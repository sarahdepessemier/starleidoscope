import { uniforms } from './shader.js';

// event.code = physical key, so it works on AZERTY and QWERTY
const KEYS = [
  { code: 'KeyS', label: 'S', name: 'paars', type: 'colour', tint: [0.75, 0.3, 1.0], css: '#a65cff' },
  { code: 'KeyD', label: 'D', name: 'rood',  type: 'colour', tint: [1.0, 0.1, 0.15],  css: '#ff2a3a' },
  { code: 'KeyF', label: 'F', name: 'roze',  type: 'colour', tint: [1.0, 0.35, 0.75], css: '#ff5cc0' },
  { code: 'KeyG', label: 'G', name: 'blauw', type: 'colour', tint: [0.15, 0.5, 1.0],  css: '#2f8cff' },
  { code: 'KeyJ', label: 'J', name: 'draai', type: 'spin',   css: '#e8e8f0' },
  { code: 'KeyK', label: 'K', name: 'warp',  type: 'warp',   css: '#e8e8f0' },
];

const state = {
  pulse: 0, phase: 0, speed: 1,
  spin: 0, spinVel: 0,
  tint: [1, 1, 1], tintTarget: [1, 1, 1], tintAmount: 0, tintAmountTarget: 0,
};
const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
const held = new Set();
const keyEls = new Map();

// ---- legend (the on-screen keys) -------------------------------------
const buildLegend = () => {
  const legend = document.createElement('div');
  legend.className = 'legend';
  for (const k of KEYS) {
    const el = document.createElement('button');
    el.className = 'key';
    el.style.setProperty('--c', k.css);
    el.innerHTML = `<span class="letter">${k.label}</span><span class="name">${k.name}</span>`;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); press(k.code); });
    el.addEventListener('pointerup', () => release(k.code));
    el.addEventListener('pointerleave', () => release(k.code));
    legend.appendChild(el);
    keyEls.set(k.code, el);
  }
  document.body.appendChild(legend);
};

// ---- input -----------------------------------------------------------
const press = (code) => {
  const key = KEYS.find((k) => k.code === code);
  if (!key || held.has(code)) return;
  held.add(code);
  keyEls.get(code)?.classList.add('down');

  if (key.type === 'colour') {
    state.tintTarget = key.tint;
    state.tintAmountTarget = 0.85;
    state.pulse = 1;                 // big flare + new colour
  } else if (key.type === 'spin') {
    state.spinVel += 0.8;            // gentle rotation kick
  }
  // 'warp' works while held (see updateInput)
};

const release = (code) => {
  held.delete(code);
  keyEls.get(code)?.classList.remove('down');
};

export const initInput = () => {
  buildLegend();
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
  const colourHeld = KEYS.some((k) => k.type === 'colour' && held.has(k.code));
  state.pulse = Math.max(colourHeld ? 0.3 : 0, state.pulse * Math.exp(-dt * 2.0));

  const targetSpeed = held.has('KeyK') ? 5 : 1;       // hold warp = fly faster
  state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 3);
  state.phase += dt * state.speed;

  state.spin += state.spinVel * dt;
  state.spinVel *= Math.exp(-dt * 1.0);

  const f = Math.min(1, dt * 5);
  for (let i = 0; i < 3; i++) state.tint[i] += (state.tintTarget[i] - state.tint[i]) * f;
  state.tintAmount += (state.tintAmountTarget - state.tintAmount) * f;

  mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 6);
  mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 6);

  uniforms.iTime.value = time;
  uniforms.phase.value = state.phase;
  uniforms.spin.value = state.spin;
  uniforms.pulse.value = state.pulse;
  uniforms.tint.value.set(state.tint[0], state.tint[1], state.tint[2]);
  uniforms.tintAmount.value = state.tintAmount;
  uniforms.iMouse.value.set(mouse.x, mouse.y);
};
