// Procedural Blue Planet by Julien Sulpis (https://twitter.com/jsulpis)
// https://www.shadertoy.com/view/Ds3XRl
// Ported to WGSL. Changes: the 3D noise texture (iChannel0) is replaced by procedural noise,
// the camera orbits the planet with the mouse (look), and shared controls were added
// (spin = roll, pulse = flash, seed = new planet, hue = colour shift, zoom).
// wgslFn reads the FIRST function of this file: main first, helpers below.
fn blueplanet(fragCoord: vec2f, iTime: f32, look: vec2f, spin: f32, pulse: f32, seed: f32, hue: f32, zoom: f32, iResolution: vec2f) -> vec4f {
  bp_time = iTime;
  bp_res = iResolution.x;
  bp_off = vec3f(seed * 3.71, seed * 1.93, seed * 2.37);

  var uv = (fragCoord / iResolution - 0.5) * iResolution / iResolution.y;
  uv = uv / zoom;
  uv = vec2f(cos(spin) * uv.x - sin(spin) * uv.y, sin(spin) * uv.x + cos(spin) * uv.y);

  // the camera orbits around the planet when the mouse moves
  let orbit = bp_rotateY(-(look.x - 0.5) * 2.4) * bp_rotateX(-(look.y - 0.5) * 1.2);
  let ro = orbit * vec3f(0.0, 0.0, 6.0);
  let fwd = normalize(-ro);
  let right = normalize(cross(fwd, vec3f(0.0, 1.0, 0.0)));
  let up = cross(right, fwd);
  let rd = normalize(uv.x * right + uv.y * up + fwd);

  let rad = bp_radiance(BpRay(ro, rd));
  var color = rad.xyz;
  color += bp_atmosphereColor(ro, rd, rad.w);
  color = bp_tonemap(color);
  color *= max(1.0 - 0.5 * pow(length(uv), 3.0), 0.0);
  color = bp_hueRotate(color, hue) * (1.0 + pulse * 0.8);
  return vec4f(color, 1.0);
}

// ---- globals set by the main function ---------------------------------------
var<private> bp_time: f32;
var<private> bp_res: f32;
var<private> bp_off: vec3f;

// ---- constants -----------------------------------------------------------------
const BP_PI = 3.14159265359;
const BP_PLANET_POSITION = vec3f(0.0, 0.0, 0.0);
const BP_PLANET_RADIUS = 2.0;
const BP_NOISE_STRENGTH = 0.2;
const BP_ROTATION_SPEED = -0.1;
const BP_MOON_RADIUS = 0.08;
const BP_MOON_ROTATION_SPEED = -0.5;
const BP_MOON_OFFSET = vec3f(2.4, 0.5, 0.0);

const BP_WATER_COLOR_DEEP = vec3f(0.01, 0.05, 0.15);
const BP_WATER_COLOR_SURFACE = vec3f(0.02, 0.12, 0.27);
const BP_SAND_COLOR = vec3f(1.0, 1.0, 0.85);
const BP_TREE_COLOR = vec3f(0.02, 0.1, 0.06);
const BP_ROCK_COLOR = vec3f(0.15, 0.12, 0.12);
const BP_ICE_COLOR = vec3f(0.8, 0.9, 0.9);
const BP_CLOUD_COLOR = vec3f(1.0, 1.0, 1.0);
const BP_ATMOSPHERE_COLOR = vec3f(0.05, 0.3, 0.9);

const BP_WATER_SURFACE_LEVEL = 0.0;
const BP_SAND_LEVEL = 0.028;
const BP_TREE_LEVEL = 0.03;
const BP_ROCK_LEVEL = 0.1;
const BP_ICE_LEVEL = 0.15;
const BP_TRANSITION = 0.02;

const BP_SUN_DIR = vec3f(0.70710678, 0.70710678, 0.0);
const BP_SUN_COLOR = vec3f(3.0, 3.0, 2.7);
const BP_AMBIENT_LIGHT = vec3f(0.003);
const BP_SPACE_BLUE = vec3f(0.0, 0.0, 0.002);
const BP_EPSILON = 0.001;
const BP_INFINITY = 1e10;

struct BpRay { origin: vec3f, direction: vec3f }
struct BpMaterial { color: vec3f, diffuse: f32, specular: f32 }
struct BpHit { len: f32, normal: vec3f, material: BpMaterial }
struct BpSphere { position: vec3f, radius: f32 }

fn bp_miss() -> BpHit {
  return BpHit(BP_INFINITY, vec3f(0.0), BpMaterial(vec3f(0.0), -1.0, -1.0));
}

// ---- utilities ---------------------------------------------------------------
fn bp_sphIntersect(ray: BpRay, sphere: BpSphere) -> f32 {
  let oc = ray.origin - sphere.position;
  let b = dot(oc, ray.direction);
  let c = dot(oc, oc) - sphere.radius * sphere.radius;
  let h = b * b - c;
  if (h < 0.0) { return -1.0; }
  return -b - sqrt(h);
}

fn bp_mod289(x: vec4f) -> vec4f { return x - floor(x * (1.0 / 289.0)) * 289.0; }
fn bp_permute(x: vec4f) -> vec4f { return bp_mod289(((x * 34.0) + 1.0) * x); }

// smooth 3D value noise (replaces the noise texture of the original)
fn bp_noise3(p: vec3f) -> f32 {
  let a = floor(p);
  var d = p - a;
  d = d * d * (3.0 - 2.0 * d);

  let b = a.xxyy + vec4f(0.0, 1.0, 0.0, 1.0);
  let k1 = bp_permute(b.xyxy);
  let k2 = bp_permute(k1.xyxy + b.zzww);

  let c = k2 + a.zzzz;
  let k3 = bp_permute(c);
  let k4 = bp_permute(c + 1.0);

  let o1 = fract(k3 * (1.0 / 41.0));
  let o2 = fract(k4 * (1.0 / 41.0));

  let o3 = o2 * d.z + o1 * (1.0 - d.z);
  let o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

  return o4.y * d.y + o4.x * (1.0 - d.y);
}

// the original read texture(iChannel0, p * .05) of a 32x32x32 noise volume
fn bp_noise(p: vec3f) -> f32 {
  return bp_noise3(p * 1.6 + bp_off);
}

fn bp_inverseLerp(v: f32, minValue: f32, maxValue: f32) -> f32 {
  return (v - minValue) / (maxValue - minValue);
}

fn bp_remap(v: f32, inMin: f32, inMax: f32, outMin: f32, outMax: f32) -> f32 {
  return mix(outMin, outMax, bp_inverseLerp(v, inMin, inMax));
}

fn bp_fbm(p: vec3f, octaves: i32, persistence: f32, lacunarity: f32, exponentiation: f32) -> f32 {
  var amplitude = 0.5;
  var frequency = 3.0;
  var total = 0.0;
  var normalization = 0.0;
  for (var i = 0; i < octaves; i++) {
    let noiseValue = bp_noise(p * frequency);
    total += noiseValue * amplitude;
    normalization += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  total /= normalization;
  total = total * 0.8 + 0.1;
  total = pow(total, exponentiation);
  return total;
}

fn bp_rotateX(angle: f32) -> mat3x3f {
  let c = cos(angle);
  let s = sin(angle);
  return mat3x3f(vec3f(1.0, 0.0, 0.0), vec3f(0.0, c, s), vec3f(0.0, -s, c));
}

fn bp_rotateY(angle: f32) -> mat3x3f {
  let c = cos(angle);
  let s = sin(angle);
  return mat3x3f(vec3f(c, 0.0, s), vec3f(0.0, 1.0, 0.0), vec3f(-s, 0.0, c));
}

fn bp_rotateZ(angle: f32) -> mat3x3f {
  let c = cos(angle);
  let s = sin(angle);
  return mat3x3f(vec3f(c, -s, 0.0), vec3f(s, c, 0.0), vec3f(0.0, 0.0, 1.0));
}

fn bp_rotate3d(axisIn: vec3f, angle: f32) -> mat3x3f {
  let axis = normalize(axisIn);
  let s = sin(angle);
  let c = cos(angle);
  let oc = 1.0 - c;
  return mat3x3f(
    vec3f(oc * axis.x * axis.x + c, oc * axis.x * axis.y - axis.z * s, oc * axis.z * axis.x + axis.y * s),
    vec3f(oc * axis.x * axis.y + axis.z * s, oc * axis.y * axis.y + c, oc * axis.y * axis.z - axis.x * s),
    vec3f(oc * axis.z * axis.x - axis.y * s, oc * axis.y * axis.z + axis.x * s, oc * axis.z * axis.z + c)
  );
}

fn bp_hash33(q: vec3f) -> vec3f {
  var p = vec3u(vec3i(q));
  p = p * vec3u(374761393u, 1103515245u, 668265263u) + p.zxy + p.yzx;
  p = p.yzx * (p.zxy ^ (p >> vec3u(3u)));
  return vec3f(p ^ (p >> vec3u(16u))) * (1.0 / 4294967295.0);
}

// nimitz - https://www.shadertoy.com/view/XsyGWV
fn bp_stars(pIn: vec3f) -> vec3f {
  var p = pIn;
  var c = vec3f(0.0);
  let res = bp_res * 0.8;
  for (var i = 0; i < 5; i++) {
    let q = fract(p * (0.15 * res)) - 0.5;
    let id = floor(p * (0.15 * res));
    let rn = bp_hash33(id).xy;
    var c2 = 1.0 - smoothstep(0.0, 0.6, length(q));
    c2 *= step(rn.x, 0.0005 + f32(i) * 0.002);
    c += c2 * (mix(vec3f(1.0, 0.49, 0.1), vec3f(0.75, 0.9, 1.0), rn.y) * 0.25 + 0.75);
    p *= 1.4;
  }
  return c * c;
}

fn bp_domainWarpingFBM(p: vec3f) -> f32 {
  let persistence = 0.3;
  let lacunarity = 5.0;
  let offset = vec3f(
    bp_fbm(p, 3, persistence, lacunarity, 1.0),
    bp_fbm(p + vec3f(43.235, 23.112, 0.0), 3, persistence, lacunarity, 1.0),
    0.0
  );
  return bp_fbm(p + 1.0 * offset, 2, persistence, lacunarity, 1.0);
}

// Zavie - https://www.shadertoy.com/view/lslGzl
fn bp_tonemap(colorIn: vec3f) -> vec3f {
  let exposure = 1.5;
  let color = colorIn * (exposure / (1.0 + colorIn / exposure));
  return pow(color, vec3f(1.0 / 2.4));
}

fn bp_hueRotate(c: vec3f, a: f32) -> vec3f {
  let k = vec3f(0.57735);
  let ca = cos(a);
  let sa = sin(a);
  return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca);
}

// ---- planet --------------------------------------------------------------------
fn bp_planetRotation() -> mat3x3f {
  return bp_rotateY(bp_time * BP_ROTATION_SPEED);
}

fn bp_planetNoise(p: vec3f) -> f32 {
  let n = bp_fbm(p * 0.8, 6, 0.5, 2.0, 5.0) * BP_NOISE_STRENGTH * 0.72;   // 0.72: a bit more ocean
  // flatten the noise on the oceans
  return mix(n / 3.0 + BP_NOISE_STRENGTH / 50.0, n, smoothstep(BP_SAND_LEVEL, BP_SAND_LEVEL + BP_TRANSITION / 2.0, n * 5.0));
}

// standard ray-sphere intersection with fbm noise added to the radius
fn bp_planetDist(ro: vec3f, rd: vec3f) -> f32 {
  let ray = BpRay(ro, rd);
  let smoothSphereDist = bp_sphIntersect(ray, BpSphere(BP_PLANET_POSITION, BP_PLANET_RADIUS));
  let intersection = ro + smoothSphereDist * rd;
  let rotated = (intersection - BP_PLANET_POSITION) * bp_planetRotation() + BP_PLANET_POSITION;
  return bp_sphIntersect(ray, BpSphere(BP_PLANET_POSITION, BP_PLANET_RADIUS + bp_planetNoise(rotated)));
}

fn bp_planetNormal(p: vec3f) -> vec3f {
  let rd = BP_PLANET_POSITION - p;
  let dist = bp_planetDist(p, rd);
  let e = vec2f(0.01, 0.0);
  let normal = vec3f(dist) - vec3f(bp_planetDist(p - e.xyy, rd), bp_planetDist(p - e.yxy, rd), bp_planetDist(p + e.yyx, rd));
  return normalize(normal);
}

fn bp_moonPosition() -> vec3f {
  let axis = (BP_MOON_OFFSET - BP_PLANET_POSITION) * bp_rotateZ(BP_PI / 2.0);
  let moonRotation = bp_rotate3d(axis, bp_time * BP_MOON_ROTATION_SPEED);
  return BP_MOON_OFFSET * moonRotation + BP_PLANET_POSITION;
}

fn bp_spaceColor(direction: vec3f) -> vec3f {
  let backgroundRotation = bp_rotateY(-bp_time * BP_ROTATION_SPEED / 4.0);
  let backgroundCoord = direction * backgroundRotation;
  let spaceNoise = bp_fbm(backgroundCoord * 3.0, 4, 0.5, 2.0, 6.0);
  return bp_stars(backgroundCoord) + mix(BP_SPACE_BLUE, BP_ATMOSPHERE_COLOR / 4.0, spaceNoise);
}

fn bp_intersectPlanet(ray: BpRay) -> BpHit {
  let len = bp_sphIntersect(ray, BpSphere(BP_PLANET_POSITION, BP_PLANET_RADIUS));
  if (len < 0.0) { return bp_miss(); }

  let position = ray.origin + len * ray.direction;
  let rotatedCoord = (position - BP_PLANET_POSITION) * bp_planetRotation() + BP_PLANET_POSITION;
  let altitude = 5.0 * bp_planetNoise(rotatedCoord);

  let normal = bp_planetNormal(position);

  var color = mix(BP_WATER_COLOR_DEEP, BP_WATER_COLOR_SURFACE, smoothstep(BP_WATER_SURFACE_LEVEL, BP_WATER_SURFACE_LEVEL + BP_TRANSITION, altitude));
  color = mix(color, BP_SAND_COLOR, smoothstep(BP_SAND_LEVEL, BP_SAND_LEVEL + BP_TRANSITION / 2.0, altitude));
  color = mix(color, BP_TREE_COLOR, smoothstep(BP_TREE_LEVEL, BP_TREE_LEVEL + BP_TRANSITION, altitude));
  color = mix(color, BP_ROCK_COLOR, smoothstep(BP_ROCK_LEVEL, BP_ROCK_LEVEL + BP_TRANSITION, altitude));
  color = mix(color, BP_ICE_COLOR, smoothstep(BP_ICE_LEVEL, BP_ICE_LEVEL + BP_TRANSITION, altitude));

  let cloudsCoord = bp_rotateY(bp_time * -0.005) * rotatedCoord + vec3f(bp_time * 0.008);
  var cloudsDensity = bp_remap(bp_domainWarpingFBM(cloudsCoord), -1.0, 1.0, 0.0, 1.0);
  cloudsDensity *= smoothstep(0.75, 0.85, cloudsDensity);
  cloudsDensity *= smoothstep(BP_ROCK_LEVEL, (BP_ROCK_LEVEL + BP_TREE_LEVEL) / 2.0, altitude);
  color = mix(color, BP_CLOUD_COLOR, cloudsDensity);

  // GLSL had smoothstep(SAND_LEVEL + TRANSITION, SAND_LEVEL, altitude): reversed edges
  let specular = 1.0 - smoothstep(BP_SAND_LEVEL, BP_SAND_LEVEL + BP_TRANSITION, altitude);

  return BpHit(len, normal, BpMaterial(color, 1.0, specular));
}

fn bp_intersectMoon(ray: BpRay) -> BpHit {
  let moonPosition = bp_moonPosition();
  let len = bp_sphIntersect(ray, BpSphere(moonPosition, BP_MOON_RADIUS));
  if (len < 0.0) { return bp_miss(); }

  let position = ray.origin + len * ray.direction;
  let axis = (BP_MOON_OFFSET - BP_PLANET_POSITION) * bp_rotateZ(BP_PI / 2.0);
  let originalPosition = position * bp_rotate3d(axis, -bp_time * BP_MOON_ROTATION_SPEED);
  let color = vec3f(sqrt(bp_fbm(originalPosition * 12.0, 6, 0.5, 2.0, 5.0)));
  let normal = normalize(position - moonPosition);

  return BpHit(len, normal, BpMaterial(color, 1.0, 0.0));
}

fn bp_intersectScene(ray: BpRay) -> BpHit {
  let planetHit = bp_intersectPlanet(ray);
  let moonHit = bp_intersectMoon(ray);
  if (moonHit.len < planetHit.len) { return moonHit; }
  return planetHit;
}

// returns rgb + spaceMask in w
fn bp_radiance(rayIn: BpRay) -> vec4f {
  var ray = rayIn;
  var color = vec3f(0.0);
  var spaceMask = 1.0;

  let hit = bp_intersectScene(ray);
  if (hit.len < BP_INFINITY) {
    spaceMask = 0.0;

    let hitPosition = ray.origin + hit.len * ray.direction;
    let shadowHit = bp_intersectScene(BpRay(hitPosition + BP_EPSILON * BP_SUN_DIR, BP_SUN_DIR));
    let hitDirectLight = clamp(
      step(BP_INFINITY, shadowHit.len) + step(length(hitPosition - BP_PLANET_POSITION) - BP_PLANET_RADIUS, 0.1),
      0.0, 1.0
    );

    // diffuse (the power softens the shadow)
    let directLightIntensity = pow(clamp(dot(hit.normal, BP_SUN_DIR), 0.0, 1.0), 2.0);
    let diffuseLight = hitDirectLight * directLightIntensity * BP_SUN_COLOR;
    let diffuseColor = hit.material.color * (BP_AMBIENT_LIGHT + diffuseLight);

    // phong specular
    let reflected = normalize(reflect(-BP_SUN_DIR, hit.normal));
    let phongValue = pow(max(0.0, dot(ray.direction, reflected)), 10.0) * 0.6;
    let specularColor = hit.material.specular * vec3f(phongValue);

    color += diffuseColor + specularColor;
  } else {
    color += bp_spaceColor(ray.direction);
  }
  return vec4f(color, spaceMask);
}

fn bp_atmosphereColor(ro: vec3f, rd: vec3f, spaceMask: f32) -> vec3f {
  let planetD = bp_sphIntersect(BpRay(ro, rd), BpSphere(BP_PLANET_POSITION, BP_PLANET_RADIUS));
  let moonD = bp_sphIntersect(BpRay(ro, rd), BpSphere(bp_moonPosition(), BP_MOON_RADIUS));
  var closestHit = planetD;
  if (planetD < 0.0 || (moonD >= 0.0 && moonD < planetD)) { closestHit = moonD; }
  let position = ro + closestHit * rd;

  let distCameraToPlanetOrigin = length(BP_PLANET_POSITION - ro);
  let distCameraToPlanetEdge = sqrt(max(distCameraToPlanetOrigin * distCameraToPlanetOrigin - BP_PLANET_RADIUS * BP_PLANET_RADIUS, 0.0));
  let distCameraToMoon = length(bp_moonPosition() - ro);
  let isMoonInFront = smoothstep(-BP_PLANET_RADIUS / 2.0, BP_PLANET_RADIUS / 2.0, distCameraToPlanetEdge - distCameraToMoon);

  let moonMask = (1.0 - spaceMask) * step(BP_PLANET_RADIUS + BP_EPSILON, length(position - BP_PLANET_POSITION));
  let planetMask = 1.0 - spaceMask - moonMask;

  let coordFromCenter = (ro + rd * distCameraToPlanetEdge) - BP_PLANET_POSITION;
  let distFromEdge = abs(length(coordFromCenter) - BP_PLANET_RADIUS);
  let planetEdge = max(1.0 - distFromEdge, 0.0);
  // the original could hand pow() a negative number here; clamp it
  let atmosphereDensity = pow(max(bp_remap(dot(BP_SUN_DIR, coordFromCenter), -2.0, 1.0, 0.0, 1.0), 0.0), 5.0);

  var atmosphere = pow(planetEdge, 80.0) * BP_ATMOSPHERE_COLOR;
  atmosphere += pow(planetEdge, 30.0) * BP_ATMOSPHERE_COLOR * (1.5 - planetMask);
  atmosphere += pow(planetEdge, 4.0) * BP_ATMOSPHERE_COLOR * 0.02;
  atmosphere += pow(planetEdge, 2.0) * BP_ATMOSPHERE_COLOR * 0.1 * planetMask;

  return atmosphere * atmosphereDensity * (1.0 - moonMask * isMoonInFront);
}
