'use strict';
/* =========================================================================
 * Partner, more helpful and more aware (his route, free time only).
 *  - She knows what the day is waiting for (pancakes, breakfast, the cake, the sofa, the porch). If you've been
 *    wandering a while without getting closer, she says so in her own words, walks a few steps that way and points.
 *  - She notices when you're walking into a wall.
 *  - She remembers the day you've had: the pinecones, the race, the ambush, the branch, the fox, the photographs,
 *    the snowman; and the circle, which she doesn't want to talk about.
 *  - She feeds the fire herself when it's getting low and there are logs in the basket (life.js).
 * Not in the night or Act IV: that isn't her.
 * ========================================================================= */
(G.afterBuild = G.afterBuild || []).push(() => {
const { PLAYER, PARTNER, STATE } = G;
const A = G.SAPI, S = A.S, { N, P } = A;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const dist = () => Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
const hers = () => !!G.S && /^(morning|walk|evening|ending_|firstsnow)/.test(S.chapter || '') && !(G.NIGHT && G.NIGHT.swapped);
const canTalk = () => STATE.started && !G.busy() && !PARTNER.hidden && !PARTNER.lie && !PARTNER.bark && !PARTNER.task && !PARTNER.script && !PARTNER.lead && !(S.flags && S.flags.noBarks) && !document.body.classList.contains('ending');

/* ---------- what the day is waiting for ---------- */
function goal() {
  const ch = S.chapter, F = S.flags;
  if (ch === 'morning') {
    if (PARTNER.lie) return null;   // she's still in bed: the hints there are the game's
    if (!F.pancakesMade) return { x: 12.3, z: -1.2, lines: ['Pancakes, {toHim}. The stove’s through in the kitchen. I’ll supervise.', 'The kitchen is that way. The pancakes won’t make themselves. I’ve asked them.'] };
    if (!F.breakfastDone) return { x: 13.0, z: 1.9, lines: ['Breakfast’s on the table. Sit with me before it goes cold.', 'Table, {toHim}. I’m starving and I refuse to eat alone.'] };
    return null;
  }
  if (ch === 'evening' && !STATE.porchDone) {
    if (STATE.watchDoor) return { x: 6.5, z: 3.6, lines: ['Inside, {toHim}. There’s something I want you to see.', 'Come in, come in. Close your eyes. No, open them.'] };
    if (!STATE.cakeDone && G.CAKE) { const p = G.CAKE.g.position; return { x: p.x + 0.6, z: p.z + 0.6, lines: ['There is… something on the table by the fire. Go and look. Don’t ask me why.', 'Have you looked at the table? Go and look at the table.'] }; }
    if (!STATE.cuddled && G.SOFA) return { x: G.SOFA.x, z: G.SOFA.z - 0.6, lines: ['Come and sit with me. The sofa’s got our shape in it.', 'Sofa. Blanket. You. In that order.'] };
    if (G.BENCH) return { x: G.BENCH.x, z: G.BENCH.z + 0.8, lines: ['The porch, {toHim}. The stars are out. Come and look.', 'Bring your coat. The bench on the porch has the best view of the sky.'] };
  }
  return null;
}
const HELP = { t: 0, best: 1e9, said: 0, key: null, cd: 0 };
async function pointTowards(g) {
  const p = PARTNER, a = Math.atan2(g.x - p.x, g.z - p.z), d = Math.min(2.2, Math.hypot(g.x - p.x, g.z - p.z) - 1);
  G.bark(g.lines[HELP.said++ % g.lines.length], 3.6);
  if (d > 0.6 && G.navOpen && G.navOpen(p.x + Math.sin(a) * d, p.z + Math.cos(a) * d)) await Promise.race([G.walkTo(p, p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, 1.3), G.wait(3)]);
  if (G.busy() || p.task) return;
  p.yaw = Math.atan2(g.x - p.x, g.z - p.z); p.gaze = { x: g.x, z: g.z, headY: 1.0, t: 2.5 };
  p.forcePose = 'wave'; await G.wait(1.1); if (p.forcePose === 'wave') p.forcePose = null;
}
function updateHelp(dt) {
  const g = hers() ? goal() : null;
  if (!g) { HELP.t = 0; HELP.key = null; return; }
  const key = g.lines[0];
  if (key !== HELP.key) { HELP.key = key; HELP.t = 0; HELP.best = 1e9; HELP.said = 0; }
  const d = Math.hypot(PLAYER.x - g.x, PLAYER.z - g.z);
  if (d < HELP.best - 1.5 || d < 2.5) { HELP.best = Math.min(HELP.best, d); HELP.t = 0; return; }   // getting there
  if (G.busy() || STATE.paused) return;
  HELP.t += dt; HELP.cd -= dt;
  const wait = HELP.said ? 75 : 40;
  if (HELP.t > wait && HELP.cd <= 0 && canTalk() && dist() < 7) { HELP.t = 0; HELP.best = d; HELP.cd = 30; A.run(() => pointTowards(g)); }
}

/* ---------- walking into walls ---------- */
const BUMP = { t: 0, cd: 0, x: 0, z: 0 };
function updateBump(dt) {
  BUMP.cd -= dt;
  const pushing = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some((k) => G.keys && G.keys.has(k));
  const moved = Math.hypot(PLAYER.x - BUMP.x, PLAYER.z - BUMP.z) / Math.max(dt, 1e-3); BUMP.x = PLAYER.x; BUMP.z = PLAYER.z;
  if (pushing && moved < 0.15 && !G.busy() && !PLAYER.freeSit && !PLAYER.lie && !(PLAYER.sit > 0.1) && !STATE.noControl) BUMP.t += dt; else BUMP.t = 0;
  if (BUMP.t > 1.8 && BUMP.cd <= 0 && hers() && canTalk() && dist() < 6) { BUMP.t = 0; BUMP.cd = 70; G.bark(pick(['That’s a wall, {toHim}. Walls don’t move. I’ve checked.', 'Other way, {dear}.', 'Are you trying to walk through that? Bold.']), 2.8); }
}

/* ---------- the day you've had: she remembers it ---------- */
const MEM = { cd: 40, used: new Set() };
const DAY = [
  { id: 'pine_won', when: () => S.mem.pinecones === 'won', text: 'You won the pinecones. I’ve decided to be gracious about it. Starting tomorrow.' },
  { id: 'pine_lost', when: () => S.mem.pinecones === 'lost', text: 'I still have my victory gloves on. In case you’d forgotten who won the pinecones.' },
  { id: 'burnt', when: () => S.flags.pancakeQuality === 'burnt', text: 'For the record, the burnt pancake was my favourite. It had character.' },
  { id: 'golden', when: () => S.flags.pancakeQuality === 'golden', text: 'Those pancakes this morning. I’m still thinking about them. Is that strange?' },
  { id: 'ambush', when: () => S.flags.mAmbush, text: 'My aim this afternoon was perfect, I thought. Right in the scarf.' },
  { id: 'branch', when: () => S.flags.mBranch, text: 'I haven’t forgotten the branch. I want you to know that I haven’t forgotten the branch.' },
  { id: 'fox', when: () => S.flags.mTracks, text: 'Do you think the fox is all right? The one with opinions.' },
  { id: 'photo', when: () => (S.photos || []).length > 0, text: 'We should look at the photographs later. Even the ones where I’m blinking.' },
  { id: 'snowman', when: () => G.S.life && G.S.life.snowman, text: 'Do you think the snowman’s cold? He doesn’t have a scarf. I worry.' },
  { id: 'hill', when: () => (S.scrap || []).some((p) => p.art === 'hill'), text: 'What you said on the hill. About being the same people. I keep thinking about it.' },
  { id: 'circle', when: () => S.mem.circleSeen, text: 'That ring of grass. I keep thinking about it. …No. I’m not thinking about it. I’ve decided.' },
];
function updateMemories(dt) {
  MEM.cd -= dt;
  if (MEM.cd > 0 || S.chapter !== 'evening' || STATE.watchDoor || !canTalk() || dist() > 4 || (PARTNER.sit || 0) > 0.2) return;
  const b = DAY.find((x) => !MEM.used.has(x.id) && x.when());
  if (!b) return;
  MEM.used.add(b.id); MEM.cd = 55 + Math.random() * 35; G.bark(b.text, 4.2);
}

/* ---------- she joins you at the window ---------- */
const WIN = { cd: 10, n: 0, v: new THREE.Vector3(), q: new THREE.Vector3() };
function windowLine() {
  if (STATE.tod > 0.7) return pick(['What are you looking at? …Oh. The stars are out. All of them, by the look of it.', 'It’s so dark out there. And so bright in here. I like that.']);
  if ((STATE.snow || 0) > 0.5) return pick(['It’s still coming down. We may never leave. What a pity.', 'Look at it. Every flake on its way to somewhere.']);
  return pick(['What are you looking at? …Oh. It’s lovely, isn’t it.', 'You can see our footprints from here. Look. Two sets.']);
}
function updateWindow(dt) {
  WIN.cd -= dt;
  if (WIN.cd > 0 || WIN.n >= 3 || !hers() || !G.WINDOWS || !G.inside(PLAYER.x, PLAYER.z) || (PLAYER.idleT || 0) < 6 || PLAYER.sit > 0.1 || PLAYER.freeSit || !canTalk() || PARTNER.mode !== 'follow' || PARTNER.carry || PARTNER.hold || (PARTNER.sit || 0) > 0.1) return;
  if (dist() > 8) return;
  const fx = Math.sin(PLAYER.yaw), fz = Math.cos(PLAYER.yaw);
  for (const w of G.WINDOWS) {
    if (w.study) continue;
    w.inn.getWorldPosition(WIN.v);
    if (WIN.v.y > 2.2) continue;   // the gable windows are out of reach of anyone's view
    const dx = WIN.v.x - PLAYER.x, dz = WIN.v.z - PLAYER.z, d = Math.hypot(dx, dz);
    if (d > 1.4 || d < 0.2 || (dx * fx + dz * fz) / d < 0.7) continue;
    // Stand beside him, on whichever side she's nearer, a touch back from the glass.
    const tx = -dz / d, tz = dx / d, side = ((PARTNER.x - PLAYER.x) * tx + (PARTNER.z - PLAYER.z) * tz) >= 0 ? 1 : -1;
    // Try beside him first (her side, then the other), then a little behind; furniture often fills the obvious spot.
    let sx = null, sz = null;
    for (const [lat, back] of [[0.62, 0], [-0.62, 0], [0.8, 0.25], [-0.8, 0.25], [0.5, 0.5], [-0.5, 0.5], [0.95, 0.55], [-0.95, 0.55], [0.3, 0.75], [-0.3, 0.75]]) {
      const x = PLAYER.x + tx * lat * side - (dx / d) * back, z = PLAYER.z + tz * lat * side - (dz / d) * back;
      if (G.inside(x, z) && (!G.navOpen || G.navOpen(x, z))) { sx = x; sz = z; break; }
    }
    if (sx == null) { WIN.cd = 20; return; }
    WIN.cd = 80; WIN.n++;
    const look = { x: WIN.v.x, y: 1.35, z: WIN.v.z };
    PARTNER.task = { o: { id: 'window', spot: { x: sx, z: sz }, yaw: Math.atan2(WIN.v.x - sx, WIN.v.z - sz), dur: [5.5, 6.5], look, noReach: true,
      onArrive: (p) => { p.gaze = { x: look.x, z: look.z, headY: 1.35, t: 5 }; G.bark(windowLine(), 4.2); },
      onEnd: () => { if (dist() < 1.6 && HAND.cd <= 0) G.wait(0.3).then(() => { if (dist() < 1.6 && canHold()) takeHand(['*takes your hand*', '*her hand finds yours*'], 14 + Math.random() * 8); }); } }, phase: 'go', t: 0 };
    return;
  }
}

/* ---------- she takes your hand: walking together outside, after the window, on the porch ---------- */
const HAND = { walk: 0, porch: 0, cd: 30 };
const canHold = () => hers() && canTalk() && PARTNER.mode === 'follow' && !PARTNER.hold && !PARTNER.carry && !PLAYER.carry && !(PARTNER.sit > 0.1) && !(PLAYER.sit > 0.1) && !PLAYER.freeSit && !STATE.dancing && !STATE.hugging;
function takeHand(lines, dur) {
  G.setHold(true); PARTNER.holdTimer = dur; HAND.cd = 90 + Math.random() * 40;
  G.bark(pick(lines), 2.6);
  S.mem.partnerInit = (S.mem.partnerInit || 0) + 1;
}
function updateHand(dt) {
  HAND.cd -= dt;
  const out = !G.inside(PLAYER.x, PLAYER.z), d = dist();
  const roof = G.underRoof && G.underRoof(PLAYER.x, PLAYER.z);
  HAND.walk = out && !roof && (PLAYER.speed || 0) > 0.6 && (PLAYER.speed || 0) < 2.4 && d < 2.4 ? HAND.walk + dt : Math.max(0, HAND.walk - dt * 2);
  HAND.porch = out && roof && G.underRoof(PARTNER.x, PARTNER.z) && (PLAYER.idleT || 0) > 0.5 && d < 2 ? HAND.porch + dt : 0;
  if (HAND.cd > 0 || !canHold()) return;
  if (HAND.walk > 7) { HAND.walk = 0; takeHand(['*slips her hand into yours* Cold fingers. Mine now.', '*takes your hand* For balance. Obviously.', '*finds your hand without looking*'], 22 + Math.random() * 12); }
  else if (HAND.porch > 5) { HAND.porch = 0; takeHand(['*takes your hand* Look at it all.', '*leans into you and laces her fingers through yours*'], 18 + Math.random() * 8); }
}

/* ---------- meanwhile: short cutaways to her, while you're apart ----------
 * When she's been on her own a while (in bed in the morning, or busy with something of hers) and you're
 * somewhere else, the camera slips away to her for a few seconds, then back. Nothing to do: just her,
 * when she thinks nobody's watching. Twice a chapter at most, each one only once. */
const VIG = (G._VIG = { used: new Set(), n: 0, t: 0, cd: 40, ch: null, on: false });
const VIGS = {
  bed: { text: '(Back in the bedroom, she stretches an arm across into the warm patch you left, pulls your pillow over to her side, and sighs like someone who has won something.)', her: '*into the pillow* …Mine.' },
  read: { text: '(In the armchair, she reads the same paragraph three times, then looks up at the doorway you went through.)', her: '*quietly* Come back and do the voices.' },
  nap: { text: '(Curled in the corner of the sofa with the blanket up to her nose, half asleep, she pats the empty cushion beside her. Twice. Checking.)' },
  radio: { text: '(In the kitchen, she dances with no one, badly and on purpose, and laughs at herself when the song ends.)', her: '*to the radio* He’d have trodden on my foot by now.' },
  water: { text: '(She waters the plants one by one and tells each of them something. You can’t hear what. Basil gets the longest.)' },
  stoke: { text: '(Kneeling at the hearth, she feeds the fire a log and watches it catch, her face gone orange.)', her: '*to the fire* Keep him warm. That’s your only job.', snd: 'catchFire' },
  books: { text: '(At the bookshelf, she finds the book you’re halfway through, moves the bookmark one page on, thinks about it, and moves it back.)', snd: 'page' },
  lwin: { text: '(At the window, she breathes on the glass and draws a small heart. She wipes it away before anyone can see. Then she draws it again.)', snd: 'squeak' },
  kwin: { text: '(At the kitchen window, she breathes on the glass and draws a small heart. She wipes it away before anyone can see. Then she draws it again.)', snd: 'squeak' },
  basil: { text: '(She leans close to the basil and whispers to it, very seriously. It sounds like a secret. It sounds like it’s about you.)' },
};
G.VIGS = VIGS;
function vigFor() {
  const p = PARTNER;
  if (S.chapter === 'morning' && p.lie && !VIG.used.has('bed')) return 'bed';
  const T = p.task; if (!T || T.phase !== 'do' || p.hidden) return null;
  const id = T.o.id; return VIGS[id] && !VIG.used.has(id) ? id : null;
}
function vigShot(id) {
  const p = PARTNER, V3 = THREE.Vector3;
  if (id === 'bed') { const B = G.BED; return { pos: new V3(B.x + 0.05, 2.2, -0.9), look: new V3(B.x + 0.02, 0.72, -1.65) }; }
  const sit = (p.sit || 0) > 0.5, hy = sit ? 1.0 : 1.45, head = new V3(p.x, hy, p.z);
  for (const [a, r] of [[0.6, 1.8], [-0.6, 1.8], [0.95, 1.6], [-0.95, 1.6], [0.3, 1.5], [-0.3, 1.5], [1.4, 1.5], [-1.4, 1.5], [1.9, 1.5], [-1.9, 1.5], [2.4, 1.6], [-2.4, 1.6], [Math.PI, 1.6], [1.2, 1.1], [-1.2, 1.1]]) {
    const ya = p.yaw + a, pos = new V3(p.x + Math.sin(ya) * r, hy + 0.15, p.z + Math.cos(ya) * r);
    if (G.inside(p.x, p.z) !== G.inside(pos.x, pos.z)) continue;
    if (G.camBlocked && G.camBlocked(head, pos)) continue;
    return { pos, look: new V3(p.x, hy - 0.12, p.z) };
  }
  return null;
}
async function meanwhile(id) {
  const v = VIGS[id], sh = vigShot(id);
  if (!sh) { VIG.used.add(id); return; }
  VIG.on = true; VIG.used.add(id); VIG.n++; VIG.cd = 120;
  G.remember && G.remember('vig', id);
  STATE.busy = true; STATE.sceneShot = true;
  const was = PLAYER.speed; PLAYER.speed = 0;
  G.setShot(A.fixed(sh.pos, sh.look, 40, 0.014));
  if (v.snd && G.Audio[v.snd]) G.Audio[v.snd]();
  if (id === 'radio' || id === 'water' || id === 'basil') G.Audio.hum();
  await N(v.text, { shot: 'keep', auto: 6.5 });
  if (v.her) await P(v.her, { shot: 'keep', auto: 3.2 });
  STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true;
  STATE.busy = false; VIG.on = false;
}
function updateMeanwhile(dt) {
  // He's got up; she stops holding on to where he was and settles into the warm patch.
  if (S.chapter === 'morning' && PARTNER.lie && PARTNER.cuddle && !PLAYER.lie && !G.busy()) { G.lieDown(PARTNER, G.BED.R, PARTNER.z, PARTNER.lieRoll || 0, 0); G.shapeBed({ R: true }); }
  if (S.chapter !== VIG.ch) { VIG.ch = S.chapter; VIG.n = 0; VIG.t = 0; VIG.cd = 40; }
  VIG.cd -= dt;
  if (!/^(morning|evening)$/.test(S.chapter || '') || !hers() || VIG.on) { VIG.t = 0; return; }
  const apart = dist() > 6.5 && !(A.sameRoom && A.sameRoom());
  const id = apart && !G.busy() && !PLAYER.lie && !STATE.noControl ? vigFor() : null;
  VIG.t = id ? VIG.t + dt : 0;
  if (id && VIG.t > 14 && VIG.cd <= 0 && VIG.n < 2) { VIG.t = 0; A.run(() => meanwhile(id)); }
}

/* ---------- running indoors; coming back after leaving her alone ---------- */
const RUN = { t: 0, cd: 30, n: 0 };
function updateRun(dt) {
  RUN.cd -= dt;
  RUN.t = G.inside(PLAYER.x, PLAYER.z) && (PLAYER.speed || 0) > 2.4 ? RUN.t + dt : 0;
  if (RUN.t > 1.5 && RUN.cd <= 0 && RUN.n < 2 && hers() && canTalk() && dist() < 7) {
    RUN.t = 0; RUN.cd = 150; RUN.n++;
    G.bark(RUN.n === 1 ? 'No running in the cabin, {toHim}. House rules. I’ve just made them.' : 'Mind the— …You missed it. Well done.', 3);
  }
}
const AWAY = { t: 0, cd: 0 };
function updateAway(dt) {
  AWAY.cd -= dt;
  if (!/^(morning|evening)$/.test(S.chapter || '') || !hers() || PARTNER.hidden || PARTNER.lie) { AWAY.t = 0; return; }
  const d = dist();
  if (d > 14 && !G.busy()) { AWAY.t += dt; return; }
  if (AWAY.t > 45 && d < 3.5 && AWAY.cd <= 0 && canTalk()) {
    AWAY.t = 0; AWAY.cd = 120;
    G.bark(pick(['There you are. I was about to send out a search party. It was going to be me.', 'Oh, good, you’re back. I missed you. Don’t tell anyone.', 'Where did you get to? …You can tell me later. Come here.']), 3.6);
    PARTNER.gaze = { x: PLAYER.x, z: PLAYER.z, headY: 1.55, t: 2 };
  } else if (d < 3.5) AWAY.t = 0;
}

/* ---------- the night: it has learned her habits, and does them wrong ----------
 * It feeds a fire that doesn't need feeding. It's beside you at the window before you hear it come. It says
 * "There you are" when you never went anywhere. Once each, per night. */
const WRONG = G._WRONG = { fire: false, win: false, there: false, near: 0, winT: 0, cd: 20 };
const itNight = () => S.chapter === 'night' && S.flags.nightUp && !S.flags.doorOpen && !S.flags.fakeWithdrawn && !(G.NIGHT && (G.NIGHT.slipping || G.NIGHT.swapped));
const itFree = () => !G.busy() && PARTNER.mode === 'follow' && !PARTNER.hidden && !PARTNER.lie && !PARTNER.task && !PARTNER.script && !PARTNER.bark && !PLAYER.lie;
const OVERFEED = { id: 'overfeed', spot: { x: 8.05, z: -0.75 }, yaw: Math.PI, dur: [5.5, 6], look: { x: 8.0, y: 0.35, z: -1.8 }, noReach: true,
  onArrive: (p) => { p.forcePose = 'warm'; const F = G.FIRE; F.fuel = Math.min(1, F.fuel + 0.5); G.Audio.catchFire && G.Audio.catchFire(); G.sparkBurst && G.sparkBurst(); G.bark('There. You like it warm. I remember that you like it warm.', 3); },
  onTick: (p, dt, T) => { if (!T.second && T.t > 3.2) { T.second = true; const F = G.FIRE; F.fuel = 1; G.Audio.catchFire && G.Audio.catchFire(); G.sparkBurst && G.sparkBurst(); G.bark('And another. So you’ll stay.', 2.6); } },
  onEnd: (p) => { p.forcePose = null; } };
function updateWrong(dt) {
  if (!itNight()) { WRONG.near = 0; WRONG.winT = 0; return; }
  WRONG.cd -= dt;
  const d = dist();
  WRONG.near = d < 6 && !PARTNER.hidden && !PARTNER.lie ? WRONG.near + dt : 0;
  if (WRONG.cd > 0 || !itFree()) return;
  // The fire: the coals are fine; it doesn't care.
  if (!WRONG.fire && G.FIRE.on && Math.hypot(PLAYER.x - 8.0, PLAYER.z - (-0.6)) < 2.6 && d < 6) {
    WRONG.fire = true; WRONG.cd = 25; PARTNER.task = { o: OVERFEED, phase: 'go', t: 0 }; return;
  }
  // The window: suddenly, right beside you. Much too close. The snow stops falling while it talks.
  const win = nearWindow();
  WRONG.winT = win && (PLAYER.idleT || 0) > 0 ? WRONG.winT + dt : 0;
  if (!WRONG.win && win && WRONG.winT > 4.5) {
    const v = win, dx = v.x - PLAYER.x, dz = v.z - PLAYER.z, l = Math.hypot(dx, dz) || 1, tx = -dz / l, tz = dx / l;
    let spot = null;
    for (const [lat, back] of [[0.38, 0.12], [-0.38, 0.12], [0.3, 0.35], [-0.3, 0.35], [0, 0.45]]) {
      const x = PLAYER.x + tx * lat - (dx / l) * back, z = PLAYER.z + tz * lat - (dz / l) * back;
      if (G.inside(x, z) && (!G.navOpen || G.navOpen(x, z))) { spot = [x, z]; break; }
    }
    if (!spot) return;
    WRONG.win = true; WRONG.cd = 30;
    A.run(async () => {
      STATE.busy = true;
      G.standAt(PARTNER, spot[0], spot[1], Math.atan2(v.x - spot[0], v.z - spot[1])); PARTNER.mode = 'still'; PARTNER.stillLook = { x: v.x, z: v.z, headY: 1.35 };
      G.Audio.creak && G.Audio.creak();
      const still = STATE.snowStill; STATE.snowStill = true;
      await N('(Someone is standing beside you. Very close. You didn’t hear it come.)');
      await P('There’s nothing out there.');
      await P('Nothing at all. Come away from the window.');
      STATE.snowStill = still;
      if (itNight() || S.chapter === 'night') PARTNER.mode = 'follow';
      STATE.busy = false;
    });
    return;
  }
  // "There you are." You never went anywhere.
  if (!WRONG.there && WRONG.near > 75 && d < 2.8) {
    WRONG.there = true; WRONG.cd = 25;
    G.bark('There you are.', 2.4);
    G.wait(2.9).then(() => { if (itNight() && !G.busy()) G.bark('…You were here all along. I know. I just like saying it.', 3.2); });
  }
}

/* ---------- the night: it gets the pet names almost right ----------
 * She calls him "my charming partner". He calls her "my lovely partner". The imitation has heard both, and
 * every so often uses the wrong one, or says "my dearest partner" in the wrong order. The first time each,
 * you notice (a hint after the line). */
const NS = { n: { toHim: 0, toHer: 0, dear: 0 }, told: new Set() };
G.nameSlip = (k) => {
  if (G.fmtWho !== 'partner' || S.chapter !== 'night' || (G.NIGHT && G.NIGHT.swapped)) return null;
  const C = G.CFG, n = ++NS.n[k];
  let out = null, kind = null;
  if (k === 'toHim' && n >= 2 && n % 3 === 2) { out = C.callPartner; kind = 'lovely'; }
  else if (k === 'dear' && n >= 2 && n % 4 === 2) { const w = String((C.callBoth || [])[1] || 'my dearest partner').split(' '); out = [w[w.length - 1]].concat(w.slice(0, -1)).join(' '); kind = 'order'; }
  if (kind && !NS.told.has(kind)) {
    NS.told.add(kind);
    const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    const line = kind === 'lovely' ? '(“' + cap(C.callPartner) + '.” That’s what you call her. She has never once called you that.)' : '(“' + cap(out) + '.” Not quite. The words are right. The order isn’t.)';
    G.wait(2.8).then(() => { if (S.chapter === 'night') G.hint(line, 6); });
    G.observe && G.observe('slip_' + kind, kind === 'lovely' ? 'I called it by the wrong name. Its name for her. It noticed.' : 'I put the words in the wrong order. It heard.');
  }
  return out;
};
const _nw = new THREE.Vector3();
function nearWindow() {
  if (!G.WINDOWS || !G.inside(PLAYER.x, PLAYER.z)) return null;
  const fx = Math.sin(PLAYER.yaw), fz = Math.cos(PLAYER.yaw);
  for (const w of G.WINDOWS) {
    if (w.study) continue;
    w.inn.getWorldPosition(_nw); if (_nw.y > 2.2) continue;
    const dx = _nw.x - PLAYER.x, dz = _nw.z - PLAYER.z, d = Math.hypot(dx, dz);
    if (d < 1.4 && d > 0.2 && (dx * fx + dz * fz) / d > 0.7) return { x: _nw.x, z: _nw.z };
  }
  return null;
}
(G.onJump = G.onJump || []).push(() => { NS.n = { toHim: 0, toHer: 0, dear: 0 }; NS.told.clear(); VIG.used.clear(); VIG.ch = null; Object.assign(WRONG, { fire: false, win: false, there: false, near: 0, winT: 0, cd: 20 }); MEM.used.clear(); MEM.cd = 40; HELP.t = 0; HELP.key = null; WIN.n = 0; WIN.cd = 10; RUN.n = 0; AWAY.t = 0; });

G.STEP_HOOKS.push((dt) => {
  if (!STATE.started) return;
  updateWrong(dt); updateAway(dt); updateHelp(dt); updateBump(dt); updateMemories(dt); updateWindow(dt); updateRun(dt); updateHand(dt); updateMeanwhile(dt);
});
});
