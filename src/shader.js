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
  spin: uniform(0),                          // extra rotation (black keys)
  pulse: uniform(0),                         // flare strength (every key)
  hue: uniform(new THREE.Vector2(0, 0)),     // colour (which key)
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
    hue: uniforms.hue,
    iMouse: uniforms.iMouse,
    iResolution: uniforms.iResolution,
  });
  return material;
};
