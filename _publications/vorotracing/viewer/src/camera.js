// Upright pinhole camera. The pose is stored as two scalars (yaw, pitch)
// referenced to a frozen scene-up axis plus a yaw=0 reference forward.
// The full 3x3 rotation matrix is rebuilt from these every frame, so:
//   - "roll" has no degree of freedom — it cannot accumulate from drift.
//   - WASD moves on the ground plane regardless of pitch.
//   - Q/E moves strictly along scene-up.
//   - mouse-drag pans (yaw + pitch); pitch is clamped to avoid the
//     forward-coincident-with-up singularity.
//
// WGSL uniform layout is unchanged — see writeUniform() at the bottom.

export const DEFAULT_FOV_DEG = 60;
export const UNIFORM_BYTES = 96;
export const PROJ_PINHOLE = 0;
export const PROJ_FISHEYE = 1;
export const PROJECTION_NAMES = { 0: 'pinhole', 1: 'fisheye' };
export const MAX_ITERS_CAP = 256;

const MOUSE_SENS = 0.0025;            // rad / pixel (orbit yaw/pitch)
const PAN_SENS   = 0.0015;            // world units / pixel, per unit distance
const DOLLY_SENS = 0.0012;            // exp factor per wheel-deltaY unit
const DOLLY_MIN  = 1e-3;              // never pass through / invert at the target
const DOLLY_MAX  = 1e9;
const FOV_MIN = 5;
const PITCH_LIMIT = 1.5533;           // ≈ 89° — stay shy of the singularity
const DEFAULT_ORBIT_DIST = 4;         // fallback pivot distance if no centroid

export function fovMaxFor(projection) {
  return projection === PROJ_FISHEYE ? 180 : 150;
}

// --- Vector helpers (small, on Float32Array of length 3) ---

function vNorm(v) {
  const n = Math.hypot(v[0], v[1], v[2]);
  if (n > 0) { v[0] /= n; v[1] /= n; v[2] /= n; }
  return v;
}

function vCross(a, b, out) {
  out[0] = a[1]*b[2] - a[2]*b[1];
  out[1] = a[2]*b[0] - a[0]*b[2];
  out[2] = a[0]*b[1] - a[1]*b[0];
  return out;
}

// --- Construction ---

// Derive world-up by averaging camera +Y (image-down) over every training
// pose. For an upright handheld camera, image-down ≈ world-down, so the
// average across many views converges to the true world-down axis. Snap
// to the nearest cardinal axis when within ~18° — keeps the horizon
// perfectly level on small per-pose tilts. Falls back to the default
// pose's column 1 if no posesHost is supplied.
export function sceneUpFromAllPoses(posesHost, numPoses) {
  if (!posesHost || numPoses <= 0) return null;
  let sx = 0, sy = 0, sz = 0;
  for (let i = 0; i < numPoses; i++) {
    const b = i * 12;
    sx += posesHost[b + 1];
    sy += posesHost[b + 5];
    sz += posesHost[b + 9];
  }
  const up = new Float32Array([-sx, -sy, -sz]);
  vNorm(up);
  const CARDINALS = [
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1],
  ];
  let bestDot = 0;
  let bestAx = null;
  for (const c of CARDINALS) {
    const d = up[0]*c[0] + up[1]*c[1] + up[2]*c[2];
    if (d > bestDot) { bestDot = d; bestAx = c; }
  }
  if (bestDot > 0.95) {
    return new Float32Array(bestAx);
  }
  return up;
}

export function fromDefaultPose(defaultPose, sceneUpOverride = null, sceneCentroid = null) {
  // defaultPose: Float32Array(12), 3x4 c2w row-major.
  // Columns of R (camera basis in world):
  //   col 0 = camera +X = image right
  //   col 1 = camera +Y = image down  (≈ -sceneUp for an upright camera)
  //   col 2 = camera +Z = forward
  const origin = new Float32Array([defaultPose[3], defaultPose[7], defaultPose[11]]);
  const col1 = new Float32Array([defaultPose[1], defaultPose[5], defaultPose[9]]);
  const col2 = new Float32Array([defaultPose[2], defaultPose[6], defaultPose[10]]);

  // Prefer the all-poses average (clean cardinal axis for well-behaved
  // datasets); fall back to -col1 if no override provided.
  const sceneUp = sceneUpOverride
    ? new Float32Array(sceneUpOverride)
    : new Float32Array([-col1[0], -col1[1], -col1[2]]);
  vNorm(sceneUp);

  // fwd0 = projection of forward onto the horizontal plane, normalized.
  // If the default camera was looking straight up/down, fwd0 is degenerate
  // — fall back to any axis perpendicular to sceneUp.
  const dotFU = col2[0]*sceneUp[0] + col2[1]*sceneUp[1] + col2[2]*sceneUp[2];
  const fwd0 = new Float32Array([
    col2[0] - dotFU * sceneUp[0],
    col2[1] - dotFU * sceneUp[1],
    col2[2] - dotFU * sceneUp[2],
  ]);
  if (Math.hypot(fwd0[0], fwd0[1], fwd0[2]) < 1e-6) {
    const axIdx = Math.abs(sceneUp[0]) > Math.abs(sceneUp[1]) ? 1 : 0;
    const ax = new Float32Array(3); ax[axIdx] = 1;
    const d = ax[0]*sceneUp[0] + ax[1]*sceneUp[1] + ax[2]*sceneUp[2];
    fwd0[0] = ax[0] - d*sceneUp[0];
    fwd0[1] = ax[1] - d*sceneUp[1];
    fwd0[2] = ax[2] - d*sceneUp[2];
  }
  vNorm(fwd0);

  // right0 = fwd0 × sceneUp; chosen sign convention makes +yaw a right-turn
  // (forward rotates from fwd0 toward right0 = clockwise from above for a
  // standard Y-up world).
  const right0 = new Float32Array(3);
  vCross(fwd0, sceneUp, right0);
  vNorm(right0);

  // Decompose the default pose into (yaw=0, pitch). We pick fwd0 as the
  // yaw-zero reference, so the initial yaw is by definition 0.
  const initialPitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, Math.asin(dotFU)));

  const camera = {
    origin,
    target: new Float32Array(3),
    distance: DEFAULT_ORBIT_DIST,
    sceneCentroid: sceneCentroid ? new Float32Array(sceneCentroid) : null,
    rot: new Float32Array(9),
    fovDeg: DEFAULT_FOV_DEG,
    sceneUp,
    fwd0,
    right0,
    yaw: 0,
    pitch: initialPitch,
    speedMul: 1.0,
    projection: PROJ_PINHOLE,
  };
  rebuildRotation(camera);

  // Orbit pivot: place it along the initial view ray at the depth of the
  // scene centroid. This leaves the first-frame origin + orientation
  // exactly as the dataset's default pose, while giving drag-to-orbit a
  // sensible center. Falls back to a constant distance if no centroid.
  if (sceneCentroid) {
    const d = Math.hypot(
      sceneCentroid[0] - origin[0],
      sceneCentroid[1] - origin[1],
      sceneCentroid[2] - origin[2],
    );
    if (Number.isFinite(d) && d > 1e-4) camera.distance = d;
  }
  // forward = rot col2; target = origin + forward·distance.
  camera.target[0] = origin[0] + camera.rot[2] * camera.distance;
  camera.target[1] = origin[1] + camera.rot[5] * camera.distance;
  camera.target[2] = origin[2] + camera.rot[8] * camera.distance;
  return camera;
}

// origin is a derived quantity in orbit mode: it sits `distance` behind
// the pivot along the current forward axis (rot col2). Call after any
// change to target / distance / rotation.
function applyOrigin(camera) {
  camera.origin[0] = camera.target[0] - camera.rot[2] * camera.distance;
  camera.origin[1] = camera.target[1] - camera.rot[5] * camera.distance;
  camera.origin[2] = camera.target[2] - camera.rot[8] * camera.distance;
}

// Set vertical FOV, clamped to the projection's max. Used by the settings
// slider and the −/= keys (the wheel now dollies instead of zooming FOV).
export function setFov(camera, deg) {
  camera.fovDeg = Math.max(FOV_MIN, Math.min(fovMaxFor(camera.projection), deg));
}

export function resetCamera(camera, defaultPose) {
  // Preserve user-tuned settings; reset pose-derived ones.
  const speedMul = camera.speedMul;
  const projection = camera.projection;
  const savedSceneUp = new Float32Array(camera.sceneUp);
  const savedCentroid = camera.sceneCentroid ? new Float32Array(camera.sceneCentroid) : null;
  Object.assign(camera, fromDefaultPose(defaultPose, savedSceneUp, savedCentroid));
  camera.speedMul = speedMul;
  camera.projection = projection;
}

export function toggleProjection(camera) {
  camera.projection = camera.projection === PROJ_PINHOLE ? PROJ_FISHEYE : PROJ_PINHOLE;
  camera.fovDeg = Math.min(camera.fovDeg, fovMaxFor(camera.projection));
}

// Replace the scene-up axis at runtime. Useful when the default-pose
// auto-derivation picks a tilted axis (yaw around a tilted axis looks
// like roll). The current camera forward direction is preserved; yaw is
// reset to 0 and pitch is recomputed relative to the new up.
export function setSceneUp(camera, newUp) {
  camera.sceneUp[0] = newUp[0]; camera.sceneUp[1] = newUp[1]; camera.sceneUp[2] = newUp[2];
  vNorm(camera.sceneUp);

  // Current forward in world = column 2 of row-major rot.
  const fwd = [camera.rot[2], camera.rot[5], camera.rot[8]];
  const dotFU = fwd[0]*camera.sceneUp[0] + fwd[1]*camera.sceneUp[1] + fwd[2]*camera.sceneUp[2];

  camera.fwd0[0] = fwd[0] - dotFU*camera.sceneUp[0];
  camera.fwd0[1] = fwd[1] - dotFU*camera.sceneUp[1];
  camera.fwd0[2] = fwd[2] - dotFU*camera.sceneUp[2];
  if (Math.hypot(camera.fwd0[0], camera.fwd0[1], camera.fwd0[2]) < 1e-6) {
    // Forward parallel to new up — fall back to any perpendicular axis.
    const axIdx = Math.abs(camera.sceneUp[0]) > Math.abs(camera.sceneUp[1]) ? 1 : 0;
    const ax = [0, 0, 0]; ax[axIdx] = 1;
    const d = ax[0]*camera.sceneUp[0] + ax[1]*camera.sceneUp[1] + ax[2]*camera.sceneUp[2];
    camera.fwd0[0] = ax[0] - d*camera.sceneUp[0];
    camera.fwd0[1] = ax[1] - d*camera.sceneUp[1];
    camera.fwd0[2] = ax[2] - d*camera.sceneUp[2];
  }
  vNorm(camera.fwd0);
  vCross(camera.fwd0, camera.sceneUp, camera.right0);
  vNorm(camera.right0);

  camera.yaw = 0;
  camera.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, Math.asin(dotFU)));
  rebuildRotation(camera);
  applyOrigin(camera); // forward is preserved, so origin/target stay put
}

// --- Per-frame basis + rotation ---
//
// Rodrigues rotation around sceneUp, given right0 = fwd0 × sceneUp:
//   sceneUp × fwd0  = -right0
//   sceneUp × right0 = +fwd0
//
// so:
//   fwd_yawed   = cos(yaw)·fwd0  - sin(yaw)·right0
//   right_yawed = cos(yaw)·right0 + sin(yaw)·fwd0
//
// Positive yaw is CCW around sceneUp (left turn from camera POV), which
// is the orbit/pan convention: drag-right yaws the camera left so the
// scene appears to follow the cursor.
//
// Pitch then rotates around right_yawed:
//   fwd_pitched  = cos(pitch)·fwd_yawed + sin(pitch)·sceneUp
//   down_pitched = -cos(pitch)·sceneUp  + sin(pitch)·fwd_yawed
//
// Rotation matrix columns are (right_yawed, down_pitched, fwd_pitched);
// right_yawed never leaves the horizontal plane, so the camera's right
// axis is always horizontal → no roll.

const _fyWS = new Float32Array(3); // scratch: world-frame horizontal forward
const _ryWS = new Float32Array(3); // scratch: world-frame horizontal right

function basis(camera) {
  const sy = Math.sin(camera.yaw);
  const cy = Math.cos(camera.yaw);
  _fyWS[0] = cy*camera.fwd0[0] - sy*camera.right0[0];
  _fyWS[1] = cy*camera.fwd0[1] - sy*camera.right0[1];
  _fyWS[2] = cy*camera.fwd0[2] - sy*camera.right0[2];
  _ryWS[0] = sy*camera.fwd0[0] + cy*camera.right0[0];
  _ryWS[1] = sy*camera.fwd0[1] + cy*camera.right0[1];
  _ryWS[2] = sy*camera.fwd0[2] + cy*camera.right0[2];
}

function rebuildRotation(camera) {
  basis(camera);
  const sp = Math.sin(camera.pitch);
  const cp = Math.cos(camera.pitch);
  const up = camera.sceneUp;
  // forward after pitch
  const fpx = cp*_fyWS[0] + sp*up[0];
  const fpy = cp*_fyWS[1] + sp*up[1];
  const fpz = cp*_fyWS[2] + sp*up[2];
  // down after pitch
  const dpx = -cp*up[0] + sp*_fyWS[0];
  const dpy = -cp*up[1] + sp*_fyWS[1];
  const dpz = -cp*up[2] + sp*_fyWS[2];

  // Row-major rot[]: rows of R, columns are (right_yawed, down_pitched, fwd_pitched).
  const r = camera.rot;
  r[0] = _ryWS[0]; r[1] = dpx; r[2] = fpx;
  r[3] = _ryWS[1]; r[4] = dpy; r[5] = fpy;
  r[6] = _ryWS[2]; r[7] = dpz; r[8] = fpz;
}

// --- Per-frame input ---

export function applyInput(camera, baseSpeed, dt, input) {
  // Mouse drag. Left button = orbit (yaw/pitch around the pivot); right
  // button = pan the pivot in the screen plane.
  if (input.isDragging()) {
    const m = input.consumeMouse();
    if (input.isPanning()) {
      // Pan: translate the orbit target along camera-right / camera-up.
      // right = rot col0, up = -col1 (image-up). Scale by distance so a
      // given drag pans the same screen fraction at any zoom level.
      const k = PAN_SENS * camera.distance;
      const rx = camera.rot[0], ry = camera.rot[3], rz = camera.rot[6];   // col0 = right
      const ux = -camera.rot[1], uy = -camera.rot[4], uz = -camera.rot[7]; // -col1 = up
      camera.target[0] += (-m.dx * rx + m.dy * ux) * k;
      camera.target[1] += (-m.dx * ry + m.dy * uy) * k;
      camera.target[2] += (-m.dx * rz + m.dy * uz) * k;
    } else {
      // Orbit, "grab the scene" convention: drag left → camera orbits
      // right, drag up → camera orbits up (scene follows the cursor).
      if (m.dx !== 0) camera.yaw -= m.dx * MOUSE_SENS;
      if (m.dy !== 0) camera.pitch -= m.dy * MOUSE_SENS;
      camera.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, camera.pitch));
    }
  } else {
    input.consumeMouse();
  }

  // Wheel → dolly (orbit distance). Multiplicative so it feels even
  // whether you're inches or thousands of units from the pivot.
  const w = input.consumeWheel();
  if (w !== 0) {
    camera.distance = Math.max(DOLLY_MIN, Math.min(DOLLY_MAX, camera.distance * Math.exp(w * DOLLY_SENS)));
  }

  // Compute the current horizontal basis (used for WASD and for the
  // rotation matrix below).
  basis(camera);

  // WASD/QE move the orbit pivot; the camera (origin) follows it via
  // applyOrigin, so this is a free-flight pan of the whole rig. Movement
  // is on the ground plane (pitch doesn't bend it); QE is along scene-up.
  let fwd = 0, side = 0, up = 0;
  if (input.isDown('KeyW')) fwd += 1;
  if (input.isDown('KeyS')) fwd -= 1;
  if (input.isDown('KeyD')) side += 1;
  if (input.isDown('KeyA')) side -= 1;
  if (input.isDown('KeyE')) up += 1;
  if (input.isDown('KeyQ')) up -= 1;

  const turbo = input.isDown('ShiftLeft') || input.isDown('ShiftRight') ? 10 : 1;
  const step = baseSpeed * camera.speedMul * turbo * dt;

  if (fwd !== 0 || side !== 0) {
    camera.target[0] += step * (fwd*_fyWS[0] + side*_ryWS[0]);
    camera.target[1] += step * (fwd*_fyWS[1] + side*_ryWS[1]);
    camera.target[2] += step * (fwd*_fyWS[2] + side*_ryWS[2]);
  }
  if (up !== 0) {
    camera.target[0] += step * up * camera.sceneUp[0];
    camera.target[1] += step * up * camera.sceneUp[1];
    camera.target[2] += step * up * camera.sceneUp[2];
  }

  // Rebuild rotation from (possibly updated) yaw/pitch, then re-derive
  // origin from the pivot + distance along the new forward axis.
  rebuildRotation(camera);
  applyOrigin(camera);
}

// --- WGSL uniform packing ---
//
//   bytes  0..11  origin (vec3<f32>)
//   bytes 12..15  fov_rad (f32)
//   bytes 16..27  rot_r0 (vec3<f32>) — row 0 of 3x3
//   bytes 28..31  projection (u32) — 0 = pinhole, 1 = fisheye
//   bytes 32..43  rot_r1
//   bytes 44..47  _pad1
//   bytes 48..59  rot_r2
//   bytes 60..63  _pad2
//   bytes 64..67  res_w (u32)
//   bytes 68..71  res_h (u32)
//   bytes 72..75  R_d (u32)
//   bytes 76..79  R_s (u32)
//   bytes 80..83  start_point (u32)
//   bytes 84..87  max_iters (u32)
//   bytes 88..91  weight_threshold (f32)
//   bytes 92..95  cell_skip_threshold (f32)
// `quality` (optional) overrides the per-scene render knobs:
//   { weightThreshold, cellSkip } — see the viewer's defaults. Omitted fields
// fall back to the scene header's baked-in values. (Specular is a compile-time
// pipeline override, not a uniform — see foam.wgsl `use_specular_c`.)
export function writeUniform(view, camera, scene, resW, resH, startPoint, quality = null) {
  const f = new Float32Array(view);
  const u = new Uint32Array(view);
  const h = scene.header;
  const fovRad = camera.fovDeg * Math.PI / 180;

  f[0] = camera.origin[0]; f[1] = camera.origin[1]; f[2] = camera.origin[2];
  f[3] = fovRad;
  f[4] = camera.rot[0]; f[5] = camera.rot[1]; f[6] = camera.rot[2];
  u[7] = camera.projection;
  f[8] = camera.rot[3]; f[9] = camera.rot[4]; f[10] = camera.rot[5];  // f[11] pad
  f[12] = camera.rot[6]; f[13] = camera.rot[7]; f[14] = camera.rot[8]; // f[15] pad

  u[16] = resW;
  u[17] = resH;
  u[18] = h.R_d;
  u[19] = h.R_s;
  u[20] = startPoint;
  u[21] = Math.min(h.maxIntersections, MAX_ITERS_CAP);
  f[22] = quality && quality.weightThreshold !== undefined ? quality.weightThreshold : h.weightThreshold;
  f[23] = quality && quality.cellSkip !== undefined ? quality.cellSkip : h.cellSkipThreshold;
}
