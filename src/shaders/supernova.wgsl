// "Supernova remnant" by Duke
// https://www.shadertoy.com/view/MdKXzc
// Based on "Dusty nebula 4" (https://www.shadertoy.com/view/MsVXWW),
// "Protoplanetary disk" (https://www.shadertoy.com/view/MdtGRl), otaviogood's "Alien Beacon"
// (https://www.shadertoy.com/view/ld2SzK) and Shane's "Cheap Cloud Flythrough" (https://www.shadertoy.com/view/Xsc3R4)
// License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
// Ported to WGSL. Changes: the noise textures (iChannel0 / iChannel2) are replaced by procedural
// noise, the 1-2-3 zoom keys become the shared zoom, the mouse turns the nebula (look), and shared
// controls were added (spin = roll, pulse = flash, seed = new nebula, hue = colour shift).
// wgslFn reads the FIRST function of this file: main first, helpers below.
fn supernova(fragCoord: vec2f, iTime: f32, look: vec2f, spin: f32, pulse: f32, seed: f32, hue: f32, zoom: f32, iResolution: vec2f) -> vec4f {
  sr_time = iTime;
  sr_ang = (look.x - 0.5) * 4.0;
  sr_ang2 = (look.y - 0.5) * 2.0;
  sr_seed = seed;

  var q = (fragCoord - 0.5 * iResolution) / iResolution.y;
  q = vec2f(cos(spin) * q.x - sin(spin) * q.y, sin(spin) * q.x + cos(spin) * q.y);
  let rd = normalize(vec3f(q, 1.0));
  let ro = vec3f(0.0, 0.0, -6.0 / zoom);

  var ld = 0.0;
  var td = 0.0;
  var w = 0.0;
  var t = 0.0;
  let h = 0.1;
  var sum = vec4f(0.0);
  var minDist = 0.0;
  var maxDist = 0.0;

  // ray vs bounding sphere
  let b = dot(rd, ro);
  let c = dot(ro, ro) - 8.0;
  let delta = b * b - c;
  if (delta >= 0.0) {
    let ds = sqrt(delta);
    minDist = -b - ds;
    maxDist = -b + ds;
    if (maxDist > 0.0) {
      t = max(minDist, 0.0) * step(t, minDist);

      for (var i = 0; i < 64; i++) {
        let pos = ro + t * rd;

        // loop break conditions (the original's `d` in this test is the outer d = 1.0)
        if (td > 0.9 || t > 10.0 || sum.a > 0.99 || t > maxDist) { break; }

        var d = sr_map(pos);
        d = max(d, 0.0);

        // point light
        let ldst = vec3f(0.0) - pos;
        let lDist = max(length(ldst), 0.001);
        let lightColor = vec3f(1.0, 0.5, 0.25);

        sum = vec4f(sum.rgb + vec3f(0.67, 0.75, 1.00) / (lDist * lDist * 10.0) / 80.0, sum.a);    // star itself
        sum = vec4f(sum.rgb + lightColor / exp(lDist * lDist * lDist * 0.08) / 30.0, sum.a);      // bloom

        if (d < h) {
          ld = h - d;
          w = (1.0 - td) * ld;
          td += w + 1.0 / 200.0;

          var col = vec4f(sr_computeColor(td, lDist), td);

          // emission
          sum += sum.a * vec4f(sum.rgb, 0.0) * 0.2;

          col.a *= 0.2;
          col = vec4f(col.rgb * col.a, col.a);
          sum = sum + col * (1.0 - sum.a);
        }

        td += 1.0 / 70.0;

        // dithering (the original used a noise texture)
        let uv = fragCoord / iResolution * vec2f(280.0, 120.0);
        d = abs(d) * (0.8 + 0.08 * sr_hash21(vec2f(uv.y, -uv.x + 0.5 * sin(4.0 * sr_time + uv.y * 4.0))));

        // step size: bigger near the camera and the light source
        t += max(d * 0.1 * max(min(length(ldst), length(ro)), 1.0), 0.01);
      }

      // simple scattering
      sum *= 1.0 / exp(ld * 0.2) * 0.6;
      sum = clamp(sum, vec4f(0.0), vec4f(1.0));
      sum = vec4f(sum.xyz * sum.xyz * (3.0 - 2.0 * sum.xyz), sum.a);
    }
  }

  // stars background
  if (td < 0.8) {
    let stars = vec3f(sr_noise(rd * 500.0) * 0.5 + 0.5);
    var starbg = vec3f(0.0);
    starbg = mix(starbg, vec3f(0.8, 0.9, 1.0), smoothstep(vec3f(0.99), vec3f(1.0), stars) * 0.75);
    starbg = clamp(starbg, vec3f(0.0), vec3f(1.0));
    sum = vec4f(sum.xyz + starbg, sum.a);
  }

  let color = sr_hueRotate(sum.xyz, hue) * (1.0 + pulse * 0.8);
  return vec4f(color, 1.0);
}

var<private> sr_time: f32;
var<private> sr_ang: f32;
var<private> sr_ang2: f32;
var<private> sr_seed: f32;

const SR_PI = 3.14159265;
const SR_NUDGE = 0.9;               // size of perpendicular vector
const SR_NORMALIZER = 0.743294;     // 1 / sqrt(1 + nudge^2)

fn sr_hash(v: vec3f) -> f32 {
  let p = fract(v * vec3f(0.1031, 0.1030, 0.0973));
  let q = p + dot(p, p.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

fn sr_hash21(p: vec2f) -> f32 {
  var q = fract(vec3f(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

// stand-in for iq's texture based noise: smooth 3D value noise in 0.18..1
fn sr_noise(x: vec3f) -> f32 {
  let p = floor(x);
  var f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  let a = mix(mix(sr_hash(p), sr_hash(p + vec3f(1.0, 0.0, 0.0)), f.x),
              mix(sr_hash(p + vec3f(0.0, 1.0, 0.0)), sr_hash(p + vec3f(1.0, 1.0, 0.0)), f.x), f.y);
  let b = mix(mix(sr_hash(p + vec3f(0.0, 0.0, 1.0)), sr_hash(p + vec3f(1.0, 0.0, 1.0)), f.x),
              mix(sr_hash(p + vec3f(0.0, 1.0, 1.0)), sr_hash(p + vec3f(1.0, 1.0, 1.0)), f.x), f.y);
  return 1.0 - 0.82 * mix(a, b, f.z);
}

fn sr_fbm(p: vec3f) -> f32 {
  return sr_noise(p * 0.06125) * 0.5 + sr_noise(p * 0.125) * 0.25 + sr_noise(p * 0.25) * 0.125 + sr_noise(p * 0.4) * 0.2;
}

fn sr_length8(pIn: vec2f) -> f32 {
  var p = pIn * pIn; p = p * p; p = p * p;
  return pow(p.x + p.y, 1.0 / 8.0);
}

fn sr_disk(p: vec3f, t: vec3f) -> f32 {
  let q = vec2f(length(p.xy) - t.x, p.z * 0.5);
  return max(sr_length8(q) - t.y, abs(p.z) - t.z);
}

// otaviogood's spiral noise: https://www.shadertoy.com/view/ld2SzK
fn sr_spiralNoiseC(pIn: vec3f) -> f32 {
  var p = pIn;
  var n = 0.0;
  var iter = 2.0;
  for (var i = 0; i < 8; i++) {
    n += -abs(sin(p.y * iter) + cos(p.x * iter)) / iter;
    var xy = p.xy + vec2f(p.y, -p.x) * SR_NUDGE;
    xy = xy * SR_NORMALIZER;
    var xz = vec2f(xy.x, p.z) + vec2f(p.z, -xy.x) * SR_NUDGE;
    xz = xz * SR_NORMALIZER;
    p = vec3f(xz.x, xy.y, xz.y);
    iter *= 1.733733;
  }
  return n;
}

fn sr_nebulaNoise(p: vec3f) -> f32 {
  var total = sr_disk(p.xzy, vec3f(2.0, 1.8, 1.25));
  total += sr_fbm(p * 90.0);
  total += sr_spiralNoiseC(p.zxy * 0.5123 + 100.0) * 3.0;
  return total;
}

fn sr_rot(p: vec2f, a: f32) -> vec2f {
  return cos(a) * p + sin(a) * vec2f(p.y, -p.x);
}

fn sr_map(pIn: vec3f) -> f32 {
  var p = pIn;
  let xz = sr_rot(p.xz, sr_ang + sr_time * 0.1 + sr_seed * 0.37);
  p = vec3f(xz.x, p.y, xz.y);
  let yz = sr_rot(p.yz, sr_ang2);
  p = vec3f(p.x, yz.x, yz.y);
  let nebNoise = abs(sr_nebulaNoise(p / 0.5) * 0.5);
  return nebNoise + 0.07;
}

// colour of the media
fn sr_computeColor(density: f32, radius: f32) -> vec3f {
  var result = mix(vec3f(1.0, 0.9, 0.8), vec3f(0.4, 0.15, 0.1), density);
  let colCenter = 7.0 * vec3f(0.8, 1.0, 1.0);
  let colEdge = 1.5 * vec3f(0.48, 0.53, 0.5);
  result *= mix(colCenter, colEdge, min((radius + 0.05) / 0.9, 1.15));
  return result;
}

fn sr_hueRotate(c: vec3f, a: f32) -> vec3f {
  let k = vec3f(0.57735);
  let ca = cos(a);
  let sa = sin(a);
  return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca);
}
