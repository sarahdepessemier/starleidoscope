// Galaxy shader ("Pegasus Galaxy") by Frank Hugenroth (frankenburgh), 07/2015
// Released at nordlicht/bremen 2015
// Shadertoy URL: https://www.shadertoy.com/view/MdXSzS (check this link against your own)
// Ported to WGSL. Changes: the 150-second intro/outro fade is removed so it can run forever,
// the mouse (look) moves the camera around the galaxy, and shared controls were added
// (spin = roll, pulse = flash, seed = other region of the clouds, hue = colour shift, zoom).
// wgslFn reads the FIRST function of this file: main first, helpers below.
fn pegasus(fragCoord: vec2f, iTime: f32, look: vec2f, spin: f32, pulse: f32, seed: f32, hue: f32, zoom: f32, iResolution: vec2f) -> vec4f {
  let time = 2.0 + iTime * 0.1;
  let xy = -1.0 + 2.0 * fragCoord / iResolution;
  let glow = 1.0;
  let fade = 1.0;

  // camera: flies slowly in and out, and the mouse swings it around the galaxy
  var campos = vec3f(500.0, 850.0, -cos((time - 1.4) / 2.0) * 2000.0);
  let swing = (look.x - 0.5) * 2.2;
  campos = vec3f(campos.x * cos(swing) - campos.z * sin(swing), 850.0 + (look.y - 0.5) * 900.0, campos.x * sin(swing) + campos.z * cos(swing));
  let camtar = vec3f(0.0);

  let roll = 0.34 + spin;
  let cw = normalize(camtar - campos);
  let cp = vec3f(sin(roll), cos(roll), 0.0);
  let cu = normalize(cross(cw, cp));
  let cv = normalize(cross(cu, cw));
  let rd = normalize(xy.x * cu + xy.y * cv + 1.6 * zoom * cw);

  let light = normalize(vec3f(0.0) - campos);
  let sundot = clamp(dot(light, rd), 0.0, 1.0);

  // sky: galaxy centre glow + haze
  var col = glow * 1.2 * min(vec3f(1.0), vec3f(2.0, 1.0, 0.5) * pow(sundot, 100.0));
  col += 0.3 * vec3f(0.8, 0.9, 1.2) * pow(sundot, 8.0);

  // stars
  let stars = 85.5 * vec3f(pow(pg_fbmslow(rd.xyz * 312.0), 7.0)) * vec3f(pow(pg_fbmslow(rd.zxy * 440.3), 8.0));

  // moving background fog
  var cpos = 1500.0 * rd + vec3f(831.0 - time * 30.0, 321.0, 1000.0);
  col += vec3f(0.4, 0.5, 1.0) * (pg_fbmslow(cpos * 0.0035) - 0.5);

  cpos += vec3f(831.0 - time * 33.0, 321.0, 999.0);
  col += vec3f(0.6, 0.3, 0.6) * 10.0 * pow(pg_fbmslow(cpos * 0.0045), 10.0);

  cpos += vec3f(3831.0 - time * 39.0, 221.0, 999.0);
  col += 0.03 * vec3f(0.6, 0.0, 0.0) * 10.0 * pow(pg_fbmslow(cpos * 0.0145), 2.0);

  // stars
  cpos = 1500.0 * rd + vec3f(831.0, 321.0, 999.0);
  col += stars * pg_fbm(cpos * 0.0021);

  // clouds
  let shift = vec2f(time * 100.0, time * 180.0) + vec2f(seed * 37.0, seed * 23.0);
  var sum = vec4f(0.0);
  let cloudH = campos.y / rd.y;
  let cpos2 = campos - cloudH * rd;
  let radius0 = length(cpos2.xz) / 1000.0;

  if (radius0 < 1.8) {
    for (var q = 10; q > -10; q--) {          // layers
      if (sum.w > 0.999) { continue; }
      let ch = (f32(q) * 8.0 - campos.y) / rd.y;
      var cp3 = campos + ch * rd;

      let see = dot(normalize(cp3), normalize(campos));
      let lightUnvis = vec3f(0.0);
      let lightVis = vec3f(1.3, 1.2, 1.2);
      let shine = mix(lightVis, lightUnvis, smoothstep(0.0, 1.0, see));

      // border
      let radius = length(cp3.xz) / 999.0;
      if (radius > 1.0) { continue; }

      let rot = 3.0 * radius - time;
      cp3 = vec3f(cp3.x * cos(rot) - cp3.z * sin(rot), cp3.y, cp3.x * sin(rot) + cp3.z * cos(rot));

      cp3 += vec3f(831.0 + shift.x, 321.0 + f32(q) * mix(250.0, 50.0, radius) - shift.x * 0.2, 1330.0 + shift.y); // cloud position
      cp3 *= mix(0.0025, 0.0028, radius); // zoom
      var alpha = smoothstep(0.50, 1.0, pg_fbm(cp3)); // fractal cloud density
      alpha *= 1.3 * pow(1.0 - smoothstep(0.0, 1.0, radius), 0.3); // fade out disc at edges (reversed smoothstep rewritten)
      let dustcolor = mix(vec3f(2.0, 1.3, 1.0), vec3f(0.1, 0.2, 0.3), pow(radius, 0.5));
      var localcolor = mix(dustcolor, shine, alpha); // density colour white->gray

      let gstar = 2.0 * pow(pg_noise(cp3 * 21.40), 22.0);
      let gstar2 = 3.0 * pow(pg_noise(cp3 * 26.55), 34.0);
      let gholes = 1.0 * pow(pg_noise(cp3 * 11.55), 14.0);
      localcolor += vec3f(1.0, 0.6, 0.3) * gstar;
      localcolor += vec3f(1.0, 1.0, 0.7) * gstar2;
      localcolor -= gholes;

      alpha = (1.0 - sum.w) * alpha; // the denser a layer, the more the higher layers are hidden
      sum += vec4f(localcolor * alpha, alpha);
    }

    for (var q = 0; q < 20; q++) {            // dark dust lanes
      if (sum.w > 0.999) { continue; }
      let ch = (f32(q) * 4.0 - campos.y) / rd.y;
      var cp3 = campos + ch * rd;

      let radius = length(cp3.xz) / 200.0;
      if (radius > 1.0) { continue; }

      let rot = 3.2 * radius - time * 1.1;
      cp3 = vec3f(cp3.x * cos(rot) - cp3.z * sin(rot), cp3.y, cp3.x * sin(rot) + cp3.z * cos(rot));

      cp3 += vec3f(831.0 + shift.x, 321.0 + f32(q) * mix(250.0, 50.0, radius) - shift.x * 0.2, 1330.0 + shift.y);
      var alpha = 0.1 + smoothstep(0.6, 1.0, pg_fbm(cp3));
      alpha *= 1.2 * (pow(1.0 - smoothstep(0.0, 1.0, radius), 0.72) - pow(1.0 - smoothstep(0.0, 1.0, radius * 1.875), 0.2));
      alpha = max(alpha, 0.0);
      alpha = (1.0 - sum.w) * alpha;
      sum += vec4f(vec3f(0.0), alpha);
    }
  }
  let alphaC = smoothstep(min(1.0 - radius0 * 0.5, 0.999), 1.0, sum.w);
  var sumRgb = sum.rgb / (sum.w + 0.0001);
  sumRgb -= 0.2 * vec3f(0.8, 0.75, 0.7) * pow(sundot, 10.0) * alphaC;
  sumRgb += min(glow, 10.0) * 0.2 * vec3f(1.2) * pow(sundot, 5.0) * (1.0 - alphaC);

  col = mix(col, sumRgb, sum.w);

  // haze
  col = fade * mix(col, vec3f(0.3, 0.5, 0.9), 29.0 * (pow(sundot, 50.0) - pow(sundot, 60.0)) / (2.0 + 9.0 * abs(rd.y)));

  // vignetting
  let xy2 = fragCoord / iResolution;
  col *= vec3f(0.5) + 0.25 * pow(100.0 * xy2.x * xy2.y * (1.0 - xy2.x) * (1.0 - xy2.y), 0.5);

  col = pg_hueRotate(max(col, vec3f(0.0)), hue) * (1.0 + pulse * 0.8);
  return vec4f(col, 1.0);
}

const PG_M = mat3x3f(vec3f(0.00, 1.60, 1.20), vec3f(-1.60, 0.72, -0.96), vec3f(-1.20, -0.96, 1.28));

fn pg_hash(n: f32) -> f32 {
  return fract(cos(n) * 41415.92653);
}

fn pg_noise(x: vec3f) -> f32 {
  let p = floor(x);
  let f = smoothstep(vec3f(0.0), vec3f(1.0), fract(x));
  let n = p.x + p.y * 57.0 + 113.0 * p.z;
  return mix(mix(mix(pg_hash(n + 0.0), pg_hash(n + 1.0), f.x),
                 mix(pg_hash(n + 57.0), pg_hash(n + 58.0), f.x), f.y),
             mix(mix(pg_hash(n + 113.0), pg_hash(n + 114.0), f.x),
                 mix(pg_hash(n + 170.0), pg_hash(n + 171.0), f.x), f.y), f.z);
}

fn pg_fbmslow(pIn: vec3f) -> f32 {
  var p = pIn;
  var f = 0.5000 * pg_noise(p); p = PG_M * p * 1.2;
  f += 0.2500 * pg_noise(p); p = PG_M * p * 1.3;
  f += 0.1666 * pg_noise(p); p = PG_M * p * 1.4;
  f += 0.0834 * pg_noise(p);
  return f;
}

fn pg_fbm(pIn: vec3f) -> f32 {
  var p = pIn;
  var f = 0.0;
  var a = 1.0;
  var s = 0.0;
  f += a * pg_noise(p); p = PG_M * p * 1.149; s += a; a *= 0.75;
  f += a * pg_noise(p); p = PG_M * p * 1.41;  s += a; a *= 0.75;
  f += a * pg_noise(p); p = PG_M * p * 1.51;  s += a; a *= 0.65;
  f += a * pg_noise(p); p = PG_M * p * 1.21;  s += a; a *= 0.35;
  f += a * pg_noise(p); p = PG_M * p * 1.41;  s += a; a *= 0.75;
  f += a * pg_noise(p);
  return f / s;
}

fn pg_hueRotate(c: vec3f, a: f32) -> vec3f {
  let k = vec3f(0.57735);
  let ca = cos(a);
  let sa = sin(a);
  return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca);
}
