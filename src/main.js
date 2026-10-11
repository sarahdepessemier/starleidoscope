import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';
import { createScreenMaterial } from './shader.js';
import { initInput, updateInput, onKey, getSpeed } from './input.js';

// ---- settings ----------------------------------------------------------
const MODEL_URL = 'assets/starleidoscope.glb';  // relative path: works on GitHub Pages
const BAKED_URL = null;                          // e.g. 'assets/baked.jpg' once the bake is done
const SCREEN_NAME = /^screen/i;                  // name of the screen object in Blender

// ---- renderer, scene, camera --------------------------------------------
const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05050a);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;
controls.maxPolarAngle = Math.PI * 0.55;        // don't look from under the floor

// place the camera so the whole object is in view, whatever scale the Blender model has
const frameObject = (object) => {
  const box = new THREE.Box3().setFromObject(object);
  const centre = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2;
  const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.9;
  camera.position.copy(centre).add(new THREE.Vector3(0.35, 0.25, 1).normalize().multiplyScalar(distance));
  camera.near = distance / 100;
  camera.far = distance * 20;
  camera.updateProjectionMatrix();
  controls.target.copy(centre);
  controls.minDistance = distance * 0.4;
  controls.maxDistance = distance * 1.8;
  controls.update();
};

// ---- placeholder: shown until (or if) the model fails to load -----------
let placeholder = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), createScreenMaterial());
scene.add(placeholder);
frameObject(placeholder);

// ---- model ---------------------------------------------------------------
let mixer = null;
const actions = {};

const loadModel = () => {
  const bakedMaterial = BAKED_URL ? (() => {
    const texture = new THREE.TextureLoader().load(BAKED_URL);
    texture.flipY = false;                       // glTF models expect textures with flipY disabled
    texture.colorSpace = THREE.SRGBColorSpace;   // the baked image contains display (sRGB) colours
    return new THREE.MeshBasicMaterial({ map: texture });
  })() : null;

  if (!bakedMaterial) {                          // no bake yet: light the model normally
    scene.add(new THREE.HemisphereLight(0xffffff, 0x222244, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(2, 4, 3);
    scene.add(sun);
  }

  new GLTFLoader().load(MODEL_URL, (gltf) => {
    // handy when your own Blender export doesn't behave: are the names what we expect?
    const names = [];
    gltf.scene.traverse((c) => { if (c.isMesh) names.push(c.name); });
    console.info('[model] meshes:', names.join(', '), '| clips:', gltf.animations.map((c) => c.name).join(', ') || '(none)');

    const screenMaterial = createScreenMaterial({ flipV: true });
    gltf.scene.traverse((child) => {
      if (!child.isMesh) return;
      if (SCREEN_NAME.test(child.name)) child.material = screenMaterial;
      else if (bakedMaterial) child.material = bakedMaterial;
    });

    scene.remove(placeholder);
    scene.add(gltf.scene);
    frameObject(gltf.scene);

    // animations made in Blender: 'Float' loops, 'Kick' plays once on a key press
    mixer = new THREE.AnimationMixer(gltf.scene);
    for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
    actions.Float?.play();
  }, undefined, (error) => {
    console.warn(`Could not load ${MODEL_URL}, showing the placeholder screen instead.`, error);
  });
};
loadModel();

onKey((code) => {
  if (!['KeyS', 'KeyD', 'KeyF'].includes(code)) return;
  actions.Kick?.reset().setLoop(THREE.LoopOnce, 1).play();
});

// ---- loop ----------------------------------------------------------------
initInput();
await renderer.init();

const start = performance.now();
let last = start;
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  updateInput(dt, (now - start) / 1000);
  if (mixer) {
    if (actions.Float) actions.Float.timeScale = getSpeed();   // hold K (warp): the ring spins faster
    mixer.update(dt);
  }
  controls.update();
  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
