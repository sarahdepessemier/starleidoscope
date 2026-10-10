// 2D rotation matrix (GLSL: mat2 Rot(float a))
fn rot(a: f32) -> mat2x2f {
  let c = cos(a);
  let s = sin(a);
  return mat2x2f(c, -s, s, c);
}
