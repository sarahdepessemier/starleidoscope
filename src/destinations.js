import * as THREE from 'three/webgpu';
import { wgslFn, uniform, colorSpaceToWorking } from 'three/tsl';
import { uniforms, screenUv, createStarMaterial } from './shader.js';

import bluePlanetSrc from './shaders/bluePlanet.wgsl?raw';
import redPlanetSrc from './shaders/redPlanet.wgsl?raw';
import neonGateSrc from './shaders/neonGate.wgsl?raw';
import vortexSrc from './shaders/vortex.wgsl?raw';
import starNestSrc from './shaders/starNest.wgsl?raw';

// All planet / tunnel shaders share one signature:
// (fragCoord, iTime, look, spin, pulse, seed, hue, zoom, iResolution) -> vec4f
const generic = (src, virtualHeight = 800) => {
  const fn = wgslFn(src);
  return ({ flipV = false, aspect = 1, interactive = true } = {}) => {
    const resolution = uniform(new THREE.Vector2(aspect * virtualHeight, virtualHeight));
    const look = interactive ? uniforms.iMouse : uniform(new THREE.Vector2(0.5, 0.5));
    const material = new THREE.MeshBasicNodeMaterial();
    material.colorNode = colorSpaceToWorking(fn({
      fragCoord: screenUv(flipV).mul(resolution),
      iTime: uniforms.phase,
      look,
      spin: uniforms.spin,
      pulse: uniforms.pulse,
      seed: uniforms.layoutSeed,
      hue: uniforms.hue,
      zoom: uniforms.zoom,
      iResolution: resolution,
    }), THREE.SRGBColorSpace);
    return material;
  };
};

export const DESTINATIONS = [
  { name: 'Kaleidoscope Rift', tint: 0xff7ad9, make: createStarMaterial, hue: 0 },
  { name: 'Aqua', tint: 0x4aa8ff, make: generic(bluePlanetSrc), hue: 0 },
  { name: 'Rubra', tint: 0xff6a3a, make: generic(redPlanetSrc), hue: 0 },
  { name: 'Neon Gate', tint: 0xff40c0, make: generic(neonGateSrc, 700), hue: 0 },
  { name: 'The Vortex', tint: 0xaad4ff, make: generic(vortexSrc, 700), hue: 0 },
  { name: 'Star Nest', tint: 0x9a7aff, make: generic(starNestSrc, 700), hue: 0 },
];
