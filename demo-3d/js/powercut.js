'use strict';
/* =========================================================================
 * The power cut (the evening), and the night it happens again.
 *  - After the cake, on her route, once: the storm leans on the house and every lamp goes out. She doesn't
 *    like the dark. She takes your hand and keeps it. There are candles in the kitchen drawer. Probably.
 *    You light them on the table by the fire; the power comes back a while later, or when you go to the sofa.
 *  - The night: the lamps go out again. No wind; the snow coming straight down. The imitation says it's only
 *    the storm, and doesn't reach for you.
 * ========================================================================= */
(G.afterBuild = G.afterBuild || []).push(() => {
const { PLAYER, PARTNER, STATE } = G;
const A = G.SAPI, S = A.S, { N, P, choose, wait, inter, addBond, addScrap, fixed, V, findInter } = A;
const dist = () => Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);

/* ---------- candles ---------- */
const CAND = { g: new THREE.Group(), flames: [], lit: false, light: new THREE.PointLight('#ffb35c', 0, 6, 2) };
CAND.g.visible = false; G.world.add(CAND.g);
CAND.light.position.set(7.9, 0.8, 0.82); G.scene.add(CAND.light);
const wax = G.std({ color: '#efe6d6', roughness: 0.65 });
const flameM = new THREE.MeshBasicMaterial({ color: '#ffe2b0', transparent: true, opacity: 0.97, depthWrite: false });
const glowM = new THREE.SpriteMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,214,150,0.9)'); g.addColorStop(0.35, 'rgba(255,170,90,0.35)'); g.addColorStop(1, 'rgba(255,150,60,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
function candle(x, y, z, h) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.023, h, 10), wax); c.position.set(x, y + h / 2, z); c.castShadow = true; CAND.g.add(c);
  const f = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), flameM); f.scale.set(1, 2.3, 1); f.position.set(x, y + h + 0.03, z); f.visible = false; f.userData.ph = Math.random() * 6; CAND.g.add(f); CAND.flames.push(f);
  const halo = new THREE.Sprite(glowM); halo.renderOrder = 4; halo.scale.set(0.16, 0.2 / 2.3, 1); f.add(halo);   // (the flame is stretched 2.3× in y)
}
candle(7.52, 0.455, 0.98, 0.15); candle(8.22, 0.455, 0.72, 0.11); candle(8.28, 0.455, 0.98, 0.08);
function light(on) { CAND.lit = on; CAND.flames.forEach((f) => { f.visible = on; }); }
function tickCandles(t) {
  if (!CAND.g.visible || !CAND.lit) { CAND.light.intensity = 0; return; }
  CAND.light.intensity = (PC.out ? 1.5 : 0.55) * (0.88 + 0.08 * Math.sin(t * 9.1) + 0.05 * Math.sin(t * 23.7 + 1));
  CAND.flames.forEach((f) => { const ph = f.userData.ph; f.scale.y = 2.3 + 0.35 * Math.sin(t * 11 + ph) + 0.2 * Math.sin(t * 27 + ph); f.rotation.z = 0.12 * Math.sin(t * 5 + ph); });
}

/* ---------- lamps ---------- */
const PC = G._PC = { done: false, out: false, settle: 0, t: 0, nagged: 0, rehold: 0, night: false, nightT: 0, saved: null };
function lampsOff() { PC.saved = G.LAMPS.map((L) => L.on); G.LAMPS.forEach((L) => { L.on = false; }); PC.out = true; }
function lampsOn() { if (PC.saved) G.LAMPS.forEach((L, i) => { L.on = PC.saved[i]; }); PC.saved = null; PC.out = false; }
async function stutter(n = 3) {
  const on = G.LAMPS.filter((L) => L.on);
  for (let k = 0; k < n; k++) { on.forEach((L) => { L.power *= 0.2; }); await wait(0.07 + Math.random() * 0.08); on.forEach((L) => { L.power /= 0.2; }); await wait(0.1 + Math.random() * 0.25); }
}

/* ---------- the evening ---------- */
async function powerCut() {
  PC.done = true; PC.t = 0; S.flags.powerCut = 1;
  const p = PARTNER;
  if (p.task) G.endPartnerTask();
  if (G.WEATHER) G.WEATHER.hold = 'heavy';
  G.Audio.rattle(); await wait(0.9); G.Audio.rattle();
  await stutter(3);
  lampsOff(); G.Audio.creak && G.Audio.creak();
  await N('(The wind throws itself at the house. The lamps stutter, and go out. All of them, at once.)');
  if (dist() > 1.3) { p.mode = 'script'; await Promise.race([G.walkTo(p, PLAYER.x + 0.55, PLAYER.z + 0.35, 1.8), wait(3.5)]); p.mode = 'follow'; }
  G.setHold(true); p.holdTimer = null;
  await P('Oh. Oh, I don’t like that.');
  await P('Don’t let go. I mean it.');
  const c = await choose(['“I’ve got you.”', '“Are you scared of the dark?”', '“It’s only the storm.”']);
  if (c === 0) { await P('*squeezes* Good. Keep having me.'); addBond(0.3); }
  else if (c === 1) await P('No. Yes. A reasonable amount. The dark in a cabin is a great deal of dark.');
  else { S.flags.onlyStorm = 1; await P('I know it’s only the storm. I would just like the storm to know I’m not on my own.'); }
  await P('There are candles in the kitchen drawer. Probably. Come with me. Don’t let go.');
  G.hint('(Find the candles: the drawer by the stove.)', 6);
}
inter('pcCandles', [11.45, 0.85, -1.55], 1.1, 'Find the candles', async () => {
  const p = PARTNER;
  await N('(You feel along the drawer: string, a corkscrew, the spare key, something that was once a biscuit. Candles. Matches.)');
  STATE.sceneShot = true;
  // From behind the table, low, the hearth at your back: the candles in front, the two of them lit from below.
  const shot = fixed(V(7.85, 1.0, -0.3), V(7.9, 1.0, 1.55), 54, 0.012);
  await G.cutTo(() => {
    G.setDressed(PLAYER, false); G.setDressed(p, false);
    G.standAt(PLAYER, 7.5, 1.5, Math.PI); G.standAt(p, 8.3, 1.45, Math.PI); p.mode = 'still'; p.stillLook = { x: 7.9, z: 0.85, headY: 0.6 };
    CAND.g.visible = true; G.setShot(shot);
  }, 0.3);
  for (let i = 0; i < CAND.flames.length; i++) { G.Audio.strike && G.Audio.strike(); await wait(0.5); CAND.flames[i].visible = true; CAND.lit = true; await wait(0.35); }
  await P('There.', { shot: 'keep' });
  await N('(Three small flames, and the fire, and her face lit gold from underneath. The storm can do what it likes.)', { shot: 'keep' });
  await P('This is better than the lamps. Don’t tell the lamps.', { shot: 'keep' });
  await P('Will you sit with me until it comes back? …And after it comes back?', { shot: 'keep' });
  addScrap('candles', 'The power cut. Candles from the kitchen drawer, her hand that wouldn’t let go, and the storm doing what it liked.');
  addBond(0.3);
  STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true;
  p.mode = 'follow'; G.setHold(true); p.holdTimer = null;
  PC.t = 0;
}, () => PC.out && !CAND.lit && S.chapter === 'evening');
A.findInter('pcCandles').prio = 2; A.findInter('pcCandles').scene = () => true;   // (a scene for two, played as her too)

async function powerBack(quiet) {
  await stutter(2); lampsOn();
  if (G.WEATHER) G.WEATHER.hold = null;
  if (quiet) return;
  G.bark(S.flags.onlyStorm ? 'And we’re back. It was only the storm. I was extremely brave throughout.' : 'And we’re back. I was extremely brave throughout.', 3.2);
  if (PARTNER.hold) PARTNER.holdTimer = 8;
}
// The sofa scene: let the lamps come back first, quietly, so it plays as it always has.
{ const f = G.Story.cuddle; G.Story.cuddle = function (...a) { if (PC.out) { lampsOn(); if (G.WEATHER) G.WEATHER.hold = null; } return f.apply(this, a); }; }

function updateEvening(dt) {
  if (S.chapter !== 'evening') { if (PC.out && S.chapter !== 'night') lampsOn(); return; }
  if (PC.out) {
    PC.t += dt;
    // She keeps hold of you in the dark. Let go, and she takes your hand again in a moment.
    if (!PARTNER.hold && !G.busy() && !PARTNER.hidden && PARTNER.mode === 'follow' && dist() < 3 && !(PARTNER.sit > 0.1) && !(PLAYER.sit > 0.1)) {
      PC.rehold += dt;
      if (PC.rehold > 4 && PC.nagged < 3) { PC.rehold = 0; PC.nagged++; G.setHold(true); PARTNER.holdTimer = null; G.bark(['Hand. Please.', 'I’ll just have this back.', 'Not yet. Not in the dark.'][PC.nagged - 1], 2.2); }
    } else PC.rehold = 0;
    if (!CAND.lit && PC.t > 110 && PC.nagged < 9 && !G.busy() && !PARTNER.bark) { PC.nagged = 9; G.bark('Candles. The kitchen drawer. I’m not going on my own.', 3); }
    if (!G.busy() && (CAND.lit ? PC.t > 75 : PC.t > 220)) A.run(() => powerBack(false));
    return;
  }
  if (PC.done) return;
  const ok = STATE.cakeDone && !STATE.cuddled && !STATE.porchDone && !STATE.watchDoor && !G.busy() && G.inside(PLAYER.x, PLAYER.z)
    && !PARTNER.hidden && !PARTNER.lie && dist() < 7 && !(G.NIGHT && G.NIGHT.swapped) && !STATE.asHer && STATE.todTarget < 0.5;
  PC.settle = ok ? PC.settle + dt : 0;
  if (PC.settle > 35) { PC.settle = 0; A.run(powerCut); }
}

/* ---------- the night: again, and no storm ---------- */
function updateNight(dt) {
  if (S.chapter !== 'night' || PC.night || !S.flags.powerCut) return;
  const free = S.flags.nightUp && !S.flags.doorOpen && !S.flags.fakeWithdrawn && !(G.NIGHT && (G.NIGHT.slipping || G.NIGHT.swapped))
    && !PLAYER.lie && !PARTNER.lie && !PARTNER.hidden && PARTNER.mode === 'follow' && !G.busy() && dist() < 4 && G.inside(PLAYER.x, PLAYER.z);
  PC.nightT = free ? PC.nightT + dt : 0;
  if (PC.nightT < 40) return;
  PC.night = true;
  A.run(async () => {
    const p = PARTNER;
    lampsOff(); G.Audio.creak && G.Audio.creak();
    p.mode = 'still'; G.gaze(p, [PLAYER.x, PLAYER.y + 1.6, PLAYER.z], 7);
    await wait(1.2);
    await P('It’s only the storm.');
    await N('(Outside, the snow is coming straight down. There is no wind at all.)');
    await wait(1.5);
    await N('(In the dark it stands quite still beside you. It doesn’t reach for your hand.)');
    await wait(1.2);
    lampsOn();
    await P(S.flags.onlyStorm ? 'There. It was only the storm. You said so.' : 'There. All better.');
    if (S.chapter === 'night') p.mode = 'follow';
  });
}

(G.onJump = G.onJump || []).push(() => {
  if (PC.out) lampsOn();
  Object.assign(PC, { done: false, out: false, settle: 0, t: 0, nagged: 0, rehold: 0, night: false, nightT: 0, saved: null });
  light(false); CAND.g.visible = false; if (G.WEATHER && G.WEATHER.hold === 'heavy') G.WEATHER.hold = null;
});
G.STEP_HOOKS.push((dt) => {
  if (!STATE.started) return;
  updateEvening(dt); updateNight(dt); tickCandles(G.simT);
  // The candles stay lit for the rest of the evening (and The First Snow doesn't have them).
  if (CAND.g.visible && !/^(evening|bedtime)$/.test(S.chapter || '')) { light(false); CAND.g.visible = false; }
});
});
