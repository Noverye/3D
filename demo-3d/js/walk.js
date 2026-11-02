'use strict';
/* =========================================================================
 * The walk (end of Act I): out past the end of the path into the fresh snow.
 * A pinecone contest in the meadow, a race up the hill to the bench, flat
 * stones skittering across the frozen lake, then the summer circle: a ring
 * of green grass and flowers in the snow, warm air, and two sets of
 * children's footprints meeting in the middle. Home hand in hand at sunset.
 * ========================================================================= */
(G.afterBuild = G.afterBuild || []).push(() => {
const { PLAYER, PARTNER, STATE } = G;
const A = G.SAPI, S = A.S;
const { P, Y, N, choose, wait, until, fixed, V, addBond, addRivalry, addScrap } = A;
const K = (o) => ({ shot: 'keep', ...o });
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const dist = () => Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
const fy = (x, z) => G.floorAt(x, z);

/* ---------- places ---------- */
const STUMP = { x: 3.6, z: 37.2 };
const HILLB = { x: G.HILL.x, z: G.HILL.z + 0.2 };   // the bench on the hilltop, facing the lake
const SHORE = { x: 6.2, z: 43.2 };
const CIRCLE = { x: -3.6, z: 45.0, r: 2.3 };
G.inCircle = (x, z) => S.flags.circleShown && Math.hypot(x - CIRCLE.x, z - CIRCLE.z) < CIRCLE.r;

const W = G.world;
// An old stump in the meadow, with a cap of snow.
(() => {
  const y = fy(STUMP.x, STUMP.z);
  G.cyl(0.32, 0.38, 0.5, G.MAT.bark, STUMP.x, y + 0.2, STUMP.z, { seg: 14 });
  G.cyl(0.3, 0.3, 0.02, G.shared({ color: '#c49a6a', roughness: 0.9 }), STUMP.x, y + 0.455, STUMP.z, { seg: 14 });
  G.cyl(0.3, 0.33, 0.07, G.MAT.snow, STUMP.x, y + 0.49, STUMP.z, { seg: 14 });
  G.addCollider({ x0: STUMP.x - 0.38, z0: STUMP.z - 0.38, x1: STUMP.x + 0.38, z1: STUMP.z + 0.38 });
})();
// The bench on top of the hill.
(() => {
  const y = fy(HILLB.x, HILLB.z), g = new THREE.Group(); g.position.set(HILLB.x, y, HILLB.z); W.add(g);
  const wood = G.MAT.darkWood;
  G.box(1.5, 0.06, 0.42, wood, 0, 0.45, 0, { parent: g });
  G.box(1.5, 0.3, 0.05, wood, 0, 0.72, -0.21, { parent: g });
  for (const dx of [-0.65, 0.65]) { G.box(0.07, 0.46, 0.07, wood, dx, 0.22, 0.15, { parent: g }); G.box(0.07, 0.86, 0.07, wood, dx, 0.42, -0.2, { parent: g }); }
  G.box(1.52, 0.05, 0.4, G.MAT.snow, 0.08, 0.5, 0.02, { parent: g, r: 0.02 }).scale.x = 0.55;
  G.box(1.52, 0.05, 0.08, G.MAT.snow, 0, 0.9, -0.21, { parent: g, r: 0.02 });
  G.addCollider({ x0: HILLB.x - 0.78, z0: HILLB.z - 0.26, x1: HILLB.x + 0.78, z1: HILLB.z + 0.24 });
  HILLB.seatY = y + 0.48;
})();
// Pinecones and stones, for throwing.
const CONES = [], STONES = [];
(() => {
  const coneM = G.shared({ color: '#6a4a2e', roughness: 0.95 }), stoneM = G.shared({ color: '#4a4a4e', roughness: 0.45, env: 0.6 });
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 8), coneM); m.visible = false; m.castShadow = true; W.add(m); CONES.push(m); }
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 6), stoneM); m.scale.set(1, 0.4, 0.8); m.visible = false; m.castShadow = true; W.add(m); STONES.push(m); }
})();
// The summer circle: grass, wildflowers, and no snow at all.
const RING = (() => {
  const g = new THREE.Group(); g.visible = false; W.add(g);
  const y = fy(CIRCLE.x, CIRCLE.z);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(CIRCLE.r, 48), G.std({ color: '#4a7434', roughness: 0.9, env: 0.3, polygonOffset: true, polygonOffsetFactor: -2 }));
  disc.rotation.x = -Math.PI / 2; disc.position.set(CIRCLE.x, y + 0.012, CIRCLE.z); disc.receiveShadow = true; g.add(disc);
  // A soft melted edge where the snow gives way.
  const edge = new THREE.Mesh(new THREE.RingGeometry(CIRCLE.r - 0.05, CIRCLE.r + 0.35, 48), G.std({ color: '#c9d4c0', roughness: 0.85, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  edge.rotation.x = -Math.PI / 2; edge.position.set(CIRCLE.x, y + 0.013, CIRCLE.z); g.add(edge);
  const r = G.seeded(31);
  const tuftG = new THREE.ConeGeometry(0.025, 0.16, 4), tuft = new THREE.InstancedMesh(tuftG, G.std({ color: '#3f6a2c', roughness: 0.85 }), 420);
  for (let i = 0; i < 420; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (CIRCLE.r - 0.1), x = CIRCLE.x + Math.cos(a) * d, z = CIRCLE.z + Math.sin(a) * d; tuft.setMatrixAt(i, G.mtx(x, fy(x, z) + 0.07, z, 1 + r(), 0.7 + r() * 0.8, 1 + r(), r() * 6, (r() - 0.5) * 0.4, (r() - 0.5) * 0.4)); }
  G.fitInstanceBounds(tuft); tuft.castShadow = false; tuft.receiveShadow = true; g.add(tuft);
  const cols = ['#f2e26a', '#e88aa0', '#ffffff', '#b8a0e8'];
  cols.forEach((c, ci) => {
    const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 6, 4), G.std({ color: c, roughness: 0.6, emissive: c, emissiveIntensity: 0.08 }), 24);
    for (let i = 0; i < 24; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (CIRCLE.r - 0.2), x = CIRCLE.x + Math.cos(a) * d, z = CIRCLE.z + Math.sin(a) * d; fl.setMatrixAt(i, G.mtx(x, fy(x, z) + 0.13 + r() * 0.08, z, 1, 0.6, 1)); }
    G.fitInstanceBounds(fl); g.add(fl);
  });
  return g;
})();
function showCircle(on) {
  RING.visible = on; S.flags.circleShown = on;
  if (!on || RING.printed) return;
  RING.printed = true;
  // Two sets of small footprints, one from each side, stopping toe to toe in the middle.
  for (const s of [-1, 1]) {
    for (let k = 0; k < 14; k++) {
      const d = 0.28 + k * 0.33, x = CIRCLE.x + s * d, z = CIRCLE.z + (k % 2 ? 0.08 : -0.08) + Math.sin(k * 0.7) * 0.06;
      G.addFootprint(x, z, s < 0 ? Math.PI / 2 : -Math.PI / 2, k % 2, 0.58, true);
    }
  }
}
// No breath shows in the warm air inside the circle.
G.noBreath = (c) => G.inCircle(c.x, c.z);

/* ---------- throwing things: a little arc, then a puff of snow ---------- */
async function arc(m, from, to, dur, h) {
  m.visible = true;
  for (let t = 0; t <= 1.001; t += 1 / (dur * 30)) { m.position.lerpVectors(from, to, t); m.position.y += Math.sin(t * Math.PI) * h; m.rotation.x += 0.4; m.rotation.z += 0.25; await wait(1 / 30); }
  m.position.copy(to); m.rotation.set(Math.PI / 2, Math.random() * 6, 0);
}
async function slide(m, from, to, dur) {
  m.visible = true; m.position.copy(from);
  G.Audio.thwump();
  // Stones on lake ice sing: falling, bird-like pings as they skitter away.
  for (let i = 0; i < 9; i++) G.Audio.tone(2600 - i * 170 + Math.random() * 80, 0.05, 0.018 * (1 - i / 11), 0.15 + i * dur / 11);
  for (let t = 0; t <= 1.001; t += 1 / (dur * 30)) { const e = 1 - Math.pow(1 - t, 2.4); m.position.lerpVectors(from, to, e); m.position.y = G.LAKE.y + 0.02; m.rotation.y += (1 - e) * 0.5; await wait(1 / 30); }
}
const handOf = (c) => { const h = G.headPos(c); return V(h.x + Math.sin(c.yaw) * 0.25, h.y - 0.25, h.z + Math.cos(c.yaw) * 0.25); };

/* =====================================================================
 * The chapter
 * ===================================================================== */
const CH = A.CH;
let ROUTE = null;   // which beat we're on; the evening's "home" path picks up from here
CH.walk = async () => {
  A.checkpoint('walk');
  const f = G.$('fade');
  if (!f.classList.contains('on')) { f.classList.add('on'); await wait(0.7); }
  A.quiet(); STATE.busy = true;
  G.useKids(false); A.showFair(false); G.post.grade.uniforms.uMem.value = 0; STATE.fog = null;
  G.setTime({ day: 1, tod: 0, snow: 0.05 }, true);
  G.WEATHER.hold = 'clear';
  showCircle(false);
  G.setDressed(PLAYER, true); G.setDressed(PARTNER, true);
  G.placeChar(PLAYER, 6.7, 8.4, 0); G.placeChar(PARTNER, 6.0, 8.7, 0);
  STATE.sceneShot = true;
  G.setShot(fixed(V(7.6, 1.6, 13.0), V(6.4, 1.0, 8.5), 44, 0.006));
  await wait(0.3);
  f.style.transition = 'opacity 1.6s'; f.classList.remove('on'); wait(1.8).then(() => { f.style.transition = ''; });
  await G.UI.card(['The walk.'], { hold: 2.4 });
  await N('(Boots, coats, scarves wound twice. The snow has stopped, and the whole clearing is new.)', K());
  await P('Fresh snow. Nobody’s walked here but us.', K());
  await P('The meadow first. Then the hill. Then the lake. I have a plan, {toHim}, and I intend to follow it.', K());
  STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true;
  STATE.busy = false; STATE.bounds = { zMin: 8.2 };   // the cabin can wait: no going back in until the walk is done
  PARTNER.mode = 'follow';
  G.hint(G.MOBILE ? 'Follow her down the path. ♥ for snowmen and snow angels.' : `Follow her down the path. ${G.keyFor('together')} near her for snowmen, snow angels and photographs.`, 7);
  const run = S.run, live = () => S.run === run;
  // Little things she says on the way down the path.
  (async () => {
    const said = {};
    while (live() && !S.flags.walkMeadow) {
      await wait(1);
      if (G.busy()) continue;
      if (PLAYER.z > 14 && !said.a) { said.a = 1; G.bark('Look back. The cabin looks like a postcard.', 3); }
      if (PLAYER.z > 22 && !said.b) { said.b = 1; G.bark('The lanterns look odd in daylight. Like they’re waiting for their turn.', 3.4); }
    }
  })();
  // She leads to the end of the path; the walk's beats follow on as you reach them.
  await lead(6.3, 31.5, ['The meadow, {toHim}! It’s just past the end of the path.', 'Keep up. Snow waits for no one.']);
  if (!live()) return;
  await meadow(); if (!live()) return;
  await hill(); if (!live()) return;
  await lake(); if (!live()) return;
  await circle(); if (!live()) return;
  await homeward(live);
};
// Walk ahead to a place; wait for you there (and for any snowman you're in the middle of).
function lead(x, z, lines) {
  return new Promise((res) => {
    PARTNER.lead = { x, z, waitLines: lines, cb: null };
    const check = async () => {
      await until(() => !PARTNER.lead || (PARTNER.lead.arrived && Math.hypot(PLAYER.x - x, PLAYER.z - z) < 3.2 && !G.busy() && !S.flags.noTogether));
      PARTNER.lead = null; res();
    };
    check();
  });
}
const free = () => !G.busy() && !S.flags.noTogether;

async function meadow() {
  S.flags.walkMeadow = 1;
  STATE.busy = true;
  const p = PARTNER;
  G.setTime({ day: 0.92, rate: 0.05 });
  const tx = STUMP.x + 1.8, tz = STUMP.z - 3.4;   // where you both throw from
  await Promise.all([G.walkTo(PLAYER, tx + 0.35, tz, 1.3), G.walkTo(p, tx - 0.45, tz + 0.1, 1.3)]);
  PLAYER.yaw = Math.atan2(STUMP.x - PLAYER.x, STUMP.z - PLAYER.z); p.yaw = Math.atan2(STUMP.x - p.x, STUMP.z - p.z);
  p.mode = 'still'; p.stillLook = { x: STUMP.x, z: STUMP.z, headY: fy(STUMP.x, STUMP.z) + 0.4 };   // eyes on the stump
  STATE.sceneShot = true;
  const side = V(tx + 3.2, fy(tx, tz) + 1.5, tz + 1.4), mid = V((tx + STUMP.x) / 2, fy(tx, tz) + 0.6, (tz + STUMP.z) / 2);
  G.setShot(fixed(side, mid, 44, 0.004));
  await P('A contest. I’ve been collecting pinecones under the big pine since October.', K());
  await Y('Since October?', K());
  await P('Since about two minutes ago. Three each. Nearest the old stump wins.', K());
  await Y('And the prize?', K());
  await P('Eternal glory. And the loser carries the winner’s gloves.', K());
  const mine = [], hers = [];
  for (let i = 0; i < 3; i++) {
    const [sc] = await G.UI.timing({ title: i ? 'Another pinecone' : 'Throw a pinecone', rounds: 1, zone: [0.6, 0.72], speed: 1 + i * 0.15, labels: ['Wide.', 'Close.', 'Right next to it!'] });
    PLAYER.forcePose = 'throw'; await wait(0.3); PLAYER.forcePose = null;
    const off = (1 - sc) * 1.7 + 0.08 + Math.random() * 0.1, a = Math.random() * Math.PI * 2, lx = STUMP.x + Math.cos(a) * off, lz = STUMP.z + Math.sin(a) * off;
    await arc(CONES[i * 2], handOf(PLAYER), V(lx, fy(lx, lz) + 0.03, lz), 0.7, 1.2); G.puffAt(lx, fy(lx, lz) + 0.05, lz, 6);
    mine.push(off);
    // Her turn: a fair throw, mostly.
    p.forcePose = 'throw'; await wait(0.3); p.forcePose = null;
    const hoff = 0.2 + Math.random() * 1.1, b = Math.random() * Math.PI * 2, hx = STUMP.x + Math.cos(b) * hoff, hz = STUMP.z + Math.sin(b) * hoff;
    await arc(CONES[i * 2 + 1], handOf(p), V(hx, fy(hx, hz) + 0.03, hz), 0.7, 1.1); G.puffAt(hx, fy(hx, hz) + 0.05, hz, 6);
    hers.push(hoff);
    G.bark(hoff < off ? pick(['Ha!', 'Closer. Obviously.', 'Watch and learn, {dear}.']) : pick(['Bother.', 'The wind took it.', 'That one was a practice throw.']), 1.8);
    await wait(0.8);
  }
  const best = Math.min(...mine), hb = Math.min(...hers), won = best < hb;
  S.mem.pinecones = won ? 'won' : 'lost';
  if (won) {
    addRivalry(0.4);
    await N('(Your best pinecone is nearest the stump. Only just.)', K());
    await P('I demand a recount. …Fine. Here are my gloves. Carry them with honour.', K());
  } else {
    addBond(0.3);
    await N('(Her best pinecone is nearest the stump. She does a small, dignified victory dance.)', K());
    await P('My gloves, please, {toHim}. Carry them carefully. They’ve seen victory.', K());
  }
  p.mode = 'follow'; p.stillLook = null;
  addScrap('pinecones', won ? 'The pinecone contest. You won, by about a pinecone. (She asked for a recount.)' : 'The pinecone contest. She won, and did a small, dignified dance.');
  STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true; STATE.busy = false;
}

async function hill() {
  const p = PARTNER;
  STATE.busy = true;
  G.bark('See the bench on top of the hill? Race you. Three, two—', 2.2);
  await wait(1.4);
  STATE.busy = false;
  // She goes on "two". Of course she does.
  G.hint(G.MOBILE ? 'Push the stick all the way to run!' : `Hold ${G.keyFor('run')} to run!`, 4);
  const goal = { x: HILLB.x - 0.4, z: HILLB.z + 0.9 };
  let theirs = false;
  G.walkTo(p, goal.x - 0.5, goal.z, 2.45).then(() => { theirs = true; });
  await until(() => theirs || Math.hypot(PLAYER.x - goal.x, PLAYER.z - goal.z) < 1.4);
  const youWon = !theirs;
  STATE.busy = true;
  await until(() => theirs || Math.hypot(p.x - goal.x, p.z - goal.z) < 1.0);
  await wait(0.4);
  G.bark(youWon ? pick(['You have longer legs! It doesn’t count!', '*wheezing* I let you win. Strategically.']) : pick(['Concentrated! I told you!', '*wheezing* Victory. Glorious, wheezing victory.']), 3);
  if (youWon) addRivalry(0.3); else addBond(0.2);
  await wait(1.6);
  STATE.sceneShot = true;
  G.setTime({ day: 0.75, rate: 0.05 });
  const B = HILLB;
  await G.cutTo(() => {
    G.sitAt(PLAYER, B.x + 0.36, B.z + 0.02, 0, B.seatY); G.sitAt(p, B.x - 0.36, B.z + 0.02, 0, B.seatY); p.mode = 'seated';
    G.setShot(fixed(V(B.x + 0.25, B.seatY + 1.15, B.z - 2.3), V(B.x - 0.5, B.seatY + 0.1, B.z + 14), 54, 0.003));
  });
  await N('(From up here you can see all of it: the cabin, small and smoking, the meadow, the lake gone white, the mountains.)', K());
  p.tiltTarget = -0.2;
  await P('Can I ask you something, {toHim}?', K());
  await P('Do you think we’re the same people we were, when we were kids?', K());
  const c = await choose(['“No. Better.”', '“Mostly. You still cheat.”', '“I hope we keep changing.”']);
  if (c === 0) { addBond(0.6); await P('Better. I’ll take better.', K()); }
  if (c === 1) { addRivalry(0.3); addBond(0.2); await P('I do not cheat. I improvise.', K()); }
  if (c === 2) { S.vars.trust += 0.6; await P('…Yes. Me too. I think that’s the whole trick of it.', K()); }
  await P('I don’t remember much of when we met. Snow. Lanterns. You. Isn’t that strange? The most important night, and it’s mostly gone.', K());
  await Y('We remember the important part.', K());
  await P('Which part is that?', K());
  await Y('That I came over.', K());
  p.lidsClosed = true;
  await P('…Yes. That part.', K());
  p.lidsClosed = false; p.tiltTarget = 0;
  addScrap('hill', 'The bench on the hill. “Do you think we’re the same people we were when we were kids?”');
  await G.cutTo(() => {
    G.standAt(PLAYER, B.x + 0.4, B.z + 0.95, 0); G.standAt(p, B.x - 0.4, B.z + 0.95, 0); p.mode = 'follow';
    STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true;
  });
  STATE.busy = false;
  G.bark('The lake next. Down we go. Carefully. Mostly carefully.', 3);
  await lead(SHORE.x - 0.3, SHORE.z - 0.6, ['The lake, {dear}! Before the light goes.', 'Down here!']);
}

async function lake() {
  const p = PARTNER;
  STATE.busy = true;
  G.setTime({ day: 0.55, rate: 0.04 });
  await Promise.all([G.walkTo(PLAYER, SHORE.x + 0.4, SHORE.z, 1.2), G.walkTo(p, SHORE.x - 0.5, SHORE.z + 0.05, 1.2)]);
  PLAYER.yaw = p.yaw = 0;
  p.mode = 'still'; p.stillLook = { x: SHORE.x, z: SHORE.z + 9, headY: G.LAKE.y + 0.5 };
  STATE.sceneShot = true;
  G.setShot(fixed(V(SHORE.x + 1.6, fy(SHORE.x, SHORE.z) + 1.7, SHORE.z - 2.6), V(SHORE.x - 0.5, G.LAKE.y + 0.3, SHORE.z + 7), 50, 0.003));
  await N('(The lake is frozen right across, grey-white, with the snow blown into long ripples on it.)', K());
  await P('Flat stones. I hid some here in the summer, under that rock. For exactly this.', K());
  await Y('You planned this in the summer?', K());
  await P('I plan everything in the summer. Furthest one wins. Listen to them sing.', K());
  let mine = 0, hers = 0;
  for (let i = 0; i < 3; i++) {
    const [sc] = await G.UI.hold({ title: i ? 'Another stone' : 'Slide a stone', sub: i ? '' : (G.MOBILE ? 'Press and hold to wind up. Let go in the warm zone.' : 'Hold E or Space to wind up. Let go in the warm zone.'), zone: [0.66, 0.8], speed: 1.0 + i * 0.12, labels: ['Plonk.', 'Not bad.', 'Beautiful.'], over: 'It flies off into a snowdrift.' });
    PLAYER.forcePose = 'throw'; await wait(0.25); PLAYER.forcePose = null;
    const d = 2.5 + sc * 13 + Math.random() * 1.5;
    await slide(STONES[i * 2], V(SHORE.x + 0.4, G.LAKE.y, SHORE.z + 1.2), V(SHORE.x + 0.4 + (Math.random() - 0.5) * 2, G.LAKE.y, SHORE.z + 1.2 + d), 1.6 + sc);
    mine = Math.max(mine, d);
    await wait(0.4);
    p.forcePose = 'throw'; await wait(0.25); p.forcePose = null;
    const hd = 5 + Math.random() * 9;
    await slide(STONES[i * 2 + 1], V(SHORE.x - 0.5, G.LAKE.y, SHORE.z + 1.2), V(SHORE.x - 0.5 + (Math.random() - 0.5) * 2, G.LAKE.y, SHORE.z + 1.2 + hd), 2.0);
    hers = Math.max(hers, hd);
    if (i === 0) await P('Did you hear it? Like birds. Like little birds, under the ice.', K());
    else await wait(0.6);
  }
  const won = mine > hers;
  await N(won ? '(Your stone went furthest, all the way out to where the ice turns grey.)' : '(Her stone went furthest. It’s still faintly singing somewhere out on the ice.)', K());
  await P(won ? 'Well. You’ve been practising in secret. I’m furious and also impressed.' : 'The stones like me. It’s a known phenomenon.', K());
  if (won) addRivalry(0.2); else addBond(0.2);
  p.mode = 'follow'; p.stillLook = null;
  addScrap('lake', 'Stones on the frozen lake. They sang, like little birds under the ice.');
  STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true; STATE.busy = false;
  // A little free time on the ice and the shore before it gets strange.
  G.hint('The ice is safe here. Have a wander, if you like.', 4);
  const t0 = G.simT;
  await until(() => (G.simT - t0 > 25 && free()) || (G.simT - t0 > 8 && free() && Math.hypot(PLAYER.x - CIRCLE.x, PLAYER.z - CIRCLE.z) < 7));
}

async function circle() {
  const p = PARTNER;
  STATE.busy = true;
  G.setTime({ day: 0.38, rate: 0.03 });
  if (p.hold) G.setHold(false);
  if (p.task) G.endPartnerTask();
  showCircle(true);
  p.mode = 'still'; p.stillLook = { x: CIRCLE.x, z: CIRCLE.z, headY: fy(CIRCLE.x, CIRCLE.z) + 0.3 };
  p.yaw = Math.atan2(CIRCLE.x - p.x, CIRCLE.z - p.z);
  await wait(0.6);
  G.bark('{toHim}. …What is that?', 3);
  await wait(1.6);
  STATE.sceneShot = true;
  const y = fy(CIRCLE.x, CIRCLE.z);
  G.setShot(fixed(V(CIRCLE.x + 5.2, y + 2.0, CIRCLE.z - 3.6), V(CIRCLE.x, y + 0.2, CIRCLE.z), 40, 0.006));
  await N('(At the edge of the trees, a ring of green. Grass, and small flowers, white and yellow, in the middle of all this snow.)', K());
  STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true;
  // She walks to the edge of it, and no further.
  await G.walkTo(p, CIRCLE.x + CIRCLE.r + 0.9, CIRCLE.z - 0.3, 1.0);
  p.mode = 'still'; p.yaw = Math.atan2(CIRCLE.x - p.x, CIRCLE.z - p.z); p.stillLook = { x: CIRCLE.x, z: CIRCLE.z, headY: y + 0.2 }; p.holdPose = 'cold';   // arms wrapped round herself
  STATE.busy = false;
  G.hint('Go and look.', 4);
  await until(() => Math.hypot(PLAYER.x - CIRCLE.x, PLAYER.z - CIRCLE.z) < 1.1 && !G.busy());
  STATE.busy = true;
  PLAYER.yaw = Math.PI / 2; p.stillLook = { x: PLAYER.x, z: PLAYER.z, headY: PLAYER.y + 1.6 };
  PLAYER.cold = 0;
  STATE.sceneShot = true;
  G.setShot(fixed(V(CIRCLE.x - 0.6, y + 2.6, CIRCLE.z + 3.0), V(CIRCLE.x + 0.3, y + 0.3, CIRCLE.z - 0.2), 42, 0.006));
  await N('(Warm air. It smells of cut grass and July. Your breath doesn’t show.)', K());
  await N('(Two sets of footprints in the grass. Small ones: children’s. One set from each side. They stop in the middle, toe to toe, as if two children had stood right here, facing each other.)', K());
  await P('{toHim}. Come out of there. Please.', K());
  const c = await choose(['“Look at the footprints.”', '“It’s warm in here. Come and feel it.”', 'Come out']);
  S.vars.fear = (S.vars.fear || 0) + 1;
  if (c === 0) await P('I don’t want to look at them. I don’t want to know whose they are.', K());
  if (c === 1) { S.vars.fear += 0.5; await P('No. No, I don’t want to. It isn’t supposed to be warm. Nothing is supposed to be warm.', K()); }
  if (c === 2) { S.vars.trust += 0.5; await N('(You step back out into the snow. The cold closes round you again, almost kindly.)', K()); }
  STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true;
  if (c !== 2) { STATE.busy = false; G.hint('Go back to her.', 3); await until(() => !G.inCircle(PLAYER.x, PLAYER.z) && Math.hypot(PLAYER.x - p.x, PLAYER.z - p.z) < 2 && !G.busy()); STATE.busy = true; }
  else G.placeChar(PLAYER, CIRCLE.x + CIRCLE.r + 0.4, CIRCLE.z + 0.4, -Math.PI / 2);
  p.holdPose = null; p.mode = 'follow';
  await P('I want to go home.', K());
  await Y('Then we’ll go home.', K());
  G.setHold(true); p.holdTimer = null;
  G.bark('Don’t let go. Not until we’re inside.', 3);
  addScrap('circle', 'A ring of summer in the snow. Neither of you wants to talk about it.');
  S.mem.circleSeen = 1;
  STATE.busy = false;
}

async function homeward(live) {
  // The long way home, hand in hand, while the sun goes down.
  G.setTime({ day: 0, tod: 0, rate: 0.05 });
  G.WEATHER.hold = null;
  STATE.bounds = null;
  G.hint('Walk her home. The path is back past the hill.', 5);
  const said = {};
  (async () => {
    while (live()) {
      await wait(1);
      if (G.busy()) continue;
      if (!PARTNER.hold && Math.hypot(PLAYER.x - PARTNER.x, PLAYER.z - PARTNER.z) < 2.2) { G.setHold(true); PARTNER.holdTimer = null; if (!said.h) { said.h = 1; G.bark('Hand. Please.', 2); } }
      if (PLAYER.z < 40 && !said.a) { said.a = 1; G.bark('Let’s not tell anyone about that. Not even us.', 3.4); }
    }
  })();
  await until(() => !live() || (PLAYER.z < 31.5 && Math.abs(PLAYER.x - G.pathX(31)) < 3.5 && !G.busy()));
  if (!live()) return;
  STATE.noControl = true;
  G.setHold(false);
  showCircle(false);
  return A.go('evening');
}

G.WALK = { meadow, hill, lake, circle, showCircle };   // the beats, for testing
// The evening picks up on the path home at dusk; you're still in your coats.
const evening = CH.evening;
CH.evening = async () => { G.setDressed(PLAYER, true); G.setDressed(PARTNER, true); G.WEATHER.hold = null; showCircle(false); STATE.bounds = null; return evening(); };
const prevLoad = G.onLoadSave;
G.onLoadSave = (s) => { if (prevLoad) prevLoad(s); };
});
