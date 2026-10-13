// Neon wormhole shader, license: CC BY-NC https://creativecommons.org/licenses/by-nc/4.0/
// Shadertoy URL: TODO (add the original link and author here and in the README)
// Ported to WGSL. Changes: the noise texture (iChannel0) is replaced by a procedural noise that
// repeats around the circle, the mouse moves the gate (look), and shared controls were added
// (spin = roll, pulse = flash, seed = new pattern, hue = colour shift, zoom).
// wgslFn reads the FIRST function of this file: main first, helpers below.
fn neongate(fragCoord: vec2f, iTime: f32, look: vec2f, spin: f32, pulse: f32, seed: f32, hue: f32, zoom: f32, iResolution: vec2f) -> vec4f {
  nw_seed = seed * 7.31;
  let t = iTime;

  var uv = (fragCoord - iResolution / 2.0) / iResolution.y;
  uv = uv / zoom;
  uv = nw_rot(uv, spin);
  uv = uv - (look - 0.5) * vec2f(0.7, -0.7);          // the gate drifts with the mouse
  uv.x += 0.2 * sin(uv.y * 3.0 + t * 0.23) * uv.y;     // slight distortion of the overall space

  let angle = atan2(uv.y, uv.x);
  let normalizedAngle = angle / NW_TWO_PI;

  let baseRadius = length(uv);

  let radius1 = baseRadius + sin(angle * 3.0 + t) * 0.01 + sin(angle * 4.0) * 0.01;
  let radius2 = baseRadius + sin(angle * 4.0 + t * 1.1 + 1.7) * 0.02 + sin(angle * 4.0 + 1.3 + t * -0.9) * 0.01;

  let mask1 = nw_tex(vec2f(normalizedAngle + sin(radius1 * 4.0) * 0.03, pow(max(1.0 - (radius1 - 0.4), 0.0), 0.5) * 0.8 + t * 0.2)).r;
  let mask2 = nw_tex(vec2f(normalizedAngle * 2.0 + 2.0 + sin(radius2 * 3.0) * 0.05 + sin(radius1 * 4.3) * 0.02, (radius2 - 0.4) * 0.2 - t * 0.1)).g;

  var mainMask = mask1 * mask2 * 2.2; // arbitrary scaling factor, brighten things up a bit

  // fade out the centre
  mainMask *= smoothstep(0.05, 0.2, radius1 + 0.005 * sin(angle * 5.0 - t * 0.4));

  var outerMask = nw_tex(vec2f(normalizedAngle + t * -0.02, baseRadius * 0.05 - t * 0.1)).b;
  outerMask *= nw_tex(vec2f(normalizedAngle + 1.3 + t * 0.03, baseRadius * 0.4 + t * -0.05)).b * 2.0;

  // adjust the amount of masking applied based on the distance from the centre
  // (the original smoothstep had reversed edges: rewritten as 1 - smoothstep)
  outerMask = 1.0 - smoothstep(0.7 - baseRadius, 1.4 - baseRadius, outerMask);

  mainMask *= outerMask;

  let colorMask = nw_tex(vec2f(normalizedAngle * 2.0 + t * 0.11, baseRadius - t * 0.3 + sin(baseRadius * 0.6) * 0.4)).r;

  let mainColor1 = vec3f(1.2, 0.3, 0.7);
  let mainColor2 = vec3f(0.3, 1.0, 1.0);

  var color = mix(mainColor2, mainColor1, colorMask);

  // hide the colour pattern a bit
  color -= vec3f(0.4, 0.2, 0.2) * nw_tex(vec2f(normalizedAngle * 3.0 - t * 0.13, baseRadius - t * 0.23)).g;

  let c = color * mainMask;
  color = c * c * 3.0;   // pow(c, 2.0) is undefined for negative c in WGSL

  color = nw_hueRotate(color, hue) * (1.0 + pulse * 0.8);
  return vec4f(color, 1.0);
}

const NW_TWO_PI = 6.283;
const NW_FREQ = 14;          // noise cells around the circle (an integer, so the seam is invisible)
var<private> nw_seed: f32;

fn nw_rot(p: vec2f, a: f32) -> vec2f {
  let c = cos(a);
  let s = sin(a);
  return vec2f(c * p.x - s * p.y, s * p.x + c * p.y);
}

fn nw_hueRotate(c: vec3f, a: f32) -> vec3f {
  let k = vec3f(0.57735);
  let ca = cos(a);
  let sa = sin(a);
  return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca);
}

// pcg-style integer hash: one random vec3 per lattice point
fn nw_hash(ix: i32, iy: i32) -> vec3f {
  var v = vec3u(bitcast<u32>(ix), bitcast<u32>(iy), 0x9e3779b9u);
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v = v ^ (v >> vec3u(16u));
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return vec3f(v >> vec3u(8u)) * (1.0 / 16777215.0);
}

// value noise that repeats in x with period `period` cells
fn nw_vnoise(p: vec2f, period: i32) -> vec3f {
  let fl = floor(p);
  let f = p - fl;
  let w = f * f * (3.0 - 2.0 * f);
  let x0 = ((i32(fl.x) % period) + period) % period;
  let x1 = (x0 + 1) % period;
  let y0 = i32(fl.y);
  let y1 = y0 + 1;
  let a = nw_hash(x0, y0);
  let b = nw_hash(x1, y0);
  let c = nw_hash(x0, y1);
  let d = nw_hash(x1, y1);
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}

// stand-in for texture(iChannel0, p): 3 independent noise channels, repeating with period 1 in x
fn nw_tex(p: vec2f) -> vec3f {
  let q = vec2f(fract(p.x) * f32(NW_FREQ), p.y * f32(NW_FREQ) + nw_seed);
  let q2 = vec2f(fract(p.x) * f32(NW_FREQ * 2), p.y * f32(NW_FREQ * 2) + nw_seed * 1.7);
  let v = nw_vnoise(q, NW_FREQ) * 0.65 + nw_vnoise(q2, NW_FREQ * 2) * 0.35;
  return clamp((v - 0.5) * 1.7 + 0.5, vec3f(0.0), vec3f(1.0));
}
