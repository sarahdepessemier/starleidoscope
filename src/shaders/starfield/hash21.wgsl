// pseudo-random number from a 2D position
fn hash21(pIn: vec2f) -> f32 {
  var p = fract(pIn * vec2f(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
