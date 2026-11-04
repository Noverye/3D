'use strict';
/* =========================================================================
 * Story UI: choices, title cards, the timing minigame, the Together menu and
 * the scrapbook. Each returns a promise. Keys are read in the capture phase
 * so a key that answers the UI never also walks, interacts or advances.
 * ========================================================================= */
(() => {
const { $ } = G;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let modal = null;   // { kind, key(e) -> handled }

const UI = (G.UI = {
  blocking: () => !!modal,
  get modal() { return modal ? modal.kind : null; },
});

addEventListener('keydown', (e) => {
  if (!modal || e.repeat) return;
  if (G.STATE.paused && modal.kind !== 'scrapbook') return;   // the pause menu has the keys
  if (modal.key(e) !== false) { e.preventDefault(); e.stopPropagation(); }
}, true);

/* A vertical list of options. opts: strings or { t, v }. Resolves to the index (or v). */
UI.choose = (opts) => new Promise((res) => {
  const box = $('choices');
  const doing = G.S && G.S.inInter && window.CBS_CHOICE_HER_DO;
  const herC = G.herSide && G.herSide() && (doing ? Object.assign({}, window.CBS_CHOICE_HER, doing) : window.CBS_CHOICE_HER), lead = herC && !doing && window.CBS_CHOICE_HER_LEAD;
  // Playing as her: where the option was a line of his, she says her own lead-in, then he says his line.
  const list = opts.map((o) => (typeof o !== 'string' ? o : lead && lead[o] ? { t: lead[o], his: o } : { t: (herC && herC[o]) || o }));
  box.innerHTML = list.map((o, i) => `<button type="button" style="animation-delay:${i * 0.06}s"><span class="n">${i + 1}</span><span>${esc(G.fmt(o.t))}</span></button>`).join('');
  box.hidden = false;
  const btns = [...box.querySelectorAll('button')];
  let sel = 0, opened = performance.now();
  const mark = () => btns.forEach((b, i) => b.classList.toggle('sel', i === sel));
  const pick = (i) => {
    if (performance.now() - opened < 250) return;   // a held key from the last line shouldn't choose
    modal = null; box.hidden = true; box.innerHTML = '';
    G.Audio.chime && G.Audio.click();
    const out = list[i].v != null ? list[i].v : i;
    if (list[i].his) { const said = /^“/.test(list[i].t) ? G.say('partner', list[i].t.replace(/^“|”$/g, '')) : Promise.resolve(); said.then(() => G.say('player', list[i].his.replace(/^“|”$/g, ''))).then(() => res(out)); }
    else res(out);
  };
  btns.forEach((b, i) => { b.addEventListener('click', () => pick(i)); b.addEventListener('pointerenter', () => { sel = i; mark(); }); });
  mark();
  modal = { kind: 'choices', key(e) {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= btns.length) { pick(n - 1); return; }
    if (['ArrowDown', 'KeyS'].includes(e.code)) { sel = (sel + 1) % btns.length; mark(); return; }
    if (['ArrowUp', 'KeyW'].includes(e.code)) { sel = (sel + btns.length - 1) % btns.length; mark(); return; }
    if (['Enter', 'Space', 'KeyE'].includes(e.code)) { pick(sel); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') return;   // swallow: a choice can't be skipped
    return false;
  } };
});

/* Centered lines over the (black or white) fade. o: { cls, hold, white } */
UI.card = (lines, o = {}) => new Promise((res) => {
  const box = $('card');
  box.className = o.white ? 'on-white' : '';
  box.innerHTML = `<div>${lines.map((l, i) => `<p class="${o.cls ? o.cls[i] || '' : ''}" style="animation-delay:${0.2 + i * (o.stagger || 0.6)}s">${esc(G.fmt(l))}</p>`).join('')}</div>`;
  requestAnimationFrame(() => box.classList.add('show'));
  G.wait(o.hold || 3).then(() => { box.classList.remove('show'); G.wait(1.2).then(() => { box.innerHTML = ''; res(); }); });
});
// Drop whatever is on screen (a choice, a card, the scrapbook): used when jumping to another chapter.
UI.reset = () => { modal = null; for (const id of ['choices', 'card']) { const b = $(id); if (b) { b.hidden = id === 'choices'; b.innerHTML = ''; b.classList.remove('show'); } } const sb = $('scrap'); if (sb) sb.hidden = true; };
UI.act = (num, title, o = {}) => UI.card(['Act ' + num, title], { cls: ['act-n', 'act-t'], stagger: 0.45, hold: o.hold || 3.4, white: o.white });

/* Timing minigame: stop the marker in the warm zone. Resolves to an array of scores in 0..1. */
/* Easier little games (a setting): warm zones half as wide again, and everything a third slower. */
const ease = (zone, speed) => {
  if (!G.easyHands || !G.easyHands()) return [zone, speed];
  const c = (zone[0] + zone[1]) / 2, hw = Math.min(0.2, (zone[1] - zone[0]) * 0.8);
  return [[Math.max(0.05, c - hw), Math.min(0.97, c + hw)], speed * 0.68];
};
UI.timing = (o) => new Promise((res) => {
  const box = $('minigame'), [zone, spd] = ease(o.zone || [0.6, 0.76], o.speed || 1), rounds = o.rounds || 3;
  box.innerHTML = `<div class="mg-title">${esc(G.fmt(o.title))}</div><div class="mg-bar"><div class="mg-zone" style="left:${zone[0] * 100}%;width:${(zone[1] - zone[0]) * 100}%"></div><div class="mg-needle"></div></div>
    <div class="mg-sub">${G.MOBILE ? 'Tap when the marker is in the warm zone' : 'Press E or Space when the marker is in the warm zone'}</div><div class="mg-res"></div><div class="mg-dots">${'<i></i>'.repeat(rounds)}</div>`;
  box.hidden = false;
  const needle = box.querySelector('.mg-needle'), resEl = box.querySelector('.mg-res'), dots = box.querySelectorAll('.mg-dots i');
  const scores = []; let t = Math.random() * 0.3, dir = 1, cool = 0.5;
  const speed = spd * 0.9;
  const press = () => {
    if (cool > 0 || scores.length >= rounds) return;
    const c = (zone[0] + zone[1]) / 2, hw = (zone[1] - zone[0]) / 2, d = Math.abs(t - c);
    const sc = d <= hw ? 1 - 0.3 * (d / hw) : Math.max(0, 0.62 - (d - hw) * 3.2);
    scores.push(sc);
    dots[scores.length - 1].classList.add('done');
    const L = o.labels || ['Miss.', 'Okay.', 'Perfect.'];
    resEl.textContent = G.fmt(sc > 0.75 ? L[2] : sc > 0.35 ? L[1] : L[0]);
    if (o.onPress) o.onPress(sc, scores.length - 1);
    cool = 0.75;
    if (scores.length >= rounds) G.wait(1.1).then(() => { G.TICKERS.delete(tick); modal = null; box.hidden = true; res(scores); });
  };
  // Runs on the game clock, so it pauses with the game.
  const tick = (dt) => {
    cool -= dt;
    if (scores.length >= rounds) return;
    t += dir * dt * speed * (1 + scores.length * 0.18);   // each round runs a touch faster
    if (t > 1) { t = 1; dir = -1; } else if (t < 0) { t = 0; dir = 1; }
    needle.style.left = (t * 100) + '%';
  };
  G.TICKERS.add(tick);
  box.onpointerdown = (e) => { e.preventDefault(); press(); };
  modal = { kind: 'minigame', key(e) {
    if (['Enter', 'Space', 'KeyE'].includes(e.code)) { press(); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') return;
    return false;
  } };
});

/* Hold and let go: pouring, warming, winding up a throw. Hold E / Space / a finger down and the bar fills (a
 * little faster as it goes); let go in the warm zone. Holding too long spills over. Resolves to scores, like timing. */
UI.hold = (o) => new Promise((res) => {
  const box = $('minigame'), [zone, spd] = ease(o.zone || [0.62, 0.78], o.speed || 1), rounds = o.rounds || 1;
  box.innerHTML = `<div class="mg-title">${esc(G.fmt(o.title))}</div><div class="mg-bar fill"><div class="mg-zone" style="left:${zone[0] * 100}%;width:${(zone[1] - zone[0]) * 100}%"></div><div class="mg-fill"></div></div>
    <div class="mg-sub">${esc(G.fmt(o.sub || (G.MOBILE ? 'Press and hold. Let go in the warm zone.' : 'Hold E or Space. Let go in the warm zone.')))}</div><div class="mg-res"></div><div class="mg-dots">${'<i></i>'.repeat(rounds)}</div>`;
  box.hidden = false;
  const fill = box.querySelector('.mg-fill'), resEl = box.querySelector('.mg-res'), dots = box.querySelectorAll('.mg-dots i');
  const scores = []; let v = 0, held = false, cool = 0.3;
  const speed = spd * 0.42;
  const L = o.labels || ['Too little.', 'Nearly.', 'Just right.'];
  const done = () => { G.TICKERS.delete(tick); removeEventListener('keyup', up); removeEventListener('pointerup', up); modal = null; box.hidden = true; res(scores); };
  const score = (sc, word) => {
    scores.push(sc); dots[scores.length - 1].classList.add('done');
    resEl.textContent = G.fmt(word || (sc > 0.75 ? L[2] : sc > 0.35 ? L[1] : L[0]));
    if (o.onRelease) o.onRelease(sc, scores.length - 1);
    held = false; cool = 0.8;
    if (scores.length >= rounds) G.wait(1.1).then(done); else G.wait(0.7).then(() => { v = 0; fill.style.width = '0%'; });
  };
  const release = () => {
    if (!held) return;
    const c = (zone[0] + zone[1]) / 2, hw = (zone[1] - zone[0]) / 2, d = Math.abs(v - c);
    score(d <= hw ? 1 - 0.3 * (d / hw) : Math.max(0, 0.62 - (d - hw) * 3.2));
  };
  const down = () => { if (cool > 0 || held || scores.length >= rounds) return; held = true; v = 0; if (o.onHold) o.onHold(); };
  const up = (e) => { if (e.type === 'pointerup' || ['Enter', 'Space', 'KeyE'].includes(e.code)) release(); };
  const tick = (dt) => {
    cool -= dt;
    if (!held) return;
    v += dt * speed * (0.6 + v * 1.1) * (1 + scores.length * 0.12);   // slow at first, then it runs away from you
    if (v >= 1) { v = 1; fill.style.width = '100%'; score(0.1, o.over || 'Too much!'); return; }
    fill.style.width = (v * 100) + '%';
    if (o.onTick) o.onTick(v, dt);
  };
  G.TICKERS.add(tick);
  addEventListener('keyup', up); addEventListener('pointerup', up);
  box.onpointerdown = (e) => { e.preventDefault(); down(); };
  modal = { kind: 'minigame', key(e) {
    if (['Enter', 'Space', 'KeyE'].includes(e.code)) { if (!e.repeat) down(); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') return;
    return false;
  } };
});

/* Keep a rhythm: stirring. Tap steadily, not too fast and not too slow; the spoon goes round with each tap, and
 * the ring warms up while you're in time. A few seconds of it. Resolves to [score]. */
UI.rhythm = (o) => new Promise((res) => {
  const easy = G.easyHands && G.easyHands(), box = $('minigame'), dur = o.dur || 5, lo = (o.lo || 0.26) * (easy ? 0.6 : 1), hi = (o.hi || 0.56) * (easy ? 1.6 : 1);
  box.innerHTML = `<div class="mg-title">${esc(G.fmt(o.title))}</div><div class="mg-stir"><div class="mg-pot"><i class="mg-spoon"></i></div><div class="mg-time"><div></div></div></div>
    <div class="mg-sub">${esc(G.fmt(o.sub || (G.MOBILE ? 'Tap steadily. Not too fast.' : 'Tap E or Space steadily. Not too fast.')))}</div><div class="mg-res"></div>`;
  box.hidden = false;
  const pot = box.querySelector('.mg-pot'), spoon = box.querySelector('.mg-spoon'), bar = box.querySelector('.mg-time div'), resEl = box.querySelector('.mg-res');
  const L = o.labels || ['Lumpy.', 'Fine.', 'Smooth.'];
  let t = 0, last = -1, ang = 0, good = 0, taps = 0, heat = 0, over = false;
  const press = () => {
    if (over) return;
    const now = t;
    if (last >= 0) { const gap = now - last; taps++; if (gap >= lo && gap <= hi) { good++; heat = Math.min(1, heat + 0.25); resEl.textContent = ''; } else { heat = Math.max(0, heat - 0.35); resEl.textContent = G.fmt(gap < lo ? (o.fast || 'Slower…') : (o.slow || 'Keep going…')); } }
    last = now; ang += 90;
    spoon.style.transform = `rotate(${ang}deg)`;
    if (o.onTap) o.onTap();
  };
  const tick = (dt) => {
    if (over) return;
    t += dt; heat = Math.max(0, heat - dt * 0.15);
    bar.style.width = Math.min(100, (t / dur) * 100) + '%';
    pot.style.setProperty('--heat', heat.toFixed(2));
    if (last >= 0 && t - last > hi * 1.6 && !resEl.textContent) resEl.textContent = G.fmt(o.slow || 'Keep going…');
    if (t >= dur) {
      over = true;
      const sc = taps ? Math.min(1, (good / Math.max(taps, dur / ((lo + hi) / 2) * 0.8)) * 1.05) : 0;
      resEl.textContent = G.fmt(sc > 0.75 ? L[2] : sc > 0.35 ? L[1] : L[0]);
      G.wait(1.1).then(() => { G.TICKERS.delete(tick); modal = null; box.hidden = true; res([sc]); });
    }
  };
  G.TICKERS.add(tick);
  box.onpointerdown = (e) => { e.preventDefault(); press(); };
  modal = { kind: 'minigame', key(e) {
    if (['Enter', 'Space', 'KeyE'].includes(e.code)) { if (!e.repeat) press(); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') return;
    return false;
  } };
});

/* The Together menu: a row of actions. Resolves to an action id, or null if closed. */
UI.together = (acts) => new Promise((res) => {
  const box = $('together');
  box.innerHTML = acts.map((a, i) => `<button type="button" style="animation-delay:${i * 0.04}s"><span class="n">${i + 1}</span>${esc(G.fmt(a.t))}</button>`).join('');
  box.hidden = false;
  const btns = [...box.querySelectorAll('button')];
  let sel = 0;
  const mark = () => btns.forEach((b, i) => b.classList.toggle('sel', i === sel));
  let closed = false;
  const done = (v) => { if (closed) return; closed = true; removeEventListener('pointerdown', away, true); modal = null; box.hidden = true; box.innerHTML = ''; res(v); };
  btns.forEach((b, i) => { b.addEventListener('click', () => done(acts[i].id)); b.addEventListener('pointerenter', () => { sel = i; mark(); }); });
  mark();
  // Walking away, or tapping anywhere else, closes it.
  function away(e) { if (!box.contains(e.target)) done(null); }
  setTimeout(() => { if (!closed) addEventListener('pointerdown', away, true); }, 0);
  modal = { kind: 'together', key(e) {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= btns.length) { done(acts[n - 1].id); return; }
    if (['ArrowRight', 'KeyD', 'ArrowDown'].includes(e.code)) { sel = (sel + 1) % btns.length; mark(); return; }
    if (['ArrowLeft', 'KeyA', 'ArrowUp'].includes(e.code)) { sel = (sel + btns.length - 1) % btns.length; mark(); return; }
    if (['Enter', 'Space', 'KeyE'].includes(e.code)) { done(acts[sel].id); return; }
    if (['Escape', 'KeyQ', 'KeyW', 'KeyS'].includes(e.code)) { done(null); return; }
    return false;
  } };
});

/* ---------- scrapbook ---------- */
// Little painted snapshots for each page, drawn on a canvas like the polaroids in the cabin.
function paintSnap(cv, art) {
  art = { lastbday: 'circle', iknow: 'list', ambush: 'blanket' }[art] || art;   // pages that share a painting
  const c = cv.getContext('2d'), W = cv.width, H = cv.height;
  const sky = { snowman: ['#c8d6e8', '#e8eef6'], angels: ['#eef2f8', '#eef2f8'], cocoa: ['#e8d0b0', '#b0805a'], reading: ['#e0c8a8', '#a87c58'], cards: ['#dfe6da', '#a8b49a'], pinecones: ['#cfdcec', '#e8eef6'], hill: ['#bcd0e8', '#e6eef8'], lake: ['#c8d4e4', '#dfe8f2'], circle: ['#f0d8b8', '#e8c8a0'], pancakes: ['#f3d9b0', '#e7b780'], blanket: ['#efe3d0', '#c9b59a'], snowkids: ['#1a2440', '#4a5a86'], tea: ['#e8d8c0', '#b89470'], basil: ['#dfe8d6', '#9db08c'], study: ['#e9dcc8', '#b39a7c'], hug: ['#f0d6c0', '#d39a7a'], dance: ['#e8c89a', '#c0905e'], fox: ['#c8d4e4', '#e8eef6'], globe: ['#e8d8c0', '#b89470'], snowball: ['#cfdcec', '#eef3f9'], branch: ['#c8d6e8', '#e8eef6'], foundme: ['#f3e2c4', '#e0bc90'], default: ['#d8dde6', '#9aa6b8'] }[art] || ['#d8dde6', '#9aa6b8'];
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const fig = (x, y, s, col, hair) => { c.fillStyle = '#e8c0a0'; c.beginPath(); c.arc(x, y - 34 * s, 10 * s, 0, 7); c.fill(); c.fillStyle = hair; c.beginPath(); c.arc(x, y - 37 * s, 10.5 * s, Math.PI, 0); c.fill(); c.fillStyle = col; c.beginPath(); c.roundRect ? c.roundRect(x - 11 * s, y - 24 * s, 22 * s, 30 * s, 6 * s) : c.rect(x - 11 * s, y - 24 * s, 22 * s, 30 * s); c.fill(); };
  if (art === 'pancakes') {
    c.fillStyle = '#f7f2ea'; c.beginPath(); c.ellipse(W / 2, H * 0.68, W * 0.34, H * 0.11, 0, 0, 7); c.fill();
    for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? '#d49a52' : '#e0ad66'; c.beginPath(); c.ellipse(W / 2, H * 0.64 - i * 9, W * 0.25, H * 0.06, 0, 0, 7); c.fill(); }
    c.fillStyle = '#8a4a1e'; c.beginPath(); c.ellipse(W / 2 + 6, H * 0.6 - 36, W * 0.12, H * 0.03, 0, 0, 7); c.fill();
    c.fillStyle = sky[0]; c.beginPath(); c.arc(W / 2 + W * 0.2, H * 0.6 - 30, 14, 0, 7); c.fill();   // the bite
  } else if (art === 'snowkids') {
    c.fillStyle = '#e8eef6'; c.fillRect(0, H * 0.7, W, H * 0.3);
    for (let i = 0; i < 9; i++) { c.fillStyle = `rgba(255,190,110,${0.35 + (i % 3) * 0.15})`; c.beginPath(); c.arc(16 + i * (W / 9), H * 0.36 + Math.sin(i) * 8, 6, 0, 7); c.fill(); }
    fig(W * 0.4, H * 0.78, 0.8, '#34506e', '#2a1a12'); fig(W * 0.62, H * 0.8, 0.72, '#c08a3e', '#6a4028');
  } else if (art === 'blanket') {
    c.fillStyle = '#8a2a2a'; c.beginPath(); c.ellipse(W * 0.55, H * 0.62, W * 0.42, H * 0.2, -0.1, 0, 7); c.fill();
    c.fillStyle = '#e8c0a0'; c.beginPath(); c.arc(W * 0.3, H * 0.42, 13, 0, 7); c.fill(); c.beginPath(); c.arc(W * 0.7, H * 0.4, 12, 0, 7); c.fill();
  } else if (art === 'snowman') {
    c.fillStyle = '#e8eef6'; c.fillRect(0, H * 0.72, W, H * 0.28);
    c.fillStyle = '#f7f9fc'; for (const [y, r] of [[H * 0.74, 34], [H * 0.5, 25], [H * 0.31, 17]]) { c.beginPath(); c.arc(W / 2, y, r, 0, 7); c.fill(); }
    c.fillStyle = '#e8c840'; c.beginPath(); c.ellipse(W / 2 + 6, H * 0.32, 8, 5, 0, 0, 7); c.fill();
    c.strokeStyle = '#5a3a26'; c.lineWidth = 3; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(W / 2 + s * 22, H * 0.5); c.lineTo(W / 2 + s * 52, H * 0.36); c.stroke(); c.beginPath(); c.moveTo(W / 2 + s * 4, H * 0.27); c.lineTo(W / 2 + s * 13, H * 0.25 - s * 2); c.stroke(); }
  } else if (art === 'angels') {
    c.fillStyle = '#eef2f8'; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(150,165,200,0.55)'; for (const x of [W * 0.33, W * 0.67]) { c.beginPath(); c.arc(x, H * 0.22, 12, 0, 7); c.fill(); c.beginPath(); c.moveTo(x, H * 0.3); c.arc(x, H * 0.3, 52, Math.PI * 0.85, Math.PI * 2.15); c.fill(); c.fillRect(x - 13, H * 0.3, 26, H * 0.4); c.beginPath(); c.moveTo(x, H * 0.62); c.arc(x, H * 0.62, 40, Math.PI * 0.25, Math.PI * 0.75); c.fill(); }
  } else if (art === 'cocoa' || art === 'reading' || art === 'cards') {
    c.fillStyle = 'rgba(80,50,30,0.25)'; c.fillRect(0, H * 0.62, W, H * 0.38);
    if (art === 'cocoa') for (const [x, col] of [[W * 0.38, '#8a3a2e'], [W * 0.62, '#efe7da']]) { c.fillStyle = col; c.fillRect(x - 18, H * 0.45, 36, 42); c.fillStyle = '#5a321e'; c.fillRect(x - 16, H * 0.45, 32, 5); c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, H * 0.42); c.bezierCurveTo(x - 8, H * 0.34, x + 8, H * 0.28, x, H * 0.2); c.stroke(); }
    if (art === 'reading') { c.fillStyle = '#7a3a2a'; c.beginPath(); c.moveTo(W * 0.5, H * 0.66); c.lineTo(W * 0.2, H * 0.58); c.lineTo(W * 0.2, H * 0.36); c.lineTo(W * 0.5, H * 0.44); c.lineTo(W * 0.8, H * 0.36); c.lineTo(W * 0.8, H * 0.58); c.closePath(); c.fill(); c.fillStyle = '#efe6d2'; c.fillRect(W * 0.23, H * 0.4, W * 0.25, H * 0.15); c.fillRect(W * 0.52, H * 0.4, W * 0.25, H * 0.15); }
    if (art === 'cards') { [['Q', '♥', -0.18, -0.2], ['7', '♣', 0.0, 0.05], ['Q', '♠', 0.2, 0.25]].forEach(([r, su, dx, rot]) => { c.save(); c.translate(W * (0.5 + dx), H * 0.5); c.rotate(rot); c.fillStyle = '#fbf8f1'; c.fillRect(-20, -28, 40, 56); c.fillStyle = su === '♥' ? '#b8322a' : '#1e1a18'; c.font = 'bold 16px Georgia'; c.fillText(r, -15, -10); c.font = '22px Georgia'; c.fillText(su, -6, 16); c.restore(); }); }
  } else if (art === 'pinecones' || art === 'hill' || art === 'lake' || art === 'circle') {
    c.fillStyle = art === 'circle' ? '#e9eef4' : '#e8eef6'; c.fillRect(0, H * 0.62, W, H * 0.38);
    if (art === 'pinecones') { c.fillStyle = '#7a5038'; c.fillRect(W * 0.46, H * 0.56, 20, 14); for (let i = 0; i < 6; i++) { c.fillStyle = '#6a4a2e'; c.beginPath(); c.ellipse(W * 0.25 + i * 24, H * 0.8 + Math.sin(i) * 6, 6, 9, 0.3, 0, 7); c.fill(); } }
    if (art === 'hill') { c.fillStyle = '#f4f7fb'; c.beginPath(); c.ellipse(W / 2, H * 0.78, W * 0.6, H * 0.3, 0, Math.PI, 0); c.fill(); c.fillStyle = '#5a3a26'; c.fillRect(W * 0.42, H * 0.46, 36, 5); c.fillRect(W * 0.44, H * 0.47, 3, 10); c.fillRect(W * 0.56, H * 0.47, 3, 10); }
    if (art === 'lake') { c.fillStyle = '#9fb4c6'; c.beginPath(); c.ellipse(W / 2, H * 0.78, W * 0.42, H * 0.12, 0, 0, 7); c.fill(); c.fillStyle = '#4a4a4e'; for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(W * 0.32 + i * 26, H * 0.78 + (i % 2) * 5, 5, 3, 0, 0, 7); c.fill(); } }
    if (art === 'circle') { c.fillStyle = '#6a9a4e'; c.beginPath(); c.ellipse(W / 2, H * 0.8, W * 0.34, H * 0.12, 0, 0, 7); c.fill(); for (let i = 0; i < 14; i++) { c.fillStyle = ['#f2e26a', '#e88aa0', '#ffffff'][i % 3]; c.beginPath(); c.arc(W * 0.24 + (i * 37) % (W * 0.52), H * 0.76 + (i * 13) % 16, 2.5, 0, 7); c.fill(); } }
  } else if (art === 'candles') {
    // The power cut: a dark room, three small flames on the table, and the two of them leaning into the light.
    c.fillStyle = '#1c1612'; c.fillRect(0, 0, W, H);
    const glow = c.createRadialGradient(W * 0.5, H * 0.62, 4, W * 0.5, H * 0.62, W * 0.55); glow.addColorStop(0, 'rgba(255,190,110,0.75)'); glow.addColorStop(0.45, 'rgba(200,120,60,0.25)'); glow.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = glow; c.fillRect(0, 0, W, H);
    fig(W * 0.34, H * 0.78, 1.0, '#2a2c32', '#1e140f'); fig(W * 0.66, H * 0.79, 0.88, '#b8a88e', '#5e3a26');
    c.fillStyle = '#4a3020'; c.fillRect(W * 0.18, H * 0.72, W * 0.64, H * 0.06);
    for (const [x, h] of [[0.42, 30], [0.5, 22], [0.58, 16]]) { c.fillStyle = '#efe6d6'; c.fillRect(W * x - 4, H * 0.72 - h, 8, h); c.fillStyle = '#ffd59a'; c.beginPath(); c.ellipse(W * x, H * 0.72 - h - 6, 3, 6, 0, 0, 7); c.fill(); }
  } else if (art === 'list' || art === 'listpm') {
    // Her list, pinned up: ruled paper, every line crossed off, and a small heart in the margin.
    c.fillStyle = '#b9a58a'; c.fillRect(0, 0, W, H);
    c.save(); c.translate(W / 2, H / 2); c.rotate(-0.05);
    c.fillStyle = '#f6efe0'; c.fillRect(-W * 0.32, -H * 0.4, W * 0.64, H * 0.8);
    c.strokeStyle = 'rgba(120,150,190,0.4)'; c.lineWidth = 1;
    for (let i = 0; i < 6; i++) { const y = -H * 0.24 + i * H * 0.11; c.beginPath(); c.moveTo(-W * 0.28, y); c.lineTo(W * 0.28, y); c.stroke(); }
    for (let i = 0; i < 5; i++) {
      const y = -H * 0.24 + i * H * 0.11 - 4, w = W * (0.3 + ((i * 37) % 17) / 100);
      c.strokeStyle = '#5a3a22'; c.lineWidth = 2; c.beginPath(); for (let x = 0; x < w; x += 6) c.lineTo(-W * 0.22 + x, y + Math.sin(x * 0.4 + i) * 1.6); c.stroke();
      c.strokeStyle = '#b4553a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-W * 0.24, y + 1); c.lineTo(-W * 0.22 + w + 4, y - 1); c.stroke();
    }
    c.fillStyle = '#c2504a'; c.beginPath(); const hx = W * 0.2, hy = H * 0.28; c.moveTo(hx, hy + 6); c.bezierCurveTo(hx - 12, hy - 4, hx - 4, hy - 12, hx, hy - 5); c.bezierCurveTo(hx + 4, hy - 12, hx + 12, hy - 4, hx, hy + 6); c.fill();
    c.fillStyle = '#d6b25a'; c.beginPath(); c.arc(0, -H * 0.4, 5, 0, 7); c.fill();   // the pin
    c.restore();
  } else if (art === 'firstsnow') {
    // The first snow: a window going blue, the first flakes, two mugs on the sill gone cold, and three notes, a little flat.
    c.fillStyle = '#6a4a34'; c.fillRect(0, 0, W, H);   // the wall round the window
    const wx = W * 0.14, wy = H * 0.1, ww = W * 0.72, wh = H * 0.56;
    const out = c.createLinearGradient(0, wy, 0, wy + wh); out.addColorStop(0, '#5a6c90'); out.addColorStop(1, '#a8b6cc'); c.fillStyle = out; c.fillRect(wx, wy, ww, wh);
    c.fillStyle = '#e8eef6'; c.beginPath(); c.moveTo(wx, wy + wh); c.quadraticCurveTo(wx + ww * 0.35, wy + wh * 0.74, wx + ww, wy + wh * 0.86); c.lineTo(wx + ww, wy + wh); c.fill();   // snow on the ground outside
    c.fillStyle = '#3e5048'; for (const [x, h] of [[0.2, 0.3], [0.32, 0.22], [0.78, 0.34]]) { c.beginPath(); c.moveTo(wx + ww * x, wy + wh * (0.84 - h)); c.lineTo(wx + ww * (x - 0.06), wy + wh * 0.86); c.lineTo(wx + ww * (x + 0.06), wy + wh * 0.86); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 0; i < 26; i++) { const x = wx + ((i * 53) % 97) / 97 * ww, y = wy + ((i * 31) % 89) / 89 * wh * 0.8; c.beginPath(); c.arc(x, y, 1.2 + (i % 3) * 0.6, 0, 7); c.fill(); }
    c.fillStyle = '#efe6d6'; c.fillRect(wx + ww / 2 - 3, wy, 6, wh); c.fillRect(wx, wy + wh * 0.48 - 3, ww, 6);   // the glazing bars
    c.strokeStyle = '#efe6d6'; c.lineWidth = 6; c.strokeRect(wx, wy, ww, wh);
    c.fillStyle = '#d8c8b0'; c.fillRect(wx - 10, wy + wh + 2, ww + 20, 10);   // the sill
    for (const [x, col] of [[W * 0.4, '#8a3a2e'], [W * 0.6, '#efe7da']]) {   // two mugs, no steam: gone cold
      c.fillStyle = col; c.fillRect(x - 14, wy + wh - 30, 28, 32);
      c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.arc(x + 16, wy + wh - 14, 7, -1.3, 1.3); c.stroke();
      c.fillStyle = '#4a2a18'; c.fillRect(x - 12, wy + wh - 30, 24, 4);
    }
    c.fillStyle = '#f3ead8'; c.font = 'bold 20px serif'; c.textAlign = 'center';
    [[0.3, 0.86, -0.15], [0.5, 0.82, 0.05], [0.7, 0.88, 0.25]].forEach(([x, y, r]) => { c.save(); c.translate(W * x, H * y); c.rotate(r); c.fillText('♪', 0, 0); c.restore(); });
  } else if (art === 'dance') {
    // The slow dance: the kitchen, the radio on the shelf, and the two of them close together.
    c.fillStyle = '#c8a07a'; c.fillRect(0, H * 0.74, W, H * 0.26);
    c.fillStyle = '#5a3a26'; c.fillRect(W * 0.66, H * 0.2, W * 0.28, 6); c.fillStyle = '#8a4a30'; c.fillRect(W * 0.72, H * 0.2 - 20, 34, 20); c.fillStyle = '#e8d0a0'; c.beginPath(); c.arc(W * 0.72 + 24, H * 0.2 - 10, 5, 0, 7); c.fill();
    c.fillStyle = '#7a4a30'; c.font = '16px serif'; c.textAlign = 'center'; c.fillText('♪', W * 0.62, H * 0.18); c.fillText('♫', W * 0.56, H * 0.28);
    fig(W * 0.44, H * 0.86, 1.15, '#2a2c32', '#1e140f'); fig(W * 0.54, H * 0.88, 0.98, '#e4d7c2', '#5e3a26');
  } else if (art === 'fox') {
    c.fillStyle = '#e8eef6'; c.fillRect(0, H * 0.5, W, H * 0.5);
    c.fillStyle = '#3e5048'; for (const [x, h] of [[0.12, 70], [0.3, 54], [0.74, 80], [0.9, 60]]) { c.beginPath(); c.moveTo(W * x, H * 0.52 - h); c.lineTo(W * x - 18, H * 0.54); c.lineTo(W * x + 18, H * 0.54); c.fill(); }
    c.fillStyle = 'rgba(90,100,130,0.55)'; for (let i = 0; i < 9; i++) { const t = i / 8, x = W * (0.3 + 0.32 * t + Math.sin(i * 1.7) * 0.03), y = H * (0.95 - 0.38 * t); c.beginPath(); c.ellipse(x + (i % 2 ? 5 : -5), y, 3.5 - t * 1.5, 2.5 - t, 0, 0, 7); c.fill(); }
  } else if (art === 'frost') {
    c.fillStyle = '#6a4a34'; c.fillRect(0, 0, W, H);
    const fg = c.createLinearGradient(0, H * 0.1, 0, H * 0.9); fg.addColorStop(0, '#c8d8ea'); fg.addColorStop(1, '#eef3f9'); c.fillStyle = fg; c.fillRect(W * 0.12, H * 0.1, W * 0.76, H * 0.8);
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1; for (let i = 0; i < 18; i++) { const x = W * 0.12 + ((i * 47) % 100) / 100 * W * 0.76, y = H * 0.1 + ((i * 29) % 100) / 100 * H * 0.8; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 8, y - 6); c.moveTo(x, y); c.lineTo(x - 7, y - 5); c.stroke(); }
    const heart = (x, y, k, r) => { c.save(); c.translate(x, y); c.rotate(r); c.beginPath(); c.moveTo(0, 14 * k); c.bezierCurveTo(-24 * k, -4 * k, -10 * k, -22 * k, 0, -9 * k); c.bezierCurveTo(10 * k, -22 * k, 24 * k, -4 * k, 0, 14 * k); c.stroke(); c.restore(); };
    c.strokeStyle = 'rgba(110,130,160,0.8)'; c.lineWidth = 3; heart(W * 0.4, H * 0.48, 1.3, 0); heart(W * 0.62, H * 0.52, 1.1, 0.35);   // one lopsided, on purpose
    c.strokeStyle = '#efe6d6'; c.lineWidth = 6; c.strokeRect(W * 0.12, H * 0.1, W * 0.76, H * 0.8);
  } else if (art === 'globe') {
    c.fillStyle = '#b89470'; c.fillRect(0, H * 0.76, W, H * 0.24);
    c.fillStyle = '#5a3a26'; c.beginPath(); c.moveTo(W * 0.32, H * 0.8); c.lineTo(W * 0.68, H * 0.8); c.lineTo(W * 0.63, H * 0.68); c.lineTo(W * 0.37, H * 0.68); c.fill();
    c.fillStyle = 'rgba(200,220,240,0.55)'; c.beginPath(); c.arc(W / 2, H * 0.44, H * 0.28, 0, 7); c.fill();
    c.fillStyle = '#f4f7fb'; c.beginPath(); c.ellipse(W / 2, H * 0.64, H * 0.24, H * 0.06, 0, 0, 7); c.fill();
    c.fillStyle = '#3e5048'; for (let i = 0; i < 7; i++) { const x = W / 2 + (i - 3) * 12, h = 22 + (i % 3) * 8; c.beginPath(); c.moveTo(x, H * 0.63 - h); c.lineTo(x - 7, H * 0.63); c.lineTo(x + 7, H * 0.63); c.fill(); }
    c.fillStyle = '#8a5a2e'; c.fillRect(W / 2 - 10, H * 0.62, 20, 4);   // the cinnamon-stick log
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 3; c.beginPath(); c.arc(W / 2, H * 0.44, H * 0.24, -2.4, -1.6); c.stroke();
  } else if (art === 'snowball') {
    c.fillStyle = '#e8eef6'; c.fillRect(0, H * 0.7, W, H * 0.3);
    fig(W * 0.22, H * 0.86, 1.0, '#4a4d54', '#1e140f'); fig(W * 0.78, H * 0.88, 0.9, '#c8b49a', '#5e3a26');
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.setLineDash([3, 5]); c.lineWidth = 2; c.beginPath(); c.moveTo(W * 0.3, H * 0.55); c.quadraticCurveTo(W * 0.5, H * 0.2, W * 0.68, H * 0.5); c.stroke(); c.beginPath(); c.moveTo(W * 0.7, H * 0.6); c.quadraticCurveTo(W * 0.5, H * 0.36, W * 0.32, H * 0.64); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#fbfdff'; for (const [x, y] of [[0.5, 0.33], [0.46, 0.49]]) { c.beginPath(); c.arc(W * x, H * y, 7, 0, 7); c.fill(); }
  } else if (art === 'branch') {
    c.fillStyle = '#e8eef6'; c.fillRect(0, H * 0.72, W, H * 0.28);
    c.strokeStyle = '#4a3222'; c.lineWidth = 7; c.beginPath(); c.moveTo(-4, H * 0.18); c.quadraticCurveTo(W * 0.4, H * 0.22, W * 0.78, H * 0.36); c.stroke();
    c.fillStyle = '#f7f9fc'; for (let i = 0; i < 6; i++) { const t = i / 5, x = W * 0.75 * t, y = H * (0.17 + 0.17 * t * t); c.beginPath(); c.ellipse(x, y - 5, 18, 7, 0.2 * t, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(W * (0.55 + ((i * 37) % 23) / 100), H * (0.42 + ((i * 17) % 30) / 100), 2 + (i % 3), 0, 7); c.fill(); }
    fig(W * 0.62, H * 0.92, 1.0, '#4a4d54', '#1e140f');
  } else if (art === 'night') {
    // A door in the kitchen wall that isn't there by day.
    c.fillStyle = '#141820'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#20262f'; c.fillRect(0, H * 0.8, W, H * 0.2);
    c.fillStyle = '#2c2420'; c.fillRect(W * 0.38, H * 0.2, W * 0.24, H * 0.6);
    const lg = c.createLinearGradient(W * 0.6, 0, W * 0.62, 0); lg.addColorStop(0, 'rgba(255,214,150,0.9)'); lg.addColorStop(1, 'rgba(255,214,150,0)'); c.fillStyle = lg; c.fillRect(W * 0.6, H * 0.2, W * 0.03, H * 0.6);   // light round the edge
    c.fillStyle = 'rgba(255,214,150,0.18)'; c.beginPath(); c.moveTo(W * 0.62, H * 0.8); c.lineTo(W * 0.9, H * 0.98); c.lineTo(W * 0.66, H * 0.98); c.fill();
    c.fillStyle = '#c8a060'; c.beginPath(); c.arc(W * 0.42, H * 0.52, 3, 0, 7); c.fill();
  } else if (art === 'foundme') {
    // An ordinary morning, and a squeeze.
    c.fillStyle = 'rgba(255,240,210,0.5)'; c.fillRect(W * 0.62, 0, W * 0.3, H * 0.5);
    c.fillStyle = '#c8a07a'; c.fillRect(0, H * 0.78, W, H * 0.22);
    c.save(); c.translate(W * 0.44, H * 0.88); c.rotate(0.12); fig(0, 0, 1.15, '#2a2c32', '#1e140f'); c.restore();
    c.save(); c.translate(W * 0.565, H * 0.9); c.rotate(-0.16); fig(0, 0, 0.98, '#e4d7c2', '#5e3a26'); c.restore();
  } else if (art === 'kept') {
    // Left blank, on purpose.
    c.fillStyle = '#f6efe0'; c.fillRect(0, 0, W, H);
  } else {
    fig(W * 0.42, H * 0.86, 1.15, '#4a4d54', '#1e140f'); fig(W * 0.6, H * 0.88, 0.98, '#e4d7c2', '#5e3a26');
  }
  c.fillStyle = 'rgba(255,230,190,0.12)'; c.fillRect(0, 0, W, H);
}
UI.paintSnap = (cv, art) => paintSnap(cv, art);
UI.scrapbook = (pages) => new Promise((res) => {
  const box = $('scrap'), prev = modal;   // opened from the pause menu it can sit over a choice; give that back after
  if (prev && prev.kind === 'scrapbook') return res();
  let at = Math.max(0, (pages.length % 2 ? pages.length - 1 : pages.length - 2));
  at -= at % 2;
  const render = () => {
    const pic = (p) => (p.src ? `<img class="photo" alt="" src="${esc(p.src)}">` : `<canvas width="220" height="190" data-art="${esc(p.art)}"></canvas>`);   // photographs you took, or a little painting
    const page = (p) => (p && p.taken ? '<div class="scrap-page taken"><div class="scrap-empty">&nbsp;</div></div>' : p ? `<div class="scrap-page">${pic(p)}<div class="scrap-cap">${esc(G.fmt(p.caption))}</div></div>` : '<div class="scrap-page"><div class="scrap-empty">(Room for more.)</div></div>');
    box.innerHTML = `<div class="scrap-book">${page(pages[at])}${page(pages[at + 1])}<div class="scrap-nav"><button class="btn" data-k="prev" ${at <= 0 ? 'disabled' : ''}>←</button><button class="btn" data-k="close">Close</button><button class="btn" data-k="next" ${at + 2 >= pages.length ? 'disabled' : ''}>→</button></div></div>`;
    box.querySelectorAll('canvas').forEach((cv) => paintSnap(cv, cv.dataset.art));
    box.querySelector('[data-k=prev]').onclick = () => { if (at > 0) { at -= 2; render(); } };
    box.querySelector('[data-k=next]').onclick = () => { if (at + 2 < pages.length) { at += 2; render(); } };
    box.querySelector('[data-k=close]').onclick = close;
  };
  const close = () => { modal = prev; box.hidden = true; box.innerHTML = ''; res(); };
  if (!pages.length) pages = [{ art: 'default', caption: 'An empty scrapbook. It’s waiting for today.' }];
  render(); box.hidden = false;
  modal = { kind: 'scrapbook', key(e) {
    if (['ArrowLeft', 'KeyA'].includes(e.code)) { if (at > 0) { at -= 2; render(); } return; }
    if (['ArrowRight', 'KeyD'].includes(e.code)) { if (at + 2 < pages.length) { at += 2; render(); } return; }
    if (['Escape', 'Enter', 'Space', 'KeyE', 'KeyP'].includes(e.code)) { close(); return; }
    return false;
  } };
});
})();
