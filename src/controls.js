import * as THREE from 'three/webgpu';
import { pressKey, releaseKey, setZoom, getZoomTarget, setRollInput, setWarpLevel, getWarpLevel, onKey } from './input.js';

// The control panel on the console. Every control is a different kind of physical part:
//   COLOURS     rotary knob   (click: turns one step, the colours change)               key S
//   ZOOM        slider        (drag the handle: zoom in / out)                          key D
//   RANDOMISE   toggle switch (flip it: a brand-new random sky or planet)               key F
//   ROLL        joystick      (drag: the view rolls, springs back when you let go)      key J
//   WARP SPEED  slider        (drag the handle along the slot: faster flight)           key K (hold)
// They only change what the window shows, never the picture frame.
const Y0 = 0.27;          // console surface (local y)
const Z0 = 0.8;           // row of controls (local z)
const ZMIN = 0.7, ZMAX = 1.8;

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2, ...o });
const hitMat = () => new THREE.MeshBasicMaterial({ visible: false });

export const createControls = ({ consoleGroup, camera, makeLabel }) => {
  const root = new THREE.Group();
  consoleGroup.add(root);

  // dark strip behind the controls
  const strip = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.02, 0.8), mat(0x2b2f38, { roughness: 0.7 }));
  strip.position.set(0, Y0 - 0.01, Z0 + 0.02); root.add(strip);

  const controls = [];
  const label = (text, x, color = '#ffe9b0') => {
    const l = makeLabel(text, { w: 0.82, h: 0.14, font: 'bold 46px "Courier New", monospace', color, bg: null });
    l.rotation.x = -Math.PI / 2; l.position.set(x, Y0 + 0.012, Z0 + 0.34); root.add(l);
  };

  // ---- 1. SCAN: rotary knob ---------------------------------------------------------------
  {
    const x = -2.22;
    const g = new THREE.Group(); g.position.set(x, Y0, Z0); root.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 32), mat(0x15161b)); base.position.y = 0.015; g.add(base);
    for (let i = 0; i < 9; i++) {                       // tick marks
      const a = -1.2 + (i / 8) * 2.4;
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.035), new THREE.MeshBasicMaterial({ color: 0xffd84a }));
      t.position.set(Math.sin(a) * 0.185, 0.034, -Math.cos(a) * 0.185); t.rotation.y = a; g.add(t);
    }
    const knob = new THREE.Group(); g.add(knob);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.14, 0.11, 32), mat(0xc9ccd4, { metalness: 0.8, roughness: 0.25 })); body.position.y = 0.085; knob.add(body);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 32), mat(0x8e93a0, { metalness: 0.8, roughness: 0.3 })); top.position.y = 0.146; knob.add(top);
    const ptr = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.016, 0.1), new THREE.MeshBasicMaterial({ color: 0xff3b30 })); ptr.position.set(0, 0.153, -0.045); knob.add(ptr);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 16), hitMat()); hit.position.y = 0.1; g.add(hit);
    const c = { name: 'scan', hit, angle: 0, target: 0, code: 'KeyS' };
    c.click = () => { pressKey('KeyS'); releaseKey('KeyS'); };
    c.step = () => { c.target += 0.9; };
    c.update = (dt) => { c.angle += (c.target - c.angle) * Math.min(1, dt * 9); knob.rotation.y = c.angle; };
    controls.push(c);
    label('COLOURS [S]', x);
  }

  // ---- 2. ZOOM: slider -----------------------------------------------------------------------
  {
    const x0 = -1.29, len = 0.9;
    const g = new THREE.Group(); g.position.set(x0, Y0, Z0); root.add(g);
    const track = new THREE.Mesh(new THREE.BoxGeometry(len + 0.1, 0.02, 0.045), mat(0x0d0e12)); track.position.set(len / 2, 0.01, 0); g.add(track);
    for (let i = 0; i <= 10; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.01, i % 5 === 0 ? 0.13 : 0.08), new THREE.MeshBasicMaterial({ color: 0x6cf0a8 }));
      t.position.set((i / 10) * len, 0.006, 0); g.add(t);
    }
    const handle = new THREE.Group(); g.add(handle);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.16), mat(0x2fbf7a, { roughness: 0.4 })); cap.position.y = 0.05; handle.add(cap);
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.17), new THREE.MeshBasicMaterial({ color: 0xffffff })); line.position.y = 0.088; handle.add(line);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(len + 0.3, 0.25, 0.3), hitMat()); hit.position.set(len / 2, 0.1, 0); g.add(hit);
    const c = { name: 'zoom', hit, p: 0.3, dragging: false, g, x0, len };
    c.zoomOf = (p) => 0.7 + p * 1.1;
    c.pOf = (z) => (z - 0.7) / 1.1;
    c.update = (dt) => {
      if (!c.dragging) c.p += (c.pOf(getZoomTarget()) - c.p) * Math.min(1, dt * 8);   // follows the D key too
      handle.position.x = c.p * len;
    };
    controls.push(c);
    label('ZOOM [D]', x0 + len / 2);
  }

  // ---- 3. NEW SKY: toggle switch -----------------------------------------------------------
  {
    const x = 0.43;
    const g = new THREE.Group(); g.position.set(x, Y0, Z0); root.add(g);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.3), mat(0xb8bcc6, { metalness: 0.7, roughness: 0.3 })); plate.position.y = 0.015; g.add(plate);
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 6), mat(0x8e93a0, { metalness: 0.8 })); nut.position.y = 0.05; g.add(nut);
    const lever = new THREE.Group(); lever.position.y = 0.07; g.add(lever);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.2, 12), mat(0xe9e9ee, { metalness: 0.8, roughness: 0.25 })); rod.position.y = 0.1; lever.add(rod);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 12), mat(0xff7ad9, { roughness: 0.3 })); ball.position.y = 0.21; lever.add(ball);
    const ledOn = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff7ad9 })); ledOn.position.set(0, 0.03, -0.12); g.add(ledOn);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.45), hitMat()); hit.position.y = 0.15; g.add(hit);
    const c = { name: 'sky', hit, tilt: 0.55, target: 0.55, flash: 0 };
    c.click = () => { c.target = -c.target; c.flash = 1; pressKey('KeyF'); releaseKey('KeyF'); };
    c.update = (dt) => {
      c.tilt += (c.target - c.tilt) * Math.min(1, dt * 14);
      lever.rotation.x = c.tilt;
      c.flash = Math.max(0, c.flash - dt * 2);
      ledOn.scale.setScalar(1 + c.flash * 1.5);
    };
    controls.push(c);
    label('RANDOMISE [F]', x);
  }

  // ---- 4. ROLL: joystick -------------------------------------------------------------------------
  {
    const x = 1.4;
    const g = new THREE.Group(); g.position.set(x, Y0, Z0); root.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.05, 32), mat(0x15161b)); base.position.y = 0.025; g.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 8, 32), mat(0xe8e8f0, { metalness: 0.6 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.052; g.add(ring);
    const stick = new THREE.Group(); stick.position.y = 0.06; g.add(stick);
    const boot = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.1, 20), mat(0x2b2f38, { roughness: 0.9 })); boot.position.y = 0.05; stick.add(boot);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.26, 12), mat(0xc9ccd4, { metalness: 0.8, roughness: 0.3 })); rod.position.y = 0.15; stick.add(rod);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 16), mat(0xe8e8f0, { roughness: 0.25 })); ball.position.y = 0.3; stick.add(ball);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 16), hitMat()); hit.position.y = 0.22; g.add(hit);
    const c = { name: 'roll', hit, g, dragging: false, tx: 0, tz: 0, ax: 0, az: 0, wobble: 0 };
    c.update = (dt, t) => {
      if (!c.dragging) { c.tx *= Math.exp(-dt * 9); c.tz *= Math.exp(-dt * 9); }
      c.ax += (c.tx - c.ax) * Math.min(1, dt * 18);
      c.az += (c.tz - c.az) * Math.min(1, dt * 18);
      c.wobble = Math.max(0, c.wobble - dt);
      stick.rotation.z = -c.ax * 0.6 + Math.sin(t * 30) * c.wobble * 0.15;
      stick.rotation.x = c.az * 0.6;
    };
    controls.push(c);
    label('ROLL [J]', x);
  }

  // ---- 5. WARP SPEED: slider along a slot (drag towards you = faster) -------------------------------
  {
    const x = 2.34, zA = -0.24, zB = 0.24;            // slot runs from zA (slow) to zB (fast), along the console
    const g = new THREE.Group(); g.position.set(x, Y0, Z0); root.add(g);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, zB - zA + 0.1), mat(0x0d0e12)); slot.position.set(0, 0.01, (zA + zB) / 2); g.add(slot);
    for (let i = 0; i <= 8; i++) {                    // tick marks, the last ones are red (hot)
      const t = new THREE.Mesh(new THREE.BoxGeometry(i % 4 === 0 ? 0.17 : 0.11, 0.008, 0.008), new THREE.MeshBasicMaterial({ color: i > 5 ? 0xff6a5a : 0x8ab4ff }));
      t.position.set(0, 0.006, zA + (i / 8) * (zB - zA)); g.add(t);
    }
    const handle = new THREE.Group(); g.add(handle);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.2, 12), mat(0xc9ccd4, { metalness: 0.8, roughness: 0.3 })); stem.position.y = 0.1; handle.add(stem);
    const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.1, 6, 14), mat(0x2f6bff, { roughness: 0.45 })); grip.position.y = 0.23; grip.rotation.z = Math.PI / 2; handle.add(grip);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, zB - zA + 0.35), hitMat()); hit.position.set(0, 0.2, (zA + zB) / 2); g.add(hit);
    const c = { name: 'warp', hit, g, zA, zB, p: 0, dragging: false, keyHeld: false };
    c.update = (dt) => {
      if (!c.dragging) {
        const target = c.keyHeld ? 1 : getWarpLevel();       // the K key pushes it to the end while held
        c.p += (target - c.p) * Math.min(1, dt * 8);
      }
      handle.position.z = zA + c.p * (zB - zA);
      handle.rotation.x = (c.p - 0.5) * 0.25;                 // leans a little with the speed
    };
    controls.push(c);
    label('WARP SPEED [K]', x);
  }

  // ---- keyboard presses animate the matching 3D control --------------------------------------
  const byCode = { KeyS: 'scan', KeyF: 'sky', KeyJ: 'roll' };
  onKey((code) => {
    const c = controls.find((x) => x.name === byCode[code]);
    if (!c) return;
    if (c.name === 'scan') c.step();
    else if (c.name === 'sky' && !c.flash) { c.target = -c.target; c.flash = 1; }
    else if (c.name === 'roll') c.wobble = 0.6;
  });
  addEventListener('keydown', (e) => { if (e.code === 'KeyK') controls.find((x) => x.name === 'warp').keyHeld = true; });
  addEventListener('keyup', (e) => { if (e.code === 'KeyK') controls.find((x) => x.name === 'warp').keyHeld = false; });

  // ---- pointer handling ---------------------------------------------------------------------------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const point = new THREE.Vector3();
  const plane = new THREE.Plane();
  const setRay = (e) => { ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); };
  const pick = (e) => {
    setRay(e);
    const hit = ray.intersectObjects(controls.map((c) => c.hit), false)[0];
    return hit ? controls.find((c) => c.hit === hit.object) : null;
  };
  // intersect the pointer ray with a plane parallel to the console, at a local height
  const localPoint = (localY) => {
    consoleGroup.updateMatrixWorld(true);
    const n = new THREE.Vector3(0, 1, 0).transformDirection(consoleGroup.matrixWorld);
    const p0 = new THREE.Vector3(0, localY, 0).applyMatrix4(consoleGroup.matrixWorld);
    plane.setFromNormalAndCoplanarPoint(n, p0);
    if (!ray.ray.intersectPlane(plane, point)) return null;
    return consoleGroup.worldToLocal(point.clone());
  };

  let active = null;
  const down = (e) => {
    const c = pick(e);
    if (!c) return false;
    active = c;
    if (c.name === 'scan' || c.name === 'sky') c.click();
    if (c.name === 'zoom') { c.dragging = true; move(e); }
    if (c.name === 'roll') { c.dragging = true; move(e); }
    if (c.name === 'warp') { c.dragging = true; move(e); }
    return true;
  };
  const move = (e) => {
    if (!active) return;
    setRay(e);
    if (active.name === 'zoom') {
      const p = localPoint(Y0 + 0.05);
      if (p) { const t = Math.min(1, Math.max(0, (p.x - active.x0) / active.len)); active.p = t; setZoom(active.zoomOf(t)); }
    } else if (active.name === 'warp') {
      const p = localPoint(Y0 + 0.05);
      if (p) {
        const z = p.z - active.g.position.z;
        active.p = Math.min(1, Math.max(0, (z - active.zA) / (active.zB - active.zA)));
        setWarpLevel(active.p);
      }
    } else if (active.name === 'roll') {
      const p = localPoint(Y0 + 0.25);
      if (p) {
        const gx = active.g.position.x, gz = active.g.position.z;
        active.tx = Math.max(-1, Math.min(1, (p.x - gx) / 0.2));
        active.tz = Math.max(-1, Math.min(1, (p.z - gz) / 0.2));
        setRollInput(active.tx);
      }
    }
  };
  const up = () => {
    if (!active) return;
    if (active.name === 'zoom') active.dragging = false;
    if (active.name === 'roll') { active.dragging = false; setRollInput(0); }
    if (active.name === 'warp') active.dragging = false;
    active = null;
  };

  return {
    pointerDown: down, pointerMove: move, pointerUp: up,
    isActive: () => !!active,
    hover: (e) => !!pick(e),
    update: (dt, t) => controls.forEach((c) => c.update(dt, t)),
  };
};
