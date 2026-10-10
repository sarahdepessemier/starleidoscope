// one layer of a grid of stars
// colourSeed/colourChance: a random share of the stars gets a random colour
// sizeSeed/sizeChance:     a random share of the stars gets a random size
// layoutSeed:              re-rolls where every star sits
fn starLayer(uv: vec2f, iTime: f32, pulse: f32, colourSeed: f32, colourChance: f32, sizeSeed: f32, sizeChance: f32, layoutSeed: f32) -> vec3f {
  var col = vec3f(0.0);

  let gv = fract(uv) - 0.5;
  let id = floor(uv);

  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let offs = vec2f(f32(x), f32(y));

      let n = hash21(id + offs + layoutSeed * vec2f(1.0, 1.7));
      let size = fract(n * 345.32);
      let p = vec2f(n, fract(n * 34.0));

      // random size: ~sizeChance of the stars become 0.6x .. 2.2x as big
      let isResized = 1.0 - step(sizeChance, hash21(vec2f(n * 53.1, sizeSeed)));
      let sizeMul = mix(1.0, mix(0.6, 2.2, hash21(vec2f(n * 7.7, sizeSeed + 9.3))), isResized);

      // pulse makes every star flare, not only the big ones
      let flare = smoothstep(0.8, 1.0, size) * 0.6 + pulse * size * 0.8;
      var s = star((gv - offs - p + 0.5) / sizeMul, flare);

      // the original mixed in audio (iChannel0) here; without audio this is the plain palette
      let hueShift = fract(n * 2345.2) * vec3f(0.2, 0.3, 0.9) * 123.2;

      var color = sin(hueShift) * 0.5 + 0.5;
      color = color * vec3f(1.0, 0.25, 1.0 + size);

      // random colour: ~colourChance of the stars get any colour of the rainbow, or white
      let isRecoloured = 1.0 - step(colourChance, hash21(vec2f(n * 91.7, colourSeed)));
      let h = hash21(vec2f(n * 17.3, colourSeed + 3.1));
      var rainbow = 0.5 + 0.5 * cos(6.28318 * (h + vec3f(0.0, 0.33, 0.67)));
      let isWhite = step(0.85, hash21(vec2f(n * 29.9, colourSeed + 5.7)));
      rainbow = mix(rainbow, vec3f(1.0), isWhite);
      color = mix(color, rainbow * (1.0 + size), isRecoloured);

      s *= sin(iTime * 3.0 + n * 6.2831) * 0.4 + 1.0;
      s *= 1.0 + pulse;
      col += s * size * color;
    }
  }

  return col;
}
