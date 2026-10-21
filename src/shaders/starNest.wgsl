// Star Nest by Pablo Roman Andrioli (Shadertoy user: Kali)
// https://www.shadertoy.com/view/XlfGRj
// License: MIT
// Ported to WGSL. Changes: the mouse (look) turns the view like the original, and shared controls
// were added (spin = roll, pulse = flash, seed = new place in the nebula, hue = colour shift, zoom).
// wgslFn reads the FIRST function of this file: main first, helpers below.
fn starnest(fragCoord: vec2f, iTime: f32, look: vec2f, spin: f32, pulse: f32, seed: f32, hue: f32, zoom: f32, iResolution: vec2f) -> vec4f {
  // get coords and direction
  var uv = fragCoord / iResolution - 0.5;
  uv.y *= iResolution.y / iResolution.x;
  uv = vec2f(cos(spin) * uv.x - sin(spin) * uv.y, sin(spin) * uv.x + cos(spin) * uv.y);
  var dir = vec3f(uv * SN_ZOOM / zoom, 1.0);
  let time = iTime * SN_SPEED + 0.25;

  // fixed base rotation (as in the original with the mouse in the middle) ...
  let c1 = cos(1.5); let s1 = sin(1.5);
  let c2 = cos(1.8); let s2 = sin(1.8);
  dir = vec3f(dir.x * c1 + dir.z * s1, dir.y, -dir.x * s1 + dir.z * c1);
  dir = vec3f(dir.x * c2 + dir.y * s2, -dir.x * s2 + dir.y * c2, dir.z);
  // ... the mouse only tilts the viewing direction a little. In the original the mouse also rotated the
  // camera position through the fractal, which made the picture race past.
  let m1 = (look.x - 0.5) * 0.35; let m2 = (look.y - 0.5) * 0.35;
  dir = vec3f(dir.x * cos(m1) + dir.z * sin(m1), dir.y, -dir.x * sin(m1) + dir.z * cos(m1));
  dir = vec3f(dir.x * cos(m2) + dir.y * sin(m2), -dir.x * sin(m2) + dir.y * cos(m2), dir.z);
  var origin = vec3f(1.0, 0.5, 0.5) + vec3f(time * 2.0, time, -2.0) + vec3f(seed * 0.173, seed * 0.091, 0.0);
  origin = vec3f(origin.x * c1 + origin.z * s1, origin.y, -origin.x * s1 + origin.z * c1);
  origin = vec3f(origin.x * c2 + origin.y * s2, -origin.x * s2 + origin.y * c2, origin.z);

  // volumetric rendering
  var s = 0.1;
  var fade = 1.0;
  var v = vec3f(0.0);
  for (var r = 0; r < SN_VOLSTEPS; r++) {
    var p = origin + s * dir * 0.5;
    p = abs(vec3f(SN_TILE) - sn_mod(p, vec3f(SN_TILE * 2.0))); // tiling fold
    var pa = 0.0;
    var a = 0.0;
    for (var i = 0; i < SN_ITERATIONS; i++) {
      p = abs(p) / max(dot(p, p), 1e-4) - SN_FORMUPARAM; // the magic formula
      a += abs(length(p) - pa);                           // absolute sum of average change
      pa = length(p);
    }
    a = min(a, 400.0);                                    // keeps a*a*a finite on every GPU
    let dm = max(0.0, SN_DARKMATTER - a * a * 0.001);     // dark matter
    a *= a * a;                                           // add contrast
    if (r > 6) { fade *= 1.0 - dm; }                      // dark matter, don't render near
    v += fade;
    v += vec3f(s, s * s, s * s * s * s) * a * SN_BRIGHTNESS * fade; // colouring based on distance
    fade *= SN_DISTFADING;                                // distance fading
    s += SN_STEPSIZE;
  }
  v = mix(vec3f(length(v)), v, SN_SATURATION);            // colour adjust
  var color = clamp(v * 0.016, vec3f(0.0), vec3f(4.0));
  color = sn_hueRotate(color, hue) * (1.0 + pulse * 0.8);
  return vec4f(color, 1.0);
}

const SN_ITERATIONS = 17;
const SN_FORMUPARAM = 0.53;
const SN_VOLSTEPS = 20;
const SN_STEPSIZE = 0.1;
const SN_ZOOM = 0.8;
const SN_TILE = 0.85;
const SN_SPEED = 0.01;
const SN_BRIGHTNESS = 0.0015;
const SN_DARKMATTER = 0.3;
const SN_DISTFADING = 0.73;
const SN_SATURATION = 0.85;

// GLSL mod: x - y * floor(x / y) (WGSL % truncates, which differs for negative numbers)
fn sn_mod(x: vec3f, y: vec3f) -> vec3f {
  return x - y * floor(x / y);
}

fn sn_hueRotate(c: vec3f, a: f32) -> vec3f {
  let k = vec3f(0.57735);
  let ca = cos(a);
  let sa = sin(a);
  return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca);
}
