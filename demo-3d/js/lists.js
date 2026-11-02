'use strict';
/* =========================================================================
 * Something to aim for in free time.
 *  - Her list (the morning and the evening): a note in her handwriting in the corner, with the small things the
 *    day is made of. The last line ends the stretch, so the rest is yours to do or skip. Crossing everything
 *    else off first earns a line from her, a scrapbook page and a little closeness, which the night and the
 *    endings notice.
 *  - The night (his route): the same corner, a torn page headed "Not right". Everything you notice about the
 *    one beside you goes on it: what it says, what's out of place. Looking at things while it's watching you
 *    makes it suspicious. What you noticed comes back at the end: you can tell it so, and it counts toward
 *    which morning you wake up to.
 * L, or a tap, opens and closes it.
 * ========================================================================= */
(G.afterBuild = G.afterBuild || []).push(() => {
const { PLAYER, PARTNER, STATE } = G;
const A = G.SAPI, S = A.S, { addBond, addScrap } = A;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* ---------- what's on the list ---------- */
// Things you do, rather than states the story keeps, are counted here (per chapter, per playthrough).
const EV = { key: '', set: new Set() };
const did = (id) => EV.set.has(id);
const PC = () => G._PC || {};
const LISTS = {
  morning: {
    title: 'Snow day',
    items: [
      { id: 'tea', text: 'Tea. Two sugars. (I don’t take sugar.)', done: () => !!S.flags.teaMade },
      { id: 'pancakes', text: 'Pancakes. ROUND ones.', done: () => !!S.flags.pancakesMade },
      { id: 'basil', text: 'Water Basil. He’s sulking.', done: () => did('basil') },
      { id: 'logs', text: 'Logs in the basket, for tonight.', done: () => did('logs') },
      { id: 'breakfast', text: 'Breakfast. With me.', last: true, done: () => !!S.flags.breakfastDone },
    ],
    over: () => !!S.flags.breakfastDone,
    reward: { flag: 'listAm', art: 'list', line: 'You did the whole list. Even Basil. I’m drawing you a gold star.', scrap: 'The snow-day list. Every line crossed off, in two different pens.' },
  },
  evening: {
    title: 'Tonight',
    items: [
      { id: 'cake', text: 'The table by the fire. (Don’t ask.)', done: () => !!STATE.cakeDone },
      { id: 'frame', text: 'The frame in the hall.', show: () => !!STATE.cakeDone, done: () => !!S.flags.photoSeen },
      { id: 'candles', text: 'Candles: the drawer by the stove.', show: () => !!S.flags.powerCut, done: () => PC().done && !PC().out },
      { id: 'lanterns', text: 'Porch lanterns. All nine.', done: () => !!S.flags.lanternsLit },
      { id: 'cocoa', text: 'Cocoa. A pinch of salt.', done: () => did('cocoa') },
      { id: 'sofa', text: 'Sofa. Blanket. You.', done: () => !!STATE.cuddled },
      { id: 'stars', text: 'Stars, from the bench.', last: true, done: () => !!STATE.porchDone },
    ],
    over: () => !!STATE.porchDone,
    reward: { flag: 'listPm', art: 'listpm', line: 'Every single thing on the list. I might cry. Later. After the stars.', scrap: 'Tonight’s list. All crossed off, and a heart drawn next to “Sofa. Blanket. You.”' },
  },
};
// What a line of the night's page says, by what you noticed.
const NOTES = {
  blanket: 'It gave the blanket back. She never gives it back.',
  certain: 'It’s sure. About everything.',
  flinch: 'It didn’t flinch.',
  verbatim: 'It knew her line. Word for word.',
  gaveup: 'It let me have her line. Just like that.',
  toaster: 'It trusts the toaster.',
  score: 'It remembers the score. She never does.',
  icing: 'It gave me the icing.',
  nocheck: 'It didn’t check the halves.',
  mugs: 'Three mugs on the rack. There are two of us.',
  photo: 'Someone else in the photograph in the hall.',
  sill: 'Snow on the inside of the window.',
  frost: 'Our drawing on the window: wiped clean.',
  photo2: 'Someone at the edge of my photograph.',
};
const THINGS = new Set(['mugs', 'photo', 'sill', 'frost', 'photo2']);   // things you look at (it can see you looking)

/* ---------- the note ---------- */
const box = document.createElement('div');
box.id = 'list'; box.hidden = true; box.setAttribute('aria-live', 'polite');
box.innerHTML = '<button type="button" id="listTab" aria-expanded="false"></button><div id="listBody"></div>';
document.body.appendChild(box);
const UI = { open: false, pin: false, until: 0, shown: false, sig: '', mode: '' };
const setOpen = (o) => { UI.open = o; box.classList.toggle('open', o); $('listTab').setAttribute('aria-expanded', String(o)); };
$('listTab').addEventListener('click', () => { UI.pin = !UI.open; setOpen(!UI.open); });
addEventListener('keydown', (e) => { if (e.code === 'KeyL' && !e.repeat && !box.hidden && !document.activeElement.matches('input, textarea')) { UI.pin = !UI.open; setOpen(!UI.open); } });
const peek = (s) => { UI.until = G.simT + s; if (!UI.open) setOpen(true); };

function night() { return S.chapter === 'night' && G.NIGHT && G.NIGHT.seen && S.flags.nightUp && !(G.herRoute && G.herRoute()); }
function current() {
  if (G.herRoute && G.herRoute()) return null;
  if (night()) return 'night';
  const L = LISTS[S.chapter];
  if (!L || L.over()) return null;
  if (S.chapter === 'evening' && STATE.watchDoor) return null;   // still arriving home
  return S.chapter;
}
function render(mode) {
  if (mode === 'night') {
    const seen = [...G.NIGHT.seen].filter((k) => NOTES[k]);
    $('listTab').innerHTML = `<span class="lt">Not right</span><span class="ln">${seen.length}</span>`;
    $('listBody').innerHTML = `<div class="lh">Not right</div>` + (seen.length
      ? '<ul>' + seen.map((k) => `<li class="${(UI.watched || {})[k] ? 'seen' : ''}">${esc(G.fmt(NOTES[k]))}</li>`).join('') + '</ul>'
      : '<p class="le">Nothing. Yet.<br>Look at the house. Listen to what it says. Don’t let it see you looking.</p>');
    return seen.length + '|' + Object.keys(UI.watched || {}).length;
  }
  const L = LISTS[mode], items = L.items.filter((i) => !i.show || i.show());
  const n = items.filter((i) => i.done()).length;
  $('listTab').innerHTML = `<span class="lt">${esc(L.title)}</span><span class="ln">${n}/${items.length}</span>`;
  $('listBody').innerHTML = `<div class="lh">${esc(L.title)}</div><ul>` + items.map((i) => `<li class="${i.done() ? 'done' : ''}${i.last ? ' last' : ''}">${esc(G.fmt(i.text))}</li>`).join('') + '</ul>'
    + (items.some((i) => i.last && !i.done()) ? '<p class="le">(The last one ends the day. Everything else first?)</p>' : '');
  return items.map((i) => (i.done() ? 1 : 0)).join('');
}

/* ---------- keeping track ---------- */
let lastUse = null;
function track() {
  const key = S.run + ':' + S.chapter;
  if (EV.key !== key) { EV.key = key; EV.set = new Set(); UI.watched = {}; UI.shown = false; UI.sig = ''; UI.seenN = 0; }
  // what you just used (the story notes the last thing on every interaction)
  const u = S.lastUse;
  if (u && u !== lastUse) {
    lastUse = u;
    if (u.id === 'basil') EV.set.add('basil');
    if (u.id === 'kettle' && S.chapter === 'evening') EV.set.add('cocoa');
  }
}
// The log basket only counts when you fill it.
{ const it = A.findInter('basket'); if (it) { const orig = it.act; it.act = () => { if (!STATE.busy && PLAYER.carry) EV.set.add('logs'); return orig(); }; } }

// Looking at things in the night while it's watching you.
function watching() {
  if (PARTNER.hidden || PARTNER.lie || G.gentle() || (G.NIGHT && G.NIGHT.swapped)) return false;
  const dx = PLAYER.x - PARTNER.x, dz = PLAYER.z - PARTNER.z, d = Math.hypot(dx, dz);
  if (d > 4.5 || !A.sameRoom()) return false;
  return (dx * Math.sin(PARTNER.yaw) + dz * Math.cos(PARTNER.yaw)) / (d || 1) > 0.5;
}
function nightTick() {
  const N = G.NIGHT, seen = [...N.seen];
  if (seen.length > (UI.seenN || 0)) {
    for (const k of seen.slice(UI.seenN || 0)) {
      if (THINGS.has(k) && watching()) {
        UI.watched[k] = true;
        S.vars.suspicion = (S.vars.suspicion || 0) + 0.75;
        G.observe('suspect_notice', 'It noticed something. I will put it back.');
        G.wait(0.9).then(() => { if (!G.busy() && !PARTNER.hidden) G.bark('What are you looking at, {toHim}?', 2.4); });
      }
    }
    UI.seenN = seen.length;
    // Kept for the end of the night (the save, and Act IV).
    S.vars.clues = seen.filter((k) => NOTES[k]);
    G.Audio.page && G.Audio.page();
    peek(4.5);
  }
}

/* ---------- each frame (cheaply) ---------- */
let acc = 0;
G.TICKERS.add((dt) => {
  acc += dt; if (acc < 0.2) return; acc = 0;
  if (!G.S || !S.chapter) return;
  track();
  const mode = current();
  const playing = document.body.classList.contains('playing') && !document.body.classList.contains('ending');
  const scene = STATE.sceneShot || (G.DLG && G.DLG.cur) || (G.UI && G.UI.modal);
  if (!mode || !playing) { box.hidden = true; UI.mode = ''; return; }
  if (mode === 'night') nightTick();
  box.classList.toggle('night', mode === 'night');
  box.classList.toggle('dim', !!scene);
  const sig = mode + render(mode);
  if (!UI.shown) { UI.shown = true; box.hidden = false; peek(mode === 'night' ? 6 : 7); if (mode === 'night' && !STATE.busy) G.hint('(Press L for what you’ve noticed. Or tap the page.)', 5); else if (mode !== 'night') G.hint(G.MOBILE ? 'Her list: tap it to open or close it.' : 'Her list for today: press L to open or close it.', 5); }
  box.hidden = false;
  if (UI.sig && sig !== UI.sig && mode !== 'night') { G.Audio.page && G.Audio.page(); peek(4); }
  UI.sig = sig; UI.mode = mode;
  if (UI.open && !UI.pin && UI.until && G.simT > UI.until) { UI.until = 0; setOpen(false); }
  if (mode !== 'night') reward(mode);
});

function reward(mode) {
  const L = LISTS[mode], R = L.reward;
  if (S.flags[R.flag]) return;
  const items = L.items.filter((i) => !i.last && (!i.show || i.show()));
  if (!items.every((i) => i.done())) return;
  if (G.busy() || PARTNER.hidden || PARTNER.lie) return;   // when she can say so
  S.flags[R.flag] = 1;
  addBond(0.6); S.mem.affection = (S.mem.affection || 0) + 1;
  addScrap(R.art, R.scrap);
  G.bark(R.line, 3.6);
}

// For the end of the night (act4.js) and the tests.
G.LISTS = { LISTS, NOTES, clues: () => (S.vars.clues || []).filter((k) => NOTES[k]) };
});
