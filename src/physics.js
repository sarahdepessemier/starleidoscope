import * as THREE from 'three/webgpu';
import RAPIER from '@dimforge/rapier3d-compat';

// Zero-gravity physics (Rapier). The mug, clipboard, pen and dice float around the cockpit,
// bounce off the walls and the console, and can be grabbed and thrown with the mouse.
export const createPhysics = async (cockpit, scene, camera) => {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });   // no gravity: we're in space
  world.timestep = 1 / 60;

  // ---- static colliders: console, wall, ceiling, floor, sides, back --------------------
  const fixed = (hx, hy, hz, pos, quat = { x: 0, y: 0, z: 0, w: 1 }) => {
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(pos.x, pos.y, pos.z).setRotation(quat).setRestitution(0.6).setFriction(0.3));
  };
  const cg = cockpit.consoleGroup;
  cg.updateMatrixWorld(true);
  const cp = new THREE.Vector3(); const cq = new THREE.Quaternion();
  cg.getWorldPosition(cp); cg.getWorldQuaternion(cq);
  fixed(3.6, 0.27, 1.3, cp, cq);                  // the slanted console
  fixed(8, 5, 0.5, { x: 0, y: 0, z: -0.5 });      // wall with the window
  fixed(8, 0.5, 6, { x: 0, y: 3.4, z: 3 });       // ceiling
  fixed(8, 0.5, 6, { x: 0, y: -2.5, z: 3 });      // floor
  fixed(0.5, 5, 6, { x: -3.75, y: 0, z: 3 });     // left
  fixed(0.5, 5, 6, { x: 3.75, y: 0, z: 3 });      // right
  fixed(8, 5, 0.5, { x: 0, y: 0, z: 3.7 });       // back wall (keeps things away from the camera)

  // ---- dynamic props ---------------------------------------------------------------------
  const bodies = [];
  const add = (obj, desc) => {
    scene.attach(obj);                              // keep the world position, leave the console group
    const p = obj.position; const q = obj.quaternion;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setLinearDamping(0.12).setAngularDamping(0.35).setCcdEnabled(true).setCanSleep(false)
    );
    world.createCollider(desc.setRestitution(0.55).setFriction(0.4).setDensity(1.0), body);
    // a gentle push so everything starts to float away from the console
    body.setLinvel({ x: (Math.random() - 0.5) * 0.08, y: 0.1 + Math.random() * 0.08, z: 0.05 + Math.random() * 0.06 }, true);
    body.setAngvel({ x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5, z: (Math.random() - 0.5) * 0.5 }, true);
    bodies.push({ obj, body });
  };

  const [mug, clipboard, pen, dice] = cockpit.props;
  add(mug, RAPIER.ColliderDesc.cylinder(0.0575 * mug.scale.x, 0.09 * mug.scale.x));
  const ch = clipboard.userData.half.clone().multiplyScalar(clipboard.scale.x);
  add(clipboard, RAPIER.ColliderDesc.cuboid(ch.x, Math.max(ch.y, 0.03), ch.z));
  add(pen, RAPIER.ColliderDesc.capsule(pen.userData.halfLength * pen.scale.x - pen.userData.radius * pen.scale.x, pen.userData.radius * pen.scale.x));
  const dh = dice.userData.half * dice.scale.x;
  add(dice, RAPIER.ColliderDesc.cuboid(dh, dh, dh));

  // ---- picking and dragging -----------------------------------------------------------------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const objs = bodies.map((b) => b.obj);
  const findProp = (hitObj) => { let o = hitObj; while (o) { const b = bodies.find((x) => x.obj === o); if (b) return b; o = o.parent; } return null; };
  const rayAt = (e) => { ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); };

  let drag = null;
  const plane = new THREE.Plane();
  const tmp = new THREE.Vector3();

  const hover = (e) => { rayAt(e); return ray.intersectObjects(objs, true).length > 0; };

  const dragStart = (e) => {
    rayAt(e);
    const hit = ray.intersectObjects(objs, true)[0];
    if (!hit) return false;
    const prop = findProp(hit.object);
    if (!prop) return false;
    const t = prop.body.translation();
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), hit.point);
    drag = { prop, offset: hit.point.clone().sub(new THREE.Vector3(t.x, t.y, t.z)) };
    return true;
  };
  const dragMove = (e) => {
    if (!drag) return;
    rayAt(e);
    if (ray.ray.intersectPlane(plane, tmp)) drag.target = tmp.clone().sub(drag.offset);
  };
  const dragEnd = () => {
    if (!drag) return;
    const b = drag.prop.body;
    // a little spin when you let go, it is zero-g after all
    b.setAngvel({ x: (Math.random() - 0.5) * 3, y: (Math.random() - 0.5) * 3, z: (Math.random() - 0.5) * 3 }, true);
    drag = null;
  };

  // hyperjump turbulence: everything gets kicked a bit
  const jolt = (strength = 1) => {
    bodies.forEach(({ body }) => {
      body.applyImpulse({ x: (Math.random() - 0.5) * 0.25 * strength, y: (Math.random() - 0.3) * 0.25 * strength, z: (Math.random() - 0.3) * 0.25 * strength }, true);
      body.applyTorqueImpulse({ x: (Math.random() - 0.5) * 0.02 * strength, y: (Math.random() - 0.5) * 0.02 * strength, z: (Math.random() - 0.5) * 0.02 * strength }, true);
    });
  };

  // Soft "leash": the room is much wider than what the camera sees, so box walls alone let objects float
  // out of sight. Whatever drifts towards the edge of the screen is pulled back inside the view.
  const v3 = new THREE.Vector3(); const target = new THREE.Vector3();
  const LIM_X = 0.7, LIM_TOP = 0.6, LIM_BOTTOM = -0.68;
  const keepInView = (dt) => {
    camera.updateMatrixWorld();
    for (const { obj, body } of bodies) {
      if (drag && drag.prop.body === body) continue;
      const t = body.translation();
      v3.set(t.x, t.y, t.z).project(camera);
      const cx = Math.min(LIM_X, Math.max(-LIM_X, v3.x));
      const cy = Math.min(LIM_TOP, Math.max(LIM_BOTTOM, v3.y));
      if (cx === v3.x && cy === v3.y && v3.z < 1) continue;
      target.set(cx, cy, Math.min(v3.z, 0.995)).unproject(camera);
      const l = body.linvel();
      const k = Math.min(1, dt * 6);
      body.setLinvel({ x: l.x * (1 - 0.15 * k) + (target.x - t.x) * 4 * k, y: l.y * (1 - 0.15 * k) + (target.y - t.y) * 4 * k, z: l.z * (1 - 0.15 * k) + (target.z - t.z) * 4 * k }, true);
    }
  };

  let acc = 0;
  const step = (dt) => {
    if (drag?.target) {
      const b = drag.prop.body; const t = b.translation();
      const v = new THREE.Vector3(drag.target.x - t.x, drag.target.y - t.y, drag.target.z - t.z).multiplyScalar(14);
      if (v.length() > 9) v.setLength(9);
      b.setLinvel(v, true);
      const a = b.angvel(); b.setAngvel({ x: a.x * 0.9, y: a.y * 0.9, z: a.z * 0.9 }, true);
    }
    acc += Math.min(dt, 0.05);
    while (acc >= 1 / 60) { world.step(); acc -= 1 / 60; }
    keepInView(dt);
    for (const { obj, body } of bodies) {
      const t = body.translation(); const r = body.rotation();
      obj.position.set(t.x, t.y, t.z);
      obj.quaternion.set(r.x, r.y, r.z, r.w);
    }
  };

  return { step, hover, dragStart, dragMove, dragEnd, jolt, isDragging: () => !!drag };
};
