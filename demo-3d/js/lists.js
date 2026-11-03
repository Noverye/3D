'use strict';
/* =========================================================================
 * Something to aim for in free time, without it turning into chores.
 *  - Her list (the morning and the evening): a note in her handwriting in the corner. It isn't the same list
 *    twice: one or two lines the day needs anyway, then a few drawn from a larger pool (tender, silly and
 *    practical ones alike: a proper hug, a photo on purpose, a song on the radio, Basil), avoiding what was on
 *    last time's. The last line ends that stretch of the day, and she says so herself if you head for it early.
 *    Crossing off the rest earns a line from her (made from what was on it), a scrapbook page and a little
 *    closeness, which the night and the endings notice.
 *  - The night (his route): a torn page headed "Not right". Everything you notice about the one beside you goes
 *    on it. Looking at things while it's watching you makes it suspicious. What you noticed comes back at the
 *    end: you can tell it so, and it counts toward which morning you wake up to.
 * L, or a tap, opens and closes it. It keeps out of the way: closed, it's a small tab; it peeks open when
 * something changes and closes itself again.
 * ========================================================================= */
(G.afterBuild = G.afterBuild || []).push(() => {
const { PLAYER, PARTNER, STATE } = G;
const A = G.SAPI, S = A.S, { addBond, addScrap } = A;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private window */ } } };

/* ---------- what can be on the list ---------- */
// Things you do, rather than states the story keeps, are counted from when the list was written.
const EV = { key: '', set: new Set(), base: {} };
const did = (id) => EV.set.has(id);
const more = (k, now) => now > (EV.base[k] == null ? now : EV.base[k]);
const hugs = () => more('hugs', S.mem.hugs || 0), kisses = () => more('kisses', S.mem.kisses || 0);
const photos = () => more('photos', (S.photos || []).length);
const PC = () => G._PC || {};
// text: ways she might write it. ask: what she says if you head for the last line with this still to do.
// fin: how she'd mention it when the list is finished.
const POOL = {
  // the morning
  pancakes: { short: 'pancakes', text: ['Pancakes. ROUND ones.', 'Pancakes, please. I’ll know if they’re square.', 'Pancakes. (The good pan.)'], done: () => !!S.flags.pancakesMade },
  tea: { short: 'tea', text: ['Tea. Two sugars. (I don’t take sugar.)', 'Tea, however you make it. You make it wrong. I like it.', 'Kettle on. Mine’s the big mug.'], ask: ['No tea? Not even for me?', 'You forgot the kettle. I’m being very brave about it.'], fin: 'Even the tea.', done: () => !!S.flags.teaMade },
  basil: { short: 'Basil watered', text: ['Water Basil. He’s sulking.', 'Basil. A drink, and a kind word.', 'Say good morning to Basil. Water optional. (Not optional.)'], ask: ['Basil’s looking at me. He’s thirsty and he’s blaming me.', 'Before we eat: Basil. He sulks.'], fin: 'Even Basil.', done: () => did('basil') },
  logs: { short: 'logs in', text: ['Logs in the basket, for tonight.', 'Wood in. Tonight’s fire is depending on you.', 'Logs. From the porch. Brave the cold.'], ask: ['The log basket’s empty, {toHim}. Tonight will be very cold and very much your fault.'], fin: 'You did the logs without being asked twice.', done: () => did('logs') },
  radio: { short: 'a song on the radio', text: ['Something on the radio. Not the news.', 'A song. Any song. The radio’s on the shelf.'], ask: ['It’s too quiet. Put something on the radio first.'], fin: 'There was even music.', done: () => did('radio') },
  hug: { short: 'a proper hug', text: ['A good-morning hug. A proper one.', 'Hug me. Properly. Not the one-armed one.'], ask: ['You haven’t hugged me yet today. I’ve noticed. I’m noticing right now.'], fin: 'And a proper hug.', done: () => hugs() },
  photo: { short: 'a photograph on purpose', text: ['A photo of us. A good one. On purpose.', 'One photograph where I’m not blinking.'], ask: ['We still haven’t taken a photo. A good one. On purpose.'], fin: 'And a photograph to prove it.', done: () => photos() },
  sock: { short: 'the missing sock', text: ['Find my other sock. (Try the sofa.)', 'One sock has escaped. The sofa knows something.'], ask: ['My sock is still at large, {toHim}.'], fin: 'You found the sock. My hero.', done: () => did('cushion') },
  breakfast: { text: ['Then: breakfast. With me.', 'Then breakfast, together, at the table like grown-ups.'], last: true, done: () => !!S.flags.breakfastDone },
  // the evening
  cake: { short: 'the cake', text: ['The table by the fire. (Don’t ask.)', 'Have a look at the table by the fire. No reason.'], done: () => !!STATE.cakeDone },
  frame: { short: 'the frame in the hall', text: ['The frame in the hall.'], show: () => !!STATE.cakeDone, ask: ['Have you seen the frame in the hall? Go and look. I’ll wait.'], fin: '', done: () => !!S.flags.photoSeen },
  candles: { short: 'candles', text: ['Candles: the drawer by the stove.'], show: () => !!S.flags.powerCut, done: () => PC().done && !PC().out },
  lanterns: { short: 'the lanterns', text: ['Porch lanterns. All nine.', 'Lanterns on the porch, so the house looks lived in.'], ask: ['The lanterns aren’t lit. The porch looks lonely.'], fin: 'The lanterns are lit.', done: () => !!S.flags.lanternsLit },
  cocoa: { short: 'cocoa', text: ['Cocoa. A pinch of salt.', 'Cocoa. Stir it like you mean it.'], ask: ['No cocoa? On a night like this?'], fin: 'Cocoa, with lumps. My favourite.', done: () => did('cocoa') || !!S.flags.eveCocoa },
  sofa: { short: 'the sofa', text: ['Sofa. Blanket. You.', 'Ten minutes on the sofa. Minimum.'], ask: ['We haven’t sat down once. Sofa first. Stars after.'], fin: 'And the sofa.', done: () => !!STATE.cuddled },
  frost: { short: 'a drawing on the window', text: ['Draw me something on the kitchen window.', 'The kitchen window’s all frost. Write on it.'], ask: ['The kitchen window’s gone all frosty and nobody’s drawn on it. Criminal.'], fin: 'Something on the window.', done: () => !!S.flags.eveFrost },
  read: { short: 'half a chapter, with voices', text: ['Read to me. The window seat.', 'Half a chapter, out loud. Do the voices.'], ask: ['You promised to read to me. You didn’t, but you would have.'], fin: 'And you did the voices.', done: () => !!S.flags.eveRead },
  kiss: { short: 'a kiss by the fire', text: ['Kiss me. Somewhere warm.', 'One kiss by the fire. Two if it’s a good fire.'], ask: ['You haven’t kissed me all evening. I’ve been counting. It’s zero.'], fin: 'And you kissed me by the fire.', done: () => kisses() },
  dance: { short: 'a dance in the kitchen', text: ['Dance with me. Kitchen. Radio. Badly.', 'One song in the kitchen. Feet optional.'], ask: ['We haven’t danced. The radio’s right there, {toHim}.'], fin: 'We even danced. Sort of.', done: () => did('radio') },
  ephoto: { short: 'a photograph by the fire', text: ['A photo of us by the fire.', 'A photograph tonight. I’ll do my good side. Both of them.'], ask: ['No photo tonight? I did my hair. Briefly.'], fin: 'And a photograph by the fire.', done: () => photos() },
  stars: { text: ['Then: stars, from the bench.', 'Then the porch. Stars. Coats.'], last: true, done: () => !!STATE.porchDone },
};
const LISTS = {
  morning: { title: ['Snow day', 'Today', 'Snowed in'], fixed: ['pancakes'], extra: ['tea', 'basil', 'logs', 'radio', 'hug', 'photo', 'sock'], n: 3, last: 'breakfast', at: () => ({ x: 13.0, z: 2.95 }), over: () => !!S.flags.breakfastDone, flag: 'listAm', art: 'list' },
  evening: { title: ['Tonight', 'This evening', 'Before bed'], fixed: ['cake', 'frame', 'candles'], extra: ['lanterns', 'cocoa', 'sofa', 'frost', 'read', 'kiss', 'dance', 'ephoto'], n: 3, last: 'stars', at: () => G.BENCH && { x: G.BENCH.x, z: G.BENCH.z }, over: () => !!STATE.porchDone, flag: 'listPm', art: 'listpm' },
};
// Write the list for this stretch: kept in the save, and steering away from last time's lines.
function written(ch) {
  const L = LISTS[ch], have = S.flags.listPick;
  if (have && have.ch === ch && have.run === S.run) return have;
  if (have && have.ch === ch && !EV.fresh) { have.run = S.run; return have; }   // a reload: the same list
  const last = store.get('snowed.lists.last.' + ch, []);
  const fresh = L.extra.filter((id) => !last.includes(id)), old = L.extra.filter((id) => last.includes(id));
  const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const extras = shuffle(fresh).concat(shuffle(old)).slice(0, L.n);
  const ids = L.fixed.concat(extras, [L.last]);
  const pick1 = (id) => Math.floor(Math.random() * POOL[id].text.length);
  const w = { ch, run: S.run, title: Math.floor(Math.random() * L.title.length), items: ids.map((id) => [id, pick1(id)]) };
  S.flags.listPick = w; store.set('snowed.lists.last.' + ch, extras);
  return w;
}
const itemsOf = (w) => w.items.map(([id, v]) => ({ id, ...POOL[id], line: POOL[id].text[v] || POOL[id].text[0] })).filter((i) => !i.show || i.show());

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
  said_scarf: 'It agreed with me about the scarf. Word for word. She never agrees about the scarf.',
  said_trees: 'It knew what I said about the trees. Exactly what I said.',
};
const THINGS = new Set(['mugs', 'photo', 'sill', 'frost', 'photo2']);   // things you look at (it can see you looking)
const WATCHED = ['What are you looking at, {toHim}?', 'Is something wrong?', 'Come away from there.', 'Leave that. Come here.', 'You keep looking at things, {dear}.', 'It’s late. Nothing in here needs looking at.'];

/* ---------- the note ---------- */
const box = document.createElement('div');
box.id = 'list'; box.hidden = true; box.setAttribute('aria-live', 'polite');
box.innerHTML = '<button type="button" id="listTab" aria-expanded="false"></button><div id="listBody"></div>';
document.body.appendChild(box);
const UI = { open: false, pin: false, until: 0, shown: false, sig: '', mode: '', watched: {}, seenN: 0, nudged: false, watchCd: 0 };
const setOpen = (o) => { UI.open = o; box.classList.toggle('open', o); $('listTab').setAttribute('aria-expanded', String(o)); };
const toggle = () => { UI.pin = !UI.open; UI.until = 0; setOpen(!UI.open); };
$('listTab').addEventListener('click', toggle);
$('listBody').addEventListener('click', toggle);
addEventListener('keydown', (e) => { if (e.code === 'KeyL' && !e.repeat && !box.hidden && !(document.activeElement && document.activeElement.matches('input, textarea'))) toggle(); });
const peek = (s) => { if (UI.pin) return; UI.until = G.simT + s; if (!UI.open) setOpen(true); };

function night() { return S.chapter === 'night' && G.NIGHT && G.NIGHT.seen && S.flags.nightUp && !S.flags.doorOpen && !(G.herRoute && G.herRoute()); }
function current() {
  if (G.herRoute && G.herRoute()) return null;
  if (night()) return 'night';
  const L = LISTS[S.chapter];
  if (!L || L.over()) return null;
  if (S.chapter === 'evening' && STATE.watchDoor) return null;   // still arriving home
  return S.chapter;
}
const dots = (items) => items.filter((i) => !i.last).map((i) => (i.done() ? '●' : '○')).join('');
function render(mode) {
  if (mode === 'night') {
    const seen = [...G.NIGHT.seen].filter((k) => NOTES[k]);
    $('listTab').innerHTML = `<span class="lt">Not right</span><span class="ln">${'—'.repeat(Math.min(seen.length, 8)) || '…'}</span>`;
    $('listBody').innerHTML = `<div class="lh">Not right</div>` + (seen.length
      ? '<ul>' + seen.map((k) => `<li class="${UI.watched[k] ? 'seen' : ''}">${esc(G.fmt(NOTES[k]))}</li>`).join('') + '</ul>'
      : '<p class="le">Nothing yet. But something is.<br>Listen to what it says. Look at the house. Don’t let it see you looking.</p>');
    return seen.length + '|' + Object.keys(UI.watched).length;
  }
  const L = LISTS[mode], w = written(mode), items = itemsOf(w), title = L.title[w.title] || L.title[0];
  $('listTab').innerHTML = `<span class="lt">${esc(title)}</span><span class="ln">${dots(items)}</span>`;
  $('listBody').innerHTML = `<div class="lh">${esc(title)}</div><ul>` + items.map((i) => `<li class="${i.done() ? 'done' : ''}${i.last ? ' last' : ''}">${esc(G.fmt(i.line))}</li>`).join('') + '</ul>';
  return items.map((i) => (i.done() ? 1 : 0)).join('');
}

/* ---------- keeping track ---------- */
let lastUse = null;
function track() {
  const key = S.run + ':' + S.chapter;
  if (EV.key !== key) {
    EV.key = key; EV.set = new Set(); EV.fresh = !(S.flags.listPick && S.flags.listPick.ch === S.chapter);
    EV.base = { hugs: S.mem.hugs || 0, kisses: S.mem.kisses || 0, photos: (S.photos || []).length };
    Object.assign(UI, { watched: {}, shown: false, sig: '', seenN: 0, nudged: false, pin: false }); setOpen(false);
  }
  // what you just used (the story notes the last thing on every interaction)
  const u = S.lastUse;
  if (u && u !== lastUse) {
    lastUse = u;
    if (u.id === 'basil' || u.id === 'cushion' || u.id === 'radio') EV.set.add(u.id === 'radio' ? (G.Audio.radioOn && G.Audio.radioOn() ? 'radio' : '') : u.id);
    if (u.id === 'kettle' && S.chapter === 'evening') EV.set.add('cocoa');
  }
}
// The log basket only counts when you fill it.
{ const it = A.findInter('basket'); if (it) { const orig = it.act; it.act = () => { if (!STATE.busy && PLAYER.carry) EV.set.add('logs'); return orig(); }; } }

// Heading for the last line with things still to do: she says so, once, in her own words.
function nudge(mode) {
  if (UI.nudged || G.busy() || PARTNER.hidden || PARTNER.lie || PARTNER.bark || !A.canHear()) return;
  const L = LISTS[mode], at = L.at(); if (!at) return;
  if (Math.hypot(PLAYER.x - at.x, PLAYER.z - at.z) > 2.6) return;
  const left = itemsOf(written(mode)).filter((i) => !i.last && !i.done() && i.ask);
  UI.nudged = true;
  if (!left.length) return;
  G.bark(pick(pick(left).ask) + (left.length > 1 ? pick([' And the rest of the list, while you’re at it.', '', ' …I’m only saying.']) : ''), 3.6);
}

// Looking at things in the night while it's watching you.
function watching() {
  if (PARTNER.hidden || PARTNER.lie || G.gentle() || (G.NIGHT && G.NIGHT.swapped)) return false;
  const dx = PLAYER.x - PARTNER.x, dz = PLAYER.z - PARTNER.z, d = Math.hypot(dx, dz);
  if (d > 4.5 || !A.sameRoom()) return false;
  return (dx * Math.sin(PARTNER.yaw) + dz * Math.cos(PARTNER.yaw)) / (d || 1) > 0.5;
}
function nightTick() {
  const seen = [...G.NIGHT.seen];
  if (seen.length > UI.seenN) {
    for (const k of seen.slice(UI.seenN)) {
      if (THINGS.has(k) && watching()) {
        UI.watched[k] = true;
        S.vars.suspicion = (S.vars.suspicion || 0) + 0.75;
        G.observe('suspect_notice', 'It noticed something. I will put it back.');
        // It doesn't always say so. Sometimes it just watches.
        if (G.simT > UI.watchCd && Math.random() < 0.7) { UI.watchCd = G.simT + 25; G.wait(0.9).then(() => { if (!G.busy() && !PARTNER.hidden) G.bark(pick(WATCHED), 2.4); }); }
      }
    }
    UI.seenN = seen.length;
    S.vars.clues = seen.filter((k) => NOTES[k]);   // kept for the end of the night (the save, and Act IV)
    G.Audio.page && G.Audio.page();
    peek(3.5);
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
  box.hidden = false;
  if (!UI.shown && !scene) {
    UI.shown = true; peek(mode === 'night' ? 5 : 6);
    // Say how it works once, ever; after that it's just there.
    const k = 'snowed.lists.hinted.' + (mode === 'night' ? 'night' : 'day');
    if (!store.get(k, false)) { store.set(k, true); G.hint(mode === 'night' ? '(You’re keeping track of what isn’t right. L, or tap the page, to read it back.)' : G.MOBILE ? 'Her list for today. Tap it to open or close it.' : 'Her list for today. L opens and closes it.', 5.5); }
  }
  if (UI.sig && sig !== UI.sig && mode !== 'night' && sig.length >= UI.sig.length) { G.Audio.page && G.Audio.page(); peek(3); }
  UI.sig = sig; UI.mode = mode;
  if (UI.open && !UI.pin && UI.until && G.simT > UI.until) { UI.until = 0; setOpen(false); }
  if (mode !== 'night') { nudge(mode); reward(mode); }
});

const OPEN = ['You did the whole list.', 'Everything on the list. Every single thing.', 'The list is finished. I have never once finished a list.', 'Look at that. All crossed off.'];
const CLOSE = ['I’m drawing you a gold star.', 'I might cry. Later.', 'Write me one tomorrow. I’ll do it all wrong.', 'Put it on the fridge.', 'Marry me again.'];
function reward(mode) {
  const L = LISTS[mode];
  if (S.flags[L.flag]) return;
  const items = itemsOf(written(mode)).filter((i) => !i.last);
  if (!items.every((i) => i.done())) return;
  if (G.busy() || PARTNER.hidden || PARTNER.lie || PARTNER.bark || !A.canHear()) return;   // when she can say so
  S.flags[L.flag] = 1;
  addBond(0.6); S.mem.affection = (S.mem.affection || 0) + 1;
  const fins = items.map((i) => i.fin).filter(Boolean);
  G.bark([pick(OPEN), fins.length ? pick(fins) : '', pick(CLOSE)].filter(Boolean).join(' '), 4);
  const done = items.map((i) => i.short).filter(Boolean), list = done.slice(0, -1).join(', ') + (done.length > 1 ? ' and ' : '') + done.slice(-1);
  addScrap(L.art, mode === 'morning' ? `Her snow-day list, every line crossed off: ${list}. Two different pens.` : `Tonight’s list, all crossed off: ${list}. A heart in the margin.`);
}

// For the end of the night (act4.js) and the tests.
G.LISTS = { LISTS, POOL, NOTES, written, clues: () => (S.vars.clues || []).filter((k) => NOTES[k]) };
});
