import { uniforms } from './shader.js';

// event.code = physical key, so it works on AZERTY and QWERTY
const NOTES = [
  { code: 'KeyS', label: 'S', index: 0,  black: false },
  { code: 'KeyE', label: 'E', index: 1,  black: true, after: 0 },
  { code: 'KeyD', label: 'D', index: 2,  black: false },
  { code: 'KeyR', label: 'R', index: 3,  black: true, after: 1 },
  { code: 'KeyF', label: 'F', index: 4,  black: false },
  { code: 'KeyG', label: 'G', index: 5,  black: false },
  { code: 'KeyY', label: 'Y', index: 6,  black: true, after: 3 },
  { code: 'KeyH', label: 'H', index: 7,  black: false },
  { code: 'KeyU', label: 'U', index: 8,  black: true, after: 4 },
  { code: 'KeyJ', label: 'J', index: 9,  black: false },
  { code: 'KeyI', label: 'I', index: 10, black: true, after: 5 },
  { code: 'KeyK', label: 'K', index: 11, black: false },
  { code: 'KeyL', label: 'L', index: 12, black: false },
];

const state = { pulse: 0, hue: 0, hueTarget: 0, speed: 1, spin: 0, spinVel: 0, phase: 0 };
const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
const held = new Set();
const keyEls = new Map();

// ---- legend (the on-screen keys) -------------------------------------
const buildLegend = () => {
  const legend = document.createElement('div');
  legend.className = 'legend';
  const whites = NOTES.filter((n) => !n.black);
  for (const n of NOTES) {
    const el = document.createElement('button');
    el.className = n.black ? 'key black' : 'key white';
    el.textContent = n.label;
    if (n.black) el.style.left = `calc(var(--w) * ${n.after + 1} - var(--bw) / 2)`;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); press(n.code); });
    el.addEventListener('pointerup', () => release(n.code));
    el.addEventListener('pointerleave', () => release(n.code));
    legend.appendChild(el);
    keyEls.set(n.code, el);
  }
  legend.style.width = `calc(var(--w) * ${whites.length})`;
  document.body.appendChild(legend);
};

// ---- input -----------------------------------------------------------
const press = (code) => {
  const note = NOTES.find((n) => n.code === code);
  if (!note || held.has(code)) return;
  held.add(code);
  keyEls.get(code)?.classList.add('down');
  state.hueTarget = note.index / 12;
  if (note.black) {
    state.spinVel += 3;                       // black key: rotation kick
    state.pulse = Math.max(state.pulse, 0.6);
  } else {
    state.pulse = 1;                          // white key: big flare
  }
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
  const sustain = held.size > 0 ? 0.35 : 0;
  state.pulse = Math.max(sustain, state.pulse * Math.exp(-dt * 2.5));

  const targetSpeed = 1 + held.size * 8;      // holding keys = flying faster
  state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 4);
  state.phase += dt * state.speed;

  state.hue += (state.hueTarget - state.hue) * Math.min(1, dt * 3);
  state.spin += state.spinVel * dt;
  state.spinVel *= Math.exp(-dt * 1.5);

  mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 6);
  mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 6);

  uniforms.iTime.value = time;
  uniforms.phase.value = state.phase;
  uniforms.spin.value = state.spin;
  uniforms.pulse.value = state.pulse;
  uniforms.hue.value.set(state.hue, state.hue);
  uniforms.iMouse.value.set(mouse.x, mouse.y);
};
