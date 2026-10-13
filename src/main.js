import * as THREE from 'three/webgpu';
import './style.css';
import { initInput, updateInput, onKey, getMouse, newSky, boostWarp, flashPulse } from './input.js';
import { DESTINATIONS } from './destinations.js';
import { createCockpit, WINDOW_R } from './cockpit.js';

const params = new URLSearchParams(location.search);
let current = Math.min(DESTINATIONS.length - 1, Math.max(0, Number(params.get('d') || 0)));
const nextOf = (i) => (i + 1) % DESTINATIONS.length;

// ---- renderer ---------------------------------------------------------------
const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
await renderer.init();

const cockpit = createCockpit();
const { scene, camera } = cockpit;

// ---- destination materials: one for the window (reacts to the mouse), one for the frame (doesn't)
const windowMats = DESTINATIONS.map((d) => d.make({ aspect: 1, interactive: true }));
const frameMats = DESTINATIONS.map((d) => d.make({ aspect: cockpit.frame.aspect, interactive: false }));

// compile all shaders now (behind the loading state) so the teleport never stutters
{
  const tmp = new THREE.Scene();
  const g = new THREE.PlaneGeometry(0.01, 0.01);
  [...windowMats, ...frameMats].forEach((m) => tmp.add(new THREE.Mesh(g, m)));
  try { await renderer.compileAsync(tmp, camera); } catch (e) { console.warn('precompile failed', e); }
}

// ---- HUD --------------------------------------------------------------------
const hud = document.createElement('div');
hud.className = 'hud';
document.body.appendChild(hud);
const hint = document.createElement('div');
hint.className = 'hint';
hint.innerHTML = 'MOVE MOUSE = LOOK AROUND<br>CLICK THE RED BUTTON = TELEPORT';
document.body.appendChild(hint);
const flash = document.createElement('div');
flash.id = 'flash';
document.body.appendChild(flash);

let sector = Math.floor(Math.random() * 9000) + 1000;
const showHud = () => {
  hud.innerHTML = `<div class="dim">SECTOR ${sector}</div><div class="big">${DESTINATIONS[current].name.toUpperCase()}</div>`;
};

const apply = () => {
  const d = DESTINATIONS[current];
  cockpit.windowDisc.material = windowMats[current];
  const n = nextOf(current);
  cockpit.frame.picture.material = frameMats[n];
  cockpit.setCaption('NEXT: ' + DESTINATIONS[n].name.toUpperCase());
  cockpit.setTint(d.tint ?? 0xffffff);
  showHud();
};
apply();

// ---- teleport ---------------------------------------------------------------
let busy = false;
const teleport = () => {
  if (busy) return;
  busy = true;
  cockpit.pressTeleport();
  boostWarp(1.3);
  flashPulse(1);
  flash.classList.remove('out');
  flash.classList.add('on');
  setTimeout(() => {
    current = nextOf(current);
    sector = Math.floor(Math.random() * 9000) + 1000;
    newSky();
    apply();
    flash.classList.add('out');
    flash.classList.remove('on');
  }, 380);
  setTimeout(() => { busy = false; }, 1500);
};

initInput();
onKey((code) => { if (code === 'KeyT') teleport(); });

// click / hover on the 3D button
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const hitsButton = (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const t = cockpit.teleportGroup;
  return ray.intersectObject(t, true).length > 0;
};
renderer.domElement.addEventListener('pointermove', (e) => {
  const hit = hitsButton(e);
  cockpit.setHover(hit);
  renderer.domElement.style.cursor = hit ? 'pointer' : 'default';
});
renderer.domElement.addEventListener('pointerdown', (e) => { if (hitsButton(e)) teleport(); });

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- loop -------------------------------------------------------------------
const timer = new THREE.Timer();
renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  const t = timer.getElapsed();
  updateInput(dt, t);
  cockpit.update(t, dt, getMouse());
  renderer.render(scene, camera);
});
window.__ready = true;
