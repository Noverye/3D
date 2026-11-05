'use strict';
/* =========================================================================
 * Story, Act I ("Shared Life"), ported from the 2D game:
 * prologue (the lantern fair, as children) → a snowed-in morning in the
 * cabin → (the walk: next stage) → the evening at home.
 * Also: hidden relationship values, memories, the scrapbook, checkpoints,
 * the house's small interactions, Partner's own habits and Together.
 * ========================================================================= */
// Runs once the world is built (boot waits for any real assets first; see assets.js).
(G.afterBuild = G.afterBuild || []).push(() => {
const { PLAYER, PARTNER, STATE } = G;
const P = (t, o) => G.say('partner', t, o);
const Y = (t, o) => G.say('player', t, o);
const N = (t, o) => G.say(null, t, o);
const choose = (o) => G.UI.choose(o);
const wait = (s) => G.wait(s);
const until = (f) => G.until(f);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const dist = () => Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
const near = (r = 6) => dist() < r && !PARTNER.hidden;

/* ---------- state: what the two of you have done, and how it's going ---------- */
const fresh = () => ({
  chapter: null,
  vars: { bond: 0, trust: 0, rivalry: 0, fear: 0 },
  mem: { hugs: 0, holds: 0, teases: 0, kisses: 0, fridge: 0, foodStolen: 0, foodShared: 0, snacks: 0, sitBeside: 0, sitAcross: 0, affection: 0, partnerInit: 0 },
  flags: {}, scrap: [], talked: {}, n: {}, reacted: {}, photos: [], life: {},
});
const S = (G.S = fresh());
const addBond = (v) => { S.vars.bond = Math.min(12, S.vars.bond + v); };
const addRivalry = (v) => { S.vars.rivalry = Math.min(12, S.vars.rivalry + v); };
const addScrap = (art, caption) => { if (!S.scrap.some((p) => p.art === art)) S.scrap.push({ art, caption }); G.remember && G.remember('scrap', { art, caption }); };
// Successive lines for repeated interactions; the last one repeats.
const cyc = (id, lines) => { S.n[id] = (S.n[id] || 0) + 1; return lines[Math.min(S.n[id] - 1, lines.length - 1)]; };

const SAVE_KEY = 'cbs.base.save';
// Every story flag is kept in a save (what the night and Act IV remember: whether it kept her, the sign she
// left, whether it withdrew...), except the ones that only mean something while a scene is playing.
const PASSING = new Set(['inInter', 'inBedScene', 'reuniting', 'noTogether', 'noBarks', 'gateArmed0', 'ending']);
function saveFlags() { const o = {}; for (const [k, v] of Object.entries(S.flags)) if (!PASSING.has(k) && (v === null || ['boolean', 'number', 'string'].includes(typeof v))) o[k] = v; return o; }
function checkpoint(chapter) {
  S.chapter = chapter;
  const data = { v: 1, chapter, vars: S.vars, mem: S.mem, scrap: S.scrap, talked: S.talked, flags: saveFlags(), life: S.life, photos: S.photos };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {
    // Photographs are the big part; if storage is full, keep the story and drop the oldest pictures.
    try { data.photos = S.photos.slice(-3); localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e2) { /* private mode */ }
  }
}
function loadSave() { try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); return d && d.v === 1 && CH[d.chapter] ? d : null; } catch (e) { return null; } }
// After every story file has registered its chapters (a save from the night or Act IV needs them to be known).
setTimeout(() => { if (loadSave()) G.$('continue').hidden = false; }, 0);

/* ---------- house state: lamps, fire, cake, breakfast, the bed ---------- */
const K = () => G.KITCHEN;
function setLamps(on) { G.LAMPS.forEach((L) => { L.on = on; }); }
// Hide the cake's meshes, never its group: the candle light inside it must stay in the scene, or every
// lit material recompiles for the new light count (a long stall).
function setCake(show, lit = show) { G.CAKE.shown = show; G.CAKE.g.children.forEach((o) => { if (!o.isLight) o.visible = show; }); G.CAKE.lit = lit; }
function setBreakfast(o = {}) {
  const k = K();
  k.mugs.forEach((m) => { m.visible = !!o.mugs; });
  k.plates.forEach((pl, i) => {
    const show = !!o.plates && (i === 0 || i === (o.seat === 'C' ? 2 : 1));
    pl.g.visible = show;
    pl.stack.forEach((c, j) => { c.material = o.burnt && j === 0 ? pl.burntMat : pl.cakeMat; c.visible = !(o.bite && i !== 0 && j === 2); });
  });
}
function houseFor(chapter) {
  if (G.Audio.radioOn && G.Audio.radioOn()) G.Audio.radio(false);
  if (K().radioDial) K().radioDial.material.opacity = 0;
  for (const id of ['kettle', 'mug0', 'mug1', 'pan', 'plate0', 'plate1']) G.steam(id, 0, 0, 0, { off: true });
  if (chapter === 'morning') {
    setLamps(false); G.FIRE.on = false; setCake(false); setBreakfast({});
    G.bedMade(false); G.shapeBed({ L: true, R: true });
    STATE.autonomy = false;
  } else {
    setLamps(true); G.FIRE.on = true; setCake(true); setBreakfast({});
    G.bedMade(true); STATE.autonomy = false;
  }
}

/* ---------- a small fair: lanterns on strings and two stalls, for the prologue ---------- */
const FAIR = { meshes: [], spots: [] };
(function buildFair() {
  const W = G.world, glow = new THREE.MeshBasicMaterial({ map: G.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 });
  const cols = ['#ffb35a', '#ff8a4a', '#ffd9a0', '#ff6a5a'].map((c) => new THREE.MeshBasicMaterial({ color: c }));
  const wire = G.std({ color: '#2a2420', roughness: 0.8 });
  const add = (m) => { m.userData.dynamic = true; W.add(m); FAIR.meshes.push(m); return m; };
  const poles = [[1.5, 17.2], [5.2, 18.4], [8.8, 18.2], [12.2, 17.0]];
  for (const [x, z] of poles) { const y = G.terrainH(x, z); const m = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.1, 8), G.std({ map: G.TX.bark, color: '#6a4a36', roughness: 0.9 }))); m.position.set(x, y + 1.55, z); m.castShadow = true; }
  const lanG = new THREE.SphereGeometry(0.13, 12, 8), glowG = new THREE.PlaneGeometry(1.1, 1.1);
  for (let i = 0; i < poles.length - 1; i++) {
    const [ax, az] = poles[i], [bx, bz] = poles[i + 1], ay = G.terrainH(ax, az) + 2.95, by = G.terrainH(bx, bz) + 2.95;
    const n = 7;
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ay + (by - ay) * t - Math.sin(t * Math.PI) * 0.55;
      if (k > 0 && k < n) {
        const l = add(new THREE.Mesh(lanG, cols[(i * 3 + k) % cols.length])); l.position.set(x, y - 0.14, z); l.scale.set(1, 1.25, 1);
        const g = add(new THREE.Mesh(glowG, glow)); g.position.set(x, y - 0.14, z); g.userData.billboard = true;
        if (k === 3) FAIR.spots.push({ x, y: y - 0.3, z, i: 5, color: '#ffa860' });
      }
      if (k < n) { const x2 = ax + (bx - ax) * (k + 1) / n, z2 = az + (bz - az) * (k + 1) / n, y2 = ay + (by - ay) * (k + 1) / n - Math.sin((k + 1) / n * Math.PI) * 0.55; const len = Math.hypot(x2 - x, y2 - y, z2 - z); const w = add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, len, 4), wire)); w.position.set((x + x2) / 2, (y + y2) / 2, (z + z2) / 2); w.lookAt(x2, y2, z2); w.rotateX(Math.PI / 2); }
    }
  }
  // Two stalls with striped awnings.
  const stripe = G.canvasTex(0, null, { w: 128, h: 32, draw: (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#efe4d0' : '#b5413a'; c.fillRect(i * w / 8, 0, w / 8, h); } } });
  const awnM = G.std({ map: stripe, roughness: 0.9 }), woodM = G.std({ map: G.TX.boards, color: '#7a5a42', roughness: 0.8 });
  // Inside the path's fence, one on each side, so you can walk up to them.
  FAIR.stalls = [[G.pathX(16.2) - 1.6, 16.2, 0.12], [G.pathX(16.0) + 1.6, 16.0, -0.12]];
  for (const [x, z, ry] of FAIR.stalls) {
    const y = G.terrainH(x, z), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.userData.dynamic = true; W.add(g); g.scale.set(0.78, 1, 1);
    FAIR.coll = (FAIR.coll || []).concat({ x0: x - 0.72, z0: z - 0.4, x1: x + 0.72, z1: z + 0.4 });
    const part = (geo, mat, px, py, pz, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.x = rx; m.castShadow = true; m.receiveShadow = true; g.add(m); FAIR.meshes.push(m); return m; };
    part(new THREE.BoxGeometry(1.8, 0.9, 0.7), woodM, 0, 0.45, 0);
    for (const sx of [-0.85, 0.85]) part(new THREE.BoxGeometry(0.07, 2.2, 0.07), woodM, sx, 1.1, -0.3);
    part(new THREE.BoxGeometry(2.0, 0.04, 1.0), awnM, 0, 2.15, 0.1, 0.35);
    part(new THREE.BoxGeometry(1.7, 0.08, 0.6), G.std({ color: '#f3f6fb', roughness: 0.75, env: 0.7 }), 0, 0.94, 0);
    for (let k = 0; k < 3; k++) { const l = part(lanG, cols[k], -0.6 + k * 0.6, 1.85, 0.32); l.scale.setScalar(0.8); }
  }
  // The log at the end of the path, where somebody small has wandered off to sit.
  const lx = 6.0, lz = 34.4, ly = G.terrainH(lx, lz);
  const log = add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.5, 12), G.std({ map: G.TX.bark, color: '#7a5a46', roughness: 1 }))); log.rotation.z = Math.PI / 2; log.rotation.y = 0.15; log.position.set(lx, ly + 0.12, lz); log.castShadow = log.receiveShadow = true;
  const cap = add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.3, 10), G.MAT.snow)); cap.rotation.z = Math.PI / 2; cap.rotation.y = 0.15; cap.scale.set(1, 1, 0.45); cap.position.set(lx - 0.2, ly + 0.27, lz - 0.02);
  FAIR.log = { x: lx + 0.25, z: lz - 0.02, seatY: ly + 0.31 };
  Object.assign(FAIR, { cols, glow, wire, lanG, glowG });
  FAIR.meshes.forEach((m) => { m.visible = false; });
  G.updateLanterns = (t, dt) => { if (!FAIR.on) return; for (const m of FAIR.meshes) if (m.userData.billboard) m.quaternion.copy(G.camera.quaternion); if (G.updateMemory) G.updateMemory(t, dt || 1 / 60); };
})();
function showFair(on) {
  // The stalls only block the path while the fair is there.
  if (FAIR.coll) for (const c of FAIR.coll) { if (on && !G.COLL.includes(c)) G.addCollider(c); if (!on) G.removeCollider(c); }
  FAIR.on = on; FAIR.meshes.forEach((m) => { m.visible = on; }); STATE.lightSpots = on ? FAIR.spots.slice(0, 2) : null; if (!on) resetMemory(); }

/* ---------- the prologue's things: a paper lantern on a stick, a paper cone of chestnuts, sky lanterns ---------- */
const MEM = (G.MEM = { sky: [] });
(function buildMemory() {
  const W = G.world;
  const mk = (geo, mat, parent) => { const m = new THREE.Mesh(geo, mat); m.userData.dynamic = true; (parent || W).add(m); return m; };
  // The paper lantern, hung from a little stick: it lives in the world and follows a hand (updateMemory).
  const lan = new THREE.Group(); lan.userData.dynamic = true; W.add(lan);
  const paper = mk(FAIR.lanG, FAIR.cols[2], lan); paper.scale.set(0.62, 0.78, 0.62);
  const halo = mk(FAIR.glowG, FAIR.glow, lan); halo.scale.setScalar(0.75); halo.userData.billboard = true;
  const stick = mk(new THREE.CylinderGeometry(0.005, 0.005, 0.3, 4), FAIR.wire, lan); stick.position.set(0, 0.2, 0); stick.rotation.z = 0.5;
  MEM.lantern = lan; MEM.lanternHalo = halo; MEM.lanternStick = stick;
  MEM.stall = { x: FAIR.stalls[0][0], z: FAIR.stalls[0][1] }; MEM.nutStall = { x: FAIR.stalls[1][0], z: FAIR.stalls[1][1] };
  // Chestnuts in a twist of paper.
  const cone = mk(new THREE.ConeGeometry(0.04, 0.12, 10), G.std({ color: '#d8c7a4', roughness: 0.95 })); cone.rotation.x = Math.PI;
  MEM.nuts = cone;
  // Sky lanterns, let go from the fair.
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(); g.userData.dynamic = true; W.add(g);
    const body = mk(new THREE.CylinderGeometry(0.15, 0.11, 0.34, 10), FAIR.cols[(i + 1) % 4], g);
    const h = mk(FAIR.glowG, FAIR.glow, g); h.scale.setScalar(1.6); h.userData.billboard = true;
    g.visible = false; MEM.sky.push({ g, halo: h, t: 0, on: false, x: 0, z: 0, ph: i * 1.7 });
  }
  MEM.spot = { x: 0, y: 0, z: 0, i: 2.6, color: '#ffb066' };
  resetMemory();
})();
function resetMemory() {
  Object.assign(MEM, { hasLantern: false, hasNuts: false, lanternDown: null, near: false, sat: false });
  MEM.lantern.visible = false; MEM.nuts.visible = false; MEM.sky.forEach((s) => { s.g.visible = false; s.on = false; });
  // The red scarf goes back on him (he might have given it away last time this memory played).
  if (G.KIDS && MEM.scarfMoved) { moveScarf(G.KIDS.partner, G.KIDS.player); MEM.scarfMoved = false; }
}
// The scarf from one child to the other, sitting where it sits on that child (fitted in life.js, fitKid).
function moveScarf(from, to) {
  const a = from.userData, b = to.userData, parts = (a.kidScarf || []).slice();
  if (!parts.length) return;
  for (const p of parts) {
    const base = p.userData.base;
    b.chest.add(p);
    p.position.set(base[0] * b.k, base[1] * b.k + (b.scarfDy || 0), base[2] * b.k);
    p.scale.copy(p.userData.baseScale).multiplyScalar(b.k / (p.userData.k0 || b.k));
  }
  b.kidScarf = parts; a.kidScarf = [];
}
const _hw = new THREE.Vector3();
G.updateMemory = (t, dt) => {
  if (!FAIR.on) return;
  const kid = G.KIDS && G.KIDS.player;
  // The lantern swings from his hand, or sits in the snow where he put it; its light goes with it.
  if (MEM.hasLantern && kid) {
    MEM.lanternStick.visible = !MEM.lanternDown;
    if (MEM.lanternDown) { MEM.lantern.position.copy(MEM.lanternDown); MEM.lantern.rotation.z = 0; }
    else { kid.userData.arms[1].hand.getWorldPosition(_hw); MEM.lantern.position.set(_hw.x, _hw.y - 0.2 + Math.sin(t * 2.3) * 0.01, _hw.z); MEM.lantern.rotation.z = Math.sin(t * 1.7) * 0.12 + PLAYER.speed * 0.05; }
    MEM.lantern.visible = true;
    MEM.lanternHalo.quaternion.copy(G.camera.quaternion);
    const p = MEM.lantern.position; Object.assign(MEM.spot, { x: p.x, y: p.y + 0.15, z: p.z, i: 2.6 * (0.94 + Math.sin(t * 11) * 0.04 + Math.sin(t * 4.3) * 0.03) });
    if (STATE.lightSpots) STATE.lightSpots[1] = MEM.spot;
  }
  if (MEM.hasNuts && kid) { kid.userData.arms[0].hand.getWorldPosition(_hw); MEM.nuts.position.set(_hw.x, _hw.y - 0.03, _hw.z); MEM.nuts.visible = true; }
  // Sky lanterns: up from the fair, drifting over the two of you on the breeze.
  for (const s of MEM.sky) {
    if (!s.on) continue;
    s.t += dt;
    if (s.t < 0) { s.g.visible = false; continue; }
    const k = s.t, y = 2.4 + k * 0.55 + Math.sin(k * 0.8 + s.ph) * 0.15;
    s.g.position.set(s.x + Math.sin(k * 0.35 + s.ph) * 0.6 + k * 0.05, y, s.z + k * 0.32);
    s.g.visible = y < 40; s.halo.quaternion.copy(G.camera.quaternion);
  }
};
function releaseSkyLanterns() {
  MEM.sky.forEach((s, i) => { s.x = 3 + i * 1.3 + Math.random() * 0.5; s.z = 16.5 + Math.random(); s.t = -i * 1.4; s.on = true; });
}
// Things to pick up at the fair before you go and find her.
G.INTER.push({ id: 'memLantern', pos: [MEM.stall.x, 0.9, MEM.stall.z + 0.6], r: 1.4, label: 'Take a paper lantern', when: () => S.chapter === 'prologue' && !MEM.hasLantern,
  act: () => { MEM.hasLantern = true; G.Audio.chime && G.Audio.chime(); G.say(null, '(The lantern man winks and lets you choose. You choose the orange one. It is the best one.)'); } });
G.INTER.push({ id: 'memNuts', pos: [MEM.nutStall.x, 0.9, MEM.nutStall.z + 0.6], r: 1.4, label: 'Buy roasted chestnuts', when: () => S.chapter === 'prologue' && !MEM.hasNuts,
  act: () => { MEM.hasNuts = true; G.say(null, '(You have exactly enough coins for one small bag. It is hot right through your mittens.)'); } });

/* =====================================================================
 * Interactions around the house
 * ===================================================================== */
const ch = () => S.chapter;
const morning = () => ch() === 'morning';
const findInter = (id) => G.INTER.find((i) => i.id === id);
// Which room someone is in, so Partner only answers what she could actually hear or see.
const room = (x, z) => (G.inside(x, z) ? (x < 5 ? 'bedroom' : x < 11 ? 'living' : 'kitchen') : G.onDeck(x, z) ? 'porch' : 'outside');
const hereRoom = () => room(PLAYER.x, PLAYER.z);
const sameRoom = () => hereRoom() === room(PARTNER.x, PARTNER.z);
const canHear = () => !PARTNER.hidden && !PARTNER.script && !PARTNER.slide && (sameRoom() ? dist() < 7.5 : dist() < 3.2);
// Interactions that talk take the scene; the player can't walk off mid-sentence. Afterwards Partner may react.
async function run(fn, id) {
  if (STATE.busy) return;
  S.inInter = !!id && !!STATE.asHer;   // playing as her: she does the thing herself (see game.js)
  STATE.busy = true; S.pSpoke = false;
  try { await fn(); } catch (e) { console.error(e); }
  S.inInter = false;
  STATE.busy = false;
  if (id) { S.lastUse = { id, t: G.simT, room: hereRoom() }; react(id); const it = findInter(id); if (it && canHear() && !PARTNER.task) G.gaze(PARTNER, it.pos, 2.4); }
}
const inter = (id, pos, r, label, act, when) => G.INTER.push({ id, pos, r, label, act: () => run(act, id), raw: act, when });
const rewire = (id, act) => { const it = findInter(id); it.raw = act; it.act = () => run(act, id); return it; };
const Pt = (t, o) => { S.pSpoke = true; return P(t, o); };   // Partner speaking inside an interaction

/* ---------- Partner reacts to what you're doing, if she's within earshot ----------
 * lines: when she's up and about; drowsy: from bed (bedroom only); each object reacts on first use,
 * then now and then. Barks don't stop you moving. */
const REACT = {
  bed: { lines: ['If you make that bed, I shall only unmake it tonight.', 'Leave the dent on my side. I’m attached to it.'], drowsy: ['Mm. Come back.', 'You’re letting the cold in, {toHim}.'] },
  wardrobe: { lines: ['If you’re looking for your grey jumper, I’m very probably wearing it.', 'The one shoe is important. I won’t explain.'], drowsy: ['Wear the grey one. No. Wait. I have the grey one.', 'Not the wedding jumper. Please.'] },
  chest: { lines: ['Be gentle with Kevin. He’s had a hard winter.', 'Kevin is lukewarm by design, {dear}.'], drowsy: ['Is that Kevin? Bring him here.'] },
  bwin: { lines: ['Is Gerald there? Do say good morning from me.', 'He’s been on that sill since autumn. I think he pays rent in feathers.'], drowsy: ['Tell Gerald I’m asleep.', 'Is it still snowing? Don’t tell me. Yes, tell me.'] },
  wwin: { lines: ['The trees look very pleased with themselves this morning.', 'It snowed all night. I heard it. Well. I imagined I heard it.'], drowsy: ['Close the curtain. Or don’t. I can’t decide.'] },
  photos: { lines: ['I still say the lake one is cursed.', 'We should take a new one today. A good one. On purpose.'], drowsy: ['The lake one is cursed. Mm.'] },
  lampL: { lines: [], drowsy: ['Too bright, {toHim}. Far too bright.', 'Mood lighting. Very bold for this hour.'] },
  lampR: { lines: [], drowsy: ['That is my lamp. I can feel it from here.'] },
  fire: { lines: ['There. Now it feels like a proper morning.', 'I do love watching you be competent at things.'] },
  clock: { lines: ['Leave it fast, please. It’s the only reason we’re ever on time.', 'Four minutes fast. Like you, at breakfast.'], drowsy: ['What time is it? No. Don’t tell me.'] },
  globe: { lines: ['Gently. It’s older than both of us.', 'I always wanted to live in there.'] },
  armchair: { lines: ['That chair suits you. Very distinguished.', 'You look like someone about to read a will.'] },
  chairB: { lines: ['That’s the creaky one. It likes you.'] },
  basil: { lines: ['Thank you for looking after my son.', 'Basil says thank you. Basil is very shy about it.'] },
  scrap: { lines: ['We need more pages, I think.', 'Please skip the lake page. I’m begging you, {toHim}.', 'Is that my handwriting? It’s dreadful.'] },
  shelf2: { lines: ['Six copies. And neither of us has made a single recipe.', 'The pine candle is for emergencies. Don’t light it on a whim.'] },
  lwin: { lines: ['Any good clouds?', 'If it’s a pancake-shaped cloud, I saw it first.'] },
  coats: { lines: ['That scarf is yours. It has always been yours.', 'The scarf is not mine, {dear}, and I won’t hear otherwise.'] },
  cushion: { lines: ['That is a private collection.', 'Please put my stash back exactly as you found it.'] },
  armchair: { lines: ['That blanket and I have an understanding.', 'Your chair. My blanket. A fair arrangement.'] },
  ctable: { lines: ['I’ll clear those. Eventually. In a broad sense.', 'The spoon mug is mine. I was making a point.'] },
  kettle: { lines: ['Is one of those for me? Say it is.', 'Two sugars, please. And not a word to anyone.'] },
  ksink: { lines: ['The spoon is innocent. I was testing the honey.', 'Leave the washing up. It’s a snow day. I’ll do it. Later.'] },
  toaster: { lines: ['Not the toaster. We agreed. After last time.', 'The toaster and I are no longer speaking.'] },
  fridge: { lines: ['Anything new in there?', 'The lemon is mine. I have plans for it.', 'Please close the door, {toHim}. You’re heating the snow.'] },
  ktable: { lines: ['Don’t open the card. It says “not yet”. That means you.', 'I tidied that table. Briefly.'] },
  kwin: { lines: ['Did you see the heart on the rail? I didn’t draw it. I drew it.', 'It looks like the whole world has been tidied away.'] },
  ewin: { lines: ['Nothing to see over there. Look somewhere else. Lovely snow, isn’t it?', 'Why are you looking at the study? Look at the sky.'] },
  study: { lines: ['No. Absolutely not. Kindly step away from the door.', 'It says “private”, {toHim}. In my best handwriting.'] },
  cupboard: { lines: ['Hands where I can see them, please.', 'Every biscuit in there is accounted for.'] },
  bench: { lines: ['It’s far too cold to sit out here before dark.', 'Later. When the stars are out. I promise.'] },
};
let reactT = -99;
function react(id) {
  const R = REACT[id];
  if (!R || S.pSpoke || S.flags.noBarks) return;
  const asleep = PARTNER.lie;
  if (asleep ? hereRoom() !== 'bedroom' : !canHear()) return;
  const pool = asleep ? R.drowsy : R.lines;
  if (!pool || !pool.length) return;
  const first = !S.reacted[id];
  if (!first && (G.simT - reactT < 8 || Math.random() > 0.45)) return;
  S.reacted[id] = (S.reacted[id] || 0) + 1;
  reactT = G.simT;
  const line = pool[(S.reacted[id] - 1) % pool.length];
  G.bark(line, 2.2 + line.length / 22);
}

// Bedroom
inter('bed', [2.4, 0.5, 0.15], 1.25, () => (morning() && PARTNER.lie ? 'Lie back down' : 'Bed'), async () => {
  if (morning() && PARTNER.lie) { await Story.morningCuddle(); S.pSpoke = true; return; }
  await N(cyc('bed', ['(The bed. Her side and your side exist in theory. In practice, it is all her side.)', '(You straighten the duvet. It will not survive the night.)', '(Not yet. There’s too much day left.)']));
});
inter('wardrobe', [4.3, 1, -1.35], 0.9, 'Wardrobe', () => N(cyc('wardrobe', ['(Your grey jumper should be in here. It is not. It is in {P}’s possession now, permanently.)', '(Half the hangers are empty. The other half hold jumpers neither of you has worn since a wedding.)', '(A shoebox labelled “IMPORTANT”. It contains one shoe.)'])));
inter('chest', [3.6, 0.5, 3.6], 0.8, 'Blanket chest', () => N(cyc('chest', ['(Spare blankets, and a hot-water bottle shaped like a sheep. His name is Kevin, apparently.)', '(Kevin the sheep is lukewarm, and somehow disapproving.)'])));
inter('bwin', [2.4, 1.3, 4.05], 0.9, 'Window', async () => {
  if (!morning()) return N('(Snow, blue in the dark, all the way to the trees.)');
  await N(cyc('bwin', ['(Morning. A round little bullfinch is regarding you from the sill.)', '(The bullfinch remains. So does its opinion of you.)']));
  if (S.n.bwin === 1 && canHear() && !PARTNER.lie) await Pt('That’s Gerald. He isn’t judging you. That’s simply his face.');
});
inter('wwin', [0.6, 1.3, -0.15], 0.9, 'Window', () => N(morning() ? cyc('wwin', ['(The pines are still holding last night’s snow, very carefully, as if it might break.)', '(A clump of snow slides off a branch. The tree looks relieved.)']) : '(The trees, and the dark between them.)'));
rewire('clock', () => N(cyc('clock', ['(The clock is four minutes fast. It has been four minutes fast for as long as anyone can remember. Nobody fixes it.)', '(Tick. Tock. Four minutes ahead of the rest of the world, and perfectly content.)'])));
rewire('photos', () => N('(Six polaroids on a string. The lake. The fire. The night you both got lost and didn’t mind.)'));
for (const id of ['lampL', 'lampR']) { const it = findInter(id); const was = it.act; it.act = () => { was(); S.lastUse = { id, t: G.simT, room: hereRoom() }; react(id); }; }
// Living room
const fire = rewire('fire', async () => {
  if (G.FIRE.on) {
    S.n.poke = (S.n.poke || 0) + 1;
    if (S.n.poke % 2) { G.Audio.poke(); G.sparkBurst(); await N(S.n.poke === 1 ? '(You poke the fire. It sends up a tall spray of sparks, as if it were showing off.)' : '(Another poke. More sparks. The fire is enjoying the attention.)'); }
    else await N(cyc('fireOn', ['(Warm. The kind of warm that gets into your sleeves.)', '(You add a log. The fire approves.)']));
    return;
  }
  G.FIRE.on = true; G.Audio.blow();
  await N('(It takes three matches and a certain amount of quiet swearing.)');
  if (canHear()) await Pt('The fire person, at work. My hero, {dear}.');
});
fire.label = () => (G.FIRE.on ? 'Poke the fire' : 'Light the fire');
// The window seat in the reading nook.
G.Story.nook = () => run(() => sitFree({ id: 'nook', x: G.NOOK.x, z: G.NOOK.z, yaw: 0, y: G.NOOK.seatY, line: '(The window seat. Cushions in every colour you own, a pile of books you are both halfway through, and the snow going past the glass at your back.)' }), 'nook');
const sofa = findInter('sofa');
sofa.label = () => (ch() === 'evening' ? (STATE.cuddled ? 'Sofa' : 'Curl up together') : 'Sit');
sofa.act = () => { if (ch() === 'evening') return G.Story.cuddle(); return run(sitSofa, 'sofa'); };
const cake = findInter('cake');
cake.when = () => G.CAKE.shown !== false;
inter('ctable', [8, 0.5, 0.85], 1.0, 'Coffee table', () => N(cyc('ctable', ['(Two mugs from last night. One has a lipstick mark; the other has a spoon standing upright in it.)', '(The coaster is a beer mat from somewhere neither of you has ever been.)'])), () => G.CAKE.shown === false);
const scrapShelf = rewire('shelf6.15', () => G.UI.scrapbook(S.scrap));
scrapShelf.label = 'Scrapbook';
REACT['shelf6.15'] = REACT.scrap;
rewire('shelf10.72', () => N(cyc('shelf2', ['(Six copies of the same cookbook. Nobody knows how.)', '(Paperbacks with cracked spines, a jar of sea glass, and a candle that smells of pine.)'])));
REACT['shelf10.72'] = REACT.shelf2;
inter('basil', [10.4, 0.8, 4.2], 0.85, 'Basil', async () => {
  await N(cyc('basil', ['(Basil. Not basil. {P} named him Basil to confuse guests.)', '(You water Basil. Basil remains indifferent.)', '(Basil has a new leaf. You decide not to make a fuss about it.)']));
  if (S.n.basil === 2) S.flags.waterBasil = 1;
});
inter('lwin', [9.4, 1.3, 4.05], 0.9, 'Window', () => N(morning() ? cyc('lwin', ['(A cloud shaped like a cat. Or a pancake.)', '(A cloud shaped like a pancake. Definitely a pancake.)']) : '(The porch lights, and the snow coming down through them.)'));
inter('coats', [5.5, 1.3, 4.1], 0.8, 'Coats', () => N(cyc('coats', ['(Your coat. Her coat. And a scarf neither of you will claim. Grey? Blue? The light in here is bad.)', '(The unclaimed scarf. Each of you insists it belongs to the other.)'])));
inter('cushion', [9.2, 0.6, 1.5], 0.6, 'Under the cushions', async () => {
  const pancake = S.mem.foodStolen > 0 ? ' a bite of pancake (fresh),' : '';
  await N(`(Under the cushion: three of your socks, a pen, the remote for a radio you no longer own,${pancake} and half a biscuit.)`);
  if (!S.flags.stash) { S.flags.stash = 1; await N('(It’s her stash. Everything in it was taken from you. You decide to let it grow.)'); }
}, () => morning());
inter('armchair', [6.62, 0.6, 0.68], 0.8, 'Sit in the armchair', () => sitFree(SEATS.armchair));
inter('frontdoor', [6.5, 1, 4.15], 0.8, 'Front door', async () => {
  if (morning()) {
    if (!S.flags.breakfastDone) { await N('(Breakfast first. Snow-day law, apparently.)'); if (canHear() && !PARTNER.lie) await Pt('Not without breakfast, {toHim}. I won’t allow it.'); return; }
    S.flags.leaveHouse = true; return;
  }
  return N('(The front door. Somebody has hung a sprig of pine on it.)');
});
// Kitchen
inter('kettle', [11.55, 1, -1.65], 0.75, () => (morning() && !S.flags.teaMade ? 'Make tea' : 'Kettle'), async () => {
  if (morning() && !S.flags.teaMade) {
    S.flags.teaMade = true;
    G.Audio.kettle(); G.steam('kettle', 11.65, 1.12, 0.36, { rate: 3, dur: 9 });
    await N('(You fill the kettle and take two mugs down. One for you. One for her: two sugars, which she will deny.)');
    setBreakfast({ mugs: true, plates: S.flags.pancakesMade, burnt: S.flags.pancakeQuality === 'burnt' });
    K().mugs.forEach((m, i) => G.steam('mug' + i, m.position.x, 0.86, m.position.z, { rate: 1.1, dur: 240, size: 0.55 }));
    return;
  }
  await N('(The kettle’s still warm.)');
});
inter('stove', [12.35, 1, -1.6], 0.7, () => (morning() && !S.flags.pancakesMade ? 'Make pancakes' : 'Stove'), async () => {
  if (morning() && !S.flags.pancakesMade) { await Story.makePancakes(); S.pSpoke = true; return; }
  await N(cyc('stove', ['(The pan is still a little warm from breakfast.)', '(You resist the urge to make more pancakes.)']));
});
inter('ksink', [13.05, 1, -1.6], 0.6, 'Sink', () => N(cyc('ksink', ['(Dishes from last night: two mugs, two forks, one suspiciously licked spoon.)', '(You wash the spoon. Some mysteries are better left clean.)'])));
inter('toaster', [13.48, 1, -1.65], 0.55, 'Toaster', () => N(cyc('toaster', ['(The toaster has two settings: “warm bread” and “house fire”.)', '(You leave the toaster alone. Today is not a house-fire day.)'])));
inter('fridge', [14.45, 1, -1.35], 0.75, 'Fridge', async () => {
  const n = ++S.mem.fridge;
  if (n === 1) { S.flags.knowsPancakes = true; return N('(Eggs. Milk. Butter. A sad lemon. Pancakes are possible.)'); }
  if (n === 2) return N('(Still eggs. Still milk. The lemon is still sad.)');
  if (n === 3) { if (canHear()) return Pt('It won’t grow new food if you keep checking, {toHim}.'); return N('(Cold air. Comforting, somehow.)'); }
  if (n === 5 && canHear()) return Pt('Are you waiting for it to say good morning? I could write it on something.');
  return N('(The fridge hums. It has nothing new to say.)');
});
inter('ktable', [13.0, 0.8, 2.95], 1.3, () => (morning() && S.flags.pancakesMade && !S.flags.breakfastDone ? 'Sit down for breakfast' : 'Kitchen table'), async () => {
  if (morning() && S.flags.pancakesMade && !S.flags.breakfastDone) { await Story.breakfast(); S.pSpoke = true; return; }
  await N(cyc('ktable', ['(The table. Mostly used for piling things on.)', '(A pile of post, a bowl of keys, and an envelope, face down, addressed to you. On the back, in her handwriting: “not yet”.)']));
});
inter('cupboard', [11.45, 1, 3.75], 0.7, 'Snack cupboard', async () => {
  await N('({P}’s snack cupboard. A note on the door: “Property of me. Not {dear}’s.”)');
  if (S.flags.snackDone) return;
  const c = await choose(['Leave her a snack on the counter', 'Steal a biscuit', 'Close it']);
  if (c === 0) { S.flags.snackDone = 1; S.mem.snacks++; addBond(0.6); await N('(You leave a biscuit on the counter, on a folded napkin, like a small gift.)'); }
  if (c === 1) { S.flags.snackDone = 1; S.flags.stoleSnack = 1; addRivalry(0.5); await N('(Delicious. Illegal. Delicious.)'); if (canHear()) await Pt('I saw that, {toHim}. I see everything.'); }
});
inter('kwin', [13.0, 1.3, 4.05], 0.75, 'Window', () => N(morning() ? cyc('kwin', ['(The clearing, white and blue and perfectly still. Somebody has drawn a heart in the snow on the porch rail.)', '(The heart is still there. So is a smaller, crosser one beside it.)']) : '(Your reflection, and the snow behind it.)'));
inter('radio', [13.58, 1.0, 4.1], 0.7, () => (G.Audio.radioOn() ? 'Turn the radio off' : 'Turn the radio on'), async () => {
  const on = !G.Audio.radioOn();
  G.Audio.radio(on); K().radioDial.material.opacity = on ? 0.9 : 0;
  S.pSpoke = true;
  if (on && !S.flags.radioN) { S.flags.radioN = 1; await N('(The radio warms up with a hum, wanders through some static, and settles on something slow.)'); }
  if (canHear() && !PARTNER.lie) G.bark(on ? pick(['Oh, I love this one.', 'Leave it on. Please.', 'Is this an invitation, {toHim}?']) : pick(['Oh. I was enjoying that.', 'Spoilsport.']), 2.6);
});
inter('ewin', [14.6, 1.3, 2.1], 0.6, 'Window', () => N(cyc('ewin', ['(The study’s roof, sloping away under a fat roll of snow.)', '(The study’s little window has a curtain drawn across it. It didn’t yesterday.)'])));
inter('study', [14.6, 1, 3.85], 0.7, 'Study door', async () => {
  if (PARTNER.hidden) { G.bark(['Not now, {dear}!', 'Private business. Please go away. Lovingly.', 'I can hear you breathing on the door.', 'The sign says “private”. I wrote it myself.'], 2.6); S.pSpoke = true; return; }
  await N(cyc('study', ['(Locked. A sign on it, in marker: “PRIVATE”.)', '(Still locked. Beneath the sign, smaller: “this means you, Partner”.)']));
});

/* ---------- Partner's own intentions (smart objects) ---------- */
G.SMART = [
  { id: 'sofa', spot: { x: 6.55, z: 2.95 }, seatAt: { x: 7.5, z: 2.95, yaw: Math.PI, y: 0.6 }, dur: [10, 18], lines: ['I’m claiming the sofa.', 'This sofa is mine now. Rent is one cushion a week.', '*settles in with great ceremony*'] },
  { id: 'lwin', spot: { x: 9.4, z: 4.08 }, yaw: 0, dur: [5, 8], look: { x: 9.4, y: 1.6, z: 8 }, lines: ['That cloud looks like you. Tall. Soft.', 'There’s a squirrel out there behaving very oddly about the snow.'] },
  { id: 'basil', spot: { x: 9.85, z: 3.72 }, yaw: 0.8, dur: [4, 7], look: { x: 10.4, y: 0.7, z: 4.2 }, lines: ['You’re doing wonderfully, Basil.', 'Don’t tell {toHim}, Basil, but you’re my favourite.'] },
  { id: 'books', spot: { x: 6.2, z: -1.45 }, yaw: Math.PI, dur: [5, 9], look: { x: 6.15, y: 1.2, z: -2.2 }, lines: ['I am reading this one. I have been reading it for a year.', 'Who owns six copies of the same cookbook? We do, apparently.'] },
  { id: 'fridge', spot: { x: 14.35, z: -1.18 }, yaw: Math.PI, dur: [3, 5], look: { x: 14.5, y: 1.1, z: -2 }, lines: ['*rustling* …nothing. I was looking at nothing.', '*takes a single grape*', 'We need cheese. Spiritually.'] },
  { id: 'study', spot: { x: 14.5, z: 3.85 }, yaw: Math.PI / 2, dur: [12, 22], hide: true, exit: { x: 14.45, z: 3.85, yaw: -Math.PI / 2 }, line: 'Private business. Please don’t follow me.', cond: () => morning() && !S.flags.pancakesMade },
  { id: 'bwin', spot: { x: 2.4, z: 4.05 }, yaw: 0, dur: [4, 6], look: { x: 2.4, y: 1.4, z: 7 }, lines: ['Good morning, Gerald.', 'Gerald’s back. Hello, Gerald.'] },
  { id: 'kwin', spot: { x: 13.0, z: 4.1 }, yaw: 0, dur: [4, 6], look: { x: 13, y: 1.4, z: 8 }, lines: ['It’s so white out there. As if someone had tidied the world away.', 'Somebody drew a heart on the porch rail. It was me. Please don’t look.'] },
];

/* ---------- other places to sit, and Partner coming to join you ---------- */
const SEATS = {
  armchair: { id: 'armchair', x: 6.22, z: 0.97, yaw: 2.23, y: 0.47, line: '(The armchair. Technically yours. {P}’s blanket lives on it, and it smells of her.)' },
  chairB: { id: 'chairB', x: 13.3, z: 3.58, yaw: Math.PI, y: 0.49, join: 'kitA', line: '(The kitchen chair creaks the way it always has. You know exactly which one it is by the creak.)' },
  chairC: { id: 'chairC', x: 13.0, z: 2.3, yaw: 0, y: 0.49, join: 'kitA' },
  bench: { id: 'bench', x: 9.83, z: 5.52, yaw: 0, y: 0.47, join: 'bench', line: '(The bench is cold enough to count as a dare. The clearing is white and still, all the way to the trees.)' },
};
const JOIN = {
  kitA: { id: 'kitA', spot: { x: 12.72, z: 4.1 }, seatAt: { x: 12.72, z: 3.58, yaw: Math.PI, y: 0.49 }, dur: [12, 20], ask: ['Mind if I join you?', 'Is this seat taken? It is now.'], lines: ['*rests her chin in her hands*', 'This is nice. Kitchen-table nice.'] },
  bench: { id: 'benchJ', spot: { x: 8.75, z: 6.15 }, seatAt: { x: 9.07, z: 5.52, yaw: 0, y: 0.47 }, dur: [14, 22], ask: ['It’s freezing out here. …Budge up.', 'Don’t sit out here alone. Wait for me.'], lines: ['*tucks her hands under your arm*', 'The quiet out here is my favourite sound.'] },
};
async function sitFree(seat) {
  if (PARTNER.hold) G.setHold(false);
  const from = { x: PLAYER.x, z: PLAYER.z, yaw: PLAYER.yaw };
  await G.sitDown(PLAYER, seat.x, seat.z, seat.yaw, seat.y);
  PLAYER.freeSit = from; S.pSpoke = true;
  if (G.SETTINGS.view === 'first') G.CAM.yaw = seat.yaw + Math.PI;   // look the way the seat faces
  if (seat.line && !S.flags['sat_' + seat.id]) { S.flags['sat_' + seat.id] = 1; await N(seat.line); }
  const o = seat.join && JOIN[seat.join];
  if (o && canHear() && PARTNER.mode === 'follow' && !PARTNER.lie && !PARTNER.hidden && !(PARTNER.sit > 0.1)) {
    if (PARTNER.task) G.endPartnerTask();
    PARTNER.task = { o, phase: 'go', t: 0 }; G.bark(o.ask, 2.4); addBond(0.2);
  }
}
const breakfastNow = () => morning() && S.flags.pancakesMade && !S.flags.breakfastDone;
inter('chairB', [13.3, 0.5, 3.95], 0.55, 'Sit', () => sitFree(SEATS.chairB), () => !breakfastNow());
inter('chairC', [13.0, 0.5, 1.95], 0.55, 'Sit', () => sitFree(SEATS.chairC), () => !breakfastNow());
// The old snow globe on the mantle: pick it up and shake it.
inter('globe', [8.5, 1.5, -1.4], 0.7, 'Shake the snow globe', async () => {
  STATE.sceneShot = true;
  G.setShot(fixed(V(8.62, 1.66, -1.23), V(8.5, 1.555, -1.65), 30, 0.012));
  G.shakeGlobe(); G.Audio.musicBox();
  await N(cyc('globe', ['(You give the snow globe a shake. Inside: a tiny cabin and a single, very determined pine. The snow takes its time.)', '(The snow swirls and settles. The little cabin’s window is painted yellow, as if someone were home.)']), { shot: 'keep' });
  await wait(1.5);
  STATE.sceneShot = false; G.releaseCamera();
});
async function sitSofa() {
  if (PARTNER.hold) G.setHold(false);
  const S0 = G.SOFA, from = { x: PLAYER.x, z: PLAYER.z, yaw: PLAYER.yaw };
  await G.sitDown(PLAYER, S0.x + 0.45, S0.z - 0.05, Math.PI, S0.seatY);
  PLAYER.freeSit = from;
  if (G.SETTINGS.view === 'first') G.CAM.yaw = 0;
  S.pSpoke = true;   // the sofa has its own replies
  const partnerThere = PARTNER.task && (PARTNER.task.o.id === 'sofa' || PARTNER.task.o.id === 'nap') && PARTNER.task.phase === 'do';
  if (partnerThere) { S.mem.affection++; addBond(0.4); G.bark(['*leans against you*', 'Mm. My pillow has arrived.', 'Oh, good. The heater.'], 2.4); return; }
  await N(S.flags.sofaN ? '(The sofa. It knows the exact shape of both of you.)' : '(You sink into the sofa. It makes a noise as if it had been waiting for you.)');
  S.flags.sofaN = 1;
  if (!PARTNER.lie && !PARTNER.hidden && dist() < 9 && PARTNER.mode === 'follow' && !PARTNER.hold) {
    if (PARTNER.task) G.endPartnerTask();
    const o = G.SMART.find((x) => x.id === 'sofa');
    PARTNER.task = { o, phase: 'go', t: 0 };
    G.bark(['Budge up, {toHim}.', 'Is there room for one more?', 'Don’t move. I’m coming.'], 2);
    S.mem.affection++; addBond(0.4);
  }
}

/* =====================================================================
 * Together: hug, hold hands, tease, kiss, talk
 * ===================================================================== */
/* Talking picks, in order: what you just did (if she saw it), where you are and what's going on,
 * the day's own topics, then small talk that fits the room. Each topic runs once. */
const recent = (id) => S.lastUse && S.lastUse.id === id && G.simT - S.lastUse.t < 60;
const ABOUT = {
  kettle: async () => { await Pt('Thank you for the tea, {dear}.'); await Y('Two sugars.'); await Pt('One. And a second one that doesn’t count.'); },
  stove: async () => { await Pt('You were very serious at that stove. Like a surgeon. A pancake surgeon.'); await Y('Pancakes deserve respect.'); await Pt('So do I, and I’ve never seen that face for me.'); },
  fridge: async () => { await Pt('You keep visiting the fridge as if it were a friend.'); await Y('It’s a good listener.'); await Pt('It hums when you talk. That isn’t listening, {toHim}. That’s politeness.'); },
  cupboard: async () => {
    if (S.flags.stoleSnack) { await Pt('About the biscuit.'); await Y('What biscuit?'); await Pt('Precisely the answer a thief would give.'); addRivalry(0.2); }
    else if (S.mem.snacks) { await Pt('Did you leave a biscuit on a napkin for me?'); await Y('It might have been Gerald.'); await Pt('Gerald has no thumbs. Thank you, {toHim}.'); addBond(0.3); }
    else { await Pt('Were you about to open my cupboard?'); await Y('Admiring it. From a respectful distance.'); await Pt('Keep it respectful.'); }
  },
  basil: async () => { await Pt('Basil likes you, you know. He just can’t show it.'); await Y('He’s a plant.'); await Pt('He is a very reserved plant.'); },
  globe: async () => { await Pt('That snow globe was my grandmother’s.'); await Y('The cabin in it looks a bit like ours.'); await Pt('I know. I think that’s why I wanted this place.'); },
  radio: async () => { await Pt('Do you remember the first time we danced in here?'); await Y('Two in the morning. The kettle was boiling.'); await Pt('And you stepped on my foot, and the kettle screamed, and neither of us stopped.'); },
  study: async () => {
    await Pt('You were looking at the study door.');
    const c = await choose(['“What’s in there?”', '“I wasn’t.”', '“I’ll wait.”']);
    if (c === 0) await Pt('Things. Private things. Things for later. That is all you may know.');
    if (c === 1) await Pt('You were. You had your curious face on. It’s very obvious.');
    if (c === 2) { addBond(0.3); await Pt('…Thank you. It will be worth it. I hope.'); }
  },
  ewin: async () => { await Pt('Why were you looking at the study window?'); await Y('Admiring the snow.'); await Pt('Admire it from another window, please.'); },
  scrap: async () => { await Pt('Which page is your favourite?'); await Y('The one we haven’t made yet.'); await Pt('That is either very romantic or a way of avoiding the question.'); },
  'shelf6.15': async () => ABOUT.scrap(),
  fire: async () => { await Pt('I’m going to learn to light it myself one day.'); await Y('You say that every winter.'); await Pt('And every winter you light it first. That’s hardly my fault.'); },
  bwin: async () => { await Pt('I think Gerald comes back because of you.'); await Y('Because I feed him?'); await Pt('Because you say good morning to him. It matters to a bird.'); },
  wardrobe: async () => { await Pt('I will give the grey jumper back. In principle.'); await Y('When?'); await Pt('When it stops smelling of you, {dear}. So never.'); },
  photos: async () => { await Pt('We should take a photograph today. A proper one.'); await Y('With both of us looking?'); await Pt('Let’s not be unrealistic.'); },
  coats: async () => { await Pt('The scarf. Be honest. Is it yours?'); await Y('It’s yours.'); await Pt('Then we’re agreed. It belongs to no one. A free scarf.'); },
  cushion: async () => { await Pt('You found my collection.'); await Y('Three of my socks are in there.'); await Pt('They were lonely. I gave them a home.'); },
  ktable: async () => { await Pt('You didn’t open the card, did you?'); await Y('It said “not yet”.'); await Pt('Good. Tonight. It’s for tonight.'); },
  clock: async () => { await Pt('Do you ever think we should fix the clock?'); await Y('No.'); await Pt('No. It would feel like someone else’s house.'); },
  toaster: async () => { await Pt('We are not speaking about the toaster.'); await Y('We never do.'); await Pt('And that is how it will stay.'); },
  bed: async () => { await Pt('You made the bed. I noticed.'); await Y('Badly.'); await Pt('Lovingly badly. That’s the best kind.'); },
  sofa: async () => { await Pt('This is my favourite place in the cabin.'); await Y('The sofa?'); await Pt('Next to you on it. The sofa’s only part of it.'); addBond(0.2); },
  chest: async () => { await Pt('Kevin was a present from my grandmother.'); await Y('Kevin the sheep?'); await Pt('Kevin the sheep. Treat him with the respect he is owed.'); },
};
const ROOM = {
  bedroom: [
    { id: 'r_bed1', when: () => morning(), run: async () => { await Pt('I’ve decided this is the best room.'); await Y('Because of the bed?'); await Pt('Because of the bed, and the person who keeps getting out of it too early.'); } },
    { id: 'r_bed2', when: () => !morning(), run: async () => { await Pt('The fairy lights were your idea. I want that on record.'); await Y('They were yours.'); await Pt('Then I have excellent ideas.'); } },
  ],
  living: [
    { id: 'r_liv1', when: () => morning() && !G.FIRE.on, run: async () => { await Pt('It’s a little cold in here, isn’t it?'); await Y('Is that a hint?'); await Pt('It is a heavy hint, {toHim}. The fire is right there.'); } },
    { id: 'r_liv2', when: () => G.FIRE.on, run: async () => { await Pt('Listen to the fire. It sounds like someone whispering.'); await Y('What’s it saying?'); await Pt('That we should stay in all day. I agree with it entirely.'); } },
    { id: 'r_liv3', run: async () => { await Pt('Do you remember carrying that sofa in?'); await Y('I remember you directing.'); await Pt('Someone had to have a vision.'); } },
  ],
  kitchen: [
    { id: 'r_kit1', when: () => morning() && !S.flags.pancakesMade, run: async () => { await Pt('Are we having pancakes, or are we simply standing in the kitchen together?'); await Y('Is there a difference?'); await Pt('About four pancakes’ difference.'); } },
    { id: 'r_kit2', when: () => S.flags.pancakesMade, run: async () => { await Pt('The kitchen smells wonderful. You’ve outdone yourself.'); await Y('Even the burnt one?'); await Pt('Especially the burnt one. It has character.'); } },
    { id: 'r_kit3', run: async () => { await Pt('I like this kitchen best in the morning. It feels new.'); await Y('It’s the same kitchen.'); await Pt('Then it’s the snow. Everything looks new under snow.'); } },
  ],
  porch: [
    { id: 'r_por1', when: () => morning(), run: async () => { await Pt('It’s so quiet out here in the mornings.'); await Y('Apart from Gerald.'); await Pt('Gerald is part of the quiet.'); } },
    { id: 'r_por2', when: () => !morning(), run: async () => { await Pt('The string lights were crooked all year. I like them crooked.'); await Y('I could straighten them.'); await Pt('Don’t you dare.'); } },
  ],
  outside: [
    { id: 'r_out1', when: () => morning(), run: async () => { await Pt('Look at our footprints. Yours are enormous.'); await Y('Yours are tiny.'); await Pt('Efficient, {toHim}. Mine are efficient.'); } },
    { id: 'r_out2', when: () => !morning(), run: async () => { await Pt('The cabin looks so small from out here.'); await Y('It is small.'); await Pt('It’s exactly big enough. That’s different.'); } },
  ],
};
const DAY = {
  morning: [
    { id: 'gift', run: async () => {
      await Pt('If you could have anything at all today, what would it be?');
      const c = await choose(['“Pancakes.”', '“You.”', '“To know what’s in the study.”']);
      if (c === 0) await Pt('Pancakes aren’t a wish, {dear}. They’re a way of life.');
      if (c === 1) { addBond(0.5); await Pt('Oh, honestly. …You already have me. That isn’t a wish. That’s a standing arrangement.'); }
      if (c === 2) await Pt('A good try. The answer is still “private”.');
    } },
    { id: 'dream', run: async () => { await Pt('I dreamt we were children again, and you were already this tall.'); await Y('That sounds unsettling.'); await Pt('It was. You couldn’t fit on the sledge.'); } },
  ],
  evening: [
    { id: 'secret', when: () => STATE.cakeDone, run: async () => { await Pt('I nearly said something this morning. Twice.'); await Y('About what day it is?'); await Pt('About what day it is. The pancakes very nearly broke me.'); } },
    { id: 'fair', run: async () => { await Pt('Do you remember the winter fair? It was the first snow then, too.'); await Y('Vaguely.'); await Pt('Same. Vaguely is my favourite way to remember things.'); } },
  ],
  any: [
    { id: 'size', run: async () => { await Pt('Why are you so tall, {toHim}?'); await Y('Why are you so small?'); await Pt('Concentrated.'); } },
  ],
};
const SMALL = {
  bedroom: ['Mm?', 'Yes, {toHim}?', 'If you’re about to suggest a nap, the answer is yes.'],
  living: ['Hello again.', 'You only wanted to hear my voice. I can tell.', 'I’m listening. Attentively.'],
  kitchen: ['Is this about food? It’s usually about food.', 'Yes, {dear}?', 'If you’re asking whether I want more tea, I do.'],
  porch: ['It’s lovely out, isn’t it?', 'Mm. Yes?'],
  outside: ['My nose is cold. That’s all I have to report.', 'Yes, {toHim}?'],
};
async function talk() {
  const here = hereRoom(), seen = S.lastUse && S.lastUse.room === room(PARTNER.x, PARTNER.z);
  // In bed she's barely awake.
  if (PARTNER.lie) { await Pt(pick(['…Mm. Five more minutes. Then you may talk to me.', 'I’m asleep, {toHim}. This is a dream. Go and make pancakes in it.', '…Shh. I’m conserving warmth.'])); return; }
  if (S.lastUse && G.simT - S.lastUse.t < 60 && ABOUT[S.lastUse.id] && !S.talked['a_' + S.lastUse.id] && (seen || dist() < 4)) {
    S.talked['a_' + S.lastUse.id] = true; await ABOUT[S.lastUse.id](); return;
  }
  if (PARTNER.hold && !S.talked.s_hold) { S.talked.s_hold = true; await Pt('You know, you could just hold my hand all day. I wouldn’t object.'); await Y('People might talk.'); await Pt('There are no people, {dear}. There is Gerald.'); return; }
  if ((PLAYER.sit || 0) > 0.5 && (PARTNER.sit || 0) > 0.5 && !S.talked.s_sofa) { S.talked.s_sofa = true; await ABOUT.sofa(); return; }
  const roomT = (ROOM[here] || []).find((x) => !S.talked[x.id] && (!x.when || x.when()));
  if (roomT) { S.talked[roomT.id] = true; await roomT.run(); return; }
  const dayT = (DAY[ch()] || []).concat(DAY.any).find((x) => !S.talked[x.id] && (!x.when || x.when()));
  if (dayT) { S.talked[dayT.id] = true; await dayT.run(); return; }
  await Pt(pick(SMALL[here] || SMALL.living));
}
const TEASES = [
  ['You have a pillow crease on your face.', 'It’s a dimple. A very long dimple.'],
  ['Your hair is doing something remarkable this morning.', 'It’s called “style”, {toHim}. Look it up.'],
  ['I’m a year older, and therefore wiser.', 'Older, certainly.'],
  ['You’re very small.', 'I’m concentrated.'],
  ['You snore, you know.', 'I purr. There’s a difference, and it’s considerable.'],
  ['You’re staring.', 'I’m looking. You are the one staring.'],
];
/* A snowball, and the inevitable reply. */
async function snowball() {
  const p = PARTNER;
  if (p.hold) G.setHold(false);
  STATE.busy = true;
  // She steps back a few paces first; it's only fair.
  const ax = Math.atan2(p.x - PLAYER.x, p.z - PLAYER.z), d = Math.hypot(p.x - PLAYER.x, p.z - PLAYER.z);
  if (d < 2.5) { G.bark('Oh, no. Not the snow. {toHim}, don’t you dare.', 2); await G.walkTo(p, PLAYER.x + Math.sin(ax) * 3.2, PLAYER.z + Math.cos(ax) * 3.2, 1.9); }
  PLAYER.yaw = Math.atan2(p.x - PLAYER.x, p.z - PLAYER.z); p.yaw = PLAYER.yaw + Math.PI;
  // Side-on, wide enough to see the ball fly both ways.
  { const mx = (PLAYER.x + p.x) / 2, mz = (PLAYER.z + p.z) / 2, sx = Math.cos(PLAYER.yaw), sz = -Math.sin(PLAYER.yaw), D = Math.hypot(p.x - PLAYER.x, p.z - PLAYER.z) * 0.9 + 1.8;
    const look = V(mx, G.floorAt(mx, mz) + 1.1, mz), side = Math.random() < 0.5 ? 1 : -1;
    const pos = V(mx + sx * D * side, look.y + 0.45, mz + sz * D * side);
    STATE.sceneShot = true; G.setShot(fixed(pos, look, 44, 0.004)); }
  PLAYER.forcePose = 'throw'; await wait(0.45); PLAYER.forcePose = null;
  const hand = (c, up = 1.45) => { const h = G.headPos(c); return new THREE.Vector3(h.x + Math.cos(c.yaw) * -0.2, h.y - 0.3 * up, h.z - Math.sin(c.yaw) * -0.2); };
  const chest = (c) => { const h = G.headPos(c); return new THREE.Vector3(h.x, h.y - 0.35, h.z); };
  await G.throwSnow(hand(PLAYER), chest(p), 0.55);
  G.Audio.thwump(); p.lidsClosed = true; wait(0.4).then(() => { p.lidsClosed = false; });
  S.mem.snowballs = (S.mem.snowballs || 0) + 1; addRivalry(0.3); addBond(0.2);
  G.bark(S.mem.snowballs === 1 ? 'Oh. Oh, you did not, {dear}.' : ['That’s it. That is war.', 'You’ll regret that. Lovingly.', 'Right in the scarf!'], 2);
  await wait(1.1);
  p.forcePose = 'throw'; await wait(0.5); p.forcePose = null;
  await G.throwSnow(hand(p), chest(PLAYER), 0.6);
  G.Audio.thwump(); G.CAM.shake = 1;
  G.bark(['Fair is fair.', 'Ha! Direct hit.', 'We are even. For now.'], 2.2);
  if (S.mem.snowballs === 1) addScrap('snowball', 'A snowball fight in the clearing. Both claimed victory. Both were wet to the elbow.');
  await wait(1.2);
  STATE.sceneShot = false; G.releaseCamera();
  STATE.busy = false;
}
async function together() {
  if (G.busy() || S.flags.noTogether) return;
  const p = PARTNER;
  // From bed she can only be talked to (or kissed good morning).
  const seated = (p.sit || 0) > 0.3 || (PLAYER.sit || 0) > 0.3 || p.lie;
  const acts = [];
  if (!seated) acts.push({ id: 'hug', t: 'Hug' }, { id: 'hand', t: p.hold ? 'Let go' : 'Hold hands' });
  const music = G.Audio.radioOn() && G.inside(PLAYER.x, PLAYER.z) && PLAYER.x > 5;
  const snowy = !G.onDeck(PLAYER.x, PLAYER.z) && !G.onDeck(p.x, p.z) && !p.lie && !p.sit;
  if (!seated && snowy) acts.push({ id: 'snow', t: 'Throw a snowball' });
  if (!seated && music) acts.push({ id: 'dance', t: 'Dance' });
  if (!p.lie) acts.push({ id: 'tease', t: 'Tease' });
  // Other things to do together (snowmen, snow angels, a photograph...) add themselves here.
  const ctx = { seated, snowy, music, out: !G.inside(PLAYER.x, PLAYER.z) };
  for (const x of EXTRA) { try { if (x.when(ctx)) acts.push({ id: x.id, t: typeof x.t === 'function' ? x.t(ctx) : x.t }); } catch (e) { console.error(e); } }
  acts.push({ id: 'kiss', t: 'Kiss' }, { id: 'talk', t: 'Talk' });
  STATE.busy = true;   // she waits while you decide
  const keep = p.task && p.task.phase === 'go' ? null : p.task;
  if (p.task && !keep) G.endPartnerTask();
  const id = await G.UI.together(acts);
  STATE.busy = false;
  if (!id) return;
  if (id !== 'tease' && id !== 'talk' && p.task && !seated) G.endPartnerTask();
  switch (id) {
    case 'hug': {
      S.mem.hugs++; S.mem.affection++; addBond(S.mem.hugs < 6 ? 0.35 : 0.08);
      await G.hug('hug', S.mem.hugs === 1 ? 'Oh. Hello. A snow-day hug. Accepted.' : ['Mm. Squashed. Very nice.', 'You’re so warm. It hardly seems fair.', 'You may stop. Please don’t stop.', '*rests her cheek against your shoulder*', 'A very good hug. Ten out of ten.']);
      return;
    }
    case 'hand': {
      if (p.hold) { G.setHold(false); G.bark(['Oh. All right.', 'Very well. Free range.', 'Fine. I’ll miss it.'], 1.8); return; }
      G.setHold(true); S.mem.holds++; S.mem.affection++; addBond(S.mem.holds < 6 ? 0.3 : 0.05);
      G.bark(['*laces her fingers through yours*', 'May I swing it a little?', 'Oh, how formal of us.', '*gives your hand a squeeze*'], 2);
      return;
    }
    case 'tease': {
      S.mem.teases++; addRivalry(0.25);
      const L = TEASES[(S.mem.teases - 1) % TEASES.length];
      STATE.busy = true; await Y(L[0]); await P(L[1]); STATE.busy = false;
      return;
    }
    case 'kiss': {
      S.mem.kisses++; S.mem.affection++; addBond(S.mem.kisses < 5 ? 0.35 : 0.05);
      const line = p.lie ? ['Mm. Good morning to you too.', '…Again. For warmth.'] : ['Well. Good morning to you too.', 'A good-morning kiss. Noted.', 'Again? Greedy, {toHim}.', '*a small, flustered noise*', 'You can’t simply do that. …Do it again.'];
      if (seated || !(await G.hug('kiss', line))) G.bark(line, 2.4);
      return;
    }
    case 'snow': await snowball(); return;
    case 'dance': S.mem.dances = (S.mem.dances || 0) + 1; S.mem.affection++; addBond(S.mem.dances < 3 ? 0.5 : 0.1); if (S.mem.dances === 1) addScrap('dance', 'A slow dance in the kitchen. Somebody stepped on somebody’s foot.'); await G.dance(); return;
    case 'talk': STATE.busy = true; await talk(); STATE.busy = false; return;
    default: { const x = EXTRA.find((e) => e.id === id); if (x) { try { await x.run(); } catch (e) { console.error(e); STATE.busy = false; } } }
  }
}
const EXTRA = (G.TOGETHER_EXTRA = []);
/* =====================================================================
 * Shots
 * ===================================================================== */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const fixed = (pos, look, fov = 38, aperture = 0.012) => () => ({ pos: pos.clone(), look: look.clone(), fov, focus: pos.distanceTo(look), aperture });
const bedShot = () => { const B = G.BED; return fixed(V(B.x + 0.05, 2.2, -0.9), V(B.x + 0.02, 0.72, -1.65), 44, 0.008); };
const bedCloseShot = () => { const B = G.BED; return fixed(V(B.x + 0.04, 2.1, -1.28), V(B.x + 0.02, 0.76, -1.8), 34, 0.012); };
const panShot = () => fixed(V(13.05, 1.5, -1.2), V(12.45, 0.95, -1.9), 38, 0.016);
const tableShot = (seat) => (seat === 'C' ? fixed(V(11.3, 1.42, 2.62), V(13.0, 1.02, 3.0), 50, 0.008) : fixed(V(13.0, 1.4, 1.55), V(13.0, 0.98, 3.4), 42, 0.01));

/* =====================================================================
 * Shared scenes
 * ===================================================================== */
const Story = G.Story;
// Continuing a saved game: a short "previously", from what actually happened in this playthrough.
async function previously(ch) {
  const F = S.flags, pick1 = (a) => a[Math.floor(Math.random() * a.length)];
  const L = {
    morning: ['Last time: the winter fair, a long time ago. A log, a lantern, somebody small.', 'Now: the first real snow.'],
    walk: ['Last time: a snow day. ' + (F.pancakeQuality === 'burnt' ? 'Pancakes, mostly charcoal.' : F.pancakeQuality === 'golden' ? 'Perfect pancakes, for once.' : 'Pancakes, mostly pancake-shaped.'), 'Now: boots on. She has a plan.'],
    evening: ['Last time: the meadow, the hill, the lake' + (F.circleShown ? ', and a ring of summer grass that shouldn’t have been there.' : '.'), 'Now: home, before dark.'],
    bedtime: ['Last time: the cake, ' + (F.photoSeen ? 'a photograph nobody took, ' : '') + (F.firefly ? 'and a firefly in the snow.' : 'and the stars from the bench.'), 'Now: bed.'],
    night: ['Last time: bed, warm, the snow still falling.', 'Now: three in the morning.'],
    elsewhere: ['Last time: something in the house that was nearly her.', 'Now: earlier the same night.'],
    lastbirthday: ['Last time: the door in the kitchen wall.', 'Now: the same day, again.'],
    act4_home: ['Last time: you found her.', 'Now: the way home.'],
  }[ch];
  if (!L) return;
  const f = G.$('fade'); f.style.background = '#000'; f.classList.add('on');
  await G.UI.card([pick1(['Previously', 'Where you left off']), ...L], { hold: 4.2, stagger: 0.7 });
}
Object.assign(Story, {
  together,
  async begin(fromSave) {
    const sv = fromSave && loadSave();
    if (sv) { Object.assign(S, fresh(), { vars: sv.vars, mem: sv.mem, scrap: sv.scrap || [], talked: sv.talked || {}, life: sv.life || {}, photos: sv.photos || [] }); Object.assign(S.flags, sv.flags || {}); if (G.onLoadSave) G.onLoadSave(S); await previously(sv.chapter); return go(sv.chapter); }
    Object.assign(S, fresh());
    return go('prologue');
  },
  partnerGetsUp(silent) {
    const p = PARTNER;
    if (!p.lie) return;
    G.standAt(p, 3.72, -0.85, -Math.PI / 2); p.mode = 'follow'; p.lidsClosed = false;   // awake: eyes open
    G.shapeBed({});
    STATE.autonomy = true;
    if (!silent) G.bark(['*an enormous yawn* Good morning, {toHim}.', '*stretches* I’m up. Spiritually and now physically.'], 2.6);
  },
  async morningCuddle() {
    S.flags.inBedScene = true; S.flags.cuddled = true;
    STATE.sceneShot = true;
    await G.cutTo(() => { G.cuddleInBed(PLAYER, PARTNER); PARTNER.mode = 'lying'; G.shapeBed({ L: true, R: true }); G.setShot(bedCloseShot()); });
    await N('(You climb back in. She doesn’t open her eyes. She simply shifts until she’s against you again.)', { shot: 'keep' });
    PARTNER.lidsClosed = true;
    await P('I knew you’d come back.', { shot: 'keep' });
    await Y('It’s a snow day. Nobody is going anywhere.', { shot: 'keep' });
    await P('Mm. Ten more minutes, {dear}. Snow-day rules.', { shot: 'keep' });
    addBond(1); S.mem.affection++;
    await G.fade(true); await wait(0.8); await G.fade(false);
    await N('(It is not ten minutes.)', { shot: 'keep' });
    PARTNER.lidsClosed = false;
    await P('…All right. All right. Pancakes. I am getting up. In spirit.', { shot: 'keep' });
    await G.cutTo(() => { G.standAt(PLAYER, 1.1, -0.5, Math.PI / 2); Story.partnerGetsUp(true); STATE.sceneShot = false; G.releaseCamera(); });
    addScrap('blanket', 'Ten more minutes. (It was not ten minutes.)');
    S.flags.inBedScene = false;
  },
  async makePancakes() {
    const k = K();
    STATE.sceneShot = true;
    await G.slideTo(PLAYER, 12.22, -1.43, Math.PI, 0.35);   // stand at the hob, a little left of the pan, so the camera can see both
    G.setShot(panShot());
    k.burner.material.opacity = 0.8; G.Audio.sizzle(true); G.steam('pan', 12.5, 0.96, 0.51, { rate: 4, size: 1.3 });
    await N('(Flour, eggs, milk, a pinch of salt. The pan hisses.)', { shot: 'keep' });
    k.pancakeInPan.visible = true;
    const col = (q) => (q > 0.75 ? '#e0ad66' : q > 0.35 ? '#c58a46' : '#5a3a22');
    // Pour (hold and let go: too little is a coaster, too much is a lake), then flip them (timing).
    k.pancakeInPan.visible = false;
    const [pour] = await G.UI.hold({ title: 'Pour the batter', zone: [0.55, 0.72], speed: 1.05, labels: ['A coaster.', 'A bit lopsided.', 'Perfectly round.'], over: 'A lake. A pancake lake.', onHold: () => G.Audio.tone && G.Audio.tone(220, 0.25, 0.01), onTick: (v) => { k.pancakeInPan.visible = true; k.pancakeInPan.scale.setScalar(0.3 + v * 0.95); }, onRelease: () => G.Audio.sizzle(true) });
    k.pancakeInPan.scale.setScalar(1); k.pancakeInPan.visible = true;
    const flips = await G.UI.timing({ title: 'Flip the pancakes', rounds: 2, zone: [0.58, 0.74], labels: ['Charcoal.', 'Pancake-shaped.', 'Golden.'], onPress: (q) => { G.Audio.flip(); flipAnim(k.pancakeInPan, col(q)); } });
    const sc = [pour, ...flips];
    const avg = sc.reduce((a, b) => a + b, 0) / sc.length;
    const q = (S.flags.pancakeQuality = avg > 0.7 ? 'golden' : avg > 0.38 ? 'fine' : 'burnt');
    k.burner.material.opacity = 0; G.Audio.sizzle(false); k.pancakeInPan.visible = false; G.steam('pan', 0, 0, 0, { off: true });
    k.plates.forEach((pl, i) => { if (i < 2) G.steam('plate' + i, pl.g.position.x, 0.82, pl.g.position.z, { rate: 1.4, dur: 120, size: 0.7 }); });
    S.flags.pancakesMade = true;
    setBreakfast({ mugs: S.flags.teaMade, plates: true, burnt: q === 'burnt' });
    G.setShot(tableShot('B')); G.CAM.cut = true;
    await N(q === 'golden' ? '(A stack of perfect golden pancakes. For a moment, you are a god.)' : q === 'fine' ? '(A stack of pancakes. Most of them are pancake-shaped.)' : '(A stack of pancakes. The bottom one is more of a concept.)', { shot: 'keep' });
    STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true;
    // She comes running, from wherever she was.
    const p = PARTNER;
    if (p.lie) Story.partnerGetsUp(true);
    if (p.task) G.endPartnerTask();
    if (p.hold) G.setHold(false);
    p.mode = 'script';
    G.bark('Do I smell pancakes, {toHim}?', 2.6);
    const A = k.chairs.A;
    G.walkTo(p, A.x, A.z + 0.52, 1.6).then(async () => { if (S.flags.breakfastDone) return; await G.sitDown(p, A.x, A.z, A.yaw, A.seatY); p.mode = 'seated'; });
  },
  async breakfast() {
    const p = PARTNER, k = K();
    if (p.hold) G.setHold(false);
    const c = await choose(['Sit beside her', 'Sit across from her']);
    const seat = c === 0 ? 'B' : 'C', ch2 = k.chairs[seat];
    STATE.sceneShot = true;
    await G.cutTo(() => { if (p.mode !== 'seated') { p.script = null; p.slide = null; const A = k.chairs.A; G.sitAt(p, A.x, A.z, A.yaw, A.seatY); p.mode = 'seated'; } G.sitAt(PLAYER, ch2.x, ch2.z, ch2.yaw, ch2.seatY); setBreakfast({ mugs: S.flags.teaMade, plates: true, seat, burnt: S.flags.pancakeQuality === 'burnt' }); G.setShot(tableShot(seat)); });
    if (c === 0) { S.mem.sitBeside++; addBond(0.5); await P('Oh, beside me today. How scandalous.', { shot: 'keep' }); }
    else { S.mem.sitAcross++; await P('Across from me. How formal. Like a business meeting.', { shot: 'keep' }); }
    const q = S.flags.pancakeQuality;
    if (q === 'golden') await P('These are… irritatingly good. I’m quite put out.', { shot: 'keep' });
    else if (q === 'fine') await P('Mm. Pancakes. Full marks for effort with the shapes.', { shot: 'keep' });
    else await P('Crunchy. A bold choice, {toHim}. I respect it.', { shot: 'keep' });
    if (S.flags.teaMade) await P('And tea. Two sugars? …Please don’t tell anyone.', { shot: 'keep' });
    if (S.flags.snackDone && S.mem.snacks) await P('Also, someone left a biscuit on a napkin for me. I intend to keep it forever. I have already eaten it.', { shot: 'keep' });
    await N('(Her fork drifts, casually, toward your plate.)', { shot: 'keep' });
    const s = await choose(['Let it happen', 'Defend your pancake', 'Slide the whole plate over']);
    const bite = () => setBreakfast({ mugs: S.flags.teaMade, plates: true, seat, bite: true, burnt: q === 'burnt' });
    if (s === 0) { bite(); await P('*chewing* …What? It looked lonely.', { shot: 'keep' }); S.mem.foodStolen++; addBond(0.3); }
    else if (s === 1) {
      addRivalry(1);
      await P('Fork violence! At the breakfast table, {dear}!', { shot: 'keep' });
      await N('(You look away for one second. One.)', { shot: 'keep' });
      bite();
      await P('Mine now. Thank you.', { shot: 'keep' });
      S.mem.foodStolen++;
    } else { bite(); await P('…You are unbearably kind. Thank you, {toHim}.', { shot: 'keep' }); S.mem.foodShared++; addBond(1); }
    addScrap('pancakes', q === 'burnt' ? 'Snow-day pancakes. Structurally ambitious. Somebody stole a bite anyway.' : 'Snow-day pancakes. Somebody stole a bite. (It was {P}.)');
    await P('Now. A walk. The meadow, the hill, the lake, all under fresh snow. I have planned this extensively.', { shot: 'keep' });
    await Y('Since when?', { shot: 'keep' });
    await P('Since about four minutes ago. Boots, please.', { shot: 'keep' });
    await G.cutTo(() => {
      G.standAt(PLAYER, 13.25, 1.75, Math.PI); G.standAt(p, 12.6, 1.8, Math.PI);
      p.mode = 'follow'; STATE.sceneShot = false; G.releaseCamera();
    });
    S.flags.breakfastDone = true;
  },
});

/* =====================================================================
 * Chapters
 * ===================================================================== */
const CH = {};
async function go(id) {
  S.chapter = id;
  S.run = (S.run || 0) + 1;   // background loops belong to one run of a chapter
  try { await CH[id](); } catch (e) { console.error('[story]', id, e); }
}
function flipAnim(m, color) {
  let t = 0; const y0 = 0.04;
  const step = () => { t += 1 / 60; const k = Math.min(1, t / 0.45); m.position.y = y0 + Math.sin(k * Math.PI) * 0.16; m.rotation.x = k * Math.PI; if (k > 0.5) m.material = G.shared({ color, roughness: 0.7 }); if (k < 1) requestAnimationFrame(step); else { m.rotation.x = 0; m.position.y = y0; } };
  step();
}
function quiet() {
  // Clear anything a previous scene left running.
  for (const c of [PLAYER, PARTNER]) { c.script = null; c.slide = null; c.lie = false; c.sit = c.sitTarget = 0; c.freeSit = null; c.rise = null; c.task = null; c.lead = null; c.speed = 0; c.nav = null; c.lidsClosed = false; c.tilt = c.tiltTarget = 0; c.angel = false; c.holdPose = null; c.forcePose = null; c.lieTilt = null; c.dozing = false; c.lookFix = null; c.extraMul = 1; }
  if (G.onQuiet) G.onQuiet();
  G.setHold(false); PARTNER.hidden = false; PARTNER.m.visible = true; PARTNER.mode = 'follow';
  STATE.busy = false; STATE.sceneShot = false; STATE.noControl = false; STATE.autonomy = false; STATE.bounds = null;
  Object.assign(S.flags, { noTogether: false, noBarks: false, noInteract: false });
}

CH.prologue = async () => {
  quiet(); STATE.busy = true;
  S.flags.noTogether = true; S.flags.noBarks = true;
  STATE.bounds = { zMin: 15 };   // the fair is behind you; the cabin isn't part of this memory
  if (G.kidsReady) await Promise.race([G.kidsReady, wait(20)]);   // the children may still be loading behind the title
  G.useKids(true); showFair(true); resetMemory();
  houseFor('evening'); G.setCake(false);
  G.setTime({ day: 0, tod: 1, snow: 0.8 }, true);
  G.post.grade.uniforms.uMem.value = 1; STATE.fog = { near: 7, far: 30 };   // the cabin, years later, is lost in the dark
  const L = FAIR.log, run = S.run, live = () => S.run === run;
  Object.assign(S.flags, { scarfGiven: 0, fairWish: null, fairTune: 0, fairPromise: null });
  G.placeChar(PLAYER, 6.5, 21.6, 0);
  G.sitAt(PARTNER, L.x, L.z, 0, L.seatY); PARTNER.mode = 'still'; PARTNER.stillLook = { x: L.x, z: L.z + 8, headY: L.seatY + 0.3 };
  G.releaseCamera(); G.CAM.yaw = Math.PI; G.CAM.pitch = 0.14; G.CAM.cut = true;
  await wait(0.5);
  G.fade(false);
  await G.UI.card(['We don’t remember exactly how it started.'], { hold: 3.8 });
  const asHer = G.herRoute();   // playing as her: you're the one on the log, and he comes to you
  if (!asHer) STATE.busy = false;
  if (!asHer) G.hint(G.MOBILE ? 'Drag on the left side of the screen to walk.' : `Walk with ${[G.keyFor('forward'), G.keyFor('left'), G.keyFor('back'), G.keyFor('right')].join('')} or the arrow keys.`, 7);
  // The fair, behind you: a music box at one of the stalls, now and then.
  (async () => { await wait(2.5); while (live() && S.chapter === 'prologue' && !MEM.sat) { G.Audio.musicBox(); S.flags.fairTune = 1; await wait(26); } })();
  if (asHer) {
    // Low behind her on the log, looking back up the path: footsteps in the snow, coming closer.
    STATE.sceneShot = true;
    G.setShot(() => { const pos = V(L.x + 0.9, L.seatY + 0.75, L.z + 1.6), look = V((PLAYER.x + L.x) / 2, L.seatY + 0.5, (PLAYER.z + L.z) / 2 - 1); return { pos, look, fov: 44, focus: pos.distanceTo(look), aperture: 0.01 }; }, true);
    (async () => { await wait(1.2); await N('(The end of the path, past the last lantern. A log, the snow, and you, keeping out of the way of everybody being loud.)', { shot: 'keep' }); await wait(1.5); await N('(Footsteps in the snow behind you. Small ones. Coming this way.)', { shot: 'keep' }); })();
    G.walkTo(PLAYER, L.x - 0.2, L.z - 2.1, 1.05);
  }
  wait(12).then(() => { if (live() && !asHer && dist() > 6) G.hint('(Behind you, the fair: a lantern stall, a man roasting chestnuts. Ahead, past the last light, somebody small is sitting on a log.)', 8); });
  // Alone on the log, she isn't still: she watches the snow, the fair, her own boots.
  (async () => {
    const looks = [{ x: L.x, z: L.z + 8, headY: L.seatY + 1.4 }, { x: L.x - 1, z: L.z - 10, headY: L.seatY + 1.2 }, { x: L.x + 0.2, z: L.z + 0.5, headY: L.seatY - 0.4 }, { x: L.x + 3, z: L.z + 6, headY: L.seatY + 2.4 }];
    let i = 0;
    while (live() && !MEM.near) { PARTNER.stillLook = looks[i++ % looks.length]; await wait(2.2 + Math.random() * 2.5); }
  })();
  await until(() => dist() < 2.4);
  MEM.near = true;
  STATE.noControl = true; STATE.busy = true; S.flags.noInteract = true;
  await wait(0.5);
  STATE.sceneShot = true;
  // Low and wide, behind her, looking back up the path at you.
  G.setShot(() => { const pos = V(L.x + 1.6, L.seatY + 0.55, L.z + 1.9), look = V((PLAYER.x + L.x) / 2, L.seatY + 0.35, (PLAYER.z + L.z) / 2); return { pos, look, fov: 40, focus: pos.distanceTo(look), aperture: 0.012 }; }, false);
  PLAYER.yaw = Math.atan2(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
  await wait(0.9);
  PARTNER.stillLook = { x: PLAYER.x, z: PLAYER.z, headY: PLAYER.y + PLAYER.m.userData.H * 0.9 };   // she looks up
  await wait(1.2);
  PARTNER.stillLook = { x: L.x + 2.5, z: L.z + 5, headY: L.seatY + 0.1 };                          // and away again
  await N('(Snow. Cold air. Lanterns, somewhere behind you. Somebody else who had wandered off.)', { shot: 'keep' });
  const c1 = await choose(['“Are you lost?”', '“Is this seat taken?”', 'Just sit down next to her']);
  S.flags.fairOpen = c1;   // remembered (or not) in the evening, at the photograph
  const sitShot = () => { const pos = V(L.x - 0.3, L.seatY + 0.42, L.z + 2.3), look = V(L.x - 0.2, L.seatY + 0.32, L.z); return { pos, look, fov: 36, focus: pos.distanceTo(look), aperture: 0.02 }; };
  const sitDown = () => G.cutTo(() => { G.sitAt(PLAYER, L.x - 0.55, L.z + 0.02, 0.1, L.seatY); PARTNER.stillLook = { x: L.x, z: L.z + 8, headY: L.seatY + 0.4 }; G.setShot(sitShot); });
  if (c1 === 0) {
    await Y('Are you lost?', { shot: 'keep' });
    await P('No.', { shot: 'keep' });
    await P('…I’m hiding.', { shot: 'keep' });
    await Y('From what?', { shot: 'keep' });
    await P('Everybody being loud.', { shot: 'keep' });
    await N('(You think about it. You can be quiet. You’re quite good at it.)', { shot: 'keep' });
    await sitDown();
  } else if (c1 === 1) {
    await Y('Is this seat taken?', { shot: 'keep' });
    await P('It’s a log.', { shot: 'keep' });
    await Y('Is this log taken?', { shot: 'keep' });
    PARTNER.stillLook = { x: PLAYER.x, z: PLAYER.z, headY: PLAYER.y + PLAYER.m.userData.H * 0.9 };
    await N('(She looks at you properly for the first time.)', { shot: 'keep' });
    await P('…No.', { shot: 'keep' });
    await sitDown();
    S.flags.fairJoke = 1;
  } else {
    await sitDown();
    await N('(You don’t say anything. You just sit down at the other end of the log.)', { shot: sitShot });
    await N('(After a while, she shuffles a little closer. Not much. Some.)', { shot: sitShot });
    S.mem.sitBeside = (S.mem.sitBeside || 0) + 1;
  }
  MEM.sat = true;
  // What you brought from the fair.
  if (MEM.hasLantern) {
    MEM.lanternDown = V(L.x + 0.85, G.terrainH(L.x + 0.85, L.z + 0.3) + 0.1, L.z + 0.3);   // at her end of the log, where you can see it
    await N('(You stand the paper lantern in the snow by your boots. It makes a small room of light, just big enough for two.)', { shot: sitShot });
    PARTNER.stillLook = { x: MEM.lanternDown.x, z: MEM.lanternDown.z, headY: MEM.lanternDown.y };
    await P('Where did you get that?', { shot: sitShot });
    await Y('The lantern man let me pick.', { shot: sitShot });
    await P('…You picked a good one.', { shot: sitShot });
  }
  if (MEM.hasNuts) {
    await Y('Do you want some? They’re chestnuts.', { shot: sitShot });
    await P('They’re too hot.', { shot: sitShot });
    G.Audio.blow && G.Audio.blow();
    await N('(She blows on one for a very long time, very seriously, and then eats it in one go.)', { shot: sitShot });
    await P('…Still too hot.', { shot: sitShot });
    await N('(She takes another one anyway. You split the bag exactly in half. She checks.)', { shot: sitShot });
    S.flags.fairNuts = 1;
  }
  // She's cold. He has the red scarf.
  PARTNER.forcePose = 'cold';
  await N('(Her nose is pink. She has a hat with a bobble on it, and no scarf at all.)', { shot: sitShot });
  let give = await choose(['Give her your scarf', 'Keep it: it’s your scarf']);
  if (give === 1) {
    await N('(You keep it. She tucks her chin down into her collar.)', { shot: sitShot });
    await P('I’m not cold.', { shot: sitShot });
    await N('(She is. You can hear her teeth.)', { shot: sitShot });
    give = await choose(['Give her the scarf after all', 'Sit a little closer instead']) === 0 ? 0 : 2;
  }
  if (give === 0) {
    moveScarf(G.KIDS.player, G.KIDS.partner); MEM.scarfMoved = true;
    PARTNER.forcePose = null;
    await N('(You unwind it, twice round, and hold it out. She looks at it, then at you, and then she takes it.)', { shot: sitShot });
    await P('It’s red.', { shot: sitShot });
    await Y('It’s warm.', { shot: sitShot });
    await P('…Okay. I’ll give it back.', { shot: sitShot });
    S.flags.scarfGiven = 1; addBond(1); S.mem.affection++;
  } else {
    G.sitAt(PLAYER, L.x - 0.38, L.z + 0.02, 0.1, L.seatY);
    await N('(You shuffle up until your shoulders touch. It helps. A bit.)', { shot: sitShot });
    PARTNER.forcePose = null;
    S.mem.sitBeside = (S.mem.sitBeside || 0) + 1;
  }
  // Behind you, at the fair, someone lets go of a lantern. Then another.
  releaseSkyLanterns();
  const skyShot = () => { const pos = V(L.x - 0.2, L.seatY + 0.25, L.z + 1.4), look = V(L.x + 0.5, L.seatY + 5, L.z - 2); return { pos, look, fov: 52, focus: 6, aperture: 0.004 }; };
  await wait(1.2);
  PARTNER.stillLook = { x: L.x, z: L.z - 6, headY: L.seatY + 6 }; PLAYER.lookFix = { x: L.x, z: L.z - 6, headY: L.seatY + 6 };
  const tune = G.Audio.musicBox();
  await N('(Behind you, at the fair, somebody lets go of a lantern. Then another. Then lots.)', { shot: skyShot, auto: 4.5 });
  PARTNER.forcePose = 'wave';
  await P('Look! Look, they’re going right over us.', { shot: skyShot });
  PARTNER.forcePose = null;
  await P('You’re supposed to make a wish. That’s the rule.', { shot: skyShot });
  const c3 = await choose(['Wish out loud', 'Keep it a secret']);
  if (c3 === 0) {
    await Y('I wish it would snow every single day.', { shot: sitShot });
    await P('That’s a silly wish.', { shot: sitShot });
    await P('…I’ll wish it too, then. So it counts double.', { shot: sitShot });
    S.flags.fairWish = 'snow';
  } else {
    await N('(You close your eyes and wish something. You don’t say what.)', { shot: sitShot });
    await P('Mine’s a secret too.', { shot: sitShot });
    await N('(Neither of you will ever say. Years later, you’ll both still be fairly sure it came true.)', { shot: sitShot });
    S.flags.fairWish = 'secret';
  }
  PLAYER.lookFix = null;
  await wait(Math.max(0, Math.min(3, tune - 9)));
  // Someone is calling her, back at the fair.
  PARTNER.stillLook = { x: L.x - 1, z: L.z - 12, headY: L.seatY + 1 };
  await N('(Somebody is calling a name, back among the lanterns. Hers. She doesn’t get up straight away.)', { shot: sitShot });
  await P('That’s my mum.', { shot: sitShot });
  PARTNER.stillLook = { x: PLAYER.x, z: PLAYER.z, headY: PLAYER.y + 0.9 };
  // The whistle: three notes, made up right here, "if one of us gets lost".
  await P('If I get lost, I’ll whistle. Like this.', { shot: sitShot });
  await wait(Math.min(1.6, G.Audio.whistle(1.12) + 0.2));
  await P('That’s mine. You need one too.', { shot: sitShot });
  const cw = await choose(['Whistle the same three notes back', 'Make one up', 'Try, and get it wrong']);
  if (cw === 0) { await wait(Math.min(1.6, G.Audio.whistle(1.05) + 0.2)); await P('No, that’s mine. …Fine. We can share it.', { shot: sitShot }); }
  else if (cw === 1) { G.Audio.whistle(0.98, 0.5); await wait(1.5); await P('That’s the same as mine but worse.', { shot: sitShot }); await P('…It can be both of ours.', { shot: sitShot }); }
  else { G.Audio.whistle(1.0, 1.4); await wait(1.5); await N('(It comes out as mostly air.)', { shot: sitShot }); await P('You’ll get better.', { shot: sitShot }); }
  S.flags.fairWhistle = 1; S.flags.fairWhistleKind = cw;
  await P('Will you be here tomorrow?', { shot: sitShot });
  const c4 = await choose(['“I’ll be here.”', '“Every day.”', 'Hold out your little finger']);
  if (c4 === 2) {
    await N('(She looks at your little finger for a moment. Then she hooks hers round it. It is very cold, and very serious.)', { shot: sitShot });
    await P('That’s a real promise. You can’t take those back.', { shot: sitShot });
    S.flags.fairPromise = 'pinky';
  } else if (c4 === 1) {
    await Y('Every day.', { shot: sitShot });
    await P('Every day is a lot of days.', { shot: sitShot });
    await Y('I know.', { shot: sitShot });
    S.flags.fairPromise = 'every';
  } else {
    await Y('I’ll be here.', { shot: sitShot });
    await P('Okay. Me too.', { shot: sitShot });
    S.flags.fairPromise = 'here';
  }
  addScrap('snowkids', S.flags.scarfGiven ? 'The lantern fair. A log, a bag of chestnuts, and one red scarf between two.' : 'The lantern fair. A log at the end of the path, and somebody else who had wandered off.');
  // Walk her back, hand in hand.
  await G.cutTo(() => {
    G.standAt(PLAYER, L.x - 0.6, L.z - 0.6, Math.PI); G.standAt(PARTNER, L.x + 0.1, L.z - 0.5, Math.PI);
    if (MEM.lanternDown) MEM.lanternDown = null;   // back in his hand
    PARTNER.mode = 'follow'; G.setHold(true);
    STATE.sceneShot = false; G.releaseCamera(); G.CAM.yaw = 0; G.CAM.pitch = 0.16; G.CAM.cut = true;
  });
  if (asHer) { G.swapBodies(); PARTNER.mode = 'follow'; G.setHold(true); G.CAM.cut = true; }   // you're her now; he holds on
  STATE.noControl = false; STATE.busy = false;
  G.hint(asHer ? '(Walk back to the lanterns. He doesn’t let go of your hand.)' : '(Walk her back to the lanterns.)', 6);
  await until(() => !live() || PLAYER.z < 24.5);
  if (asHer && G.NIGHT && G.NIGHT.swapped && !live()) G.swapBodies();
  if (!live()) return;
  STATE.noControl = true;
  await N('(You came over. That part, everyone agrees on.)');
  const f = G.$('fade'); f.style.transition = 'opacity 2.4s'; G.fade(true, '#ffffff');
  await wait(2.6); f.style.transition = '';
  G.setHold(false);
  if (G.NIGHT && G.NIGHT.swapped) G.swapBodies();   // back to who's who before the morning
  S.flags.noTogether = false; S.flags.noBarks = false; S.flags.noInteract = false; STATE.bounds = null;
  return go('morning');
};

CH.morning = async () => {
  checkpoint('morning');
  const f = G.$('fade');
  if (!f.classList.contains('on')) { f.style.background = '#ffffff'; f.classList.add('on'); await wait(0.7); }
  quiet(); STATE.busy = true;
  G.useKids(false); showFair(false);
  G.post.grade.uniforms.uMem.value = 0; STATE.fog = null;
  G.setTime({ day: 1, tod: 0, snow: 0.12 }, true);
  houseFor('morning');
  Object.assign(S.flags, { teaMade: false, pancakesMade: false, breakfastDone: false, leaveHouse: false, cuddled: false });
  const B = G.BED;
  G.cuddleInBed(PLAYER, PARTNER); PARTNER.mode = 'lying'; PARTNER.lidsClosed = true;   // she's curled against him, asleep
  STATE.sceneShot = true; G.setShot(bedShot());
  await wait(0.4);
  f.style.transition = 'opacity 2.2s'; f.classList.remove('on'); wait(2.4).then(() => { f.style.transition = ''; f.style.background = ''; });
  await G.UI.act('I', 'Shared Life', { white: false });
  if (G.herDawn && !S.flags.dawnDone && !window.SKIP_DAWN) { await G.herDawn(); G.cuddleInBed(PLAYER, PARTNER); PARTNER.mode = 'lying'; PARTNER.lidsClosed = true; STATE.sceneShot = true; G.setShot(bedShot()); STATE.busy = true; }
  G.setShot(bedCloseShot(), false);
  await N('(The first real snow of the winter came in the night. Morning. Warm. Someone is breathing, very softly, against your neck.)', { shot: 'keep' });
  await P('…Mm. Don’t move, {toHim}. You’re warm.', { shot: 'keep' });
  await Y('You have taken the entire blanket.', { shot: 'keep' });
  PARTNER.lidsClosed = false;
  await P('Our blanket.', { shot: 'keep' });
  await Y('It is entirely on your side.', { shot: 'keep' });
  await P('I don’t recognise sides. Not before nine.', { shot: 'keep' });
  const c = await choose(['Stay a little longer', 'Steal the blanket back', 'Get up']);
  if (c === 0) {
    addBond(1); S.mem.affection++;
    PARTNER.lidsClosed = true;
    await N('(You stay. She settles into your side as though she were measured for it.)', { shot: 'keep' });
    await P('Good. That was the correct answer.', { shot: 'keep' });
    await P('It snowed all night, by the way. We are officially snowed in.', { shot: 'keep' });
    await Y('You said that into my shoulder.', { shot: 'keep' });
    await P('Then your shoulder may consider itself informed.', { shot: 'keep' });
    PARTNER.lidsClosed = false;
  } else if (c === 1) {
    addRivalry(1);
    await slideBlanket(-1);
    await N('(One heroic tug. The blanket is yours. Briefly.)', { shot: 'keep' });
    await P('Theft. First thing in the morning. I’m shocked, {dear}.', { shot: 'keep' });
    await slideBlanket(0.35);
    await N('(It is back on her side within four seconds. You did not see how.)', { shot: 'keep' });
    await P('Good morning, all the same. Thief.', { shot: 'keep' });
    addScrap('blanket', 'The Great Blanket Robbery. (Lasted four seconds.)');
  } else {
    await N('(You begin to get up. A pillow meets the back of your head.)', { shot: 'keep' });
    await P('Traitor.', { shot: 'keep' });
    await P('…Good morning, traitor.', { shot: 'keep' });
  }
  await P('Hello, {dear}.', { shot: 'keep' });
  await Y('Hello, {dear}.', { shot: 'keep' });
  await P('Good. Now it’s officially morning, {toHim}.', { shot: 'keep' });
  await Y('Officially, {toHer}.', { shot: 'keep' });
  await P('On snow days, whoever wakes first makes breakfast. I believe that’s the law.', { shot: 'keep' });
  await Y('You woke up first.', { shot: 'keep' });
  await P('I have no recollection of that. …Pancakes, please. I’ll be up in a minute.', { shot: 'keep' });
  await G.cutTo(() => {
    G.standAt(PLAYER, 1.1, -0.5, Math.PI / 2);
    G.shapeBed({ R: true }, c === 1 ? 0.35 : 0);
    PARTNER.lieLook = -0.2; PARTNER.lidsClosed = true;
    if (G.herRoute()) { Story.partnerGetsUp(true); PARTNER.lidsClosed = false; }   // playing as her: she's up too, and it's her turn
    STATE.sceneShot = false; G.releaseCamera(); G.CAM.yaw = -Math.PI / 2 + Math.PI; G.CAM.cut = true;
  });
  STATE.busy = false;
  G.hint(G.MOBILE ? 'Tap Use near things to interact. Tap ♥ near {P} to be together. ◉ takes a photo.' : `${G.keyFor('interact')} or Space: interact.   ${G.keyFor('together')}: be together (hug, hold hands, talk).   ${G.keyFor('photo')}: take a photo.   ${G.keyFor('view')}: first person.`, 9);
  // She gets up on her own after a while; never in front of you mid-move.
  const run = S.run, live = () => S.run === run;
  (async () => {
    await wait(30);
    await until(() => !live() || !PARTNER.lie || (!G.busy() && (PLAYER.x > 5.2 || Math.random() < 0.02)));
    if (!live() || !PARTNER.lie) return;
    if (PLAYER.x < 5.2) await G.cutTo(() => Story.partnerGetsUp(true)); else Story.partnerGetsUp();
  })();
  // Birdsong now and then, and a nudge toward the kitchen if you dawdle.
  (async () => { while (live()) { await wait(7 + Math.random() * 10); if (STATE.day > 0.5 && !STATE.paused) G.Audio.chirp(); } })();
  (async () => {
    let idle = 0, i = 0;
    const lines = () => (S.flags.pancakesMade ? ['(She’s at the kitchen table. With a fork. Waiting.)'] : ['(Pancakes. She did say pancakes.)', '(The kitchen is through the living room, past the fire.)']);
    while (live() && !S.flags.breakfastDone) { await wait(5); idle = PLAYER.speed < 0.1 && !G.busy() ? idle + 5 : 0; if (idle > 40) { const L = lines(); G.hint(L[i++ % L.length], 5); idle = -20; } }
  })();
  await until(() => S.flags.breakfastDone);
  G.setHold(false);
  PARTNER.lead = { x: 6.45, z: 7.95, waitLines: ['Boots, {toHim}. The walk awaits.', 'Do come along, {toHim}.', 'The day isn’t getting any younger. Nor are you.'] };
  G.bark('Boots, please! The snow won’t wait.', 2.8);
  await until(() => S.flags.leaveHouse || (PLAYER.z > 6.9 && Math.abs(PLAYER.x - 6.5) < 2.2));
  STATE.noControl = true;
  PARTNER.lead = null;
  return go('walk');
};

/* The walk is the next part of the port; for now the day passes on a card and the evening picks up at home. */
async function slideBlanket(to) {
  const B = G.BED; let s = B.shift || 0; const from = s;
  for (let t = 0; t <= 1.001; t += 1 / 24) { s = from + (to - from) * G.smooth(0, 1, t); G.shapeBed({ L: true, R: true }, s); await wait(1 / 40); }
  B.shift = to;
}
CH.walk = async () => {
  STATE.busy = true;
  const f = G.$('fade'); f.style.transition = 'opacity 1.6s'; f.classList.add('on'); await wait(1.7); f.style.transition = '';
  await G.UI.card(['The walk.', 'The meadow, the hill, the frozen lake —', 'and the long way home.'], { hold: 4.6, stagger: 0.9 });
  return go('evening');
};
CH.evening = async () => {
  checkpoint('evening');
  const f = G.$('fade');
  if (!f.classList.contains('on')) { f.classList.add('on'); await wait(0.7); }
  quiet();
  G.useKids(false); showFair(false); G.post.grade.uniforms.uMem.value = 0; STATE.fog = null;
  G.setTime({ day: 0, tod: 0, snow: 1 }, true);
  houseFor('evening');
  Object.assign(STATE, { cuddled: false, cakeDone: false, porchDone: false });
  G.Story.intro();
  await wait(0.9);
  f.classList.remove('on');
};
G.setCake = setCake;
G.CH = CH; G.go = go;

const bench = findInter('bench');
bench.label = () => (ch() === 'evening' ? (STATE.porchDone ? 'Bench' : 'Watch the stars') : 'Sit on the bench');
bench.act = () => { if (ch() === 'evening') return G.Story.porch(); return run(() => sitFree(SEATS.bench), 'bench'); };
G.$('pScrap').addEventListener('click', () => { G.UI.scrapbook(S.scrap); });
// For the other story files (life.js, walk.js): the same helpers this file uses.
/* =====================================================================
 * The evening, after the cake: the photograph in the hall, the porch lanterns and her present,
 * and the firefly on the bench.
 * ===================================================================== */
const EVE = (G.EVE = {});
// The photograph: painted here, so it can be the night you actually had (who ended up with the scarf).
function paintPhoto() {
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 240; const x = cv.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, 240); sky.addColorStop(0, '#26304a'); sky.addColorStop(0.55, '#52577a'); sky.addColorStop(1, '#c9c6d4');
  x.fillStyle = sky; x.fillRect(0, 0, 320, 240);
  // lanterns, out of focus behind them
  for (let i = 0; i < 14; i++) { const lx = 20 + i * 22 + Math.sin(i * 3.1) * 6, ly = 78 + Math.sin(i * 1.7) * 10, r = 9 + (i % 3) * 3; const g = x.createRadialGradient(lx, ly, 0, lx, ly, r); g.addColorStop(0, 'rgba(255,214,140,0.95)'); g.addColorStop(0.6, 'rgba(255,170,80,0.45)'); g.addColorStop(1, 'rgba(255,150,60,0)'); x.fillStyle = g; x.beginPath(); x.arc(lx, ly, r, 0, 7); x.fill(); }
  // dark trees at the edges
  x.fillStyle = 'rgba(28,36,40,0.85)'; for (const [tx, h] of [[18, 120], [44, 90], [292, 110], [268, 80]]) { x.beginPath(); x.moveTo(tx, 170 - h); x.lineTo(tx - 22, 172); x.lineTo(tx + 22, 172); x.fill(); }
  // snow, and the log
  x.fillStyle = '#e7e6ee'; x.fillRect(0, 168, 320, 72);
  x.fillStyle = '#5a4434'; x.fillRect(96, 172, 136, 16); x.fillStyle = '#efeef5'; x.fillRect(98, 168, 132, 5);
  // two small figures on it
  const kid = (cx, coat, hat, scarf) => { x.fillStyle = coat; x.fillRect(cx - 11, 140, 22, 32); x.fillStyle = '#e9c3a8'; x.beginPath(); x.arc(cx, 132, 9, 0, 7); x.fill(); x.fillStyle = hat; x.beginPath(); x.arc(cx, 128, 9.5, Math.PI, 0); x.fill(); x.beginPath(); x.arc(cx, 117, 3.5, 0, 7); x.fill(); if (scarf) { x.fillStyle = '#b8322a'; x.fillRect(cx - 10, 140, 20, 6); x.fillRect(cx + 2, 144, 5, 14); } x.fillStyle = '#3b3440'; x.fillRect(cx - 9, 172, 7, 12); x.fillRect(cx + 2, 172, 7, 12); };
  const given = !!S.flags.scarfGiven;
  kid(145, '#3a3f4a', '#5b5f68', !given);   // him
  kid(183, '#d9cfbf', '#ece4d6', given);    // her
  // falling snow, grain, a soft vignette: an old print
  x.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 90; i++) { x.beginPath(); x.arc((i * 73) % 320, (i * 151) % 240, 0.6 + (i % 3) * 0.5, 0, 7); x.fill(); }
  const id = x.getImageData(0, 0, 320, 240), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 18; d[i] = Math.min(255, d[i] * 1.04 + n + 8); d[i + 1] += n + 2; d[i + 2] = d[i + 2] * 0.9 + n; } x.putImageData(id, 0, 0);
  const vg = x.createRadialGradient(160, 120, 60, 160, 120, 200); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,25,10,0.5)'); x.fillStyle = vg; x.fillRect(0, 0, 320, 240);
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
}
// The frame on the hall wall, by the coats: empty until the evening.
(function buildFrame() {
  const g = new THREE.Group(); g.position.set(7.75, 1.52, 4.43); g.rotation.y = Math.PI;   // facing into the room
  const wood = G.MAT.darkWood || G.std({ color: '#3a2a20' });
  const bar = (w, h, x2, y2) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), wood); m.position.set(x2, y2, 0); m.castShadow = true; g.add(m); };
  bar(0.44, 0.04, 0, 0.17); bar(0.44, 0.04, 0, -0.17); bar(0.04, 0.38, -0.2, 0); bar(0.04, 0.38, 0.2, 0);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.3), G.std({ color: '#efe6d6', roughness: 0.9 })); back.position.z = -0.004; g.add(back);
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.225), G.std({ color: '#ffffff', roughness: 0.6 })); photo.position.z = 0.002; photo.visible = false; g.add(photo);
  G.world.add(g); EVE.photo = photo;
})();
EVE.showPhoto = () => { if (EVE.photo.visible) return; EVE.photo.material.map = paintPhoto(); EVE.photo.material.needsUpdate = true; EVE.photo.visible = true; };
// Paper lanterns on a string along the porch beam, unlit until the evening.
(function buildLanterns() {
  const mat = G.std({ color: '#d99a5c', roughness: 0.85, emissive: '#ff7a24', emissiveIntensity: 0 });   // warm paper, not bulbs
  // Lit, a paper lantern isn't an even disc of light: it's brightest and palest straight through the middle, deepening
  // to orange round its rim where you see the paper edge-on, crossed by the darker hoops of its wire frame, with a
  // dark little cap top and bottom. The hoops show by day too.
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vLP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvLP = position;');
    sh.fragmentShader = 'varying vec3 vLP;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
	float lyy = vLP.y / 0.11;
	float lrib = 0.8 + 0.2 * smoothstep( 0.0, 0.45, abs( sin( lyy * 3.14159 * 4.5 ) ) );
	float lcap = smoothstep( 0.8, 0.93, abs( lyy ) );
	diffuseColor.rgb *= lrib * ( 1.0 - lcap * 0.7 );`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	{
		float core = pow( saturate( dot( normal, normalize( vViewPosition ) ) ), 0.9 );
		totalEmissiveRadiance *= mix( vec3( 1.0, 0.42, 0.14 ), vec3( 1.15, 0.84, 0.56 ), core ) * ( 0.35 + 0.85 * core ) * lrib * ( 1.0 - lcap * 0.9 );
	}`);
  };
  mat.customProgramCacheKey = () => 'paper-lantern';
  const wire = G.std({ color: '#2a2420', roughness: 0.9 });
  EVE.lanterns = []; EVE.lanternMat = mat;
  const x0 = 4.2, x1 = 11.0, n = 9, y = 2.18, z = 6.42;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), lx = x0 + (x1 - x0) * t, sag = Math.sin(t * Math.PI) * 0.16 * 0 + Math.sin(((t * (n - 1)) % 1) * Math.PI) * 0.0;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), mat); m.scale.set(1, 1.15, 1); m.position.set(lx, y - 0.14 - Math.abs(Math.sin(i * 1.3)) * 0.04 - sag, z); m.castShadow = false; G.world.add(m); EVE.lanterns.push(m);
  }
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, x1 - x0 + 0.3, 4), wire); line.rotation.z = Math.PI / 2; line.position.set((x0 + x1) / 2, y, z); G.world.add(line);
})();
// The firefly: a small light that should not be here. Made at boot, so nothing compiles mid-scene.
(function buildFirefly() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.25, 'rgba(220,255,120,0.8)'); g.addColorStop(1, 'rgba(160,255,80,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), color: new THREE.Color(4, 4.5, 2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false, toneMapped: false }));
  s.scale.setScalar(0.16); s.visible = false; G.scene.add(s);
  // a bright core, so it reads as a point of light whatever the post-processing does to the halo
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 3.2, 0.7), transparent: true, opacity: 0, toneMapped: false, fog: false }));
  s.add(core); core.scale.setScalar(1 / 0.16);
  EVE.fly = { s, core, on: false, t: 0 };
  G.TICKERS.add((dt) => {
    const F = EVE.fly; if (!F.on) { if (s.visible) s.visible = false; return; }
    F.t += dt; s.visible = true;
    const B = G.BENCH, t = F.t;
    // drifting in from the right, down through the snow, wandering in front of the bench
    const k = Math.min(1, t / 6);
    // out past the porch posts, in the open air in front of the bench
    s.position.set(B.x + 2.2 - k * 2.5 + Math.sin(t * 0.9) * 0.3, 2.2 - k * 0.85 + Math.sin(t * 1.7) * 0.1, B.z + 2.5 + Math.sin(t * 0.6) * 0.25);
    const blink = Math.max(0, Math.min(1, Math.sin(t * 1.5) * 2.2 + 1.3)) * (0.8 + 0.2 * Math.sin(t * 7.3));   // mostly lit, short dark gaps
    s.material.opacity = blink * Math.min(1, t * 1.5); core.material.opacity = s.material.opacity;
  });
})();
G.TICKERS.add((dt) => { const want = S.flags.lanternsLit ? 0.85 * (0.94 + Math.sin(G.simT * 3.1) * 0.04) : 0; EVE.lanternMat.emissiveIntensity = G.damp(EVE.lanternMat.emissiveIntensity, want, 3, dt); G.LANTERN_GLOW = EVE.lanternMat.emissiveIntensity / 0.85; });   // the porch lamp warms up with them (game.js)

// The frame: empty all day; after the cake, a photograph nobody put there.
inter('frame', [7.75, 1.4, 4.15], 0.8, () => (EVE.photo.visible ? 'Photograph' : 'Empty frame'), async () => {
  if (!EVE.photo.visible) { await N(cyc('frame', ['(The frame in the hall. It has been empty for as long as you’ve lived here. {dear} says it’s “waiting for the right one”.)', '(Still empty. Still waiting, apparently.)'])); return; }
  if (S.flags.photoSeen) { await N(cyc('photo', ['(Two children in the snow. You look for a long time and it still doesn’t become a memory.)', '(The lanterns in it look brighter than they did. Probably the fire.)'])); return; }
  // Step to one side of it, so you can both look (and the camera can see it, over your shoulder).
  await G.slideTo(PLAYER, 7.3, 3.86, Math.atan2(7.75 - 7.3, 4.43 - 3.86), 0.45);
  const shot = fixed(V(8.45, 1.62, 3.35), V(7.72, 1.5, 4.43), 32, 0.014);
  await N('(The frame isn’t empty any more.)', { shot });
  await N('(A photograph. Two children in the snow, side by side on a log, lanterns blurred behind them. ' + (S.flags.scarfGiven ? 'The girl is wearing a red scarf that is far too big for her.' : 'The boy has a red scarf on. The girl hasn’t got one at all.') + ')', { shot });
  // Fetch her: she ought to see this.
  if (!canHear() || dist() > 2.2) await Y('{toHer}? Come and look at this.', { shot });
  PARTNER.mode = 'script'; await G.walkTo(PARTNER, 8.05, 3.72, 1.3, Math.atan2(7.75 - 8.05, 4.43 - 3.72)); PARTNER.mode = 'still'; PARTNER.stillLook = { x: 7.75, z: 4.43, headY: 1.5 };
  G.gaze(PARTNER, [7.75, 1.5, 4.43], 6);
  await P('Did you put that there?', { shot });
  const c0 = await choose(['“I thought you did.”', '“I found it in the study.”', '“Is that us?”']);
  if (c0 === 1) { await P('You did not. The study is locked. I have the only key, and it is in my sock.', { shot }); }
  else if (c0 === 0) await P('I’ve never seen it before in my life.', { shot });
  await P('That’s us. Isn’t it.', { shot });
  await N('(Neither of you remembers anyone taking it.)', { shot });
  // What do you remember? You agree on almost nothing.
  await P('All right. What do you remember. The scarf: it was blue.', { shot });
  const c1 = await choose(['“It was red.”', '“It was blue.”', '“There wasn’t a scarf.”']);
  S.flags.saidScarf = ['red', 'blue', 'none'][c1];   // (the night remembers exactly what you said)
  if (c1 === 0) await P(S.flags.scarfGiven ? 'It was blue. Red is the one you have now. You’re mixing them up.' : 'Blue. I would stake the cake on it. What’s left of the cake.', { shot });
  else if (c1 === 1) await P('…Now you agree with me I’m not sure. That’s very unsettling, {toHim}.', { shot });
  else await P('There is a scarf right there in the photograph. …Although I don’t remember it.', { shot });
  await P('There were three trees. By the log.', { shot });
  const c2 = await choose(['“Two.”', '“A whole forest.”', '“I don’t remember any trees.”']);
  S.flags.saidTrees = ['two', 'forest', 'none'][c2];
  await P(['Three. One of them was leaning.', 'It was a fair, {dear}, not a forest. There were three.', 'You were looking at something else, then.'][c2], { shot });
  if (c2 === 2) await N('(You were. You don’t say what.)', { shot });
  await P('And the first thing you said to me. What was it?', { shot });
  const open = S.flags.fairOpen;
  const c3 = await choose(['“Are you lost?”', '“Is this seat taken?”', '“Nothing. I just sat down.”']);
  if (open != null && c3 === open) await N('(It’s the right answer. You don’t know how you know.)', { shot });
  await P('I remember it being “nice hat”.', { shot });
  await Y('I would never say “nice hat”.', { shot });
  await P('You were seven. You said all sorts.', { shot });
  await N('(You agree on nothing at all. Not the scarf, not the trees, not a word of it.)', { shot });
  await P('Except…', { shot });
  await wait(Math.min(1.8, G.Audio.whistle(1.12) + 0.3));
  const c4 = await choose(['Whistle it back', 'Hum it', 'Just smile at her']);
  if (c4 === 0) { await wait(Math.min(1.8, G.Audio.whistle(S.flags.fairWhistleKind === 1 ? 0.98 : 1.05, S.flags.fairWhistleKind === 2 ? 0.9 : 0) + 0.3)); await N(S.flags.fairWhistleKind === 2 ? '(It still comes out as mostly air. She looks delighted.)' : '(Three notes. You both know them. You always have.)', { shot }); }
  else if (c4 === 1) await N('(You hum it. Three notes. She nods along as if checking your work.)', { shot });
  else await N('(You don’t have to whistle it. You both know how it goes.)', { shot });
  await P('Three notes. That we agree on.', { shot });
  await N('(When you look at the photograph again, the lanterns in it seem a little brighter. Probably the fire.)', { shot });
  S.flags.photoSeen = 1; addBond(0.3); PARTNER.mode = 'follow'; PARTNER.stillLook = null;
  G.hint('The paper lanterns for the porch are in the box by the door.', 6);
}, () => S.chapter === 'evening' || S.chapter === 'morning');

// The porch lanterns, and her present from the study.
inter('lanterns', [7.9, 1.0, 5.9], 1.1, () => (S.flags.lanternsLit ? 'Lanterns' : 'Light the porch lanterns'), async () => {
  if (S.flags.lanternsLit) { await N(cyc('lanternsLit', ['(Nine paper lanterns, nodding a little in the wind.)', '(One of them is crooked. It was crooked last year too.)'])); return; }
  const shot = fixed(V(7.6, 1.25, 8.6), V(7.6, 1.7, 6.0), 46, 0.008);
  await N('(The lantern box: string, a lighter, nine paper lanterns that have done this every year.)', { shot });
  S.flags.lanternsLit = 1; G.Audio.chime && G.Audio.chime();
  await N('(One by one, along the porch, they come on.)', { shot, auto: 3.2 });
  if (!canHear() || dist() > 3) { PARTNER.mode = 'script'; await G.walkTo(PARTNER, 7.0, 5.7, 1.2); PARTNER.mode = 'follow'; }
  G.gaze(PARTNER, [PLAYER.x, PLAYER.y + 1.6, PLAYER.z], 8);
  const close = fixed(V(PLAYER.x + 1.2, 1.5, PLAYER.z + 1.6), V((PLAYER.x + PARTNER.x) / 2, 1.3, (PLAYER.z + PARTNER.z) / 2), 38, 0.012);
  await P('Close your eyes. Hold out your hands. Both of them.', { shot: close });
  await P('…Not like that. You look like you’re expecting a fish.', { shot: close });
  await N('(Something small and cold and heavy. A snow globe.)', { shot: close });
  await N('(Inside it: a log, two small figures, a string of lanterns no bigger than seeds. And trees.)', { shot: close });
  await P('It’s the night we met. The study has been full of glue for a month.', { shot: close });
  const c = await choose(['“How many trees are there?”', '“It’s perfect.”', 'Shake it']);
  if (c === 0) {
    await P('Seven. I didn’t remember how many there were, so I guessed.', { shot: close });
    if (S.flags.photoSeen) { await Y('You said three, earlier.', { shot: close }); await P('Earlier I was remembering. Now I’m guessing. It’s completely different.', { shot: close }); }
  } else if (c === 1) {
    await P('It isn’t. The log is a cinnamon stick. Don’t tell anyone.', { shot: close });
  } else {
    await N('(The snow goes up, and comes down slowly over the two of them, the way it did.)', { shot: close });
    await P('Careful. That’s the only weather we’ve got.', { shot: close });
  }
  if (S.flags.fairWish === 'snow') await P('I wanted it to be snowing in there forever. Somebody wished for that once.', { shot: close });
  await P('Happy first snow, {toHim}. Again.', { shot: close });
  S.flags.presentGiven = 1; addBond(0.4);
  addScrap('globe', 'A snow globe of the night we met. Seven trees, a cinnamon-stick log, and a month of glue.');
  G.hint('The bench on the porch has the best view of the sky.', 5);
}, () => S.chapter === 'evening');

G.SAPI = { EVE, S, P, Y, N, Pt, choose, wait, until, pick, dist, near, addBond, addRivalry, addScrap, cyc, checkpoint, inter, run, rewire, findInter, react, REACT, ABOUT, ROOM, DAY, SMALL, SEATS, JOIN, sitFree, canHear, hereRoom, room, sameRoom, fixed, V, CH, go, quiet, houseFor, setBreakfast, setLamps, showFair, morning };
});
