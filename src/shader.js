import * as THREE from 'three/webgpu';
import { wgslFn, uniform, uv, vec2, colorSpaceToWorking } from 'three/tsl';

import fragmentSrc from './shaders/starfield/fragment.wgsl?raw';

// the main function is the first function in the file, the helpers sit below it
const starfield = wgslFn(fragmentSrc);

// uniforms are TSL nodes: change their .value every frame
export const uniforms = {
  iTime: uniform(0),                         // twinkle
  phase: uniform(0),                         // travel through the layers
  spin: uniform(0),                          // extra rotation (spin key)
  pulse: uniform(0),                         // flare strength (flash on key press)
  colourSeed: uniform(0),                    // which stars get a random colour, and which colour
  colourChance: uniform(0),                  // share of stars recoloured (0 = none)
  sizeSeed: uniform(0),                      // which stars get a random size, and which size
  sizeChance: uniform(0),                    // share of stars resized (0 = none)
  layoutSeed: uniform(0),                    // re-rolls the position of every star
  iMouse: uniform(new THREE.Vector2(0.5, 0.5)),
  iResolution: uniform(new THREE.Vector2(1.6, 1)), // same ratio as the screen plane
};

// flipV: meshes exported from Blender (glTF) have their uv origin at the TOP-left, three's
// PlaneGeometry at the bottom-left. If the shader shows upside down, toggle this.
export const createScreenMaterial = ({ flipV = false } = {}) => {
  const material = new THREE.MeshBasicNodeMaterial();
  const screenUv = flipV ? vec2(uv().x, uv().y.oneMinus()) : uv();
  // the shader outputs display-ready (sRGB) colours: tell three.js, so it converts them correctly
  // and baked/lit materials in the same scene keep working
  material.colorNode = colorSpaceToWorking(starfield({
    fragCoord: screenUv.mul(uniforms.iResolution),
    iTime: uniforms.iTime,
    phase: uniforms.phase,
    spin: uniforms.spin,
    pulse: uniforms.pulse,
    colourSeed: uniforms.colourSeed,
    colourChance: uniforms.colourChance,
    sizeSeed: uniforms.sizeSeed,
    sizeChance: uniforms.sizeChance,
    layoutSeed: uniforms.layoutSeed,
    iMouse: uniforms.iMouse,
    iResolution: uniforms.iResolution,
  }), THREE.SRGBColorSpace);
  return material;
};
