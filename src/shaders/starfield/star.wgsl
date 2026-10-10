// one star: glowing core + two crossed rays
fn star(uvIn: vec2f, flare: f32) -> f32 {
  var uv = uvIn;
  let d = max(length(uv), 0.0001);
  var m = 0.02 / d;

  var rays = max(0.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * flare;
  uv = uv * rot(3.1415 / 4.0);
  rays = max(0.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * 0.3 * flare;

  // GLSL had smoothstep(1., .2, d): reversed edges are not allowed in WGSL
  m *= 1.0 - smoothstep(0.2, 1.0, d);
  return m;
}
