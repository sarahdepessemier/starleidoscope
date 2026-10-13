// Procedural Red Planet by Julien Sulpis (https://twitter.com/jsulpis)
// https://www.shadertoy.com/view/msdXzl
// License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported
// Ported to WGSL. Changes: the camera orbits the planet with the mouse (look), and shared
// controls were added (spin = roll, pulse = flash, seed = new planet, hue = colour shift, zoom).
// wgslFn reads the FIRST function of this file: main first, helpers below.
fn redplanet(fragCoord: vec2f, iTime: f32, look: vec2f, spin: f32, pulse: f32, seed: f32, hue: f32, zoom: f32, iResolution: vec2f) -> vec4f {
  rp_time = iTime;
  rp_res = iResolution.x;
  rp_off = vec3f(seed * 3.71, seed * 1.93, seed * 2.37);

  let uv = fragCoord / iResolution;
  var p = (uv - 0.5) * iResolution / iResolution.y;
  p = p / zoom;
  p = vec2f(cos(spin) * p.x - sin(spin) * p.y, sin(spin) * p.x + cos(spin) * p.y);

  // camera orbits the planet with the mouse
  let orbit = rp_rotateY(-(look.x - 0.5) * 2.4) * rp_rotateX(-(look.y - 0.5) * 1.2);
  let ro = orbit * vec3f(0.0, 0.0, -6.0);
  let fwd = normalize(-ro);
  let right = normalize(cross(vec3f(0.0, 1.0, 0.0), fwd));
  let up = cross(fwd, right);
  let rd = normalize(p.x * right + p.y * up + fwd);

  // space background
  let backgroundRotation = rp_rotateY(-rp_time * RP_ROTATION_SPEED / 4.0);
  let backgroundCoord = rd * backgroundRotation;
  let spaceNoise = rp_fbm(backgroundCoord * 2.5, 4, 0.5, 2.0, 6.0);
  var color = mix(RP_SPACE_COLOR, RP_SPACE_DUST, spaceNoise);

  // planet geometry (only march when the ray touches the bounding sphere)
  var dist = RP_MAX_DIST;
  let boundR = RP_PLANET_RADIUS + RP_NOISE_STRENGTH + 0.05;
  let b = dot(ro, rd);
  let h = b * b - (dot(ro, ro) - boundR * boundR);
  if (h > 0.0) {
    dist = rp_rayMarch(ro, rd, max(-b - sqrt(h), 0.0));
  }
  let position = ro + rd * dist;
  let spaceMask = step(RP_MAX_DIST / 2.0, dist);
  let planetMask = 1.0 - spaceMask;

  // planet colours
  if (planetMask > 0.5) {
    color = rp_addLight(RP_PLANET_COLOR, position);
  }

  // atmosphere, measured in the plane facing the camera
  let distCameraToSphere = length(ro);
  let c = ro + rd * distCameraToSphere;
  let coordFromCenter = vec2f(dot(c, right), dot(c, up));
  let sunXY = vec2f(dot(RP_SUN_DIR, right), dot(RP_SUN_DIR, up));
  let distFromEdge = abs(length(coordFromCenter) - RP_PLANET_RADIUS);
  let planetEdge = max(1.0 - distFromEdge, 0.0);
  let atmosphereDensity = pow(clamp(rp_remap(dot(sunXY, coordFromCenter), -2.0, 1.0, 0.0, 1.0), 0.0, 1.0), 5.0);

  var atmosphere = pow(planetEdge, 50.0) * RP_ATMOSPHERE_COLOR * 2.0 * spaceMask;
  atmosphere += pow(planetEdge, 30.0) * RP_ATMOSPHERE_COLOR * (1.5 - planetMask);
  atmosphere += pow(planetEdge, 4.0) * RP_ATMOSPHERE_COLOR * 0.02;
  atmosphere += pow(planetEdge, 2.0) * RP_ATMOSPHERE_COLOR * 0.1 * planetMask;
  color += atmosphere * atmosphereDensity;

  // stars
  color += rp_stars(backgroundCoord) * spaceMask;

  // gamma
  color = pow(max(color, vec3f(0.0)), vec3f(1.0 / 2.4));

  // vignette
  let vig = length((uv - 0.5) * iResolution) / iResolution.x * 1.5;
  color *= max(1.0 - vig * vig * vig, 0.0);

  color = rp_hueRotate(color, hue) * (1.0 + pulse * 0.8);
  return vec4f(color, 1.0);
}

var<private> rp_time: f32;
var<private> rp_res: f32;
var<private> rp_off: vec3f;

const RP_MAX_STEPS = 100;
const RP_MAX_DIST = 100.0;
const RP_SURF_DIST = 0.0001;
const RP_PLANET_RADIUS = 2.0;
const RP_NOISE_STRENGTH = 0.2;
const RP_ROTATION_SPEED = 0.1;
const RP_PLANET_COLOR = vec3f(0.6, 0.3, 0.23);
const RP_ATMOSPHERE_COLOR = vec3f(0.9, 0.15, 0.05);
const RP_SUN_DIR = vec3f(0.0, 1.0, 0.0);
const RP_SUN_COLOR = vec3f(3.0, 3.0, 2.7);
const RP_AMBIENT_LIGHT = vec3f(0.5);
const RP_SPACE_COLOR = vec3f(0.0, 0.0, 0.002);
const RP_SPACE_DUST = vec3f(0.1, 0.0, 0.2);

fn rp_remap(v: f32, inMin: f32, inMax: f32, outMin: f32, outMax: f32) -> f32 {
  return mix(outMin, outMax, (v - inMin) / (inMax - inMin));
}

fn rp_mod289(x: vec4f) -> vec4f { return x - floor(x * (1.0 / 289.0)) * 289.0; }
fn rp_permute(x: vec4f) -> vec4f { return rp_mod289(((x * 34.0) + 1.0) * x); }

// https://github.com/yiwenl/glsl-fbm/blob/master/3d.glsl
fn rp_noise(pIn: vec3f) -> f32 {
  let p = pIn + rp_off;
  let a = floor(p);
  var d = p - a;
  d = d * d * (3.0 - 2.0 * d);

  let b = a.xxyy + vec4f(0.0, 1.0, 0.0, 1.0);
  let k1 = rp_permute(b.xyxy);
  let k2 = rp_permute(k1.xyxy + b.zzww);

  let c = k2 + a.zzzz;
  let k3 = rp_permute(c);
  let k4 = rp_permute(c + 1.0);

  let o1 = fract(k3 * (1.0 / 41.0));
  let o2 = fract(k4 * (1.0 / 41.0));

  let o3 = o2 * d.z + o1 * (1.0 - d.z);
  let o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

  return o4.y * d.y + o4.x * (1.0 - d.y);
}

// SimonDev - https://simondev.teachable.com/p/glsl-shaders-from-scratch
fn rp_fbm(p: vec3f, octaves: i32, persistence: f32, lacunarity: f32, exponentiation: f32) -> f32 {
  var amplitude = 0.5;
  var frequency = 3.0;
  var total = 0.0;
  var normalization = 0.0;
  for (var i = 0; i < octaves; i++) {
    total += rp_noise(p * frequency) * amplitude;
    normalization += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  total /= normalization;
  total = total * 0.8 + 0.1;
  return pow(max(total, 0.0), exponentiation);
}

fn rp_rotateX(angle: f32) -> mat3x3f {
  let c = cos(angle);
  let s = sin(angle);
  return mat3x3f(vec3f(1.0, 0.0, 0.0), vec3f(0.0, c, s), vec3f(0.0, -s, c));
}

fn rp_rotateY(angle: f32) -> mat3x3f {
  let c = cos(angle);
  let s = sin(angle);
  return mat3x3f(vec3f(c, 0.0, s), vec3f(0.0, 1.0, 0.0), vec3f(-s, 0.0, c));
}

fn rp_hash33(q: vec3f) -> vec3f {
  var p = vec3u(vec3i(q));
  p = p * vec3u(374761393u, 1103515245u, 668265263u) + p.zxy + p.yzx;
  p = p.yzx * (p.zxy ^ (p >> vec3u(3u)));
  return vec3f(p ^ (p >> vec3u(16u))) * (1.0 / 4294967295.0);
}

// https://www.shadertoy.com/view/XsyGWV
fn rp_stars(pIn: vec3f) -> vec3f {
  var p = pIn;
  var c = vec3f(0.0);
  let res = rp_res * 0.8;
  for (var i = 0; i < 5; i++) {
    let q = fract(p * (0.15 * res)) - 0.5;
    let id = floor(p * (0.15 * res));
    let rn = rp_hash33(id).xy;
    var c2 = 1.0 - smoothstep(0.0, 0.6, length(q));
    c2 *= step(rn.x, 0.0005 + f32(i) * 0.002);
    c += c2 * (mix(vec3f(1.0, 0.49, 0.1), vec3f(0.75, 0.9, 1.0), rn.y) * 0.25 + 0.75);
    p *= 1.4;
  }
  return c * c;
}

fn rp_hueRotate(c: vec3f, a: f32) -> vec3f {
  let k = vec3f(0.57735);
  let ca = cos(a);
  let sa = sin(a);
  return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca);
}

// sphere with fbm noise on the radius; the planet sits at the origin and rotates
fn rp_planetSDF(p: vec3f) -> f32 {
  let position = p * rp_rotateY(rp_time * RP_ROTATION_SPEED);
  let n = rp_fbm(position, 6, 0.6, 2.0, 5.0) * RP_NOISE_STRENGTH;
  return length(position) - (RP_PLANET_RADIUS + n);
}

fn rp_rayMarch(ro: vec3f, rd: vec3f, start: f32) -> f32 {
  var dO = start;
  for (var i = 0; i < RP_MAX_STEPS; i++) {
    let dS = rp_planetSDF(ro + rd * dO);
    dO += dS;
    if (dO > RP_MAX_DIST || dS < RP_SURF_DIST) { break; }
  }
  return dO;
}

fn rp_getNormal(p: vec3f) -> vec3f {
  let dist = rp_planetSDF(p);
  let e = vec2f(0.01, 0.0);
  let normal = dist - vec3f(
    rp_planetSDF(p - e.xyy),
    rp_planetSDF(p - e.yxy),
    rp_planetSDF(p + e.yyx)
  );
  return normalize(normal);
}

fn rp_addLight(color: vec3f, p: vec3f) -> vec3f {
  let normal = rp_getNormal(p);
  // the power softens the shadow: not physically accurate but it looks better
  let exposition = pow(max(0.0, dot(RP_SUN_DIR, normal)), 1.5);
  let diffuse = exposition * RP_SUN_COLOR;
  return color * (RP_AMBIENT_LIGHT * 0.006 + diffuse);
}
