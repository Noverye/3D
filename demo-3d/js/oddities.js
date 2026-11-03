'use strict';
/* =========================================================================
 * Small things that aren't quite right, in the daytime (his route). Suspense, not horror: nothing chases you,
 * nothing is explained, nobody makes a fuss. Two per playthrough, drawn from a pool, steering away from last time's.
 *  - The clock: it stops ticking for a few seconds. If you look at it then, it's four minutes slow. Look again:
 *    four minutes fast, the way it's always been.
 *  - The whistle: standing right next to her, you hear three notes from the kitchen. Her three notes. She doesn't
 *    seem to hear them.
 *  - The frame: in the morning, from across the room, the empty frame in the hall has a photograph in it. Closer,
 *    it's empty. (By the evening, it won't be.)
 *  - The prints: on the walk, a line of footprints comes out of the trees and up to the bottom step. Not back.
 * Gentle nights don't change these: they're the day.
 * ========================================================================= */
(G.afterBuild = G.afterBuild || []).push(() => {
const { PLAYER, PARTNER, STATE } = G;
const A = G.SAPI, S = A.S, { N, P } = A;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private window */ } } };
const dist = () => Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
const CLOCK = { x: 5.4, z: 1.5 }, FRAME = { x: 7.75, z: 4.43 };
const O = { run: null, todo: [], done: new Set(), clockWrong: 0, frameShown: false, prints: false };
const quiet = () => !G.busy() && !STATE.sceneShot && document.body.classList.contains('playing') && !(G.herRoute && G.herRoute()) && !STATE.asHer;

function plan() {
  const all = ['clock', 'whistle', 'frame', 'prints'], last = store.get('snowed.odd.last', []);
  const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  O.todo = shuffle(all.filter((k) => !last.includes(k))).concat(shuffle(all.filter((k) => last.includes(k)))).slice(0, 2);
  store.set('snowed.odd.last', O.todo.slice()); O.done = new Set(); O.clockWrong = 0; O.frameShown = false; O.prints = false; O.t = 0;
}
const want = (id) => O.todo.includes(id) && !O.done.has(id);

/* the clock */
{ const it = G.INTER.find((i) => i.id === 'clock'); if (it) { const orig = it.act; it.act = () => {
  if (O.clockWrong > G.simT) { O.clockWrong = 0; return A.run(async () => { await N('(The clock is four minutes slow.)'); await N('(You look again. Four minutes fast, the way it’s always been.)'); }, 'clock'); }
  return orig();
}; } }
function tryClock() {
  if (!want('clock') || !G.inside(PLAYER.x, PLAYER.z) || Math.hypot(PLAYER.x - CLOCK.x, PLAYER.z - CLOCK.z) > 4) return;
  O.done.add('clock'); G.Audio.tickHold(6); O.clockWrong = G.simT + 14;
}
/* the whistle from the kitchen, while she's right beside you */
function tryWhistle() {
  if (!want('whistle') || PARTNER.hidden || PARTNER.lie || dist() > 2.2 || !G.inside(PLAYER.x, PLAYER.z) || A.hereRoom() === 'kitchen' || PARTNER.bark || G.Audio.radioOn()) return;
  O.done.add('whistle');
  G.Audio.whistle(1.12, 0.3, { at: 'kettle', vol: 0.05 });
  // She doesn't hear it. Or she does, and doesn't say.
  G.wait(2.4).then(() => { if (quiet() && !PARTNER.bark && Math.random() < 0.5) G.bark(pick(['Hm? What is it?', 'You’ve gone all still.', 'What? Have I got something on my face?']), 2.4); });
}
/* the frame, from across the room */
function tryFrame() {
  if (S.chapter !== 'morning' || !G.EVE || !G.EVE.photo) return;
  const E = G.EVE, d = Math.hypot(PLAYER.x - FRAME.x, PLAYER.z - FRAME.z);
  if (O.frameShown) { if (d < 2.6 || G.simT > O.frameShown) { E.photo.visible = false; O.frameShown = false; O.done.add('frame'); } return; }
  if (!want('frame') || d > 6.5 || d < 3.4) return;
  const fx = FRAME.x - PLAYER.x, fz = FRAME.z - PLAYER.z, facing = (fx * Math.sin(PLAYER.yaw) + fz * Math.cos(PLAYER.yaw)) / d;
  if (facing < 0.8 || (PLAYER.speed || 0) < 0.3) return;
  if (!E.photo.material.map) { E.showPhoto(); } else E.photo.visible = true;
  O.frameShown = G.simT + 6;
}
/* the prints, out of the trees and up to the step */
function layPrints() {
  if (O.prints || !G.addFootprint || !G.pathX) return; O.prints = true;
  const x0 = 1.2, z0 = 13.6, x1 = 6.2, z1 = 8.2, n = 18, yaw = Math.atan2(x1 - x0, z1 - z0);
  for (let k = 0; k < n; k++) { const t = k / (n - 1); G.addFootprint(x0 + (x1 - x0) * t + (k % 2 ? 0.07 : -0.07), z0 + (z1 - z0) * t, yaw, k % 2, 0.95, true); }
}
A.inter('oddPrints', [5.4, 0.3, 9.0], 1.3, 'Footprints', async () => {
  O.done.add('prints');
  await N('(A line of footprints, coming out of the trees and up to the bottom step. Not going back.)');
  if (A.canHear() && dist() < 5) { await P(pick(['Postman, probably.', 'Someone came to the door and thought better of it.'])); await P('We don’t have a postman.'); }
}, () => S.chapter === 'walk' && O.prints && !O.done.has('prints') && !S.flags.walkMeadow);

let acc = 0;
G.TICKERS.add((dt) => {
  acc += dt; if (acc < 0.2) return; acc = 0;
  if (!G.S || !S.chapter) return;
  if (S.chapter === 'morning' && O.run !== S.run) { O.run = S.run; plan(); }
  if (!O.todo.length) return;
  if (S.chapter === 'walk' && want('prints')) layPrints();
  if (S.chapter === 'morning') tryFrame();
  if (!['morning', 'evening'].includes(S.chapter) || !quiet()) return;
  if (S.chapter === 'evening' && STATE.watchDoor) return;
  O.t = (O.t || 0) + 0.2; if (O.t < 30) return;   // not straight away
  tryClock(); tryWhistle();
});
G.ODD = O;
});
