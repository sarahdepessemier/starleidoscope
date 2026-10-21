import * as THREE from 'three/webgpu';
import { wgslFn, uniform, vec4, colorSpaceToWorking } from 'three/tsl';
import { uniforms, screenUv, createStarMaterial } from './shader.js';

import bluePlanetSrc from './shaders/bluePlanet.wgsl?raw';
import redPlanetSrc from './shaders/redPlanet.wgsl?raw';
import vortexSrc from './shaders/vortex.wgsl?raw';
import starNestSrc from './shaders/starNest.wgsl?raw';
import pegasusSrc from './shaders/pegasus.wgsl?raw';
import supernovaSrc from './shaders/supernova.wgsl?raw';

// All planet / tunnel shaders share one signature:
// (fragCoord, iTime, look, spin, pulse, seed, hue, zoom, iResolution) -> vec4f
const generic = (src, virtualHeight = 800, limit = null) => {
  const fn = wgslFn(src);
  return ({ flipV = false, aspect = 1, interactive = true } = {}) => {
    const resolution = uniform(new THREE.Vector2(aspect * virtualHeight, virtualHeight));
    const look = interactive ? uniforms.iMouse : uniform(new THREE.Vector2(0.5, 0.5));
    const material = new THREE.MeshBasicNodeMaterial();
    // window: driven by the controls. picture frame: calm preview (own time + seed, no colour/zoom/roll)
    const c = interactive
      ? { time: uniforms.phase, spin: uniforms.spin, pulse: uniforms.pulse, seed: uniforms.layoutSeed, hue: uniforms.hue, zoom: uniforms.zoom }
      : { time: uniforms.previewTime, spin: uniform(0), pulse: uniform(0), seed: uniforms.previewSeed, hue: uniform(0), zoom: uniform(1) };
    const raw = fn({
      fragCoord: screenUv(flipV).mul(resolution),
      iTime: c.time,
      look,
      spin: c.spin,
      pulse: c.pulse,
      seed: c.seed,
      hue: c.hue,
      zoom: c.zoom,
      iResolution: resolution,
    });
    // limit: keeps sparkly shaders below the bloom threshold (no flickering glow)
    const out = limit ? vec4(raw.rgb.min(limit), 1.0) : raw;
    material.colorNode = colorSpaceToWorking(out, THREE.SRGBColorSpace);
    return material;
  };
};

// sparkly shaders are capped at this display brightness so the bloom (threshold ~0.8) ignores them
const BLOOM_SAFE = 0.82;

// Phones and tablets (touch screens) showed glitches with Star Nest, the heaviest of the sparkly shaders.
// It is left out there. Set this to false to bring it back on touch devices.
const SKIP_HEAVY_ON_TOUCH = true;
export const isTouch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

const ALL = [
  { name: 'Kaleidoscope Rift', tint: 0xff7ad9, make: (o) => createStarMaterial({ ...o, limit: BLOOM_SAFE }), hue: 0 },
  { name: 'Aqua', tint: 0x4aa8ff, make: generic(bluePlanetSrc), hue: 0 },
  { name: 'Rubra', tint: 0xff6a3a, make: generic(redPlanetSrc), hue: 0 },
  { name: 'The Vortex', tint: 0xaad4ff, make: generic(vortexSrc, 700, BLOOM_SAFE), hue: 0 },
  { name: 'Star Nest', tint: 0x9a7aff, make: generic(starNestSrc, 700, BLOOM_SAFE), hue: 0, mobileSkip: true },
  { name: 'Pegasus Galaxy', tint: 0xffb070, make: generic(pegasusSrc, 700), hue: 0 },
  { name: 'Supernova Remnant', tint: 0x7ad0ff, make: generic(supernovaSrc, 700), hue: 0 },
];

export const DESTINATIONS = ALL.filter((d) => !(SKIP_HEAVY_ON_TOUCH && isTouch && d.mobileSkip));
