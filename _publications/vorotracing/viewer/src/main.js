import { initWebGPU, describeAdapter } from './support.js';
import { createHud, installDropZone, createTweaks } from './hud.js';
import { loadFoam, fmtBytes } from './foam-loader.js';
import { fromDefaultPose, resetCamera, applyInput, toggleProjection, setSceneUp, setFov, fovMaxFor, sceneUpFromAllPoses, writeUniform, UNIFORM_BYTES, PROJECTION_NAMES, PROJ_PINHOLE, PROJ_FISHEYE, DEFAULT_FOV_DEG } from './camera.js';

// Cycle of scene-up axes when the user presses U. Auto-derivation from
// the default pose is the initial state; pressing U thereafter overrides.
const SCENE_UP_CYCLE = [
  { name: '+Y', v: [0, 1, 0] },
  { name: '-Y', v: [0, -1, 0] },
  { name: '+Z', v: [0, 0, 1] },
  { name: '-Z', v: [0, 0, -1] },
  { name: '+X', v: [1, 0, 0] },
  { name: '-X', v: [-1, 0, 0] },
];
let sceneUpIdx = -1; // -1 = auto-derived from pose
import { findStartPoint, walkStartPoint } from './start-point.js';
import { createInput } from './input.js';

const MODEL_BASE_URL = 'https://huggingface.co/bertaveira/vorotracing/resolve/main/mipnerf360';
const GALLERY_MODELS = [
  ['Garden', 1696743940],
  ['Bicycle', 1696970700],
  ['Bonsai', 1697325668],
  ['Counter', 1697035476],
  ['Kitchen', 1696939284],
  ['Room', 1697015588],
  ['Stump', 1696841252],
].map(([name, bytes]) => ({
  name,
  url: `${MODEL_BASE_URL}/${name.toLowerCase()}.foam`,
  size: fmtBytes(bytes),
}));

const canvas = document.getElementById('view');
const hud = createHud();

const { adapter, device, format } = await initWebGPU();
const ctx = canvas.getContext('webgpu');
ctx.configure({ device, format, alphaMode: 'opaque' });

// Module-relative so the viewer works wherever it is mounted, including a
// nested path served without a trailing slash.
const blitWgsl = await fetch(new URL('kernels/blit.wgsl', import.meta.url)).then((r) => r.text());
const foamWgsl = await fetch(new URL('kernels/foam.wgsl', import.meta.url)).then((r) => r.text());

const gradientWgsl = /* wgsl */ `
  @group(0) @binding(0) var dst: texture_storage_2d<rgba16float, write>;
  @compute @workgroup_size(8, 8, 1)
  fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dim = textureDimensions(dst);
    if (gid.x >= dim.x || gid.y >= dim.y) { return; }
    let uv = vec2<f32>(gid.xy) / vec2<f32>(dim);
    textureStore(dst, vec2<i32>(gid.xy), vec4<f32>(uv.x, uv.y, 1.0 - uv.x, 1.0));
  }
`;

const gradientPipeline = device.createComputePipeline({
  label: 'gradient',
  layout: 'auto',
  compute: { module: device.createShaderModule({ code: gradientWgsl }), entryPoint: 'cs_main' },
});

// Foam pipelines are keyed by (workgroup shape × specular). The viewer only
// uses 8×8; the workgroup override exists for the headless bench
// (bench/foam_bench.py) to sweep tile shapes. Specular is a compile-time
// override, so the diffuse-only variant is fully DCE'd. An explicit bind-group
// layout (incl. binding 8) is shared by every variant, so one foam bind group
// works for all of them regardless of which bindings a variant references.
// Octmap resolutions are baked into the WGSL as true `const`s (not override
// constants) per scene. This is the big shading win: with a literal R the
// frontend folds `%R` / `/R` in oct_wrap_index to `&(R-1)` / `>>log2(R)`.
// Override constants compile to Metal *function constants* on Dawn, which the
// Metal compiler does NOT reduce to bit-ops — so the speedup is lost in the
// browser unless R is a genuine compile-time literal. Modules cached per R.
const foamModuleCache = new Map(); // "rDiff,rSpec" -> GPUShaderModule
function foamModuleFor(rDiff, rSpec) {
  const key = `${rDiff},${rSpec}`;
  let m = foamModuleCache.get(key);
  if (!m) {
    const src = foamWgsl
      .replace('override oct_r_diff: u32 = 8u;', `const oct_r_diff: u32 = ${rDiff}u;`)
      .replace('override oct_r_spec: u32 = 8u;', `const oct_r_spec: u32 = ${rSpec}u;`);
    m = device.createShaderModule({ code: src, label: `foam-r${key}` });
    foamModuleCache.set(key, m);
  }
  return m;
}

const COMPUTE = GPUShaderStage.COMPUTE;
const foamBGL = device.createBindGroupLayout({
  label: 'foam-bgl',
  entries: [
    { binding: 0, visibility: COMPUTE, buffer: { type: 'uniform' } },
    { binding: 1, visibility: COMPUTE, buffer: { type: 'read-only-storage' } },
    { binding: 2, visibility: COMPUTE, buffer: { type: 'read-only-storage' } },
    { binding: 3, visibility: COMPUTE, buffer: { type: 'read-only-storage' } },
    { binding: 4, visibility: COMPUTE, buffer: { type: 'read-only-storage' } },
    { binding: 5, visibility: COMPUTE, buffer: { type: 'read-only-storage' } },
    { binding: 6, visibility: COMPUTE, buffer: { type: 'read-only-storage' } },
    { binding: 7, visibility: COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } },
    { binding: 8, visibility: COMPUTE, buffer: { type: 'read-only-storage' } },
  ],
});
const foamPL = device.createPipelineLayout({ bindGroupLayouts: [foamBGL] });
const foamPipelineCache = new Map(); // "wgX,wgY,spec" -> { pipeline, wgX, wgY }

function makeFoamPipeline(wgX, wgY, spec, rDiff, rSpec) {
  const key = `${wgX},${wgY},${spec ? 1 : 0},${rDiff},${rSpec}`;
  let entry = foamPipelineCache.get(key);
  if (!entry) {
    const pipeline = device.createComputePipeline({
      label: `foam-${key}`,
      layout: foamPL,
      compute: { module: foamModuleFor(rDiff, rSpec), entryPoint: 'cs_main',
                 constants: { wg_x: wgX, wg_y: wgY, use_specular_c: spec ? 1 : 0 } },
    });
    entry = { pipeline, wgX, wgY };
    foamPipelineCache.set(key, entry);
  }
  return entry;
}

// The live render uses the default 8×8 tile, picking the specular variant when
// the user enables it on a scene that has a specular map. Octmap resolutions
// are baked in as compile-time constants (the big shading speedup).
function currentFoamEntry() {
  const spec = !!(scene && scene.hasSpecular && quality.specular);
  return makeFoamPipeline(8, 8, spec, scene.header.R_d, scene.header.R_s || 8);
}

const blitModule = device.createShaderModule({ code: blitWgsl, label: 'blit' });
const blitPipeline = device.createRenderPipeline({
  label: 'blit',
  layout: 'auto',
  vertex: { module: blitModule, entryPoint: 'vs' },
  fragment: { module: blitModule, entryPoint: 'fs', targets: [{ format }] },
  primitive: { topology: 'triangle-list' },
});

const cameraBuf = device.createBuffer({
  label: 'camera',
  size: UNIFORM_BYTES,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
const cameraStaging = new ArrayBuffer(UNIFORM_BYTES);

let storageTex = null;
let gradientBG = null;
let foamBG     = null;
let blitBG     = null;
let scene  = null;
let camera = null;
// Constant default — scene-aware scaling was misleading for scenes with
// degenerate AABBs (e.g. garden's Y extends thousands of units into
// underground cells). Shift gives 10× for fast travel.
const baseSpeed = 3.0;
let cachedStartPoint = -1;
const cachedOrigin = new Float32Array(3);

const input = createInput(canvas);

// --- Settings (resolution cap + the on-screen panel) ---

// Cap the longest render dimension so 4K / ultrawide windows don't melt
// the GPU. The canvas still fills the viewport via CSS; the smaller
// buffer is upscaled by the compositor. Infinity = render at native size.
let maxRenderDim = 1920;

// Render-quality knobs written into the camera uniform. Defaults: skip
// near-zero-contribution shading + terminate rays at 1% transmittance —
// measured ~1.10× faster, visually lossless (PSNR ~53 dB). `specular` adds
// the view-independent specular octmap (gated on scene.hasSpecular), on by
// default for the best-looking result.
const quality = { cellSkip: 1e-3, weightThreshold: 0.01, specular: true };

// Settings panel. FOV + projection drive the camera; resolution drives
// the render cap. onChange guards on `camera` since it's null pre-load.
const tweaks = createTweaks(
  { fov: DEFAULT_FOV_DEG, projection: 'pinhole', resolution: '1920', specular: 'on' },
  [
    { label: 'camera', keys: [
      { key: 'fov', label: 'fov', type: 'range', min: 5, max: fovMaxFor(PROJ_PINHOLE), step: 1 },
      { key: 'projection', label: 'lens', type: 'select', options: [
        { value: 'pinhole', label: 'pinhole' },
        { value: 'fisheye', label: 'fisheye' },
      ]},
      { key: 'specular', label: 'spec', type: 'select', options: [
        { value: 'on', label: 'on' },
        { value: 'off', label: 'off' },
      ]},
    ]},
    { label: 'render', keys: [
      { key: 'resolution', label: 'maxpx', type: 'select', options: [
        { value: '1280', label: '1280' },
        { value: '1920', label: '1920' },
        { value: '2560', label: '2560' },
        { value: '3200', label: '3200' },
        { value: 'native', label: 'native' },
      ]},
    ]},
  ],
  (p) => {
    if (p.fov !== undefined && camera) setFov(camera, p.fov);
    if (p.projection !== undefined && camera) {
      const want = p.projection === 'fisheye' ? PROJ_FISHEYE : PROJ_PINHOLE;
      if (camera.projection !== want) toggleProjection(camera);
      syncProjectionUi();
    }
    if (p.resolution !== undefined) {
      maxRenderDim = p.resolution === 'native' ? Infinity : Number(p.resolution);
    }
    if (p.specular !== undefined) { quality.specular = p.specular === 'on'; lastRender.w = 0; }
  },
);

// Push the camera's current projection + FOV bounds into the panel. Called
// after the `F` key or a projection change so the slider max and the
// lens dropdown stay truthful.
function syncProjectionUi() {
  if (!camera) return;
  tweaks.setRange('fov', 5, fovMaxFor(camera.projection));
  tweaks.setValues({
    fov: camera.fovDeg,
    projection: PROJECTION_NAMES[camera.projection],
  });
}

// Strided mean of the host point cloud — the orbit pivot's depth. Sampling
// ~100k points keeps it sub-millisecond even on multi-million-point scenes.
function computeCentroid(pointsHost) {
  const N = (pointsHost.length / 3) | 0;
  if (N === 0) return null;
  const stride = Math.max(1, Math.floor(N / 100000));
  let sx = 0, sy = 0, sz = 0, c = 0;
  for (let i = 0; i < N; i += stride) {
    const b = i * 3;
    sx += pointsHost[b]; sy += pointsHost[b + 1]; sz += pointsHost[b + 2];
    c++;
  }
  return new Float32Array([sx / c, sy / c, sz / c]);
}

// State of the last actual render — used to skip GPU work entirely when
// nothing visible has changed. yaw + pitch fully determine the rotation
// (no roll exists), so two scalars replace the 9-element rot comparison.
const lastRender = {
  ox: NaN, oy: NaN, oz: NaN,
  yaw: NaN, pitch: NaN,
  start: -1,
  w: 0, h: 0,
  fov: 0,
  projection: -1,
};

function stateUnchanged() {
  if (canvas.width !== lastRender.w || canvas.height !== lastRender.h) return false;
  if (cachedStartPoint !== lastRender.start) return false;
  if (camera.origin[0] !== lastRender.ox) return false;
  if (camera.origin[1] !== lastRender.oy) return false;
  if (camera.origin[2] !== lastRender.oz) return false;
  if (camera.yaw !== lastRender.yaw) return false;
  if (camera.pitch !== lastRender.pitch) return false;
  if (camera.fovDeg !== lastRender.fov) return false;
  if (camera.projection !== lastRender.projection) return false;
  return true;
}

function captureRenderState() {
  lastRender.w = canvas.width;
  lastRender.h = canvas.height;
  lastRender.start = cachedStartPoint;
  lastRender.ox = camera.origin[0];
  lastRender.oy = camera.origin[1];
  lastRender.oz = camera.origin[2];
  lastRender.yaw = camera.yaw;
  lastRender.pitch = camera.pitch;
  lastRender.fov = camera.fovDeg;
  lastRender.projection = camera.projection;
}

// Build a foam bind group against the shared explicit layout — valid for
// every pipeline variant (workgroup shape × specular).
function makeFoamBindGroup() {
  if (!scene || !storageTex) return null;
  return device.createBindGroup({
    layout: foamBGL,
    entries: [
      { binding: 0, resource: { buffer: cameraBuf } },
      { binding: 1, resource: { buffer: scene.buffers.points } },
      { binding: 2, resource: { buffer: scene.buffers.density } },
      { binding: 3, resource: { buffer: scene.buffers.diffuse } },
      { binding: 4, resource: { buffer: scene.buffers.adjacency } },
      { binding: 5, resource: { buffer: scene.buffers.adjacencyOffsets } },
      { binding: 6, resource: { buffer: scene.buffers.adjacentDiff } },
      { binding: 7, resource: storageTex.createView() },
      { binding: 8, resource: { buffer: scene.buffers.specular } },
    ],
  });
}

function rebuildFoamBindGroup() {
  foamBG = makeFoamBindGroup();
}

function ensureStorageTexture(w, h) {
  if (storageTex && storageTex.width === w && storageTex.height === h) return;
  if (storageTex) storageTex.destroy();
  storageTex = device.createTexture({
    label: 'compute-target',
    size: { width: w, height: h },
    format: 'rgba16float',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
  });
  const view = storageTex.createView();
  gradientBG = device.createBindGroup({
    layout: gradientPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: view }],
  });
  blitBG = device.createBindGroup({
    layout: blitPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: view }],
  });
  rebuildFoamBindGroup();
}

function resizeToDisplay() {
  // Render at 1:1 with CSS pixels (not DPR-scaled). On a Retina display
  // this is 4× fewer rays than DPR=2 and lets the macOS compositor
  // breathe — without it a 2M-point scene starves the OS.
  const dpr = 1.0;
  let w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  let h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  // Clamp the longest dimension to maxRenderDim (preserve aspect). The CSS
  // size is unchanged, so the smaller buffer upscales to fill the window.
  const longest = Math.max(w, h);
  if (longest > maxRenderDim) {
    const s = maxRenderDim / longest;
    w = Math.max(1, Math.floor(w * s));
    h = Math.max(1, Math.floor(h * s));
  }
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ensureStorageTexture(canvas.width, canvas.height);
}

const frameTimes = new Float32Array(60);
let frameIdx = 0;
let validFrames = 0; // how many slots in frameTimes hold real intervals
let lastTs = performance.now();
let lastRenderTs = performance.now(); // for FPS / idle detection

// Back-pressure: at most one frame in flight on the GPU at a time, and the loop
// is driven by requestAnimationFrame so every presented frame aligns to a vsync
// tick. Without the back-pressure, rAF fires every ~16 ms while a kernel takes
// hundreds of ms; command buffers pile up, the queue grows unbounded, and the
// macOS compositor starves. We deliberately do NOT free-run (resubmit the moment
// the GPU finishes): the canvas is presented on a fixed vsync cadence, so
// off-vsync completions get shown at uneven 1-/2-vsync intervals — visible
// judder — even though the average frame rate looks higher. Vsync-aligned
// pacing trades a higher FPS number for a smooth, evenly-paced image, which is
// what actually matters for a viewer.
let frameInFlight = false;

// GPU-time readout for the HUD. timestamp-query is optional; when present we
// time the foam compute pass (one mapAsync in flight at a time) and show a
// lightly-smoothed millisecond figure — a truthful compute cost, unlike the
// vsync/rAF-influenced FPS counter.
const hasTimestamp = device.features.has('timestamp-query');
let tsQuerySet = null, tsResolve = null, tsRead = null, tsPending = false, gpuMs = 0;
if (hasTimestamp) {
  tsQuerySet = device.createQuerySet({ type: 'timestamp', count: 2 });
  tsResolve = device.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
  tsRead = device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
}

function sceneSummary() {
  if (!scene) return '';
  const h = scene.header;
  const hint = input.isDragging()
    ? (input.isPanning() ? '        (panning…)' : '        (orbiting…)')
    : '        (drag orbit; right-drag pan; wheel dolly; WASD QE move; −/= fov; Shift fast; R reset; F proj; U up-axis)';
  const upLabel = sceneUpIdx < 0
    ? `auto (${[...camera.sceneUp].map((v) => v.toFixed(2)).join(', ')})`
    : SCENE_UP_CYCLE[sceneUpIdx].name;
  return [
    ``,
    `scene   N=${h.numPoints.toLocaleString()} M=${h.adjacencySize.toLocaleString()}`,
    `        R_d=${h.R_d} R_s=${h.R_s}${scene.hasSpecular ? '' : ' (diffuse-only file)'}`,
    `        spec: ${!scene.hasSpecular ? 'n/a' : (quality.specular ? 'on' : 'off')}`,
    `cam     pos=${[...camera.origin].map((v) => v.toFixed(1)).join(', ')}  fov=${camera.fovDeg.toFixed(1)}°`,
    `        proj=${PROJECTION_NAMES[camera.projection]}  up=${upLabel}`,
    `        start=${cachedStartPoint}  speed=${(baseSpeed * camera.speedMul).toFixed(2)}/s`,
    hint,
  ].join('\n');
}

function updateHud() {
  const idle = (performance.now() - lastRenderTs) > 500;
  let fpsStr;
  if (idle) {
    fpsStr = '   idle';
  } else if (validFrames > 0) {
    let sum = 0;
    for (let i = 0; i < validFrames; i++) sum += frameTimes[i];
    const fps = validFrames / (sum / 1000);
    fpsStr = `${fps.toFixed(0).padStart(3)} fps`;
  } else {
    fpsStr = '    --';
  }
  const gpuStr = (hasTimestamp && gpuMs > 0) ? `   gpu ${gpuMs.toFixed(1)}ms` : '';
  hud.setStatus(
    `${fpsStr}   ${canvas.width}x${canvas.height}${gpuStr}\n` +
    describeAdapter(adapter, device) +
    sceneSummary(),
  );
}

// Drop the cached start cell so the next recompute does a full O(N) scan.
// Called on every discontinuous camera jump (load, reset) — see below.
function invalidateStartCell() {
  cachedStartPoint = -1;
  cachedOrigin.fill(NaN);
}

// The per-frame "which cell is the camera origin in?" query. Two regimes:
//   • discontinuity (first frame, scene load, reset) — cachedStartPoint < 0, so
//     we do an exact O(N) brute scan. ~2 ms at 2M; runs once per jump.
//   • continuous motion (orbit / fly / dolly) — greedy-descend the adjacency
//     graph from last frame's cell. The origin moved a hair, so it's 0–2 hops
//     (~60 ns). This is the same graph + descent the ray-march itself relies
//     on, so it's exact whenever the renderer is. Invalidating on every jump
//     means the walk only ever runs in the small-move regime it's exact for.
function maybeRecomputeStartPoint() {
  if (!scene || !camera) return;
  const ox = camera.origin[0], oy = camera.origin[1], oz = camera.origin[2];
  if (cachedStartPoint >= 0 && cachedOrigin[0] === ox && cachedOrigin[1] === oy && cachedOrigin[2] === oz) {
    return;
  }
  cachedStartPoint = cachedStartPoint >= 0
    ? walkStartPoint(scene.pointsHost, scene.adjacencyHost, scene.adjacencyOffsetsHost, cachedStartPoint, ox, oy, oz)
    : findStartPoint(scene.pointsHost, ox, oy, oz);
  cachedOrigin[0] = ox; cachedOrigin[1] = oy; cachedOrigin[2] = oz;
}

function uploadCamera() {
  const q = {
    cellSkip: quality.cellSkip,
    weightThreshold: quality.weightThreshold,
    useSpecular: quality.specular && scene.hasSpecular,
  };
  writeUniform(cameraStaging, camera, scene, canvas.width, canvas.height, cachedStartPoint, q);
  device.queue.writeBuffer(cameraBuf, 0, cameraStaging);
}

function frame() {
  if (frameInFlight) {
    // GPU still chewing on the previous frame — don't pile up more work.
    requestAnimationFrame(frame);
    return;
  }

  const now = performance.now();
  // Clamp dt: long stalls (debugger, idle, tab in background) shouldn't
  // catapult the camera into the next county on resume.
  const dt = Math.min((now - lastTs) / 1000, 0.1);
  lastTs = now;

  resizeToDisplay();

  // Input is always processed so movement starts the instant a key is
  // pressed — even from an idle state where we'd otherwise be skipping.
  if (scene && camera) {
    applyInput(camera, baseSpeed, dt, input);
    if (input.consumePress('KeyR')) {
      resetCamera(camera, scene.header.defaultPose);
      invalidateStartCell(); // big jump back to default pose → re-brute, don't walk
      sceneUpIdx = -1;
      syncProjectionUi();
    }
    if (input.consumePress('KeyF')) { toggleProjection(camera); syncProjectionUi(); }
    if (input.consumePress('KeyU')) {
      sceneUpIdx = (sceneUpIdx + 1) % SCENE_UP_CYCLE.length;
      setSceneUp(camera, SCENE_UP_CYCLE[sceneUpIdx].v);
    }

    // Continuous FOV on −/= (the wheel now dollies). Shift = faster. Mirror
    // the new value back into the panel slider.
    let fovDir = 0;
    if (input.isDown('Equal')) fovDir += 1; // = / +  → wider
    if (input.isDown('Minus')) fovDir -= 1; // −      → narrower
    if (fovDir !== 0) {
      const turbo = (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) ? 3 : 1;
      setFov(camera, camera.fovDeg + fovDir * 40 * turbo * dt);
      tweaks.setValues({ fov: camera.fovDeg });
    }
    maybeRecomputeStartPoint();

    if (stateUnchanged()) {
      // Identical to last presented frame; skip GPU work, keep HUD live.
      updateHud();
      requestAnimationFrame(frame);
      return;
    }
    captureRenderState();
    uploadCamera();
  }

  // Track render-rate stats only over actually-rendered frames.
  const renderDt = now - lastRenderTs;
  lastRenderTs = now;
  if (renderDt < 500) {
    frameTimes[frameIdx] = renderDt;
    frameIdx = (frameIdx + 1) % frameTimes.length;
    if (validFrames < frameTimes.length) validFrames++;
  } else {
    // Resumed from idle — old FPS samples are stale, reset.
    validFrames = 0;
    frameIdx = 0;
  }

  const encoder = device.createCommandEncoder();
  let timedThisFrame = false;
  if (scene && camera) {
    const fe = currentFoamEntry();
    // Time just the foam compute pass on the GPU (one reading in flight).
    timedThisFrame = hasTimestamp && !tsPending;
    const cpass = encoder.beginComputePass(timedThisFrame
      ? { label: 'foam', timestampWrites: { querySet: tsQuerySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 } }
      : { label: 'foam' });
    cpass.setPipeline(fe.pipeline);
    cpass.setBindGroup(0, foamBG);
    cpass.dispatchWorkgroups(
      Math.ceil(canvas.width / fe.wgX),
      Math.ceil(canvas.height / fe.wgY),
      1,
    );
    cpass.end();
    if (timedThisFrame) {
      encoder.resolveQuerySet(tsQuerySet, 0, 2, tsResolve, 0);
      encoder.copyBufferToBuffer(tsResolve, 0, tsRead, 0, 16);
    }
  } else {
    const cpass = encoder.beginComputePass({ label: 'gradient' });
    cpass.setPipeline(gradientPipeline);
    cpass.setBindGroup(0, gradientBG);
    cpass.dispatchWorkgroups(
      Math.ceil(canvas.width / 8),
      Math.ceil(canvas.height / 8),
      1,
    );
    cpass.end();
  }

  const rpass = encoder.beginRenderPass({
    label: 'blit',
    colorAttachments: [{
      view: ctx.getCurrentTexture().createView(),
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
      loadOp: 'clear',
      storeOp: 'store',
    }],
  });
  rpass.setPipeline(blitPipeline);
  rpass.setBindGroup(0, blitBG);
  rpass.draw(3);
  rpass.end();

  device.queue.submit([encoder.finish()]);
  frameInFlight = true;
  device.queue.onSubmittedWorkDone().then(() => { frameInFlight = false; });

  if (timedThisFrame) {
    tsPending = true;
    tsRead.mapAsync(GPUMapMode.READ).then(() => {
      const t = new BigInt64Array(tsRead.getMappedRange().slice(0));
      tsRead.unmap();
      const ms = Number(t[1] - t[0]) / 1e6;
      if (ms > 0 && ms < 1000) gpuMs = gpuMs === 0 ? ms : gpuMs * 0.8 + ms * 0.2; // light smoothing
      tsPending = false;
    }).catch(() => { tsPending = false; });
  }

  updateHud();
  requestAnimationFrame(frame);
}

// Stream a URL into a Blob with progress. Piping through a TransformStream
// keeps the bytes browser-managed (large scenes stay disk-backed, not held
// whole in JS heap) while still reporting % from Content-Length.
async function fetchBlob(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !total) {
    onProgress('downloading…');
    return await res.blob();
  }
  let loaded = 0;
  const ts = new TransformStream({
    transform(chunk, controller) {
      loaded += chunk.byteLength;
      onProgress(`downloading ${((loaded / total) * 100).toFixed(0)}%  (${fmtBytes(loaded)} / ${fmtBytes(total)})`);
      controller.enqueue(chunk);
    },
  });
  return await new Response(res.body.pipeThrough(ts)).blob();
}

// Load a scene from a gallery card ({ url, label }), a file picker / drop
// ({ file, label }), or a raw dropped File.
async function handleSource(arg) {
  const src = arg instanceof Blob ? { file: arg, label: arg.name } : arg;
  hud.setBackVisible(false);
  hud.setLanding(true);
  hud.setLandingSubtitle(src.label ?? 'loading…');
  hud.setProgress('reading…');
  try {
    const blob = src.file ?? await fetchBlob(src.url, (m) => hud.setProgress(m));
    hud.setLandingSubtitle(`${src.label}  (${fmtBytes(blob.size)})`);
    const loaded = await loadFoam(blob, device, (e) => {
      hud.setProgress(`[${e.phase}] ${e.message}`);
      return new Promise((r) => setTimeout(r, 0));
    });
    if (scene) {
      for (const b of Object.values(scene.buffers)) b.destroy();
    }
    scene = loaded;
    const sceneUp = sceneUpFromAllPoses(scene.posesHost, scene.header.numPoses);
    const centroid = computeCentroid(scene.pointsHost);
    camera = fromDefaultPose(scene.header.defaultPose, sceneUp, centroid);
    invalidateStartCell(); // fresh scene → exact brute scan next frame
    lastRender.w = 0; // force first render
    rebuildFoamBindGroup();
    syncProjectionUi(); // reset panel to the fresh camera's fov / lens
    hud.setLanding(false);
    hud.setBackVisible(true);
    console.log('[foam] scene loaded:', scene.header);
  } catch (err) {
    console.error(err);
    hud.setProgress(`error: ${err.message}`);
  }
}

installDropZone(window, (file) => handleSource({ file, label: file.name }), hud);

// Gallery: hosted scenes plus the local file-picker tile.
hud.onBack(() => { hud.setLanding(true); hud.setBackVisible(false); });
hud.setGallery(GALLERY_MODELS, handleSource);

requestAnimationFrame(frame);
