import * as THREE from 'three/webgpu';
import { wgslFn, uniform, uv, vec2, colorSpaceToWorking } from 'three/tsl';

import fragmentSrc from './shaders/starfield/fragment.wgsl?raw';

// the main function is the first function in the file, the helpers sit below it
const starfield = wgslFn(fragmentSrc);

// uniforms are TSL nodes: change their .value every frame
export const uniforms = {
  iTime: uniform(0),                         // twinkle
  phase: uniform(0),                         // travel through the layers (warp-driven time)
  spin: uniform(0),                          // extra rotation (roll)
  pulse: uniform(0),                         // flare strength (flash on key press)
  colourSeed: uniform(0),
  colourChance: uniform(0),
  sizeSeed: uniform(0),
  sizeChance: uniform(0),
  layoutSeed: uniform(0),                    // re-rolls the sky
  hue: uniform(0),                           // hue rotation (radians) for the planet shaders
  zoom: uniform(1),                          // field of view zoom
  iMouse: uniform(new THREE.Vector2(0.5, 0.5)),
  iResolution: uniform(new THREE.Vector2(1.6, 1)),
};

// meshes exported from Blender have a top-left uv origin; three's planes bottom-left
export const screenUv = (flipV = false) => (flipV ? vec2(uv().x, uv().y.oneMinus()) : uv());

export const createStarMaterial = ({ flipV = false, aspect = 1.6, interactive = true } = {}) => {
  const material = new THREE.MeshBasicNodeMaterial();
  const resolution = uniform(new THREE.Vector2(aspect, 1));
  const mouse = interactive ? uniforms.iMouse : uniform(new THREE.Vector2(0.5, 0.5));
  // the shader outputs display-ready (sRGB) colours: tell three.js so it converts them correctly
  material.colorNode = colorSpaceToWorking(starfield({
    fragCoord: screenUv(flipV).mul(resolution),
    iTime: uniforms.iTime,
    phase: uniforms.phase,
    spin: uniforms.spin,
    pulse: uniforms.pulse,
    colourSeed: uniforms.colourSeed,
    colourChance: uniforms.colourChance,
    sizeSeed: uniforms.sizeSeed,
    sizeChance: uniforms.sizeChance,
    layoutSeed: uniforms.layoutSeed,
    iMouse: mouse,
    iResolution: resolution,
  }), THREE.SRGBColorSpace);
  return material;
};

// kept for the old name
export const createScreenMaterial = createStarMaterial;
