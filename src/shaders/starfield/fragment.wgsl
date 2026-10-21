// Shadertoy: https://www.shadertoy.com/view/ftt3R7  (kaleidoscope star field, by DanielXMoore)
// wgslFn reads the signature of the FIRST function in this file, so the main function
// comes first and the helper functions follow below it.
fn starfield(fragCoord: vec2f, iTime: f32, phase: f32, spin: f32, pulse: f32, colourSeed: f32, colourChance: f32, sizeSeed: f32, sizeChance: f32, layoutSeed: f32, iMouse: vec2f, iResolution: vec2f) -> vec4f {
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
    col += starLayer(uv * scale + i * 453.2, iTime, pulse, colourSeed, colourChance, sizeSeed, sizeChance, layoutSeed) * fade;
  }

  return vec4f(col, 1.0);
}

// ---- helper functions -------------------------------------------------

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

// pseudo-random number from a 2D position
fn hash21(pIn: vec2f) -> f32 {
  var p = fract(pIn * vec2f(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// 2D rotation matrix (GLSL: mat2 Rot(float a))
fn rot(a: f32) -> mat2x2f {
  let c = cos(a);
  let s = sin(a);
  return mat2x2f(c, -s, s, c);
}
