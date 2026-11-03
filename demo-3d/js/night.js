'use strict';
/* =========================================================================
 * Act III · Recognition: the night.
 * You wake cold; her side is empty and there's a light in the kitchen. She
 * couldn't sleep either. A sleepless night together, the ordinary way: cocoa,
 * the last of the fire, the window seat, cold cake from the fridge. You tease
 * her the way you always do; she answers almost right (a line repeated word
 * for word, the toaster mentioned, a score remembered, a laugh a beat late).
 * Nothing says so. Back in bed she lies exactly on her side; then, from the
 * kitchen, three notes whistled the way only the real one whistles them, and
 * a door in the wall that has never been there. Elsewhere: for a little while
 * you are Partner, at breakfast with an imitation of you.
 * ========================================================================= */
(G.afterBuild = G.afterBuild || []).push(() => {
const { PLAYER, PARTNER, STATE } = G;
const A = G.SAPI, S = A.S;
const { P, Y, N, choose, wait, until, fixed, V, addBond, addScrap, cyc, inter, findInter, rewire, checkpoint, houseFor, quiet, CH, EVE } = A;
const K = (o) => ({ shot: 'keep', ...o });
const dist = () => Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
const night = () => S.chapter === 'night';
const NIGHT = (G.NIGHT = { clues: new Set(), door: null });

/* ---------- the door that has never been there: east wall of the kitchen, between the fridge and the study ---------- */
(() => {
  const g = new THREE.Group(); g.position.set(14.86, 0, 2.45); g.rotation.y = -Math.PI / 2; g.visible = false;
  const wood = G.MAT.darkWood || G.std({ color: '#3a2a20' });
  const frame = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), wood); m.position.set(x, y, 0); g.add(m); };
  frame(0.1, 2.05, -0.47, 1.02); frame(0.1, 2.05, 0.47, 1.02); frame(1.04, 0.1, 0, 2.08);
  // summer, through the gap: warm light and green
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 2.0), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.45, 0.9), toneMapped: false }));
  glow.position.set(0, 1.0, -0.02); g.add(glow);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.84, 2.0, 0.04), G.std({ color: '#d9cbb4', roughness: 0.8 }));
  leaf.geometry.translate(0.42, 0, 0); leaf.position.set(-0.42, 1.0, 0.01); leaf.rotation.y = -0.55; g.add(leaf);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), G.std({ color: '#b08a48', metalness: 0.8, roughness: 0.3 })); knob.position.set(0.76, 0, 0.04); leaf.add(knob);
  G.world.add(g); NIGHT.door = g; NIGHT.leaf = leaf;
})();

/* ---------- getting there: the porch ends in "Inside. Please." and the night begins ---------- */
G.goNight = async () => {
  const f = G.$('fade'); f.style.background = '#000'; f.classList.add('on'); await wait(1.4);
  return A.go('bedtime');
};

/* ---------- the photograph again: now with a third shape at the edge, between the trees ---------- */
function thirdShape() {
  const m = EVE && EVE.photo && EVE.photo.material.map; if (!m || !m.image) return;
  const x = m.image.getContext('2d');
  x.fillStyle = 'rgba(30,30,40,0.55)'; x.fillRect(260, 118, 12, 52); x.beginPath(); x.arc(266, 110, 8, 0, 7); x.fill();
  m.needsUpdate = true;
}

/* ---------- the chapter ---------- */
const B = () => G.BED;
const bedShot = () => fixed(V(B().x + 0.05, 2.2, -0.9), V(B().x + 0.02, 0.72, -1.65), 44, 0.01);
const bedClose = () => fixed(V(B().x + 0.04, 2.1, -1.28), V(B().x + 0.02, 0.76, -1.8), 34, 0.012);
/* ---------- the Entity's notes: it watches how you play (console, and kept in this browser) ---------- */
G.observe = (key, text) => {
  S.obs = S.obs || {}; S.obs[key] = (S.obs[key] || 0) + 1;
  try { const k = 'snowed.entity.observations', a = JSON.parse(localStorage.getItem(k) || '[]'); a.push({ t: Date.now(), key, text }); localStorage.setItem(k, JSON.stringify(a.slice(-80))); } catch (e) { /* private window: it forgets */ }
  try { console.log('%c' + text, 'color:#8f93a8;font-style:italic'); } catch (e) { /* */ }
};
const corrupt = (n, why) => { S.vars.corruption = (S.vars.corruption || 0) + n; G.observe('corrupt_' + why, ['It sat with me by the fire. It was warm. It stayed.', 'It agreed with me. It is easier to agree.', 'It closed its eyes beside me. Good.'][{ fire: 0, agree: 1, sleep: 2 }[why] || 1]); };
const suspect = (n, why) => { S.vars.suspicion = (S.vars.suspicion || 0) + n; G.observe('suspect_' + why, { stare: 'It looks at me for a long time. I will look back.', run: 'It moves away from me quickly. I will be slower.', confront: 'It asked me who I am. I told it.', notice: 'It noticed something. I will put it back.' }[why] || 'It is paying attention.'); };

/* ---------- bedtime: the real one, warm, and the thing she says about water ---------- */
CH.bedtime = async () => {
  checkpoint('bedtime'); STATE.watchDoor = false;
  const f = G.$('fade');
  if (!f.classList.contains('on')) { f.style.background = '#000'; f.classList.add('on'); await wait(0.6); }
  quiet(); STATE.busy = true;
  G.useKids(false); G.setDressed(PLAYER, false); G.setDressed(PARTNER, false);
  G.setTime({ day: 0, tod: 1, snow: 0.3 }, true);
  houseFor('evening'); G.FIRE.level = 0.6;
  NIGHT.door.visible = false;
  G.standAt(PLAYER, 3.2, 1.6, Math.PI); G.standAt(PARTNER, 2.5, 1.7, Math.PI); PARTNER.mode = 'still';
  STATE.sceneShot = true; G.setShot(fixed(V(4.2, 1.7, 2.6), V(2.6, 0.9, -0.6), 44, 0.01));
  await wait(0.3);
  f.style.transition = 'opacity 1.6s'; f.classList.remove('on'); wait(1.8).then(() => { f.style.transition = ''; f.style.background = ''; });
  await P('Bed. Now. I’m declaring it.', K());
  await G.cutTo(() => { G.cuddleInBed(PLAYER, PARTNER); PARTNER.mode = 'lying'; G.shapeBed({ L: true, R: true }); G.setShot(bedClose()); }, 0.5);
  if (G.herRoute()) return bedtimeHer(f);
  await P('Partner.', K());
  await Y('Partner.', K());
  await P('A good first snow?', K());
  const a = await choose(['“Top three.”', '“Apart from the firefly.”', '“Every one with you is.”']);
  if (a === 0) { await P('Top three? What were the other two?', K()); await Y('Classified.', K()); await P('I shall find out. I have methods.', K()); }
  else if (a === 1) { addBond(0.2); S.vars.trust = (S.vars.trust || 0) + 0.4; await P('…Yes. Apart from that.', K()); await N('(She finds your hand under the blanket and keeps it.)', K()); }
  else { addBond(0.6); await P('…Stop it. You can’t say things like that at night. I’ll cry on your good jumper.', K()); }
  const b = await choose(['Hold her', 'Look at her', 'Kiss her goodnight']);
  addBond(0.6);
  if (b === 0) { PARTNER.lidsClosed = true; await N('(She fits into your side as though she were measured for it.)', K()); await P('Mm. Don’t let it go to your head, {toHim}.', K()); PARTNER.lidsClosed = false; }
  else if (b === 1) { await P('You’re staring.', K()); await Y('I’m looking.', K()); await P('At me.', K()); await Y('Unfortunately.', K()); await P('You could simply admit I’m lovely.', K()); await Y('I could.', K()); await P('…Coward.', K()); }
  else { await P('Mm. A goodnight kiss. Very proper. Very old married couple.', K()); await Y('We’re not married.', K()); await P('Very old unmarried couple, then.', K()); }
  await P('If I get up for water, don’t steal my side.', K());
  await Y('You don’t recognise sides.', K());
  await P('…Touché. Goodnight, {dear}.', K());
  for (const L of G.LAMPS) L.on = false;
  G.Audio.click && G.Audio.click();
  PARTNER.lidsClosed = true;
  await N('(Snow taps at the window. You don’t remember falling asleep.)', K());
  f.style.background = '#000'; f.style.transition = 'opacity 2.2s'; f.classList.add('on'); await wait(2.4); f.style.transition = '';
  return A.go('night');
};

// Bedtime from her side: the same night, her choices, his answers.
async function bedtimeHer(f) {
  await Y('Partner.', K());
  await P('Partner.', K());
  await Y('A good first snow?', K());
  const a = await choose(['“Top three.”', '“Apart from the firefly.”', '“Every one with you is.”']);
  if (a === 0) { await Y('Top three? What were the other two?', K()); await P('Classified.', K()); await Y('I’ll find out. I have methods.', K()); await P('You have one method. It’s asking nicely.', K()); }
  else if (a === 1) { addBond(0.2); S.vars.trust = (S.vars.trust || 0) + 0.4; await Y('…Yes. Apart from that.', K()); await N('(You find his hand under the blanket and keep it.)', K()); }
  else { addBond(0.6); await Y('…Stop it. You can’t say things like that at night. I’m not equipped for it.', K()); }
  const b = await choose(['Curl into him', 'Look at him', 'Kiss him goodnight']);
  addBond(0.6);
  if (b === 0) { PARTNER.lidsClosed = true; await N('(You fit into his side as though you were measured for it.)', K()); await Y('Mm. Don’t get used to this, {toHer}.', K()); await P('Too late.', K()); PARTNER.lidsClosed = false; }
  else if (b === 1) { await Y('You’re staring.', K()); await P('I’m looking.', K()); await Y('At me.', K()); await P('Unfortunately.', K()); await Y('You could simply admit I’m charming.', K()); await P('I could.', K()); await Y('…Coward.', K()); }
  else { await Y('A goodnight kiss. Very proper. Very old married couple.', K()); await P('We’re not married.', K()); await Y('Very old unmarried couple, then.', K()); }
  await P('If I get up for water, don’t steal my side.', K());
  await Y('You don’t recognise sides.', K());
  await P('…Touché. Goodnight, {dear}.', K());
  await Y('Goodnight, {dear}.', K());
  for (const L of G.LAMPS) L.on = false;
  G.Audio.click && G.Audio.click();
  PARTNER.lidsClosed = true;
  await N('(Snow taps at the window. He’s asleep before you are. He always is.)', K());
  f.style.background = '#000'; f.style.transition = 'opacity 2.2s'; f.classList.add('on'); await wait(2.4); f.style.transition = '';
  return A.go('night');
}

/* ---------- the night ---------- */
CH.night = async () => {
  if (G.herRoute()) return nightHer();
  checkpoint('night');
  const f = G.$('fade');
  if (!f.classList.contains('on')) { f.style.background = '#000'; f.classList.add('on'); await wait(0.7); }
  quiet(); STATE.busy = true;
  G.useKids(false); G.setDressed(PLAYER, false); G.setDressed(PARTNER, false);
  G.post.grade.uniforms.uMem.value = 0; STATE.fog = null;
  G.setTime({ day: 0, tod: 1, snow: 0.25 }, true);
  houseFor('morning');                        // lamps off, the cake put away, the bed slept in
  G.FIRE.on = true; G.FIRE.level = 0.35;      // the fire down to its last coals
  for (const L of G.LAMPS) { if (L.power0 == null) L.power0 = L.power; const p = L.g.getWorldPosition(new THREE.Vector3()); if (p.x > 12.5 && p.x < 13.5 && p.y > 1.5) { L.on = true; L.power = 0.9; } }
  NIGHT.door.visible = false; NIGHT.done = new Set(); NIGHT.whistles = 0; NIGHT.seen = new Set();
  Object.assign(S.flags, { doorOpen: false, nightUp: false, sleptBeside: false, fakeWithdrawn: false });
  S.vars.suspicion = 0;
  STATE.bounds = { zMin: -5, zMax: 4.3 };     // nobody is going out tonight
  G.lieDown(PLAYER, B().L, -0.14, 0.15, 0.35);
  PARTNER.hidden = true; PARTNER.m.visible = false; PARTNER.mode = 'still';
  STATE.sceneShot = true; G.setShot(bedShot());
  await wait(0.4);
  f.style.transition = 'opacity 2.6s'; f.classList.remove('on'); wait(2.8).then(() => { f.style.transition = ''; f.style.background = ''; });
  await G.UI.act('III', 'Recognition', { white: false });
  G.setShot(bedClose(), false);
  await N('(Cold. The blanket is on your side. All of it.)', K());
  await N('(Her side is empty. Still a little warm.)', K());
  await wait(0.8);
  for (let i = 0; i < 6; i++) { G.Audio.step('wood', 0.5); await wait(0.5); }
  // Footsteps come back. Nothing tells you anything.
  PARTNER.hidden = false; PARTNER.m.visible = true;
  G.placeChar(PARTNER, 5.6, 1.2, -Math.PI / 2); PARTNER.mode = 'script';
  G.setShot(bedShot(), false);
  await G.walkTo(PARTNER, B().R + 0.55, -0.4, 0.9);
  await P('Couldn’t sleep. Got water.', K());
  G.lieDown(PARTNER, B().R, -0.40, 0, 0); PARTNER.mode = 'lying'; PARTNER.lidsClosed = false;
  G.setShot(bedClose(), false);
  await N('(She lies down on her side. Exactly on her side.)', K());
  await P('Come back to sleep.', K());
  STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true; STATE.busy = false;
  S.flags.noTogether = true; S.flags.noBarks = true; S.flags.nightUp = true;
  nightLoops(S.run);
};
// The night from her side: she wakes beside the real one, gets up for water, and the house is almost right.
// Then something in his shape comes into the kitchen (Elsewhere, as her whole Act III).
async function nightHer() {
  checkpoint('night');
  const f = G.$('fade');
  if (!f.classList.contains('on')) { f.style.background = '#000'; f.classList.add('on'); await wait(0.7); }
  quiet(); STATE.busy = true;
  G.useKids(false); G.setDressed(PLAYER, false); G.setDressed(PARTNER, false);
  G.post.grade.uniforms.uMem.value = 0; STATE.fog = null;
  G.setTime({ day: 0, tod: 1, snow: 0.25 }, true);
  houseFor('morning'); G.FIRE.on = true; G.FIRE.level = 0.35;
  for (const L of G.LAMPS) { if (L.power0 == null) L.power0 = L.power; const p = L.g.getWorldPosition(new THREE.Vector3()); if (p.x > 12.5 && p.x < 13.5 && p.y > 1.5) { L.on = true; L.power = 0.9; } }
  NIGHT.door.visible = false; NIGHT.done = new Set(); NIGHT.whistles = 0; NIGHT.seen = new Set(); NIGHT.outside = false; NIGHT.canWhistle = false;
  Object.assign(S.flags, { doorOpen: true, nightUp: true, sleptBeside: false, fakeWithdrawn: false, povWhistled: false, herWater: false });
  S.vars.suspicion = 0;
  await elsewhere({ her: true });
}
const herUp = () => night() && NIGHT.her && NIGHT.swapped && !NIGHT.outside && !NIGHT.left;
// Getting up: you're on your feet beside the bed.
const getUp = () => G.cutTo(() => { G.standAt(PLAYER, B().L - 0.6, 0.2, Math.PI / 2); G.releaseCamera(); G.CAM.cut = true; }, 0.4);
// Moving while you're lying there gets you up (the bed's prompt still offers going back to sleep).
G.lieMove = () => { if (!night() || !S.flags.nightUp || S.flags.doorOpen || NIGHT.rising) return; NIGHT.rising = true; S.flags.upT = G.simT; A.run(async () => { await getUp(); NIGHT.rising = false; }); };

function nightLoops(run) {
  const live = () => S.run === run && night() && !S.flags.doorOpen;
  // The real one's whistle, from the kitchen, now and then. It has an explanation for it.
  (async () => {
    let k = 0;
    while (live()) {
      await wait(k === 0 ? 14 : 18 + Math.random() * 8);
      if (!live()) return;
      G.Audio.whistle(1.12, 0.6); NIGHT.whistles++; k++;
      if (k === 1 && !PARTNER.hidden) { await wait(1.6); if (live() && !G.busy()) G.bark('…Pipes. Old house.', 2.6); }
      if (NIGHT.whistles >= 2 && !NIGHT.door.visible && !PLAYER.lie) { NIGHT.door.visible = true; }
    }
  })();
  // If you're up, so is she: she gets out of bed after a little while and keeps you company.
  (async () => {
    await until(() => !live() || (!PLAYER.lie && S.flags.upT && G.simT - S.flags.upT > 10));
    if (!live() || S.flags.fakeWithdrawn) return;
    G.standAt(PARTNER, B().R + 0.6, 0.2, Math.PI / 2); PARTNER.mode = 'follow'; PARTNER.lidsClosed = false;
    G.bark('Can’t sleep either, {toHim}?', 2.4);
  })();
  // Social stealth: staring at her too long, or bolting away, is noticed.
  let stare = 0;
  G.TICKERS.add(function tick(dt) {
    if (!live()) { G.TICKERS.delete(tick); return; }
    const it = findInter('nHer'); if (it) { it.pos[0] = PARTNER.x; it.pos[2] = PARTNER.z; }
    if (PARTNER.hidden || PARTNER.lie || G.busy() || S.flags.fakeWithdrawn) { stare = 0; return; }
    const d = dist(), fx = PARTNER.x - PLAYER.x, fz = PARTNER.z - PLAYER.z, l = Math.hypot(fx, fz) || 1;
    const facing = (fx * Math.sin(PLAYER.yaw) + fz * Math.cos(PLAYER.yaw)) / l > 0.85;
    if ((PLAYER.speed || 0) < 0.2 && d < 2.4 && facing && !PLAYER.lie && !(PLAYER.sit > 0.1)) { stare += dt; if (stare > 5) { stare = -6; suspect(1, 'stare'); G.bark('…What?', 1.6); } }
    else stare = Math.max(0, stare - dt);
    if ((PLAYER.speed || 0) > 2.4 && d < 3.2) { NIGHT.runT = (NIGHT.runT || 0) + dt; if (NIGHT.runT > 1.2) { NIGHT.runT = -8; suspect(0.5, 'run'); } }
    // It's noticed you noticing: close to it, with suspicion up, you can hear your own heart.
    if ((S.vars.suspicion || 0) >= 2 && d < 3 && !G.gentle()) { NIGHT.hbT = (NIGHT.hbT || 0) - dt; if (NIGHT.hbT <= 0) { G.Audio.heart && G.Audio.heart(0.5 + (3 - d) / 4); NIGHT.hbT = 0.75 + d * 0.15; } }
    if ((S.vars.suspicion || 0) >= 3 && !S.flags.fakeWithdrawn && !NIGHT.slipping && !G.gentle()) A.run(slip);
  });
  // The more you've let it convince you, the closer it keeps you, and the more it says so.
  (async () => {
    const lines = [
      ['Don’t go far, {toHim}.', 'Where are you going, {dear}?', 'Stay where I can see you.'],
      ['I like it when you’re close, {toHim}. Closer.', 'You don’t need to go in there. Everything you need is here.', 'You keep looking at the door, {dear}.'],
      ['I’ll remember all of it for you. You don’t have to.', 'You’re mine to keep warm. Mine.', 'Nobody else gets to have this. Not even her.'],
    ];
    while (live()) {
      await wait(26 - Math.min(14, (S.vars.corruption || 0) * 4) + Math.random() * 8);
      if (!live() || PARTNER.hidden || PARTNER.lie || G.busy() || S.flags.fakeWithdrawn) continue;
      const lv = Math.min(2, Math.floor(S.vars.corruption || 0));
      if (lv < 1 && dist() < 5) continue;
      G.bark(lines[lv][Math.floor(Math.random() * 3)], 2.8);
      if (lv >= 2 && dist() > 2 && !G.gentle()) { PARTNER.mode = 'script'; await G.walkTo(PARTNER, PLAYER.x + 0.5, PLAYER.z + 0.3, 1.5); if (live() && !S.flags.fakeWithdrawn) PARTNER.mode = 'follow'; }
    }
  })();
  // The night running down: the longer you're up, the lower the fire, the dimmer the kitchen lamp and the heavier the
  // snow at the windows. Nothing on screen says so; four minutes or so from first light to last.
  { let t = 0, fireCtl = true; const lamps = G.LAMPS.filter((L) => L.on);
    G.TICKERS.add(function down(dt) {
      if (!live()) { G.TICKERS.delete(down); return; }
      if (PLAYER.lie || G.busy()) return;
      t += dt; const k = Math.min(1, t / 240);
      const F = G.FIRE, want = Math.max(0.12, 0.6 - 0.48 * k);
      if (fireCtl && F.on) { if (F.fuel > want + 0.3 && k > 0.02) fireCtl = false; else F.fuel = Math.min(F.fuel, want); }   // (if it builds the fire up itself, let it)
      for (const L of lamps) if (L.on && L.power0) L.power = L.power0 * 0.9 * (1 - 0.55 * k);
      STATE.snowTarget = 0.25 + 0.6 * k;
      NIGHT.runDown = k;
    });
  }
  // It repeats what you said this evening, word for word. She argued with you; it agrees. (lists.js writes it down.)
  (async () => {
    const F = S.flags, said = [];
    if (F.saidScarf === 'red') said.push(['scarf', 'The scarf was red. You were right. You’re always right about the scarf.']);
    else if (F.saidScarf === 'blue') said.push(['scarf', 'The scarf was blue. Like you said. We agreed, remember? We always agree.']);
    else if (F.saidScarf === 'none') said.push(['scarf', 'There wasn’t a scarf. You said so. I believe you.']);
    if (F.saidTrees === 'two') said.push(['trees', 'Two trees, by the log. Two. You remembered it so well.']);
    else if (F.saidTrees === 'forest') said.push(['trees', 'A whole forest. That’s how you said it. A whole forest.']);
    if (!said.length) return;
    await wait(35 + Math.random() * 15);
    for (const [k, line] of said.slice(0, 2)) {
      await until(() => !live() || (!G.busy() && !PARTNER.hidden && !PARTNER.lie && !S.flags.fakeWithdrawn && dist() < 4 && !PARTNER.bark));
      if (!live()) return;
      G.bark(line, 4); NIGHT.seen.add('said_' + k);
      await wait(40 + Math.random() * 20);
    }
  })();
  // A hint, if you've heard the whistle and stood about a while.
  (async () => { await wait(70); if (live() && NIGHT.whistles > 0 && !G.busy()) G.hint('(The whistling seems to come from the kitchen.)', 6); })();
}
// Too watched: it stops pretending, for a moment. Then you wake up in bed an hour later, and something is gone.
// The third time, it doesn't let you wake up as yourself.
async function slip() {
  NIGHT.slipping = true; STATE.busy = true;
  S.vars.slips = (S.vars.slips || 0) + 1;
  // The lamps stutter first.
  { const on = G.LAMPS.filter((L) => L.on); for (let k = 0; k < 3; k++) { on.forEach((L) => { L.power *= 0.3; }); await wait(0.08 + Math.random() * 0.07); on.forEach((L) => { L.power /= 0.3; }); await wait(0.12 + Math.random() * 0.2); } }
  const n = S.vars.slips, o = S.obs || {};
  for (const L of G.LAMPS) if (L.on) L.power *= 0.25;
  G.Audio.thud && G.Audio.thud();
  await wait(0.5);
  // It's right behind you.
  const bx = PLAYER.x - Math.sin(PLAYER.yaw) * 0.7, bz = PLAYER.z - Math.cos(PLAYER.yaw) * 0.7;
  G.standAt(PARTNER, bx, bz, PLAYER.yaw); PARTNER.mode = 'still'; PARTNER.lidsClosed = false; PARTNER.noBlink = true;
  G.gaze(PARTNER, [PLAYER.x, PLAYER.y + 1.6, PLAYER.z], 8);
  const knows = o.slip_lovely ? 'Charming. Charming. I know what she calls you. I’ve been practising.' : o.corrupt_fire ? 'You put a log on the fire for me. Two, actually. I counted.' : o.gift ? 'You always shake things. Snow globes. Presents. Me.' : 'You checked the sink. Then the window. Then me.';
  const said = [
    ['Stop looking at me like that.', knows],
    ['You’re doing it again.', 'I was being so good. I was being exactly right.'],
    ['No.', 'I’m keeping you.'],
  ][Math.min(2, n - 1)];
  await N('(Her voice is very flat. Her eyes don’t move from you.)');
  for (const t of said) await P(t);
  PARTNER.noBlink = false;
  const f = G.$('fade'); f.style.background = '#000'; f.style.transition = 'opacity 0.5s'; f.classList.add('on'); await wait(1.4);
  for (const L of G.LAMPS) if (L.power0 != null) L.power = L.on && L.power < 0.5 ? L.power * 4 : L.power;
  if (n >= 3) { f.style.transition = ''; NIGHT.slipping = false; return A.go('ending_replaced'); }
  // An hour later. Back in bed. It's beside you, awake.
  G.lieDown(PLAYER, B().L, -0.14, 0.15, 0.35); G.lieDown(PARTNER, B().R, -0.40, 0, 0); PARTNER.mode = 'lying'; PARTNER.lidsClosed = false;
  S.vars.suspicion = 1; S.flags.upT = 0;
  STATE.sceneShot = true; G.setShot(bedClose());
  const lost = G.take ? G.take() : null;
  f.style.transition = 'opacity 1.6s'; f.classList.remove('on'); await wait(1.8); f.style.transition = ''; f.style.background = '';
  await N('(You’re in bed. The clock says it’s an hour later. You don’t remember lying down.)', K());
  if (lost) await N('(Something is missing. You can’t think what.)', K());
  await P(n === 1 ? 'Bad dream?' : 'You keep getting up. I keep bringing you back.', K());
  STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true;
  STATE.busy = false; NIGHT.slipping = false;
  // It gets up when you do, sooner this time.
  A.run(async () => { await until(() => !night() || !PLAYER.lie); if (!night()) return; await wait(3); if (!night()) return; G.standAt(PARTNER, B().R + 0.6, 0.2, Math.PI / 2); PARTNER.mode = 'follow'; });
}
async function withdraw() {
  S.flags.fakeWithdrawn = true;
  G.bark('I’m going back to bed, Partner. You should too.', 3);
  PARTNER.mode = 'script'; await G.walkTo(PARTNER, B().R + 0.55, -0.4, 1.0);
  G.lieDown(PARTNER, B().R, -0.40, 0, 0); PARTNER.mode = 'lying'; PARTNER.lidsClosed = false;
}

/* ---------- in bed: go back to sleep beside her, or get up ---------- */
inter('nBed', [2.4, 0.6, 0.15], 1.25, () => (PLAYER.lie ? 'Get up' : 'Bed'), async () => {
  if (PLAYER.lie) {
    const c = await choose(['Get up', 'Go back to sleep']);
    if (c === 0) { S.flags.upT = G.simT; await getUp(); return; }
    S.flags.sleptBeside = true; corrupt(1, 'sleep');
    const f = G.$('fade'); f.style.background = '#000'; f.style.transition = 'opacity 1.4s'; f.classList.add('on'); await wait(2.6);
    f.classList.remove('on'); await wait(1.2); f.style.transition = '';
    await N('(You sleep. When you open your eyes the room is colder, and the whistling is very close.)');
    G.Audio.whistle(1.12, 0.6); NIGHT.whistles = Math.max(NIGHT.whistles, 2); NIGHT.door.visible = true;
    await N('(Beside you, she hasn’t moved. Her eyes are open.)');
    return;
  }
  await N(cyc('nBedSeen', ['(She’s lying exactly on her side, on her back, hands folded on the blanket.)', '(“Come back to sleep, Partner.” She says it kindly. She says it like a line.)']));
}, () => night() && S.flags.nightUp && !S.flags.doorOpen);

/* ---------- with her: talk, tease, and the ordinary things people do at three in the morning ---------- */
inter('nHer', [13.0, 1.2, 3.55], 1.1, 'Partner', async () => {
  if (S.flags.fakeWithdrawn) { await N('(She’s gone back to bed.)'); return; }
  await nightMenu();
}, () => night() && S.flags.nightUp && !S.flags.doorOpen && !PARTNER.lie && !PARTNER.hidden);

async function nightMenu() {
  const all = [['cocoa', 'Make some cocoa'], ['fire', 'Sit by what’s left of the fire'], ['seat', 'Watch the snow from the window seat'], ['cake', 'Raid the fridge for the last of the cake']];
  const left = all.filter(([id]) => !NIGHT.done.has(id));
  const opts = left.map((o) => o[1]).concat(['Tease her', '“Who are you?”', 'Not now']);
  await P(NIGHT.done.size ? 'What now, Partner?' : 'Since we’re both up. What shall we do?');
  const c = await choose(opts);
  if (c < left.length) { const id = left[c][0]; NIGHT.done.add(id); PARTNER.mode = 'still'; await ({ cocoa, fire, seat, cake })[id](); PARTNER.mode = 'follow'; return; }
  const k = c - left.length;
  if (k === 0) return tease();
  if (k === 1) {
    suspect(2, 'confront');
    await P('Partner. It’s three in the morning. I’m me. Who else would I be?');
    await N('(She smiles.)');
    return;
  }
  await P('All right.');
}
async function tease() {
  const c = await choose(['“You stole the whole blanket. Then gave it back.”', '“Nice hat.”', 'Poke her in the side']);
  if (c === 0) { await P('I gave it to you. You looked cold.'); await Y('That isn’t how it works. You steal it; I complain.'); await P('Yes. Sorry. Next time I’ll steal it properly.'); NIGHT.seen.add('blanket'); }
  else if (c === 1) { await P('Thank you. You said that at the fair, the first thing you ever said to me.'); const d = await choose(['“I did, didn’t I.”', '“Did I? I don’t remember.”']); if (d === 0) corrupt(1, 'agree'); else { await P('I remember everything, Partner.'); NIGHT.seen.add('certain'); } }
  else { await N('(She doesn’t flinch.)'); await P('Goodness. What was that for?'); NIGHT.seen.add('flinch'); }
}
const two = (px, pz, qx, qz, pyaw, qyaw) => G.cutTo(() => { G.standAt(PLAYER, px, pz, pyaw); G.standAt(PARTNER, qx, qz, qyaw); PARTNER.mode = 'still'; }, 0.35);
async function cocoa() {
  const K2 = G.KITCHEN || {}, kx = (K2.stove && K2.stove.x) || 12.35;
  await two(kx - 0.35, -1.25, kx + 0.4, -1.2, Math.PI + 0.2, Math.PI - 0.3);
  const shot = fixed(V(kx + 0.1, 1.55, 0.2), V(kx, 1.0, -1.5), 42, 0.012);
  await N('(Milk in the little pan, the hob ticking, the window black and full of snow.)', { shot });
  await P('How many sugars?', { shot });
  const c = await choose(['“Two.”', '“One, and a second one that doesn’t count.”', '“None. I’m sweet enough.”']);
  if (c === 0) { await P('One. And a second one that doesn’t count.', { shot }); NIGHT.seen.add('verbatim'); }
  else if (c === 1) { await P('That’s my line.', { shot }); await Y('I know. I’m stealing it.', { shot }); await P('That’s fair. You can have it.', { shot }); NIGHT.seen.add('gaveup'); }
  else await P('That’s not true, Partner. You’re an ordinary amount of sweet.', { shot });
  if (S.flags.eveCocoa) await N('(This evening she burned her tongue on hers and blew on every mouthful after. This one drinks it straight off the heat, and doesn’t blink.)', { shot });
  const t = await choose(['“Toast with it?”', '“Don’t burn it this time.”', 'Just stir']);
  if (t === 0) { await P('The toaster? Of course. It works perfectly well.', { shot }); NIGHT.seen.add('toaster'); }
  else if (t === 1) { await P('I won’t.', { shot }); await N('(She doesn’t. Not even a little at the bottom.)', { shot }); }
  else await N('(You stir. She watches the spoon go round.)', { shot });
  await N('(It’s good cocoa.)', { shot });
}
async function fire() {
  const S0 = G.SOFA;
  await G.cutTo(() => { for (const [c, x] of [[PLAYER, S0.x + 0.35], [PARTNER, S0.x - 0.25]]) { c.x = x; c.z = S0.z - 0.08; c.y = c.yFloor = 0; c.yaw = Math.PI; c.seatY = S0.seatY; c.sitTarget = 1; c.sit = 1; c.speed = 0; } PARTNER.mode = 'seated'; }, 0.35);
  const shot = fixed(V(S0.x - 1.1, 1.2, S0.z - 1.6), V(S0.x, 0.95, S0.z), 36, 0.012);
  G.FIRE.level = 0.5; corrupt(1, 'fire');
  await N('(The fire is down to a red glow. You put one more log on, mostly for the company.)', { shot });
  await P('It was a perfect day. You won the pinecones by two. Eleven to nine.', { shot });
  const c = await choose(['“Eleven to nine. That’s right.”', '“You never remember a score.”', '“Was it?”']);
  if (c === 0) corrupt(1, 'agree');
  else if (c === 1) { await P('I remember this one.', { shot }); NIGHT.seen.add('score'); suspect(0.5, 'notice'); }
  else await P('It was. I counted.', { shot });
  await N('(She leans her head on your shoulder.)', { shot });
  await G.cutTo(() => { for (const c2 of [PLAYER, PARTNER]) { c2.sitTarget = c2.sit = 0; } G.standAt(PLAYER, S0.x + 1.55, S0.z - 0.1, -Math.PI / 2); G.standAt(PARTNER, S0.x - 1.55, S0.z - 0.1, Math.PI / 2); }, 0.3);
  G.FIRE.level = 0.35;
}
async function seat() {
  const Nk = G.NOOK;
  await G.cutTo(() => { G.sitAt(PLAYER, Nk.x + 0.35, Nk.z, 0, Nk.seatY); G.sitAt(PARTNER, Nk.x - 0.35, Nk.z, 0, Nk.seatY); PARTNER.mode = 'seated'; }, 0.35);
  const shot = fixed(V(Nk.x + 0.2, 1.35, Nk.z + 2.0), V(Nk.x, 0.95, Nk.z), 38, 0.012);
  await N('(Snow going past the window behind you, slow and fat and silent.)', { shot });
  await P('We’re exactly the same people we were when we were seven. Nothing has changed at all.', { shot });
  if (S.flags.eveRead) await N('(This evening, right here, she said she wanted to always be halfway through something.)', { shot });
  const c = await choose(['“Exactly the same.”', '“You asked me that on the hill. You weren’t sure.”', '“Taller.”']);
  if (c === 0) corrupt(1, 'agree');
  else if (c === 1) { await P('I’m sure now.', { shot }); NIGHT.seen.add('certain'); }
  else await P('Taller. Otherwise exactly the same.', { shot });
  await G.cutTo(() => { for (const c2 of [PLAYER, PARTNER]) { c2.sitTarget = c2.sit = 0; } G.standAt(PLAYER, Nk.x + 0.4, Nk.z + 0.9, Math.PI); G.standAt(PARTNER, Nk.x - 0.4, Nk.z + 0.9, Math.PI); }, 0.3);
}
async function cake() {
  const K2 = G.KITCHEN || {}, tb = K2.table || { x: 13.0, z: 2.95 };
  await G.cutTo(() => { G.sitAt(PLAYER, 13.3, 3.58, Math.PI, 0.49); G.sitAt(PARTNER, 13.0, 2.3, 0, 0.49); PARTNER.mode = 'seated'; }, 0.35);
  const shot = fixed(V(tb.x + 1.6, 1.35, tb.z + 0.4), V(tb.x, 0.9, tb.z), 40, 0.012);
  await N('(The last of the cake, two forks, the fridge door left open for the light.)', { shot });
  const c = await choose(['Steal the bit with the most icing', '“Half each. You check.”', '“You have it.”']);
  if (c === 0) { await P('Have it. You like that bit.', { shot }); NIGHT.seen.add('icing'); }
  else if (c === 1) { await P('It’s exactly half. I can tell.', { shot }); await N('(She doesn’t look.)', { shot }); NIGHT.seen.add('nocheck'); }
  else await P('Thank you, Partner.', { shot });
  await N('(When you stand up, she pushes her chair in. Square to the table.)', { shot });
  await G.cutTo(() => { for (const c2 of [PLAYER, PARTNER]) { c2.sitTarget = c2.sit = 0; } G.standAt(PLAYER, 12.6, 3.9, Math.PI); G.standAt(PARTNER, 13.4, 3.9, Math.PI); }, 0.3);
}
/* ---------- small things in the dark house, for anyone who looks (none of them needed) ---------- */
inter('nSink', [13.05, 1, -1.6], 0.6, 'Sink', async () => { await N(NIGHT.her ? '(Three mugs on the drying rack, washed and turned upside down. You washed two. You remember washing two.)' : '(Three mugs on the drying rack, washed and turned upside down. There were two.)'); NIGHT.seen.add('mugs'); }, () => (night() && S.flags.nightUp && !S.flags.doorOpen) || (herUp() && S.flags.herWater));
inter('nPhoto', [7.75, 1.4, 4.15], 0.8, 'Photograph', async () => { if (!EVE.photo.visible) EVE.showPhoto(); thirdShape(); await N('(The photograph. The two children on the log. And at the very edge, between the trees, a third shape, standing very still.)'); NIGHT.seen.add('photo'); }, () => (night() && S.flags.nightUp && !S.flags.doorOpen) || herUp());
inter('nWin', [0.6, 1.3, -0.15], 0.8, 'Window', async () => { await N('(There’s snow on the inside of the sill. A little drift of it, as if the window had been open. It hasn’t.)'); NIGHT.seen.add('sill'); }, () => (night() && S.flags.nightUp && !S.flags.doorOpen) || herUp());
// Her night: the glass of water she got up for, and the bed once he's gone from it.
inter('hWater', [13.05, 1, -1.6], 1.1, 'Glass of water', async () => {
  await N('(A cold glass of water at the window. Snow everywhere, blue in the dark. Not a sound.)');
  await N('(Behind you, the house makes its house noises. One of them is wrong. You can’t say which.)');
  S.flags.herWater = true;
}, () => herUp() && !S.flags.herWater);
findInter('hWater').prio = 2;
inter('hBed', [2.4, 0.6, 0.15], 1.25, 'Bed', async () => {
  if (!PARTNER.hidden) { await N('(He’s asleep on his front, taking up exactly half. Not one inch more.)'); return; }
  await N(cyc('hBedSeen', ['(His side of the bed is empty. Still warm.)', '(You don’t get back in. You don’t know why not. You just don’t.)']));
}, () => herUp());
// The front door won't open tonight.
{ const fd = findInter('frontdoor'), orig = fd && fd.raw; if (fd) rewire('frontdoor', async () => { if (night() && !S.flags.doorOpen) { await N('(It won’t open. It isn’t locked. It just won’t.)'); return; } return orig(); }); }
// Noticing enough brings the door sooner: once you've heard the whistle and found three things that aren't right.
G.TICKERS.add(() => { if (night() && S.flags.nightUp && !S.flags.doorOpen && !NIGHT.door.visible && NIGHT.whistles >= 1 && NIGHT.seen && NIGHT.seen.size >= 3 && !PLAYER.lie && !G.busy()) NIGHT.door.visible = true; });
// Walking into the kitchen once the door is there.
G.TICKERS.add(() => { if (night() && NIGHT.door.visible && !S.flags.doorOpen && !NIGHT.doorSaid && PLAYER.x > 11.3 && !G.busy()) { NIGHT.doorSaid = true; A.run(async () => { G.beatHush && G.beatHush(5); await wait(1.2); await N('(There’s a door in the kitchen wall. There has never been a door in the kitchen wall.)'); }); } });

/* ---------- the door, and Elsewhere ---------- */
inter('nDoor', [14.6, 1, 2.45], 0.9, 'The door', async () => {
  await N('(A door in the kitchen wall, between the fridge and the study. It is standing a little open. Through the gap: the kitchen, at night, from the other side.)');
  const c = await choose(['Go through', 'Not yet']);
  if (c === 1) return;
  S.flags.doorOpen = true;
  G.observe('door', S.flags.sleptBeside ? 'It slept beside me first. Then it went.' : 'It went through. It always goes through.');
  await elsewhere();
}, () => night() && NIGHT.door.visible && !S.flags.doorOpen);

// Play as her for a while: the bodies swap places, so the controls drive her.
G.swapBodies = () => {
  const a = PLAYER.m; PLAYER.m = PARTNER.m; PARTNER.m = a;
  const st = PLAYER.scarfTail; PLAYER.scarfTail = PARTNER.scarfTail; PARTNER.scarfTail = st;
  for (const c of [PLAYER, PARTNER]) { c._hsp = null; c._ikOff = null; c.lookAt = null; c.hugWith = null; c.holdWith = null; c.lie = false; c.sit = c.sitTarget = 0; }
  NIGHT.swapped = !NIGHT.swapped;
};
async function elsewhere(o = {}) {
  if (S.chapter === 'night' && !o.her) { checkpoint('elsewhere'); S.chapter = 'night'; }   // a reload resumes here, not at bedtime
  const f = G.$('fade');
  if (!o.her) { f.style.background = S.flags.sleptBeside ? '#000' : '#dfe9f5'; f.style.transition = 'opacity 1.6s'; f.classList.add('on'); await wait(1.8); }
  STATE.busy = true; STATE.sceneShot = false; NIGHT.left = false; NIGHT.outside = false; NIGHT.kept = false; NIGHT.hiding = null; S.vars.caught = 0;
  NIGHT.door.visible = false; STATE.bounds = { zMin: -5, zMax: 4.3 };
  NIGHT.her = !!o.her;
  G.swapBodies();
  if (o.her) {
    // Her own Act III: she wakes beside him. He's really there, asleep. She gets up for water.
    G.lieDown(PLAYER, B().R, -0.40, 0, 0); G.lieDown(PARTNER, B().L, -0.14, 0.15, 0.35); PARTNER.mode = 'lying'; PARTNER.lidsClosed = true;
    G.post.grade.uniforms.uMem.value = 0.18;
    STATE.sceneShot = true; G.setShot(bedClose());
    await wait(0.4);
    f.style.transition = 'opacity 2.6s'; f.classList.remove('on'); wait(2.8).then(() => { f.style.transition = ''; f.style.background = ''; });
    await G.UI.act('III', 'Recognition', { white: false });
    await N('(Three in the morning, or near it. He’s asleep on his front, taking up exactly half the bed. Not one inch more. He’s very fair about it.)', K());
    await N('(He’s snoring. Lovingly. You’re thirsty.)', K());
    await G.cutTo(() => { G.standAt(PLAYER, B().R + 0.6, 0.2, -Math.PI / 2); STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true; }, 0.4);
    STATE.busy = false; S.flags.noTogether = true;
    G.hint('A glass of water: the kitchen sink.', 6);
    await until(() => S.flags.herWater && !G.busy());
    // A little while to look round the kitchen at night before anything happens.
    const t0 = G.simT; await until(() => (G.simT - t0 > 22 || NIGHT.seen.size >= 2) && !G.busy() && PLAYER.x > 9.4);
  } else {
    // Earlier, the same night. She's up for water. He's asleep.
    G.standAt(PLAYER, 13.05, -1.25, Math.PI); PARTNER.hidden = true; PARTNER.m.visible = false; PARTNER.mode = 'still';
    G.post.grade.uniforms.uMem.value = 0.25;
    G.releaseCamera(); G.CAM.cut = true;
    await wait(0.3);
    f.classList.remove('on'); wait(1.8).then(() => { f.style.transition = ''; f.style.background = ''; });
    await G.UI.card(['Earlier.'], { hold: 2.2 });
    await N('(Water. A cold glass. The house making its house noises. In the bedroom, he is asleep and snoring, lovingly.)');
    STATE.busy = false; S.flags.noTogether = true;
    await wait(4);
  }
  // Something in his shape comes into the kitchen.
  STATE.busy = true;
  PARTNER.lie = false; PARTNER.lidsClosed = false;
  if (o.her) await N('(Footsteps. From the bedroom. Bare feet on the boards, unhurried.)');
  PARTNER.hidden = false; PARTNER.m.visible = true; G.placeChar(PARTNER, 10.6, 2.0, Math.PI / 2); PARTNER.mode = 'script';
  await G.walkTo(PARTNER, PLAYER.x - 1.1, PLAYER.z + 0.9, 0.9);
  G.gaze(PARTNER, [PLAYER.x, PLAYER.y + 1.5, PLAYER.z], 9); G.gaze(PLAYER, [PARTNER.x, PARTNER.y + 1.7, PARTNER.z], 9);
  await Y('Come back to bed, Partner.');
  await N('(He’s come all the way into the kitchen, in his bare feet.)');
  const c = await choose(['“Did you call from the door?”', '“Two minutes.”', '“…Hello, {dear}.”']);
  if (c === 0) { await Y('No. I came for you.'); }
  else if (c === 1) { await Y('I’ll wait.'); }
  else { await Y('Hello.'); }
  await Y('Come on.');
  STATE.busy = false;
  G.walkTo(PARTNER, 5.6, 1.2, 0.9).then(() => { PARTNER.hidden = true; PARTNER.m.visible = false; });
  await until(() => PLAYER.x < 11.4 || PARTNER.hidden);
  await until(() => !G.busy());
  STATE.busy = true;
  await N('(He doesn’t wait for you.)');
  STATE.busy = false;
  NIGHT.canWhistle = true;
  hunt(S.run);
  const wh = () => G.hint(G.MOBILE ? 'Any window in the kitchen: tap Use to whistle.' : 'Any window in the kitchen: ' + G.keyFor('interact') + ' to whistle.', 7);
  wh(); (async () => { for (let i = 0; i < 20 && !S.flags.povWhistled; i++) { await wait(25); if (!S.flags.povWhistled && NIGHT.canWhistle && !G.busy()) wh(); } })();
  await until(() => (S.flags.povWhistled && !G.busy()) || NIGHT.kept);
  if (NIGHT.kept) return;
  STATE.busy = true;
  await N('(You leave him something. Just in case.)');
  const s = await choose(['Line the pinecones up along the windowsill', 'Leave half a pancake, one enormous bite out of it', 'Write on a page of the scrapbook']);
  S.flags.sign = ['pinecones', 'pancake', 'note'][s];
  if (s === 0) await N('(Seven pinecones, in a row along the sill, biggest to smallest. The contest. He won it, and you said you let him.)');
  else if (s === 1) await N('(Half a pancake on a plate, with one enormous bite out of it. He’ll know that bite anywhere.)');
  else await N('(You write: “If it’s sure about the night we met, it isn’t me. — your {dear}”)');
  await N('(Then you walk out into the snow, towards wherever he is.)');
  STATE.busy = false; STATE.bounds = null; NIGHT.outside = true;
  G.hint('Out through the front door.', 6);
  (async () => { for (let i = 0; i < 20 && NIGHT.outside && !NIGHT.left; i++) { await wait(25); if (NIGHT.outside && !NIGHT.left && !G.busy()) G.hint('Out through the front door, into the snow.', 6); } })();
  await until(() => NIGHT.kept || PLAYER.z > 4.75 || (Math.hypot(PLAYER.x - G.FRONT_DOOR.x, PLAYER.z - G.FRONT_DOOR.z) < 0.7));
  if (NIGHT.kept) return;
  NIGHT.left = true;
  STATE.busy = true;
  f.style.background = '#ffffff'; f.style.transition = 'opacity 2.2s'; f.classList.add('on'); await wait(2.4);
  G.swapBodies(); G.post.grade.uniforms.uMem.value = 0;
  addScrap('night', 'A door in the kitchen wall. The kitchen at night, from her side. Something left behind for the real one to find.');
  STATE.busy = false;
  return A.go('lastbirthday');
}
// While it's searching: a heartbeat when it's near, quicker the nearer it gets.
function heartbeat(live) {
  let beatT = 0;
  G.TICKERS.add(function beat(dt) {
    if (!live()) { G.TICKERS.delete(beat); NIGHT.tense = 0; return; }
    const d = NIGHT.searching && !PARTNER.hidden ? Math.hypot(PLAYER.x - PARTNER.x, PLAYER.z - PARTNER.z) : 99;
    NIGHT.tense = d < 7 ? 1 - d / 7 : 0;
    if (NIGHT.tense > 0.05) { beatT -= dt; if (beatT <= 0) { G.Audio.heart && G.Audio.heart(0.5 + NIGHT.tense); beatT = 1.15 - NIGHT.tense * 0.6; } }
    else beatT = 0;
  });
}
// The close call: it comes and stands right outside where she's hiding, and waits.
async function nearMiss(spd) {
  const w = NIGHT.hiding; if (!w) return;
  const stop = w === 'nook' ? { x: G.NOOK.x + 0.1, z: G.NOOK.z + 1.25 } : { x: 14.2, z: 3.9 };
  PARTNER.mode = 'script';
  await Promise.race([G.walkTo(PARTNER, stop.x, stop.z, spd * 0.75), wait(9)]);
  if (!NIGHT.hiding || !NIGHT.searching) return;
  PARTNER.mode = 'still';
  if (w === 'nook') { PARTNER.yaw = 0.5; G.gaze(PARTNER, [G.NOOK.x + 3, 1.5, G.NOOK.z + 4], 5); }   // its back to her, looking out into the room
  else G.gaze(PARTNER, [G.CAB.x1, 1.5, 3.85], 5);
  STATE.busy = true;
  await N(w === 'nook' ? '(It stops in the mouth of the alcove, a step away, its back to you. It doesn’t turn round. Not yet.)' : '(Through the crack at the hinges: it’s standing right outside the door, with its head on one side, listening.)');
  await wait(1.2);
  await Y(['Partner? Are you playing a game? I like games.', 'I can hear you breathing, Partner.', 'It’s cold out here. It’s warm in bed. I’ll wait.'][Math.min(2, S.vars.caught || 0)]);
  await N('(You don’t breathe.)');
  STATE.busy = false;
  await wait(2.2);
  if (!NIGHT.hiding || !NIGHT.searching) return;
  G.bark('…Pipes. Old house.', 2.2);
  PARTNER.mode = 'script';
  G.walkTo(PARTNER, 12.6, 1.4, spd * 0.7);
}
// It comes back for her. Sooner, and faster, the more it got its way with him earlier.
function hunt(run) {
  if (G.gentle()) return;   // gentle nights: it doesn't come back for her
  const live = () => S.run === run && !NIGHT.left && !NIGHT.kept;
  heartbeat(live);
  const ob = () => Math.min(3, S.vars.corruption || 0);
  (async () => {
    while (live()) {
      await wait(Math.max(8, 26 - ob() * 5));
      if (!live()) return;
      await until(() => !live() || !G.busy());
      if (!live()) return;
      // The warning: the kitchen light stutters, then footsteps from the bedroom, getting closer. A few seconds to hide.
      STATE.hush = true;   // the house goes quiet all at once
      await wait(1.4);
      const lamps = G.LAMPS.filter((L) => L.on);
      for (let k = 0; k < 3; k++) { lamps.forEach((L) => { L.power *= 0.25; }); await wait(0.09 + Math.random() * 0.08); lamps.forEach((L) => { L.power *= 4; }); await wait(0.15 + Math.random() * 0.25); }
      if (!NIGHT.warned) { NIGHT.warned = true; G.hint('(Footsteps. Coming this way.)', 3); }
      for (let i = 0; i < 7; i++) { G.Audio.step('wood', 0.2 + i * 0.1); await wait(0.6 - i * 0.03); }
      if (!live()) return;
      PARTNER.hidden = false; PARTNER.m.visible = true; PARTNER.mode = 'script'; G.placeChar(PARTNER, 5.8, 1.2, Math.PI / 2);
      STATE.hush = false;
      G.bark(['Partner?', 'Where did you go?', 'I know you’re in here.'][Math.min(2, S.vars.caught || 0)], 2.2);
      const t0 = G.simT, spd = 0.85 + ob() * 0.2;
      let lostT = 0, closeCall = false;
      NIGHT.searching = true; NIGHT.justCaught = false;
      while (live() && G.simT - t0 < 40) {
        if (NIGHT.justCaught) break;   // she came out right in front of it
        const hid = !!NIGHT.hiding, d = Math.hypot(PLAYER.x - PARTNER.x, PLAYER.z - PARTNER.z);
        // Once per search, if she's hidden, it comes and stands right outside her hiding place.
        if (hid && !closeCall && G.simT - t0 > 2.5 && !G.busy()) { closeCall = true; await nearMiss(spd); continue; }
        if (!hid && d < 0.95 && !G.busy()) { await caught(); break; }
        if (hid) lostT += 0.5; else lostT = 0;
        if (lostT > 6) break;   // it can't find her: it goes back to wait for her
        if (hid) G.walkTo(PARTNER, 12.2 + Math.random() * 1.4, 1.0 + Math.random() * 2, spd * 0.7);
        else G.walkTo(PARTNER, PLAYER.x, PLAYER.z, spd);
        await wait(0.5);
      }
      NIGHT.searching = false;
      if (!live()) return;
      if (!PARTNER.hidden && !NIGHT.kept) { G.bark('Come back to bed when you’re ready.', 2.4); await G.walkTo(PARTNER, 5.6, 1.2, spd); PARTNER.hidden = true; PARTNER.m.visible = false; }
    }
  })();
}
NIGHT.caught = () => caught();   // (tests)
async function caught() {
  NIGHT.justCaught = true; NIGHT.searching = false; STATE.hush = false;
  if (STATE.sceneShot) { STATE.sceneShot = false; G.releaseCamera(); }
  STATE.busy = true; NIGHT.hiding = null; STATE.noControl = false;
  S.vars.caught = (S.vars.caught || 0) + 1;
  const n = S.vars.caught;
  PARTNER.script = null; PARTNER.mode = 'still';
  // It takes her by the wrist: face to face, an arm's length apart, his hand round hers.
  PLAYER.sitTarget = PLAYER.sit = 0; PLAYER.forcePose = null;
  const ang = Math.atan2(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
  G.standAt(PARTNER, PLAYER.x + Math.sin(ang) * 0.58, PLAYER.z + Math.cos(ang) * 0.58, ang + Math.PI);
  PLAYER.yaw = ang; PARTNER.grabWith = PLAYER; PLAYER.forcePose = 'held';
  G.gaze(PARTNER, [PLAYER.x, PLAYER.y + 1.5, PLAYER.z], 6); G.gaze(PLAYER, [PARTNER.x, PARTNER.y + 1.7, PARTNER.z], 6);
  await N('(His hand closes round your wrist. A little too hard.)');
  await Y(['There you are. Come back to bed.', 'You keep wandering off. I don’t like it when you wander off.', 'Stay.'][Math.min(2, n - 1)]);
  G.observe('caught', ['I found her in the kitchen. I brought her back.', 'She wandered again. I brought her back again.', 'She stays now.'][Math.min(2, n - 1)]);
  const f = G.$('fade'); f.style.background = '#000'; f.style.transition = 'opacity 0.8s'; f.classList.add('on'); await wait(1.6);
  PARTNER.grabWith = null; PARTNER.forcePose = PLAYER.forcePose = null;
  if (n >= 3) {
    NIGHT.kept = true; S.flags.keptHer = true; NIGHT.canWhistle = false;
    G.lieDown(PLAYER, B().R, -0.40, 0, 0); G.lieDown(PARTNER, B().L, -0.14, 0, 0); PARTNER.mode = 'lying';
    STATE.sceneShot = true; G.setShot(bedClose());
    f.classList.remove('on'); await wait(1.0);
    await N('(You lie down on your side. Exactly on your side.)', K());
    await N('(Beside you, he says goodnight three times, the same way each time.)', K());
    await N('(Somewhere, very far off, the snow keeps falling. You stop listening for him.)', K());
    f.classList.add('on'); await wait(2.2); f.style.transition = '';
    G.swapBodies(); G.post.grade.uniforms.uMem.value = 0;
    addScrap('kept', 'A page that should be about the kitchen at night. It’s been left blank.');
    STATE.busy = false;
    return A.go('lastbirthday');
  }
  // Back to the kitchen: she slips out again. Something is gone.
  G.standAt(PLAYER, 13.05, -1.25, Math.PI); PARTNER.hidden = true; PARTNER.m.visible = false;
  const lost = G.take ? G.take() : null;
  f.classList.remove('on'); await wait(1.0); f.style.transition = ''; f.style.background = '';
  await N(lost ? '(Later. The kitchen again. You slipped away when he fell asleep. Something is missing; you can’t think what.)' : '(Later. The kitchen again. You slipped away when he fell asleep.)');
  STATE.busy = false;
}
// Somewhere to hide from it in the dark house: the curtains of the window seat, and the study (the lean-to through
// the locked door; at night it isn't locked). In the study she's actually inside, behind the door, and the camera
// stays in the kitchen on the closed door.
const HIDE = { nook: () => ({ x: G.NOOK.x, z: G.NOOK.z, yaw: 0, y: G.NOOK.seatY }), study: () => ({ x: G.ANNEX.x0 + 0.42, z: 4.3, yaw: -Math.PI * 0.5 }) };
const STUDY_OUT = { x: 14.35, z: 3.85, yaw: -Math.PI * 0.5 };
const hideAct = (where) => async () => {
  if (NIGHT.hiding) {
    const was = NIGHT.hiding;
    if (G.simT - (G.lineEndT || -9) < 1.2) return;   // a tap meant for the last line, not a decision to come out
    // Coming out while it's standing right there.
    if (NIGHT.searching && !PARTNER.hidden && Math.hypot(PARTNER.x - (was === 'study' ? STUDY_OUT.x : PLAYER.x), PARTNER.z - (was === 'study' ? STUDY_OUT.z : PLAYER.z)) < 2.4) {
      NIGHT.hiding = null; PLAYER.forcePose = null;
      if (was === 'study') G.standAt(PLAYER, STUDY_OUT.x, STUDY_OUT.z, STUDY_OUT.yaw); else { PLAYER.sitTarget = PLAYER.sit = 0; G.standAt(PLAYER, G.NOOK.x, G.NOOK.z + 0.75, Math.PI); }
      STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true;
      await N('(It’s right there. It was waiting.)');
      return caught();
    }
    NIGHT.hiding = null; PLAYER.forcePose = null;
    if (was === 'study') {
      await G.cutTo(() => { G.standAt(PLAYER, STUDY_OUT.x, STUDY_OUT.z, STUDY_OUT.yaw); STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true; }, 0.2);
    }
    STATE.noControl = false;
    if (was === 'nook') { STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true; }
    if (PLAYER.sitTarget) { PLAYER.sitTarget = 0; await wait(0.5); }
    await N('(You come out.)'); return;
  }
  NIGHT.hiding = where; STATE.noControl = true;
  G.observe('her_hid', where === 'nook' ? 'She hid behind the curtain. I knew where she was. I let her.' : 'She hid in the study. I knew where she was. I let her.');
  const h = HIDE[where]();
  if (where === 'nook') {
    // knees up on the window seat behind the curtain
    G.sitDown(PLAYER, h.x, h.z - 0.14, h.yaw, h.y, 0.5); PLAYER.forcePose = 'hideSit';   // well back on the seat, feet up on the cushion
    await N('(You fold yourself into the window seat behind the curtain, knees up, and keep very still.)');
    // Held on the alcove from the dark room: her, small against the moonlit window. Anything that comes stands in between.
    if (NIGHT.hiding === 'nook') { STATE.sceneShot = true; G.setShot(fixed(V(G.NOOK.x - 0.25, 1.35, G.NOOK.z + 2.7), V(G.NOOK.x + 0.05, 0.85, G.NOOK.z + 0.1), 46, 0.006)); }
  } else {
    // through the door and flat against the wall behind it, in the dark
    await G.cutTo(() => {
      G.standAt(PLAYER, h.x, h.z, h.yaw); PLAYER.forcePose = 'hide';
      STATE.sceneShot = true; G.setShot(fixed(V(12.9, 1.55, 2.2), V(14.9, 1.15, 3.85), 46, 0.004));
    }, 0.3);
    await N('(You slip into the study and stand behind the door, in the dark. It smells of pencil shavings and old paper.)');
  }
};
inter('eHideNook', [10.05, 0.8, -1.3], 1.1, () => (NIGHT.hiding === 'nook' ? 'Come out' : 'Hide behind the curtain'), hideAct('nook'), () => S.chapter !== 'lastbirthday' && NIGHT.swapped && !NIGHT.left && !NIGHT.kept && (!NIGHT.hiding || NIGHT.hiding === 'nook'));
inter('eHideStudy', [14.35, 0.8, 3.85], 1.0, () => (NIGHT.hiding === 'study' ? 'Come out' : 'Hide in the study'), hideAct('study'), () => S.chapter !== 'lastbirthday' && NIGHT.swapped && !NIGHT.left && !NIGHT.kept && (!NIGHT.hiding || NIGHT.hiding === 'study'));

/* ---------- Dawn, as her (start of Act I): the real him, so you know what he's like ----------
 * He calls from the bedroom door, won't set foot on the cold kitchen floor, says "Hello, Dearest Partner" back, and waits for you. */
G.herDawn = async () => {
  const f = G.$('fade');
  f.style.background = '#000'; f.style.transition = 'opacity 0.8s'; f.classList.add('on'); await wait(1.0);
  G.swapBodies();
  G.lieDown(PARTNER, B().L, -0.14, 0.15, 0.35); PARTNER.mode = 'lying'; PARTNER.lidsClosed = true;
  G.standAt(PLAYER, B().R + 0.6, 0.2, Math.PI / 2);
  G.setTime({ day: 0.35, tod: 0.55, snow: 0.1 }, true);
  STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true;
  f.classList.remove('on'); await wait(0.9); f.style.transition = ''; f.style.background = '';
  await G.UI.card(['Earlier. Before it was light.'], { hold: 2.2 });
  await N('(You are her, for a little while. He’s asleep on his front, taking up exactly half the bed. Not one inch more. He’s very fair about it.)');
  STATE.busy = false; S.flags.dawnOn = true;
  G.hint('A glass of water: the kitchen sink.', 6);
  await until(() => S.flags.dawnWater && !G.busy());
  STATE.busy = true;
  PARTNER.lie = false; PARTNER.lidsClosed = false; G.placeChar(PARTNER, 5.15, 1.2, Math.PI / 2); PARTNER.mode = 'still';
  G.gaze(PARTNER, [PLAYER.x, PLAYER.y + 1.5, PLAYER.z], 10);
  await N('(From the bedroom doorway, sleepy: “Are you in the kitchen?”)');
  await N('(“The floor’s freezing, {toHer}. I’m not coming in. I’ll stand here and complain.”)');
  const c = await choose(['“Come and get me.”', '“Two minutes.”', '“Hello, {dear}.”']);
  if (c === 0) await N('(“Absolutely not. There’s a line. This is the line.” He points at the doorframe, toes curled on the rug.)');
  else if (c === 1) await N('(“One. The floor is a crime.”)');
  else await N('(“Hello, {dear},” he says back, through an enormous yawn.)');
  STATE.busy = false;
  G.hint('Back to bed.', 4);
  await until(() => Math.hypot(PLAYER.x - PARTNER.x, PLAYER.z - PARTNER.z) < 1.4 && !G.busy());
  STATE.busy = true;
  await N('(He waits in the doorway, hopping from foot to foot, until you’re past him. Then he follows you back to bed, complaining about his feet the whole way.)');
  f.style.background = '#000'; f.style.transition = 'opacity 1.2s'; f.classList.add('on'); await wait(1.4);
  G.swapBodies(); S.flags.dawnOn = false; S.flags.dawnDone = true;
  G.setTime({ day: 1, tod: 0, snow: 0.12 }, true);
  f.classList.remove('on'); f.style.transition = 'opacity 2s'; wait(2.2).then(() => { f.style.transition = ''; f.style.background = ''; });
};
inter('dawnWater', [13.05, 1, -1.6], 1.1, 'Glass of water', async () => { await N('(A cold glass of water at the window. Snow everywhere, blue in the half-dark. Not a sound.)'); S.flags.dawnWater = true; }, () => S.flags.dawnOn && !S.flags.dawnWater);
findInter('dawnWater').prio = 1;

/* ---------- the house shows it winning: the more it has convinced you and taken, the more drained the colour,
 * the tidier everything gets (the bed made perfectly, the mugs lined up). ---------- */
G.TICKERS.add(() => {
  const ch = S.chapter;
  if (ch !== 'night' && ch !== 'lastbirthday') return;
  const w = Math.min(1, ((S.vars.corruption || 0) + (S.vars.taken || 0) * 0.7) / 4);
  const u = G.post.grade.uniforms.uMem, base = ch === 'lastbirthday' ? 0.32 : (NIGHT.swapped ? 0.25 : 0);
  u.value += (Math.max(base, base + w * 0.3) - u.value) * 0.02;
  if (w > 0.5 && !NIGHT.tidied && ch === 'night' && !PLAYER.lie && !PARTNER.lie) { NIGHT.tidied = true; G.bedMade && G.bedMade(true); }
});

// Elsewhere on its own (for the chapter list): the night house, then straight through the door.
CH.elsewhere = async () => {
  checkpoint('elsewhere');
  quiet(); STATE.busy = true;
  G.useKids(false); G.setDressed(PLAYER, false); G.setDressed(PARTNER, false);
  G.setTime({ day: 0, tod: 1, snow: 0.25 }, true); houseFor('morning'); G.FIRE.on = true; G.FIRE.level = 0.35;
  for (const L of G.LAMPS) { if (L.power0 == null) L.power0 = L.power; const p = L.g.getWorldPosition(new THREE.Vector3()); if (p.x > 12.5 && p.x < 13.5 && p.y > 1.5) { L.on = true; L.power = 0.9; } }
  NIGHT.door.visible = false; NIGHT.outside = false; NIGHT.canWhistle = false;
  Object.assign(S.flags, { doorOpen: true, povWhistled: false });
  if (!S.flags.sign) S.flags.sign = 'pinecones';
  await elsewhere();
};
// Her whistle, at the kitchen window (only in Elsewhere).
const herWhistle = async () => {
  await wait(Math.min(1.8, G.Audio.whistle(1.12, 0.6) + 0.3));
  await N('(Three notes, out into the dark. Slightly flat on the last one. If he’s awake, he’ll know.)');
  S.flags.povWhistled = true; NIGHT.canWhistle = false;
};
// Either kitchen window will do (the one over the sink, the one by the table), and it wins over the sink's own prompt.
inter('eWhistle', [13.05, 1.3, -1.45], 1.1, 'Whistle', herWhistle, () => NIGHT.canWhistle);
inter('eWhistle2', [13.0, 1.3, 3.85], 1.2, 'Whistle', herWhistle, () => NIGHT.canWhistle);
for (const id of ['eWhistle', 'eWhistle2']) findInter(id).prio = 1;
// In Elsewhere the front door opens: that's the way out to find him.
{ const fd = findInter('frontdoor'), raw = fd && fd.raw; if (fd) rewire('frontdoor', async () => { if (NIGHT.outside) { await N('(Out into the snow.)'); return; } return raw(); }); }

});
