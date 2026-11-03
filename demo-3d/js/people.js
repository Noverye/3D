'use strict';
/* =========================================================================
 * People: anthropometric bodies (Drillis & Contini ratios), layered
 * hair-card hair, knitwear / hoodie outfits, simple faces with real eyes.
 * Rig: root → hips → spine → chest → neck → head; shoulder → elbow → hand;
 * hip → knee → ankle. +z is forward.
 * ========================================================================= */
(() => {
const { TX, lerp } = G;

/* ---------- hair cards ---------- */
const SKULL = { c: new THREE.Vector3(0, 0.02, -0.005), r: new THREE.Vector3(0.082, 0.103, 0.099) };
function skullNormal(p) {
  const d = p.clone().sub(SKULL.c);
  return new THREE.Vector3(d.x / (SKULL.r.x ** 2), d.y / (SKULL.r.y ** 2), d.z / (SKULL.r.z ** 2)).normalize();
}
function pushOut(p, margin) {
  const d = p.clone().sub(SKULL.c);
  const e = Math.hypot(d.x / (SKULL.r.x * margin), d.y / (SKULL.r.y * margin), d.z / (SKULL.r.z * margin));
  if (e < 1) { d.multiplyScalar(1 / e); p.copy(SKULL.c).add(d); }
}
function hairGeometry(style, seed) {
  const r = G.seeded(seed);
  const P = [], N = [], UV = [], I = [];
  const crown = new THREE.Vector3(0.0, 0.12, -0.035);
  const card = (p0, dir0, L, w0, grav, curl, layer) => {
    const S = 7;
    const pts = [p0.clone()], dirs = [];
    let d = dir0.clone().normalize();
    let q = p0.clone();
    for (let k = 0; k < S; k++) {
      dirs.push(d.clone());
      q = q.clone().addScaledVector(d, L / S);
      pushOut(q, 1.01 + layer * 0.006);
      { const dd = q.clone().sub(SKULL.c); const e = Math.hypot(dd.x / SKULL.r.x, dd.y / SKULL.r.y, dd.z / SKULL.r.z); if (e > 1.08 + layer * 0.02 && q.y > SKULL.c.y - 0.06) { q.copy(SKULL.c).add(dd.multiplyScalar((1.08 + layer * 0.02) / e)); } }
      pts.push(q);
      d.add(new THREE.Vector3(0, -grav, 0)).add(new THREE.Vector3((r() - 0.5) * curl, (r() - 0.5) * curl * 0.5, (r() - 0.5) * curl)).normalize();
    }
    dirs.push(d.clone());
    const base = P.length / 3;
    for (let k = 0; k <= S; k++) {
      const t = k / S, p = pts[k];
      const n = p.distanceTo(SKULL.c) < 0.16 ? skullNormal(p) : new THREE.Vector3(p.x, 0, p.z).normalize();
      const side = new THREE.Vector3().crossVectors(dirs[k], n).normalize();
      const w = w0 * lerp(1, 0.55, t);
      for (const s of [-0.5, 0.5]) {
        const v = p.clone().addScaledVector(side, s * w).addScaledVector(n, 0.002 * layer);
        P.push(v.x, v.y, v.z); N.push(n.x, n.y, n.z); UV.push(s + 0.5, 1 - t);
      }
      if (k) { const a = base + (k - 1) * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
  };
  const onSkull = (theta, phi) => new THREE.Vector3(SKULL.c.x + SKULL.r.x * Math.cos(phi) * Math.sin(theta), SKULL.c.y + SKULL.r.y * Math.sin(phi), SKULL.c.z + SKULL.r.z * Math.cos(phi) * Math.cos(theta));
  const comb = (p, n, frontBias) => {
    const t = p.clone().sub(crown); t.addScaledVector(n, -t.dot(n)); t.normalize();
    return t.multiplyScalar(0.9).addScaledVector(n, 0.35).add(new THREE.Vector3(0, -0.25, frontBias));
  };
  if (style === 'shaggy') {
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 120; i++) {
        const theta = (r() * 2 - 1) * Math.PI, phi = -0.45 + r() * 1.95;
        const front = Math.cos(theta) > 0.55;
        if (front && phi < 0.42) continue;           // hairline
        if (Math.abs(Math.sin(theta)) > 0.85 && phi < -0.05 && Math.cos(theta) > -0.2) continue; // above the ears
        const p = onSkull(theta, phi), n = skullNormal(p);
        let dir = comb(p, n, front ? 0.35 : 0);
        if (front) dir.add(new THREE.Vector3(0, -0.55, 0.45));
        const L = front ? 0.055 + r() * 0.025 : 0.045 + r() * 0.045 + (phi < 0.2 ? 0.015 : 0);
        card(p, dir, L, 0.02 + r() * 0.01, 0.35, 0.2, layer);
      }
    }
  } else {
    // Long, loosely tied hair: body falls to the shoulders, bun at the back, face-framing strands.
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 130; i++) {
        const theta = (r() * 2 - 1) * Math.PI, phi = -0.35 + r() * 1.85;
        const front = Math.cos(theta) > 0.5;
        if (front && phi < 0.45) continue;
        if (Math.abs(Math.sin(theta)) > 0.85 && phi < 0.05 && Math.cos(theta) > -0.2) continue;
        const p = onSkull(theta, phi), n = skullNormal(p);
        const toBun = new THREE.Vector3(0, 0.07, -0.11).sub(p);
        let dir = phi > 0.1 ? toBun.normalize().addScaledVector(n, 0.25) : comb(p, n, 0);
        const L = phi > 0.1 ? 0.06 + r() * 0.05 : 0.14 + r() * 0.1;
        card(p, dir, L, 0.022 + r() * 0.012, phi > 0.1 ? 0.02 : 0.3, 0.18, layer);
      }
    }
    // Bun: cards wound around a point at the back of the crown.
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, b = r() * Math.PI;
      const c = new THREE.Vector3(0, 0.085, -0.115);
      const p = c.clone().add(new THREE.Vector3(Math.cos(a) * Math.sin(b) * 0.032, Math.cos(b) * 0.03, Math.sin(a) * Math.sin(b) * 0.032));
      const dir = new THREE.Vector3(-Math.sin(a), (r() - 0.5) * 0.6, Math.cos(a));
      card(p, dir, 0.08 + r() * 0.05, 0.03, 0.0, 0.6, 1);
    }
    // Face-framing strands and loose flyaways.
    for (const s of [-1, 1]) for (let j = 0; j < 4; j++) {
      const p = onSkull(s * (0.75 + j * 0.12), 0.42 + j * 0.05), n = skullNormal(p);
      card(p, new THREE.Vector3(s * 0.15, -1, 0.25).addScaledVector(n, 0.2), 0.17 + j * 0.03, 0.018 + r() * 0.01, 0.12, 0.25, 2);
    }
    for (let j = 0; j < 7; j++) {
      const th = (r() - 0.5) * 0.9, p = onSkull(th, 0.66 + r() * 0.1), n = skullNormal(p);
      card(p, new THREE.Vector3(th * 0.6, -0.5, 0.6).addScaledVector(n, 0.3), 0.035 + r() * 0.015, 0.02, 0.2, 0.3, 2);  // wispy bangs
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I);
  return g;
}

/* ---------- body ---------- */
G.makeHuman = (o) => {
  const H = o.height, k = H / 1.75, fem = !!o.fem;
  const W = fem ? { hip: 0.172, waist: 0.13, chest: 0.155, sh: 0.16, shoulderX: 0.16 } : { hip: 0.162, waist: 0.15, chest: 0.18, sh: 0.19, shoulderX: 0.19 };
  const std = G.std;
  const skin = std({ color: o.skin, roughness: 0.48, emissive: '#5a2010', emissiveIntensity: 0.06, env: 0.3 });
  const topMat = o.outfit === 'sweater'
    ? std({ map: G.rep(TX.knitCream, 3, 2), bumpMap: G.rep(TX.knitB, 3, 2), bumpScale: 0.0025, roughness: 1, env: 0.2 })
    : std({ map: TX.jersey, color: o.top, bumpMap: TX.jerseyB, bumpScale: 0.002, roughness: 0.95, env: 0.25 });
  const legMat = std({ map: TX.jersey, color: o.legs, bumpMap: TX.jerseyB, bumpScale: 0.002, roughness: 0.9 });
  const sock = std({ map: TX.knitCream, color: o.socks || '#d8cfc2', roughness: 1 });
  const sole = std({ color: '#3a3330', roughness: 0.85 });
  const hairM = std({ map: TX.hair, color: new THREE.Color(o.hair).multiplyScalar(0.62), alphaTest: 0.38, side: THREE.DoubleSide, roughness: 0.72, env: 0.12 });
  const scalpM = std({ color: new THREE.Color(o.hair).multiplyScalar(0.7), roughness: 0.6 });
  const eyeW = std({ color: '#ece6df', roughness: 0.08, env: 1.2 });
  const iris = std({ color: o.eyes || '#5a3a22', roughness: 0.05, env: 1.6 });
  const pupil = std({ color: '#0a0706', roughness: 0.05, env: 1.6 });
  const lip = std({ color: o.lips || '#b86a62', roughness: 0.38, env: 0.5 });
  const lash = std({ color: '#1a120e', roughness: 0.6 });
  const LIDS = [];
  const root = new THREE.Group();
  const M = (geo, mat, parent, x = 0, y = 0, z = 0, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x * k, y * k, z * k); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
  const lathe = (pts, seg = 30) => { const P = pts[0][1] > pts[pts.length - 1][1] ? pts.slice().reverse() : pts; return new THREE.LatheGeometry(P.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r) * k, y * k)), seg); };
  const ell = (rx, ry, rz, mat, parent, x, y, z, seg = 20, cast = true) => { const m = M(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), mat, parent, x, y, z, cast); m.scale.set(rx * k, ry * k, rz * k); return m; };
  const loose = o.outfit === 'sweater' ? 1.07 : 1.04;

  /* pelvis & torso */
  const hipY = 0.53 * 1.75;
  const hips = new THREE.Group(); hips.position.y = hipY * k; root.add(hips);
  M(lathe([[0, -0.13], [W.hip * 0.62, -0.115], [W.hip * 0.96, -0.06], [W.hip, 0.0], [W.hip * 0.97, 0.06], [W.waist * 1.02, 0.13], [0, 0.135]]), legMat, hips).scale.z = 0.7;
  const spine = new THREE.Group(); spine.position.y = 0.1 * k; hips.add(spine);
  const bust = fem ? 0.012 : 0;
  const hemY = o.outfit === 'sweater' ? -0.13 : -0.07;
  const torso = M(lathe([
    [W.hip * loose * 1.02, hemY], [W.hip * loose, hemY + 0.06], [W.waist * loose * 1.03, 0.1], [(W.waist + W.chest) / 2 * loose, 0.18],
    [(W.chest + bust) * loose, 0.27], [(W.chest + bust * 0.5) * loose, 0.33], [W.chest * 1.02 * loose, 0.38], [W.sh * loose, 0.43],
    [W.sh * 0.88 * loose, 0.47], [0.1, 0.5], [0.066, 0.52], [0, 0.524],
  ], 36), topMat, spine);
  torso.scale.z = fem ? 0.7 : 0.66;
  // Ribbed hem
  M(lathe([[W.hip * loose * 1.03, hemY - 0.002], [W.hip * loose * 1.06, hemY + 0.03], [W.hip * loose * 1.03, hemY + 0.055]]), topMat, spine).scale.z = torso.scale.z;
  const chest = new THREE.Group(); chest.position.y = 0.36 * k; spine.add(chest);
  if (o.outfit === 'hoodie') {
    // Hood bunched behind the neck, drawstrings, kangaroo pocket.
    const hood = ell(0.085, 0.045, 0.035, topMat, chest, 0, 0.12, -0.075, 24); hood.rotation.x = 0.45;
    const hr = M(new THREE.TorusGeometry(0.075 * k, 0.02 * k, 10, 24, Math.PI * 1.25), topMat, chest, 0, 0.155, -0.01); hr.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI * 1.375);
    for (const s of [-1, 1]) { const ds = M(new THREE.CylinderGeometry(0.0035 * k, 0.0035 * k, 0.16 * k, 6), std({ color: '#d8d4cc', roughness: 0.8 }), chest, s * 0.035, 0.05, 0.118); ds.rotation.x = 0.06; }
    const pk = M(new THREE.BoxGeometry(0.2 * k, 0.11 * k, 0.012 * k), topMat, spine, 0, 0.06, W.waist * loose * (fem ? 0.7 : 0.66) + 0.003); pk.rotation.x = -0.08;
  } else {
    // Cowl collar of the sweater.
    M(new THREE.TorusGeometry(0.075 * k, 0.022 * k, 10, 28), topMat, chest, 0, 0.145, 0.005).rotation.x = Math.PI / 2 - 0.15;
  }

  /* neck & head */
  const neck = new THREE.Group(); neck.position.y = 0.135 * k; chest.add(neck);
  M(new THREE.CylinderGeometry(0.048 * k, 0.056 * k, 0.12 * k, 20), skin, neck, 0, 0.04, 0.005);
  const head = new THREE.Group(); head.position.set(0, 0.155 * k, 0.012 * k); neck.add(head);
  ell(0.077, 0.098, 0.094, skin, head, 0, 0.02, -0.005, 36);
  ell(0.06, 0.064, 0.066, skin, head, 0, -0.034, 0.004, 28);                  // jaw/cheeks
  ell(0.03, 0.022, 0.028, skin, head, 0, -0.082, 0.038, 18);                  // chin
  const bridge = ell(0.011, 0.03, 0.012, skin, head, 0, 0.0, 0.088, 14); bridge.rotation.x = -0.3;
  ell(0.0105, 0.0095, 0.0105, skin, head, 0, -0.025, 0.094, 14);                 // nose tip
  for (const s of [-1, 1]) ell(0.007, 0.0065, 0.008, skin, head, s * 0.0105, -0.029, 0.088, 10);  // nostril wings
  for (const s of [-1, 1]) {
    ell(0.011, 0.024, 0.017, skin, head, s * 0.077, 0.0, -0.008, 12);        // ears
    ell(0.012, 0.012, 0.012, eyeW, head, s * 0.031, 0.007, 0.073, 18, false);
    ell(0.0068, 0.0068, 0.0025, iris, head, s * 0.031, 0.007, 0.0848, 16, false);
    ell(0.0033, 0.0033, 0.0015, pupil, head, s * 0.031, 0.007, 0.0868, 10, false);
    const lid = ell(0.0135, 0.008, 0.0125, skin, head, s * 0.031, 0.0135, 0.073, 16); lid.scale.y *= 0.9; LIDS.push(lid);
    const ln = M(new THREE.BoxGeometry(0.028 * k, 0.0022 * k, 0.004 * k), lash, head, s * 0.031, 0.0125, 0.0855, false); ln.rotation.z = -s * 0.06;
    const brow = M(new THREE.BoxGeometry(0.03 * k, 0.0055 * k, 0.007 * k), scalpM, head, s * 0.033, 0.033, 0.086, false); brow.rotation.z = -s * 0.1;
  }
  ell(0.0165, 0.0045, 0.007, lip, head, 0, -0.0505, 0.0855, 16, false);
  ell(0.015, 0.005, 0.007, lip, head, 0, -0.058, 0.0835, 16, false);
  // Hair: a scalp shell plus layered alpha-tested cards.
  ell(0.08, 0.1, 0.096, scalpM, head, 0, 0.022, -0.01, 28).scale.y *= 1;
  const hg = hairGeometry(o.hairStyle, o.seed || 7);
  const hair = new THREE.Mesh(hg, hairM); hair.scale.setScalar(k); hair.castShadow = false; head.add(hair);
  if (o.hairStyle === 'bun') ell(0.034, 0.03, 0.034, scalpM, head, 0, 0.085, -0.115, 16);

  /* arms */
  const arms = [];
  const ua = 0.186 * 1.75, fa = 0.146 * 1.75;
  const sleeveR = o.outfit === 'sweater' ? 1.1 : 1.0;
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * W.shoulderX * k, 0.07 * k, -0.005 * k); chest.add(sh);
    ell(0.047 * sleeveR, 0.042, 0.047 * sleeveR, topMat, sh, 0, -0.01, 0, 20);
    M(lathe([[0.05 * sleeveR, 0], [0.051 * sleeveR, -0.05], [0.046 * sleeveR, -0.15], [0.04 * sleeveR, -ua + 0.02], [0.037 * sleeveR, -ua]]), topMat, sh).scale.z = 0.94;
    const el = new THREE.Group(); el.position.y = -ua * k; sh.add(el);
    ell(0.036 * sleeveR, 0.036, 0.035 * sleeveR, topMat, el, 0, 0, 0, 14);
    const cuffEnd = o.outfit === 'sweater' ? -fa - 0.035 : -fa + 0.01;
    M(lathe([[0.038 * sleeveR, 0], [0.041 * sleeveR, -0.06], [0.036 * sleeveR, -0.15], [0.033 * sleeveR, cuffEnd + 0.04], [0.036 * sleeveR, cuffEnd + 0.004], [0.0, cuffEnd]]), topMat, el);
    M(new THREE.CylinderGeometry(0.022 * k, 0.025 * k, 0.03 * k, 14), skin, el, 0, -fa + 0.005, 0);
    const hand = new THREE.Group(); hand.position.y = -fa * k; el.add(hand);
    ell(0.017, 0.045, 0.038, skin, hand, 0, -0.04, 0, 18);
    for (let f = 0; f < 4; f++) ell(0.0075, 0.03 - Math.abs(f - 1.5) * 0.003, 0.0075, skin, hand, s * 0.002, -0.098 + Math.abs(f - 1.5) * 0.004, -0.024 + f * 0.016, 10);
    const th = ell(0.01, 0.026, 0.011, skin, hand, -s * 0.004, -0.045, 0.038, 12); th.rotation.x = 0.55;
    sh.rotation.z = s * 0.07;
    arms.push({ sh, el, hand });
  }

  /* legs */
  const lids = [];
  const legs = [];
  const tl = 0.245 * 1.75, sl = 0.246 * 1.75, ank = 0.039 * 1.75, fl = 0.152 * 1.75;
  for (const s of [-1, 1]) {
    const thg = new THREE.Group(); thg.position.set(s * (fem ? 0.088 : 0.086) * k, 0, 0); hips.add(thg);
    M(lathe([[0.088, 0.02], [0.085, -0.04], [0.074, -0.18], [0.06, -0.33], [0.052, -tl]]), legMat, thg).scale.z = 0.95;
    const kn = new THREE.Group(); kn.position.y = -tl * k; thg.add(kn);
    ell(0.05, 0.05, 0.048, legMat, kn, 0, 0, 0, 14);
    M(lathe([[0.051, 0], [0.054, -0.09], [0.046, -0.2], [0.04, -sl + 0.03], [0.034, -sl + 0.005], [0, -sl]]), legMat, kn);
    const ft = new THREE.Group(); ft.position.y = -sl * k; kn.add(ft);
    M(new THREE.CylinderGeometry(0.032 * k, 0.036 * k, 0.05 * k, 14), sock, ft, 0, -0.01, 0);
    ell(0.043, 0.034, fl * 0.5, sock, ft, 0, -ank + 0.032, fl * 0.5 - 0.06, 22);
    M(new THREE.BoxGeometry(0.082 * k, 0.016 * k, fl * k), sole, ft, 0, -ank + 0.008, fl * 0.5 - 0.06);
    legs.push({ th: thg, kn, ft });
  }
  root.userData = { hips, spine, chest, neck, head, arms, legs, k, H, hipY: hipY * k, lids: LIDS, bodyMats: [skin, topMat, legMat, sock, sole], skinM: skin, topM: topMat, legM: legMat, sockM: sock, outfit: o.outfit };
  G.scene.add(root);
  return root;
};

/* ---------- Blender body (rigged glTF) driven by the procedural rig ----------
 * The procedural rig above keeps animating as before. The Blender mesh's bones
 * copy each rig group's motion: Mbone = Mgroup * Mgroup_rest^-1 * Mbone_rest.
 * The procedural body meshes are hidden; eyes, lids, brows, lips and hair stay.
 */
/* Character models: fetched as .glb when served over http(s); opened from disk (file://, where fetch
 * is blocked) they come from js/models.js, which embeds the same files as base64 and is only loaded then. */
let embedded = null;
const loadEmbedded = () => embedded || (embedded = new Promise((res) => {
  if (window.CBS_MODELS) return res(window.CBS_MODELS);
  const s = document.createElement('script');
  s.src = 'js/models.js';
  s.onload = () => res(window.CBS_MODELS || {});
  s.onerror = () => res({});
  document.head.appendChild(s);
}));
G.loadModelBuffer = async (name) => {
  if (location.protocol !== 'file:') {
    try {
      const r = await fetch('models/' + name + '.glb');
      if (r.ok) return await r.arrayBuffer();
    } catch (e) { /* fall through to the embedded copy */ }
  }
  const all = await loadEmbedded();
  if (!all[name]) return null;
  return Uint8Array.from(atob(all[name]), (c) => c.charCodeAt(0)).buffer;
};
/* The realistic characters (assets.js manifest): fetched when served, else from js/models_real.js,
 * which embeds them as base64 for hosts that can't serve .glb files. Null if neither is there. */
let embeddedReal = null;
const embeddedFiles = {};
// Adults in js/models_real.js (window.CBS_REAL), the children in js/models_kids.js (window.CBS_REAL_KIDS).
const loadEmbeddedReal = (kid) => embeddedFiles[kid ? 1 : 0] || (embeddedFiles[kid ? 1 : 0] = new Promise((res) => {
  const v = kid ? 'CBS_REAL_KIDS' : 'CBS_REAL';
  if (window[v]) return res(window[v]);
  const s = document.createElement('script');
  s.src = (G.BUILD !== 'dev' ? 'v' + G.BUILD + '/' : '') + (kid ? 'js/models_kids.js' : 'js/models_real.js');
  s.onload = () => res(window[v] || {});
  s.onerror = () => res({});
  document.head.appendChild(s);
}));
G.loadRealModel = async (name, spec, embeddedOnly) => {
  G.CHAR_SRC = G.CHAR_SRC || {};
  // Already on the page (the published build includes js/models_real.js): use it, don't fetch.
  const kidV = /^kid_/.test(name) ? window.CBS_REAL_KIDS : window.CBS_REAL;
  if (kidV && kidV[name]) { G.CHAR_SRC[name] = 'page'; return decodeReal(kidV[name]); }
  if (!embeddedOnly && location.protocol !== 'file:' && spec.url) {
    try {
      const r = await fetch(spec.url);
      // Only a real GLB (some hosts answer a missing file with a web page and a 200).
      // And it must be the realistic rig (Mixamo bones), not some other file served in its place.
      if (r.ok) { const buf = await r.arrayBuffer(); if (isRealGlb(buf)) { G.CHAR_SRC[name] = 'fetched ' + (buf.byteLength / 1e6).toFixed(1) + 'MB'; return buf; } console.warn('[characters]', spec.url, 'served something else; using the embedded copy'); }
    } catch (e) { /* try the embedded copy */ }
  }
  const all = await loadEmbeddedReal(/^kid_/.test(name));
  if (all[name]) G.CHAR_SRC[name] = 'embedded';
  return all[name] ? decodeReal(all[name]) : null;
};
const decodeReal = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
/* Build number of the published page (the artifact build puts every script under v<build>/, so phones don't keep stale copies). */
G.BUILD = G.BUILD || (document.currentScript && (document.currentScript.src.match(/\/v(\d+)\/js\//) || [])[1]) || 'dev';
/* A few facts for Stats, to see from a screenshot why a device shows the characters differently. */
G.ERRS = [];
window.addEventListener('error', (e) => { G.ERRS.push(String(e.message).slice(0, 60)); });
const _ce = console.error.bind(console), _cw = console.warn.bind(console);
console.error = (...a) => { G.ERRS.push(a.map(String).join(' ').slice(0, 70)); _ce(...a); };
console.warn = (...a) => { if (/characters|GLTF|THREE/.test(String(a[0]))) G.ERRS.push(a.map(String).join(' ').slice(0, 70)); _cw(...a); };
let diagT = 0, diagS = '';
G.diag = () => {
  const now = performance.now(); if (now - diagT < 1000) return diagS; diagT = now;
  const R = G.renderer, cap = R.capabilities, gl = R.getContext();
  const per = (m) => { let n = 0, vis = 0, tex = 0, bones = 0; m.traverse((o) => { if (o.isSkinnedMesh) { n++; if (o.visible) vis++; if (o.material.map && o.material.map.image) tex++; bones = Math.max(bones, o.skeleton.bones.length); } }); const u = m.userData; return `${vis}/${n} vis ${tex} tex ${bones} bones top ${(u.realTop || []).map((o) => (o.visible ? 1 : 0)).join('')} fit ${u.gearFitted ? 1 : 0}`; };
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const kid = G.KIDS && G.PLAYER.m === G.KIDS.player;
  diagS = `${kid ? '\n(childhood scene: the children)' : ''}\nHim ${per(G.PLAYER.m)}\nHer ${per(G.PARTNER.m)}\nGPU ${ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).slice(0, 34) : '?'}\nWebGL${cap.isWebGL2 ? 2 : 1} vtex ${cap.floatVertexTextures ? 1 : 0} vuni ${cap.maxVertexUniforms} tex ${cap.maxTextureSize} dressed ${G.PLAYER.dressed ? 1 : 0}${G.PARTNER.dressed ? 1 : 0}` + G.ERRS.slice(-3).map((e) => '\n! ' + e).join('');
  return diagS;
};
/* Which body each character got, and why (shown in Stats). */
G.CHAR_STATUS = {};
G.attachBlenderBody = async (root, name, opts = {}) => {
  if (!THREE.GLTFLoader) return false;
  // A realistic model from the manifest if there is one (not for the children in the prologue), else the built-in body.
  const mname = opts.kid ? 'kid_' + name : name;
  const spec = G.ASSET_MANIFEST && G.ASSET_MANIFEST.characters[mname];
  const key = opts.kid ? 'kid ' + name : name;
  if (spec) {
    let why = 'not found';
    try {
      // The served file first; if it can't be decoded here (no WebAssembly for meshopt), the embedded copy.
      for (const only of [false, true]) {
        const bin = await G.loadRealModel(mname, spec, only);
        if (!bin) continue;
        root.userData.real = true;
        if (await attachBody(root, name, spec, bin)) { G.CHAR_STATUS[key] = 'realistic ' + ((G.CHAR_SRC || {})[mname] || '?') + ' ' + (bin.byteLength / 1e6).toFixed(1) + 'MB'; return true; }
        why = 'could not be read';
        if (!isMeshopt(bin)) break;
      }
    } catch (e) { why = String(e && e.message || e); }
    console.warn('[characters] realistic', name, why, '- using the built-in body');
    G.CHAR_STATUS[key] = 'built-in (realistic ' + why + ')';
    root.userData.real = false;
  }
  const bin = await G.loadModelBuffer(name);
  const ok = bin ? await attachBody(root, name, null, bin) : false;
  if (!G.CHAR_STATUS[key]) G.CHAR_STATUS[key] = ok ? 'built-in' : 'procedural';
  return ok;
};
// The models are stored quantized for download (normals, UVs, colours and skin weights as small normalized integers,
// tools/quantize_glb.js). This version of three.js doesn't scale those on getX/setX, and the game reshapes and
// reweights the bodies on load, so every quantized attribute goes back to plain floats straight away.
function dequantize(scene) {
  scene.traverse((o) => {
    const g = o.geometry; if (!g || !g.attributes) return;
    for (const [k, A] of Object.entries(g.attributes)) {
      if (!A.normalized && !A.isInterleavedBufferAttribute) continue;
      const arr = A.isInterleavedBufferAttribute ? A.data.array : A.array;
      const max = arr instanceof Int8Array ? 127 : arr instanceof Uint8Array ? 255 : arr instanceof Int16Array ? 32767 : arr instanceof Uint16Array ? 65535 : 1;
      const signed = arr instanceof Int8Array || arr instanceof Int16Array;
      const n = A.itemSize, out = new Float32Array(A.count * n), get = ['getX', 'getY', 'getZ', 'getW'];
      for (let i = 0; i < A.count; i++) for (let j = 0; j < n; j++) { const v = A[get[j]](i) / (A.normalized ? max : 1); out[i * n + j] = signed ? Math.max(-1, v) : v; }
      g.setAttribute(k, new THREE.BufferAttribute(out, n));
    }
  });
}
async function attachBody(root, name, spec, bin) {
  // The realistic models may be meshopt-compressed (EXT_meshopt_compression); the decoder is WebAssembly,
  // so the embedded copies (js/models_real.js) are stored decompressed and load without it.
  const loader = new THREE.GLTFLoader();
  if (window.MeshoptDecoder && isMeshopt(bin)) { await MeshoptDecoder.ready; loader.setMeshoptDecoder(MeshoptDecoder); }
  return new Promise((resolve) => {
    loader.parse(bin, '', (gltf) => {
      dequantize(gltf.scene);
      const u = root.userData, k = u.k;
      const model = gltf.scene;
      // A model from the asset manifest can bring its own materials and proportions; the built-in ones
      // are authored for a 1.75 m body and take the game's knit and jersey materials.
      spec = spec || {};
      if (spec.fit) { const b = new THREE.Box3().setFromObject(model); model.scale.setScalar(u.H / Math.max(0.1, b.max.y - b.min.y)); }
      else model.scale.setScalar(spec.scale || k);
      // Rest pose: zero every rig rotation, then capture world matrices.
      const groups = { hips: u.hips, spine: u.spine, chest: u.chest, neck: u.neck, head: u.head };
      u.arms.forEach((a, i) => { const s = i ? 'R' : 'L'; groups['sh_' + s] = a.sh; groups['el_' + s] = a.el; groups['hand_' + s] = a.hand; });
      u.legs.forEach((l, i) => { const s = i ? 'R' : 'L'; groups['th_' + s] = l.th; groups['kn_' + s] = l.kn; groups['ft_' + s] = l.ft; });
      const saved = [];
      root.traverse((o) => { saved.push([o, o.position.clone(), o.rotation.clone()]); });
      const pos0 = root.position.clone(), rot0 = root.rotation.clone();
      root.position.set(0, 0, 0); root.rotation.set(0, 0, 0);
      Object.values(groups).forEach((g) => g.rotation.set(0, 0, 0));
      u.hips.position.y = u.hipY;
      root.add(model);
      root.updateMatrixWorld(true);
      const map = [], used = new Set(), wpos = new THREE.Vector3();
      // Match bones to rig groups: exact names first (the built-in models), else by common rig naming,
      // picking the left or right group by which side of the body the bone actually sits on.
      const groupFor = (o) => {
        if (groups[o.name]) return o.name;
        const a = G.boneAlias ? G.boneAlias(o.name) : null;
        if (!a) return null;
        if (['hips', 'spine', 'chest', 'neck', 'head'].includes(a.part)) return a.part;
        const x = o.getWorldPosition(wpos).x, l = groups[a.part + '_L'], r = groups[a.part + '_R'];
        if (!l || !r) return null;
        const lx = l.getWorldPosition(new THREE.Vector3()).x;
        return Math.sign(x) === Math.sign(lx) ? a.part + '_L' : a.part + '_R';
      };
      model.traverse((o) => {
        const gn = o.isBone ? groupFor(o) : null;
        if (gn && !used.has(gn)) { used.add(gn); map.push({ bone: o, group: groups[gn], restInv: new THREE.Matrix4().copy(groups[gn].matrixWorld).invert(), boneRest: o.matrixWorld.clone() }); }
        if (o.isMesh && spec.keepMaterials) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; return; }
        if (o.isMesh) {
          o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true;
          const nm = (o.material.name || '').split('.')[0];
          const src = { skin: u.skinM, top: u.topM, legs: u.legM, socks: u.sockM }[nm] || u.skinM;
          const m = src.clone(); m.skinning = true; G.MATS.push(m); o.material = m;
          // Cylindrical UVs so knit and jersey textures wrap the body (not on the clothes made in Blender, which
          // carry their own).
          if (/^(coat|hat|scarf|gloves|boots)_/i.test(o.name) && o.geometry.attributes.uv) return;
          const p = o.geometry.attributes.position, uv = new Float32Array(p.count * 2);
          for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const cx = Math.abs(x) > 0.15 && y > 0.75 && y < 1.5 ? Math.sign(x) * 0.18 : Math.abs(x) > 0.03 && y < 0.95 ? Math.sign(x) * 0.087 : 0; uv[i * 2] = (Math.atan2(z, x - cx) / (2 * Math.PI) + 0.5) * 2; uv[i * 2 + 1] = y * 3; }
          o.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        }
      });
      // A realistic model: measure it in the rest pose, so outdoor clothes can be fitted around it (life.js).
      if (spec.fit) u.fit = measureFit(model, u);
      // Fingers (the rig doesn't drive them): found and measured now, in the rest pose, curled every frame.
      u.fingers = findFingers(model);
      // Eyelids: the real heads have no blink shapes, so each eye gets a skin-coloured lid that rides the head bone.
      if (spec.keepMaterials) u.realLids = makeRealLids(model);
      // Expressions: a smile, a sad look and raised brows, built as morph targets on the face and brows.
      if (spec.keepMaterials) u.expr = makeExpressions(model);
      if (spec.keepMaterials) softenFace(model);
      // Eyes that turn: the eyes mesh split into two eyeballs on pivots at their centres, riding the head bone.
      if (spec.keepMaterials) u.realEyes = makeRealEyes(model);
      // The coat's seams (the skirt is split front and back, each half on its own leg): vertices that share a
      // position share their skin weights too, so the seams stay closed when the legs part.
      if (spec.keepMaterials) model.traverse((o) => { if (o.isSkinnedMesh && /^coat/.test(o.name)) u.coatWelds = (u.coatWelds || 0) + weldSkin(o.geometry); });
      // Jumpers: the hem follows the hips, not the thighs (sitting, the thighs would pull it into a point), and is a
      // little longer, so it always overlaps the waistband.
      if (spec.keepMaterials) u.topFixed = fixTops(model);
      // The exported hands lost most of their finger width when the meshes were simplified: plump them back up.
      if (spec.keepMaterials) u.fingersPlumped = plumpFingers(model, u.H || 1.7);
      // Skin that pokes through the leggings when a knee bends: the legs under them pulled in a few millimetres.
      if (spec.keepMaterials) u.tucked = tuckLegs(model);
      // Coat tails: spring bones the coat's skirt hangs from (tools/coats.py, coat_L / coat_R).
      u.springs = [];
      model.traverse((o) => { if (o.isBone && /^coat_?[LR]$/.test(o.name.replace(/[^A-Za-z_]/g, ''))) u.springs.push({ bone: o, q0: o.quaternion.clone(), side: /L$/.test(o.name) ? 1 : -1, a: 0, va: 0, b: 0, vb: 0 }); });
      // The model's own arms at rest (for reaching with IK: its arms hang in an A-pose, the rig's straight down).
      u.armRest = u.arms.map((A) => {
        const e = (g) => map.find((q) => q.group === g), es = e(A.sh), ee = e(A.el), eh = A.hand && e(A.hand);
        if (!es || !ee || !eh) return null;
        const P = (q) => new THREE.Vector3().setFromMatrixPosition(q.boneRest);
        const ps = P(es), pe = P(ee), ph = P(eh), shRest = A.sh.getWorldPosition(new THREE.Vector3());
        return { off: ps.clone().sub(shRest), u0: pe.clone().sub(ps).normalize(), v0: ph.clone().sub(pe).normalize(), a: ps.distanceTo(pe), b: pe.distanceTo(ph) };
      });
      // Bones parents before children.
      const depth = (b) => { let d = 0; for (let p = b.parent; p; p = p.parent) d++; return d; };
      map.sort((a, b) => depth(a.bone) - depth(b.bone));
      saved.forEach(([o, p, r]) => { o.position.copy(p); o.rotation.copy(r); });
      root.position.copy(pos0); root.rotation.copy(rot0);
      // Hide procedural body parts.
      const hide = new Set(u.bodyMats);
      root.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && !o.userData.gear && (spec.hideProcedural === 'all' ? !model.getObjectById(o.id) : hide.has(o.material) && !u.lids.includes(o))) o.visible = false; });
      u.retarget = { map, model };
      resolve(true);
    }, (err) => { console.error('model', name, err); resolve(false); });
  });
}
function weldSkin(g) {
  const P = g.attributes.position, I = g.attributes.skinIndex, W = g.attributes.skinWeight; if (!I || !W) return 0;
  const AX = ['X', 'Y', 'Z', 'W'], get = (A, i, j) => A['get' + AX[j]](i), set = (A, i, j, v) => A['set' + AX[j]](i, v);
  const by = new Map(), key = (i) => Math.round(P.getX(i) * 2000) + ',' + Math.round(P.getY(i) * 2000) + ',' + Math.round(P.getZ(i) * 2000);
  for (let i = 0; i < P.count; i++) { const k = key(i); let a = by.get(k); if (!a) by.set(k, (a = [])); a.push(i); }
  let n = 0;
  for (const grp of by.values()) {
    if (grp.length < 2) continue;
    const sum = new Map();
    for (const i of grp) for (let j = 0; j < 4; j++) { const b = get(I, i, j), w = get(W, i, j); if (w > 0) sum.set(b, (sum.get(b) || 0) + w); }
    const top = [...sum.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4), tot = top.reduce((s, e) => s + e[1], 0) || 1;
    for (const i of grp) for (let j = 0; j < 4; j++) { set(I, i, j, top[j] ? top[j][0] : 0); set(W, i, j, top[j] ? top[j][1] / tot : 0); }
    n++;
  }
  I.needsUpdate = W.needsUpdate = true;
  return n;
}
function plumpFingers(model, H) {
  let body = null; model.traverse((o) => { if (o.isSkinnedMesh && /body/.test(o.material.name || '')) body = o; });
  if (!body) return 0;
  const g = body.geometry, P = g.attributes.position, N = g.attributes.normal, I = g.attributes.skinIndex, W = g.attributes.skinWeight;
  if (!N || !I) return 0;
  const bones = body.skeleton.bones, fing = new Set(), AX = ['X', 'Y', 'Z', 'W'];
  bones.forEach((b, i) => { if (/Hand(Thumb|Index|Middle|Ring|Pinky)/.test(b.name)) fing.add(i); });
  const d = 0.0042 * (H / 1.7);
  let n = 0;
  for (let i = 0; i < P.count; i++) {
    let w = 0; for (let j = 0; j < 4; j++) if (fing.has(I['get' + AX[j]](i))) w += W['get' + AX[j]](i);
    if (w < 0.25) continue;
    const k = d * Math.min(1, w);
    P.setXYZ(i, P.getX(i) + N.getX(i) * k, P.getY(i) + N.getY(i) * k, P.getZ(i) + N.getZ(i) * k); n++;
  }
  P.needsUpdate = true;
  return n;
}
function fixTops(model) {
  let n = 0;
  model.traverse((o) => {
    if (!o.isSkinnedMesh || !/^top/.test(o.material.name || '')) return;
    const g = o.geometry, P = g.attributes.position, I = g.attributes.skinIndex, W = g.attributes.skinWeight, bones = o.skeleton.bones;
    const legs = new Set(), hipsI = bones.findIndex((b) => /Hips$/.test(b.name));
    bones.forEach((b, i) => { if (/UpLeg$|Leg$/.test(b.name)) legs.add(i); });
    if (hipsI < 0) return;
    const AX = ['X', 'Y', 'Z', 'W'];
    g.computeBoundingBox(); const y0 = g.boundingBox.min.y, h = g.boundingBox.max.y - y0;
    for (let i = 0; i < P.count; i++) {
      let moved = 0, hipJ = -1;
      for (let j = 0; j < 4; j++) { const b = I['get' + AX[j]](i), w = W['get' + AX[j]](i); if (b === hipsI) hipJ = j; if (legs.has(b) && w > 0) { moved += w; W['set' + AX[j]](i, 0); } }
      if (moved > 0) {
        if (hipJ < 0) { let jm = 0, wm = 9; for (let j = 0; j < 4; j++) { const w = W['get' + AX[j]](i); if (w < wm) { wm = w; jm = j; } } hipJ = jm; I['set' + AX[hipJ]](i, hipsI); W['set' + AX[hipJ]](i, 0); }
        W['set' + AX[hipJ]](i, W['get' + AX[hipJ]](i) + moved); n++;
      }
      // the bottom few centimetres let down a little
      const y = P.getY(i), t = 1 - (y - y0) / (0.05 * h);
      if (t > 0) P.setY(i, y - 0.022 * h * Math.min(1, t));
    }
    I.needsUpdate = W.needsUpdate = P.needsUpdate = true;
  });
  return n;
}
function tuckLegs(model) {
  let body = null, legs = null;
  model.traverse((o) => { if (!o.isMesh) return; const mn = o.material.name || ''; if (/body/.test(mn)) body = o; if (/^legs|leggings/.test(mn) || /leggings/.test(o.name)) legs = o; });
  if (!body || !legs) return 0;
  legs.geometry.computeBoundingBox();
  const lb = legs.geometry.boundingBox, top = lb.max.y - 0.02, xMax = Math.max(Math.abs(lb.min.x), Math.abs(lb.max.x)) + 0.01;
  const g = body.geometry, P = g.attributes.position, N = g.attributes.normal; if (!N) return 0;
  let n = 0;
  for (let i = 0; i < P.count; i++) {
    const y = P.getY(i), x = P.getX(i);
    if (y > top || Math.abs(x) > xMax) continue;
    const d = 0.007 * Math.min(1, (top - y) / 0.04);   // eased in just below the waistband
    P.setXYZ(i, x - N.getX(i) * d, y - N.getY(i) * d, P.getZ(i) - N.getZ(i) * d); n++;
  }
  P.needsUpdate = true;
  return n;
}
function makeRealEyes(model) {
  let eyes = null, head = null;
  model.traverse((o) => { if (o.isMesh && /high-?poly/i.test(o.name)) eyes = o; if (o.isBone && /Head$/.test(o.name)) head = o; });
  if (!eyes || !head || !eyes.geometry.index) return null;
  // The eye texture's cornea is clear (alpha 0) but the exported material is opaque, so the cornea shell was drawn
  // as a pale grey disc over the iris. Cut the clear part away so the iris and pupil show through.
  if (eyes.material && eyes.material.map) { eyes.material.alphaTest = 0.5; eyes.material.transparent = false; eyes.material.needsUpdate = true; }
  eyes.updateMatrixWorld(true);
  const g = eyes.geometry, P = g.attributes.position, Nn = g.attributes.normal, UV = g.attributes.uv, ix = g.index.array, M = eyes.matrixWorld;
  const nm = new THREE.Matrix3().getNormalMatrix(M), v = new THREE.Vector3(), out = [];
  for (const side of [1, -1]) {
    // world-space (rest) positions of this eye's triangles
    const tris = []; for (let t = 0; t < ix.length; t += 3) { let ok = true; for (let j = 0; j < 3; j++) { v.fromBufferAttribute(P, ix[t + j]).applyMatrix4(M); if (Math.sign(v.x) !== side) ok = false; } if (ok) tris.push(t); }
    if (!tris.length) continue;
    const box = new THREE.Box3(); tris.forEach((t) => { for (let j = 0; j < 3; j++) box.expandByPoint(v.fromBufferAttribute(P, ix[t + j]).applyMatrix4(M)); });
    const c = box.getCenter(new THREE.Vector3());
    const pos = [], nor = [], uv = [];
    tris.forEach((t) => { for (let j = 0; j < 3; j++) { const i = ix[t + j]; v.fromBufferAttribute(P, i).applyMatrix4(M).sub(c); pos.push(v.x, v.y, v.z); if (Nn) { v.fromBufferAttribute(Nn, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z); } if (UV) uv.push(UV.getX(i), UV.getY(i)); } });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (nor.length) geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); else geo.computeVertexNormals();
    if (uv.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const mat = eyes.material.clone(); mat.skinning = false;
    const piv = new THREE.Object3D(); piv.position.copy(c); model.parent.add(piv); piv.updateMatrixWorld(true); head.attach(piv);
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; piv.add(mesh);
    out.push({ piv, q0: piv.quaternion.clone(), yaw: 0, pitch: 0 });
  }
  if (out.length === 2) eyes.visible = false;
  return out.length === 2 ? out : null;
}
/* Eyes toward what the character is looking at (or straight ahead), leading the head; quick small saccades
 * between fixations, never further than eyes can turn. After the bones are posed. */
const _eq = new THREE.Quaternion(), _ev = new THREE.Vector3(), _ew = new THREE.Vector3();
function aimEyes(c, u, tgt, dt) {
  const E = u.realEyes; if (!E) return;
  c._sacT = (c._sacT || 0) - dt;
  if (c._sacT <= 0) { c._sacT = 0.35 + Math.random() * (tgt ? 1.4 : 2.2); c._sac = [(Math.random() - 0.5) * (tgt ? 0.06 : 0.16), (Math.random() - 0.5) * (tgt ? 0.04 : 0.1)]; }
  const sac = c._sac || [0, 0];
  for (const e of E) {
    const par = e.piv.parent; par.updateWorldMatrix(true, false);
    let yaw = 0, pitch = 0;
    if (tgt) {
      e.piv.getWorldPosition(_ev);
      _ew.copy(tgt).sub(_ev).normalize();
      // into the eye's rest frame
      _eq.copy(par.getWorldQuaternion(new THREE.Quaternion())).multiply(e.q0).invert();
      _ew.applyQuaternion(_eq);
      yaw = Math.atan2(_ew.x, _ew.z); pitch = -Math.atan2(_ew.y, Math.hypot(_ew.x, _ew.z));
      if (_ew.z < 0.2) { yaw = 0; pitch = 0; }   // behind: no wall-eyes
    }
    yaw = Math.max(-0.55, Math.min(0.55, yaw + sac[0])); pitch = Math.max(-0.35, Math.min(0.3, pitch + sac[1]));
    const k = 1 - Math.exp(-dt * 28);   // eyes are fast
    e.yaw += (yaw - e.yaw) * k; e.pitch += (pitch - e.pitch) * k;
    e.piv.quaternion.copy(e.q0).multiply(_eq.setFromEuler(new THREE.Euler(e.pitch, e.yaw, 0, 'YXZ')));
  }
}
/* Conversation, from the neck up. While a line is being spoken (about as long as it would take to say it), the
 * speaker's head moves with the words: a gentle drift, a small nod on each comma or full stop as the speech reaches
 * it, and a slight tilt held at the end of a question. The other one listens: a small nod when the line ends
 * (sometimes two), a tilt when they've been asked something. Lying down it's all smaller. Narration moves no one. */
function talkHead(c, u, dt, t) {
  const D = G.DLG && G.DLG.cur, sw = !!(G.NIGHT && G.NIGHT.swapped);
  const him = sw ? G.PARTNER : G.PLAYER, her = sw ? G.PLAYER : G.PARTNER;
  const speaker = D && D.who === 'partner' ? her : D && D.who === 'player' ? him : null;
  const T = c._th || (c._th = { line: null, nods: [], tilt: 0, env: 0, done: false, mark: 0 });
  if (D !== T.line) {
    T.line = D; T.done = false; T.mark = 0;
    T.speak = D ? Math.max(0.8, Math.min(6, D.text.replace(/\*[^*]*\*|\([^)]*\)/g, '').length / 15)) : 0;
    T.q = !!D && /\?\s*[”"]?\s*$/.test(D.text);
  }
  const me = speaker === c, listening = !!speaker && !me && Math.hypot(speaker.x - c.x, speaker.z - c.z) < 4 && !c.hidden && !speaker.hidden;
  const el = D ? G.DLG.t : 0, speaking = me && el < T.speak;
  T.env = G.damp(T.env, speaking ? 1 : 0, speaking ? 6 : 3, dt);
  if (me && D) {
    // emphasis: a little nod as the speech passes each comma / full stop
    const reach = Math.floor(Math.min(1, el / T.speak) * D.text.length);
    for (let i = T.mark; i < reach; i++) if (/[,.;!?…—]/.test(D.text[i]) && i < D.text.length - 1) { T.nods.push({ at: t, a: /[.!?]/.test(D.text[i]) ? 0.05 : 0.03 }); break; }
    T.mark = Math.max(T.mark, reach);
  }
  if (D && !T.done && el >= T.speak) {
    T.done = true;
    if (me && T.q) T.tilt = 1;
    if (listening) { T.nods.push({ at: t + 0.22, a: 0.055 }); if (Math.random() < 0.4) T.nods.push({ at: t + 0.62, a: 0.04 }); if (T.q) T.tilt = -1; }
  }
  if (!D) T.tilt = 0;
  c._tiltK = G.damp(c._tiltK || 0, T.tilt, 4, dt);
  let nod = 0;
  T.nods = T.nods.filter((n) => { const k = (t - n.at) / 0.38; if (k < 0) return true; if (k > 1) return false; nod += n.a * Math.sin(Math.PI * k); return true; });
  const amp = c.lie ? 0.55 : 1, sd = c === G.PLAYER ? 0 : 1.7;
  const drift = T.env * (0.022 * Math.sin(t * 2.3 + sd) + 0.014 * Math.sin(t * 3.7 + sd * 2)), yaw = T.env * 0.02 * Math.sin(t * 1.1 + sd);
  u.head.rotation.x += (drift + nod) * amp;
  u.head.rotation.y += yaw * amp;
  u.head.rotation.z += (c._tiltK || 0) * 0.075 * amp * (c === G.PLAYER ? 1 : -1);
}
/* A softer, more natural face. The exports draw the lashes and brows as hard pure black: thick lower lashes read
 * as heavy eyeliner, and the brows as broken black lines, and with dark irises the face seemed to stare.
 *  - lower lashes: taken away (real ones are faint); upper lashes: very dark brown rather than black, a touch softer;
 *  - brows: drawn softly (blended by their own alpha, not cut at a threshold), so they read as hair, not ink.
 * Rest pose, character space. */
function softenFace(model) {
  let eyes = null; const lashes = [], brows = [];
  model.traverse((o) => { if (!o.isMesh) return; const n = o.name.toLowerCase(); if (/kid/.test(n)) return; if (/high-?poly/.test(n)) eyes = o; else if (/eyelash/.test(n)) lashes.push(o); else if (/eyebrow/.test(n)) brows.push(o); });
  if (!eyes) return;
  model.updateMatrixWorld(true);
  const v = new THREE.Vector3(), P = eyes.geometry.attributes.position;
  let ey = 0; for (let i = 0; i < P.count; i++) ey += v.fromBufferAttribute(P, i).applyMatrix4(eyes.matrixWorld).y; ey /= P.count;
  const her = !!lashes.concat(brows).find((o) => /partner/i.test(o.name));
  for (const o of lashes) {
    const g = o.geometry;
    if (g.index && !g.userData.softened) {
      const ix = g.index.array, pos = g.attributes.position, keep = [];
      for (let t = 0; t < ix.length; t += 3) {
        let below = 0; for (let j = 0; j < 3; j++) if (v.fromBufferAttribute(pos, ix[t + j]).applyMatrix4(o.matrixWorld).y < ey - 0.002) below++;
        if (below < 3) keep.push(ix[t], ix[t + 1], ix[t + 2]);
      }
      g.setIndex(keep); g.userData.softened = true;
    }
    const m = o.material; m.emissive = new THREE.Color('#2a1a12'); m.emissiveIntensity = her ? 0.55 : 0.4; m.alphaTest = 0.55; m.needsUpdate = true;
  }
  for (const o of brows) {
    // drawn softly (blended by the texture's own alpha) rather than cut at a threshold, in brown rather than black
    const m = o.material; m.transparent = true; m.alphaTest = 0.03; m.depthWrite = false; m.opacity = 1;
    m.color = new THREE.Color(her ? '#2e1c12' : '#20160f'); m.emissive = new THREE.Color('#000000'); m.needsUpdate = true; o.renderOrder = 2;
  }
}
/* Expressions for heads that have none. Made and checked in Blender first (cozy_characters_expressions.blend:
 * shape keys smile, sad and browsUp on the face and the eyebrows), from the face's own landmarks: the eye centres,
 * the line between the lips (5.8 cm below her eye line, 7.4 cm below his) and the mouth corners (0.41 of the eye
 * spacing out from the middle). The same soft displacement fields are rebuilt here as morph targets when the
 * models load, scaled by eye spacing, so the exported models stay as they are.
 *  - smile: the corners up and out and a little back, the cheeks lifted;
 *  - sad: the corners down, the inner brows up;
 *  - browsUp: both brows raised. */
const EXPR_LM = { partner: { d: 0.055, mouth: 0.058, brow: 0.012 }, player: { d: 0.0644, mouth: 0.074, brow: 0.010 } };
const EXPR_KINDS = ['smile', 'sad', 'browsUp', 'open', 'round'];
function makeExpressions(model) {
  let eyes = null, skin = null, brow = null, who = null;
  model.traverse((o) => {
    if (!o.isMesh) return;
    const n = o.name.toLowerCase();
    if (/kid/.test(n)) return;
    if (/high-?poly/.test(n)) eyes = o;
    else if (/eyebrow/.test(n)) brow = o;
    else if (/^human_(partner|player)$/.test(n)) { skin = o; who = RegExp.$1; }
  });
  if (!eyes || !skin || !who) return null;
  model.updateMatrixWorld(true);
  const v = new THREE.Vector3(), E = [];
  const P = eyes.geometry.attributes.position;
  let mx = 0; for (let i = 0; i < P.count; i++) mx += v.fromBufferAttribute(P, i).applyMatrix4(eyes.matrixWorld).x; mx /= P.count;
  const acc = [new THREE.Vector3(), new THREE.Vector3()], cnt = [0, 0];
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(eyes.matrixWorld); const k = v.x > mx ? 0 : 1; acc[k].add(v); cnt[k]++; }
  if (!cnt[0] || !cnt[1]) return null;
  const eA = acc[0].divideScalar(cnt[0]), eB = acc[1].divideScalar(cnt[1]), M = eA.clone().add(eB).multiplyScalar(0.5), d = eA.distanceTo(eB);
  const L = EXPR_LM[who], k = d / L.d;
  const ss = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  const field = (kind, p, out, seam) => {
    const side = p.x > M.x ? 1 : -1, dx = (p.x - M.x) * side, up = p.y - M.y, fwd = p.z - M.z;
    out.set(0, 0, 0);
    if (fwd < -0.02 * k) return out;
    const blob = (x0, z0, r, a, b, c) => { const w = 1 - ss(Math.hypot(dx - x0, up - z0) / r); out.x += w * a; out.y += w * b; out.z += w * c; };
    const cx = 0.41 * d, cz = -L.mouth * k, by = L.brow * k;
    // the mouth corners, not the whole mouth: the middle of the lips stays put, so the line curves rather than lifts
    const corner = (r) => (1 - ss(Math.hypot(dx - cx, up - cz) / r)) * (0.2 + 0.8 * ss(dx / cx));
    const band = (x0, y0, rx, ry) => (1 - ss(Math.abs(dx - x0) / rx)) * (1 - ss(Math.abs(up - y0) / ry));
    if (kind === 'smile') {
      const w = corner(0.42 * d); out.x += w * 0.0042 * k; out.y += w * 0.0052 * k; out.z -= w * 0.0016 * k;      // corners up, out and back
      blob(0.5 * d, -0.45 * d, 0.4 * d, 0.0004 * k, 0.0024 * k, 0.0012 * k);                                    // the cheeks lift and round
      const lid = band(0.5 * d, -0.3 * d, 0.42 * d, 0.16 * d); out.y += lid * 0.0011 * k; out.z += lid * 0.0004 * k;  // and the eyes smile too
    } else if (kind === 'sad') {
      const w = corner(0.42 * d); out.x -= w * 0.0008 * k; out.y -= w * 0.0034 * k;                               // corners down
      blob(0.18 * d, by + 0.003 * k, 0.36 * d, -0.0008 * k, 0.0048 * k, 0.0004 * k);                            // inner brows up and together
      blob(0.85 * d, by, 0.3 * d, 0, -0.0012 * k, 0);                                                            // the outer ends drop a little
    }
    else if (kind === 'browsUp') { const w = (1 - ss(dx / (1.05 * d))) * (1 - ss(Math.abs(up - (by + 0.006 * k)) / (0.03 * k))); out.y += 0.0055 * k * w; out.z += 0.0006 * k * w; }
    else if (kind === 'open') {
      // the jaw drops: everything below the line between the lips, down to under the chin, fading toward the ears
      // which lip a vertex is on (seam: 1 upper, -1 lower, worked out below), so the mouth opens between them cleanly
      const ue = seam && Math.abs(up - cz) < 0.004 * k ? cz + seam * 0.002 * k : up;
      const lw = ss((cz - ue) / (0.002 * k)), hz = 1 - ss(dx / (1.25 * d)), vz = 1 - ss((cz - 0.045 * k - up) / (0.02 * k)), fz = ss((fwd + 0.02 * k) / (0.03 * k));
      const w = lw * hz * vz * fz; out.y -= w * 0.009 * k; out.z -= w * 0.0025 * k;
      const uw = (1 - ss((ue - cz) / (0.008 * k))) * (1 - ss(dx / (0.5 * d))) * (1 - lw); out.y += uw * 0.0012 * k;   // the upper lip lifts a touch
      out.x -= corner(0.3 * d) * 0.0015 * k;                                                                      // and the corners come in
    } else {
      // rounded (oo, w): the lips come in from the corners and push forward
      const r0 = 1 - ss(Math.hypot(dx / (0.55 * d), (up - cz) / (0.02 * k))); out.x -= dx * 0.25 * r0; out.z += r0 * 0.003 * k;
    }
    out.x *= side; return out;
  };
  const meshes = [];
  for (const o of [skin, brow]) {
    if (!o) continue;
    const g = o.geometry;
    if (!g.userData.expr) {
      const pos = g.attributes.position, inv = new THREE.Matrix3().setFromMatrix4(o.matrixWorld).invert(), dw = new THREE.Vector3();
      // Which lip each vertex near the mouth belongs to. The lips meet with no gap, so position can't tell; but between
      // the corners the upper and lower lip aren't joined, so each is what's connected to a point well above (or below)
      // the line without going round a corner. Elsewhere (and where both or neither reach), position decides.
      const lab = new Int8Array(pos.count);
      if (o === skin && g.index) {
        const ix = g.index.array, W = [], inBox = new Uint8Array(pos.count), U = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); const dx = Math.abs(v.x - M.x), up = v.y - M.y + L.mouth * k, fwd = v.z - M.z;
          U[i * 2] = up; U[i * 2 + 1] = dx < 0.03 * k && Math.abs(up) < 0.03 * k && fwd > -0.01 * k ? 1 : 0; if (dx < 0.018 * k && Math.abs(up) < 0.03 * k && fwd > -0.01 * k) inBox[i] = 1;
        }
        const adj = new Map();
        for (let t = 0; t < ix.length; t += 3) for (let q = 0; q < 3; q++) { const i0 = ix[t + q]; if (!inBox[i0]) continue; for (let r = 1; r < 3; r++) { const j = ix[t + (q + r) % 3]; if (!inBox[j]) continue; let l = adj.get(i0); if (!l) adj.set(i0, l = []); l.push(j); } }
        const reach = (pick) => { const seen = new Uint8Array(pos.count), st = []; for (const i of adj.keys()) if (pick(U[i * 2])) { seen[i] = 1; st.push(i); } while (st.length) { const i = st.pop(); for (const j of adj.get(i) || []) if (!seen[j]) { seen[j] = 1; st.push(j); } } return seen; };
        const hi = reach((up) => up > 0.003 * k), lo = reach((up) => up < -0.003 * k);
        for (let i = 0; i < pos.count; i++) if (hi[i] !== lo[i]) lab[i] = hi[i] ? 1 : -1;
        // Inside the mouth in shadow: the mouth's lining (its own patch of the texture, painted flat red) and the
        // inner faces of the lips, which only show when it opens. Darkened through vertex colours.
        const UV = g.attributes.uv;
        if (UV && !g.attributes.color) {
          const col = new Float32Array(pos.count * 3).fill(1), sc = UV.array instanceof Uint16Array ? 1 / 65535 : 1;
          for (let i = 0; i < pos.count; i++) {
            if (!U[i * 2 + 1]) continue;
            const lining = UV.getY(i) * sc > 0.76, innerLip = lab[i] && Math.abs(U[i * 2]) < 0.0025 * k;
            const f = lining ? 0.16 : innerLip ? 0.5 : 1;
            col[i * 3] = f; col[i * 3 + 1] = f * 0.9; col[i * 3 + 2] = f * 0.9;
          }
          g.setAttribute('color', new THREE.BufferAttribute(col, 3)); o.material.vertexColors = true;
        }
      }
      g.morphAttributes.position = EXPR_KINDS.map((kind) => {
        const a = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) {
          field(kind, v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld), dw, lab[i]);
          if (dw.x || dw.y || dw.z) { dw.applyMatrix3(inv); a[i * 3] = dw.x; a[i * 3 + 1] = dw.y; a[i * 3 + 2] = dw.z; }
        }
        return new THREE.BufferAttribute(a, 3);
      });
      g.morphTargetsRelative = true; g.userData.expr = true;
    }
    o.material.morphTargets = true; o.material.needsUpdate = true;
    o.updateMorphTargets();
    meshes.push(o);
  }
  // The mouth's lining doesn't close at the back, so an open mouth would show through the head (to the scarf, say).
  // A dark pocket inside the head, behind the lining, where only the open mouth can see it.
  let head = null; model.traverse((o) => { if (o.isBone && /Head$/.test(o.name) && !head) head = o; });
  if (head && model.parent) {
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1c0d0b').convertSRGBToLinear(), roughness: 0.9, envMapIntensity: 0, side: THREE.DoubleSide });
    const cav = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 16, 10), mat);
    cav.scale.set(0.022 * k, 0.012 * k, 0.011 * k); cav.position.set(M.x, M.y - L.mouth * k - 0.004 * k, M.z - 0.002 * k);
    cav.castShadow = cav.receiveShadow = false; cav.userData.mouth = true;
    model.parent.add(cav); cav.updateMatrixWorld(true); head.attach(cav);
    // The upper teeth: a shallow arc just behind the upper lip, its edge 1.5 mm (his 2.8) below the line between the lips, so
    // they're hidden when the mouth is shut and a sliver shows when it opens. Shaded down toward the sides and the
    // gum, where the mouth is in shadow, with the faintest line between each tooth. (They're the skull's, so they
    // stay with the head; the lower ones would be behind the lower lip.)
    const R = 0.022 * k, A = 0.7, top = 0.007 * k, bot = (who === 'player' ? -0.0028 : -0.0015) * k, F = (who === 'player' ? 0.014 : 0.0125) * k;   // his lips are fuller
    const tg = new THREE.CylinderBufferGeometry(R, R, top - bot, 40, 3, true, -A, 2 * A), tp = tg.attributes.position, tc = new Float32Array(tp.count * 3);
    for (let i = 0; i < tp.count; i++) {
      const th = Math.atan2(tp.getX(i), tp.getZ(i)), yy = (tp.getY(i) + (top - bot) / 2) / (top - bot), a = Math.abs(th) / A;
      const gap = [0, 0.39, 0.7].some((b) => Math.abs(Math.abs(th) - b) < 0.025) ? 0.82 : 1;
      const f = (1 - 0.6 * a * a) * (0.55 + 0.45 * (1 - yy)) * gap;
      tc[i * 3] = f; tc[i * 3 + 1] = f * 0.97; tc[i * 3 + 2] = f * 0.92;
    }
    tg.setAttribute('color', new THREE.BufferAttribute(tc, 3));
    const tm = new THREE.MeshStandardMaterial({ color: new THREE.Color('#d4cab8').convertSRGBToLinear(), roughness: 0.4, envMapIntensity: 0.3, vertexColors: true, side: THREE.DoubleSide });
    G.MATS && G.MATS.push(tm);
    const teeth = new THREE.Mesh(tg, tm);
    teeth.position.set(M.x, M.y - L.mouth * k + (top + bot) / 2, M.z + F - R);
    teeth.castShadow = teeth.receiveShadow = false; teeth.userData.mouth = true;
    model.parent.add(teeth); teeth.updateMatrixWorld(true); head.attach(teeth);
  }
  return { meshes, v: { smile: 0, sad: 0, browsUp: 0, open: 0, round: 0 } };
}
/* What each face is doing: from the line being said (or her last bark), the moment, and who it is.
 *  - Only clear feeling moves the face: laughter and love smile most, a plain "good" or "!" only a little; sorry,
 *    alone, afraid and the like look sad. Everyday words (cold, never, please) don't.
 *  - A question lifts the brows as it's asked, then they settle; they don't stay up the whole line.
 *  - Each line's feeling is a little different in strength, comes in quickly and goes slowly, so a smile lingers.
 *  - The one listening answers a smile with a smaller one, and a sad line with a little concern; never a copy.
 *  - At rest, when you're together, both are very slightly smiling. The thing in the night smiles, evenly, the
 *    whole time: the same smile, never more, never less. */
const EXPR_LAUGH = /\b(ha(ha)+|hah|laugh(ing|s)?|giggl\w*)\b|\*grins?\*|\*smil|\*laugh/i;
const EXPR_WARM = /\b(love|lovely|perfect|happy|marry|kiss|gold star|snow day|beautiful|wonderful|hero|favourite|best)\b/i;
const EXPR_LIGHT = /\b(good|nice|yes|warm|great|thank(s| you)|clever|cosy|cozy|fun)\b|!/i;
const EXPR_SAD = /\b(sorry|miss(ed|ing)?|alone|lonely|afraid|scared|frightened|lost|cry(ing)?|don[’']t go|don[’']t leave|wish you|i[’']m tired)\b/i;
const exprHash = (t) => { let h = 7; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return ((h >>> 0) % 1000) / 1000; };
function exprRead(text) {
  const t = text.replace(/\([^)]*\)/g, ''), r = { smile: 0, sad: 0, q: /\?\s*[”"’]?\s*$/.test(t) }, vary = 0.85 + 0.25 * exprHash(t);
  if (EXPR_SAD.test(t)) r.sad = 0.55 * vary;
  else if (EXPR_LAUGH.test(t)) { r.smile = 0.85 * vary; r.laugh = true; }
  else if (EXPR_WARM.test(t)) r.smile = 0.6 * vary;
  else if (EXPR_LIGHT.test(t)) r.smile = 0.32 * vary;
  return r;
}
/* Mouth shapes from the letters of what's being said, read along at the speed it's spoken: open vowels open the
 * jaw, o / u / w round the lips, m / b / p close them, the rest part them a little. Spaces and punctuation rest.
 * Not true speech sounds, but enough for the mouth to move with the words rather than flap. */
const MOUTH = { a: [0.7, 0], e: [0.45, 0], i: [0.35, 0], o: [0.5, 0.65], u: [0.25, 0.85], w: [0.15, 0.9], y: [0.3, 0], h: [0.4, 0], r: [0.25, 0.3], m: [0, 0], b: [0, 0], p: [0, 0], f: [0.08, 0], v: [0.08, 0] };
function mouthAt(X, text, f) {
  if (X.mText !== text) { X.mText = text; X.mClean = text.replace(/\*[^*]*\*|\([^)]*\)|<[^>]*>/g, '').toLowerCase(); }
  const s = X.mClean, n = s.length; if (!n) return [0, 0];
  const p = Math.min(n - 1, f * n), i = Math.floor(p), ch = s[i];
  if (!/[a-z]/.test(ch)) return [0, 0];
  const m = MOUTH[ch] || [0.2, 0], g = 0.8 + 0.4 * (((i * 2654435761) >>> 0) % 100) / 100;   // a little variety, letter to letter
  return [m[0] * g, m[1]];
}
function exprUpdate(c, u, dt) {
  const X = u.expr; if (!X || c.hidden) return;
  const D = G.DLG && G.DLG.cur, sw = !!(G.NIGHT && G.NIGHT.swapped);
  const him = sw ? G.PARTNER : G.PLAYER, her = sw ? G.PLAYER : G.PARTNER, isHer = c === her;
  const speaker = D && D.who === 'partner' ? her : D && D.who === 'player' ? him : null;
  const T = { smile: 0, sad: 0, browsUp: 0 };
  if (!X.cache) X.cache = { text: null, r: null };
  const read = (text, w, own, t) => {
    if (!text) return;
    if (X.cache.text !== text) X.cache = { text, r: exprRead(text) };
    const r = X.cache.r;
    if (own) {
      T.smile = Math.max(T.smile, r.smile * w); T.sad = Math.max(T.sad, r.sad * w);
      // brows: up as the question is asked, then back down
      if (r.q) T.browsUp = Math.max(T.browsUp, 0.45 * w * (t < 0.15 ? t / 0.15 : t < 1.8 ? 1 : Math.max(0.2, 1 - (t - 1.8) / 0.8)));
    } else {
      T.smile = Math.max(T.smile, r.smile * 0.45 * w);                       // a smaller smile back
      if (r.sad) { T.sad = Math.max(T.sad, 0.25 * w); T.browsUp = Math.max(T.browsUp, 0.1 * w); }   // concern, not a copy
    }
  };
  const asleep = c.lidsClosed && c.lie;
  const S = G.S, night = S && S.chapter === 'night' && isHer && !sw;
  if (!asleep) {
    const t = (G.DLG && G.DLG.t) || 0;
    if (speaker === c) read(D.text, 1, true, t);
    else if (speaker && Math.hypot(speaker.x - c.x, speaker.z - c.z) < 4) read(D.text, 1, false, t);
    if (isHer && c.bark && c.bark.text) read(c.bark.text, 0.8, true, 1);
    const near = Math.hypot(G.PLAYER.x - G.PARTNER.x, G.PLAYER.z - G.PARTNER.z) < 3;
    if (near && !night && !T.sad) T.smile = Math.max(T.smile, isHer ? 0.16 : 0.08);
    if (night && !c.lie) { T.smile = 0.3; T.sad = 0; T.browsUp = 0; }   // it smiles. It doesn't stop.
  }
  // The mouth, while speaking: the sounds of the words as they're reached
  T.open = 0; T.round = 0;
  if (!asleep) {
    let text = null, el = 0, dur = 0;
    if (speaker === c && c._th && c._th.line === D) { text = D.text; el = (G.DLG && G.DLG.t) || 0; dur = c._th.speak; }
    else if (isHer && c.bark && c.bark.text && !(speaker === c)) { const b = c.bark; if (b.t0 == null) b.t0 = b.t; text = b.text; el = b.t0 - b.t; dur = Math.max(0.6, Math.min(4, b.text.length / 15)); }
    if (text && el < dur) { const m = mouthAt(X, text, el / dur); T.open = m[0] * (c.lie ? 0.6 : 1); T.round = m[1]; }
    // a laugh opens the smile for a moment, in little bursts
    if (text && X.cache.text === text && X.cache.r.laugh && el < 1.3 && !night) T.open = Math.max(T.open, (0.22 + 0.14 * Math.sin(el * 15)) * (1 - el / 1.3));
  }
  const inf = [];
  for (const kind of EXPR_KINDS) {
    const cur = X.v[kind], to = T[kind];
    X.v[kind] = kind === 'open' || kind === 'round' ? G.damp(cur, to, 20, dt)
      : night ? to : G.damp(cur, to, to > cur ? 4 : kind === 'browsUp' ? 2.5 : 1.1, dt);   // quick in, slow out (the night's never moves)
    inf.push(X.v[kind]);
  }
  if (X.forced) inf.splice(0, X.forced.length, ...X.forced);   // tests
  for (const m of X.meshes) if (m.morphTargetInfluences) for (let i = 0; i < inf.length; i++) m.morphTargetInfluences[i] = inf[i];
}
/* Eyelids for a model whose head has no blink shapes: a cap over each eyeball (the eyes mesh split left and right),
 * attached to the head bone, in the face's average skin colour; shown while the eyes are shut. */
const LID_REST = 0.05, LID_COVER = Math.PI * 0.28, LID_SHUT = 1.36, LID_EDGE = 0.3;   // the cap: the top 50 degrees of the eye; swung 78 degrees forward it covers it. The first 30% of the swing is under the brow.
function setRealLids(u, a) {   // a: 0 open, 1 shut (measured from the visible edge of the eye)
  for (const pv of u.realLids) { const cap = pv.userData.cap; cap.rotation.x = (LID_EDGE + a * (1 - LID_EDGE)) * LID_SHUT; cap.visible = a > 0.01; }
}
function makeRealLids(model) {
  let eyes = null, skin = null, head = null;
  model.traverse((o) => { if (o.isMesh && /high-?poly/i.test(o.name)) eyes = o; if (o.isMesh && /body/.test(o.material.name || '')) skin = o; if (o.isBone && /Head$/.test(o.name)) head = o; });
  if (!eyes || !head) return null;
  eyes.updateMatrixWorld(true); if (skin) skin.updateMatrixWorld(true);
  const pos = eyes.geometry.attributes.position, v = new THREE.Vector3(), out = [];
  // The skin texture, small enough to read quickly.
  let pix = null, PW = 0, PH = 0;
  try {
    const img = skin && skin.material.map && skin.material.map.image;
    if (img) { PW = PH = 256; const cv = document.createElement('canvas'); cv.width = PW; cv.height = PH; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, PW, PH); pix = cx.getImageData(0, 0, PW, PH).data; }
  } catch (e) { pix = null; }
  for (const side of [1, -1]) {
    const pts = [];
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(eyes.matrixWorld); if (Math.sign(v.x) === side) pts.push(v.clone()); }
    if (pts.length < 8) continue;
    const box = new THREE.Box3().setFromPoints(pts), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    const r = Math.max(sz.x, sz.y) * 0.5;
    // Colour: the skin of the lid itself, sampled from the face texture just above and around this eye (the old
    // whole-texture average came out grey-brown); a touch warmer and darker, as a closed lid in the eye's shade.
    let col = new THREE.Color(0xd9a98f).convertSRGBToLinear();
    if (pix && skin.geometry.attributes.uv) {
      // the face skin round the eye (cheek, temple, brow bone), leaving out the darker texels (lashes, brows, the
      // socket's painted shadow): the brighter half's average is the lid's own colour
      const SP = skin.geometry.attributes.position, UV = skin.geometry.attributes.uv, samp = [];
      for (let i = 0; i < SP.count; i++) {
        v.fromBufferAttribute(SP, i).applyMatrix4(skin.matrixWorld);
        const dx = v.x - c.x, dy = v.y - c.y, dz = v.z - c.z;
        if (dz < -r || dx * dx + dy * dy > (r * 5) * (r * 5) || dz > r * 4) continue;
        const u = UV.getX(i), w = UV.getY(i);
        const px = Math.max(0, Math.min(PW - 1, Math.round(u * (PW - 1)))), py = Math.max(0, Math.min(PH - 1, Math.round(w * (PH - 1))));
        const k = (py * PW + px) * 4; if (pix[k + 3] < 128) continue;
        samp.push([pix[k], pix[k + 1], pix[k + 2], pix[k] * 0.3 + pix[k + 1] * 0.59 + pix[k + 2] * 0.11]);
      }
      if (samp.length >= 6) {
        samp.sort((a, b) => b[3] - a[3]); const top = samp.slice(0, Math.max(3, Math.floor(samp.length * 0.5)));
        const avg = [0, 1, 2].map((j) => top.reduce((t, x) => t + x[j], 0) / top.length / 255);
        col = new THREE.Color(avg[0] * 0.96, avg[1] * 0.93, avg[2] * 0.93).convertSRGBToLinear();
      }
    }
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.62, envMapIntensity: 0.25 });
    G.MATS && G.MATS.push(mat);
    // The cap hugs the eyeball (just over the cornea), so the face around the opening hides its edge as real
    // lids do; before, it was bigger than the eye and stood out past the lashes.
    // A real lid comes down over the eye and goes back up; it doesn't appear. So the cap sits over the top of the
    // eyeball, tucked under the brow (its front edge at the upper lash line), and swings forward and down about the
    // eye's centre to close: part way for a softer look when smiling, all the way for a blink or sleep.
    const pivot = new THREE.Object3D(); pivot.position.copy(c); pivot.position.z -= r * 0.02;
    // Its edge darkens into a lash line, and the lid itself sits a little in the brow's shade, so a lid part way down
    // reads as a lid, not a patch of skin with a hard edge.
    const lg = new THREE.SphereBufferGeometry(r * 1.035, 24, 14, 0, Math.PI * 2, 0, LID_COVER), lp = lg.attributes.position, cols = new Float32Array(lp.count * 3);
    for (let i = 0; i < lp.count; i++) {
      const t = Math.acos(Math.max(-1, Math.min(1, lp.getY(i) / (r * 1.035)))) / LID_COVER, e = Math.max(0, Math.min(1, (t - 0.72) / 0.28)), sh = 0.9 * (1 - 0.55 * e * e * (3 - 2 * e));
      cols[i * 3] = sh; cols[i * 3 + 1] = sh * 0.97; cols[i * 3 + 2] = sh * 0.95;
    }
    lg.setAttribute('color', new THREE.BufferAttribute(cols, 3)); mat.vertexColors = true;
    const lid = new THREE.Mesh(lg, mat);
    lid.castShadow = false; lid.visible = false; lid.userData.lid = true;
    pivot.add(lid); pivot.userData.cap = lid;
    model.parent.add(pivot); pivot.updateMatrixWorld(true); head.attach(pivot);
    out.push(pivot);
  }
  return out.length ? out : null;
}
/* Finger chains of a Mixamo-style hand, with the axis that curls each one toward the palm.
 * The palm side is the side the thumb sits on; the axis is whichever local one moves the fingertip that way. */
function findFingers(model) {
  const by = {}; model.traverse((o) => { if (o.isBone) by[o.name.replace(/[^A-Za-z0-9]/g, '')] = o; });
  const out = [];
  for (const side of ['Left', 'Right']) {
    const hand = by['mixamorig' + side + 'Hand']; if (!hand) continue;
    const W = (o) => o.getWorldPosition(new THREE.Vector3());
    const h = W(hand), idx = by['mixamorig' + side + 'HandIndex1'], pky = by['mixamorig' + side + 'HandPinky1'], th = by['mixamorig' + side + 'HandThumb1'];
    if (!idx || !pky || !th) continue;
    let n = W(idx).sub(h).cross(W(pky).sub(h)).normalize();
    if (W(th).sub(h).dot(n) < 0) n.negate();   // n points out of the palm
    for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
      const chain = [1, 2, 3].map((i) => by['mixamorig' + side + 'Hand' + f + i]).filter(Boolean);
      if (chain.length < 2) continue;
      const b0 = chain[0], tip = chain[chain.length - 1], q0 = b0.quaternion.clone();
      let best = null;
      for (const ax of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)]) {
        const before = W(tip);
        b0.quaternion.copy(q0).multiply(new THREE.Quaternion().setFromAxisAngle(ax, 0.5)); b0.updateMatrixWorld(true);
        const d = W(tip).sub(before).dot(n);
        b0.quaternion.copy(q0); b0.updateMatrixWorld(true);
        if (!best || Math.abs(d) > Math.abs(best.d)) best = { ax, d };
      }
      const sgn = best.d >= 0 ? 1 : -1;
      // And the axis that closes the finger toward the middle one (the base mesh is modelled splayed).
      let close = null;
      const mid = by['mixamorig' + side + 'HandMiddle1'];
      const toward = f === 'Thumb' ? idx : mid;   // fingers close toward the middle one, the thumb toward the index
      if (f !== 'Middle' && toward) {
        const toMid = W(toward).sub(W(b0));
        for (const ax of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)]) {
          if (Math.abs(ax.dot(best.ax)) > 0.9) continue;
          const before = W(tip);
          b0.quaternion.copy(q0).multiply(new THREE.Quaternion().setFromAxisAngle(ax, 0.3)); b0.updateMatrixWorld(true);
          const d = W(tip).sub(before).dot(toMid);
          b0.quaternion.copy(q0); b0.updateMatrixWorld(true);
          if (!close || Math.abs(d) > Math.abs(close.d)) close = { ax, d };
        }
      }
      const spread = { Thumb: 0.38, Index: 0.14, Ring: 0.12, Pinky: 0.26 }[f] || 0;
      chain.forEach((b, j) => out.push({ bone: b, q0: b.quaternion.clone(), ax: best.ax.clone().multiplyScalar(sgn), finger: f, j, side,
        adx: j === 0 && close ? close.ax.clone().multiplyScalar(close.d >= 0 ? 1 : -1) : null, ad: spread }));
    }
  }
  return out;
}
const _ik = { S: new THREE.Vector3(), T: new THREE.Vector3(), E: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4() };
const _down = new THREE.Vector3(0, -1, 0);
function hugIK(c, u, wgt) {
  const o = c.hugWith, ou = o.m.userData, tall = u.H >= ou.H;
  c.m.updateMatrixWorld(true); o.m.updateMatrixWorld(true);
  const oc = ou.chest.getWorldPosition(new THREE.Vector3()), back = new THREE.Vector3(-Math.sin(o.yaw), 0, -Math.cos(o.yaw));
  const myC = u.chest.getWorldPosition(new THREE.Vector3());
  u.arms.forEach((A, i) => {
    const R = u.armRest && u.armRest[i];
    const S = R ? A.sh.parent.localToWorld(A.sh.position.clone().add(R.off)) : A.sh.getWorldPosition(new THREE.Vector3());
    const side = S.clone().sub(myC); side.y = 0; side.normalize();
    // On their back: over the shoulder blades for the taller one, the small of the back for the other.
    const T = oc.clone().addScaledVector(back, (tall ? 0.08 : 0.07) * ou.k).addScaledVector(side, (tall ? 0.11 : 0.15) * ou.k);
    T.y += (tall ? 0.04 : -0.16) * ou.k;
    solveArm(c, u, A, i, T, wgt, 0.6);
  });
}
/* Holding hands: the holding hand reaches for a point between the two of you, at hand height, swinging a
 * little with the stride; both reach for the same point, so the hands actually meet. */
function holdIK(c, u, wgt) {
  const o = c.holdWith, ou = o.m.userData, i = c.holdArm, A = u.arms[i], oi = o.holdArm, OA = ou.arms[oi];
  if (!A || !OA) return;
  c.m.updateMatrixWorld(true); o.m.updateMatrixWorld(true);
  const sh = (uu, AA, k) => { const R = uu.armRest && uu.armRest[k]; return R ? AA.sh.parent.localToWorld(AA.sh.position.clone().add(R.off)) : AA.sh.getWorldPosition(new THREE.Vector3()); };
  const S = sh(u, A, i), OS = sh(ou, OA, oi);
  const reach = (uu, k, AA) => { const R = uu.armRest && uu.armRest[k]; return R ? R.a + R.b : Math.abs(AA.el.position.y) + Math.abs((AA.hand || AA.el).position.y); };
  const T = S.clone().add(OS).multiplyScalar(0.5);
  // hand height: a little below the shorter one's straight-arm reach, so neither has to stretch
  T.y = Math.max(S.y - reach(u, i, A) * 0.9, OS.y - reach(ou, oi, OA) * 0.9);
  const fw = new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw)), sw = Math.min(1, (c.speed || 0) / 1.5);
  T.addScaledVector(fw, 0.05 + Math.sin(c.phase || 0) * 0.07 * sw);
  solveArm(c, u, A, i, T, wgt, 0.2);
}
// Reaching for a thing you're using (the kettle, a door, the radio): turn to it, the nearer hand goes out, touches,
// and comes back. Started by G.startReach; it lets go if you walk off or sit down, or a scene moves you.
const _rv = new THREE.Vector3();
G.startReach = (c, it, dur = 1.15) => {
  if (!it || !it.pos || c.lie || (c.sit || 0) > 0.2 || c.freeSit || it.noReach) return;
  const [x, y, z] = it.pos, d = Math.hypot(x - c.x, z - c.z);
  if (d > 1.7 || d < 0.2 || y < 0.55 || y > 1.85) return;
  const o = c === G.PLAYER ? G.PARTNER : G.PLAYER;
  if (!o.hidden && Math.hypot(x - o.x, z - o.z) < 0.7) return;   // that's a person, not a thing
  c.reach = { x, y, z, t: 0, dur, x0: c.x, z0: c.z, yaw: Math.atan2(x - c.x, z - c.z), arm: null };
};
function reachIK(c, u, dt) {
  const R = c.reach; R.t += dt;
  if (R.t >= R.dur || (c.sit || 0) > 0.2 || c.lie || Math.hypot(c.x - R.x0, c.z - R.z0) > 0.45 || (c.hug || 0) > 0.05) { c.reach = null; return; }
  // Turn to face it first (only standing still, and not all the way round).
  let dy = R.yaw - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  if ((c.speed || 0) < 0.3 && R.t < 0.5 && Math.abs(dy) < 2.2) c.yaw += dy * Math.min(1, dt * 7);
  c.m.updateMatrixWorld(true);
  if (R.arm == null) {   // the nearer hand, for the whole reach
    let bd = 1e9; u.arms.forEach((A, i) => { if (!A) return; A.sh.getWorldPosition(_rv); const dd = Math.hypot(_rv.x - R.x, _rv.z - R.z); if (dd < bd) { bd = dd; R.arm = i; } });
    if (R.arm == null || bd > 1.6) { c.reach = null; return; }
  }
  const A = u.arms[R.arm]; if (!A) { c.reach = null; return; }
  // out (0.3 s), hold, back (0.4 s); the hand stops just short of the thing rather than inside it
  const k = R.t < 0.34 ? G.smooth(0, 0.34, R.t) : R.t > R.dur - 0.4 ? 1 - G.smooth(R.dur - 0.4, R.dur, R.t) : 1;
  u.spine.rotation.x += k * 0.14 * Math.min(1, Math.max(0, (1.25 - R.y) * 2));   // a little lean for low things
  c.m.updateMatrixWorld(true);
  A.sh.getWorldPosition(_rv);
  const T = new THREE.Vector3(R.x, R.y, R.z); T.lerp(_rv, 0.1);
  solveArm(c, u, A, R.arm, T, k * 0.92, 0.35);
}
// In bed together: her top arm across his chest; his near arm round her, hand at her back.
function cuddleIK(c, u) {
  const o = c.cuddle.with, ou = o.m.userData; if (!ou.chest || !u.arms) return;
  c.m.updateMatrixWorld(true); o.m.updateMatrixWorld(true);
  const oc = ou.chest.getWorldPosition(new THREE.Vector3()), mc = u.chest.getWorldPosition(new THREE.Vector3());
  let arm = -1, T;
  if (c.cuddle.role === 'drape') {
    // the upper arm (she's on her side): the shoulder that's higher; the hand comes to rest on his far side of the chest
    let best = -1e9; u.arms.forEach((A, i) => { if (!A) return; const y = A.sh.getWorldPosition(_rv).y; if (y > best) { best = y; arm = i; } });
    // elbow bent, the forearm lying across him and the hand resting on the middle of his chest
    const oh = (ou.hips || ou.chest).getWorldPosition(new THREE.Vector3());
    T = oc.clone().lerp(oh, 0.6).lerp(mc, 0.15); T.y = Math.max(oc.y, oh.y) + 0.04;
  } else {
    // the arm nearer to her goes round under her shoulders, hand on her far side
    let bd = 1e9; u.arms.forEach((A, i) => { if (!A) return; const d = A.sh.getWorldPosition(_rv).distanceTo(oc); if (d < bd) { bd = d; arm = i; } });
    const away = oc.clone().sub(mc); away.y = 0; away.normalize();
    T = oc.clone().addScaledVector(away, 0.06); T.y -= 0.11;
  }
  if (arm < 0 || !u.arms[arm]) return;
  solveArm(c, u, u.arms[arm], arm, T, 0.95, 0.4);
  // his other hand rests on his own stomach, not out at his side
  if (c.cuddle.role === 'hold') {
    const other = arm ? 0 : 1, A = u.arms[other];
    if (A && u.hips) { const H = u.hips.getWorldPosition(new THREE.Vector3()), C = mc.clone(); const R = H.lerp(C, 0.4); R.y += 0.06; solveArm(c, u, A, other, R, 0.9, 0.3); }
  }
}
// Taking someone by the wrist: arm 0 reaches for the other one's arm-1 hand, wherever their pose has put it
// (they're facing each other, so that's the hand straight across).
function grabIK(c, u) {
  const o = c.grabWith, OA = o.m.userData.arms[1], A = u.arms[0];
  if (!A || !OA) return;
  c.m.updateMatrixWorld(true); o.m.updateMatrixWorld(true);
  const T = (OA.hand || OA.el).getWorldPosition(new THREE.Vector3());
  T.y += 0.02;
  solveArm(c, u, A, 0, T, 1, 0.1);
}
/* Two-bone IK for one arm onto a world point: on the model's own arm bones when it has them (its rest arm
 * directions), else on the rig's. The elbow goes out and down. handTurn turns the wrist toward the body. */
function solveArm(c, u, A, i, T, wgt, handTurn) {
  const sgn = Math.sign(A.sh.position.x) || (i ? -1 : 1), R = u.armRest && u.armRest[i];   // which side this arm is on
  const inv = new THREE.Matrix4().copy(u.chest.matrixWorld).invert();
  const S = R ? A.sh.parent.localToWorld(A.sh.position.clone().add(R.off)) : A.sh.getWorldPosition(new THREE.Vector3());
  const Sl = S.clone().applyMatrix4(inv), Tl = T.clone().applyMatrix4(inv);
  const a = R ? R.a : Math.abs(A.el.position.y), b = R ? R.b : A.hand ? Math.abs(A.hand.position.y) : a;
  const dv = Tl.clone().sub(Sl); const d = Math.min(Math.max(dv.length(), Math.abs(a - b) + 1e-3), a + b - 1e-3); dv.normalize();
  const pole = new THREE.Vector3(sgn, -0.6, -0.2).normalize(); const p = pole.sub(dv.clone().multiplyScalar(pole.dot(dv))).normalize();
  const al = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
  const El = Sl.clone().addScaledVector(dv, Math.cos(al) * a).addScaledVector(p, Math.sin(al) * a);
  const Hl = Sl.clone().addScaledVector(dv, d);
  const d1 = El.clone().sub(Sl).normalize(), d2 = Hl.clone().sub(El).normalize();
  if (R) {
    const q1 = new THREE.Quaternion().setFromUnitVectors(R.u0, d1);
    const w = d2.clone().applyQuaternion(q1.clone().invert());
    const qe = new THREE.Quaternion().setFromUnitVectors(R.v0, w);
    A.sh.quaternion.slerp(q1, wgt); A.el.quaternion.slerp(qe, wgt);
  } else {
    const q1 = new THREE.Quaternion().setFromUnitVectors(_down, d1);
    const d2s = d2.clone().applyQuaternion(q1.clone().invert());
    const bend = Math.acos(Math.max(-1, Math.min(1, d2s.dot(_down))));
    const q = q1.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(d2s.x, d2s.z)));
    A.sh.quaternion.slerp(q, wgt);
    A.el.rotation.set(A.el.rotation.x + (-bend - A.el.rotation.x) * wgt, A.el.rotation.y * (1 - wgt), 0);
  }
  if (A.hand) A.hand.rotation.set(0, A.hand.rotation.y * (1 - wgt) + sgn * handTurn * wgt, 0);
}
/* Feet on uneven ground (the hill, a step's edge): each foot finds the ground under it; the hips come down for
 * the lower one and the other knee bends to lift its foot onto the higher ground. Eased, and halved walking. */
const _pf = new THREE.Vector3();
function plantFeet(c, u, sit, w, dt) {
  if (c.lie || sit > 0.05 || c.angel || !G.floorAt) { c._ikOff = null; return; }
  c.m.updateMatrixWorld(true);
  const k = 1 - w * 0.5;
  const raw = u.legs.map((L) => { L.ft.getWorldPosition(_pf); return Math.max(-0.25, Math.min(0.25, G.floorAt(_pf.x, _pf.z) - c.y)) * k; });
  const off = c._ikOff || (c._ikOff = raw.slice());
  raw.forEach((g, i) => { off[i] = G.damp(off[i], g, 10, dt); });
  // ground under each foot relative to the body's floor; the hips drop for the lower foot
  const drop = Math.max(0, -Math.min(...off));
  if (drop < 0.002 && Math.max(...off) < 0.002) return;
  u.hips.position.y -= drop;
  u.legs.forEach((L, i) => {
    const r = off[i] + drop;   // how much shorter this hip-to-ankle has to be
    if (r < 0.002) return;
    const a = Math.abs(L.kn.position.y), b = Math.abs(L.ft.position.y), th = L.kn.rotation.x;
    const d0 = Math.sqrt(a * a + b * b + 2 * a * b * Math.cos(th));
    const d = Math.max((a + b) * 0.55, d0 - r);
    const th2 = Math.acos(Math.max(-1, Math.min(1, (d * d - a * a - b * b) / (2 * a * b))));
    const dl = th2 - th;
    L.th.rotation.x -= dl * 0.5; L.kn.rotation.x += dl; L.ft.rotation.x -= dl * 0.5;
  });
}
/* Feet that grip the floor. Walking, the body glides at an even speed but a recorded step doesn't, so a planted foot
 * slid a little (about a third of the walking speed). Now each foot, as it comes down (furthest forward under the
 * body), is pinned where it landed; while it carries the weight the hip and knee bend to keep it there, and it lets
 * go as the heel comes up, easing back into the step. Forward and back only: the sideways sway is the recording's. */
const _lk = { a: new THREE.Vector3(), b: new THREE.Vector3(), f: new THREE.Vector3() };
function ankleIn(c, L, out) { L.ft.getWorldPosition(out); return out; }
function lockFeet(c, u, sit, w, dt) {
  if (!u.legs || u.legs.length !== 2 || c.lie || sit > 0.05 || c.angel || c.hugWith || G.NO_FOOTLOCK) { c._lock = null; return; }
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
  const S = c._lock || (c._lock = u.legs.map(() => ({ x: 0, z: 0, on: false, t: 0, k: 0, prev: null, dir: 0 })));
  const period = c.gaitRate > 0.5 ? (2 * Math.PI) / c.gaitRate : 1, walking = w > 0.3 && (c.speed || 0) > 0.25 && !c.reach;
  c.m.updateMatrixWorld(true);
  u.legs.forEach((L, i) => {
    const st = S[i], A = ankleIn(c, L, _lk.a);
    const rel = (A.x - c.x) * fx + (A.z - c.z) * fz;   // how far ahead of the body this ankle is
    // the foot coming down: it was moving forward relative to the body and now goes back
    const dir = st.prev == null ? 0 : Math.sign(rel - st.prev);
    if (walking && !st.on && st.dir > 0 && dir < 0) { st.on = true; st.t = 0; st.x = A.x; st.z = A.z; }
    st.prev = rel; if (dir) st.dir = dir;
    if (st.on) { st.t += dt; if (st.t > period * 0.6 || !walking) st.on = false; }
    // weight: in over 0.05 s, out over the last fifth of the stance (60% of the stride, as for real feet) (and quickly if the walk stops)
    const tgt = st.on ? Math.min(1, st.t / 0.05) * Math.min(1, (period * 0.6 - st.t) / (period * 0.12)) : 0;
    st.k = st.on ? tgt : G.damp(st.k, 0, 14, dt);
    if (st.k < 0.01) return;
    // where the foot should be, forward/back along the walk (world → the body's forward axis)
    const want = ((st.x - A.x) * fx + (st.z - A.z) * fz) * st.k;
    if (Math.abs(want) < 0.002) return;
    // Two passes of a small numerical solve: how the ankle moves (forward, up) for a touch of hip and of knee.
    for (let pass = 0; pass < 2; pass++) {
      const A0 = ankleIn(c, L, _lk.a).clone(), e = 0.02;
      const fwd0 = (A0.x - c.x) * fx + (A0.z - c.z) * fz;
      const probe = (bone) => { bone.rotation.x += e; L.th.updateMatrixWorld(true); const P = ankleIn(c, L, _lk.b); const r = [((P.x - c.x) * fx + (P.z - c.z) * fz - fwd0) / e, (P.y - A0.y) / e]; bone.rotation.x -= e; L.th.updateMatrixWorld(true); return r; };
      const jt = probe(L.th), jk = probe(L.kn);
      const gF = ((st.x - A0.x) * fx + (st.z - A0.z) * fz) * st.k, gU = 0;   // forward/back to the pinned spot, at the same height
      if (Math.abs(gF) < 0.002) break;
      const det = jt[0] * jk[1] - jk[0] * jt[1]; if (Math.abs(det) < 1e-4) break;
      let dth = (gF * jk[1] - jk[0] * gU) / det, dkn = (jt[0] * gU - gF * jt[1]) / det;
      dth = Math.max(-0.35, Math.min(0.35, dth)); dkn = Math.max(-0.5, Math.min(0.5, dkn));
      if (L.kn.rotation.x + dkn < 0.02) dkn = 0.02 - L.kn.rotation.x;   // never past straight
      L.th.rotation.x += dth; L.kn.rotation.x += dkn; L.ft.rotation.x -= dth + dkn;   // the foot stays as it was to the floor
      L.th.updateMatrixWorld(true);
    }
  });
}
/* Neck and head on a critically damped spring toward where the pose wants them: a head moves with ease-in
 * and ease-out, never jumps, whatever sets its target (a glance, a new look-at, a doze, a hug, a clip change).
 * A cut (a long frame, or c.snapHead) puts it straight there. */
function springHead(c, u, dt) {
  const J = [u.neck.rotation, u.head.rotation], S = c._hsp;
  if (!S || dt > 0.25 || c.snapHead) { c._hsp = J.map((r) => ({ p: [r.x, r.y, r.z], v: [0, 0, 0] })); c.snapHead = false; return; }
  const w = 11, n = Math.max(1, Math.ceil(dt / 0.017)), h = dt / n, ax = ['x', 'y', 'z'];
  J.forEach((r, j) => {
    const s = S[j];
    for (let i = 0; i < 3; i++) {
      const tg = r[ax[i]];
      for (let k = 0; k < n; k++) { s.v[i] += (w * w * (tg - s.p[i]) - 2 * w * s.v[i]) * h; s.p[i] += s.v[i] * h; }
      r[ax[i]] = s.p[i];
    }
  });
}
const _fq = new THREE.Quaternion();
/* Coat tails on springs: they trail behind when walking, swing out on turns, and settle when you stop.
 * Each tail follows its leg a little (the coat is weighted to the thigh as well), the spring adds the rest. */
const _sx = new THREE.Vector3(1, 0, 0), _sz = new THREE.Vector3(0, 0, 1);
G.swingCoat = (c, dt) => {
  const u = c.m.userData; if (!u.springs || !u.springs.length || !c.dressed) return;
  dt = Math.min(dt, 1 / 20);
  const sp = c.lie ? 0 : (c.speed || 0), acc = (sp - (c._csp || 0)) / Math.max(dt, 1e-3); c._csp = sp;
  const turn = c.turnLean || 0, sit = c.sit || 0;
  // Outdoors the wind gets at the hem: it presses the coat one way (the wind drifts along +x) and makes it flutter.
  const W = G.WIND || { gust: 0 }, out = !c.lie && !(G.inside && G.inside(c.x, c.z)), gst = out ? W.gust : 0, tt = G.simT || 0;
  const wf = Math.sin(c.yaw) * gst, ws = Math.cos(c.yaw) * gst;   // the wind against your front, and across you
  for (const S of u.springs) {
    // back (trailing) with speed, forward when slowing; out on the outside of a turn; tucked when sitting
    const ta = (-0.07 * Math.min(sp, 2.2) + 0.025 * Math.max(-3, Math.min(3, acc))) * (1 - sit);   // sitting: the skirt lies on the lap with the thighs (weights), no swing of its own
    const flut = (Math.sin(tt * 7.3 + S.side * 1.7) * 0.6 + Math.sin(tt * 12.1 + S.side) * 0.4) * gst * 0.035 * (1 - sit);
    const ta2 = ta + wf * 0.1 * (1 - sit) + flut;   // facing downwind, the hem is blown forward
    const tb = turn * 1.6 + ws * 0.07 * (1 - sit);
    S.va += ((ta2 - S.a) * 60 - S.va * 7) * dt; S.a += S.va * dt;
    S.vb += ((tb - S.b) * 50 - S.vb * 7) * dt; S.b += S.vb * dt;
    S.bone.quaternion.copy(S.q0).multiply(_fq.setFromAxisAngle(_sx, S.a * (u.springSign || 1))).multiply(_fq.setFromAxisAngle(_sz, S.b));
  }
};
// How far each finger curls, per joint, for a relaxed hand; holding something closes them further.
const CURL = { Thumb: [0.1, 0.15, 0.15], Index: [0.18, 0.28, 0.2], Middle: [0.24, 0.34, 0.24], Ring: [0.3, 0.4, 0.27], Pinky: [0.36, 0.45, 0.3] };
G.curlFingers = (c, dt) => {
  const u = c.m.userData; if (!u.fingers || !u.fingers.length || window.NOCURL) return;
  const pz = c.forcePose || c.pose;
  const grip = c.carry || pz === 'carry' || pz === 'grab' ? 1 : pz === 'hide' ? 0.9 : pz === 'hideSit' ? 0.6 : (c.holdPose || pz === 'cup' || pz === 'read') ? 0.75 : pz === 'cold' ? 0.85 : pz === 'pockets' || pz === 'coatPockets' ? 0.6 : c.holdOn ? 0.45 : (c.hug || 0) > 0.3 ? 0.4 : 0;
  c.grip = G.damp(c.grip || 0, grip, 6, dt);
  const fid = Math.sin((c.breath || 0) * 0.5) * 0.04;   // the smallest restlessness, so hands never look carved
  for (const F of u.fingers) {
    const base = CURL[F.finger][F.j] || 0.3;
    const a = base * (1 + c.grip * (F.finger === 'Thumb' ? 0.6 : 1.3)) + fid * (F.j + 1) * 0.5;
    F.bone.quaternion.copy(F.q0);
    if (F.adx) F.bone.quaternion.multiply(_fq.setFromAxisAngle(F.adx, F.ad * (1 - c.grip * 0.3)));
    F.bone.quaternion.multiply(_fq.setFromAxisAngle(F.ax, a));
  }
};
function isRealGlb(buf) {
  try {
    if (buf.byteLength < 20 || new TextDecoder().decode(new Uint8Array(buf, 0, 4)) !== 'glTF') return false;
    const n = new DataView(buf).getUint32(12, true);
    return new TextDecoder().decode(new Uint8Array(buf, 20, n)).includes('mixamorig');
  } catch (e) { return false; }
}
function isMeshopt(bin) {
  try { const v = new DataView(bin), n = v.getUint32(12, true); return new TextDecoder().decode(new Uint8Array(bin, 20, n)).includes('EXT_meshopt_compression'); } catch (e) { return false; }
}
/* Hair moves with the head and nothing else. In the exports some hair points are weighted partly to the neck, so
 * when the head turns on a pillow those triangles stretch into long thin strands across the face. Every hair
 * point goes to the head bone, fully. */
function pinToHead(o, u) {
  if (!o.isSkinnedMesh || !o.skeleton || o.geometry.userData.pinnedHead) return;
  const bones = o.skeleton.bones;
  let hi = bones.indexOf(u.head);
  if (hi < 0) hi = bones.findIndex((b) => /head$/i.test(b.name));
  if (hi < 0) return;
  const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight;
  if (!si || !sw) return;
  // (weights can be stored as normalised integers: "1" is then the type's largest value)
  const one = sw.normalized ? (sw.array instanceof Uint8Array ? 255 : sw.array instanceof Uint16Array ? 65535 : 1) : 1;
  for (let i = 0; i < si.count; i++) { si.setXYZW(i, hi, 0, 0, 0); sw.setXYZW(i, one, 0, 0, 0); }
  si.needsUpdate = true; sw.needsUpdate = true; o.geometry.userData.pinnedHead = true;
}
/* Loose strands in front of the face. Her hair has a dozen thin separate wisps hanging at the temples and over the
 * forehead, and the tips of his fringe reach down onto the brow; seen up close (in bed, on a pillow) they read as
 * dark scratches across the face. Found and checked in Blender (cozy_characters_hair.blend, where the same cut was
 * made); done here at load so the exported models stay as they are:
 *  - her: any separate little piece of hair (20 faces or fewer) lying wholly in the front third of the hair;
 *  - him: fringe faces lying wholly in the lower 47% of the fringe (its strand tips, below the hairline).
 * Measured against each hair piece's own extent (the Blender cut, as fractions), so it doesn't depend on where the
 * game's head joint sits. Rest pose, character space, facing +z. */
function trimHair(o, u) {
  const g = o.geometry, n = o.name.toLowerCase();
  if (!g.index || g.userData.trimmed || /kid/.test(n)) return;
  const her = /partner/.test(n) && /ponytail/.test(n), him = /player/.test(n) && /fringe/.test(n);
  if (!her && !him) return;
  const P = g.attributes.position, idx = g.index.array;
  const pos = []; const v = new THREE.Vector3(); let y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); pos.push(v.x, v.y, v.z); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); }
  const keep = [];
  if (him) {
    const cut = y0 + 0.47 * (y1 - y0);
    for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2]; if (!(pos[a * 3 + 1] < cut && pos[b * 3 + 1] < cut && pos[c * 3 + 1] < cut)) keep.push(a, b, c); }
  } else {
    // pieces by shared position (welded, so a UV seam doesn't split one piece in two)
    const key = new Map(), root = [], find = (x) => { while (root[x] !== x) { root[x] = root[root[x]]; x = root[x]; } return x; };
    const vid = new Int32Array(P.count);
    for (let i = 0; i < P.count; i++) { const kk = Math.round(pos[i * 3] * 1e4) + ',' + Math.round(pos[i * 3 + 1] * 1e4) + ',' + Math.round(pos[i * 3 + 2] * 1e4); if (!key.has(kk)) { key.set(kk, root.length); root.push(root.length); } vid[i] = key.get(kk); }
    for (let t = 0; t < idx.length; t += 3) { const a = find(vid[idx[t]]), b = find(vid[idx[t + 1]]), c = find(vid[idx[t + 2]]); root[b] = a; root[find(c)] = a; }
    const tris = new Map(), back = new Map(), front = z1 - 0.32 * (z1 - z0);
    for (let t = 0; t < idx.length; t += 3) {
      const r = find(vid[idx[t]]); tris.set(r, (tris.get(r) || 0) + 1);
      for (let j = 0; j < 3; j++) { const z = pos[idx[t + j] * 3 + 2]; back.set(r, Math.min(back.has(r) ? back.get(r) : 1e9, z)); }
    }
    for (let t = 0; t < idx.length; t += 3) { const r = find(vid[idx[t]]); if (!(tris.get(r) <= 40 && back.get(r) > front)) keep.push(idx[t], idx[t + 1], idx[t + 2]); }
  }
  const removed = (idx.length - keep.length) / 3;
  g.setIndex(keep); g.userData.trimmed = removed;
}
/* Rest-pose measurements of a realistic model, in the character's own space (root at the origin, facing +z):
 * the top and width of the skull, the depth of the knitwear through the chest, the collar, the feet. */
function measureFit(model, u) {
  const v = new THREE.Vector3(), cat = { top: [], skin: [], socks: [] };
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    if (!o.isMesh) return;
    const n = o.name.toLowerCase();
    if (/^coat/.test(n)) {
      // The model's own long coat (tools/coats.py): shown when dressed (life.js, setDressed), in the game's wool.
      u.realCoat = (u.realCoat || []).concat(o);
      if (G.TX && G.TX.jersey) { o.material.map = G.rep(G.TX.jersey, 3, 3); o.material.bumpMap = G.TX.jerseyB || null; o.material.bumpScale = 0.004; o.material.roughness = 1; o.material.side = THREE.DoubleSide; o.material.needsUpdate = true; }
      o.visible = false; o.userData.warm = true; o.userData.gear = true;
      return;
    }
    // Winter clothes made in Blender (tools/winter_gear.py): knitted hat, scarf and gloves, and boots. Shown with
    // the coat (life.js, setDressed), in the game's own knit and leather.
    const gk = /^(hat|scarf|gloves|boots)_/.exec(n);
    if (gk) { u.realGear = u.realGear || {}; (u.realGear[gk[1]] = u.realGear[gk[1]] || []).push(o); o.visible = false; o.userData.warm = true; o.userData.gear = true; o.frustumCulled = false; return; }
    const key = /sweater|hood|cord|pocket/.test(n) ? 'top' : /sock/.test(n) ? 'socks' : /^human_(kid_)?(partner|player)$/.test(n) ? 'skin'
      : /legging|trouser|jean/.test(n) ? 'legs' : /hair|ponytail|fringe|short|bun|braid/.test(n) ? 'hair' : null;
    if (!key) return;
    cat[key] = cat[key] || [];
    if (key === 'top') u.realTop = (u.realTop || []).concat(o);
    if (key === 'hair') { u.realBun = (u.realBun || []).concat(o); pinToHead(o, u); trimHair(o, u); }   // tucked under the winter hat (life.js)
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); cat[key].push(v.x, v.y, v.z); }
  });
  const pts = (a, f) => { const r = []; for (let i = 0; i < a.length; i += 3) if (f(a[i], a[i + 1], a[i + 2])) r.push([a[i], a[i + 1], a[i + 2]]); return r; };
  const w = (o) => o.getWorldPosition(new THREE.Vector3());
  const head = w(u.head), chest = w(u.chest);
  const skull = pts(cat.skin, (x, y) => Math.abs(x) < 0.13 && y > head.y - 0.02);
  const skinTop = skull.reduce((m, q) => Math.max(m, q[1]), head.y);
  const band = skull.filter((q) => q[1] > skinTop - 0.1 && q[1] < skinTop - 0.05);
  const headHalfW = band.reduce((m, q) => Math.max(m, Math.abs(q[0] - head.x)), 0.06);
  const torso = pts(cat.top, (x, y) => Math.abs(x) < 0.07 && y > chest.y - 0.12 && y < chest.y + 0.02);
  const zs = torso.map((q) => q[2]);
  const halfD = zs.length ? (Math.max(...zs) - Math.min(...zs)) / 2 : 0;
  const neck = pts(cat.top, (x) => Math.abs(x) < 0.1).reduce((m, q) => Math.max(m, q[1]), chest.y);
  const feet = pts(cat.socks, (x, y) => y < 0.12), side = (s) => { const z = feet.filter((q) => Math.sign(q[0]) === s).map((q) => q[2]); return z.length ? Math.max(...z) - Math.min(...z) : 0; };
  // The raw rest-pose points too (every 2nd vertex, plenty), for fitting the coat and hat around them.
  const thin = (a) => { const r = []; for (let i = 0; a && i < a.length; i += 6) r.push(a[i], a[i + 1], a[i + 2]); return new Float32Array(r); };
  return { headY: head.y, chestY: chest.y, skinTop, headHalfW, halfD, neck, footLen: (side(1) + side(-1)) / 2,
    body: thin(cat.skin.concat(cat.legs || [])), hair: thin((cat.hair || []).concat(skull.flat())), skull: thin(skull.flat()), socks: thin(cat.socks || []) };
}

/* Run fn with a character in its rest pose at the origin (as measured above), then put everything back. */
G.atRest = (root, fn) => {
  const u = root.userData;
  // Only the root and the rig's joints are posed (and put back): anything fitted onto them in fn stays.
  const joints = [u.hips, u.spine, u.chest, u.neck, u.head].concat(...u.arms.map((a) => [a.sh, a.el, a.hand]), ...u.legs.map((l) => [l.th, l.kn, l.ft]));
  const saved = [root].concat(joints).map((o) => [o, o.position.clone(), o.rotation.clone()]);
  root.position.set(0, 0, 0); root.rotation.set(0, 0, 0);
  joints.forEach((g) => g.rotation.set(0, 0, 0));
  u.hips.position.y = u.hipY;
  root.updateMatrixWorld(true);
  try { return fn(); } finally { saved.forEach(([o, p, r]) => { o.position.copy(p); o.rotation.copy(r); }); root.updateMatrixWorld(true); }
};
const _m = new THREE.Matrix4(), _pi = new THREE.Matrix4();
G.retarget = (root) => {
  const R = root.userData.retarget;
  if (!R) return;
  root.updateMatrixWorld(true);
  for (const e of R.map) {
    _m.multiplyMatrices(e.group.matrixWorld, e.restInv).multiply(e.boneRest);
    _pi.copy(e.bone.parent.matrixWorld).invert();
    _m.premultiply(_pi);
    _m.decompose(e.bone.position, e.bone.quaternion, e.bone.scale);
    e.bone.updateMatrixWorld(true);
  }
};

/* ---------- animation ---------- */
/* Poses blended on top of the base idle/walk for the arms:
 * [shoulder x (forward −), shoulder z (inward +), elbow x (bend −), shoulder twist (about the upper arm)]. */
const ARM_POSES = (G.ARM_POSES = {
  cold: [-0.5, 0.3, -1.65, -0.85],   // arms wrapped around yourself
  warm: [-1.0, 0.18, -0.45, -0.25],  // hands held out to the fire
  pockets: [-0.18, 0.22, -1.05, -0.55], // hands tucked into the hoodie pocket
  throw: [-2.5, -0.15, -0.5, 0.2],      // arm back over the shoulder (snowballs)
  carry: [-0.85, 0.3, -1.25, -0.45],    // an armful of logs against the chest
  read: [-0.62, 0.24, -1.2, -0.62],      // a book held up in both hands
  water: [-1.05, 0.05, -0.55, 0.1],     // one arm out, tipping a watering can (arm 0 only)
  wave: [-2.7, -0.3, -0.7, 0.1],        // one hand up (arm 1 only): hello, and a pose for photographs
  cup: [-0.55, 0.28, -1.3, -0.7],      // a mug cradled in both hands
  coatPockets: [-0.16, 0.06, -0.5, -0.35], // hands in the coat's side pockets
  grab: [-1.2, 0.12, -0.32, 0.15],      // one arm out, hand closed round someone's wrist (arm 0 only)
  held: [-0.8, 0.04, -0.14, 0.1],       // one arm pulled out low and straight by the wrist (arm 1 only)
  hide: [-0.36, 0.46, -1.45, -0.55],    // hugging yourself small, elbows in, hands on the opposite arms (hiding)
  hideSit: [-0.95, 0.4, -0.95, -0.3],   // sitting, arms wrapped round your knees (hiding on a seat)
});
const ONE_ARM = { throw: 0, water: 0, wave: 1, grab: 0, held: 1 };
/* Motion capture (js/mocap.js, from the CMU motion capture database): looping idle, walk and seated clips,
 * already in this rig's joint angles. Sampled with linear interpolation; mixed by walk speed and sitting. */
const MC_KEYS = ['hips', 'hipsPos', 'spine', 'spineW', 'chest', 'neck', 'head', 'sh0', 'sh1', 'el0', 'el1', 'th0', 'th1', 'kn0', 'kn1', 'ft0', 'ft1'];
const mcSample = (clip, f, out) => {
  const n = clip.n, a = ((Math.floor(f) % n) + n) % n, b = (a + 1) % n, t = f - Math.floor(f);
  for (const k of MC_KEYS) {
    const A = clip[k][a], B = clip[k][b];
    if (typeof A === 'number') out[k] = A + (B - A) * t;
    else { const o = out[k] || (out[k] = [0, 0, 0]); for (let i = 0; i < 3; i++) o[i] = A[i] + (B[i] - A[i]) * t; }
  }
  return out;
};
const mcMix = (a, b, t, out) => { for (const k of MC_KEYS) { if (typeof a[k] === 'number') out[k] = a[k] + (b[k] - a[k]) * t; else { const o = out[k] || (out[k] = [0, 0, 0]); for (let i = 0; i < 3; i++) o[i] = a[k][i] + (b[k][i] - a[k][i]) * t; } } return out; };
G.animate = (c, dt, t) => {
  const u = c.m.userData, k = u.k, { lerp: L, clamp, damp } = G;
  c.m.position.set(c.x, c.y, c.z);
  // Lean into turns: roll about the character's own forward axis, scaled by speed.
  const prevYaw = c._prevYaw == null ? c.yaw : c._prevYaw;
  let dy = c.yaw - prevYaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
  c._prevYaw = c.yaw;
  const sp = c.lie ? 0 : clamp(c.speed / 1.6, 0, 2);
  c.turnLean = damp(c.turnLean || 0, clamp((dy / Math.max(dt, 1e-3)) * sp * 0.05, -0.1, 0.1), 6, dt);
  // Lying down (in bed): the body tips back onto the mattress, head toward −z; lieRoll turns it onto one side.
  if (c.lie) c.m.rotation.set(-Math.PI / 2 + (c.lieTilt == null ? 0.09 : c.lieTilt), c.lieRoll || 0, 0);   // tilt: head up on the pillow
  else c.m.rotation.set(0, c.yaw, -c.turnLean);
  const prevPh = c.phase;
  // Steps per second to match the speed, so the stride covers the ground the body does (the recorded stride is a
  // fixed length): measured, the feet stop sliding forward or back at about 2.2 + 4.4 × speed (radians a second).
  c.gaitRate = G.GAIT ? G.GAIT(c.speed) : (2.2 + 4.4 * Math.min(2.4, c.speed)) * Math.min(1, sp * 2);
  c.phase += dt * c.gaitRate;
  const ph = c.phase, w = Math.min(1, sp);
  // Turning on the spot: small steps round, one foot then the other, so the feet don't swivel on the ground.
  const yawRate = Math.abs(dy) / Math.max(dt, 1e-3);
  G.spring(c, '_turnW', c.lie || (c.sit || 0) > 0.05 ? 0 : clamp((yawRate - 0.5) / 1.5, 0, 1) * (1 - w), 9, dt);
  const turnW = clamp(c._turnW, 0, 1);
  if (turnW > 0.02) c._turnPh = (c._turnPh || 0) + dt * 10; else c._turnPh = 0;
  const sit = c.sit || 0, idle = (1 - w) * (1 - sit);
  // Foot plants (heel strike when a leg is fully forward) drive footstep sounds and footprints.
  const plant = (p) => Math.floor((p - 1.5 * Math.PI) / Math.PI);
  if (w > 0.25 && sit < 0.1 && plant(ph) !== plant(prevPh)) {
    const leg = ((plant(ph) % 2) + 2) % 2, lx = (leg ? 1 : -1) * 0.09 * k, fz = 0.22 * w;
    const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    c.stepEvent = { leg, x: c.x + lx * cy + fz * sy, z: c.z - lx * sy + fz * cy, yaw: c.yaw };
  }
  // Idle weight shift: most of the weight on one leg, drifting to the other now and then (two slow,
  // unrelated rhythms, so it never looks like a metronome), and each person settles their own way.
  if (c.seedT == null) c.seedT = Math.random() * 20;
  const sd = c.seedT, raw = Math.sin(t * 0.21 + sd) * 0.75 + Math.sin(t * 0.083 + sd * 1.7) * 0.45;
  const shift = Math.max(-1, Math.min(1, raw * 1.3)) * idle;
  const small = u.H < 1.3;   // a child
  // The recorded base pose for this frame (null without the clips, or for poses the clips don't cover).
  const MC = window.CBS_MOCAP && G.MOCAP_ON !== false && !c.lie && !c.angel ? window.CBS_MOCAP : null;
  let mb = null;
  if (MC) {
    const S = c._mc || (c._mc = { i: {}, w: {}, s: {}, m: {}, m2: {} });
    // Each person through the idle at their own point and pace; children a touch quicker.
    mcSample(MC.idle, (t * (small ? 1.12 : 0.96) + sd * 9) * MC.idle.fps, S.i);
    // The walk follows the stride phase: right foot furthest forward at ph = 1.5π (as the footsteps expect).
    const wu = (((ph - 1.5 * Math.PI) / (2 * Math.PI)) % 1 + 1) % 1;
    mcSample(MC.walk, wu * MC.walk.n, S.w);
    mb = mcMix(S.i, S.w, w, S.m);
    if (sit > 0.01) { mcSample(MC.sit, (t * 0.9 + sd * 5) * MC.sit.fps, S.s); mb = mcMix(mb, S.s, sit, S.m2); }
    // Talking: while it's your line, the recorded conversation's hand gestures come in (and a laugh, when the line
    // laughs), eased in and out, softer when sitting or walking. Each person at their own point in the recording.
    const D = G.DLG && G.DLG.cur, sw = !!(G.NIGHT && G.NIGHT.swapped), mine = !!D && ((D.who === 'partner' && c === (sw ? G.PLAYER : G.PARTNER)) || (D.who === 'player' && c === (sw ? G.PARTNER : G.PLAYER)));
    const laughing = mine && /\bha\b|haha|\bheh|laugh/i.test(D.text);
    if (D && D !== c._line) { c._line = D; if (laughing) c._laughT = 2.6; if (!mine && /laugh/i.test(D.text) && !D.who) c._laughT = 2.2; }
    c._laughT = Math.max(0, (c._laughT || 0) - dt);
    G.spring(c, '_talkW', mine && !c.hugWith && !c.lie ? 1 : 0, 3.2, dt);
    G.spring(c, '_laughW', c._laughT > 0 ? 1 : 0, 4, dt);
    if (MC.talk && c._talkW > 0.01) { S.t = S.t || {}; mcSample(MC.talk, (t + sd * 13) * MC.talk.fps, S.t); mb = mcMix(mb, S.t, Math.min(1, c._talkW) * 0.5 * (1 - w * 0.8) * (1 - sit * 0.5), S.m3 || (S.m3 = {})); }
    if (MC.laugh && c._laughW > 0.01) { S.l = S.l || {}; mcSample(MC.laugh, (t + sd * 7) * MC.laugh.fps, S.l); mb = mcMix(mb, S.l, Math.min(1, c._laughW) * 0.7 * (1 - w * 0.8), S.m4 || (S.m4 = {})); }
  }
  u.legs.forEach((Lg, i) => {
    const p = ph + (i ? Math.PI : 0), s = i ? 1 : -1;
    const bend = Math.max(0, s * shift) * 0.2;   // the unloaded leg softens at the knee and turns out a little
    // Sitting: knees a little apart; a child's feet, off the ground, swing.
    const dang = small && sit > 0.5 ? Math.sin(t * 1.6 + i * 2.1 + sd) * 0.14 * Math.max(0, Math.sin(t * 0.23 + sd)) : 0;
    Lg.th.rotation.set(L(Math.sin(p) * 0.55 * w - bend * 0.45, -1.42, sit), L(s * bend * 0.35, s * 0.1, sit), L(-s * 0.025 * idle - s * Math.max(0, -s * shift) * 0.03, s * 0.09, sit));
    Lg.kn.rotation.x = L(Math.max(0, -Math.sin(p + 0.6)) * 1.0 * w + 0.04 + bend, 1.4 + dang, sit);
    Lg.ft.rotation.x = L(Math.sin(p) * 0.2 * w - bend * 0.5, -0.12 - dang * 0.5, sit);
    if (mb) {
      // Walking legs from the recording (index 0 is the right leg, as here). Standing and sitting keep this
      // rig's own legs: the recording's standing knees aren't trustworthy, and a seat decides sitting legs.
      const S = c._mc, k2 = w * (1 - sit), th = S.w['th' + i];
      const r = Lg.th.rotation;
      r.set(L(r.x, th[0], k2), L(r.y, th[1], k2), L(r.z, th[2], k2));
      Lg.kn.rotation.x = L(Lg.kn.rotation.x, S.w['kn' + i], k2);
      Lg.ft.rotation.x = L(Lg.ft.rotation.x, S.w['ft' + i], k2);
    }
    if (turnW > 0.02) { const lift = Math.max(0, Math.sin(c._turnPh + i * Math.PI)) * turnW; Lg.th.rotation.x -= lift * 0.32; Lg.kn.rotation.x += lift * 0.62; Lg.ft.rotation.x -= lift * 0.22; }
    if (c.angel) { Lg.th.rotation.set(0, 0, s * (0.05 + 0.32 * (0.5 - 0.5 * Math.cos(t * 2.4)))); Lg.kn.rotation.x = 0.04; }
    if (c.lie && c.cuddle && c.cuddle.role === 'drape') { Lg.th.rotation.x = -0.55 - i * 0.12; Lg.kn.rotation.x = 0.85 + i * 0.15; Lg.ft.rotation.x = 0.1; }   // curled a little, knees towards him
    // Stamping the snow off on the mat: one foot, then the other, lifted and brought down hard.
    if (c.stampT > 0 && sit < 0.1) { const ph2 = (0.95 - c.stampT) / 0.32, leg = Math.floor(ph2) % 2, f = ph2 % 1, up = Math.sin(Math.min(1, f / 0.75) * Math.PI) * (f < 0.75 ? 1 : 0); if (leg === i) { Lg.th.rotation.x -= up * 0.38; Lg.kn.rotation.x += up * 0.75; Lg.ft.rotation.x -= up * 0.15; } }
    // Hiding on a seat: knees pulled right up to the chest, feet tucked in on the cushion.
    if ((c.forcePose === 'hide' || c.forcePose === 'hideSit') && sit > 0.5) { const k3 = (sit - 0.5) * 2; Lg.th.rotation.x = L(Lg.th.rotation.x, -2.0, k3); Lg.th.rotation.z = L(Lg.th.rotation.z, s * 0.06, k3); Lg.kn.rotation.x = L(Lg.kn.rotation.x, 2.8, k3); Lg.ft.rotation.x = L(Lg.ft.rotation.x, -0.35, k3); }
  });
  u.hips.position.y = L(u.hipY, (c.seatY || 0.6) - c.y + 0.03, sit) - Math.abs(Math.sin(ph)) * 0.03 * w - Math.abs(shift) * 0.012;
  // Walking, the hips sway over the planted foot; standing, they sit out over the loaded leg.
  u.hips.position.x = shift * 0.03 * k + Math.sin(ph) * 0.012 * w * k;
  u.hips.rotation.set(0, Math.sin(ph) * 0.12 * w + shift * 0.06, -shift * 0.06 - Math.sin(ph) * 0.03 * w);
  // The chest counters the hips (contrapposto), and a little slump when sitting.
  u.spine.rotation.y = -Math.sin(ph) * 0.17 * w - shift * 0.04;
  u.spine.rotation.z = shift * 0.075;
  u.spine.rotation.x = 0.04 * w * (sp > 1.2 ? 2.5 : 1) + sit * 0.1 + (c.lean || 0) + Math.sin(t * 0.17 + sd) * 0.012 * idle;
  u.chest.rotation.z = shift * 0.02;
  if (mb) {
    // Hips and spine from the recording: height relative to standing, sway about the path; sitting keeps the seat's.
    // Hip height and pelvis only from the walk (standing keeps the weight shift above); upper body from all.
    const S = c._mc, hp = S.w.hipsPos, k2 = w * (1 - sit);
    // (hip height stays this rig's own, with its bob: the recording's is tied to its over-bent knees)
    u.hips.position.x = L(u.hips.position.x, hp[0] * u.hipY, k2);
    u.hips.rotation.set(L(u.hips.rotation.x, S.w.hips[0] - 0.02, k2), L(u.hips.rotation.y, S.w.hips[1], k2), L(u.hips.rotation.z, S.w.hips[2], k2));
    // With the recorded pelvis (walking) the spine is relative to it; without, against the upright body.
    u.spine.rotation.set(L(mb.spineW[0], mb.spine[0], k2) + (c.lean || 0) + sit * 0.1, L(mb.spineW[1], mb.spine[1], k2), L(mb.spineW[2], mb.spine[2], k2));
  }
  // Sitting down and getting up: the chest goes forward over the feet half-way through (the weight has to be over
  // them to lift off or lower onto the seat), and the head stays up, looking ahead.
  c._sitTr = 4 * sit * (1 - sit) * (c.lie ? 0 : 1);
  u.spine.rotation.x += c._sitTr * 0.48;
  // Swaying to music (the radio, or a slow dance): weight rocks side to side on the beat.
  G.spring(c, 'swayW', c.swayTarget || 0, 3, dt);
  c.headSway = 0;
  if (c.swayW > 0.002) {
    const sw = c.swayW, bt = t * 4.83;
    u.hips.position.x += Math.sin(bt) * 0.028 * sw * k; u.hips.position.y -= Math.abs(Math.cos(bt)) * 0.012 * sw;
    u.hips.rotation.z += Math.sin(bt) * 0.05 * sw; u.spine.rotation.z -= Math.sin(bt) * 0.06 * sw;
    c.headSway = Math.sin(bt + 0.6) * 0.07 * sw;
  }
  // A shiver: a quick shudder through the shoulders, fading out.
  if (c.shiverT > 0) { const sk = Math.min(1, c.shiverT / 0.6); u.chest.rotation.z += Math.sin(t * 38) * 0.025 * sk; u.spine.rotation.x += 0.05 * sk; }
  // On the ice: careful, a little bent at the knees, and now and then a small wobble.
  G.spring(c, '_iceW', c.onIce && !c.lie && sit < 0.1 ? 1 : 0, 3, dt);
  if (c._iceW > 0.01) { const iw = c._iceW, wob = Math.sin(t * 2.3 + sd * 7) * Math.max(0, Math.sin(t * 0.7 + sd * 3)) * (0.3 + w * 0.7); u.hips.rotation.z += wob * 0.06 * iw; u.spine.rotation.z -= wob * 0.08 * iw; u.spine.rotation.x += 0.06 * iw; }
  // Breathing: a slow chest rise, quicker after running.
  c.breathRate = damp(c.breathRate || 1.8, sp > 1.2 ? 3.4 : 1.8, 0.6, dt);   // ~3.5 s per breath at rest
  c.breath = (c.breath || 0) + dt * c.breathRate;
  const br = Math.sin(c.breath) * 0.012;
  u.chest.scale.set(1 + br, 1 + br * 0.4, 1 + br);
  u.chest.rotation.x = -br * 1.2;
  if (mb) { u.chest.rotation.x += mb.chest[0]; u.chest.rotation.y = mb.chest[1]; u.chest.rotation.z = mb.chest[2]; }
  // Arm poses fade in and out instead of popping.
  const pw = c.poseW || (c.poseW = {});
  const want = c.forcePose || c.pose;
  G.spring(c, 'holdW', c.holdOn ? 1 : 0, 11, dt);
  for (const name in ARM_POSES) { G.spring(pw, name, want === name ? 1 : 0, 7, dt); pw[name] = clamp(pw[name], 0, 1); }
  u.arms.forEach((A, i) => {
    const s = i ? 1 : -1, p = ph + (i ? 0 : Math.PI);
    const swing = Math.sin(p);
    // Relaxed hang: slight forward set and soft elbows; the forearm bends more on the forward swing.
    // Relaxed: arms a touch forward and out from the hips, elbows soft, each a little different, and the
    // arm on the loaded side hanging a fraction further out (the hip pushes it).
    const own = Math.sin(t * 0.37 + sd + i * 1.3) * 0.03;
    let sx = swing * 0.42 * w - (0.1 + own) * idle + Math.sin(c.breath) * 0.018 * idle;
    let sz = s * (0.11 + 0.012 * Math.sin(c.breath)) * idle + s * 0.06 * w + s * shift * (i ? -0.035 : 0.035);
    let ex = -(0.3 + own) * idle - (0.3 + Math.max(0, -swing) * 0.45 + Math.max(0, swing) * 0.1) * w, sy = s * 0.12 * idle;
    if (sit > 0.5) {
      // Seated hands don't stay glued to the thighs: they settle in different places now and then (on the thighs,
      // clasped in the lap, one hand up on the knee), each person on their own slow clock, easing between them.
      const rest = [[-0.42, 0.16, -0.95, 0.25], [-0.36, 0.24, -1.2, 0.38], i ? [-0.58, 0.18, -0.72, 0.2] : [-0.42, 0.16, -0.95, 0.25], [-0.48, 0.2, -0.85, 0.18]];
      const cyc = (t * 0.045 + sd * 0.31) % rest.length, a0 = Math.floor(cyc), f = G.smooth(0.8, 1, cyc - a0), A0 = rest[a0], A1 = rest[(a0 + 1) % rest.length];
      sx = L(A0[0], A1[0], f) + own; sz = s * L(A0[1], A1[1], f); ex = L(A0[2], A1[2], f); sy = s * L(A0[3], A1[3], f);
    }
    // Standing and walking arms from the recording; seated, the hands stay in the lap (its seated arms are up at the face).
    // Sitting and talking: the conversation recording's hands, from the elbows down mostly, over the resting pose.
    if (mb && sit > 0.5 && c._talkW > 0.01 && c._mc.t && c._mc.t['sh' + i]) { const T = c._mc.t, kt = Math.min(1, c._talkW) * 0.4 * sit; sx = L(sx, Math.max(-1.1, T['sh' + i][0]), kt * 0.6); ex = L(ex, T['el' + i], kt); sz = L(sz, T['sh' + i][2] + s * 0.12, kt * 0.4); }
    if (mb) { const a = mb['sh' + i], ka = 1 - sit; sx = L(sx, a[0], ka); sy = L(sy, a[1] * 0.6, ka); sz = L(sz, a[2] + s * (c.dressed ? 0.1 : 0.06), ka); ex = L(ex, mb['el' + i], ka); }
    for (const name in ARM_POSES) {
      const wgt = pw[name] * (name === 'read' || name === 'cup' || name === 'hideSit' ? 1 : 1 - sit) * (name === 'warm' ? idle : 1);   // a book or a mug works sitting down too
      if (wgt < 0.001 || (ONE_ARM[name] != null && i !== ONE_ARM[name])) continue;   // one arm throws, or waves
      const P = ARM_POSES[name];
      // On this rig +s rolls the arm in toward the body (−s spreads it, as the hug does).
      sx = L(sx, P[0] + (name === 'cold' ? Math.sin(t * 31 + i) * 0.012 : 0), wgt); sz = L(sz, s * P[1], wgt); ex = L(ex, P[2], wgt); sy = L(sy, s * P[3], wgt);
    }
    // Arms a little out from the body on the ice, for balance (more when moving).
    if (c._iceW > 0.01 && !c.hug && !c.holdOn && !(pw.carry > 0.1)) { const iw = c._iceW * (0.45 + w * 0.55); sz = L(sz, -s * 0.42, iw); sx = L(sx, -0.25, iw * 0.6); ex = L(ex, -0.35, iw * 0.5); }
    // Sitting down or getting up: the hands come forward onto the knees, to push off or to brace.
    if (c._sitTr > 0.02 && !c.hug && !c.holdW) { const tr = Math.min(1, c._sitTr * 1.15); sx = L(sx, -0.62, tr); sz = L(sz, s * 0.16, tr); ex = L(ex, -0.75, tr); sy = L(sy, s * 0.15, tr); }
    if (c.pose === 'chin') { if (i === (c.chinSide || 0)) { sx = -1.6; sz = s * -0.35; ex = -2.3; } }
    // Snow angels: lying on your back, arms sweeping up and down through the snow.
    if (c.angel) { const sw = 0.5 - 0.5 * Math.cos(t * 2.4); sx = -0.05; sz = -s * (0.25 + 1.55 * sw); ex = -0.12; sy = 0; }
    if (c.hug > 0) {
      // [forward, spread, elbow, twist]; the taller one wraps lower so their arms go around, not over.
      const hp = c.hugPose || [-1.3, 0.6, -1.4, 0];
      sx = L(sx, hp[0], c.hug); sz = L(sz, -s * hp[1], c.hug); ex = L(ex, hp[2], c.hug); sy = L(sy, s * hp[3], c.hug);
    }
    if (i === c.holdArm && (c.holdW || 0) > 0.001) { const hw = c.holdW; sx = L(sx, -0.14 + (c.holdReach || 0), hw); sz = L(sz, -s * 0.14, hw); ex = L(ex, -0.18, hw); sy = L(sy, s * 0.2, hw); }
    // Palms toward the thighs, not facing forward: the turn spread over upper arm, forearm and wrist.
    // Only for the realistic bodies (the built-in ones are modelled that way already); poses take it back.
    const tw = u.real ? -s * 0.65 * (1 - Math.max(c.hug || 0, c.holdW || 0)) * (1 - sit * 0.4) : 0;
    let posed = 0; for (const name in ARM_POSES) posed = Math.max(posed, pw[name] || 0);
    const twist = tw * (1 - posed * 0.7) * (mb ? 0.55 : 1);   // the recording already turns the arms some way
    A.sh.rotation.set(sx, sy + twist * 0.35, sz); A.el.rotation.set(ex, twist * 0.4, 0);
    if (A.hand) A.hand.rotation.set(0, twist * 0.45, 0);
  });
  // Hugging: each arm reaches for a point on the other one's back (two-bone IK), so the arms go round the body
  // instead of through it. The taller one wraps over the shoulders, the shorter one round the back, under the arms.
  if ((c.hug || 0) > 0.01 && c.hugWith && c.hugWith.m) hugIK(c, u, c.hug);
  else if ((c.holdW || 0) > 0.01 && c.holdWith && c.holdWith.m && c.holdArm != null && c.holdWith.holdArm != null) holdIK(c, u, c.holdW);
  else if (c.grabWith && c.grabWith.m && c.grabWith.m.userData.arms) grabIK(c, u);
  if (c.reach) reachIK(c, u, dt);
  if (c.lie && c.cuddle && c.cuddle.with && c.cuddle.with.m && c.cuddle.with.lie) cuddleIK(c, u);
  // Blinks on a natural, irregular rhythm (sometimes a double blink).
  c.blinkT = (c.blinkT == null ? Math.random() * 3 : c.blinkT) - dt;
  if (c.noBlink) c.blinkT = Math.max(c.blinkT, 1);   // the imitation, when it stops pretending
  if (c.blinkT < -0.17) c.blinkT = Math.random() < 0.15 ? 0.2 : 2 + Math.random() * 4.5;
  const shut = c.lidsClosed || c.blinkT < 0;
  if (u.realLids) {
    // A blink: down fast (50 ms), a moment shut, up a little slower. Falling asleep, the lids close slowly.
    const s0 = -c.blinkT, b = c.blinkT >= 0 ? 0 : s0 < 0.05 ? s0 / 0.05 : s0 < 0.08 ? 1 : Math.max(0, 1 - (s0 - 0.08) / 0.09);
    c.lidSleep = damp(c.lidSleep || 0, c.lidsClosed ? 1 : 0, c.lidsClosed ? 2.5 : 8, dt);
    // At rest the lids sit a touch down over the top of the iris, as relaxed eyes do (wide-open eyes stare); a smile
    // softens them a little more, and so does sadness. The imitation, once it stops pretending, opens them right up.
    const X = u.expr && u.expr.v, soft = X && !c.noBlink ? LID_REST + Math.min(0.14, X.smile * 0.12 + X.sad * 0.09) : 0;
    setRealLids(u, u.forceLid != null ? u.forceLid : Math.max(b, c.lidSleep, soft));   // forceLid: tests
  }
  if (u.lids) u.lids.forEach((ld) => { ld.position.y = (shut ? 0.0085 : 0.0135) * k; ld.scale.y = (shut ? 0.0125 : 0.0072) * k; });
  // With nothing to look at, glance around now and then.
  let tgt = c.lie ? null : c.lookAt;
  if (c.lie) { c.look = damp(c.look || 0, c.lieLook || 0, 3, dt); c.lookUp = damp(c.lookUp || 0, 0, 3, dt); }
  else if (!tgt && idle > 0.5 && !c.lockHead) {
    c.glanceT = (c.glanceT || 0) - dt;
    if (c.glanceT <= 0) { const g0 = c.glance || 0; c.glanceT = 2.5 + Math.random() * 4; c.glance = Math.random() < 0.35 ? 0 : (Math.random() - 0.5) * 1.6; c.glanceUp = (Math.random() - 0.4) * 0.5; if (Math.abs(c.glance - g0) > 0.6 && c.blinkT > 0.4 && Math.random() < 0.7) c.blinkT = 0; }   // people blink as they look somewhere new
    if (c.glance) { const a = c.yaw + c.glance; tgt = { x: c.x + Math.sin(a) * 3, z: c.z + Math.cos(a) * 3, headY: c.y + u.H * 0.93 + (c.glanceUp || 0) * 3 }; }
  }
  if (tgt) {
    const dx = tgt.x - c.x, dz = tgt.z - c.z;
    let a = Math.atan2(dx, dz) - c.yaw; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI;
    if (c._tgtA != null && Math.abs(a - c._tgtA) > 0.7 && c.blinkT > 0.4 && Math.random() < 0.8) c.blinkT = 0;   // a big turn of the head: a blink with it
    c._tgtA = a;
    // Something behind: keep looking over the same shoulder instead of whipping across to the other one.
    if (Math.abs(a) > 2.1 && c._lookSide) a = c._lookSide * Math.abs(a); else c._lookSide = Math.sign(a) || c._lookSide || 1;
    c.look = damp(c.look || 0, clamp(a, -1.1, 1.1), 4, dt);
    const dy = (tgt.headY || 1.5) - (c.y + u.H * 0.93);
    c.lookUp = damp(c.lookUp || 0, clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.4, 0.4), 4, dt);
  } else if (!c.lie) { c.look = damp(c.look || 0, 0, 3, dt); c.lookUp = damp(c.lookUp || 0, 0, 3, dt); }
  u.neck.rotation.set(c.lookUp * 0.4 - (c._sitTr || 0) * 0.3, c.look * 0.45 + Math.sin(ph) * 0.06 * w, (c.tilt || 0) - shift * 0.05);   // walking, the head stays steady over a turning chest
  // Recorded head and neck motion under the look-at: kept small when looking at something, so the gaze holds.
  c._hk = damp(c._hk == null ? 1 : c._hk, tgt ? 0.35 : 1, 2.5, dt); const hk = c._hk;
  if (mb) { u.neck.rotation.x += mb.neck[0] * hk; u.neck.rotation.y += mb.neck[1] * hk; u.neck.rotation.z += mb.neck[2] * hk; }
  u.head.rotation.set(c.lookUp * 0.6 + Math.sin(t * 0.7 + c.z) * 0.02 * (mb ? 0 : 1) + (c.headDown || 0), c.look * 0.55, (c.tilt || 0) * 0.6 + c.headSway);
  if (mb) { u.head.rotation.x += mb.head[0] * hk; u.head.rotation.y += mb.head[1] * hk; u.head.rotation.z += mb.head[2] * hk; }
  talkHead(c, u, dt, t);
  exprUpdate(c, u, dt);
  plantFeet(c, u, sit, w, dt);
  lockFeet(c, u, sit, w, dt);
  springHead(c, u, dt);
  G.retarget(c.m);
  if (u.realEyes) aimEyes(c, u, tgt ? new THREE.Vector3(tgt.x, tgt.headY != null ? tgt.headY : c.y + u.H * 0.93, tgt.z) : null, dt);
  if (c.scarfTail && G.simScarf) G.simScarf(c, dt);
  G.curlFingers(c, dt);
  G.swingCoat(c, dt);
};
})();
