// one layer of a grid of stars
fn starLayer(uv: vec2f, iTime: f32, pulse: f32) -> vec3f {
  var col = vec3f(0.0);

  let gv = fract(uv) - 0.5;
  let id = floor(uv);

  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let offs = vec2f(f32(x), f32(y));

      let n = hash21(id + offs);
      let size = fract(n * 345.32);
      let p = vec2f(n, fract(n * 34.0));

      // pulse (keys) makes every star flare, not only the big ones
      let flare = smoothstep(0.8, 1.0, size) * 0.6 + pulse * size * 0.8;
      var s = star(gv - offs - p + 0.5, flare);

      // the original mixed in audio (iChannel0) here; without audio this is the plain palette
      let hueShift = fract(n * 2345.2) * vec3f(0.2, 0.3, 0.9) * 123.2;

      var color = sin(hueShift) * 0.5 + 0.5;
      color = color * vec3f(1.0, 0.25, 1.0 + size);

      s *= sin(iTime * 3.0 + n * 6.2831) * 0.4 + 1.0;
      s *= 1.0 + pulse;
      col += s * size * color;
    }
  }

  return col;
}
