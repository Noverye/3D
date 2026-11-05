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
G.floorAt = (x, z) => {
  if (x > CAB.x0 - 0.05 && x < CAB.x1 + 0.05 && z > CAB.z0 - 0.05 && z < CAB.z1 + 0.05) return 0;
  if (x > PORCH.x0 && x < PORCH.x1 && z >= PORCH.z0 && z < PORCH.z1) return 0;
  if (x > PORCH.stepX0 && x < PORCH.stepX1 && z >= PORCH.z1 && z < PORCH.stepZ1) return lerp(0, GROUND, (z - PORCH.z1) / (PORCH.stepZ1 - PORCH.z1));
  if (G.onIce(x, z)) return LAKE.y;
  return terrainH(x, z);
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
    g.addColorStop(0, '#5a4030'); g.addColorStop(0.42, '#8a6446'); g.addColorStop(0.5, '#9a7252'); g.addColorStop(0.58, '#6e4c34'); g.addColorStop(1, '#3a2a20');
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
    I.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I);
  g.computeVertexNormals();
  const rock = new THREE.Color('#55535f'), rockDark = new THREE.Color('#3b3a45'), forest = new THREE.Color('#1c2a2a'), snow = new THREE.Color('#eef1f7'), haze = new THREE.Color('#c9d3e2');
  const N = g.attributes.normal, C = new Float32Array(P.length), c = new THREE.Color();
  for (let k = 0; k < P.length / 3; k++) {
    const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2], ny = Math.abs(N.getY(k)), a = Math.atan2(z - CLEAR.z, x - CLEAR.x);
    const steep = 1 - ny;   // 0 flat .. 1 vertical
    const snowLine = 15 + fbm(a * 3, y * 0.05) * 9;
    const keep = G.smooth(0.2, 0.07, steep + (fbm(a * 9, y * 0.12) - 0.5) * 0.08);   // how well snow stays on a slope this steep (the range is broad, so its faces are gentler than they look)
    if (y < 8) c.copy(forest).lerp(rock, G.smooth(2, 8, y) * 0.6);
    else c.copy(rockDark).lerp(rock, G.smooth(0.4, 0.12, steep)).lerp(snow, keep * G.smooth(snowLine - 6, snowLine, y));
    const far = G.smooth(130, 220, Math.hypot(x - CLEAR.x, z - CLEAR.z));
    c.lerp(haze, 0.12 + far * 0.18);   // a little air between you and them
    C[k * 3] = c.r; C[k * 3 + 1] = c.g; C[k * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  const mat = G.std({ vertexColors: true, roughness: 0.95, flatShading: true, env: 0.3 });
  // Less of the scene's fog on them (it washed them out to the colour of the sky); the haze above stands in for it.
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', THREE.ShaderChunk.fog_fragment.replace('gl_FragColor.rgb = mix(', 'fogFactor *= 0.32;\n\tgl_FragColor.rgb = mix(')); };
  mat.customProgramCacheKey = () => 'mountain-fog';
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = false; m.castShadow = false;
  world.add(m);
};

/* ---------------- forest ---------------- */
function pineGeometry(seed, lod = 0) {
  // lod 0: full detail for trees near the clearing; lod 1: a low-poly stand-in for distant trees.
  const r = G.seeded(seed), parts = [];
  const radial = lod ? 7 : 18, hseg = lod ? 1 : 3;
  const H = 1;   // unit height; instances scale it
  const green = (t) => new THREE.Color().setHSL(0.39 + r() * 0.03, 0.32, 0.1 + t * 0.06);
  const snow = new THREE.Color('#eef3f8');
  parts.push({ geo: new THREE.CylinderGeometry(0.012, 0.028, 0.25, lod ? 4 : 6, 1, !!lod), mat: G.mtx(0, 0.12, 0), color: new THREE.Color('#3a2a20') });
  const tiers0 = 11 + Math.floor(r() * 4);
  const tiers = lod ? 6 : tiers0;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const y = 0.1 + t * 0.84, rad = lerp(0.26, 0.035, Math.pow(t, 0.8)) * (0.9 + r() * 0.2), h = lerp(0.17, 0.1, t);
    const cone = new THREE.ConeGeometry(lod ? rad * 1.04 : rad, lod ? h * 1.5 : h, radial, hseg, true);
    const p = cone.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const yy = p.getY(k);
      if (yy < -h * 0.4) { const ang = Math.atan2(p.getZ(k), p.getX(k)); const j = 0.9 + Math.sin(ang * 5 + seed + i) * 0.08; p.setX(k, p.getX(k) * j); p.setZ(k, p.getZ(k) * j); p.setY(k, yy - 0.012 - Math.sin(ang * 3 + i) * 0.008); }
    }
    cone.computeVertexNormals();
    const snowy = r() < 0.85;
    const base = green(t);
    const ph = r() * 10;
    if (lod) {   // two rings per tier: green skirt, snow-dusted tip
      const tipC = base.clone().lerp(snow, snowy ? 0.55 : 0.15);
      parts.push({ geo: cone, mat: G.mtx(0, y, 0, 1, 1, 1, r() * 6), color: (v) => (v.y > y + h * 0.2 ? tipC : base) });
      continue;
    }
    // Near trees: a dark inner cone for body, then a ring of separate drooping branches round it, each its own
    // length and angle, so the outline is ragged like a spruce's; snow lies only on their upper faces.
    const inner = base.clone().multiplyScalar(0.55);
    parts.push({ geo: new THREE.ConeGeometry(rad * 0.62, h * 1.25, 9, 1, true), mat: G.mtx(0, y, 0, 1, 1, 1, r() * 6), color: inner });
    const nb = Math.max(6, Math.round(7 + rad * 30)), droop0 = lerp(0.55, 0.25, t);
    for (let b = 0; b < nb * 2; b++) {
      const ring = b >= nb, bi = ring ? b - nb : b;   // two rings, the second shorter and a little higher, between the first
      const phi = ((bi + (ring ? 0.5 : 0)) / nb) * Math.PI * 2 + (r() - 0.5) * 0.4, L = rad * (ring ? 0.7 : 0.95) * (0.85 + r() * 0.3), w = L * (0.42 + r() * 0.1), d = droop0 + (r() - 0.5) * 0.2 - (ring ? 0.08 : 0);
      const br = new THREE.CylinderGeometry(w * 0.3, w, L, 4, 2, true);   // blunt-ended, not a spike (open: the ends are never seen)
      // a little sag along its length: the far half bends down further
      const bp = br.attributes.position; for (let k = 0; k < bp.count; k++) { const yy = bp.getY(k) / L + 0.5; bp.setX(k, bp.getX(k) - yy * yy * L * 0.18); }
      const M = new THREE.Matrix4().makeTranslation(0, y + (r() - 0.5) * h * 0.4 + (ring ? h * 0.3 : 0), 0)
        .multiply(new THREE.Matrix4().makeRotationY(phi))
        .multiply(new THREE.Matrix4().makeRotationZ(-(Math.PI / 2 + d)))
        .multiply(new THREE.Matrix4().makeTranslation(0, L / 2, 0))
        .multiply(new THREE.Matrix4().makeScale(0.28, 1, 1));
      const tone = base.clone().offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.03);
      const snowB = snowy && r() < 0.72, s0 = 0.3 + r() * 0.25;
      // snow in clumps on the outer, upward faces of some branches, with green between (whole slabs of it, on every
      // branch, made the trees look folded from white card)
      parts.push({ geo: br, mat: M, color: (v, n) => { const out = Math.hypot(v.x, v.z) / Math.max(1e-3, rad); return snowB && n.y > 0.52 && out > s0 ? snow : tone.clone().multiplyScalar(0.7 + Math.min(1, out) * 0.45); } });
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
  const mat = G.std({ vertexColors: true, roughness: 0.9, env: 0.5 });
  // Gentle sway in the wind: the crown moves more than the trunk, each tree on its own phase.
  G.SWAY = { uTime: { value: 0 }, uGust: { value: 0 } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSwayT = G.SWAY.uTime; sh.uniforms.uGust = G.SWAY.uGust;
    sh.vertexShader = 'uniform float uSwayT; uniform float uGust;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
        float bend = position.y * position.y * (0.004 + uGust * 0.012);
        transformed.x += sin(uSwayT * 1.1 + ph) * bend + bend * uGust * 0.6;
        transformed.z += cos(uSwayT * 0.83 + ph * 1.7) * bend * 0.6;
      #endif`);
  };
  mat.customProgramCacheKey = () => 'pine-sway';
  // Trees within NEAR_R of the clearing get full detail and cast shadows; the rest are low-poly and shadowless.
  const NEAR_R = 34;
  const variants = [pineGeometry(3), pineGeometry(17), pineGeometry(42)];
  const farVariants = [pineGeometry(3, 1), pineGeometry(17, 1), pineGeometry(42, 1)];
  const lists = [[], [], []], farLists = [[], [], []];
  const near = (m) => { const e = m.elements; return Math.hypot(e[12] - CLEAR.x, e[14] - CLEAR.z) < NEAR_R; };
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
  const place = (geos, ls, shadows) => geos.forEach((g, i) => {
    if (!ls[i].length) return;
    const im = new THREE.InstancedMesh(g, mat, ls[i].length);
    ls[i].forEach((m, k) => im.setMatrixAt(k, m));
    im.castShadow = shadows; im.receiveShadow = true;
    G.fitInstanceBounds(im);
    world.add(im);
  });
  place(variants, lists, true);
  place(farVariants, farLists, false);
  // Snow-covered shrubs and drifts.
  // Indexed sphere so vertex normals are shared and the drifts read as soft, rounded snow
  // (an icosahedron is non-indexed, which gave every face its own normal: faceted "rocks").
  const shrubG = new THREE.SphereGeometry(1, 14, 9);
  const sp = shrubG.attributes.position;
  for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i); const k = 1 + G.simplex.noise(x * 1.6, z * 1.6 + y) * 0.14; sp.setXYZ(i, x * k, y < 0 ? y * 0.3 : y * k, z * k); }
  shrubG.computeVertexNormals();
  const drifts = [];
  for (let i = 0; i < 160; i++) {
    const a = r() * Math.PI * 2, d = 8 + r() * 26;
    const x = CLEAR.x + Math.cos(a) * d, z = CLEAR.z + Math.sin(a) * d;
    if (rectDist(x, z, -1, -1, 18, 8.2) < 0.6) continue;
    if (z > 7 && z < PATH_END + 2 && Math.abs(x - pathX(z)) < 2.6) continue;
    const s = 0.35 + r() * 0.9;
    drifts.push(G.mtx(x, terrainH(x, z) + s * 0.05, z, s * (1 + r()), s * 0.55, s * (1 + r()), r() * 6));
  }
  const dm = new THREE.InstancedMesh(shrubG, MAT.snow, drifts.length);
  drifts.forEach((m, k) => dm.setMatrixAt(k, m));
  dm.castShadow = true; dm.receiveShadow = true;
  G.fitInstanceBounds(dm);
  world.add(dm);
};

/* ---------------- path: fence and lanterns ---------------- */
G.PATH_LIGHTS = [];
G.buildPath = () => {
  const r = G.seeded(9);
  const capMat = MAT.snow, rail = G.std({ map: TX.bark, color: '#8a6a52', roughness: 0.9 });
  // Split-rail fence on both sides.
  for (const side of [-1, 1]) {
    let prev = null;
    for (let z = 9.4; z <= PATH_END; z += 2.6) {
      const x = pathX(z) + side * 2.4, y = terrainH(x, z);
      const post = G.box(0.13, 1.1, 0.13, rail, x, y + 0.5, z, { r: 0.02, seg: 1 });
      post.rotation.y = r() * 0.3;
      G.box(0.18, 0.08, 0.18, capMat, x, y + 1.08, z, { r: 0.04 });
      if (prev) {
        const dx = x - prev.x, dz = z - prev.z, len = Math.hypot(dx, dz);
        // You can't walk through the fence: a row of small blockers along each rail.
        for (let t = 0; t <= 1.001; t += 0.25 / len) { const cx = prev.x + dx * t, cz = prev.z + dz * t; G.COLL.push({ x0: cx - 0.09, z0: cz - 0.09, x1: cx + 0.09, z1: cz + 0.09, fence: true }); }
        for (const h of [0.45, 0.85]) {
          const m = G.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, len, 7), rail), world);
          m.position.set((x + prev.x) / 2, (y + prev.y) / 2 + h, (z + prev.z) / 2);
          m.rotation.x = Math.PI / 2; m.rotation.z = -Math.atan2(dx, dz) * 0; m.lookAt(x, y + h, z); m.rotateX(Math.PI / 2);
          if (h > 0.8) { const s = G.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, len, 7, 1), capMat), world); s.position.copy(m.position); s.position.y += 0.05; s.quaternion.copy(m.quaternion); s.scale.set(1, 1, 0.6); }
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
  const lanternGlass = new THREE.MeshBasicMaterial({ color: '#ffc27a' });
  let side = -1;
  for (let z = 9.2; z <= PATH_END; z += 5.2) {
    side = -side;
    const x = pathX(z) + side * 1.65, y = terrainH(x, z);
    G.box(0.14, 0.62, 0.14, MAT.darkWood, x, y + 0.31, z, { r: 0.02 });
    G.box(0.2, 0.05, 0.2, MAT.darkMetal, x, y + 0.64, z);
    G.box(0.13, 0.16, 0.13, lanternGlass, x, y + 0.75, z, { cast: false });
    G.box(0.22, 0.05, 0.22, MAT.darkMetal, x, y + 0.85, z);
    G.box(0.24, 0.07, 0.24, MAT.snow, x, y + 0.9, z, { r: 0.03 });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), poolMat);
    pool.rotation.x = -Math.PI / 2; pool.position.set(x, y + 0.03, z); world.add(pool);
    G.PATH_LIGHTS.push({ x, y: y + 0.75, z, pool });
  }
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
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 2.75, uv.getY(i) * h / 2.75);
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
function windowAt(axis, c, a, b, y0, y1, outward) {
  const mid = (a + b) / 2, w = b - a, h = y1 - y0, fw = 0.07, d = WT + 0.06;
  const T = MAT.trim;
  const put = (sx, sy, sz, x, y, z) => (axis === 'x' ? G.box(sx, sy, sz, T, x, y, z) : G.box(sz, sy, sx, T, z, y, x));
  // frame (x-aligned coordinates, swapped for z walls)
  put(w + fw * 2, fw, d, mid, y1 + fw / 2, c); put(w + fw * 2 + 0.1, fw, d + 0.12, mid, y0 - fw / 2, c);
  put(fw, h, d, a - fw / 2, (y0 + y1) / 2, c); put(fw, h, d, b + fw / 2, (y0 + y1) / 2, c);
  put(0.045, h, d * 0.5, mid, (y0 + y1) / 2, c); put(w, 0.045, d * 0.5, mid, y0 + h * 0.55, c);
  // snow on the outside sill
  const sill = axis === 'x' ? G.box(w + 0.2, 0.06, 0.16, MAT.snow, mid, y0 - 0.005, c + outward * 0.18, { r: 0.025 }) : G.box(0.16, 0.06, w + 0.2, MAT.snow, c + outward * 0.18, y0 - 0.005, mid, { r: 0.025 });
  // glass: warm glow outward, dark night inward
  const pane = (mat, off, flip) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    if (axis === 'x') { m.position.set(mid, (y0 + y1) / 2, c + off); m.rotation.y = flip ? Math.PI : 0; }
    else { m.position.set(c + off, (y0 + y1) / 2, mid); m.rotation.y = flip ? -Math.PI / 2 : Math.PI / 2; }
    m.renderOrder = 3; world.add(m); return m;
  };
  const out = pane(MAT.glassOut, outward * 0.012, outward < 0);
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
function buildAnnex() {
  const A = ANNEX, h0 = 2.55, h1 = 2.05, cx = (A.x0 + A.x1) / 2, cz = (A.z0 + A.z1) / 2;
  G.box(A.x1 - A.x0 + 0.3, 0.4, A.z1 - A.z0 + 0.3, MAT.stone, cx, -0.2, cz, { uv: [1, 0.3], cast: false });
  const L = MAT.logs.clone(); L.map = G.rep(TX.logs, 1 / 2.75, 1 / 2.75); L.bumpMap = G.rep(TX.logsB, 1 / 2.75, 1 / 2.75); G.MATS.push(L);
  // Side walls follow the roof line: tall against the cabin, lower at the far end.
  const sh = new THREE.Shape(); sh.moveTo(A.x0, -0.4); sh.lineTo(A.x1 + WT / 2, -0.4); sh.lineTo(A.x1 + WT / 2, h1); sh.lineTo(A.x0, h0); sh.closePath();
  for (const z of [A.z0, A.z1]) { const m = G.add(new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: WT, bevelEnabled: false }), L), world); m.position.z = z - WT / 2; G.CAMBLOCK.push(m); }
  G.CAMBLOCK.push(G.box(WT, h1 + 0.4, A.z1 - A.z0 + WT, L, A.x1, (h1 - 0.4) / 2, cz, { uv: [A.z1 - A.z0 + WT, h1 + 0.4] }));
  // A little window, warm at night: somebody is always "just doing something" in here.
  G.box(0.5, 0.42, 0.04, new THREE.MeshBasicMaterial({ color: '#ffbf7a' }), cx + 0.2, 1.3, A.z1 + WT / 2 + 0.005, { cast: false });
  G.box(0.62, 0.06, 0.12, MAT.trim, cx + 0.2, 1.06, A.z1 + WT / 2 + 0.04); G.box(0.62, 0.06, 0.1, MAT.trim, cx + 0.2, 1.54, A.z1 + WT / 2 + 0.03);
  G.box(0.6, 0.05, 0.14, MAT.snow, cx + 0.2, 1.1, A.z1 + WT / 2 + 0.06, { r: 0.02 });
  // Shed roof falling away from the cabin, with snow.
  const run = A.x1 - A.x0 + 0.6, slope = Math.atan2(h0 - h1, run), len = Math.hypot(run, h0 - h1);
  const roof = G.box(len, 0.12, A.z1 - A.z0 + 0.7, MAT.shingle, cx + 0.15, (h0 + h1) / 2 + 0.12, cz, { uv: [1, 1] });
  roof.rotation.z = -slope; G.CAMBLOCK.push(roof);
  const sn = G.box(len - 0.05, 0.2, A.z1 - A.z0 + 0.6, MAT.snow, cx + 0.15, (h0 + h1) / 2 + 0.27, cz, { r: 0.08 }); sn.rotation.z = -slope;
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
G.buildCabin = () => {
  MAT.logsW = MAT.logs; MAT.boardsW = MAT.boards;
  const { x1, z1, z0, eave } = CAB, D = z1 - z0, zc = (z0 + z1) / 2;
  // Foundation
  G.box(x1 + 0.5, 0.45, D + 0.5, MAT.stone, x1 / 2, -0.235, zc, { uv: [4, 0.5], cast: false });   // top just under the floorboards (it used to cover them)
  // Floor & ceiling
  const fl = G.add(new THREE.Mesh(new THREE.PlaneGeometry(x1, D), MAT.floor), world, false, true);
  fl.rotation.x = -Math.PI / 2; fl.position.set(x1 / 2, 0.002, zc);
  const fuv = fl.geometry.attributes.uv; for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * x1 / 2.4, fuv.getY(i) * D / 2.4);
  const ce = G.add(new THREE.Mesh(new THREE.PlaneGeometry(x1, D), MAT.boards), world, false, true);
  ce.rotation.x = Math.PI / 2; ce.position.set(x1 / 2, CAB.wallH, zc); G.CAMBLOCK.push(ce);
  const cuv = ce.geometry.attributes.uv; for (let i = 0; i < cuv.count; i++) cuv.setXY(i, cuv.getX(i) * x1 / 2.75, cuv.getY(i) * D / 2.75);
  for (let x = 0.9; x < x1; x += 1.55) G.box(0.16, 0.2, D, MAT.beam, x, CAB.wallH - 0.1, zc, { cast: false });
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
  G.box(0.94, 2.08, 0.06, MAT.darkWood, 0.47, 1.04, 0, { parent: leaf });
  G.sph(0.03, MAT.metal, 0.85, 1.0, 0.05, [1, 1, 1], leaf);
  // Corner log ends: crossing logs stacked at each corner.
  const logEnd = G.std({ map: TX.bark, color: '#b08860', roughness: 0.9 });
  for (const [cx, cz] of [[-0.11, z0 - 0.11], [x1 + 0.11, z0 - 0.11], [-0.11, z1 + 0.11], [x1 + 0.11, z1 + 0.11]]) {
    for (let i = 0; i < 7; i++) {
      const y = -0.2 + 0.39 * i + 0.2, alongX = i % 2 === 0;
      const m = G.cyl(0.16, 0.16, 0.75, MAT.logs, cx, y, cz, { seg: 10 });
      if (alongX) m.rotation.z = Math.PI / 2; else m.rotation.x = Math.PI / 2;
      const e = G.cyl(0.155, 0.155, 0.02, logEnd, alongX ? cx + Math.sign(cx - 5) * 0.37 : cx, y, alongX ? cz : cz + Math.sign(cz - zc) * 0.37, { seg: 10 });
      if (alongX) e.rotation.z = Math.PI / 2; else e.rotation.x = Math.PI / 2;
    }
  }
  // Gable ends (east and west).
  const gableShape = new THREE.Shape();
  gableShape.moveTo(z0 - 0.11, eave); gableShape.lineTo(z1 + 0.11, eave); gableShape.lineTo(CAB.ridgeZ, CAB.ridge + 0.02); gableShape.closePath();
  const gMat = MAT.logs.clone(); gMat.map = G.rep(TX.logs, 1 / 2.75, 1 / 2.75); gMat.bumpMap = G.rep(TX.logsB, 1 / 2.75, 1 / 2.75); G.MATS.push(gMat);
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
    const snow = G.box(rw - 0.05, 0.26, len - 0.1, MAT.snow, rcx, 0, 0, { r: 0.12, seg: 4 });
    snow.position.set(rcx, cy + Math.cos(slope) * 0.2, cz + s * Math.sin(slope) * 0.2);
    snow.rotation.x = s * slope;
    // Snow lip and icicles along the eave.
    const ez = CAB.ridgeZ + s * (run + 0.2), ey = eave - 0.17;
    const lip = G.cyl(0.13, 0.13, rw - 0.1, MAT.snow, rcx, ey + 0.08, ez, { seg: 10 }); lip.rotation.z = Math.PI / 2; lip.scale.x = 0.8;
    const ic = new THREE.ConeGeometry(0.025, 1, 5);
    const r = G.seeded(s > 0 ? 5 : 6), icM = G.std({ color: '#dcebf7', roughness: 0.08, transparent: true, opacity: 0.85, env: 1.4 });
    const cnt = 46, im = new THREE.InstancedMesh(ic, icM, cnt);
    for (let i = 0; i < cnt; i++) { const l = 0.08 + Math.pow(r(), 2.2) * 0.45; im.setMatrixAt(i, G.mtx(RX0 + 0.2 + r() * (rw - 0.4), ey - l / 2 + 0.02, ez + (r() - 0.5) * 0.06, 1, l, 1, 0, Math.PI)); }
    G.fitInstanceBounds(im);
    world.add(im);
  }
  // Ridge cap snow.
  const rc = G.cyl(0.2, 0.2, rw - 0.05, MAT.snow, rcx, CAB.ridge + 0.12, CAB.ridgeZ, { seg: 12 }); rc.rotation.z = Math.PI / 2; rc.scale.set(0.8, 1, 1);
  // Chimney (stone, outside the north wall) with smoke.
  G.box(1.05, 6.5, 0.75, MAT.stone, 8, 2.85, z0 - 0.5, { uv: [1, 4], cam: true });
  G.box(1.2, 0.16, 0.9, MAT.stone, 8, 6.15, z0 - 0.5);
  G.box(1.25, 0.14, 0.95, MAT.snow, 8, 6.28, z0 - 0.5, { r: 0.06 });
  G.CHIMNEY = new THREE.Vector3(8, 6.4, z0 - 0.5);
  // Porch: deck, posts, railing, roof, steps.
  const deckMat = MAT.wood.clone(); deckMat.map = G.rep(TX.floor, 3, 1.2); deckMat.color.set('#a07a58'); G.MATS.push(deckMat);
  G.box(PORCH.x1 - PORCH.x0, 0.36, PORCH.z1 - PORCH.z0, deckMat, (PORCH.x0 + PORCH.x1) / 2, -0.18, (PORCH.z0 + PORCH.z1) / 2);
  for (let i = 0; i < 3; i++) {
    const z = PORCH.z1 + 0.18 + i * 0.36, y = -0.12 * (i + 1);
    G.box(PORCH.stepX1 - PORCH.stepX0, 0.12, 0.36, deckMat, (PORCH.stepX0 + PORCH.stepX1) / 2, y - 0.06 - 0.0, z);
    G.box(PORCH.stepX1 - PORCH.stepX0 - 0.1, 0.05, 0.2, MAT.snow, (PORCH.stepX0 + PORCH.stepX1) / 2 + (i - 1) * 0.15, y + 0.02, z - 0.05, { r: 0.02 });
  }
  const posts = [3.5, 5.8, 7.2, 9.3, 11.3];
  for (const x of posts) { G.box(0.18, 2.45, 0.18, MAT.darkWood, x, 1.22, PORCH.z1 - 0.12, { coll: true, cam: true }); }  // cam: keeps the lens from parking behind a post
  const railMat = MAT.darkWood;
  const railSeg = (a, b, z) => {
    G.box(b - a, 0.08, 0.1, railMat, (a + b) / 2, 0.95, z);
    G.box(b - a, 0.07, 0.14, MAT.snow, (a + b) / 2, 1.02, z, { r: 0.03 });
    G.box(b - a, 0.06, 0.08, railMat, (a + b) / 2, 0.12, z);
    for (let x = a + 0.12; x < b - 0.06; x += 0.16) G.box(0.035, 0.8, 0.035, railMat, x, 0.53, z, { cast: false });
    G.COLL.push({ x0: a, z0: z - 0.1, x1: b, z1: z + 0.1 });
  };
  railSeg(3.5, 5.8, PORCH.z1 - 0.12); railSeg(7.2, 11.3, PORCH.z1 - 0.12);
  // side rails
  G.box(0.1, 0.08, PORCH.z1 - PORCH.z0, railMat, PORCH.x0 + 0.08, 0.95, (PORCH.z0 + PORCH.z1) / 2);
  G.box(0.1, 0.08, PORCH.z1 - PORCH.z0, railMat, PORCH.x1 - 0.08, 0.95, (PORCH.z0 + PORCH.z1) / 2);
  G.COLL.push({ x0: PORCH.x0 - 0.1, z0: PORCH.z0, x1: PORCH.x0 + 0.15, z1: PORCH.z1 }, { x0: PORCH.x1 - 0.15, z0: PORCH.z0, x1: PORCH.x1 + 0.1, z1: PORCH.z1 });
  // Porch roof (lean-to)
  const prRun = PORCH.z1 + 0.35 - PORCH.z0, prRise = 0.45, prSlope = Math.atan2(prRise, prRun), prLen = Math.hypot(prRun, prRise);
  const pr = G.box(PORCH.x1 - PORCH.x0 + 0.5, 0.12, prLen, MAT.shingle, (PORCH.x0 + PORCH.x1) / 2, 2.7 - prRise / 2, PORCH.z0 + prRun / 2, { uv: [4, 1] });
  pr.rotation.x = prSlope; G.CAMBLOCK.push(pr);
  const prs = G.box(PORCH.x1 - PORCH.x0 + 0.42, 0.2, prLen - 0.05, MAT.snow, (PORCH.x0 + PORCH.x1) / 2, 2.7 - prRise / 2 + 0.15, PORCH.z0 + prRun / 2, { r: 0.09 });
  prs.rotation.x = prSlope;
  G.box(PORCH.x1 - PORCH.x0, 0.16, 0.14, MAT.darkWood, (PORCH.x0 + PORCH.x1) / 2, 2.38, PORCH.z1 - 0.12);
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
  // Hanging lantern by the door.
  const lan = new THREE.Group(); lan.position.set(7.35, 1.85, PORCH.z0 + 0.25); world.add(lan);
  G.box(0.03, 0.4, 0.03, MAT.darkMetal, 0, 0.32, -0.12, { parent: lan }); G.box(0.03, 0.03, 0.22, MAT.darkMetal, 0, 0.5, -0.03, { parent: lan });
  G.box(0.2, 0.04, 0.2, MAT.darkMetal, 0, 0.14, 0.08, { parent: lan }); G.box(0.16, 0.22, 0.16, new THREE.MeshBasicMaterial({ color: '#ffc27a' }), 0, 0.01, 0.08, { parent: lan, cast: false }); G.box(0.2, 0.04, 0.2, MAT.darkMetal, 0, -0.12, 0.08, { parent: lan });
  G.PORCH_LAMP = new THREE.PointLight('#ffae5c', 5, 7, 2); G.PORCH_LAMP.position.set(7.35, 1.8, PORCH.z0 + 0.45); world.add(G.PORCH_LAMP);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), G.poolMat); pool.rotation.x = -Math.PI / 2; pool.position.set(7.0, 0.012, 6.0); world.add(pool);
  // Porch bench facing the lake, with a plaid throw and a lantern beside it.
  const bx = 9.45, bz = 5.5;
  G.box(1.7, 0.06, 0.48, MAT.darkWood, bx, 0.44, bz, { coll: true });
  G.box(1.7, 0.42, 0.05, MAT.darkWood, bx, 0.74, bz - 0.24);
  for (const dx of [-0.75, 0.75]) G.box(0.06, 0.44, 0.44, MAT.darkWood, bx + dx, 0.22, bz);
  const throwM = G.box(0.9, 0.05, 0.5, MAT.plaid, bx + 0.4, 0.49, bz + 0.02, { r: 0.02 }); throwM.rotation.y = 0.15;
  G.BENCH = { x: bx, z: bz, seatY: 0.47 };
  const fl2 = new THREE.Group(); fl2.position.set(bx + 1.05, 0, bz + 0.1); world.add(fl2);
  G.box(0.2, 0.3, 0.2, new THREE.MeshBasicMaterial({ color: '#ffbf72' }), 0, 0.2, 0, { parent: fl2, cast: false });
  G.box(0.24, 0.04, 0.24, MAT.darkMetal, 0, 0.36, 0, { parent: fl2 }); G.box(0.24, 0.04, 0.24, MAT.darkMetal, 0, 0.04, 0, { parent: fl2 });
  G.cyl(0.06, 0.06, 0.08, MAT.candle, bx - 1.05, 0.04, bz + 0.15);
  G.BENCH_LAMP = new THREE.PointLight('#ffa850', 2.5, 4, 2); G.BENCH_LAMP.position.set(bx + 1.05, 0.4, bz + 0.1); world.add(G.BENCH_LAMP);
  G.INTER.push({ id: 'bench', pos: [bx, 0.5, bz + 0.4], r: 1.3, label: () => (G.STATE.porchDone ? 'Bench' : 'Watch the stars'), act: () => G.Story.porch() });
};
})();
