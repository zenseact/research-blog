// Foam neural ray-tracer — inference kernel.
//
// A WebGPU port of the reference CUDA inference kernel. One
// invocation = one ray = one output pixel. Cells are walked by ray-Voronoi-
// face intersection on the precomputed `adjacent_diff` neighbor offsets;
// alpha-compositing samples the bilinear-interpolated octahedral diffuse
// map at each cell.
//
// Specular path is gated by an override constant — `false` for the
// diffuse-only pipeline (milestone 4). Milestone 5 adds the override-true
// variant and binds the specular buffer.

enable f16;

struct Camera {
  origin:              vec3<f32>,
  fov_rad:             f32,
  rot_r0:              vec3<f32>,
  projection:          u32,    // 0 = pinhole, 1 = equidistant fisheye
  rot_r1:              vec3<f32>,
  _pad1:               f32,
  rot_r2:              vec3<f32>,
  _pad2:               f32,
  res_w:               u32,
  res_h:               u32,
  R_d:                 u32,
  R_s:                 u32,
  start_point:         u32,
  max_iters:           u32,
  weight_threshold:    f32,
  cell_skip_threshold: f32,
}

@group(0) @binding(0) var<uniform>          camera             : Camera;
@group(0) @binding(1) var<storage, read>    points             : array<vec4<f32>>;
@group(0) @binding(2) var<storage, read>    density            : array<f32>;
@group(0) @binding(3) var<storage, read>    diffuse            : array<vec4<f16>>;
@group(0) @binding(4) var<storage, read>    adjacency          : array<u32>;
@group(0) @binding(5) var<storage, read>    adjacency_offsets  : array<u32>;
@group(0) @binding(6) var<storage, read>    adjacent_diff      : array<vec4<f16>>;
@group(0) @binding(7) var                   out_tex            : texture_storage_2d<rgba16float, write>;
@group(0) @binding(8) var<storage, read>    specular           : array<vec4<f16>>;

// ---------- Octahedral helpers ----------

fn oct_encode(d: vec3<f32>, R: u32) -> vec2<f32> {
  let ad = abs(d);
  let l1 = ad.x + ad.y + ad.z;
  let inv_l1 = 1.0 / max(l1, 1e-10);
  var u = d.x * inv_l1;
  var v = d.y * inv_l1;
  if (d.z < 0.0) {
    let su = select(-1.0, 1.0, u >= 0.0);
    let sv = select(-1.0, 1.0, v >= 0.0);
    let nu = (1.0 - abs(v)) * su;
    let nv = (1.0 - abs(u)) * sv;
    u = nu;
    v = nv;
  }
  let fR = f32(R);
  return vec2<f32>(
    (u * 0.5 + 0.5) * fR - 0.5,
    (v * 0.5 + 0.5) * fR - 0.5,
  );
}

// C-style truncation semantics — WGSL `/` and `%` on signed ints truncate
// toward zero, matching CUDA. The reference implementation uses abs-then-divide to
// avoid Python's floor-divide on negative numerators; we don't need that
// trick here but keep the structure identical for cross-checking.
fn oct_wrap_index(u_tex: i32, v_tex: i32, R: u32) -> u32 {
  let Ri = i32(R);
  if (u_tex >= 0 && u_tex < Ri && v_tex >= 0 && v_tex < Ri) {
    return u32(v_tex * Ri + u_tex);
  }
  var wu = ((u_tex % Ri) + Ri) % Ri;
  var wv = ((v_tex % Ri) + Ri) % Ri;
  let fold_u = (abs(u_tex) / Ri) + select(0, 1, u_tex < 0);
  let fold_v = (abs(v_tex) / Ri) + select(0, 1, v_tex < 0);
  if (((fold_u ^ fold_v) & 1) != 0) {
    wu = Ri - 1 - wu;
    wv = Ri - 1 - wv;
  }
  return u32(wv * Ri + wu);
}

fn bilinear_diffuse(point_idx: u32, R: u32, dir: vec3<f32>) -> vec3<f32> {
  let uv = oct_encode(dir, R);
  let u0 = i32(floor(uv.x));
  let v0 = i32(floor(uv.y));
  let fu = uv.x - f32(u0);
  let fv = uv.y - f32(v0);
  let base = point_idx * R * R;
  let i00 = base + oct_wrap_index(u0,     v0,     R);
  let i10 = base + oct_wrap_index(u0 + 1, v0,     R);
  let i01 = base + oct_wrap_index(u0,     v0 + 1, R);
  let i11 = base + oct_wrap_index(u0 + 1, v0 + 1, R);
  let t00 = vec3<f32>(diffuse[i00].xyz);
  let t10 = vec3<f32>(diffuse[i10].xyz);
  let t01 = vec3<f32>(diffuse[i01].xyz);
  let t11 = vec3<f32>(diffuse[i11].xyz);
  let w00 = (1.0 - fu) * (1.0 - fv);
  let w10 = fu       * (1.0 - fv);
  let w01 = (1.0 - fu) * fv;
  let w11 = fu       * fv;
  return w00 * t00 + w10 * t10 + w01 * t01 + w11 * t11;
}

fn sigmoid3(x: vec3<f32>) -> vec3<f32> {
  return 1.0 / (1.0 + exp(-x));
}

// ---------- Main ----------

// Workgroup dimensions are pipeline-overridable so the benchmark can sweep
// tile shapes (occupancy + warp-coherence). Defaults to an 8×8 tile, which
// already gives WebGPU native warp-coherent sub-tiles (the first subgroup of
// 32 lands on an 8×4 block — the same locality the CUDA path gets from its
// warp-coherent ray tiling).
override wg_x: u32 = 8u;
override wg_y: u32 = 8u;
// Compile-time specular gate: when false the entire specular path below is
// dead-code-eliminated, so the diffuse-only pipeline pays nothing (no extra
// registers held across the walk). Two pipeline variants are compiled.
override use_specular_c: bool = false;

// Octahedral map resolutions as compile-time constants (set per scene from the
// header). GPUs have no hardware integer divide, so the `%R` / `/R` inside
// oct_wrap_index expand to a costly sequence when R is a runtime value — the
// dominant shading cost. As compile-time constants (typically 8) they collapse
// to &7 / >>3, ~1.3–1.4× faster overall. Must match the scene's R_d / R_s.
override oct_r_diff: u32 = 8u;
override oct_r_spec: u32 = 8u;

@compute @workgroup_size(wg_x, wg_y, 1)
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= camera.res_w || gid.y >= camera.res_h) { return; }
  let pixel = vec2<i32>(i32(gid.x), i32(gid.y));

  // Ray gen, OpenCV camera frame (+x right, +y down, +z forward). FOV is
  // vertical and interpreted identically for both projections: it's the
  // total angular span from the image's top edge to its bottom edge.
  let res = vec2<f32>(f32(camera.res_w), f32(camera.res_h));
  let cx = 0.5 * (res.x - 1.0);
  let cy = 0.5 * (res.y - 1.0);
  let dx_pix = f32(gid.x) - cx;
  let dy_pix = f32(gid.y) - cy;

  var d_cam: vec3<f32>;
  if (camera.projection == 0u) {
    // Pinhole: r_image = f · tan(θ). Standard NeRF-style ray generation.
    let f_pix = 0.5 * res.y / tan(0.5 * camera.fov_rad);
    let x_cam = dx_pix / f_pix;
    let y_cam = dy_pix / f_pix;
    let nrm = 1.0 / sqrt(x_cam * x_cam + y_cam * y_cam + 1.0);
    d_cam = vec3<f32>(x_cam * nrm, y_cam * nrm, nrm);
  } else {
    // Equidistant fisheye: r_image = f · θ. f_pix maps pixels to angle
    // such that pixels at H/2 from the center lie exactly fov/2 rad off
    // the forward axis. Rays past θ=π/2 simply point backward — the
    // ray tracer's escape path handles them gracefully.
    let f_pix = res.y / camera.fov_rad;
    let r_pix = sqrt(dx_pix * dx_pix + dy_pix * dy_pix);
    if (r_pix < 1.0e-6) {
      d_cam = vec3<f32>(0.0, 0.0, 1.0);
    } else {
      let theta = r_pix / f_pix;
      let s = sin(theta) / r_pix; // radial scale: sin(θ)·(dx_pix/r_pix)
      d_cam = vec3<f32>(dx_pix * s, dy_pix * s, cos(theta));
    }
  }

  let d = vec3<f32>(
    dot(camera.rot_r0, d_cam),
    dot(camera.rot_r1, d_cam),
    dot(camera.rot_r2, d_cam),
  );
  let o = camera.origin;

  // Specular is indexed by the (negated) ray direction — constant for the
  // whole ray — so the octahedral bilinear taps are computed once here, then
  // only the per-cell base offset varies inside the walk, matching the
  // reference implementation's one-time specular bilinear setup.
  let use_spec = use_specular_c;
  var sp_i00 = 0u; var sp_i10 = 0u; var sp_i01 = 0u; var sp_i11 = 0u;
  var sp_fu = 0.0; var sp_fv = 0.0;
  if (use_spec) {
    let uvs = oct_encode(-d, oct_r_spec);
    let su0 = i32(floor(uvs.x));
    let sv0 = i32(floor(uvs.y));
    sp_fu = uvs.x - f32(su0);
    sp_fv = uvs.y - f32(sv0);
    sp_i00 = oct_wrap_index(su0,     sv0,     oct_r_spec);
    sp_i10 = oct_wrap_index(su0 + 1, sv0,     oct_r_spec);
    sp_i01 = oct_wrap_index(su0,     sv0 + 1, oct_r_spec);
    sp_i11 = oct_wrap_index(su0 + 1, sv0 + 1, oct_r_spec);
  }

  // Integrator state.
  var acc           = vec3<f32>(0.0);
  var transmittance = 1.0;
  var t_0           = 0.0;
  var current_idx   = camera.start_point;
  var p             = points[current_idx].xyz;

  for (var iter: u32 = 0u; iter < camera.max_iters; iter = iter + 1u) {
    let off_begin = adjacency_offsets[current_idx];
    let off_end   = adjacency_offsets[current_idx + 1u];

    // Find next face — minimum positive t along the ray over all forward
    // neighbor planes. `next_face` is the global neighbor index, not the
    // local one (simpler than the reference local-index then global-resolve).
    var t_1: f32       = 1.0e30;
    var next_face: u32 = 0xFFFFFFFFu;
    let pmo = p - o;
    for (var n: u32 = off_begin; n < off_end; n = n + 1u) {
      let off = vec3<f32>(adjacent_diff[n].xyz);
      let dp  = dot(off, d);
      if (dp > 0.0) {
        let num = dot(off, pmo) + dot(off, off) * 0.5;
        if (num < t_1 * dp) {
          t_1       = num / dp;
          next_face = n;
        }
      }
    }
    if (next_face == 0xFFFFFFFFu) { break; }

    let next_idx = adjacency[next_face];
    let np = points[next_idx].xyz;

    if (t_1 > t_0) {
      let s = density[current_idx];
      if (s > 1e-6) {
        let dt    = max(t_1 - t_0, 0.0);
        let alpha = 1.0 - exp(-s * dt);
        let weight = transmittance * alpha;

        if (weight >= camera.cell_skip_threshold) {
          // View dir from cell center to the entry-face surface point (t_0).
          let h = o + d * t_0 - p;
          let hsq = dot(h, h);
          var view_dir: vec3<f32>;
          if (hsq > 1e-16) {
            view_dir = h * inverseSqrt(hsq);
          } else {
            view_dir = d;
          }

          var rgb_logits = bilinear_diffuse(current_idx, oct_r_diff, view_dir);
          if (use_spec) {
            // View-independent specular: blend the per-ray taps from this
            // cell's specular octmap and add to the logits before sigmoid.
            let sbase = current_idx * oct_r_spec * oct_r_spec;
            let w00 = (1.0 - sp_fu) * (1.0 - sp_fv);
            let w10 = sp_fu * (1.0 - sp_fv);
            let w01 = (1.0 - sp_fu) * sp_fv;
            let w11 = sp_fu * sp_fv;
            rgb_logits = rgb_logits
              + w00 * vec3<f32>(specular[sbase + sp_i00].xyz)
              + w10 * vec3<f32>(specular[sbase + sp_i10].xyz)
              + w01 * vec3<f32>(specular[sbase + sp_i01].xyz)
              + w11 * vec3<f32>(specular[sbase + sp_i11].xyz);
          }
          acc = acc + sigmoid3(rgb_logits) * weight;
        }

        transmittance = transmittance * (1.0 - alpha);
        if (transmittance <= camera.weight_threshold) { break; }
      }
    }

    if (t_1 > t_0) { t_0 = t_1; }
    current_idx = next_idx;
    p           = np;
  }

  textureStore(out_tex, pixel, vec4<f32>(acc, 1.0 - transmittance));
}
