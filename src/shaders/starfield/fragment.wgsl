// https://www.shadertoy.com/view/ftt3R7  (kaleidoscope star field)
// iMouse: 0..1, (0.5, 0.5) = centre. phase/spin/pulse/hue are driven by the keyboard.
fn starfield(fragCoord: vec2f, iTime: f32, phase: f32, spin: f32, pulse: f32, hue: vec2f, iMouse: vec2f, iResolution: vec2f) -> vec4f {
  var uv = (fragCoord - 0.5 * iResolution) / iResolution.y;
  let m = (iMouse - vec2f(0.5)) * vec2f(iResolution.x / iResolution.y, 1.0);
  let t = phase * 0.01;

  uv.x = abs(uv.x);
  uv.y += tan((5.0 / 6.0) * 3.1415) * 0.5;

  let a1 = (5.0 / 6.0) * 3.1415;
  var n = vec2f(sin(a1), cos(a1));
  let d = dot(uv - vec2f(0.5, 0.0), n);
  uv -= n * max(0.0, d) * 2.0;

  let a2 = (2.0 / 3.0) * 3.1415;
  n = vec2f(sin(a2), cos(a2));
  uv.x += 1.5 / 1.25;
  for (var i = 0; i < 5; i++) {
    uv *= 1.25;
    uv.x -= 1.5;

    uv.x = abs(uv.x);
    uv.x -= 0.5;
    uv -= n * min(0.0, dot(uv, n)) * 2.0;
  }

  uv += m * 4.0;
  uv = uv * rot(t + spin);

  var col = vec3f(0.0);
  for (var k = 0; k < 10; k++) {
    let i = f32(k) / 10.0;
    let depth = fract(i + t);
    let scale = mix(20.0, 0.5, depth);
    // GLSL had smoothstep(1., .9, depth)
    let fade = depth * (1.0 - smoothstep(0.9, 1.0, depth));
    col += starLayer(uv * scale + i * 453.2, iTime, hue, pulse) * fade;
  }

  return vec4f(col, 1.0);
}
