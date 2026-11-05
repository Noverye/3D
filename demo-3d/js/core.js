'use strict';
/* =========================================================================
 * Cozy Birthday Simulator — 3D base. Core: renderer, quality, utilities,
 * procedural textures and materials. Units are metres; y is up.
 * ========================================================================= */
const G = (window.G = {});
G.$ = (id) => document.getElementById(id);
G.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
G.lerp = (a, b, t) => a + (b - a) * t;
G.smooth = (a, b, x) => { const t = G.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/* The deeper cabin: furniture that stood against the back wall moved back with it, and the middle of the living
 * room opened up. G.ZM maps a position in the old 4.6 m-deep layout to where it is now (bedroom: the bed and
 * everything round it 2.4 m back; living room: the hearth wall 2.4 m, the coffee table and armchair 1 m; kitchen:
 * the counters 2.4 m). Anything nearer the front, and everything outside, is where it always was. */
G.ZM = (x, z) => {
  if (!(x > 0 && x < 15 && z > -0.2 && z < 4.6)) return z;
  if (x < 5) return z < 2.7 ? z - 2.4 : z;
  if (x < 11) return z < 1.45 ? z - 2.4 : z < 2.6 ? z - 1.0 : z;
  return z < 1.5 ? z - 2.4 : z;
};
G.smooth01 = (x) => x * x * (3 - 2 * x);
G.unsmooth01 = (y) => 0.5 - Math.sin(Math.asin(1 - 2 * Math.max(0, Math.min(1, y))) / 3);   // inverse of smooth01
/* A critically damped spring on o[key] toward target (velocity kept in o[key + 'V']): starts gently, no overshoot.
 * w is the stiffness in 1/s; about 2.5/w seconds to get most of the way there. */
G.spring = (o, key, target, w, dt) => {
  const vk = key + 'V'; let p = o[key] == null ? target : o[key], v = o[vk] || 0;
  const n = Math.max(1, Math.ceil(dt / 0.017)), h = dt / n;
  for (let i = 0; i < n; i++) { v += (w * w * (target - p) - 2 * w * v) * h; p += v * h; }
  o[key] = p; o[vk] = v; return p;
};
G.damp = (a, b, k, dt) => G.lerp(a, b, 1 - Math.exp(-k * dt));
G.rand = (a, b) => a + Math.random() * (b - a);
G.seeded = (s) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
// Personalisation (names, nicknames, birthday message) from js/config.js / the 2D game's config.
G.CFG = window.CBS_CONFIG || { playerLabel: 'You', partnerLabel: 'Partner', nickForPlayer: 'you', nickForPartner: 'you', birthday: { heading: 'Happy birthday.', full: [], signature: '' } };
// In the 3D game the two of them call each other “Partner” (callPlayer / callPartner in the config).
let dearN = 0;
const petName = (k) => { const C = G.CFG; const slip = G.nameSlip && G.nameSlip(k); if (slip) return slip; const v = k === 'toHim' ? C.callPlayer : k === 'toHer' ? C.callPartner : C.callBoth; return (Array.isArray(v) ? v[dearN++ % v.length] : v) || 'Partner'; };
// Pet names: lower case mid-sentence, a capital at the start of a sentence (or a quote).
G.fmt = (t) => String(t).replace(/\{(toHim|toHer|dear)\}/g, (m, k, i, s) => { const n = petName(k), pre = s.slice(Math.max(0, i - 2), i); return i === 0 || /(^|[.!?…]\s|[“"(]\s?)$/.test(pre) || /[“"(]$/.test(pre) ? n[0].toUpperCase() + n.slice(1) : n; }).replace(/\{giant\}/g, G.CFG.callPlayer || 'Partner').replace(/\{gremlin\}/g, G.CFG.callPartner || 'Partner')
  .replace(/\{P\}/g, G.CFG.partnerLabel).replace(/\{Y\}/g, G.CFG.playerLabel);
G.MOBILE = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;

/* ---------------- quality presets ---------------- */
G.PRESETS = {
  Low: { dpr: 1, shadows: false, dof: false, ssao: false, bloom: 0.35, shadowSize: 1024, trees: 0.45, snow: 1500 },
  High: { dpr: 1.5, shadows: true, dof: true, ssao: false, bloom: 0.5, shadowSize: 2048, trees: 1, snow: 3000 },
  Epic: { dpr: 2, shadows: true, dof: true, ssao: true, bloom: 0.55, shadowSize: 4096, trees: 1, snow: 4500 },
};
G.qName = G.MOBILE ? 'Low' : 'High';
try { G.qName = localStorage.getItem('cbs.base.quality') || G.qName; } catch (e) { /* storage unavailable */ }
if (!G.PRESETS[G.qName]) G.qName = 'High';
G.Q = G.PRESETS[G.qName];

/* ---------------- renderer & scene ---------------- */
G.canvas = G.$('gl');
G.renderer = new THREE.WebGLRenderer({ canvas: G.canvas, antialias: false, powerPreference: 'high-performance' });
G.renderer.physicallyCorrectLights = true;
G.renderer.toneMapping = THREE.ACESFilmicToneMapping;
G.renderer.toneMappingExposure = 0.9;
G.renderer.outputEncoding = THREE.sRGBEncoding;
G.renderer.shadowMap.enabled = true;
G.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
G.scene = new THREE.Scene();
G.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400);
G.pmrem = new THREE.PMREMGenerator(G.renderer);
G.MATS = [];
G.COLL = [];       // axis-aligned blockers {x0,z0,x1,z1}
G.CAMBLOCK = [];   // meshes the camera must not pass through
G.INTER = [];      // interactables

/* ---------------- noise ---------------- */
G.simplex = new THREE.SimplexNoise({ random: G.seeded(491) });
G.fbm = (x, y, o = 4) => { let a = 0, f = 1, w = 0.5; for (let i = 0; i < o; i++) { a += w * G.simplex.noise(x * f, y * f); f *= 2.03; w *= 0.5; } return a; };

G.hash1 = (n) => { const h = Math.sin(n * 127.1 + 311.7) * 43758.5453; return h - Math.floor(h); };
// Periodic value noise: the lattice wraps every p cells, so a texture painted with it tiles without a seam.
G.pnoise = (x, y, px, py) => {
  const hs = (i, j) => { i = ((i % px) + px) % px; j = ((j % py) + py) % py; const h = Math.sin(i * 127.1 + j * 311.7 + px * 17.3 + py * 3.1) * 43758.5453; return h - Math.floor(h); };
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hs(xi, yi), b = hs(xi + 1, yi), c = hs(xi, yi + 1), d = hs(xi + 1, yi + 1);
  return (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy) * 2 - 1;
};
// fbm over it: x, y are already in lattice units for the first octave, p = [px, py] that octave's period.
G.pfbm = (x, y, p, o = 3) => { let a = 0, f = 1, w = 0.5; for (let i = 0; i < o; i++) { a += w * G.pnoise(x * f, y * f, Math.round(p[0] * f), Math.round(p[1] * f)); f *= 2; w *= 0.5; } return a; };

/* ---------------- procedural textures ---------------- */
// Procedural textures are painted per pixel at boot; on Low (phones) paint them at half size, a quarter of the work.
G.TEX_SCALE = G.qName === 'Low' ? 0.5 : 1;
function canvasTex(size, fn, o = {}) {
  const k = o.draw ? 1 : G.TEX_SCALE;
  const w = Math.max(16, Math.round((o.w || size) * k)), h = Math.max(16, Math.round((o.h || size) * k));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  if (o.draw) o.draw(ctx, w, h);
  else {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = fn(x / w, y / h, x, y);
      const i = (y * w + x) * 4;
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = c[3] == null ? 255 : c[3];
    }
    ctx.putImageData(img, 0, 0);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = G.renderer.capabilities.getMaxAnisotropy();
  if (o.srgb !== false) t.encoding = THREE.sRGBEncoding;
  return t;
}
G.canvasTex = canvasTex;
const TX = (G.TX = {});
G.buildTextures = () => {
  const fbm = G.fbm;
  // Interior: warm vertical pine boards.
  TX.boards = canvasTex(512, (u, v) => {
    const col = Math.floor(u * 6), off = ((col * 37) % 10) / 10;
    const gap = (u * 6) % 1 < 0.02 ? 0.45 : 1;
    const knot = Math.max(0, 1 - Math.hypot(((u * 6) % 1 - 0.5) * 3, ((v + off) % 0.5 - 0.25) * 12)) * 0.25;
    const grain = fbm(u * 30 + col, v * 3, 3) * 0.18 + fbm(u * 120, v * 8, 2) * 0.06;
    const t = (0.82 + ((col * 13) % 5) / 25 + grain - knot) * gap;
    return [176 * t, 118 * t, 72 * t];
  });
  // The walls: tongue-and-groove pine. Seamless (periodic noise), ten boards to a tile, each its own cut of the
  // log: a tone of its own, grain that flows in long wavering stripes and bends round the odd knot, a dark groove
  // and a lit bevel at each joint. (It was a few wide planks under cloudy blotches, and the tiles didn't meet.)
  const PB = 10;
  const pine = (u, v) => {
    const col = Math.floor(u * PB), lu = (u * PB) % 1, hc = G.hash1(col * 7.13 + 1.7);
    // knots: at most one per board per tile, somewhere along it
    let kn = 0, bend = 0;
    if (hc < 0.45) {
      const kv = G.hash1(col * 3.1 + 9.2), ku = 0.3 + G.hash1(col * 5.7) * 0.4;
      let dv = v - kv; dv -= Math.round(dv);
      const dx = (lu - ku) / PB * 2.75, dy = dv * 2.75, r = Math.hypot(dx * 1.0, dy * 0.55);
      kn = Math.max(0, 1 - r / 0.018); bend = Math.exp(-r * r / 0.0035) * Math.sign(dx || 1) * 0.5;
    }
    const w = G.pfbm(u * PB * 0.5 + hc * 13, v * 2, [Math.max(1, PB / 2), 2], 3);
    const x = lu * (2.2 + hc * 2.6) + w * 1.6 + bend + hc * 7;
    const ring = x - Math.floor(x), late = Math.pow(1 - ring, 6) * 0.55 + Math.pow(ring, 14) * 0.25;
    const fine = G.pfbm(u * PB * 8, v * 48, [PB * 8, 48], 2) * 0.05;
    const tone = 0.86 + (hc - 0.5) * 0.2 + G.pfbm(u * PB, v * 3, [PB, 3], 2) * 0.08;
    const warm = 0.94 + G.hash1(col * 1.37 + 4.4) * 0.1;
    let t = tone * (1 - late * 0.28) + fine;
    const groove = lu < 0.012 ? 0.42 : lu < 0.03 ? 0.78 : lu > 0.985 ? 1.12 : 1;
    t *= groove * (1 - kn * 0.55);
    return [206 * t * warm, 158 * t, 108 * t / warm];
  };
  TX.wallBoards = canvasTex(512, pine);
  TX.wallBoardsB = canvasTex(256, (u) => { const lu = (u * PB) % 1; const g = lu < 0.014 ? 30 : lu < 0.035 ? 30 + (lu - 0.014) / 0.021 * 160 : lu > 0.98 ? 150 : 190; return [g, g, g]; }, { srgb: false });
  TX.boardsB = canvasTex(256, (u) => { const g = (u * 6) % 1 < 0.02 ? 40 : 170 + G.fbm(u * 80, 0, 2) * 30; return [g, g, g]; }, { srgb: false });
  // Snow: wind-ripples for the light to model (it was one flat white), tileable (whole-number waves only), and a few
  // crystals in every patch that catch the sun as you move.
  TX.snowB = (() => {
    // periodic value noise (the lattice wraps), so the tiles meet without a seam and without regular waves
    const hsh = (x, y, p) => { x = ((x % p) + p) % p; y = ((y % p) + p) % p; const h = Math.sin(x * 127.1 + y * 311.7 + p * 17.3) * 43758.5453; return h - Math.floor(h); };
    const vn = (u, v, p) => { const x = u * p, y = v * p, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = hsh(xi, yi, p), b = hsh(xi + 1, yi, p), c = hsh(xi, yi + 1, p), d = hsh(xi + 1, yi + 1, p); return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; };
    return canvasTex(256, (u, v) => {
      const h = 0.45 * vn(u, v, 4) + 0.28 * vn(u, v, 8) + 0.16 * vn(u, v, 16) + 0.11 * vn(u, v, 32);
      const g = Math.max(0, Math.min(255, h * 255)); return [g, g, g];
    }, { srgb: false });
  })();
  TX.snowR = canvasTex(256, (u, v, x, y) => {
    const r = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
    const g = r < 0.006 ? 20 : 200 + (r * 1000 % 1) * 30; return [g, g, g];
  }, { srgb: false });
  // Exterior: stacked round logs with chinking.
  TX.logs = canvasTex(512, (u, v) => {
    const row = Math.floor(v * 7), f = (v * 7) % 1;
    if (f < 0.07) { const c = 205 + fbm(u * 40, v * 40) * 25; return [c, c * 0.95, c * 0.88]; }
    const shade = Math.sin(((f - 0.07) / 0.93) * Math.PI);
    const grain = fbm(u * 3 + row * 11, v * 70, 3) * 0.25 + fbm(u * 50, v * 400, 2) * 0.06;
    const t = (0.35 + shade * 0.6) * (0.85 + grain) * (0.9 + ((row * 7) % 5) / 25);
    return [128 * t, 82 * t, 52 * t];
  });
  TX.logsB = canvasTex(256, (u, v) => { const f = (v * 7) % 1; const g = f < 0.07 ? 30 : 60 + Math.sin(((f - 0.07) / 0.93) * Math.PI) * 170 + G.fbm(u * 60, v * 300, 2) * 20; return [g, g, g]; }, { srgb: false });
  // Floor: wide oak planks.
  TX.floor = canvasTex(512, (u, v) => {
    const row = Math.floor(v * 6), off = (row * 0.37) % 1, seg = Math.floor((u + off) * 2);
    const edge = (v * 6) % 1 < 0.025 || ((u + off) * 2) % 1 < 0.006 ? 0.5 : 1;
    const t = (0.74 + ((row * 17 + seg * 31) % 7) / 28 + fbm(u * 3, v * 50 + row * 3, 3) * 0.3) * edge;
    return [172 * t, 120 * t, 78 * t];   // warm oak (it was nearly mahogany)
  });
  TX.floorB = canvasTex(256, (u, v) => { const row = Math.floor(v * 6), off = (row * 0.37) % 1; const e = (v * 6) % 1 < 0.025 || ((u + off) * 2) % 1 < 0.006; const g = e ? 40 : 160 + G.fbm(u * 40, v * 300, 2) * 30; return [g, g, g]; }, { srgb: false });
  // Roof shingles.
  TX.shingle = canvasTex(256, (u, v) => {
    const row = Math.floor(v * 8), off = row % 2 ? 0.5 : 0, f = (v * 8) % 1;
    const id = Math.floor(u * 6 + off) + row * 9;
    const t = (0.5 + ((id * 37) % 9) / 30 + f * 0.25 + fbm(u * 30, v * 30) * 0.1) * ((u * 6 + off) % 1 < 0.04 ? 0.5 : 1);
    return [70 * t, 58 * t, 54 * t];
  });
  // Field stone (chimney, fireplace, foundation).
  TX.stone = canvasTex(512, (u, v) => {
    const s = 5; let best = 9, second = 9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = Math.floor(u * s) + i, cy = Math.floor(v * s * 1.6) + j;
      const h = Math.sin(cx * 127.1 + cy * 311.7) * 43758.5453; const r = h - Math.floor(h);
      const px = (cx + 0.5 + (r - 0.5) * 0.7) / s, py = (cy + 0.5 + ((r * 7) % 1 - 0.5) * 0.7) / (s * 1.6);
      const d = Math.hypot((u - px) * s, (v - py) * s * 1.6);
      if (d < best) { second = best; best = d; id = r; } else if (d < second) second = d;
    }
    const mortar = second - best < 0.09;
    if (mortar) { const g = 120 + fbm(u * 50, v * 50) * 20; return [g, g * 0.97, g * 0.92]; }
    const t = 0.65 + id * 0.35 + fbm(u * 25, v * 25, 3) * 0.12;
    return [138 * t, 128 * t, 116 * t];
  });
  // Knit: cable pattern.
  const knit = (base, cable) => canvasTex(256, (u, v) => {
    const x = u * 16, y = v * 32;
    const rib = Math.abs(Math.sin(x * Math.PI)) * 0.25;
    const st = Math.abs(Math.sin(y * Math.PI + (Math.floor(x) % 2) * 1.5)) * 0.18;
    let c = 0;
    if (cable) { const cx = (u * 4) % 1; const tw = Math.sin(v * 16 * Math.PI) * 0.08; c = Math.max(0, 1 - Math.abs(cx - 0.5 - tw) * 10) * 0.2; }
    const t = 0.72 + rib + st + c + fbm(u * 40, v * 40, 2) * 0.05;
    return [base[0] * t, base[1] * t, base[2] * t];
  });
  TX.knitCream = knit([226, 210, 186], true);
  TX.knitDark = knit([70, 66, 64], false);
  TX.knitB = canvasTex(256, (u, v) => { const g = 90 + Math.abs(Math.sin(u * 16 * Math.PI)) * 80 + Math.abs(Math.sin(v * 32 * Math.PI)) * 60; return [g, g, g]; }, { srgb: false });
  // Jersey (hoodie).
  TX.jersey = canvasTex(256, (u, v) => { const t = 0.9 + G.fbm(u * 60, v * 60, 2) * 0.08 + Math.sin(v * 400) * 0.015; return [255 * t, 255 * t, 255 * t]; });
  TX.jerseyB = canvasTex(128, (u, v) => { const g = 128 + G.fbm(u * 50, v * 50, 2) * 60; return [g, g, g]; }, { srgb: false });
  // Wool coating (the overcoats): a dense, slightly fuzzy melton with a faint twill running across it.
  // One tile is 30 cm of coat (tools/overcoat.py lays the UVs out at that scale).
  TX.wool = canvasTex(256, (u, v) => { const tw = Math.sin((u + v) * 96 * Math.PI) * 0.018, t = 0.9 + G.fbm(u * 90, v * 90, 3) * 0.07 + G.fbm(u * 12, v * 12, 2) * 0.03 + tw; return [255 * t, 255 * t, 255 * t]; });
  TX.woolB = canvasTex(256, (u, v) => { const g = 128 + Math.sin((u + v) * 96 * Math.PI) * 26 + G.fbm(u * 120, v * 120, 2) * 50; return [g, g, g]; }, { srgb: false });
  // Plaid throw.
  TX.plaid = canvasTex(512, (u, v) => {
    const band = (t, w) => (Math.abs(((t * 4) % 1) - 0.5) < w ? 1 : 0);
    let r = 120, g = 28, b = 30;
    const dkU = band(u, 0.18), dkV = band(v, 0.18);
    if (dkU || dkV) { r = 50; g = 30; b = 32; }
    if (dkU && dkV) { r = 26; g = 22; b = 26; }
    if (band(u + 0.125, 0.025) || band(v + 0.125, 0.025)) { r = 200; g = 170; b = 120; }
    if (band(u + 0.25, 0.012) || band(v + 0.25, 0.012)) { r = 30; g = 60; b = 52; }
    const tw = ((Math.floor(u * 512) + Math.floor(v * 512)) % 4 < 2) ? 0.92 : 1.05;
    return [r * tw, g * tw, b * tw];
  });
  TX.fabricB = canvasTex(256, (u, v) => { const w = 128 + Math.sin(u * 128 * Math.PI) * Math.sin(v * 128 * Math.PI) * 70; return [w, w, w]; }, { srgb: false });
  TX.linen = canvasTex(256, (u, v) => { const t = 0.92 + Math.sin(u * 200) * Math.sin(v * 200) * 0.03 + G.fbm(u * 20, v * 20, 2) * 0.05; return [240 * t, 232 * t, 220 * t]; });
  TX.rug = canvasTex(512, (u, v) => {
    const b = Math.min(u, v, 1 - u, 1 - v);
    let c = [110, 54, 42];
    if (b < 0.05) c = [60, 34, 28]; else if (b < 0.08) c = [196, 160, 112]; else if (b < 0.14) c = [80, 40, 34];
    const d = Math.abs(u - 0.5) + Math.abs(v - 0.5);
    if (b >= 0.14 && Math.abs(Math.sin(d * 30)) < 0.15) c = [186, 140, 92];
    const k = 0.88 + G.fbm(u * 60, v * 60, 2) * 0.14;
    return [c[0] * k, c[1] * k, c[2] * k];
  });
  TX.bark = canvasTex(128, (u, v) => { const t = 0.6 + G.fbm(u * 6, v * 30, 3) * 0.4; return [90 * t, 64 * t, 48 * t]; });
  TX.snowN = canvasTex(256, (u, v) => { const n = G.fbm(u * 4, v * 4, 3) * 0.6 + G.fbm(u * 24, v * 24, 2) * 0.4; const g = 128 + n * 70; return [g, g, g]; }, { srgb: false });
  // Hair strands (alpha-tested cards).
  TX.hair = canvasTex(0, null, {
    w: 128, h: 512, srgb: true, draw: (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const r = G.seeded(77);
      for (let i = 0; i < 220; i++) {
        const x = r() * w, len = h * (0.55 + r() * 0.45), wd = 0.6 + r() * 1.6;
        const l = 150 + r() * 105;
        const g = ctx.createLinearGradient(0, 0, 0, len);
        g.addColorStop(0, `rgba(${l},${l},${l},1)`); g.addColorStop(0.75, `rgba(${l},${l},${l},0.95)`); g.addColorStop(1, `rgba(${l},${l},${l},0)`);
        ctx.strokeStyle = g; ctx.lineWidth = wd;
        ctx.beginPath(); ctx.moveTo(x, 0);
        const sway = (r() - 0.5) * 18;
        ctx.bezierCurveTo(x + sway * 0.3, len * 0.33, x + sway, len * 0.66, x + sway * 1.3, len);
        ctx.stroke();
      }
    },
  });
  TX.hair.wrapS = TX.hair.wrapT = THREE.ClampToEdgeWrapping;
};

/* ---------------- materials ---------------- */
G.std = (o) => {
  const { env, ...rest } = o;
  const m = new THREE.MeshStandardMaterial(rest);
  m.envMapIntensity = env != null ? env : 0.35;
  G.MATS.push(m);
  return m;
};
// Shared plain materials (no textures, never animated): one material per look instead of one per prop.
const SHARED = new Map();
G.shared = (o) => {
  const key = JSON.stringify(o);
  if (!SHARED.has(key)) SHARED.set(key, G.std(o));
  return SHARED.get(key);
};
/* three r128 frustum-culls an InstancedMesh with its template geometry's bounds at the mesh origin,
 * so instances elsewhere can vanish when the origin leaves the view. Give the geometry a sphere that
 * encloses every instance instead. (Each instanced geometry here is used by one mesh only.) */
G.fitInstanceBounds = (im) => {
  const g = im.geometry;
  if (!g.boundingSphere) g.computeBoundingSphere();
  const r0 = g.boundingSphere.radius, c0 = g.boundingSphere.center.clone();
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const pts = [];
  let maxS = 0;
  for (let i = 0; i < im.count; i++) {
    im.getMatrixAt(i, m); m.decompose(p, q, sc);
    pts.push(c0.clone().applyMatrix4(m)); maxS = Math.max(maxS, sc.x, sc.y, sc.z);
  }
  const box = new THREE.Box3().setFromPoints(pts), sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);
  sphere.radius += r0 * maxS;
  g.boundingSphere = sphere;
};
G.rep = (tex, x, y) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(x, y); return t; };
const MAT = (G.MAT = {});
G.buildMaterials = () => {
  const std = G.std;
  Object.assign(MAT, {
    boards: std({ map: TX.wallBoards, bumpMap: TX.wallBoardsB, bumpScale: 0.004, color: '#fbeee0', roughness: 0.72, env: 0.24 }),   // golden pine
    logs: std({ map: TX.logs, bumpMap: TX.logsB, bumpScale: 0.03, roughness: 0.85, env: 0.4 }),
    floor: std({ map: TX.floor, bumpMap: TX.floorB, bumpScale: 0.003, color: '#f0d9c0', roughness: 0.55, env: 0.4 }),
    shingle: std({ map: TX.shingle, roughness: 0.9 }),
    stone: std({ map: TX.stone, bumpMap: TX.stone, bumpScale: 0.02, roughness: 0.9, env: 0.3 }),
    beam: std({ map: TX.bark, color: '#7a5a42', roughness: 0.8 }),
    trim: std({ color: '#5e4330', roughness: 0.7 }),
    darkWood: std({ map: TX.boards, color: '#6a4a36', roughness: 0.55, env: 0.35 }),
    wood: std({ map: TX.boards, color: '#b88a62', roughness: 0.55, env: 0.35 }),
    snow: std({ color: '#e6ecf3', roughness: 0.75, env: 0.7 }),   // just short of paper-white, so it can be shaded rather than clip
    snowGround: std({ color: '#dfe6ef', roughness: 1, roughnessMap: G.rep(TX.snowR, 26, 26), bumpMap: G.rep(TX.snowB, 7, 7), bumpScale: 0.09, env: 0.6 }),
    ice: std({ color: '#8fa6b8', roughness: 0.12, metalness: 0.0, env: 1.3 }),
    bark: std({ map: TX.bark, roughness: 1 }),
    metal: std({ color: '#b89b6a', roughness: 0.3, metalness: 1, env: 1 }),
    darkMetal: std({ color: '#2b2724', roughness: 0.45, metalness: 0.85, env: 0.9 }),
    ceramic: std({ color: '#f1ede4', roughness: 0.25, env: 0.9 }),
    plaid: std({ map: TX.plaid, bumpMap: TX.fabricB, bumpScale: 0.003, roughness: 1 }),
    knitCream: std({ map: TX.knitCream, bumpMap: TX.knitB, bumpScale: 0.006, roughness: 1 }),
    linen: std({ map: TX.linen, bumpMap: TX.fabricB, bumpScale: 0.001, roughness: 1 }),
    rug: std({ map: TX.rug, bumpMap: TX.fabricB, bumpScale: 0.004, roughness: 1 }),
    sofa: std({ map: TX.jersey, color: '#4d4038', bumpMap: TX.fabricB, bumpScale: 0.002, roughness: 1 }),
    glassOut: std({ color: '#ffb46a', emissive: '#ff9a40', emissiveIntensity: 0.55, roughness: 0.05, transparent: true, opacity: 0.32, env: 1.2, depthWrite: false }),
    glassIn: std({ color: '#203050', roughness: 0.02, transparent: true, opacity: 0.18, env: 1.4, depthWrite: false }),
    bulb: new THREE.MeshBasicMaterial({ color: '#ffcf86' }),
    flameGlow: new THREE.MeshBasicMaterial({ color: '#ffd59a' }),
    leaf: std({ color: '#4b6f3f', roughness: 0.65, side: THREE.DoubleSide }),
    pot: std({ color: '#a86040', roughness: 0.85 }),
    candle: std({ color: '#f2e8d6', roughness: 0.6, emissive: '#ffb060', emissiveIntensity: 0.06 }),
  });
  MAT.glassOut.side = THREE.FrontSide; MAT.glassIn.side = THREE.FrontSide;
};

/* ---------------- mesh helpers ---------------- */
G.add = (m, parent, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; (parent || G.world).add(m); return m; };
G.box = (w, h, d, mat, x, y, z, o = {}) => {
  const g = o.r ? new THREE.RoundedBoxGeometry(w, h, d, o.seg || 3, o.r) : new THREE.BoxGeometry(w, h, d);
  if (o.uv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * o.uv[0], uv.getY(i) * o.uv[1]); }
  const m = G.add(new THREE.Mesh(g, mat), o.parent, o.cast !== false, true);
  m.position.set(x, y, z);
  if (o.ry) m.rotation.y = o.ry;
  if (o.coll) G.COLL.push({ x0: x - w / 2 - (o.pad || 0), z0: z - d / 2 - (o.pad || 0), x1: x + w / 2 + (o.pad || 0), z1: z + d / 2 + (o.pad || 0) });
  if (o.cam) G.CAMBLOCK.push(m);
  return m;
};
G.cyl = (rt, rb, h, mat, x, y, z, o = {}) => {
  const m = G.add(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg || 20, 1, !!o.open), mat), o.parent, o.cast !== false);
  m.position.set(x, y, z);
  return m;
};
G.sph = (r, mat, x, y, z, s = [1, 1, 1], parent, seg = 20) => {
  const m = G.add(new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)), mat), parent);
  m.position.set(x, y, z); m.scale.set(s[0], s[1], s[2]);
  return m;
};
/* Merge several geometries (each with a transform matrix and a flat colour) into one vertex-coloured geometry. */
G.merge = (parts) => {
  const P = [], N = [], C = [];
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const p of parts) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    const pos = g.attributes.position, nor = g.attributes.normal;
    nm.getNormalMatrix(p.mat);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(p.mat);
      n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      P.push(v.x, v.y, v.z); N.push(n.x, n.y, n.z);
      const c = typeof p.color === 'function' ? p.color(v, n, i) : p.color;
      C.push(c.r, c.g, c.b);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  return out;
};
G.mtx = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

/* ---------------- static batching ----------------
 * Merge every static, opaque mesh under `root` that shares a material (and shadow flags) into one
 * mesh, turning hundreds of draw calls into a few dozen. Skipped: instanced/skinned meshes, shader and
 * transparent materials, vertex-coloured materials, anything flagged userData.dynamic, and anything
 * in `skip` (or under a skipped object). Merged-away camera blockers are kept detached, with their
 * world matrices, so the camera can still raycast against them.
 */
G.mergeStatic = (root, skip = new Set()) => {
  root.updateMatrixWorld(true);
  const buckets = new Map(), victims = [];
  const nm = new THREE.Matrix3(), v = new THREE.Vector3();
  const skipped = (o) => { for (let p = o; p; p = p.parent) { if (skip.has(p) || (p.userData && p.userData.dynamic) || p.visible === false) return true; } return false; };
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.renderOrder || skipped(o)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => !(m.isMeshStandardMaterial || m.isMeshBasicMaterial || m.isMeshLambertMaterial) || m.transparent || m.vertexColors)) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    if (!nor) return;
    const mw = o.matrixWorld, flip = mw.determinant() < 0;
    nm.getNormalMatrix(mw);
    // Batch by area (the cabin interior, and 16 m blocks outside) so culling and shadow cameras still skip what they can't see.
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const wc = o.geometry.boundingSphere.center.clone().applyMatrix4(mw);
    const zone = G.inside && G.inside(wc.x, wc.z) && wc.y < 2.8 ? 'in' : Math.floor(wc.x / 16) + ',' + Math.floor(wc.z / 16);
    const groups = Array.isArray(o.material) && g.groups.length ? g.groups : [{ start: 0, count: pos.count, materialIndex: 0 }];
    for (const gr of groups) {
      const mat = Array.isArray(o.material) ? o.material[gr.materialIndex] : o.material;
      if (!mat) continue;
      const key = mat.uuid + zone + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { mat, zone, cast: o.castShadow, recv: o.receiveShadow, P: [], N: [], U: [] }));
      for (let t = gr.start; t < gr.start + gr.count; t += 3) {
        const order = flip ? [t, t + 2, t + 1] : [t, t + 1, t + 2];
        for (const i of order) {
          v.fromBufferAttribute(pos, i).applyMatrix4(mw); b.P.push(v.x, v.y, v.z);
          v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); b.N.push(v.x, v.y, v.z);
          if (uv) b.U.push(uv.getX(i), uv.getY(i)); else b.U.push(0, 0);
        }
      }
    }
    if (g !== o.geometry) g.dispose();
    victims.push(o);
  });
  for (const o of victims) {
    o.parent.remove(o);
    if (!G.CAMBLOCK.includes(o)) o.geometry.dispose();   // blockers keep their geometry for raycasts
  }
  let made = 0;
  for (const b of buckets.values()) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.P, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.N, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.U, 2));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, b.mat);
    m.castShadow = b.cast; m.receiveShadow = b.recv; m.matrixAutoUpdate = false; m.name = 'static';
    root.add(m); made++;
  }
  return { merged: victims.length, meshes: made };
};
