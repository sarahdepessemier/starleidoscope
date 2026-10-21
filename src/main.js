import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import './style.css';
import { uniforms } from './shader.js';
import { initInput, updateInput, onKey, getMouse, adoptPreview, boostWarp, flashPulse } from './input.js';
import { DESTINATIONS } from './destinations.js';
import { createCockpit, makeLabel } from './cockpit.js';
import { createControls } from './controls.js';
import { createPhysics } from './physics.js';

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

// ---- post-processing: bloom (TSL RenderPipeline). Bright things (LEDs, the glowing window, the red
// button) get a soft glow. Add ?bloom=0 to the url to turn it off.
let renderPipeline = null;
let bloomPass = null;
if (params.get('bloom') !== '0') {
  try {
    const scenePass = pass(scene, camera);
    const sceneColor = scenePass.getTextureNode('output');
    bloomPass = bloom(sceneColor, 0.4, 0.5, 0.8);        // strength, radius, threshold
    renderPipeline = new THREE.RenderPipeline(renderer);
    renderPipeline.outputNode = sceneColor.add(bloomPass);
  } catch (e) { console.warn('bloom not available, rendering without it', e); renderPipeline = null; }
}
// debug: ?solo=1&d=N renders one destination full-screen (for checking a shader)
if (params.has('solo')) {
  const { uniforms } = await import('./shader.js');
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const sc = new THREE.Scene();
  sc.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), DESTINATIONS[current].make({ aspect: innerWidth / innerHeight })));
  uniforms.layoutSeed.value = Number(params.get('s') || 3);
  uniforms.phase.value = Number(params.get('t') || 5);
  uniforms.iMouse.value.set(Number(params.get('mx') || 0.5), Number(params.get('my') || 0.5));
  renderer.setAnimationLoop(() => renderer.render(sc, ortho));
  window.__ready = true;
  await new Promise(() => {});
}
const physics = await createPhysics(cockpit, scene, camera);
const controls = createControls({ consoleGroup: cockpit.consoleGroup, camera, makeLabel });

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
// help panel: open at the start, then folds away into a small "? HELP" button
const help = document.createElement('div');
help.className = 'help open';
help.innerHTML = `
  <button class="helpbtn" aria-label="Show or hide the instructions">? HELP</button>
  <div class="helpbody">
    <b>HOW TO FLY</b>
    <div><span>MOUSE</span> look around: the window follows your pointer</div>
    <div><span>RED BUTTON <i>T</i></span> teleport to the next destination (the frame shows it)</div>
    <div class="sub">Control panel, all of it only changes the window:</div>
    <div><span>KNOB <i>S</i></span> COLOURS: click to change the colours</div>
    <div><span>SLIDER <i>D</i></span> ZOOM: drag to zoom in and out</div>
    <div><span>TOGGLE <i>F</i></span> RANDOMISE: flip for a brand-new sky or planet</div>
    <div><span>JOYSTICK <i>J</i></span> ROLL: drag sideways to roll the view</div>
    <div><span>SLIDER <i>K</i></span> WARP SPEED: slide it towards you to fly faster (or hold K)</div>
    <div class="sub">Loose objects float in zero gravity:</div>
    <div><span>DRAG</span> grab and throw the mug, pen, dice or clipboard</div>
  </div>`;
document.body.appendChild(help);
const helpBtn = help.querySelector('.helpbtn');
helpBtn.addEventListener('click', () => { help.classList.toggle('open'); clearTimeout(helpTimer); });
const helpTimer = setTimeout(() => help.classList.remove('open'), 22000);
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
  physics.jolt(1);
  flash.classList.remove('out');
  flash.classList.add('on');
  setTimeout(() => {
    current = nextOf(current);
    sector = Math.floor(Math.random() * 9000) + 1000;
    adoptPreview();
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
renderer.domElement.style.touchAction = 'none';
renderer.domElement.addEventListener('pointermove', (e) => {
  controls.pointerMove(e);
  physics.dragMove(e);
  const hit = hitsButton(e);
  cockpit.setHover(hit);
  const onControl = controls.hover(e);
  renderer.domElement.style.cursor = (physics.isDragging() || controls.isActive()) ? 'grabbing'
    : (hit || onControl) ? 'pointer' : physics.hover(e) ? 'grab' : 'default';
});
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (hitsButton(e)) teleport();
  else if (controls.pointerDown(e)) renderer.domElement.setPointerCapture(e.pointerId);
  else if (physics.dragStart(e)) renderer.domElement.setPointerCapture(e.pointerId);
});
const release = () => { physics.dragEnd(); controls.pointerUp(); };
addEventListener('pointerup', release);
addEventListener('pointercancel', release);

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
  controls.update(dt, t);
  physics.step(dt);
  cockpit.update(t, dt, getMouse());
  if (renderPipeline) {
    bloomPass.strength.value = 0.4 + uniforms.pulse.value * 0.6;   // the glow flares with scans and teleports
    renderPipeline.render();
  } else {
    renderer.render(scene, camera);
  }
});
window.__ready = true;
