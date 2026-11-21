// We read one blob at a time via Blob.slice().arrayBuffer() rather than
// pulling the entire file into a single ArrayBuffer. Why: ArrayBuffer is
// capped at ~2 GiB in V8, and garden.foam-sized scenes exceed that. Each
// individual blob is ≤ maxStorageBufferBindingSize (we validate this in
// the pre-flight check), so per-blob slices are always safe.

export const FOAM_MAGIC = 0x464F414D; // "FOAM"
export const FOAM_VERSION_MIN = 2;
export const FOAM_VERSION_MAX = 4;
// V2 header is 116 B. V3 appends an explicit `has_specular` u32 at offset 116
// (header 120 B). V4 keeps the 120 B header but shrinks the blobs losslessly:
// octmaps store tight RGB (3 f16/texel, not RGBA — the 4th channel was always
// zero) and adjacent_diff is dropped (it equals points[neighbor]−points[self],
// recomputed on load). The loader re-pads / recomputes both for the GPU.
const HEADER_BYTES_V2 = 116;
const HEADER_BYTES_V3 = 120;

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function parseHeader(buffer) {
  if (buffer.byteLength < HEADER_BYTES_V2) {
    throw new Error(`file too small for .foam header (${buffer.byteLength} B)`);
  }
  const u32 = new Uint32Array(buffer, 0, 11);
  const f32 = new Float32Array(buffer, 0, 29);

  const magic = u32[0];
  if (magic !== FOAM_MAGIC) {
    throw new Error(
      `bad magic 0x${magic.toString(16).padStart(8, '0')} — not a .foam file`,
    );
  }
  const version = u32[1];
  if (version < FOAM_VERSION_MIN || version > FOAM_VERSION_MAX) {
    throw new Error(
      `unsupported .foam version ${version} (expected ${FOAM_VERSION_MIN}–${FOAM_VERSION_MAX})`,
    );
  }

  const R_s = u32[7];
  // V2 infers specular presence from R_s; V3 carries an explicit flag at
  // byte 116 (and so its blobs start at 120 instead of 116).
  let headerBytes = HEADER_BYTES_V2;
  let hasSpecular = R_s > 0;
  if (version >= 3) {
    if (buffer.byteLength < HEADER_BYTES_V3) {
      throw new Error(`file too small for .foam V3 header (${buffer.byteLength} B)`);
    }
    headerBytes = HEADER_BYTES_V3;
    hasSpecular = new Uint32Array(buffer, 116, 1)[0] !== 0;
  }

  // V4 stores octmaps as tight RGB and drops the adjacent_diff blob; earlier
  // versions store RGBA octmaps and ship adjacent_diff. These two flags drive
  // the blob plan + upload paths below.
  const octChannels = version >= 4 ? 3 : 4;
  const hasAdjacentDiffBlob = version < 4;

  return {
    version,
    headerBytes,
    hasSpecular,
    octChannels,
    hasAdjacentDiffBlob,
    numPoints: u32[2],
    numPoses: u32[3],
    adjacencySize: u32[4],
    adjacentDiffSize: u32[5],
    R_d: u32[6],
    R_s,
    weightThreshold: f32[8],
    cellSkipThreshold: f32[9],
    maxIntersections: u32[10],
    defaultPose: new Float32Array(buffer, 44, 12).slice(),
    aabbMin: new Float32Array(buffer, 92, 3).slice(),
    aabbMax: new Float32Array(buffer, 104, 3).slice(),
  };
}

function blobPlan(h) {
  const C = h.octChannels; // 3 (V4, tight RGB) or 4 (V2/V3, RGBA)
  const plan = [
    { name: 'points',  bytes: h.numPoints * 3 * 4 },                  // f32, padded on upload
    { name: 'density', bytes: h.numPoints * 4 },                      // f32
    { name: 'diffuse', bytes: h.numPoints * h.R_d * h.R_d * C * 2 },  // f16, C channels/texel
  ];
  if (h.hasSpecular) {
    plan.push({ name: 'specular', bytes: h.numPoints * h.R_s * h.R_s * C * 2 });
  }
  plan.push(
    { name: 'adjacency',         bytes: h.adjacencySize * 4 },        // u32
    { name: 'adjacency_offsets', bytes: (h.numPoints + 1) * 4 },      // u32
  );
  if (h.hasAdjacentDiffBlob) {
    plan.push({ name: 'adjacent_diff', bytes: h.adjacentDiffSize * 4 * 2 }); // f16 vec4
  }
  plan.push({ name: 'poses', bytes: h.numPoses * 12 * 4 });          // f32
  return plan;
}

// f32 → IEEE-754 half (round-to-nearest-even), returned as a u16. Only used by
// the V4 adjacent_diff recompute when the engine lacks Float16Array (Chrome
// <135); modern Chrome takes the native Float16Array path below.
const _f2h_f32 = new Float32Array(1);
const _f2h_u32 = new Uint32Array(_f2h_f32.buffer);
function floatToHalf(val) {
  _f2h_f32[0] = val;
  const x = _f2h_u32[0];
  const sign = (x >>> 16) & 0x8000;
  let exp = (x >>> 23) & 0xff;
  let mant = x & 0x7fffff;
  if (exp === 0xff) return sign | 0x7c00 | (mant ? 0x200 : 0); // inf / nan
  exp = exp - 127 + 15;
  if (exp >= 0x1f) return sign | 0x7c00;                       // overflow → inf
  if (exp <= 0) {                                              // subnormal / zero
    if (exp < -10) return sign;
    mant |= 0x800000;
    const shift = 14 - exp;
    let half = mant >>> shift;
    if ((mant >>> (shift - 1)) & 1) half += 1;                 // round to nearest
    return sign | half;
  }
  let half = (exp << 10) | (mant >>> 13);
  if (mant & 0x1000) half += 1;                                // round to nearest
  return sign | half;
}

// Recompute the dropped V4 adjacent_diff into a vec4<f16> storage buffer the
// kernel reads unchanged. adjacent_diff[n] = points[neighbor] − points[self]
// (the Voronoi face normal); the kernel indexes it by the same flattened
// neighbor index n ∈ [offsets[i], offsets[i+1]). Validated bit-exact against the
// shipped V3 blob (see bench/transcode_v4.py --verify).
function buildAdjacentDiff(device, points, adjacency, offsets, numPoints, adjacencySize) {
  const bytes = adjacencySize * 4 * 2; // vec4<f16>; padding entries stay 0
  const native = typeof Float16Array !== 'undefined';
  return uploadStorageBuffer(device, 'adjacent_diff', bytes, (mapped) => {
    const dst = native ? new Float16Array(mapped) : new Uint16Array(mapped);
    for (let i = 0; i < numPoints; i++) {
      const px = points[i * 3], py = points[i * 3 + 1], pz = points[i * 3 + 2];
      const begin = offsets[i], end = offsets[i + 1];
      for (let n = begin; n < end; n++) {
        const b = adjacency[n] * 3;
        const dx = points[b] - px, dy = points[b + 1] - py, dz = points[b + 2] - pz;
        if (native) { dst[n * 4] = dx; dst[n * 4 + 1] = dy; dst[n * 4 + 2] = dz; }
        else { dst[n * 4] = floatToHalf(dx); dst[n * 4 + 1] = floatToHalf(dy); dst[n * 4 + 2] = floatToHalf(dz); }
      }
    }
  });
}

function uploadStorageBuffer(device, label, byteCount, fillFn) {
  const buf = device.createBuffer({
    label,
    size: Math.max(byteCount, 4),
    usage: GPUBufferUsage.STORAGE,
    mappedAtCreation: true,
  });
  fillFn(buf.getMappedRange());
  buf.unmap();
  return buf;
}

// `source` is a Blob — File works directly, and a fetched scene can be
// wrapped via response.blob() to share this path.
export async function loadFoam(source, device, onProgress = () => {}) {
  const report = async (e) => { await onProgress(e); };

  await report({ phase: 'header', message: 'parsing header' });
  const headerBuf = await source.slice(0, HEADER_BYTES_V3).arrayBuffer();
  const h = parseHeader(headerBuf);

  const plan = blobPlan(h);
  const totalBlobBytes = plan.reduce((s, b) => s + b.bytes, 0);
  const expectedFileSize = h.headerBytes + totalBlobBytes;
  if (source.size < expectedFileSize) {
    throw new Error(
      `file truncated: header expects ${fmtBytes(expectedFileSize)}, ` +
      `got ${fmtBytes(source.size)}`,
    );
  }

  const maxBinding = device.limits.maxStorageBufferBindingSize;
  for (const b of plan) {
    if (b.bytes > maxBinding) {
      throw new Error(
        `${b.name} blob is ${fmtBytes(b.bytes)} but this device caps a ` +
        `single storage buffer at ${fmtBytes(maxBinding)}. ` +
        `Try a smaller scene (fewer points or lower octmap R).`,
      );
    }
  }

  const sizeReport = plan.map((b) => `${b.name}=${fmtBytes(b.bytes)}`).join(' ');
  await report({
    phase: 'plan',
    message: `N=${h.numPoints} R_d=${h.R_d} R_s=${h.R_s} | ${sizeReport}`,
  });

  let cursor = h.headerBytes;
  const out = { header: h, buffers: {} };

  // Read N bytes starting at `cursor` and return as Uint8Array. Caller
  // advances cursor.
  async function readBlob(bytes) {
    return new Uint8Array(await source.slice(cursor, cursor + bytes).arrayBuffer());
  }

  // points: read N×3 f32, write N×4 f32 (pad with 0 for vec4 alignment).
  {
    const bytes = h.numPoints * 3 * 4;
    await report({ phase: 'upload', message: `points (${fmtBytes(h.numPoints * 16)} padded)` });
    const blob = await readBlob(bytes);
    const src = new Float32Array(blob.buffer, blob.byteOffset, h.numPoints * 3);
    cursor += bytes;
    out.buffers.points = uploadStorageBuffer(device, 'points', h.numPoints * 16, (mapped) => {
      const dst = new Float32Array(mapped);
      for (let i = 0; i < h.numPoints; i++) {
        dst[i * 4 + 0] = src[i * 3 + 0];
        dst[i * 4 + 1] = src[i * 3 + 1];
        dst[i * 4 + 2] = src[i * 3 + 2];
      }
    });
    out.pointsHost = new Float32Array(src); // copy for CPU kNN later
  }

  const passthrough = async (name, bytes) => {
    await report({ phase: 'upload', message: `${name} (${fmtBytes(bytes)})` });
    const src = await readBlob(bytes);
    cursor += bytes;
    return uploadStorageBuffer(device, name, bytes, (mapped) => {
      new Uint8Array(mapped).set(src);
    });
  };

  // Like passthrough, but also returns a host-side Uint32 view (the bytes are
  // already in RAM during upload). Used for the CPU start-cell graph walk.
  const passthroughU32Host = async (name, bytes) => {
    await report({ phase: 'upload', message: `${name} (${fmtBytes(bytes)})` });
    const src = await readBlob(bytes);
    cursor += bytes;
    const buffer = uploadStorageBuffer(device, name, bytes, (mapped) => {
      new Uint8Array(mapped).set(src);
    });
    return { buffer, host: new Uint32Array(src.buffer, src.byteOffset, bytes / 4) };
  };

  // Upload an octahedral map. The kernel binds vec4<f16>; V2/V3 store RGBA
  // (passthrough), V4 stores tight RGB and we re-pad to RGBA (w=0) here. The
  // mapped buffer is zero-initialised, so we only write the 3 RGB lanes.
  const uploadOctmap = async (name, R) => {
    const texels = h.numPoints * R * R;
    if (h.octChannels === 4) return passthrough(name, texels * 4 * 2);
    const bytes = texels * 3 * 2;
    await report({ phase: 'upload', message: `${name} (${fmtBytes(texels * 4 * 2)} padded from RGB)` });
    const blob = await readBlob(bytes);
    const src = new Uint16Array(blob.buffer, blob.byteOffset, texels * 3);
    cursor += bytes;
    return uploadStorageBuffer(device, name, texels * 4 * 2, (mapped) => {
      const dst = new Uint16Array(mapped);
      for (let t = 0; t < texels; t++) {
        dst[t * 4] = src[t * 3]; dst[t * 4 + 1] = src[t * 3 + 1]; dst[t * 4 + 2] = src[t * 3 + 2];
      }
    });
  };

  out.buffers.density = await passthrough('density', h.numPoints * 4);
  out.buffers.diffuse = await uploadOctmap('diffuse', h.R_d);

  if (h.hasSpecular) {
    out.buffers.specular = await uploadOctmap('specular', h.R_s);
    out.hasSpecular = true;
  } else {
    await report({ phase: 'upload', message: 'specular omitted (diffuse-only scene)' });
    out.buffers.specular = uploadStorageBuffer(device, 'specular-dummy', 8, () => {});
    out.hasSpecular = false;
  }

  {
    const a = await passthroughU32Host('adjacency', h.adjacencySize * 4);
    out.buffers.adjacency = a.buffer;
    out.adjacencyHost = a.host;
    const o = await passthroughU32Host('adjacency_offsets', (h.numPoints + 1) * 4);
    out.buffers.adjacencyOffsets = o.buffer;
    out.adjacencyOffsetsHost = o.host;
  }

  // adjacent_diff: V2/V3 ship the blob; V4 drops it and we recompute from the
  // points + adjacency we just loaded (host copies kept for the start-cell walk).
  if (h.hasAdjacentDiffBlob) {
    out.buffers.adjacentDiff = await passthrough('adjacent_diff', h.adjacentDiffSize * 4 * 2);
  } else {
    await report({ phase: 'compute', message: 'recomputing adjacent_diff from adjacency' });
    out.buffers.adjacentDiff = buildAdjacentDiff(
      device, out.pointsHost, out.adjacencyHost, out.adjacencyOffsetsHost,
      h.numPoints, h.adjacencySize,
    );
  }

  {
    const bytes = h.numPoses * 12 * 4;
    await report({ phase: 'upload', message: `poses (${fmtBytes(bytes)})` });
    const blob = await readBlob(bytes);
    cursor += bytes;
    out.buffers.poses = uploadStorageBuffer(device, 'poses', Math.max(bytes, 4), (mapped) => {
      new Uint8Array(mapped).set(blob);
    });
    out.posesHost = new Float32Array(blob.buffer, blob.byteOffset, h.numPoses * 12).slice();
  }

  if (cursor !== source.size) {
    console.warn(
      `[foam] trailing ${source.size - cursor} B in file after declared blobs`,
    );
  }

  await report({ phase: 'done', message: 'scene uploaded' });
  return out;
}

export { fmtBytes };
