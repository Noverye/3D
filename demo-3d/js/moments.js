'use strict';
/* =========================================================================
 * Small moments that flesh out the day.
 *  The walk, between the set pieces: a snowball ambush on the path, a young pine with a branch full of snow,
 *  and a line of small tracks going off into the trees.
 *  The evening: cocoa at the hob (she takes two sugars and denies it), reading together in the window seat
 *  (she does the voices), and drawing in the frost on the kitchen window.
 *  The evening ones come back, wrong, in the night: the imitation drinks its cocoa scalding, the window
 *  has been wiped clean.
 * ========================================================================= */
(G.afterBuild = G.afterBuild || []).push(() => {
const { PLAYER, PARTNER, STATE } = G;
const A = G.SAPI, S = A.S;
const { P, Y, N, choose, wait, until, fixed, V, addBond, addRivalry, addScrap, inter, findInter } = A;
const K = (o) => ({ shot: 'keep', ...o });
const fy = (x, z) => G.floorAt(x, z);
const dist = () => Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
const walkBefore = () => S.chapter === 'walk' && !S.flags.walkMeadow;
const evening = () => S.chapter === 'evening' && !STATE.porchDone;
const back = () => { PARTNER.mode = 'follow'; PARTNER.stillLook = null; PARTNER.holdPose = null; STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true; STATE.busy = false; };
const hand = (c) => { const h = G.headPos(c); return V(h.x + Math.sin(c.yaw) * 0.2, h.y - 0.35, h.z + Math.cos(c.yaw) * 0.2); };
const chest = (c) => { const h = G.headPos(c); return V(h.x, h.y - 0.35, h.z); };
const sideShot = () => {
  const mx = (PLAYER.x + PARTNER.x) / 2, mz = (PLAYER.z + PARTNER.z) / 2, a = Math.atan2(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
  const sx = Math.cos(a), sz = -Math.sin(a), D = dist() * 0.9 + 2, look = V(mx, fy(mx, mz) + 1.1, mz);
  return fixed(V(mx + sx * D, look.y + 0.5, mz + sz * D), look, 44, 0.004);
};

/* ===================== the walk ===================== */
// A young pine beside the path, with one low branch heavy with snow.
const PINE = (() => {
  const z = 16.2, x = G.pathX(z) - 1.9, y = fy(x, z), g = new THREE.Group(); g.position.set(x, y, z); G.world.add(g);
  const needle = G.shared({ color: '#2e4a36', roughness: 0.9 }), snow = G.MAT.snow;
  G.cyl(0.07, 0.1, 1.0, G.MAT.bark, 0, 0.5, 0, { parent: g, seg: 8 });
  [[0.95, 1.1, 0.9], [0.75, 1.0, 1.55], [0.52, 0.85, 2.1], [0.3, 0.7, 2.55]].forEach(([r, h, yy]) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9), needle); c.position.y = yy; c.castShadow = true; g.add(c);
    const s = new THREE.Mesh(new THREE.ConeGeometry(r * 0.82, h * 0.42, 9), snow); s.position.y = yy + h * 0.24; g.add(s);
  });
  // the low branch, reaching out over the path
  const arm = new THREE.Group(); arm.position.set(0.15, 1.75, 0); arm.rotation.y = Math.atan2(G.pathX(z) - x, 0) - Math.PI / 2; g.add(arm);
  const br = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.4, 7), needle); br.rotation.z = -Math.PI / 2 + 0.12; br.position.x = 0.7; br.castShadow = true; arm.add(br);
  const cap = G.box(1.2, 0.09, 0.34, snow, 0.75, 0.2, 0, { parent: arm, r: 0.04 }); cap.rotation.z = -0.12;
  G.addCollider({ x0: x - 0.5, z0: z - 0.5, x1: x + 0.5, z1: z + 0.5 });
  const tip = () => arm.localToWorld(new THREE.Vector3(1.0, -0.1, 0));
  return { g, arm, cap, x, z, tip };
})();
const shakeBranch = async () => {
  const t0 = G.simT, p = PINE.tip();
  G.Audio.flump && G.Audio.flump();
  for (let i = 0; i < 4; i++) wait(i * 0.12).then(() => G.puffAt(p.x + (Math.random() - 0.5) * 0.5, p.y - 0.2 - i * 0.35, p.z + (Math.random() - 0.5) * 0.5, 16));
  PINE.cap.visible = false;
  while (G.simT - t0 < 0.9) { const k = (G.simT - t0) / 0.9; PINE.arm.rotation.x = Math.sin(k * 18) * 0.12 * (1 - k); await wait(1 / 30); }
  PINE.arm.rotation.x = 0;
};
inter('mBranch', [PINE.x + 0.9, 1.4, PINE.z], 1.3, 'Snowy branch', async () => {
  STATE.busy = true; const p = PARTNER;
  const c = await choose(['Get her to stand under it', 'Walk under it yourself', 'Leave it']);
  if (c === 2) { STATE.busy = false; return; }
  const under = PINE.tip(); under.y = 0;
  if (c === 0) {
    G.bark('What? What are you looking at? …Why are you smiling like that?', 2.6);
    p.mode = 'script'; await G.walkTo(p, under.x, under.z, 1.2); p.mode = 'still';
    G.walkTo(PLAYER, PINE.x + 0.55, PINE.z - 0.35, 1.2); await wait(0.9);
    STATE.sceneShot = true; G.setShot(sideShot());
    PLAYER.forcePose = 'wave'; await wait(0.3); PLAYER.forcePose = null;
    await shakeBranch(); p.lidsClosed = true; wait(0.6).then(() => { p.lidsClosed = false; });
    await N('(The whole branch lets go at once. She disappears, briefly, into a small private blizzard.)', K());
    await P('…', K());
    await P('I am going to remember this. On your birthday. At your wedding. On your deathbed.', K());
    addRivalry(0.4);
  } else {
    G.walkTo(PLAYER, under.x, under.z, 1.2);
    p.mode = 'script'; await G.walkTo(p, PINE.x + 0.55, PINE.z - 0.35, 1.3); p.mode = 'still';
    STATE.sceneShot = true; G.setShot(sideShot());
    await P('Stand still. There’s… something on your hat.', K());
    p.forcePose = 'wave'; await wait(0.3); p.forcePose = null;
    await shakeBranch(); G.CAM.shake = 0.6;
    await N('(It goes down the back of your neck. All of it.)', K());
    await P('Oh no. Oh dear. How did that happen.', K());
    await N('(She is not even slightly sorry. She brushes the snow off your shoulders anyway, very gently, one shoulder at a time.)', K());
    addBond(0.4);
  }
  addScrap('branch', c === 0 ? 'A branch full of snow on the path. She has sworn revenge.' : 'A branch full of snow on the path, and down the back of your neck.');
  S.flags.mBranch = 1; back();
}, () => walkBefore() && !S.flags.mBranch && S.flags.walkSkip !== 'mBranch' && dist() < 7);

// Small tracks in the fresh snow, going off into the trees.
const TRACKS = { z: 25.6, x: () => G.pathX(25.6) + 1.1, laid: false };
function layTracks() {
  if (TRACKS.laid || !G.addFootprint) return; TRACKS.laid = true;
  const x0 = TRACKS.x(), z0 = TRACKS.z;
  for (let k = 0; k < 16; k++) {
    const t = k / 15, x = x0 + t * 4.2 + Math.sin(k * 0.9) * 0.15, z = z0 + t * 2.4 + Math.sin(k * 1.7) * 0.1;
    G.addFootprint(x + (k % 2 ? 0.05 : -0.05), z, Math.atan2(4.2, 2.4), k % 2, 0.26, true);
  }
}
inter('mTracks', [TRACKS.x() + 0.6, 0.3, TRACKS.z + 0.3], 1.2, 'Tracks', async () => {
  STATE.busy = true; const p = PARTNER;
  p.mode = 'script'; await G.walkTo(p, TRACKS.x() + 0.2, TRACKS.z - 0.6, 1.1); p.mode = 'still';
  p.stillLook = { x: TRACKS.x() + 3, z: TRACKS.z + 2, headY: fy(TRACKS.x(), TRACKS.z) + 0.2 };
  STATE.sceneShot = true;
  G.setShot(fixed(V(TRACKS.x() - 1.4, fy(TRACKS.x(), TRACKS.z) + 1.7, TRACKS.z - 2.0), V(TRACKS.x() + 2.2, fy(TRACKS.x(), TRACKS.z) + 0.1, TRACKS.z + 1.4), 46, 0.004));
  await N('(Small tracks, neat and close together, coming out of nowhere and going off into the trees.)', K());
  await P('*whispering* A fox. Has to be a fox.', K());
  const c = await choose(['Follow them a little way', '“Why are we whispering?”', 'Leave the fox in peace']);
  if (c === 0) {
    G.Audio.paws(10);
    await N('(You follow them to the edge of the trees. They stop at a fallen branch, go round it twice, and carry on, as if whoever made them had to think about it.)', K());
    await P('A fox with opinions. My favourite kind.', K());
    addBond(0.2);
  } else if (c === 1) {
    await P('*whispering* Because it might be listening. *normal* …It’s probably not listening.', K());
    await P('*whispering* But it might be.', K());
  } else {
    await P('Yes. Let it have its morning. It’s had a big night, probably.', K());
    S.vars.trust = (S.vars.trust || 0) + 0.2;
  }
  addScrap('fox', 'Fox tracks off into the trees. (A fox with opinions.)');
  S.flags.mTracks = 1; back();
}, () => walkBefore() && !S.flags.mTracks && S.flags.walkSkip !== 'mTracks');

// The ambush: half-way down the path she gets you first.
async function ambush() {
  S.flags.mAmbush = 1; STATE.busy = true; const p = PARTNER;
  if (dist() < 3) { const a = Math.atan2(p.x - PLAYER.x, p.z - PLAYER.z); p.mode = 'script'; await G.walkTo(p, PLAYER.x + Math.sin(a) * 3.4, PLAYER.z + Math.cos(a) * 3.4, 2.2); }
  p.mode = 'still'; p.yaw = Math.atan2(PLAYER.x - p.x, PLAYER.z - p.z); p.stillLook = null;
  // over his shoulder, high enough to clear the path's banks: her, winding up
  { const a = Math.atan2(p.x - PLAYER.x, p.z - PLAYER.z), cx = PLAYER.x - Math.sin(a) * 2.3 + Math.cos(a) * 0.6, cz = PLAYER.z - Math.cos(a) * 2.3 - Math.sin(a) * 0.6;
    STATE.sceneShot = true; G.setShot(fixed(V(cx, Math.max(fy(cx, cz), fy(PLAYER.x, PLAYER.z)) + 1.9, cz), V(p.x, fy(p.x, p.z) + 1.1, p.z), 44, 0.004)); }
  await wait(0.3);
  p.forcePose = 'throw'; await wait(0.4); p.forcePose = null;
  await G.throwSnow(hand(p), chest(PLAYER), 0.55);
  G.Audio.thwump(); G.CAM.shake = 1; PLAYER.lidsClosed = true; wait(0.35).then(() => { PLAYER.lidsClosed = false; });
  await P('Ambush! That one was for the blanket.', K());
  const c = await choose(['Throw one back', 'Surrender', 'Charge her']);
  if (c === 0) {
    const [sc] = await G.UI.timing({ title: 'Throw one back', rounds: 1, zone: [0.58, 0.74], labels: ['Miles off.', 'Close!', 'Direct hit.'] });
    PLAYER.forcePose = 'throw'; await wait(0.4); PLAYER.forcePose = null;
    const to = sc > 0.5 ? chest(p) : V(p.x + 0.8, fy(p.x, p.z) + 0.05, p.z + 0.4);
    await G.throwSnow(hand(PLAYER), to, 0.55); G.Audio.thwump();
    if (sc > 0.5) { p.lidsClosed = true; wait(0.4).then(() => { p.lidsClosed = false; }); await P('Right in the scarf! That’s a war crime.', K()); addRivalry(0.4); }
    else await P('Missed! Your aim is as bad as your whistling.', K());
  } else if (c === 1) {
    await P('Surrender accepted. Terms: you carry my gloves for the rest of the walk, and you say I’m the best at snow.', K());
    await Y('You’re the best at snow.', K());
    await P('I know. It’s nice to hear, though.', K());
    addBond(0.3);
  } else {
    p.mode = 'stay';
    STATE.sceneShot = false; G.releaseCamera();
    await G.walkTo(PLAYER, p.x - Math.sin(p.yaw) * -0.7, p.z - Math.cos(p.yaw) * -0.7, 2.6);
    STATE.busy = false;
    if (G.hug) { await G.hug('hug', 'Truce! Truce! …You’re freezing. You’re a snowman.'); await until(() => !G.busy()); }
    STATE.busy = true;
    addBond(0.4); addRivalry(0.2);
  }
  addScrap('ambush', 'Ambushed on the path. (It was for the blanket.)');
  back();
}
G.TICKERS.add(() => {
  if (S.chapter !== 'walk') return;
  if (S.flags.walkSkip !== 'mTracks') layTracks();
  if (walkBefore() && !S.flags.mAmbush && S.flags.walkSkip !== 'mAmbush' && !G.busy() && PLAYER.z > 19.5 && PLAYER.z < 27 && !PARTNER.hidden && dist() < 9 && !STATE.noControl) A.run(ambush);
});
// A new walk lays fresh tracks and a fresh branch.
(G.onJump = G.onJump || []).push(() => { PINE.cap.visible = true; });

/* ===================== the evening ===================== */
// Cocoa at the hob.
const KX = () => (G.KITCHEN && G.KITCHEN.stove && G.KITCHEN.stove.x) || 12.35;
const cocoaScene = async () => {
  STATE.busy = true; const p = PARTNER, kx = KX();
  await G.cutTo(() => { G.setDressed(PLAYER, false); G.setDressed(p, false); G.standAt(PLAYER, kx - 0.35, -1.25, Math.PI + 0.2); G.standAt(p, kx + 0.38, -1.2, Math.PI - 0.3); p.mode = 'still'; }, 0.35);
  const shot = fixed(V(kx + 0.1, 1.55, 0.2), V(kx, 1.0, -1.5), 42, 0.012);
  STATE.sceneShot = true; G.setShot(shot);
  G.steam && G.steam('cocoa', kx + 0.15, 0.98, -1.5, { rate: 3, dur: 25, size: 0.8 });
  await N('(Milk in the little pan. She stands too close to the hob, and too close to you, on purpose.)', { shot });
  await Y('How many sugars?', { shot });
  await P('One.', { shot });
  await N('(She watches you put in one. Then she reaches past you and puts in a second.)', { shot });
  await P('That one doesn’t count. It fell.', { shot });
  const c = await choose(['“It fell?”', 'Put in a third', 'Say nothing']);
  if (c === 0) await P('From a great height. It was very sad. We don’t talk about it.', { shot });
  else if (c === 1) { addRivalry(0.3); await P('…I respect that. I will deny all three.', { shot }); }
  else { addBond(0.3); await N('(You let it go. She hums, and leans on you while it heats.)', { shot }); }
  await N('(She drinks hers far too soon, burns her tongue, and complains about it for ten minutes. After that she blows on every single mouthful for ages.)', { shot });
  await P('Don’t look at me like that. It’s a perfectly normal amount of blowing.', { shot });
  S.flags.eveCocoa = 1;
  addScrap('cocoa', 'Cocoa at the hob. One sugar. (Two. The second one fell.)');
  await G.cutTo(() => { G.standAt(PLAYER, kx - 0.5, -0.4, 0); G.standAt(p, kx + 0.5, -0.35, 0); }, 0.3);
  back();
};
// The kettle's "Make cocoa": the first time in the evening it's this scene, then the usual mugs.
{ const k = findInter('kettle'), raw = k.raw; A.rewire('kettle', async () => { if (evening() && !S.flags.eveCocoa && !PARTNER.hidden) return cocoaScene(); return raw(); }); }

// Reading together in the window seat.
inter('mRead', [G.NOOK.x, 0.6, G.NOOK.z + 0.6], 1.0, 'Read together', async () => {
  STATE.busy = true; const p = PARTNER, Nk = G.NOOK;
  await G.cutTo(() => { G.setDressed(PLAYER, false); G.setDressed(p, false); G.sitAt(PLAYER, Nk.x + 0.32, Nk.z, 0, Nk.seatY); G.sitAt(p, Nk.x - 0.3, Nk.z, 0, Nk.seatY); p.mode = 'seated'; p.holdPose = 'read'; }, 0.35);
  const shot = fixed(V(Nk.x - 0.45, 1.25, Nk.z + 0.95), V(Nk.x + 0.12, 0.88, Nk.z - 0.05), 56, 0.012);   // inside the alcove, past the curtains
  STATE.sceneShot = true; G.setShot(shot);
  await N('(The window seat, the snow going past the glass behind you, and the book you’re both halfway through. She reads. She does all the voices.)', { shot });
  G.Audio.page();
  await P('“…and the lighthouse keeper turned, and said—” No. You do him. You do the gruff ones.', { shot });
  const c = await choose(['Do the voice', 'Do the voice, very badly', '“I’ve never done a voice in my life.”']);
  if (c === 0) { await N('(You do it. It is, generously, a voice.)', { shot }); await P('Perfect. Terrible. Perfect.', { shot }); }
  else if (c === 1) { await N('(You do it as badly as you possibly can. It goes somewhere unexpected.)', { shot }); await P('That was a pirate. He is a lighthouse keeper. He’s never seen a boat he didn’t want to warn.', { shot }); addRivalry(0.2); }
  else { await P('You did a bear last winter. For a whole chapter. It was one of the best nights of my life.', { shot }); addBond(0.3); }
  p.tiltTarget = -0.28; G.Audio.page(); wait(0.9).then(() => G.Audio.page());
  await N('(Two chapters later her head is on your shoulder. She is pretending to read. She is reading ahead.)', { shot });
  await Y('You’re reading ahead.', { shot });
  await P('I would never.', { shot });
  await P('…It’s not a happy ending. Not yet. It might be by the end.', { shot });
  await P('Let’s never finish it. Let’s always be halfway through something.', { shot });
  p.tiltTarget = 0;
  S.flags.eveRead = 1;
  addScrap('reading', 'The window seat. The lighthouse keeper’s voice (terrible). “Let’s always be halfway through something.”');
  await G.cutTo(() => { p.holdPose = null; for (const k of [PLAYER, p]) k.sitTarget = k.sit = 0; G.standAt(PLAYER, Nk.x + 0.4, Nk.z + 0.9, Math.PI); G.standAt(p, Nk.x - 0.4, Nk.z + 0.9, Math.PI); }, 0.3);
  back();
}, () => evening() && !S.flags.eveRead && !PARTNER.hidden);
findInter('mRead').prio = 1;

// Drawing in the frost on the kitchen window by the table.
const FROST = (() => {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 200;
  const tex = new THREE.CanvasTexture(cv);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.44), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 1, toneMapped: false }));
  m.position.set(13.0, 1.34, (G.CAB ? G.CAB.z1 : 4.6) - 0.09); m.rotation.y = Math.PI; m.visible = false; G.world.add(m);
  return { cv, tex, m };
})();
function drawFrost(kind, extra) {
  G.Audio.squeak && G.Audio.squeak(kind === 'score' ? 4 : 3);
  const x = FROST.cv.getContext('2d'); x.clearRect(0, 0, 256, 200);
  x.strokeStyle = 'rgba(235,242,250,0.95)'; x.lineWidth = 7; x.lineCap = x.lineJoin = 'round';
  const heart = (cx, cy, s) => { x.beginPath(); x.moveTo(cx, cy + 30 * s); x.bezierCurveTo(cx - 55 * s, cy - 5 * s, cx - 25 * s, cy - 45 * s, cx, cy - 18 * s); x.bezierCurveTo(cx + 25 * s, cy - 45 * s, cx + 55 * s, cy - 5 * s, cx, cy + 30 * s); x.stroke(); };
  if (kind === 'heart') { heart(110, 100, 1.2); if (extra) { x.lineWidth = 5; heart(178, 130, 0.55); } }
  else if (kind === 'snowman') { x.beginPath(); x.arc(128, 135, 34, 0, 7); x.stroke(); x.beginPath(); x.arc(128, 75, 24, 0, 7); x.stroke(); if (extra) { x.beginPath(); x.moveTo(98, 52); x.lineTo(158, 52); x.moveTo(110, 52); x.lineTo(112, 22); x.lineTo(144, 22); x.lineTo(146, 52); x.stroke(); } }
  else { x.font = 'bold 54px Georgia, serif'; x.fillStyle = 'rgba(235,242,250,0.95)'; x.textAlign = 'center'; x.fillText('11–9', 128, 100); if (extra) { x.lineWidth = 5; x.beginPath(); x.moveTo(60, 84); x.lineTo(196, 84); x.stroke(); x.font = 'italic 30px Georgia, serif'; x.fillText('recount', 128, 150); } }
  FROST.tex.needsUpdate = true; FROST.m.visible = true;
}
inter('mFrost', [13.0, 1.35, 4.0], 1.0, 'Draw in the frost', async () => {
  STATE.busy = true; const p = PARTNER;
  await G.cutTo(() => { G.setDressed(PLAYER, false); G.setDressed(p, false); G.standAt(PLAYER, 12.35, 3.95, 0.35); G.standAt(p, 12.72, 4.05, 0.25); p.mode = 'still'; }, 0.35);
  const shot = fixed(V(13.85, 1.5, 3.15), V(12.9, 1.3, 4.5), 44, 0.012);   // from the right: the two of them, and the glass
  STATE.sceneShot = true; G.setShot(shot);
  await N('(The window by the table has frosted over from the bottom up. It’s asking for it.)', { shot });
  const c = await choose(['Draw a heart', 'Draw a snowman', 'Write the pinecone score']);
  const kind = ['heart', 'snowman', 'score'][c];
  PLAYER.forcePose = 'wave'; drawFrost(kind, false); await wait(0.6); PLAYER.forcePose = null;
  if (c === 0) { await P('Soppy. Hold on.', { shot }); p.forcePose = 'wave'; await wait(0.5); drawFrost(kind, true); p.forcePose = null; await N('(She adds a second, smaller heart next to yours. It’s lopsided. She says that’s the point.)', { shot }); addBond(0.4); }
  else if (c === 1) { await P('He’s cold. Look at him. Hold on.', { shot }); p.forcePose = 'wave'; await wait(0.5); drawFrost(kind, true); p.forcePose = null; await N('(She gives him a hat. A very tall hat. “It needed a hat. Obviously.”)', { shot }); addBond(0.2); }
  else { await P('Oh, really? Hold on.', { shot }); p.forcePose = 'wave'; await wait(0.5); drawFrost(kind, true); p.forcePose = null; await N('(She crosses it out and writes “recount” underneath, with a flourish.)', { shot }); addRivalry(0.3); }
  S.flags.eveFrost = kind;
  addScrap('frost', { heart: 'Two hearts in the frost on the kitchen window. (One lopsided, on purpose.)', snowman: 'A snowman in the frost on the kitchen window, with a very tall hat.', score: '“11–9” in the frost on the kitchen window. (“Recount.”)' }[kind]);
  back();
}, () => evening() && !S.flags.eveFrost && !PARTNER.hidden);
findInter('mFrost').prio = 1;
// Only the evening has the drawing. In the night, someone has wiped it.
G.TICKERS.add(() => { if (FROST.m.visible && S.chapter !== 'evening' && S.chapter !== 'firstsnow') FROST.m.visible = false; });
G.MOM = { drawFrost, FROST };   // (The First Snow draws in the frost again)
inter('nFrost', [13.0, 1.35, 4.0], 1.0, 'Kitchen window', async () => {
  await N('(The window you drew on this evening has been wiped. Not smudged. Clean, right to the corners, as if nobody had ever drawn on it.)');
  if (G.NIGHT) G.NIGHT.seen.add('frost');
}, () => S.chapter === 'night' && S.flags.nightUp && !S.flags.doorOpen && S.flags.eveFrost && G.NIGHT && G.NIGHT.seen && !G.NIGHT.seen.has('frost'));

/* ===================== photographs ===================== */
// In the night, one of your photographs of her has changed: at the edge of it, between the trees or by the door,
// a third shape, standing very still. The fridge shows the changed one from then on. (Only photos with her in them.)
const herIn = (ph) => /\{P\}|two of you/.test(ph.caption || '');
function alterPhoto(ph) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas'); cv.width = 320; cv.height = 240; const c = cv.getContext('2d');
      c.drawImage(img, 0, 0, 320, 240);
      // colder, a touch faded
      c.fillStyle = 'rgba(120,140,170,0.16)'; c.fillRect(0, 0, 320, 240);
      // the shape: tall, thin, slightly too still, half out of the frame on the right
      c.filter = 'blur(3px)';   // out of focus, like something nobody was focusing on
      const x = 282, g = c.createLinearGradient(0, 30, 0, 240); g.addColorStop(0, 'rgba(14,16,22,0.0)'); g.addColorStop(0.12, 'rgba(14,16,22,0.86)'); g.addColorStop(1, 'rgba(14,16,22,0.74)');
      c.fillStyle = g; c.beginPath(); c.ellipse(x, 58, 15, 19, 0, 0, 7); c.fill();
      c.beginPath(); c.moveTo(x - 13, 78); c.lineTo(x + 14, 78); c.lineTo(x + 21, 240); c.lineTo(x - 20, 240); c.closePath(); c.fill();
      c.fillStyle = 'rgba(14,16,22,0.7)'; c.fillRect(x - 21, 86, 7, 90); c.fillRect(x + 14, 86, 7, 90);   // arms, hanging straight down
      c.filter = 'none';
      res(cv.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => res(null);
    img.src = ph.src;
  });
}
inter('nPhotos', [14.45, 1.1, -1.4], 0.8, 'Photographs on the fridge', async () => {
  const ph = S.photos.filter(herIn).slice(-1)[0]; if (!ph) return;
  STATE.busy = true;
  if (!ph.altered) {
    const src = await alterPhoto(ph);
    if (src) {
      ph.src = src; ph.altered = true; ph.caption = ph.caption.replace('The two of you', 'The three of you');
      const sp = S.scrap.find((p) => p.art === 'photo' && p.caption && p.caption.replace('The two of you', 'The three of you') === ph.caption); if (sp) { sp.src = src; sp.caption = ph.caption; }
      if (G.refreshFridge) G.refreshFridge();
    }
  }
  S.flags.photoAltered = 1; if (G.NIGHT) G.NIGHT.seen.add('photo2');
  G.observe('photo_fridge', 'It found itself in one of the photographs. I thought it would like that.');
  const pol = G.$('polaroid'); pol.querySelector('img').src = ph.src; pol.querySelector('p').textContent = G.fmt(ph.caption); pol.classList.add('show'); setTimeout(() => pol.classList.remove('show'), 5200);
  await N('(Your photographs, on the fridge door. The one you took of her today.)');
  await N('(At the edge of it, half out of the frame, someone is standing very still. You were the one holding the camera. There was nobody else there.)');
  STATE.busy = false;
}, () => S.chapter === 'night' && S.flags.nightUp && !S.flags.doorOpen && G.NIGHT && G.NIGHT.seen && !G.NIGHT.seen.has('photo2') && S.photos.some(herIn));
findInter('nPhotos').prio = 2;

// Now and then in the evening she suggests one of them, if you haven't done it yet.
(() => {
  let idle = 0;
  G.TICKERS.add((dt) => {
    if (!evening() || G.busy() || PARTNER.hidden || PARTNER.task || STATE.cuddled && STATE.cakeDone && S.flags.eveCocoa && S.flags.eveRead && S.flags.eveFrost) { idle = 0; return; }
    idle += (PLAYER.speed < 0.2 ? 1 : 0.4) * dt;
    if (idle < 45) return; idle = -30;
    const opts = [];
    if (!S.flags.eveCocoa) opts.push('Cocoa? The kettle’s right there. I’ll supervise. I’m an excellent supervisor.');
    if (!S.flags.eveRead) opts.push('We could read a bit. The lighthouse keeper is in terrible trouble.');
    if (!S.flags.eveFrost) opts.push('The kitchen window’s all frosted. I’m just saying.');
    if (opts.length) G.bark(opts[Math.floor(Math.random() * opts.length)], 3.2);
  });
})();
});
