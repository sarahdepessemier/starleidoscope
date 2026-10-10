import * as THREE from 'three/webgpu';
import './style.css';
import { createScreenMaterial } from './shader.js';
import { initInput, updateInput } from './input.js';

const renderer = new THREE.WebGPURenderer({ antialias: true });
// shadertoy shaders output display-ready colours: skip the linear → sRGB conversion
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05050a);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 2.4;

// temporary screen: replaced by the Blender model later
const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), createScreenMaterial());
scene.add(screen);

initInput();
await renderer.init();

const start = performance.now();
let last = start;
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  updateInput(dt, (now - start) / 1000);
  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
