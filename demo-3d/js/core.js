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
  Low: { glass: 128, dpr: 1, shadows: false, dof: false, ssao: false, bloom: 0.35, shadowSize: 1024, trees: 0.45, snow: 1500 },
  High: { glass: 256, dpr: 1.5, shadows: true, dof: true, ssao: false, bloom: 0.5, shadowSize: 2048, trees: 1, snow: 3000 },
  Epic: { glass: 256, dpr: 2, shadows: true, dof: true, ssao: true, bloom: 0.55, shadowSize: 4096, trees: 1, snow: 4500 },
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
  // The ceiling: the same boards limewashed, the grain still showing through a milky white (all wood, walls, ceiling
  // and floor in one golden orange, made every room a box of the same colour, and kept the light low).
  TX.ceilWash = canvasTex(0, null, { w: TX.wallBoards.image.width, h: TX.wallBoards.image.height, draw: (c, w, h) => {
    c.drawImage(TX.wallBoards.image, 0, 0, w, h);
    c.globalCompositeOperation = 'saturation'; c.fillStyle = 'rgba(128,128,128,0.65)'; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'source-over'; c.fillStyle = 'rgba(238,233,224,0.6)'; c.fillRect(0, 0, w, h);
  } });
  // The bedroom's painted wall: boards painted a dusty blue, the grooves and a ghost of the grain under the paint.
  TX.paintBoards = canvasTex(0, null, { w: TX.wallBoards.image.width, h: TX.wallBoards.image.height, draw: (c, w, h) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
    c.globalAlpha = 0.16; c.drawImage(TX.wallBoards.image, 0, 0, w, h); c.globalAlpha = 1;
    c.globalCompositeOperation = 'saturation'; c.fillStyle = 'rgb(128,128,128)'; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.55; c.drawImage(TX.wallBoardsB.image, 0, 0, w, h);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  } });
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
  // Exterior logs: only the wood, its grain running along each log, and a little of the shading round it; the logs'
  // roundness, the chinking between them and each log's own tone are drawn by the walls' shader (G.logWall), so the
  // light models them and the lines between them waver. (The chinking used to be painted in as dead-straight bright
  // stripes, and the logs' shading painted on, so they read as a striped wall.)
  TX.logs = canvasTex(512, (u, v) => {
    const row = Math.floor(v * 7), f = (v * 7) % 1;
    const shade = Math.sin(f * Math.PI);
    const grain = fbm(u * 3 + row * 11, v * 70, 3) * 0.25 + fbm(u * 50, v * 400, 2) * 0.06;
    const t = (0.78 + shade * 0.22) * (0.85 + grain);
    return [128 * t, 82 * t, 52 * t];
  });
  // A log's sawn end, weathered (the cabin's corners): pale end grain in growth rings round a pith a little off centre,
  // the rings wavering, the late wood of each ring darker; checks (drying cracks) running in from the rim; a band of
  // sapwood and a thin rim of grey-brown bark. Drawn on the disc inscribed in the tile, as a CircleGeometry maps it.
  TX.logEnd = canvasTex(128, (u, v, x, y) => {
    const dx = u - 0.47, dy = v - 0.53, a = Math.atan2(dy, dx), r = Math.hypot(u - 0.5, v - 0.5) * 2;
    const rp = Math.hypot(dx, dy) * 2 * (1 + G.fbm(Math.cos(a) * 1.4 + 3.1, Math.sin(a) * 1.4 + 0.7, 2) * 0.1);
    const ring = (rp * 13) % 1, late = G.smooth(0.62, 0.9, ring) * (1 - G.smooth(0.9, 1.0, ring));
    let t = (0.92 - late * 0.2 + G.fbm(u * 24, v * 24, 2) * 0.08) * (1 - G.smooth(0.0, 0.08, 0.08 - rp) * 0.25);
    let c = [194 * t, 160 * t, 118 * t];
    const g = 0.3 + G.fbm(u * 5 + 2, v * 5, 2) * 0.25;   // weathered toward grey
    c = c.map((k, i) => k * (1 - g) + [150, 142, 132][i] * t * g);
    for (let i = 0; i < 4; i++) {   // checks, from the rim inward
      const ca = G.hash1(i * 3.7 + 1.3) * Math.PI * 2, len = 0.35 + G.hash1(i * 5.1) * 0.4;
      let da = (((a - ca) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); da = Math.min(da, Math.PI * 2 - da);
      if (r > 1 - len && da * r < 0.006 + 0.02 * (r - (1 - len))) { c = c.map((k) => k * 0.4); break; }
    }
    if (r > 0.82) c = c.map((k) => k * 0.82);                                    // sapwood
    if (r > 0.93) c = [74 + G.hash1(x * 3.3 + y * 7.1) * 20, 60, 50];          // bark
    return c;
  });
  TX.logsB = canvasTex(256, (u, v) => { const g = 128 + G.fbm(u * 60, v * 300, 2) * 60 + G.fbm(u * 8, v * 90, 2) * 30; return [g, g, g]; }, { srgb: false });
  // Floor: wide oak planks.
  // Oak floorboards, darker and browner than the pine walls so the room has a floor under it: nine boards to the
  // 2.4 m tile, each its own length, tone and grain, a dark line at every joint.
  const FR = 9;
  TX.floor = canvasTex(512, (u, v) => {
    const row = Math.floor(v * FR), off = G.hash1(row * 3.7) % 1, seg = Math.floor((u + off) * 2), id = row * 7 + seg * 3;
    const edge = (v * FR) % 1 < 0.035 || ((u + off) * 2) % 1 < 0.006 ? 0.45 : 1;
    const h = G.hash1(id * 1.93 + 0.4), warm = 0.94 + G.hash1(id * 2.71) * 0.1;
    const grain = G.pfbm(u * 6 + h * 9, v * FR * 6, [6, FR * 6], 3) * 0.22 + G.pfbm(u * 40, v * FR * 14, [40, FR * 14], 2) * 0.07;
    const t = (0.66 + h * 0.3 + grain) * edge;
    return [150 * t * warm, 112 * t, 84 * t / warm];   // a greyer brown than the pine, so the warm light doesn't turn it to rust
  });
  TX.floorB = canvasTex(256, (u, v) => { const row = Math.floor(v * FR), off = G.hash1(row * 3.7) % 1; const e = (v * FR) % 1 < 0.035 || ((u + off) * 2) % 1 < 0.006; const g = e ? 40 : 160 + G.fbm(u * 40, v * 300, 2) * 30; return [g, g, g]; }, { srgb: false });
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
  // Fieldstone (the chimney): rounded stones of every size and colour, grey and brown and bluish, laid in thick
  // recessed mortar. Seamless, one tile to 1.2 m, six stones across it and eight up, each its own shape. TX.fieldB is
  // its height, for the bump map: each stone domed, the mortar sunk between them.
  {
    const NX = 6, NY = 8, pts = [], cache = [];
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) pts.push([(i + 0.5 + (G.hash1(i * 17.3 + j * 5.1 + 0.3) - 0.5) * 0.75) / NX, (j + 0.5 + (G.hash1(i * 3.9 + j * 11.7 + 2.1) - 0.5) * 0.7) / NY, G.hash1(i * 7.7 + j * 1.3 + 4.4)]);
    const near = (u, v) => {   // the nearest two stone centres (wrapping round the tile), and the nearest one's id
      let b = 9, s2 = 9, id = 0; const ci = Math.floor(u * NX), cj = Math.floor(v * NY);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const I = ci + di, J = cj + dj, p = pts[(((J % NY) + NY) % NY) * NX + (((I % NX) + NX) % NX)];
        const d = Math.hypot((u - p[0] - Math.floor(I / NX)) * NX, (v - p[1] - Math.floor(J / NY)) * NY * 0.8);
        if (d < b) { s2 = b; b = d; id = p[2]; } else if (d < s2) s2 = d;
      }
      return [b, s2, id];
    };
    const PAL = [[150, 144, 134], [164, 152, 134], [138, 122, 104], [128, 130, 132], [176, 168, 154], [146, 126, 104], [118, 114, 108], [156, 150, 142]];
    TX.field = canvasTex(512, (u, v, x, y) => {
      const [b, s2, id] = near(u, v), e = s2 - b, mw = 0.1 + 0.05 * G.fbm(u * 30, v * 30, 2);
      const h = G.smooth(mw, mw + 0.32, e), sp = G.fbm(u * 60 + id * 9, v * 60, 2);
      cache.push(e < mw ? -1 : h);
      if (e < mw) { const k = 0.4 + 0.1 * sp + 0.14 * (1 - e / mw); return [128 * k, 122 * k, 112 * k]; }   // deep joints, in shadow
      const c = PAL[Math.floor(id * PAL.length)], k = (0.74 + 0.26 * h) * (0.9 + 0.2 * sp);
      const lich = G.smooth(0.45, 0.6, G.fbm(u * 14 + id * 3, v * 14, 3)) * (id > 0.7 ? 0.35 : 0);   // a little pale lichen on some
      return [c[0] * k * (1 - lich) + 170 * lich, c[1] * k * (1 - lich) + 172 * lich, c[2] * k * (1 - lich) + 140 * lich];
    });
    let n = 0;
    TX.fieldB = canvasTex(512, (u, v) => { const h = cache[n++]; const g = h < 0 ? 40 : 95 + 150 * h + G.fbm(u * 80, v * 80, 2) * 12; return [g, g, g]; }, { srgb: false });
    // The same stones indoors, out of the weather: no lichen, the colours deeper, and the joints pointed in pale lime
    // mortar (their depth shows in the relief there, not painted dark).
    const PALI = [[136, 130, 121], [150, 138, 120], [122, 109, 95], [116, 118, 120], [160, 151, 136], [134, 115, 95], [108, 104, 99], [143, 137, 128]];
    TX.fieldIn = canvasTex(512, (u, v, x, y) => {
      const [b, s2, id] = near(u, v), e = s2 - b, mw = 0.1 + 0.05 * G.fbm(u * 30, v * 30, 2), sp = G.fbm(u * 60 + id * 9, v * 60, 2);
      if (e < mw) { const k = 0.74 + 0.12 * sp + 0.1 * G.fbm(u * 140, v * 140, 2); return [158 * k, 151 * k, 140 * k]; }
      const h = G.smooth(mw, mw + 0.32, e), c = PALI[Math.floor(id * PALI.length)], k = (0.8 + 0.2 * h) * (0.88 + 0.24 * sp) * (G.hash1(x * 1.7 + y * 9.1) > 0.985 ? 1.18 : 1);
      return [c[0] * k, c[1] * k, c[2] * k];
    });
    // ...and the height itself, softened a little, for the chimney breast indoors, whose stones stand out in relief: G.fieldH(u, v)
    // at texture coordinates, 0 deep in a joint to 1 on the crown of a stone
    const w = TX.field.image.width, h = TX.field.image.height, a = new Float32Array(w * h), b = new Float32Array(w * h), R = Math.max(1, Math.round((2 * w) / 512));
    for (let i = 0; i < w * h; i++) a[i] = cache[i] < 0 ? 0 : 0.3 + 0.7 * G.smooth(0, 0.45, cache[i]);   // the faces flattish, rounding over at the edges
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = -R; k <= R; k++) s += a[y * w + ((x + k + w) % w)]; b[y * w + x] = s / (2 * R + 1); }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = -R; k <= R; k++) s += b[((y + k + h) % h) * w + x]; a[y * w + x] = s / (2 * R + 1); }
    const at = (x, y) => a[(((y % h) + h) % h) * w + (((x % w) + w) % w)];
    G.fieldH = (U, V) => {   // bilinear; v runs up, as the texture is flipped
      const px = (((U % 1) + 1) % 1) * w - 0.5, py = (1 - (((V % 1) + 1) % 1)) * h - 0.5, x0 = Math.floor(px), y0 = Math.floor(py), tx = px - x0, ty = py - y0;
      return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
    };
  }
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
  // A quilted cotton duvet: four puffed squares to a tile, each fullest in the middle and drawn in at the stitched
  // seams, with a fine cotton weave over it. (The bed was covered in the cable knit, whose ribs read from above as
  // rows of eggs.) Seamless: everything here repeats on the tile.
  const QN = 4;
  const quiltH = (u, v) => { const fx = (u * QN) % 1, fy = (v * QN) % 1, ex = Math.min(fx, 1 - fx) * 2, ey = Math.min(fy, 1 - fy) * 2;
    const e = Math.min(ex, ey); return Math.sqrt(Math.max(0, Math.min(1, e / 0.9))) * (0.75 + 0.25 * Math.min(1, Math.max(ex, ey))); };
  TX.quilt = canvasTex(512, (u, v, x, y) => {
    const h = quiltH(u, v), fx = (u * QN) % 1, fy = (v * QN) % 1;
    const seam = Math.min(Math.min(fx, 1 - fx), Math.min(fy, 1 - fy)) < 0.006 ? 0.86 : 1;
    const weave = 1 + ((x + y) % 2 ? 0.012 : -0.012) + G.pfbm(u * 64, v * 64, [64, 64], 2) * 0.03;
    const t = (0.84 + h * 0.16) * seam * weave;
    return [238 * t, 230 * t, 216 * t];
  });
  TX.quiltB = canvasTex(256, (u, v) => { const g = 40 + quiltH(u, v) * 200; return [g, g, g]; }, { srgb: false });
  TX.knitDark = knit([70, 66, 64], false);
  TX.knitB = canvasTex(256, (u, v) => { const g = 90 + Math.abs(Math.sin(u * 16 * Math.PI)) * 80 + Math.abs(Math.sin(v * 32 * Math.PI)) * 60; return [g, g, g]; }, { srgb: false });
  // Jersey (hoodie).
  TX.jersey = canvasTex(256, (u, v) => { const t = 0.9 + G.fbm(u * 60, v * 60, 2) * 0.08 + Math.sin(v * 400) * 0.015; return [255 * t, 255 * t, 255 * t]; });
  TX.jerseyB = canvasTex(128, (u, v) => { const g = 128 + G.fbm(u * 50, v * 50, 2) * 60; return [g, g, g]; }, { srgb: false });
  // His hoodie: charcoal-black cotton jersey, heathered. One tile is 7.5 cm of hoodie (the model's UVs), the knit's
  // columns running down it: 40 columns of V-shaped stitches, each leg of each stitch a yarn of its own shade, mostly
  // near-black with a few lighter fibres through it, as a black cotton-mix is when you look closely. It reflects about
  // as much as real black cotton; the model's own texture was a hundredth of white, which no cloth is, so the hoodie
  // was a flat black cut-out in any light.
  {
    const NC = 40, NR = 56, H = (a, b, c) => G.hash1(a * 12.9898 + b * 78.233 + c * 37.719);
    const knit = (u, v) => {   // -> [yarn height 0..1, yarn id] for this point of the tile
      const cx = u * NC, cy = v * NR, ix = Math.floor(cx), iy = Math.floor(cy), fx = cx - ix, fy = cy - iy;
      const left = fx < 0.5, d = left ? Math.abs(fx - (0.08 + fy * 0.36)) : Math.abs(fx - (0.92 - fy * 0.36));
      const h = Math.max(0, 1 - d / 0.24); return [h * h * (3 - 2 * h) * (0.8 + 0.2 * Math.sin(fy * Math.PI)), ix * 3 + (left ? 0 : 1), iy];
    };
    TX.hoodKnit = canvasTex(256, (u, v) => {
      const [h, yi, yr] = knit(u, v), r = H(yi % (NC * 3), yr % NR, 1), r2 = H(yi % (NC * 3), yr % NR, 2);
      let l = 0.26 + (r - 0.5) * 0.05;                      // the black yarn, each a shade of its own (sRGB 0..1)
      if (r2 > 0.84) l += 0.1 + (r2 - 0.84) * 0.6;           // a lighter fibre through it
      l *= 0.7 + 0.4 * h;                                     // the yarn's crown catches more than the gap between
      const c = 255 * l; return [c, c * 1.01, c * 1.05];
    });
    TX.hoodKnitB = canvasTex(256, (u, v) => { const g = 60 + knit(u, v)[0] * 150; return [g, g, g]; }, { srgb: false });
    // the cuffs, hem and collar: 1x1 rib, a raised column then a sunken one, 24 pairs to the tile
    TX.hoodRibB = canvasTex(128, (u, v) => { const c = 0.5 + 0.5 * Math.cos(u * 24 * 2 * Math.PI), k = knit(u, v)[0]; const g = 40 + c * 150 + k * 45; return [g, g, g]; }, { srgb: false });
  }
  // Firebrick, blackened with years of fires: one tile is 48 x 45 cm, six courses of two bricks, each brick its own
  // shade of burnt red-brown, some nearly black with soot, the mortar dark.
  TX.firebrick = canvasTex(256, (u, v, x, y) => {
    const row = Math.floor(v * 6), fy = v * 6 - row, off = row % 2 ? 0.5 : 0, bu = u * 2 + off, col = Math.floor(bu), fx = bu - col;
    const mortar = Math.min(fx, 1 - fx) < 0.025 || Math.min(fy, 1 - fy) < 0.07;
    const h = G.hash1((col % 2) * 7.1 + row * 3.3 + 0.5), soot = G.hash1(col * 1.7 + row * 9.1 + 2.0);
    const k = (0.75 + G.fbm(u * 40, v * 40, 2) * 0.25) * (soot > 0.7 ? 0.45 : 1);
    if (mortar) return [38, 33, 30];
    return [(104 + h * 44) * k, (54 + h * 20) * k, (40 + h * 12) * k];
  });
  // Wood ash: pale grey, soft and uneven, with flecks of charcoal.
  TX.ash = canvasTex(128, (u, v, x, y) => { const g = 0.55 + G.fbm(u * 18, v * 18, 3) * 0.25 - (G.hash1(x * 3.1 + y * 7.7) > 0.93 ? 0.35 : 0); const c = 255 * Math.max(0.08, g); return [c, c * 0.97, c * 0.93]; });
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
  // Spruce branch: each face of a branch slab is one tile across (u) and its length (v). The middle is solid; toward
  // both side edges and the tip it breaks into needles raked toward the tip, so a branch's outline is a fringe of
  // needles and not a cut edge of card. The colour is a fine streak of needles in light and dark.
  TX.needles = canvasTex(0, (u, v, x, y) => {
    const e = Math.min(u, 1 - u) * 2;   // 0 at the side edges, 1 down the middle
    const tip = 1 - v;                  // 0 at the far end of the branch
    const cell = Math.floor(v * 46 + e * 7), h = G.hash1(cell * 1.91 + (u < 0.5 ? 0 : 77)), saw = (v * 46 + e * 7) % 1;
    const reach = 0.32 + h * 0.28;     // how far in from the edge this tuft's gaps run
    let a = e > reach * (1 - saw * 0.85) ? 255 : 0;
    if (tip < 0.12 && e < 0.9 * (1 - (tip / 0.12)) + (saw * 0.3)) a = 0;
    if (e > 0.75) a = 255;
    const nd = Math.max(0, 1 - e * 1.2);   // needle streaks toward the edges; the middle (where snow lies) stays even
    const st = 0.9 + (Math.sin((u * 9 + v * 60) * Math.PI) * 0.07 + (G.hash1(x * 3.7 + y * 11.3) - 0.5) * 0.16) * nd - nd * 0.08;
    const g = Math.max(0, Math.min(255, 255 * st)); return [g, g, g, a];
  }, { w: 64, h: 256 });
  // A near spruce's bough, as one card seen from above (u across it, v from the trunk end, 0, to the tip, 1): a stem
  // down the middle with side shoots leaving it every few centimetres, raked forward and curving toward the tip, each
  // a bottle-brush of needles, with sky showing between them toward the edges. Raw data, not a canvas (a canvas
  // premultiplies, and would lose the other channels wherever the needles are not): R the needles' brightness (each
  // shoot lit along its crest, darker at its sides, each needle its own shade), G the paler new growth at the shoot
  // tips, B how readily snow settles there (along the stem and the inner halves of the shoots, filling the gaps between
  // them there, none out at the tips), A the needles.
  TX.frond = (() => {
    const W = 256, H = 512, D = new Uint8Array(W * H * 4), h1 = G.hash1;
    const HW = 0.375, taper = (Y) => 1 - 0.4 * Y;   // the card's half-width at the base, in bough lengths, and its taper
    const env = (Y) => (Y < 0.26 ? 0.6 + 0.4 * Math.sin((Y / 0.26) * Math.PI / 2) : Math.max(0.08, 1 - 0.92 * Math.pow((Y - 0.26) / 0.74, 1.3))) * HW * taper(Y) * 0.94;
    const SA = Math.sin(0.95), CA = Math.cos(0.95), SP = 0.046, NS = 0.0072;
    const shoots = [[], []];
    for (let s = 0; s < 2; s++) for (let k = 0; ; k++) {
      const y0 = 0.025 + k * SP + s * SP * 0.5 + (h1(k * 3.1 + s * 17) - 0.5) * SP * 0.4;
      if (y0 > 0.93) break;
      // each shoot its own angle, curve and length (a few stunted), so they don't line up like a fern's
      const an = 0.95 + (h1(k * 9.1 + s * 5.9) - 0.5) * 0.32, sa = Math.sin(an), ca = Math.cos(an);
      const len = (env(Math.min(1, y0 + 0.07)) / sa) * (0.72 + h1(k * 5.7 + s * 3.3) * 0.4) * (h1(k * 2.3 + s * 8.1) < 0.1 ? 0.55 : 1);
      shoots[s].push({ y0, len, sa, ca, bend: 0.25 + h1(k * 4.4 + s * 1.7) * 0.4, r: 0.016 + len * 0.068, seed: k * 13.7 + s * 101 });
    }
    // needles raked forward along a shoot: (along, across) from its base -> covered?, and how it is lit
    const brush = (al, pe, len, r, seed) => {
      const t = al / len;
      if (t < 0 || t > 1.1) return null;
      const rr = r * (1 - 0.4 * Math.min(t, 1)) * (t > 1 ? 1 - (t - 1) / 0.1 : 1);
      const ap = Math.abs(pe), q = (al - ap * 0.9) / NS, n = Math.floor(q), f = q - n;
      if (ap > rr * (0.7 + h1(n * 7.31 + seed) * 0.5)) return null;
      if (ap > rr * 0.42 && f > 0.6) return null;
      return { sh: 0.6 + 0.42 * (1 - Math.min(1, ap / rr)) + (h1(n * 3.7 + seed * 1.3) - 0.5) * 0.2, tip: Math.max(0, Math.min(1, (t - 0.66) / 0.3)), d: ap / rr };
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W, Y = (y + 0.5) / H, s = u < 0.5 ? 0 : 1, X = Math.abs(u - 0.5) * 2 * HW * taper(Y);
      let best = brush(Y + 0.3, X, 1.3, 0.024 * (1 - 0.5 * Y) + 0.012, 7 + s), snow = Math.max(0, 1 - X / (0.065 + 0.05 * (1 - Y)));
      const L = shoots[s], k0 = Math.round((Y - X * (CA / SA) - 0.025 - s * SP * 0.5) / SP);
      for (let k = k0 - 2; k <= k0 + 2; k++) {
        const sh = L[k]; if (!sh) continue;
        const dy = Y - sh.y0, al = X * sh.sa + dy * sh.ca, pe = -X * sh.ca + dy * sh.sa - sh.bend * al * al;
        const b = brush(al, pe, sh.len, sh.r, sh.seed);
        if (b && (!best || b.d < best.d)) best = b;
        if (al > 0 && al < sh.len) snow = Math.max(snow, 0.85 * (1 - al / sh.len) * Math.max(0, 1 - Math.abs(pe) / (sh.r * 2.6)));
      }
      snow = Math.max(snow, 0.5 * Math.max(0, 1 - X / env(Y))) * (1 - 0.35 * Y);
      const i = (y * W + x) * 4;
      D[i] = best ? Math.round(255 * Math.sqrt(Math.min(1, best.sh / 1.2))) : 170;   // (the gaps: what the inner cones show)
      D[i + 1] = best ? Math.round(255 * best.tip) : 0;
      D[i + 2] = Math.round(255 * Math.min(1, snow));
      D[i + 3] = best ? 255 : 0;
    }
    const t = new THREE.DataTexture(D, W, H, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.anisotropy = G.renderer.capabilities.getMaxAnisotropy();
    t.needsUpdate = true;
    return t;
  })();
  // Distant spruces: each tier's lower edge hangs in ragged tufts instead of a clean cone rim (u: one face of the
  // cone, three tufts to it; v: 0 at the rim, 1 at the tip).
  TX.skirt = canvasTex(0, (u, v, x) => {
    const f = (u * 3) % 1, cell = Math.floor(u * 3), h = G.hash1(cell * 2.3 + 0.7);
    const tooth = 1 - Math.abs(2 * f - 1);
    const cut = 0.34 * (1 - tooth) * (0.6 + h * 0.8) + (G.hash1(x * 5.1) - 0.5) * 0.05;
    const a = v > cut ? 255 : 0;
    const g = 255 * (0.8 + Math.min(1, v * 2.5) * 0.2);
    return [g, g, g, a];
  }, { w: 64, h: 64 });
  TX.skirt.wrapT = THREE.ClampToEdgeWrapping;
  // The frozen lake, once across (the disc's own UVs): dark clear ice, cloudier in places, with wind-swept streaks of
  // snow lying on it, thicker toward the shore, a few long white cracks and trapped bubbles. Its alpha channel
  // carries the snow cover (for the roughness map and the bump). It was one pale, glossy blue-white sheet that read
  // as more snow.
  {
    // the soft noise painted at half size and scaled up (a quarter of the work at boot); cracks and bubbles at full size
    const S = Math.round(1024 * G.TEX_SCALE), cv = document.createElement('canvas'); cv.width = cv.height = S;
    const c = cv.getContext('2d');
    const F = S >> 1, half = document.createElement('canvas'); half.width = half.height = F;
    const hc = half.getContext('2d'), img = hc.createImageData(F, F), snowH = new Float32Array(F * F), d = img.data;
    const iceA = [34, 58, 70], iceB = [88, 122, 136], sn = [228, 234, 242];
    for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) {
      const u = x / F, v = y / F, r = Math.hypot(u - 0.5, v - 0.5) * 2;
      const cloud = 0.5 + 0.5 * G.fbm(u * 5 + 3, v * 5, 4);
      const streak = G.fbm(u * 2.5 + 11, v * 11, 4) * 0.8 + G.fbm(u * 9, v * 30, 2) * 0.25;
      let k = G.smooth(0.08, 0.34, streak + G.smooth(0.62, 1.0, r) * 0.75 - 0.05);
      k = Math.max(k, G.smooth(0.93, 1.0, r));
      snowH[y * F + x] = k;
      const ice = iceA.map((a, j) => a + (iceB[j] - a) * cloud);
      const i = (y * F + x) * 4;
      for (let j = 0; j < 3; j++) d[i + j] = ice[j] + (sn[j] - ice[j]) * k;
      d[i + 3] = 255;
    }
    hc.putImageData(img, 0, 0);
    c.imageSmoothingEnabled = true; c.drawImage(half, 0, 0, S, S);
    const snow = { at: (i) => snowH[Math.min(F - 1, Math.floor((i / S) / 2)) * F + Math.min(F - 1, Math.floor((i % S) / 2))] };
    // cracks: long wandering lines with short branches, pale where they run through clear ice
    const rr = G.seeded(77);
    c.lineCap = 'round';
    for (let n = 0; n < 9; n++) {
      let a = rr() * Math.PI * 2, px = S * (0.5 + Math.cos(a) * rr() * 0.3), py = S * (0.5 + Math.sin(a) * rr() * 0.3);
      let dir = rr() * Math.PI * 2; const len = 30 + rr() * 50;
      c.strokeStyle = 'rgba(214,232,240,0.55)'; c.lineWidth = Math.max(1, S / 700);
      c.beginPath(); c.moveTo(px, py);
      for (let k = 0; k < len; k++) {
        dir += (rr() - 0.5) * 0.7; px += Math.cos(dir) * S / 160; py += Math.sin(dir) * S / 160; c.lineTo(px, py);
        if (rr() < 0.08) { c.stroke(); c.beginPath(); c.moveTo(px, py); const bd = dir + (rr() < 0.5 ? 1 : -1) * (0.6 + rr()); let bx = px, by = py; c.save(); c.globalAlpha = 0.6; for (let q = 0; q < 6; q++) { bx += Math.cos(bd) * S / 200; by += Math.sin(bd) * S / 200; c.lineTo(bx, by); } c.stroke(); c.restore(); c.beginPath(); c.moveTo(px, py); }
      }
      c.stroke();
    }
    // bubbles frozen in the clear ice
    for (let n = 0; n < 900; n++) { const bx = rr() * S, by = rr() * S; if (snow.at(Math.floor(by) * S + Math.floor(bx)) > 0.3) continue; c.fillStyle = 'rgba(220,236,244,' + (0.25 + rr() * 0.35) + ')'; c.beginPath(); c.arc(bx, by, S / 1400 + rr() * S / 1200, 0, Math.PI * 2); c.fill(); }
    TX.ice = new THREE.CanvasTexture(cv); TX.ice.encoding = THREE.sRGBEncoding; TX.ice.anisotropy = G.renderer.capabilities.getMaxAnisotropy();
    // roughness (green channel, as three reads it) and bump from the snow cover
    const cr = document.createElement('canvas'); cr.width = cr.height = F; const c2 = cr.getContext('2d'), im2 = c2.createImageData(F, F), d2 = im2.data;
    for (let i = 0; i < F * F; i++) { const g = 30 + snowH[i] * 225; d2[i * 4] = d2[i * 4 + 1] = d2[i * 4 + 2] = g; d2[i * 4 + 3] = 255; }
    c2.putImageData(im2, 0, 0); TX.iceR = new THREE.CanvasTexture(cr);
  }
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
    boards: std({ map: TX.wallBoards, bumpMap: TX.wallBoardsB, bumpScale: 0.004, color: '#f4e9dd', roughness: 0.72, env: 0.24 }),   // golden pine
    ceiling: std({ map: TX.ceilWash, bumpMap: TX.wallBoardsB, bumpScale: 0.003, color: '#ffffff', roughness: 0.85, env: 0.3 }),   // limewashed boards
    paintedBoards: std({ map: TX.paintBoards, bumpMap: TX.wallBoardsB, bumpScale: 0.004, color: '#7f97a6', roughness: 0.62, env: 0.3 }),   // the bedroom wall, dusty blue
    logs: std({ map: TX.logs, bumpMap: TX.logsB, bumpScale: 0.006, roughness: 0.85, env: 0.4 }),
    floor: std({ map: TX.floor, bumpMap: TX.floorB, bumpScale: 0.003, color: '#f2e6dc', roughness: 0.46, env: 0.45 }),
    shingle: std({ map: TX.shingle, roughness: 0.9 }),
    stone: std({ map: TX.stone, bumpMap: TX.stone, bumpScale: 0.02, roughness: 0.9, env: 0.3 }),
    beam: std({ map: TX.bark, color: '#7a5a42', roughness: 0.8 }),
    trim: std({ color: '#5e4330', roughness: 0.7 }),
    darkWood: std({ map: TX.boards, color: '#6a4a36', roughness: 0.55, env: 0.35 }),
    wood: std({ map: TX.boards, color: '#b88a62', roughness: 0.55, env: 0.35 }),
    snow: std({ color: '#e6ecf3', roughness: 0.75, env: 0.7 }),   // just short of paper-white, so it can be shaded rather than clip
    snowGround: std({ color: '#dfe6ef', roughness: 1, roughnessMap: G.rep(TX.snowR, 26, 26), bumpMap: G.rep(TX.snowB, 7, 7), bumpScale: 0.09, env: 0.6 }),
    ice: std({ map: TX.ice, roughnessMap: TX.iceR, bumpMap: TX.iceR, bumpScale: 0.02, roughness: 1, metalness: 0.0, env: 0.85 }),   // clear ice reflects the sky; the snow on it doesn't
    bark: std({ map: TX.bark, roughness: 1 }),
    metal: std({ color: '#b89b6a', roughness: 0.3, metalness: 1, env: 1 }),
    darkMetal: std({ color: '#2b2724', roughness: 0.45, metalness: 0.85, env: 0.9 }),
    ceramic: std({ color: '#f1ede4', roughness: 0.25, env: 0.9 }),
    plaid: std({ map: TX.plaid, bumpMap: TX.fabricB, bumpScale: 0.003, roughness: 1 }),
    knitCream: std({ map: TX.knitCream, bumpMap: TX.knitB, bumpScale: 0.006, roughness: 1 }),
    quilt: std({ map: TX.quilt, bumpMap: TX.quiltB, bumpScale: 0.02, roughness: 0.95, env: 0.3 }),
    linen: std({ map: TX.linen, bumpMap: TX.fabricB, bumpScale: 0.001, roughness: 1 }),
    rug: std({ map: TX.rug, bumpMap: TX.fabricB, bumpScale: 0.004, roughness: 1 }),
    sofa: std({ map: TX.jersey, color: '#5f6a4e', bumpMap: TX.fabricB, bumpScale: 0.002, roughness: 1, env: 0.35 }),   // moss green, with the rust armchair and the red plaid (the old near-black brown swallowed the light)
    glassOut: std({ color: '#ffb46a', emissive: '#ff9a40', emissiveIntensity: 0.55, roughness: 0.05, transparent: true, opacity: 0.32, env: 1.2, depthWrite: false }),
    glassIn: std({ color: '#203050', roughness: 0.02, transparent: true, opacity: 0.18, env: 1.4, depthWrite: false }),
    bulb: new THREE.MeshBasicMaterial({ color: '#ffcf86' }),
    flameGlow: new THREE.MeshBasicMaterial({ color: '#ffd59a' }),
    leaf: std({ color: '#4b6f3f', roughness: 0.65, side: THREE.DoubleSide }),
    pot: std({ color: '#a86040', roughness: 0.85 }),
    candle: std({ color: '#f2e8d6', roughness: 0.6, emissive: '#ffb060', emissiveIntensity: 0.06 }),
  });
  MAT.glassOut.side = THREE.FrontSide; MAT.glassIn.side = THREE.FrontSide;
  // Snow sparkles: here and there in the snow a flat ice crystal, tilted its own way, flashes as it catches the sun
  // (or a lantern at night) and goes out again as you move. Only where the light falls, not in shadow, and only near
  // enough to see: further off they would just be noise.
  MAT.snowGround.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vSnW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvSnW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    sh.fragmentShader = `varying vec3 vSnW;
float snH( vec3 p ) { p = fract( p * vec3( 0.1031, 0.1030, 0.0973 ) ); p += dot( p, p.yxz + 33.33 ); return fract( ( p.x + p.y ) * p.z ); }
vec3 snGlint( vec3 N, vec3 V, vec3 L ) {
	float fade = 1.0 - smoothstep( 6.0, 20.0, length( vSnW - cameraPosition ) );
	if ( fade <= 0.0 ) return vec3( 0.0 );
	vec3 c = floor( vSnW * 34.0 );
	if ( snH( c ) > 0.3 ) return vec3( 0.0 );
	vec3 r = vec3( snH( c + 1.7 ), snH( c + 4.3 ), snH( c + 9.1 ) ) * 2.0 - 1.0;
	vec3 fN = normalize( N + mat3( viewMatrix ) * r * 0.85 );
	return vec3( 1.0, 0.98, 0.95 ) * pow( max( dot( fN, normalize( L + V ) ), 0.0 ), 260.0 ) * 10.0 * fade;
}
` + sh.fragmentShader.replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace(
      'reflectedLight.directDiffuse += ( 1.0 - clearcoatDHR ) * irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );',
      'reflectedLight.directDiffuse += ( 1.0 - clearcoatDHR ) * irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );\n\treflectedLight.directSpecular += irradiance * snGlint( geometry.normal, geometry.viewDir, directLight.direction );'));
  };
  MAT.snowGround.customProgramCacheKey = () => 'snow-glint';
  // A lit window seen from outside is not one even sheet of cream: the room's light is strongest low in the middle
  // (the lamps, the fire) and falls off toward the frame, deepening to amber at the edges.
  MAT.glassOut.emissive.set('#ff8c34');
  // Shared by both faces of the window glass: the pane's size and seed, noise, and the frost on it.
  const GW_VERT = 'attribute vec3 gsz;\nvarying vec2 vGU;\nvarying vec3 vGS;\n';
  const GW_HEAD = `varying vec2 vGU; varying vec3 vGS;
float gwH( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float gwN( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( gwH( i ), gwH( i + vec2( 1.0, 0.0 ) ), f.x ), mix( gwH( i + vec2( 0.0, 1.0 ) ), gwH( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }
// The pane's seed, a whole number: hashing a varying that is only nearly constant would flicker pixel to pixel.
float gwSeed() { return floor( vGS.z + 0.5 ); }
float gwFrost( out vec2 gid ) {
	// Where on the glass: metres across the window, which of the four panes, how far to that pane's edges.
	vec2 gp = vGU * vGS.xy, gm = vec2( 0.5, 0.55 ) * vGS.xy; gid = step( gm, gp );
	vec2 glo = mix( vec2( 0.0 ), gm + 0.0225, gid ), ghi = mix( gm - 0.0225, vGS.xy, gid );
	float gdx = min( gp.x - glo.x, ghi.x - gp.x ) * 1.3, gdy = min( ( gp.y - glo.y ) * 0.5, ( ghi.y - gp.y ) * 4.0 );
	// Frost: thickest in the bottom corners, a ragged feathery fringe along the edges, clear in the middle.
	float gfd = 1.0 / ( 1.0 / max( gdx, 1e-3 ) + 1.0 / max( gdy, 1e-3 ) );
	float gsd = gwSeed();
	float gfn = gwN( gp * 11.0 + gsd * 0.37 ) * 0.6 + gwN( gp * 27.0 - gsd * 0.53 ) * 0.4;
	float gband = 0.012 + 0.05 * gfn * gfn;
	// Crystals in long feathery streaks, fanning out of the corners on the diagonals.
	vec2 gq = gp - glo - ( ghi - glo ) * 0.5;
	float gcr = gwN( vec2( gp.x * 46.0 + sign( gq.x * gq.y ) * gp.y * 30.0, gp.y * 9.0 - gp.x * 6.0 ) );
	float gfa = smoothstep( gband, gband * 0.15, gfd ) * ( 0.3 + 0.7 * pow( gcr, 1.4 ) ) + smoothstep( gband * 0.45, 0.0, gfd ) * 0.4;
	return clamp( gfa, 0.0, 1.0 ) * 0.82;
}`;
  // By day the room behind a window is far darker than the snow outside, so the glass reads by what it reflects. Each
  // window keeps a small cube map of the world as seen from just outside it (world.js: the sky, the forest across the
  // clearing, the porch posts, the snow), so a pane shows what is really in front of it; until that is drawn it falls
  // back on a sketch of the same (sky, a ring of spruces round the clearing, snow). Old hand-made panes each sit at
  // their own slight tilt and ripple a little, so the reflection wavers and breaks from pane to pane, and frost has
  // crept in from the corners. It is composited as glass is: the reflection added on top and the room behind dimmed
  // (not a milky sheet laid over it). The reflection is added after tone mapping, as the cube map already was.
  const GU = { uGDay: { value: 0 } };
  G.GLASS_OUT = [];
  G.glassOutSetup = (m) => {
    const U = (m.userData.U = { uGDay: GU.uGDay, uGCube: { value: null }, uGHave: { value: 0 } });
    m.blending = THREE.CustomBlending; m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor;
    m.extensions = { derivatives: true };
    m.customProgramCacheKey = () => 'glassOut-glow-cube';
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.uniforms.uGSun = { value: G.SUN_DAY.clone().normalize() };
      sh.uniforms.uGClr = { value: new THREE.Vector3(G.CLEAR.x, G.CLEAR.z, G.CLEAR.r) };
      sh.vertexShader = GW_VERT + 'varying vec3 vGW;\nvarying vec3 vGN;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
	vGU = uv; vGS = gsz; vGW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz; vGN = normalize( mat3( modelMatrix ) * objectNormal );`);
      sh.fragmentShader = `uniform float uGDay; uniform vec3 uGSun; uniform vec3 uGClr; uniform samplerCube uGCube; uniform float uGHave;
varying vec3 vGW; varying vec3 vGN;
${GW_HEAD}
// The forest's silhouette height (m) at arc position s round the clearing's edge: a row of spruce cones.
float gwTrees( float s, float row ) {
	float hgt = 0.0, sp = 3.4, q = s / sp + row * 0.5;
	for ( int k = -1; k <= 1; k++ ) {
		float cell = floor( q ) + float( k ), r1 = gwH( vec2( cell, row ) ), r2 = gwH( vec2( cell, row + 7.0 ) );
		float cx = ( cell + 0.5 + ( r1 - 0.5 ) * 0.7 ) * sp, ht = 10.0 + 8.0 * r2 + row * 2.5;
		hgt = max( hgt, ht - abs( s - cx ) * ht / 2.3 );
	}
	return hgt;
}
\n` + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	{
		vec2 gd = abs( vGU - 0.5 ) * 2.0; float edge = max( gd.x, gd.y * 1.1 );
		float k = smoothstep( 0.3, 1.0, edge );
		totalEmissiveRadiance *= mix( 1.25, 0.4, k ) * ( 0.8 + 0.35 * ( 1.0 - vGU.y ) );
		totalEmissiveRadiance *= mix( vec3( 1.0, 0.96, 0.9 ), vec3( 1.0, 0.62, 0.32 ), k );
	}`).replace('#include <tonemapping_fragment>', `
	vec2 gid; float gfa = gwFrost( gid ); vec2 gp = vGU * vGS.xy;
	// By night (and at dusk) the frost catches the lamplight from inside, a brighter amber than the clear glass.
	gl_FragColor = vec4( mix( gl_FragColor.rgb, gl_FragColor.rgb * 0.75 + totalEmissiveRadiance * 0.25, gfa * 0.8 ), mix( gl_FragColor.a, 0.9, gfa * 0.8 ) );
	#include <tonemapping_fragment>
	{
		// Each pane at its own slight tilt, with the horizontal waves of drawn glass.
		vec3 gN0 = normalize( vGN ), gT = normalize( cross( vec3( 0.0, 1.0, 0.0 ), gN0 ) );
		float gs = gwSeed() + gid.x * 3.0 + gid.y * 5.0;
		float gtx = ( gwH( vec2( gs, 1.0 ) ) - 0.5 ) * 0.03 + ( gwN( vec2( gp.x * 2.5, gp.y * 5.5 ) + gs ) - 0.5 ) * 0.03;
		float gty = ( gwH( vec2( gs, 2.0 ) ) - 0.5 ) * 0.03 + ( gwN( vec2( gp.x * 2.0 + 7.0, gp.y * 6.5 ) + gs ) - 0.5 ) * 0.04;
		vec3 gNw = normalize( gN0 + gT * gtx + vec3( 0.0, gty, 0.0 ) );
		vec3 gV = normalize( vGW - cameraPosition ), gR = reflect( gV, gNw );
		gR = normalize( gR + gN0 * max( 0.0, -dot( gR, gN0 ) ) );
		vec3 grefl = vec3( 0.0 );
		if ( uGHave < 0.999 ) {
			// The sketch: what the reflected ray meets, the clearing's forest edge, the snow before it, or the sky.
			vec2 go = vGW.xz - uGClr.xy, gdir = normalize( gR.xz + vec2( 1e-5 ) );
			float gaz = atan( gdir.y, gdir.x ), grr = uGClr.z + 2.0 + 5.0 * gwN( vec2( gaz * 2.5, 3.0 ) );
			float gb = dot( go, gdir ), gc = dot( go, go ) - grr * grr, gt = -gb + sqrt( max( gb * gb - gc, 0.0 ) );
			vec2 ghit = go + gdir * gt; float garc = atan( ghit.y, ghit.x ) * grr;
			float gtan = gR.y / max( length( gR.xz ), 1e-3 );
			float gtree = ( gwTrees( garc, 0.0 ) - vGW.y ) / gt, gfoot = -vGW.y / gt;
			float gaa = fwidth( gtan ) * 1.2 + 1e-4;
			vec3 gsky = mix( vec3( 0.68, 0.74, 0.82 ), vec3( 0.24, 0.36, 0.6 ), smoothstep( 0.05, 0.75, gR.y ) );
			vec3 gtrees = mix( vec3( 0.035, 0.045, 0.05 ), vec3( 0.08, 0.095, 0.11 ), smoothstep( 20.0, 60.0, gt ) * 0.6 );
			vec3 gsk = mix( gsky, gtrees, smoothstep( gtree + gaa, gtree - gaa, gtan ) );
			gsk = mix( gsk, vec3( 0.5, 0.54, 0.6 ), smoothstep( gfoot + gaa, gfoot - gaa, gtan ) );
			grefl = gsk * ( 1.0 - uGHave );
		}
		if ( uGHave > 0.001 ) grefl += textureCube( uGCube, gR, 1.25 ).rgb * uGHave;   // a touch soft, as through old glass
		grefl += vec3( 1.0, 0.97, 0.9 ) * pow( max( dot( gR, uGSun ), 0.0 ), 900.0 ) * 6.0;
		float gcos = clamp( dot( -gV, gNw ), 0.0, 1.0 ), gF = 0.32 + 0.68 * pow( 1.0 - gcos, 3.0 );
		vec3 gdayC = grefl * gF; float gdayA = 1.0 - ( 1.0 - gF ) * 0.45;
		// Frost by day: white crystals lit by the snowlight; it hides what's behind and takes no clear reflection.
		gdayC = mix( gdayC, vec3( 0.6, 0.64, 0.7 ), gfa ); gdayA = mix( gdayA, 0.97, gfa );
		gl_FragColor = vec4( mix( gl_FragColor.rgb * gl_FragColor.a, gdayC, uGDay ), mix( gl_FragColor.a, gdayA, uGDay ) );
	}`).replace('#include <fog_fragment>', `#include <fog_fragment>
	#ifdef USE_FOG
		gl_FragColor.rgb -= fogColor * fogFactor * ( 1.0 - gl_FragColor.a );   // fog on a premultiplied colour
	#endif`);
    };
    G.GLASS_OUT.push(m);
    return m;
  };
  G.glassOutSetup(MAT.glassOut);
  // The same frost seen from inside: by day it glows white with the snowlight behind it, by night it catches the
  // room's lamplight faintly. (Same blending as the outer face, so the frost hides the view instead of greying it.)
  MAT.glassIn.blending = THREE.CustomBlending; MAT.glassIn.blendSrc = THREE.OneFactor; MAT.glassIn.blendDst = THREE.OneMinusSrcAlphaFactor;
  MAT.glassIn.onBeforeCompile = (sh) => {
    sh.uniforms.uGDay = GU.uGDay;
    sh.vertexShader = GW_VERT + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvGU = uv; vGS = gsz;');
    sh.fragmentShader = 'uniform float uGDay;\n' + GW_HEAD + '\n' + sh.fragmentShader.replace('#include <tonemapping_fragment>', `
	{
		vec2 gid; float gfa = gwFrost( gid );
		vec3 gfc = mix( vec3( 0.07, 0.06, 0.055 ) + outgoingLight * 0.6, vec3( 0.86, 0.9, 0.95 ), uGDay );
		gl_FragColor = vec4( mix( gl_FragColor.rgb * gl_FragColor.a, gfc, gfa ), mix( gl_FragColor.a, mix( 0.75, 0.94, uGDay ), gfa ) );
	}
	#include <tonemapping_fragment>`).replace('#include <fog_fragment>', `#include <fog_fragment>
	#ifdef USE_FOG
		gl_FragColor.rgb -= fogColor * fogFactor * ( 1.0 - gl_FragColor.a );
	#endif`);
  };
  MAT.glassIn.customProgramCacheKey = () => 'glassIn-frost';
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
/* A pillow or cushion: full in the middle and thinning to a seam all round its edge, with soft rounded-square
 * corners and a few creases (a rounded box read as a block of foam). w, h, d as for G.box; the smallest is its
 * thickness. */
G.pillowGeo = (w, h, d, seed = 1) => {
  const dims = [w, h, d], thin = dims.indexOf(Math.min(w, h, d));
  const A = thin === 0 ? [h, d] : thin === 1 ? [w, d] : [w, h], T = dims[thin];
  const g = new THREE.SphereGeometry(1, 40, 24), P = g.attributes.position, UV = g.attributes.uv, n = 5;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), r = Math.min(1, Math.hypot(x, z)), a = Math.atan2(z, x);
    const ca = Math.cos(a), sa = Math.sin(a), sq = Math.pow(Math.pow(Math.abs(ca), n) + Math.pow(Math.abs(sa), n), -1 / n);   // radius of the rounded square
    const s = Math.pow(r, 0.75);
    const px = ca * sq * s, pz = sa * sq * s;
    const wr = 1 + 0.06 * Math.sin(px * 7 + seed) * Math.sin(pz * 5 - seed * 2) * s;   // creases, more toward the edges
    const yy = Math.sign(y) * Math.sqrt(Math.max(0, 1 - Math.pow(s, 3))) * wr;
    P.setXYZ(i, px * A[0] / 2, yy * T / 2, pz * A[1] / 2);
    // the cloth's pattern laid flat across the face, about 0.4 m to a tile (the sphere's own UVs swirled it into a
    // pinwheel at the middle)
    UV.setXY(i, (px * A[0] / 2) / 0.4 + 0.5, (pz * A[1] / 2) / 0.4 * (y < 0 ? -1 : 1) + 0.5);
  }
  if (thin === 0) g.rotateZ(Math.PI / 2); else if (thin === 2) g.rotateX(Math.PI / 2);
  g.computeVertexNormals();
  return g;
};
G.pillow = (w, h, d, mat, x, y, z, o = {}) => {
  const m = G.add(new THREE.Mesh(G.pillowGeo(w, h, d, o.seed || x * 3.1 + z), mat), o.parent, o.cast !== false, true);
  m.position.set(x, y, z);
  return m;
};
/* Upholstery: a block with soft edges whose faces swell a little, as stuffed cloth does (a rounded box is flat on
 * every face, so a chair made of them read as foam blocks). It is a sphere pushed out to a rounded box (n: how square,
 * 3 a soft roll, 8 a crisp block), then each face crowned: top, the sides, and one face (front: -z) fuller still.
 * UVs are laid flat on each face at uvM metres to a tile. */
G.puffGeo = (w, h, d, o = {}) => {
  const n = o.n || 6, ct = o.top == null ? 0.12 : o.top, cs = o.side == null ? 0.05 : o.side, cf = o.front || 0, uvM = o.uvM || 0.3, seed = o.seed || 1;
  const g = new THREE.SphereGeometry(1, o.ws || 40, o.hs || 28), P = g.attributes.position, UV = g.attributes.uv, N0 = [];
  const a = w / 2, b = h / 2, c = d / 2;
  for (let i = 0; i < P.count; i++) {
    const dx = P.getX(i), dy = P.getY(i), dz = P.getZ(i);
    const t = Math.pow(Math.pow(Math.abs(dx / a), n) + Math.pow(Math.abs(dy / b), n) + Math.pow(Math.abs(dz / c), n), -1 / n);
    let x = dx * t, y = dy * t, z = dz * t;
    const ux = x / a, uy = y / b, uz = z / c, fx = Math.max(0, 1 - ux * ux), fy = Math.max(0, 1 - uy * uy), fz = Math.max(0, 1 - uz * uz);
    const wr = 1 + 0.04 * Math.sin(ux * 6 + seed) * Math.sin(uz * 5 - seed);
    if (y > 0) y += ct * b * fx * fz * wr;
    x += Math.sign(x) * cs * a * fy * fz;
    z += (z < 0 ? -(cs + cf) : cs) * c * fx * fy * wr;
    P.setXYZ(i, x, y, z);
    // flat on the face it most faces
    const ax = Math.abs(ux), ay = Math.abs(uy), az = Math.abs(uz);
    if (ay >= ax && ay >= az) UV.setXY(i, x / uvM, z / uvM); else if (ax >= az) UV.setXY(i, z / uvM, y / uvM); else UV.setXY(i, x / uvM, y / uvM);
  }
  g.computeVertexNormals();
  G.weldNormals(g);
  return g;
};
// Vertices in the same place share one normal (a sphere's seam and poles are split, which shows as a line).
G.weldNormals = (g) => {
  const P = g.attributes.position, N = g.attributes.normal, by = new Map();
  for (let i = 0; i < P.count; i++) { const k = P.getX(i).toFixed(4) + ',' + P.getY(i).toFixed(4) + ',' + P.getZ(i).toFixed(4); (by.get(k) || by.set(k, []).get(k)).push(i); }
  by.forEach((L) => { if (L.length < 2) return; let x = 0, y = 0, z = 0; for (const i of L) { x += N.getX(i); y += N.getY(i); z += N.getZ(i); } const l = Math.hypot(x, y, z) || 1; for (const i of L) N.setXYZ(i, x / l, y / l, z / l); });
  N.needsUpdate = true;
};
/* Shade where stuffed parts press together (a seat cushion against the arms and the back, the arms into the base):
 * each vertex of the meshes in `group` that use `mat` is darkened by how much of the other parts lies within r of it,
 * and toward the floor, written as vertex colours (the room has no ambient occlusion, so a chair of one colour read
 * as one blob). */
G.contactShade = (group, mat, r = 0.07, k = 0.5) => {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), meshes = [];
  group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const cell = r, grid = new Map(), v = new THREE.Vector3(), key = (x, y, z) => x + ',' + y + ',' + z;
  const pos = meshes.map((m, mi) => {
    const M = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld), P = m.geometry.attributes.position, out = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(M); out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
      const kk = key(Math.floor(v.x / cell), Math.floor(v.y / cell), Math.floor(v.z / cell)); (grid.get(kk) || grid.set(kk, []).get(kk)).push(mi, i);
    }
    return out;
  });
  meshes.forEach((m, mi) => {
    if (m.material !== mat) return;
    const p = pos[mi], n = p.length / 3, C = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2], cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
      let s = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        const L = grid.get(key(cx + a, cy + b, cz + c)); if (!L) continue;
        for (let j = 0; j < L.length; j += 2) { if (L[j] === mi) continue; const q = pos[L[j]], o = L[j + 1] * 3, d = Math.hypot(q[o] - x, q[o + 1] - y, q[o + 2] - z); if (d < r) s += 1 - d / r; }
      }
      const ao = (1 - k * Math.min(1, s / 8)) * (0.72 + 0.28 * G.smooth(0.02, 0.3, y));
      C[i * 3] = C[i * 3 + 1] = C[i * 3 + 2] = ao;
    }
    m.geometry.setAttribute('color', new THREE.BufferAttribute(C, 3));
  });
  mat.vertexColors = true; mat.needsUpdate = true;
};
G.puff = (w, h, d, mat, x, y, z, o = {}) => {
  const m = G.add(new THREE.Mesh(G.puffGeo(w, h, d, o), mat), o.parent, o.cast !== false, true);
  m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx;
  if (o.rz) m.rotation.z = o.rz;
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
  const P = [], N = [], C = [], U = [], S = [], anyUV = parts.some((p) => p.uv), anyS = parts.some((p) => p.snow);
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const p of parts) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    nm.getNormalMatrix(p.mat);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(p.mat);
      n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      P.push(v.x, v.y, v.z); N.push(n.x, n.y, n.z);
      // parts can carry their UVs (p.uv: true, or a [su, sv] scale); the rest sit on one solid texel
      if (anyUV) { if (p.uv && uv) { const k = p.uv === true ? [1, 1] : p.uv; U.push(uv.getX(i) * k[0], uv.getY(i) * k[1]); } else U.push(0.5, 0.5); }
      const c = typeof p.color === 'function' ? p.color(v, n, i) : p.color;
      C.push(c.r, c.g, c.b);
      // (p.snow: how much snow lies on a spruce bough here, and a seed for where: aSnow, read by the forest's shader)
      if (anyS) { const sn = !p.snow ? [0, 0] : typeof p.snow === 'function' ? p.snow(v, n, i) : p.snow; S.push(sn[0], sn[1]); }
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  if (anyUV) out.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  if (anyS) out.setAttribute('aSnow', new THREE.Float32BufferAttribute(S, 2));
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

/* =====================================================================
 * Firewood, as it's cut for the fire: a round, or a half, a third or a quarter split from a bigger one. The bark
 * outside, the pale split faces inside, the sawn ends showing their rings round the pith (so a split piece's rings
 * centre on its corner). G.woodGeo(kind, R, L, seed, roll): a geometry along y, centred on its middle, in three groups
 * (bark, split, ends) for G.WOOD_M (or G.WOOD_OUT, weathered on the porch); white in its colours, to char.
 * (They were bark cylinders, which by day in the hearth read as dark nothing with one pale disc.)
 * ===================================================================== */
{
  const TX = G.TX;
  TX.woodBark = G.canvasTex(128, (u, v) => {   // furrows down its length (v)
    const f = Math.abs(Math.sin(u * Math.PI * 7 + G.fbm(u * 6, v * 1.5, 2) * 3)), t = 0.5 + 0.32 * Math.pow(f, 0.6) + G.fbm(u * 24, v * 6, 3) * 0.25;
    return [92 * t, 76 * t, 62 * t];
  });
  TX.woodSplit = G.canvasTex(128, (u, v) => {   // the grain down its length, torn fibres, darker toward the heart
    const t = 0.8 + Math.sin(u * 90 + G.fbm(u * 5, v * 1.2, 2) * 9) * 0.05 + G.fbm(u * 50, v * 3, 2) * 0.12 + G.fbm(u * 6, v * 0.8, 2) * 0.1, heart = 1 - 0.18 * G.smooth(0.35, 0.0, u);
    return [214 * t * heart, 176 * t * heart * heart, 124 * t * heart * heart];
  });
  TX.woodEnd = G.canvasTex(0, null, { w: 96, h: 96, draw: (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, '#b8875a'); g.addColorStop(0.18, '#cfa577'); g.addColorStop(0.8, '#d2ad80'); g.addColorStop(0.86, '#7a5a3e'); g.addColorStop(0.9, '#4a3626'); g.addColorStop(1, '#3a2a1e');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let r = 3, k = 0; r < w * 0.42; r += 2.2 + ((k * 7) % 5) * 0.6, k++) { c.strokeStyle = k % 3 ? 'rgba(120,84,52,0.32)' : 'rgba(96,64,40,0.45)'; c.lineWidth = k % 4 ? 1 : 1.6; c.beginPath(); c.ellipse(w / 2 + 0.6, h / 2, r, r * 0.97, 0, 0, Math.PI * 2); c.stroke(); }
    c.strokeStyle = 'rgba(60,40,26,0.55)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w * 0.7, h * 0.18); c.stroke(); c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w * 0.26, h * 0.72); c.stroke();   // drying checks
  } });
  G.WOOD_M = [G.std({ map: TX.woodBark, bumpMap: TX.woodBark, bumpScale: 0.004, roughness: 1, env: 0.15 }), G.std({ map: TX.woodSplit, roughness: 0.85, env: 0.2 }), G.std({ map: TX.woodEnd, roughness: 0.9, env: 0.2 })];
  G.WOOD_OUT = [G.WOOD_M[0], G.std({ map: TX.woodSplit, color: '#d4ccc2', roughness: 0.9, env: 0.2 }), G.std({ map: TX.woodEnd, color: '#d6cdc2', roughness: 0.92, env: 0.2 })];
  const cache = new Map();
  G.woodGeo = (kind = 'round', R = 0.06, L = 0.42, seed = 1, roll = 0) => {
    const key = [kind, R.toFixed(3), L.toFixed(3), seed, roll.toFixed(2)].join('|');
    if (cache.has(key)) return cache.get(key);
    const r = G.seeded(seed * 7919 + 13), th = { half: Math.PI, third: (Math.PI * 2) / 3, quarter: Math.PI / 2 }[kind] || Math.PI * 2, split = th < 6;
    // the outline round its end, in x, z, with the pith at 0: [x, z, on the bark?, distance round the bark]
    const O = [], na = Math.max(4, Math.round(th / 0.45)), a0 = -th / 2 + (r() - 0.5) * 0.5, ph = r() * 6.28;
    const rad = (a) => R * (1 + 0.04 * Math.sin(a * 5 + ph) + 0.025 * Math.sin(a * 11 + ph * 2.3));
    for (let k = 0; k < (split ? na + 1 : na); k++) { const a = a0 + (th * k) / na; O.push([Math.cos(a) * rad(a), Math.sin(a) * rad(a), 1, a * R]); }
    if (split) {   // in along the split to the pith, a little ragged, and out again
      const e = O[O.length - 1], s = O[0], rag = () => (r() - 0.5) * R * 0.1;
      for (const t of [0.66, 0.33]) O.push([e[0] * t + rag(), e[1] * t + rag(), 0, 0]);
      O.push([0, 0, 0, 0]);
      for (const t of [0.33, 0.66]) O.push([s[0] * t + rag(), s[1] * t + rag(), 0, 0]);
    }
    let cx = 0, cz = 0; O.forEach((p) => { cx += p[0]; cz += p[1]; }); cx /= O.length; cz /= O.length;
    const NY = 4, swell = (y) => 1 + 0.035 * Math.sin((y / L) * 5.5 + ph) - 0.03 * Math.pow(Math.abs((2 * y) / L), 6);   // a little irregular, and rounded off at the saw cuts
    const G3 = [[], [], []].map(() => ({ P: [], N: [], U: [] }));
    const put = (gi, x, y, z, nx, ny, nz, u, v) => { const b = G3[gi]; b.P.push(x - cx, y, z - cz); b.N.push(nx, ny, nz); b.U.push(u, v); };
    // the sides: bark round the outside, the split faces in to the pith
    for (let k = 0; k < O.length; k++) {
      const p = O[k], q = O[(k + 1) % O.length], bark = p[2] && q[2], gi = bark ? 0 : 1;
      const ex = q[0] - p[0], ez = q[1] - p[1], el = Math.hypot(ex, ez) || 1, fn = [ez / el, -ex / el];   // the face's outward normal (the outline runs anticlockwise)
      for (let j = 0; j < NY; j++) {
        const y0 = -L / 2 + (L * j) / NY, y1 = -L / 2 + (L * (j + 1)) / NY, s0 = swell(y0), s1 = swell(y1);
        const vtx = (pt, y, s) => {
          const n = bark ? [pt[0] / (Math.hypot(pt[0], pt[1]) || 1), pt[1] / (Math.hypot(pt[0], pt[1]) || 1)] : fn;
          const u = bark ? pt[3] / 0.2 : Math.hypot(pt[0], pt[1]) / 0.12 + (k % 2) * 0.37;
          return [pt[0] * s, y, pt[1] * s, n[0], 0, n[1], u, y / 0.36 + seed * 0.13];
        };
        const a = vtx(p, y0, s0), b = vtx(q, y0, s0), c = vtx(q, y1, s1), d = vtx(p, y1, s1);
        for (const t of [a, c, b, a, d, c]) put(gi, ...t);
      }
    }
    // the sawn ends
    const cont = O.map((p) => new THREE.Vector2(p[0], p[1])), tris = THREE.ShapeUtils.triangulateShape(cont, []);
    for (const sy of [-1, 1]) {
      const y = (sy * L) / 2, s = swell(y);
      for (const [i0, i1, i2] of tris) {
        let t = [i0, i1, i2]; const A = O[i0], B = O[i1], C = O[i2], cr = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
        if ((cr > 0) === sy > 0) t = [i0, i2, i1];   // facing out of the end
        for (const i of t) { const p = O[i]; put(2, p[0] * s, y, p[1] * s, 0, sy, 0, (p[0] / (2.2 * R)) * sy + 0.5, p[1] / (2.2 * R) + 0.5); }
      }
    }
    const P = [], N = [], U = [], g = new THREE.BufferGeometry();
    G3.forEach((b, gi) => { g.addGroup(P.length / 3, b.P.length / 3, gi); P.push(...b.P); N.push(...b.N); U.push(...b.U); });
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(P.length).fill(1), 3));
    if (roll) g.rotateY(roll);
    g.computeBoundingSphere(); cache.set(key, g);
    return g;
  };
  // a piece of firewood: kind 'round' | 'half' | 'third' | 'quarter'
  G.wood = (kind, R, L, seed, roll, mats = G.WOOD_M) => { const m = new THREE.Mesh(G.woodGeo(kind, R, L, seed, roll), mats); m.castShadow = true; m.receiveShadow = true; return m; };
}
