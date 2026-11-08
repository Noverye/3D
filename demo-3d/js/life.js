'use strict';
/* =========================================================================
 * Life in the cabin: coats and boots, the cold, a fire that has to be fed,
 * weather that comes and goes, and Partner's own way of passing the time
 * when you leave her to it. Runs after story.js (uses G.SAPI).
 * ========================================================================= */
(G.afterBuild = G.afterBuild || []).push(() => {
const { PLAYER, PARTNER, STATE, clamp, damp, smooth } = G;
const A = G.SAPI, S = A.S;
const N = A.N, Pt = A.Pt;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const outside = (c) => !G.inside(c.x, c.z) && !G.underRoof(c.x, c.z);
const dist = () => Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
const FIRE_AT = { x: 8.0, z: -1.8 };
const L = (S.life = S.life || {});
G.LIFE = L;
const freeBark = (line, d) => { if (!G.busy() && !PARTNER.hidden && !PARTNER.bark && dist() < 7 && !(G.S.flags && G.S.flags.noBarks)) { G.bark(line, d || 2.8); return true; } return false; };

/* =====================================================================
 * Outdoor gear: coat, hat, scarf and boots, worn over the indoor clothes
 * ===================================================================== */
function buildGear(m, o) {
  const u = m.userData, k = u.k, fem = !!o.fem;
  const W = fem ? { hip: 0.172, waist: 0.13, chest: 0.155, sh: 0.16 } : { hip: 0.162, waist: 0.15, chest: 0.18, sh: 0.19 };
  const parts = [];
  const add = (mesh, parent, x = 0, y = 0, z = 0) => { if (mesh.material === coatM || (parent === u.spine && mesh.geometry.parameters && mesh.geometry.parameters.radius < 0.01 * k)) mesh.userData.coatPiece = true; /* coat and its buttons */ mesh.position.set(x * k, y * k, z * k); mesh.castShadow = true; mesh.receiveShadow = true; mesh.visible = false; mesh.userData.warm = true; parent.add(mesh); parts.push(mesh); return mesh; };
  // Profiles must run bottom to top, or the lathe's faces point inward and get culled.
  const lathe = (pts, seg = 32) => { const P = pts[0][1] > pts[pts.length - 1][1] ? pts.slice().reverse() : pts; return new THREE.LatheGeometry(P.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r) * k, y * k)), seg); };
  const coatM = G.std({ map: G.rep(G.TX.jersey, 2, 2), color: o.coat, bumpMap: G.TX.jerseyB, bumpScale: 0.004, roughness: 1, env: 0.2 });
  const knit = (c) => G.std({ map: G.rep(G.TX.knitCream, 2, 1), color: c, bumpMap: G.TX.knitB, bumpScale: 0.004, roughness: 1 });
  const bust = fem ? 0.012 : 0, c = 1.17;
  // A hip-length wool jacket over the jumper: it ends above where the thighs swing, so walking legs
  // never come through it (a rigid mid-thigh coat can't move with the legs).
  const coat = add(new THREE.Mesh(lathe([
    [W.hip * 1.21, -0.165], [W.hip * 1.19, -0.11], [W.hip * c, -0.04], [W.waist * 1.2, 0.1], [(W.waist + W.chest) / 2 * c, 0.18],
    [(W.chest + bust) * c, 0.27], [W.chest * 1.18, 0.38], [W.sh * c, 0.43], [W.sh * 1.0, 0.475], [0.118, 0.505], [0.088, 0.522], [0.0, 0.526],
  ], 36), coatM), u.spine);
  coat.scale.z = fem ? 0.72 : 0.69;
  add(new THREE.Mesh(new THREE.TorusGeometry(0.083 * k, 0.026 * k, 10, 28), coatM), u.chest, 0, 0.14, 0.004).rotation.x = Math.PI / 2 - 0.15;   // collar
  for (let i = 0; i < 3; i++) add(new THREE.Mesh(new THREE.SphereGeometry(0.008 * k, 8, 6), G.shared({ color: '#2a201a', roughness: 0.5 })), u.spine, 0.015, 0.03 + i * 0.11, (W.waist * 1.2 + 0.004) * (fem ? 0.72 : 0.69));
  const ua = 0.186 * 1.75, fa = 0.146 * 1.75;
  u.arms.forEach((a) => {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.058 * k, 16, 12), coatM), a.sh, 0, -0.01, 0).scale.set(1, 0.9, 1);
    add(new THREE.Mesh(lathe([[0.062, 0.01], [0.063, -0.05], [0.057, -0.15], [0.051, -ua + 0.02], [0.049, -ua]], 20), coatM), a.sh).scale.z = 0.94;
    add(new THREE.Mesh(new THREE.SphereGeometry(0.047 * k, 12, 10), coatM), a.el);
    add(new THREE.Mesh(lathe([[0.049, 0], [0.051, -0.06], [0.046, -0.15], [0.044, -fa + 0.05], [0.048, -fa + 0.02], [0.04, -fa + 0.015]], 20), coatM), a.el);
  });
  // Hat: his a plain turned-up beanie, hers a cream bobble hat (she had one like it at the fair).
  const hatM = knit(o.hat), n0 = parts.length;
  const hat = add(new THREE.Mesh(new THREE.SphereGeometry(0.094 * k, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), hatM), u.head, 0, 0.026, -0.012);
  hat.scale.set(1.1, 1.12, 1.12);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.09 * k, 0.017 * k, 8, 28), hatM), u.head, 0, 0.04, -0.006).rotation.x = Math.PI / 2 + 0.12;
  if (o.pom) add(new THREE.Mesh(new THREE.SphereGeometry(0.032 * k, 12, 8), hatM), u.head, 0, 0.142, -0.02);
  const hatParts = parts.slice(n0);
  // Scarf: wound twice, one end down the front.
  const sm = knit(o.scarf);
  const sc = add(new THREE.Mesh(new THREE.TorusGeometry(0.075 * k, 0.034 * k, 10, 24), sm), u.chest, 0, 0.15, 0.008);
  sc.rotation.x = Math.PI / 2 - 0.12; sc.scale.set(1.12, 1.18, 0.95);
  const tail = add(new THREE.Mesh(new THREE.BoxGeometry(0.065 * k, 0.26 * k, 0.026 * k), sm), u.chest, 0.045, 0.04, 0.12);
  tail.rotation.set(0.14, 0, 0.1); tail.userData.scarfTail = true;   // the hanging end: simulated (G.simScarf)
  // Boots over the socks.
  const bootM = G.std({ color: o.boots, roughness: 0.62, env: 0.4 });
  const fl = 0.152 * 1.75, ank = 0.039 * 1.75;
  u.legs.forEach((lg) => {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.043 * k, 0.046 * k, 0.15 * k, 16), bootM), lg.ft, 0, 0.03, -0.004).userData.boot = true;
    const toe = add(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), bootM), lg.ft, 0, -ank + 0.034, fl * 0.5 - 0.058); toe.scale.set(0.049 * k, 0.039 * k, fl * 0.53 * k); toe.userData.boot = true;
    add(new THREE.Mesh(new THREE.BoxGeometry(0.094 * k, 0.022 * k, fl * 1.06 * k), G.shared({ color: '#221c18', roughness: 0.9 })), lg.ft, 0, -ank + 0.008, fl * 0.5 - 0.058).userData.boot = true;
  });
  // Snow that settles on the shoulders (and the hat) while you stand about in it.
  const snow = [];
  const flake = (parent, x, y, z, sx, sy, sz) => { const s = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), G.MAT.snow); s.scale.set(sx * k, sy * k, sz * k); s.position.set(x * k, y * k, z * k); s.visible = false; s.castShadow = false; s.userData.warm = true; s.userData.base = [sx, sy, sz]; parent.add(s); snow.push(s); return s; };
  // [y with the coat on, y without]: the coat's shoulders sit a little higher than the jumper's.
  for (const a of u.arms) flake(u.chest, a.sh.position.x / k * 0.72, 0.138, -0.005, 0.05, 0.018, 0.045).userData.ys = [0.138, 0.122];
  flake(u.chest, 0, 0.13, -0.075, 0.07, 0.013, 0.042).userData.ys = [0.13, 0.112];
  flake(u.head, 0, 0.115, -0.012, 0.055, 0.02, 0.055);
  return { parts, snow, hat, hatParts, coatM };
}
const ADULT = G.KIDS ? G.KIDS.adults : { player: PLAYER.m, partner: PARTNER.m };
const GEAR = {
  player: buildGear(ADULT.player, { coat: '#5c5f63', hat: '#3a3d44', scarf: '#b8322a', boots: '#4a3426' }),
  partner: buildGear(ADULT.partner, { fem: true, coat: '#a8875e', hat: '#ece4d6', scarf: '#7a4a5e', boots: '#6b4a32', pom: true }),
};
// By body, not by role: playing as her, PLAYER is in her body and wears her coat.
const herBody = (c) => G.herBody(c);
const gearOf = (c) => (herBody(c) ? GEAR.partner : GEAR.player);
/* A realistic body (assets.js manifest) is shaped differently from the procedural one the gear was built on:
 * a bigger knit jumper, a different skull. Once it's loaded and measured (people.js, measureFit), the coat is
 * widened to clear the knitwear, the hat moved and sized to sit on that head, the scarf to that collar, the
 * boots to those feet. */
function fitGear(c) {
  const m = herBody(c) ? ADULT.partner : ADULT.player, u = m.userData, f = u.fit;
  if (!f || u.gearFitted || !u.real) return null;
  u.gearFitted = true;
  const g = gearOf(c), k = u.k, out = {};
  return G.atRest(m, () => {
    const inv = new THREE.Matrix4(), v = new THREE.Vector3();
    const local = (mesh, P, keep) => { mesh.updateMatrixWorld(true); inv.copy(mesh.matrixWorld).invert(); const r = []; for (let i = 0; i < P.length; i += 3) { v.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(inv); if (keep(v)) r.push(v.clone()); } return r; };
    const pct = (a, q) => { if (!a.length) return 0; a.sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * q))]; };
    // How much wider must a lathe piece (coat body, sleeve) be to clear the body inside it, at every height?
    const latheNeed = (mesh) => {
      const pr = mesh.geometry.parameters.points, rAt = (y) => { if (y < pr[0].y) return pr[0].x; for (let i = 1; i < pr.length; i++) if (y <= pr[i].y) { const a = pr[i - 1], b = pr[i], t = (y - a.y) / (b.y - a.y || 1); return a.x + (b.x - a.x) * t; } return 0; };
      const y0 = pr[0].y, y1 = pr[pr.length - 1].y, h = y1 - y0;
      const P = local(mesh, mesh === torso ? bodyNoArms : armOf(mesh) >= 0 ? armPts[armOf(mesh)] : f.body, (q) => q.y > y0 + (mesh === torso ? 0 : h * 0.04) && q.y < y1 - h * 0.08);
      // The real body may sit forward or back of where the procedural one did: centre the piece on it first.
      let dz = 0;
      if (mesh === torso) { const zs = P.filter((q) => Math.abs(q.x) < 0.08 * k).map((q) => q.z); if (zs.length) dz = (pct(zs, 0.99) + pct(zs, 0.01)) / 2; mesh.userData.dz = dz; }
      const ratios = [], hem = [], yH = y0 + h * 0.18;
      P.forEach((q) => { const r = rAt(q.y); if (r > 0.01 * k) { const t = Math.hypot(q.x, q.z - dz) / r; if (t < 1.4) (mesh === torso && q.y < yH ? hem : ratios).push(t); } });
      const s = clamp(pct(ratios, mesh === torso ? 0.997 : 0.98) * 1.04, 1, 1.4);
      // The hem of the coat flares out over the thighs instead of the whole coat growing to clear them.
      if (mesh === torso && hem.length) {
        const fl = clamp(pct(hem, 0.995) * 1.06 / s, 1, 1.35), yR = y0 + h * 0.4, pos = mesh.geometry.attributes.position;
        if (fl > 1.001) { for (let j = 0; j < pos.count; j++) { const y = pos.getY(j); if (y < yR) { const t = 1 + (fl - 1) * smooth(yR, y0, y); pos.setX(j, pos.getX(j) * t); pos.setZ(j, pos.getZ(j) * t); } } pos.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere(); }
        mesh.userData.flare = fl;
      }
      return s;
    };
    const need = new Map(), torso = g.parts[0];
    // The arms hang at the sides in the rest pose, hands by the hips: the coat body mustn't try to swallow them.
    const segs = [], wp = (o) => o.getWorldPosition(new THREE.Vector3());
    u.arms.forEach((A) => { const a = wp(A.sh), e = wp(A.el), hd = wp(A.hand); segs.push([a, e], [e, hd], [hd, hd.clone().add(hd.clone().sub(e).multiplyScalar(0.8))]); });
    const ln = new THREE.Line3(), cp = new THREE.Vector3(), pt = new THREE.Vector3(), B = f.body, keepIdx = [], armIdx = [[], []];
    const near = (sg) => { ln.set(sg[0], sg[1]); ln.closestPointToPoint(pt, true, cp); return cp.distanceTo(pt); };
    for (let i = 0; i < B.length; i += 3) {
      pt.set(B[i], B[i + 1], B[i + 2]);
      const d = segs.map(near), j = d.indexOf(Math.min(...d));
      if (d[j] < 0.1 * k) { if (d[j] < 0.075 * k) armIdx[Math.floor(j / 3)].push(B[i], B[i + 1], B[i + 2]); } else keepIdx.push(B[i], B[i + 1], B[i + 2]);
    }
    const bodyNoArms = new Float32Array(keepIdx), armPts = armIdx.map((a) => new Float32Array(a));
    const armOf = (mesh) => u.arms.findIndex((A) => A.sh === mesh.parent || A.el === mesh.parent);
    g.parts.forEach((p) => { if (p.material === g.coatM && p.geometry.type === 'LatheGeometry') need.set(p, latheNeed(p)); });
    // Left and right sleeves alike (the rest pose is symmetric; any difference is just a stray vertex or two).
    const sl = [...need.keys()].filter((p) => p !== torso), half = sl.length / 2;
    sl.slice(0, half).forEach((p, i) => { const q = sl[i + half], m = Math.min(need.get(p), need.get(q)); need.set(p, m); need.set(q, m); });
    const sT = need.get(torso) || 1, dzT = (torso.userData.dz || 0) * torso.scale.z;
    const sibling = (p) => { for (const [q, s] of need) if (q !== torso && q.parent === p.parent) return s; return sT; };
    // Hat: down onto this skull (it was built for a rounder procedural head), then big enough to sit over the hair.
    const hp = g.hatParts, hat = hp[0], dyHat = (f.skinTop + 0.016) - (f.headY + 0.12 * k);
    hp.forEach((p) => { p.position.y += dyHat; });
    const r0 = hat.geometry.parameters.radius;
    // Centred on the skull itself: the middle of its extent above the brim, side to side and front to back
    // (the middle of the extent, not the average, which the forehead or a bun would pull).
    { const sk = local(hat, f.skull || f.hair, (q) => q.y > 0.35 * r0 && q.length() < 1.6 * r0);
      if (sk.length > 8) { const b = new THREE.Box3().setFromPoints(sk), d = b.getCenter(new THREE.Vector3()); d.y = 0; d.multiply(hat.scale); d.x = clamp(d.x, -0.02, 0.02); d.z = clamp(d.z, -0.01, 0.06); hp.forEach((p) => { p.position.x += d.x; p.position.z += d.z; }); out.hatCentre = [+d.x.toFixed(3), +d.z.toFixed(3)]; } }
    const hr = local(hat, f.hair, (q) => q.y > 0.1 * r0 && q.z > -0.35 * r0 && q.length() < 1.6 * r0).map((q) => q.length() / r0);   // not the bun at the back
    const sH = clamp(pct(hr, 0.95) * 1.02, 0.85, 1.15), c0 = hat.position.clone();
    hp.forEach((p) => { p.position.sub(c0).multiplyScalar(sH).add(c0); p.scale.multiplyScalar(sH); });
    // Then down to the forehead: the brim just above the brows (the real heads' eye line), and big enough over
    // the hair on top that it's worn, not perched.
    const lid = (u.realLids || [])[0];
    if (lid) {
      m.updateMatrixWorld(true);
      const W = (o) => o.getWorldPosition(new THREE.Vector3());
      // the brim's lowest edge (its front: it's tilted) just above the brows
      const brim = hp[1], bb = new THREE.Box3().setFromObject(brim), dy2 = W(lid).y + 0.026 * k - bb.min.y;
      hp.forEach((p) => { p.position.y += dy2; }); g.snow.forEach((s2) => { if (s2.parent === u.head) s2.position.y += dy2; });
      m.updateMatrixWorld(true);
      const dc = W(hat), hTop = f.hair.reduce((mx, _, i) => (i % 3 === 1 && Math.hypot(f.hair[i - 1] - dc.x, f.hair[i + 1] - dc.z) < 0.06 ? Math.max(mx, f.hair[i]) : mx), f.skinTop);
      const need = clamp((hTop + 0.014 - dc.y) / (r0 * hat.scale.y), 1, 1.12), c1 = brim.position.clone();
      if (need > 1) hp.forEach((p) => { p.position.sub(c1).multiplyScalar(need).add(c1); p.scale.multiplyScalar(need); });
      out.hatDrop = +dy2.toFixed(3); out.hatGrow = +need.toFixed(3);
    }
    const dyScarf = clamp(f.neck - (f.chestY + 0.15 * k), -0.012, 0.015);   // never down into the coat's collar, nor up over the mouth
    const sB = f.footLen > 0.1 ? clamp(f.footLen / (0.266 * k) * 1.06, 0.9, 1.4) : 1;
    const arm = (p) => u.arms.some((a) => a.sh === p || a.el === p), foot = (p) => u.legs.some((l) => l.ft === p);
    for (const p of g.parts) {
      const par = p.parent;
      if (hp.includes(p)) continue;
      if (need.has(p)) { p.scale.x *= need.get(p); p.scale.z *= need.get(p); if (p === torso) p.position.z += dzT; }
      else if (arm(par)) { const s = sibling(p); p.scale.x *= s; p.scale.z *= s; }
      else if (par === u.spine || (par === u.chest && p.material === g.coatM)) { p.position.x *= sT; p.position.z = p.position.z * sT + (par === u.spine ? dzT : 0); p.scale.x *= sT; p.scale.z *= sT; }
      else if (par === u.chest) { p.position.set(p.position.x * sT, p.position.y + dyScarf, p.position.z * sT); p.scale.x *= sT; p.scale.z *= sT; }
      else if (foot(par)) { /* boots: fitted to the feet below */ }
    }
    g.snow.forEach((s) => { if (s.parent === u.head) s.position.y += dyHat; else { s.position.x *= sT; s.position.z *= sT; } });
    out.boots = fitBoots(m, g.parts.filter((p) => foot(p.parent)));
    out.head = toHeadBone(m, g.parts.concat(g.snow));
    out.bun = tuckUnderHat(m, g.hatParts);
    // The model's own long coat wears the same wool and colour as the built-on one did.
    // Over the long coat's own collar the scarf sits a little lower and wider, wrapped round it, not the chin.
    if ((u.realCoat || []).length) g.parts.forEach((p) => { if (p.parent === u.chest && p.material !== g.coatM && !p.userData.coatPiece) { p.position.y -= 0.035 * k; p.scale.x *= 1.08; p.scale.z *= 1.1; } });
    // The scarf down onto the long coat's collar and round it: measured from the coat itself (the collar's top at
    // the front and back, where there are no shoulder points, and how wide it is just below).
    if ((u.realCoat || []).length) {
      const cv = []; const vv = new THREE.Vector3();
      u.realCoat.forEach((o) => { o.updateMatrixWorld(true); const P = o.geometry.attributes.position; for (let i = 0; i < P.count; i += 2) { vv.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); cv.push(vv.clone()); } });
      const cz0 = cv.filter((q) => q.y > f.chestY).reduce((a2, q, _, A) => a2 + q.z / A.length, 0);
      const front = cv.filter((q) => Math.abs(q.x) < 0.05 && q.z > cz0 && q.y > f.chestY), backC = cv.filter((q) => Math.abs(q.x) < 0.06 && q.z < cz0 && q.y > f.chestY);
      const fTop = pct(front.map((q) => q.y), 0.98), bTop = pct(backC.map((q) => q.y), 0.97);
      // Square, peaked sleeve heads: anything above a natural shoulder line (sloping ~20° down from the neck)
      // is brought most of the way down onto it, so the shoulders read round.
      const yMax = (ax) => fTop - 0.025 * k - Math.max(0, ax - 0.07 * k) * 0.36;
      // (The coats are tailored in Blender now, sleeve heads included: tools/overcoat.py. The old fold for square,
      // peaked shoulders is only for an untailored coat.)
      if (window.COAT_FOLD) u.realCoat.forEach((o) => {
        const P = o.geometry.attributes.position, iw = new THREE.Matrix4().copy(o.matrixWorld).invert(); let n = 0;
        for (let i = 0; i < P.count; i++) { vv.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); const ax = Math.abs(vv.x); if (ax > 0.07 * k && ax < 0.3 * k) { const ym = yMax(ax); if (vv.y > ym) { vv.y = ym + (vv.y - ym) * 0.3; vv.applyMatrix4(iw); P.setXYZ(i, vv.x, vv.y, vv.z); n++; } } }
        P.needsUpdate = true; o.geometry.computeVertexNormals(); out.folded = (out.folded || 0) + n;
      });
      const band = cv.filter((q) => q.y > fTop - 0.04 && q.y < fTop + 0.01 && Math.hypot(q.x, q.z - cz0) < 0.16);
      const rx = pct(band.map((q) => Math.abs(q.x)), 0.9), rz = pct(band.map((q) => Math.abs(q.z - cz0)), 0.9);
      const ring = g.parts.find((p) => p.parent === u.chest && p.geometry.type === 'TorusGeometry');
      const tail = g.parts.find((p) => p.userData.scarfTail);
      if (ring && rx > 0.03) {
        const P = ring.geometry.parameters, inner = P.radius - P.tube * 0.6;
        ring.scale.x = clamp((rx * 1.04) / inner, 0.8, 1.6); ring.scale.y = clamp((Math.max(rz, rx * 0.8) * 1.04) / inner, 0.8, 1.6);
        // Resting on the front of the collar, riding up a little at the back of the neck.
        ring.rotation.x = Math.PI / 2 - clamp(Math.atan2((bTop - fTop) * 0.45, rz * 2 + 0.01), 0.1, 0.4);
        u.chest.updateMatrixWorld(true);
        const at = ring.getWorldPosition(new THREE.Vector3()), want = fTop + P.tube * ring.scale.z * 0.55 + (bTop - fTop) * 0.2;
        ring.position.y += want - at.y; ring.position.z += cz0 - at.z;
        if (tail) { tail.position.y = ring.position.y - 0.11 * k; tail.position.z = ring.position.z + (P.radius + P.tube * 0.5) * ring.scale.y; tail.position.x = 0.35 * rx; }
        out.collar = [+fTop.toFixed(3), +bTop.toFixed(3), +rx.toFixed(3), +rz.toFixed(3), +(want - at.y).toFixed(3)];
      }
    }
    // The overcoat (tools/overcoat.py) carries its own UVs (30 cm a tile) and vertex colours (dark horn buttons,
    // a touch lighter on the cuffs and pocket flaps); older coats fall back to the jersey.
    (u.realCoat || []).forEach((o) => { const mt = g.coatM.clone(); mt.skinning = true; mt.side = THREE.DoubleSide; const wool = !!o.geometry.attributes.color; mt.map = wool ? G.TX.wool : G.rep(G.TX.jersey, 4, 4); if (wool) { mt.vertexColors = true; mt.bumpMap = G.TX.woolB; mt.bumpScale = 0.0025; mt.roughness = 0.97; } G.MATS && G.MATS.push(mt); o.material = mt; });
    // The hat, scarf, gloves and boots made in Blender replace the built-on ones (which stay hidden), in the same
    // knit (their own UVs, so the texture isn't repeated again) and, for the boots, leather in their own colours.
    const RG = u.realGear;
    if (RG) {
      const hatM0 = g.hatParts[0].material, ring0 = g.parts.find((p) => p.parent === u.chest && p.geometry.type === 'TorusGeometry' && p.material !== g.coatM), tail0 = g.parts.find((p) => p.userData.scarfTail);
      const knitOf = (m0) => { const mt = m0.clone(); mt.skinning = true; mt.map = G.TX.knitCream; mt.bumpMap = G.TX.knitB; mt.bumpScale = 0.003; mt.side = THREE.DoubleSide; G.MATS && G.MATS.push(mt); return mt; };
      const set = (list, mt) => (list || []).forEach((o) => { o.material = mt; o.castShadow = true; o.receiveShadow = true; });
      if (RG.hat) { set(RG.hat, knitOf(hatM0)); g.hatParts.forEach((p) => (p.userData.replaced = true)); }
      if (RG.gloves) set(RG.gloves, knitOf(hatM0));
      if (RG.scarf && ring0) { set(RG.scarf, knitOf(ring0.material)); ring0.userData.replaced = true; if (tail0) tail0.userData.replaced = true; }
      if (RG.boots) {
        const bm = G.std({ color: '#ffffff', roughness: 0.68, env: 0.35, bumpMap: G.TX.jerseyB, bumpScale: 0.0015 }); bm.skinning = true; bm.vertexColors = true; G.MATS && G.MATS.push(bm);
        set(RG.boots, bm); g.parts.forEach((p) => { if (p.userData.boot) p.userData.replaced = true; });
      }
      out.realGear = Object.keys(RG).join(',');
    }
    out.flare = +(torso.userData.flare || 1).toFixed(3);
    need.forEach((s, p) => { out[p.parent === u.spine ? 'coat' : (out.sl = (out.sl || 0) + 1, 'sleeve' + out.sl)] = +s.toFixed(3); });
    return Object.assign(out, { sH: +sH.toFixed(3), dyHat: +dyHat.toFixed(3), dyScarf: +dyScarf.toFixed(3), sB: +sB.toFixed(3) });
  });
}
/* Boots built round a realistic model's own feet. Each boot is [shaft, foot, sole] on the rig's foot group;
 * every part is sized and placed from the sock it covers, measured in that foot's frame, then handed to the
 * model's own foot bone so it moves exactly with that foot (the rig's foot is longer and higher, and a child's
 * shins are shorter than the rig's). Call with the body at rest (inside G.atRest). */
function fitBoots(m, boots) {
  const u = m.userData, f = u.fit, R = u.retarget, out = [];
  if (!f || !f.socks || !f.socks.length || !boots || !boots.length) return out;
  const inv = new THREE.Matrix4(), v = new THREE.Vector3();
  u.legs.forEach((lg, i) => {
    lg.ft.updateMatrixWorld(true); inv.copy(lg.ft.matrixWorld).invert();
    const side = Math.sign(new THREE.Vector3().setFromMatrixPosition(lg.ft.matrixWorld).x - m.position.x) || (i ? 1 : -1);
    const box = new THREE.Box3();
    for (let j = 0; j < f.socks.length; j += 3) { if (Math.sign(f.socks[j] - m.position.x) !== side) continue; box.expandByPoint(v.set(f.socks[j], f.socks[j + 1], f.socks[j + 2]).applyMatrix4(inv)); }
    const mine = boots.filter((p) => p.parent === lg.ft);
    if (box.isEmpty() || mine.length < 3) return;
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    const [shaft, foot, sole] = mine;
    shaft.userData.shaft = true;
    const lowY = box.min.y, w = Math.max(sz.x, 0.05) * 0.5 + 0.008, fh = Math.min(sz.y, 0.09);
    // Foot: an ellipsoid round the sock, toe to heel (the geometry is a unit sphere).
    foot.position.set(c.x, lowY + fh * 0.42, c.z); foot.scale.set(w * 1.05, fh * 0.5 + 0.006, sz.z * 0.5 + 0.012);
    const fit = (mesh) => { mesh.scale.set(1, 1, 1); mesh.geometry.computeBoundingBox(); return mesh.geometry.boundingBox.getSize(new THREE.Vector3()); };
    // Sole: under it.
    const gs = fit(sole); sole.position.set(c.x, lowY + 0.004, c.z); sole.scale.set((w * 1.9) / gs.x, 1, (sz.z + 0.016) / gs.z);
    // Shaft: up the shin from the ankle, wide enough for the sock's top.
    // A real calf widens above the ankle: the shaft flares to fit it (unit cylinder, top half as wide again).
    // Sized to the body: a child's wellies come to below the knee, not up to it.
    const bs = Math.max(0.5, Math.min(1.15, (u.H || 1.7) / 1.7)), kid = bs < 0.85;
    if (!shaft.userData.flared) { shaft.geometry = new THREE.CylinderGeometry(0.5 * (kid ? 1.22 : 1.5), 0.5, 1, 18, 1, true); shaft.material.side = THREE.DoubleSide; shaft.userData.flared = true; }
    const sh = new THREE.Vector3(1, 1, 1), top = box.max.y + (kid ? 0.1 : 0.2) * bs, bot = lowY + 0.03 * bs, rr = w * 1.08;   // to mid-calf, well over the leggings' hem (the shaft tips with the foot)
    shaft.position.set(c.x, (top + bot) / 2, c.z - sz.z * 0.22); shaft.scale.set((rr * 2) / sh.x, (top - bot) / sh.y, (rr * 2) / sh.z);
    out.push([+sz.x.toFixed(3), +sz.y.toFixed(3), +sz.z.toFixed(3)]);
  });
  if (R) {
    G.retarget(m); m.updateMatrixWorld(true);
    // The shaft goes with the shin (so the calf can't push through it when the ankle bends), the rest with the foot.
    u.legs.forEach((lg) => { const e = R.map.find((q) => q.group === lg.ft), s = R.map.find((q) => q.group === lg.kn); if (!e) return; for (const p of boots.slice()) if (p.parent === lg.ft) (p.userData.shaft && s ? s : e).bone.attach(p); });
  }
  return out;
}
/* Hand head-worn gear to the model's own head bone, so it stays on the head when the neck turns and nods
 * (the rig's head joint pivots at a different height from the model's neck). Call at rest, after fitting. */
// Her bun is tall at the back of her head: under the winter hat it's pressed in, not poking out through the
// knit. For each hair vertex outside the hat's shape (above the brim), find where it would sit just inside the
// hat and keep that as a second set of positions, swapped in while the hat is on (setDressed).
function tuckUnderHat(m, hatParts) {
  const u = m.userData; if (!(u.realBun || []).length || !hatParts.length) return 0;
  m.updateMatrixWorld(true);
  const box = new THREE.Box3(), RH = u.realGear && u.realGear.hat && u.realGear.hat[0];
  if (RH) {
    // the Blender hat (skinned to the head): its shape as worn, up to the crown (not the bobble: no higher than
    // just over the skull)
    RH.updateMatrixWorld(true); const P = RH.geometry.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) { RH.boneTransform(i, v); box.expandByPoint(v.applyMatrix4(RH.matrixWorld)); }
    if (u.fit && u.fit.skinTop) box.max.y = Math.min(box.max.y, u.fit.skinTop + 0.032 * (u.k || 1));
  } else hatParts.slice(0, 2).forEach((p) => { if (p.isMesh) box.expandByObject(p); });   // the crown and brim, not the bobble
  const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const yBrim = box.min.y + (box.max.y - box.min.y) * 0.18;
  let moved = 0;
  u.realBun.forEach((mesh) => {
    const P = mesh.geometry.attributes.position, orig = P.array.slice(), alt = P.array.slice();
    const sk = mesh.isSkinnedMesh && mesh.boneTransform, w = new THREE.Vector3(), t = new THREE.Vector3(), lm = new THREE.Matrix3();
    const world = (i, o) => { if (sk) { mesh.boneTransform(i, o); } else o.fromBufferAttribute(P, i); return o.applyMatrix4(mesh.matrixWorld); };
    const inv = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
    for (let i = 0; i < P.count; i++) {
      world(i, w); if (w.y < yBrim) continue;
      const dx = (w.x - c.x) / r.x, dy = (w.y - c.y) / r.y, dz = (w.z - c.z) / r.z, e = Math.hypot(dx, dy, dz);
      if (e <= 0.88) continue;
      // onto 0.84 of the hat's shape, then the same shift in the mesh's own space (the head bone barely rotates it)
      const f = 0.84 / e; t.set(c.x + (w.x - c.x) * f, c.y + (w.y - c.y) * f, c.z + (w.z - c.z) * f);
      const ld = t.clone().sub(w).applyMatrix3(lm.setFromMatrix4(inv));
      alt[i * 3] += ld.x; alt[i * 3 + 1] += ld.y; alt[i * 3 + 2] += ld.z; moved++;
    }
    mesh.userData.hairPos = { orig, alt };
  });
  return moved;
}
function toHeadBone(m, parts) {
  const u = m.userData, R = u.retarget; if (!R) return 0;
  const e = R.map.find((q) => q.group === u.head); if (!e) return 0;
  G.retarget(m); m.updateMatrixWorld(true);
  let n = 0; for (const p of parts) if (p.parent === u.head) { e.bone.attach(p); n++; }
  return n;
}
/* The scarf's hanging end as a chain of knitted segments with verlet physics: gravity, inertia from the body's
 * motion, a little wind, kept in front of the chest. The built box stays as the fitted anchor (and the dressed
 * flag); it draws nothing itself. Run after each character's pose (people.js, G.animate). */
const _scW = new THREE.Vector3(), _scV = new THREE.Vector3(), _scM = new THREE.Matrix4(), _scDown = new THREE.Vector3(0, -1, 0);
G.simScarf = (c, dt) => {
  const box = c.scarfTail; if (!box) return;
  const u = c.m.userData, ch = u.chest;
  let S = box.userData.sim;
  if (!S) {
    const p = box.geometry.parameters, N = 5;
    S = box.userData.sim = { N, w: p.width, h: p.height, d: p.depth, P: [], Q: [], segs: [] };
    for (let i = 0; i < N; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), box.material); m.castShadow = true; m.userData.gear = true; ch.add(m); S.segs.push(m); }
    box.geometry = new THREE.BufferGeometry();   // the anchor draws nothing now
  }
  const on = box.visible && c.m.visible;
  S.segs.forEach((m) => (m.visible = on));
  if (!on) { S.P.length = 0; return; }
  ch.updateWorldMatrix(true, false);
  // Root (the top of the fitted box) and its rest direction, in the chest's frame.
  const L = (S.h * box.scale.y) / S.N;
  const rootL = new THREE.Vector3(0, (S.h * box.scale.y) / 2, 0).applyEuler(box.rotation).add(box.position);
  const dirL = new THREE.Vector3(0, -1, 0).applyEuler(box.rotation);
  const toW = (v) => v.clone().applyMatrix4(ch.matrixWorld);
  const root = toW(rootL);
  if (!S.P.length || dt > 0.2 || S.P[0].distanceTo(root) > 0.5) {
    S.P = []; S.Q = [];
    for (let i = 0; i <= S.N; i++) { const q = toW(rootL.clone().addScaledVector(dirL, L * i)); S.P.push(q); S.Q.push(q.clone()); }
  }
  const inv = _scM.copy(ch.matrixWorld).invert(), k = u.k || 1;
  // The body's forward, measured from the chest bone out to the scarf root (bone axes differ between rigs, so
  // no fixed local axis); the tail is kept on that side of the chest and lies back against the coat.
  const cpos = new THREE.Vector3().setFromMatrixPosition(ch.matrixWorld), fwd = root.clone().sub(cpos); fwd.y = 0;
  if (fwd.lengthSq() < 1e-6) fwd.set(Math.sin(c.yaw || 0), 0, Math.cos(c.yaw || 0)); fwd.normalize();
  const dRoot = root.clone().sub(cpos).dot(fwd);
  const W = G.WIND || { gust: 0, drift: 0 }, t = G.simT || 0;
  const n = Math.max(1, Math.ceil(dt / (1 / 90))), h = dt / n;
  for (let s = 0; s < n; s++) {
    S.P[0].copy(root); S.Q[0].copy(root);
    const wx = (Math.sin(t * 1.3 + c.x) * 0.5 + 0.5) * W.gust * 0.6, wz = Math.sin(t * 0.9) * W.gust * 0.25;
    for (let i = 1; i <= S.N; i++) {
      const P = S.P[i], Q = S.Q[i];
      _scV.copy(P).sub(Q).multiplyScalar(0.955);   // velocity, with air drag (wool is heavy and soft)
      Q.copy(P);
      P.add(_scV); P.y -= 9.8 * h * h; P.x += wx * h * h * i * 0.4; P.z += wz * h * h * i * 0.4;
    }
    for (let it = 0; it < 4; it++) {
      for (let i = 1; i <= S.N; i++) {
        const A = S.P[i - 1], B = S.P[i];
        _scV.copy(B).sub(A); const d = _scV.length() || 1e-6;
        if (i === 1) B.copy(A).addScaledVector(_scV, L / d);
        else { const corr = (d - L) / d * 0.5; A.addScaledVector(_scV, corr); B.addScaledVector(_scV, -corr); }
      }
      // Knit is a little stiff: each joint leans toward carrying on the line of the one above.
      for (let i = 2; i <= S.N; i++) { _scV.copy(S.P[i - 1]).sub(S.P[i - 2]).add(S.P[i - 1]); S.P[i].lerp(_scV, 0.16); }
      // Not through the chest.
      // Kept on the front of the chest: never inside it, and the lower end lies back against the coat (which
      // slopes away under the scarf) instead of hanging out in the air.
      for (let i = 1; i <= S.N; i++) { const P = S.P[i], d = _scW.copy(P).sub(cpos).dot(fwd), lie = dRoot - 0.004 * k - 0.025 * k * (i / S.N); if (d < lie) P.addScaledVector(fwd, lie - d); else if (d > lie + 0.012 * k) P.addScaledVector(fwd, (lie + 0.012 * k - d) * 0.3); }
      S.P[0].copy(root);
    }
  }
  // Draw each segment between its two points, in the chest's frame.
  for (let i = 0; i < S.N; i++) {
    const a = S.P[i].clone().applyMatrix4(inv), b = S.P[i + 1].clone().applyMatrix4(inv), m = S.segs[i];
    const dv = b.clone().sub(a), len = dv.length() || L;
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(_scDown, dv.normalize());
    m.scale.set(S.w * box.scale.x * (1 - i * 0.03), len * 1.18, S.d * box.scale.z);
  }
};
/* The children's bobble hats and scarf (game.js, kidDress), moved onto a realistic child's head and collar. */
function fitKid(m) {
  const u = m.userData, f = u.fit;
  if (!f || !u.real || !u.kidHat || u.gearFitted) return null;
  u.gearFitted = true;
  const k = u.k;
  return G.atRest(m, () => {
    const inv = new THREE.Matrix4(), v = new THREE.Vector3();
    const pct = (a, q) => { if (!a.length) return 0; a.sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * q))]; };
    const hp = u.kidHat, hat = hp[0], r0 = hat.geometry.parameters.radius;
    const dyHat = (f.skinTop - f.headY + 0.02) - (hat.position.y + r0 * hat.scale.y * 0.85);
    hp.forEach((p) => { p.position.y += dyHat; });
    // Centre it front to back and side to side on the top of this skull and hair.
    hat.updateMatrixWorld(true); inv.copy(hat.matrixWorld).invert();
    let cx = 0, cz = 0, cn = 0;
    const S = f.skull || f.hair;   // the skull alone: a bun or ponytail would pull it backwards
    for (let i = 0; i < S.length; i += 3) { v.set(S[i], S[i + 1], S[i + 2]).applyMatrix4(inv); if (v.y > 0.2 * r0 && v.length() < 1.6 * r0) { cx += v.x; cz += v.z; cn++; } }
    if (cn) { const d = new THREE.Vector3(cx / cn, 0, cz / cn).multiply(hat.scale); hp.forEach((p) => { p.position.x += d.x; p.position.z += d.z; }); }
    hat.updateMatrixWorld(true); inv.copy(hat.matrixWorld).invert();
    const hr = [];
    for (let i = 0; i < f.hair.length; i += 3) { v.set(f.hair[i], f.hair[i + 1], f.hair[i + 2]).applyMatrix4(inv); if (v.y > 0.1 * r0 && v.length() < 1.6 * r0) hr.push(v.length() / r0); }
    const sH = clamp(pct(hr, 0.95) * 1.02, 0.85, 1.25), c0 = hat.position.clone();
    hp.forEach((p) => { p.position.sub(c0).multiplyScalar(sH).add(c0); p.scale.multiplyScalar(sH); });
    const dyScarf = clamp(f.neck - (f.chestY + 0.15 * k), -0.05, 0.05);
    u.bootOff = fitBoots(m, u.kidBoots);
    toHeadBone(m, hp);
    u.scarfDy = dyScarf;   // kept: the scarf can change hands in the prologue (story.js, moveScarf)
    u.kidScarf.forEach((p) => { p.position.y += dyScarf; });
    return { sH: +sH.toFixed(3), dyHat: +dyHat.toFixed(3), dyScarf: +dyScarf.toFixed(3), centre: cn ? [+(cx / cn).toFixed(3), +(cz / cn).toFixed(3)] : null };
  });
}
(G.onBodies = G.onBodies || []).push(() => {
  G.GEAR_FIT = { player: fitGear(PLAYER), partner: fitGear(PARTNER) };
  // A body that was still loading when the game started (the loading screen gives up after 8 s): fitted the
  // moment it's measured, and dressed again if it should be.
  [PLAYER, PARTNER].forEach((c) => {
    const key = herBody(c) ? 'partner' : 'player'; if (G.GEAR_FIT[key]) return;
    const t = setInterval(() => { const r = fitGear(c); if (r) { clearInterval(t); G.GEAR_FIT[key] = r; setDressed(c, !!c.dressed); } }, 400);
  });
  if (G.KIDS) { G.GEAR_FIT.kidPlayer = fitKid(G.KIDS.player); G.GEAR_FIT.kidPartner = fitKid(G.KIDS.partner); }
  // Already dressed when the bodies arrived (a save outdoors): put the jumper under the coat now.
  [PLAYER, PARTNER].forEach((c) => { if (c.dressed) setDressed(c, true); });
});
function setDressed(c, on) {
  c.dressed = on;
  const g = gearOf(c);
  const him = !herBody(c);
  g.parts.forEach((p) => { p.visible = on && !p.userData.replaced && !(him && L.hatGiven && g.hatParts.includes(p)); });   // the snowman has his hat
  if (G.HOOK_COATS) G.HOOK_COATS[him ? 0 : 1].visible = !on;
  BOOTS[him ? 0 : 1].visible = !on;
  // A realistic body's own jumper would poke through the coat: it goes under it, out of sight.
  const mu = (him ? ADULT.player : ADULT.partner).userData;
  (mu.realTop || []).forEach((o) => { o.visible = !on; });
  // Hair that would poke through the knitted hat (her bun and its loose strands) goes under it while it's on.
  const hatOn = on && !(him && L.hatGiven);
  (mu.realBun || []).forEach((o) => { const H = o.userData.hairPos; if (!H) return; const P = o.geometry.attributes.position; P.array.set(hatOn ? H.alt : H.orig); P.needsUpdate = true; });
  const RG = mu.realGear;
  if (RG) Object.keys(RG).forEach((kind) => RG[kind].forEach((o) => { o.visible = on && !(kind === 'hat' && him && L.hatGiven); }));
  // A realistic body with its own long coat wears that instead of the built-on one (hat, scarf, boots stay).
  if (mu.realCoat && mu.realCoat.length) {
    mu.realCoat.forEach((o) => { o.visible = on; });
    g.parts.forEach((p) => { if (p.userData.coatPiece) p.visible = false; });
  }
}
G.setDressed = setDressed;

/* ---------- the mat by the door: boots when they're off, and the puddle they leave ---------- */
const BOOTS = [];
const PUDDLE = (() => {
  const W = G.world;
  const mat = G.add(new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.5), G.std({ map: G.TX.rug, color: '#8a6a48', roughness: 1 })), W, false, true);
  mat.rotation.x = -Math.PI / 2; mat.position.set(5.55, 0.007, 4.22); mat.userData.dynamic = true;
  const tex = G.canvasTex(0, null, { w: 128, h: 128, draw: (c, w, h) => { const g = c.createRadialGradient(64, 64, 6, 64, 64, 62); g.addColorStop(0, 'rgba(90,90,100,1)'); g.addColorStop(0.6, 'rgba(150,150,160,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = g; c.beginPath(); c.ellipse(64, 64, 62, 44, 0, 0, 7); c.fill(); } });
  const pm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.MultiplyBlending, polygonOffset: true, polygonOffsetFactor: -4, color: '#ffffff' });
  const pd = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.46), pm); pd.rotation.x = -Math.PI / 2; pd.position.set(5.55, 0.01, 4.22); pd.renderOrder = 2; W.add(pd);
  const leather = [G.std({ color: '#4a3426', roughness: 0.62, env: 0.4 }), G.std({ color: '#6b4a32', roughness: 0.62, env: 0.4 })];
  [[5.32, 4.22, 0.25, 1.0], [5.76, 4.24, -0.2, 0.86]].forEach(([x, z, ry, s], i) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.userData.dynamic = true; W.add(g);
    for (const dx of [-0.065, 0.065]) {
      G.cyl(0.043 * s, 0.047 * s, 0.17 * s, leather[i], dx, 0.13 * s, -0.02, { parent: g, seg: 14 });
      const f = G.sph(1, leather[i], dx, 0.045 * s, 0.05 * s, [0.05 * s, 0.045 * s, 0.13 * s], g, 16); f.castShadow = true;
    }
    BOOTS.push(g);
  });
  return { mesh: pd, mat: pm, wet: 0 };
})();

/* =====================================================================
 * The cold: frost at the edges of your sight, heavier breath, shivers
 * ===================================================================== */
const frostEl = G.$('frost');
if (frostEl) {
  // A frosted-glass vignette, drawn once: dense feathery crystals at the edges, clear in the middle.
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const c = cv.getContext('2d'), r = G.seeded(77);
  const vg = c.createRadialGradient(256, 256, 120, 256, 256, 362); vg.addColorStop(0, 'rgba(235,245,255,0)'); vg.addColorStop(0.65, 'rgba(225,238,252,0.22)'); vg.addColorStop(1, 'rgba(240,248,255,0.8)');
  c.fillStyle = vg; c.fillRect(0, 0, 512, 512);
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineCap = 'round';
  const branch = (x, y, a, len, w, d) => { if (d > 4 || len < 3) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); for (const s of [-1, 1]) branch(x + (x2 - x) * 0.5, y + (y2 - y) * 0.5, a + s * (0.6 + r() * 0.3), len * 0.5, w * 0.7, d + 1); branch(x2, y2, a + (r() - 0.5) * 0.4, len * 0.7, w * 0.8, d + 1); };
  for (let i = 0; i < 260; i++) {
    const ang = r() * Math.PI * 2, rad = 200 + Math.pow(r(), 0.5) * 170, x = 256 + Math.cos(ang) * rad, y = 256 + Math.sin(ang) * rad;
    branch(x, y, ang + Math.PI + (r() - 0.5) * 1.2, 10 + r() * 26, 1.2 + r() * 1.2, 0);
  }
  frostEl.style.backgroundImage = `url(${cv.toDataURL()})`;
}
const COLD = { outing: false, warned: {}, inT: 0 };
function updateCold(dt) {
  const storm = G.WEATHER.kind === 'heavy' ? 1 : 0;
  for (const c of [PLAYER, PARTNER]) {
    c.cold = c.cold || 0;
    if (G.inCircle && G.inCircle(c.x, c.z)) c.cold = Math.max(0, c.cold - dt * 0.05);   // warm air, inexplicably
    else if (outside(c)) {
      let rate = (0.0026 + 0.0045 * STATE.tod + 0.004 * storm + (G.onIce(c.x, c.z) ? 0.002 : 0)) * (c.dressed ? 1 : 3.4) * (c.speed > 2 ? 0.75 : 1);
      if (c.lie) rate *= 2.2;   // lying in the snow
      c.cold = Math.min(1, c.cold + rate * dt);
    } else if (G.inside(c.x, c.z)) {
      const nearFire = G.FIRE.on && Math.hypot(c.x - FIRE_AT.x, c.z - FIRE_AT.z) < 2.7;
      c.cold = Math.max(0, c.cold - dt * (nearFire ? 0.04 * (0.4 + G.FIRE.level) : 0.011));
    }
    // Snow settles on shoulders and hats while it's falling, and melts away indoors.
    const snowing = outside(c) && STATE.snow > 0.25;
    c.snowAcc = clamp((c.snowAcc || 0) + dt * (snowing ? STATE.snow * 0.012 * (c.speed > 0.3 ? 0.6 : 1) : G.inside(c.x, c.z) ? -0.03 : -0.004), 0, 1);
    const g = gearOf(c), show = c.snowAcc > 0.06;
    g.snow.forEach((s, i) => { const onHat = i === g.snow.length - 1; s.visible = show && (!onHat || (c.dressed && !(!herBody(c) && L.hatGiven) && !(c.m.userData.realGear && c.m.userData.realGear.hat))); if (s.visible) { const b = s.userData.base, f = 0.35 + 0.65 * c.snowAcc, k = c.m.userData.k; s.scale.set(b[0] * k * f, b[1] * k * (0.4 + c.snowAcc), b[2] * k * f); if (s.userData.ys) s.position.y = s.userData.ys[c.dressed ? 0 : 1] * k; } });
  }
  if (frostEl) { const f = smooth(0.38, 1, PLAYER.cold) * 0.92; if (Math.abs((frostEl._o || 0) - f) > 0.004) { frostEl._o = f; frostEl.style.opacity = f.toFixed(3); } }
  // Her side of it.
  const out = outside(PLAYER), inNow = G.inside(PLAYER.x, PLAYER.z);
  if (out && !COLD.outing) { COLD.outing = true; COLD.warned = {}; if (!PLAYER.dressed && S.chapter !== 'prologue') wait2(1.5, () => { if (outside(PLAYER) && !PLAYER.dressed && !freeBark(pick(['Coat, {toHim}! And boots. You’ll catch your death.', 'Where is your coat? It’s snowing, {toHim}.']), 3)) return; if (!L.coatHint) { L.coatHint = 1; G.hint('Your coat and boots are on the hook by the front door.', 5); } }); }
  if (inNow && COLD.outing) {
    COLD.outing = false;
    if (PLAYER.cold > 0.45 && S.chapter !== 'prologue') wait2(1.2, () => freeBark(pick(['You’re frozen! Come and stand by the fire.', 'Look at you. Fire. Now. I insist.']), 3));
  }
  const strange = G.inCircle && G.inCircle(PLAYER.x, PLAYER.z);
  if (out && !strange && PLAYER.cold > 0.72 && !COLD.warned.a) { COLD.warned.a = 1; freeBark(pick(['Your nose has gone from pink to blue. Inside soon?', 'I can’t feel my face. Can you feel yours?']), 3); }
  if (out && !strange && PLAYER.cold > 0.9 && !COLD.warned.b) {
    COLD.warned.b = 1;
    if (!G.busy() && dist() < 3 && PARTNER.mode === 'follow' && !PARTNER.hold && !PARTNER.task && !PARTNER.lead) { G.setHold(true); PARTNER.holdTimer = 16; G.bark('Your hands are ice. Give them here.', 2.8); }
  }
  // Warming up again by the fire.
  if (PLAYER.cold > 0.5) COLD.wasCold = true;
  if (COLD.wasCold && PLAYER.cold < 0.12 && inNow) { COLD.wasCold = false; if (!L.thawHint) { L.thawHint = 1; G.hint('(The warmth comes back into your fingers in pins and needles.)', 5); } }
}
const wait2 = (s, f) => G.wait(s).then(f);

/* ---------- putting coats on and taking them off ---------- */
const coats = A.findInter('coats');
coats.label = () => (PLAYER.dressed ? 'Hang up your coat' : 'Put on your coat and boots');
A.rewire('coats', async () => {
  if (!PLAYER.dressed) {
    setDressed(PLAYER, true);
    await N(A.cyc('coatOn', ['(Coat. Boots. The red scarf, wound twice. You look like a parcel somebody loves.)', '(Coat, boots, scarf. Ready for whatever the weather has in mind.)']));
    if (!S.flags.scarfTalk && A.canHear() && !PARTNER.lie) { S.flags.scarfTalk = 1; await Pt(S.flags.scarfGiven ? 'I have a feeling that scarf was mine once. For about an hour. You’ll say it wasn’t.' : 'You’ve had that red scarf as long as I’ve known you.'); }
    return;
  }
  setDressed(PLAYER, false);
  if (PLAYER.snowyT > 1 || PLAYER.snowAcc > 0.05) PUDDLE.wet = 1;
  PLAYER.snowAcc = 0;
  await N(A.cyc('coatOff', ['(You hang up your coat and kick your boots onto the mat, where they drip contentedly.)', '(Coat on the hook, boots on the mat.)']));
});
REACTadd('coats', ['Hang mine next to yours, please. They like to be together.', 'The unclaimed scarf stays on the hook. It’s a free scarf.']);
function REACTadd(id, lines) { const R = A.REACT[id] || (A.REACT[id] = { lines: [] }); R.lines = R.lines.concat(lines); }

const HANG = { id: 'hang', spot: { x: 5.6, z: 3.85 }, yaw: 0, dur: [0.6, 0.8], look: { x: 5.5, y: 1.4, z: 4.4 } };
/* Partner dresses herself on the way out and hangs her coat up a few seconds after coming in. */
function updatePartnerGear(dt) {
  const p = PARTNER;
  if (S.chapter === 'prologue') return;
  if (!G.inside(p.x, p.z) && !p.dressed && !p.hidden) setDressed(p, true);
  // Indoors in her coat: she goes over to the hooks by the door and hangs it up (wherever she came in from).
  if (G.inside(p.x, p.z) && p.dressed) {
    p.inT = (p.inT || 0) + dt;
    const nearHooks = Math.hypot(p.x - 5.6, p.z - 3.85) < 0.9;
    if (p.inT > 1.5 && (nearHooks || p.inT > 40) && !p.sit) { setDressed(p, false); p.inT = 0; if (p.snowyT > 1) PUDDLE.wet = 1; p.snowAcc = 0; if (Math.random() < 0.6) freeBark(pick(['*hangs her coat beside yours*', '*kicks her boots onto the mat*']), 2); }
    else if (p.inT > 1.5 && !p.task && !p.lead && !p.hold && !p.hidden && p.mode === 'follow' && !G.busy()) p.task = { o: HANG, phase: 'go', t: 0 };
  } else if (!G.inside(p.x, p.z)) p.inT = 0;
  // Coming in from the snow, you hang your coat up by the door on the way past (or soon after).
  if (PLAYER.dressed && G.inside(PLAYER.x, PLAYER.z) && L.cameIn) {
    L.pInT = (L.pInT || 0) + dt;
    const byDoor = Math.hypot(PLAYER.x - 5.6, PLAYER.z - 3.9) < 2.4;
    if (!G.busy() && !(PLAYER.sit > 0.1) && ((byDoor && L.pInT > 1.2) || L.pInT > 7)) {
      setDressed(PLAYER, false); L.cameIn = false; L.pInT = 0;
      if (PLAYER.snowyT > 1 || PLAYER.snowAcc > 0.05) PUDDLE.wet = 1;
      PLAYER.snowAcc = 0;
      G.hint('(You hang up your coat and kick your boots onto the mat.)', 3);
    }
  }
  if (!G.inside(PLAYER.x, PLAYER.z)) { L.cameIn = PLAYER.dressed; L.pInT = 0; }
  // Still in your coat by the fire after a while: she notices.
  if (PLAYER.dressed && G.inside(PLAYER.x, PLAYER.z)) { L.coatInT = (L.coatInT || 0) + dt; if (L.coatInT > 50 && !L.coatTease) { L.coatTease = 1; freeBark('Are you planning to wear that coat all evening, {dear}?', 3); } } else L.coatInT = 0;
  // The puddle on the mat dries; drips while it's fresh.
  PUDDLE.wet = Math.max(0, PUDDLE.wet - dt / 240);
  const k = 1 - PUDDLE.wet * 0.42; PUDDLE.mat.color.setRGB(k, k, k * 1.01);
  PUDDLE.mesh.visible = PUDDLE.wet > 0.01;
  if (PUDDLE.wet > 0.3 && Math.hypot(PLAYER.x - 5.55, PLAYER.z - 4.2) < 3 && Math.random() < dt * 0.25) G.Audio.tone(1800 + Math.random() * 800, 0.02, 0.008);
}

/* =====================================================================
 * The fire: it burns down, and wants feeding from the log basket
 * ===================================================================== */
const F = G.FIRE;
F.fuel = F.on ? 1 : 0;
L.basket = L.basket == null ? 4 : L.basket;
const BASKET = (() => {
  // beside the hearth, in the corner by the bookshelves (it had been left out in the room by the coffee table, 2.5 m
  // from the fire, since the room was made deeper)
  const W = G.world, g = new THREE.Group(); g.position.set(6.7, 0, -1.55); g.userData.dynamic = true; W.add(g);
  const wick = G.std({ map: G.rep(G.TX.knitCream, 3, 1), color: '#9a7a50', roughness: 1 });
  G.cyl(0.24, 0.2, 0.32, wick, 0, 0.16, 0, { parent: g, seg: 22, open: true });
  G.cyl(0.2, 0.2, 0.02, wick, 0, 0.01, 0, { parent: g, seg: 22 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.016, 8, 26), wick); rim.rotation.x = Math.PI / 2; rim.position.y = 0.32; g.add(rim);
  const logs = [];
  // split firewood, as on the fire (G.wood): halves and quarters and the odd round, pale where they were split
  const KINDS = ['half', 'quarter', 'round', 'third', 'half'];
  for (let i = 0; i < 5; i++) { const k = KINDS[i], lg = G.wood(k, k === 'round' ? 0.055 : 0.075, 0.42, 20 + i, i * 1.3 + 0.4); lg.position.set(-0.1 + (i % 3) * 0.1, 0.2 + Math.floor(i / 3) * 0.1, i % 2 ? 0.05 : -0.05); lg.rotation.set(Math.PI / 2 + (i - 2) * 0.12, 0, Math.PI / 2 + (i % 2 ? 0.2 : -0.15)); g.add(lg); logs.push(lg); }
  G.COLL.push({ x0: 6.45, z0: -1.8, x1: 6.95, z1: -1.3 });
  return { g, logs };
})();
const WOODPILE = (() => {
  const W = G.world, g = new THREE.Group(); g.position.set(4.3, 0, 4.92); W.add(g);
  // split firewood (G.wood), weathered grey at the ends: mostly halves and quarters with the odd round, each its own
  // size, laid flat or on edge and a little out of line, so the pile's face is half-moons and wedges and rings. (They
  // were all rounds, cylinders with an end grain disc on.)
  const r = G.seeded(64), KINDS = ['half', 'half', 'quarter', 'round', 'third', 'half', 'round', 'quarter'];
  for (let row = 0; row < 4; row++) for (let i = 0; i < 6 - (row > 2 ? 2 : 0); i++) {
    const k = KINDS[Math.floor(r() * KINDS.length)], rad = k === 'round' ? 0.064 + r() * 0.014 : 0.08 + r() * 0.014;
    const x = -0.45 + i * 0.165 + (row % 2) * 0.08 + (r() - 0.5) * 0.02, y = 0.08 + row * 0.14 + (r() - 0.5) * 0.015, dz = (r() - 0.5) * 0.05;
    const lg = G.wood(k, rad, 0.42, 64 + row * 10 + i, Math.floor(r() * 4) * (Math.PI / 2) + (r() - 0.5) * 0.4, G.WOOD_OUT);   // laid flat side down, or on edge lg.position.set(x, y, dz); lg.rotation.x = Math.PI / 2; g.add(lg);
  }
  G.box(1.1, 0.05, 0.5, G.MAT.snow, -0.05, 0.6, 0, { parent: g, r: 0.02 });
  G.COLL.push({ x0: 3.72, z0: 4.65, x1: 4.88, z1: 5.18 });
  return g;
})();
function armful(m, n) {
  const u = m.userData, k = u.k, g = new THREE.Group(); g.position.set(0, -0.2 * k, 0.19 * k); g.visible = false; g.userData.warm = true; u.chest.add(g);   // resting on the forearms
  for (let i = 0; i < n; i++) { const lg = new THREE.Mesh(G.woodGeo(['half', 'quarter', 'round'][i % 3], i % 3 === 2 ? 0.052 : 0.07, 0.42, 40 + i, i * 2.1 + 0.5), G.WOOD_M); lg.rotation.z = Math.PI / 2 + (i - 1) * 0.08; lg.position.set((i - 1) * 0.02, (i % 2) * 0.07 - 0.02, (i % 2) * -0.035); lg.castShadow = true; lg.userData.warm = true; lg.userData.gear = true; g.add(lg); }   // gear: not hidden with the built-in body when the real one loads
  return g;
}
const ARMS = { player: armful(ADULT.player, 3), partner: armful(ADULT.partner, 2) };
const armsOf = (c) => (herBody(c) ? ARMS.partner : ARMS.player);
function setCarry(c, on) { c.carry = on; armsOf(c).visible = on; }
// Her feeding the fire: kneel at the hearth, a log on, sparks; a word if you're there to hear it.
const STOKE = { at: -99, id: 'stoke', spot: { x: 8.05, z: -0.75 }, yaw: Math.PI, dur: [2.2, 2.6], look: { x: 8.0, y: 0.35, z: -1.8 },
  onArrive: (p) => { p.forcePose = 'warm'; },
  onEnd: (p) => { p.forcePose = null; if (L.basket > 0 && F.on) { L.basket--; F.fuel = Math.min(1, F.fuel + 0.42); G.Audio.catchFire ? G.Audio.catchFire() : G.Audio.poke(); G.sparkBurst && G.sparkBurst(); freeBark(pick(['There. Can’t have it going out on us.', 'One more log. It was looking at me.', 'Fire’s fed. You’re welcome.']), 2.8); } } };
const fire = A.findInter('fire');
fire.label = () => (!F.on ? 'Light the fire' : F.fuel < 0.62 && L.basket > 0 ? 'Add a log' : 'Poke the fire');
const pokeAct = fire.raw;
A.rewire('fire', async () => {
  if (!F.on) {
    if (L.basket <= 0) { await N('(No logs. The basket by the hearth is empty, and the woodpile is out on the porch.)'); return; }
    L.basket--; F.fuel = 0.6; F.on = true; G.Audio.blow(); setTimeout(() => G.Audio.catchFire && G.Audio.catchFire(), 500);
    await N('(It takes three matches and a certain amount of quiet swearing.)');
    if (A.canHear()) await Pt('The fire person, at work. My hero, {toHim}.');
    return;
  }
  if (F.fuel < 0.62 && L.basket > 0) {
    L.basket--; F.fuel = Math.min(1, F.fuel + 0.42); G.Audio.poke(); G.sparkBurst();
    await N(A.cyc('addLog', ['(You set a log on the embers. It thinks about it, then catches with a pleased little roar.)', '(Another log. The fire settles in for the long haul.)', '(A log on the fire. Sparks go up the chimney like they have somewhere to be.)']));
    if (L.basket === 0 && !L.emptyHint) { L.emptyHint = 1; G.hint('That was the last log in the basket. There’s a woodpile on the porch.', 5); }
    return;
  }
  await pokeAct();
});
A.inter('basket', [6.7, 0.4, -1.2], 0.8, () => (PLAYER.carry ? 'Fill the log basket' : 'Log basket'), async () => {
  if (PLAYER.carry) {
    const helped = PARTNER.carry; setCarry(PLAYER, false); if (helped) setCarry(PARTNER, false);
    L.basket = Math.min(5, L.basket + (helped ? 5 : 3)); G.Audio.poke();
    await N(helped ? '(Five logs in the basket, stacked by two people with very different ideas about stacking.)' : '(You stack the logs in the basket. Enough for the evening.)');
    return;
  }
  await N(L.basket ? `(${['', 'One log', 'Two logs', 'Three logs', 'Four logs', 'Five logs'][L.basket]} in the basket.)` : '(Empty. The woodpile is out on the porch.)');
});
A.inter('woodpile', [4.3, 0.6, 5.4], 0.85, () => (PLAYER.carry ? 'Woodpile' : 'Take an armful of logs'), async () => {
  if (PLAYER.carry) { await N('(Your arms are full already.)'); return; }
  if (PLAYER.freeSit) return;
  setCarry(PLAYER, true);
  await N(A.cyc('logs', ['(An armful of logs, cold and sweet-smelling, with snow in the bark.)', '(Another armful. Your arms remember the shape.)']));
  if (A.canHear() && PARTNER.mode === 'follow' && !PARTNER.task && !PARTNER.lie && !PARTNER.carry && !PARTNER.hold && dist() < 4) { setCarry(PARTNER, true); G.bark(pick(['I’ll take the small ones.', 'Give me two. I’m stronger than I look.']), 2.4); }
});
A.REACT.basket = { lines: ['Thank you, {toHim}. You do keep us warm.'] };
A.REACT.woodpile = { lines: ['Mind your back. It’s the only one you have.', 'The one at the bottom is the load-bearing log. Don’t touch it.'] };
function updateFire(dt) {
  if (F.on && !F._was && F.fuel < 0.05) F.fuel = 0.6;   // lit by a scene
  F._was = F.on;
  if (S.chapter !== L.ch) { L.ch = S.chapter; if (F.on) F.fuel = 1; L.basket = Math.max(L.basket, 3); PUDDLE.wet = 0; }
  if (F.on) {
    F.fuel = Math.max(0, F.fuel - dt / 480);
    if (F.fuel <= 0) { F.outT = (F.outT || 0) + dt; if (F.outT > 50) { F.on = false; F.outT = 0; freeBark('Oh. The fire’s gone out.', 2.6); } } else F.outT = 0;
    // Low, with logs in the basket and her at a loose end nearby: she sees to it herself.
    const p = PARTNER;
    if (F.fuel < 0.28 && S.chapter !== 'night' && L.basket > 0 && G.simT - STOKE.at > 30 && !G.busy() && p.mode === 'follow' && !p.task && !p.lead && !p.hold && !p.hidden && !p.lie && !p.carry && G.inside(p.x, p.z) && Math.hypot(p.x - 8, p.z - 0.2) < 8 && /^(morning|evening|ending_|firstsnow)/.test(S.chapter || '')) {
      STOKE.at = G.simT;
      p.task = { o: STOKE, phase: 'go', t: 0 };
    }
    if (F.fuel < 0.2 && !L.lowWarned && S.chapter !== 'night') { L.lowWarned = 1; freeBark(pick(['The fire’s getting sleepy, {dear}.', 'Is it me, or is it getting colder in here?']), 3); }
    if (F.fuel > 0.4) L.lowWarned = 0;
  }
  F.level = !F.on ? 0 : F.fuel > 0.02 ? 0.3 + 0.7 * smooth(0, 0.55, F.fuel) : 0.14;   // embers when it's nearly out
  BASKET.logs.forEach((lg, i) => { lg.visible = i < L.basket; });
  // Logs are heavy, and you can't sit down with an armful.
  PLAYER.speedMul = (PLAYER.carry ? 0.8 : 1) * (G.surfaceAt(PLAYER.x, PLAYER.z) === 'snow' ? 0.84 : 1) * (PLAYER.extraMul || 1);
  if (PLAYER.carry) armsOf(PLAYER).visible = !(PLAYER.sit > 0.2);
  if (PARTNER.carry && (PARTNER.sit > 0.2 || PARTNER.hidden || PARTNER.lie)) setCarry(PARTNER, false);
}

/* =====================================================================
 * Weather: calm, light snow, heavier snow, the odd short blizzard, clear spells
 * ===================================================================== */
const KINDS = {
  clear: { snow: 0.0, bias: -0.22, fog: 1.12 },
  light: { snow: 0.3, bias: -0.06, fog: 1 },
  snow: { snow: 0.75, bias: 0.06, fog: 0.82 },
  heavy: { snow: 1.0, bias: 0.34, fog: 0.5 },
};
const PLAN = { morning: ['light', 'clear', 'light', 'snow', 'light'], walk: ['clear', 'light', 'clear', 'light'], evening: ['snow', 'heavy', 'snow', 'light', 'snow'] };
const WEATHER = (G.WEATHER = { kind: 'snow', t: 0, next: 150, i: 0, ch: null, hold: null });
G.WEATHER_PLAN = PLAN;   // variety.js reshuffles it for each playthrough
function setWeather(kind, quiet) {
  const K = KINDS[kind]; if (!K) return;
  WEATHER.kind = kind; STATE.snowTarget = K.snow; G.WIND.biasTarget = K.bias; STATE.fogK = K.fog;
  if (quiet) return;
  if (kind === 'heavy') { G.Audio.rattle(); wait2(2, () => freeBark(pick(['Listen to that. The wind’s trying the door.', 'Here it comes. Proper snow now.']), 3)); }
  if (kind === 'clear' && STATE.day > 0.5) wait2(3, () => freeBark(pick(['Oh, look. The sun’s out.', 'The snow’s stopped. Everything’s sparkling.']), 3));
}
G.setWeather = setWeather;
function updateWeather(dt) {
  const ch = S.chapter;
  if (!PLAN[ch]) { if (WEATHER.ch) { WEATHER.ch = null; G.WIND.biasTarget = 0; STATE.fogK = 1; } return; }
  if (WEATHER.ch !== ch) { WEATHER.ch = ch; WEATHER.i = 0; WEATHER.t = 0; WEATHER.next = 120 + Math.random() * 90; WEATHER.kind = PLAN[ch][0]; G.WIND.biasTarget = KINDS[WEATHER.kind].bias; STATE.fogK = KINDS[WEATHER.kind].fog; return; }   // the chapter set its own snow; leave it for the first spell
  if (WEATHER.hold) { if (WEATHER.kind !== WEATHER.hold) setWeather(WEATHER.hold, true); return; }   // a scene wants particular weather
  if (STATE.todTarget > 0.5 && WEATHER.kind !== 'clear') { setWeather('clear', true); return; }   // stars on the porch: a clear night
  WEATHER.t += dt;
  if (WEATHER.t > WEATHER.next && !G.busy()) {
    WEATHER.t = 0; WEATHER.i = (WEATHER.i + 1) % PLAN[ch].length;
    const kind = PLAN[ch][WEATHER.i];
    WEATHER.next = (kind === 'heavy' ? 50 : 110) + Math.random() * 90;   // blizzards are short
    setWeather(kind);
  }
  if (WEATHER.kind === 'heavy' && G.WIND.gust > 0.9 && Math.random() < dt * 0.3) G.Audio.rattle();
}

/* =====================================================================
 * Partner's own time: things she does when you leave her to it
 * ===================================================================== */
const book = (() => {
  const u = ADULT.partner.userData, k = u.k, g = new THREE.Group(); g.position.set(0, -0.12 * k, 0.22 * k); g.rotation.x = -0.75; g.visible = false; g.userData.warm = true; u.chest.add(g);
  const cover = G.std({ color: '#3a5a6a', roughness: 0.8 });
  for (const s of [-1, 1]) { const half = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.004, 0.13), cover); half.position.set(s * 0.045, 0, 0); half.rotation.z = -s * 0.25; g.add(half); const pg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.12), G.shared({ color: '#efe6d2', roughness: 0.9 })); pg.position.set(s * 0.043, 0.007, 0); pg.rotation.z = -s * 0.25; g.add(pg); }
  g.traverse((o) => { o.userData.warm = true; o.userData.gear = true; o.castShadow = true; });   // gear: kept when the built-in body is hidden for the real one
  return g;
})();
G.PARTNER_BOOK = book;
const can = (() => {
  const W = G.world, g = new THREE.Group(); g.position.set(13.78, 0.9, 0.38); g.userData.dynamic = true; W.add(g);
  const zinc = G.std({ color: '#8a9aa0', roughness: 0.35, metalness: 0.8, env: 1 });
  G.cyl(0.07, 0.075, 0.15, zinc, 0, 0.075, 0, { parent: g, seg: 16 });
  const sp = G.cyl(0.012, 0.018, 0.2, zinc, 0.1, 0.11, 0, { parent: g, seg: 8 }); sp.rotation.z = -0.9;
  const hd = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 14, Math.PI), zinc); hd.position.set(-0.02, 0.15, 0); g.add(hd);
  return { g, home: g.position.clone() };
})();
const handOf = (m) => ADULT.partner.userData.arms[0].hand;
function holdCan(on) {
  if (on) { handOf().add(can.g); can.g.position.set(0, -0.15, 0.03); can.g.rotation.set(0, Math.PI / 2, 0); }
  else { G.world.add(can.g); can.g.position.copy(can.home); can.g.rotation.set(0, 0, 0); }
}
const alone = () => dist() > 5.5 || !A.sameRoom();
const SOLO = [
  { id: 'read', solo: true, stay: true, spot: { x: 6.95, z: 0.5 }, seatAt: { x: 6.22, z: 0.97, yaw: 2.23, y: 0.47 }, dur: [70, 130],
    cond: () => soloOK('read') && !(PLAYER.freeSit && Math.hypot(PLAYER.x - 6.22, PLAYER.z - 1.97) < 0.6) && G.inside(PLAYER.x, PLAYER.z),
    lines: ['I’ll just read for a bit. Don’t let me fall asleep.', 'Chapter eleven. Again.'],
    onArrive: (p) => { book.visible = true; p.holdPose = 'read'; }, onTick: dozeTick, onEnd: (p) => { book.visible = false; p.holdPose = null; wake(p, true); } },
  { id: 'nap', solo: true, stay: true, spot: { x: 6.55, z: 2.95 }, seatAt: { x: 7.45, z: 2.95, yaw: Math.PI, y: 0.6 }, dur: [60, 120],
    cond: () => soloOK('nap') && S.chapter === 'evening' && !(PLAYER.sit > 0.2),
    lines: ['I’m only resting my eyes.', '*curls up in the corner of the sofa*'], onTick: dozeTick, onEnd: (p) => wake(p, true) },
  { id: 'radio', solo: true, stay: true, sway: true, spot: { x: 13.75, z: 4.1 }, yaw: 0.3, dur: [40, 80],
    cond: () => soloOK('radio'),
    onArrive: (p) => { if (!G.Audio.radioOn()) { G.Audio.radio(true); G.KITCHEN.radioDial.material.opacity = 0.9; G.bark(pick(['A little music, I think.', 'This kitchen needs a song.']), 2.6); } else G.bark('Oh, I like this one.', 2.2); },
    onTick: (p, dt, T) => { T.humT = (T.humT == null ? 6 : T.humT) - dt; if (T.humT < 0) { T.humT = 12 + Math.random() * 10; G.Audio.hum(); } if (!G.Audio.radioOn()) T.abort = true; p.swayTarget = 0.6; } },
  { id: 'water', solo: true, stay: true, spot: { x: 13.78, z: -1.42 }, dur: [90, 90],
    cond: () => soloOK('water') && !L.watered,
    onArrive: (p, T) => waterRound(p, p.task), onEnd: (p) => { holdCan(false); p.holdPose = null; } },
];
function soloOK(id) { return STATE.autonomy && S.chapter !== 'prologue' && Math.random() < 0.6 && (G.simT - (L['solo_' + id] || -999)) > 150; }
SOLO.forEach((o) => { const arrive = o.onArrive; o.onArrive = (p) => { L['solo_' + o.id] = G.simT; if (arrive) arrive(p, p.task); }; });
G.SMART.push(...SOLO);
// Reading or curled up on the sofa: left alone long enough, she drifts off. Coming back wakes her.
function dozeTick(p, dt, T) {
  T.aloneT = alone() ? (T.aloneT || 0) + dt : 0;
  if (!p.dozing && T.t > 18 && T.aloneT > 22) { p.dozing = true; p.lidsClosed = true; p.tiltTarget = -0.3; p.headDown = 0.25; if (p.holdPose === 'read') p.holdPose = 'cup'; }
  if (p.dozing) {
    T.t = Math.min(T.t, T.dur - 5);   // she isn't going anywhere while she's asleep
    if (dist() < 1.7) { T.nearT = (T.nearT || 0) + dt; if (T.nearT > 1.6) wake(p); } else T.nearT = 0;
  }
}
function wake(p, quiet) {
  if (!p.dozing) return;
  p.dozing = false; p.lidsClosed = false; p.tiltTarget = 0; p.headDown = 0;
  if (p.holdPose === 'cup' && book.visible) p.holdPose = 'read';
  if (!quiet) { G.bark(pick(['Mm? I was resting my eyes.', 'I wasn’t asleep. I was reading with my eyes closed.', '…Oh. Hello. How long was I out?']), 2.8); S.mem.dozes = (S.mem.dozes || 0) + 1; }
}
async function waterRound(p, T) {
  const live = () => p.task === T;
  holdCan(true);
  const pour = async (x, z, look) => {
    await G.walkTo(p, x, z, 1.1); if (!live()) return false;
    p.yaw = Math.atan2(look[0] - p.x, look[2] - p.z); G.gaze(p, look, 4);
    p.holdPose = 'water'; G.Audio.tone && pourSound();
    await G.wait(3.6); p.holdPose = null; return live();
  };
  if (!(await pour(12.82, 4.1, [12.82, 0.95, 4.47]))) return;
  G.bark(pick(['There you are, herbs. Drink up.', 'Thyme, rosemary, and the one we can’t identify.']), 2.6);
  if (!(await pour(9.85, 3.72, [10.4, 0.7, 4.2]))) return;
  G.bark(pick(['Basil. Darling. Don’t drink it all at once.', 'You’re doing wonderfully, Basil.']), 2.6);
  L.watered = true;
  await G.walkTo(p, 13.78, -1.42, 1.1); if (!live()) return;
  T.abort = true;
}
function pourSound() { for (let i = 0; i < 14; i++) G.Audio.tone(900 + Math.random() * 1400, 0.03, 0.004, i * 0.2 + Math.random() * 0.1); }
// Run off and leave her behind indoors, and she settles into something of her own.
function updateSolo(dt) {
  const p = PARTNER;
  if (!STATE.autonomy || STATE.asHer || p.mode !== 'follow' || p.task || p.lead || p.hold || p.hidden || p.lie || G.busy()) { L.leftT = 0; return; }
  if (dist() > 7 && G.inside(p.x, p.z)) {
    L.leftT = (L.leftT || 0) + dt;
    if (L.leftT > 2.5) {
      L.leftT = 0;
      const opts = SOLO.filter((o) => (!o.cond || o.cond()) && Math.hypot(o.spot.x - p.x, o.spot.z - p.z) < 6);
      if (opts.length) { const o = opts[0]; p.task = { o, phase: 'go', t: 0 }; G.bark(pick(['I’ll be in here, {toHim}.', 'Go on, then. I’ll find something to do.', 'Fine. Leave me. I have a book.']), 2.4); }
    }
  } else L.leftT = 0;
}
G.onQuiet = () => { for (const c of [PLAYER, PARTNER]) { setCarry(c, false); c.cold = 0; c.snowAcc = 0; } book.visible = false; holdCan(false); };
G.onLoadSave = () => {};

// The evening's set pieces take her away from whatever she was doing (and wake her, gently).
for (const k of ['cake', 'cuddle', 'porch']) {
  const f = G.Story[k];
  G.Story[k] = function (...a) { if (PARTNER.task) { wake(PARTNER, true); G.endPartnerTask(); } setCarry(PARTNER, false); return f.apply(this, a); };
}
G.STEP_HOOKS.push((dt) => {
  if (!STATE.started) return;
  updateCold(dt); updatePartnerGear(dt); updateFire(dt); updateWeather(dt); updateSolo(dt);
  // After the cake, the evening is hers too: she wanders off to things she likes.
  if (S.chapter === 'evening' && STATE.cakeDone && !STATE.porchDone && !G.busy()) STATE.autonomy = true;
});
setDressed(PLAYER, false); setDressed(PARTNER, false);
// The scarf ends that get simulated: one per adult (the gear's hanging box).
[PLAYER, PARTNER].forEach((c) => { c.scarfTail = gearOf(c).parts.find((p) => p.userData.scarfTail) || null; });
});
