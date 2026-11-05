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
  for (const [c, dx, ry] of cush) { const m = box(0.38, 0.34, 0.12, G.std({ map: TX.knitCream, color: c, roughness: 1 }), sx + dx, 0.66, sz - 0.18, { r: 0.06, seg: 3 }); m.rotation.set(-0.35, ry, 0.08); }
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
function buildRooms() {
  const W = G.world;
  /* ===== Bedroom ===== */
  const bx = 2.4;
  box(1.8, 0.3, 2.15, MAT.darkWood, bx, 0.15, 1.2, { coll: true, r: 0.03 });
  box(1.9, 1.2, 0.09, MAT.darkWood, bx, 0.6, 0.16, { r: 0.03 });
  box(1.7, 0.22, 2.0, MAT.linen, bx, 0.41, 1.22, { r: 0.09, seg: 4 });
  const p1 = box(0.66, 0.16, 0.42, MAT.linen, bx - 0.44, 0.6, 0.48, { r: 0.08, seg: 4 }); p1.rotation.x = -0.25;
  const p2 = box(0.66, 0.16, 0.42, MAT.linen, bx + 0.44, 0.6, 0.48, { r: 0.08, seg: 4 }); p2.rotation.x = -0.2;
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
  for (const s of [-1, 1]) box(0.5, 0.56, 0.42, MAT.wood, bx + s * 1.28, 0.28, 0.38, { coll: true, r: 0.02 });
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
  box(1.1, 2.1, 0.62, MAT.darkWood, 4.3, 1.05, 0.44, { coll: true, cam: true, r: 0.02 });
  box(0.01, 1.9, 0.01, MAT.darkMetal, 4.3, 1.05, 0.755);
  const rug = G.add(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), MAT.rug), W, false, true); rug.rotation.x = -Math.PI / 2; rug.position.set(bx, 0.006, 3.2);
  plant(0.45, 3.6, 1.0);
  box(0.9, 0.42, 0.5, MAT.wood, 3.6, 0.21, 4.15, { coll: true, r: 0.02 });   // chest at the foot wall
  box(0.6, 0.05, 0.45, MAT.plaid, 3.5, 0.45, 4.15, { r: 0.02 });
  for (let i = 0; i < 4; i++) box(0.22, 0.05 + i * 0.002, 0.16, G.shared({ color: ['#6b3a2e', '#2e4a5a', '#c9b48a', '#3a5a40'][i], roughness: 0.8 }), 3.85, 0.48 + i * 0.05, 4.1);

  /* ===== Living room ===== */
  const fx = 8.0;
  box(2.0, 2.7, 0.62, MAT.stone, fx, 1.35, 0.35, { coll: true, cam: true, uv: [1.2, 1.6] });
  box(2.25, 0.12, 0.44, MAT.darkWood, fx, 1.42, 0.62, { r: 0.02 });
  box(1.0, 0.78, 0.25, G.std({ color: '#070504', roughness: 1, env: 0 }), fx, 0.42, 0.56, { cast: false });
  box(1.7, 0.06, 0.6, MAT.stone, fx, 0.03, 0.98, { cast: false });
  // Logs that glow from underneath where they're burning (their own material: emissive with the fire).
  const logM = MAT.bark.clone(); logM.emissive = new THREE.Color('#ff4a10'); logM.emissiveIntensity = 0;
  const logA = cyl(0.065, 0.065, 0.6, logM, fx - 0.05, 0.13, 0.74); logA.rotation.z = Math.PI / 2; logA.rotation.y = 0.3;
  const logB = cyl(0.06, 0.06, 0.55, logM, fx + 0.05, 0.22, 0.74); logB.rotation.z = Math.PI / 2; logB.rotation.y = -0.4;
  const logC = cyl(0.05, 0.055, 0.5, logM, fx + 0.02, 0.17, 0.82); logC.rotation.z = Math.PI / 2 - 0.35; logC.rotation.y = 1.25;
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
  coals.scale.set(1.15, 0.14, 0.42); coals.position.set(fx, 0.05, 0.7); W.add(coals);
  const fireG = new THREE.Group(); fireG.position.set(fx, 0.15, 0.74); W.add(fireG);
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
  G.FIRE = { planes: firePlanes, light: fireLight, on: true, power: 9, level: 1, coals: coalM, logM, lightAt: fireLight.position.clone() };
  G.INTER.push({ id: 'fire', pos: [fx, 0.6, 1.25], r: 1.3, label: () => (G.FIRE.on ? 'Fireplace' : 'Light the fire'), act: () => { G.FIRE.on = !G.FIRE.on; if (G.FIRE.on) G.say('partner', 'The fire person, at work. My hero, {toHim}.'); } });
  // Mantle: candles, frames, a snow globe, a sprig of pine.
  // Mantle things sit on the shelf in front of the stone (its face is at z = 0.66), not inside it.
  candle(fx - 0.85, 1.48, 0.74, 0.16, 0.03); candle(fx - 0.72, 1.48, 0.77, 0.11, 0.03); candle(fx + 0.82, 1.48, 0.76, 0.13, 0.03);
  G.MANTLE_LIGHT = new THREE.PointLight('#ffa850', 1.4, 3, 2); G.MANTLE_LIGHT.position.set(fx, 1.75, 0.8); W.add(G.MANTLE_LIGHT);
  polaroid(fx - 0.3, 1.6, 0.675, 0, 'lake', -0.12); polaroid(fx + 0.05, 1.58, 0.675, 0, 'hill', 0.08);
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
  const sx = 8.0, sz = 3.0;
  box(2.2, 0.44, 0.92, MAT.sofa, sx, 0.22, sz, { coll: true, r: 0.07, seg: 4 });
  box(2.2, 0.58, 0.24, MAT.sofa, sx, 0.66, sz + 0.38, { r: 0.09, seg: 4 });
  for (const s of [-1, 1]) box(0.22, 0.64, 0.92, MAT.sofa, sx + s * 1.1, 0.32, sz, { r: 0.09, seg: 4 });
  for (const s of [-1, 1]) box(0.96, 0.15, 0.64, MAT.sofa, sx + s * 0.5, 0.51, sz - 0.08, { r: 0.07, seg: 4 });
  const pil1 = box(0.42, 0.4, 0.13, MAT.knitCream, sx - 0.72, 0.77, sz + 0.2, { r: 0.06, seg: 3 }); pil1.rotation.set(-0.3, 0.3, 0.12);
  const pil2 = box(0.4, 0.38, 0.13, MAT.plaid, sx + 0.75, 0.76, sz + 0.2, { r: 0.06, seg: 3 }); pil2.rotation.set(-0.3, -0.25, -0.1);
  const drape = box(0.7, 0.04, 1.0, MAT.plaid, sx + 0.95, 0.68, sz + 0.05, { r: 0.02 }); drape.rotation.set(0.2, 0, -0.5);
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
  const chair = new THREE.Group(); chair.position.set(6.25, 0, 1.95); chair.rotation.y = -0.91; W.add(chair);   // turned to face the fire
  const cm = G.std({ map: TX.wool, bumpMap: TX.woolB, bumpScale: 0.002, color: '#6c3322', roughness: 1, env: 0.25 });   // rust wool (it was so dark it read as a hole in the room)
  box(0.86, 0.42, 0.82, cm, 0, 0.21, 0, { parent: chair, r: 0.07, seg: 4 });
  box(0.86, 0.64, 0.2, cm, 0, 0.72, 0.33, { parent: chair, r: 0.08, seg: 4 });
  for (const s of [-1, 1]) box(0.16, 0.56, 0.82, cm, s * 0.43, 0.33, 0, { parent: chair, r: 0.07, seg: 4 });
  box(0.6, 0.05, 0.6, MAT.knitCream, 0, 0.45, -0.02, { parent: chair, r: 0.02 });
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
  // Coats by the door.
  box(0.6, 0.05, 0.08, MAT.darkWood, 5.5, 1.75, 4.45);
  const coat = G.std({ map: TX.jersey, color: '#5c5f63', roughness: 1 });
  // Kept separate (not batched): each one comes off its hook when it's being worn (life.js).
  G.HOOK_COATS = [box(0.3, 0.75, 0.12, coat, 5.38, 1.35, 4.38, { r: 0.05 }), box(0.28, 0.7, 0.12, G.std({ map: TX.jersey, color: '#a8875e', roughness: 1 }), 5.65, 1.38, 4.38, { r: 0.05 })];
  G.HOOK_COATS.forEach((m) => { m.userData.dynamic = true; });
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
  const paint = G.std({ map: TX.boards, color: '#8fa08a', roughness: 0.6, env: 0.3 });
  const block = G.std({ map: TX.floor, color: '#d8b48a', roughness: 0.5, env: 0.4 });
  const enamel = (c) => G.shared({ color: c, roughness: 0.25, env: 0.9 });
  // Base cabinets along the north wall with a butcher-block top and a tiled splash.
  const cx0 = 11.18, cx1 = 13.72, ccx = (cx0 + cx1) / 2, cw = cx1 - cx0;
  box(cw, 0.84, 0.58, paint, ccx, 0.42, 0.4, { coll: true, r: 0.01 });
  box(cw + 0.04, 0.12, 0.5, G.shared({ color: '#2e2620', roughness: 0.9 }), ccx, 0.05, 0.37, { cast: false });   // toe kick
  for (let x = cx0 + 0.62; x < cx1 - 0.1; x += 0.63) box(0.012, 0.66, 0.01, G.shared({ color: '#55604f', roughness: 0.8 }), x, 0.5, 0.695, { cast: false });
  for (let x = cx0 + 0.31; x < cx1; x += 0.63) box(0.1, 0.018, 0.02, MAT.metal, x, 0.74, 0.705);
  box(cw + 0.06, 0.05, 0.64, block, ccx, 0.865, 0.41, { r: 0.01 });
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
  box(0.62, 0.02, 0.5, G.shared({ color: '#1e1c1c', roughness: 0.3, metalness: 0.4, env: 0.8 }), 12.35, 0.895, 0.39, { cast: false });
  for (const [dx, dz, rr] of [[-0.15, -0.1, 0.08], [0.15, -0.1, 0.06], [-0.15, 0.12, 0.06], [0.15, 0.12, 0.09]]) cyl(rr, rr, 0.008, G.shared({ color: '#3a3330', roughness: 0.6, metalness: 0.5 }), 12.35 + dx, 0.905, 0.39 + dz, { seg: 20, cast: false });
  K.burner = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.075, 24), new THREE.MeshBasicMaterial({ color: '#ff6a2a', transparent: true, opacity: 0 }));
  K.burner.rotation.x = -Math.PI / 2; K.burner.position.set(12.5, 0.911, 0.51); W.add(K.burner); K.burner.userData.dynamic = true;
  const pan = new THREE.Group(); pan.position.set(12.5, 0.91, 0.51); W.add(pan); pan.userData.dynamic = true;
  cyl(0.13, 0.12, 0.035, G.shared({ color: '#2a2725', roughness: 0.35, metalness: 0.7, env: 0.8 }), 0, 0.02, 0, { parent: pan, seg: 24 });
  box(0.2, 0.018, 0.035, MAT.darkWood, 0.22, 0.03, 0.06, { parent: pan }).rotation.y = -0.3;
  K.pancakeInPan = cyl(0.09, 0.09, 0.012, G.shared({ color: '#e0b070', roughness: 0.7 }), 0, 0.04, 0, { parent: pan, seg: 20 });
  K.pancakeInPan.visible = false; K.pan = pan;
  for (let i = 0; i < 4; i++) cyl(0.022, 0.022, 0.03, MAT.darkMetal, 12.12 + i * 0.15, 0.62, 0.7, { seg: 10 }).rotation.x = Math.PI / 2;   // oven knobs
  box(0.52, 0.26, 0.012, G.shared({ color: '#141210', roughness: 0.1, env: 1 }), 12.35, 0.4, 0.697, { cast: false });   // oven window
  K.sink = { x: 13.05, z: 0.38 };
  box(0.5, 0.012, 0.38, G.shared({ color: '#9aa0a4', roughness: 0.2, metalness: 0.9, env: 1 }), 13.05, 0.892, 0.4, { cast: false });
  const tap = cyl(0.014, 0.014, 0.3, MAT.metal, 13.05, 1.04, 0.2, { seg: 8 });
  const tapA = cyl(0.012, 0.012, 0.16, MAT.metal, 13.05, 1.18, 0.27, { seg: 8 }); tapA.rotation.x = Math.PI / 2;
  K.toaster = { x: 13.48, z: 0.36 };
  box(0.26, 0.17, 0.15, enamel('#e9e1d2'), 13.48, 0.975, 0.36, { r: 0.04, seg: 3 });
  for (const dz of [-0.03, 0.03]) box(0.18, 0.01, 0.018, G.shared({ color: '#141210', roughness: 0.6 }), 13.48, 1.062, 0.36 + dz, { cast: false });
  // Fridge in the corner, covered in magnets and one very important drawing.
  K.fridge = { x: 14.55, z: 0.45 };
  box(0.74, 1.82, 0.68, enamel('#ece6da'), 14.55, 0.91, 0.43, { coll: true, cam: true, r: 0.05, seg: 3 });
  box(0.025, 0.4, 0.03, MAT.metal, 14.25, 1.2, 0.785); box(0.025, 0.3, 0.03, MAT.metal, 14.25, 0.55, 0.785);
  box(0.7, 0.01, 0.01, G.shared({ color: '#b8b0a2', roughness: 0.6 }), 14.55, 0.92, 0.772, { cast: false });
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
  box(0.6, 1.9, 0.42, paint, 11.42, 0.95, 4.26, { coll: true, cam: true, r: 0.01 });
  box(0.012, 1.7, 0.01, G.shared({ color: '#55604f', roughness: 0.8 }), 11.42, 0.95, 4.045, { cast: false });
  const note = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), G.std({ map: noteTex([{ t: 'Property', size: 30 }, { t: 'of me.', size: 30, gap: 44 }, { t: 'Not', size: 34, color: '#b8322a', gap: 56 }, { t: 'Partner’s.', size: 36, color: '#b8322a', gap: 46 }]), roughness: 0.9 }));
  note.position.set(11.52, 1.3, 4.044); note.rotation.set(0, Math.PI, -0.05); W.add(note);
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
