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
UI.timing = (o) => new Promise((res) => {
  const box = $('minigame'), zone = o.zone || [0.6, 0.76], rounds = o.rounds || 3;
  box.innerHTML = `<div class="mg-title">${esc(G.fmt(o.title))}</div><div class="mg-bar"><div class="mg-zone" style="left:${zone[0] * 100}%;width:${(zone[1] - zone[0]) * 100}%"></div><div class="mg-needle"></div></div>
    <div class="mg-sub">${G.MOBILE ? 'Tap when the marker is in the warm zone' : 'Press E or Space when the marker is in the warm zone'}</div><div class="mg-res"></div><div class="mg-dots">${'<i></i>'.repeat(rounds)}</div>`;
  box.hidden = false;
  const needle = box.querySelector('.mg-needle'), resEl = box.querySelector('.mg-res'), dots = box.querySelectorAll('.mg-dots i');
  const scores = []; let t = Math.random() * 0.3, dir = 1, cool = 0.5;
  const speed = (o.speed || 1) * 0.9;
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
  const c = cv.getContext('2d'), W = cv.width, H = cv.height;
  const sky = { snowman: ['#c8d6e8', '#e8eef6'], angels: ['#eef2f8', '#eef2f8'], cocoa: ['#e8d0b0', '#b0805a'], reading: ['#e0c8a8', '#a87c58'], cards: ['#dfe6da', '#a8b49a'], pinecones: ['#cfdcec', '#e8eef6'], hill: ['#bcd0e8', '#e6eef8'], lake: ['#c8d4e4', '#dfe8f2'], circle: ['#f0d8b8', '#e8c8a0'], pancakes: ['#f3d9b0', '#e7b780'], blanket: ['#efe3d0', '#c9b59a'], snowkids: ['#1a2440', '#4a5a86'], tea: ['#e8d8c0', '#b89470'], basil: ['#dfe8d6', '#9db08c'], study: ['#e9dcc8', '#b39a7c'], hug: ['#f0d6c0', '#d39a7a'], default: ['#d8dde6', '#9aa6b8'] }[art] || ['#d8dde6', '#9aa6b8'];
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
