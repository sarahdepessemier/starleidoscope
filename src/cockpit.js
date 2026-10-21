import * as THREE from 'three/webgpu';

// The cockpit is built in code: cream wall with a round window, a slanted console full of
// blinking buttons, one big TELEPORT button, a picture frame and a mug.
const CREAM = 0xe6d9bb;
const CREAM_DARK = 0xcdbf9d;
const DARK = 0x2b2f38;
const LED_COLOURS = [0xffb347, 0xff5a4a, 0x6cf0a8, 0x5ad0ff, 0xfff3d0, 0xff7ad9];

export const WINDOW_R = 0.95;
export const WINDOW_POS = new THREE.Vector3(0, 0.8, 0);

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...o });

export const makeLabel = (text, { w = 1, h = 0.25, font = 'bold 64px "Courier New", monospace', color = '#2b2f38', bg = null } = {}) => {
  const c = document.createElement('canvas');
  c.width = 512; c.height = Math.round(512 * (h / w));
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
  g.fillStyle = color; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2 + 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  m.userData = { canvas: c, tex, g, text, font, color, bg };
  return m;
};

// redraw a label (used for the frame caption)
const setLabel = (label, text) => {
  const { canvas, tex, g, font, color, bg } = label.userData;
  g.clearRect(0, 0, canvas.width, canvas.height);
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, canvas.width, canvas.height); }
  g.fillStyle = color; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  // shrink the text until it fits
  let px = Number(/(\d+)px/.exec(font)[1]);
  while (g.measureText(text).width > canvas.width * 0.94 && px > 12) { px -= 2; g.font = font.replace(/\d+px/, px + 'px'); }
  g.fillText(text, canvas.width / 2, canvas.height / 2 + 3);
  tex.needsUpdate = true;
};

const buildWall = (scene) => {
  const W = 14, H = 8;
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2, -H / 2); shape.lineTo(W / 2, -H / 2); shape.lineTo(W / 2, H / 2); shape.lineTo(-W / 2, H / 2); shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(WINDOW_POS.x, WINDOW_POS.y, WINDOW_R, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false, curveSegments: 96 });
  geo.translate(0, 0, -0.35); // front face at z = 0
  const wall = new THREE.Mesh(geo, mat(CREAM));
  scene.add(wall);

  // panel seams
  const seam = mat(0xa99b7c, { roughness: 0.9 });
  const seams = new THREE.Group();
  for (const y of [-0.95, 1.9]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(W, 0.035, 0.02), seam); s.position.set(0, y, 0.005); seams.add(s);
  }
  for (const x of [-3.6, -1.55, 1.55, 3.6]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.035, 2.85, 0.02), seam); s.position.set(x, 0.475, 0.005); seams.add(s);
  }
  scene.add(seams);

  // rivets along the seams
  const rivetGeo = new THREE.SphereGeometry(0.03, 8, 6);
  const rivets = new THREE.InstancedMesh(rivetGeo, mat(0x9c8f72, { metalness: 0.4 }), 140);
  const m4 = new THREE.Matrix4(); let n = 0;
  for (const x of [-3.6, -1.55, 1.55, 3.6]) {
    for (let y = -0.85; y <= 1.8; y += 0.3) { m4.makeTranslation(x + 0.1, y, 0.01); rivets.setMatrixAt(n++, m4); }
  }
  rivets.count = n;
  scene.add(rivets);

  // window rim + bolts
  const rim = new THREE.Mesh(new THREE.TorusGeometry(WINDOW_R + 0.05, 0.085, 20, 96), mat(0x7f8794, { metalness: 0.7, roughness: 0.35 }));
  rim.position.copy(WINDOW_POS); rim.position.z = 0.01;
  scene.add(rim);
  const boltGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.04, 10); boltGeo.rotateX(Math.PI / 2);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const b = new THREE.Mesh(boltGeo, mat(0x4a505c, { metalness: 0.8, roughness: 0.3 }));
    b.position.set(WINDOW_POS.x + Math.cos(a) * (WINDOW_R + 0.22), WINDOW_POS.y + Math.sin(a) * (WINDOW_R + 0.22), 0.02);
    scene.add(b);
  }

  // dark room around everything
  const room = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 12), new THREE.MeshStandardMaterial({ color: 0x24262d, side: THREE.BackSide, roughness: 1 }));
  room.position.set(0, 0, 5.8);
  scene.add(room);
};

// a panel with round gauges on the right-hand wall
const buildGauges = (scene) => {
  const g = new THREE.Group();
  g.position.set(2.75, 1.0, 0.0);
  scene.add(g);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.15, 0.05), mat(DARK, { roughness: 0.55 }));
  plate.position.z = 0.025; g.add(plate);
  const needles = [];
  [[-0.5, 0.18], [0.0, 0.18], [0.5, 0.18]].forEach(([x, y], i) => {
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), new THREE.MeshBasicMaterial({ color: 0xf2ead6 }));
    face.position.set(x, y, 0.055); g.add(face);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 32), mat(0xb8bcc6, { metalness: 0.7, roughness: 0.3 }));
    bezel.position.set(x, y, 0.055); g.add(bezel);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.01), new THREE.MeshBasicMaterial({ color: 0xd8322b }));
    needle.geometry.translate(0, 0.07, 0);
    needle.position.set(x, y, 0.065); g.add(needle);
    needles.push(needle);
  });
  const warn = makeLabel('WARP CORE  98%', { w: 1.4, h: 0.2, font: 'bold 56px "Courier New", monospace', color: '#ffb347', bg: '#15161b' });
  warn.position.set(0, -0.36, 0.055); g.add(warn);
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.05), new THREE.MeshBasicMaterial({ color: 0x6cf0a8 }));
  bar.position.set(0, -0.5, 0.055); g.add(bar);
  return { needles };
};

const buildConsole = (scene) => {
  const g = new THREE.Group();
  g.position.set(0, -1.55, 1.0);
  g.rotation.x = 0.5;
  scene.add(g);

  const body = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.5, 2.6), mat(CREAM_DARK));
  g.add(body);
  const top = 0.25;
  // dark inset panels
  for (const x of [-2.15, 2.15]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.02, 1.7), mat(DARK, { roughness: 0.6 }));
    p.position.set(x, top + 0.006, 0.05); g.add(p);
  }
  const centre = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 1.7), mat(0x39404c, { roughness: 0.6 }));
  centre.position.set(0, top + 0.006, 0.05); g.add(centre);

  // blinking LED buttons: instanced, every one has its own colour and blink pattern
  const btnGeo = new THREE.CylinderGeometry(0.03, 0.034, 0.03, 12);
  const buttons = new THREE.InstancedMesh(btnGeo, new THREE.MeshBasicMaterial(), 800);
  const dummy = new THREE.Object3D();
  const base = []; const blink = [];
  let n = 0;
  for (const side of [-1, 1]) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 19; c++) {
        if (n >= 800) break;
        const x = side * (0.82 + c * 0.14 + (r % 2) * 0.04);
        const z = -0.72 + r * 0.14;
        if (Math.abs(x) > 3.4) continue;
        if (Math.random() < 0.12) continue;   // a few gaps look hand-placed
        dummy.position.set(x, top + 0.03, z); dummy.updateMatrix();
        buttons.setMatrixAt(n, dummy.matrix);
        const col = new THREE.Color(LED_COLOURS[(Math.random() * LED_COLOURS.length) | 0]).multiplyScalar(0.85);
        base.push(col);
        blink.push({ speed: 0.4 + Math.random() * 2.2, phase: Math.random() * 6.28, steady: Math.random() < 0.35, thr: -0.2 + Math.random() * 0.6 });
        buttons.setColorAt(n, col);
        n++;
      }
    }
  }
  buttons.count = n;
  g.add(buttons);

  // a few dials and switches on the centre panel
  for (const [x, z] of [[-0.38, -0.58], [0.38, -0.58]]) {
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.06, 24), mat(0xb8bcc6, { metalness: 0.7, roughness: 0.3 }));
    dial.position.set(x, top + 0.04, z); g.add(dial);
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.11), mat(0xff5a4a));
    tick.position.set(x, top + 0.075, z - 0.03); tick.rotation.y = x * 2; g.add(tick);
  }
  // the big TELEPORT button
  const tele = new THREE.Group();
  tele.position.set(0, top, -0.05);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.06, 40), mat(0xf2c230, { roughness: 0.5, metalness: 0.3 }));
  ring.position.y = 0.03;
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.012, 8, 48), mat(DARK));
  stripe.rotation.x = Math.PI / 2; stripe.position.y = 0.062;
  const capMat = mat(0xb21d17, { emissive: 0xc01a12, emissiveIntensity: 0.25, roughness: 0.4 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.11, 40), capMat);
  cap.position.y = 0.11;
  tele.add(ring, stripe, cap);
  g.add(tele);

  const label = makeLabel('TELEPORT', { w: 0.75, h: 0.16, color: '#2b2f38', bg: null, font: 'bold 74px "Courier New", monospace' });
  label.rotation.x = -Math.PI / 2; label.position.set(0, top + 0.012, 0.36);
  g.add(label);

  return { group: g, buttons, base, blink, tele, cap, capMat };
};

const buildFrame = (scene) => {
  const g = new THREE.Group();
  g.position.set(-2.75, 1.0, 0.0);
  g.rotation.z = 0.025;
  scene.add(g);
  const FW = 1.25, FH = 0.95, B = 0.1;
  const wood = mat(0x6b4a2f, { roughness: 0.6 });
  const outer = new THREE.Mesh(new THREE.BoxGeometry(FW + B * 2, FH + B * 2, 0.07), wood);
  outer.position.z = 0.035; g.add(outer);
  const mount = new THREE.Mesh(new THREE.BoxGeometry(FW + 0.06, FH + 0.06, 0.02), mat(0xf2ead6));
  mount.position.z = 0.075; g.add(mount);
  // the picture itself: a plane that gets a destination shader (no mouse reaction)
  const picture = new THREE.Mesh(new THREE.PlaneGeometry(FW - 0.1, FH - 0.1), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  picture.position.z = 0.09; g.add(picture);
  const caption = makeLabel('NEXT: ???', { w: 1.2, h: 0.17, font: 'bold 52px "Courier New", monospace', color: '#2b2f38', bg: '#f2ead6' });
  caption.position.set(0, -FH / 2 - B - 0.15, 0.04); g.add(caption);
  const nail = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), mat(0x555a66, { metalness: 0.8 }));
  nail.position.set(0, FH / 2 + B + 0.1, 0.03); g.add(nail);
  return { group: g, picture, caption, aspect: (FW - 0.1) / (FH - 0.1) };
};

// a mug that stands on the console (physics will make it float later)
export const createMug = () => {
  const g = new THREE.Group();
  const prof = [[0, 0], [0.085, 0], [0.09, 0.01], [0.09, 0.115], [0.082, 0.115], [0.082, 0.02], [0, 0.02]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), mat(0xf4f1e8, { roughness: 0.3, side: THREE.DoubleSide }));
  body.position.y = -0.0575; g.add(body);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.081, 32), mat(0x3b2214, { roughness: 0.2 }));
  coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.045; g.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 10, 20, Math.PI), mat(0xf4f1e8, { roughness: 0.3 }));
  handle.position.set(0.09, 0.0, 0); handle.rotation.z = -Math.PI / 2; g.add(handle);
  // a little star sticker, of course
  const sticker = makeLabel('★', { w: 0.08, h: 0.08, font: 'bold 150px sans-serif', color: '#d8322b' });
  sticker.position.set(0, 0, 0.0905); g.add(sticker);
  g.userData.radius = 0.1; g.userData.halfHeight = 0.0575;
  return g;
};

export const createPen = () => {
  const g = new THREE.Group();   // axis = local Y, length 0.26
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 12), mat(0x2a5db0, { roughness: 0.35 }));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 12), mat(0xd9d4c4, { metalness: 0.6, roughness: 0.3 }));
  tip.position.y = -0.125; tip.rotation.x = Math.PI;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.05, 12), mat(0xf2f2f2, { roughness: 0.3 }));
  cap.position.y = 0.125;
  g.add(body, tip, cap);
  g.userData = { halfLength: 0.13, radius: 0.017 };
  return g;
};

export const createDice = () => {
  const pip = (n) => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#fbf8ee'; x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#2b2f38';
    const P = { 1: [[.5, .5]], 2: [[.25, .25], [.75, .75]], 3: [[.25, .25], [.5, .5], [.75, .75]], 4: [[.25, .25], [.75, .25], [.25, .75], [.75, .75]], 5: [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]], 6: [[.25, .25], [.75, .25], [.25, .5], [.75, .5], [.25, .75], [.75, .75]] }[n];
    P.forEach(([px, py]) => { x.beginPath(); x.arc(px * 128, py * 128, 11, 0, 7); x.fill(); });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.4 });
  };
  const d = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), [1, 6, 2, 5, 3, 4].map(pip));
  d.userData = { half: 0.07 };
  return d;
};

export const createClipboard = () => {
  const g = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.012, 0.36), mat(0x8a5a35, { roughness: 0.6 }));
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.004, 0.31), mat(0xfbf8ee, { roughness: 0.9 }));
  paper.position.y = 0.008;
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.04), mat(0xb8bcc6, { metalness: 0.8, roughness: 0.3 }));
  clip.position.set(0, 0.012, -0.16);
  g.add(board, paper, clip);
  g.userData.half = new THREE.Vector3(0.13, 0.012, 0.18);
  return g;
};

export const createCockpit = () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x15161b);

  const camera = new THREE.PerspectiveCamera(49, innerWidth / innerHeight, 0.1, 50);
  const camBase = new THREE.Vector3(0, 0.3, 6.8);
  const camTarget = new THREE.Vector3(0, -0.35, 0);
  camera.position.copy(camBase);

  scene.add(new THREE.HemisphereLight(0xfff1d6, 0x30323c, 0.55));
  const key = new THREE.DirectionalLight(0xfff0d8, 0.9); key.position.set(1.5, 3, 5); scene.add(key);
  // coloured glow from the window, changes with every destination
  const glow = new THREE.PointLight(0xffffff, 5, 9, 1.6);
  glow.position.set(0, WINDOW_POS.y, 1.1);
  scene.add(glow);
  const glowTarget = new THREE.Color(0xffffff);

  buildWall(scene);
  const consoleParts = buildConsole(scene);
  const gauges = buildGauges(scene);
  const frame = buildFrame(scene);

  // the window disc: gets the destination shader
  const windowDisc = new THREE.Mesh(new THREE.CircleGeometry(WINDOW_R, 96), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  windowDisc.position.set(WINDOW_POS.x, WINDOW_POS.y, -0.12);
  scene.add(windowDisc);

  const mug = createMug();
  const clipboard = createClipboard();
  // placed on the console surface (console group coordinates)
  mug.scale.setScalar(1.8); mug.position.set(2.3, 0.27 + 0.0575 * 1.8 + 0.01, -0.15);
  clipboard.scale.setScalar(1.8); clipboard.position.set(-2.3, 0.27 + 0.03, -0.1); clipboard.rotation.y = 0.25;
  const pen = createPen(); pen.scale.setScalar(1.5); pen.position.set(1.4, 0.27 + 0.03, 0.1); pen.rotation.z = Math.PI / 2; pen.rotation.y = 0.5;
  const dice = createDice(); dice.scale.setScalar(1.4); dice.position.set(-1.4, 0.27 + 0.1, 0.05); dice.rotation.set(0.3, 0.6, 0);
  consoleParts.group.add(mug, clipboard, pen, dice);

  const update = (t, dt, mouse) => {
    // blinking buttons
    const { buttons, base, blink } = consoleParts;
    const col = new THREE.Color();
    for (let i = 0; i < buttons.count; i++) {
      const b = blink[i];
      const on = b.steady ? 1 : (Math.sin(t * b.speed + b.phase) > b.thr ? 1 : 0.18);
      col.copy(base[i]).multiplyScalar(on);
      buttons.setColorAt(i, col);
    }
    buttons.instanceColor.needsUpdate = true;

    gauges.needles.forEach((n, i) => { n.rotation.z = Math.sin(t * (0.6 + i * 0.37) + i) * 0.9 - 0.2; });

    // light glow eases to the destination tint
    glow.color.lerp(glowTarget, Math.min(1, dt * 3));

    // small camera parallax with the mouse
    camera.position.x += ((camBase.x + (mouse.x - 0.5) * 0.35) - camera.position.x) * Math.min(1, dt * 4);
    camera.position.y += ((camBase.y + (mouse.y - 0.5) * 0.18) - camera.position.y) * Math.min(1, dt * 4);
    camera.lookAt(camTarget);

    // teleport button: hover glow + pressed offset
    const press = consoleParts.tele.userData.press || 0;
    consoleParts.cap.position.y = 0.11 - press * 0.05;
    consoleParts.capMat.emissiveIntensity = 0.25 + (consoleParts.tele.userData.hover ? 0.35 : 0) + press * 0.6;
    consoleParts.tele.userData.press = Math.max(0, press - dt * 4);
  };

  return {
    scene, camera, update,
    windowDisc, frame, mug, clipboard, pen, dice,
    props: [mug, clipboard, pen, dice],
    teleportMesh: consoleParts.cap,
    teleportGroup: consoleParts.tele,
    consoleGroup: consoleParts.group,
    setTint: (hex) => glowTarget.set(hex),
    setCaption: (text) => setLabel(frame.caption, text),
    pressTeleport: () => { consoleParts.tele.userData.press = 1; },
    setHover: (v) => { consoleParts.tele.userData.hover = v; },
  };
};
