// Tunnel by Ethan Alexander Shulman, 2017
// https://www.shadertoy.com/view/XdBBDz (Shadertoy user: public_int_i)
// Ported to WGSL from the MSAA version (16 samples instead of 64). Changes: the mouse moves the
// tunnel (look), and shared controls were added (spin = roll, pulse = flash, seed = colour phase,
// hue = colour shift, zoom).
// wgslFn reads the FIRST function of this file: main first, helpers below.
fn vortex(fragCoord: vec2f, iTime: f32, look: vec2f, spin: f32, pulse: f32, seed: f32, hue: f32, zoom: f32, iResolution: vec2f) -> vec4f {
  let R = iResolution;
  var o = vec4f(0.0);
  for (var s = 0; s < 16; s++) {
    let sub = vec2f(f32(s % 4), f32(s / 4)) * 0.5;
    var u = (fragCoord * 2.0 - R + sub - 2.0) / R.x;
    u = u / zoom;
    u = vt_rot(u, spin);
    u = u - (look - 0.5) * vec2f(1.0, -1.0);
    u = floor((6.0 - vec2f(atan2(u.y, u.x) / 3.0, length(u))) * R) + 0.5;
    o += max(1.0 - fract(vec4f(7.0, 6.0, 4.0, 0.0) * 0.02 + (u.y * 0.02 + u.x * 0.4) * fract(u.x * 0.61) + iTime + seed * 0.137) * 5.0, vec4f(0.0)) / 16.0;
  }
  let color = vt_hueRotate(o.rgb, hue) * (1.0 + pulse * 0.8);
  return vec4f(color, 1.0);
}

fn vt_rot(p: vec2f, a: f32) -> vec2f {
  let c = cos(a);
  let s = sin(a);
  return vec2f(c * p.x - s * p.y, s * p.x + c * p.y);
}

fn vt_hueRotate(c: vec3f, a: f32) -> vec3f {
  let k = vec3f(0.57735);
  let ca = cos(a);
  let sa = sin(a);
  return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca);
}
