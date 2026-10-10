import * as THREE from 'three/webgpu';
import { wgslFn, uniform, uv } from 'three/tsl';

import rotSrc from './shaders/starfield/rot.wgsl?raw';
import hash21Src from './shaders/starfield/hash21.wgsl?raw';
import starSrc from './shaders/starfield/star.wgsl?raw';
import starLayerSrc from './shaders/starfield/starLayer.wgsl?raw';
import fragmentSrc from './shaders/starfield/fragment.wgsl?raw';

// helper functions first; the second argument lists the functions a function calls
const rot = wgslFn(rotSrc);
const hash21 = wgslFn(hash21Src);
const star = wgslFn(starSrc, [rot]);
const starLayer = wgslFn(starLayerSrc, [star, hash21]);
const starfield = wgslFn(fragmentSrc, [starLayer, rot]);

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

export const createScreenMaterial = () => {
  const material = new THREE.MeshBasicNodeMaterial();
  material.colorNode = starfield({
    fragCoord: uv().mul(uniforms.iResolution),
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
  });
  return material;
};
