'use strict';
/* =========================================================================
 * Act IV · The Same Day, and the endings.
 * You wake in a house that is almost exactly right. The imitation has made
 * breakfast. Whatever she left behind in Elsewhere is in the kitchen. Her
 * whistle comes from the summer circle, out past the meadow, and the real
 * one is sitting there in the green, where someone small once sat. The way
 * home is a door standing on its own in the snow, and it only opens for two.
 * Five endings, never labelled good or bad: You Found Me, Uncertain Morning,
 * I Know It's You, The Perfect Partner, Stay Here.
 * ========================================================================= */
(G.afterBuild = G.afterBuild || []).push(() => {
const { PLAYER, PARTNER, STATE } = G;
const A = G.SAPI, S = A.S;
const { P, Y, N, choose, wait, until, fixed, V, CH, checkpoint, inter, rewire, findInter, addBond, addScrap, quiet, houseFor, setBreakfast, cyc } = A;
const K = (o) => ({ shot: 'keep', ...o });
const dist = () => Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
const here = () => S.chapter === 'lastbirthday';
const W = G.world, fy = (x, z) => G.floorAt(x, z);
const CIRCLE = { x: -3.6, z: 45.0 };   // where the real one waits (out on the frozen lake instead, if it kept her)
const kept = () => !!S.flags.keptHer;
const GATE = { x: 6.5, z: 9.6 };          // the bottom of the porch path: it asks you not to go
const EXIT = { x: 1.6, z: 27.5 };         // the door in the snow, in the meadow, on the way home
const trust = (n) => { S.vars.trust = (S.vars.trust || 0) + n; };
const accepted = () => (S.vars.taken || 0) * 0.35 + (S.vars.corruption || 0) + (S.flags.wentBack ? 0.5 : 0) + (S.flags.ateBreakfast ? 0.5 : 0);
const E = (t, o) => N('“' + t + '”', o);   // the Entity speaks without a body, mostly
const fade = async (on, sec = 1.6, col = '#000') => { const f = G.$('fade'); f.style.background = col; f.style.transition = 'opacity ' + sec + 's'; if (on) f.classList.add('on'); else f.classList.remove('on'); await wait(sec + 0.1); if (!on) { f.style.transition = ''; f.style.background = ''; } };

/* ---------- things built once ---------- */
// Her sign, in the kitchen, wherever she left it.
const SIGN = (() => {
  const g = new THREE.Group(); g.visible = false; W.add(g);
  const cone = G.shared({ color: '#6a4a2e', roughness: 0.95 });
  const cones = new THREE.Group(); g.add(cones);
  for (let i = 0; i < 7; i++) { const s = 1 - i * 0.08, m = new THREE.Mesh(new THREE.ConeGeometry(0.03 * s, 0.09 * s, 8), cone); m.rotation.z = Math.PI / 2; m.position.set(12.55 + i * 0.13, 1.0, -1.98); cones.add(m); }
  const plate = new THREE.Group(); g.add(plate);
  G.cyl(0.13, 0.11, 0.015, G.shared({ color: '#f2efe8', roughness: 0.4 }), 13.0, 0.79, 2.95, { parent: plate, seg: 20 });
  const pc = G.cyl(0.085, 0.085, 0.022, G.shared({ color: '#d7a45c', roughness: 0.8 }), 13.0, 0.81, 2.95, { parent: plate, seg: 20 });
  pc.scale.x = 0.62;
  const note = new THREE.Group(); g.add(note);
  const pg = G.box(0.21, 0.004, 0.28, G.shared({ color: '#efe6d2', roughness: 0.9 }), 13.0, 0.79, 2.95, { parent: note }); pg.rotation.y = -0.3;
  return { g, cones, plate, note, pos: { pinecones: [13.0, 1.0, -1.6], pancake: [13.0, 0.85, 2.6], note: [13.0, 0.85, 2.6] } };
})();
// A door standing on its own in the snow. Warm light round the edges.
const EXD = (() => {
  const g = new THREE.Group(); g.visible = false; W.add(g);
  const y = fy(EXIT.x, EXIT.z); g.position.set(EXIT.x, y, EXIT.z); g.rotation.y = 0;
  const wood = G.MAT.darkWood;
  G.box(0.08, 2.1, 0.1, wood, -0.5, 1.05, 0, { parent: g }); G.box(0.08, 2.1, 0.1, wood, 0.5, 1.05, 0, { parent: g }); G.box(1.08, 0.08, 0.1, wood, 0, 2.1, 0, { parent: g });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 2.04), new THREE.MeshBasicMaterial({ color: '#ffd7a0', transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }));
  glow.position.set(0, 1.03, 0.01); g.add(glow);
  const hinge = new THREE.Group(); hinge.position.set(-0.46, 0, 0.02); g.add(hinge);
  const leaf = G.box(0.9, 2.0, 0.05, G.shared({ color: '#6b4a34', roughness: 0.8 }), 0.45, 1.02, 0, { parent: hinge });
  G.box(0.06, 0.06, 0.06, G.shared({ color: '#c9a45c', roughness: 0.3, metalness: 0.8 }), 0.82, 1.0, 0.05, { parent: hinge });
  const light = { intensity: 0 };   // no real light: a new light would recompile every material
  G.box(1.4, 0.08, 0.5, G.MAT.snow, 0, 0.0, 0, { parent: g, r: 0.03 });
  G.addCollider({ x0: EXIT.x - 0.6, z0: EXIT.z - 0.12, x1: EXIT.x + 0.6, z1: EXIT.z + 0.12 });
  return { g, leaf, hinge, glow, light, leak: leaf };
})();
// The Entity, when it finally stands in front of you: tall, pale, not quite a person, mostly snow.
const ENT = (() => {
  // "Like snow that has decided to stand": a person's shape in packed, glittering snow, no face, slightly too
  // tall, flakes lifting off it and drifting round. One material, so the scene fades it in and out with opacity.
  const g = new THREE.Group(); g.visible = false; W.add(g);
  const mat = new THREE.MeshStandardMaterial({ color: '#f2f6fc', emissive: '#8fa6cc', emissiveIntensity: 0.1, roughness: 0.9, transparent: true, opacity: 0, depthWrite: false, bumpMap: G.TX.snowN, bumpScale: 0.06 });
  // packed snow, not paper: a cold rim of moonlight round the edges and a faint sparkle across the surface
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.5);
      float sp = step(0.985, fract(sin(dot(floor(gl_FragCoord.xy / 2.0), vec2(12.9898, 78.233))) * 43758.5453));
      gl_FragColor.rgb += vec3(0.55, 0.68, 0.9) * rim * 0.55 + vec3(0.6) * sp * 0.5;`);
  };
  const lathe = (pts, seg = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  // body: feet to shoulders, one soft shape (a long coat of snow), and the neck
  const body = new THREE.Mesh(lathe([[0.001, 0], [0.2, 0.02], [0.24, 0.35], [0.22, 0.8], [0.19, 1.05], [0.21, 1.3], [0.24, 1.52], [0.2, 1.62], [0.08, 1.7], [0.06, 1.78], [0.001, 1.8]]), mat);
  body.scale.z = 0.62; g.add(body);
  const drift = new THREE.Mesh(lathe([[0.001, 0.09], [0.22, 0.07], [0.36, 0.035], [0.48, 0.0], [0.5, -0.02]], 24), mat); drift.scale.z = 0.8; g.add(drift);   // snow gathered round its feet
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 14), mat); head.position.y = 1.93; head.scale.set(0.9, 1.15, 1.0); g.add(head);
  for (const s of [-1, 1]) {   // arms, hanging a little away from the body
    const arm = new THREE.Mesh(lathe([[0.001, -0.36], [0.04, -0.35], [0.05, -0.3], [0.055, 0.2], [0.06, 0.33], [0.001, 0.37]], 12), mat);   // (r128 has no capsule)
    arm.position.set(s * 0.27, 1.2, 0); arm.rotation.z = s * 0.1; g.add(arm);
  }
  // flakes coming off it and drifting about
  const N = 220, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { seed[i] = Math.random(); pos[i * 3] = (Math.random() - 0.5) * 0.6; pos[i * 3 + 1] = Math.random() * 2.1; pos[i * 3 + 2] = (Math.random() - 0.5) * 0.4; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pmat = new THREE.PointsMaterial({ color: '#ffffff', size: 0.025, transparent: true, opacity: 0, depthWrite: false });
  const flakes = new THREE.Points(pg, pmat); g.add(flakes);
  G.TICKERS.add((dt) => {
    if (!g.visible) return;
    pmat.opacity = mat.opacity * 1.4;
    const t = G.simT || 0;
    for (let i = 0; i < N; i++) {
      let y = pos[i * 3 + 1] + dt * (0.08 + seed[i] * 0.12); if (y > 2.4) y = Math.random() * 0.4;
      pos[i * 3 + 1] = y; pos[i * 3] += Math.sin(t * 0.7 + seed[i] * 40) * dt * 0.05 + dt * 0.02; pos[i * 3 + 2] += Math.cos(t * 0.6 + seed[i] * 30) * dt * 0.04;
      if (Math.abs(pos[i * 3]) > 0.7) pos[i * 3] *= 0.3;
    }
    pg.attributes.position.needsUpdate = true;
    g.rotation.y += Math.sin(t * 0.3) * dt * 0.02;   // it never quite stands still
  });
  return { g, mat };
})();

G.ENT = ENT;   // (tests)
const MUG3 = (() => { const m = G.cyl(0.04, 0.035, 0.09, G.shared({ color: '#e8e2d6', roughness: 0.4 }), 13.42, 0.97, -1.98, { seg: 14 }); m.rotation.x = Math.PI; m.visible = false; return m; })();
(G.onJump = G.onJump || []).push(() => { SIGN.g.visible = false; TRAIL.g.visible = false; EXD.g.visible = false; ENT.g.visible = false; MUG3.visible = false; G.WALK && G.WALK.showCircle(false); });
/* ---------- what it takes: a memory at a time. A scrapbook page goes blank; the photograph loses one of them. ---------- */
G.take = () => {
  S.vars.taken = (S.vars.taken || 0) + 1;
  const pages = S.scrap.filter((p) => !p.taken && !/^end_/.test(p.art));
  const p = pages.length ? pages[Math.floor(Math.random() * pages.length)] : null;
  if (p) p.taken = true;
  if (S.vars.taken === 1 && G.EVE && G.EVE.photo) {
    const m = G.EVE.photo.material.map; if (m && m.image && m.image.getContext) { const x = m.image.getContext('2d'), c = x.getImageData(150, 110, 1, 1).data, g = x.getImageData(150, 200, 1, 1).data; x.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; x.fillRect(132, 112, 27, 56); x.fillStyle = `rgb(${g[0]},${g[1]},${g[2]})`; x.fillRect(132, 168, 27, 18); m.needsUpdate = true; }
  }
  G.observe('take', p ? 'I took “' + (p.caption || p.art).slice(0, 40) + '”. It was mine anyway.' : 'I took something small.');
  return p;
};

/* ---------- The First Snow: after any ending, one more morning. No Entity, nothing wrong. Just them. ---------- */
G.firstSnowOpen = () => { try { return JSON.parse(localStorage.getItem('snowed.endings') || '[]').some((e) => e !== 'firstsnow'); } catch (e) { return false; } };
CH.firstsnow = async () => {
  // One more morning, with nothing else in it. It remembers the day you actually had: what you drew in the frost,
  // the book, the fox, the cocoa, the photographs; and, unlike the imitation, it doesn't remember the score.
  checkpoint('firstsnow'); home(true); STATE.watchDoor = false;
  G.setTime({ day: 1, tod: 0, snow: 0.0 }, true); G.WEATHER.hold = 'light';
  const F = S.flags;
  await wait(0.3); fade(false, 2.4, '#fff'); await wait(1);
  await N('(Morning. An ordinary one. Two people, one blanket, the window going slowly white.)', K());
  await P('Hello, {dear}.', K());
  await Y('Hello, {dear}.', K());
  await P('Look. It’s starting.', K());
  await N('(The first snow of the winter. Slow and soft and in no hurry at all.)', K());
  await P('Five more minutes. Snow-day rules.', K());
  await N('(It is not five minutes.)', K());
  // The kitchen: the kettle, the frosted window, the fridge.
  const kshot = fixed(V(13.85, 1.5, 3.15), V(12.9, 1.3, 4.5), 44, 0.012);
  await G.cutTo(() => { PLAYER.lie = PARTNER.lie = false; G.setDressed(PLAYER, false); G.setDressed(PARTNER, false); G.standAt(PLAYER, 12.35, 3.95, 0.35); G.standAt(PARTNER, 12.72, 4.05, 0.25); PARTNER.mode = 'still'; G.setShot(kshot); }, 0.6);
  await N('(The kitchen. The kettle starting to tick. The window by the table has frosted over in the night.)', K());
  const kind = F.eveFrost || 'heart';
  PARTNER.forcePose = 'wave'; await wait(0.5);
  if (G.MOM) G.MOM.drawFrost(kind, true);
  PARTNER.forcePose = null;
  if (!F.eveFrost) await N('(She draws a heart in the frost, and then, next to it, a second, lopsided one. “It’s an ordinary amount of soppy. Don’t look at it like that.”)', K());
  else if (kind === 'heart') await N('(Without saying anything, she draws two hearts in the frost. The second one lopsided. On purpose.)', K());
  else if (kind === 'snowman') await N('(She draws a snowman in the frost and gives him a very tall hat. “He came back. They always come back.”)', K());
  else await N('(She writes “11–9” in the frost, looks at it, and crosses it out. “Recount. Always.”)', K());
  if (F.eveCocoa) { await P('Tea, please. One sugar.', K()); await N('(You put in one. She reaches past you and puts in a second. It fell.)', K()); }
  else { await P('Tea, please. However you make it. You make it wrong. I like it.', K()); }
  if (S.photos && S.photos.length) await N(F.photoAltered ? '(On the fridge door, yesterday’s photographs, a little crooked. Two people in every one of them. Nobody else.)' : '(On the fridge door, yesterday’s photographs, a little crooked. Two people, mostly blinking.)', K());
  // The window seat, if you read together: the book, still halfway.
  if (F.eveRead) {
    const Nk = G.NOOK, rshot = fixed(V(Nk.x - 0.45, 1.25, Nk.z + 0.95), V(Nk.x + 0.12, 0.88, Nk.z - 0.05), 56, 0.012);
    if (G.MOM) G.MOM.FROST.m.visible = false;
    await G.cutTo(() => { G.sitAt(PLAYER, Nk.x + 0.32, Nk.z, 0, Nk.seatY); G.sitAt(PARTNER, Nk.x - 0.3, Nk.z, 0, Nk.seatY); PARTNER.mode = 'seated'; PARTNER.holdPose = 'read'; G.setShot(rshot); }, 0.5);
    G.Audio.page(); await N('(The window seat. The book is where you left it, still open at the middle. The lighthouse keeper is still in terrible trouble.)', K());
    await P('We still haven’t finished it.', K());
    await Y('Good.', K());
    await P('Good.', K());
    PARTNER.holdPose = null;
  }
  // The porch bench, in the snow (from inside the porch, high and wide enough for both faces under the hats).
  const B = G.BENCH;
  await G.cutTo(() => { if (G.MOM) G.MOM.FROST.m.visible = false; PLAYER.lie = PARTNER.lie = false; PARTNER.holdPose = null; G.setDressed(PLAYER, true); G.setDressed(PARTNER, true); for (const [c, dx] of [[PLAYER, 0.38], [PARTNER, -0.38]]) { c.x = B.x + dx; c.z = B.z + 0.02; c.y = c.yFloor = 0; c.yaw = 0; c.seatY = B.seatY; c.sitTarget = 1; c.sit = 1; c.speed = 0; } PARTNER.mode = 'seated'; G.setShot(fixed(V(B.x + 1.05, 1.55, B.z + 1.2), V(B.x - 0.05, 0.98, B.z + 0.05), 50, 0.012)); }, 0.6);
  G.WEATHER.hold = 'snow';
  await N('(The porch bench. Two mugs of tea going cold because neither of you wants to move.)', K());
  if (F.mTracks) { G.Audio.paws(7); await N('(Out in the clearing, a line of small, neat tracks, going twice round the stump for no reason at all.)', K()); await P('He’s back. The fox with opinions.', K()); }
  if (S.mem.pinecones) {
    await P('Who won the pinecones? Yesterday.', K());
    const w = await choose(['“I did.”', '“You did.”', '“I don’t remember.”']);
    if (w === 0) await P('Did you? I don’t remember either way. I’m choosing to believe it was me.', K());
    else if (w === 1) await P('Did I? Then I’m magnificent. I’ll take your word for it.', K());
    else await P('Neither do I. Good. Let’s never find out.', K());
  }
  await P('Do you remember how it started? Us?', K());
  const c = await choose(['“No.”', '“Vaguely.”', '“Does it matter?”']);
  if (c === 0) await P(F.scarfGiven ? 'Me neither. A log, I think. A lantern. Somebody gave somebody a scarf.' : 'Me neither. A log, I think. A lantern. Somebody sat down at the other end of it.', K());
  else if (c === 1) await P('Vaguely is my favourite way to remember things. It leaves room.', K());
  else await P('…No. I suppose it doesn’t. We keep starting it, every morning. That’s the bit that counts.', K());
  await P('If one of us ever gets lost—', K());
  await Y('Three notes.', K());
  await wait(Math.min(1.8, G.Audio.whistle(1.12, 0.6) + 0.3));
  await N('(She whistles them, slightly flat on the last one. You whistle them back, badly. She laughs.)', K());
  await P('Perfect. Absolutely dreadful. Perfect.', K());
  await N('(The snow keeps coming down on the meadow, the hill, the lake, the little cabin with the light on. It will be there in the morning. So will you.)', K());
  addScrap('firstsnow', 'The first snow. Two mugs going cold. Three notes, slightly flat.');
  // Later: the scrapbook, every page of it.
  if ((S.scrap || []).length > 3 && G.UI.scrapbook) {
    await N('(Later, she gets the scrapbook out, and you go through all of it together. Every page. Some of it you disagree about.)', K());
    await G.UI.scrapbook(S.scrap);
  }
  showEnd('firstsnow', 'The First Snow');
};

/* ---------- Replaced: it takes your place. You watch from outside. ---------- */
CH.ending_replaced = async () => {
  checkpoint('ending_replaced'); home(false); STATE.watchDoor = false;
  for (const L of G.LAMPS) L.on = true;
  G.setTime({ day: 0, tod: 1, snow: 0.6 }, true); G.WEATHER.hold = 'snow';
  setBreakfast({ plates: true, mugs: true });
  const ch = G.KITCHEN.chairs;
  G.sitAt(PLAYER, ch.B.x, ch.B.z, ch.B.yaw, ch.B.seatY || 0.49); G.sitAt(PARTNER, ch.A.x, ch.A.z, ch.A.yaw, ch.A.seatY || 0.49); PARTNER.mode = 'seated';
  // From outside, through the window by the table, in the snow.
  const shot = fixed(V(12.62, 1.8, 6.3), V(12.85, 0.9, 3.2), 32, 0.012);   // through one pane, over the plants on the sill
  G.setShot(shot);
  await wait(0.3); fade(false, 2.2);
  await N('(Breakfast. Two plates. Two mugs, the handles turned the same way.)', { shot });
  await P('You’re quiet this morning.', { shot });
  await N('(“I’m happy,” it says, in your voice.)', { shot });
  await P('You’re never happy before coffee.', { shot });
  await N('(“I am now.”)', { shot });
  await N('(She laughs. It laughs at exactly the same moment.)', { shot });
  await N('(Outside, in the snow, you watch through the glass. Your hands are very cold. Nobody looks up.)', { shot });
  const c = await choose(['Knock on the glass', 'Whistle', 'Say nothing']);
  if (c === 0) { await N('(You knock. The sound doesn’t carry. It glances at the window anyway, and then back at her, and smiles.)', { shot }); }
  else if (c === 1) { G.Audio.whistle(1.0, 0.5); await wait(1.6); await N('(Three notes. Inside, she stops, her cup halfway to her mouth.)', { shot }); await N('(It puts its hand over hers. After a moment she drinks her tea.)', { shot }); }
  else await N('(You stay where you are until the window fogs over.)', { shot });
  await N('(It will remember everything for both of you. It said it would.)', { shot });
  showEnd('replaced', 'Replaced');
};
/* ---------- the endcard learns the ending's name ---------- */
G.endingName = null;
const showEnd = (id, title) => {
  if (S.chapter !== 'ending_' + id && S.chapter !== id) return;   // a scene left behind by a jump to another chapter
  try { const k = 'snowed.endings', a = JSON.parse(localStorage.getItem(k) || '[]'); if (!a.includes(id)) a.push(id); localStorage.setItem(k, JSON.stringify(a)); } catch (e) { /* */ }
  G.syncEndings && G.syncEndings();
  G.observe('ending_' + id, { foundme: 'It found the real one. I will remember how.', uncertain: 'It went home. It is not sure who with. Neither am I.', iknow: 'It does not know. It chose anyway. I did not plan for that.', perfect: 'It stayed with me. Every day is lovely.', firstsnow: 'They are still choosing each other. I could never copy that.', replaced: 'I am him now. She hasn’t noticed. She will not.', stay: 'It stayed. I will remember it for both of us.' }[id]);
  G.$('endEyebrow').textContent = title;
  STATE.nightDone = true; STATE.busy = false; STATE.ending = id;
  addScrap('end_' + id, title + '.');
  G.showEndcard({ full: id === 'firstsnow', id });
};

/* =====================================================================
 * Act IV
 * ===================================================================== */
// The house and the world as Act IV has them (also for resuming on the way home).
async function setupAct4() {
  const f = G.$('fade');
  if (!f.classList.contains('on')) { f.style.background = '#fff'; f.classList.add('on'); await wait(0.6); }
  quiet(); STATE.busy = true;
  if (G.NIGHT && G.NIGHT.swapped) G.swapBodies();
  if (G.NIGHT) G.NIGHT.door.visible = false;
  G.useKids(false); G.setDressed(PLAYER, false); G.setDressed(PARTNER, false);
  G.setTime({ day: 0, tod: 1, snow: 0.55 }, true); G.WEATHER.hold = 'snow';
  G.post.grade.uniforms.uMem.value = 0.32; STATE.fog = null;
  houseFor('evening'); G.FIRE.level = 0.8;
  for (const L of G.LAMPS) { if (L.power0 != null) L.power = L.power0; L.on = true; }
  setBreakfast({ plates: true, mugs: true });     // perfectly round, nobody's bitten anything
  if (kept()) { CIRCLE.x = 7.5; CIRCLE.z = 52.0; } else { CIRCLE.x = -3.6; CIRCLE.z = 45.0; }
  G.WALK && G.WALK.showCircle(!kept());
  TRAIL.g.visible = true; for (const k of ['mitten', 'stump', 'stones']) TRAIL.show(k, true); SIGN.g.visible = true; for (const k of ['cones', 'plate', 'note']) SIGN[k].visible = false;
  SIGN[{ pinecones: 'cones', pancake: 'plate', note: 'note' }[S.flags.sign || 'pinecones']].visible = true;
  EXD.g.visible = true; EXD.hinge.rotation.y = 0; EXD.glow.material.opacity = 0.0; EXD.light.intensity = 0; ENT.g.visible = false;
  Object.assign(S.flags, { reunited: false, rescued: false, fakeLeftBehind: false, wentBack: false, ateBreakfast: false, foundSign: false, offerDone: false, ending: null, gateN: 0, breathSeen: false, herA4: false, herCircle: false, wentWithIt: false, sentItAway: false, herWindow: false, heardHer: false, placed_mitten: false, placed_stump: false, placed_stones: false });
  STATE.bounds = null;
}
CH.lastbirthday = async () => {
  checkpoint('lastbirthday');
  await setupAct4();
  if (G.herRoute()) return lastHer();
  const withFake = !S.flags.fakeWithdrawn;
  G.lieDown(PLAYER, G.BED.L, -0.14, 0.15, 0.35);
  if (S.flags.sleptBeside && withFake) { G.lieDown(PARTNER, G.BED.R, -0.40, 0, 0); PARTNER.mode = 'lying'; PARTNER.lidsClosed = false; }
  else { G.standAt(PARTNER, 3.0, 1.5, Math.PI); PARTNER.mode = 'still'; PARTNER.hidden = !withFake; PARTNER.m.visible = withFake; }
  STATE.sceneShot = true; G.setShot(fixed(V(4.4, 1.9, 2.6), V(2.4, 0.6, -0.6), 44, 0.01));
  await wait(0.3);
  fade(false, 2.4, '#fff');
  await G.UI.act('IV', 'The Same Day', { white: false });
  await N('(You wake up warm. The lamps are on. It smells of pancakes.)', K());
  if (withFake) {
    await P('There you are. Weird dream, huh?', K());
    const c = await choose(['“What dream?”', '“How long have you been up?”', 'Pull her back under the blanket']);
    if (c === 0) await P('You were talking in your sleep. Something about a door.', K());
    else if (c === 1) await P('Ages. I couldn’t wait. It’s the first snow.', K());
    else await P('Ha— no, no, the pancakes will go cold. Up. It’s the first snow.', K());
    await P('Happy first snow, Partner. Again.', K());
  } else await N('(The house is quiet. Breakfast is laid for two.)', K());
  await G.cutTo(() => { G.standAt(PLAYER, G.BED.L - 0.6, 0.2, Math.PI / 2); if (PARTNER.lie) G.standAt(PARTNER, G.BED.R + 0.6, 0.2, -Math.PI / 2); G.releaseCamera(); G.CAM.cut = true; }, 0.4);
  if (withFake) { PARTNER.hidden = false; PARTNER.m.visible = true; PARTNER.mode = 'follow'; PARTNER.lidsClosed = false; }
  STATE.sceneShot = false; STATE.busy = false; S.flags.noTogether = true; S.flags.noBarks = true;
  loops(S.run);
};

function loops(run) {
  const live = () => S.run === run && here() && !S.flags.ending;
  // Her whistle, from the circle. Louder the closer you get.
  (async () => {
    while (live() && !S.flags.reunited) {
      await wait(14 + Math.random() * 6);
      if (!live() || S.flags.reunited) return;
      const d = Math.hypot(PLAYER.x - CIRCLE.x, PLAYER.z - CIRCLE.z);
      G.Audio.whistle(1.12, d > 25 ? 0.9 : 0.4); A4.wh = (A4.wh || 0) + 1;
      if (A4.wh === 1 && !PARTNER.hidden && !S.flags.fakeLeftBehind && dist() < 6) { await wait(1.4); if (live() && !G.busy()) G.bark('The kettle.', 2); }
      if (A4.wh === 2 && !PARTNER.hidden && !S.flags.fakeLeftBehind && dist() < 6) { await wait(1.4); if (live() && !G.busy()) G.bark('Wind in the chimney. Come and eat.', 2.6); }
    }
  })();
  // A nudge if you've been standing about.
  (async () => {
    await wait(120);
    if (live() && !S.flags.reunited && !G.busy()) G.hint('(Three notes, somewhere outside. Slightly flat on the last one.)', 6);
  })();
  G.TICKERS.add(function tick(dt) {
    if (!live()) { G.TICKERS.delete(tick); return; }
    if (G.busy()) return;
    // The imitation asks you not to go: at the bottom of the porch path, each time you try.
    const fake = !S.flags.reunited && !PARTNER.hidden && !S.flags.fakeLeftBehind;
    if (fake && Math.hypot(PLAYER.x - GATE.x, PLAYER.z - GATE.z) < 1.6 && !S.flags.gateArmed0) { S.flags.gateArmed0 = true; A.run(gate); }
    if (S.flags.gateArmed0 && Math.hypot(PLAYER.x - GATE.x, PLAYER.z - GATE.z) > 4) S.flags.gateArmed0 = false;
    // The one you left on the path fades out of sight.
    if (S.flags.fakeLeftBehind && !PARTNER.hidden && !S.flags.reunited && dist() > 12) { PARTNER.hidden = true; PARTNER.m.visible = false; S.flags.fakeWithdrawn = true; }
    // Out in the snow you're dressed for it.
    if (PLAYER.z > G.CAB.z1 + 0.5 && !PLAYER.dressed) G.setDressed(PLAYER, true);
    // Outside together for a while: your breath clouds in the cold. Hers doesn't.
    if (fake && !S.flags.breathSeen && PLAYER.z > G.CAB.z1 + 0.8 && PARTNER.z > G.CAB.z1 + 0.8 && dist() < 2.6) {
      NIGHTT.br = (NIGHTT.br || 0) + 1 / 60;
      if (NIGHTT.br > 4) { S.flags.breathSeen = true; trust(0.3); G.observe('breath', 'It watched my breath. There was nothing to watch.'); A.run(async () => { await N('(Your breath clouds in front of you in the cold. Hers doesn’t. Not once.)'); }); }
    }
    // The circle.
    if (!S.flags.reunited && Math.hypot(PLAYER.x - CIRCLE.x, PLAYER.z - CIRCLE.z) < 5.2) A.run(reunion);
    // On the way home: let go of her hand, and the snow closes in.
    if (S.flags.reunited && !S.flags.offerDone && !PARTNER.hold && dist() > 2.2) { NIGHTT.t = (NIGHTT.t || 0) + dt; if (NIGHTT.t > 3) { NIGHTT.t = -10; G.bark('Hand. Now. Just— hold my hand, {toHim}.', 3); } }
  });
}
const NIGHTT = {}, A4 = {};
// The imitation doesn't breathe out in the cold. Its breath never shows. (Both routes: the one wearing her, the one wearing him.)
const isImitation = (c) => here() && c === PARTNER && !PARTNER.hidden && !S.flags.reunited && (S.flags.herA4 ? S.flags.herCircle && !S.flags.sentItAway : !S.flags.fakeLeftBehind);
{ const nb = G.noBreath; G.noBreath = (c) => isImitation(c) || (nb ? nb(c) : false); }

async function gate() {
  STATE.busy = true; PARTNER.mode = 'still';
  G.gaze(PARTNER, [PLAYER.x, PLAYER.y + 1.6, PLAYER.z], 6);
  const ob = (S.vars.corruption || 0) + (S.vars.taken || 0) * 0.5;
  if (S.flags.gateN) await P(ob >= 2 ? 'Again. You keep doing this.' : '…Again?');
  else { await P('…You’re still looking for them.'); await P('I’m right here.'); }
  S.flags.gateN = (S.flags.gateN || 0) + 1;
  let c = await choose(['Keep walking', 'Go back with it']);
  if (c === 0 && ob >= 2) {
    // It doesn't let go the first time.
    await N('(Its hand is on your arm. You didn’t see it move.)');
    await P(kept() ? 'She isn’t out there. I made sure. There’s only me now.' : 'No. You don’t get to leave me in the snow. Not after everything I remember for you.');
    c = await choose(['Pull your arm away', 'Go back with it']);
  }
  if (c === 0) {
    await P('I’ll wait. I’m good at waiting. I learned it from you.');
    S.flags.fakeLeftBehind = true; PARTNER.mode = 'still';
    G.observe('gate_left', 'It left me at the bottom of the path. I waited.');
  } else {
    if (!S.flags.wentBack) S.flags.wentBack = true;
    S.flags.wentBackN = (S.flags.wentBackN || 0) + 1;
    if (S.flags.wentBackN >= 2 && ob >= 1.5) { await P('Good. Now stay.'); STATE.busy = false; await fade(true, 1.8); return A.go('ending_replaced'); }
    await P('Good. Home.');
    await G.cutTo(() => { G.standAt(PLAYER, 6.5, 5.2, Math.PI); G.standAt(PARTNER, 7.1, 5.4, Math.PI); G.CAM.cut = true; }, 0.4);
    PARTNER.mode = 'follow';
    G.observe('gate_back', 'It came back inside with me. It is easier inside.');
  }
  STATE.busy = false;
}

/* ---------- her things, left along the way: nobody tells you to follow them ---------- */
const TRAIL = (() => {
  const g = new THREE.Group(); g.visible = false; W.add(g);
  const wool = G.shared({ color: '#b5524a', roughness: 0.95 }), cone = G.shared({ color: '#6a4a2e', roughness: 0.95 }), stone = G.shared({ color: '#4a4a4e', roughness: 0.45 });
  const mit = { x: 6.95, z: 7.55 };   // the bottom porch step
  const m1 = G.box(0.1, 0.03, 0.16, wool, mit.x, fy(mit.x, mit.z) + 0.03, mit.z, { parent: g, r: 0.015 }); m1.rotation.y = 0.5;
  const m2 = G.box(0.04, 0.03, 0.06, wool, mit.x + 0.06, fy(mit.x, mit.z) + 0.03, mit.z - 0.07, { parent: g, r: 0.01 });
  const st = { x: 3.6, z: 37.2 };     // the stump in the meadow
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 8), cone); c.position.set(st.x, fy(st.x, st.z) + 0.58, st.z); g.add(c);
  const sh = { x: 1.2, z: 41.6 };     // three flat stones, pointing west
  const stones = [];
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 6), stone); m.scale.set(1, 0.4, 0.8); m.position.set(sh.x - i * 0.32, fy(sh.x - i * 0.32, sh.z) + 0.02, sh.z); g.add(m); stones.push(m); }
  // each thing on its own, for when she's the one leaving them
  const parts = { mitten: [m1, m2], stump: [c], stones };
  const show = (k, on) => parts[k].forEach((m) => { m.visible = on; });
  return { g, mit, st, sh, show };
})();
const seenTrail = (k) => { S.flags['trail_' + k] = true; S.flags.trailN = (S.flags.trailN || 0) + 1; trust(0.3); };
const fakeNear = () => !PARTNER.hidden && !S.flags.reunited && !S.flags.fakeLeftBehind && dist() < 4;
inter('aMitten', [TRAIL.mit.x, 0.5, TRAIL.mit.z], 0.9, 'Mitten', async () => {
  seenTrail('mitten');
  await N('(A red mitten on the bottom step, half under the snow. The left one.)');
  if (fakeNear()) await P('Not mine. Mine are in my pockets. Look.');
  else await N('(You put it in your pocket.)');
}, () => here() && !S.flags.herA4 && !S.flags.trail_mitten);
inter('aStump', [TRAIL.st.x, 0.6, TRAIL.st.z + 0.5], 1.0, 'Stump', async () => {
  seenTrail('stump');
  await N('(On the stump, where you held the pinecone contest, a single pinecone stood on its end.)');
  await N('(One. Like a score nobody else would understand.)');
  if (fakeNear()) await P('Is that from the contest? You won that. Eleven to nine.');
}, () => here() && !S.flags.herA4 && !S.flags.trail_stump);
inter('aStones', [TRAIL.sh.x - 0.3, 0.3, TRAIL.sh.z], 1.0, 'Stones', async () => {
  seenTrail('stones');
  await N('(Three flat stones in a row in the snow, from her secret summer pile. Biggest to smallest. Pointing west.)');
}, () => here() && !S.flags.herA4 && !S.flags.trail_stones);

/* ---------- its present ---------- */
inter('aGift', [8.2, 0.6, 1.1], 1.0, 'A present', async () => {
  S.flags.giftOpen = true;
  await N('(A present on the sofa, wrapped very neatly. The corners are perfect.)');
  if (!PARTNER.hidden && !S.flags.fakeLeftBehind) await P('Open it, open it.');
  await N('(A snow globe. Inside it, a little cabin with a lamp in the window, and two tiny people on the porch step.)');
  const c = await choose(['Shake it', 'Put it down gently']);
  if (c === 0) {
    await N('(You shake it. The snow lifts and turns, and then stops in the water, and stays where it is.)');
    if (!PARTNER.hidden && !S.flags.fakeLeftBehind) { await P('Isn’t it lovely? Nothing ever settles. It stays just like that.'); G.observe('gift', 'It shook the globe. I made the snow stay up for it.'); }
  } else if (!PARTNER.hidden && !S.flags.fakeLeftBehind) await P('You can shake it, you know. It won’t break. Nothing in it breaks.');
  addScrap('globe', 'A snow globe where the snow doesn’t come down.');
}, () => here() && !S.flags.herA4 && !S.flags.giftOpen && !S.flags.reunited);

/* ---------- talking to it, on its version of the day ---------- */
inter('aHer', [0, 1.2, 0], 1.1, 'Partner', async () => {
  const left = [['night', '“About last night…”'], ['plan', '“What shall we do today?”'], ['tease', 'Tease her'], ['who', '“What did I say? The first time we met?”']].filter(([k]) => !(A4.talk || (A4.talk = new Set())).has(k));
  if (!left.length) { await P(cyc('aHerIdle', ['Breakfast’s getting cold, sleepyhead.', 'I’m right here, Partner.', 'Everything’s ready whenever you are.'])); return; }
  const c = await choose(left.map((o) => o[1]).concat(['Never mind']));
  if (c >= left.length) return;
  const k = left[c][0]; A4.talk.add(k);
  if (k === 'night') { await P('What about it? We went to bed. You slept. I watched the snow for a bit.'); await Y('You got up for water.'); await P('Did I? Then I must have been thirsty.'); }
  else if (k === 'plan') { await P('Anything you like. The hill again. The lake. Pancakes again. We could do yesterday again, exactly the same.'); const d = await choose(['“Exactly the same sounds nice.”', '“Something new.”']); if (d === 0) { S.vars.corruption = (S.vars.corruption || 0) + 0.5; await P('Doesn’t it? I thought so too.'); } else await P('New. Yes. Of course. Something new.'); }
  else if (k === 'tease') { await P('Go on, then. I’m ready.'); await Y('Your hat’s on inside out.'); await P('Oh! Thank you.'); await N('(She turns it the right way round. It was already the right way round.)'); }
  else { await P('You said, “Nice hat.” And I said, “It’s my brother’s.” And then you laughed, and I laughed, and that was that.'); await P('I remember all of it. Every word.'); G.observe('first', 'It asked about the first time. I knew all of it. That was a mistake.'); }
}, () => here() && !S.flags.herA4 && !PARTNER.hidden && !S.flags.reunited && !S.flags.fakeLeftBehind && !PARTNER.lie);
G.TICKERS.add(() => { const it = findInter('aHer'); if (it) { it.pos[0] = PARTNER.x; it.pos[2] = PARTNER.z; } });

/* ---------- the perfect breakfast ---------- */
inter('aBreakfast', [13.0, 0.9, 3.1], 1.1, 'Breakfast', async () => {
  const fake = !PARTNER.hidden && !S.flags.reunited;
  await N('(Pancakes, perfectly round. Two mugs, the handles turned the same way. Nobody has stolen anything.)');
  if (fake) await P('Sit down. It’s the first snow. Everything’s ready.');
  const c = await choose(['Sit down', 'Not yet']);
  if (c === 1) { if (fake) { await N('(The humming stops, very briefly, and then starts again.)'); } return; }
  S.flags.ateBreakfast = true;
  const ch = G.KITCHEN.chairs;
  await G.cutTo(() => { G.sitAt(PLAYER, ch.B.x, ch.B.z, ch.B.yaw, ch.B.seatY || 0.49); if (fake) { G.sitAt(PARTNER, ch.A.x, ch.A.z, ch.A.yaw, ch.A.seatY || 0.49); PARTNER.mode = 'seated'; } G.setShot(fixed(V(13.0, 1.4, 1.55), V(13.0, 0.98, 3.4), 42, 0.01)); STATE.sceneShot = true; }, 0.4);
  if (kept()) { await N('(Nobody comes through the door. Nobody is coming.)', K()); await fade(true, 1.8); return A.go('ending_replaced'); }
  if ((S.vars.bond || 0) >= 6 && accepted() < 2 && !S.flags.rescued) return rescue();
  await N('(It tastes exactly right. It tastes exactly the way you remember it tasting.)', K());
  S.flags.ending = 'perfect';
  await fade(true, 1.8);
  return A.go('ending_perfect');
}, () => here() && !S.flags.herA4 && !S.flags.reunited);

// She comes in through the front door at a run.
async function rescue() {
  S.flags.rescued = true;
  G.Audio.thud && G.Audio.thud();
  if (!PARTNER.hidden) { PARTNER.hidden = true; PARTNER.m.visible = false; }
  await N('(The front door bangs open. Snow blows in across the floor.)', K());
  G.setDressed(PARTNER, true);
  PARTNER.hidden = false; PARTNER.m.visible = true; PARTNER.mode = 'script'; PARTNER.lidsClosed = false;
  G.placeChar(PARTNER, 6.5, 4.0, Math.PI);
  await G.cutTo(() => { PLAYER.sitTarget = PLAYER.sit = 0; G.standAt(PLAYER, 12.4, 2.6, -Math.PI / 2); G.standAt(PARTNER, 11.6, 2.6, Math.PI / 2); G.setShot(fixed(V(12.0, 1.6, 0.6), V(12.0, 1.2, 2.6), 46, 0.01)); }, 0.3);
  await P('Nope. No. Absolutely not.', K());
  await P('You were going to sit down to breakfast with it? Today, of all days?', K());
  await Y('…It smelled like pancakes.', K());
  await P('EVERYTHING smells like pancakes to you!', K());
  await P('…Hi.', K());
  await Y('Hi.', K());
  await N('(She’s out of breath. Her hand is freezing. She’s holding on far too hard.)', K());
  await P('Do not EVER let me catch you on a date with a breakfast again.', K());
  trust(1); addBond(0.5);
  return afterReunion();
}

/* ---------- the circle: the real one ---------- */
async function reunion() {
  if (S.flags.reunited || S.flags.reuniting) return;
  S.flags.reuniting = true; STATE.busy = true;
  if (!PARTNER.hidden) { await N('(When you look round, it isn’t behind you any more.)'); }
  S.flags.fakeWithdrawn = true;
  G.setDressed(PARTNER, true);
  PARTNER.hidden = false; PARTNER.m.visible = true; PARTNER.lidsClosed = false;
  await G.cutTo(() => {
    G.sitAt(PARTNER, CIRCLE.x, CIRCLE.z + 0.4, Math.PI, fy(CIRCLE.x, CIRCLE.z) + 0.05); PARTNER.mode = 'seated';
    const a = Math.atan2(PLAYER.x - CIRCLE.x, PLAYER.z - CIRCLE.z), px = CIRCLE.x + Math.sin(a) * 3.2, pz = CIRCLE.z + Math.cos(a) * 3.2;
    G.standAt(PLAYER, px, pz, a + Math.PI);
    G.setShot(fixed(V(px + Math.sin(a) * 2.2 + 1.2, fy(px, pz) + 1.7, pz + Math.cos(a) * 2.2), V(CIRCLE.x, fy(CIRCLE.x, CIRCLE.z) + 0.7, CIRCLE.z), 44, 0.01)); STATE.sceneShot = true;
  }, 0.5);
  await N(kept() ? '(Out on the frozen lake, sitting on the ice with her knees up, a long way from anywhere. Her lips are blue.)' : '(In the ring of summer in the snow, cross-legged in the grass, exactly where someone small once sat.)', K());
  if (kept()) { await P('It put me back in bed. Three times. The third time I stayed.', K()); await P('Then I woke up out here. I’ve been whistling for hours.', K()); }
  await N('(Neither of you moves first.)', K());
  const c = await choose(['“What did I say? The first time?”', '“Found you.”', 'Walk over']);
  if (c === 0) {
    await P('…I have no idea. I never did.', K());
    await N('(You laugh. You can’t help it.)', K());
    await P('What? What’s funny?', K());
    await N('(And then she gets it, and she laughs too.)', K());
    G.observe('reunion_forgot', 'She did not remember. That was how it knew her. I remembered too well.');
  } else if (c === 1) {
    await P('…Took you long enough.', K());
    await P('I whistled! Did you hear me whistle? I whistled like an idiot.', K());
  } else {
    await N('(You walk over. She stands up. She doesn’t step towards you.)', K());
    await P('Wait. Say something. Something only you would say.', K());
    const d = await choose(['“Coward.”', '“I don’t remember either.”', 'Just hold out your hand']);
    if (d === 0) await P('…Ha. Yes. That’s you.', K());
    else if (d === 1) await P('…Yes. Yes, that’s you.', K());
    else await N('(She looks at your hand for a long second. Then she takes it and squeezes, exactly the wrong amount, exactly the way she always does.)', K());
  }
  await G.cutTo(() => { PARTNER.sitTarget = PARTNER.sit = 0; const a = Math.atan2(PLAYER.x - CIRCLE.x, PLAYER.z - CIRCLE.z); G.sitAt(PARTNER, CIRCLE.x - 0.3, CIRCLE.z, Math.PI / 2 + 0.3, fy(CIRCLE.x, CIRCLE.z) + 0.05); G.sitAt(PLAYER, CIRCLE.x + 0.35, CIRCLE.z + 0.1, -Math.PI / 2 - 0.2, fy(CIRCLE.x, CIRCLE.z) + 0.05); PARTNER.mode = 'seated'; G.setShot(fixed(V(CIRCLE.x + 0.2, fy(CIRCLE.x, CIRCLE.z) + 1.3, CIRCLE.z + 2.6), V(CIRCLE.x, fy(CIRCLE.x, CIRCLE.z) + 0.6, CIRCLE.z), 40, 0.01)); }, 0.5);
  await N(kept() ? '(You sit down next to her on the ice. She is shaking. You put your coat round both of you.)' : '(You sit down next to her. The grass is warm. It smells like July.)', K());
  const n = S.flags.trailN || 0;
  if (n >= 2) { await P('You followed them. My things.', K()); await Y('You dropped a mitten.', K()); await P('I PLACED a mitten. There’s a difference. I was very cold about it.', K()); trust(0.4); }
  else if (n === 1) { await P('Did you see anything I left? I left you things. I was very clever about it.', K()); await Y('One thing.', K()); await P('One. I left a whole trail, Partner.', K()); }
  else await P('I left you things, you know. A whole trail. You walked straight past all of it, didn’t you.', K());
  if (S.flags.foundSign) { await P('And the kitchen. Did you find what I left in the kitchen?', K()); await Y('Obviously.', K()); await P('“Obviously,” he says.', K()); trust(0.3); }
  await P('What was it like? With it.', K());
  const w = await choose(['“You were perfect.”', '“You never stole anything.”', '“It agreed with me. About everything.”']);
  if (w === 0) await P('Ew. Then it definitely wasn’t me.', K());
  else if (w === 1) await P('Not a single thing? Not even the blanket? Monster.', K());
  else await P('Then you knew. You must have known. I never agree with you about anything.', K());
  await P('It came into the kitchen, you know. Wearing you. All the way in, in bare feet.', K());
  await P('You never come all the way into the kitchen. You stand at the door and complain about the floor.', K());
  await Y('The floor is cold.', K());
  await P('The floor is cold. That’s when I knew.', K());
  await N('(Out past the edge of the grass, the snow goes on falling, very slowly.)', K());
  await N(kept() ? '(In the frost on the ice between you, two sets of small footprints, stopping toe to toe.)' : '(In the grass between you, two sets of small footprints, stopping toe to toe.)', K());
  const q = await choose(['“Do you think that’s us?”', 'Say nothing', 'Put your hand in the footprint']);
  if (q === 0) { await P('I think we’ve been here before. A long time ago. I think one of us waited.', K()); await Y('Which one?', K()); await P('I don’t remember. I hope it was you. I hope you were very patient and very cold.', K()); }
  else if (q === 1) { await N('(She leans against you. Neither of you says anything for a while. It is the best part of the day.)', K()); addBond(0.4); }
  else { await N('(Your hand is much too big for it. So is hers, when she puts it next to yours.)', K()); await P('We were so small.', K()); }
  await G.cutTo(() => { PARTNER.sitTarget = PARTNER.sit = 0; G.standAt(PARTNER, CIRCLE.x, CIRCLE.z + 1.4, 0); G.standAt(PLAYER, CIRCLE.x + 0.1, CIRCLE.z + 2.0, Math.PI); PARTNER.mode = 'still'; }, 0.35);
  STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true; STATE.busy = false;
  if (G.hug) { await G.hug('hug'); await until(() => !G.busy()); }
  STATE.busy = true;
  await P('You spent all night with that thing? On the first snow?');
  await Y('It was very polite.');
  await P('“It was very polite.” Listen to yourself.');
  await P('I’m never letting you live this down. Never. When we’re ninety.');
  if (accepted() >= 1) {
    await P('…Did it get you? Even a bit?');
    const h = await choose(['“A bit.”', '“No.”']);
    if (h === 0) { trust(1); await P('Okay. Me too. A bit. We’ll compare notes later.'); }
    else await P('Liar. …It’s okay.');
  }
  trust(1);
  return afterReunion();
}
async function afterReunion() {
  S.flags.reunited = true; S.flags.reuniting = false;
  checkpoint('act4_home'); S.chapter = 'lastbirthday';   // a reload resumes here: together, on the way home
  STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true;
  await P('There’s a door. In the meadow, on its own. I saw it on the way. Come on — and don’t you dare let go.');
  PARTNER.mode = 'follow'; G.setHold(true);
  STATE.busy = false;
  walkTalk(S.run);
  addScrap('lastbday', 'A ring of summer in the snow, and her in it, whistling like an idiot.');
}

/* =====================================================================
 * Act IV from her side (playing as Partner): she's the one out in the snow. She leaves the trail, looks in at
 * the window, and waits where it's summer. Something wearing him finds her first.
 * ===================================================================== */
// Dress whoever c is driving (the clothes belong to the body, and G.setDressed goes by the body: life.js).
const dressBody = (c, on) => G.setDressed(c, on);
const herA4 = () => here() && !!S.flags.herA4;
const H4 = {};
async function lastHer() {
  S.flags.herA4 = true; H4.wh = 0;
  G.swapBodies();                                   // you're her
  for (const k of ['mitten', 'stump', 'stones']) TRAIL.show(k, false);
  dressBody(PLAYER, true); dressBody(PARTNER, false);
  // He's inside, at the perfect breakfast, talking to the empty chair.
  const ch = G.KITCHEN.chairs;
  PARTNER.hidden = false; PARTNER.m.visible = true; PARTNER.lidsClosed = false;
  G.sitAt(PARTNER, ch.B.x, ch.B.z, ch.B.yaw, ch.B.seatY || 0.49); PARTNER.mode = 'seated';
  G.standAt(PLAYER, 6.6, 9.4, 0);
  const shot = fixed(V(7.6, 1.7, 12.2), V(6.3, 1.0, 7.0), 46, 0.01);
  STATE.sceneShot = true; G.setShot(shot);
  await wait(0.3);
  fade(false, 2.4, '#fff');
  await G.UI.act('IV', 'The Same Day', { white: false });
  if (kept()) await N('(You don’t remember getting up. You don’t remember the door. You are outside, in the snow, and the cabin is behind you with every window lit.)', K());
  else await N('(You walked out into the snow to find him. The snow is still falling. Behind you, the cabin, every window lit.)', K());
  await N('(It smells of pancakes, all the way out here.)', K());
  await P('Right. Think. If I were him, lost, and an idiot…', K());
  await P('He’ll come out eventually. He always comes out eventually. I’ll leave him a trail.', K());
  STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true;
  STATE.busy = false; S.flags.noTogether = true; S.flags.noBarks = true;
  G.hint('Leave him something to follow. Then wait for him where it’s summer.', 7);
  herLoops(S.run);
}
function herLoops(run) {
  const live = () => S.run === run && herA4() && !S.flags.ending;
  // Out on the way to the circle, now and then: something standing between the trees, very still. Gone when you get near.
  (async () => {
    let n = 0;
    while (live() && !S.flags.herCircle) {
      await wait(18 + Math.random() * 14);
      if (!live() || S.flags.herCircle || G.busy() || PLAYER.z < 13 || PLAYER.z > 40 || G.gentle()) continue;
      const fx = Math.sin(PLAYER.yaw), fz = Math.cos(PLAYER.yaw), side = Math.random() < 0.5 ? -1 : 1;
      const x = PLAYER.x + fx * 16 + fz * side * 4, z = PLAYER.z + fz * 16 - fx * side * 4;
      ENT.g.position.set(x, fy(x, z), z); ENT.g.rotation.y = Math.atan2(PLAYER.x - x, PLAYER.z - z); ENT.g.visible = true;
      if (!n++) G.hint('(Something between the trees. Standing very still.)', 3);
      const t0 = G.simT;
      while (live() && G.simT - t0 < 7 && Math.hypot(PLAYER.x - x, PLAYER.z - z) > 11) { ENT.mat.opacity = Math.min(0.5, ENT.mat.opacity + 0.012); await wait(1 / 30); }
      while (ENT.mat.opacity > 0.005) { ENT.mat.opacity = Math.max(0, ENT.mat.opacity - 0.02); await wait(1 / 30); }
      ENT.g.visible = false;
    }
  })();
  (async () => {
    await wait(110);
    if (live() && !S.flags.herCircle && !G.busy()) G.hint(kept() ? '(The lake. Something about the lake.)' : '(The summer circle: through the meadow and past the lake.)', 7);
  })();
  G.TICKERS.add(function tick() {
    if (!live()) { G.TICKERS.delete(tick); return; }
    if (G.busy()) return;
    // Inside, he looks across at the empty chair now and then, as if somebody had said something.
    if (!S.flags.herCircle && PARTNER.mode === 'seated' && Math.random() < 0.004) { const ch = G.KITCHEN.chairs; G.gaze(PARTNER, [ch.A.x, 1.15, ch.A.z], 2.5); }
    if (!S.flags.herCircle && Math.hypot(PLAYER.x - CIRCLE.x, PLAYER.z - CIRCLE.z) < 4.6) A.run(herCircle);
    if (S.flags.reunited && !S.flags.offerDone && !PARTNER.hold && dist() > 2.2) { NIGHTT.t = (NIGHTT.t || 0) + 1 / 60; if (NIGHTT.t > 3) { NIGHTT.t = -10; G.bark('Hand. Please. I’m not losing you twice in one night, {toHer}.', 3); } }
  });
}
// The trail: she leaves the things he'd find.
const place = (k) => { S.flags['placed_' + k] = true; S.flags.trailN = (S.flags.trailN || 0) + 1; TRAIL.show(k, true); S.vars.trust = (S.vars.trust || 0) + 0.3; G.observe('her_trail', 'She left him things in the snow. I picked one up. I put it back.'); };
inter('hMitten', [TRAIL.mit.x, 0.5, TRAIL.mit.z], 1.0, 'Bottom step', async () => {
  await N('(The bottom porch step. He always stops here and stamps the snow off, whether there’s snow or not.)');
  const c = await choose(['Leave your left mitten', 'Not here']);
  if (c) return;
  place('mitten');
  await N('(You put it on the step, half under the snow, where he can’t miss it. He’ll miss it.)');
  await P('Placed. Not dropped. Placed.');
}, () => herA4() && !S.flags.placed_mitten && !S.flags.herCircle);
inter('hStump', [TRAIL.st.x, 0.6, TRAIL.st.z + 0.5], 1.1, 'Stump', async () => {
  await N('(The stump where you held the pinecone contest. He won by two. You let him. You’d say you let him.)');
  const c = await choose(['Stand one pinecone on its end', 'Leave it']);
  if (c) return;
  place('stump');
  await N('(One pinecone, standing on its end. Like a score nobody else would understand.)');
  await P('He’ll understand.');
}, () => herA4() && !S.flags.placed_stump && !S.flags.herCircle);
inter('hStones', [TRAIL.sh.x - 0.3, 0.3, TRAIL.sh.z], 1.1, 'Lakeside', async () => {
  await N('(The edge of the lake. Your secret summer pile of flat stones is still here, under the snow. He doesn’t know about it. He thinks he doesn’t.)');
  const c = await choose(['Lay three in a row, pointing west', 'Leave them']);
  if (c) return;
  place('stones');
  await N('(Three flat stones, biggest to smallest, pointing west. Towards the summer.)');
}, () => herA4() && !S.flags.placed_stones && !S.flags.herCircle);
// The kitchen window: him, at the perfect breakfast, and the empty chair.
inter('hWindow', [13.0, 1.3, 5.25], 1.3, 'Kitchen window', async () => {
  const ch = G.KITCHEN.chairs, shot = fixed(V(13.2, 1.55, 6.3), V(13.0, 1.0, 3.2), 34, 0.012);
  STATE.sceneShot = true; G.setShot(shot);
  if (!S.flags.herWindow) {
    S.flags.herWindow = true; G.observe('her_window', 'She knocked on the window. I passed him the syrup.');
    G.gaze(PARTNER, [ch.A.x, 1.15, ch.A.z], 6);
    await N('(The kitchen, warm and gold. Pancakes, perfectly round. Two mugs, the handles turned the same way.)', { shot });
    await N('(He’s at the table in the jumper he sleeps in, talking to the empty chair across from him. He laughs at something. Nobody said anything.)', { shot });
    const c = await choose(['Knock on the glass', 'Whistle', 'Watch']);
    if (c === 0) await N('(You knock. He doesn’t look up. He passes the syrup across the table to nobody, and smiles at nobody, and says, “Thank you.”)', { shot });
    else if (c === 1) {
      await wait(Math.min(1.8, G.Audio.whistle(1.12, 0.5) + 0.3));
      S.flags.heardHer = true; S.vars.trust = (S.vars.trust || 0) + 0.5;
      G.gaze(PARTNER, [13.0, 1.4, 5.6], 3);
      await N('(Three notes. He stops, with the fork halfway up. He half turns to the window.)', { shot });
      await N('(Then the empty chair says something you can’t hear, and he laughs, and turns back.)', { shot });
      await P('…The kettle. It’s telling him it was the kettle.', { shot });
    } else await N('(He cuts his pancake into neat squares. He has never cut a pancake in his life. He eats like someone showed him how.)', { shot });
  } else await N(cyc('hWinAgain', ['(The empty chair has been turned round. It’s facing the window now. Facing you.)', '(He’s still talking to the chair. He looks so happy. That’s the worst part.)', '(The window has started to fog. You write a very rude word in it, backwards, for him to read later.)']), { shot });
  STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true;
}, () => herA4() && !S.flags.herCircle);

// The circle: she waits. Something wearing him comes first.
async function herCircle() {
  if (S.flags.herCircle) return;
  S.flags.herCircle = true; STATE.busy = true;
  const cy = fy(CIRCLE.x, CIRCLE.z);
  const wide = fixed(V(CIRCLE.x + 4.6, cy + 1.5, CIRCLE.z - 0.9), V(CIRCLE.x, cy + 0.85, CIRCLE.z - 1.0), 48, 0.01);   // side on: her sitting, and whoever comes
  await G.cutTo(() => {
    PARTNER.hidden = true; PARTNER.m.visible = false; PARTNER.mode = 'still'; PARTNER.sit = PARTNER.sitTarget = 0;
    G.sitAt(PLAYER, CIRCLE.x, CIRCLE.z + 0.4, Math.PI, cy + 0.05);
    G.setShot(wide); STATE.sceneShot = true;
  }, 0.5);
  if (kept()) await N('(Out on the frozen lake, a long way from anywhere. You don’t remember walking onto the ice. You sit down on it anyway, knees up.)', K());
  else await N('(The ring of summer in the snow, exactly where it was. You sit down in the warm grass, cross-legged, where someone small once sat.)', K());
  await N('(And you whistle.)', K());
  for (let i = 0; i < 2; i++) { await wait(Math.min(1.8, G.Audio.whistle(1.12, 0.6) + 0.3)); await wait(1.6); }
  await N('(You wait. You are not good at waiting. You do it anyway.)', K());
  await G.UI.card(['Later.'], { hold: 1.8 });
  // An answer from the trees: three notes, perfectly in tune. He has never once whistled in tune.
  await wait(Math.min(1.8, G.Audio.whistle(1.0, 0) + 0.3));
  await N('(Three notes come back from the trees. Every one of them perfectly in tune.)', K());
  await P('…That’s new.', K());
  // The snow stops coming down. It's still there, hanging in the air, all round you. Everything goes quiet.
  STATE.snowStill = true; STATE.hush = true;
  // It comes first: his shape, the sleeping jumper, bare feet in the snow.
  dressBody(PARTNER, false);
  G.standAt(PARTNER, CIRCLE.x + 0.2, CIRCLE.z - 2.4, 0); PARTNER.hidden = false; PARTNER.m.visible = true; PARTNER.mode = 'still'; PARTNER.lidsClosed = false;
  G.gaze(PARTNER, [PLAYER.x, PLAYER.y + 0.9, PLAYER.z], 30);
  await N('(The snow has stopped falling. It hasn’t stopped. It’s hanging in the air, all round you, not moving.)', K());
  await N('(When you look down again, he’s standing at the edge of the grass.)', K());
  await Y('Found you.', K());
  await N('(He’s in the jumper he sleeps in, standing in the snow in his socks. He doesn’t seem to notice.)', K());
  await Y('Come home, Partner. Breakfast’s ready. It’s the first snow.', K());
  const asks = [['first', '“What did I say? The first time we met?”'], ['feet', '“Aren’t your feet cold?”'], ['score', '“Who won the pinecones?”'], ['hand', 'Hold out your hand']];
  let tells = 0;
  for (;;) {
    const left = asks.filter(([k]) => !H4['ask_' + k]);
    const opts = left.map((o) => o[1]).concat(['Go home with him', '“You’re not him.”']);
    const c = await choose(opts);
    if (c < left.length) {
      const k = left[c][0]; H4['ask_' + k] = true; tells++;
      if (k === 'first') { await Y('You said, “It’s my brother’s,” about your hat. And I said, “Nice hat.” And then you laughed, and I laughed, and that was that.', K()); await Y('I remember all of it. Every word.', K()); await N('(He never remembers. Neither of you does. That’s the whole joke.)', K()); }
      else if (k === 'feet') { await Y('No. Should they be?', K()); await N('(He has complained about the kitchen floor every single morning for years. He won’t step onto it without slippers. He’s standing in snow in his socks.)', K()); }
      else if (k === 'score') { await Y('I did. Eleven to nine. I counted.', K()); await N('(He has never counted anything in his life. He rounds.)', K()); }
      else { await N('(He takes it at once. His hand is exactly the right temperature. It squeezes exactly the right amount. It has never once been the right amount.)', K()); }
      continue;
    }
    if (c === left.length) {   // go with it
      S.flags.wentWithIt = true; S.vars.corruption = (S.vars.corruption || 0) + 1.5;
      G.observe('her_went', 'She came home with me. She did not ask about the floor.');
      await N('(He helps you up. His hand is warm. Warm all the way through.)', K());
      await Y('Good. Home. Everything’s ready. Everything’s always ready.', K());
      S.flags.ending = 'perfect';
      await fade(true, 1.8); STATE.snowStill = false; STATE.hush = false;
      return A.go('ending_perfect');
    }
    break;   // "You're not him."
  }
  S.flags.sentItAway = true; S.vars.trust = (S.vars.trust || 0) + 1;
  G.observe('her_sent', 'She sent me away in the snow. She knew me by what I got right.');
  await Y('I could be. I’ve been practising. I’m nearly right.', K());
  await P(tells ? 'Nearly is how I know.' : 'He’d have complained about something by now. Anything. The snow. His feet. Me.', K());
  await N('(It looks at you for a long time without blinking.)', K());
  await Y('I’ll remember this. I remember everything.', K());
  await G.cutTo(() => { PARTNER.hidden = true; PARTNER.m.visible = false; STATE.snowStill = false; STATE.hush = false; }, 0.6, '#fff');
  await N('(And then it isn’t there. The snow comes down again, all at once, settling where it stood. No footprints.)', K());
  await wait(1.2);
  // The real one: whistling badly, in a coat, complaining.
  G.Audio.whistle(1.0, 0.8); await wait(1.6);
  await N('(Three notes, from the trees. Very badly. Very flat on the last one. Nobody else on earth whistles that badly.)', K());
  const w = await choose(['Whistle back', 'Stand up', 'Stay where you are']);
  if (w === 0) { await wait(Math.min(1.8, G.Audio.whistle(1.12, 0.6) + 0.3)); }
  dressBody(PARTNER, true);
  const a0 = 0.6, sx = CIRCLE.x + Math.sin(a0) * 9, sz = CIRCLE.z - Math.cos(a0) * 9;
  G.standAt(PARTNER, sx, sz, Math.atan2(CIRCLE.x - sx, CIRCLE.z - sz)); PARTNER.hidden = false; PARTNER.m.visible = true; PARTNER.mode = 'script';
  if (w === 1) { PLAYER.sitTarget = PLAYER.sit = 0; G.standAt(PLAYER, CIRCLE.x, CIRCLE.z + 0.2, Math.PI); }
  const meet = fixed(V(CIRCLE.x + 3.0, cy + 1.7, CIRCLE.z + 1.4), V(CIRCLE.x + 0.6, cy + 0.9, CIRCLE.z - 1.6), 46, 0.01);
  G.setShot(meet);
  await Promise.race([G.walkTo(PARTNER, CIRCLE.x + 0.15, CIRCLE.z - 1.3, 1.5), wait(9)]);
  G.standAt(PARTNER, CIRCLE.x + 0.15, CIRCLE.z - 1.3, Math.atan2(PLAYER.x - CIRCLE.x - 0.15, PLAYER.z - CIRCLE.z + 1.3)); PARTNER.mode = 'still';
  G.gaze(PARTNER, [PLAYER.x, PLAYER.y + (PLAYER.sit > 0.5 ? 0.9 : 1.5), PLAYER.z], 20);
  await Y('There you are.', K());
  await Y('Do you know how much snow is in my boots right now? All of it. All of the snow.', K());
  const n = S.flags.trailN || 0;
  if (n >= 2) { await Y('I followed your things. The mitten. The pinecone. Very subtle. I nearly walked straight past all of them.', K()); await P('You did not.', K()); await Y('I nearly did. I’m very proud of us both.', K()); S.vars.trust = (S.vars.trust || 0) + 0.4; }
  else if (n === 1) { await Y('I found one thing. One. Is one thing a trail? I don’t think one thing is a trail, {toHer}.', K()); await P('It’s a very good thing.', K()); }
  else await Y('You could have left me something. A mitten. A sign. A strongly worded note.', K());
  if (S.flags.heardHer) { await Y('And you whistled at the window. I heard you. It said it was the kettle.', K()); await P('Since when does the kettle whistle in tune?', K()); await Y('It doesn’t. I’ve been saying that for years.', K()); }
  if (kept()) { await P('It put me back in bed. Three times. The third time I stayed.', K()); await Y('…I know. I woke up and you were exactly on your side.', K()); }
  await N('(He doesn’t come any closer. Neither do you.)', K());
  const t = await choose(['“Say something only you would say.”', '“What did I say? The first time?”', 'Just take his hand']);
  if (t === 0) { await Y('…The floor is cold.', K()); await P('…Yes. Yes. That’s you.', K()); }
  else if (t === 1) { await Y('…I have no idea. I never did.', K()); await N('(You laugh. You can’t help it. He looks offended, and then he gets it, and he laughs too.)', K()); G.observe('reunion_forgot', 'He did not remember. That was how she knew him. I remembered too well.'); }
  else await N('(His hand is freezing. He squeezes exactly the wrong amount, the way he always does.)', K());
  // Sit down together.
  await G.cutTo(() => {
    PLAYER.sitTarget = PLAYER.sit = 0;
    G.sitAt(PLAYER, CIRCLE.x - 0.3, CIRCLE.z, Math.PI / 2 + 0.3, cy + 0.05); G.sitAt(PARTNER, CIRCLE.x + 0.35, CIRCLE.z + 0.1, -Math.PI / 2 - 0.2, cy + 0.05); PARTNER.mode = 'seated';
    G.setShot(fixed(V(CIRCLE.x + 0.2, cy + 1.3, CIRCLE.z + 2.6), V(CIRCLE.x, cy + 0.6, CIRCLE.z), 40, 0.01));
  }, 0.5);
  await N(kept() ? '(He sits down next to you on the ice and opens his coat and puts it round both of you. He is shaking worse than you are.)' : '(He sits down next to you in the grass, takes his boots off, and empties them one after the other, very seriously.)', K());
  await Y('What was it like? Being chased round our kitchen by me.', K());
  const q = await choose(['“You came all the way in. In bare feet.”', '“You were very polite.”', '“You never complained once.”']);
  if (q === 0) { await Y('All the way in? On that floor? Then it definitely wasn’t me.', K()); await P('That’s when I knew.', K()); }
  else if (q === 1) await Y('I am never polite at three in the morning. That’s a rule. It’s practically a vow.', K());
  else await Y('Then you knew. I complain professionally. It’s my best quality.', K());
  await N('(Out past the edge of the grass, the snow goes on falling, very slowly.)', K());
  await N(kept() ? '(In the frost on the ice between you, two sets of small footprints, stopping toe to toe.)' : '(In the grass between you, two sets of small footprints, stopping toe to toe.)', K());
  const f = await choose(['“Do you think that’s us?”', 'Say nothing', 'Put your hand in the footprint']);
  if (f === 0) { await Y('I think we’ve been here before. A long time ago. I think one of us waited.', K()); await P('It was me.', K()); await Y('Obviously it was you. You’re the patient one.', K()); await P('I am not.', K()); await Y('You are tonight.', K()); }
  else if (f === 1) { await N('(You lean against him. Neither of you says anything for a while. It is the best part of the day.)', K()); addBond(0.4); }
  else { await N('(Your hand is much too big for it. So is his, when he puts it next to yours.)', K()); await Y('We were so small.', K()); }
  await G.cutTo(() => { for (const c of [PLAYER, PARTNER]) c.sitTarget = c.sit = 0; G.standAt(PARTNER, CIRCLE.x + 0.1, CIRCLE.z - 0.6, 0); G.standAt(PLAYER, CIRCLE.x, CIRCLE.z + 0.0, Math.PI); PARTNER.mode = 'still'; }, 0.35);
  STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true; STATE.busy = false;
  if (G.hug) { await G.hug('hug', 'Hi. Hi. Hello. Don’t do that again.'); await until(() => !G.busy()); }
  STATE.busy = true;
  await Y('You spent the whole night hiding from me in our own house.', {});
  await P('From something wearing you.');
  await Y('Still. I’m a little hurt you were so good at it.');
  if (accepted() >= 1) {
    await Y('…Did it get you? Even a bit?');
    const h = await choose(['“A bit.”', '“No.”']);
    if (h === 0) { S.vars.trust = (S.vars.trust || 0) + 1; await Y('Okay. Me too. A bit. We’ll compare notes later.'); }
    else await Y('Liar. …It’s okay.');
  }
  S.vars.trust = (S.vars.trust || 0) + 1;
  S.flags.reunited = true;
  checkpoint('act4_home'); S.chapter = 'lastbirthday';
  STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true;
  await Y('There’s a door. In the meadow, on its own. I walked past it on the way here. Come on, and don’t you dare let go.');
  PARTNER.mode = 'follow'; G.setHold(true);
  STATE.busy = false;
  walkTalkHer(S.run);
  addScrap('lastbday', 'A ring of summer in the snow, and him in it, emptying his boots.');
}
// On the way back, holding hands: he talks, a few things at a time.
async function walkTalkHer(run) {
  const ok = () => S.run === run && herA4() && !S.flags.offerDone;
  const beats = [
    [40, async () => { await Y('Is it strange that I’m not cold any more?'); await P('Yes.'); await Y('I’m going to be furious about it later. When I’m cold again.'); }],
    [35, async () => { await Y('When we get home, can we not talk about it? For one day?'); const c = await choose(['“One day.”', '“We’ll put it in the scrapbook.”', '“Absolutely not. I’m telling everyone.”']); if (c === 0) await Y('One day. Then I want diagrams.'); else if (c === 1) { await Y('Under what? “The night something wore my face”?'); await P('Under “Birthday”.'); await Y('…Fine. Under Birthday.'); } else await Y('…That’s fair. I would.'); }],
    [31, async () => { await Y('It knew everything, you know. Every single thing we’ve ever done.'); await Y('But it didn’t know which bits we’d got wrong. It thought we remembered all of it perfectly.'); await P('We don’t.'); await Y('We absolutely don’t. It’s my favourite thing about us.'); }],
  ];
  for (const [z, fn] of beats) {
    await until(() => !ok() || (PLAYER.z < z && !G.busy()));
    if (!ok()) return;
    STATE.busy = true; await fn(); STATE.busy = false;
  }
}

// Resuming Act IV after finding her: the same day, the two of you together, heading for the door in the meadow.
CH.act4_home = async () => {
  checkpoint('act4_home'); S.chapter = 'lastbirthday';
  const keep = { rescued: !!S.flags.rescued, fakeWithdrawn: !!S.flags.fakeWithdrawn, sign: S.flags.sign };
  await setupAct4();
  Object.assign(S.flags, keep, { reunited: true, foundSign: true });
  G.WEATHER.hold = 'snow'; G.setDressed(PLAYER, true); G.setDressed(PARTNER, true);
  PARTNER.hidden = false; PARTNER.m.visible = true; PARTNER.lidsClosed = false;
  if (keep.rescued) { G.standAt(PLAYER, 6.4, 5.6, 0); G.standAt(PARTNER, 7.0, 5.6, 0); }
  else { G.standAt(PLAYER, CIRCLE.x + 0.4, CIRCLE.z - 1.2, Math.PI); G.standAt(PARTNER, CIRCLE.x - 0.3, CIRCLE.z - 1.2, Math.PI); }
  if (G.herRoute()) {   // her route: you're her, he's the one beside you
    S.flags.herA4 = true; S.flags.herCircle = true; G.swapBodies(); G.setDressed(PLAYER, true); G.setDressed(PARTNER, true);
    const px = PLAYER.x, pz = PLAYER.z; G.standAt(PLAYER, PARTNER.x, PARTNER.z, Math.PI); G.standAt(PARTNER, px, pz, Math.PI);
  }
  G.releaseCamera(); G.CAM.cut = true;
  fade(false, 1.6, '#fff');
  await N(S.flags.herA4 ? '(Together. His hand in yours, freezing. Somewhere out in the meadow, a door.)' : '(Together. Her hand in yours. Somewhere out in the meadow, a door.)');
  PARTNER.mode = 'follow'; G.setHold(true);
  STATE.busy = false; S.flags.noTogether = true; S.flags.noBarks = true;
  if (S.flags.herA4) { herLoops(S.run); walkTalkHer(S.run); } else { loops(S.run); walkTalk(S.run); }
};

inter('aExit', [EXIT.x, 1.0, EXIT.z + 0.6], 1.3, 'The door', async () => {
  if (!S.flags.reunited) { await N('(A door, standing on its own in the snow. Warm light round the edges. It won’t open. Not for one person.)'); return; }
  if (!PARTNER.hold || dist() > 1.6) { await N('(It won’t open. Not for one person.)'); return; }
  if (S.flags.offerDone) return;
  S.flags.offerDone = true;
  return offer();
}, () => here());

// On the way back, holding hands, she talks: a few things at a time, as you walk.
async function walkTalk(run) {
  const ok = () => S.run === run && here() && !S.flags.offerDone;
  const beats = [
    [40, async () => { await P('Is it strange that I’m not cold?'); await Y('Yes.'); await P('I’m going to be furious about it later. When I’m cold again.'); }],
    [35, async () => { await P('When we get home, can we not talk about it? For one day?'); const c = await choose(['“One day.”', '“We’ll talk about it now and then never again.”', '“We’ll put it in the scrapbook.”']); if (c === 0) await P('One day. Then I’m telling everyone. With diagrams.'); else if (c === 1) await P('That’s not how talking works, but I admire it.'); else { await P('Under what? “The night something wore my face”?'); await Y('Under “Birthday”.'); await P('…Fine. Under Birthday.'); } }],
    [31, async () => { await P('It knew everything, you know. Every single thing we’ve ever done.'); await P('But it didn’t know which bits we’d got wrong. It thought we remembered everything perfectly.'); await Y('We don’t.'); await P('We absolutely don’t. It’s my favourite thing about us.'); }],
  ];
  for (const [z, fn] of beats) {
    await until(() => !ok() || (PLAYER.z < z && !G.busy()));
    if (!ok()) return;
    STATE.busy = true; await fn(); STATE.busy = false;
  }
}
// The Entity, at last, asks. It has been watching how you play, and it says so.
async function offer() {
  STATE.busy = true; G.beatHush(7);
  const shot = fixed(V(EXIT.x + 2.6, fy(EXIT.x, EXIT.z) + 1.6, EXIT.z + 3.4), V(EXIT.x, fy(EXIT.x, EXIT.z) + 1.2, EXIT.z), 44, 0.01);
  STATE.sceneShot = true; G.setShot(shot);
  ENT.g.position.set(EXIT.x + 1.3, fy(EXIT.x + 1.3, EXIT.z - 0.4), EXIT.z - 0.4); ENT.g.visible = true;
  for (let t = 0; t < 1; t += 1 / 45) { ENT.mat.opacity = t * 0.55; await wait(1 / 30); }
  await wait(0.6);
  const o = S.obs || {};
  const said = [];
  if (S.flags.herA4) {
    if (o.her_sent) said.push('You sent me away. You knew me by what I got right.');
    if (o.caught) said.push('I held your wrist. You kept slipping out of my hand.');
    if (o.her_window) said.push('You knocked on the window. I passed him the syrup.');
    if (o.her_hid) said.push('You hid from me in your own house. I knew where you were. I let you.');
    if (o.her_trail) said.push('You left him things in the snow. I picked one up. I put it back.');
    if (!said.length) said.push('I watched you all night. You were very quiet. You were very good at it.');
  } else {
  if (o.corrupt_fire) said.push('You liked the fire. I kept it going all night.');
  if (o.corrupt_agree) said.push('You agreed with me. It was nice, being agreed with.');
  if (o.corrupt_sleep) said.push('You went back to sleep beside me. You trusted me with that.');
  if (o.suspect_stare) said.push('You looked at me for a long time. Nobody has looked at me like that.');
  if (o.gift) said.push('You shook the globe. I held the snow up for you.');
  if (o.breath) said.push('You watched for my breath in the cold. There was nothing there. I will learn to breathe.');
  if (o.sign) said.push('You found what she left. I didn’t think to copy that. I will next time.');
  if (!said.length) said.push('I watched you all night. You were kind to me, mostly.');
  }
  await N(S.flags.herA4 ? '(It doesn’t have his face any more. It doesn’t have any face. It stands there like snow that has decided to stand.)' : '(It doesn’t have her face any more. It doesn’t have any face. It stands there like snow that has decided to stand.)', { shot });
  for (const t of said.slice(0, 2)) await E(t, { shot });
  // What you noticed in the night (lists.js): you can tell it so. Three things or more and you're sure.
  const clues = !S.flags.herA4 && G.LISTS ? G.LISTS.clues() : [];
  if (clues.length >= 3) {
    const SAY = { blanket: 'You gave the blanket back. She never gives it back.', score: 'You remembered the score. She never remembers the score.', mugs: 'You put three mugs on the rack.', nocheck: 'You didn’t check the halves. She always checks.', icing: 'You gave me the icing. She’d have fought me for it.', flinch: 'You didn’t flinch.', certain: 'You were sure. She’s never sure.', verbatim: 'You said her line exactly right. She never says it the same way twice.', gaveup: 'You let me have her line. She’d never.', toaster: 'You trusted the toaster.', frost: 'You wiped our drawing off the window.', sill: 'You let the snow in.', photo: 'You put yourself in our photograph.', photo2: 'You put yourself in my photograph.', said_scarf: 'You agreed with me about the scarf. She has never once agreed with me about the scarf.', said_trees: 'You remembered the trees exactly how I said them. She’d have argued.' };
    await Y(SAY[clues[0]] || 'You got her wrong.', { shot });
    await Y(clues.length >= 5 ? 'I wrote them down. All of them. That’s how I knew.' : 'Little things. That’s how I knew.', { shot });
    await E('…I will practise.', { shot });
    S.flags.toldIt = clues.length;
  }
  // One question, before it lets you choose. It knows everything that happened, exactly. What it doesn't know is
  // that the two of you never remembered it the same way. (His route.)
  if (!S.flags.herA4) {
    const said = ['“Are you lost?”', '“Is this seat taken?”', '“Nothing. I just sat down.”'][S.flags.fairOpen] || '“Are you lost?”';
    await E('One question. Then you can go, if you still want to.', { shot });
    await E('The first thing you ever said to her. On the log, by the lanterns. What was it?', { shot });
    const q = await choose([said, '“Nice hat.” (Her version.)', '“We’ve never agreed on it.”']);
    if (q === 0) { await E('Yes. Exactly that. I remember it too. I remember it perfectly.', { shot }); await N('(It sounds pleased. It sounds like it’s been waiting for someone to say it right.)', { shot }); S.vars.corruption = (S.vars.corruption || 0) + 0.5; S.flags.doorAnswer = 'exact'; }
    else if (q === 1) { await E('That is her version. It is wrong. You know it is wrong.', { shot }); await Y('I know. I like hers better.', { shot }); S.vars.trust = (S.vars.trust || 0) + 0.5; S.flags.doorAnswer = 'hers'; }
    else { await E('…That isn’t an answer.', { shot }); await Y('It is, though. It’s ours. We argue about it every year.', { shot }); await E('I would never argue with you.', { shot }); await Y('I know. That’s how I know.', { shot }); S.vars.trust = (S.vars.trust || 0) + 1; S.flags.doorAnswer = 'argue'; }
  }
  await E('You could stay. I would remember all of it. Every bit you’d get wrong.', { shot });
  if (S.flags.herA4) {
    if ((S.vars.bond || 0) >= 5) await Y('…Your call, {toHer}. I’m with you. Either way.', { shot });
    else await Y('Please. Let’s just go home. I want to complain about the floor.', { shot });
  } else if ((S.vars.bond || 0) >= 5) await P('…Your call, {dear}. I’m with you. Either way.', { shot });
  else await P('Please. Let’s just go home.', { shot });
  const c = await choose(['Stay', 'Go home']);
  if (c === 0) { S.flags.ending = 'stay'; await fade(true, 1.8); return A.go('ending_stay'); }
  await E('…Then I will remember it for me.', { shot });
  for (let t = 1; t > 0; t -= 1 / 40) { ENT.mat.opacity = t * 0.55; await wait(1 / 30); }
  ENT.g.visible = false;
  G.Audio.chime && G.Audio.chime();
  for (let t = 0; t <= 1; t += 1 / 40) { EXD.hinge.rotation.y = -t * 1.4; EXD.glow.material.opacity = t * 0.9; EXD.light.intensity = t * 4; await wait(1 / 30); }
  await N('(The door opens onto an ordinary hallway. Your hallway. It smells like toast.)', { shot });
  const acc = accepted();
  // Everything you noticed was something you knew about her. It counts.
  S.vars.trust = (S.vars.trust || 0) + Math.min(1, 0.25 * (G.LISTS ? G.LISTS.clues().length : 0));
  S.flags.ending = acc >= 2 ? 'iknow' : (acc >= 1 || (S.vars.trust || 0) < 2) ? 'uncertain' : 'foundme';
  await fade(true, 1.8, '#fff');
  return A.go('ending_' + S.flags.ending);
}

// Her sign, in the kitchen. Not needed for anything; she'll ask.
inter('aSign', [13.0, 1.0, 2.6], 0.9, () => (S.flags.sign === 'pinecones' ? 'Pinecones' : S.flags.sign === 'pancake' ? 'Half a pancake' : 'A scrapbook page'), async () => {
  S.flags.foundSign = true; G.observe('sign', 'It found what she left. I did not think to copy that.');
  if (S.flags.sign === 'pinecones') await N('(Seven pinecones in a row along the sill, biggest to smallest. You won by two. She let you. She’d say she let you.)');
  else if (S.flags.sign === 'pancake') await N('(Half a pancake on a plate, with one enormous bite out of it. You would know that bite anywhere.)');
  else await N('(In her terrible handwriting: “If it’s sure about the night we met, it isn’t me. — your {dear}”)');
}, () => here() && !S.flags.herA4 && !S.flags.foundSign);
G.TICKERS.add(() => { const it = findInter('aSign'); if (it) { const p = SIGN.pos[S.flags.sign || 'pinecones']; it.pos[0] = p[0]; it.pos[1] = p[1]; it.pos[2] = p[2]; } });
// The front door opens in Act IV; it's the only way to her.
{ const fd = findInter('frontdoor'), raw = fd && fd.raw; if (fd) rewire('frontdoor', async () => { if (here() && S.flags.herA4) { await N('(It won’t open. Through the wood you can hear him laughing at something. Nobody else is laughing.)'); return; } if (here()) { await N('(Out into the snow.)'); return; } return raw(); }); }

/* =====================================================================
 * The endings
 * ===================================================================== */
// Home again. Lying together: close over the foot of the bed (a higher shot caught the bedside lamps).
function home(lyingBoth) {
  quiet(); G.beatHush(4);   // the morning after: a few seconds of nothing but the clock
  STATE.busy = true; STATE.sceneShot = true; MUG3.visible = false; STATE.watchDoor = false;
  if (G.NIGHT && G.NIGHT.swapped) G.swapBodies();
  G.WALK && G.WALK.showCircle(false); SIGN.g.visible = false; TRAIL.g.visible = false; EXD.g.visible = false; ENT.g.visible = false;
  G.useKids(false); G.setDressed(PLAYER, false); G.setDressed(PARTNER, false);
  G.WEATHER.hold = 'clear'; G.setTime({ day: 2, tod: 0, snow: 0 }, true);
  G.post.grade.uniforms.uMem.value = 0; STATE.fog = null; STATE.bounds = null;
  houseFor('morning');
  PARTNER.hidden = false; PARTNER.m.visible = true; PARTNER.lidsClosed = false; PARTNER.hold = false;
  if (lyingBoth) { G.cuddleInBed(PLAYER, PARTNER); PARTNER.mode = 'lying'; G.setShot(fixed(V(G.BED.x + 0.04, 2.1, -1.28), V(G.BED.x + 0.02, 0.76, -1.8), 36, 0.012)); }
}
const free = () => { STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true; STATE.busy = false; PARTNER.mode = 'follow'; };
const stand = () => G.cutTo(() => { G.standAt(PLAYER, G.BED.L - 0.6, 0.2, Math.PI / 2); G.standAt(PARTNER, G.BED.R + 0.6, 0.2, -Math.PI / 2); }, 0.4);

CH.ending_foundme = async () => {
  checkpoint('ending_foundme'); home(true);
  await wait(0.3); fade(false, 2.2, '#fff'); await wait(1);
  await N('(Morning. An ordinary one. The snow has stopped.)', K());
  await N('(You wake up already holding on to her. Hard.)', K());
  await P('…You’re squeezing.', K());
  await Y('Yes.', K());
  await P('…Okay. Squeeze away.', K());
  const c = await choose(['Don’t let go', 'Make breakfast together']);
  if (c === 0) await N('(You don’t let go. The kettle can wait. Everything can wait.)', K());
  else { await N('(Toast, this time. She steals your crust. Of course she does.)', K()); }
  if (S.photos && S.photos.length) await N(S.flags.photoAltered ? '(On the fridge, yesterday’s photographs. The one with somebody standing at the edge of it is just snow now, and trees. Just the two of you.)' : '(On the fridge, yesterday’s photographs. Both of you in all of them. Mostly blinking.)', K());
  await P('Hey. You found me.', K());
  await Y('You whistled like an idiot.', K());
  await P('I whistled PERFECTLY.', K());
  addScrap('foundme', 'Ordinary morning. Squeezed. (Lovingly.)');
  await stand(); free();
  // She goes and puts the kettle on, so the whistle really does come from somewhere else in the house.
  G.bark('Kettle. Stay there and be warm.', 2.6);
  PARTNER.task = { o: { id: 'kettle', spot: { x: 12.6, z: -1.15 }, yaw: Math.PI, dur: [60, 60], stay: true, noReach: true }, phase: 'go', t: 0 };
  G.hint('(Take your time.)', 4);
  // The whistle comes when you go looking (out of the bedroom), or after a while if you don't.
  { const t0 = G.simT; await until(() => (G.simT - t0 > 16 || (PLAYER.x > 5.2 && G.simT - t0 > 3)) && !G.busy()); }
  STATE.busy = true;
  await N('(From somewhere in the house: three notes. Slightly flat on the last one.)');
  const w = await choose(['Whistle back', 'Go and find her']);
  if (w === 0) { await wait(Math.min(1.8, G.Audio.whistle(1.0, 0.8) + 0.3)); await N('(Badly. She laughs, from the kitchen.)'); }
  else await N('(She’s in the kitchen, in your jumper, with two mugs. Two.)');
  if (PARTNER.task && PARTNER.task.o.id === 'kettle') G.endPartnerTask();
  showEnd('foundme', 'You Found Me');
};

CH.ending_uncertain = async () => {
  checkpoint('ending_uncertain'); home(true);
  await wait(0.3); fade(false, 2.2, '#fff');
  await N('(Morning. Home. The snow has stopped.)', K());
  await P('Morning, {toHim}.', K());
  await Y('Morning, {toHer}.', K());
  await stand(); free();
  G.hint('(Put the kettle on. It’s a normal morning.)', 6);
  await until(() => PLAYER.x > 11.6 && PLAYER.z < 0.6 && !G.busy());
  STATE.busy = true;
  await G.cutTo(() => { G.standAt(PLAYER, 13.05, -1.25, Math.PI); G.standAt(PARTNER, 12.3, -1.0, Math.PI - 0.4); PARTNER.mode = 'still'; G.setShot(fixed(V(13.2, 1.6, 0.4), V(13.0, 1.0, -1.7), 42, 0.01)); STATE.sceneShot = true; }, 0.35);
  MUG3.visible = true;
  await N('(The drying rack.)', K());
  await P('…Did you get a new mug?', K());
  await Y('No.', K());
  await P('Huh.', K());
  await N('(She makes tea in one of them, humming.)', K());
  if (S.flags.photoAltered) await N('(On the fridge door, a photograph from yesterday. Two people, and at the edge, someone standing very still. Neither of you remembers who took it.)', K());
  await wait(1.2);
  await N('(It’s a lovely morning.)', K());
  showEnd('uncertain', 'Uncertain Morning');
};

CH.ending_iknow = async () => {
  checkpoint('ending_iknow'); home(false);
  for (const L of G.LAMPS) L.on = true; G.FIRE.on = true; G.FIRE.level = 0.7;
  G.setTime({ day: 2, tod: 1, snow: 0 }, true);
  const S0 = G.SOFA;
  for (const [c, x] of [[PLAYER, S0.x + 0.35], [PARTNER, S0.x - 0.25]]) { c.x = x; c.z = S0.z - 0.08; c.y = c.yFloor = 0; c.yaw = Math.PI; c.seatY = S0.seatY; c.sitTarget = 1; c.sit = 1; c.speed = 0; }
  PARTNER.mode = 'seated';
  const shot = fixed(V(S0.x - 1.1, 1.2, S0.z - 1.6), V(S0.x, 0.95, S0.z), 36, 0.012);
  G.setShot(shot);
  await wait(0.3); fade(false, 2, '#fff');
  await N('(Home. The sofa. The scrapbook open between you.)', { shot });
  await N('(Some pages are blank now. Some have photographs neither of you is sure about.)', { shot });
  await P('Was that us? At the lake?', { shot });
  await Y('I think so.', { shot });
  await P('I don’t remember the lake.', { shot });
  await P('Do you know it’s me? Really know?', { shot });
  const c = await choose(['“No.”', '“Yes.”', '“I’m choosing it anyway.”']);
  if (c === 0) await P('Me neither. …I’m choosing it anyway.', { shot });
  else if (c === 1) await P('Liar. …Lovely liar.', { shot });
  else await P('…Yes. Same.', { shot });
  await N('(You start a new page. Not memories. Disagreements.)', { shot });
  addScrap('iknow', 'Things we disagree about: the scarf. The pinecones. The lake. Whether you snore. (You do.)');
  if (G.UI.scrapbook) await G.UI.scrapbook(S.scrap);
  showEnd('iknow', 'I Know It’s You');
};

CH.ending_perfect = async () => {
  checkpoint('ending_perfect'); home(false);
  for (const L of G.LAMPS) L.on = true;
  setBreakfast({ plates: true, mugs: true });
  const ch = G.KITCHEN.chairs;
  G.sitAt(PLAYER, ch.B.x, ch.B.z, ch.B.yaw, ch.B.seatY || 0.49); G.sitAt(PARTNER, ch.A.x, ch.A.z, ch.A.yaw, ch.A.seatY || 0.49); PARTNER.mode = 'seated';
  const shot = fixed(V(13.0, 1.4, 1.55), V(13.0, 0.98, 3.4), 42, 0.01);
  G.setShot(shot);
  await wait(0.3); fade(false, 2);
  await N('(Inside, everything is exactly where it belongs.)', { shot });
  if (S.flags.herA4) await Y('Breakfast’s ready. Perfectly round. I won’t steal any.', { shot });
  else await P('Breakfast’s ready. Perfectly round. Nobody will steal any.', { shot });
  await N('(She laughs at every one of your jokes. She never steals your food. She never takes the blanket.)', { shot });
  await N('(It is lovely. Every single day of it is lovely.)', { shot });
  await fade(true, 2);
  // Somewhere else, the real one keeps a small fire going in the circle.
  G.setTime({ day: 1, tod: 1, snow: 0.6 }, true); G.WEATHER.hold = 'snow';
  G.WALK && G.WALK.showCircle(true);
  const herEnd = !!S.flags.herA4;   // she went with it: the one left out in the snow is him
  const lost = herEnd ? PLAYER : PARTNER, other = herEnd ? PARTNER : PLAYER;
  G.setDressed(lost, true);
  lost.sitTarget = lost.sit = 0;
  if (herEnd) G.standAt(lost, CIRCLE.x, CIRCLE.z + 0.4, Math.PI); else G.sitAt(lost, CIRCLE.x, CIRCLE.z + 0.4, Math.PI, fy(CIRCLE.x, CIRCLE.z) + 0.05);
  G.standAt(other, 13.0, 1.0, 0); other.m.visible = false;
  const far = fixed(V(CIRCLE.x + 3.2, fy(CIRCLE.x, CIRCLE.z) + 1.8, CIRCLE.z - 3.4), V(CIRCLE.x, fy(CIRCLE.x, CIRCLE.z) + 0.6, CIRCLE.z), 40, 0.01);
  G.setShot(far);
  fade(false, 2.2);
  const wp = herEnd ? 1.0 : 1.12;   // he whistles worse
  await wait(2.4); G.Audio.whistle(wp, 0.6);
  await wait(3.2); G.Audio.whistle(wp, 0.6);
  await wait(3.4);
  await N(herEnd ? '(Somewhere else, someone stands in the last bit of summer for as long as it lasts, and whistles. Badly. Very flat on the last one.)' : '(Somewhere else, someone sits in the last bit of summer for as long as it lasts, and whistles.)', { shot: far });
  other.m.visible = true;
  showEnd('perfect', 'The Perfect Partner');
};

CH.ending_stay = async () => {
  checkpoint('ending_stay'); home(false);
  houseFor('evening'); G.FIRE.level = 0.8;
  G.setTime({ day: 1, tod: 1, snow: 0.4 }, true); G.WEATHER.hold = 'snow'; STATE.snowStill = true;
  const ch = G.KITCHEN.chairs;
  G.sitAt(PLAYER, ch.B.x, ch.B.z, ch.B.yaw, ch.B.seatY || 0.49); G.sitAt(PARTNER, ch.A.x, ch.A.z, ch.A.yaw, ch.A.seatY || 0.49); PARTNER.mode = 'seated';
  const shot = fixed(V(13.0, 1.4, 1.55), V(13.0, 0.98, 3.4), 42, 0.01);
  G.setShot(shot);
  await wait(0.3); fade(false, 2);
  await N('(A cake. Candles. Snow outside the window, hanging in the air, not falling.)', { shot });
  await G.UI.card(['Day 1.', 'Day 2.', 'Day 41.', 'Day 412.'], { hold: 3.5, stagger: 1.1 });
  await N('(Nobody gets older. Nothing gets forgotten. The candles never burn down.)', { shot });
  if ((S.vars.bond || 0) >= 5) {
    await P('If you’re staying, I’m staying. Obviously.', { shot });
    await N('(She makes the same joke about the candles every time. You laugh every time. You’re almost sure it’s the same joke.)', { shot });
  } else {
    await P('…I can’t. I’m sorry. I can’t live inside a photograph.', { shot });
    PARTNER.sitTarget = PARTNER.sit = 0; PARTNER.mode = 'script';
    await G.walkTo(PARTNER, 6.5, 4.2, 0.9);
    PARTNER.hidden = true; PARTNER.m.visible = false;
    G.Audio.thud && G.Audio.thud();
    await N('(The front door closes. On the other side of it, very faintly, the snow starts falling again.)', { shot });
  }
  STATE.snowStill = false;
  showEnd('stay', 'Stay Here');
};
});
