'use strict';
/* =========================================================================
 * She notices your habits, across playthroughs (kept in this browser, his route).
 *  - What you reach for first in the morning: tea, the stove, Basil, the logs, the radio, the sofa cushions.
 *    If it's the same thing as last time, she says so, fondly.
 *  - How the last playthrough ended colours one line on the next morning: a dream she half remembers.
 *  - Never more than one of each per playthrough, never on the first, and only when she can say it.
 * ========================================================================= */
(G.afterBuild = G.afterBuild || []).push(() => {
const { PLAYER, PARTNER, STATE } = G;
const A = G.SAPI, S = A.S;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const KEY = 'snowed.habits';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } };
const write = (h) => { try { localStorage.setItem(KEY, JSON.stringify(h)); } catch (e) { /* private window */ } };

const FIRST = {
  kettle: ['Tea first. Always tea first. I love that about you.', 'Straight to the kettle. You’re a creature of habit, {toHim}.'],
  stove: ['Straight to the pancakes. Every single time.', 'Pancakes before anything. A man of principle.'],
  basil: ['Basil first. He’s your favourite. Don’t deny it.', 'You always say good morning to Basil before me. I’ve noticed.'],
  basket: ['Logs before breakfast. You’re very predictable, {toHim}. I like predictable.'],
  woodpile: ['Logs before breakfast. You’re very predictable, {toHim}. I like predictable.'],
  radio: ['The radio first. Same song, I bet.', 'You always put the radio on first. It’s nice. It’s like the house waking up.'],
  cushion: ['Rummaging in the sofa again. What are you hoping to find? Don’t answer.'],
};
const DREAM = {
  stay: ['I dreamt you didn’t come home. Silly. You’re right here.', 'I had a dream where you stayed somewhere. Somewhere nicer than here. You didn’t, did you?'],
  perfect: ['I dreamt you didn’t come home. Silly. You’re right here.', 'I dreamt about a breakfast where everything was perfect. It was horrible.'],
  replaced: ['I dreamt I was outside, looking in. Isn’t that odd? You were laughing.', 'I had the strangest dream. You didn’t know me.'],
  foundme: ['I dreamt about the fair again. You whistled. Badly.', 'Did you dream? I dreamt you came and found me.'],
  uncertain: ['Did you sleep? You look like you’ve been somewhere.', 'I keep feeling we’ve done today before.'],
  iknow: ['I dreamt you asked me if I was me. I said yes. I was right, wasn’t I?'],
  firstsnow: ['Déjà vu. Do you get déjà vu? I’ve got it terribly today.'],
};
const H = { run: null, first: null, saidFirst: false, saidDream: false, t: 0, lastUse: null };

let acc = 0;
G.TICKERS.add((dt) => {
  acc += dt; if (acc < 0.25) return; const step = acc; acc = 0;
  if (!G.S || !S.chapter || (G.herRoute && G.herRoute())) return;
  // How this playthrough ended, for next time.
  if (/^ending_|^firstsnow$/.test(S.chapter)) { const h = read(); const e = S.chapter.replace('ending_', ''); if (h.lastEnding !== e || h.endRun !== S.run) { h.lastEnding = e; h.endRun = S.run; write(h); } return; }
  if (S.chapter !== 'morning') return;
  // A new morning: a new playthrough.
  if (H.run !== S.run) {
    H.run = S.run; H.first = null; H.saidFirst = false; H.saidDream = false; H.t = 0; H.lastUse = S.lastUse;
    const h = read(); H.before = { runs: h.runs || 0, first: h.first, lastEnding: h.lastEnding };
    h.runs = (h.runs || 0) + 1; write(h);
  }
  const prev = H.before; if (!prev) return;
  // The first thing you reach for.
  const u = S.lastUse;
  if (u && u !== H.lastUse) {
    H.lastUse = u;
    if (!H.first && FIRST[u.id]) {
      H.first = u.id; const h = read(); h.first = u.id; write(h);
      if (prev.runs >= 1 && (prev.first === u.id || (prev.first === 'basket' && u.id === 'woodpile') || (prev.first === 'woodpile' && u.id === 'basket'))) H.wantFirst = u.id;
    }
  }
  const canTalk = !G.busy() && !PARTNER.hidden && !PARTNER.lie && !PARTNER.bark && !PARTNER.task && A.canHear() && !STATE.sceneShot;
  if (H.wantFirst && !H.saidFirst && canTalk) { H.saidFirst = true; G.bark(pick(FIRST[H.wantFirst]), 3.4); H.wantFirst = null; return; }
  // Once she's up and you're together for a bit: last time's ending, as a dream.
  if (!PARTNER.lie && canTalk) H.t += step;
  if (!H.saidDream && prev.runs >= 1 && prev.lastEnding && DREAM[prev.lastEnding] && H.t > 15) { H.saidDream = true; G.bark(pick(DREAM[prev.lastEnding]), 4); }
});
G.HABITS = { read, H };
});
