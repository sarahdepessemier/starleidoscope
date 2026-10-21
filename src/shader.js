import * as THREE from 'three/webgpu';
import { wgslFn, uniform, uv, vec2, vec4, colorSpaceToWorking } from 'three/tsl';

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
  // the picture frame has its own time and seed, so the controls never touch it
  previewSeed: uniform(0),
  previewTime: uniform(0),
};

// meshes exported from Blender have a top-left uv origin; three's planes bottom-left
export const screenUv = (flipV = false) => (flipV ? vec2(uv().x, uv().y.oneMinus()) : uv());

export const createStarMaterial = ({ flipV = false, aspect = 1.6, interactive = true, limit = null } = {}) => {
  const material = new THREE.MeshBasicNodeMaterial();
  const resolution = uniform(new THREE.Vector2(aspect, 1));
  const mouse = interactive ? uniforms.iMouse : uniform(new THREE.Vector2(0.5, 0.5));
  // window (interactive): driven by the controls. frame: calm preview with its own seed and time
  const z = () => uniform(0);
  const p = interactive
    ? { phase: uniforms.phase, spin: uniforms.spin, pulse: uniforms.pulse, cs: uniforms.colourSeed, cc: uniforms.colourChance, ss: uniforms.sizeSeed, sc: uniforms.sizeChance, seed: uniforms.layoutSeed }
    : { phase: uniforms.previewTime, spin: z(), pulse: z(), cs: z(), cc: z(), ss: z(), sc: z(), seed: uniforms.previewSeed };
  // the shader outputs display-ready (sRGB) colours: tell three.js so it converts them correctly
  const raw = starfield({
    fragCoord: screenUv(flipV).mul(resolution),
    iTime: uniforms.iTime,
    phase: p.phase,
    spin: p.spin,
    pulse: p.pulse,
    colourSeed: p.cs,
    colourChance: p.cc,
    sizeSeed: p.ss,
    sizeChance: p.sc,
    layoutSeed: p.seed,
    iMouse: mouse,
    iResolution: resolution,
  });
  // limit: keeps sparkly shaders below the bloom threshold, so tiny bright stars don't flicker
  const out = limit ? vec4(raw.rgb.min(limit), 1.0) : raw;
  material.colorNode = colorSpaceToWorking(out, THREE.SRGBColorSpace);
  return material;
};

// kept for the old name
export const createScreenMaterial = createStarMaterial;
