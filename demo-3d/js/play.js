'use strict';
/* =========================================================================
 * Things to do together: photographs (and the fridge they end up on), a
 * snowman, snow angels, cocoa, reading on the sofa, and a game of cards
 * that she is not above cheating at. Runs after story.js and life.js.
 * ========================================================================= */
(G.afterBuild = G.afterBuild || []).push(() => {
const { PLAYER, PARTNER, STATE, clamp, smooth } = G;
const A = G.SAPI, S = A.S, L = G.LIFE;
const { P, Y, N, Pt, choose, wait, fixed, V, addBond, addRivalry, addScrap, cyc } = A;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const dist = () => Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
const K = (o) => ({ shot: 'keep', ...o });
const free = () => !G.busy() && !PLAYER.script && !(PLAYER.sit > 0.1) && !PLAYER.lie && !STATE.noControl;
// Get both of you out of whatever you were in the middle of, for a scene.
function clearHands() {
  if (PARTNER.task) G.endPartnerTask();
  if (PARTNER.hold) G.setHold(false);
  PARTNER.holdTimer = null;
}
const onSnow = (x, z) => { const s = G.surfaceAt(x, z); return s === 'snow' || s === 'packed'; };
// Where you are and when, in words (photo captions).
function whereWhen() {
  const x = PLAYER.x, z = PLAYER.z, r = A.room(x, z);
  let where = { bedroom: 'the bedroom', living: G.FIRE.on ? 'by the fire' : 'the living room', kitchen: 'the kitchen', porch: 'the porch' }[r];
  if (!where) where = G.onIce(x, z) ? 'on the frozen lake' : Math.hypot(x - G.HILL.x, z - G.HILL.z) < 6 ? 'on top of the hill' : z > 31 ? 'out past the end of the path' : 'in the clearing';
  const when = STATE.tod > 0.6 ? 'at night' : STATE.day > 0.6 ? (S.chapter === 'walk' ? 'in the afternoon' : 'in the morning') : STATE.day > 0.25 ? 'late in the afternoon' : 'at dusk';
  return { where, when };
}

/* =====================================================================
 * Photographs
 * ===================================================================== */
const PHOTO = { cool: 0, last: 0 };
const FRIDGE = (() => {
  const slots = [[14.36, 1.42, -2.34], [14.83, 1.45, -2.48], [14.4, 0.98, -2.45], [14.8, 1.02, -2.33]];
  const frameM = G.shared({ color: '#f6f1e6', roughness: 0.85 });
  return slots.map(([x, y, rz]) => {
    const g = new THREE.Group(); g.position.set(x, y, 0.789); g.rotation.z = rz; g.visible = false; G.world.add(g);
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.118), frameM); g.add(fr);
    const ph = G.canvasTex(0, null, { w: 64, h: 48, draw: (c, w, h) => { c.fillStyle = '#556'; c.fillRect(0, 0, w, h); } });
    ph.wrapS = ph.wrapT = THREE.ClampToEdgeWrapping;
    const pm = G.std({ map: ph, roughness: 0.4, env: 0.5 });
    const img = new THREE.Mesh(new THREE.PlaneGeometry(0.086, 0.065), pm); img.position.set(0, 0.012, 0.001); g.add(img);
    const mag = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 6), G.shared({ color: '#c94a3a', roughness: 0.3, env: 0.9 })); mag.scale.z = 0.5; mag.position.set(0, 0.052, 0.004); g.add(mag);
    return { g, pm };
  });
})();
function refreshFridge() {
  const ph = S.photos.slice(-FRIDGE.length);
  FRIDGE.forEach((f, i) => {
    const p = ph[i];
    f.g.visible = !!p;
    if (!p || f.src === p.src) return;
    f.src = p.src;
    const img = new Image();
    img.onload = () => { const t = new THREE.Texture(img); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; if (f.pm.map) f.pm.map.dispose(); f.pm.map = t; };
    img.src = p.src;
  });
}
G.refreshFridge = () => { FRIDGE.forEach((f) => { f.src = null; }); refreshFridge(); };
function shutter() { G.Audio.tone(2400, 0.015, 0.03); G.Audio.tone(1300, 0.03, 0.025, 0.06); }
// Read the canvas right after it's drawn (same task), crop to 4:3 and keep a small JPEG.
function capture() {
  return new Promise((res) => {
    G.onFrameEnd = () => {
      const src = G.canvas, W = src.width, H = src.height, sw = Math.min(W, H * 4 / 3), sh = sw * 3 / 4;
      const cv = document.createElement('canvas'); cv.width = 320; cv.height = 240;
      const c = cv.getContext('2d');
      c.drawImage(src, (W - sw) / 2, (H - sh) / 2, sw, sh, 0, 0, 320, 240);
      // A little warmth and grain, like the polaroids in the cabin.
      c.fillStyle = 'rgba(255,220,170,0.07)'; c.fillRect(0, 0, 320, 240);
      res(cv.toDataURL('image/jpeg', 0.8));
    };
  });
}
function keepPhoto(src, caption) {
  S.photos.push({ src, caption });
  if (S.photos.length > 12) S.photos.shift();
  G.remember && G.remember('photo', { src, caption });
  S.scrap.push({ art: 'photo', src, caption });
  // Only the most recent photographs stay in the scrapbook too (they're big).
  const ph = S.scrap.filter((p) => p.art === 'photo');
  if (ph.length > 12) S.scrap.splice(S.scrap.indexOf(ph[0]), 1);
  refreshFridge();
  const pol = G.$('polaroid');
  pol.querySelector('img').src = src; pol.querySelector('p').textContent = G.fmt(caption);
  pol.classList.add('show'); clearTimeout(keepPhoto._t); keepPhoto._t = setTimeout(() => pol.classList.remove('show'), 2800);
}
function flash() { const f = G.$('flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }
function partnerInFrame() {
  if (PARTNER.hidden || dist() > 9) return null;
  const h = G.headPos(PARTNER), v = h.clone().project(G.camera);
  if (v.z > 1 || Math.abs(v.x) > 0.92 || Math.abs(v.y) > 0.92) return null;
  const cp = G.camera.position, fx = Math.sin(PARTNER.yaw), fz = Math.cos(PARTNER.yaw);
  const tx = cp.x - h.x, tz = cp.z - h.z, l = Math.hypot(tx, tz) || 1;
  return { facing: (fx * tx + fz * tz) / l > 0.25 || PARTNER.lie };
}
G.takePhoto = async () => {
  if (STATE.paused || !STATE.started || G.simT - PHOTO.last < 1.4 || document.body.classList.contains('ending') || (G.UI.modal && G.UI.modal !== 'choices')) return;
  PHOTO.last = G.simT;
  const inF = partnerInFrame(), ww = whereWhen();
  const src = await capture();
  shutter(); flash();
  const cap = inF ? `{P}, ${ww.where}, ${ww.when}.` : `${ww.where[0].toUpperCase() + ww.where.slice(1)}, ${ww.when}.`;
  keepPhoto(src, cap);
  S.mem.photos = (S.mem.photos || 0) + 1;
  // She has opinions about being photographed.
  if (inF && !G.busy() && !PARTNER.lie) {
    if (!inF.facing) G.bark(pick(['Did you just photograph the back of my head?', 'I wasn’t ready! Was that my bad side? I have two bad sides.']), 2.8);
    else if (PARTNER.dozing) { /* asleep: she'll never know */ }
    else { G.bark(pick(['Was I blinking? I was blinking.', 'Let me see. …No. Keep it.', 'Oh, you sneak.', 'Take another. I’ll do my good face.']), 2.6); if (Math.random() < 0.4 && !PARTNER.sit && !PARTNER.task) { PARTNER.forcePose = 'wave'; wait(1.4).then(() => { if (PARTNER.forcePose === 'wave') PARTNER.forcePose = null; }); } }
  } else if (inF && PARTNER.lie && !PARTNER.lidsClosed) G.bark('Mm. Don’t you dare. Not before nine.', 2.4);
  if (S.mem.photos === 1) G.hint('Your photographs go in the scrapbook, and the latest ones end up on the fridge.', 5);
};
// Together: a photograph of the two of you, at arm's length.
async function selfie() {
  clearHands(); STATE.busy = true;
  // Stand side by side facing whichever way has the most room for the camera.
  const mx = (PLAYER.x + PARTNER.x) / 2, mz = (PLAYER.z + PARTNER.z) / 2;
  let best = 0, bestA = PLAYER.yaw;
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; let ok = 0; for (let d = 0.4; d <= 1.6; d += 0.3) if (G.navOpen(mx + Math.sin(a) * d, mz + Math.cos(a) * d)) ok++; if (ok > best) { best = ok; bestA = a; } }
  const fx = Math.sin(bestA), fz = Math.cos(bestA), rx = Math.cos(bestA), rz = -Math.sin(bestA);
  await Promise.all([G.slideTo(PLAYER, mx - rx * 0.24, mz - rz * 0.24, bestA, 0.5), G.slideTo(PARTNER, mx + rx * 0.24, mz + rz * 0.24, bestA, 0.5)]);
  const hy = G.headPos(PARTNER).y;
  STATE.sceneShot = true;
  const cam = V(mx + fx * 1.1, hy - 0.02, mz + fz * 1.1), look = V(mx, hy - 0.12, mz);
  G.setShot(fixed(cam, look, 46, 0.006));
  // Both of you look at the lens, heads together.
  PARTNER.mode = 'still'; PARTNER.yaw = bestA; PARTNER.stillLook = { x: cam.x, z: cam.z, headY: cam.y };
  PARTNER.tiltTarget = 0.22; PLAYER.tiltTarget = -0.12; PLAYER.lookFix = { x: cam.x, z: cam.z, headY: cam.y };
  G.bark(pick(['Wait — is my hair all right? Don’t answer.', 'Closer. You’re enormous. Crouch.', 'On three. Not after three. On three.']), 2.4);
  await wait(1.2);
  for (const n of ['3', '2', '1']) { G.hint(n + '…', 0.7); G.Audio.tone(900, 0.03, 0.02); await wait(0.75); }
  PARTNER.lidsClosed = false; PLAYER.lidsClosed = false;
  const ww = whereWhen(), src = await capture();
  shutter(); flash();
  keepPhoto(src, `The two of you, ${ww.where}, ${ww.when}.`);
  S.mem.photos = (S.mem.photos || 0) + 1; S.mem.affection++; addBond(0.3);
  await wait(0.9);
  G.bark(pick(['Let me see. …Oh. We look happy. How embarrassing.', 'That one’s going on the fridge.', 'You blinked. It’s perfect.']), 3);
  PARTNER.tiltTarget = 0; PLAYER.tiltTarget = 0; PLAYER.lookFix = null; PARTNER.mode = 'follow'; PARTNER.stillLook = null;
  await wait(1.2);
  STATE.sceneShot = false; G.releaseCamera(); STATE.busy = false;
}
G.TOGETHER_EXTRA.push({ id: 'selfie', t: 'Take a photo together', when: (c) => !c.seated && !PARTNER.carry && !PLAYER.carry, run: selfie });

/* =====================================================================
 * A snowman
 * ===================================================================== */
const SNOWMAN = (() => {
  const g = new THREE.Group(); g.visible = false; g.userData.dynamic = true; G.world.add(g);
  const ball = (r) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), G.MAT.snow); m.scale.setScalar(r); m.castShadow = m.receiveShadow = true; return m; };
  const base = ball(0.4), mid = ball(0.3), head = ball(0.21);
  // The two rolling balls start life as the base and the middle.
  const rollP = ball(0.12), rollQ = ball(0.1);
  [rollP, rollQ].forEach((b) => { b.visible = false; G.world.add(b); });
  const deco = new THREE.Group(); g.add(head); head.add(deco);
  const stone = G.shared({ color: '#2a2622', roughness: 0.6 });
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), stone); e.position.set(s * 0.33, 0.22, 0.86); deco.add(e); }
  for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.32, st = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), stone); st.position.set(Math.sin(a) * 0.55, -0.32 - Math.cos(a) * 0.12 + 0.12, 0.86 - Math.abs(a) * 0.1); deco.add(st); }
  // The nose is the sad lemon from the fridge. It volunteered.
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), G.shared({ color: '#e8c840', roughness: 0.55 })); nose.scale.set(0.8, 0.8, 1.25); nose.position.set(0, 0, 1.0); deco.add(nose);
  const brows = [];
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.38, 6), G.MAT.bark); b.rotation.z = Math.PI / 2 + s * 0.35; b.position.set(s * 0.34, 0.5, 0.82); deco.add(b); brows.push(b); }
  const arms = [];
  // Stick arms, in the middle ball's own units (radius 1).
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.85, 0.25, 0); a.rotation.z = -s * 1.0; mid.add(a); arms.push(a);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 2.2, 6), G.MAT.bark); st.position.y = 1.1; a.add(st);
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.7, 5), G.MAT.bark); tw.position.set(s * 0.18, 1.75, 0); tw.rotation.z = -s * 0.7; a.add(tw);
  }
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.17, 10, 24), G.std({ map: G.rep(G.TX.knitCream, 3, 1), color: '#6a7a8e', bumpMap: G.TX.knitB, bumpScale: 0.004, roughness: 1 }));
  scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.8; mid.add(scarf);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.08), scarf.material); tail.position.set(0.32, 0.25, 0.78); tail.rotation.set(0.25, 0, 0.2); mid.add(tail);
  const hat = new THREE.Mesh(new THREE.SphereGeometry(1.06, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), G.std({ map: G.rep(G.TX.knitCream, 2, 1), color: '#3a3d44', bumpMap: G.TX.knitB, bumpScale: 0.004, roughness: 1 }));
  hat.position.y = 0.12; head.add(hat);
  [base, mid].forEach((m) => g.add(m));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { g, base, mid, head, deco, nose, brows, arms, scarf, tail, hat, rollP, rollQ };
})();
function placeSnowman(d) {
  const M = SNOWMAN, y = G.floorAt(d.x, d.z);
  M.g.position.set(d.x, y, d.z); M.g.rotation.y = d.ry || 0; M.g.visible = true;
  M.base.position.set(0, d.R * 0.82, 0); M.base.scale.setScalar(d.R);
  M.mid.position.set(0, d.R * 1.55 + d.r * 0.75, 0); M.mid.scale.setScalar(d.r);
  M.head.position.set(0, M.mid.position.y + d.r * 0.8 + 0.17, 0); M.head.scale.setScalar(0.19);
  M.scarf.visible = M.tail.visible = d.deco === 'scarf'; M.hat.visible = d.deco === 'hat';
  if (!placeSnowman.coll) { placeSnowman.coll = true; G.addCollider({ x0: d.x - d.R * 0.75, z0: d.z - d.R * 0.75, x1: d.x + d.R * 0.75, z1: d.z + d.R * 0.75 }); }
  const it = A.findInter('snowman');
  if (it) it.pos = [d.x, 1, d.z]; else A.inter('snowman', [d.x, 1, d.z], 1.3, () => G.fmt(L.snowman.name || 'Snowman'), async () => {
    await N(cyc('snowman', [`(${L.snowman.name}. Lemon nose, stick arms, and eyebrows that make him look permanently surprised.)`, `(${L.snowman.name} keeps watch over the clearing. He has seen things.)`, '(You straighten one of his eyebrows. He looks no less alarmed.)']));
  });
}
const ROLL = { on: false };
function rollTick(dt) {
  if (!ROLL.on) return;
  const M = SNOWMAN, fx = Math.sin(PLAYER.yaw), fz = Math.cos(PLAYER.yaw);
  // Your ball: pushed along in front of you, picking up snow as it goes.
  const bx = PLAYER.x + fx * (0.32 + ROLL.R), bz = PLAYER.z + fz * (0.32 + ROLL.R);
  const moved = Math.hypot(bx - ROLL.px, bz - ROLL.pz);
  if (moved > 0.001) {
    if (onSnow(bx, bz) && G.walkable(bx, bz)) ROLL.R = Math.min(0.42, ROLL.R + moved * 0.035);
    const ax = new THREE.Vector3(fz, 0, -fx).normalize(); M.rollP.rotateOnWorldAxis(ax, moved / ROLL.R);
    if (Math.random() < moved * 3 && G.addFootprint) G.addFootprint(bx - fx * ROLL.R * 0.6, bz - fz * ROLL.R * 0.6, PLAYER.yaw, Math.random() < 0.5 ? 1 : 0, 1.6 + ROLL.R * 2);
  }
  ROLL.px = bx; ROLL.pz = bz;
  M.rollP.position.set(bx, G.floorAt(bx, bz) + ROLL.R * 0.85, bz); M.rollP.scale.setScalar(ROLL.R);
  // Hers grows too, off to one side, with a lot of effort.
  const q = PARTNER, qx = q.x + Math.sin(q.yaw) * (0.28 + ROLL.r), qz = q.z + Math.cos(q.yaw) * (0.28 + ROLL.r);
  if (q.speed > 0.1) ROLL.r = Math.min(0.31, ROLL.r + q.speed * dt * 0.02);
  if (!ROLL.lifting) { M.rollQ.position.set(qx, G.floorAt(qx, qz) + ROLL.r * 0.85, qz); M.rollQ.scale.setScalar(ROLL.r); }
  PLAYER.extraMul = 0.62;
  if (G.hit('KeyE', 'Space', 'Enter') && !G.busy()) {
    G.pressed.clear();
    if (ROLL.R < 0.3) G.hint('A bit bigger first. Keep rolling.', 2.5);
    else if (!onSnow(bx, bz) || !G.navOpen(bx, bz) || Math.hypot(bx - 6.5, bz - 2.3) < 7.5) G.hint('Somewhere flatter, away from the cabin and the path.', 3);
    else { ROLL.on = false; finishSnowman(bx, bz); }
  }
}
async function partnerRolls(token) {
  const p = PARTNER;
  while (ROLL.on && ROLL.token === token) {
    const a = Math.random() * Math.PI * 2, d = 2.2 + Math.random() * 1.5;
    let x = PLAYER.x + Math.sin(a) * d, z = PLAYER.z + Math.cos(a) * d;
    if (!G.navOpen(x, z) || !onSnow(x, z)) { await wait(0.4); continue; }
    await G.walkTo(p, x, z, 0.9);
    if (Math.random() < 0.3 && ROLL.on) G.bark(pick(['Mine is bigger. Spiritually.', 'Don’t look at mine. It’s a work in progress.', '*grunts*', 'This is harder than it looks!']), 2.2);
  }
}
async function startSnowman() {
  const p = PARTNER;
  if (!onSnow(PLAYER.x, PLAYER.z) || Math.hypot(PLAYER.x - 6.5, PLAYER.z - 2.3) < 7) { G.bark('Not here. Out in the open, where the snow’s good.', 2.6); return; }
  clearHands();
  ROLL.on = true; ROLL.token = (ROLL.token || 0) + 1; ROLL.R = 0.13; ROLL.r = 0.11; ROLL.px = PLAYER.x; ROLL.pz = PLAYER.z; ROLL.lifting = false;
  SNOWMAN.rollP.visible = SNOWMAN.rollQ.visible = true;
  S.flags.noTogether = true; S.flags.noInteract = true;
  p.mode = 'script';
  G.bark(pick(['A snowman! Yes. You do the bottom, I’ll do the middle.', 'Right. You roll the big one. I have a vision for the middle.']), 3);
  G.hint(`Walk to roll the snowball and make it bigger. ${G.MOBILE ? 'Use' : G.keyFor('interact')} to set it down.`, 6);
  partnerRolls(ROLL.token);
}
async function finishSnowman(bx, bz) {
  const M = SNOWMAN, p = PARTNER, R = ROLL.R;
  STATE.busy = true; PLAYER.extraMul = 1; ROLL.token++;
  p.script = null;
  const ry = Math.atan2(G.CAB ? 6.5 - bx : 0, 4 - bz);   // he faces the cabin
  // Her ball, carried over and set on top.
  const r = Math.max(0.22, ROLL.r);
  const sx = bx + Math.sin(ry + 1.4) * (R + 0.55), sz = bz + Math.cos(ry + 1.4) * (R + 0.55);
  await G.walkTo(p, sx, sz, 1.2);
  p.yaw = Math.atan2(bx - p.x, bz - p.z);
  STATE.sceneShot = true;
  const look = V(bx, G.floorAt(bx, bz) + R * 1.6, bz), cpos = V(bx + Math.sin(ry) * 3.2 + Math.cos(ry) * 1.2, look.y + 0.5, bz + Math.cos(ry) * 3.2 - Math.sin(ry) * 1.2);
  G.setShot(fixed(cpos, look, 42, 0.008));
  ROLL.lifting = true; p.forcePose = 'carry';
  const from = M.rollQ.position.clone(), to = V(bx, G.floorAt(bx, bz) + R * 1.55 + r * 0.75, bz);
  for (let t = 0; t <= 1.001; t += 1 / 30) { M.rollQ.position.lerpVectors(from, to, t).y += Math.sin(t * Math.PI) * 0.35; M.rollQ.scale.setScalar(r); await wait(1 / 30); }
  p.forcePose = null;
  M.rollP.visible = M.rollQ.visible = false;
  const d = { x: bx, z: bz, R, r, ry, deco: null, name: null };
  placeSnowman(d); M.head.visible = true; M.deco.visible = false;
  await Pt('*puffing* There. I lifted that. With my arms.', K());
  await N('(You pat together a head and set it on top. It is slightly too small. Somehow that makes it better.)', K());
  const c = await choose(['Give him the unclaimed scarf', 'Give him your hat', 'He’s perfect as he is']);
  d.deco = c === 0 ? 'scarf' : c === 1 ? 'hat' : null;
  if (c === 0) { await Pt('The free scarf! Finally, it belongs to somebody.', K()); addBond(0.3); }
  if (c === 1) { await Pt('Your hat? You’ll freeze. …It does suit him better.', K()); addRivalry(0.1); }
  if (c === 2) await Pt('Minimalist. Very bold.', K());
  placeSnowman(d);
  M.deco.visible = true; M.nose.visible = false; M.brows.forEach((b) => { b.visible = false; });
  await N('(Pinecone eyes, a smile of little stones. She steps back, studies him, and frowns.)', K());
  await Pt('He needs a nose. Wait there.', K());
  M.nose.visible = true; L.lemonGone = true;
  await N('(She produces the sad lemon from her coat pocket. You decide not to ask.)', K());
  M.brows.forEach((b) => { b.visible = true; });
  await Pt('And eyebrows. He looked far too calm.', K());
  const names = ['Sir Reginald', 'Gerald the Second', 'Kevin', 'Mr. Frost'];
  const nm = await choose(names.map((n) => `“${n}.”`));
  d.name = names[nm];
  await Pt(nm === 1 ? 'Gerald the Second. The bird will be furious. I love it.' : nm === 2 ? 'Kevin! Like the sheep. He’ll have a lot to live up to.' : `${names[nm]}. Yes. He has the bearing for it.`, K());
  L.snowman = d; placeSnowman(d);
  S.mem.snowman = 1; S.mem.affection++; addBond(0.6);
  addScrap('snowman', `${d.name}: lemon nose, stick arms, startled eyebrows.${d.deco === 'scarf' ? ' Wearing the free scarf.' : d.deco === 'hat' ? ' Wearing your hat.' : ''}`);
  if (d.deco === 'hat') { L.hatGiven = true; G.setDressed(PLAYER, PLAYER.dressed); }   // he's wearing it now
  await wait(0.6);
  STATE.sceneShot = false; G.releaseCamera(); STATE.busy = false;
  S.flags.noTogether = false; S.flags.noInteract = false; p.mode = 'follow';
}
G.TOGETHER_EXTRA.push({ id: 'snowman', t: 'Build a snowman', when: (c) => c.out && c.snowy && !c.seated && !L.snowman && !ROLL.on && !PLAYER.carry, run: startSnowman });

/* =====================================================================
 * Snow angels
 * ===================================================================== */
const ANGELS = (() => {
  const tex = G.canvasTex(0, null, { w: 256, h: 320, draw: (c, w, h) => {
    c.clearRect(0, 0, w, h); c.filter = 'blur(5px)'; c.fillStyle = 'rgb(153,168,201)';
    c.beginPath(); c.arc(w / 2, 40, 26, 0, 7); c.fill();   // head
    c.beginPath(); c.moveTo(w / 2 - 22, 66); c.lineTo(w / 2 + 22, 66); c.lineTo(w / 2 + 44, 230); c.lineTo(w / 2 - 44, 230); c.fill();   // body
    // Wings: the fan the arms swept, and the skirt the legs made.
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(w / 2 + s * 18, 80); c.arc(w / 2 + s * 18, 80, 108, s < 0 ? Math.PI * 0.82 : -Math.PI * 0.18, s < 0 ? Math.PI * 1.18 : Math.PI * 0.18); c.closePath(); c.fill(); }
    c.beginPath(); c.moveTo(w / 2, 170); c.arc(w / 2, 170, 140, Math.PI * 0.3, Math.PI * 0.7); c.closePath(); c.fill();
    c.filter = 'none';
  } });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mat = G.std({ map: tex, roughness: 0.75, env: 0.7, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const geo = new THREE.PlaneGeometry(1.7, 2.05); geo.rotateX(-Math.PI / 2);
  return [0, 1].map(() => { const m = new THREE.Mesh(geo, mat); m.visible = false; m.renderOrder = 2; m.receiveShadow = true; G.world.add(m); return m; });
})();
function lieInSnow(c, x, z, look) {
  c.script = null; c.slide = null; c.sitTarget = c.sit = 0; c.speed = 0; c.nav = null;
  c.lie = true; c.x = x; c.z = z + 0.8; c.lieY = G.floorAt(x, z) + 0.11; c.y = c.lieY; c.lieRoll = 0; c.lieLook = look; c.lieTilt = 0.03; c.yaw = 0; c.angel = true;
}
async function snowAngels() {
  const p = PARTNER;
  const rx = 1.3, x0 = PLAYER.x, z0 = PLAYER.z;
  const okAt = (x, z) => onSnow(x, z) && G.navOpen(x, z) && G.navOpen(x, z - 0.9) && G.navOpen(x, z + 0.9);
  const side = okAt(x0 + rx, z0) ? 1 : okAt(x0 - rx, z0) ? -1 : 0;
  if (!okAt(x0, z0) || !side) { G.bark('Not here. Somewhere with lots of fresh snow.', 2.6); return; }
  clearHands(); STATE.busy = true;
  G.bark(pick(['Snow angels! Lie down. Go on. It’s tradition.', 'On your back, {toHim}. Arms out.']), 2.6);
  await wait(1);
  const px = x0 + side * rx, y = G.floorAt(x0, z0);
  STATE.sceneShot = true;
  await G.cutTo(() => {
    lieInSnow(PLAYER, x0, z0, side * 0.35); lieInSnow(p, px, z0, -side * 0.35); p.mode = 'lying';
    const mx = (x0 + px) / 2;
    G.setShot(fixed(V(mx, y + 3.6, z0 + 0.55), V(mx, y, z0 - 0.1), 50, 0.004));
  });
  await wait(1.6);
  await N('(Flat on your backs in the snow, sweeping your arms and legs like a pair of very determined beetles.)', K());
  await Pt('Flap properly, {toHim}. You’re doing a starfish.', K());
  await Y('This is how angels flap.', K());
  await Pt('Have you ever seen an angel?', K());
  await Y('I’m looking at one.', K());
  await wait(0.4);
  PLAYER.angel = p.angel = false;
  await Pt('…That was shameless. Do it again.', K());
  await N('(For a while you just lie there, side by side, watching the snow come down out of nowhere.)', K());
  await wait(1.2);
  await G.cutTo(() => {
    [[x0, 0], [px, 1]].forEach(([x, i]) => { const m = ANGELS[i]; m.position.set(x, G.floorAt(x, z0) + 0.024, z0 - 0.08); m.visible = true; });
    for (const c of [PLAYER, p]) { c.lie = false; c.angel = false; c.lieTilt = null; }
    G.standAt(PLAYER, x0 - side * 0.4, z0 + 1.35, Math.PI); G.standAt(p, px + side * 0.4, z0 + 1.35, Math.PI);
    PLAYER.snowAcc = Math.min(1, (PLAYER.snowAcc || 0) + 0.5); p.snowAcc = Math.min(1, (p.snowAcc || 0) + 0.5);
    p.mode = 'follow';
    const mx = (x0 + px) / 2;
    G.setShot(fixed(V(mx, y + 2.1, z0 + 3.4), V(mx, y + 0.2, z0 - 0.3), 46, 0.006));
  });
  await Pt(pick(['Look at us. Two perfectly respectable angels.', 'Yours has enormous wings. Mine is concentrated.']), K());
  S.mem.angels = (S.mem.angels || 0) + 1; S.mem.affection++; addBond(S.mem.angels === 1 ? 0.6 : 0.1);
  addScrap('angels', 'Two snow angels side by side. One with enormous wings; one concentrated.');
  STATE.sceneShot = false; G.releaseCamera(); STATE.busy = false;
}
G.TOGETHER_EXTRA.push({ id: 'angels', t: 'Make snow angels', when: (c) => c.out && c.snowy && !c.seated && !PLAYER.carry && !ROLL.on, run: snowAngels });

/* =====================================================================
 * Cocoa
 * ===================================================================== */
function mugFor(m, col) {
  const u = m.userData, k = u.k, g = new THREE.Group(); g.position.set(0.0, -0.13 * k, 0.2 * k); g.visible = false; g.userData.warm = true; u.chest.add(g);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.095, 16), G.shared({ color: col, roughness: 0.3, env: 0.8 })); g.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.004, 14), G.shared({ color: '#5a321e', roughness: 0.25 })); top.position.y = 0.043; g.add(top);
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 6, 12, Math.PI), body.material); h.position.set(0.045, 0, 0); h.rotation.z = -Math.PI / 2; g.add(h);
  g.traverse((o) => { o.userData.warm = true; o.userData.gear = true; o.castShadow = true; });   // gear: kept when the built-in body is hidden for the real one
  return g;
}
const MUGS = { player: mugFor(G.KIDS ? G.KIDS.adults.player : PLAYER.m, '#8a3a2e'), partner: mugFor(G.KIDS ? G.KIDS.adults.partner : PARTNER.m, '#efe7da') };
const COCOA = { t: 0 };
function setMug(c, on) {
  const m = c === PLAYER ? MUGS.player : MUGS.partner; m.visible = on;
  c.holdPose = on ? 'cup' : (c.holdPose === 'cup' ? null : c.holdPose);
  const id = c === PLAYER ? 'cocoaY' : 'cocoaP';
  if (on) { const w = m.getWorldPosition(new THREE.Vector3()); G.steam(id, w.x, w.y + 0.06, w.z, { rate: 1.2, dur: 999, size: 0.45 }); } else G.steam(id, 0, 0, 0, { off: true });
}
G.setMug = (c, on) => setMug(c, on);
function cocoaTick(dt) {
  for (const [c, m, id] of [[PLAYER, MUGS.player, 'cocoaY'], [PARTNER, MUGS.partner, 'cocoaP']]) {
    if (!m.visible) continue;
    const w = m.getWorldPosition(new THREE.Vector3()); G.steamMove(id, w.x, w.y + 0.06, w.z);
    if (c.carry || c.lie || c.angel || PARTNER.task && c === PARTNER && PARTNER.task.o.id !== 'nap' && PARTNER.task.o.id !== 'read') setMug(c, false);
  }
  if (COCOA.t > 0) { COCOA.t -= dt; if (COCOA.t <= 0) { if (MUGS.partner.visible) { setMug(PARTNER, false); if (!G.busy()) G.bark(pick(['*sets down her empty mug, very satisfied*', 'That was the best cocoa of my life. Don’t tell the last one.']), 2.6); } setMug(PLAYER, false); } }
}
const kettle = A.findInter('kettle'), teaAct = kettle.raw, teaLabel = kettle.label;
kettle.label = () => (A.morning() && !S.flags.teaMade ? teaLabel() : L.cocoaCh !== S.chapter ? 'Make cocoa' : 'Kettle');
A.rewire('kettle', async () => {
  if (A.morning() && !S.flags.teaMade) return teaAct();
  if (L.cocoaCh === S.chapter) { await N('(The pan’s still warm, with a ring of cocoa in it that you’ll deal with later.)'); return; }
  if (PLAYER.carry) { await N('(Not with your arms full of logs.)'); return; }
  L.cocoaCh = S.chapter;
  await N('(Milk in the little pan, two big spoons of cocoa, and a pinch of salt, because she swears by it.)');
  G.Audio.sizzle(true);
  const [warm] = await G.UI.hold({ title: 'Warm the milk', sub: G.MOBILE ? 'Press and hold. Take it off before it boils.' : 'Hold E or Space. Take it off before it boils.', zone: [0.6, 0.8], speed: 0.85, labels: ['Barely warm.', 'Warm enough.', 'Just steaming.'], over: 'It boiled over. Mostly onto the hob.' });
  const [stir] = await G.UI.rhythm({ title: 'Stir in the cocoa', labels: ['Lumpy.', 'Drinkable.', 'Velvety.'], fast: 'Slower, or it’ll go everywhere…', slow: 'Keep stirring…', onTap: () => { for (let i = 0; i < 2; i++) G.Audio.tone(700 + Math.random() * 500, 0.02, 0.01, i * 0.05); } });
  const sc = [warm, stir, stir];
  G.Audio.sizzle(false);
  const q = sc.reduce((a, b) => a + b, 0) / sc.length;
  await N(q > 0.7 ? '(Two mugs of cocoa so smooth it’s almost suspicious.)' : q > 0.38 ? '(Two mugs of cocoa. A few heroic lumps, but cocoa.)' : '(Two mugs of something cocoa-adjacent. Mostly warm.)');
  setMug(PLAYER, true); COCOA.t = 120;
  // She comes for hers.
  const p = PARTNER;
  if (!p.hidden && !p.lie && p.mode !== 'script' && (A.canHear() || dist() < 9)) {
    clearHands(); G.wake && G.wake();
    if (p.sit > 0.2) { p.sitTarget = 0; await wait(0.5); }
    G.bark('Is that cocoa? Is one of those mine?', 2.2);
    await G.walkTo(p, PLAYER.x + Math.cos(PLAYER.yaw) * 0.6 + Math.sin(PLAYER.yaw) * 0.5, PLAYER.z - Math.sin(PLAYER.yaw) * 0.6 + Math.cos(PLAYER.yaw) * 0.5, 1.5);
    p.yaw = Math.atan2(PLAYER.x - p.x, PLAYER.z - p.z);
    setMug(p, true);
    await Pt(q > 0.7 ? 'Oh. Oh, that’s perfect. Marry me again.' : q > 0.38 ? 'The lumps are my favourite part. Thank you, {dear}.' : 'It’s warm, and you made it. That’s the whole recipe.');
    S.mem.affection++; addBond(0.4);
    if (!S.flags.cocoaScrap) { S.flags.cocoaScrap = 1; addScrap('cocoa', q > 0.38 ? 'Cocoa, with a pinch of salt (she swears by it).' : 'Cocoa-adjacent. Drunk anyway, every drop.'); }
  }
});
A.REACT.kettle.lines.push('Cocoa? You read my mind.');

/* =====================================================================
 * Reading together on the sofa
 * ===================================================================== */
const myBook = (() => {
  const u = (G.KIDS ? G.KIDS.adults.player : PLAYER.m).userData, k = u.k, g = G.PARTNER_BOOK.clone(); g.position.set(0, -0.12 * k, 0.23 * k); g.rotation.x = -0.75; g.visible = false; g.traverse((o) => { o.userData.warm = true; }); u.chest.add(g);
  g.children.forEach((c, i) => { if (i % 2 === 0) c.material = G.std({ color: '#7a3a2a', roughness: 0.8 }); });
  return g;
})();
// A book held open between the real model's hands, facing the reader's eyes. (On the chest, where the built-in
// body would have held it, it floated small by the real one's elbow.)
const HANDS = new WeakMap();
function handsOf(m) {
  if (HANDS.has(m)) return HANDS.get(m);
  const model = m.userData.retarget && m.userData.retarget.model; if (!model) return null;
  const by = {}; model.traverse((o) => { if (o.isBone) by[o.name.replace(/[^A-Za-z0-9]/g, '')] = o; });
  const r = by.mixamorigLeftHand && by.mixamorigRightHand && by.mixamorigHead ? { L: by.mixamorigLeftHandMiddle1 || by.mixamorigLeftHand, R: by.mixamorigRightHandMiddle1 || by.mixamorigRightHand, head: by.mixamorigHead } : null;
  HANDS.set(m, r); return r;
}
const _bk = { l: new THREE.Vector3(), r: new THREE.Vector3(), h: new THREE.Vector3(), x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), pq: new THREE.Quaternion() };
function bookInHands(m, g) {
  if (!g.visible || !g.parent) return;
  const H = handsOf(m); if (!H) return;
  if (!g.userData.chestPose) g.userData.chestPose = [g.position.clone(), g.quaternion.clone()];
  const B = _bk; H.L.getWorldPosition(B.l); H.R.getWorldPosition(B.r); H.head.getWorldPosition(B.h);
  const mid = B.l.clone().add(B.r).multiplyScalar(0.5);
  B.x.subVectors(B.l, B.r); const span = B.x.length(); if (span < 1e-3) return; B.x.divideScalar(span);
  B.y.subVectors(B.h, mid).normalize(); B.y.addScaledVector(B.x, -B.y.dot(B.x)).normalize();   // the open pages face the eyes
  B.z.crossVectors(B.x, B.y);
  B.m.makeBasis(B.x, B.y, B.z); B.q.setFromRotationMatrix(B.m);
  g.parent.updateMatrixWorld(true); g.parent.getWorldQuaternion(B.pq);
  g.quaternion.copy(B.pq.invert().multiply(B.q));
  g.position.copy(g.parent.worldToLocal(mid.addScaledVector(B.y, 0.015)));
  const ps = new THREE.Vector3(); g.parent.getWorldScale(ps);
  g.scale.setScalar(clamp(span / 0.19, 1.1, 1.35) / (ps.x || 1));   // spread across both hands
}
// A mug, upright, cradled between the real hands.
function cupInHands(m, g) {
  if (!g.visible || !g.parent) return;
  const H = handsOf(m); if (!H) return;
  const B = _bk; H.L.getWorldPosition(B.l); H.R.getWorldPosition(B.r);
  const mid = B.l.clone().add(B.r).multiplyScalar(0.5);
  B.x.subVectors(B.l, B.r); B.x.y = 0; if (B.x.lengthSq() < 1e-6) return; B.x.normalize();
  B.y.set(0, 1, 0); B.z.crossVectors(B.x, B.y);
  B.m.makeBasis(B.x, B.y, B.z); B.q.setFromRotationMatrix(B.m);
  g.parent.updateMatrixWorld(true); g.parent.getWorldQuaternion(B.pq);
  g.quaternion.copy(B.pq.invert().multiply(B.q));
  g.position.copy(g.parent.worldToLocal(mid.add(new THREE.Vector3(0, 0.01, 0))));
  const ps = new THREE.Vector3(); g.parent.getWorldScale(ps); g.scale.setScalar(0.95 / (ps.x || 1));   // a real mug's size, whatever the rig's scale
}
G.LATE.add(() => {
  const pm = G.KIDS ? G.KIDS.adults.player : PLAYER.m, qm = G.KIDS ? G.KIDS.adults.partner : PARTNER.m;
  bookInHands(pm, myBook); bookInHands(qm, G.PARTNER_BOOK); cupInHands(pm, MUGS.player); cupInHands(qm, MUGS.partner);
});
const BOOKS = [
  { t: 'A Field Guide to Winter Birds', cap: 'Reading about bullfinches. (It was about Gerald, really.)', run: async () => {
    await Y('“The bullfinch is a bird of fixed habits and few words, and will return to a favoured sill for years.”', K());
    await Pt('That’s Gerald. That is Gerald exactly.', K());
    await Y('“It is not known to sing.”', K());
    await Pt('He hums. Privately. Read the owl one.', K());
    await Y('“The tawny owl does not, in fact, say ‘twit-twoo’. That is two owls, one calling and one answering.”', K());
    await Pt('…Oh. I like that very much. One calling, and one answering.', K());
  } },
  { t: 'The Lighthouse Keeper’s Cat', cap: 'The Lighthouse Keeper’s Cat, chapter one, twice.', run: async () => {
    await Y('“The lighthouse keeper had one rule: the lamp was lit at dusk, every dusk, without fail. The cat had a different rule.”', K());
    await Pt('What was the cat’s rule?', K());
    await Y('“That the keeper was not to leave the warm chair until the cat said so.”', K());
    await Pt('The cat has priorities. I respect the cat.', K());
    await Y('“For eleven years he lit the lamp four minutes early. Nobody ever told him the clock was fast.”', K());
    await Pt('…Wait. Did you write this? Is this about us?', K());
    await Y('It’s a very old book.', K());
    await Pt('Hm. Suspicious.', K());
  } },
  { t: 'One of the six identical cookbooks', cap: 'Read a cookbook aloud. Found her notes in the margins.', run: async () => {
    await Y('“Pancakes. Serves four.”', K());
    await Pt('Serves two. Generously.', K());
    await Y('“Step one: heat a heavy pan.”', K());
    await Pt('Step two: the first pancake goes to {toHim}, as a tax.', K());
    await Y('That isn’t in the book.', K());
    await Pt('It’s in the margin. In pencil. I wrote it years ago. Check the other five copies.', K());
  } },
];
const shelf = A.findInter('shelf10.72'), browse = shelf.raw;
shelf.label = () => 'Bookshelf';
A.rewire('shelf10.72', async () => {
  const p = PARTNER;
  if (PLAYER.carry || p.lie || p.hidden || !A.canHear() || S.chapter === 'prologue') return browse();
  const c = await choose(['Read something together', 'Just browse']);
  if (c === 1) return browse();
  const b = await choose(BOOKS.map((x) => x.t));
  await readTogether(BOOKS[b]);
});
async function readTogether(book) {
  const p = PARTNER, So = G.SOFA;
  clearHands();
  STATE.sceneShot = true;
  await G.cutTo(() => {
    for (const [c, x] of [[PLAYER, So.x + 0.35], [p, So.x - 0.25]]) { c.x = x; c.z = So.z - 0.08; c.y = c.yFloor = 0; c.yaw = Math.PI; c.seatY = So.seatY; c.sitTarget = 1; c.sit = 1; c.speed = 0; c.script = null; c.nav = null; }
    p.mode = 'seated'; myBook.visible = true; PLAYER.holdPose = 'read';
    if (MUGS.partner.visible) setMug(p, false);
    G.setShot(() => { const pos = V(So.x + 0.95, 1.2, So.z - 1.5), look = V(So.x + 0.08, 0.95, So.z - 0.05); return { pos, look, fov: 36, focus: pos.distanceTo(look), aperture: 0.012 }; });
  });
  p.tiltTarget = -0.3; p.leanTarget = 0.1;
  await N(`(${book.t}. She tucks her feet under her and her head against your arm.)`, K());
  await Pt('Do the voices.', K());
  await book.run();
  p.lidsClosed = true;
  await N('(Somewhere in the second chapter, her head finds your shoulder and stays there. You keep reading anyway, quieter, for no one in particular.)', K());
  await wait(1.5);
  S.mem.reads = (S.mem.reads || 0) + 1; S.mem.affection++; addBond(0.5);
  addScrap('reading', book.cap);
  await G.cutTo(() => {
    p.tiltTarget = p.tilt = 0; p.leanTarget = p.lean = 0; p.lidsClosed = false;
    myBook.visible = false; PLAYER.holdPose = null;
    G.placeChar(PLAYER, So.x + 1.55, So.z - 0.1, -Math.PI / 2 - 0.4); G.placeChar(p, So.x - 1.55, So.z - 0.1, Math.PI / 2 + 0.4);
    for (const c of [PLAYER, p]) { c.sitTarget = c.sit = 0; }
    p.mode = 'follow'; p.nav = null;
    STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true;
  }, 0.3);
  G.bark('Mm. Did I miss the ending?', 2.4);
}

/* =====================================================================
 * Cards at the kitchen table (higher or lower), and her sleeve
 * ===================================================================== */
const SUITS = ['♥', '♦', '♣', '♠'], RANKS = ['', 'ace', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king'];
const SUIT_N = { '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs', '♠': 'spades' };
const CARDS = (() => {
  const mk = (x, z, ry) => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 90;
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.063, 0.088), G.std({ map: t, roughness: 0.6, env: 0.4 }));
    m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x, 0.768, z); m.visible = false; G.world.add(m);
    return { m, cv, t };
  };
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.02, 0.09), G.shared({ color: '#2a4a6a', roughness: 0.6 })); deck.position.set(13.18, 0.775, 2.92); deck.rotation.y = 0.2; deck.visible = false; G.world.add(deck);
  return { deck, mine: mk(12.98, 2.66, 0.1), hers: mk(12.85, 3.22, Math.PI - 0.15) };
})();
function drawCard(slot, card) {
  const c = slot.cv.getContext('2d');
  c.fillStyle = '#fbf8f1'; c.fillRect(0, 0, 64, 90); c.strokeStyle = '#c8bca8'; c.lineWidth = 2; c.strokeRect(2, 2, 60, 86);
  const red = card.s === '♥' || card.s === '♦';
  c.fillStyle = red ? '#b8322a' : '#1e1a18'; c.textAlign = 'center';
  c.font = 'bold 22px Georgia, serif'; c.fillText(['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][card.v], 16, 26);
  c.font = '40px Georgia, serif'; c.fillText(card.s, 34, 66);
  slot.t.needsUpdate = true; slot.m.visible = true;
}
const deal = () => ({ v: 1 + Math.floor(Math.random() * 13), s: pick(SUITS) });
const nameOf = (c) => `${RANKS[c.v]} of ${SUIT_N[c.s]}`;
const ktable = A.findInter('ktable'), tableAct = ktable.raw, tableLabel = ktable.label;
const cardsOK = () => !PARTNER.lie && !PARTNER.hidden && !PLAYER.carry && S.chapter !== 'prologue' && A.canHear() && !(A.morning() && S.flags.pancakesMade && !S.flags.breakfastDone);
A.rewire('ktable', async () => {
  if (!cardsOK()) return tableAct();
  const c = await choose(['Play cards with {P}', 'Look at the table']);
  if (c === 1) return tableAct();
  await cards();
});
async function cards() {
  const p = PARTNER, Kc = G.KITCHEN.chairs;
  clearHands();
  STATE.sceneShot = true;
  await G.cutTo(() => {
    G.sitAt(p, Kc.A.x, Kc.A.z, Kc.A.yaw, Kc.A.seatY); p.mode = 'seated';
    G.sitAt(PLAYER, Kc.C.x, Kc.C.z, Kc.C.yaw, Kc.C.seatY);
    CARDS.deck.visible = true;
    G.setShot(fixed(V(11.35, 1.45, 2.55), V(12.95, 0.95, 2.98), 46, 0.01));
  });
  await Pt('Higher or lower. Three each. Loser does the washing up.', K());
  await Y('You always lose and never do the washing up.', K());
  await Pt('Which is why I intend to win.', K());
  let mine = 0, cur = deal();
  drawCard(CARDS.mine, cur);
  for (let i = 0; i < 3; i++) {
    await N(`(The ${nameOf(cur)}.)`, K());
    const g = await choose(['Higher', 'Lower']);
    let nx = deal(); while (nx.v === cur.v) nx = deal();
    drawCard(CARDS.mine, nx); G.Audio.flip();
    const ok = g === 0 ? nx.v > cur.v : nx.v < cur.v;
    if (ok) mine++;
    await N(`(The ${nameOf(nx)}. ${ok ? 'Right.' : 'Wrong.'})`, K());
    if (i === 1) await Pt(ok ? 'Beginner’s luck. You’ve been a beginner for years.' : 'Oh, dear. Oh, dear, oh, dear.', K());
    cur = nx;
  }
  await Pt('My turn. Watch closely. Not too closely.', K());
  let hers = 0; let hc = deal(); drawCard(CARDS.hers, hc);
  for (let i = 0; i < 2; i++) { let nx = deal(); while (nx.v === hc.v) nx = deal(); const ok = Math.random() < 0.6; if (ok) hers++; drawCard(CARDS.hers, nx); G.Audio.flip(); await Pt(ok ? pick(['Higher. …Yes!', 'Lower. Obviously.']) : pick(['Higher— no. Bother.', 'That card is lying.']), K()); hc = nx; }
  // The last one, she gets right. Very right.
  hers++;
  await Pt('Lower. And— oh, look. A queen. Lovely. Correct.', K());
  await N('(As she reaches for the deck, a second queen slides out of her sleeve and lands face up on the table.)', K());
  const call = await choose(['“{toHer}.”', 'Say nothing']);
  S.mem.cards = (S.mem.cards || 0) + 1;
  if (call === 0) {
    addRivalry(0.6);
    await Pt('That card was there when I sat down. It’s circumstantial.', K());
    await Y('It was in your sleeve.', K());
    await Pt('…Best of five?', K());
    hers--;
  } else {
    addBond(0.5);
    await N('(You say nothing. She looks so pleased with herself that you decide it was fair.)', K());
  }
  await N(hers > mine ? '(She wins. You are doing the washing up.)' : hers < mine ? '(You win. She is doing the washing up, in theory.)' : '(A draw. Nobody does the washing up. It’s a snow day.)', K());
  addScrap('cards', call === 0 ? 'Cards at the kitchen table. A queen fell out of her sleeve. (Circumstantial.)' : 'Cards at the kitchen table. She won. (There may have been a queen in her sleeve.)');
  await G.cutTo(() => {
    CARDS.deck.visible = CARDS.mine.m.visible = CARDS.hers.m.visible = false;
    G.standAt(PLAYER, 13.0, 1.75, Math.PI); G.standAt(p, 12.4, 4.05, Math.PI); p.mode = 'follow'; p.nav = null;
    STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true;
  }, 0.3);
}

/* ---------- the lemon, gone to a better place ---------- */
const fridge = A.findInter('fridge'), fridgeAct = fridge.raw;
A.rewire('fridge', async () => {
  if (S.photos.length && !S.flags.fridgePhotos) { S.flags.fridgePhotos = 1; await N('(Your photographs are up on the fridge door already, pinned by the magnets, a little crooked.)'); return; }
  if (L.lemonGone && !S.flags.lemonNoted) { S.flags.lemonNoted = 1; await N('(The lemon is gone. It has a new career, outside, as a nose.)'); return; }
  return fridgeAct();
});

/* ---------- ticking, and putting things back after loading a save ---------- */
const prevLoad = G.onLoadSave;
G.onLoadSave = (s) => { if (prevLoad) prevLoad(s); refreshFridge(); if (L.snowman) placeSnowman(L.snowman); };
const prevQuiet = G.onQuiet;
G.onQuiet = () => { if (prevQuiet) prevQuiet(); setMug(PLAYER, false); setMug(PARTNER, false); COCOA.t = 0; myBook.visible = false; if (ROLL.on) { ROLL.on = false; SNOWMAN.rollP.visible = SNOWMAN.rollQ.visible = false; PLAYER.extraMul = 1; } };
G.STEP_HOOKS.push((dt) => { rollTick(dt); cocoaTick(dt); });
G.wake = () => { if (PARTNER.dozing) { PARTNER.dozing = false; PARTNER.lidsClosed = false; PARTNER.tiltTarget = 0; PARTNER.headDown = 0; } };
});
