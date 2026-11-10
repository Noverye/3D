'use strict';
/* =========================================================================
 * World: terrain, sky, mountains, forest, frozen lake, path and the cabin.
 * Cabin interior is x 0..15, z 0..4.6, floor y = 0 (bedroom 0–5, living room 5–11,
 * kitchen 11–15, with the study lean-to outside the east wall). North is −z.
 * ========================================================================= */
(() => {
const { clamp, lerp, smooth, fbm, MAT, TX } = G;
const world = (G.world = new THREE.Group());
G.scene.add(world);

/* ---------------- layout ---------------- */
// The cabin: 15 m wide, 7 m deep (the back wall at z = -2.4; the front, the porch and everything outside it are where they always were).
const CAB = (G.CAB = { x0: 0, z0: -2.4, x1: 15, z1: 4.6, wallH: 2.7, eave: 2.9, ridge: 5.25, ridgeZ: 1.1 });
const PORCH = (G.PORCH = { x0: 3.4, x1: 11.4, z0: 4.6, z1: 6.6, stepX0: 5.85, stepX1: 7.15, stepZ1: 7.7 });
const GROUND = -0.35;
const CLEAR = (G.CLEAR = { x: 6.5, z: 15, r: 23 });
const LAKE = (G.LAKE = { x: 6, z: 60, r: 16, y: -1.15 });
const HILL = (G.HILL = { x: 13, z: 36.5, h: 3.0, s: 4.0 });   // the hill past the meadow, with a bench on top (the walk)
G.SUN_SET = new THREE.Vector3(0.62, 0.17, -1).normalize();
G.SUN_DAY = new THREE.Vector3(0.55, 0.42, 0.72).normalize();   // morning sun low in the south-east, in through the south windows
const ANNEX = (G.ANNEX = { x0: 15.1, x1: 16.9, z0: 2.9, z1: 4.75 });
const pathX = (G.pathX = (z) => 6.5 + Math.sin((z - 7.6) / 7.5) * 1.6 * smooth(7.6, 12, z));
const PATH_END = 31;

function rectDist(x, z, x0, z0, x1, z1) { const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1); return Math.hypot(dx, dz); }
function terrainH(x, z) {
  const dHouse = Math.min(rectDist(x, z, -0.6, -0.8, 15.8, 7.8), rectDist(x, z, 14, -0.8, 17.6, 5.4));
  const onPath = z > 7 && z < PATH_END + 2 ? Math.abs(x - pathX(z)) : 99;
  const near = Math.min(dHouse, onPath + 0.3);
  const dC = Math.hypot(x - CLEAR.x, z - CLEAR.z);
  let h = GROUND + fbm(x * 0.07, z * 0.07, 3) * 0.55 * smooth(1.5, 8, near);
  const southness = Math.max(0, (z - CLEAR.z) / Math.max(1, dC));
  const rise = smooth(16, 34, dC) * (fbm(x * 0.025 + 5, z * 0.025, 3) * 3.5 + Math.max(0, dC - 32) * 0.11) * (1 - 0.85 * southness);
  h += rise;
  h += HILL.h * Math.exp(-((x - HILL.x) ** 2 + (z - HILL.z) ** 2) / (2 * HILL.s * HILL.s));
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
  h = lerp(h, LAKE.y - 0.25, 1 - smooth(LAKE.r - 1, LAKE.r + 7, dl));
  return Math.max(h, shoreH(x, z));
}
G.terrainH = terrainH;
/* Snow banked up against the cabin, where the wind drifts it and the roof sheds it: deepest along the back (north)
 * wall and round the chimney, then the west end, lower at the front and lowest against the porch, and dug away round
 * the porch steps where everyone comes and goes. Under the eaves, the snow that slid off the roof has left a ridge
 * along the drip line. (The snow used to meet the foundation stones in one straight hard line all the way round.) */
// The chimney, outside the north wall: x its centre; the breast bW wide and bD deep up to yB, the shoulders up to yS,
// the stack sW by sD up to yT.
// (The stack stands out from the wall far enough for the roof's overhang, and its snow, to stop inside it.)
const CHIM = { x: 8, bW: 1.6, bD: 1.0, yB: 1.85, yS: 2.25, sW: 0.9, sD: 0.8, yT: 6.05 };
const BANK_R = [   // [x0, z0, x1, z1, height at the wall]: the outer faces of the walls (−1: by which side it is)
  [CAB.x0 - 0.11, CAB.z0 - 0.11, CAB.x1 + 0.11, CAB.z1 + 0.11, -1],
  [ANNEX.x0 - 0.1, ANNEX.z0 - 0.11, ANNEX.x1 + 0.11, ANNEX.z1 + 0.11, 0.34],
  [CHIM.x - CHIM.bW / 2, CAB.z0 - 0.11 - CHIM.bD, CHIM.x + CHIM.bW / 2, CAB.z0 - 0.11, 0.52],   // the chimney breast
  [PORCH.x0, PORCH.z0, PORCH.x1, PORCH.z1, 0.17],
];
function bankH(x, z) {
  if (x < -3 || x > 20 || z < CAB.z0 - 3.2 || z > PORCH.stepZ1 + 2) return 0;
  let ws = 0, hs = 0, d = 99;
  for (const R of BANK_R) {
    const di = rectDist(x, z, R[0], R[1], R[2], R[3]);
    if (di > 2.6) continue;
    let b = R[4];
    if (b < 0) {
      const cx = clamp(x, R[0], R[2]), cz = clamp(z, R[1], R[3]), l = Math.hypot(x - cx, z - cz) || 1, nx = (x - cx) / l, nz = (z - cz) / l;
      b = 0.36 + 0.15 * Math.max(0, -nz) + 0.06 * Math.max(0, -nx) - 0.09 * Math.max(0, nz);
    }
    const w = Math.exp(-di * 5); ws += w; hs += w * b; d = Math.min(d, di);
  }
  if (d > 2.6) return 0;
  const h = (hs / ws) * (0.8 + 0.5 * fbm(x * 0.55 + 3.1, z * 0.55, 2));
  const wdt = (0.7 + h * 1.6) * (0.85 + 0.3 * fbm(x * 0.3 + 7, z * 0.3, 2));
  let s = h * (1 - smooth(0, wdt, d));
  const north = z < CAB.z0 - 0.11, south = z > CAB.z1 + 0.11 && (x < PORCH.x0 - 0.3 || x > PORCH.x1 + 0.3);
  if (x > CAB.x0 - 0.5 && x < CAB.x1 + 0.5 && (north || south)) {
    const de = north ? CAB.z0 - 0.11 - z : z - CAB.z1 - 0.11;
    s += 0.11 * (0.7 + 0.6 * fbm(x * 0.8, z * 0.8 + 9, 2)) * Math.exp(-(((de - 0.58) / 0.24) ** 2));
  }
  s *= smooth(0.2, 0.9, rectDist(x, z, PORCH.stepX0, PORCH.z1, PORCH.stepX1, PORCH.stepZ1));
  if (z > PORCH.z1) s *= smooth(0.9, 1.7, Math.abs(x - pathX(Math.max(z, 7.6))));
  return Math.max(0, s);
}
G.bankH = bankH;
G.floorAt = (x, z) => {
  if (x > CAB.x0 - 0.05 && x < CAB.x1 + 0.05 && z > CAB.z0 - 0.05 && z < CAB.z1 + 0.05) return 0;
  if (x > PORCH.x0 && x < PORCH.x1 && z >= PORCH.z0 && z < PORCH.z1) return 0;
  if (x > PORCH.stepX0 && x < PORCH.stepX1 && z >= PORCH.z1 && z < PORCH.stepZ1) return lerp(0, GROUND, (z - PORCH.z1) / (PORCH.stepZ1 - PORCH.z1));
  if (G.onIce(x, z)) return LAKE.y;
  return terrainH(x, z) + bankH(x, z) * 0.6;   // feet sink a little into the banked snow
};
// The ice, and a shelf of packed snow that brings the shore up to meet it so you can step on and off.
G.onIce = (x, z) => Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r - 0.05;
function shoreH(x, z) { if (!LAKE) return -9; const d = Math.hypot(x - LAKE.x, z - LAKE.z) - LAKE.r; return d < 0 || d > 3 ? -9 : LAKE.y - d * 0.16; }
G.shoreH = shoreH;
G.inside = (x, z) => x > CAB.x0 && x < CAB.x1 && z > CAB.z0 && z < CAB.z1;
// On wooden floor or decking (inside, porch or its steps) rather than snow.
G.onDeck = (x, z) => G.inside(x, z) || (x > PORCH.x0 && x < PORCH.x1 && z >= PORCH.z0 - 0.1 && z < PORCH.z1) || (x > PORCH.stepX0 && x < PORCH.stepX1 && z >= PORCH.z1 && z < PORCH.stepZ1);
G.underRoof = (x, z) => (x > CAB.x0 - 0.5 && x < CAB.x1 + 0.5 && z > CAB.z0 - 0.5 && z < 5) || (x > ANNEX.x0 && x < ANNEX.x1 + 0.3 && z > ANNEX.z0 - 0.3 && z < ANNEX.z1 + 0.3) || (x > PORCH.x0 && x < PORCH.x1 && z > PORCH.z0 && z < 6.95);
// Rugs muffle footsteps: [x0, z0, x1, z1].
const RUGS = (G.RUGS = [[1.1, 2.4, 3.7, 4.0], [6.55, 0.2, 9.45, 2.2], [11.3, -1.55, 13.6, -0.85]]);
G.onRug = (x, z) => RUGS.some((r) => x > r[0] && x < r[2] && z > r[1] && z < r[3]);
G.walkable = (x, z) => {
  if (Math.hypot(x - CLEAR.x, (z - CLEAR.z) * 0.9) < CLEAR.r) return true;
  // The walk: past the end of the path, across the meadow, over the hill and down onto the frozen lake.
  // (The forest leaves this corridor open; see buildForest.)
  if (z > 26 && z < 66 && Math.abs(x - 6.5) < 4.5 + (z - 8) * 0.25) return true;
  return false;
};
// What's underfoot, for footsteps: the packed path, deep snow, ice, the porch, a rug, the creaky board...
const CREAK = [5.25, 2.0, 5.75, 2.7];   // the board by the bedroom door that everyone knows about
G.surfaceAt = (x, z) => {
  if (G.inside(x, z)) return G.onRug(x, z) ? 'rug' : (x > CREAK[0] && x < CREAK[2] && z > CREAK[1] && z < CREAK[3]) ? 'creak' : 'wood';
  if (G.onDeck(x, z)) return 'porch';
  if (G.onIce(x, z)) return 'ice';
  if ((z > 6.5 && z < PATH_END + 0.5 && Math.abs(x - pathX(z)) < 1.3) || rectDist(x, z, -0.6, -0.8, 15.8, 7.8) < 1.2) return 'packed';
  return 'snow';
};

/* ---------------- terrain ---------------- */
G.buildTerrain = () => {
  const S = 240, N = G.MOBILE ? 140 : 200;
  const geo = new THREE.PlaneGeometry(S, S, N, N);
  geo.rotateX(-Math.PI / 2);
  geo.translate(CLEAR.x, 0, CLEAR.z + 20);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, terrainH(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 18, uv.getY(i) * 18);
  const ground = G.add(new THREE.Mesh(geo, MAT.snowGround || MAT.snow), world, false, true);
  ground.name = 'ground';
  // Trodden path: slightly darker, rougher ribbon.
  const P = [], I = [], UV = [];
  let k = 0;
  for (let z = PORCH.stepZ1 - 0.05; z <= PATH_END + 2; z += 0.4) {
    const cx = pathX(z), w = 1.15 + Math.sin(z * 0.7) * 0.15;
    for (const s of [-1, 1]) { const x = cx + s * w; P.push(x, terrainH(x, z) + 0.015, z); UV.push(s < 0 ? 0 : 1, z * 0.5); }
    if (k) I.push(k * 2 - 2, k * 2, k * 2 - 1, k * 2 - 1, k * 2, k * 2 + 1);
    k++;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); pg.setIndex(I); pg.computeVertexNormals();
  // Packed snow with old boot prints and soft edges that fade into the fresh snow either side.
  const pathTex = (bump) => G.canvasTex(0, null, { w: 256, h: 512, srgb: !bump, draw: (ctx, w, h) => {
    const r = G.seeded(bump ? 5 : 5);
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h, edge = G.smooth(0, 0.28, Math.min(u, 1 - u));
      const n = fbm(u * 6, v * 10, 3) * 0.5 + fbm(u * 40, v * 60, 2) * 0.2;
      const i = (y * w + x) * 4;
      if (bump) { const g = 150 + n * 60; img.data[i] = img.data[i + 1] = img.data[i + 2] = g; img.data[i + 3] = 255; }
      else { const t = 0.9 + n * 0.08; img.data[i] = 222 * t; img.data[i + 1] = 228 * t; img.data[i + 2] = 238 * t; img.data[i + 3] = 255 * edge * (0.75 + n * 0.2); }
    }
    ctx.putImageData(img, 0, 0);
    // Boot prints: two loose lanes, slightly darker and pressed in.
    for (let k = 0; k < 46; k++) {
      const lane = k % 2 ? 0.36 : 0.64, x = (lane + (r() - 0.5) * 0.14) * w, y = r() * h, a = (r() - 0.5) * 0.5;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = bump ? 'rgba(70,70,70,0.75)' : 'rgba(150,165,190,0.32)';
      // Texture is ~111 px/m across and 256 px/m along the path, so a 28 cm boot is ~70 px long.
      ctx.beginPath(); ctx.ellipse(0, -14, 6, 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, 24, 5, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  } });
  const pathMat = G.std({ map: pathTex(false), bumpMap: pathTex(true), bumpScale: 0.012, roughness: 0.8, transparent: true, depthWrite: false, env: 0.6 });
  pathMat.polygonOffset = true; pathMat.polygonOffsetFactor = -2;
  G.add(new THREE.Mesh(pg, pathMat), world, false, true);
  // The banks against the cabin: a fine grid laid round it, kept only where there is bank, in the ground's own
  // material and texture coordinates so it melts into the snow at its foot.
  {
    const st = 0.13, X0 = -2.9, Z0 = CAB.z0 - 3.1, nx = Math.ceil((19.9 - X0) / st), nz = Math.ceil((PORCH.stepZ1 + 1.9 - Z0) / st);
    const solid = (x, z) => BANK_R.some((R) => x > R[0] && x < R[2] && z > R[1] && z < R[3]);
    const H = [], IN = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = X0 + i * st, z = Z0 + j * st; H.push(bankH(x, z)); IN.push(solid(x, z)); }
    const id = (i, j) => j * (nx + 1) + i, map = new Map(), P = [], UV = [], I = [];
    const vert = (i, j) => {
      const k = id(i, j); if (map.has(k)) return map.get(k);
      const x = X0 + i * st, z = Z0 + j * st;
      P.push(x, terrainH(x, z) + H[k] - 0.012, z);
      UV.push((0.5 + (x - CLEAR.x) / 240) * 18, (0.5 - (z - CLEAR.z - 20) / 240) * 18);
      map.set(k, P.length / 3 - 1); return P.length / 3 - 1;
    };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const q = [id(i, j), id(i + 1, j), id(i, j + 1), id(i + 1, j + 1)];
      if (q.every((k) => IN[k]) || q.every((k) => H[k] < 0.004)) continue;
      const a0 = vert(i, j), a1 = vert(i + 1, j), b0 = vert(i, j + 1), b1 = vert(i + 1, j + 1);
      I.push(a0, b0, a1, a1, b0, b1);
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); bg.setIndex(I);
    bg.computeVertexNormals();
    const bank = G.add(new THREE.Mesh(bg, MAT.snowGround || MAT.snow), world, false, true);
    bank.name = 'snowBank';
  }
  // Frozen lake.
  const lake = G.add(new THREE.Mesh(new THREE.CircleGeometry(LAKE.r, 64), MAT.ice), world, false, true);
  lake.rotation.x = -Math.PI / 2; lake.position.set(LAKE.x, LAKE.y, LAKE.z);
  // World boundary for walking.
  G.COLL.push({ x0: CAB.x0 - 0.12, z0: CAB.z0 - 0.12, x1: CAB.x1 + 0.12, z1: CAB.z1 + 0.12, solidExterior: true });
};

/* ---------------- sky ---------------- */
G.SKY_UNI = { uSun: { value: G.SUN_SET.clone() }, uTod: { value: 0 }, uDay: { value: 0 }, uTime: { value: 0 } };
const SKY_FRAG = `
  uniform vec3 uSun; uniform float uTod; uniform float uDay; uniform float uTime; varying vec3 vDir;
  float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float a=0., w=.5; for(int i=0;i<5;i++){ a+=w*n2(p); p*=2.03; w*=.5; } return a; }
  void main(){
    vec3 v = normalize(vDir); float h = v.y;
    vec3 sun = normalize(uSun);
    float sd = max(dot(v, sun), 0.0);
    vec2 vh = normalize(v.xz + 1e-4), sh = normalize(sun.xz);
    float towards = clamp(dot(vh, sh) * 0.5 + 0.5, 0.0, 1.0);
    // Sunset
    vec3 zen = vec3(0.10, 0.14, 0.32), mid = vec3(0.42, 0.30, 0.52), pinkB = vec3(0.86, 0.52, 0.58), gold = vec3(1.0, 0.56, 0.22);
    vec3 horiz = mix(pinkB, gold, pow(towards, 3.0));
    vec3 c = mix(horiz, mid, smoothstep(0.02, 0.22, h));
    c = mix(c, zen, smoothstep(0.18, 0.75, h));
    c += gold * pow(sd, 6.0) * 0.55 + vec3(1.0, 0.8, 0.55) * pow(sd, 60.0) * 1.2;
    c += vec3(1.0, 0.92, 0.7) * smoothstep(0.9994, 0.99975, sd) * 30.0;
    // Clouds: a broken layer lit from below by the sun.
    float ch = clamp(h, 0.0, 1.0);
    vec2 cp = v.xz / (ch + 0.12) * 1.4 + vec2(uTime * 0.004, 0.0);
    float cl = smoothstep(0.48, 0.78, fbm(cp)) * smoothstep(0.015, 0.08, h) * (1.0 - smoothstep(0.35, 0.7, h));
    vec3 cloudLit = mix(vec3(0.42, 0.30, 0.42), vec3(1.0, 0.62, 0.35), pow(towards, 2.0) * 0.9 + pow(sd, 4.0));
    cloudLit = mix(cloudLit, vec3(1.0, 0.85, 0.6), pow(sd, 18.0));
    c = mix(c, cloudLit, cl * 0.92);
    // Below horizon: hazy dusk
    c = mix(c, vec3(0.30, 0.24, 0.36), smoothstep(0.0, -0.08, h));
    // Night
    vec3 nz = vec3(0.012, 0.02, 0.055), nh = vec3(0.06, 0.08, 0.16);
    vec3 nc = mix(nh, nz, smoothstep(0.0, 0.5, h));
    vec3 mwN = normalize(vec3(0.35, 0.25, 0.9));
    float band = exp(-pow(dot(v, mwN) / 0.2, 2.0));
    float dust = fbm(v.xy * 6.0 + v.z * 3.0);
    nc += vec3(0.20, 0.22, 0.32) * band * smoothstep(0.35, 0.8, dust) * 0.55 * smoothstep(0.0, 0.2, h);
    vec2 sc = vec2(atan(v.z, v.x + 1e-5) * 220.0, asin(clamp(h, -0.999, 0.999)) * 220.0);
    vec2 cell = floor(sc); float r = h21(cell);
    float dens = 0.9935 - band * 0.012;
    float star = step(dens, r) * smoothstep(0.55, 0.0, length(fract(sc) - 0.5)) * (0.6 + 0.4 * sin(uTime * 2.0 + r * 80.0));
    nc += vec3(0.85, 0.9, 1.0) * star * smoothstep(0.0, 0.12, h) * (0.6 + r * 6.0 - 5.6 * 0.0);
    nc = mix(nc, vec3(0.04, 0.05, 0.10), smoothstep(0.0, -0.08, h));
    c = mix(c, nc, uTod);
    // Winter day: pale, high and clear, with soft white cloud and a bright low sun.
    if (uDay > 0.001) {
      vec3 dz = vec3(0.20, 0.38, 0.72), dm = vec3(0.50, 0.66, 0.88), dh = vec3(0.86, 0.90, 0.94);
      vec3 dc = mix(dh, dm, smoothstep(0.0, 0.25, h));
      dc = mix(dc, dz, smoothstep(0.2, 0.9, h));
      dc += vec3(1.0, 0.95, 0.85) * (pow(sd, 8.0) * 0.35 + pow(sd, 80.0) * 0.9);
      dc += vec3(1.0, 0.98, 0.92) * smoothstep(0.9995, 0.99985, sd) * 24.0;
      float dcl = smoothstep(0.45, 0.8, fbm(cp * 0.8 + 3.7)) * smoothstep(0.02, 0.12, h) * (1.0 - smoothstep(0.4, 0.85, h));
      vec3 cw = mix(vec3(0.78, 0.82, 0.88), vec3(1.0, 0.99, 0.96), pow(sd, 3.0) * 0.6 + 0.4);
      dc = mix(dc, cw, dcl * 0.85);
      dc = mix(dc, vec3(0.80, 0.84, 0.90), smoothstep(0.0, -0.08, h));
      c = mix(c, dc, uDay);
    }
    c = max(c, vec3(0.0));
    gl_FragColor = vec4(c, 1.0);
  }`;
G.skyMaterial = (env) => new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: G.SKY_UNI,
  vertexShader: env ? 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }' : 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
  fragmentShader: SKY_FRAG,
});
G.buildSky = () => {
  G.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), G.skyMaterial());
  G.sky.frustumCulled = false; G.sky.renderOrder = -1;
  G.scene.add(G.sky);
  // Reflections: environment maps from painted equirectangular skies (sunset, night).
  const paint = (night, day) => {
    const W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, H);
    if (day) { g.addColorStop(0, '#3e6cb4'); g.addColorStop(0.3, '#86a8d8'); g.addColorStop(0.47, '#d6e0ec'); g.addColorStop(0.5, '#eef2f6'); g.addColorStop(0.53, '#e2e8f0'); g.addColorStop(1, '#c8d0dc'); }
    else if (night) { g.addColorStop(0, '#04070f'); g.addColorStop(0.45, '#101a33'); g.addColorStop(0.5, '#1b2440'); g.addColorStop(0.52, '#1a2236'); g.addColorStop(1, '#0d1322'); }
    else { g.addColorStop(0, '#2a3466'); g.addColorStop(0.3, '#7a5e96'); g.addColorStop(0.46, '#e8a08a'); g.addColorStop(0.5, '#ffc08a'); g.addColorStop(0.52, '#d8bcc4'); g.addColorStop(1, '#a89aaa'); }
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (!night) {
      const sun = day ? G.SUN_DAY : G.SUN_SET, u = (Math.atan2(sun.x, -sun.z) / (2 * Math.PI) + 0.5) * W, v = (0.5 - Math.asin(sun.y) / Math.PI) * H;
      const rg = c.createRadialGradient(u, v, 0, u, v, 90); if (day) { rg.addColorStop(0, 'rgba(255,252,240,1)'); rg.addColorStop(0.2, 'rgba(255,244,220,0.7)'); rg.addColorStop(1, 'rgba(255,240,220,0)'); } else { rg.addColorStop(0, 'rgba(255,240,200,1)'); rg.addColorStop(0.15, 'rgba(255,190,110,0.9)'); rg.addColorStop(1, 'rgba(255,150,80,0)'); }
      c.fillStyle = rg; c.fillRect(0, 0, W, H);
    }
    const t = new THREE.CanvasTexture(cv); t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding;
    return G.pmrem.fromEquirectangular(t).texture;
  };
  G.envSunset = paint(false); G.envNight = paint(true); G.envDay = paint(false, true);
  // Indoors by day the "sky" a surface sees is mostly warm pine with a few bright windows, not open blue sky.
  G.envRoom = (() => {
    const W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'), g = c.createLinearGradient(0, 0, 0, H);
    // the limewashed ceiling above, pine walls round the middle, the oak floor below
    g.addColorStop(0, '#b8b0a4'); g.addColorStop(0.3, '#9a8a78'); g.addColorStop(0.42, '#8a6446'); g.addColorStop(0.5, '#9a7252'); g.addColorStop(0.58, '#6e4c34'); g.addColorStop(1, '#3e3028');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (const u of [0.08, 0.3, 0.55, 0.8]) { const rg = c.createRadialGradient(u * W, H * 0.45, 0, u * W, H * 0.45, 34); rg.addColorStop(0, 'rgba(240,244,250,0.95)'); rg.addColorStop(1, 'rgba(240,244,250,0)'); c.fillStyle = rg; c.fillRect(0, 0, W, H); }
    const t = new THREE.CanvasTexture(cv); t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding;
    return G.pmrem.fromEquirectangular(t).texture;
  })();
  G.scene.environment = G.envSunset;
};

/* ---------------- mountains ---------------- */
G.buildMountains = () => {
  // A ring of peaks round the valley. Coloured from its final shape: rock where the faces are too steep for snow to
  // stay, snow on the gentler slopes and ledges, dark forest at the foot, so the range has ridges and gullies you can
  // read instead of one pale cone. (It was 10 rows deep and coloured before smoothing, so the colours missed the shape.)
  const segA = 260, segR = 26, R0 = 120, R1 = 220;
  const P = [], I = [];
  for (let j = 0; j <= segR; j++) {
    for (let i = 0; i <= segA; i++) {
      const a = (i / segA) * Math.PI * 2, t = j / segR, r = lerp(R0, R1, t);
      const x = CLEAR.x + Math.cos(a) * r, z = CLEAR.z + Math.sin(a) * r;
      const ridge = 1 - Math.abs(G.simplex.noise(Math.cos(a) * 2.2 + 9, Math.sin(a) * 2.2));
      const peaks = Math.pow(ridge, 2.2) * 62 + fbm(Math.cos(a) * 6, Math.sin(a) * 6 + t * 2, 4) * 16;
      const rise = Math.sin(Math.PI * Math.min(1, t * 1.25));
      // gullies and ribs running down the slopes
      const gully = (1 - Math.abs(G.simplex.noise(Math.cos(a) * 16 + 3, Math.sin(a) * 16 + t * 1.5))) * 7 * rise;
      let y = rise * (14 + peaks) - 4 + gully - 3.5 * rise;
      if (j === 0) y = -6;
      P.push(x, y, z);
    }
  }
  // Smooth heights around each ring so no single vertex spikes into a needle.
  for (let pass = 0; pass < 3; pass++) for (let j = 1; j <= segR; j++) {
    const row = j * (segA + 1), ys = [];
    for (let i = 0; i <= segA; i++) ys.push(P[(row + i) * 3 + 1]);
    for (let i = 0; i <= segA; i++) { const a = ys[(i + segA - 1) % segA], b = ys[i], c = ys[(i + 1) % segA]; P[(row + i) * 3 + 1] = (a + 2 * b + c) / 4; }
  }
  for (let j = 0; j < segR; j++) for (let i = 0; i < segA; i++) {
    const a = j * (segA + 1) + i, b = a + segA + 1;
    I.push(a, a + 1, b, b, a + 1, b + 1);   // wound to face the valley (the other way round, the slopes facing you were culled and you saw the backs of the far ones through them)
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I);
  g.computeVertexNormals();
  { // the ring's two ends are separate vertices in the same place: share their normals, or a line shows down the range
    const N = g.attributes.normal;
    for (let j = 0; j <= segR; j++) { const a0 = j * (segA + 1), a1 = a0 + segA; const x = N.getX(a0) + N.getX(a1), y = N.getY(a0) + N.getY(a1), z = N.getZ(a0) + N.getZ(a1), l = Math.hypot(x, y, z) || 1; N.setXYZ(a0, x / l, y / l, z / l); N.setXYZ(a1, x / l, y / l, z / l); }
  }
  const rock = new THREE.Color('#55535f'), rockDark = new THREE.Color('#3b3a45'), forest = new THREE.Color('#1c2a2a'), snow = new THREE.Color('#eef1f7'), haze = new THREE.Color('#c9d3e2');
  // Per vertex: the base colour (forest at the foot, rock or snow above it, from the slope), how snowy the slope is,
  // and whether it is above the trees. The shader adds what a vertex every few metres can't: rock ribs running down
  // the faces with snow lying in the gullies between, ledges of snow across the cliffs, strata in the rock and a
  // rough surface, then the air between you and them. (They were pale, smooth and evenly snowed: grey paper.)
  const N = g.attributes.normal, C = new Float32Array(P.length), K = new Float32Array(P.length / 3 * 2), c = new THREE.Color();
  for (let k = 0; k < P.length / 3; k++) {
    const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2], ny = Math.abs(N.getY(k)), a = Math.atan2(z - CLEAR.z, x - CLEAR.x);
    const steep = 1 - ny;   // 0 flat .. 1 vertical
    const snowLine = 15 + fbm(a * 3, y * 0.05) * 9;
    const keep = G.smooth(0.2, 0.07, steep + (fbm(a * 9, y * 0.12) - 0.5) * 0.08);   // how well snow stays on a slope this steep (the range is broad, so its faces are gentler than they look)
    const snowK = keep * G.smooth(snowLine - 6, snowLine, y);
    if (y < 8) c.copy(forest).lerp(rock, G.smooth(2, 8, y) * 0.6);
    else c.copy(rockDark).lerp(rock, G.smooth(0.4, 0.12, steep)).lerp(snow, snowK);
    C[k * 3] = c.r; C[k * 3 + 1] = c.g; C[k * 3 + 2] = c.b;
    K[k * 2] = snowK; K[k * 2 + 1] = G.smooth(6.5, 10, y);
  }
  g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.setAttribute('mtn', new THREE.BufferAttribute(K, 2));
  const mat = G.std({ vertexColors: true, roughness: 0.95, env: 0.3 });
  mat.extensions = { derivatives: true };
  const U = { uHaze: { value: haze }, uSnowC: { value: snow }, uRockC: { value: new THREE.Color(0.11, 0.1, 0.1) }, uRockD: { value: new THREE.Color(0.042, 0.04, 0.045) }, uClr: { value: new THREE.Vector2(CLEAR.x, CLEAR.z) } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'attribute vec2 mtn;\nvarying vec2 vMtn;\nvarying vec3 vMW;\nvarying vec3 vMN;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vMtn = mtn; vMW = (modelMatrix * vec4(transformed, 1.0)).xyz; vMN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = `uniform vec3 uHaze, uSnowC, uRockC, uRockD; uniform vec2 uClr;
      varying vec2 vMtn; varying vec3 vMW; varying vec3 vMN;
      float mtH(vec2 i, float P) { i.x = mod(i.x, P); return fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453); }
      float mtN(vec2 p, float P) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mtH(i, P), mtH(i + vec2(1.0, 0.0), P), f.x), mix(mtH(i + vec2(0.0, 1.0), P), mtH(i + vec2(1.0, 1.0), P), f.x), f.y); }
      float mtF(vec2 p, float P) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * mtN(p, P); p = p * 2.0 + vec2(0.0, 7.31); P *= 2.0; a *= 0.5; } return s / 0.9375; }
      ` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        // Around the range (periodic, so there is no seam) and down its faces: cells long down the fall line and narrow
        // across it, so the ribs and gullies run downhill.
        vec2 rel = vMW.xz - uClr; float ang = atan(rel.y, rel.x), rr = length(rel);
        const float MP = 230.0;
        vec2 q = vec2((ang / 6.2831853 + 0.5) * MP, rr * 0.014 + vMW.y * 0.032);
        float rib = 1.0 - abs(2.0 * mtF(q, MP) - 1.0);
        float fine = mtF(q * vec2(3.0, 7.0) + vec2(0.0, 3.1), MP * 3.0);
        float slope = 1.0 - clamp(normalize(vMN).y, 0.0, 1.0);
        float above = vMtn.y;
        // rock shows along the ribs, more of it the steeper the face
        float big = mtN(q * vec2(0.08, 0.3) + vec2(0.0, 5.7), MP * 0.08);   // some faces mostly cliff, some mostly snow
        // Snow lies on everything above the snow line but the ribs and the steepest faces, where the rock shows.
        float snowLine = 9.0 + big * 9.0 + (fine - 0.5) * 6.0;
        float exposed = smoothstep(0.62, 0.76, rib * rib * 0.85 + fine * 0.3 + slope * 0.32 + (big - 0.5) * 0.4 - 0.02) * above;
        float sn = max(vMtn.x, smoothstep(snowLine - 3.0, snowLine + 3.0, vMW.y)) * (1.0 - exposed);
        // ...and on the rock, ledges of snow across it where it is less steep
        float ledge = smoothstep(0.58, 0.74, mtN(vec2(q.x * 0.4, vMW.y * 0.55 + fine * 2.4), MP * 0.4)) * smoothstep(0.42, 0.2, slope);
        sn = max(sn, ledge * 0.9 * above * exposed * smoothstep(9.0, 14.0, vMW.y));
        float strata = 0.78 + 0.34 * mtN(vec2(q.x * 1.2, vMW.y * 1.1 + fine * 1.5), MP * 1.2);
        vec3 rockC = mix(uRockD, uRockC, fine) * strata;
        vec3 snowC = uSnowC * (0.93 + 0.07 * fine);
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(rockC, snowC, sn), above);
        float mtFar = smoothstep(130.0, 220.0, rr);
        diffuseColor.rgb = mix(diffuseColor.rgb, uHaze, 0.12 + mtFar * 0.2);   // a little air between you and them
        float mtBump = (rib * 1.4 + fine * 0.9) * (1.0 - sn * 0.65) * above;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { // the rough surface: tilt the normal by the slope of mtBump across the screen
          vec3 mtSx = dFdx(-vViewPosition), mtSy = dFdy(-vViewPosition);
          vec3 mtR1 = cross(mtSy, normal), mtR2 = cross(normal, mtSx);
          float mtDet = dot(mtSx, mtR1);
          vec2 mtDh = vec2(dFdx(mtBump), dFdy(mtBump));
          vec3 mtGrad = sign(mtDet) * (mtDh.x * mtR1 + mtDh.y * mtR2);
          normal = normalize(abs(mtDet) * normal - mtGrad);
        }`)
      // Less of the scene's fog on them (it washed them out to the colour of the sky); the haze above stands in for it.
      .replace('#include <fog_fragment>', THREE.ShaderChunk.fog_fragment.replace('gl_FragColor.rgb = mix(', 'fogFactor *= 0.32;\n\tgl_FragColor.rgb = mix('));
  };
  mat.customProgramCacheKey = () => 'mountain-detail';
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = false; m.castShadow = false;
  world.add(m);
};

/* ---------------- forest ---------------- */
// One near spruce bough: a card drawn with TX.frond, reaching out along +x from the trunk, arched across (its stem
// highest, its side shoots drooping away from it) and sagging along its length, then lifting a little at the tip as a
// spruce's do. u runs across it, v from the trunk end (0) to the tip (1). (They were flattened four-sided slabs, solid
// green, and up close the trees looked folded from card.)
function frondGeo(L, W, sag = 0.16, arch = 0.38, lift = 0.05, NX = 5, NA = 3) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= NA; j++) {
    const t = j / NA, hw = W * (1 - 0.4 * t), y = (-sag * t * t + lift * Math.max(0, t - 0.6) * 2.5) * L;
    for (let i = 0; i < NX; i++) {
      const s = (i / (NX - 1)) * 2 - 1;
      pos.push(t * L, y - Math.pow(Math.abs(s), 1.5) * arch * hw, s * hw);
      uv.push((s + 1) / 2, t);
    }
  }
  for (let j = 0; j < NA; j++) for (let i = 0; i < NX - 1; i++) { const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
G.frondGeo = frondGeo;
function pineGeometry(seed, lod = 0) {
  // lod 0: full detail for trees near the clearing; lod 1: the same spruce with fewer, simpler branches for distant
  // trees (they were stacked cones with white tips, and looked like toys next to the near ones).
  const r = G.seeded(seed), parts = [];
  const radial = lod ? 7 : 18, hseg = lod ? 1 : 3;
  const H = 1;   // unit height; instances scale it
  const green = (t) => new THREE.Color().setHSL(0.39 + r() * 0.03, 0.32, 0.1 + t * 0.06);
  // (near trees: the trunk and the inner cones take the bough texture's stem, which is a little brighter than the old one)
  const solid = lod ? 1 : 0.78;
  parts.push({ geo: new THREE.CylinderGeometry(0.012, 0.028, 0.25, lod ? 4 : 6, 1, !!lod), mat: G.mtx(0, 0.12, 0), color: new THREE.Color('#3a2a20').multiplyScalar(solid) });
  const tiers0 = 11 + Math.floor(r() * 4);
  const tiers = lod ? 8 : tiers0;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const y = 0.1 + t * 0.84, rad = lerp(0.26, 0.035, Math.pow(t, 0.8)) * (0.9 + r() * 0.2), h = lerp(0.17, 0.1, t);
    const snowy = r() < 0.85;
    const base = green(t);
    r();   // (a draw that used to be a phase: kept so the near trees keep their shapes)
    // A dark inner cone for body, then a ring of separate drooping branches round it, each its own length and angle,
    // so the outline is ragged like a spruce's; snow lies only on their upper faces. Distant trees get one ring of
    // fewer, three-sided branches, and a fuller inner cone so the gaps between them read as shadow, not sky.
    const inner = base.clone().multiplyScalar(lod ? 0.62 : 0.6);
    // (needled all over like the boughs, never see-through: aSnow.y -1 tells the shader so)
    parts.push({ geo: new THREE.ConeGeometry(rad * (lod ? 0.72 : 0.62), h * (lod ? 1.6 : 1.25), lod ? 6 : 9, 1, true), mat: G.mtx(0, y, 0, 1, 1, 1, r() * 6), color: inner, uv: [lod ? 5 : 7, 1], snow: [0, -1] });
    const nb = lod ? Math.max(4, Math.round(4 + rad * 16)) : Math.max(6, Math.round(7 + rad * 30)), droop0 = lerp(0.55, 0.25, t);
    if (lod) {
      // Distant trees: the same needled boughs, simpler (one segment along, three across) and more of them, so
      // the edge of the forest is feathered like the trees near the cabin. (They were three-sided slabs, smooth and
      // faceted, with flat white tips: from the yard the forest's edge looked stiff, as if cut from card.)
      const nf = Math.round(nb * 1.6);   // every other one shorter and a little higher, between the long ones
      for (let b = 0; b < nf; b++) {
        const two = b % 2, phi = (b / nf) * Math.PI * 2 + (r() - 0.5) * 0.3, L = rad * (two ? 0.85 : 1.15) * (0.85 + r() * 0.3), W = L * 0.48 * (0.9 + r() * 0.2), d = droop0 + 0.08 + (r() - 0.5) * 0.2;
        const M = new THREE.Matrix4().makeTranslation(0, y + (r() - 0.5) * h * 0.4 + (two ? h * 0.3 : 0), 0).multiply(new THREE.Matrix4().makeRotationY(phi)).multiply(new THREE.Matrix4().makeRotationZ(-d));
        const tone = base.clone().offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.03);
        const sAmt = snowy && r() < 0.85 ? 0.62 + r() * 0.35 : 0, sSeed = r();   // (a little more: it has to read from further off)
        parts.push({ geo: frondGeo(L, W, 0.15, 0.36, 0.04, 3, 1), mat: M, uv: true,
          color: (v) => tone.clone().multiplyScalar(0.72 + Math.min(1, Math.hypot(v.x, v.z) / Math.max(1e-3, rad)) * 0.42),
          snow: sAmt ? (v) => [sAmt * (0.35 + 0.65 * smooth(0.12, 0.6, Math.hypot(v.x, v.z) / Math.max(1e-3, rad))), sSeed] : null });
      }
      continue;
    }
    {
      // Near trees: two rings of boughs, the second shorter and a little higher, between the first. Each is a card of
      // needled side shoots (TX.frond) at its own length, droop and roll; snow lies along some of them, more toward
      // the outside of the tree, where the tier above doesn't shelter it, in clumps the shader finds from aSnow.
      // A third, shorter ring hangs steeply over the inner cone, so what shows between the boughs is more boughs.
      const n3 = Math.max(4, Math.round(nb * 0.7));
      for (let b = 0; b < nb * 2 + n3; b++) {
        const ring = b >= nb ? (b >= nb * 2 ? 2 : 1) : 0, bi = b - nb * ring;
        const phi = ((bi + (ring === 1 ? 0.5 : ring ? 0.25 : 0)) / (ring === 2 ? n3 : nb)) * Math.PI * 2 + (r() - 0.5) * 0.4;
        const L = rad * [1.0, 0.74, 0.6][ring] * (0.85 + r() * 0.3);
        const W = L * 0.44 * (0.9 + r() * 0.2), d = droop0 + (r() - 0.5) * 0.2 + [0, -0.08, 0.45][ring];
        const M = new THREE.Matrix4().makeTranslation(0, y + (r() - 0.5) * h * 0.4 + [0, h * 0.3, h * 0.45][ring], 0)
          .multiply(new THREE.Matrix4().makeRotationY(phi))
          .multiply(new THREE.Matrix4().makeRotationZ(-d))
          .multiply(new THREE.Matrix4().makeRotationX((r() - 0.5) * 0.3));
        const tone = base.clone().offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.03);
        const sAmt = snowy && r() < 0.75 ? 0.45 + r() * 0.4 : 0, sSeed = r();
        parts.push({ geo: frondGeo(L, W, 0.13 + r() * 0.07, 0.3 + r() * 0.14, 0.05, ring ? 3 : 5), mat: M, uv: true,
          color: (v) => tone.clone().multiplyScalar(0.7 + Math.min(1, Math.hypot(v.x, v.z) / Math.max(1e-3, rad)) * 0.45),
          snow: sAmt ? (v) => [sAmt * (0.3 + 0.7 * smooth(0.12, 0.6, Math.hypot(v.x, v.z) / Math.max(1e-3, rad))), sSeed] : null });
      }
      continue;
    }
  }
  const g = G.merge(parts);
  // Light the tree as one soft, rounded mass: every flat branch shaded on its own facet made it look folded from
  // paper. The normals are bent most of the way toward "out from the trunk, and a little up", so the crown shades
  // smoothly from its lit side to its shadowed side while the branches keep their ragged outline.
  const P = g.attributes.position, N = g.attributes.normal, v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (y < 0.06 && Math.hypot(x, z) < 0.04) continue;   // the trunk keeps its own
    v.set(x, (y - 0.45) * 0.5 + 0.12, z).normalize();
    n.set(N.getX(i), N.getY(i), N.getZ(i)).multiplyScalar(0.3).addScaledVector(v, 0.7).normalize();
    N.setXYZ(i, n.x, n.y, n.z);
  }
  N.needsUpdate = true;
  return g;
}
G.buildForest = () => {
  const r = G.seeded(31);
  const mat = G.std({ vertexColors: true, roughness: 0.9, env: 0.5, map: G.TX.frond, alphaTest: 0.5, side: THREE.DoubleSide });
  // Gentle sway in the wind: the crown moves more than the trunk, each tree on its own phase.
  G.SWAY = { uTime: { value: 0 }, uGust: { value: 0 } };
  const SWAY_V = `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
        float bend = position.y * position.y * (0.004 + uGust * 0.012);
        transformed.x += sin(uSwayT * 1.1 + ph) * bend + bend * uGust * 0.6;
        transformed.z += cos(uSwayT * 0.83 + ph * 1.7) * bend * 0.6;
      #endif`;
  const sway = (mat, tag, frond) => { mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSwayT = G.SWAY.uTime; sh.uniforms.uGust = G.SWAY.uGust;
    sh.vertexShader = 'uniform float uSwayT; uniform float uGust;\n' + (frond ? 'attribute vec2 aSnow;\nvarying vec2 vFrS;\n' : '') +
      sh.vertexShader.replace('#include <begin_vertex>', (frond ? 'vFrS = aSnow;\n' : '') + SWAY_V);
    if (!frond || !sh.fragmentShader.includes('#include <color_fragment>')) return;
    // The near boughs (TX.frond's channels): the needles' shading and paler tips; their coverage kept up in the
    // distance (the mipmaps average the gaps in, and the alpha test would thin the boughs to nothing); snow in soft
    // clumps where aSnow and the texture's B say it settles, filling the gaps there, white and lit as if facing up,
    // and seen from underneath only where it overhangs the needles; and the undersides lit as undersides, darker,
    // rather than as the tops turned over.
    sh.fragmentShader = `varying vec2 vFrS;
      float frH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float frN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(frH(i), frH(i + vec2(1.0, 0.0)), f.x), mix(frH(i + vec2(0.0, 1.0)), frH(i + vec2(1.0, 1.0)), f.x), f.y); }
      ` + sh.fragmentShader
      .replace('#include <map_fragment>', `
        vec4 frT = texture2D(map, vUv);
        vec2 frD = vUv * vec2(256.0, 512.0);
        float frL = 0.5 * log2(max(max(dot(dFdx(frD), dFdx(frD)), dot(dFdy(frD), dFdy(frD))), 1e-8));
        // (the inner cones: solid, but their lower rims ragged, not a clean line round the tree)
        float frA = vFrS.y < -0.5 ? step(0.1 + 0.2 * frN(vec2(vUv.x * 6.0, 0.5)) + 0.12 * frH(vec2(floor(vUv.x * 30.0), 3.0)), vUv.y)
          : min(1.0, frT.a * (1.0 + max(frL, 0.0) * 0.35));
        diffuseColor.rgb *= frT.r * frT.r * 1.2 * mix(vec3(1.0), vec3(1.25, 1.32, 0.8), frT.g * 0.7);
        diffuseColor.a *= frA;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float frSn = 0.0;
        if (vFrS.x > 0.001) {
          float fn = frN(vec2(vUv.x * 6.0, vUv.y * 16.0) + vFrS.y * 37.0) * 0.65 + frN(vec2(vUv.x * 15.0, vUv.y * 40.0) + vFrS.y * 11.0) * 0.35;
          float fv = frT.b * 0.85 + (fn - 0.5) * 0.5, fth = 1.0 - vFrS.x;
          frSn = smoothstep(fth, fth + 0.06, fv);
          vec3 frC = vec3(0.86, 0.89, 0.94) * (0.72 + 0.28 * smoothstep(0.0, 0.22, fv - fth));
          if (!gl_FrontFacing) { frSn *= 1.0 - smoothstep(0.3, 0.6, frA); frC *= 0.5; }
          diffuseColor.rgb = mix(diffuseColor.rgb, frC, frSn);
          diffuseColor.a = max(diffuseColor.a, frSn);
        }`)
      .replace('normal = normal * faceDirection;', 'if (!gl_FrontFacing) normal = normalize(normal - (viewMatrix * vec4(0.0, 0.6, 0.0, 0.0)).xyz);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (frSn > 0.0 && gl_FrontFacing) normal = normalize(mix(normal, (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz, frSn * 0.7));`);
  };
  mat.customProgramCacheKey = () => 'pine-sway' + tag; };
  sway(mat, '-near-frond', true);
  mat.extensions = { derivatives: true };
  // their shadows: the needles' own outline (not the whole card), swaying with the tree
  const nearDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: G.TX.frond, alphaTest: 0.5, side: THREE.DoubleSide });
  sway(nearDepth, '-near-depth', false);
  G.PINE_MAT = mat; G.PINE_DEPTH = nearDepth; G.pineGeometry = pineGeometry;   // for the odd single spruce placed by hand (the walk's young pine)
  // Trees within NEAR_R of the clearing get full detail and cast shadows; the rest are low-poly and shadowless.
  const NEAR_R = 34;
  const variants = [pineGeometry(3), pineGeometry(17), pineGeometry(42)];
  const farVariants = [pineGeometry(3, 1), pineGeometry(17, 1), pineGeometry(42, 1)];
  const lists = [[], [], []], farLists = [[], [], []];
  // ...and the trees round the lake too: you stand on its shore on the walk, a few metres from them
  const near = (m) => { const e = m.elements; return Math.hypot(e[12] - CLEAR.x, e[14] - CLEAR.z) < NEAR_R || Math.hypot(e[12] - LAKE.x, e[14] - LAKE.z) < LAKE.r + 16; };
  const want = Math.round(520 * G.Q.trees);
  let tries = 0;
  const total = () => lists.concat(farLists).reduce((n, l) => n + l.length, 0);
  while (total() < want && tries++ < 20000) {
    const a = r() * Math.PI * 2, d = 13 + Math.pow(r(), 0.7) * 95;
    const x = CLEAR.x + Math.cos(a) * d * 1.1, z = CLEAR.z + Math.sin(a) * d;
    if (rectDist(x, z, -5, -6, 20, 10) < 1) continue;
    if (z > 7 && z < PATH_END + 4 && Math.abs(x - pathX(z)) < 4.5) continue;
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 3) continue;
    if (Math.hypot(x - CLEAR.x, (z - CLEAR.z) * 0.9) < CLEAR.r - 6 && r() < 0.85) continue;
    // Keep a view corridor from the porch to the lake and mountains.
    if (z > 8 && Math.abs(x - pathX(Math.min(z, PATH_END))) < 7 + (z - 8) * 0.25 && z < LAKE.z + 6) continue;
    const s = 7 + r() * 9;
    const m = G.mtx(x, terrainH(x, z) - 0.15, z, s * (0.85 + r() * 0.3), s, s * (0.85 + r() * 0.3), r() * 6);
    const vi = Math.floor(r() * 3);
    (near(m) ? lists : farLists)[vi].push(m);
  }
  // A few big framing pines close to the cabin, as in the reference shots.
  for (const [x, z, s] of [[-3.6, 9, 15], [19.5, 9, 14], [-4.5, -2, 17], [20, -1, 16], [-0.5, 23, 12], [13.5, 24, 13], [-3, 16, 11]]) lists[0].push(G.mtx(x, terrainH(x, z) - 0.15, z, s, s, s, r() * 6));
  const place = (geos, ls, shadows, M, depth) => geos.forEach((g, i) => {
    if (!ls[i].length) return;
    const im = new THREE.InstancedMesh(g, M, ls[i].length);
    if (depth) im.customDepthMaterial = depth;
    ls[i].forEach((m, k) => im.setMatrixAt(k, m));
    im.castShadow = shadows; im.receiveShadow = true;
    G.fitInstanceBounds(im);
    world.add(im);
  });
  place(variants, lists, true, mat, nearDepth);
  place(farVariants, farLists, false, mat);   // (the distant trees too: the same needled boughs, fewer of them)
  // Snow-covered shrubs and drifts.
  // Indexed sphere so vertex normals are shared and the drifts read as soft, rounded snow
  // (an icosahedron is non-indexed, which gave every face its own normal: faceted "rocks").
  // A drift is a soft dome whose edge runs down into the ground with no crease. (They were squashed spheres, with a
  // ridge round the middle where the flattened underside met the top: from the lake shore they looked like stones.)
  const shrubG = new THREE.SphereGeometry(1, 36, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const sp = shrubG.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i), z = sp.getZ(i), r0 = Math.hypot(x, z), a = Math.atan2(z, x);
    const lump = 1 + G.simplex.noise(Math.cos(a) * 1.3, Math.sin(a) * 1.3) * 0.16;   // an uneven outline
    const r = r0 * 1.18;                                                               // the last bit is a skirt
    const h = (r < 1 ? Math.pow(1 - r * r, 1.4) : -(r - 1) * 0.9) * (1 + G.simplex.noise(x * 1.4 + 7, z * 1.4) * 0.18);
    sp.setXYZ(i, (r0 ? x / r0 : 0) * r * lump * 0.85, h, (r0 ? z / r0 : 0) * r * lump * 0.85);
  }
  shrubG.computeVertexNormals();
  { // the sphere's seam and its pole are split vertices: share their normals, or a line shows down each drift
    const N = shrubG.attributes.normal, by = new Map();
    for (let i = 0; i < sp.count; i++) { const k = sp.getX(i).toFixed(4) + ',' + sp.getY(i).toFixed(4) + ',' + sp.getZ(i).toFixed(4); (by.get(k) || by.set(k, []).get(k)).push(i); }
    by.forEach((L) => { if (L.length < 2) return; let x = 0, y = 0, z = 0; for (const i of L) { x += N.getX(i); y += N.getY(i); z += N.getZ(i); } const l = Math.hypot(x, y, z) || 1; for (const i of L) N.setXYZ(i, x / l, y / l, z / l); });
  }
  const drifts = [];
  for (let i = 0; i < 160; i++) {
    const a = r() * Math.PI * 2, d = 8 + r() * 26;
    const x = CLEAR.x + Math.cos(a) * d, z = CLEAR.z + Math.sin(a) * d;
    if (rectDist(x, z, -1, CAB.z0 - 1, 18, 8.2) < 0.6) continue;   // clear of the cabin (and of its back wall, out at CAB.z0)
    if (z > 7 && z < PATH_END + 2 && Math.abs(x - pathX(z)) < 2.6) continue;
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 1) continue;   // not out on the ice (they sat on it like white rocks)
    const s = 0.35 + r() * 0.9;
    drifts.push(G.mtx(x, terrainH(x, z) - 0.02, z, s * (1 + r()), s * 0.5, s * (1 + r()), r() * 6));
  }
  const dm = new THREE.InstancedMesh(shrubG, MAT.snow, drifts.length);
  drifts.forEach((m, k) => dm.setMatrixAt(k, m));
  dm.castShadow = true; dm.receiveShadow = true;
  G.fitInstanceBounds(dm);
  world.add(dm);
};

/* Peeled poles and logs, sawn at their ends (the porch, the path's fence and lanterns): pole(A, B, r0, r1, cap, out)
 * adds one from A to B, radius r0 at A and r1 at B, the wood's grain running along it (one row of TX.logs, mirrored
 * round it so there's no seam); cap 1 puts a sawn end (TX.logEnd) at A, 2 at B. build() makes them into two meshes,
 * the sides and the ends; mesh(parts, material) makes a mesh of some kept apart. tone: their shade [least, spread]
 * and tint. */
function poleSet(seed, tone = [0.74, 0.18], tint = '#ffffff', parent = world) {
  const r = G.seeded(seed), up = new THREE.Vector3(0, 1, 0), parts = [], ends = [], tc = new THREE.Color(tint);
  const sideM = G.std({ map: TX.logs, bumpMap: TX.logsB, bumpScale: 0.004, roughness: 0.85, env: 0.35, vertexColors: true });
  const endM = G.std({ map: TX.logEnd, color: '#c8c0b6', roughness: 0.92, env: 0.2, vertexColors: true });
  const pole = (A, B, r0, r1 = r0, cap = 0, out = parts, seg = 10) => {
    const a = new THREE.Vector3(...A), b = new THREE.Vector3(...B), d = b.clone().sub(a), len = d.length();
    const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, true), P = g.attributes.position, U = g.attributes.uv, row = Math.floor(r() * 7), off = r();
    for (let i = 0; i < P.count; i++) { const ang = Math.atan2(P.getX(i), P.getZ(i)); U.setXY(i, (P.getY(i) + len / 2) / 2.75 + off, (row + 0.3 + 0.4 * Math.abs(ang / Math.PI)) / 7); }
    const M = new THREE.Matrix4().makeTranslation(...a.clone().add(b).multiplyScalar(0.5).toArray())
      .multiply(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d.clone().normalize())))
      .multiply(new THREE.Matrix4().makeRotationY(r() * 6.28));
    const col = tc.clone().multiplyScalar(tone[0] + r() * tone[1]);
    out.push({ geo: g, mat: M, uv: true, color: col });
    for (const [bit, rr, y, rx] of [[1, r0, -len / 2, Math.PI / 2], [2, r1, len / 2, -Math.PI / 2]]) if (cap & bit) {
      const c = new THREE.CircleGeometry(rr * 0.96, seg); c.rotateZ(r() * 6.28); c.rotateX(rx); c.translate(0, y, 0); ends.push({ geo: c, mat: M, uv: true, color: col });
    }
  };
  const mesh = (ps, m) => { const x = new THREE.Mesh(G.merge(ps), m); x.castShadow = x.receiveShadow = true; parent.add(x); return x; };
  return { r, pole, parts, ends, sideM, endM, mesh, build: () => { if (parts.length) mesh(parts, sideM); if (ends.length) mesh(ends, endM); } };
}
G.poleSet = poleSet;
/* A rustic log bench, built into group g (its seat centred on x = 0, facing +z, the ground at y = 0): a split log for
 * the seat, planed flat on top (its top at seatY) and round underneath; four splayed pole legs; two back posts leaning
 * back a little, with a log rail across them and a thinner pole below it. len, depth: the seat's size. */
G.logBench = (g, { len, depth, seatY, seed = 5, snow = false }) => {
  const PS = poleSet(seed, [0.72, 0.2], '#ffffff', g), r = PS.r, hl = len / 2;
  const seatM = G.std({ map: TX.logs, bumpMap: TX.logsB, bumpScale: 0.003, color: '#e2cdb0', roughness: 0.8, env: 0.3 });
  G.box(len, 0.035, depth, seatM, 0, seatY - 0.0175, 0, { parent: g, uv: [len / 2.75, 0.05] });
  { // the round underside of the split log
    const R = depth / 2 * 0.96, c = new THREE.CylinderGeometry(R, R, len - 0.02, 14, 1, false, Math.PI / 2, Math.PI);
    c.rotateZ(-Math.PI / 2); c.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(c, PS.sideM); m.position.y = seatY - 0.035; m.scale.y = 0.5; m.castShadow = m.receiveShadow = true; g.add(m);
    const P = c.attributes.position, U = c.attributes.uv, C = [];
    for (let i = 0; i < P.count; i++) { U.setXY(i, P.getX(i) / 2.75, (3.3 + 0.4 * Math.abs(Math.atan2(P.getY(i), P.getZ(i)) / Math.PI)) / 7); C.push(0.82, 0.82, 0.82); }
    c.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) PS.pole([sx * (hl - 0.16), seatY - 0.06, sz * (depth / 2 - 0.07)], [sx * (hl - 0.07), -0.05, sz * (depth / 2 + 0.03)], 0.038, 0.042);
    PS.pole([sx * (hl - 0.12), -0.05, -depth / 2 + 0.02], [sx * (hl - 0.1), seatY + 0.5, -depth / 2 - 0.1], 0.042, 0.038, 2);
  }
  const zAt = (y) => -depth / 2 + 0.02 - 0.12 * ((y + 0.05) / (seatY + 0.55));   // the back posts' lean
  const yT = seatY + 0.4, yL = seatY + 0.18;
  PS.pole([-hl - 0.04, yT, zAt(yT)], [hl + 0.04, yT, zAt(yT)], 0.06, 0.058, 3);
  PS.pole([-hl + 0.06, yL, zAt(yL)], [hl - 0.06, yL, zAt(yL)], 0.032, 0.03, 3);
  PS.build();
  if (snow) {
    G.box(len * 0.55, 0.05, depth - 0.04, MAT.snow, 0.08, seatY + 0.02, 0.02, { parent: g, r: 0.02 });
    G.box(len - 0.1, 0.045, 0.08, MAT.snow, 0, yT + 0.065, zAt(yT), { parent: g, r: 0.02 });
  }
};
/* ---------------- path: fence and lanterns ---------------- */
G.PATH_LIGHTS = [];
G.buildPath = () => {
  // Post-and-rail fence down both sides: round posts, sawn off at the top under a cap of snow, and two weathered grey
  // pole rails between each pair, run on a little past the posts, each its own girth and not quite level, with a ridge
  // of snow along the top one and a thinner one along the lower. (It was square dark posts with blocks of snow on them,
  // and the rails were striped round like barber's poles.)
  const PS = poleSet(9, [0.7, 0.22], '#d6cfc6'), r = PS.r, snowP = [];
  const ridge = (A, B, w, h, lift) => {   // a ridge of snow lying along a rail from A to B
    const a = new THREE.Vector3(...A), d = new THREE.Vector3(...B).sub(a), len = d.length(); d.normalize();
    const sd = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize(), n = Math.max(2, Math.ceil(len / 0.14)), K = 6, P = [], I = [], seed = r() * 50;
    for (let i = 0; i <= n; i++) {
      const t = i / n, taper = Math.min(1, (Math.min(t, 1 - t) * len) / 0.14), hh = h * taper * (0.75 + 0.5 * (0.5 + 0.5 * G.simplex.noise(t * len * 2.2 + seed, seed))), ww = w * (0.55 + 0.45 * taper);
      for (let k = 0; k <= K; k++) { const th = (Math.PI * k) / K, p = a.clone().addScaledVector(d, t * len).addScaledVector(sd, Math.cos(th) * ww); p.y += lift + Math.sin(th) * hh; P.push(p.x, p.y, p.z); }
    }
    for (let i = 0; i < n; i++) for (let k = 0; k < K; k++) { const q = i * (K + 1) + k; I.push(q, q + K + 1, q + 1, q + 1, q + K + 1, q + K + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
    if (g.attributes.normal.getY(Math.floor(n / 2) * (K + 1) + Math.floor(K / 2)) < 0) { for (let t = 0; t < I.length; t += 3) { const x = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = x; } g.setIndex(I); g.computeVertexNormals(); }
    snowP.push({ geo: g, mat: new THREE.Matrix4(), color: new THREE.Color(1, 1, 1) });
  };
  const cap = new THREE.SphereGeometry(1, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  for (const side of [-1, 1]) {
    let prev = null;
    for (let z = 9.4; z <= PATH_END; z += 2.6) {
      const x = pathX(z) + side * 2.4, y = terrainH(x, z), top = y + 1.05 + (r() - 0.5) * 0.08, pr = 0.07 + r() * 0.015;
      PS.pole([x, y - 0.3, z], [x + (r() - 0.5) * 0.04, top, z + (r() - 0.5) * 0.04], pr * 1.08, pr, 2);
      snowP.push({ geo: cap, mat: G.mtx(x, top - 0.005, z, pr * 1.15, 0.06, pr * 1.15, r() * 6), color: new THREE.Color(1, 1, 1) });
      if (prev) {
        const dx = x - prev.x, dz = z - prev.z, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
        // You can't walk through the fence: a row of small blockers along each rail.
        for (let t = 0; t <= 1.001; t += 0.25 / len) { const cx = prev.x + dx * t, cz = prev.z + dz * t; G.COLL.push({ x0: cx - 0.09, z0: cz - 0.09, x1: cx + 0.09, z1: cz + 0.09, fence: true }); }
        for (const h of [0.42, 0.84]) {
          const rr = 0.045 + r() * 0.015, ov = 0.06 + r() * 0.08, h0 = prev.y + h + (r() - 0.5) * 0.05, h1 = y + h + (r() - 0.5) * 0.05;
          const A = [prev.x - ux * ov, h0, prev.z - uz * ov], B = [x + ux * ov, h1, z + uz * ov];
          PS.pole(A, B, rr, rr * (0.85 + r() * 0.2), 3);
          ridge(A, B, rr * 1.15, h > 0.8 ? 0.06 : 0.03, rr * 0.75);
        }
      }
      prev = { x, y, z };
    }
  }
  // Lantern bollards with warm pools of light on the snow.
  const glowTex = G.canvasTex(0, null, { w: 128, h: 128, draw: (ctx, w, h) => { const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,170,90,0.9)'); g.addColorStop(0.4, 'rgba(255,140,70,0.35)'); g.addColorStop(1, 'rgba(255,120,60,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); } });
  G.glowTex = glowTex;
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  G.poolMat = poolMat;
  // Each lantern is a small iron one, glazed on four sides under a little pyramid roof with a ring on top and a cap of
  // snow, on a stub of log. Its glass glows at night; by day it's unlit glass. (They were stacked boxes, orange all day.)
  const lanternGlass = new THREE.MeshBasicMaterial({ color: '#ffc27a' });
  lanternGlass.userData = { on: new THREE.Color('#ffc27a'), off: new THREE.Color('#4f5154') }; (G.LIT_GLASS = G.LIT_GLASS || []).push(lanternGlass);
  const iron = MAT.darkMetal, roofG = new THREE.ConeGeometry(0.15, 0.1, 4, 1); roofG.rotateY(Math.PI / 4);
  let side = -1;
  for (let z = 9.2; z <= PATH_END; z += 5.2) {
    side = -side;
    const x = pathX(z) + side * 1.65, y = terrainH(x, z), ry = r() * 0.3;
    PS.pole([x, y - 0.25, z], [x, y + 0.6, z], 0.075, 0.07, 0);
    const L = new THREE.Group(); L.position.set(x, y + 0.6, z); L.rotation.y = ry; world.add(L);
    G.box(0.17, 0.035, 0.17, iron, 0, 0.018, 0, { parent: L });
    G.box(0.12, 0.17, 0.12, lanternGlass, 0, 0.12, 0, { parent: L, cast: false });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) G.box(0.016, 0.19, 0.016, iron, sx * 0.065, 0.12, sz * 0.065, { parent: L });
    for (const sx of [-1, 1]) { G.box(0.135, 0.012, 0.012, iron, 0, 0.12, sx * 0.065, { parent: L, cast: false }); G.box(0.012, 0.012, 0.135, iron, sx * 0.065, 0.12, 0, { parent: L, cast: false }); }
    G.box(0.16, 0.02, 0.16, iron, 0, 0.215, 0, { parent: L });
    const roof = new THREE.Mesh(roofG, iron); roof.position.y = 0.27; roof.castShadow = true; L.add(roof);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 5, 10), iron); ring.position.y = 0.345; L.add(ring);
    const sn = new THREE.Mesh(cap, MAT.snow); sn.scale.set(0.115, 0.05, 0.115); sn.position.y = 0.285; L.add(sn);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), poolMat);
    pool.rotation.x = -Math.PI / 2; pool.position.set(x, y + 0.03, z); world.add(pool);
    G.PATH_LIGHTS.push({ x, y: y + 0.72, z, pool });
  }
  PS.build();
  { const m = new THREE.Mesh(G.merge(snowP), MAT.snow); m.castShadow = true; m.receiveShadow = true; world.add(m); }
};

// Soffit boards (under a roof's overhangs): tongue-and-groove running down the slope, a tile of six boards to 0.9 m.
const SOFFIT = (across, len) => {
  const m = G.std({ map: G.rep(TX.boards, across / 0.9, len / 2), color: '#9a7a5e', roughness: 0.8, env: 0.2 });
  return m;
};
/* Snow lying on a roof, built on its slab: thick and drifted across the middle, with wind ripples, rounding over each
 * verge and tucking under it, and at the eave a heavy rounded lip curling over and under the edge. (It was a white box on each slope: a plastic slab.) The slab is a
 * box `across` wide and `len` long down the slope, its top at y = top in its own frame; `down` maps (a, d, y) — across,
 * distance down from the top end, height — to that frame. Returns the points along the lip's underside (slab frame)
 * for the icicles. */
G.ROOF_SNOW = null;
function roofSnow(slab, across, len, top, down, seed = 1) {
  if (!G.ROOF_SNOW) G.ROOF_SNOW = G.std({ color: '#e8edf4', bumpMap: G.rep(TX.snowB, 1, 1), bumpScale: 0.03, roughnessMap: TX.snowR, roughness: 0.85, env: 0.7 });
  const NA = Math.max(24, Math.round(across * 9)), ND = Math.max(10, Math.round(len * 9)), NR = 9, P = [], UV = [], I = [], lip = [];
  const nz = (x, y) => G.simplex.noise(x + seed * 13.1, y - seed * 7.7);
  // The snow runs right out to the verges and a little past them, its edge rounded over and tucked back under against
  // the edge of the roof. (It stopped short of the edge in a thin wedge, leaving the roof's square edge as a dark band.)
  const ov = 0.06, fade = 0.22;
  const H = (a, d) => {   // depth of snow at (a, d)
    const e = Math.min(a, across - a) + ov;   // from the snow's edge, just past the verge
    if (e <= 0) return 0;
    const edge = Math.sqrt(Math.min(1, e / fade)) * (0.9 + 0.1 * nz(a * 3.1, d * 1.3));
    const drift = 0.2 + 0.05 * nz(a * 0.45, d * 0.6) + 0.02 * nz(a * 2.1, d * 2.7) + 0.006 * Math.sin(a * 9 + d * 2 + nz(a, d) * 2);
    const ridge = 0.55 + 0.45 * G.smooth(0, 0.5, d);   // thinner up at the ridge, under its cap
    return drift * edge * ridge;
  };
  // Columns across: closer together toward the verges, where the edge turns over; at each end two more, curling back
  // under the edge (cy: how far below the roof's top they tuck).
  const cols = [{ a: 0.004, cy: -0.05 }, { a: -ov * 0.8, cy: -0.035 }];
  for (let i = 0; i <= NA; i++) { const t = i / NA; cols.push({ a: -ov + (across + 2 * ov) * (t - (0.8 * Math.sin(2 * Math.PI * t)) / (2 * Math.PI)) }); }
  cols.push({ a: across + ov * 0.8, cy: -0.035 }, { a: across - 0.004, cy: -0.05 });
  const NC = cols.length, rows = ND + 1 + NR;
  for (let j = 0; j < rows; j++) for (const c of cols) {
    const a = c.a;
    let d, y;
    if (c.cy != null) { d = Math.min(j / ND, 1) * len; y = top + c.cy * (1 + 0.15 * nz(d * 2.3, a)); }
    else if (j <= ND) { d = (j / ND) * len; y = top + H(a, d); }
    else {   // the lip: a half-round turned over the eave, its radius from the depth there, the underside sagging in lumps
      const th = ((j - ND) / NR) * Math.PI, hE = Math.max(0, H(a, len)), R = (hE + 0.16) / 2, sag = 1 + 0.25 * Math.max(0, nz(a * 1.7, 9)) * Math.sin(th / 2);
      d = len + Math.sin(th) * R * (0.75 + 0.25 * sag); y = top + hE - R + R * Math.cos(th) * (th > Math.PI / 2 ? sag : 1);
      if (hE <= 0) { d = len; y = top - 0.01; }
      if ((j === rows - 1 || j === rows - 3) && a > 0.15 && a < across - 0.15) lip.push([a, len + R * 0.35, y]);
    }
    const q = down(a, d, y); P.push(q[0], q[1], q[2]);
    UV.push(a / 1.6, d / 1.6);
  }
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < NC - 1; i++) { const a0 = j * NC + i, a1 = a0 + NC; I.push(a0, a1, a0 + 1, a1, a1 + 1, a0 + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
  // facing up off the roof (the winding depends on how `down` turns the frame)
  const N = g.attributes.normal; let up = 0; for (let k = 0; k < N.count; k++) up += N.getY(k); if (up < 0) { for (let t = 0; t < I.length; t += 3) { const x = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = x; } g.setIndex(I); g.computeVertexNormals(); }
  const m = new THREE.Mesh(g, G.ROOF_SNOW); m.castShadow = true; m.receiveShadow = true; slab.add(m);
  return lip.filter((q) => q[2] > top - 0.2).map((q) => down(q[0], q[1], q[2] - 0.02));
}
/* The cabin's log walls (their map's UVs run along the wall and up it, seven logs to a tile): each log lit as a
 * round log, its top turned to the sky and its underside away, darkening into the joints; the chinking between them a
 * recessed grey mortar of uneven width, shadowed under the log above; the lines between the logs wavering a little,
 * as real logs do; and each log its own tone. */
G.logWall = (m) => {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = `
      float lgH(float n) { return fract(sin(n * 127.1 + 1.7) * 43758.5453); }
      float lgN(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(lgH(i), lgH(i + 1.0), f) * 2.0 - 1.0; }
    ` + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        float lgY = vUv.y * 7.0, lgU = vUv.x * 2.75, lgK = floor(lgY);
        float lgWv = mix(lgN(lgU * 0.9 + lgK * 7.13), lgN(lgU * 0.9 + (lgK + 1.0) * 7.13), smoothstep(0.0, 1.0, fract(lgY))) * 0.045;
        float lgYs = lgY - lgWv, lgF = fract(lgYs), lgR = floor(lgYs);
        float lgCb = 0.034 + 0.014 * lgN(lgU * 2.1 + lgR * 3.31), lgCt = 0.034 + 0.014 * lgN(lgU * 2.1 + (lgR + 1.0) * 3.31);
        float lgT = (lgF - lgCb) / (1.0 - lgCb - lgCt);
        float lgIn = step(0.0, lgT) * step(lgT, 1.0);
        float lgAA = fwidth(lgYs) * 1.5;
        float lgLog = smoothstep(-lgAA, lgAA, lgF - lgCb) * smoothstep(-lgAA, lgAA, (1.0 - lgCt) - lgF);
        {
          // the log: its own tone along it and row to row, darkening into the joints
          float tone = 0.86 + 0.26 * lgH(lgR * 3.7 + 11.0) + 0.06 * lgN(lgU * 0.7 + lgR * 5.1);
          float ao = mix(0.62, 1.0, smoothstep(0.0, 0.2, min(lgT, 1.0 - lgT)));
          // the chinking: grey mortar, darker toward its top, in the shadow of the log over it
          float q = lgF > 0.5 ? (lgF - (1.0 - lgCt)) / (lgCt * 2.0) : 0.5 + lgF / (lgCb * 2.0);
          vec3 mortar = vec3(0.34, 0.32, 0.29) * (0.85 + 0.15 * lgN(lgU * 9.0 + lgR)) * (1.0 - 0.5 * smoothstep(0.35, 1.0, q));
          diffuseColor.rgb = mix(mortar, diffuseColor.rgb * tone * ao, lgLog);
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 lgUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          float lgV = dot(lgUp, normal);
          if (abs(lgV) < 0.6) {
            vec3 lgP = normalize(lgUp - normal * lgV);
            float a = (clamp(lgT, 0.0, 1.0) - 0.5) * 1.9 * lgLog;   // up to 55 degrees toward the sky at its top, away at its bottom
            normal = normalize(normal * cos(a) + lgP * sin(a));
          }
        }`);
  };
  m.customProgramCacheKey = () => 'log-wall';
  m.envMapIntensity = 0.26;   // weathered wood: the sky only sheens on it (turned up to the sky, the logs' tops shone silver)
  m.extensions = Object.assign({}, m.extensions, { derivatives: true });
  m.needsUpdate = true;
  return m;
};
/* ---------------- cabin ---------------- */
const WT = 0.22; // wall thickness
function wallMats(inner) {
  // Box face order: +x, -x, +y, -y, +z, -z
  const L = MAT.logsW, Bd = MAT.boardsW;
  return { '+x': [Bd, L, L, L, L, L], '-x': [L, Bd, L, L, L, L], '+z': [L, L, L, L, Bd, L], '-z': [L, L, L, L, L, Bd], none: [L, L, L, L, L, L] }[inner];
}
function wallSeg(axis, c, a, b, y0, y1, inner, mats) {
  const len = b - a, h = y1 - y0;
  if (len < 0.01 || h < 0.01) return;
  const geo = axis === 'x' ? new THREE.BoxGeometry(len, h, WT) : new THREE.BoxGeometry(WT, h, len);
  const uv = geo.attributes.uv, P = geo.attributes.position, N = geo.attributes.normal;
  // UVs from world position on the two big faces, so the boards above and below a window line up with the ones
  // beside it (each piece used to start its own boards at 0).
  const mid = (a + b) / 2, ym = (y0 + y1) / 2;
  for (let i = 0; i < uv.count; i++) {
    const n = axis === 'x' ? N.getZ(i) : N.getX(i);
    if (Math.abs(n) > 0.5) {
      const along = (axis === 'x' ? P.getX(i) : P.getZ(i)) + mid;
      // (the end walls' logs sit half a log higher than the front and back walls', as they do where notched logs cross)
      uv.setXY(i, (n > 0 === (axis === 'x') ? along : -along) / 2.75, (P.getY(i) + ym + (axis === 'z' ? 2.75 / 14 : 0)) / 2.75);
    } else uv.setXY(i, uv.getX(i) * len / 2.75, uv.getY(i) * h / 2.75);
  }
  const m = G.add(new THREE.Mesh(geo, mats || wallMats(inner)), world);
  if (axis === 'x') m.position.set((a + b) / 2, (y0 + y1) / 2, c); else m.position.set(c, (y0 + y1) / 2, (a + b) / 2);
  G.CAMBLOCK.push(m);
  if (y0 <= 0.01) {
    if (axis === 'x') G.COLL.push({ x0: a, z0: c - WT / 2 - 0.04, x1: b, z1: c + WT / 2 + 0.04 });
    else G.COLL.push({ x0: c - WT / 2 - 0.04, z0: a, x1: c + WT / 2 + 0.04, z1: b });
  }
}
function wall(axis, c, a, b, holes, inner, top, mats) {
  let p = a;
  holes.slice().sort((h1, h2) => h1.a - h2.a).forEach((h) => {
    wallSeg(axis, c, p, h.a, -0.4, top, inner, mats);
    wallSeg(axis, c, h.a, h.b, -0.4, h.y0, inner, mats);
    wallSeg(axis, c, h.a, h.b, h.y1, top, inner, mats);
    p = h.b;
  });
  wallSeg(axis, c, p, b, -0.4, top, inner, mats);
}
function windowAt(axis, c, a, b, y0, y1, outward, fw = 0.07) {
  const mid = (a + b) / 2, w = b - a, h = y1 - y0, d = WT + 0.06, mw = fw * 0.64;
  const T = MAT.trim;
  const put = (sx, sy, sz, x, y, z) => (axis === 'x' ? G.box(sx, sy, sz, T, x, y, z) : G.box(sz, sy, sx, T, z, y, x));
  // frame (x-aligned coordinates, swapped for z walls)
  put(w + fw * 2, fw, d, mid, y1 + fw / 2, c); put(w + fw * 2 + 0.1, fw, d + 0.12, mid, y0 - fw / 2, c);
  put(fw, h, d, a - fw / 2, (y0 + y1) / 2, c); put(fw, h, d, b + fw / 2, (y0 + y1) / 2, c);
  put(mw, h, d * 0.5, mid, (y0 + y1) / 2, c); put(w, mw, d * 0.5, mid, y0 + h * 0.55, c);
  // snow on the outside sill
  const sill = axis === 'x' ? G.box(w + 0.2, 0.06, 0.16, MAT.snow, mid, y0 - 0.005, c + outward * 0.18, { r: 0.025 }) : G.box(0.16, 0.06, w + 0.2, MAT.snow, c + outward * 0.18, y0 - 0.005, mid, { r: 0.025 });
  // glass: warm glow outward, dark night inward
  // Each pane carries its size in metres and a seed of its own (for the glass shaders: ripples, tilt, frost).
  const seed = Math.floor(((Math.abs(Math.sin(mid * 12.9898 + c * 78.233)) * 43758.5453) % 1) * 997);
  const pane = (mat, off, flip) => {
    const g = new THREE.PlaneGeometry(w, h), sz = [];
    for (let i = 0; i < g.attributes.position.count; i++) sz.push(w, h, seed);
    g.setAttribute('gsz', new THREE.Float32BufferAttribute(sz, 3));
    // The inner face looks the other way, so mirror its u: the frost then lies in the same place seen from either side.
    if (mat === MAT.glassIn) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
    const m = new THREE.Mesh(g, mat);
    if (axis === 'x') { m.position.set(mid, (y0 + y1) / 2, c + off); m.rotation.y = flip ? Math.PI : 0; }
    else { m.position.set(c + off, (y0 + y1) / 2, mid); m.rotation.y = flip ? -Math.PI / 2 : Math.PI / 2; }
    m.renderOrder = 3; world.add(m); return m;
  };
  // The outer pane gets a material of its own: it reflects its own cube map of what is in front of it (see below).
  const gm = G.glassOutSetup(MAT.glassOut.clone()); G.MATS.push(gm);
  const out = pane(gm, outward * 0.012, outward < 0);
  const inn = pane(MAT.glassIn, -outward * 0.012, outward > 0);
  if (axis === 'z') { out.rotation.y = outward > 0 ? Math.PI / 2 : -Math.PI / 2; inn.rotation.y = outward > 0 ? -Math.PI / 2 : Math.PI / 2; }
  G.WINDOWS.push({ out, inn });
  G.CAMBLOCK.push(out, inn);
  return sill;
}
/* The study: a log lean-to on the east wall, reached by a door in the kitchen that is always locked. */
function signTex() {
  return G.canvasTex(0, null, { w: 256, h: 192, draw: (c, w, h) => {
    c.fillStyle = '#f3ecdc'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(80,60,40,0.25)'; c.lineWidth = 2; c.strokeRect(6, 6, w - 12, h - 12);
    c.save(); c.translate(w / 2, h * 0.42); c.rotate(-0.05);
    c.fillStyle = '#b8322a'; c.font = 'bold 54px "Comic Sans MS", "Marker Felt", cursive'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'bold 50px "Comic Sans MS", "Marker Felt", cursive'; c.fillText('PRIVATE', 0, 0); c.restore();
    c.fillStyle = '#3a3a48'; c.font = '19px "Comic Sans MS", cursive'; c.textAlign = 'center'; c.fillText('(this means you, Partner)', w / 2, h - 26);
  } });
}
// Inside the study window: a pair of curtains drawn across, almost meeting, and behind them the room, dark by day and
// lamplit at night, so a line of warm light shows where they don't quite close. (The glass's own glow is the lamp's
// light on it.) G.STUDY_LIGHT(n, d) is called with the night and the daylight as they change.
function studyCurtain(x0, x1, y0, y1, zi) {
  const w = x1 - x0 + 0.2, h = y1 - y0 + 0.2, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const fab = G.std({ map: TX.knitCream, color: '#8f4a36', roughness: 1, emissive: '#ff9852', emissiveMap: TX.knitCream, emissiveIntensity: 0 });
  const glowTex = G.canvasTex(0, (u, v) => { const r = Math.hypot(u - 0.62, (v - 0.4) * 1.2), k = Math.max(0, 1 - r * 1.6); const c = 70 + 185 * k * k; return [c, c * 0.72, c * 0.46]; }, { w: 64, h: 64 });
  const room = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: glowTex, color: '#000000', fog: true }));
  room.position.set(mx, my, zi - 0.12); world.add(room);
  const gap = 0.018, pw = w / 2 - gap / 2 + 0.1;
  for (const sd of [-1, 1]) {
    const g = new THREE.PlaneGeometry(pw, h, 10, 4), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i) / pw + 0.5; p.setZ(i, Math.sin(u * Math.PI * 5 + sd) * 0.012); }
    g.computeVertexNormals();
    // (meeting off-centre, clear of the glazing bar)
    const c = new THREE.Mesh(g, fab); c.position.set(mx + sd * (gap / 2 + pw / 2) + 0.1, my, zi - 0.045); c.receiveShadow = true; world.add(c);
  }
  const warm = new THREE.Color('#ffb070'), dim = new THREE.Color('#0c0907');
  G.STUDY_LIGHT = (n, d) => { const k = 1 - d; fab.emissiveIntensity = 0.32 * k; room.material.color.copy(dim).lerp(warm, k); };
}
function buildAnnex() {
  const A = ANNEX, h0 = 2.55, h1 = 2.05, cx = (A.x0 + A.x1) / 2, cz = (A.z0 + A.z1) / 2;
  G.box(A.x1 - A.x0 + 0.3, 0.4, A.z1 - A.z0 + 0.3, MAT.stone, cx, -0.2, cz, { uv: [1, 0.3], cast: false });
  const L = G.logWall(MAT.logs.clone()); L.map = G.rep(TX.logs, 1 / 2.75, 1 / 2.75); L.bumpMap = G.rep(TX.logsB, 1 / 2.75, 1 / 2.75); G.MATS.push(L);
  // Side walls follow the roof line: tall against the cabin, lower at the far end.
  const sh = new THREE.Shape(); sh.moveTo(A.x0, -0.4); sh.lineTo(A.x1 + WT / 2, -0.4); sh.lineTo(A.x1 + WT / 2, h1); sh.lineTo(A.x0, h0); sh.closePath();
  // A little window in the wall facing the yard, warm at night: somebody is always "just doing something" in here.
  // (It was a cream rectangle stuck on the outside of the logs, glowing the same by day as by night.) Now it's a real
  // window like the cabin's, framed and glazed, the old glass reflecting the yard by day, set into the wall with a
  // curtain drawn across it inside, and a lamp behind the curtain at night.
  const WX0 = cx - 0.05, WX1 = cx + 0.45, WY0 = 1.09, WY1 = 1.51;
  for (const z of [A.z0, A.z1]) {
    let s = sh;
    if (z === A.z1) { s = sh.clone(); const hole = new THREE.Path(); hole.moveTo(WX0, WY0); hole.lineTo(WX1, WY0); hole.lineTo(WX1, WY1); hole.lineTo(WX0, WY1); hole.closePath(); s.holes.push(hole); }
    const m = G.add(new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: WT, bevelEnabled: false }), L), world); m.position.z = z - WT / 2; G.CAMBLOCK.push(m);
  }
  G.CAMBLOCK.push(G.box(WT, h1 + 0.4, A.z1 - A.z0 + WT, L, A.x1, (h1 - 0.4) / 2, cz, { uv: [A.z1 - A.z0 + WT, h1 + 0.4] }));
  windowAt('x', A.z1, WX0, WX1, WY0, WY1, 1, 0.05);   // (a slimmer frame: it's a small window)
  G.WINDOWS[G.WINDOWS.length - 1].study = true;   // (not one to stand and look out of: it's in a room nobody goes into)
  studyCurtain(WX0, WX1, WY0, WY1, A.z1 - WT / 2);
  // Shed roof falling away from the cabin, with snow.
  const run = A.x1 - A.x0 + 0.6, slope = Math.atan2(h0 - h1, run), len = Math.hypot(run, h0 - h1);
  const roof = G.box(len, 0.12, A.z1 - A.z0 + 0.7, MAT.shingle, cx + 0.15, (h0 + h1) / 2 + 0.12, cz, { uv: [1, 1] });
  roof.rotation.z = -slope; G.CAMBLOCK.push(roof);
  { const aw = A.z1 - A.z0 + 0.7; roofSnow(roof, aw, len, 0.06, (a, d, y) => [d - len / 2, y, a - aw / 2], 5);
    for (const sz of [-1, 1]) G.box(len + 0.035, 0.16, 0.035, MAT.trim, 0.0175, -0.03, sz * (aw / 2 + 0.018), { parent: roof });
    G.box(0.035, 0.15, aw + 0.07, MAT.trim, len / 2 + 0.018, -0.03, 0, { parent: roof });
    const sof = new THREE.Mesh(new THREE.PlaneGeometry(aw, len), SOFFIT(aw, len)); sof.rotation.x = Math.PI / 2; sof.rotation.z = Math.PI / 2; sof.position.y = -0.061; sof.receiveShadow = true; roof.add(sof); }
  G.COLL.push({ x0: CAB.x1 + 0.05, z0: A.z0 - 0.15, x1: A.x1 + 0.15, z1: A.z1 + 0.15 });
  // The door, from the kitchen side: closed, with the sign.
  const dz = 3.85;
  G.box(WT * 0.6, 2.0, 0.88, MAT.darkWood, CAB.x1, 1.0, dz);
  G.box(0.06, 0.08, 1.04, MAT.trim, CAB.x1 - WT / 2, 2.07, dz); for (const s of [-1, 1]) G.box(0.06, 2.05, 0.07, MAT.trim, CAB.x1 - WT / 2, 1.02, dz + s * 0.49);
  G.sph(0.03, MAT.metal, CAB.x1 - WT / 2 - 0.03, 1.0, dz - 0.32);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.255), G.std({ map: signTex(), roughness: 0.85 }));
  sign.position.set(CAB.x1 - WT / 2 - 0.012, 1.48, dz); sign.rotation.set(0, -Math.PI / 2, 0.04); world.add(sign);
  G.STUDY_DOOR = { x: CAB.x1 - 0.5, z: dz };
}
G.WINDOWS = [];
/* Window reflections by day (the glass shader is G.glassOutSetup in core.js). Each window keeps a small cube map of
 * the world as seen from just outside its glass: the sky, the forest across the clearing, the porch posts, the yard.
 * When the light has changed since it was drawn and the camera is outdoors by day, its faces are redrawn one a frame,
 * nearest window first (the face looking into the wall is never seen, so it's skipped). Characters, falling snow,
 * smoke and the glass itself are left out of it: they move, and the reflection doesn't. */
const GLASS = { hide: [] };
function glassCube(w) {
  const p = new THREE.Vector3(), q = new THREE.Quaternion();
  w.out.getWorldPosition(p); w.out.getWorldQuaternion(q);
  const nrm = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  w.rt = new THREE.WebGLCubeRenderTarget(G.Q.glass || 256, { format: THREE.RGBAFormat, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  w.cam = new THREE.CubeCamera(0.1, 400, w.rt);
  w.cam.position.copy(p).addScaledVector(nrm, 0.3); w.cam.updateMatrixWorld(true);
  const ax = Math.abs(nrm.x) > Math.abs(nrm.z) ? 0 : 4;
  w.skip = ax + ((ax === 0 ? nrm.x : nrm.z) > 0 ? 1 : 0);   // the face looking back into the wall
  w.out.material.userData.U.uGCube.value = w.rt.texture;
  w.key = null; w.todo = []; w.ready = false;
}
function glassFace(w, f) {
  const R = G.renderer, prev = R.getRenderTarget(), au = R.shadowMap.autoUpdate;
  const hide = GLASS.hide; hide.length = 0;
  for (const o of G.scene.children) if (o.visible && (o.isPoints || o.isSprite || (o.userData && o.userData.hips))) { o.visible = false; hide.push(o); }
  for (const v of G.WINDOWS) { v.out.visible = false; v.inn.visible = false; }
  R.shadowMap.autoUpdate = false;   // the shadow maps from this frame still hold
  R.setRenderTarget(w.rt, f); R.clear(); R.render(G.scene, w.cam.children[f]);
  R.setRenderTarget(prev); R.shadowMap.autoUpdate = au;
  for (const v of G.WINDOWS) { v.out.visible = true; v.inn.visible = true; }
  for (const o of hide) o.visible = true;
}
G.glassCapture = (dt, force) => {
  if (!G.WINDOWS.length) return;
  const key = G.glassLightKey, day = MAT.glassOut.userData.U.uGDay.value, cp = G.camera.position;
  for (const w of G.WINDOWS) {
    if (!w.rt) glassCube(w);
    const U = w.out.material.userData.U; U.uGHave.value = Math.min(w.ready ? 1 : 0, U.uGHave.value + dt * 2.5);
    if (w.key !== key) { w.key = key; w.todo = [0, 1, 2, 3, 4, 5].filter((f) => f !== w.skip); }
  }
  if (!force && (day < 0.05 || G.inside(cp.x, cp.z))) return;
  for (;;) {
    let best = null, bd = 1e9;
    for (const w of G.WINDOWS) { if (!w.todo.length) continue; const d = w.cam.position.distanceTo(cp); if (d < bd && (force || d < 45)) { bd = d; best = w; } }
    if (!best) return;
    glassFace(best, best.todo.shift());
    if (!best.todo.length) best.ready = true;
    if (!force) return;
  }
};
G.buildCabin = () => {
  MAT.logsW = G.logWall(MAT.logs.clone()); G.MATS.push(MAT.logsW); MAT.boardsW = MAT.boards;
  const { x1, z1, z0, eave } = CAB, D = z1 - z0, zc = (z0 + z1) / 2;
  // Foundation
  G.box(x1 + 0.5, 0.45, D + 0.5, MAT.stone, x1 / 2, -0.235, zc, { uv: [4, 0.5], cast: false });   // top just under the floorboards (it used to cover them)
  // Floor & ceiling
  const fl = G.add(new THREE.Mesh(new THREE.PlaneGeometry(x1, D), MAT.floor), world, false, true);
  fl.rotation.x = -Math.PI / 2; fl.position.set(x1 / 2, 0.002, zc);
  const fuv = fl.geometry.attributes.uv; for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * x1 / 2.4, fuv.getY(i) * D / 2.4);
  const ce = G.add(new THREE.Mesh(new THREE.PlaneGeometry(x1, D), MAT.ceiling), world, false, true);
  ce.rotation.x = Math.PI / 2; ce.position.set(x1 / 2, CAB.wallH, zc); G.CAMBLOCK.push(ce);
  const cuv = ce.geometry.attributes.uv; for (let i = 0; i < cuv.count; i++) cuv.setXY(i, cuv.getX(i) * x1 / 2.75, cuv.getY(i) * D / 2.75);
  for (let x = 0.9; x < x1; x += 1.55) G.box(0.16, 0.2, D, MAT.beam, x, CAB.wallH - 0.1, zc, { cast: false });
  // The bedroom's back wall, behind the bed, painted (a board wall of its own, just in front of the pine).
  { const pw = new THREE.Mesh(new THREE.PlaneGeometry(4.78, CAB.wallH), MAT.paintedBoards);
    const puv = pw.geometry.attributes.uv; for (let i = 0; i < puv.count; i++) puv.setXY(i, puv.getX(i) * 4.78 / 2.75, puv.getY(i) * CAB.wallH / 2.75);
    pw.position.set(0.11 + 4.78 / 2, CAB.wallH / 2, z0 + 0.113); G.add(pw, world, false, true); }
  // ...and the kitchen's back wall, round the window over the sink, a soft sage.
  { const sh = new THREE.Shape(); sh.moveTo(11.11, 0); sh.lineTo(x1 - 0.11, 0); sh.lineTo(x1 - 0.11, CAB.wallH); sh.lineTo(11.11, CAB.wallH); sh.lineTo(11.11, 0);
    const hole = new THREE.Path(); hole.moveTo(12.45, 1.15); hole.lineTo(12.45, 2.0); hole.lineTo(13.65, 2.0); hole.lineTo(13.65, 1.15); hole.lineTo(12.45, 1.15); sh.holes.push(hole);
    const km = MAT.paintedBoards.clone(); km.map = G.rep(TX.paintBoards, 1 / 2.75, 1 / 2.75); km.bumpMap = G.rep(TX.wallBoardsB, 1 / 2.75, 1 / 2.75); km.color.set('#97a284'); G.MATS && G.MATS.push(km);
    const kw = new THREE.Mesh(new THREE.ShapeGeometry(sh), km); kw.position.z = z0 + 0.113; G.add(kw, world, false, true); }
  // Walls (outer log face, inner boards).
  const W_win = { bedS: { a: 1.6, b: 3.2 }, livS1: { a: 8.6, b: 10.2 }, door: { a: 6.0, b: 7.0 } };
  // Back wall: a window over the kitchen sink, and one in the reading nook.
  wall('x', z0 - WT / 2 + 0.11, -0.11, x1 + 0.11, [{ a: 9.45, b: 10.65, y0: 0.75, y1: 1.95 }, { a: 12.45, b: 13.65, y0: 1.15, y1: 2.0 }], '+z', eave);
  wall('x', z1 + WT / 2 - 0.11, -0.11, x1 + 0.11, [{ a: 1.6, b: 3.2, y0: 0.85, y1: 2.05 }, { a: 8.6, b: 10.2, y0: 0.85, y1: 2.05 }, { a: 6.0, b: 7.0, y0: -0.4, y1: 2.12 }, { a: 12.2, b: 13.8, y0: 0.85, y1: 2.05 }], '-z', eave);
  wall('z', -WT / 2 + 0.11, z0, z1, [{ a: -0.9, b: 0.6, y0: 0.85, y1: 2.05 }], '+x', eave);
  wall('z', x1 + WT / 2 - 0.11, z0, z1, [{ a: 1.4, b: 2.8, y0: 0.85, y1: 2.05 }, { a: 3.4, b: 4.3, y0: -0.4, y1: 2.05 }], '-x', eave);
  // Interior partition (boards both sides).
  const P2 = [MAT.boards, MAT.boards, MAT.boards, MAT.boards, MAT.boards, MAT.boards];
  wall('z', 5, z0 + 0.11, z1 - 0.11, [{ a: 3.0, b: 4.0, y0: -0.4, y1: 2.12 }], 'none', CAB.wallH, P2);
  wall('z', 11, z0 + 0.11, z1 - 0.11, [{ a: 1.5, b: 2.6, y0: -0.4, y1: 2.12 }], 'none', CAB.wallH, P2);   // living room | kitchen
  for (const [zz, xx] of [[1.5, 11], [2.6, 11]]) G.box(0.26, 2.12, 0.07, MAT.trim, xx, 1.06, zz);
  G.box(0.26, 0.08, 1.24, MAT.trim, 11, 2.16, 2.05);
  windowAt('x', z1, 1.6, 3.2, 0.85, 2.05, 1);
  windowAt('x', z1, 8.6, 10.2, 0.85, 2.05, 1);
  windowAt('z', 0, -0.9, 0.6, 0.85, 2.05, -1);
  windowAt('x', z0, 9.45, 10.65, 0.75, 1.95, -1);   // the reading nook
  windowAt('x', z0, 12.45, 13.65, 1.15, 2.0, -1);    // over the sink
  windowAt('x', z1, 12.2, 13.8, 0.85, 2.05, 1);
  windowAt('z', x1, 1.4, 2.8, 0.85, 2.05, 1);
  buildAnnex();
  // Door frame + open door leaf (hinged at x = 6.0, swung inward).
  const T = MAT.trim;
  G.box(1.16, 0.1, WT + 0.08, T, 6.5, 2.17, z1); G.box(0.08, 2.12, WT + 0.08, T, 5.96, 1.06, z1); G.box(0.08, 2.12, WT + 0.08, T, 7.04, 1.06, z1);
  const leaf = new THREE.Group(); leaf.position.set(6.04, 0, z1 - 0.08); leaf.rotation.y = 0; world.add(leaf);
  leaf.userData.dynamic = true;   // closed against the cold; swings open as someone comes near (game.js)
  G.FRONT_DOOR = { leaf, openAngle: -1.75, amt: 0, want: 0, x: 6.5, z: z1 };
  // The door itself: planks painted barn red, ledged and braced on the inside, hung on black iron strap hinges with a
  // thumb latch, and a wreath of evergreen, cones and berries outside under a red bow. (It was a dark slab with a
  // brass ball for a knob.)
  {
    const grain = G.canvasTex(256, (u, v) => { const t = 0.86 + Math.sin(u * 300 + G.fbm(u * 4, v * 1.2, 3) * 20) * 0.04 + G.fbm(u * 30, v * 2, 2) * 0.07 + (G.fbm(u * 3, v * 0.5, 2) - 0.5) * 0.08; return [230 * t, 224 * t, 216 * t]; });
    const red = G.std({ map: grain, color: '#8c3a2c', roughness: 0.6, env: 0.25 }), ironB = G.shared({ color: '#1d1b1a', roughness: 0.55, metalness: 0.6, env: 0.4 });
    const L = (w, h, d, m, x, y, z, o = {}) => G.box(w, h, d, m, x, y, z, { parent: leaf, ...o });
    L(0.93, 2.06, 0.012, G.shared({ color: '#2a1612', roughness: 1 }), 0.47, 1.04, 0, { cast: false });   // behind the joints
    for (let i = 0; i < 6; i++) L(0.94 / 6 - 0.006, 2.08, 0.045, red, (0.94 / 6) * (i + 0.5), 1.04, 0, { r: 0.004, uv: [0.25, 1] });
    // inside: three ledges and the braces between them, running up from the hinge side
    const ly = [0.26, 1.04, 1.84];
    for (const y of ly) L(0.84, 0.12, 0.022, red, 0.47, y, -0.0335, { r: 0.004 });
    for (let k = 0; k < 2; k++) {
      const x0 = 0.1, y0 = ly[k] + 0.07, x1 = 0.84, y1 = ly[k + 1] - 0.07, len = Math.hypot(x1 - x0, y1 - y0);
      L(0.11, len, 0.022, red, (x0 + x1) / 2, (y0 + y1) / 2, -0.0335, { r: 0.004 }).rotation.z = -Math.atan2(x1 - x0, y1 - y0);
    }
    // outside: strap hinges with spear tips and nail heads
    for (const y of [0.36, 1.72]) {
      L(0.62, 0.036, 0.006, ironB, 0.31, y, 0.0255);
      L(0.05, 0.05, 0.006, ironB, 0.63, y, 0.0255).rotation.z = Math.PI / 4;
      for (const x of [0.08, 0.24, 0.4, 0.56]) G.sph(0.006, ironB, x, y, 0.029, [1, 1, 0.6], leaf, 6);
    }
    // the thumb latch: a grip on a backplate outside, the bar and a slide bolt inside
    L(0.04, 0.3, 0.006, ironB, 0.84, 1.02, 0.0255, { r: 0.008 });
    const grip = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.009, 6, 14, Math.PI), ironB); grip.rotation.set(0, Math.PI / 2, Math.PI / 2); grip.position.set(0.84, 1.0, 0.03); grip.scale.set(1, 1, 0.5); leaf.add(grip);
    L(0.025, 0.012, 0.05, ironB, 0.84, 1.13, 0.05);   // the thumb press
    L(0.24, 0.016, 0.008, ironB, 0.8, 1.13, -0.027); L(0.03, 0.06, 0.012, ironB, 0.68, 1.13, -0.029);
    L(0.14, 0.03, 0.01, ironB, 0.82, 1.5, -0.028); G.sph(0.012, ironB, 0.79, 1.5, -0.04, [1, 1, 1], leaf, 8);
    // the wreath
    const needles = G.canvasTex(0, null, { w: 128, h: 64, draw: (c, w, h) => {
      c.fillStyle = '#24391f'; c.fillRect(0, 0, w, h); const r = G.seeded(9);
      for (let i = 0; i < 900; i++) { const x = r() * w, y = r() * h, a = r() * Math.PI, l = 3 + r() * 5; c.strokeStyle = ['#2f4a2a', '#3d5c34', '#1c2d18', '#4a6a3e'][Math.floor(r() * 4)]; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
    } });
    const wg = new THREE.TorusGeometry(0.17, 0.05, 10, 40), WP = wg.attributes.position, WN = wg.attributes.normal;
    for (let i = 0; i < WP.count; i++) { const d = 0.018 * (G.fbm(WP.getX(i) * 30 + 2, WP.getY(i) * 30 + WP.getZ(i) * 20, 2) - 0.3) + 0.01 * Math.sin(i * 7.3); WP.setXYZ(i, WP.getX(i) + WN.getX(i) * d, WP.getY(i) + WN.getY(i) * d, WP.getZ(i) + WN.getZ(i) * d); }
    wg.computeVertexNormals();
    const wr = new THREE.Group(); wr.position.set(0.47, 1.45, 0.075); wr.scale.set(1, 1, 0.55); leaf.add(wr);
    const ring = new THREE.Mesh(wg, G.std({ map: needles, roughness: 0.9, env: 0.15 })); ring.castShadow = true; wr.add(ring);
    const cone = G.std({ color: '#2e1e12', roughness: 1, env: 0.05 }), berry = G.std({ color: '#7a0f18', roughness: 0.35, env: 0.3 }), rr = G.seeded(31);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.4, c = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.05, 7), cone); c.position.set(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0.05); c.rotation.z = a + Math.PI / 2 + (rr() - 0.5); wr.add(c); }
    for (let i = 0; i < 16; i++) { const a = rr() * Math.PI * 2, d = 0.17 + (rr() - 0.5) * 0.06; G.sph(0.011, berry, Math.cos(a) * d, Math.sin(a) * d, 0.055 + rr() * 0.01, [1, 1, 1], wr, 8); }
    const bowM = G.std({ color: '#6e1018', roughness: 0.6, env: 0.15 });
    for (const k of [-1, 1]) {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 6, 14), bowM); loop.position.set(k * 0.04, 0.2, 0.06); loop.scale.set(1.2, 0.8, 0.5); loop.rotation.z = k * 0.3; wr.add(loop);
      const tail = G.box(0.025, 0.11, 0.006, bowM, k * 0.025, 0.13, 0.065, { parent: wr }); tail.rotation.z = k * 0.35;
    }
    G.sph(0.016, bowM, 0, 0.2, 0.068, [1.2, 1, 0.8], wr, 10);
  }
  // The corners: where the walls meet, each wall's logs run on past the other's and stop, crossing, stacked alternately
  // (the end walls' logs half a log higher), so each face of a corner is a column of sawn ends between the sides of the
  // logs going the other way. Each log its own girth, length and tone, its end slightly chamfered and sawn, the end
  // grain pale and weathered (TX.logEnd). (They were a few thin cylinders with the wall's stripes wrapped round them
  // like rings, and dark discs on their ends that looked like holes.)
  {
    const rr = G.seeded(77), sides = [], ends = [], up = new THREE.Vector3(0, 1, 0);
    const sideM = G.std({ map: TX.logs, bumpMap: TX.logsB, bumpScale: 0.006, roughness: 0.85, env: 0.4, vertexColors: true });
    const endM = G.std({ map: TX.logEnd, color: '#d2cbc2', roughness: 0.92, env: 0.25, vertexColors: true });
    const ROW = 2.75 / 7;
    for (const [X, Z] of [[0, z0], [x1, z0], [0, z1], [x1, z1]]) {
      const ox = X < 5 ? -1 : 1, oz = Z < zc ? -1 : 1;
      for (const alongX of [true, false]) {
        for (let k = 0; k < 8; k++) {
          const y = alongX ? ROW * (k + 0.5) : ROW * k;
          if (y < 0.15 || y > eave - 0.1) continue;
          const r = 0.175 + rr() * 0.02, out = 0.11 + 0.24 + rr() * 0.1, len = out + 0.06, ch = 0.022;
          const tone = new THREE.Color(1, 1, 1).multiplyScalar(0.86 + rr() * 0.26);
          // local +y runs from just inside the corner out past the far face
          const pts = [new THREE.Vector2(r, 0), new THREE.Vector2(r, len - ch), new THREE.Vector2(r * 0.93, len)];
          const g = new THREE.LatheGeometry(pts, 14), P = g.attributes.position, U = g.attributes.uv, row = Math.floor(rr() * 7);
          // the wood's grain along the log (one row of TX.logs, mirrored round it so there's no seam), not round it
          for (let i = 0; i < P.count; i++) { const ang = Math.atan2(P.getX(i), P.getZ(i)); U.setXY(i, P.getY(i) / 2.75 + row * 0.37, (row + 0.3 + 0.4 * Math.abs(ang / Math.PI)) / 7); }
          const cap = new THREE.CircleGeometry(r * 0.93, 14); cap.rotateZ(rr() * 6.28); cap.rotateX(-Math.PI / 2); cap.translate(0, len, 0);
          const M = new THREE.Matrix4().makeTranslation(alongX ? X - ox * 0.06 : X, y, alongX ? Z : Z - oz * 0.06)
            .multiply(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(alongX ? ox : 0, 0, alongX ? 0 : oz))))
            .multiply(new THREE.Matrix4().makeRotationY(rr() * 6.28));
          sides.push({ geo: g, mat: M, uv: true, color: tone });
          ends.push({ geo: cap, mat: M, uv: true, color: tone.clone().multiplyScalar(0.95 + rr() * 0.1) });
        }
      }
    }
    for (const [parts, m] of [[sides, sideM], [ends, endM]]) { const mesh = new THREE.Mesh(G.merge(parts), m); mesh.castShadow = true; mesh.receiveShadow = true; world.add(mesh); }
  }
  // Gable ends (east and west).
  const gableShape = new THREE.Shape();
  gableShape.moveTo(z0 - 0.11, eave); gableShape.lineTo(z1 + 0.11, eave); gableShape.lineTo(CAB.ridgeZ, CAB.ridge + 0.02); gableShape.closePath();
  const gMat = G.logWall(MAT.logs.clone()); gMat.map = G.rep(TX.logs, 1 / 2.75, 1 / 2.75); gMat.bumpMap = G.rep(TX.logsB, 1 / 2.75, 1 / 2.75); G.MATS.push(gMat);
  gMat.map.offset.y = 1 / 14;   // (in line with the end walls under them)
  for (const x of [-0.11, x1 + 0.11]) {
    const g = new THREE.ExtrudeGeometry(gableShape, { depth: WT, bevelEnabled: false });
    const m = G.add(new THREE.Mesh(g, gMat), world);
    m.rotation.y = -Math.PI / 2; m.position.set(x < 1 ? 0.11 : x1 + 0.11, 0, 0);
    G.CAMBLOCK.push(m);
  }
  // Roof slabs with thick snow and icicles.
  const run = D / 2 + 0.45, rise = CAB.ridge - eave, slope = Math.atan2(rise, run), len = Math.hypot(run, rise) + 0.25;
  const RX0 = -0.65, RX1 = x1 + 0.65, rw = RX1 - RX0, rcx = (RX0 + RX1) / 2;
  for (const s of [-1, 1]) {
    const cz = CAB.ridgeZ + s * run / 2, cy = (CAB.ridge + eave) / 2;
    const slab = G.box(rw, 0.16, len, MAT.shingle, rcx, cy, cz, { uv: [rw / 2, len / 2] });
    slab.rotation.x = s * slope; G.CAMBLOCK.push(slab);
    // The snow on it, and icicles hanging from its lip along the eave.
    const lip = roofSnow(slab, rw, len, 0.08, (a, d, y) => [a - rw / 2, y, s * (d - len / 2)], s > 0 ? 2 : 3);
    // barge boards down the verges and a fascia along the eave, painted like the window trim, under the snow's edge
    // (the roof's edges were the raw edge of the shingle slab: a dark band round it)
    for (const sx of [-1, 1]) G.box(0.035, 0.19, len + 0.035, MAT.trim, sx * (rw / 2 + 0.018), -0.035, s * 0.0175, { parent: slab });
    G.box(rw + 0.07, 0.17, 0.035, MAT.trim, 0, -0.035, s * (len / 2 + 0.018), { parent: slab });
    // and boards under the overhang, where it was the shingles' underside, dark
    const sof = new THREE.Mesh(new THREE.PlaneGeometry(rw, len), SOFFIT(rw, len)); sof.rotation.x = Math.PI / 2; sof.position.y = -0.081; sof.receiveShadow = true; slab.add(sof);
    slab.updateMatrixWorld(true);
    const ic = new THREE.ConeGeometry(0.025, 1, 5);
    const r = G.seeded(s > 0 ? 5 : 6), icM = G.std({ color: '#dcebf7', roughness: 0.08, transparent: true, opacity: 0.85, env: 1.4 });
    const cnt = 46, im = new THREE.InstancedMesh(ic, icM, cnt), v3 = new THREE.Vector3();
    for (let i = 0; i < cnt; i++) {
      const l = 0.08 + Math.pow(r(), 2.2) * 0.45, q = lip[Math.floor(r() * lip.length)];
      v3.set(q[0], q[1], q[2]).applyMatrix4(slab.matrixWorld);
      im.setMatrixAt(i, G.mtx(v3.x + (r() - 0.5) * 0.1, v3.y - l / 2 + 0.03, v3.z + (r() - 0.5) * 0.04, 1, l, 1, 0, Math.PI));
    }
    G.fitInstanceBounds(im);
    world.add(im);
  }
  // Ridge cap snow.
  const rc = G.cyl(0.2, 0.2, rw - 0.05, MAT.snow, rcx, CAB.ridge + 0.12, CAB.ridgeZ, { seg: 12 }); rc.rotation.z = Math.PI / 2; rc.scale.set(0.8, 1, 1);
  // Chimney (stone, outside the north wall) with smoke.
  // A fieldstone chimney: a broad breast round the firebox, shoulders sloping in to the narrower stack with snow lying
  // on them, the stack blackened with soot toward its top, and on it a stone crown with a clay pot, the snow on the
  // crown melted back from the warm flue. (It was one tall plain box of small grey stones with a slab of snow on top,
  // and the smoke came out of the snow.)
  {
    const C = CHIM, ZW = z0 - 0.11, FT = 1.2;
    const fieldM = G.std({ map: TX.field, bumpMap: TX.fieldB, bumpScale: 0.035, roughness: 0.92, env: 0.25, vertexColors: true });
    // UVs from world position, by which way each face looks, so the stones are one size on every face and run on from
    // one part to the next
    const planar = (g, ox, oy, oz) => { const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      for (let i = 0; i < P.count; i++) { const x = P.getX(i) + ox, y = P.getY(i) + oy, z = P.getZ(i) + oz, nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i)), nz = Math.abs(N.getZ(i));
        if (ny > nx && ny > nz) U.setXY(i, x / FT, z / FT); else if (nx > nz) U.setXY(i, z / FT, y / FT); else U.setXY(i, x / FT, y / FT); } };
    const soot = (g, oy) => { const P = g.attributes.position, c = []; for (let i = 0; i < P.count; i++) { const k = 1 - 0.6 * G.smooth(C.yT - 1.0, C.yT + 0.05, P.getY(i) + oy); c.push(k, k * 0.98, k * 0.96); } g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); };
    const part = (g, x, y, z) => { planar(g, x, y, z); soot(g, y); const m = new THREE.Mesh(g, fieldM); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; world.add(m); G.CAMBLOCK.push(m); return m; };
    part(new THREE.BoxGeometry(C.bW, C.yB + 0.4, C.bD), C.x, (C.yB - 0.4) / 2, ZW - C.bD / 2);   // the breast
    { // the shoulders: drawn in at the top to the stack's width, and back toward the wall to its depth
      const g = new THREE.BoxGeometry(C.bW, C.yS - C.yB, C.bD), P = g.attributes.position;
      for (let i = 0; i < P.count; i++) if (P.getY(i) > 0) { P.setX(i, P.getX(i) * C.sW / C.bW); P.setZ(i, C.bD / 2 - (C.bD / 2 - P.getZ(i)) * C.sD / C.bD); }
      g.computeVertexNormals(); part(g, C.x, (C.yB + C.yS) / 2, ZW - C.bD / 2);
      // snow lying on the two sloping shoulders, and a little on the front one
      const run = (C.bW - C.sW) / 2, rise = C.yS - C.yB, ang = Math.atan2(rise, run), L = Math.hypot(run, rise);
      for (const sx of [-1, 1]) {
        const sn = G.box(L * 0.8, 0.07, (C.bD + C.sD) / 2 - 0.06, MAT.snow, C.x + sx * (C.sW / 2 + run / 2 + (rise / L) * 0.03), (C.yB + C.yS) / 2 + (run / L) * 0.03, ZW - (C.bD + C.sD) / 4 + 0.02, { r: 0.03 });
        sn.rotation.z = -sx * ang;
      }
      const fr = (C.bD - C.sD), fa = Math.atan2(rise, fr);
      const FL = Math.hypot(fr, rise), sf = G.box(C.sW + 0.2, 0.05, FL * 0.7, MAT.snow, C.x, (C.yB + C.yS) / 2 + (fr / FL) * 0.025, ZW - C.sD - fr * 0.5 - (rise / FL) * 0.025, { r: 0.02 });
      sf.rotation.x = -fa;
    }
    part(new THREE.BoxGeometry(C.sW, C.yT - C.yS, C.sD, 1, 12, 1), C.x, (C.yS + C.yT) / 2, ZW - C.sD / 2);   // the stack
    // the crown, a stone slab overhanging the stack, sooty; the clay pot on it, its mouth black
    const cz = ZW - C.sD / 2, crownM = G.std({ map: TX.field, color: '#57534f', roughness: 0.95, env: 0.2 });
    G.box(C.sW + 0.14, 0.1, C.sD + 0.14, crownM, C.x, C.yT + 0.05, cz);
    const potM = G.std({ color: '#6a4030', roughness: 0.85, env: 0.25 }), rimM = G.std({ color: '#2e231e', roughness: 0.95, env: 0.15 }), sootM = G.shared({ color: '#0e0b09', roughness: 1 });
    G.cyl(0.13, 0.16, 0.36, potM, C.x, C.yT + 0.1 + 0.18, cz, { seg: 14 });
    G.cyl(0.148, 0.148, 0.05, rimM, C.x, C.yT + 0.1 + 0.33, cz, { seg: 14 });   // the rim, black with soot
    G.cyl(0.11, 0.11, 0.012, sootM, C.x, C.yT + 0.1 + 0.36, cz, { seg: 14 });   // its mouth
    // snow on the crown round the pot, melted back from it
    const cw = C.sW + 0.12, cd = C.sD + 0.12, hole = 0.27;
    for (const sz of [-1, 1]) G.box(cw, 0.06, cd / 2 - hole, MAT.snow, C.x, C.yT + 0.12, cz + sz * (hole + (cd / 2 - hole) / 2), { r: 0.025 });
    for (const sx of [-1, 1]) G.box(cw / 2 - hole, 0.06, hole * 2, MAT.snow, C.x + sx * (hole + (cw / 2 - hole) / 2), C.yT + 0.12, cz, { r: 0.025 });
    G.CHIMNEY = new THREE.Vector3(C.x, C.yT + 0.1 + 0.4, cz);
  }
  // Porch: deck, posts, railing, roof, steps.
  const deckMat = MAT.wood.clone(); deckMat.map = G.rep(TX.floor, 3, 1.2); deckMat.color.set('#a07a58'); G.MATS.push(deckMat);
  G.box(PORCH.x1 - PORCH.x0, 0.36, PORCH.z1 - PORCH.z0, deckMat, (PORCH.x0 + PORCH.x1) / 2, -0.18, (PORCH.z0 + PORCH.z1) / 2);
  for (let i = 0; i < 3; i++) {
    const z = PORCH.z1 + 0.18 + i * 0.36, y = -0.12 * (i + 1);
    G.box(PORCH.stepX1 - PORCH.stepX0, 0.12, 0.36, deckMat, (PORCH.stepX0 + PORCH.stepX1) / 2, y - 0.06 - 0.0, z);
    G.box(PORCH.stepX1 - PORCH.stepX0 - 0.1, 0.05, 0.2, MAT.snow, (PORCH.stepX0 + PORCH.stepX1) / 2 + (i - 1) * 0.15, y + 0.02, z - 0.05, { r: 0.02 });
  }
  // The posts, beam and railing: peeled logs and poles like the cabin's own, not sawn boards. Round posts carry a log
  // beam, each with knee braces up to it; the railing is a log top rail (with its line of snow) and a pole bottom rail,
  // with rustic pole balusters between, each its own girth and standing a little out of true, along the front and down
  // both ends. (They were square dark boards with a row of thin square sticks: a deck from a catalogue.)
  const posts = [3.5, 5.8, 7.2, 9.3, 11.3], pz = PORCH.z1 - 0.12, BEAM_Y = 2.4;
  {
    const PS = poleSet(21), { r, pole, parts } = PS;
    // the posts (each a mesh of its own: the camera keeps from parking behind one)
    for (const x of posts) {
      const one = []; pole([x, 0, pz], [x + (r() - 0.5) * 0.02, BEAM_Y, pz], 0.105, 0.095, 0, one, 12);
      G.CAMBLOCK.push(PS.mesh(one, PS.sideM));
      G.COLL.push({ x0: x - 0.11, z0: pz - 0.11, x1: x + 0.11, z1: pz + 0.11 });
      // knee braces up to the beam (not out past the ends)
      for (const sx of [-1, 1]) if (!(x === posts[0] && sx < 0) && !(x === posts[posts.length - 1] && sx > 0)) pole([x, BEAM_Y - 0.5, pz], [x + sx * 0.46, BEAM_Y - 0.04, pz], 0.045, 0.045);
    }
    pole([PORCH.x0 - 0.2, BEAM_Y, pz], [PORCH.x1 + 0.2, BEAM_Y, pz], 0.11, 0.115, 3, parts, 14);   // the beam
    const rail = (A, B) => {   // A and B: [x, z] at each end
      pole([A[0], 0.95, A[1]], [B[0], 0.95, B[1]], 0.055, 0.055);
      pole([A[0], 0.14, A[1]], [B[0], 0.14, B[1]], 0.04, 0.04);
      const L = Math.hypot(B[0] - A[0], B[1] - A[1]), n = Math.max(1, Math.round((L - 0.12) / 0.15));
      for (let i = 1; i < n; i++) {
        const t = i / n + (r() - 0.5) * 0.02, x = lerp(A[0], B[0], t), z = lerp(A[1], B[1], t), w = 0.021 + r() * 0.009;
        pole([x, 0.12, z], [x + (r() - 0.5) * 0.025, 0.96, z + (r() - 0.5) * 0.02], w, w * 0.9);
      }
      const sn = G.box(L - 0.1, 0.06, 0.1, MAT.snow, (A[0] + B[0]) / 2, 1.02, (A[1] + B[1]) / 2, { r: 0.03 });
      sn.rotation.y = -Math.atan2(B[1] - A[1], B[0] - A[0]);
    };
    rail([3.5, pz], [5.8, pz]); rail([7.2, pz], [9.3, pz]); rail([9.3, pz], [11.3, pz]);
    G.COLL.push({ x0: 3.5, z0: pz - 0.1, x1: 5.8, z1: pz + 0.1 }, { x0: 7.2, z0: pz - 0.1, x1: 11.3, z1: pz + 0.1 });
    // and down both ends, from the wall to the corner posts
    rail([PORCH.x0 + 0.1, CAB.z1 + 0.13], [PORCH.x0 + 0.1, pz]); rail([PORCH.x1 - 0.1, CAB.z1 + 0.13], [PORCH.x1 - 0.1, pz]);
    G.COLL.push({ x0: PORCH.x0 - 0.1, z0: PORCH.z0, x1: PORCH.x0 + 0.15, z1: PORCH.z1 }, { x0: PORCH.x1 - 0.15, z0: PORCH.z0, x1: PORCH.x1 + 0.1, z1: PORCH.z1 });
    PS.build();
  }
  // Porch roof (lean-to)
  const prRun = PORCH.z1 + 0.35 - PORCH.z0, prRise = 0.45, prSlope = Math.atan2(prRise, prRun), prLen = Math.hypot(prRun, prRise);
  const pr = G.box(PORCH.x1 - PORCH.x0 + 0.5, 0.12, prLen, MAT.shingle, (PORCH.x0 + PORCH.x1) / 2, 2.7 - prRise / 2, PORCH.z0 + prRun / 2, { uv: [4, 1] });
  pr.rotation.x = prSlope; G.CAMBLOCK.push(pr);
  { const pw = PORCH.x1 - PORCH.x0 + 0.5; roofSnow(pr, pw, prLen, 0.06, (a, d, y) => [a - pw / 2, y, d - prLen / 2], 4);
    for (const sx of [-1, 1]) G.box(0.035, 0.16, prLen + 0.035, MAT.trim, sx * (pw / 2 + 0.018), -0.03, 0.0175, { parent: pr });
    G.box(pw + 0.07, 0.15, 0.035, MAT.trim, 0, -0.03, prLen / 2 + 0.018, { parent: pr }); }
  const pc = G.add(new THREE.Mesh(new THREE.PlaneGeometry(PORCH.x1 - PORCH.x0, prLen), MAT.boards), world, false, true);
  pc.rotation.x = Math.PI / 2 + prSlope; pc.position.set((PORCH.x0 + PORCH.x1) / 2, 2.6 - prRise / 2 - 0.02, PORCH.z0 + prRun / 2);
  // String lights along the porch beam.
  G.STRING = [];
  const bulbG = new THREE.SphereGeometry(0.025, 8, 6);
  for (let i = 0; i <= 26; i++) {
    const t = i / 26, x = lerp(PORCH.x0 + 0.1, PORCH.x1 - 0.1, t);
    const sag = Math.sin(((t * 4) % 1) * Math.PI) * 0.12;
    const b = new THREE.Mesh(bulbG, MAT.bulb); b.position.set(x, 2.27 - sag, PORCH.z1 - 0.07); world.add(b); G.STRING.push(b);
  }
  // The lantern by the door: an iron one like those along the path, hung from a wrought bracket on the logs, glazed on
  // four sides under its little roof, lit at dusk and plain glass by day. (It was two plates with an orange box
  // between them, lit all day, on a stick.)
  {
    const iron = MAT.darkMetal, wz = PORCH.z0 + 0.12, L = new THREE.Group(); L.position.set(7.35, 1.98, PORCH.z0 + 0.41); world.add(L);
    const glass = new THREE.MeshBasicMaterial({ color: '#ffc27a' }); glass.userData = { on: new THREE.Color('#ffc27a'), off: new THREE.Color('#505255') }; (G.LIT_GLASS = G.LIT_GLASS || []).push(glass);
    // the bracket: a plate on the wall, an arm out over the step, a brace under it with a curl of iron between
    G.box(0.07, 0.22, 0.014, iron, 7.35, 2.2, wz);
    G.box(0.018, 0.022, 0.33, iron, 7.35, 2.3, wz + 0.165);
    const br = G.box(0.014, 0.014, 0.27, iron, 7.35, 2.2, wz + 0.1); br.rotation.x = -(Math.atan2(0.19, 0.2) - 0.05);
    const curl = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 5, 14, Math.PI * 1.5), iron); curl.rotation.y = Math.PI / 2; curl.position.set(7.35, 2.24, wz + 0.06); world.add(curl);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 5, 10), iron); hook.rotation.y = Math.PI / 2; hook.position.set(7.35, 2.27, PORCH.z0 + 0.41); world.add(hook);
    // the lantern, hung from its ring
    G.box(0.17, 0.025, 0.17, iron, 0, -0.12, 0, { parent: L });
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 4), iron); fin.rotation.x = Math.PI; fin.position.y = -0.155; L.add(fin);
    G.box(0.13, 0.2, 0.13, glass, 0, -0.005, 0, { parent: L, cast: false });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) G.box(0.016, 0.22, 0.016, iron, sx * 0.07, -0.005, sz * 0.07, { parent: L });
    for (const sx of [-1, 1]) { G.box(0.145, 0.012, 0.012, iron, 0, 0.0, sx * 0.07, { parent: L, cast: false }); G.box(0.012, 0.012, 0.145, iron, sx * 0.07, 0.0, 0, { parent: L, cast: false }); }
    G.box(0.17, 0.02, 0.17, iron, 0, 0.11, 0, { parent: L });
    const rg = new THREE.ConeGeometry(0.16, 0.11, 4, 1); rg.rotateY(Math.PI / 4); const roof = new THREE.Mesh(rg, iron); roof.position.y = 0.175; roof.castShadow = true; L.add(roof);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 5, 10), iron); ring.position.y = 0.26; L.add(ring);
    G.CAMBLOCK.push(roof);
  }
  G.PORCH_LAMP = new THREE.PointLight('#ffae5c', 5, 7, 2); G.PORCH_LAMP.position.set(7.35, 1.8, PORCH.z0 + 0.45); world.add(G.PORCH_LAMP);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), G.poolMat); pool.rotation.x = -Math.PI / 2; pool.position.set(7.0, 0.012, 6.0); world.add(pool);
  // Porch bench facing the lake, with a plaid throw and a lantern beside it.
  // (a log bench, like the one on the hill: it was three dark boards)
  const bx = 9.45, bz = 5.5;
  { const g = new THREE.Group(); g.position.set(bx, 0, bz); world.add(g); G.logBench(g, { len: 1.7, depth: 0.46, seatY: 0.47, seed: 31 }); }
  G.COLL.push({ x0: bx - 0.85, z0: bz - 0.24, x1: bx + 0.85, z1: bz + 0.24 });
  // the plaid throw, over the seat and down its front edge (it was a slab of plaid lying on the boards)
  { const tg = new THREE.Group(); tg.position.set(bx + 0.35, 0, bz); tg.rotation.y = -Math.PI / 2 + 0.06; world.add(tg);
    G.drapeOver(tg, MAT.plaid, [[-0.18, 0.474], [0.05, 0.476], [0.18, 0.473], [0.225, 0.461], [0.247, 0.43], [0.255, 0.36], [0.258, 0.28], [0.253, 0.2]], -0.27, 0.27); }
  G.BENCH = { x: bx, z: bz, seatY: 0.47 };
  const fl2 = new THREE.Group(); fl2.position.set(bx + 1.05, 0, bz + 0.1); fl2.rotation.y = 0.3; world.add(fl2);
  { // an iron lantern on the boards, lit at dusk (it was two plates with an orange box between)
    const glass = new THREE.MeshBasicMaterial({ color: '#ffbf72' }); glass.userData = { on: new THREE.Color('#ffbf72'), off: new THREE.Color('#55575a') }; (G.LIT_GLASS = G.LIT_GLASS || []).push(glass);
    const iron = MAT.darkMetal;
    G.box(0.22, 0.03, 0.22, iron, 0, 0.015, 0, { parent: fl2 });
    G.box(0.16, 0.24, 0.16, glass, 0, 0.15, 0, { parent: fl2, cast: false });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) G.box(0.018, 0.26, 0.018, iron, sx * 0.085, 0.15, sz * 0.085, { parent: fl2 });
    for (const sx of [-1, 1]) { G.box(0.175, 0.014, 0.014, iron, 0, 0.15, sx * 0.085, { parent: fl2, cast: false }); G.box(0.014, 0.014, 0.175, iron, sx * 0.085, 0.15, 0, { parent: fl2, cast: false }); }
    G.box(0.2, 0.025, 0.2, iron, 0, 0.29, 0, { parent: fl2 });
    const rf = new THREE.ConeGeometry(0.18, 0.12, 4); rf.rotateY(Math.PI / 4); const roof = new THREE.Mesh(rf, iron); roof.position.y = 0.36; roof.castShadow = true; fl2.add(roof);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 5, 10), iron); ring.position.y = 0.45; fl2.add(ring);
  }
  G.cyl(0.06, 0.06, 0.08, MAT.candle, bx - 1.05, 0.04, bz + 0.15);
  G.BENCH_LAMP = new THREE.PointLight('#ffa850', 2.5, 4, 2); G.BENCH_LAMP.position.set(bx + 1.05, 0.4, bz + 0.1); world.add(G.BENCH_LAMP);
  G.INTER.push({ id: 'bench', pos: [bx, 0.5, bz + 0.4], r: 1.3, label: () => (G.STATE.porchDone ? 'Bench' : 'Watch the stars'), act: () => G.Story.porch() });
};
})();
