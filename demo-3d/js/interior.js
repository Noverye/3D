'use strict';
/* =========================================================================
 * Interior: bedroom (x 0–5), living room (x 5–11) and kitchen (x 11–15).
 * Lamps, fire, cake, breakfast. Story-aware interactions live in story.js.
 * ========================================================================= */
(() => {
const { MAT, TX, box, cyl, sph, lerp } = G;
const LAMPS = (G.LAMPS = []);
const FLAMES = (G.FLAMES = []);

function flameMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uPower: { value: 1 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform float uTime; uniform float uPower; uniform vec3 uColor; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 uv = vUv; float y = uv.y;
        float w = n(vec2(uv.x*4.0, y*3.0 - uTime*3.2))*0.55 + n(vec2(uv.x*9.0, y*7.0 - uTime*5.0))*0.3;
        float shape = 1.0 - smoothstep(0.0, 0.5 - y*0.42, abs(uv.x - 0.5 + (w-0.4)*0.25*y));
        float f = shape * (1.0 - y) * smoothstep(0.0, 0.12, y) * (0.6 + w);
        f = clamp(f * 1.6, 0.0, 1.0) * uPower;
        vec3 c = mix(uColor, vec3(1.0, 0.95, 0.75), smoothstep(0.55, 1.0, f));
        gl_FragColor = vec4(c * f * 3.0, f);
      }`,
  });
}
G.flameMaterial = flameMaterial;
function candle(x, y, z, h = 0.1, r = 0.035, parent) {
  cyl(r, r, h, MAT.candle, x, y + h / 2, z, { parent, seg: 16 });
  const f = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.07), flameMaterial('#ffb24a'));
  f.position.set(x, y + h + 0.035, z); (parent || G.world).add(f); FLAMES.push(f);
  return f;
}
G.candle = candle;
function tableLamp(x, y, z, power = 5) {
  const g = new THREE.Group(); g.position.set(x, y, z); G.world.add(g);
  cyl(0.06, 0.08, 0.16, MAT.ceramic, 0, 0.08, 0, { parent: g, seg: 16 });
  cyl(0.012, 0.012, 0.16, MAT.metal, 0, 0.24, 0, { parent: g, seg: 8 });
  const shadeMat = G.std({ color: '#f1dcb2', roughness: 0.9, emissive: '#ffb060', emissiveIntensity: 1, side: THREE.DoubleSide });
  const shade = cyl(0.1, 0.15, 0.18, shadeMat, 0, 0.38, 0, { parent: g, open: true, cast: false });
  const light = new THREE.PointLight('#ffb062', 0, 6, 2); light.position.set(0, 0.34, 0); g.add(light);
  const L = { g, light, shade, on: true, power, flick: 1 };
  LAMPS.push(L);
  return L;
}
function floorLamp(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); G.world.add(g);
  cyl(0.15, 0.17, 0.03, MAT.darkMetal, 0, 0.015, 0, { parent: g });
  cyl(0.014, 0.014, 1.45, MAT.darkMetal, 0, 0.74, 0, { parent: g, seg: 8 });
  const shadeMat = G.std({ color: '#f1dcb2', roughness: 0.9, emissive: '#ffb060', emissiveIntensity: 1, side: THREE.DoubleSide });
  const shade = cyl(0.16, 0.23, 0.3, shadeMat, 0, 1.55, 0, { parent: g, open: true, cast: false });
  const light = new THREE.PointLight('#ffb062', 0, 8, 2); light.position.set(0, 1.5, 0); g.add(light);
  G.CAMBLOCK.push(shade);   // keep the camera from ending up inside the shade
  const L = { g, light, shade, on: true, power: 9, flick: 1 };
  LAMPS.push(L);
  G.COLL.push({ x0: x - 0.2, z0: z - 0.2, x1: x + 0.2, z1: z + 0.2 });
  return L;
}
G.toggleLamp = (L) => { L.on = !L.on; G.Audio.click(); };

/* ---------------- photographs (procedural "polaroids") ---------------- */
function photoTex(kind) {
  const cv = document.createElement('canvas'); cv.width = 160; cv.height = 190;
  const c = cv.getContext('2d');
  c.fillStyle = '#f4efe6'; c.fillRect(0, 0, 160, 190);
  const g = c.createLinearGradient(0, 10, 0, 150);
  const pal = { lake: ['#e8a070', '#7a8fb0'], snow: ['#c7cfdb', '#eef2f7'], fire: ['#3a2418', '#c06a2a'], hill: ['#9fc4e2', '#e8f0f6'], night: ['#0d1430', '#2a3a66'], cake: ['#5a3a2a', '#e0a070'] }[kind];
  g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]); c.fillStyle = g; c.fillRect(10, 10, 140, 140);
  const fig = (x, y, s, col) => { c.fillStyle = '#e8c0a0'; c.beginPath(); c.arc(x, y - 30 * s, 8 * s, 0, 7); c.fill(); c.fillStyle = col; c.fillRect(x - 9 * s, y - 22 * s, 18 * s, 26 * s); };
  if (kind === 'night') { c.fillStyle = '#fff'; for (let i = 0; i < 40; i++) c.fillRect(10 + (i * 37) % 140, 10 + (i * 53) % 90, 1.5, 1.5); }
  fig(64, 140, 1.25, '#5a5d63'); fig(92, 142, 1.0, '#e4d7c2');
  c.fillStyle = 'rgba(255,220,180,0.12)'; c.fillRect(10, 10, 140, 140);
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
  return t;
}
function polaroid(x, y, z, ry, kind, tilt = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.142), G.std({ map: photoTex(kind), roughness: 0.5, env: 0.5 }));
  m.position.set(x, y, z); m.rotation.set(0, ry, tilt); G.world.add(m);
  return m;
}

/* ---------------- build ---------------- */
G.buildInterior = () => {
  // Everything built here is laid out in the old, shallower cabin; afterwards it's moved to the deeper one (G.ZM).
  const n0 = { w: G.world.children.length, c: G.COLL.length, i: G.INTER.length };
  buildRooms();
  for (const o of G.world.children.slice(n0.w)) o.position.z = G.ZM(o.position.x, o.position.z);
  for (const b of G.COLL.slice(n0.c)) { const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, d = G.ZM(cx, cz) - cz; b.z0 += d; b.z1 += d; }
  for (const it of G.INTER.slice(n0.i)) it.pos[2] = G.ZM(it.pos[0], it.pos[2]);
  G.BED.z = G.ZM(G.BED.x, G.BED.z);
  G.FIRE.lightAt.copy(G.FIRE.light.position);
  for (const v of Object.values(G.KITCHEN || {})) if (v && typeof v.x === 'number' && typeof v.z === 'number') v.z = G.ZM(v.x, v.z);
  buildNook();
  buildHomely();
};
/* ---------- the reading nook: the new back corner of the living room, beside the hearth ----------
 * An alcove under its own window: a window seat piled with cushions, books on the side wall, a reading lamp,
 * a beam across the opening with fairy lights, and curtains tied back. */
function buildNook() {
  const W = G.world, z0 = G.CAB.z0, NX0 = 9.2, NX1 = 10.89, nz = -0.75;
  // the opening: a beam and two posts, softened with a pair of curtains
  box(0.12, 2.12, 0.12, MAT.darkWood, NX0, 1.06, nz, { coll: true });
  box(NX1 - NX0 + 0.1, 0.16, 0.14, MAT.darkWood, (NX0 + NX1) / 2, 2.2, nz);
  const curtainM = G.std({ map: TX.knitCream, color: '#c98f6a', roughness: 1, side: THREE.DoubleSide });
  for (const [x, s] of [[NX0 + 0.2, 1], [NX1 - 0.18, -1]]) curtain(x, nz + 0.05, 0.42, 2.05, curtainM, s, true);
  for (let i = 0; i <= 18; i++) { const t = i / 18, b = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 4), MAT.bulb); b.position.set(NX0 + 0.05 + t * (NX1 - NX0 - 0.1), 2.08 - Math.sin(t * Math.PI) * 0.12, nz + 0.08); W.add(b); }
  // the window seat
  const sx = 10.05, sz = z0 + 0.38;
  box(1.5, 0.42, 0.62, MAT.wood, sx, 0.21, sz, { coll: true, r: 0.02 });
  box(1.46, 0.1, 0.58, MAT.knitCream, sx, 0.47, sz, { r: 0.04, seg: 3 });
  const cush = [['#b65a3e', -0.5, -0.15], ['#d9cbb4', -0.15, 0.1], ['#6e7f62', 0.42, -0.2]];
  for (const [c, dx, ry] of cush) { const m = G.pillow(0.4, 0.36, 0.15, G.std({ map: TX.knitCream, color: c, roughness: 1 }), sx + dx, 0.66, sz - 0.18, { seed: dx * 9 }); m.rotation.set(-0.35, ry, 0.08); }
  const th = box(0.7, 0.04, 0.5, MAT.plaid, sx + 0.3, 0.54, sz + 0.08, { r: 0.02 }); th.rotation.set(0.05, 0.4, -0.15);
  for (let i = 0; i < 3; i++) box(0.2, 0.04, 0.15, G.shared({ color: ['#2d4659', '#8a3a2e', '#d4c6a8'][i], roughness: 0.8 }), sx - 0.62, 0.54 + i * 0.04, sz + 0.1, { r: 0.005 }).rotation.y = i * 0.2;
  cyl(0.04, 0.035, 0.09, G.std({ color: '#efe7da', roughness: 0.3, env: 0.8 }), sx + 0.66, 0.565, sz + 0.12, { seg: 16 });
  // books along the side wall, a plant, and a little round rug
  bookshelf(NX1 - 0.18, z0 + 1.15, 0.34, 1.1, 1.85, Math.PI / 2);
  plant(NX0 + 0.25, z0 + 0.35, 0.9);
  const rug = G.add(new THREE.Mesh(new THREE.CircleGeometry(0.7, 32), MAT.rug), W, false, true); rug.rotation.x = -Math.PI / 2; rug.position.set(sx, 0.007, z0 + 1.15);
  G.NOOK = { x: sx, z: sz + 0.12, seatY: 0.5 };
  G.INTER.push({ id: 'nook', pos: [sx, 0.6, sz + 0.5], r: 1.0, label: 'Window seat', act: () => G.Story.nook && G.Story.nook() });
}
// A curtain: a hanging panel of soft folds; tied back (narrow at the waist) or hanging straight.
function curtain(x, z, w, h, mat, side = 1, tied = false, alongX = true) {
  const g = new THREE.PlaneGeometry(w, h, 16, 12), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / w + 0.5, v = p.getY(i) / h + 0.5;
    const pinch = tied ? 1 - 0.55 * Math.exp(-((v - 0.42) ** 2) / 0.02) : 1;
    p.setX(i, (u - 0.5) * w * pinch + (tied ? side * (1 - pinch) * w * 0.4 : 0));
    p.setZ(i, Math.sin(u * Math.PI * 6) * 0.03 * pinch + 0.02);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
  m.position.set(x, h / 2 + 0.08, z); if (!alongX) m.rotation.y = Math.PI / 2; G.world.add(m);
  return m;
}
/* ---------- lived-in: curtains at the windows, rugs, throws, plants, boots by the door, a kitchen pendant ---------- */
function buildHomely() {
  const W = G.world, z0 = G.CAB.z0, z1 = G.CAB.z1;
  const cM = G.std({ map: TX.knitCream, color: '#d7b48e', roughness: 1, side: THREE.DoubleSide });
  const rod = (x0, x1, z, y) => { const r = cyl(0.012, 0.012, x1 - x0 + 0.2, MAT.darkMetal, (x0 + x1) / 2, y, z, { seg: 8 }); r.rotation.z = Math.PI / 2; };
  // front windows (inside face of the front wall) and the one over the sink
  for (const [a, b] of [[1.6, 3.2], [8.6, 10.2], [12.2, 13.8]]) { rod(a, b, z1 - 0.2, 2.2); curtain(a - 0.12, z1 - 0.2, 0.36, 2.1, cM, 1, true); curtain(b + 0.12, z1 - 0.2, 0.36, 2.1, cM, -1, true); }
  // the west (bedroom) window: on the side wall
  for (const zz of [-1.02, 0.72]) { const c = curtain(0.2, zz, 0.36, 2.1, cM, 1, true, false); c.position.x = 0.2; }
  // a café curtain at the sink window
  // (red gingham, gathered on a little rod: it was a plain cream sheet, which the light behind it turned into a blank
  // white panel across the window)
  { const ging = G.canvasTex(128, (u, v, x, y) => {
      const a = (u * 8) % 1 < 0.5, b = (v * 8) % 1 < 0.5, n = 1 + ((x * 7 + y * 13) % 5 - 2) * 0.01;
      const k = a && b ? 0 : a || b ? 1 : 2, c = [[150, 58, 48], [214, 158, 140], [240, 230, 214]][k];
      return [c[0] * n, c[1] * n, c[2] * n];
    });
    ging.repeat.set(5, 1.8);
    const g = new THREE.PlaneGeometry(1.2, 0.42, 24, 4); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.sin(x * 34) * 0.016 * (0.6 + (0.21 - y) * 1.6)); }   // gathered at the rod, fuller toward the hem
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, G.std({ map: ging, bumpMap: TX.fabricB, bumpScale: 0.001, roughness: 1, side: THREE.DoubleSide, env: 0.2 })); m.position.set(13.05, 1.4, z0 + 0.2); W.add(m);
    const r = cyl(0.007, 0.007, 1.3, MAT.metal, 13.05, 1.615, z0 + 0.2, { seg: 6 }); r.rotation.z = Math.PI / 2; }
  // rugs: a long runner by the bed, a sheepskin by the hearth, a mat inside the door
  const rug = (w, d, x, z, mat, ry = 0) => { const m = G.add(new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat), W, false, true); m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x, 0.007, z); return m; };
  rug(0.7, 2.0, 0.95, -0.8, MAT.rug);
  const sheep = G.add(new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), G.std({ map: TX.knitCream, color: '#f4eee4', roughness: 1 })), W, false, true); sheep.rotation.x = -Math.PI / 2; sheep.scale.set(1.3, 0.9, 1); sheep.position.set(8.6, 0.008, -0.9);
  rug(1.0, 0.6, 6.5, z1 - 0.5, G.std({ color: '#5a4636', roughness: 1 }));
  // boots on the mat, and a basket of hats and mittens
  for (const [x, c] of [[6.0, '#4a3426'], [6.18, '#4a3426'], [6.95, '#6b4a32'], [7.1, '#6b4a32']]) { const b = box(0.11, 0.24, 0.27, G.shared({ color: c, roughness: 0.6 }), x, 0.12, z1 - 0.38, { r: 0.04 }); b.rotation.y = (x * 7) % 0.3 - 0.15; }
  cyl(0.2, 0.17, 0.3, G.std({ map: TX.bark, color: '#c9a26e', roughness: 1 }), 4.65, 0.15, z1 - 0.45, { seg: 16 });
  sph(0.11, G.std({ map: TX.knitCream, color: '#b8322a', roughness: 1 }), 4.6, 0.32, z1 - 0.42, [1, 0.6, 1]);
  // plants: the bedroom corner and the kitchen
  plant(0.45, z0 + 0.5, 1.1); plant(14.55, 1.4, 0.8);
  // a bench at the foot of the bed with a folded blanket, and a stack of books by the bed
  box(1.3, 0.42, 0.4, MAT.wood, 2.4, 0.21, 0.45, { coll: true, r: 0.02 });
  box(0.8, 0.12, 0.34, MAT.plaid, 2.2, 0.48, 0.45, { r: 0.04 });
  for (let i = 0; i < 4; i++) box(0.22, 0.045, 0.16, G.shared({ color: ['#5e4870', '#9a5a36', '#2d4659', '#d4c6a8'][i], roughness: 0.8 }), 0.75, 0.025 + i * 0.045, -2.0, { r: 0.004 }).rotation.y = i * 0.25;
  // a throw over the sofa back and a knitted pouffe
  const pf = cyl(0.3, 0.3, 0.36, G.std({ map: TX.knitCream, color: '#c0a07a', roughness: 1 }), 9.55, 0.18, 2.0, { seg: 20 }); G.COLL.push({ x0: 9.25, z0: 1.7, x1: 9.85, z1: 2.3 });
  // (the kitchen's pendant is built with the kitchen; a second, copper one hung here too, just under it, so the table
  // had two lamps, one inside the other)
  // fairy lights along the living-room beam, over the sofa
  for (let i = 0; i <= 36; i++) { const t = i / 36, b = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 4), MAT.bulb); b.position.set(5.3 + t * 5.4, 2.5 - Math.sin(t * Math.PI * 4) * 0.07, 3.95); W.add(b); }
}
/* A throw laid over the arm of a chair or sofa: a cloth following `path` (x, y in the parent's frame, from the seat,
 * over the arm, down the outside) from z0 to z1, the part that hangs rippling more toward its free edge. */
function drapeOver(parent, mat, path, z0, z1, o = {}) {
  const len = [0]; for (let i = 1; i < path.length; i++) len.push(len[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const L = len[len.length - 1], top = len[o.hangFrom || 4];
  const at = (s) => { let i = 1; while (i < path.length - 1 && len[i] < s) i++; const f = (s - len[i - 1]) / (len[i] - len[i - 1]); return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f]; };
  const NS = 36, NZ = Math.max(12, Math.round((z1 - z0) * 40)), P = [], UV = [], I = [];
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NS; i++) {
    const sl = (i / NS) * L, zz = z0 + (j / NZ) * (z1 - z0), [px, py] = at(sl), hang = Math.max(0, (sl - top) / (L - top));
    const fold = Math.sin(zz * 22 + 1.3) * 0.012 * hang + Math.sin(zz * 9) * 0.006 * hang;
    P.push(px + fold + 0.012, py + 0.008 - hang * hang * Math.abs(Math.sin(zz * 11)) * 0.03, zz + Math.sin(sl * 9) * 0.01 * hang);
    UV.push(sl / 0.3, (zz - z0) / 0.3);
  }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NS; i++) { const a0 = j * (NS + 1) + i, a1 = a0 + NS + 1; I.push(a0, a0 + 1, a1, a1, a0 + 1, a1 + 1); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); tg.setIndex(I); tg.computeVertexNormals();
  const tm = mat.clone(); tm.side = THREE.DoubleSide; G.MATS.push(tm);
  return G.add(new THREE.Mesh(tg, tm), parent, true, true);
}
function buildRooms() {
  const W = G.world;
  /* ===== Bedroom ===== */
  const bx = 2.4;
  // The bed: a wooden frame stained like the wardrobe, on legs, its rails round the mattress, square posts with round
  // caps, and a headboard upholstered in teal velvet, buttoned, puffed between the buttons. (It was a dark box with a
  // dark slab standing behind it.)
  {
    const { V: wV, H: wH } = G.FURN('#7a5640');
    G.COLL.push({ x0: bx - 0.9, z0: 0.125, x1: bx + 0.9, z1: 2.275 });
    box(1.72, 0.04, 2.05, G.shared({ color: '#2a201a', roughness: 1 }), bx, 0.28, 1.21, { cast: false });   // the slats, under the mattress
    for (const s of [-1, 1]) box(0.06, 0.2, 2.06, wH, bx + s * 0.88, 0.24, 1.2, { r: 0.008, uv: [3, 0.4] });   // side rails
    box(1.84, 0.22, 0.06, wH, bx, 0.25, 2.25, { r: 0.008, uv: [3, 0.4] });   // foot rail
    const cap = (x, y, z) => { cyl(0.05, 0.05, 0.02, wV, x, y + 0.01, z, { seg: 16 }); sph(0.042, wV, x, y + 0.035, z, [1, 0.7, 1], W, 14); };
    for (const s of [-1, 1]) { box(0.08, 0.45, 0.08, wV, bx + s * 0.92, 0.225, 2.25, { r: 0.008, uv: [0.15, 0.8] }); cap(bx + s * 0.92, 0.45, 2.25); }   // foot posts
    for (const s of [-1, 1]) { box(0.08, 1.24, 0.08, wV, bx + s * 0.92, 0.62, 0.165, { r: 0.008, uv: [0.15, 2] }); cap(bx + s * 0.92, 1.24, 0.165); }   // head posts
    // the headboard's crest, rising a little in the middle, and its bottom rail
    const sh = new THREE.Shape(); sh.moveTo(-0.88, 0); sh.lineTo(0.88, 0); sh.lineTo(0.88, 0.1); sh.quadraticCurveTo(0, 0.2, -0.88, 0.1); sh.lineTo(-0.88, 0);
    const crest = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 16 }), wH);
    crest.position.set(bx, 1.06, 0.145); crest.castShadow = true; G.add(crest, W, true, true);
    { const g = crest.geometry, P = g.attributes.position, UVa = g.attributes.uv; for (let i = 0; i < P.count; i++) UVa.setXY(i, P.getX(i) / 0.6, P.getY(i) / 0.6 + P.getZ(i)); }
    box(1.76, 0.08, 0.05, wH, bx, 0.5, 0.165, { r: 0.006, uv: [3, 0.3] });
    // the upholstered panel between: puffed between the buttons, drawn in at each
    const PW = 1.76, PH = 0.52, PY = 0.54, bt = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < (r % 2 ? 4 : 5); c++) bt.push([-PW / 2 + 0.14 + (c + (r % 2 ? 0.5 : 0)) * ((PW - 0.28) / 4), 0.11 + r * ((PH - 0.22) / 2)]);
    const pg = new THREE.PlaneGeometry(PW, PH, 88, 26), PP = pg.attributes.position;
    for (let i = 0; i < PP.count; i++) {
      const x = PP.getX(i), y = PP.getY(i) + PH / 2;
      let dmin = 9; for (const [u, v] of bt) dmin = Math.min(dmin, Math.hypot(x - u, (y - v) * 1.15));
      const edge = Math.min(1, (PW / 2 - Math.abs(x)) / 0.05, y / 0.04, (PH - y) / 0.04);
      PP.setZ(i, 0.03 * (1 - Math.exp(-(dmin * dmin) / 0.006)) * Math.max(0, edge));
    }
    pg.computeVertexNormals();
    const velvetTex = G.canvasTex(128, (u, v) => { const t = 0.9 + G.fbm(u * 40, v * 40, 2) * 0.1 + Math.sin(u * 300) * 0.01; return [235 * t, 235 * t, 235 * t]; });
    const velvet = G.std({ map: G.rep(velvetTex, 6, 2), color: '#5f7a72', roughness: 0.85, env: 0.15 });
    const panel = new THREE.Mesh(pg, velvet); panel.position.set(bx, PY + PH / 2, 0.15); panel.receiveShadow = panel.castShadow = true; G.add(panel, W, true, true);
    box(PW, PH, 0.02, velvet, bx, PY + PH / 2, 0.14, { cast: false });   // its back
    for (const [u, v] of bt) sph(0.012, G.shared({ color: '#46605a', roughness: 0.6 }), bx + u, PY + v, 0.152, [1, 1, 0.6], W, 8);
  }
  box(1.7, 0.22, 2.0, MAT.linen, bx, 0.41, 1.22, { r: 0.09, seg: 4 });
  // pillows: plump in the middle, thinning to the seam (they were rounded blocks)
  const p1 = G.pillow(0.68, 0.2, 0.44, MAT.linen, bx - 0.44, 0.61, 0.48, { seed: 1 }); p1.rotation.set(-0.25, 0.04, 0.02);
  const p2 = G.pillow(0.68, 0.2, 0.44, MAT.linen, bx + 0.44, 0.61, 0.48, { seed: 4 }); p2.rotation.set(-0.2, -0.05, -0.02);
  const bolster = box(0.5, 0.2, 0.18, MAT.knitCream, bx + 0.25, 0.62, 0.72, { r: 0.08, seg: 4 }); bolster.rotation.set(-0.4, 0.2, 0);
  const dm = MAT.quilt.clone(); dm.map = G.rep(TX.quilt, 1.7, 1.45); dm.bumpMap = G.rep(TX.quiltB, 1.7, 1.45); G.MATS.push(dm);
  const duvet = box(1.76, 0.12, 1.5, dm, bx, 0.56, 1.5, { r: 0.06, seg: 4 });
  const throwB = box(1.84, 0.06, 0.6, MAT.plaid, bx, 0.64, 1.95, { r: 0.03 }); throwB.rotation.z = 0.01;
  // Made bed vs slept-in bed: the tidy duvet swaps for a rumpled one draped over whoever is in it.
  for (const m of [duvet, throwB, bolster]) m.userData.dynamic = true;
  G.BED = { x: bx, z: 1.2, top: 0.52, made: [duvet, throwB, bolster], cover: bedCover(bx), L: bx - 0.38, R: bx + 0.4 };
  // Plush bunny, keeping watch from the pillow corner.
  const bun = new THREE.Group(); bun.position.set(bx + 0.8, 0.6, 0.52); bun.rotation.y = -0.5; W.add(bun);
  const fluff = G.std({ color: '#f2ece4', roughness: 1, map: TX.knitCream, bumpMap: TX.knitB, bumpScale: 0.002 });
  sph(0.075, fluff, 0, 0.06, 0, [1, 1.05, 0.9], bun); sph(0.06, fluff, 0, 0.17, 0.02, [1, 0.95, 0.95], bun);
  for (const s of [-1, 1]) { sph(0.022, fluff, s * 0.025, 0.27, 0.0, [0.8, 2.4, 0.5], bun); sph(0.008, MAT.darkMetal, s * 0.022, 0.18, 0.07, [1, 1, 1], bun, 8); }
  // Nightstands and lamps.
  // Nightstands to match the bed: a top with a little overhang, a drawer with a brass knob, an open shelf under with
  // books on it, on tapered legs. (They were plain boxes of the floorboards.)
  {
    const { V: wV, H: wH } = G.FURN('#7a5640'), r = G.seeded(155);
    for (const s of [-1, 1]) {
      const x = bx + s * 1.28, z = 0.38;
      G.COLL.push({ x0: x - 0.25, z0: z - 0.21, x1: x + 0.25, z1: z + 0.21 });
      box(0.54, 0.03, 0.45, wH, x, 0.545, z, { r: 0.01, uv: [0.9, 0.75] });
      box(0.48, 0.21, 0.4, wV, x, 0.425, z, { r: 0.004, uv: [0.8, 0.35] });
      box(0.44, 0.17, 0.016, wH, x, 0.425, z + 0.207, { r: 0.004, uv: [0.75, 0.3] });
      sph(0.016, MAT.metal, x, 0.43, z + 0.225, [1, 1, 0.8], W, 12);
      for (const [dx, dz] of [[-0.21, -0.17], [0.21, -0.17], [-0.21, 0.17], [0.21, 0.17]]) cyl(0.022, 0.015, 0.32, wV, x + dx, 0.16, z + dz, { seg: 10 });
      box(0.44, 0.02, 0.36, wH, x, 0.1, z, { r: 0.004, uv: [0.75, 0.6] });   // the shelf
      for (let k = 0; k < 3; k++) {   // books lying on it
        const bw = 0.2 + r() * 0.06, bh = 0.025 + r() * 0.012;
        const bk = box(bw, bh, 0.15 + r() * 0.04, G.shared({ color: ['#6b4a5a', '#3f5a6a', '#8a6a3a', '#5a6a4a'][Math.floor(r() * 4)], roughness: 0.7 }), x - 0.05 + (r() - 0.5) * 0.04, 0.11 + 0.012 + k * 0.032, z + 0.02, { r: 0.004 });
        bk.rotation.y = (r() - 0.5) * 0.3;
      }
    }
  }
  const lampL = tableLamp(bx - 1.28, 0.56, 0.36, 5), lampR = tableLamp(bx + 1.28, 0.56, 0.36, 5);
  candle(bx + 1.42, 0.56, 0.5, 0.08);
  G.INTER.push({ id: 'lampL', pos: [bx - 1.28, 0.8, 0.6], r: 1.0, label: 'Lamp', act: () => G.toggleLamp(lampL) });
  G.INTER.push({ id: 'lampR', pos: [bx + 1.28, 0.8, 0.6], r: 1.0, label: 'Lamp', act: () => G.toggleLamp(lampR) });
  // Fairy lights over the headboard, polaroids pegged on a string.
  for (let i = 0; i <= 30; i++) {
    const t = i / 30, x = lerp(0.6, 4.2, t), y = 1.9 - Math.sin(t * Math.PI * 3) * 0.08 - Math.sin(t * Math.PI) * 0.12;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), MAT.bulb); b.position.set(x, y, 0.135); W.add(b);
  }
  ['lake', 'snow', 'fire', 'hill', 'night', 'cake'].forEach((k, i) => polaroid(1.1 + i * 0.5, 1.62 - Math.sin((i + 0.5) / 6 * Math.PI) * 0.1, 0.125, 0, k, (i % 2 ? 1 : -1) * 0.06));
  G.INTER.push({ id: 'photos', pos: [2.4, 1.5, 1.4], r: 1.3, label: 'Photographs', act: () => G.say(null, '(Six polaroids on a string. The lake. The fire. The night you both got lost and didn’t mind.)') });
  // Wardrobe, rug, plant, laundry basket.
  // The wardrobe: an old pine armoire, stained dark, on a plinth under a stepped cornice, with two panelled doors (a
  // frame round a raised panel, a tall one over a short one), brass knobs and a keyhole, the hinges showing, and a
  // drawer under the doors. On top, an old leather suitcase and a hatbox. (It was a dark slab with a line down it.)
  {
    const { V: woodV, H: woodH } = G.FURN('#7a5640'), panelM = G.FURN('#86604a').V;   // fine grain, no board seams (core.js)
    box(1.1, 1.91, 0.58, woodV, 4.3, 1.065, 0.42, { coll: true, cam: true });   // the carcass
    const W2 = new THREE.Group(); W2.position.set(4.3, 0, 0.71); W.add(W2);   // the front, at the carcass's face (so it moves back with the bedroom)
    const fb = (w, h, d, x, y, z, m, o = {}) => G.box(w, h, d, m, x, y, z, { parent: W2, uv: [Math.max(w, d) / 0.6, h / 0.6], ...o });
    // plinth and cornice
    fb(1.16, 0.1, 0.64, 0, 0.05, -0.29, woodH); fb(1.18, 0.02, 0.66, 0, 0.11, -0.29, woodH, { r: 0.006 });
    fb(1.16, 0.035, 0.63, 0, 2.037, -0.29, woodH); fb(1.2, 0.025, 0.67, 0, 2.067, -0.29, woodH, { r: 0.006 }); fb(1.24, 0.04, 0.7, 0, 2.1, -0.29, woodH, { r: 0.008 });
    // the doors: each a frame round a tall panel and a short one
    const DW = 0.528, DY0 = 0.355, DY1 = 1.985, DH = DY1 - DY0, DZ = 0.011;
    for (const s of [-1, 1]) {
      const cx = s * (DW / 2 + 0.003);
      fb(DW, DH, 0.022, cx, (DY0 + DY1) / 2, DZ, woodV);
      const st = 0.075, rT = 0.09, rM = 0.08, rB = 0.11, ym = DY0 + rB + (DH - rB - rT - rM) * 0.32 + rM / 2;   // stiles, top/middle/bottom rails
      for (const k of [-1, 1]) fb(st, DH, 0.012, cx + k * (DW / 2 - st / 2), (DY0 + DY1) / 2, 0.028, woodV, { r: 0.003 });
      for (const [yy, hh] of [[DY1 - rT / 2, rT], [ym, rM], [DY0 + rB / 2, rB]]) fb(DW - 2 * st, hh, 0.012, cx, yy, 0.028, woodH, { r: 0.003 });
      // the raised panels, between them
      const pw = DW - 2 * st - 0.012;
      for (const [y0, y1] of [[ym + rM / 2, DY1 - rT], [DY0 + rB, ym - rM / 2]]) fb(pw, y1 - y0 - 0.012, 0.014, cx, (y0 + y1) / 2, 0.019, panelM, { r: 0.006, seg: 2 });   // its face 8 mm back from the frame's
      // hinges at the outer edge
      for (const hy of [DY0 + 0.2, DY1 - 0.2]) G.box(0.012, 0.075, 0.016, MAT.darkMetal, cx + s * (DW / 2 + 0.002), hy, 0.016, { parent: W2, cast: false });
      // a brass knob on each, by the meeting stiles
      const kx = cx - s * (DW / 2 - 0.038);
      G.cyl(0.006, 0.008, 0.02, MAT.metal, kx, 1.13, 0.044, { parent: W2, seg: 8 }).rotation.x = Math.PI / 2;
      G.sph(0.016, MAT.metal, kx, 1.13, 0.058, [1, 1, 0.85], W2, 12);
    }
    // a keyhole plate under the right knob
    G.box(0.022, 0.042, 0.003, MAT.metal, 0.038, 1.06, 0.0355, { parent: W2, cast: false });
    G.box(0.005, 0.014, 0.002, G.shared({ color: '#0c0a08', roughness: 1 }), 0.038, 1.058, 0.0375, { parent: W2, cast: false });
    // the drawer under the doors, with two knobs
    fb(1.06, 0.2, 0.024, 0, 0.228, 0.012, woodH, { r: 0.004 });
    fb(0.98, 0.13, 0.008, 0, 0.228, 0.026, panelM, { r: 0.003 });
    for (const s of [-1, 1]) G.sph(0.015, MAT.metal, s * 0.26, 0.228, 0.04, [1, 1, 0.85], W2, 12);
    // On top: an old suitcase, tan leather with darker straps and a handle, and a round striped hatbox.
    const leather = G.std({ color: '#8a5a34', roughness: 0.6, env: 0.3 }), strap = G.std({ color: '#4a2e1c', roughness: 0.55, env: 0.3 });
    G.box(0.62, 0.17, 0.4, leather, -0.18, 2.205, -0.3, { parent: W2, r: 0.025 });
    for (const sx of [-0.2, 0.16]) G.box(0.035, 0.178, 0.408, strap, -0.18 + sx, 2.205, -0.3, { parent: W2, r: 0.006 });
    for (const sx of [-0.2, 0.16]) G.box(0.03, 0.03, 0.006, MAT.metal, -0.18 + sx, 2.21, -0.093, { parent: W2, cast: false });   // buckles
    const hnd = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 6, 14, Math.PI), strap); hnd.position.set(-0.18, 2.29, -0.3); W2.add(hnd);
    const hat = G.cyl(0.15, 0.15, 0.2, G.std({ map: G.canvasTex(0, null, { w: 128, h: 32, draw: (c, w, h) => { c.fillStyle = '#d8cdb8'; c.fillRect(0, 0, w, h); c.fillStyle = '#7f9aa6'; for (let i = 0; i < w; i += 16) c.fillRect(i, 0, 7, h); } }), roughness: 0.85, env: 0.2 }), 0.28, 2.22, -0.32, { parent: W2, seg: 24 });
    hat.rotation.y = 0.4;
    G.cyl(0.155, 0.155, 0.045, G.std({ color: '#c9bfa9', roughness: 0.85 }), 0.28, 2.305, -0.32, { parent: W2, seg: 24 });   // its lid
  }
  const rug = G.add(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), MAT.rug), W, false, true); rug.rotation.x = -Math.PI / 2; rug.position.set(bx, 0.006, 3.2);
  plant(0.45, 3.6, 1.0);
  box(0.9, 0.42, 0.5, MAT.wood, 3.6, 0.21, 4.15, { coll: true, r: 0.02 });   // chest at the foot wall
  box(0.6, 0.05, 0.45, MAT.plaid, 3.5, 0.45, 4.15, { r: 0.02 });
  for (let i = 0; i < 4; i++) box(0.22, 0.05 + i * 0.002, 0.16, G.shared({ color: ['#6b3a2e', '#2e4a5a', '#c9b48a', '#3a5a40'][i], roughness: 0.8 }), 3.85, 0.48 + i * 0.05, 4.1);

  /* ===== Living room ===== */
  const fx = 8.0;
  // The chimney breast, built round a real firebox 32 cm deep (it was a solid block with a black panel on its face,
  // the logs on the hearth in front of it, so with the fire out it was a black rectangle).
  // It's fieldstone, like the chimney outside (build 145): rounded stones of every size and colour, grey and brown and
  // bluish, standing out from deep joints, blackened with soot up over the opening, under a stone lintel. (It was a
  // flat grey stone painted on the blocks, every stone outlined like a drawing.) The stone is laid by its position, so
  // the courses run on across the pieces. Under the stones the breast is still four plain blocks: they keep the camera
  // out and cast the shadows.
  const FT = 1.2;   // the stone's tile, as on the chimney outside
  const stoneUV = (m) => { const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, UVa = g.attributes.uv;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i) + m.position.x, y = P.getY(i) + m.position.y, z = P.getZ(i) + m.position.z, nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i));
      if (ny > 0.5) UVa.setXY(i, x / FT, z / FT); else if (nx > 0.5) UVa.setXY(i, z / FT, y / FT); else UVa.setXY(i, x / FT, y / FT); } UVa.needsUpdate = true; };
  const FB = { x0: fx - 0.5, x1: fx + 0.5, top: 0.81, back: 0.34, face: 0.66 };
  G.COLL.push({ x0: fx - 1.0, z0: 0.04, x1: fx + 1.0, z1: 0.66 });
  const blockM = G.std({ map: TX.fieldIn, color: '#8a8580', roughness: 0.95, env: 0.15 });
  for (const [x0, x1, y0, y1, z0, z1] of [[fx - 1, FB.x0, 0, FB.top, 0.04, 0.66], [FB.x1, fx + 1, 0, FB.top, 0.04, 0.66], [fx - 1, fx + 1, FB.top, 2.7, 0.04, 0.66], [FB.x0, FB.x1, 0, FB.top, 0.04, FB.back]])
    stoneUV(box(x1 - x0, y1 - y0, z1 - z0, blockM, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, { cam: true }));
  {
    const fieldM = G.std({ map: TX.fieldIn, bumpMap: TX.fieldB, bumpScale: 0.01, roughness: 0.9, env: 0.2, vertexColors: true });
    const STEP = G.qName === 'Low' ? 0.03 : 0.015, RISE = 0.028, OFF = 0.01, TOP = 2.7;
    const out = (U, V) => OFF + (G.fieldH(U, V) - 0.3) * RISE;   // how far the stone stands out of the block here
    // soot: up the stone over the opening, where the smoke curls out before it draws, fading out under the mantel
    const sootK = (x, y) => { const e = Math.hypot((x - fx) / 0.8, Math.max(0, y - FB.top + 0.06) / 0.72); return 1 - 0.8 * (y > FB.top - 0.14 ? 1 - G.smooth(0.2, 1.0, e) : 0); };
    // a sheet of stone: at(i, j) gives [x, y, z, u, v] for each point of an (nu + 1) x (nv + 1) grid, i along the face
    // and j up it, laid so the face looks out; keep(i, j) whether to keep that cell
    const sheet = (nu, nv, at, keep) => {
      const P = [], UV = [], C = [], I = [], t = [];
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { at(i, j, t); P.push(t[0] - fx, t[1], t[2] - 0.5); UV.push(t[3], t[4]); const k = sootK(t[0], t[1]); C.push(k, k * 0.985, k * 0.97); }
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) if (!keep || keep(i, j)) { const p = j * (nu + 1) + i; I.push(p, p + 1, p + nu + 2, p, p + nu + 2, p + nu + 1); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      g.setIndex(I); g.computeVertexNormals();
      const m = G.add(new THREE.Mesh(g, fieldM), null, false, true); m.position.set(fx, 0, 0.5);   // at the hearth, so it moves back with the hearth wall (G.ZM)
      return m;
    };
    // the two front corners: the stone on the face and on the side meet there, rounded over it
    const corner = (s, y, t) => { const x = fx + s, z = FB.face, d = OFF + ((G.fieldH(x / FT, y / FT) + G.fieldH(z / FT, y / FT)) / 2 - 0.3) * RISE; t[0] = x + Math.sign(s) * d; t[1] = y; t[2] = z + d; };
    const NA = 4 * Math.round(2 / STEP / 4), NB = 10 * Math.round(TOP / STEP / 10), JT = (NB * FB.top) / TOP;   // the opening falls on the grid
    // the face, the opening cut out of it
    const faceAt = (i, j, t) => {
      const x = fx - 1 + (2 * i) / NA, y = (TOP * j) / NB;
      if (i === 0 || i === NA) corner(i ? 1 : -1, y, t); else { t[0] = x; t[1] = y; t[2] = FB.face + out(x / FT, y / FT); }
      t[3] = x / FT; t[4] = y / FT;
    };
    sheet(NA, NB, faceAt, (i, j) => !(j < JT && i >= NA / 4 && i < (3 * NA) / 4));
    // the sides, back to the wall
    const NS = Math.max(2, Math.round((FB.face - 0.04) / STEP));
    for (const s of [-1, 1]) sheet(NS, NB, (i, j, t) => {
      const k = s < 0 ? i / NS : 1 - i / NS, z = 0.04 + (FB.face - 0.04) * k, y = (TOP * j) / NB;
      if ((s < 0 && i === NS) || (s > 0 && i === 0)) corner(s, y, t); else { t[0] = fx + s * (1 + out(z / FT, y / FT)); t[1] = y; t[2] = z; }
      t[3] = z / FT; t[4] = y / FT;
    });
    // the jambs: the stone turns in round each side of the opening and tucks behind the firebrick
    for (const s of [-1, 1]) {
      const xe = fx + s * 0.5;
      sheet(1, JT, (i, j, t) => {
        const y = (TOP * j) / NB, front = s < 0 ? i === 0 : i === 1;
        t[0] = front ? xe : xe - s * 0.002; t[1] = y; t[2] = front ? FB.face + out(xe / FT, y / FT) : FB.face - 0.012;
        t[3] = (xe - s * (front ? 0 : 0.03)) / FT; t[4] = y / FT;
      });
    }
    // The lintel: one long stone dressed square across the opening, its arrises worn round, the tooling still on its
    // face, sooted from underneath.
    const dressed = G.canvasTex(512, (u, v, x, y) => {   // a grey granite, salt and pepper, the chisel's lines across it
      const hs = G.hash1(x * 3.1 + y * 7.7), hs2 = G.hash1(x * 1.3 + y * 5.9 + 0.4);
      let t = 0.8 + G.fbm(u * 6, v * 2, 3) * 0.14 + G.fbm(u * 50, v * 18, 2) * 0.07 + Math.sin(u * 900 + G.fbm(u * 8, v * 3, 2) * 4) * 0.025;
      t *= hs > 0.9 ? 0.55 : hs2 > 0.94 ? 1.25 : 1;
      return [128 * t, 125 * t, 120 * t];
    }, { w: 512, h: 128 });
    const LW = FB.x1 - FB.x0 + 0.28, LH = 0.2, LD = 0.1, LR = 0.012, ly0 = FB.top - 0.004;
    const lg = new THREE.BoxGeometry(LW, LH, LD, 80, 12, 6), LP = lg.attributes.position, lc = [], v3 = new THREE.Vector3(), q3 = new THREE.Vector3();
    for (let i = 0; i < LP.count; i++) {
      v3.fromBufferAttribute(LP, i);
      q3.set(G.clamp(v3.x, -LW / 2 + LR, LW / 2 - LR), G.clamp(v3.y, -LH / 2 + LR, LH / 2 - LR), G.clamp(v3.z, -LD / 2 + LR, LD / 2 - LR));
      const dv = v3.clone().sub(q3); if (dv.lengthSq() > 1e-10) v3.copy(q3).addScaledVector(dv.normalize(), LR);   // round the arrises
      const bump = (G.fbm(v3.x * 9 + 3, v3.y * 9 + v3.z * 7, 2) - 0.5) * 0.007 + (G.fbm(v3.x * 40, v3.y * 40 + v3.z * 30, 2) - 0.5) * 0.003; v3.addScaledVector(dv.lengthSq() > 1e-10 ? dv : q3.set(0, 0, 1), bump);
      LP.setXYZ(i, v3.x, v3.y, v3.z);
      const k = 1 - 0.72 * G.smooth(LH / 2 + 0.05, -LH / 2, v3.y) * (1 - G.smooth(0.15, 0.66, Math.abs(v3.x)));
      lc.push(k, k * 0.98, k * 0.96);
    }
    lg.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3)); lg.computeVertexNormals();
    const lintel = new THREE.Mesh(lg, G.std({ map: dressed, bumpMap: dressed, bumpScale: 0.003, roughness: 0.85, env: 0.2, vertexColors: true }));
    lintel.position.set(fx, ly0 + LH / 2, FB.face - LD / 2 + 0.042); G.add(lintel, null, true, true);
  }
  // The mantel: a beam hewn square with an adze, its face and underside dished from the strokes, its front edges
  // chamfered by hand and checked along the grain, the sawn ends showing their rings. The top is planed flat for the
  // things on it. (It was a plain dark board.)
  {
    const L = 2.3, H = 0.17, D = 0.44, chT = 0.016, chB = 0.022;
    const hewn = G.canvasTex(0, (u, v, x, y) => {
      const s = u * (L / 0.075) + G.fbm(u * 3, v * 2, 2) * 0.6, f = s - Math.floor(s);
      const grain = G.fbm(u * 5, v * 46, 3) * 0.16 + G.fbm(u * 40, v * 160, 2) * 0.06;
      let t = 0.78 + grain + (f - 0.5) * 0.05;
      for (const [cv, u0, u1] of [[0.31, 0.08, 0.37], [0.64, 0.45, 0.88], [0.86, 0.15, 0.3]]) if (u > u0 && u < u1 && Math.abs(v - cv - Math.sin(u * 23) * 0.006) < 0.0045) t *= 0.35;   // checks
      return [124 * t, 88 * t, 60 * t];
    }, { w: 1024, h: 128 });
    const endTex = G.canvasTex(0, null, { w: 220, h: 86, draw: (c, w, h) => {
      c.fillStyle = '#a07a52'; c.fillRect(0, 0, w, h);
      const cx = w * 0.54, cy = h * 0.42;
      for (let r = 3; r < w; r += 3 + (r % 4)) { c.strokeStyle = r % 3 ? 'rgba(96,64,40,0.35)' : 'rgba(120,84,54,0.25)'; c.beginPath(); c.ellipse(cx, cy, r, r * 0.96, 0, 0, Math.PI * 2); c.stroke(); }
      c.strokeStyle = 'rgba(40,26,16,0.7)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + 18, cy - 30); c.lineTo(cx + 24, 0); c.stroke();
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx - 40, cy + 22); c.stroke();
      const g = c.createRadialGradient(cx, cy, 2, cx, cy, w * 0.7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(50,32,20,0.35)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    } });
    const g = new THREE.BoxGeometry(L, H, D, 184, 8, 12), P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i); let z = P.getZ(i);
      const front = N.getZ(i) > 0.5, under = N.getY(i) < -0.5;
      if (front || under) {   // the adze's strokes, each a shallow dish across the beam
        const s = (x + L / 2) / 0.075 + Math.sin(y * 31 + z * 7) * 0.25, f = s - Math.floor(s), dish = 0.0045 * (1 - (2 * f - 1) ** 2) * (0.7 + 0.3 * Math.sin(Math.floor(s) * 2.3));
        if (front) z -= dish; else P.setY(i, y + dish);
      }
      z = Math.min(z, D / 2 - chT * (0.8 + 0.4 * Math.sin(x * 2.3)) + (H / 2 - y), D / 2 - chB + (y + H / 2));   // the chamfers
      P.setZ(i, z);
    }
    g.computeVertexNormals();
    const sideM = G.std({ map: hewn, bumpMap: hewn, bumpScale: 0.0025, roughness: 0.72, env: 0.25 }), endM = G.std({ map: endTex, roughness: 0.85, env: 0.15 });
    const beam = new THREE.Mesh(g, [endM, endM, sideM, sideM, sideM, sideM]); beam.position.set(fx, 1.48 - H / 2, 0.62); G.add(beam, null, true, true);
  }
  // The hearth: flagstones laid in dark mortar in front of the fire, each its own shape and colour, set a little
  // unevenly, their edges worn round. (It was one thin slab of the painted stone.)
  {
    const r = G.seeded(1520), X0 = fx - 0.95, X1 = fx + 0.95, Z0 = 0.6, Z1 = 1.3, ZR = 0.97, TOPY = 0.06, BEV = 0.007, GAP = 0.009;
    const j = (a) => (r() - 0.5) * a;
    // the cuts across each row (x where it meets the edge, x where it meets the line between the rows)
    const cutsB = [[X0, X0], ...[-0.55, 0.47].map((c) => [fx + c + j(0.05), fx + c + j(0.05)]), [X1, X1]];
    const cutsF = [[X0, X0], ...[-0.36, 0.22].map((c) => [fx + c + j(0.05), fx + c + j(0.05)]), [X1, X1]];
    // the line between the rows: through the ends of every cut, and a point between each
    const xs = [...new Set([...cutsB, ...cutsF].map((c) => c[1]))].sort((a, b) => a - b);
    const rowPts = []; xs.forEach((x, k) => { rowPts.push([x, ZR + j(0.05)]); if (k < xs.length - 1) rowPts.push([(x + xs[k + 1]) / 2 + j(0.06), ZR + j(0.05)]); });
    const rowAt = (x) => rowPts.find((p) => Math.abs(p[0] - x) < 1e-9);
    const between = (a, b) => rowPts.filter((p) => p[0] > a + 1e-9 && p[0] < b - 1e-9);
    const polys = [];
    for (let k = 0; k < cutsB.length - 1; k++) { const A = cutsB[k], B = cutsB[k + 1]; polys.push([[A[0], Z0], [B[0], Z0], rowAt(B[1]), ...between(A[1], B[1]).reverse(), rowAt(A[1])]); }
    for (let k = 0; k < cutsF.length - 1; k++) { const A = cutsF[k], B = cutsF[k + 1]; polys.push([rowAt(A[1]), ...between(A[1], B[1]), rowAt(B[1]), [B[0], Z1], [A[0], Z1]]); }
    // each drawn in from its neighbours by half the joint (and the bevel, which the extrusion adds back)
    const inset = (pts, d) => {
      let area = 0; pts.forEach((p, k) => { const q = pts[(k + 1) % pts.length]; area += p[0] * q[1] - q[0] * p[1]; });
      const sg = area > 0 ? 1 : -1, nrm = (p, q) => { const ex = q[0] - p[0], ez = q[1] - p[1], l = Math.hypot(ex, ez) || 1; return [(-ez / l) * sg, (ex / l) * sg]; };
      return pts.map((p, k) => { const a = pts[(k + pts.length - 1) % pts.length], b = pts[(k + 1) % pts.length], n0 = nrm(a, p), n1 = nrm(p, b), dt = 1 + n0[0] * n1[0] + n0[1] * n1[1];
        return [p[0] + (d * (n0[0] + n1[0])) / dt, p[1] + (d * (n0[1] + n1[1])) / dt]; });
    };
    const flagTex = G.canvasTex(256, (u, v, x, y) => {
      const t = 0.8 + G.fbm(u * 6, v * 6, 3) * 0.2 + G.fbm(u * 34, v * 34, 2) * 0.07 + Math.sin((v * 9 + G.fbm(u * 2, v * 2, 2) * 1.5) * Math.PI * 2) * 0.025 - (G.hash1(x * 5.3 + y * 1.7) > 0.975 ? 0.08 : 0);
      const rust = G.smooth(0.62, 0.8, G.fbm(u * 4 + 7, v * 4, 3)) * 0.35;   // a little iron staining
      return [180 * t * (1 + rust * 0.25), 176 * t * (1 - rust * 0.05), 170 * t * (1 - rust * 0.3)];
    });
    const PAL = ['#6e6964', '#5f5e5e', '#76695c', '#5a5d62', '#6d6458', '#66625c'];
    const parts = polys.map((pts, k) => {
      const ins = inset(pts, GAP / 2 + BEV), cx = ins.reduce((a, p) => a + p[0], 0) / ins.length, cz = ins.reduce((a, p) => a + p[1], 0) / ins.length;
      const sh = new THREE.Shape(ins.map((p) => new THREE.Vector2(p[0] - cx, p[1] - cz)));
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 2, curveSegments: 1 });
      geo.rotateX(Math.PI / 2); geo.computeBoundingBox();
      const c = new THREE.Color(PAL[k % PAL.length]).multiplyScalar(0.92 + r() * 0.14);
      return { geo, mat: G.mtx(cx - fx, TOPY - geo.boundingBox.max.y + j(0.004), cz - 0.5, 1, 1, 1, 0, j(0.012), j(0.012)), color: c, uv: [2, 2] };   // each tipped a little about its middle
    });
    const flags = new THREE.Mesh(G.merge(parts), G.std({ map: flagTex, bumpMap: flagTex, bumpScale: 0.003, roughness: 0.82, env: 0.25, vertexColors: true }));
    flags.position.set(fx, 0, 0.5); G.add(flags, null, false, true);
    box(X1 - X0 - 0.02, 0.045, Z1 - Z0 - 0.02, G.std({ color: '#4a4541', roughness: 1, env: 0.1 }), fx, 0.0225, (Z0 + Z1) / 2 - 0.01, { cast: false });   // the mortar bed
  }
  { // inside: splayed sides and a back of sooty firebrick, darker toward the top; a floor of ash; the soot above
    const brick = G.std({ map: TX.firebrick, bumpMap: TX.firebrick, bumpScale: 0.01, roughness: 0.95, env: 0.1, vertexColors: true });
    const wall = (pts, soot) => {   // a quad from 4 corners (bl, br, tr, tl), brick laid at 0.48 x 0.45 m, soot by height
      const g = new THREE.PlaneGeometry(1, 1, 6, 6), P = g.attributes.position, UVa = g.attributes.uv, C = new Float32Array(P.count * 3);
      const [bl, br, tr, tl] = pts.map((q) => new THREE.Vector3(...q)), wdt = bl.distanceTo(br), hgt = bl.distanceTo(tl), v3 = new THREE.Vector3();
      for (let i = 0; i < P.count; i++) {
        const u = P.getX(i) + 0.5, w = P.getY(i) + 0.5;
        v3.copy(bl).lerp(br, u).lerp(new THREE.Vector3().copy(tl).lerp(tr, u), w); P.setXYZ(i, v3.x, v3.y, v3.z);
        UVa.setXY(i, (u * wdt) / 0.48, (w * hgt) / 0.45);
        const k = (1 - 0.62 * Math.pow(w, 1.3) * soot) * (0.85 + 0.15 * Math.sin(u * Math.PI));
        C[i * 3] = C[i * 3 + 1] = C[i * 3 + 2] = k;
      }
      g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.translate(-fx, 0, -0.5); g.computeVertexNormals();
      const m = G.add(new THREE.Mesh(g, brick), null, false, true); m.position.set(fx, 0, 0.5);   // placed at the hearth, so it moves back with the hearth wall (G.ZM goes by position)
      return m;
    };
    const bx0 = fx - 0.36, bx1 = fx + 0.36, y0 = 0.06, y1 = FB.top;
    wall([[bx0, y0, FB.back + 0.001], [bx1, y0, FB.back + 0.001], [bx1, y1, FB.back + 0.001], [bx0, y1, FB.back + 0.001]], 1);
    wall([[FB.x0 + 0.002, y0, FB.face], [bx0, y0, FB.back + 0.001], [bx0, y1, FB.back + 0.001], [FB.x0 + 0.002, y1, FB.face]], 0.8);
    wall([[bx1, y0, FB.back + 0.001], [FB.x1 - 0.002, y0, FB.face], [FB.x1 - 0.002, y1, FB.face], [bx1, y1, FB.back + 0.001]], 0.8);
    // its roof, black with soot, and the floor of ash
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(1.0, FB.face - FB.back), G.std({ color: '#0d0a09', roughness: 1, env: 0 }));
    roof.rotation.x = Math.PI / 2; roof.position.set(fx, FB.top - 0.001, (FB.back + FB.face) / 2); G.add(roof, null, false, false);
    const ash = new THREE.Mesh(new THREE.PlaneGeometry(1.0, FB.face - FB.back + 0.02), G.std({ map: G.rep(TX.ash, 2.5, 1), roughness: 1, env: 0.1 }));
    ash.rotation.x = -Math.PI / 2; ash.position.set(fx, 0.061, (FB.back + FB.face) / 2 + 0.01); G.add(ash, null, false, true);
    // (the soot up the stone above the opening is in the stone itself, above)
    // a pair of iron firedogs for the logs to lie across
    const iron = G.std({ color: '#1b1918', roughness: 0.55, metalness: 0.6, env: 0.4 });
    for (const s of [-1, 1]) {
      const ax = fx + s * 0.24;
      cyl(0.014, 0.02, 0.2, iron, ax, 0.16, FB.face - 0.03, { seg: 10 });
      sph(0.026, iron, ax, 0.27, FB.face - 0.03, [1, 1, 1], G.world, 12);
      box(0.026, 0.026, 0.28, iron, ax, 0.085, FB.face - 0.16);
      box(0.12, 0.02, 0.026, iron, ax, 0.07, FB.face - 0.03);
    }
  }
  // The logs on the firedogs: split firewood (G.wood), a half, a quarter and a small round, charred black underneath
  // where the fire's been at them, glowing from underneath while it burns (their own materials, emissive with the
  // fire). (They were bark cylinders, which with the fire out read as dark nothing with one pale disc.)
  const logMs = G.WOOD_M.map((m) => { const c = m.clone(); c.vertexColors = true; c.emissive = new THREE.Color('#ff4a10'); c.emissiveIntensity = 0; return c; });
  const charred = (m) => {   // black where the fire reaches: low down, in the middle, and underneath
    m.updateMatrixWorld(true);
    const g = (m.geometry = m.geometry.clone()), P = g.attributes.position, Nn = g.attributes.normal, C = g.attributes.color, v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); n.fromBufferAttribute(Nn, i).applyMatrix3(nm).normalize();
      const c = G.clamp(G.smooth(0.25, 0.11, v.y) + 0.45 * Math.max(0, -n.y), 0, 1) * (1 - 0.65 * G.smooth(0.16, 0.32, Math.abs(v.x - fx)));
      C.setXYZ(i, 1 - 0.9 * c, 1 - 0.91 * c, 1 - 0.92 * c);
    }
  };
  const log = (kind, R, l, x, y, z, rz, ry, seed, roll) => { const m = G.wood(kind, R, l, seed, roll, logMs); m.position.set(x, y, z); m.rotation.z = rz; m.rotation.y = ry; G.add(m, null, true, true); charred(m); return m; };
  log('half', 0.075, 0.6, fx - 0.05, 0.19, 0.5, Math.PI / 2, 0.3, 3, Math.PI / 2 + 0.35);
  log('quarter', 0.1, 0.55, fx + 0.05, 0.31, 0.49, Math.PI / 2, -0.4, 5, Math.PI / 2 - 0.2);
  log('round', 0.052, 0.5, fx + 0.02, 0.2, 0.57, Math.PI / 2 - 0.35, 1.25, 7, 0);
  // A bed of coals under them: a low mound with a slowly crawling glow.
  const coalM = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPower: { value: 1 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uTime; uniform float uPower; varying vec3 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){ vec2 q = vP.xz * 9.0; float g = n(q + uTime * 0.2) * 0.65 + n(q * 2.7 - uTime * 0.35) * 0.35; float crack = smoothstep(0.35, 0.85, g) * (0.55 + 0.45 * smoothstep(0.3, 0.0, length(vP.xz) - 0.05));
        vec3 ash = vec3(0.06, 0.05, 0.045); vec3 hot = mix(vec3(0.9, 0.18, 0.02), vec3(1.0, 0.6, 0.15), crack);
        gl_FragColor = vec4(mix(ash, hot * (0.8 + crack * 1.4), crack * uPower), 1.0); }`,
  });
  const coals = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2), coalM);
  coals.scale.set(1.1, 0.14, 0.4); coals.position.set(fx, 0.065, 0.5); W.add(coals);
  const fireG = new THREE.Group(); fireG.position.set(fx, 0.19, 0.5); W.add(fireG);
  const firePlanes = [];
  // Tongues of flame at different depths and sizes (each its own flicker), a small bright core in the middle.
  const TONGUES = [[-0.16, 0.05, 0.34, 0.52], [0.0, -0.05, 0.42, 0.72], [0.15, 0.04, 0.32, 0.5], [-0.07, 0.1, 0.26, 0.42], [0.09, -0.1, 0.28, 0.46], [-0.24, -0.04, 0.2, 0.3], [0.24, 0.0, 0.2, 0.32]];
  TONGUES.forEach(([x, z, w, hh], i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), flameMaterial(i % 3 === 1 ? '#ff6a1a' : '#ff8a32'));
    m.position.set(x, hh * 0.46, z); m.renderOrder = 7; fireG.add(m); firePlanes.push(m); FLAMES.push(m);
  });
  const core = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.26), flameMaterial('#ffd27a'));
  core.position.set(0, 0.11, 0.02); core.renderOrder = 8; fireG.add(core); firePlanes.push(core); FLAMES.push(core);
  const fireLight = new THREE.PointLight('#ff8a3a', 0, 10, 2); fireLight.position.set(fx, 0.5, 1.35); W.add(fireLight);
  G.FIRE = { planes: firePlanes, light: fireLight, on: true, power: 9, level: 1, coals: coalM, logM: logMs[0], logMs, lightAt: fireLight.position.clone() };
  G.INTER.push({ id: 'fire', pos: [fx, 0.6, 1.25], r: 1.3, label: () => (G.FIRE.on ? 'Fireplace' : 'Light the fire'), act: () => { G.FIRE.on = !G.FIRE.on; if (G.FIRE.on) G.say('partner', 'The fire person, at work. My hero, {toHim}.'); } });
  // Mantle: candles, frames, a snow globe, a sprig of pine.
  // Mantle things sit on the shelf in front of the stone (its face is at z = 0.66), not inside it.
  candle(fx - 0.85, 1.48, 0.74, 0.16, 0.03); candle(fx - 0.72, 1.48, 0.77, 0.11, 0.03); candle(fx + 0.82, 1.48, 0.76, 0.13, 0.03);
  G.MANTLE_LIGHT = new THREE.PointLight('#ffa850', 1.4, 3, 2); G.MANTLE_LIGHT.position.set(fx, 1.75, 0.8); W.add(G.MANTLE_LIGHT);
  polaroid(fx - 0.3, 1.6, 0.7, 0, 'lake', -0.12); polaroid(fx + 0.05, 1.58, 0.7, 0, 'hill', 0.08);   // leaning on the stones
  // The old snow globe: a tiny cabin and one pine on a snowy base, under glass.
  { const gx = fx + 0.5, gy = 1.56, gz = 0.75;
    cyl(0.06, 0.062, 0.012, MAT.snow, gx, gy - 0.031, gz, { seg: 24 });
    box(0.034, 0.022, 0.026, G.shared({ color: '#7a5038', roughness: 0.8 }), gx - 0.012, gy - 0.014, gz + 0.004);
    const rf = box(0.04, 0.008, 0.03, MAT.snow, gx - 0.012, gy + 0.001, gz + 0.004); rf.rotation.z = 0.12;
    box(0.006, 0.006, 0.002, new THREE.MeshBasicMaterial({ color: '#ffd27a' }), gx - 0.006, gy - 0.014, gz + 0.018, { cast: false });
    const pine = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.045, 8), G.shared({ color: '#2f4a38', roughness: 0.8 })); pine.position.set(gx + 0.024, gy - 0.002, gz - 0.006); G.world.add(pine);
    const glass = sph(0.07, G.std({ color: '#e8f2fc', roughness: 0.02, transparent: true, opacity: 0.12, env: 0.7 }), gx, gy, gz, [1, 1, 1], G.world, 40); glass.renderOrder = 6; }
  cyl(0.07, 0.08, 0.05, MAT.darkWood, fx + 0.5, 1.5, 0.75);
  // Tall bookshelf left of the fireplace.
  bookshelf(6.15, 0.3, 1.5, 0.34, 2.4, 0);
  // Sofa facing the fire.
  // Upholstered like the armchair: short legs, a stuffed base, rolled arms, a leaning back, two plump seat cushions
  // and two at the back, the pillows, and the plaid throw over an arm. (It was rounded boxes, with the throw a tilted
  // slab.) Its back is +z; it faces the fire.
  const sx = 8.0, sz = 3.0;
  const sofa = new THREE.Group(); sofa.position.set(sx, 0, sz); W.add(sofa);
  const sm = MAT.sofa.clone(); G.MATS.push(sm);
  G.COLL.push({ x0: sx - 1.1, z0: sz - 0.46, x1: sx + 1.1, z1: sz + 0.46 });
  for (const [lx, lz] of [[-1.0, -0.38], [1.0, -0.38], [-1.0, 0.38], [1.0, 0.38]]) cyl(0.028, 0.02, 0.11, MAT.darkWood, lx, 0.055, lz, { parent: sofa, seg: 10 });
  G.puff(2.2, 0.3, 0.9, sm, 0, 0.255, 0, { parent: sofa, n: 8, top: 0.03, side: 0.03, seed: 11 });
  for (const s of [-1, 1]) {
    G.puff(0.2, 0.42, 0.9, sm, s * 1.0, 0.44, 0, { parent: sofa, n: 6, top: 0.05, side: 0.06, seed: 12 + s });
    G.puff(0.24, 0.14, 0.94, sm, s * 1.02, 0.65, -0.01, { parent: sofa, n: 3, top: 0.08, side: 0.08, seed: 14 + s });
  }
  G.puff(1.84, 0.55, 0.2, sm, 0, 0.7, 0.36, { parent: sofa, n: 6, top: 0.08, side: 0.04, front: 0.05, rx: -0.12, seed: 16 });
  for (const s of [-1, 1]) {
    G.puff(0.9, 0.15, 0.68, sm, s * 0.45, 0.485, -0.07, { parent: sofa, n: 5, top: 0.28, side: 0.08, front: 0.1, seed: 17 + s });
    G.puff(0.88, 0.42, 0.15, sm, s * 0.45, 0.75, 0.22, { parent: sofa, n: 4, top: 0.1, side: 0.1, front: 0.3, rx: -0.2, seed: 19 + s });
  }
  const pil1 = G.pillow(0.44, 0.42, 0.16, MAT.knitCream, sx - 0.68, 0.76, sz + 0.06, { seed: 2 }); pil1.rotation.set(-0.3, 0.3, 0.12);
  const pil2 = G.pillow(0.42, 0.4, 0.16, MAT.plaid, sx + 0.7, 0.75, sz + 0.06, { seed: 3 }); pil2.rotation.set(-0.3, -0.25, -0.1);
  // the plaid throw over the right arm, the way the old slab was meant to lie
  drapeOver(sofa, MAT.plaid, [[0.8, 0.6], [0.87, 0.63], [0.93, 0.7], [1.02, 0.755], [1.105, 0.725], [1.15, 0.62], [1.165, 0.42], [1.16, 0.18]], -0.42, 0.3);
  G.contactShade(sofa, sm);
  G.SOFA = { x: sx, z: sz, seatY: 0.6 };
  G.INTER.push({ id: 'sofa', pos: [sx, 0.5, sz - 0.6], r: 1.1, label: () => (G.STATE.cuddled ? 'Sofa' : 'Curl up together'), act: () => G.Story.cuddle() });
  // Blanket used in the cuddle scene (hidden until then).
  const blanket = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.2, 24, 20), MAT.plaid);
  const bp = blanket.geometry.attributes.position;
  for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), y = bp.getY(i); bp.setZ(i, Math.sin(x * 9) * 0.02 + Math.cos(y * 7 + x * 3) * 0.025 + Math.max(0, 0.36 - Math.abs(y + 0.15) * 0.9) * 0.0); }
  blanket.geometry.computeVertexNormals();
  blanket.material = MAT.plaid.clone(); blanket.material.side = THREE.DoubleSide; G.MATS.push(blanket.material);
  blanket.castShadow = true; blanket.receiveShadow = true; blanket.visible = false; W.add(blanket);
  G.CUDDLE_BLANKET = blanket;
  // Coffee table with the cake, mugs, cookies and a candle.
  const tx = 8.0, tz = 1.85;
  box(1.15, 0.06, 0.62, MAT.darkWood, tx, 0.43, tz, { r: 0.02 });
  for (const [a, b] of [[-0.5, -0.24], [0.5, -0.24], [-0.5, 0.24], [0.5, 0.24]]) box(0.06, 0.4, 0.06, MAT.darkWood, tx + a, 0.2, tz + b);
  G.COLL.push({ x0: tx - 0.6, z0: tz - 0.34, x1: tx + 0.6, z1: tz + 0.34 });
  G.CAKE = buildCake(tx - 0.12, 0.46, tz);
  for (const [dx, dz, c] of [[0.36, 0.14, '#efe7da'], [0.42, -0.12, '#8a3a2e']]) {
    cyl(0.045, 0.04, 0.1, G.std({ color: c, roughness: 0.3, env: 0.8 }), tx + dx, 0.51, tz + dz, { seg: 18 });
    cyl(0.04, 0.04, 0.005, G.shared({ color: '#4a2a1a', roughness: 0.2 }), tx + dx, 0.555, tz + dz, { seg: 16 });
  }
  candle(tx - 0.45, 0.46, tz - 0.16, 0.09, 0.03);
  G.INTER.push({ id: 'cake', pos: [tx, 0.6, tz], r: 1.1, label: () => (G.CAKE.lit ? 'Make a wish' : 'Cake'), act: () => G.Story.cake() });
  // Armchair.
  // An upholstered reading chair: short turned legs, a stuffed base, rolled arms, a back that leans a little, a plump
  // seat cushion and one at the back, and a knitted throw over the arm. (It was four rounded boxes with a flat cream
  // slab on the seat.) Its back is +z; it faces -z, to the fire.
  const chair = new THREE.Group(); chair.position.set(6.25, 0, 1.95); chair.rotation.y = -0.91; W.add(chair);   // turned to face the fire
  const cm = G.std({ map: G.rep(TX.wool, 1, 1), bumpMap: TX.woolB, bumpScale: 0.003, color: '#6e2c16', roughness: 1, env: 0.25 });   // rust wool (it was so dark it read as a hole in the room, then a dusty rose)
  for (const [lx, lz] of [[-0.36, -0.32], [0.36, -0.32], [-0.36, 0.32], [0.36, 0.32]]) cyl(0.026, 0.018, 0.11, MAT.darkWood, lx, 0.055, lz, { parent: chair, seg: 10 });
  G.puff(0.86, 0.3, 0.8, cm, 0, 0.255, 0, { parent: chair, n: 8, top: 0.04, side: 0.03, seed: 1 });                       // the base
  for (const s of [-1, 1]) {
    G.puff(0.16, 0.42, 0.8, cm, s * 0.35, 0.44, 0.0, { parent: chair, n: 6, top: 0.05, side: 0.06, seed: 2 + s });         // the arm
    G.puff(0.2, 0.13, 0.84, cm, s * 0.365, 0.64, -0.01, { parent: chair, n: 3, top: 0.08, side: 0.08, seed: 4 + s });     // its roll
  }
  G.puff(0.78, 0.6, 0.18, cm, 0, 0.74, 0.32, { parent: chair, n: 6, top: 0.1, side: 0.05, front: 0.06, rx: -0.14, seed: 6 });   // the back, leaning
  G.puff(0.56, 0.14, 0.62, cm, 0, 0.465, -0.05, { parent: chair, n: 5, top: 0.32, side: 0.1, front: 0.12, seed: 7 });           // the seat cushion
  G.puff(0.54, 0.42, 0.13, cm, 0, 0.73, 0.2, { parent: chair, n: 4, top: 0.1, side: 0.12, front: 0.35, rx: -0.2, seed: 8 });    // the back cushion
  // the throw, over the right arm: lying on the edge of the seat, up over the roll, and hanging down outside
  drapeOver(chair, MAT.knitCream, [[0.17, 0.53], [0.25, 0.56], [0.31, 0.69], [0.37, 0.745], [0.445, 0.715], [0.49, 0.61], [0.505, 0.42], [0.5, 0.2]], -0.3, 0.26);
  G.contactShade(chair, cm);
  G.propify('armchair', chair);
  G.COLL.push({ x0: 5.75, z0: 1.45, x1: 6.75, z1: 2.45 });
  // East wall bookshelf, floor lamp, plant, rug.
  bookshelf(10.72, 3.95, 0.34, 1.05, 2.1, Math.PI / 2);
  floorLamp(10.35, 0.55);
  floorLamp(6.15, 3.55);
  plant(10.4, 4.2, 1.2);   // Basil (not basil)
  const rug2 = G.add(new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.0), MAT.rug), W, false, true); rug2.rotation.x = -Math.PI / 2; rug2.position.set(8, 0.006, 2.2);
  // A wall clock on the partition, hands set to the time of day (fx.js turns them).
  const clock = G.propSlot('clock', 5.13, 1.95, 1.5, Math.PI / 2, (g) => {
    cyl(0.17, 0.17, 0.04, MAT.darkWood, 0, 0, 0, { parent: g, seg: 32 }).rotation.x = Math.PI / 2;
    cyl(0.15, 0.15, 0.01, MAT.ceramic, 0, 0, 0.022, { parent: g, seg: 32 }).rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; box(i % 3 ? 0.008 : 0.014, 0.025, 0.004, MAT.darkMetal, Math.sin(a) * 0.125, Math.cos(a) * 0.125, 0.029, { parent: g, cast: false }).rotation.z = -a; }
    const hand = (len, w) => { const p = new THREE.Group(); p.position.z = 0.032; p.userData.dynamic = true; g.add(p); box(w, len, 0.004, MAT.darkMetal, 0, len / 2 - 0.015, 0, { parent: p, cast: false }); return p; };
    G.CLOCK = { h: hand(0.08, 0.012), m: hand(0.115, 0.008) };
  });
  G.INTER.push({ id: 'clock', pos: [5.4, 1.6, 1.5], r: 0.9, label: 'Clock', act: () => G.say(null, '(The clock is four minutes fast. It has been four minutes fast for as long as anyone can remember. Nobody fixes it.)') });
  // Coats by the door, hung by their loops from a Shaker peg rail: his charcoal wool, her camel one with a fur-trimmed
  // hood, each with its sleeves hanging, buttons or toggles down the front and pocket flaps; a striped scarf over the
  // end peg. (They were two flat panels on a shelf.)
  {
    const { V: wV, H: wH } = G.FURN('#7a5640'), RZ = 4.454;
    box(0.9, 0.1, 0.022, wH, 5.66, 1.75, RZ, { r: 0.006, uv: [1.5, 0.2] });
    for (const x of [5.38, 5.66, 5.94]) { const st = cyl(0.011, 0.015, 0.07, wV, x, 1.755, RZ - 0.045, { seg: 10 }); st.rotation.x = Math.PI / 2 - 0.15; sph(0.019, wV, x, 1.762, RZ - 0.082, [1, 1, 0.8], W, 12); }
    const coat = (x, color, hers) => {
      const g = new THREE.Group(); g.position.set(x, 0.87, 4.37); g.rotation.y = Math.PI; g.scale.set(1, 1.2, 1); W.add(g);   // its front to the room
      const m = G.std({ map: TX.jersey, bumpMap: TX.jerseyB, bumpScale: 0.003, color, roughness: 1, env: 0.15 }), dark = G.std({ map: TX.jersey, color: new THREE.Color(color).multiplyScalar(0.7), roughness: 1, env: 0.1 });
      // the body, hanging in folds that deepen toward the hem, flat at the back against the wall
      const prof = [[0, 0.03], [0.135, 0.0], [0.142, 0.05], [0.132, 0.28], [0.125, 0.48], [0.12, 0.59], [0.104, 0.655], [0.07, 0.705], [0.048, 0.728], [0, 0.74]].map(([a, b]) => new THREE.Vector2(a, b));
      const lg = new THREE.LatheGeometry(prof, 28), LP = lg.attributes.position;
      for (let i = 0; i < LP.count; i++) {
        const x0 = LP.getX(i), y = LP.getY(i), z0 = LP.getZ(i), th = Math.atan2(x0, z0), f = 1 + 0.06 * Math.sin(th * 7 + (hers ? 1 : 0)) * Math.pow(Math.max(0, 1 - y / 0.62), 1.4);
        LP.setXYZ(i, x0 * f, y, z0 * f * (z0 > 0 ? 0.46 : 0.3));
      }
      lg.computeVertexNormals();
      const body = new THREE.Mesh(lg, m); body.castShadow = body.receiveShadow = true; g.add(body);
      const front = (y) => { let r = 0; for (let k = 0; k < prof.length - 1; k++) if (y >= prof[k].y && y <= prof[k + 1].y) r = prof[k].x + ((prof[k + 1].x - prof[k].x) * (y - prof[k].y)) / (prof[k + 1].y - prof[k].y || 1); return r * 0.46; };
      // sleeves, hanging at its sides, with their cuffs
      for (const s of [-1, 1]) {
        const sl = cyl(0.04, 0.05, 0.54, m, s * 0.15, 0.37, 0.03, { parent: g, seg: 12 }); sl.rotation.z = s * 0.06; sl.scale.z = 0.8;
        cyl(0.052, 0.052, 0.05, dark, s * 0.134, 0.11, 0.03, { parent: g, seg: 12 }).scale.z = 0.8;
      }
      // the hood, bunched at the back of the collar over the peg
      sph(0.105, m, 0, 0.72, -0.02, [1, 0.72, 0.62], g, 16);
      if (hers) {   // its fur trim
        const fur = G.std({ map: TX.knitCream, bumpMap: TX.knitB, bumpScale: 0.006, color: '#e9dfcf', roughness: 1, env: 0.1 });
        const tr = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.032, 8, 18), fur); tr.position.set(0, 0.745, 0.012); tr.rotation.x = -1.25; tr.scale.set(1, 1, 0.7); g.add(tr);
        for (const y of [0.56, 0.44, 0.32]) { const t = cyl(0.008, 0.008, 0.06, G.shared({ color: '#c8a878', roughness: 0.6 }), 0, y, front(y) + 0.008, { parent: g, seg: 8 }); t.rotation.z = Math.PI / 2; }   // toggles
      } else {
        box(0.032, 0.6, 0.006, dark, 0, 0.33, front(0.33) + 0.002, { parent: g, cast: false });   // the placket
        for (const y of [0.58, 0.46, 0.34, 0.22]) cyl(0.012, 0.012, 0.006, G.shared({ color: '#1e1c1a', roughness: 0.4, env: 0.4 }), 0, y, front(y) + 0.008, { parent: g, seg: 10 }).rotation.x = Math.PI / 2;
      }
      for (const s of [-1, 1]) { const fl = box(0.075, 0.028, 0.008, dark, s * 0.065, 0.2, front(0.2) * 0.88 + 0.003, { parent: g, r: 0.004 }); fl.rotation.y = s * 0.3; }   // pocket flaps
      g.userData.dynamic = true;
      return g;
    };
    // Kept separate (not batched): each one comes off its hook when it's being worn (life.js).
    G.HOOK_COATS = [coat(5.38, '#5c5f63', false), coat(5.66, '#a8875e', true)];
    // a spare scarf over the end peg, striped, its fringed ends hanging
    const stripes = G.canvasTex(0, null, { w: 32, h: 128, draw: (c, w, h) => { const cols = ['#e8e0d0', '#5d7a5a', '#e8e0d0', '#b8463a']; for (let i = 0; i < 16; i++) { c.fillStyle = cols[i % 4]; c.fillRect(0, (i * h) / 16, w, h / 16); } } });
    const scarfM = G.std({ map: stripes, bumpMap: TX.knitB, bumpScale: 0.003, roughness: 1, env: 0.1 });
    const over = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.012, 6, 12, Math.PI), scarfM); over.rotation.y = Math.PI / 2; over.scale.set(1, 1, 4.5); over.position.set(5.94, 1.76, 4.38); W.add(over);
    for (const [dz, len, ry] of [[-0.03, 0.62, 0.05], [0.03, 0.5, -0.08]]) {
      const t = box(0.13, len, 0.012, scarfM, 5.94 + dz * 0.6, 1.76 - len / 2, 4.38 + dz, { r: 0.004 }); t.rotation.set(0, ry, dz * 1.5);
      for (let k = 0; k < 6; k++) box(0.006, 0.05, 0.006, scarfM, 5.94 + dz * 0.6 - 0.055 + k * 0.022, 1.76 - len - 0.025, 4.38 + dz, { cast: false });   // its fringe
    }
  }
  buildKitchen();
};

/* ===== Bed cover: a draped blanket shaped over whoever is lying in the bed ===== */
function bedCover(bx) {
  const g = new THREE.PlaneGeometry(2.1, 1.76, 44, 36); g.rotateX(-Math.PI / 2);
  const mat = MAT.quilt.clone(); mat.side = THREE.DoubleSide; mat.map = G.rep(TX.quilt, 2.0, 1.7); mat.bumpMap = G.rep(TX.quiltB, 2.0, 1.7); G.MATS.push(mat);
  const m = new THREE.Mesh(g, mat); m.position.set(bx, 0, 1.42); m.castShadow = m.receiveShadow = true;
  m.visible = false; m.userData.dynamic = true; G.world.add(m);
  m.userData.base = Float32Array.from(g.attributes.position.array);
  return m;
}
/* who: { L: true, R: true } for the bodies under it; shift moves the whole blanket toward one side (−1 left, +1 right). */
G.shapeBed = (who, shift = 0) => {
  const B = G.BED, m = B.cover, p = m.geometry.attributes.position, base = m.userData.base;
  const bumps = [];
  // Lying close together (G.cuddleInBed): one broad mound over the two of them, where they actually are.
  const P = G.PLAYER, Q = G.PARTNER, close = P && Q && P.lie && Q.lie && P.cuddle && who.L && who.R;
  if (close) { const lo = Math.min(P.x, Q.x), hi = Math.max(P.x, Q.x); bumps.push(lo - 0.24 - B.x, lo - 0.12 - B.x, lo - B.x, (lo + hi) / 2 - B.x, hi - B.x); }
  else { if (who.L) bumps.push(B.L - B.x); if (who.R) bumps.push(B.R - B.x); }
  for (let i = 0; i < p.count; i++) {
    const x0 = base[i * 3] + shift * 0.32, z = base[i * 3 + 2], wz = z + 1.42;   // world z
    let y = 0.6;
    // Over each body: highest at the chest (z ≈ 1), lower over the legs, as the bodies lie head-up.
    if (close) { let m = 0; for (const b of bumps) { const dx = x0 - b; m = Math.max(m, Math.exp(-dx * dx / 0.075)); } const along = G.smooth(0.6, 0.9, wz) * (1 - G.smooth(1.3, 2.3, wz) * 0.5); y += m * (0.17 + 0.25 * along); }
    else for (const b of bumps) { const dx = x0 - b; const along = G.smooth(0.62, 0.95, wz) * (1 - G.smooth(1.3, 2.3, wz) * 0.55); y += Math.exp(-dx * dx / 0.055) * (0.12 + 0.2 * along); }
    y += Math.sin(x0 * 9 + z * 5) * 0.008 + Math.cos(z * 11 - x0 * 3) * 0.006;
    // Off the mattress the blanket hangs down the sides and the foot.
    const ex = Math.abs(x0) - 0.9, ez = wz - (close ? 2.5 : 2.26);   // together: tucked in over their feet
    if (ex > 0) y -= Math.min(0.38, ex * 2.6);
    if (ez > 0) y -= Math.min(0.38, ez * 2.6);
    if (wz < (close ? 0.76 : 0.74)) y -= ((close ? 0.76 : 0.74) - wz) * (close ? 1.6 : 0.8);   // turned down at the top (pulled up to the shoulders, together)
    p.setXYZ(i, x0, y, z);
  }
  p.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere();
};
G.bedMade = (made) => { G.BED.made.forEach((o) => { o.visible = made; }); G.BED.cover.visible = !made; };

/* ===== Kitchen ===== */
function tileTex() {
  return G.canvasTex(0, null, { w: 256, h: 128, draw: (c, w, h) => {
    c.fillStyle = '#cfc8bc'; c.fillRect(0, 0, w, h);
    const tw = w / 4, th = h / 4;
    for (let j = 0; j < 4; j++) for (let i = -1; i < 5; i++) {
      const x = i * tw + (j % 2 ? tw / 2 : 0), y = j * th;
      const l = 236 + ((i * 7 + j * 3) % 5) * 3;
      c.fillStyle = `rgb(${l},${l - 4},${l - 12})`; c.fillRect(x + 2, y + 2, tw - 4, th - 4);
    }
  } });
}
function noteTex(lines, o = {}) {
  return G.canvasTex(0, null, { w: 256, h: 256, draw: (c, w, h) => {
    c.fillStyle = o.bg || '#fff6c8'; c.fillRect(0, 0, w, h);
    c.fillStyle = o.ink || '#3a3550'; c.textAlign = 'center';
    lines.forEach((l, i) => { c.font = `${l.size || 34}px "Comic Sans MS", "Marker Felt", cursive`; c.fillStyle = l.color || o.ink || '#3a3550'; c.fillText(l.t, w / 2, 70 + i * (l.gap || 52)); });
  } });
}
G.noteTex = noteTex;
function buildKitchen() {
  const W = G.world, K = (G.KITCHEN = {});
  const block = G.std({ map: TX.floor, color: '#d8b48a', roughness: 0.5, env: 0.4 });
  const enamel = (c) => G.shared({ color: c, roughness: 0.25, env: 0.9 });
  // Base cabinets along the north wall, with a butcher-block top and a tiled splash: painted sage, with shaker doors
  // (a frame round a flat panel) and drawers, brass knobs and cup pulls; a cream enamel range in the middle with its
  // oven window and chrome rail; and a deep white farmhouse sink with a brass bridge tap. (They were a run of brown
  // boards with lines drawn on for doors, a grey rectangle for an oven and a steel plate on the top for a sink.)
  const cx0 = 11.18, cx1 = 13.72, ccx = (cx0 + cx1) / 2, cw = cx1 - cx0;
  const RX0 = 12.05, RX1 = 12.65, SX0 = 12.75, SX1 = 13.35, FZ = 0.69;   // the range, the sink, the cabinets' face
  const brush = G.canvasTex(128, (u, v) => { const t = 0.93 + G.fbm(u * 2, v * 40, 2) * 0.06 + G.fbm(u * 24, v * 24, 2) * 0.03; return [236 * t, 236 * t, 236 * t]; });
  const sage = G.std({ map: brush, color: '#8c9c86', roughness: 0.55, env: 0.3 }), sageIn = G.std({ map: brush, color: '#7c8c76', roughness: 0.6, env: 0.25 }), cream = enamel('#eee5d3'), chrome = G.shared({ color: '#e2e4e6', metalness: 1, roughness: 0.15, env: 1 });
  const ceramic = G.shared({ color: '#f4f2ec', roughness: 0.12, env: 0.9 }), blackK = G.shared({ color: '#1a1716', roughness: 0.35, env: 0.6 });
  // the carcasses: either side of the range, and lower under the sink
  for (const [a, b, top] of [[cx0, RX0, 0.84], [RX1, SX0, 0.84], [SX0, SX1, 0.655], [SX1, cx1, 0.84]]) box(b - a, top - 0.1, 0.58, sage, (a + b) / 2, (top + 0.1) / 2, 0.4, { coll: true });
  box(cw + 0.04, 0.1, 0.5, G.shared({ color: '#2e2620', roughness: 0.9 }), ccx, 0.05, 0.37, { cast: false });   // toe kick
  const knob = (x, y, P = W, z0 = FZ) => { cyl(0.006, 0.009, 0.018, MAT.metal, x, y, z0 + 0.035, { seg: 8, parent: P }).rotation.x = Math.PI / 2; sph(0.014, MAT.metal, x, y, z0 + 0.047, [1, 1, 0.8], P, 12); };
  const cup = (x, y, P = W, z0 = FZ) => {   // a brass cup pull, hood down
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 14, 1, true, 0, Math.PI), MAT.metal);
    c.rotation.z = Math.PI / 2; c.position.set(x, y, z0 + 0.03); c.scale.set(1, 1, 0.9); P.add(c);
    box(0.09, 0.012, 0.02, MAT.metal, x, y + 0.012, z0 + 0.03, { cast: false, parent: P });
  };
  // a shaker front: a slab, a frame round it standing proud (P, z0: what it's on and where that face is, if not the run)
  const front = (x0, x1, y0, y1, pull, P = W, z0 = FZ) => {
    const w = x1 - x0 - 0.004, h = y1 - y0 - 0.004, x = (x0 + x1) / 2, y = (y0 + y1) / 2, f = Math.min(0.06, h * 0.22);
    box(w, h, 0.018, sageIn, x, y, z0 + 0.009, { r: 0.003, parent: P });
    for (const k of [-1, 1]) { box(f, h, 0.008, sage, x + (k * (w - f)) / 2, y, z0 + 0.022, { cast: false, parent: P }); box(w - 2 * f, f, 0.008, sage, x, y + (k * (h - f)) / 2, z0 + 0.022, { cast: false, parent: P }); }
    if (pull === 'cup') cup(x, y + h * 0.12, P, z0); else if (pull !== undefined && pull !== null) knob(pull, y1 - 0.07, P, z0);
  };
  K.front = front;
  // left of the range: a drawer over two doors
  front(cx0, RX0, 0.66, 0.84, 'cup'); front(cx0, (cx0 + RX0) / 2, 0.1, 0.66, (cx0 + RX0) / 2 - 0.05); front((cx0 + RX0) / 2, RX0, 0.1, 0.66, (cx0 + RX0) / 2 + 0.05);
  // between the range and the sink, a narrow pull-out; under the sink, two doors; right of it, a drawer over a door
  front(RX1, SX0, 0.1, 0.84, RX1 + 0.05);
  front(SX0, (SX0 + SX1) / 2, 0.1, 0.655, (SX0 + SX1) / 2 - 0.05); front((SX0 + SX1) / 2, SX1, 0.1, 0.655, (SX0 + SX1) / 2 + 0.05);
  front(SX1, cx1, 0.66, 0.84, 'cup'); front(SX1, cx1, 0.1, 0.66, SX1 + 0.05);
  // the worktops, butcher block, either side of the range and round the back of the sink
  for (const [a, b] of [[cx0 - 0.03, RX0], [RX1, SX0], [SX1, cx1 + 0.03]]) box(b - a, 0.05, 0.64, block, (a + b) / 2, 0.865, 0.41, { r: 0.008 });
  box(SX1 - SX0, 0.05, 0.08, block, (SX0 + SX1) / 2, 0.865, 0.13, { r: 0.006 });
  const splash = new THREE.Mesh(new THREE.PlaneGeometry(cw, 0.56), G.std({ map: G.rep(tileTex(), cw / 0.6, 1), roughness: 0.3, env: 0.7 }));
  splash.position.set(ccx, 1.17, 0.113); W.add(splash); splash.receiveShadow = true;
  // Open shelf with jars, mugs and a sprig of something green.
  box(cw - 0.1, 0.04, 0.24, MAT.darkWood, ccx, 1.78, 0.24);
  const r = G.seeded(61);
  for (let x = cx0 + 0.15; x < cx1 - 0.1; x += 0.16 + r() * 0.08) {
    if (r() < 0.55) { const h = 0.12 + r() * 0.1; cyl(0.045, 0.045, h, G.shared({ color: '#dfe6e0', roughness: 0.05, transparent: true, opacity: 0.5, env: 1.2 }), x, 1.8 + h / 2, 0.24); cyl(0.047, 0.047, 0.02, MAT.darkWood, x, 1.8 + h + 0.01, 0.24); }
    else { cyl(0.04, 0.035, 0.09, enamel(['#c96a4a', '#efe7da', '#5d7a8c'][Math.floor(r() * 3)]), x, 1.845, 0.24, { seg: 14 }); }
  }
  // Kettle (enamel red), hob with a pan, sink and tap, toaster.
  K.kettle = { x: 11.55, z: 0.36 };
  const kg = new THREE.Group(); kg.position.set(11.55, 0.89, 0.36); W.add(kg);
  cyl(0.075, 0.095, 0.17, enamel('#b9473a'), 0, 0.085, 0, { parent: kg, seg: 20 });
  cyl(0.03, 0.06, 0.03, enamel('#b9473a'), 0, 0.185, 0, { parent: kg, seg: 16 });
  sph(0.018, MAT.darkMetal, 0, 0.21, 0, [1, 1, 1], kg, 10);
  const spout = cyl(0.012, 0.02, 0.12, enamel('#b9473a'), 0.1, 0.11, 0, { parent: kg, seg: 8 }); spout.rotation.z = -0.9;
  const hdl = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 16, Math.PI), MAT.darkMetal); hdl.position.set(0, 0.2, 0); kg.add(hdl);
  K.kettleG = G.propify('kettle', kg);
  K.stove = { x: 12.35, z: 0.38 };
  // The range: cream enamel, its top with four burners under cast-iron grates, a back guard with a little clock,
  // knobs along the front, the oven door with its window and chrome rail, and a drawer under.
  box(RX1 - RX0 - 0.008, 0.87, 0.6, cream, 12.35, 0.455, 0.405, { r: 0.012, coll: true });
  box(RX1 - RX0, 0.012, 0.6, cream, 12.35, 0.894, 0.4, { r: 0.004, cast: false });
  const iron = G.shared({ color: '#2a2624', roughness: 0.55, metalness: 0.5, env: 0.5 });
  for (const [dx, dz, rr] of [[-0.15, -0.1, 0.08], [0.15, -0.1, 0.06], [-0.15, 0.12, 0.06], [0.15, 0.12, 0.09]]) {
    const bx = 12.35 + dx, bz = 0.39 + dz;
    cyl(rr, rr, 0.008, G.shared({ color: '#3a3330', roughness: 0.6, metalness: 0.5 }), bx, 0.902, bz, { seg: 20, cast: false });
    for (const ry of [0, Math.PI / 2]) box(2 * rr + 0.05, 0.008, 0.01, iron, bx, 0.908, bz, { cast: false }).rotation.y = ry + Math.PI / 4;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr + 0.025, 0.005, 4, 20), iron); ring.rotation.x = Math.PI / 2; ring.position.set(bx, 0.908, bz); W.add(ring);
  }
  box(RX1 - RX0, 0.13, 0.035, cream, 12.35, 0.96, 0.13, { r: 0.01 });   // the back guard
  cyl(0.04, 0.04, 0.012, chrome, 12.35, 0.965, 0.152, { seg: 20 }).rotation.x = Math.PI / 2;
  cyl(0.034, 0.034, 0.004, G.std({ map: G.canvasTex(0, null, { w: 64, h: 64, draw: (c, w, h) => { c.fillStyle = '#f6f1e4'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2a2420'; c.lineWidth = 2;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.beginPath(); c.moveTo(w / 2 + Math.cos(a) * 24, h / 2 + Math.sin(a) * 24); c.lineTo(w / 2 + Math.cos(a) * 29, h / 2 + Math.sin(a) * 29); c.stroke(); }
    c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + 10, h / 2 - 12); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 - 2, h / 2 - 20); c.stroke(); } }), roughness: 0.3 }), 12.35, 0.965, 0.16, { seg: 20, cast: false }).rotation.set(Math.PI / 2, Math.PI, 0);
  K.burner = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.075, 24), new THREE.MeshBasicMaterial({ color: '#ff6a2a', transparent: true, opacity: 0 }));
  K.burner.rotation.x = -Math.PI / 2; K.burner.position.set(12.5, 0.911, 0.51); W.add(K.burner); K.burner.userData.dynamic = true;
  const pan = new THREE.Group(); pan.position.set(12.5, 0.91, 0.51); W.add(pan); pan.userData.dynamic = true;
  cyl(0.13, 0.12, 0.035, G.shared({ color: '#2a2725', roughness: 0.35, metalness: 0.7, env: 0.8 }), 0, 0.02, 0, { parent: pan, seg: 24 });
  box(0.2, 0.018, 0.035, MAT.darkWood, 0.22, 0.03, 0.06, { parent: pan }).rotation.y = -0.3;
  K.pancakeInPan = cyl(0.09, 0.09, 0.012, G.shared({ color: '#e0b070', roughness: 0.7 }), 0, 0.04, 0, { parent: pan, seg: 20 });
  K.pancakeInPan.visible = false; K.pan = pan;
  for (let i = 0; i < 4; i++) {   // the knobs, black with chrome skirts
    cyl(0.027, 0.027, 0.006, chrome, 12.12 + i * 0.15, 0.8, 0.708, { seg: 16, cast: false }).rotation.x = Math.PI / 2;
    cyl(0.019, 0.022, 0.026, blackK, 12.12 + i * 0.15, 0.8, 0.722, { seg: 14 }).rotation.x = Math.PI / 2;
  }
  box(0.56, 0.56, 0.025, cream, 12.35, 0.445, 0.713, { r: 0.01 });   // the oven door
  box(0.4, 0.2, 0.006, G.shared({ color: '#141210', roughness: 0.08, env: 1 }), 12.35, 0.46, 0.727, { cast: false });   // its window
  for (const k of [-1, 1]) { box(0.42, 0.012, 0.008, chrome, 12.35, 0.46 + k * 0.106, 0.728, { cast: false }); box(0.012, 0.224, 0.008, chrome, 12.35 + k * 0.206, 0.46, 0.728, { cast: false }); }
  cyl(0.011, 0.011, 0.5, chrome, 12.35, 0.67, 0.762, { seg: 12 }).rotation.z = Math.PI / 2;   // the rail
  for (const k of [-1, 1]) cyl(0.008, 0.008, 0.04, chrome, 12.35 + k * 0.22, 0.67, 0.742, { seg: 8 }).rotation.x = Math.PI / 2;
  box(0.56, 0.1, 0.02, cream, 12.35, 0.09, 0.711, { r: 0.008 }); box(0.16, 0.014, 0.014, chrome, 12.35, 0.115, 0.728, { r: 0.005 });   // the drawer under
  // The sink: deep white fireclay, its apron front standing out of the cabinets, a brass bridge tap behind.
  K.sink = { x: 13.05, z: 0.38 };
  box(SX1 - SX0, 0.24, 0.04, ceramic, 13.05, 0.775, 0.7, { r: 0.012 });
  box(SX1 - SX0, 0.24, 0.03, ceramic, 13.05, 0.775, 0.185, { r: 0.008 });
  for (const k of [-1, 1]) box(0.03, 0.24, 0.52, ceramic, 13.05 + k * ((SX1 - SX0) / 2 - 0.015), 0.775, 0.44, { r: 0.008 });
  box(SX1 - SX0 - 0.04, 0.03, 0.5, ceramic, 13.05, 0.67, 0.44, { cast: false });
  cyl(0.03, 0.03, 0.004, G.shared({ color: '#1a1816', roughness: 0.6 }), 13.05, 0.686, 0.44, { seg: 16, cast: false });
  const drain = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 4, 16), chrome); drain.rotation.x = Math.PI / 2; drain.position.set(13.05, 0.688, 0.44); W.add(drain);
  for (const k of [-1, 1]) {   // the pillars, each with a cross-head handle
    cyl(0.013, 0.016, 0.07, MAT.metal, 13.05 + k * 0.08, 0.925, 0.13, { seg: 10 });
    for (const a of [0, Math.PI / 2]) box(0.065, 0.01, 0.01, MAT.metal, 13.05 + k * 0.08, 0.968, 0.13, { r: 0.004 }).rotation.y = a + Math.PI / 4;
    sph(0.012, ceramic, 13.05 + k * 0.08, 0.975, 0.13, [1, 1, 1], W, 10);
  }
  cyl(0.012, 0.012, 0.16, MAT.metal, 13.05, 0.945, 0.13, { seg: 10 }).rotation.z = Math.PI / 2;   // the bridge
  cyl(0.012, 0.013, 0.12, MAT.metal, 13.05, 1.005, 0.13, { seg: 10 });
  const tapSpout = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.011, 8, 18, Math.PI), MAT.metal); tapSpout.rotation.y = Math.PI / 2; tapSpout.position.set(13.05, 1.065, 0.22); W.add(tapSpout);
  cyl(0.011, 0.009, 0.04, MAT.metal, 13.05, 1.045, 0.31, { seg: 10 });
  K.toaster = { x: 13.48, z: 0.36 };
  box(0.26, 0.17, 0.15, enamel('#e9e1d2'), 13.48, 0.975, 0.36, { r: 0.04, seg: 3 });
  for (const dz of [-0.03, 0.03]) box(0.18, 0.01, 0.018, G.shared({ color: '#141210', roughness: 0.6 }), 13.48, 1.062, 0.36 + dz, { cast: false });
  // Fridge in the corner, covered in magnets and one very important drawing.
  K.fridge = { x: 14.55, z: 0.45 };
  // Rounded like an old one, in the range's cream: two doors with a dark seam between, chrome lever handles on posts,
  // a chrome badge, a grille at its foot. (Its handles were two brass sticks, the seam a pale line.)
  box(0.74, 1.82, 0.68, cream, 14.55, 0.91, 0.43, { coll: true, cam: true, r: 0.08, seg: 4 });
  box(0.7, 0.012, 0.012, G.shared({ color: '#2a2622', roughness: 0.8 }), 14.55, 0.92, 0.768, { cast: false });
  for (const [y0, y1] of [[1.0, 1.45], [0.4, 0.75]]) {
    cyl(0.013, 0.013, y1 - y0, chrome, 14.26, (y0 + y1) / 2, 0.81, { seg: 12 });
    for (const y of [y0 + 0.02, y1 - 0.02]) cyl(0.009, 0.009, 0.05, chrome, 14.26, y, 0.787, { seg: 8 }).rotation.x = Math.PI / 2;
  }
  box(0.13, 0.03, 0.006, chrome, 14.55, 1.7, 0.772, { r: 0.004, cast: false });
  box(0.56, 0.07, 0.01, G.shared({ color: '#2a2622', roughness: 0.8 }), 14.55, 0.07, 0.768, { cast: false });
  for (let i = 0; i < 4; i++) box(0.54, 0.006, 0.006, chrome, 14.55, 0.048 + i * 0.015, 0.774, { cast: false });
  const drawing = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), G.std({ map: noteTex([{ t: '☃', size: 110 }, { t: 'us', size: 30, gap: 90 }], { bg: '#fdfbf4' }), roughness: 0.9 }));
  drawing.position.set(14.62, 1.35, 0.776); drawing.rotation.z = 0.06; W.add(drawing);
  for (const [x, y, c] of [[14.4, 1.6, '#c94a3a'], [14.75, 1.1, '#4a7ac9'], [14.48, 0.75, '#e0b040']]) sph(0.018, enamel(c), x, y, 0.785, [1, 1, 0.5], W, 10);
  // Table and three chairs: two side by side facing the window wall, one across.
  K.table = { x: 13.0, z: 2.95, top: 0.76 };
  box(1.25, 0.05, 0.8, MAT.wood, 13.0, 0.74, 2.95, { r: 0.015 });
  for (const [a, b] of [[-0.56, -0.34], [0.56, -0.34], [-0.56, 0.34], [0.56, 0.34]]) box(0.05, 0.72, 0.05, MAT.wood, 13.0 + a, 0.36, 2.95 + b);
  G.COLL.push({ x0: 12.36, z0: 2.53, x1: 13.64, z1: 3.37 });
  const chair = (x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; W.add(g);
    box(0.42, 0.04, 0.4, MAT.darkWood, 0, 0.45, 0, { parent: g, r: 0.01 });
    for (const [a, b] of [[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]]) box(0.035, 0.45, 0.035, MAT.darkWood, a, 0.225, b, { parent: g });
    for (const a of [-0.18, 0.18]) box(0.035, 0.5, 0.035, MAT.darkWood, a, 0.72, -0.18, { parent: g });
    box(0.4, 0.12, 0.03, MAT.darkWood, 0, 0.9, -0.18, { parent: g });
    box(0.36, 0.035, 0.34, MAT.plaid, 0, 0.485, 0.01, { parent: g, r: 0.012 });
    return G.propify('chair', g);
  };
  // ry = π: the seat faces −z (toward the table from the window side).
  K.chairs = { A: { x: 12.72, z: 3.58, yaw: Math.PI }, B: { x: 13.3, z: 3.58, yaw: Math.PI }, C: { x: 13.0, z: 2.3, yaw: 0 } };
  for (const c of Object.values(K.chairs)) { chair(c.x, c.z, c.yaw === 0 ? 0 : Math.PI); G.COLL.push({ x0: c.x - 0.2, z0: c.z - 0.19, x1: c.x + 0.2, z1: c.z + 0.19 }); c.seatY = 0.49; }
  // Breakfast things, shown as they're made.
  const plateM = enamel('#f3efe6'), cake = G.shared({ color: '#d9a35e', roughness: 0.7 }), burnt = G.shared({ color: '#5a3a22', roughness: 0.9 });
  K.plates = [];
  for (const c of [K.chairs.A, K.chairs.B, K.chairs.C]) {
    const g = new THREE.Group(); g.position.set(c.x, 0.765, c.z + (c.yaw === 0 ? 0.33 : -0.33)); g.visible = false; W.add(g);
    cyl(0.12, 0.1, 0.014, plateM, 0, 0.007, 0, { parent: g, seg: 24 });
    const stack = [];
    for (let i = 0; i < 3; i++) stack.push(cyl(0.085 - i * 0.004, 0.085, 0.014, cake, (i - 1) * 0.004, 0.021 + i * 0.015, 0, { parent: g, seg: 20 }));
    const fork = box(0.012, 0.006, 0.16, MAT.metal, 0.15, 0.01, 0, { parent: g });
    K.plates.push({ g, stack, chair: c, fork, cakeMat: cake, burntMat: burnt });
  }
  K.mugs = [];
  for (const [x, z] of [[12.55, 2.98], [13.45, 3.0]]) { const g = new THREE.Group(); g.position.set(x, 0.765, z); g.visible = false; W.add(g); cyl(0.04, 0.036, 0.09, enamel('#efe7da'), 0, 0.045, 0, { parent: g, seg: 16 }); cyl(0.036, 0.036, 0.004, G.shared({ color: '#7a4a2a', roughness: 0.2 }), 0, 0.082, 0, { parent: g, seg: 14 }); K.mugs.push(g); }
  // Snack cupboard by the doorway, with its sign.
  K.cupboard = { x: 11.42, z: 4.12 };
  // sage like the run, two shaker doors and a brass knob each, under a little cornice
  box(0.6, 1.9, 0.42, sage, 11.42, 0.95, 4.26, { coll: true, cam: true, r: 0.01 });
  { const P = new THREE.Group(); P.position.set(11.42, 0, 4.05); P.rotation.y = Math.PI; W.add(P);
    front(-0.29, 0, 0.08, 1.86, -0.05, P, 0); front(0, 0.29, 0.08, 1.86, 0.05, P, 0);
    box(0.66, 0.04, 0.46, sage, 0, 1.92, -0.19, { parent: P, r: 0.006 }); }
  const note = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), G.std({ map: noteTex([{ t: 'Property', size: 30 }, { t: 'of me.', size: 30, gap: 44 }, { t: 'Not', size: 34, color: '#b8322a', gap: 56 }, { t: 'Partner’s.', size: 36, color: '#b8322a', gap: 46 }]), roughness: 0.9 }));
  note.position.set(11.52, 1.3, 4.02); note.rotation.set(0, Math.PI, -0.05); W.add(note);
  // A little radio on the window sill (story.js switches it on and off).
  K.radio = G.propSlot('radio', 13.58, 0.88, 4.42, Math.PI, (g) => {
    box(0.26, 0.15, 0.1, enamel('#7c2f2a'), 0, 0.075, 0, { parent: g, r: 0.025, seg: 3 });
    const grille = box(0.12, 0.09, 0.005, G.shared({ color: '#d8ccb4', roughness: 0.9 }), -0.05, 0.08, 0.051, { parent: g, cast: false });
    cyl(0.025, 0.025, 0.02, G.shared({ color: '#e9e1d2', roughness: 0.4 }), 0.075, 0.08, 0.055, { parent: g, seg: 14 }).rotation.x = Math.PI / 2;
    box(0.005, 0.18, 0.005, MAT.metal, 0.1, 0.24, -0.02, { parent: g }).rotation.z = -0.3;
    const dial = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.02), new THREE.MeshBasicMaterial({ color: '#ffb468', transparent: true, opacity: 0 }));
    dial.position.set(0.075, 0.125, 0.051); dial.userData.dynamic = true; g.add(dial); K.radioDial = dial;
  });
  // Pendant over the table, a runner rug, herbs on the sill.
  const pend = new THREE.Group(); pend.position.set(13.0, 2.7, 2.95); W.add(pend);
  cyl(0.006, 0.006, 0.7, MAT.darkMetal, 0, -0.35, 0, { parent: pend, seg: 6 });
  const shadeMat = G.std({ color: '#2c3a34', roughness: 0.5, metalness: 0.3, emissive: '#ffb060', emissiveIntensity: 0, side: THREE.DoubleSide });
  const shade = cyl(0.05, 0.22, 0.18, shadeMat, 0, -0.78, 0, { parent: pend, open: true, cast: false });
  const pl = new THREE.PointLight('#ffb062', 0, 6, 2); pl.position.set(0, -0.85, 0); pend.add(pl);
  LAMPS.push({ g: pend, light: pl, shade, on: true, power: 7.5, flick: 1 }); K.pendant = LAMPS[LAMPS.length - 1];
  const runner = G.add(new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.7), MAT.rug), W, false, true); runner.rotation.x = -Math.PI / 2; runner.position.set(12.45, 0.006, 1.2);
  for (let i = 0; i < 3; i++) { const x = 12.5 + i * 0.32; cyl(0.06, 0.05, 0.1, MAT.pot, x, 0.9, 4.47, { seg: 14 }); for (let k = 0; k < 6; k++) { const lf = sph(0.03, MAT.leaf, x + Math.sin(k * 2.1) * 0.03, 0.97 + (k % 3) * 0.025, 4.47 + Math.cos(k * 2.1) * 0.02, [0.5, 1.2, 0.3], W, 8); lf.rotation.z = Math.sin(k) * 0.6; } }
}

function plant(x, z, s = 1) {
  cyl(0.15 * s, 0.12 * s, 0.32 * s, MAT.pot, x, 0.16 * s, z, { seg: 18 });
  const r = G.seeded(Math.round(x * 100 + z));
  for (let i = 0; i < 16; i++) {
    const leaf = G.add(new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 10, 6, 0, Math.PI), MAT.leaf));
    leaf.scale.set(0.42, 1, 0.1); const a = r() * Math.PI * 2;
    leaf.position.set(x + Math.cos(a) * 0.1 * s, (0.42 + r() * 0.38) * s, z + Math.sin(a) * 0.1 * s);
    leaf.rotation.set(Math.sin(a) * 0.8, a, Math.cos(a) * 0.8);
  }
  G.COLL.push({ x0: x - 0.2 * s, z0: z - 0.2 * s, x1: x + 0.2 * s, z1: z + 0.2 * s });
}
function bookshelf(x, z, w, d, h, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; G.world.add(g);
  box(w, h, 0.03, MAT.darkWood, 0, h / 2, -d / 2 + 0.015, { parent: g });
  for (const s of [-1, 1]) box(0.04, h, d, MAT.darkWood, s * (w / 2 - 0.02), h / 2, 0, { parent: g });
  const cols = ['#6e2f26', '#2d4659', '#a8803c', '#43614a', '#5e4870', '#9a5a36', '#d4c6a8', '#33302c', '#7a6a5a'];
  const r = G.seeded(Math.round(x * 31 + z * 7));
  const rows = Math.floor(h / 0.42);
  for (let row = 0; row < rows; row++) {
    const y = 0.06 + row * 0.42;
    box(w - 0.06, 0.03, d - 0.02, MAT.darkWood, 0, y, 0.01, { parent: g });
    let u = -w / 2 + 0.06;
    while (u < w / 2 - 0.1) {
      const kind = r();
      if (kind < 0.08) { cyl(0.04, 0.045, 0.12, G.shared({ color: '#cfd8d0', roughness: 0.05, transparent: true, opacity: 0.55, env: 1.2 }), u + 0.05, y + 0.075, 0, { parent: g }); u += 0.12; continue; }
      if (kind < 0.12) { G.candle(u + 0.04, y + 0.015, 0.0, 0.07, 0.025, g); u += 0.1; continue; }
      const bw = 0.025 + r() * 0.035, bh = 0.2 + r() * 0.13;
      const b = box(bw, bh, d * 0.75, G.shared({ color: cols[Math.floor(r() * cols.length)], roughness: 0.85 }), u + bw / 2, y + 0.015 + bh / 2, 0.02, { parent: g, cast: false });
      if (r() < 0.1) b.rotation.z = 0.22;
      u += bw + 0.004;
    }
  }
  G.COLL.push(ry ? { x0: x - d / 2, z0: z - w / 2, x1: x + d / 2, z1: z + w / 2 } : { x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
  G.INTER.push({ id: 'shelf' + x, pos: [x, 1, z], r: 1.2, label: 'Bookshelf', act: () => G.say(null, '(Paperbacks with cracked spines, a jar of sea glass, and a candle that smells like pine.)') });
}
function buildCake(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); G.world.add(g); g.userData.dynamic = true;   // hidden until the evening
  cyl(0.19, 0.19, 0.012, MAT.ceramic, 0, 0.006, 0, { parent: g, seg: 32 });
  const sponge = G.std({ color: '#f3e3cf', roughness: 0.7 });
  cyl(0.15, 0.15, 0.13, sponge, 0, 0.077, 0, { parent: g, seg: 32 });
  cyl(0.153, 0.153, 0.018, G.std({ color: '#fff6ec', roughness: 0.35, env: 0.6 }), 0, 0.14, 0, { parent: g, seg: 32 });
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; sph(0.017, G.shared({ color: '#b83a3a', roughness: 0.25, env: 0.9 }), Math.cos(a) * 0.12, 0.16, Math.sin(a) * 0.12, [1, 1, 1], g, 10); }
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2, cx = Math.cos(a) * 0.065, cz = Math.sin(a) * 0.065;
    cyl(0.005, 0.005, 0.07, G.shared({ color: '#e8d6c0', roughness: 0.5 }), cx, 0.185, cz, { parent: g, seg: 8 });
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.028, 0.05), flameMaterial('#ffb24a'));
    f.position.set(cx, 0.245, cz); g.add(f); flames.push(f); FLAMES.push(f);
  }
  const light = new THREE.PointLight('#ffb062', 0, 3, 2); light.position.set(0, 0.32, 0); g.add(light);
  return { g, flames, light, lit: true };
}
})();
