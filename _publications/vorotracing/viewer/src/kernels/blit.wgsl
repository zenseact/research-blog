// Fullscreen-quad blit: samples the compute output (rgba16float storage
// texture) onto the swap-chain target via textureLoad at fragment-pixel
// coords. Source texture is same size as the canvas (1:1), so no filter.

@group(0) @binding(0) var src: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4<f32> {
  // Single oversized triangle covering the NDC square — clipping
  // discards the off-screen portion, no quad/index buffer needed.
  var p = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 3.0, -1.0),
    vec2<f32>(-1.0,  3.0),
  );
  return vec4<f32>(p[i], 0.0, 1.0);
}

@fragment
fn fs(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  return textureLoad(src, vec2<i32>(pos.xy), 0);
}
