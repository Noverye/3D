'use strict';
/* =========================================================================
 * So no two days are quite the same (his route, the morning and the evening).
 *  - The weather runs in a different order each playthrough.
 *  - The evening power cut always happens the first time you play; after that, only on some evenings
 *    (and the night's echo of it only follows a real one).
 *  - A couple of small unplanned things happen in each stretch of free time, drawn from a pool and steering away
 *    from last time's: the roof shedding its snow, her singing along to the radio, a static shock, hiccups, an owl,
 *    cold feet, the snow suddenly coming down in pillows; outdoors, her shouting to the valley and the valley answering.
 *  - The walk keeps two of its three little moments (the snowy branch, the fox tracks, the ambush), not always the same two. Each is short, and only when she's with you and nothing
 *    else is going on.
 * ========================================================================= */
(G.afterBuild = G.afterBuild || []).push(() => {
const { PLAYER, PARTNER, STATE } = G;
const A = G.SAPI, S = A.S;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private window */ } } };
const dist = () => Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
const say = (t, s = 3) => G.bark(t, s);
const later = (s, fn) => G.wait(s).then(() => { if (free(true)) fn(); });

/* ---------- the weather, in a different order ---------- */
function shuffleWeather() {
  const P = G.WEATHER_PLAN; if (!P) return;
  for (const k of Object.keys(P)) { const a = P[k]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }
}

/* ---------- small things that just happen ---------- */
const EVENTS = {
  roof: { ch: ['morning', 'evening'], run: () => {
    G.Audio.rattle(); G.wait(0.15).then(() => G.Audio.heart && G.Audio.heart(1.6));
    G.gaze && G.gaze(PARTNER, [PARTNER.x, 2.6, PARTNER.z + 1], 2);
    later(0.9, () => say(pick(['What was— oh. The roof’s let go of its snow. All of it. At once.', 'That was the roof. It’s been holding that in all night.']), 3.4));
    later(5, () => say(pick(['I’m not saying I jumped. I’m saying the house jumped.', 'My heart’s still going. Feel. No, don’t, I’m fine.']), 3));
  } },
  sing: { ch: ['morning', 'evening'], ok: () => A.hereRoom() === 'kitchen' || A.hereRoom() === 'living', run: () => {
    if (G.Audio.radio && !G.Audio.radioOn()) { G.Audio.radio(true); if (G.KITCHEN && G.KITCHEN.radioDial) G.KITCHEN.radioDial.material.opacity = 0.9; }
    say(pick(['Oh. Oh, this one. Don’t say anything.', 'I love this song. I don’t know any of the words. That won’t stop me.']), 2.8);
    later(3.5, () => { G.Audio.hum && G.Audio.hum(); say(pick(['♪ …something something, snow on the window, something something you… ♪', '♪ …and the kettle on, and the la la la la… ♪']), 3.6); });
    later(9, () => say(pick(['That’s not how it goes, is it.', 'I’ve sung that wrong for eleven years. I’m not stopping now.']), 3));
  } },
  zap: { ch: ['morning', 'walk', 'evening'], ok: () => dist() < 1.6, run: () => {
    G.Audio.click && G.Audio.click(); G.Audio.tone && G.Audio.tone(2400, 0.04, 0.03);
    PARTNER.forcePose = 'wave'; G.wait(0.5).then(() => { PARTNER.forcePose = null; });
    say(pick(['Ow! You zapped me.', 'Ow! Static. You’re all static. It’s the jumper.']), 2.4);
    later(3, () => say(pick(['On purpose. I saw your face.', 'Do it again. No. Yes. No.']), 2.6));
  } },
  hiccups: { ch: ['morning', 'walk', 'evening'], run: () => {
    say('*hic*', 1.2);
    later(2.5, () => say(pick(['Don’t— *hic* —look at me.', 'It’s nothing. It’s— *hic*. Oh, come on.']), 2.4));
    later(9, () => say('*hic*', 1.2));
    later(16, () => say(pick(['…They’ve gone. Don’t say anything, you’ll bring them back.', 'Gone. I held my breath for a hundred years.']), 3));
  } },
  echo: { ch: ['walk'], ok: () => !G.inside(PLAYER.x, PLAYER.z), run: () => {
    PARTNER.forcePose = 'wave'; G.wait(1.2).then(() => { PARTNER.forcePose = null; });
    say(pick(['*cups her hands* HELLO!', '*cups her hands* IS ANYONE OUT THERE?']), 2);
    for (let i = 0; i < 3; i++) G.wait(1.6 + i * 0.7).then(() => G.Audio.tone && G.Audio.tone(330 - i * 20, 0.25, 0.012 / (i + 1)));
    G.wait(1.8).then(() => G.hint(pick(['(…hello… …ello… …lo…)', '(…out there… …there… …ere…)']), 3));
    later(4.5, () => say(pick(['It answered. It always answers. It’s very polite, this valley.', 'Your turn. No? Coward. Lovingly.']), 3));
  } },
  owl: { ch: ['evening'], run: () => {
    for (const [f, w] of [[392, 0], [349, 0.45], [392, 1.3], [349, 1.6]]) G.Audio.tone && G.Audio.tone(f, 0.32, 0.018, w);
    later(1.8, () => say(pick(['Did you hear that? An owl. He’s very late. Or very early.', 'An owl. In this weather. He must be furious.']), 3.2));
  } },
  feet: { ch: ['morning', 'walk', 'evening'], ok: () => dist() < 2.5, run: () => {
    say(pick(['My feet are ice. Feel. No, don’t. Yes, do.', 'My toes have stopped speaking to me.']), 3);
    later(4, () => say(pick(['Socks. I own eleven pairs. I know where none of them are.', 'You’re warm. That’s just unfair.']), 3));
  } },
  pillows: { ch: ['morning', 'evening'], ok: () => G.inside(PLAYER.x, PLAYER.z) && G.WEATHER && !G.WEATHER.hold, run: () => {
    G.WEATHER.hold = 'heavy';
    later(2, () => say(pick(['Look at it now. It’s coming down in pillows.', 'Come and look. You can’t see the trees.']), 3.2));
    G.wait(45).then(() => { if (G.WEATHER.hold === 'heavy' && !(G._PC && G._PC.out)) G.WEATHER.hold = null; });   // (unless the storm's taken the power)
  } },
};
// When something can just happen: free time, her up and about and near you, nothing else going on.
function free(soft) {
  if (!['morning', 'walk', 'evening'].includes(S.chapter) || (G.herRoute && G.herRoute()) || STATE.asHer || STATE.noControl) return false;
  if (S.chapter === 'walk' && (S.flags.circleShown || PARTNER.hold)) return false;
  if (G.busy() || STATE.sceneShot || PARTNER.hidden || PARTNER.lie || PARTNER.script || PARTNER.task || (PARTNER.sit || 0) > 0.2) return false;
  if (S.chapter === 'evening' && (STATE.watchDoor || STATE.porchDone || (G._PC && G._PC.out))) return false;
  if (S.chapter === 'morning' && S.flags.breakfastDone) return false;
  if (!soft && (PARTNER.bark || !A.canHear() || dist() > 5)) return false;
  return true;
}
const V = { key: '', t: 0, next: 0, todo: [] };
function plan() {
  const ch = S.chapter, last = store.get('snowed.var.last.' + ch, []);
  const all = Object.keys(EVENTS).filter((k) => EVENTS[k].ch.includes(ch));
  const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  V.todo = shuffle(all.filter((k) => !last.includes(k))).concat(shuffle(all.filter((k) => last.includes(k)))).slice(0, 2);
  store.set('snowed.var.last.' + ch, V.todo.slice());
  V.t = 0; V.next = 45 + Math.random() * 40;
}

/* ---------- the walk: two of its three little moments, not always the same two ---------- */
function walkMoments() {
  const all = ['mBranch', 'mTracks', 'mAmbush'];
  if (all.some((k) => S.flags[k]) || S.flags.walkSkip) return;   // already under way
  const last = store.get('snowed.var.walkSkip', null);
  const skip = pick(all.filter((k) => k !== last));
  S.flags.walkSkip = skip; store.set('snowed.var.walkSkip', skip);   // that one doesn't happen this time (moments.js)
}

/* ---------- the power cut: not every evening ---------- */
function rollPowerCut() {
  if (S.flags.pcRoll != null) return;
  const seen = store.get('snowed.pc.seen', false);
  S.flags.pcRoll = !seen || Math.random() < 0.55 ? 1 : 0;
  if (S.flags.pcRoll) store.set('snowed.pc.seen', true);
}

let acc = 0;
G.TICKERS.add((dt) => {
  acc += dt; if (acc < 0.25) return; const step = acc; acc = 0;
  if (!G.S || !S.chapter) return;
  const key = S.run + ':' + S.chapter;
  if (V.key !== key) {
    const was = V.key; V.key = key;
    if (S.chapter === 'morning' && (!was || !was.endsWith(':morning'))) { shuffleWeather(); S.flags.pcRoll = null; }
    if (['morning', 'walk', 'evening'].includes(S.chapter)) plan(); else V.todo = [];
    if (S.chapter === 'walk') walkMoments();
    if (S.chapter === 'evening') rollPowerCut();
  }
  // The power cut only comes on the evenings it's meant to (powercut.js waits for it otherwise).
  if (S.chapter === 'evening' && S.flags.pcRoll === 0 && G._PC && !G._PC.done) G._PC.done = true;
  if (!V.todo.length) return;
  if (!free()) return;
  V.t += step;
  if (V.t < V.next) return;
  const id = V.todo[0], E = EVENTS[id];
  if (E.ok && !E.ok()) { if (V.t > V.next + 30) { V.todo.shift(); V.t = 0; V.next = 30 + Math.random() * 30; } return; }   // not now; maybe the next one
  V.todo.shift(); V.t = 0; V.next = 70 + Math.random() * 50;
  try { E.run(); } catch (e) { console.error(e); }
});

G.VARIETY = { EVENTS, V, free, fire: (id) => EVENTS[id] && EVENTS[id].run() };
});
