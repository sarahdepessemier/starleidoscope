import { uniforms } from './shader.js';

// event.code = physical key, so it works on AZERTY and QWERTY
const KEYS = [
  { code: 'KeyS', label: 'S', name: 'SCAN',     css: '#ffd84a' },
  { code: 'KeyD', label: 'D', name: 'ZOOM',     css: '#6cf0a8' },
  { code: 'KeyF', label: 'F', name: 'NEW SKY',  css: '#ff7ad9' },
  { code: 'KeyJ', label: 'J', name: 'ROLL',     css: '#e8e8f0' },
  { code: 'KeyK', label: 'K', name: 'WARP',     css: '#8ab4ff' },
  { code: 'KeyT', label: 'T', name: 'TELEPORT', css: '#ff6a5a' },
];

const rnd = (a, b) => a + Math.random() * (b - a);

// every visit starts with a different sky
const state = {
  pulse: 0, phase: rnd(0, 100), speed: 1,
  spin: rnd(0, 6.28), spinVel: 0,
  colourSeed: 0, colourChance: 0,
  sizeSeed: 0, sizeChance: 0,
  layoutSeed: rnd(0, 100),
  hue: 0, hueTarget: 0, zoom: 1, zoomTarget: 1, zoomStep: 0,
  boost: 0, rollInput: 0, warpLevel: 0,
  nextSeed: rnd(0, 100), previewPhase: rnd(0, 100),
};
const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
const held = new Set();
const listeners = [];

// other modules (the 3D scene) can react to key presses and read the current warp speed
export const onKey = (fn) => listeners.push(fn);
export const getSpeed = () => state.speed;
export const getMouse = () => mouse;
// a brand-new sky / planet (used by the teleport)
export const newSky = () => {
  state.layoutSeed = rnd(0, 100);
  state.colourChance = 0;
  state.sizeChance = 0;
  state.hueTarget = state.hue = 0;
  state.spin += rnd(0, 6.28);
};
// teleport: the window adopts exactly the sky the picture frame was showing, and the frame rolls a new one
export const adoptPreview = () => {
  state.layoutSeed = state.nextSeed;
  state.nextSeed = rnd(0, 100);
  state.colourChance = 0;
  state.sizeChance = 0;
  state.hueTarget = state.hue = 0;
  state.zoomTarget = 1; state.zoomStep = 0;
  state.spin += rnd(0, 6.28);
};
// used by the 3D controls
export const pressKey = (code) => press(code);
export const releaseKey = (code) => release(code);
export const setZoom = (v) => { state.zoomTarget = Math.min(1.8, Math.max(0.7, v)); };
export const getZoomTarget = () => state.zoomTarget;
export const setWarpLevel = (v) => { state.warpLevel = Math.min(1, Math.max(0, v)); };
export const getWarpLevel = () => state.warpLevel;
export const setRollInput = (v) => { state.rollInput = v; };
export const flashPulse = (v = 1) => { state.pulse = Math.max(state.pulse, v); };
// fly fast for a moment (during the teleport)
export const boostWarp = (seconds) => { state.boost = seconds; };
// ---- input -----------------------------------------------------------
const press = (code) => {
  if (!KEYS.some((k) => k.code === code) || held.has(code)) return;
  held.add(code);
  listeners.forEach((fn) => fn(code));

  if (code === 'KeyS') {                 // scan: random star colours + a new colour tint on the planets
    state.colourSeed = rnd(0, 100);
    state.colourChance = rnd(0.15, 0.5);
    state.hueTarget += rnd(1.2, 3.6);
    state.pulse = 1;
  } else if (code === 'KeyD') {          // zoom in / out, and random star sizes
    state.sizeSeed = rnd(0, 100);
    state.sizeChance = rnd(0.15, 0.45);
    state.zoomStep = (state.zoomStep + 1) % 3;
    state.zoomTarget = [1, 1.7, 0.7][state.zoomStep];
    state.pulse = 0.8;
  } else if (code === 'KeyF') {          // brand-new sky: new positions, effects cleared
    newSky();
    state.pulse = 1;
  } else if (code === 'KeyJ') {          // gentle rotation kick
    state.spinVel += 0.8;
  }
  // 'KeyK' (warp) works while held, see updateInput
};

const release = (code) => {
  held.delete(code);
};

export const initInput = () => {
  window.addEventListener('keydown', (e) => { if (!e.repeat) press(e.code); });
  window.addEventListener('keyup', (e) => release(e.code));
  window.addEventListener('blur', () => [...held].forEach(release));
  window.addEventListener('pointermove', (e) => {
    mouse.tx = e.clientX / window.innerWidth;
    mouse.ty = 1 - e.clientY / window.innerHeight;
  });
};

// ---- per frame: smooth the values and write the uniforms ---------------
export const updateInput = (dt, time) => {
  state.pulse *= Math.exp(-dt * 2.0);

  state.boost = Math.max(0, state.boost - dt);
  const targetSpeed = state.boost > 0 ? 9 : held.has('KeyK') ? 7 : 1 + state.warpLevel * 6;   // slider: 1x .. 7x       // hold warp = fly faster
  state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 3);
  state.phase += dt * state.speed;

  state.spin += (state.spinVel + state.rollInput * 1.6) * dt;
  state.spinVel *= Math.exp(-dt * 1.0);

  state.hue += (state.hueTarget - state.hue) * Math.min(1, dt * 2.5);
  state.zoom += (state.zoomTarget - state.zoom) * Math.min(1, dt * 3);

  mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 6);
  mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 6);

  uniforms.iTime.value = time;
  uniforms.phase.value = state.phase;
  uniforms.spin.value = state.spin;
  uniforms.pulse.value = state.pulse;
  uniforms.colourSeed.value = state.colourSeed;
  uniforms.colourChance.value = state.colourChance;
  uniforms.sizeSeed.value = state.sizeSeed;
  uniforms.sizeChance.value = state.sizeChance;
  uniforms.layoutSeed.value = state.layoutSeed;
  state.previewPhase += dt;
  uniforms.previewTime.value = state.previewPhase;
  uniforms.previewSeed.value = state.nextSeed;
  uniforms.hue.value = state.hue;
  uniforms.zoom.value = state.zoom;
  uniforms.iMouse.value.set(mouse.x, mouse.y);
};
