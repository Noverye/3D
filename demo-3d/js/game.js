'use strict';
/* =========================================================================
 * Game: lighting & time of day, weather, post, the camera director,
 * input, Partner, story beats, UI and the main loop.
 * ========================================================================= */
(() => {
const { $, clamp, lerp, damp, rand, MAT } = G;
/* Player settings, remembered per browser. */
const SETTINGS = (G.SETTINGS = { volume: 0.8, muted: false, view: 'third', subs: 'm', keys: {}, motion: (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'reduced' : 'full' });
try { Object.assign(SETTINGS, JSON.parse(localStorage.getItem('cbs.base.settings') || '{}')); } catch (e) { /* storage unavailable */ }
// Playing as her is switched off for now (G.PARTNER_PLAY): everyone plays as him. Her route stays in the code.
G.PARTNER_PLAY = false;
if (!G.PARTNER_PLAY) SETTINGS.playAs = 'player';
const saveSettings = () => { try { localStorage.setItem('cbs.base.settings', JSON.stringify(SETTINGS)); } catch (e) { /* ignore */ } };
G.saveSettings = saveSettings;
/* ---------- key bindings ----------
 * The game reads fixed default codes (KeyW, KeyE...). A rebound key is translated to its action's
 * default code before anything else sees it, and the old default key stops doing anything, so
 * every handler (movement, the menus, dialogue) follows the new binding with no other changes.
 * Arrow keys, Enter and Space always keep working. */
const KEY_DEFAULTS = (G.KEY_DEFAULTS = { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', run: 'ShiftLeft', interact: 'KeyE', together: 'KeyQ', photo: 'KeyT', view: 'KeyV' });
SETTINGS.keys = Object.assign({}, KEY_DEFAULTS, SETTINGS.keys || {});
G.keyName = (code) => (code || '').replace(/^Key/, '').replace(/^Digit/, '').replace(/^Shift(Left|Right)$/, 'Shift').replace(/^Control(Left|Right)$/, 'Ctrl').replace(/^Alt(Left|Right)$/, 'Alt').replace('Backquote', '`').replace('Space', 'Space').replace('Tab', 'Tab').replace(/^Numpad/, 'Num ');
G.keyFor = (action) => G.keyName(SETTINGS.keys[action] || KEY_DEFAULTS[action]);
function translateKey(code) {
  const K = SETTINGS.keys;
  for (const a in KEY_DEFAULTS) if (K[a] === code) return KEY_DEFAULTS[a];
  for (const a in KEY_DEFAULTS) if (KEY_DEFAULTS[a] === code) return 'Unbound';
  return code;
}
G.REBIND = null;   // { action, done(code) } while the pause menu waits for a key
const keyTranslate = (e) => {
  if (G.REBIND && e.type === 'keydown') {
    e.preventDefault(); e.stopImmediatePropagation();
    if (!e.repeat) { const R = G.REBIND; G.REBIND = null; R.done(e.code === 'Escape' ? null : e.code); }
    return;
  }
  const t = translateKey(e.code);
  if (t !== e.code) { try { Object.defineProperty(e, 'code', { value: t }); } catch (err) { /* read-only in this browser */ } }
};
addEventListener('keydown', keyTranslate, true);
addEventListener('keyup', keyTranslate, true);
G.applySubs = () => { document.documentElement.dataset.subs = SETTINGS.subs || 'm'; };
G.applySubs();
G.MOTION = SETTINGS.motion === 'reduced' ? 0 : 1;   // scales handheld sway, step bob and the run zoom
const STATE = (G.STATE = { started: false, tod: 0, todTarget: 0, day: 0, dayTarget: 0, snow: 1, snowTarget: 1, cuddled: false, cakeDone: false, porchDone: false, busy: false });
// Wind: a slow gust value (0..1) shared by snowfall, tree sway and the wind sound.
const WIND = (G.WIND = { gust: 0.3, drift: 0, t: 0 });
function updateWind(dt) {
  WIND.t += dt;
  const n = G.simplex.noise(WIND.t * 0.06, 3.1) * 0.7 + G.simplex.noise(WIND.t * 0.23, 7.7) * 0.3;
  WIND.bias = damp(WIND.bias || 0, WIND.biasTarget || 0, 0.15, dt);   // the weather leans the gusts calmer or wilder
  WIND.gust = clamp(0.35 + n * 0.65 + WIND.bias, 0, 1);
  WIND.drift += dt * (0.08 + WIND.gust * 0.55);
  if (G.SWAY) { G.SWAY.uTime.value = WIND.t; G.SWAY.uGust.value = WIND.gust; }
}
const angDamp = (a, b, k, dt) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * (1 - Math.exp(-k * dt)); };

/* =====================================================================
 * Audio (procedural)
 * ===================================================================== */
G.Audio = (() => {
  let droneG = null;   // the low drone under the night and Act IV (made on first use)
  let ctx = null, master, fireG, windG, windF, outF, padG, pad = [], noiseBuf = null, chordI = 0, nextChord = 0;
  const noise = () => {
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s;
  };
  // A slow progression (Cmaj7 · Am9 · Fmaj7 · G6) so the ambience breathes instead of droning.
  const CHORDS = [[130.8, 164.8, 196.0, 246.9], [110.0, 164.8, 196.0, 246.9], [87.3, 174.6, 220.0, 329.6], [98.0, 146.8, 196.0, 329.6]];
  const level = () => (SETTINGS.muted ? 0 : 0.7 * SETTINGS.volume);
  let held = false;   // paused: keep the context suspended even if a key or tap would wake it
  function start() {
    if (ctx) { if (ctx.state === 'suspended' && !held) ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = level(); master.connect(ctx.destination);
    // Outdoor bus: muffled through the walls when you're inside.
    outF = ctx.createBiquadFilter(); outF.type = 'lowpass'; outF.frequency.value = 9000; outF.connect(master);
    const f = noise(), ff = ctx.createBiquadFilter(); ff.type = 'lowpass'; ff.frequency.value = 220; fireG = ctx.createGain(); fireG.gain.value = 0; f.connect(ff); ff.connect(fireG); f.start();
    buildSpots(); fireG.connect(SPOTS.fire.in);
    const w = noise(); windF = ctx.createBiquadFilter(); windF.type = 'bandpass'; windF.frequency.value = 400; windF.Q.value = 0.6; windG = ctx.createGain(); windG.gain.value = 0.05; w.connect(windF); windF.connect(windG); windG.connect(outF); w.start();
    padG = ctx.createGain(); padG.gain.value = 0.04; const pf = ctx.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 900; pf.connect(padG); padG.connect(master);
    CHORDS[0].forEach((fr, i) => { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr; o.detune.value = (i - 1.5) * 3; o.connect(pf); o.start(); pad.push(o); });
    nextChord = ctx.currentTime + 9;
  }
  /* ---------- the soundscape: sources placed in the cabin ----------
   * Each source sits at a point in the world, heard through an HRTF panner from the camera, and is
   * muffled by a low-pass when it's in another room (walls) or outside while you're in. */
  const SPOTS = {};
  const roomOf = (x, z) => (G.inside(x, z) ? (x < 5 ? 'bed' : x < 11 ? 'liv' : 'kit') : 'out');
  function spot(id, x, y, z, o = {}) {
    const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = o.ref || 1; p.rolloffFactor = o.roll || 1.4; p.maxDistance = 40;
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 16000;
    const inp = ctx.createGain(); inp.connect(p); p.connect(lp); lp.connect(master);
    return (SPOTS[id] = { in: inp, lp, x, z, room: roomOf(x, z), panner: p });
  }
  function buildSpots() {
    spot('fire', 8.0, 0.5, 0.9, { ref: 1.2 });
    // The fridge: a low hum, two partials, slowly breathing in and out.
    const fr = spot('fridge', 14.55, 1.0, 0.5, { ref: 0.6, roll: 2 }), hum = ctx.createGain(); hum.gain.value = 0.006; hum.connect(fr.in);
    for (const [f, v] of [[50, 1], [100, 0.5], [151, 0.18]]) { const o = ctx.createOscillator(); o.frequency.value = f; const g = ctx.createGain(); g.gain.value = v; o.connect(g); g.connect(hum); o.start(); }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 0.003; lfo.connect(lg); lg.connect(hum.gain); lfo.start();
    spot('clock', 5.15, 1.95, 1.5, { ref: 0.5, roll: 1.8 });
    spot('kettle', 11.55, 1.0, 0.36, { ref: 0.8 });
    spot('door', 6.5, 1.2, 4.6, { ref: 1 });
    spot('gerald', 2.4, 1.0, 4.85, { ref: 0.5, roll: 1.6 });
    // The kitchen radio: a small speaker, so the music is band-limited and a little boxy.
    const rs = spot('radio', 13.55, 1.0, 4.4, { ref: 0.9, roll: 1.3 });
    const box = ctx.createBiquadFilter(); box.type = 'bandpass'; box.frequency.value = 1300; box.Q.value = 0.45;
    radioOut = ctx.createGain(); radioOut.gain.value = 0; radioOut.connect(box); box.connect(rs.in);
    // Partner humming: a source that follows her around.
    const hs = spot('hum', 0, 1.5, 0, { ref: 0.7, roll: 1.5 }); hs.moving = true;
    // Wind finding the gaps around the window frames.
    for (const [i, x, z] of [[0, 2.4, 4.6], [1, 9.4, 4.6], [2, 13.0, 4.6], [3, 0, -0.15], [4, 15, 2.1]]) {
      const s = spot('win' + i, x, 1.4, z, { ref: 0.7, roll: 1.6 }), n = noise(), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900 + i * 230; bp.Q.value = 4;
      const g = ctx.createGain(); g.gain.value = 0; n.connect(bp); bp.connect(g); g.connect(s.in); n.start(Math.random()); s.g = g; s.bp = bp;
    }
  }
  let humPos = null;
  let tickHoldUntil = 0, tickVol = 1;
  let nextTick = 0, tickN = 0, radioOut = null, radioOn = false, radioNext = 0, radioBar = 0;
  /* The radio plays something soft: a four-chord loop on an electric-piano-ish voice, a wandering
   * melody over it, brushed noise on the beat, and a little crackle. Scheduled a bar ahead. */
  const RCH = [[174.6, 220, 261.6, 329.6], [146.8, 174.6, 220, 261.6], [116.5, 146.8, 174.6, 220], [130.8, 164.8, 196, 220]];
  const RMEL = [523.3, 587.3, 659.3, 784, 880, 698.5];
  const ep = (f, t, d, v) => { const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o2.frequency.value = f * 2.001; o2.type = 'sine'; const g2 = ctx.createGain(); g2.gain.value = 0.25; o.connect(g); o2.connect(g2); g2.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d); g.connect(radioOut); o.start(t); o2.start(t); o.stop(t + d + 0.1); o2.stop(t + d + 0.1); };
  let melI = 2;
  function radioTick(now) {
    if (!radioOn || now < radioNext - 0.6) return;
    if (radioNext < now) radioNext = now + 0.1;
    const t = radioNext, bar = 2.6, beat = bar / 4, C = RCH[radioBar % 4];
    C.forEach((f, i) => ep(f, t + i * 0.012, bar * 0.95, 0.05));
    for (let b = 0; b < 4; b++) { burst(0.06, 6000, 0.012, 'highpass', 0.7, t + b * beat - now, radioOut); if (b % 2 === 0) ep(C[0] / 2, t + b * beat, beat * 1.6, 0.06); }
    for (let n = 0; n < 4; n++) { if (Math.random() < 0.3) continue; melI = Math.max(0, Math.min(RMEL.length - 1, melI + Math.floor(Math.random() * 3) - 1)); ep(RMEL[melI], t + n * beat + (Math.random() < 0.3 ? beat / 2 : 0), beat * 1.4, 0.035); }
    if (Math.random() < 0.6) burst(0.02, 3000, 0.01, 'bandpass', 1, t + Math.random() * bar - now, radioOut);
    radioNext += bar; radioBar++;
  }
  function updateSpots(lx, ly, lz, fx, fz, room, t) {
    const L = ctx.listener, now = ctx.currentTime;
    if (L.positionX) { L.positionX.setTargetAtTime(lx, now, 0.03); L.positionY.setTargetAtTime(ly, now, 0.03); L.positionZ.setTargetAtTime(lz, now, 0.03); L.forwardX.value = fx; L.forwardY.value = 0; L.forwardZ.value = fz; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else { L.setPosition(lx, ly, lz); L.setOrientation(fx, 0, fz, 0, 1, 0); }
    for (const id in SPOTS) {
      const s = SPOTS[id];
      const f = s.room === room ? 16000 : s.room === 'out' || room === 'out' ? 450 : 1100;
      s.lp.frequency.setTargetAtTime(f, now, 0.25);
    }
    // The clock: a tick and a slightly different tock, once a second.
    if (now < tickHoldUntil) { if (nextTick < now) nextTick = now + 1; }   // the clock, holding its breath (oddities.js)
    else if (now > nextTick - 0.05) { if (nextTick < now) nextTick = now + 0.05; burst(0.025, tickN % 2 ? 2600 : 3200, 0.05 * tickVol, 'bandpass', 6, nextTick - now, SPOTS.clock.in); tickN++; nextTick += 1; }
    radioTick(now);
    if (humPos && SPOTS.hum) { const pn = SPOTS.hum.panner; if (pn.positionX) { pn.positionX.setTargetAtTime(humPos.x, now, 0.1); pn.positionY.setTargetAtTime(humPos.y, now, 0.1); pn.positionZ.setTargetAtTime(humPos.z, now, 0.1); } else pn.setPosition(humPos.x, humPos.y, humPos.z); SPOTS.hum.room = roomOf(humPos.x, humPos.z); }
    const gust = G.WIND.gust;
    for (let i = 0; i < 5; i++) { const s = SPOTS['win' + i]; s.g.gain.setTargetAtTime(Math.max(0, gust - 0.45) * 0.05, now, 0.6); s.bp.frequency.setTargetAtTime(800 + i * 230 + gust * 600, now, 0.8); }
  }
  const tone = (f, d, v = 0.06, when = 0, dest) => { if (!ctx) return; const t = ctx.currentTime + when; const o = ctx.createOscillator(); o.frequency.value = f; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.2); o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + d + 0.3); };
  const burst = (dur, freq, vol, type = 'bandpass', q = 1, when = 0, dest) => { if (!ctx) return; const t = ctx.currentTime + when; const s = noise(); const bf = ctx.createBiquadFilter(); bf.type = type; bf.frequency.value = freq; bf.Q.value = q; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(bf); bf.connect(g); g.connect(dest || master); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); };
  /* ---------- the score: a quiet piano over the pad ----------
   * Short phrases built from the pad's current chord and a pentatonic scale, with long rests between them, so it
   * comes and goes like someone playing in another room. Warm and fuller indoors in the day and evening, sparse
   * and high outside, almost nothing at night (one note now and then, sometimes not quite the right one).
   * It dips under dialogue and goes quiet for the radio. Made of oscillators: no recordings. */
  let scoreIn = null, scoreG = null, scoreNext = 0, phrase = [], melIdx = 4;
  const SCALE = [196.0, 220.0, 261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3, 784.0, 880.0];
  function scoreBus() {
    scoreIn = ctx.createGain(); scoreG = ctx.createGain(); scoreG.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; scoreIn.connect(lp); lp.connect(scoreG); scoreG.connect(master);
    // a soft room: one echo, darker each time round
    const d = ctx.createDelay(1); d.delayTime.value = 0.41; const fb = ctx.createGain(); fb.gain.value = 0.32; const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 1500; const wet = ctx.createGain(); wet.gain.value = 0.3;
    lp.connect(d); d.connect(dl); dl.connect(fb); fb.connect(d); dl.connect(wet); wet.connect(scoreG);
  }
  function key(f, t, v) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(v * 0.3, t + 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4); g.connect(scoreIn);
    for (const [m, a, ty] of [[1, 1, 'triangle'], [2.003, 0.3, 'sine'], [3.007, 0.08, 'sine']]) { const o = ctx.createOscillator(); o.type = ty; o.frequency.value = f * m; const og = ctx.createGain(); og.gain.value = a; o.connect(og); og.connect(g); o.start(t); o.stop(t + 3.5); }
  }
  function compose(mood) {
    const chord = CHORDS[chordI].map((f) => { let x = f; while (x < 250) x *= 2; return x; });
    const n = mood === 'night' ? 1 : mood === 'sparse' ? 3 + Math.floor(Math.random() * 3) : 4 + Math.floor(Math.random() * 5);
    const step = mood === 'warm' ? 0.55 : 0.8, out = [];
    let at = 0;
    for (let i = 0; i < n; i++) {
      melIdx = Math.max(mood === 'sparse' ? 5 : 2, Math.min(SCALE.length - 1, melIdx + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
      let f = SCALE[melIdx];
      if (i % 2 === 0) { const c = chord.reduce((a, b) => (Math.abs(b - f) < Math.abs(a - f) ? b : a)); if (Math.abs(c - f) / f < 0.2) f = c; }   // chord tones on the strong beats
      if (mood === 'night' && Math.random() < 0.3) f *= 1.0595;   // not quite the right note
      out.push({ f, at, v: (i === 0 ? 1 : 0.8) * (0.7 + Math.random() * 0.3) });
      if (mood === 'warm' && i === n - 1 && Math.random() < 0.5) out.push({ f: chord[0] / 2, at, v: 0.55 });   // a low note under the last one
      at += step * (Math.random() < 0.25 ? 2 : 1);
    }
    return { notes: out, len: at };
  }
  function scoreTick(o) {
    if (!ctx) return;
    if (!scoreIn) scoreBus();
    const now = ctx.currentTime, want = o.on ? (o.mood === 'night' ? 0.5 : o.mood === 'sparse' ? 0.75 : 1) * (o.duck ? 0.55 : 1) : 0;
    scoreG.gain.setTargetAtTime(want * 0.05, now, o.on ? 2.5 : 0.8);
    if (!o.on || now < scoreNext) return;
    const p = compose(o.mood);
    p.notes.forEach((nt) => key(nt.f, now + 0.05 + nt.at, 0.5 * nt.v));
    const rest = o.mood === 'night' ? 14 + Math.random() * 16 : o.mood === 'sparse' ? 7 + Math.random() * 8 : 4 + Math.random() * 6;
    scoreNext = now + p.len + rest;
  }
  // Music-box note: a bright fundamental with a quickly decaying metallic partial.
  const bell = (f, when, v = 0.05) => { tone(f, 1.1, v, when); tone(f * 4.2, 0.12, v * 0.25, when); tone(f * 2, 0.5, v * 0.3, when); };
  return {
    start, tone,
    applyVolume() { if (ctx) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.05); },
    hold(on) { held = on; if (!ctx) return; if (on) ctx.suspend(); else ctx.resume(); },
    set(o) {
      if (!ctx) return; const t = ctx.currentTime;
      if (o.fire != null) fireG.gain.setTargetAtTime(o.fire * 0.22, t, 0.6);
      if (o.wind != null) { windG.gain.setTargetAtTime(o.wind * 0.1, t, 0.8); windF.frequency.setTargetAtTime(320 + o.wind * 380, t, 0.8); }
      if (o.pad != null) padG.gain.setTargetAtTime(o.pad * 0.04, t, 1.5);
      if (o.drone != null) {
        if (!droneG) {
          // Two low sines a couple of hertz apart (a slow beating), an octave above for body, all through a dark filter.
          droneG = ctx.createGain(); droneG.gain.value = 0; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.connect(droneG); droneG.connect(master);
          for (const [f, v, ty] of [[49, 1, 'sine'], [51.4, 0.8, 'sine'], [98.6, 0.25, 'triangle']]) { const os = ctx.createOscillator(); os.type = ty; os.frequency.value = f; const g = ctx.createGain(); g.gain.value = v; os.connect(g); g.connect(lp); os.start(); }
        }
        droneG.gain.setTargetAtTime(o.drone * 0.07, t, o.droneFast ? 0.025 : 2.2);
      }
      if (o.inside != null) outF.frequency.setTargetAtTime(o.inside ? (o.doorOpen ? 2600 : 650) : 9000, t, 0.35);   // an open front door lets the outside in
      if (t > nextChord) { chordI = (chordI + 1) % CHORDS.length; CHORDS[chordI].forEach((fr, i) => pad[i].frequency.setTargetAtTime(fr, t, 1.8)); nextChord = t + 9 + Math.random() * 3; }
    },
    click() { tone(1800, 0.01, 0.03); },
    tickHold(sec) { if (ctx) tickHoldUntil = ctx.currentTime + sec; },
    tickLoud(v) { tickVol = v; },
    score(o) { scoreTick(o); return ctx ? scoreNext - ctx.currentTime : 0; },   // (seconds until the next phrase)
    // A heartbeat, felt more than heard: two low thumps (lub-dub).
    heart(v = 1) { burst(0.11, 65, 0.2 * v, 'lowpass', 1.2); burst(0.09, 55, 0.14 * v, 'lowpass', 1.2, 0.26); },
    crackle(dt, level) {
      if (!ctx) return;
      if (Math.random() < dt * 10 * level) burst(0.04, 1500 + Math.random() * 2500, 0.1 * Math.random(), 'bandpass', 2, 0, SPOTS.fire.in);
      // Now and then a log settles: a soft thump and a little shower of sparks.
      if (Math.random() < dt * 0.04 * level) { burst(0.25, 160, 0.14, 'lowpass', 1, 0, SPOTS.fire.in); for (let i = 0; i < 6; i++) burst(0.03, 2000 + Math.random() * 3000, 0.08, 'bandpass', 2, 0.05 + i * 0.04 * Math.random(), SPOTS.fire.in); if (G.sparkBurst) G.sparkBurst(); }
    },
    spatial(lx, ly, lz, fx, fz, room, t) { if (ctx) updateSpots(lx, ly, lz, fx, fz, room, t); },
    radio(on) { radioOn = on; if (!ctx) return; radioOut.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, on ? 0.4 : 0.15); burst(0.05, 2500, 0.05, 'bandpass', 3, 0, SPOTS.radio.in); if (on) radioNext = ctx.currentTime + 0.3; },
    radioOn: () => radioOn,
    humAt(p) { humPos = p; },
    // Partner humming the snow globe's tune to herself, a few bars, off-key and content.
    hum() {
      if (!ctx) return 0; const N = [659.3, 784, 880, 784, 659.3, 587.3, 659.3, 523.3], b = 0.55;
      N.forEach((f0, i) => { const t = ctx.currentTime + i * b * (i === 3 ? 1.6 : 1), f = f0 / 2 * (1 + (Math.random() - 0.5) * 0.01), o = ctx.createOscillator(), v = ctx.createOscillator(), vg = ctx.createGain(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = f; v.frequency.value = 5.2; vg.gain.value = f * 0.012; v.connect(vg); vg.connect(o.frequency); lp.type = 'lowpass'; lp.frequency.value = 900;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.022, t + 0.08); g.gain.setTargetAtTime(0.0001, t + b * 0.8, 0.12); o.connect(lp); lp.connect(g); g.connect(SPOTS.hum.in); o.start(t); v.start(t); o.stop(t + b * 1.6); v.stop(t + b * 1.6); });
      return N.length * b;
    },
    door(open) { if (!ctx) return; if (open) { const t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.linearRampToValueAtTime(160, t + 0.7); const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 700; bf.Q.value = 9; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.012, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8); o.connect(bf); bf.connect(g); g.connect(SPOTS.door.in); o.start(t); o.stop(t + 0.9); burst(0.04, 1500, 0.05, 'bandpass', 3, 0, SPOTS.door.in); } else { burst(0.18, 140, 0.16, 'lowpass', 1, 0, SPOTS.door.in); burst(0.03, 2000, 0.05, 'bandpass', 4, 0.02, SPOTS.door.in); } },
    rattle() { for (let i = 0; i < 4; i++) burst(0.03, 1700 + Math.random() * 600, 0.06, 'bandpass', 5, i * 0.07); },
    tweet() { if (!ctx) return; const n = 2 + Math.floor(Math.random() * 3), f0 = 3600 + Math.random() * 900; for (let i = 0; i < n; i++) { const t = ctx.currentTime + i * 0.11, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.75, t + 0.07); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.02, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); o.connect(g); g.connect(SPOTS.gerald.in); o.start(t); o.stop(t + 0.1); } },
    // A kettle coming to the boil: rising hiss, then the click.
    kettle() {
      if (!ctx) return; const t = ctx.currentTime, n = noise(), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.setValueAtTime(500, t); bp.frequency.linearRampToValueAtTime(3200, t + 5);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 4.5); g.gain.setTargetAtTime(0, t + 5.2, 0.4); n.connect(bp); bp.connect(g); g.connect(SPOTS.kettle.in); n.start(); n.stop(t + 7.5);
      burst(0.03, 1800, 0.12, 'bandpass', 4, 5.2, SPOTS.kettle.in);
    },
    // The house settling in the cold, and night birds outside.
    creak() { if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(90 + Math.random() * 40, t); o.frequency.linearRampToValueAtTime(70 + Math.random() * 30, t + 0.5); const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 420; bf.Q.value = 8; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.012, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); o.connect(bf); bf.connect(g); g.connect(master); o.start(t); o.stop(t + 0.7); },
    owl() { if (!ctx) return; for (const [w, f, d] of [[0, 410, 0.35], [0.55, 380, 0.2], [0.85, 400, 0.6]]) { const t = ctx.currentTime + w, o = ctx.createOscillator(); o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 0.92, t + d); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.018, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.1); o.connect(g); g.connect(outF); o.start(t); o.stop(t + d + 0.2); } },
    poke() { if (!ctx) return; burst(0.12, 400, 0.08, 'lowpass', 1, 0, SPOTS.fire.in); for (let i = 0; i < 10; i++) burst(0.03, 1800 + Math.random() * 3500, 0.07, 'bandpass', 2, 0.05 + Math.random() * 0.5, SPOTS.fire.in); },
    thwump() { burst(0.12, 500, 0.12, 'lowpass', 1); burst(0.15, 3000, 0.04, 'highpass', 0.8, 0.01); },
    tap() { tone(900, 0.03, 0.03); tone(900, 0.03, 0.03, 0.14); },
    flump() { burst(0.5, 300, 0.07, 'lowpass', 0.8, 0, outF); burst(0.35, 2400, 0.02, 'highpass', 0.7, 0.05, outF); },
    step(surface, vol = 1) {
      if (!ctx) return;
      if (surface === 'rug') { burst(0.06, 260, 0.035 * vol, 'lowpass', 0.8); return; }
      if (surface === 'porch') { burst(0.09, 180, 0.1 * vol, 'lowpass', 1.6); burst(0.05, 900, 0.025 * vol, 'bandpass', 3, 0.01); return; }
      if (surface === 'ice') {
        // Hard and hollow: a knock, and now and then the faint singing ring of lake ice.
        burst(0.05, 900 + Math.random() * 300, 0.05 * vol, 'bandpass', 2.5); burst(0.03, 3400, 0.012 * vol, 'highpass', 1, 0.01);
        if (Math.random() < 0.12) { const t = ctx.currentTime + 0.03, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(1900 + Math.random() * 900, t); o.frequency.exponentialRampToValueAtTime(260, t + 0.5); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.008 * vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.6); }
        return;
      }
      if (surface === 'snow' || surface === 'packed') {
        // Crunch: a dull compress then a short bright squeak, both slightly randomised. Deep snow is
        // a longer, softer push; the trodden path is a quick, squeakier crunch.
        const deep = surface === 'snow';
        burst(deep ? 0.15 : 0.08, (deep ? 380 : 520) + Math.random() * 200, (deep ? 0.075 : 0.05) * vol, 'lowpass', 0.7);
        burst((deep ? 0.16 : 0.1) + Math.random() * 0.05, (deep ? 2100 : 2900) + Math.random() * 1400, (deep ? 0.035 : 0.05) * vol, 'bandpass', 0.9, deep ? 0.05 : 0.02);
      } else if (surface === 'creak') {
        burst(0.07, 240, 0.09 * vol, 'lowpass', 1.2);
        const t = ctx.currentTime + 0.05, o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(150, t); o.frequency.linearRampToValueAtTime(95, t + 0.32); const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 760; bf.Q.value = 7; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.02 * vol, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36); o.connect(bf); bf.connect(g); g.connect(master); o.start(t); o.stop(t + 0.4);
      } else {
        burst(0.07, 240 + Math.random() * 60, 0.09 * vol, 'lowpass', 1.2);
        if (Math.random() < 0.18) { const t = ctx.currentTime + 0.04; const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(170, t); o.frequency.linearRampToValueAtTime(120 + Math.random() * 40, t + 0.22); const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 900; bf.Q.value = 6; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.012 * vol, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26); o.connect(bf); bf.connect(g); g.connect(master); o.start(t); o.stop(t + 0.3); }
      }
    },
    blow() { burst(0.7, 1200, 0.12, 'highpass', 0.7); },
    // The snow globe's tune: a short original waltz, played like a music box winding down.
    musicBox() {
      if (!ctx) return 0;
      const C5 = 523.3, D5 = 587.3, E5 = 659.3, F5 = 698.5, G5 = 784, A5 = 880, B4 = 493.9, A4 = 440, G4 = 392;
      const b = 0.4, N = [[E5, 1], [G5, 1], [A5, 1], [G5, 2], [E5, 1], [D5, 1], [E5, 1], [C5, 3], [D5, 1], [E5, 1], [F5, 1], [E5, 2], [D5, 1], [B4, 1], [D5, 1], [G4, 3],
        [E5, 1], [G5, 1], [A5, 1], [G5, 2], [E5, 1], [F5, 1], [E5, 1], [D5, 2], [A4, 1], [B4, 1], [D5, 1], [C5, 3.5]];
      let at = 0.1; for (const [f, d] of N) { bell(f, at); at += d * b; }
      return at;
    },
    chime() { bell(1046.5, 0, 0.03); bell(1568, 0.09, 0.025); },
    // The three-note whistle they made up at the fair ("if one of us gets lost"): up, down, up-and-hold.
    // pitch: a child's is higher; wobble: a first, uncertain try.
    whistle(pitch = 1, wobble = 0, opt = {}) {
      if (!ctx) return 0;
      const dest = opt.at && SPOTS[opt.at] ? SPOTS[opt.at].in : outF, vol = opt.vol || 0.03;   // o.at: from a place in the house
      const notes = [[1318.5, 0.22], [987.8, 0.22], [1568, 0.5]];
      let at = ctx.currentTime + 0.05;
      for (const [f0, d] of notes) {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = f0 * pitch;
        o.type = 'sine';
        o.frequency.setValueAtTime(f * 0.94, at); o.frequency.exponentialRampToValueAtTime(f, at + 0.05);
        if (wobble) { o.frequency.setValueAtTime(f, at + d * 0.5); o.frequency.linearRampToValueAtTime(f * (1 - 0.04 * wobble), at + d); }
        g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(vol, at + 0.03); g.gain.setValueAtTime(vol, at + d - 0.06); g.gain.exponentialRampToValueAtTime(0.0001, at + d);
        o.connect(g); g.connect(dest); o.start(at); o.stop(at + d + 0.02);
        at += d + 0.07;
      }
      return at - ctx.currentTime;
    },
    // A winter bird somewhere outside: two or three quick falling notes, muffled by the walls when you're in.
    chirp() {
      if (!ctx) return; const n = 2 + Math.floor(Math.random() * 2), f0 = 3200 + Math.random() * 1400;
      for (let i = 0; i < n; i++) { const t = ctx.currentTime + i * 0.13, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.7, t + 0.08); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.012, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(g); g.connect(outF); o.start(t); o.stop(t + 0.12); }
    },
    // Batter in a hot pan.
    sizzle(on) {
      if (!ctx) return;
      if (on && !this._sz) { const s = noise(), bf = ctx.createBiquadFilter(); bf.type = 'highpass'; bf.frequency.value = 2500; const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.03, ctx.currentTime, 0.3); s.connect(bf); bf.connect(g); g.connect(master); s.start(); this._sz = { s, g }; }
      if (!on && this._sz) { const z = this._sz; this._sz = null; z.g.gain.setTargetAtTime(0, ctx.currentTime, 0.3); z.s.stop(ctx.currentTime + 1.5); }
    },
    flip() { burst(0.08, 900, 0.05, 'bandpass', 1.5); tone(220, 0.05, 0.02, 0.05); },
    // A match: the scratch, then the soft flare catching.
    strike() { burst(0.09, 2600, 0.05, 'highpass', 0.9); burst(0.05, 1800, 0.04, 'bandpass', 2, 0.04); burst(0.35, 520, 0.03, 'lowpass', 0.8, 0.1); },
    // A fingertip dragged on cold glass: a thin, wavering, rubbery squeak in short strokes.
    squeak(strokes = 3) {
      if (!ctx) return;
      for (let i = 0; i < strokes; i++) {
        const t = ctx.currentTime + i * (0.22 + Math.random() * 0.12), d = 0.12 + Math.random() * 0.14, f = 1300 + Math.random() * 700;
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(f, t);
        o.frequency.linearRampToValueAtTime(f * (0.85 + Math.random() * 0.35), t + d);
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 38 + Math.random() * 20; lg.gain.value = f * 0.05; lfo.connect(lg); lg.connect(o.frequency);
        const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = f; bf.Q.value = 6;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.012, t + 0.02); g.gain.setValueAtTime(0.012, t + d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(bf); bf.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.05); lfo.start(t); lfo.stop(t + d + 0.05);
      }
    },
    // A page turning: a soft paper swish, then the faint pat of it landing.
    page() { burst(0.22, 3200, 0.03, 'bandpass', 0.7); burst(0.16, 6000, 0.012, 'highpass', 0.5, 0.05); burst(0.05, 700, 0.02, 'lowpass', 1, 0.24); },
    // A log catching: a breathy whoomp, then the crackle quickening.
    catchFire() {
      if (!ctx) return;
      burst(0.6, 260, 0.09, 'lowpass', 0.8, 0, SPOTS.fire.in); burst(0.5, 1100, 0.03, 'bandpass', 0.6, 0.05, SPOTS.fire.in);
      for (let i = 0; i < 16; i++) burst(0.025, 2000 + Math.random() * 4000, 0.05 + Math.random() * 0.04, 'bandpass', 2, 0.3 + Math.random() * 1.4, SPOTS.fire.in);
    },
    // Small paws on snow: light, quick, uneven crunches that go off into the distance.
    paws(n = 8) { for (let i = 0; i < n; i++) { const v = 0.05 * (1 - i / (n + 2)); burst(0.06, 1400 + Math.random() * 500, v, 'bandpass', 1.6, i * (0.16 + Math.random() * 0.07), outF); burst(0.04, 300, v * 0.6, 'lowpass', 1, i * 0.18 + 0.01, outF); } },
  };
})();

/* =====================================================================
 * Lights, time of day, weather
 * ===================================================================== */
const key = new THREE.DirectionalLight('#ffb070', 3);
key.castShadow = true; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
const sc = key.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 90;
G.scene.add(key); G.scene.add(key.target);
const hemi = new THREE.HemisphereLight('#9a8fc0', '#d8c0c8', 0.5); G.scene.add(hemi);
G.scene.fog = new THREE.Fog('#b48aa0', 30, 230);
const pathLights = [new THREE.PointLight('#ffa860', 0, 6, 2), new THREE.PointLight('#ffa860', 0, 6, 2)];
pathLights.forEach((l) => G.scene.add(l));
const MOON_DIR = new THREE.Vector3(-0.25, 0.62, 0.74).normalize();
const C = (h) => new THREE.Color(h);
// [sunset, night]; DAY holds the daylight values each is blended toward by STATE.day.
const PAL = {
  keyCol: [C('#ffac6a'), C('#8ea6e8')], keyI: [3.2, 0.7],
  sky: [C('#9a94c8'), C('#22325a')], gnd: [C('#f0d2d0'), C('#1a2238')], hemiI: [1.7, 0.75],
  fog: [C('#c08e9c'), C('#0c1324')], exposure: [0.92, 1.3],
};
const DAY = { keyCol: C('#fff0dc'), keyI: 3.3, sky: C('#b4c8e6'), gnd: C('#e8edf4'), hemiI: 1.3, hemiIn: 1.0, fog: C('#c6d3e4'), exposure: 0.74, glass: C('#a8b8c8'), skyIn: C('#f2e2c8'), gndIn: C('#c49a74') };
const GLASS_WARM = C('#ffb46a'), tmpC = new THREE.Color();
function updateLighting(t, dt, focus) {
  STATE.tod = damp(STATE.tod, STATE.todTarget, 0.5, dt);
  STATE.day = damp(STATE.day, STATE.dayTarget, STATE.dayRate || 0.5, dt);
  STATE.snow = damp(STATE.snow, STATE.snowTarget, 0.4, dt);
  const n = STATE.tod, d = STATE.day, inside = G.inside(focus.x, focus.z);
  STATE.inK = damp(STATE.inK || 0, inside ? 1 : 0, 3, dt);   // eases the indoor/outdoor exposure change at the door
  const ik = STATE.inK * d;
  G.SKY_UNI.uTod.value = n; G.SKY_UNI.uDay.value = d; G.SKY_UNI.uTime.value = t;
  G.sky.position.copy(G.camera.position);
  const dir = G.SUN_SET.clone().lerp(MOON_DIR, n).normalize().lerp(G.SUN_DAY, d).normalize();
  G.SKY_UNI.uSun.value.copy(G.SUN_SET).lerp(G.SUN_DAY, d).normalize();
  key.position.copy(focus).addScaledVector(dir, 40);
  key.target.position.copy(focus);
  key.color.copy(PAL.keyCol[0]).lerp(PAL.keyCol[1], n).lerp(DAY.keyCol, d);
  key.intensity = lerp(lerp(PAL.keyI[0], PAL.keyI[1], n), DAY.keyI, d);
  // By day, indoors the fill is the warm light bouncing off pine boards rather than the blue sky.
  hemi.color.copy(PAL.sky[0]).lerp(PAL.sky[1], n).lerp(DAY.sky, d).lerp(DAY.skyIn, ik * 0.8);
  hemi.groundColor.copy(PAL.gnd[0]).lerp(PAL.gnd[1], n).lerp(DAY.gnd, d).lerp(DAY.gndIn, ik * 0.8);
  // Indoors the sky fill drops (the room is lit by its lamps and fire), less so by day: light bounces in off the snow.
  // At night with the lamps off, moonlight off the snow still comes in through the windows: enough to see the room by.
  const lampsOn = G.LAMPS.some((L) => L.on) || (G.FIRE.on && G.FIRE.level > 0.2);
  hemi.intensity = lerp(lerp(PAL.hemiI[0], PAL.hemiI[1], n), DAY.hemiI, d) * (inside ? lerp(lampsOn ? 0.55 : lerp(0.55, 1.15, n), DAY.hemiIn, d) : 1);
  G.scene.fog.color.copy(PAL.fog[0]).lerp(PAL.fog[1], n).lerp(DAY.fog, d);
  G.scene.fog.near = lerp(lerp(30, 20, n), 40, d); G.scene.fog.far = lerp(lerp(230, 170, n), 270, d);
  STATE.fogKs = damp(STATE.fogKs || 1, STATE.fogK || 1, 0.3, dt);   // heavy snow closes the distance in
  G.scene.fog.near *= STATE.fogKs; G.scene.fog.far *= STATE.fogKs;
  if (STATE.fog) { G.scene.fog.near = STATE.fog.near; G.scene.fog.far = STATE.fog.far; }   // a scene's own fog (the prologue's)
  G.renderer.toneMappingExposure = lerp(lerp(PAL.exposure[0], PAL.exposure[1], n), DAY.exposure, d) * (1 + ik * 0.3) * (STATE.exposureMul || 1);
  const camIn0 = G.inside(G.camera.position.x, G.camera.position.z);
  const env = d > 0.5 ? (camIn0 ? G.envRoom : G.envDay) : n > 0.5 ? G.envNight : G.envSunset; if (G.scene.environment !== env) G.scene.environment = env;
  MAT.glassOut.emissiveIntensity = lerp(0.5, 1.0, n) * (1 - d);
  MAT.glassOut.color.copy(GLASS_WARM).lerp(DAY.glass, d);
  const dark = 1 - d;   // outdoor lanterns and the porch lamp are off by day
  // Interior lights
  const fl = 0.82 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07 + Math.sin(t * 23.1) * 0.03;
  for (const L of G.LAMPS) { L.light.intensity = damp(L.light.intensity, L.on ? L.power * L.flick : 0, 14, dt); L.shade.material.emissiveIntensity = (L.light.intensity / L.power) * 1.2; }
  const F = G.FIRE, fp = F.on ? F.level : 0;
  const camIn = G.inside(G.camera.position.x, G.camera.position.z);
  const fireShadow = G.Q.ssao && camIn && fp > 0.02;
  if (F.light.castShadow !== fireShadow) F.light.castShadow = fireShadow;
  F.light.intensity = damp(F.light.intensity, F.power * fp * fl, 12, dt);
  // The light moves a little as the flames do, so shadows in the room breathe and dance.
  if (F.lightAt) F.light.position.set(F.lightAt.x + Math.sin(t * 5.3) * 0.04 + Math.sin(t * 11.7) * 0.02, F.lightAt.y + Math.sin(t * 7.1) * 0.03, F.lightAt.z + Math.sin(t * 4.1) * 0.02);
  if (F.coals) { F.coals.uniforms.uTime.value = t; F.coals.uniforms.uPower.value = Math.max(0.15 * (F.level || 0), fp) * (0.85 + (fl - 0.82) * 1.5); }
  if (F.logM) F.logM.emissiveIntensity = 0.12 * fp * fl;
  F.planes.forEach((p, i) => { p.visible = fp > 0.02; p.material.uniforms.uPower.value = fp; p.lookAt(G.camera.position.x, p.getWorldPosition(tmpV).y, G.camera.position.z); });
  G.CAKE.light.intensity = damp(G.CAKE.light.intensity, G.CAKE.lit ? 1.4 * fl : 0, 10, dt);
  G.CAKE.flames.forEach((f) => { f.visible = G.CAKE.lit; });
  G.MANTLE_LIGHT.intensity = 1.3 * fl;
  G.FLAMES.forEach((f, i) => { f.material.uniforms.uTime.value = t * 1.3 + i * 2.1; if (!F.planes.includes(f)) f.lookAt(G.camera.position); });
  G.PORCH_LAMP.intensity = lerp(4, 7, n) * (0.95 + Math.sin(t * 9) * 0.03) * dark;
  G.BENCH_LAMP.intensity = lerp(1.5, 3, n) * fl * dark;
  // Path lanterns: two real lights on the nearest, glow pools on the rest.
  const near = G.PATH_LIGHTS.slice().sort((a, b) => Math.hypot(a.x - focus.x, a.z - focus.z) - Math.hypot(b.x - focus.x, b.z - focus.z));
  // A scene can borrow the two lantern lights (the prologue's fair) instead of the path's nearest pair.
  const spots = STATE.lightSpots || near;
  pathLights.forEach((l, i) => { const p = spots[i]; if (!p) { l.intensity = 0; return; } l.position.set(p.x, p.y, p.z); l.intensity = STATE.lightSpots ? (p.i || 4) : lerp(2.5, 4, n) * dark; if (p.color) l.color.set(p.color); else l.color.set('#ffa860'); });
  G.poolMat.opacity = lerp(0.5, 0.9, n) * dark;
  if (G.updateLanterns) G.updateLanterns(t, dt);
  Audio_ambience(focus, dt, fp);
}
const tmpV = new THREE.Vector3();
const AMB_T = { creak: 20, owl: 15 };
function Audio_ambience(focus, dt, fp) {
  const inside = G.inside(focus.x, focus.z);
  const dFire = Math.hypot(focus.x - 8, focus.z - 1);
  const gust = WIND.gust;
  // The fire is a placed source now: distance and walls do the work.
  // The night and Act IV (until you're together again): the warm chords thin out and a low drone sits under everything.
  // When it goes quiet all at once (STATE.hush), something is coming.
  const eerie = !!G.S && (G.S.chapter === 'night' || (G.S.chapter === 'lastbirthday' && !G.S.flags.reunited));
  // The quiet piano: warm indoors, sparse outside, almost nothing at night; off for the radio, the title screen,
  // the power cut and the Music setting; a little quieter while someone's talking.
  const still = G.simT < (STATE.quietUntil || 0);
  G.Audio.tickLoud(still ? 2.2 : 1);
  G.Audio.score({ on: !still && SETTINGS.music !== 'off' && STATE.started && !G.Audio.radioOn() && !(G._PC && G._PC.out) && !document.body.classList.contains('ending'),
    mood: eerie ? 'night' : inside ? 'warm' : 'sparse', duck: !!DLG.cur });
  G.Audio.set({ doorOpen: !!STATE.doorOpen, fire: fp, wind: (inside ? 0.35 : 0.45 + STATE.tod * 0.15) + gust * 0.55, pad: (STATE.started ? 1 : 0.6) * (eerie ? 0.3 : 1) * (still ? 0 : 1), drone: eerie && !STATE.hush ? 1 : 0, droneFast: !!STATE.hush, inside });
  G.Audio.crackle(dt, fp * (dFire < 12 ? 1 : 0));
  const cp = G.camera.position, fw = tmpV.set(0, 0, -1).applyQuaternion(G.camera.quaternion);
  const room = inside ? (focus.x < 5 ? 'bed' : focus.x < 11 ? 'liv' : 'kit') : 'out';
  G.Audio.spatial(cp.x, cp.y, cp.z, fw.x, fw.z, room);
  // Small life: the house settling at night, an owl in the pines after dark.
  AMB_T.creak -= dt; AMB_T.owl -= dt;
  if (inside && AMB_T.creak < 0) { AMB_T.creak = 25 + Math.random() * 40; G.Audio.creak(); }
  if (!inside && STATE.tod > 0.6 && AMB_T.owl < 0) { AMB_T.owl = 30 + Math.random() * 45; G.Audio.owl(); }
}

/* ---------- snow ---------- */
let SNOW;
const SNOW_DAY = new THREE.Color('#ffe2d0'), SNOW_NIGHT = new THREE.Color('#c8d4ff'), SNOW_NOON = new THREE.Color('#f6f8fc');
const SMOKE_DAY = new THREE.Color('#c4a8b0'), SMOKE_NIGHT = new THREE.Color('#3a4058'), SMOKE_NOON = new THREE.Color('#d4d8e0');
function snowSystem(n) {
  const pos = new Float32Array(n * 3), spd = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = rand(-18, 18); pos[i * 3 + 1] = rand(0, 12); pos[i * 3 + 2] = rand(-18, 18); spd[i] = rand(0.3, 0.8); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('spd', new THREE.BufferAttribute(spd, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uDrift: { value: 0 }, uGust: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uPx: { value: 1 }, uLight: { value: new THREE.Color('#ffd6c0') } },
    vertexShader: `
      attribute float spd; uniform float uTime; uniform float uDrift; uniform float uGust; uniform vec3 uCenter; uniform float uPx; varying float vA;
      void main(){
        vec3 p = position;
        p.y = mod(p.y - uTime * spd, 12.0);
        float sw = 0.25 + uGust * 0.35;
        p.x += sin(uTime * 0.6 + position.z) * sw + uDrift * (0.8 + spd * 0.5);
        p.z += cos(uTime * 0.45 + position.x) * sw * 0.8 - uDrift * 0.25;
        p.x = mod(p.x - uCenter.x + 18.0, 36.0) - 18.0 + uCenter.x;
        p.z = mod(p.z - uCenter.z + 18.0, 36.0) - 18.0 + uCenter.z;
        p.y += uCenter.y - 3.0;
        bool roof = (p.x > -0.6 && p.x < 15.6 && p.z > -3.0 && p.z < 5.1) || (p.x > 3.3 && p.x < 11.5 && p.z > 4.5 && p.z < 7.0 && p.y < 2.6) || (p.x > 15.0 && p.x < 17.3 && p.z > 2.5 && p.z < 5.1 && p.y < 2.7);
        vA = roof ? 0.0 : 1.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = vA * 14.0 * uPx / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'uniform vec3 uLight; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(uLight, smoothstep(0.5, 0.05, d) * 0.85 * vA); }',
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; G.scene.add(pts);
  return pts;
}
/* ---------- chimney smoke ---------- */
const SMOKE = [];
function smokeSystem() {
  const tex = G.canvasTex(0, null, { w: 64, h: 64, draw: (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); } });
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#b8b0b8', transparent: true, depthWrite: false, opacity: 0 }));
    G.scene.add(s); SMOKE.push({ s, age: i * 0.35, life: 9 });
  }
}
function updateSmoke(dt) {
  for (const p of SMOKE) {
    p.age += dt; if (p.age > p.life) p.age -= p.life;
    const k = p.age / p.life;
    const blow = 2.5 + WIND.gust * 3;   // smoke leans further over in a gust
    p.s.position.set(G.CHIMNEY.x + k * blow + Math.sin(p.age * 0.7 + p.age) * 0.5, G.CHIMNEY.y + k * (5.5 - WIND.gust * 1.5), G.CHIMNEY.z - k * 1.2);
    p.s.scale.setScalar(0.5 + k * 2.6);
    p.s.material.opacity = Math.sin(k * Math.PI) * 0.07 * (G.FIRE.on ? 1 : 0.15);
    p.s.material.color.copy(SMOKE_DAY).lerp(SMOKE_NIGHT, STATE.tod).lerp(SMOKE_NOON, STATE.day);
  }
}

/* =====================================================================
 * Post-processing
 * ===================================================================== */
let composer, bokeh, bloom, ssao, grade, fxaa;
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.42 }, uGrain: { value: 0.022 }, uCA: { value: 0.0012 }, uBars: { value: 0 }, uMem: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain, uCA, uBars, uMem; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime*7.0) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      vec3 c = vec3(texture2D(tDiffuse, vUv + d*uCA).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d*uCA).b);
      float l = dot(c, vec3(0.2126,0.7152,0.0722));
      // Split-tone: cool shadows, warm highlights.
      c *= mix(vec3(0.9, 0.97, 1.08), vec3(1.07, 1.0, 0.9), smoothstep(0.05, 0.7, l));
      c = mix(vec3(l), c, 1.08);
      // Memory: faded, cooler, softer at the edges.
      c = mix(c, vec3(l) * vec3(0.94, 0.98, 1.07) + 0.015, uMem * 0.6);
      c *= 1.0 - (uVig + uMem * 0.25) * smoothstep(0.3 - uMem * 0.12, 0.9, length(d * vec2(1.3, 1.0)));
      c += (h(vUv * 917.0) - 0.5) * uGrain;
      float bar = step(0.5 - uBars, abs(vUv.y - 0.5));
      c = mix(c, vec3(0.0), bar);
      gl_FragColor = LinearTosRGB(vec4(c, 1.0));   // gamma folded in here: one full-screen pass fewer
    }`,
};
function buildPost() {
  composer = new THREE.EffectComposer(G.renderer);
  composer.addPass(new THREE.RenderPass(G.scene, G.camera));
  ssao = new THREE.SSAOPass(G.scene, G.camera, 2, 2);
  ssao.kernelRadius = 0.3; ssao.minDistance = 0.0006; ssao.maxDistance = 0.03;
  composer.addPass(ssao);
  bokeh = new THREE.BokehPass(G.scene, G.camera, { focus: 3, aperture: 0.004, maxblur: 0.008, width: 2, height: 2 });
  composer.addPass(bokeh);
  bloom = new THREE.UnrealBloomPass(new THREE.Vector2(512, 512), 0.5, 0.55, 0.85);
  composer.addPass(bloom);
  grade = new THREE.ShaderPass(GradeShader); composer.addPass(grade);
  fxaa = new THREE.ShaderPass(THREE.FXAAShader); composer.addPass(fxaa);
  G.post = { composer, bokeh, bloom, ssao, grade, fxaa, key, hemi };
}
G.applyQuality = () => {
  G.Q = G.PRESETS[G.qName];
  try { localStorage.setItem('cbs.base.quality', G.qName); } catch (e) { /* ignore */ }
  G.renderer.shadowMap.enabled = G.Q.shadows;
  key.castShadow = G.Q.shadows; key.shadow.mapSize.set(G.Q.shadowSize, G.Q.shadowSize);
  if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
  G.FIRE.light.shadow.mapSize.set(512, 512); G.FIRE.light.shadow.bias = -0.004;
  if (G.Q.ssao) {
    // The fireplace's cube shadow redraws everything around it six times, so it runs only while the
    // camera is in the cabin. Compile both lighting states now so switching never stutters.
    for (const on of [true, false]) { G.FIRE.light.castShadow = on; G.renderer.compile(G.scene, G.camera); }
  }
  G.FIRE.light.castShadow = false;
  G.FIRE.light.shadow.camera.near = 0.1; G.FIRE.light.shadow.camera.far = 7;   // the room, not the whole valley
  ssao.enabled = G.Q.ssao; bokeh.enabled = G.Q.dof; bloom.strength = G.Q.bloom;
  G.MATS.forEach((m) => { m.needsUpdate = true; });
  if (SNOW) SNOW.geometry.setDrawRange(0, Math.round(G.Q.snow * clamp(STATE.snow, 0, 1)));
  resize();
  document.querySelectorAll('#quality button').forEach((b) => b.classList.toggle('on', b.dataset.q === G.qName));
};
function resize() {
  const W = innerWidth, H = innerHeight, dpr = Math.min(window.devicePixelRatio || 1, G.Q.dpr);
  G.renderer.setPixelRatio(dpr); G.renderer.setSize(W, H, false);
  composer.setPixelRatio(dpr); composer.setSize(W, H);
  G.camera.aspect = W / H; G.camera.updateProjectionMatrix();
  fxaa.material.uniforms.resolution.value.set(1 / (W * dpr), 1 / (H * dpr));
  if (SNOW) SNOW.material.uniforms.uPx.value = H * dpr / 900;
  bokeh.uniforms.aspect.value = W / H;
}
addEventListener('resize', () => { if (composer) { resize(); G.needsRender = true; } });

/* =====================================================================
 * Characters & collision
 * ===================================================================== */
const PLAYER = (G.PLAYER = { m: null, x: 0, y: 0, z: 0, yaw: Math.PI, speed: 0, phase: 0, r: 0.24, look: 0 });
const PARTNER = (G.PARTNER = { m: null, x: 0, y: 0, z: 0, yaw: Math.PI, speed: 0, phase: 0, r: 0.2, look: 0, mode: 'follow', script: null });
const head = (c) => ({ x: c.x, z: c.z, headY: c.y + c.m.userData.H * 0.93 - (c.sit > 0.5 ? 0.45 : 0) });
G.headPos = (c) => (c.lie ? new THREE.Vector3(c.x, c.lieY + 0.28, c.z - c.m.userData.H * 0.86) : new THREE.Vector3(c.x, c.y + c.m.userData.H * 0.935 - (c.sit || 0) * (c.m.userData.hipY - ((c.seatY || 0.6) - c.y)), c.z));
function collide(c, ox, oz) {
  for (const b of G.COLL) {
    if (b.solidExterior) continue;
    const cx = clamp(c.x, b.x0, b.x1), cz = clamp(c.z, b.z0, b.z1);
    const dx = c.x - cx, dz = c.z - cz, d = Math.hypot(dx, dz);
    if (d < c.r) {
      if (d > 1e-5) { c.x = cx + dx / d * c.r; c.z = cz + dz / d * c.r; }
      else { const l = c.x - b.x0, r = b.x1 - c.x, t = c.z - b.z0, bb = b.z1 - c.z, m = Math.min(l, r, t, bb); if (m === l) c.x = b.x0 - c.r; else if (m === r) c.x = b.x1 + c.r; else if (m === t) c.z = b.z0 - c.r; else c.z = b.z1 + c.r; }
    }
  }
  if (!G.walkable(c.x, c.z) || (STATE.bounds && (c.z < STATE.bounds.zMin || (STATE.bounds.zMax != null && c.z > STATE.bounds.zMax)))) { c.x = ox; c.z = oz; }
  // Can't climb onto the porch except by the steps.
  const fy = G.floorAt(c.x, c.z);
  if (fy - c.yFloor > 0.22 && !(c.x > G.PORCH.stepX0 && c.x < G.PORCH.stepX1)) { c.x = ox; c.z = oz; }
  c.yFloor = G.floorAt(c.x, c.z);
}
function moveChar(c, dx, dz) { const ox = c.x, oz = c.z; c.x += dx; c.z += dz; collide(c, ox, oz); }
/* ---------- navigation: grid A* over the real colliders ----------
 * Cells are 0.15 m. A cell is open when it is inside the walkable clearing and
 * far enough from every collider for a character to stand there. Moving
 * between neighbouring cells is refused when the floor height jumps (porch
 * edge), so routes onto the porch always use the steps.
 */
const NAV = { cs: 0.15, x0: -17, z0: -11, nx: 0, nz: 0, open: null, h: null };
const AGENT_R = 0.21;
// Out to the frozen lake and the far shore (the walk); closed per collider, not per cell, so it builds fast.
function buildNav() {
  const N = NAV; N.nx = Math.ceil((32 - N.x0) / N.cs); N.nz = Math.ceil((68 - N.z0) / N.cs);
  const n = N.nx * N.nz; N.open = new Uint8Array(n); N.h = new Float32Array(n);
  for (let j = 0; j < N.nz; j++) for (let i = 0; i < N.nx; i++) {
    const x = N.x0 + (i + 0.5) * N.cs, z = N.z0 + (j + 0.5) * N.cs, k = j * N.nx + i;
    N.h[k] = G.floorAt(x, z);
    N.open[k] = G.walkable(x, z) ? 1 : 0;
  }
  for (const b of G.COLL) if (!b.solidExterior) navClose(b);
}
function navClose(b) {
  const N = NAV, R = AGENT_R;
  const i0 = Math.max(0, Math.floor((b.x0 - R - N.x0) / N.cs)), i1 = Math.min(N.nx - 1, Math.floor((b.x1 + R - N.x0) / N.cs));
  const j0 = Math.max(0, Math.floor((b.z0 - R - N.z0) / N.cs)), j1 = Math.min(N.nz - 1, Math.floor((b.z1 + R - N.z0) / N.cs));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = N.x0 + (i + 0.5) * N.cs, z = N.z0 + (j + 0.5) * N.cs;
    const dx = Math.max(b.x0 - x, 0, x - b.x1), dz = Math.max(b.z0 - z, 0, z - b.z1);
    if (Math.hypot(dx, dz) < R) N.open[j * N.nx + i] = 0;
  }
}
G.buildNav = buildNav;
G.navOpen = (x, z) => { if (!NAV.open) buildNav(); const [i, j] = cellOf(x, z); return isOpen(i, j); };
// Add a solid thing to the world after boot (a snowman): a collider, closed off on the nav grid too.
G.addCollider = (b) => { G.COLL.push(b); if (NAV.open) navClose(b); };
G.removeCollider = (b) => { const i = G.COLL.indexOf(b); if (i >= 0) { G.COLL.splice(i, 1); NAV.open = null; } };   // the nav grid is rebuilt on next use
const cellOf = (x, z) => [Math.floor((x - NAV.x0) / NAV.cs), Math.floor((z - NAV.z0) / NAV.cs)];
const cellPos = (i, j) => ({ x: NAV.x0 + (i + 0.5) * NAV.cs, z: NAV.z0 + (j + 0.5) * NAV.cs });
const inGrid = (i, j) => i >= 0 && j >= 0 && i < NAV.nx && j < NAV.nz;
const isOpen = (i, j) => inGrid(i, j) && NAV.open[j * NAV.nx + i] === 1;
function canStep(i0, j0, i1, j1) { return isOpen(i1, j1) && Math.abs(NAV.h[j1 * NAV.nx + i1] - NAV.h[j0 * NAV.nx + i0]) < 0.13; }
function nearestOpen(i, j, maxR = 14) {
  if (isOpen(i, j)) return [i, j];
  for (let r = 1; r <= maxR; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    if (isOpen(i + di, j + dj)) return [i + di, j + dj];
  }
  return null;
}
function lineClear(a, b) {
  // Walk the segment in half-cell steps; every sample must be open and level with the last.
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / (NAV.cs * 0.5)));
  let [pi, pj] = cellOf(a.x, a.z);
  for (let s = 1; s <= n; s++) {
    const [i, j] = cellOf(a.x + (b.x - a.x) * s / n, a.z + (b.z - a.z) * s / n);
    if (i === pi && j === pj) continue;
    if (!canStep(pi, pj, i, j)) return false;
    pi = i; pj = j;
  }
  return true;
}
let heapK, heapF, gScore, came, closed, gridN = 0;
function findPath(sx, sz, tx, tz) {
  if (!NAV.open) buildNav();
  const n = NAV.nx * NAV.nz;
  if (!gScore || gridN !== n) { gridN = n; gScore = new Float32Array(n); came = new Int32Array(n); closed = new Uint8Array(n); heapK = new Int32Array(n); heapF = new Float32Array(n); }
  const s = nearestOpen(...cellOf(sx, sz), 6), t = nearestOpen(...cellOf(tx, tz));
  if (!s || !t) return null;
  const goal = t[1] * NAV.nx + t[0], start = s[1] * NAV.nx + s[0];
  gScore.fill(Infinity); closed.fill(0); came.fill(-1);
  let hn = 0;
  const push = (k, f) => { let i = hn++; while (i > 0) { const p = (i - 1) >> 1; if (heapF[p] <= f) break; heapK[i] = heapK[p]; heapF[i] = heapF[p]; i = p; } heapK[i] = k; heapF[i] = f; };
  const pop = () => { const top = heapK[0]; const k = heapK[--hn], f = heapF[hn]; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= hn) break; if (c + 1 < hn && heapF[c + 1] < heapF[c]) c++; if (heapF[c] >= f) break; heapK[i] = heapK[c]; heapF[i] = heapF[c]; i = c; } heapK[i] = k; heapF[i] = f; return top; };
  const hEst = (i, j) => { const dx = Math.abs(i - t[0]), dz = Math.abs(j - t[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  gScore[start] = 0; push(start, hEst(s[0], s[1]));
  let found = false, iter = 0;
  while (hn && iter++ < 120000) {
    const k = pop();
    if (closed[k]) continue;
    if (k === goal) { found = true; break; }
    closed[k] = 1;
    const i = k % NAV.nx, j = (k / NAV.nx) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj;
      if (!canStep(i, j, ni, nj)) continue;
      if (di && dj && (!canStep(i, j, ni, j) || !canStep(i, j, i, nj))) continue;   // no corner cutting
      const nk = nj * NAV.nx + ni, g = gScore[k] + (di && dj ? 1.414 : 1);
      if (g < gScore[nk]) { gScore[nk] = g; came[nk] = k; push(nk, g + hEst(ni, nj)); }
    }
  }
  if (!found) return null;
  const cells = [];
  for (let k = goal; k !== -1 && k !== start; k = came[k]) cells.push(cellPos(k % NAV.nx, (k / NAV.nx) | 0));
  cells.reverse();
  // String-pull: keep only the points where the straight line would be blocked.
  const pts = [], startP = { x: sx, z: sz };
  let anchor = startP;
  for (let i = 0; i < cells.length; i++) {
    const next = cells[i + 1];
    if (next && lineClear(anchor, next)) continue;
    pts.push(cells[i]); anchor = cells[i];
  }
  const last = isOpen(...cellOf(tx, tz)) ? { x: tx, z: tz } : cells[cells.length - 1] || { x: tx, z: tz };
  if (!pts.length || Math.hypot(pts[pts.length - 1].x - last.x, pts[pts.length - 1].z - last.z) > 0.01) pts.push(last);
  return pts;
}
G.findPath = findPath; G.NAV = NAV;
/* Steer along a cached path to (tx, tz). Re-plans when the target moves, every
 * so often, and when the character stops making progress. Returns true on arrival. */
function steer(c, tx, tz, speed, dt, stopAt = 0.06) {
  const nav = c.nav || (c.nav = { path: null, tx: 1e9, tz: 1e9, age: 9, stuckT: 0, lastD: 1e9, fail: 0 });
  nav.age += dt;
  const dGoal = Math.hypot(tx - c.x, tz - c.z);
  if (dGoal < stopAt) { c.speed = damp(c.speed, 0, 10, dt); nav.path = null; return true; }
  if (!nav.path || Math.hypot(tx - nav.tx, tz - nav.tz) > 0.4 || nav.age > 1.5) {
    nav.path = findPath(c.x, c.z, tx, tz); nav.tx = tx; nav.tz = tz; nav.age = 0;
    if (!nav.path) nav.fail += 1; else nav.fail = 0;
  }
  let w = { x: tx, z: tz };
  if (nav.path) {
    while (nav.path.length > 1 && Math.hypot(nav.path[0].x - c.x, nav.path[0].z - c.z) < 0.18) nav.path.shift();
    w = nav.path[0];
  }
  const dx = w.x - c.x, dz = w.z - c.z, l = Math.hypot(dx, dz) || 1;
  const slow = nav.path && nav.path.length === 1 ? clamp(l / 0.5, 0.35, 1) : 1;
  c.speed = damp(c.speed, speed * slow, 5, dt);
  // Arriving: slow down over the last step or two, as if braking evenly, then gently into the stop, so the walk
  // ends at a near standstill rather than from walking pace in a single frame.
  c.speed = Math.min(c.speed, Math.sqrt(2 * 2.2 * Math.max(0, dGoal - stopAt)) + 0.05, (dGoal - stopAt) * 4 + 0.12);
  c.yaw = angDamp(c.yaw, Math.atan2(dx, dz), 9, dt);
  // Move along the waypoint direction (not the smoothed facing) so corners are taken cleanly.
  moveChar(c, dx / l * c.speed * dt, dz / l * c.speed * dt);
  // Stuck: little progress toward the goal for a while -> re-plan now; if it persists, nudge to the next open cell.
  if (nav.lastD - dGoal < 0.15 * dt && c.speed > 0.2) nav.stuckT += dt; else nav.stuckT = Math.max(0, nav.stuckT - dt * 2);
  nav.lastD = dGoal;
  if (nav.stuckT > 0.8) { nav.path = null; nav.stuckT = 0; nav.unstuck = (nav.unstuck || 0) + 1;
    if (nav.unstuck > 2) { const o = nearestOpen(...cellOf(c.x, c.z), 4); if (o) { const p = cellPos(o[0], o[1]); c.x = p.x; c.z = p.z; c.yFloor = G.floorAt(c.x, c.z); } nav.unstuck = 0; } }
  return false;
}
function placeChar(c, x, z, yaw) { c.turnTo = null; c.settle = false; c.x = x; c.z = z; c.yaw = yaw; c.yFloor = G.floorAt(x, z); c.y = c.yFloor; c.speed = 0; c.nav = null; c._prevYaw = yaw; }
G.placeChar = placeChar;
G.gaze = (c, pos, dur = 2.2) => { c.gaze = { x: pos[0], z: pos[2], headY: pos[1], t: dur }; };
G.slideTo = (c, x, z, yaw, dur = 0.55) => new Promise((res) => { c.script = null; c.nav = null; c.slide = { from: { x: c.x, z: c.z }, x, z, yaw, dur, t: 0, res }; });
// Sit down from where you stand: slide into the seat while the legs fold.
G.sitDown = (c, x, z, yaw, seatY, dur = 0.6) => { c.seatY = seatY; c.sitTarget = 1; return G.slideTo(c, x, z, yaw, dur); };
G.sitAt = (c, x, z, yaw, seatY) => { c.script = null; c.lie = false; placeChar(c, x, z, yaw); c.seatY = seatY; c.sitTarget = 1; c.sit = 1; };
G.standAt = (c, x, z, yaw) => { c.script = null; c.turnTo = null; c.lie = false; c.sitTarget = 0; c.sit = 0; c.freeSit = null; c.rise = null; placeChar(c, x, z, yaw); };
// In bed: feet at (x, zFeet), head toward the headboard; roll turns onto one side, look turns the head.
// The two of them in bed together, close: him on his back turned a little towards her, her on her side against him with
// her head at his shoulder, her arm across his chest and her knees drawn up; his arm round her. (The imitation's nights
// keep to "exactly her side": those use lieDown on each side as before.)
G.cuddleInBed = (him, her, o = {}) => {
  const B = G.BED, hx = B.x + (o.himX != null ? o.himX : -0.1), sx = B.x + (o.herX != null ? o.herX : 0.17);
  // which side she's on decides which way each turns
  const side = Math.sign(sx - hx) || 1;
  G.lieDown(him, hx, -0.14, 0.2 * side, 0.32 * side);   // head turned to her
  G.lieDown(her, sx, -0.4, -1.0 * side, -0.35 * side);  // her face toward him, tucked against his shoulder
  her.lieTilt = 0.05;
  him.cuddle = { with: her, role: 'hold' }; her.cuddle = { with: him, role: 'drape' };
  if (G.bedMade) G.bedMade(false);
  if (G.shapeBed) G.shapeBed({ L: true, R: true });   // the blanket up over the two of them, to the shoulders
};
G.lieDown = (c, x, zFeet, roll = 0, look = 0) => { c.cuddle = null; c.script = null; c.sitTarget = 0; c.sit = 0; c.speed = 0; c.lie = true; c.x = x; c.z = zFeet; c.lieY = G.BED.top + 0.13; c.y = c.lieY; c.lieRoll = roll; c.lieLook = look; c.yaw = 0; };

/* =====================================================================
 * Camera director
 * ===================================================================== */
const CAM = (G.CAM = { yaw: 0, pitch: 0.2, zoom: 1, pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 42, focus: 3, aperture: 0.003, shot: null, cut: true, lastDrag: -99, idle: 0, bars: 0 });
const ray = new THREE.Raycaster();
function blocked(from, to) {
  const d = to.clone().sub(from), len = d.length();
  ray.set(from, d.normalize()); ray.far = len;
  return ray.intersectObjects(G.CAMBLOCK, false).length > 0;
}
G.camBlocked = blocked;
function clampToWalls(target, desired) {
  const d = desired.clone().sub(target), len = d.length();
  ray.set(target, d.clone().normalize()); ray.far = len + 0.25;
  const hit = ray.intersectObjects(G.CAMBLOCK, false)[0];
  if (hit) return target.clone().addScaledVector(d.normalize(), Math.max(0.3, hit.distance - 0.2));
  return desired;
}
/* Shots return { pos, look, fov, focus, aperture }. */
const SHOTS = {
  // First person: the camera is your eyes. Drag (or the stick) looks; you face where you look.
  first(t) {
    const p = PLAYER, h = G.headPos(p);
    const bob = Math.sin(p.phase * 2) * 0.018 * clamp(p.speed / 1.5, 0, 1.6) * G.MOTION, sway = Math.cos(p.phase) * 0.012 * clamp(p.speed / 1.5, 0, 1.6) * G.MOTION;
    const fx = -Math.sin(CAM.yaw), fz = -Math.cos(CAM.yaw), pitch = CAM.fpPitch || 0;
    const pos = new THREE.Vector3(h.x + fx * 0.09 + fz * sway, h.y + 0.02 + bob, h.z + fz * 0.09 - fx * sway);
    const look = pos.clone().add(new THREE.Vector3(fx * Math.cos(pitch), -Math.sin(pitch), fz * Math.cos(pitch)));
    return { pos, look, fov: 62 + CAM.run * 4 * G.MOTION, focus: 2.5, aperture: 0.001 };
  },
  follow(t) {
    if (SETTINGS.view === 'first') return SHOTS.first(t);
    const p = PLAYER, inside = G.inside(p.x, p.z) || G.underRoof(p.x, p.z);
    const ks = clamp(p.m.userData.H / 1.84, 0.62, 1);   // smaller people (the prologue) get a lower, closer camera
    // Running pulls the camera back a little and widens the lens; walking adds a faint step rhythm.
    const dist = (inside ? 1.75 : 2.9) * CAM.zoom * (1 + CAM.run * G.MOTION * (inside ? 0.06 : 0.16)) * lerp(0.75, 1, ks), height = (inside ? 1.58 : 1.72) * ks;
    const bob = Math.sin(p.phase * 2) * 0.01 * clamp(p.speed / 1.5, 0, 1.5) * G.MOTION;
    const tgt = new THREE.Vector3(p.x, p.y + height - (p.sit || 0) * 0.45 + bob, p.z);
    const right = new THREE.Vector3(Math.cos(CAM.yaw), 0, -Math.sin(CAM.yaw));
    tgt.addScaledVector(right, inside ? 0.32 : 0.42);
    const pitch = CAM.pitch + (inside ? 0.06 : 0);
    const dir = new THREE.Vector3(Math.sin(CAM.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(CAM.yaw) * Math.cos(pitch));
    let pos = clampToWalls(tgt, tgt.clone().addScaledVector(dir, dist));
    pos.y = Math.max(pos.y, G.floorAt(pos.x, pos.z) + 0.35);
    if (G.inside(pos.x, pos.z)) pos.y = Math.min(pos.y, G.CAB.wallH - 0.15);
    const lookAhead = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw)).multiplyScalar(p.speed * 0.25);
    return { pos, look: tgt.clone().add(lookAhead), fov: (inside ? 50 : 46) + CAM.run * 5 * G.MOTION, focus: pos.distanceTo(tgt) + 0.2, aperture: 0.0025 };
  },
  ots(subject, fg, side0 = 1) {
    // Over the foreground character's shoulder, framing the subject's face.
    const hs = G.headPos(subject), hf = G.headPos(fg);
    const d = new THREE.Vector3(hs.x - hf.x, 0, hs.z - hf.z); const dist = Math.max(0.5, d.length()); d.normalize();
    const side = new THREE.Vector3(d.z, 0, -d.x);
    // A little wider and further back than a tight OTS, so the near shoulder frames rather than blocks.
    for (const sgn of [side0, -side0]) for (const back of [0.9, 0.6, 0.36]) {
      const pos = hf.clone().addScaledVector(d, -back).addScaledVector(side, sgn * 0.4); pos.y = hf.y + 0.04;
      if (!blocked(hs, pos)) return { pos, look: hs.clone().add(new THREE.Vector3(0, -0.02, 0)), fov: 30, focus: pos.distanceTo(hs), aperture: 0.016 };
    }
    return SHOTS.twoShot();
  },
  twoShot(low = true) {
    const a = G.headPos(PLAYER), b = G.headPos(PARTNER), m = a.clone().add(b).multiplyScalar(0.5);
    const across = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
    let f = new THREE.Vector3(-across.z, 0, across.x);
    const fwd = new THREE.Vector3(Math.sin(PLAYER.yaw) + Math.sin(PARTNER.yaw), 0, Math.cos(PLAYER.yaw) + Math.cos(PARTNER.yaw));
    if (fwd.lengthSq() > 0.01 && f.dot(fwd) < 0) f.negate();
    for (const sgn of [1, -1]) {
      const ff = f.clone().multiplyScalar(sgn);
      const pos = m.clone().addScaledVector(ff, 1.5); pos.y = m.y - (low ? 0.35 : 0.05);
      if (!blocked(m, pos)) return { pos, look: m.clone().add(new THREE.Vector3(0, -0.12, 0)), fov: 36, focus: pos.distanceTo(m), aperture: 0.012 };
    }
    return SHOTS.follow();
  },
  rearPair(dist = 2.4, up = 0.25, lookFar = 8, fov = 48) {
    const a = PLAYER, b = PARTNER, m = new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2 + 1.4, (a.z + b.z) / 2);
    const f = new THREE.Vector3(Math.sin(a.yaw) + Math.sin(b.yaw), 0, Math.cos(a.yaw) + Math.cos(b.yaw)).normalize();
    const pos = m.clone().addScaledVector(f, -dist); pos.y += up;
    const look = m.clone().addScaledVector(f, lookFar); look.y += 0.6;
    return { pos, look, fov, focus: dist + 0.3, aperture: 0.004 };
  },
};
G.SHOTS = SHOTS;
let handT = 0;
function updateCamera(dt, t) {
  const c = CAM;
  c.run = damp(c.run || 0, clamp((PLAYER.speed - 1.6) / 1.4, 0, 1), 2.5, dt);
  if (G.keys.has('KeyZ') || G.keys.has('Comma')) { c.yaw += dt * 1.6; c.lookYaw = clamp((c.lookYaw || 0) + dt * 1.2, -1.4, 1.4); c.lastDrag = t; }
  if (G.keys.has('KeyC') || G.keys.has('Period')) { c.yaw -= dt * 1.6; c.lookYaw = clamp((c.lookYaw || 0) - dt * 1.2, -1.4, 1.4); c.lastDrag = t; }
  let s;
  const walking = c.shot && !STATE.sceneShot && t - (c.lastMove || -99) < 1.6 && STATE.started && !STATE.lockMove;
  if (walking && !c.wasWalking) c.yaw = PLAYER.yaw + Math.PI;
  c.wasWalking = walking;
  if (c.shot && !walking) {
    s = c.shot(t);
    if (STATE.sceneShot && STATE.started) s = liven(s, t, dt);
    // Looking around inside a scene: drag (or Z / C) turns the view from where the camera stands; it eases back when you let go.
    if (t - c.lastDrag > 4) { c.lookYaw = damp(c.lookYaw || 0, 0, 1.6, dt); c.lookPitch = damp(c.lookPitch || 0, 0, 1.6, dt); }
    if (Math.abs(c.lookYaw || 0) > 1e-3 || Math.abs(c.lookPitch || 0) > 1e-3) {
      const d = s.look.clone().sub(s.pos), r = d.length(), yaw = Math.atan2(d.x, d.z) + c.lookYaw, pit = Math.asin(clamp(d.y / r, -1, 1)) - c.lookPitch;
      s = { ...s, look: s.pos.clone().add(new THREE.Vector3(Math.sin(yaw) * Math.cos(pit), Math.sin(pit), Math.cos(yaw) * Math.cos(pit)).multiplyScalar(r)) };
    }
  }
  else {
    // Exploration: recentre behind the player while moving; drift toward an
    // over-the-shoulder framing of Partner when standing still near them.
    if (SETTINGS.view !== 'first' && PLAYER.speed > 0.3 && t - c.lastDrag > 2.5) c.yaw = angDamp(c.yaw, PLAYER.yaw + Math.PI, 1.2 * clamp(PLAYER.speed / 1.5, 0.3, 1.5), dt);
    c.idle = PLAYER.speed < 0.1 ? c.idle + dt : 0;
    s = SHOTS.follow(t);
    const dP = Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
    // Only when she's actually turned toward you; otherwise this framed the back of her head.
    const faces = (Math.sin(PARTNER.yaw) * (PLAYER.x - PARTNER.x) + Math.cos(PARTNER.yaw) * (PLAYER.z - PARTNER.z)) / Math.max(dP, 1e-3);
    if (SETTINGS.view !== 'first' && c.idle > 2.2 && t - c.lastDrag > 4 && dP < 3.2 && dP > 0.6 && !(PARTNER.sit > 0.5) && !PARTNER.hidden && !PARTNER.lie && !PLAYER.freeSit && faces > 0.5 && PARTNER.pose !== 'warm') {
      const o = SHOTS.ots(PARTNER, PLAYER, 1), k = G.smooth(2.2, 4.5, c.idle);
      s = { pos: s.pos.clone().lerp(o.pos, k), look: s.look.clone().lerp(o.look, k), fov: lerp(s.fov, o.fov + 8, k), focus: lerp(s.focus, o.focus, k), aperture: lerp(s.aperture, o.aperture * 0.8, k) };
    }
  }
  const k = c.cut ? 1 : 1 - Math.exp(-(c.shot ? 3 : 6) * dt);
  c.cut = false;
  c.pos.lerp(s.pos, k); c.look.lerp(s.look, k);
  c.fov = lerp(c.fov, s.fov, k); c.focus = lerp(c.focus, s.focus, k); c.aperture = lerp(c.aperture, s.aperture, k);
  // Subtle handheld drift.
  handT += dt;
  const hm = G.MOTION;
  c.shake = Math.max(0, (c.shake || 0) - dt * 2.5);
  const sk = c.shake * c.shake * 0.05 * (0.4 + 0.6 * G.MOTION);
  const hx = (Math.sin(handT * 0.9) * 0.006 + Math.sin(handT * 2.3) * 0.003) * hm + Math.sin(handT * 61) * sk, hy = (Math.sin(handT * 1.3 + 1) * 0.005 + Math.sin(handT * 3.1) * 0.002) * hm + Math.cos(handT * 53) * sk;
  G.camera.position.copy(c.pos).add(new THREE.Vector3(hx, hy, 0));
  G.camera.lookAt(c.look.x + hx * 0.5, c.look.y + hy * 0.5, c.look.z);
  // Portrait phones: widen the vertical angle so the frame keeps most of a landscape shot's width.
  const asp = G.camera.aspect;
  const fov = asp < 1 ? Math.min(85, 2 * Math.atan(Math.tan(c.fov * Math.PI / 360) * Math.max(1, 0.95 / asp)) * 180 / Math.PI) : c.fov;
  if (Math.abs(G.camera.fov - fov) > 0.01) { G.camera.fov = fov; G.camera.updateProjectionMatrix(); }
  if (bokeh) {
    bokeh.uniforms.focus.value = c.focus; bokeh.uniforms.aperture.value = c.aperture;
    // Depth of field re-renders the whole scene for depth; only pay for it in shots where the blur shows.
    bokeh.enabled = G.Q.dof && c.aperture > 0.006;
  }
  // In first person your own body is out of frame (and would sit around the lens).
  if (PLAYER.m) PLAYER.m.visible = !(SETTINGS.view === 'first' && !c.shot && STATE.started);
  c.bars = damp(c.bars, c.shot && !G.MOBILE ? 0.06 : 0, 4, dt);
  grade.uniforms.uBars.value = c.bars;
}
function setShot(fn, cut = true) { CAM.shot = fn; CAM.cut = cut; CAM.shotT = G.simT || 0; }
/* Scene shots shouldn't sit dead still. Each one pushes in very slowly and drifts in a small arc around what it's
 * looking at, and the framing leans a little toward whoever is talking, if they're already in frame. Reduced motion
 * turns all of it off. */
const _lv = { a: new THREE.Vector3(), b: new THREE.Vector3() };
function liven(s, t, dt) {
  const c = CAM, m = G.MOTION;
  const u = t - (c.shotT || 0);
  const d = _lv.a.copy(s.pos).sub(s.look), r = d.length();
  if (r < 0.3) return s;
  let pos = s.pos, look = s.look, fov = s.fov;
  if (m > 0) {
    const push = 0.065 * G.smooth(0, 14, u) * m, arc = 0.03 * Math.sin(u * 0.17) * m * G.smooth(0, 3, u);
    const rr = Math.max(0.5, r * (1 - push)), ya = Math.atan2(d.x, d.z) + arc, hz = Math.hypot(d.x, d.z);
    pos = s.look.clone().add(new THREE.Vector3(Math.sin(ya) * hz * rr / r, d.y * rr / r, Math.cos(ya) * hz * rr / r));
    fov = s.fov * (1 - 0.03 * G.smooth(0, 14, u) * m);
  }
  // Lean toward the speaker.
  const who = DLG.cur && DLG.cur.who, sw = !!(G.NIGHT && G.NIGHT.swapped);
  const spk = who === 'partner' ? (sw ? PLAYER : PARTNER) : who === 'player' ? (sw ? PARTNER : PLAYER) : null;
  let want = 0;
  if (m > 0 && spk && spk.m && spk.m.visible !== false && !spk.hidden) {
    const h = head(spk); _lv.b.set(h.x, h.headY, h.z);
    const v1 = _lv.b.clone().sub(pos), v2 = look.clone().sub(pos);
    const ang = v1.angleTo(v2) * 180 / Math.PI;
    if (ang < fov * 0.42 && v1.length() < 7) { want = 1; c.leanTo = (c.leanTo || new THREE.Vector3()).copy(_lv.b); }
  }
  c.lean = damp(c.lean || 0, want, want ? 1.4 : 0.9, dt);
  if (c.lean > 0.002 && c.leanTo) {
    const off = c.leanTo.clone().sub(look), L = off.length(), k = Math.min(0.16, 0.22 / Math.max(L, 1e-3)) * c.lean;
    look = look.clone().add(off.multiplyScalar(k));
    fov *= 1 - 0.025 * c.lean;
  }
  if (pos === s.pos && look === s.look && fov === s.fov) return s;
  return { ...s, pos, look, fov, focus: pos.distanceTo(look) };
}
function releaseCamera() { CAM.shot = null; CAM.cut = false; CAM.yaw = PLAYER.yaw + Math.PI; CAM.lastDrag = -99; }
G.setShot = setShot; G.releaseCamera = releaseCamera;
// Free time-of-day toggle (N / the HUD button): day → sunset → night → day.
G.cycleTime = () => {
  if (G.S && G.S.chapter === 'prologue') return;   // the memory keeps its own night
  if (STATE.dayTarget > 0.5) { STATE.dayTarget = 0; STATE.todTarget = 0; }
  else if (STATE.todTarget < 0.5) STATE.todTarget = 1;
  else { STATE.todTarget = 0; STATE.dayTarget = 1; }
};
G.setTime = (o, now) => {
  if (o.day != null) { STATE.dayTarget = o.day; if (now) STATE.day = o.day; }
  if (o.tod != null) { STATE.todTarget = o.tod; if (now) STATE.tod = o.tod; }
  if (o.snow != null) { STATE.snowTarget = o.snow; if (now) STATE.snow = o.snow; }
  STATE.dayRate = o.rate || 0.5;
};

/* =====================================================================
 * Input
 * ===================================================================== */
const keys = (G.keys = new Set()), pressed = new Set();
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') { setPaused(!STATE.paused); e.preventDefault(); return; }
  if (e.code === 'KeyM') { setMuted(!SETTINGS.muted); return; }
  if (e.code === 'KeyV' && !STATE.paused) { setView(SETTINGS.view === 'first' ? 'third' : 'first'); return; }
  if (STATE.paused) return;
  if (e.code === 'KeyT' && !e.repeat && STATE.started && G.takePhoto) { G.takePhoto(); return; }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (!keys.has(e.code)) pressed.add(e.code);
  keys.add(e.code); G.Audio.start();
  if (e.code === 'Backquote') toggleStats();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const hit = (...c) => c.some((k) => pressed.has(k));
G.hit = hit; G.pressed = pressed;
let drag = null;
G.canvas.addEventListener('pointerdown', (e) => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { G.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } G.Audio.start(); });
G.canvas.addEventListener('pointermove', (e) => { if (!drag || drag.id !== e.pointerId || STATE.paused) return; if (CAM.shot && G.simT - (CAM.lastMove || -99) > 1.6) { CAM.lookYaw = clamp((CAM.lookYaw || 0) - (e.clientX - drag.x) * 0.004, -1.4, 1.4); CAM.lookPitch = clamp((CAM.lookPitch || 0) + (e.clientY - drag.y) * 0.003, -0.5, 0.5); drag.x = e.clientX; drag.y = e.clientY; CAM.lastDrag = G.simT; return; } CAM.yaw -= (e.clientX - drag.x) * 0.006; if (SETTINGS.view === 'first') CAM.fpPitch = clamp((CAM.fpPitch || 0) + (e.clientY - drag.y) * 0.004, -0.9, 1.0); else CAM.pitch = clamp(CAM.pitch + (e.clientY - drag.y) * 0.004, -0.2, 0.85); drag.x = e.clientX; drag.y = e.clientY; CAM.lastDrag = G.simT; });
G.canvas.addEventListener('pointerup', () => { drag = null; });
G.canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (SETTINGS.view === 'first') return; CAM.zoom = clamp(CAM.zoom * (e.deltaY > 0 ? 1.1 : 0.9), 0.6, 1.8); }, { passive: false });
const stick = { x: 0, y: 0, on: false };
(() => {
  const zone = $('stickzone'), knob = $('knob'), base = $('stick');
  let id = null, ox = 0, oy = 0;
  zone.addEventListener('pointerdown', (e) => { id = e.pointerId; ox = e.clientX; oy = e.clientY; base.style.left = (ox - 55) + 'px'; base.style.top = (oy - 55) + 'px'; base.classList.add('on'); try { zone.setPointerCapture(id); } catch (err) { /* capture is a nicety */ } stick.on = true; G.Audio.start(); e.preventDefault(); });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId !== id) return; let dx = e.clientX - ox, dy = e.clientY - oy; const l = Math.hypot(dx, dy); if (l > 45) { dx *= 45 / l; dy *= 45 / l; } knob.style.transform = `translate(${dx}px,${dy}px)`; stick.x = dx / 45; stick.y = dy / 45; });
  const end = (e) => { if (e.pointerId !== id) return; id = null; stick.on = false; stick.x = stick.y = 0; knob.style.transform = ''; base.classList.remove('on'); };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  $('btn-use').addEventListener('pointerdown', (e) => { e.preventDefault(); pressed.add('KeyE'); });
  $('btn-hug').addEventListener('pointerdown', (e) => { e.preventDefault(); pressed.add('KeyQ'); });
  if ($('btn-photo')) $('btn-photo').addEventListener('pointerdown', (e) => { e.preventDefault(); if (G.takePhoto) G.takePhoto(); });
})();

/* =====================================================================
 * Dialogue (cinematic subtitles) with automatic shot selection
 * ===================================================================== */
const DLG = { q: [], cur: null, shown: 0, t: 0, auto: false };
// Playing as Partner: in the chapters told around her (free time and the endings) the narration is her side of it,
// and the speaker labels turn round ("You" is her, "Partner" is him).
const HER_CH = /^(prologue|morning|walk|evening|firstsnow|ending_(foundme|uncertain|iknow|perfect|stay))$/;
G.herSide = () => SETTINGS.playAs === 'partner' && !!G.S && HER_CH.test(G.S.chapter || '');
// Playing as her through the night and Act IV (her own route there, not just free time).
G.herRoute = () => SETTINGS.playAs === 'partner';
// Gentle nights (title screen): nothing chases you, nothing catches you, no heartbeat. The story is the same.
G.gentle = () => SETTINGS.nights === 'gentle';
G.easyHands = () => SETTINGS.hands === 'easy';
// Just before a big moment: the music and the warm chords drop away, and the clock gets louder.
G.beatHush = (sec = 5) => { STATE.quietUntil = G.simT + sec; };
// Dialogue that flows on by itself (default), or waits for E / a tap on every line.
G.flowing = () => SETTINGS.flow !== 'press';
// "You" is whoever you're playing: her in her chapters, in her own route, and whenever the bodies are swapped.
G.labelsTurned = () => G.herSide() || !!(G.NIGHT && G.NIGHT.swapped) || (G.herRoute() && !!G.S && G.S.chapter === 'bedtime');
const herLine = (who, text) => (who == null && G.herSide() && window.CBS_NARR_HER && window.CBS_NARR_HER[text]) || text;
// Who is talking while a line is formatted (the imitation's pet names can slip: companion.js, G.nameSlip).
const fmtAs = (who, t) => { G.fmtWho = who; try { return G.fmt(t); } finally { G.fmtWho = null; } };
G.say = (who, text, o = {}) => (who != null && STATE.asHer && G.S && G.S.inInter ? Promise.resolve() : new Promise((res) => DLG.q.push({ who, text: fmtAs(who, herLine(who, text)), res, o })));
const busy = () => !!DLG.cur || DLG.q.length > 0 || STATE.busy || !!(G.UI && G.UI.blocking());
G.busy = busy; G.DLG = DLG;
function pickShotFor(who, o) {
  if (o.shot === 'keep') return;
  if (o.shot) { setShot(o.shot, o.cut !== false); return; }
  const d = Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
  if (d > 3.6 || STATE.sceneShot || G.simT - (CAM.lastMove || -99) < 1.6) return;
  // With the bodies swapped, her lines come from the body you're driving.
  const sw = !!(G.NIGHT && G.NIGHT.swapped), her = sw ? PLAYER : PARTNER, him = sw ? PARTNER : PLAYER;
  if (who === 'partner') setShot(() => SHOTS.ots(her, him, 1));
  else if (who === 'player') setShot(() => SHOTS.ots(him, her, -1));
  else setShot(() => SHOTS.twoShot(), true);
  DLG.autoShot = true;
}
function updateDialogue(dt) {
  const box = $('subs');
  if (!DLG.cur && DLG.q.length) {
    DLG.cur = DLG.q.shift(); DLG.shown = 0; DLG.t = 0;
    box.className = 'show ' + (DLG.cur.who ? 'who-' + DLG.cur.who : 'narr') + (G.flowing() ? ' flow' : '');
    document.body.classList.toggle('talking', G.flowing());
    { const hs = G.labelsTurned(); $('who').textContent = DLG.cur.who === 'partner' ? (hs ? G.CFG.playerLabel : G.CFG.partnerLabel) : DLG.cur.who === 'player' ? (hs ? G.CFG.partnerLabel : G.CFG.playerLabel) : ''; }
    pickShotFor(DLG.cur.who, DLG.cur.o);
  }
  if (!DLG.cur) { if (box.className !== '') { box.className = ''; document.body.classList.remove('talking'); DLG.autoShot = false; if (!STATE.sceneShot && CAM.shot) releaseCamera(); } return; }
  const cur = DLG.cur;
  DLG.t += dt; DLG.shown = Math.min(cur.text.length, DLG.shown + dt * 42);
  $('line').textContent = cur.text.slice(0, Math.floor(DLG.shown));
  // Lines flow on by themselves (a setting): long enough to read comfortably, then the next one. E or a tap
  // still moves things along, and "Press to continue" brings back waiting for you.
  const read = Math.min(8, Math.max(1.6, 0.6 + cur.text.length * 0.05)) * (SETTINGS.subs === 'l' || SETTINGS.subs === 'xl' ? 1.15 : 1);
  const auto = (cur.o.auto && DLG.t > cur.o.auto) || (G.flowing() && !cur.o.wait && DLG.shown >= cur.text.length && DLG.t > cur.text.length / 42 + read);
  if (auto || ((hit('KeyE', 'Space', 'Enter') || DLG.click) && DLG.t > 0.15)) {
    DLG.click = false; pressed.delete('KeyE'); pressed.delete('Space'); pressed.delete('Enter');
    if (!auto && DLG.shown < cur.text.length) DLG.shown = cur.text.length;
    else { DLG.cur = null; G.lineEndT = G.simT; cur.res(); }
  }
}
$('subs').addEventListener('pointerdown', (e) => { e.preventDefault(); DLG.click = true; });
function bark(text, dur = 2.6) { if (STATE.asHer) return; PARTNER.bark = { text: fmtAs('partner', Array.isArray(text) ? text[Math.floor(Math.random() * text.length)] : text), t: dur }; }
G.bark = (t, d) => bark(t, d); G.hint = (t, d) => hint(G.fmt(t), d);
function hint(text, dur = 5) { const h = $('hint'); h.textContent = text; h.classList.add('show'); clearTimeout(hint._t); hint._t = setTimeout(() => h.classList.remove('show'), dur * 1000); }
// Waits run on the game clock, so a scene pauses with the tab instead of racing ahead of the dialogue.
const TIMERS = [];
const wait = (s) => new Promise((r) => TIMERS.push({ t: s, r }));
const until = async (fn) => { while (!fn()) await wait(0.1); };
G.until = until;
function tickTimers(dt) { for (let i = TIMERS.length - 1; i >= 0; i--) if ((TIMERS[i].t -= dt) <= 0) { const r = TIMERS[i].r; TIMERS.splice(i, 1); r(); } }
// Fade to black, run the setup, fade back in: a cinematic cut that also skips fiddly walking.
async function cutTo(setup, hold = 0.15, color) {
  const f = $('fade');
  if (color) f.style.background = color;
  f.classList.add('on'); await wait(0.65); await setup(); CAM.cut = true; await wait(hold); f.classList.remove('on');
  if (color) wait(0.7).then(() => { if (!f.classList.contains('on')) f.style.background = ''; });
}
G.cutTo = cutTo; G.wait = wait;
G.fade = (on, color) => { const f = $('fade'); f.style.background = color || ''; f.classList.toggle('on', on); return wait(0.65); };

/* =====================================================================
 * Partner
 * ===================================================================== */
function partnerAI(dt, t) {
  const p = PARTNER;
  p.holdOn = PLAYER.holdOn = false;   // set again below only while she's actually walking hand in hand
  if (p.bark) { p.bark.t -= dt; if (p.bark.t <= 0) p.bark = null; }
  // The last of the walk's pace runs out over a moment (it ends near a standstill already), not in one frame.
  if (p.settle) { if (p.script || p.slide || p.lie) p.settle = false; else { p.speed = damp(p.speed, 0, 12, dt); if (p.speed < 0.01) { p.speed = 0; p.settle = false; } } }
  // Turning to face where a walk said to (a quick turn on the spot, with little steps), not a snap round.
  if (p.turnTo != null) { if (p.script || p.slide || p.lie || (p.sit || 0) > 0.2) p.turnTo = null; else { p.yaw = angDamp(p.yaw, p.turnTo, 9, dt); let e = p.turnTo - p.yaw; e = Math.atan2(Math.sin(e), Math.cos(e)); if (Math.abs(e) < 0.01) { p.yaw = p.turnTo; p.turnTo = null; } } }
  if (p.script) {
    const s = p.script;
    s.t = (s.t || 0) + dt;
    if (steer(p, s.x, s.z, s.speed || 1.2, dt, 0.08) || s.t > 12) { p.script = null; p.settle = true; if (s.yaw != null) p.turnTo = s.yaw; s.res && s.res(); }
    p.lookAt = null;
    return;
  }
  if (p.slide) return;
  if (p.mode === 'still') { p.speed = damp(p.speed, 0, 8, dt); p.lookAt = p.stillLook || null; return; }
  if (p.mode === 'seated' || p.mode === 'lying') { p.speed = 0; p.lookAt = p.mode === 'seated' ? head(PLAYER) : null; return; }
  if (p.mode === 'stay') { p.speed = damp(p.speed, 0, 8, dt); p.yaw = angDamp(p.yaw, Math.atan2(PLAYER.x - p.x, PLAYER.z - p.z), 2, dt); p.lookAt = head(PLAYER); return; }
  if (p.task) { if (partnerTask(p, dt, t)) return; }
  if (p.lead) { partnerLead(p, dt, t); return; }
  if (p.hold) { partnerHold(p, dt, t); return; }
  if (p.mode === 'follow') {
    const side = new THREE.Vector3(Math.cos(PLAYER.yaw), 0, -Math.sin(PLAYER.yaw));
    if (!NAV.open) buildNav();
    // Stand at your shoulder (her usual side, else the other one) — never on the far side of a wall.
    let tx = PLAYER.x, tz = PLAYER.z;
    const pin = G.inside(PLAYER.x, PLAYER.z);
    for (const sg of [-1, 1]) {
      const o = nearestOpen(...cellOf(PLAYER.x + sg * side.x * 0.75 - Math.sin(PLAYER.yaw) * 0.35, PLAYER.z + sg * side.z * 0.75 - Math.cos(PLAYER.yaw) * 0.35), 6);
      if (!o) continue;
      const q = cellPos(o[0], o[1]);
      if (Math.hypot(q.x - PLAYER.x, q.z - PLAYER.z) < 1.6 && G.inside(q.x, q.z) === pin && lineClear({ x: PLAYER.x, z: PLAYER.z }, q)) { tx = q.x; tz = q.z; break; }
    }
    const d = Math.hypot(PLAYER.x - p.x, PLAYER.z - p.z);
    if (d > 1.15 || (p.speed > 0.05 && Math.hypot(tx - p.x, tz - p.z) > 0.25)) steer(p, tx, tz, clamp(d * 1.1, 0.8, PLAYER.speed > 2 ? 3.0 : 1.65), dt, 0.2);
    else {
      p.speed = damp(p.speed, 0, 8, dt);
      // Warming her hands: turn to the fire, and only glance back at you now and then.
      const fire = p.pose === 'warm';
      p.yaw = angDamp(p.yaw, fire ? Math.atan2(FIRE_AT.x - p.x, FIRE_AT.z - p.z) : Math.atan2(PLAYER.x - p.x, PLAYER.z - p.z), fire ? 3 : 2, dt);
      if (fire) { p.lookAt = Math.sin(t * 0.4) > 0.6 ? head(PLAYER) : null; return; }
    }
    // Lost entirely (no route for a few seconds and far behind): catch up quietly behind the player.
    if (p.nav && p.nav.fail > 3 && d > 6) { const o = nearestOpen(...cellOf(PLAYER.x - Math.sin(PLAYER.yaw) * 1.2, PLAYER.z - Math.cos(PLAYER.yaw) * 1.2), 8); if (o) { const q = cellPos(o[0], o[1]); if (G.inside(q.x, q.z) === G.inside(PLAYER.x, PLAYER.z) && lineClear({ x: PLAYER.x, z: PLAYER.z }, q)) { placeChar(p, q.x, q.z, PLAYER.yaw); p.nav = null; } } }
    p.lookAt = head(PLAYER);
    // At home she has a life of her own: every so often she wanders off to something she likes.
    if (STATE.autonomy && !STATE.asHer && G.SMART && !busy() && !p.hold) {
      p.curious = (p.curious || 0) + dt * (PLAYER.speed < 0.2 ? 1.4 : 1);
      if (p.curious > (p.curiousAt || (p.curiousAt = 18 + Math.random() * 16))) {
        p.curious = 0; p.curiousAt = 22 + Math.random() * 22;
        const opts = G.SMART.filter((o) => o !== p.lastSmart && (!o.cond || o.cond()) && Math.hypot(o.spot.x - PLAYER.x, o.spot.z - PLAYER.z) < 11);
        if (opts.length) { const o = opts[Math.floor(Math.random() * opts.length)]; p.lastSmart = o; p.task = { o, phase: 'go', t: 0 }; }
      }
    }
  }
}
/* A smart-object task: walk to it, do the thing for a while, come back. Returns true while it owns her. */
function partnerTask(p, dt, t) {
  const T = p.task, o = T.o, dP = Math.hypot(PLAYER.x - p.x, PLAYER.z - p.z);
  T.t += dt;
  if (T.phase === 'go') {
    if ((dP > 11 && !o.stay) || T.t > (o.stay ? 30 : 14)) { p.task = null; return false; }
    if (steer(p, o.spot.x, o.spot.z, 1.2, dt, 0.1)) {
      T.phase = 'do'; T.t = 0; T.dur = o.dur[0] + Math.random() * (o.dur[1] - o.dur[0]);
      p.speed = 0; p.nav = null;
      if (o.hide) { p.m.visible = false; p.hidden = true; if (o.line) bark(o.line, 2.6); }
      else if (o.seatAt) G.sitDown(p, o.seatAt.x, o.seatAt.z, o.seatAt.yaw, o.seatAt.y);
      if (o.lines && Math.random() < 0.8 && !o.hide) bark(o.lines, 3);
      else if (!o.hide && Math.random() < 0.6) G.Audio.hum();   // or she hums to herself
      if (o.onArrive) o.onArrive(p);
      if (!o.hide && !o.seatAt && o.look && !o.noReach && G.startReach) G.startReach(p, { pos: [o.look.x, o.look.y, o.look.z] }, 1.6);   // she reaches for it
    }
    p.lookAt = null;
    return true;
  }
  // doing it
  if (o.yaw != null && !o.seatAt) p.yaw = angDamp(p.yaw, o.yaw, 4, dt);
  p.lookAt = o.look ? { x: o.look.x, z: o.look.z, headY: o.look.y } : (Math.sin(t * 0.5) > 0.7 ? head(PLAYER) : null);
  if (o.onTick) o.onTick(p, dt, T);
  const done = T.t > T.dur || (dP > 9 && !p.hidden && !o.stay) || T.abort;
  if (done) endTask(p);
  return true;
}
function endTask(p) {
  const T = p.task; if (!T) return;
  if (T.o.onEnd) { try { T.o.onEnd(p, T); } catch (e) { console.error(e); } }
  if (p.hidden) { p.hidden = false; p.m.visible = true; if (T.o.exit) placeChar(p, T.o.exit.x, T.o.exit.z, T.o.exit.yaw || 0); bark(['*reappears, entirely casual*', 'Hm? I wasn’t doing anything.', 'There’s nothing in there. Please don’t look.'], 2.4); }
  if (p.sitTarget) { p.sitTarget = 0; G.slideTo(p, T.o.spot.x, T.o.spot.z, null, 0.55); }
  p.task = null; p.nav = null;
}
G.endPartnerTask = () => endTask(PARTNER);
/* Lead: she walks ahead to a place, waiting (and complaining) if you fall behind. */
function partnerLead(p, dt, t) {
  const L = p.lead, d = Math.hypot(PLAYER.x - p.x, PLAYER.z - p.z);
  L.waitT = (L.waitT || 0) - dt;
  if (L.arrived || d > 6.5) {
    p.speed = damp(p.speed, 0, 6, dt); p.nav = null;
    p.yaw = angDamp(p.yaw, Math.atan2(PLAYER.x - p.x, PLAYER.z - p.z), 3, dt); p.lookAt = head(PLAYER);
    if (L.waitT <= 0 && d > 3.5) { L.waitT = 8 + Math.random() * 5; bark(L.waitLines || ['Do keep up, {toHim}.', 'I’m waiting. Patiently. Mostly.', 'Your legs are longer than mine, you know.', 'Come along, {toHim}.'], 2.6); }
    if (!L.arrived && d > 6.5) return;
    if (L.arrived) return;
  }
  if (steer(p, L.x, L.z, d < 3 ? 1.55 : 1.25, dt, 0.15)) { L.arrived = true; if (L.cb) L.cb(); }
  p.lookAt = null;
}
/* Holding hands: she walks at your side, hand in hand, and lets go for a moment when a doorway won't fit you both. */
function partnerHold(p, dt, t) {
  const side = p.holdSide2 || 1;   // which side of you she walks on (+1 = your left)
  const lx = Math.cos(PLAYER.yaw), lz = -Math.sin(PLAYER.yaw);   // your left, for a character facing (sin yaw, cos yaw)
  const tx = PLAYER.x + lx * side * 0.46, tz = PLAYER.z + lz * side * 0.46;
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  if (d > 0.7) {
    steer(p, tx, tz, clamp(d * 2, 1, 3.2), dt, 0.05);
  } else {
    const k = 1 - Math.exp(-10 * dt);
    moveChar(p, dx * k, dz * k);
    p.speed = damp(p.speed, PLAYER.speed, 10, dt);
    p.phase = PLAYER.phase + Math.PI * 0.08;   // in step with you, more or less
    p.yaw = angDamp(p.yaw, PLAYER.speed > 0.2 ? PLAYER.yaw : Math.atan2(PLAYER.x - p.x, PLAYER.z - p.z) * 0.3 + PLAYER.yaw * 0.7, 8, dt);
  }
  const close = Math.hypot(PLAYER.x - p.x, PLAYER.z - p.z) < 0.75;
  // Arm 0 sits at the rig's −x: the right arm. Each holds with the hand nearest the other.
  p.holdArm = side > 0 ? 0 : 1; PLAYER.holdArm = side > 0 ? 1 : 0;
  p.holdWith = PLAYER; PLAYER.holdWith = p;
  p.holdOn = close; PLAYER.holdOn = close && !!p.hold;
  p.lookAt = Math.sin(t * 0.3) > 0.5 ? head(PLAYER) : null;
}
G.setHold = (on) => {
  const p = PARTNER;
  if (on) { const rx = Math.cos(PLAYER.yaw), rz = -Math.sin(PLAYER.yaw); p.holdSide2 = ((p.x - PLAYER.x) * rx + (p.z - PLAYER.z) * rz) > 0 ? 1 : -1; }
  p.hold = on; p.holdTimer = null; if (!on) { p.holdOn = false; PLAYER.holdOn = false; }
};
// Scripted walk. An unreachable target (inside furniture) is moved to the nearest open spot, and a
// walk that still can't finish gives up after a while, so a story beat can never hang on it.
const walkTo = (c, x, z, speed, yaw) => new Promise((res) => {
  if (!NAV.open) buildNav();
  const cell = cellOf(x, z);
  if (!isOpen(cell[0], cell[1])) { const o = nearestOpen(cell[0], cell[1], 10); if (o) { const q = cellPos(o[0], o[1]); x = q.x; z = q.z; } }
  c.script = { x, z, speed, yaw, res, t: 0 };
});
G.walkTo = walkTo;

/* =====================================================================
 * Story beats
 * ===================================================================== */
const Story = (G.Story = {
  async intro() {
    STATE.busy = true; STATE.sceneShot = true;
    const z0 = 27;
    placeChar(PLAYER, G.pathX(z0) + 0.35, z0, Math.PI); placeChar(PARTNER, G.pathX(z0) - 0.45, z0 - 0.4, Math.PI);
    PLAYER.script = { x: G.pathX(19) + 0.35, z: 19, speed: 1.05 };
    PARTNER.script = { x: G.pathX(18.6) - 0.45, z: 18.6, speed: 1.05 };
    setShot(() => SHOTS.rearPair(2.6, 0.15, 12, 46));
    await wait(1.4);
    await G.say('partner', 'Look. Every window’s still glowing. We left all the lights on.', { shot: 'keep', auto: 4.2 });
    await G.say('player', 'You left all the lights on.', { shot: 'keep', auto: 2.6 });
    await G.say('partner', 'We did. I like coming home to a lit house. It feels like someone’s waiting for us.', { shot: 'keep', auto: 4.2 });
    await until(() => !PLAYER.script);
    STATE.sceneShot = false; STATE.busy = false;
    PARTNER.mode = 'follow';
    releaseCamera();
    hint(G.MOBILE ? 'Drag on the left to walk; drag on the right to look. Use to interact, ♥ to be together.' : `${[G.keyFor('forward'), G.keyFor('left'), G.keyFor('back'), G.keyFor('right')].join('')} to walk, ${G.keyFor('run')} to run. Drag to look, scroll to zoom. ${G.keyFor('interact')} to interact, ${G.keyFor('together')} to be together.`, 8);
    STATE.watchDoor = true;
  },
  async cake() {
    if (!G.CAKE.lit) { G.say(null, '(One slice missing. You didn’t cut it.)'); return; }
    STATE.busy = true;
    PARTNER.mode = 'script';
    const cx = G.CAKE.g.position.x, cz = G.CAKE.g.position.z;
    // Across the table from the sofa side, between table and hearth, so the candles light her face.
    await walkTo(PARTNER, cx + 0.55, cz - 0.68, 1.3, 0);   // off-centre: right in front of the fire she'd be blown out by its light
    PARTNER.mode = 'follow'; STATE.busy = false;
    const cakeShot = () => { const p = new THREE.Vector3(cx + 0.55, 0.78, cz + 0.7), l = new THREE.Vector3(cx, 0.62, cz); return { pos: p, look: l, fov: 34, focus: p.distanceTo(l), aperture: 0.03 }; };
    await G.say(null, '(A cake. Five candles: one for every first snow in this cabin. Somebody counted very carefully.)', { shot: cakeShot });
    await G.say('partner', 'You thought I’d forgotten what day it is. Admit it.');
    await G.say('player', 'You didn’t say a word all day.');
    await G.say('partner', 'That was the hardest thing I have ever done, {toHim}.');
    // The snow globe on the mantle doubles as a music box.
    const tune = G.Audio.musicBox();
    await G.say(null, '(She winds the snow globe on the mantle. It plays its little tune, a touch slow, and she hums along, off-key and completely sure of herself.)', { shot: cakeShot, auto: Math.max(5, tune + 0.4) });
    // The same tune the lantern fair played, the night you met (the prologue).
    if (G.S.flags.fairTune) await G.say(null, '(For a moment it sounds like somewhere else. Lanterns, a long time ago. Then it’s just the snow globe again.)', { shot: cakeShot });
    await G.say('partner', 'Wait. Make a wish first. A proper one. Not a sensible one.');
    await G.say('player', 'What counts as sensible?');
    await G.say('partner', '“More sleep.” “A new kettle.” Anything you’d be willing to say out loud.');
    if (G.S.flags.fairWish === 'secret') await G.say(null, '(You make one. For a second it feels like a wish you’ve made before, somewhere colder.)', { shot: cakeShot });
    else if (G.S.flags.fairWish === 'snow') await G.say('partner', 'And not “snow every day”. …Somebody wished that once. I’m sure somebody did.', { shot: cakeShot });
    G.Audio.blow(); G.CAKE.lit = false;
    await G.say(null, '(You blow them out. All five, first try.)', { shot: cakeShot });
    await G.say('partner', 'Happy first snow, {dear}.');
    await G.say('player', 'Happy first snow.');
    STATE.cakeDone = true;
    if (G.EVE && G.EVE.showPhoto) { G.EVE.showPhoto(); wait(4).then(() => hint('Something’s different about the frame in the hall.', 6)); }
  },
  async cuddle() {
    if (STATE.cuddled) { G.say(null, '(The sofa still remembers the shape of both of you.)'); return; }
    STATE.busy = true; STATE.sceneShot = true;
    const S = G.SOFA;
    const bl = G.CUDDLE_BLANKET;
    await cutTo(() => {
      for (const [c, x] of [[PLAYER, S.x + 0.35], [PARTNER, S.x - 0.25]]) { c.x = x; c.z = S.z - 0.08; c.y = c.yFloor = 0; c.yaw = Math.PI; c.seatY = S.seatY; c.sitTarget = 1; c.sit = 1; c.speed = 0; }
      PARTNER.mode = 'seated'; PARTNER.script = null;
      bl.visible = true; bl.position.set(S.x + 0.05, 0.69, S.z - 0.2); bl.rotation.set(-Math.PI / 2 + 0.18, 0, 0); bl.scale.set(0.95, 0.75, 1);
      setShot(() => { const pos = new THREE.Vector3(S.x - 1.05, 1.22, S.z - 1.55), look = new THREE.Vector3(S.x + 0.02, 0.98, S.z - 0.05); return { pos, look, fov: 34, focus: pos.distanceTo(look), aperture: 0.012 }; });
    });
    await wait(1.2);
    PARTNER.tiltTarget = -0.32; PARTNER.leanTarget = 0.12; PARTNER.lidsClosed = true;
    await G.say(null, '(One blanket, two people, and the fire doing all the talking.)', { shot: 'keep' });
    await G.say('partner', 'Please don’t move. You are exactly the right height for this.', { shot: 'keep' });
    await G.say('player', 'I shall have to move eventually.', { shot: 'keep' });
    await G.say('partner', '“Eventually” is a very long way off.', { shot: 'keep' });
    await wait(1.5);
    // Stand up off-screen at either end of the sofa: the gap between sofa and coffee table is
    // too narrow to stand in, so placing people there left them inside the table.
    await cutTo(() => {
      PARTNER.tiltTarget = PARTNER.tilt = 0; PARTNER.leanTarget = PARTNER.lean = 0; PARTNER.lidsClosed = false;
      bl.visible = false;
      placeChar(PLAYER, S.x + 1.55, S.z - 0.1, -Math.PI / 2 - 0.4);
      placeChar(PARTNER, S.x - 1.55, S.z - 0.1, Math.PI / 2 + 0.4);
      for (const c of [PLAYER, PARTNER]) { c.sitTarget = c.sit = 0; }
      PARTNER.mode = 'follow'; PARTNER.nav = null;
      STATE.cuddled = true; STATE.busy = false; STATE.sceneShot = false;
      releaseCamera(); CAM.cut = true;
    }, 0.3);
    hint('The bench on the porch has the best view of the sky.', 6);
  },
  async porch() {
    if (STATE.porchDone) { STATE.todTarget = STATE.todTarget > 0.5 ? 0 : 1; return; }
    STATE.busy = true; STATE.sceneShot = true;
    STATE.dayTarget = 0;
    const B = G.BENCH;
    const rear = () => { const pos = new THREE.Vector3(B.x + 0.05, 1.2, B.z - 0.62), look = new THREE.Vector3(B.x - 0.3, 2.4, B.z + 12); return { pos, look, fov: 62, focus: 1.0, aperture: 0.005 }; };
    await cutTo(() => {
      for (const [c, x] of [[PLAYER, B.x + 0.38], [PARTNER, B.x - 0.38]]) { c.x = x; c.z = B.z + 0.02; c.y = c.yFloor = 0; c.yaw = 0; c.seatY = B.seatY; c.sitTarget = 1; c.sit = 1; c.speed = 0; }
      PARTNER.mode = 'seated'; PARTNER.script = null;
      setShot(rear);
    });
    STATE.todTarget = 1;
    await wait(2.5);
    await G.say(null, '(The sun goes, and then all at once there are more stars than sky.)', { shot: 'keep' });
    PARTNER.tiltTarget = -0.25;
    await G.say('partner', 'Pick a star. That one is yours. For this year.', { shot: 'keep' });
    await G.say('player', 'Which one, {toHer}?', { shot: 'keep' });
    await G.say('partner', 'The bright one, naturally. I wouldn’t give you a dim one tonight.', { shot: 'keep' });
    await wait(1.5);
    // Something that should not be here in winter.
    const E = G.EVE;
    if (E && E.fly) {
      E.fly.t = 0; E.fly.on = true;
      const flyShot = () => { const f = E.fly.s.position, pos = new THREE.Vector3(B.x - 1.1, 1.55, B.z - 0.35), look = f.clone().lerp(new THREE.Vector3(B.x, 1.0, B.z), 0.25); return { pos, look, fov: 48, focus: pos.distanceTo(f), aperture: 0.0004 }; };
      await wait(2.2);
      setShot(flyShot);
      await G.say(null, '(Something comes down through the falling snow, slowly, past the lanterns. A small, steady light. Yellow-green. It goes out. It comes on again.)', { shot: 'keep' });
      PARTNER.tiltTarget = 0; PARTNER.lookAt = { x: E.fly.s.position.x, z: E.fly.s.position.z, headY: E.fly.s.position.y };
      await G.say('player', 'Is that a—', { shot: 'keep' });
      await G.say('partner', 'It’s a firefly.', { shot: 'keep' });
      await wait(1.2);
      await G.say('partner', 'It’s the first snow, {dear}. There aren’t any fireflies.', { shot: 'keep' });
      await G.say(null, '(Her hand finds yours on the bench, and holds on.)', { shot: 'keep' });
      setShot(rear);
      await G.say('partner', 'Inside. Please.', { shot: 'keep' });
      E.fly.on = false; PARTNER.lookAt = null;
      G.S.flags.firefly = 1;
      await wait(0.8);
    }
    STATE.porchDone = true;
    if (G.goNight) { G.goNight(); return; }
    showEndcard();
    document.body.classList.remove('playing');
    STATE.porchDone = true;
  },
  closeEnd() {
    $('endcard').classList.remove('show');
    document.body.classList.remove('ending');
    document.body.classList.add('playing');
    cutTo(() => {
      PARTNER.tiltTarget = PARTNER.tilt = 0;
      const B = G.BENCH;
      placeChar(PLAYER, B.x + 0.38, B.z + 0.6, 0.15); placeChar(PARTNER, B.x - 0.42, B.z + 0.62, -0.1);
      for (const c of [PLAYER, PARTNER]) { c.sitTarget = c.sit = 0; }
      PARTNER.mode = 'follow'; PARTNER.nav = null; STATE.busy = false; STATE.sceneShot = false;
      releaseCamera(); CAM.cut = true;
    }, 0.3);
  },
});
G.showEndcard = (o = {}) => { showEndcard(o); document.body.classList.remove('playing'); };
function showEndcard(o = {}) {
  const B = G.CFG.closing || {};
  $('endHeading').textContent = G.fmt(B.heading || 'Still here. Still us.');
  const msg = $('endMsg');
  msg.textContent = '';
  const lines = (o.full === false && B.short ? [B.short] : B.full && B.full.length ? B.full : [B.short || '']).filter(Boolean);
  if ($('endMore')) $('endMore').hidden = !G.firstSnowOpen || !G.firstSnowOpen() || o.id === 'firstsnow';
  lines.forEach((t, i) => { const p = document.createElement('p'); p.textContent = G.fmt(t); p.style.animationDelay = (1.2 + i * 1.6) + 's'; msg.appendChild(p); });
  const sig = $('endSig');
  sig.textContent = G.fmt(B.signature || '');
  sig.style.animationDelay = (1.2 + lines.length * 1.6 + 0.4) + 's';
  $('endcard').classList.add('show');
  $('endcard').scrollTop = 0;
  document.body.classList.add('ending');
}
async function hug(kind = 'hug', line) {
  if (busy() || Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z) > 1.8 || PARTNER.sit > 0.2 || PLAYER.sit > 0.2) return false;
  const kiss = kind === 'kiss';
  STATE.busy = true; STATE.kiss = kiss;
  const held = PARTNER.hold; if (held) G.setHold(false);
  if (PARTNER.task) endTask(PARTNER);
  const a = Math.atan2(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
  PARTNER.speed = 0; PARTNER.nav = null;
  // Step in toward each other over a few frames instead of snapping, then settle out of any wall.
  const mx = (PLAYER.x + PARTNER.x) / 2, mz = (PLAYER.z + PARTNER.z) / 2;
  STATE.hugIn = { p: [mx - Math.sin(a) * 0.17, mz - Math.cos(a) * 0.17], q: [mx + Math.sin(a) * 0.17, mz + Math.cos(a) * 0.17], yaw: a };
  PLAYER.hugWith = PARTNER; PARTNER.hugWith = PLAYER;
  STATE.hugging = true; PARTNER.lidsClosed = true; PARTNER.tiltTarget = kiss ? -0.38 : -0.2;
  if (kiss) { STATE.hugIn.p = [mx - Math.sin(a) * 0.2, mz - Math.cos(a) * 0.2]; STATE.hugIn.q = [mx + Math.sin(a) * 0.2, mz + Math.cos(a) * 0.2]; PLAYER.leanTarget = 0.14; PLAYER.tiltTarget = 0.18; PLAYER.lidsClosed = true; PARTNER.headDown = -0.12; }
  // Side-on to the hug, favouring her face; try both sides and a closer fallback so walls never block it.
  const side = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)), fwd = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
  const camAt = (o) => { const m = G.headPos(PARTNER).add(new THREE.Vector3(0, -0.08, 0)); const pos = m.clone().addScaledVector(side, o[0] * o[2]).addScaledVector(fwd, o[1]); pos.y = m.y - 0.1; return { pos, look: m, fov: 34, focus: pos.distanceTo(m), aperture: 0.016 }; };
  // Mostly side-on, a little to your side of the hug, so her face (turned against you) is the one in frame.
  const pick = [[1, -0.25, 1.25], [-1, -0.25, 1.25], [1, -0.1, 0.9], [-1, -0.1, 0.9]].find((o) => { const c = camAt(o); return !blocked(c.look, c.pos); });
  if (pick) setShot(() => camAt(pick));
  bark(line || ['Mm. Hello, {toHim}.', 'You’re so warm. It hardly seems fair.', 'A very good hug. Ten out of ten.', 'All right. One more second. Two.']);
  await wait(kiss ? 1.7 : 2.6);
  STATE.hugging = false; STATE.hugIn = null; PARTNER.lidsClosed = false; PARTNER.tiltTarget = 0; STATE.busy = false;
  PLAYER.leanTarget = 0; PLAYER.tiltTarget = 0; PLAYER.lidsClosed = false; PARTNER.headDown = 0;
  if (held) G.setHold(true);
  releaseCamera();
  return true;
}
G.hug = hug;
/* A slow dance in the kitchen to the radio: close, swaying, the camera drifting round. Any move ends it. */
async function dance() {
  if (busy() || Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z) > 1.8 || PARTNER.sit > 0.2 || PLAYER.sit > 0.2) return false;
  STATE.busy = true; STATE.kiss = false; STATE.dancing = true; PLAYER.hugWith = PARTNER; PARTNER.hugWith = PLAYER;
  if (PARTNER.hold) G.setHold(false);
  if (PARTNER.task) endTask(PARTNER);
  const a = Math.atan2(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z), mx = (PLAYER.x + PARTNER.x) / 2, mz = (PLAYER.z + PARTNER.z) / 2;
  STATE.hugIn = { p: [mx - Math.sin(a) * 0.19, mz - Math.cos(a) * 0.19], q: [mx + Math.sin(a) * 0.19, mz + Math.cos(a) * 0.19], yaw: a };
  STATE.hugging = true; PARTNER.tiltTarget = -0.22; PLAYER.swayTarget = PARTNER.swayTarget = 1;
  // Find the most open direction around the pair (kitchens are small), then drift slowly either side of it.
  const t0 = G.simT, m0 = new THREE.Vector3(mx, 1.25, mz);
  let a0 = a + Math.PI / 2, best = -1;
  for (let i = 0; i < 16; i++) { const ang = i / 16 * Math.PI * 2, p = m0.clone().add(new THREE.Vector3(Math.sin(ang) * 2.2, 0.15, Math.cos(ang) * 2.2)), d = clampToWalls(m0, p).distanceTo(m0) - Math.abs(Math.sin(ang - a)) * -0.3; if (d > best) { best = d; a0 = ang; } }
  const R = Math.min(1.9, Math.max(1.1, best - 0.15));
  setShot(() => { const ang = a0 + Math.sin((G.simT - t0) * 0.18) * 0.45; let pos = m0.clone().add(new THREE.Vector3(Math.sin(ang) * R, 0.15, Math.cos(ang) * R)); pos = clampToWalls(m0, pos); return { pos, look: m0, fov: 42, focus: pos.distanceTo(m0), aperture: 0.012 }; });
  bark(['Mm. I was hoping you’d ask.', 'Don’t step on my feet. …Too late.', 'We are very bad at this. Don’t stop.'], 3);
  const moving = () => ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some((k) => keys.has(k)) || stick.on;
  await wait(1.2);
  hint(G.MOBILE ? 'Move to stop dancing.' : 'Move to stop dancing.', 3);
  while (G.simT - t0 < 40 && !moving() && G.Audio.radioOn()) await wait(0.1);
  STATE.hugging = false; STATE.hugIn = null; STATE.dancing = false; PARTNER.tiltTarget = 0; PLAYER.swayTarget = PARTNER.swayTarget = 0; STATE.busy = false;
  releaseCamera();
  return true;
}
G.dance = dance;

/* =====================================================================
 * Pause menu, volume, mute, camera motion
 * ===================================================================== */
function setPaused(on) {
  if (on === !!STATE.paused) return;
  G.REBIND = null;
  if (on && (!STATE.started || $('endcard').classList.contains('show'))) return;
  STATE.paused = on;
  $('pause').hidden = !on;
  keys.clear(); pressed.clear(); drag = null;
  stick.on = false; stick.x = stick.y = 0;
  G.Audio.hold(on);
  if (on) { syncPauseUI(); G.syncTest && G.syncTest(); $('pResume').focus(); } else { G.needsRender = true; }
}
function setView(v) { SETTINGS.view = v; saveSettings(); syncPauseUI(); CAM.cut = true; if (v === 'first') { CAM.fpPitch = 0.05; CAM.yaw = PLAYER.yaw + Math.PI; } hint(v === 'first' ? 'First person. V switches back.' : 'Third person. V for first person.', 3); }
G.setView = setView;
function setMuted(m) { SETTINGS.muted = m; saveSettings(); G.Audio.applyVolume(); syncPauseUI(); }
function syncPauseUI() {
  $('pVolume').value = Math.round(SETTINGS.volume * 100);
  $('pMute').setAttribute('aria-pressed', String(SETTINGS.muted));
  $('pMute').textContent = SETTINGS.muted ? 'Muted' : 'Mute';
  document.querySelectorAll('[data-motion]').forEach((b) => b.classList.toggle('on', b.dataset.motion === SETTINGS.motion));
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === SETTINGS.view));
  document.querySelectorAll('[data-subs]').forEach((b) => b.classList.toggle('on', b.dataset.subs === (SETTINGS.subs || 'm')));
  renderControls();
}
/* Controls: every rebindable action with its key. Click one, then press the new key (Esc cancels). */
const ACTION_NAMES = { forward: 'Walk forward', back: 'Walk back', left: 'Walk left', right: 'Walk right', run: 'Run', interact: 'Interact', together: 'Together', photo: 'Take a photo', view: 'First / third person' };
const RESERVED = ['Escape', 'KeyP', 'KeyM', 'Backquote', 'Enter', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'MetaLeft', 'MetaRight'];
function renderControls() {
  const box = $('pControls'); if (!box) return;
  box.innerHTML = Object.keys(KEY_DEFAULTS).map((a) => `<span>${ACTION_NAMES[a]}</span><button class="btn small" type="button" data-bind="${a}">${G.keyFor(a)}</button>`).join('');
  box.querySelectorAll('[data-bind]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.bind;
    box.querySelectorAll('.wait').forEach((x) => { x.classList.remove('wait'); });
    b.classList.add('wait'); b.textContent = 'Press a key…';
    G.REBIND = { action: a, done(code) {
      if (code && !RESERVED.includes(code) && !/^Digit/.test(code)) {
        // A key can only do one thing: whatever had it before takes this action's old key.
        const K = SETTINGS.keys, old = K[a];
        for (const o in K) if (o !== a && K[o] === code) K[o] = old;
        K[a] = code; saveSettings(); keys.clear();
      } else if (code) hint('That key is kept for something else.', 2.5);
      renderControls(); updateKeyHints();
    } };
  }));
}
function updateKeyHints() {
  const k = (a) => G.keyFor(a), mv = [k('forward'), k('left'), k('back'), k('right')].join('');
  const esc = (x) => String(x).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const chip = ([key, what]) => `<span class="k">${key ? `<kbd>${esc(key)}</kbd>` : ''}${esc(what)}</span>`;
  const t = $('titleKeys'); if (t) t.innerHTML = [[mv, 'walk'], [k('run'), 'run'], [null, 'Drag to look'], [k('interact'), 'use'], [k('together'), 'together'], [k('photo'), 'photo'], [k('view'), 'first person']].map(chip).join('');
  const pk = $('pKeys'); if (pk) pk.innerHTML = [['Esc', 'pause'], ['M', 'mute'], [mv, 'walk'], [k('run'), 'run'], [k('interact'), 'use'], [k('together'), 'together'], [k('photo'), 'photo'], [k('view'), 'first person']].map(chip).join('');
}
G.updateKeyHints = updateKeyHints;
G.setPaused = setPaused;
function initPauseUI() {
  $('pauseBtn').addEventListener('click', () => setPaused(true));
  $('pResume').addEventListener('click', () => setPaused(false));
  $('pause').addEventListener('pointerdown', (e) => { if (e.target === $('pause')) setPaused(false); });   // tap outside the panel
  $('pVolume').addEventListener('input', (e) => { SETTINGS.volume = e.target.value / 100; if (SETTINGS.volume > 0 && SETTINGS.muted) SETTINGS.muted = false; saveSettings(); G.Audio.applyVolume(); syncPauseUI(); });
  $('pMute').addEventListener('click', () => setMuted(!SETTINGS.muted));
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  document.querySelectorAll('[data-subs]').forEach((b) => b.addEventListener('click', () => { SETTINGS.subs = b.dataset.subs; saveSettings(); G.applySubs(); syncPauseUI(); }));
  if ($('pKeysReset')) $('pKeysReset').addEventListener('click', () => { SETTINGS.keys = Object.assign({}, KEY_DEFAULTS); saveSettings(); G.REBIND = null; renderControls(); updateKeyHints(); });
  updateKeyHints();
  document.querySelectorAll('[data-motion]').forEach((b) => b.addEventListener('click', () => { SETTINGS.motion = b.dataset.motion; G.MOTION = SETTINGS.motion === 'reduced' ? 0 : 1; saveSettings(); syncPauseUI(); }));
  // Leaving the tab pauses the game and its sound.
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
  syncPauseUI();
}

/* =====================================================================
 * Per-frame
 * ===================================================================== */
function nearest() {
  if (G.S && G.S.flags.noInteract) return null;
  let best = null, bd = 1e9;
  const fx = Math.sin(PLAYER.yaw), fz = Math.cos(PLAYER.yaw);
  for (const it of G.INTER) {
    const dx = it.pos[0] - PLAYER.x, dz = it.pos[2] - PLAYER.z, d = Math.hypot(dx, dz);
    if (d > it.r || (it.when && !it.when())) continue;
    if (it.y != null && Math.abs(it.y - PLAYER.y) > 1.2) continue;
    const s = d - ((dx * fx + dz * fz) / (d || 1)) * 0.4 - (it.prio || 0);
    if (s < bd) { bd = s; best = it; }
  }
  return best;
}
/* Small idle behaviours: warm hands at the fire, hug yourself in the cold, hands in pockets. */
const FIRE_AT = { x: 8.0, z: -1.8 };   // the fire itself (inside the hearth), so 'face the fire' points at it
function ambientPoses(dt) {
  for (const c of [PLAYER, PARTNER]) {
    const out = !G.inside(c.x, c.z) && !G.underRoof(c.x, c.z);
    c.idleT = c.speed < 0.15 ? (c.idleT || 0) + dt : 0;
    const toFire = Math.atan2(FIRE_AT.x - c.x, FIRE_AT.z - c.z);
    let facing = toFire - c.yaw; while (facing > Math.PI) facing -= 2 * Math.PI; while (facing < -Math.PI) facing += 2 * Math.PI;
    const nearFire = G.FIRE.on && G.inside(c.x, c.z) && Math.hypot(c.x - FIRE_AT.x, c.z - FIRE_AT.z) < 2.2;
    // Crossing the threshold: a shiver stepping out into the cold; a couple of stamps on the mat coming in from the snow.
    const inNow = G.inside(c.x, c.z) || G.underRoof(c.x, c.z);
    if (c._wasIn != null && !c.hidden && !c.lie && !c.script && !STATE.sceneShot) {
      if (c._wasIn && !inNow && !(c === PARTNER && PARTNER.mode === 'still')) { c.shiverT = 1.5; if (c === PLAYER || Math.hypot(c.x - PLAYER.x, c.z - PLAYER.z) < 6) G.breathe && G.breathe(c, 1.6); }
      if (!c._wasIn && inNow && (c.snowyT || 0) > 0) { c.stampT = 0.95; c.stampN = 0; }
    }
    c._wasIn = inNow;
    if (c.shiverT > 0) c.shiverT -= dt;
    if (c.stampT > 0) { c.stampT -= dt; const n = Math.floor((0.95 - c.stampT) / 0.32); if (n > (c.stampN || 0) && n <= 2) { c.stampN = n; const v = c === PLAYER ? 0.9 : clamp(1.2 - Math.hypot(c.x - PLAYER.x, c.z - PLAYER.z) * 0.25, 0, 0.7); if (v > 0.05) G.Audio.step('wood', v * 1.3); } }
    c.onIce = !G.inside(c.x, c.z) && G.surfaceAt && G.surfaceAt(c.x, c.z) === 'ice';
    let pose = null;
    if (c.carry && !c.lie && !STATE.hugging) pose = 'carry';
    else if (c.holdPose && !c.lie && !STATE.hugging) pose = c.holdPose;   // a book, a watering can: whatever she's busy with
    else if (STATE.hugging || (c.sit || 0) > 0.2 || c.script || c.lie || c.holdOn) pose = null;
    else if (c.shiverT > 0) pose = 'cold';   // just stepped out: arms in, shoulders up
    else if (nearFire && c === PARTNER && c.idleT > 1.2 && !busy()) pose = 'warm';   // not mid-conversation
    else if (nearFire && c === PLAYER && c.idleT > 2.5 && Math.abs(facing) < 1.0) pose = 'warm';
    else if (c === PLAYER && (c.cold || 0) > 0.6 && c.idleT > 1.2 && !c.holdOn) pose = 'cold';   // shivering
    else if (out && c.idleT > 1.5) {
      // Standing about outside: nobody holds one pose. Every so often they settle into another: arms wrapped
      // round themselves (more often the colder it is), hands in pockets, or just arms loose.
      c.moodT = (c.moodT == null ? Math.random() * 4 : c.moodT) - dt;
      if (c.moodT <= 0) {
        c.moodT = 6 + Math.random() * 9;
        const cold = c === PARTNER ? (STATE.tod > 0.35 ? 0.5 : 0.25) : 0.12 + clamp(c.cold || 0, 0, 1) * 0.6;
        const r = Math.random();
        c.mood = r < cold ? 'cold' : r < cold + 0.4 ? (c.dressed ? 'coatPockets' : 'pockets') : null;
      }
      pose = c.mood;
    }
    c.pose = pose;
  }
}
/* Partner talks a little on her own, rarely and only when nothing else is happening. */
const AMBIENT = { cd: 20, used: new Set(), runT: 0 };
const BARKS = [
  { id: 'nose', when: (o) => o.out && STATE.tod > 0.6 && o.idle > 5, text: 'Your nose has gone pink. It suits you. Please don’t fix it.' },
  { id: 'listen', when: (o) => o.out && o.idle > 9, text: 'Listen. You can hear the snow landing.' },
  { id: 'stars', when: (o) => o.out && STATE.tod > 0.8 && o.idle > 6, text: 'There are so many. Someone has rather overdone it.' },
  { id: 'run', when: (o) => o.out && AMBIENT.runT > 2.2, text: 'No running in the snow, {toHim}! …Very well. Wait for me.' },
  { id: 'fire', when: (o) => o.nearFire && o.idle > 6, text: 'I could stay here until spring, I think.' },
  { id: 'cake', when: (o) => STATE.cakeDone && o.inside && o.idle > 10, text: 'Would a second slice be too early? I say nothing is too early on a first snow.' },
  { id: 'cold', when: (o) => o.out && STATE.tod > 0.4 && o.idle > 14, text: 'My toes have formally resigned. Shall we go in soon?' },
];
function ambientBarks(dt) {
  const out = !G.inside(PLAYER.x, PLAYER.z) && !G.underRoof(PLAYER.x, PLAYER.z);
  AMBIENT.runT = PLAYER.speed > 2.4 ? AMBIENT.runT + dt : 0;
  AMBIENT.cd -= dt;
  if (AMBIENT.cd > 0 || busy() || PARTNER.bark || STATE.watchDoor || (PARTNER.sit || 0) > 0.2 || PARTNER.hidden || PARTNER.task || (G.S && G.S.flags.noBarks)) return;
  if (Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z) > 4.5) return;
  const o = { out, inside: G.inside(PLAYER.x, PLAYER.z), idle: PLAYER.idleT || 0, nearFire: PARTNER.pose === 'warm' };
  const b = BARKS.find((x) => !AMBIENT.used.has(x.id) && x.when(o));
  if (b) { AMBIENT.used.add(b.id); bark(b.text, 4); AMBIENT.cd = 28 + Math.random() * 20; }
}
/* Playing as Partner (chosen on the title screen): in free time the two swap bodies where they stand, so nothing moves
 * on screen, and you steer her while he follows. Scenes are told from his side, so a scene puts you back in his shoes
 * for its length, and the chapters that need a particular one (the night, Act IV as him; dawn and Elsewhere as her) decide. */
const FREE_CH = /^(morning|walk|evening|ending_)/;
G.canSwitch = () => STATE.started && !busy() && !PARTNER.script && !PLAYER.script && !PARTNER.lead && G.S && FREE_CH.test(G.S.chapter || '') && !PARTNER.hidden && !PARTNER.lie && !PLAYER.lie && (PARTNER.sit || 0) < 0.05 && (PLAYER.sit || 0) < 0.05 && !PARTNER.task && !PLAYER.carry && !STATE.dancing && !PLAYER.hugWith;
function swapPlaces() {
  for (const k of ['x', 'z', 'y', 'yFloor', 'yaw', 'speed', 'phase']) { const v = PLAYER[k]; PLAYER[k] = PARTNER[k]; PARTNER[k] = v; }
  const m = PLAYER.m; PLAYER.m = PARTNER.m; PARTNER.m = m;
  const st = PLAYER.scarfTail; PLAYER.scarfTail = PARTNER.scarfTail; PARTNER.scarfTail = st;
  const d = PLAYER.dressed; PLAYER.dressed = PARTNER.dressed; PARTNER.dressed = d;
  // Scripts stay with the role (the story's walkTo on PARTNER keeps going, now in the other body).
  for (const c of [PLAYER, PARTNER]) { c._hsp = null; c._ikOff = null; c.lookAt = null; c.nav = null; c._prevYaw = c.yaw; }
  G.setHold(false); if (!PARTNER.script) PARTNER.mode = 'follow';
  STATE.asHer = !STATE.asHer;
  CAM.yaw = PLAYER.yaw + Math.PI; CAM.cut = true;
}
G.switchPerspective = () => {
  if (STATE.asHer) { swapPlaces(); hint('You again.', 2); return; }
  if (!G.canSwitch()) { hint('Not right now.', 1.6); return; }
  swapPlaces(); hint('Playing as her. Tab to switch back.', 3);
};
G.unswitch = () => { if (STATE.asHer) swapPlaces(); };
// Using something around the house as her is hers to do: no hand-back, her side of the narration, and the
// conversation lines written for his version of the moment are skipped.
const inInter = () => !!(G.S && G.S.inInter);
// A scene must start with him back in his own body *before* it places anyone, or the two would trade the spots the
// scene just gave them. So: going busy, speaking, cutting to a shot or offering a choice all hand control back first.
{
  let _busy = STATE.busy;
  Object.defineProperty(STATE, 'busy', { get: () => _busy, set: (v) => { if (v && STATE.asHer && !inInter()) swapPlaces(); _busy = v; }, configurable: true });
  const guard = (name) => { const f = G[name]; G[name] = function (...a) { if (STATE.asHer && !inInter()) swapPlaces(); return f.apply(this, a); }; };
  ['say', 'cutTo', 'setShot'].forEach(guard);   // (not the placement helpers: the follow AI uses those every frame)
  (G.afterBuild = G.afterBuild || []).push(() => { const ch = G.UI.choose; G.UI.choose = (o) => { if (STATE.asHer && !inInter()) swapPlaces(); return ch(o); }; });
}
function step(dt, t) {
  // A scene starting (or a chapter that isn't free time) puts you back as him; free time again, back to her.
  if (STATE.asHer && ((busy() && !inInter()) || !G.S || !FREE_CH.test(G.S.chapter || '') || PLAYER.lie || PARTNER.lie)) swapPlaces();
  else if (!STATE.asHer && SETTINGS.playAs === 'partner' && !(G.NIGHT && G.NIGHT.swapped) && G.canSwitch() && (PARTNER.mode === 'follow' || PARTNER.mode === 'still') && Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z) < 6) swapPlaces();
  updateDialogue(dt);
  let ix = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  let iy = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
  if (stick.on) { ix = stick.x; iy = stick.y; }
  // Sitting down somewhere of your own accord: any move stands you back up.
  if (PLAYER.freeSit && !busy() && Math.hypot(ix, iy) > 0.3 && !PLAYER.rise) { PLAYER.rise = { from: { x: PLAYER.x, z: PLAYER.z }, to: PLAYER.freeSit, t: 0 }; PLAYER.sitTarget = 0; PLAYER.freeSit = null; }
  if (PLAYER.rise) {
    const R = PLAYER.rise; R.t += dt; const k = G.smooth(0, 0.55, R.t);
    PLAYER.x = lerp(R.from.x, R.to.x, k); PLAYER.z = lerp(R.from.z, R.to.z, k); PLAYER.yFloor = G.floorAt(PLAYER.x, PLAYER.z);
    if (R.t > 0.6) PLAYER.rise = null;   // (you stood up by walking off, so you face where you're going, not back the way you came in)
  }
  // Lying in bed: a push on the stick or the keys gets you up, if the story has a way to.
  if (PLAYER.lie && !busy() && Math.hypot(ix, iy) > 0.4 && G.lieMove) G.lieMove();
  // In conversation you can keep walking. In a staged cutscene you stay put, but can always look around
  // (drag, or Z / C); a hug, a dance or a game holds you too.
  const staged = STATE.sceneShot || STATE.lockMove || STATE.kiss || PLAYER.hugWith || STATE.dancing || (G.UI && (G.UI.modal === 'minigame' || G.UI.modal === 'scrapbook')) || (G.UI && G.UI.blocking() && G.UI.modal !== 'choices');
  const free = (!busy() || (STATE.started && !staged)) && !PLAYER.script && (PLAYER.sit || 0) < 0.05 && !PLAYER.rise && !PLAYER.lie && !STATE.noControl;
  if (!free) ix = iy = 0;
  if (Math.hypot(ix, iy) > 0.3 && busy()) CAM.lastMove = G.simT;
  // Walking off mid-conversation: the camera that cut in for it hands itself back straight away.
  if (free && Math.hypot(ix, iy) > 0.3 && DLG.autoShot && !STATE.sceneShot) { DLG.autoShot = false; releaseCamera(); }
  const l = Math.hypot(ix, iy);
  if (PLAYER.script) {
    const s = PLAYER.script;
    s.t = (s.t || 0) + dt;
    if (steer(PLAYER, s.x, s.z, s.speed || 1.2, dt, 0.08) || s.t > 20) { PLAYER.script = null; s.res && s.res(); }
  } else {
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight') || (stick.on && l > 0.95);
    const target = l > 0.05 ? (run ? 3.1 : 1.5) * Math.min(1, l) * (PLAYER.speedMul || 1) : 0;   // deep snow and armfuls of logs slow you down
    // Speeding up and slowing down like a body with weight: a spring, not an instant jump in pace.
    G.spring(PLAYER, 'speed', target, target > PLAYER.speed ? 8 : 9, dt); if (PLAYER.speed < 0.005) PLAYER.speed = 0;
    const fp = SETTINGS.view === 'first' && !CAM.shot;
    if (l > 0.05) {
      const cy = Math.cos(CAM.yaw), sy = Math.sin(CAM.yaw);
      const moveYaw = Math.atan2(ix * cy + iy * sy, -ix * sy + iy * cy);
      PLAYER.yaw = fp ? CAM.yaw + Math.PI : angDamp(PLAYER.yaw, moveYaw, 9, dt);
      PLAYER.moveYaw = moveYaw;
    } else if (fp && (PLAYER.sit || 0) < 0.1) PLAYER.yaw = angDamp(PLAYER.yaw, CAM.yaw + Math.PI, 12, dt);
    // On the touch screen in first person, the right half of the screen looks around (drag) as before.
    { const my = fp && PLAYER.moveYaw != null ? PLAYER.moveYaw : PLAYER.yaw; if (PLAYER.speed > 0.01) moveChar(PLAYER, Math.sin(my) * PLAYER.speed * dt, Math.cos(my) * PLAYER.speed * dt); }
  }
  partnerAI(dt, t);
  // The front door swings open for whoever comes near and closes behind them.
  const FD = G.FRONT_DOOR;
  if (FD) {
    const dd = Math.min(Math.hypot(PLAYER.x - FD.x, PLAYER.z - FD.z), PARTNER.hidden ? 99 : Math.hypot(PARTNER.x - FD.x, PARTNER.z - FD.z));
    const want = dd < 1.6 ? 1 : 0;
    if (want !== FD.want) { FD.want = want; if (want && FD.amt < 0.3) G.Audio.door(true); }
    const prev = FD.amt; FD.amt = damp(FD.amt, want, want ? 4 : 2.4, dt);
    if (!want && prev > 0.05 && FD.amt <= 0.05) { FD.amt = 0; G.Audio.door(false); }
    FD.leaf.rotation.y = FD.openAngle * FD.amt; STATE.doorOpen = FD.amt > 0.3;
  }
  // Music: she sways a little when the radio's on and she's standing about nearby.
  if (G.Audio.radioOn && !STATE.dancing) {
    const hearRadio = G.Audio.radioOn() && G.inside(PARTNER.x, PARTNER.z) && PARTNER.x > 5;
    PARTNER.swayTarget = hearRadio && PARTNER.speed < 0.15 && !(PARTNER.sit > 0.2) && (!PARTNER.task || PARTNER.task.o.sway) && !PARTNER.lie ? 0.55 : 0;
    PLAYER.swayTarget = 0;
  }
  G.Audio.humAt(G.headPos(PARTNER));
  // When things are going well, now and then she reaches for you first.
  if (G.S && STATE.started && G.S.chapter !== 'prologue' && PARTNER.mode === 'follow' && !busy() && !PARTNER.task && !PARTNER.lead && !PARTNER.hidden && !PARTNER.lie && !(PARTNER.sit > 0.2) && !(PLAYER.sit > 0.2)) {
    PARTNER.initT = (PARTNER.initT == null ? 45 : PARTNER.initT) - dt;
    const dP = Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
    if (PARTNER.initT < 0 && dP < 2.4) {
      PARTNER.initT = 55 + Math.random() * 55;
      if (G.S.vars.bond >= 2 || G.S.mem.affection >= 3) {
        const r = Math.random();
        if (r < 0.4) { G.Audio.tap(); bark('*tap tap*', 1.2); wait(1.1).then(() => { if (!busy()) bark(['Hello. I only wanted to say hello.', 'Still here? Good.', 'You look thoughtful, {toHim}.', 'Just checking you’re real.']); }); }
        else if (r < 0.75 && !PARTNER.hold) { G.setHold(true); PARTNER.holdTimer = 18 + Math.random() * 14; bark(['*takes your hand*', 'Hand, please.', 'I’ll have this, thank you.']); G.S.mem.partnerInit = (G.S.mem.partnerInit || 0) + 1; }
        else bark(['*rests her head on your shoulder for a moment*', '*bumps your arm with hers*'], 2.4);
      }
    }
  }
  if (PARTNER.holdTimer != null && PARTNER.hold) { PARTNER.holdTimer -= dt; if (PARTNER.holdTimer <= 0) { G.setHold(false); bark(['*lets go, reluctantly*', 'Free range again.'], 1.8); } }
  if (STATE.hugIn) {
    const H = STATE.hugIn, kk = 1 - Math.exp(-8 * dt);
    for (const [c, p, y] of [[PLAYER, H.p, H.yaw], [PARTNER, H.q, H.yaw + Math.PI]]) { moveChar(c, (p[0] - c.x) * kk, (p[1] - c.z) * kk); c.yaw = angDamp(c.yaw, y, 10, dt); c.speed = 0; }
  }
  // Personal space: she eases out of you rather than overlapping, except when you're hugging or seated together.
  if (!STATE.hugging && !STATE.hugIn && (PARTNER.sit || 0) < 0.2 && (PLAYER.sit || 0) < 0.2 && !PARTNER.hold && !PARTNER.lie && !PLAYER.lie && !PARTNER.hidden) {
    const dx = PARTNER.x - PLAYER.x, dz = PARTNER.z - PLAYER.z, d = Math.hypot(dx, dz), min = 0.5;
    if (d < min) { const push = (min - d) * Math.min(1, dt * 8), ux = d > 1e-3 ? dx / d : 1, uz = d > 1e-3 ? dz / d : 0; moveChar(PARTNER, ux * push, uz * push); }
  }
  ambientPoses(dt);
  for (const c of [PLAYER, PARTNER]) {
    // A short eased move (sliding into a seat, stepping out of one) instead of a pop.
    if (c.slide) {
      const S = c.slide; S.t += dt; const k = G.smooth(0, S.dur, S.t);
      c.x = lerp(S.from.x, S.x, k); c.z = lerp(S.from.z, S.z, k); c.yFloor = G.floorAt(c.x, c.z); c.speed = 0;
      if (S.yaw != null) c.yaw = angDamp(c.yaw, S.yaw, 8, dt);
      if (S.t >= S.dur) { c.slide = null; if (S.yaw != null) c.yaw = S.yaw; S.res && S.res(); }
    }
    if (c.snowyT > 0) c.snowyT -= dt * (G.onDeck(c.x, c.z) ? 1 : 0);
    c.y = c.lie ? c.lieY : damp(c.y, c.yFloor != null ? c.yFloor : G.floorAt(c.x, c.z), 14, dt);
    // Sitting and standing take about a second, eased in and out (lowering is a touch slower than rising).
    { const tg = c.sitTarget || 0, s0 = c.sit || 0;
      if (Math.abs(tg - s0) < 0.002) c.sit = tg;
      else { let u0 = c._sitU != null && Math.abs(G.smooth01(c._sitU) - s0) < 0.02 ? c._sitU : G.unsmooth01(s0);
        u0 += Math.sign(tg - s0) * dt / (tg > s0 ? 0.95 : 0.85); u0 = Math.max(0, Math.min(1, u0));
        c._sitU = u0; c.sit = G.smooth01(u0); if ((tg > s0 && c.sit > tg) || (tg < s0 && c.sit < tg)) c.sit = tg; } }
    c.tilt = damp(c.tilt || 0, c.tiltTarget || 0, 3, dt);
    c.lean = damp(c.lean || 0, c.leanTarget || 0, 3, dt);
    G.spring(c, 'hug', STATE.hugging ? (STATE.dancing ? 0.62 : STATE.hugIn && STATE.kiss ? 0.55 : 1) : 0, 8, dt); c.hug = Math.max(0, Math.min(1, c.hug));
    G.animate(c, dt, t);
    // Footsteps: sound and (on snow) a footprint at each heel strike.
    if (c.stepEvent) {
      const e = c.stepEvent; c.stepEvent = null;
      const deck = G.onDeck(e.x, e.z);
      const surf = G.surfaceAt(e.x, e.z);
      const vol = c === PLAYER ? 1 : clamp(1.3 - Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z) * 0.25, 0, 0.7);
      if (vol > 0.02) G.Audio.step(surf, vol * clamp(c.speed / 1.5, 0.5, 1.4));
      if (!deck && surf !== 'ice' && G.addFootprint) G.addFootprint(e.x, e.z, e.yaw, e.leg, c === PLAYER ? 1.05 : 0.9);
      // Walking briskly through fresh snow kicks a little powder off the toes.
      if (!deck && surf !== 'ice' && surf !== 'rug' && !G.inside(e.x, e.z) && c.speed > 0.7 && G.kickAt && Math.random() < 0.75) G.kickAt(e.x, G.floorAt(e.x, e.z), e.z, e.yaw, clamp((c.speed - 0.5) / 2, 0.3, 1.2));
      // Boots that were in the snow leave wet prints on the boards for a while after you come in.
      if (!deck) c.snowyT = surf === 'ice' ? Math.max(c.snowyT || 0, 10) : 30; else if (c.snowyT > 0 && surf !== 'rug' && G.addWetPrint) G.addWetPrint(e.x, e.z, e.yaw, e.leg, c === PLAYER ? 1.05 : 0.9, c.snowyT / 30);
    }
    // Breath shows on each exhale whenever you're out in the cold.
    const cyc = Math.floor((c.breath || 0) / (2 * Math.PI));
    if (cyc !== c._cyc) { c._cyc = cyc; if (!G.inside(c.x, c.z) && !(G.noBreath && G.noBreath(c))) G.breathe(c, (c.speed > 2 ? 1.3 : 1) * (1 + (c.cold || 0) * 0.7)); }   // colder, heavier
  }
  PLAYER.lookAt = PLAYER.lookFix || (Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z) < 3 && !PARTNER.hidden ? head(PARTNER) : null);   // lookFix: a scene wants you looking at something
  // Nobody walks around with their eyes shut: whatever closed them (sleep, a hug, a scene), walking opens them.
  for (const c of [PLAYER, PARTNER]) if (c.lidsClosed && !c.lie && !STATE.hugging && !STATE.sceneShot && (c.speed || 0) > 0.4) c.lidsClosed = false;
  // Interaction prompt
  // While a line is on screen E advances it, so no prompts then (you can still walk).
  const it = free && !DLG.cur ? nearest() : null;
  // You look at what you're about to use; she glances at whatever you're doing.
  if (it) PLAYER.lookAt = { x: it.pos[0], z: it.pos[2], headY: it.pos[1] };
  if (PARTNER.gaze) { PARTNER.gaze.t -= dt; if (PARTNER.gaze.t > 0 && !PARTNER.lie && !PARTNER.hidden) PARTNER.lookAt = PARTNER.gaze; else PARTNER.gaze = null; }
  // Outside near the cabin, now and then a clump of snow slides off the eaves.
  if (!G.inside(PLAYER.x, PLAYER.z)) { STATE.puffT = (STATE.puffT == null ? 15 : STATE.puffT) - dt; if (STATE.puffT < 0) { STATE.puffT = 18 + Math.random() * 30; if (G.snowPuff && G.snowPuff(PLAYER)) G.Audio.flump(); } }
  const together = !!(G.Story && G.Story.together);
  const sittingFree = !!PLAYER.freeSit && !busy() && !PLAYER.rise;
  const ph = PARTNER.lie ? G.headPos(PARTNER) : PARTNER;   // in bed, talk to her face, not her feet
  const nearP = (free || (sittingFree && together)) && !DLG.cur && !PARTNER.hidden && (!PARTNER.lie || together) && !PARTNER.script && Math.hypot(ph.x - PLAYER.x, ph.z - PLAYER.z) < (PARTNER.hold ? 1.8 : PARTNER.lie ? 1.5 : 1.4) && (together ? (!G.S || !G.S.flags.noTogether) : PARTNER.sit < 0.2);
  let html = '';
  const lab = it ? G.fmt(typeof it.label === 'function' ? it.label() : it.label) : '';
  if (it && lab) html += `<span class="key">${G.MOBILE ? 'Use' : G.keyFor('interact')}</span>${lab}`;
  if (nearP) html += `${html ? '<span class="sep"></span>' : ''}<span class="key">${G.MOBILE ? '♥' : G.keyFor('together')}</span>${together ? 'Together' : 'Hug'}`;
  const pr = $('prompt'); if (pr._h !== html) { pr._h = html; pr.innerHTML = html; pr.classList.toggle('hidden', !html); }
  if (it && lab && hit('KeyE', 'Space', 'Enter')) { pressed.clear(); G.startReach && G.startReach(PLAYER, it); it.act(); }
  else if (nearP && hit('KeyQ', 'KeyF')) { pressed.clear(); if (together) G.Story.together(); else hug(); }
  if (hit('KeyN')) G.cycleTime();
  if (STATE.watchDoor && G.inside(PLAYER.x, PLAYER.z)) { STATE.watchDoor = false; bark('Close your eyes. …No, open them. Look at the table.', 4); }
  if (STATE.watchDoor && PLAYER.z < 8.5 && !STATE.porchBark) { STATE.porchBark = true; bark('Inside, please. I can no longer feel my nose.', 3); }
  ambientBarks(dt);
  for (const f of G.STEP_HOOKS) f(dt, t, free);
}
G.STEP_HOOKS = [];
function bubble(dt) {
  const el = $('bubble'), c = PARTNER;
  if (!c.bark || !STATE.started) { el.classList.remove('show'); return; }
  const v = G.headPos(c).add(new THREE.Vector3(0, 0.3, 0)).project(G.camera);
  if (v.z > 1) { el.classList.remove('show'); return; }
  if (el.textContent !== c.bark.text) el.textContent = c.bark.text;   // avoid re-laying out the bubble every frame
  const bx = G.clamp((v.x + 1) / 2 * innerWidth, 130, innerWidth - 130), by = G.clamp((1 - v.y) / 2 * innerHeight, 110, innerHeight - 40);   // keep it on screen, clear of the HUD
  el.style.transform = `translate(${bx.toFixed(1)}px, ${by.toFixed(1)}px) translate(-50%, -100%)`;
  el.classList.add('show');
}

/* ---------- title: establishing crane shot ---------- */
function titleShot(t) {
  const k = (t * 0.025) % 1, e = 0.5 - Math.cos(k * Math.PI * 2) * 0.5;
  const pos = new THREE.Vector3(lerp(3.5, 8.5, e), lerp(5.2, 2.0, e), lerp(30, 21, e));
  const look = new THREE.Vector3(6.5, lerp(3.0, 2.2, e), 2);
  return { pos, look, fov: 40, focus: 22, aperture: 0.0008 };
}

/* ---------- stats ---------- */
let fpsAcc = 0, fpsN = 0, fps = 60, lowT = 0;
function toggleStats() { const s = $('stats'); s.hidden = !s.hidden; }
function stats() {
  const s = $('stats');
  if (!s.hidden) { const i = G.renderer.info.render; s.textContent = `${fps.toFixed(0)} FPS  ${(1000 / Math.max(1, fps)).toFixed(1)} ms\nDraw calls ${i.calls}   Tris ${(i.triangles / 1000).toFixed(0)}k\nBuild ${G.BUILD}  Quality ${G.qName}  DOF ${G.Q.dof ? 'on' : 'off'}  AO ${G.Q.ssao ? 'on' : 'off'}\nBodies ${G.CHAR_STATUS ? (G.CHAR_STATUS.player || '?') + ' / ' + (G.CHAR_STATUS.partner || '?') : '?'}${G.diag ? G.diag() : ''}`; }
  if (STATE.started && fps < 24) { lowT += 0.5; if (lowT > 5 && G.qName !== 'Low') { G.qName = G.qName === 'Epic' ? 'High' : 'Low'; G.applyQuality(); hint('Quality lowered to ' + G.qName + ' for smoother play.', 4); lowT = 0; } } else lowT = 0;
}

/* ---------- loop ---------- */
let last = performance.now();
G.TICKERS = new Set();   // per-frame callbacks on the game clock (UI widgets)
G.simT = 0;   // game clock: sum of (capped) frame steps, so everything pauses together with the tab
function simulate(dt) {
  G.simT += dt;
  const t = G.simT;
  tickTimers(dt);
  G.TICKERS.forEach((f) => f(dt));
  if (STATE.started) step(dt, t);
  else { for (const c of [PLAYER, PARTNER]) G.animate(c, dt, t); CAM.shot = titleShot; }
  updateCamera(dt, t);
  const focus = STATE.started ? new THREE.Vector3(PLAYER.x, PLAYER.y + 1, PLAYER.z) : new THREE.Vector3(6.5, 1, 8);
  updateLighting(t, dt, focus);
  updateWind(dt);
  if (SNOW) { const U = SNOW.material.uniforms; U.uTime.value = t; U.uDrift.value = WIND.drift; U.uGust.value = WIND.gust; U.uCenter.value.copy(G.camera.position); U.uLight.value.copy(SNOW_DAY).lerp(SNOW_NIGHT, STATE.tod).lerp(SNOW_NOON, STATE.day); SNOW.geometry.setDrawRange(0, Math.round(G.Q.snow * clamp(STATE.snow, 0, 1))); }
  updateSmoke(dt);
  G.updateFX(dt, t);
  grade.uniforms.uTime.value = t;
  pressed.clear();
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; stats(); }
  if (STATE.paused) {
    // Hold the last frame; only redraw it if the window changed size.
    if (G.needsRender) { G.needsRender = false; composer.render(0); }
    return;
  }
  // Input pressed this frame must survive until simulate() reads it.
  simulate(dt);
  composer.render(dt);
  if (G.onFrameEnd) { const f = G.onFrameEnd; G.onFrameEnd = null; try { f(); } catch (e) { console.error(e); } }   // read the canvas in the same task it was drawn
  bubble(dt);
}

/* ---------- shader warm-up ----------
 * Compile every material behind the loading screen, including things that are hidden now but
 * appear later (the cuddle blanket, breath puffs) and the depth-of-field pass used in cutscenes,
 * so nothing stalls the first time it comes into view. */
function warmUp() {
  const t0 = performance.now(), R = G.renderer, before = R.info.programs.length;
  const inChar = (o) => { for (let p = o; p; p = p.parent) if (p === PLAYER.m || p === PARTNER.m) return true; return false; };
  const later = [];
  // Hidden things inside the characters are normally skipped (some never show), except gear flagged to warm.
  const warmIn = (o) => { for (let p = o; p; p = p.parent) if (p.userData && p.userData.warm) return true; return false; };
  const hiddenUp = (o) => { const r = []; for (let p = o; p && p !== G.scene; p = p.parent) if (p.visible === false) r.push(p); return r; };
  G.scene.traverse((o) => { if ((o.isMesh || o.isSprite || o.isPoints) && (inChar(o) ? warmIn(o) : true)) { const h = hiddenUp(o); if (h.length && (!inChar(o) || warmIn(o))) later.push(...h); } });
  later.forEach((o) => { o.visible = true; });
  // One frame drawn with culling off compiles exactly what can appear (renderer.compile() in this
  // three.js version would also compile materials on hidden objects that never show).
  const culled = [];
  G.scene.traverse((o) => { if (o.frustumCulled && (o.isMesh || o.isPoints || o.isSprite)) { culled.push(o); o.frustumCulled = false; } });
  const bokehWas = bokeh.enabled;
  bokeh.enabled = G.Q.dof;
  // A tiny frame: shaders compile the same at any size, and the GPU barely has to draw anything.
  G.renderer.setPixelRatio(1); G.renderer.setSize(64, 36, false); composer.setPixelRatio(1); composer.setSize(64, 36);
  composer.render(0);          // scene, shadow, depth-of-field and post-processing shaders
  resize();
  bokeh.enabled = bokehWas;
  culled.forEach((o) => { o.frustumCulled = true; });
  later.forEach((o) => { o.visible = false; });
  G.BOOT_MS.warmup = Math.round(performance.now() - t0);
  G.BOOT_MS.programs = [before, R.info.programs.length];
}

/* ---------- the prologue's children ---------- */
function kidDress(root, hatCol, scarfCol, bootCol) {
  const u = root.userData, k = u.k;
  const knit = G.std({ map: G.rep(G.TX.knitCream, 2, 1), color: hatCol, bumpMap: G.TX.knitB, bumpScale: 0.004, roughness: 1 });
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.094 * k, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), knit);
  hat.position.set(0, 0.035 * k, -0.008 * k); hat.scale.set(1.04, 1.12, 1.07); hat.castShadow = true; u.head.add(hat);
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.088 * k, 0.014 * k, 8, 28), knit); brim.rotation.x = Math.PI / 2 + 0.12; brim.position.set(0, 0.045 * k, -0.004 * k); brim.scale.set(1.04, 1.1, 1); u.head.add(brim);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.03 * k, 12, 8), knit); pom.position.set(0, 0.145 * k, -0.02 * k); u.head.add(pom);
  // Kept when a realistic body replaces the procedural one (people.js), and fitted to it (life.js, fitKid).
  // Wellies.
  u.kidBoots = [];
  if (bootCol) {
    const bm = G.std({ color: bootCol, roughness: 0.45, env: 0.5 }), sole = G.shared({ color: '#221c18', roughness: 0.9 });
    const fl = 0.152 * 1.75, ank = 0.039 * 1.75;
    const put = (m, parent, x, y, z) => { m.position.set(x * k, y * k, z * k); m.castShadow = true; parent.add(m); u.kidBoots.push(m); return m; };
    u.legs.forEach((lg) => {
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.047 * k, 0.05 * k, 0.2 * k, 16), bm), lg.ft, 0, 0.05, -0.004);
      put(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), bm), lg.ft, 0, -ank + 0.034, fl * 0.5 - 0.058).scale.set(0.052 * k, 0.041 * k, fl * 0.53 * k);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.098 * k, 0.022 * k, fl * 1.06 * k), sole), lg.ft, 0, -ank + 0.008, fl * 0.5 - 0.058);
    });
  }
  u.kidHat = [hat, brim, pom]; u.kidScarf = [];
  if (scarfCol) {
    const sm = G.std({ map: G.rep(G.TX.knitCream, 3, 1), color: scarfCol, bumpMap: G.TX.knitB, bumpScale: 0.004, roughness: 1 });
    const sc = new THREE.Mesh(new THREE.TorusGeometry(0.068 * k, 0.03 * k, 10, 24), sm); sc.rotation.x = Math.PI / 2 - 0.1; sc.position.set(0, 0.14 * k, 0.005 * k); sc.scale.set(1, 1.15, 0.9); u.chest.add(sc);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06 * k, 0.2 * k, 0.025 * k), sm); tail.position.set(0.04 * k, 0.04 * k, 0.1 * k); tail.rotation.set(0.12, 0, 0.1); u.chest.add(tail);
    u.kidScarf = [sc, tail];
    u.kidScarf.forEach((o) => { o.userData.base = [o.position.x / k, o.position.y / k, o.position.z / k]; o.userData.baseScale = o.scale.clone(); o.userData.k0 = k; });
  }
  u.kidHat.concat(u.kidScarf, u.kidBoots).forEach((o) => { o.userData.gear = true; o.castShadow = true; });
}
G.useKids = (on) => {
  const K = G.KIDS;
  for (const [c, kid, adult] of [[PLAYER, K.player, K.adults.player], [PARTNER, K.partner, K.adults.partner]]) {
    const m = on ? kid : adult; (on ? adult : kid).visible = false; m.visible = true; c.m = m;
  }
  // Children's proportions: a bigger head. Scaled after the body is attached so the rig carries it to the mesh.
  K.player.userData.head.scale.setScalar(1.32); K.partner.userData.head.scale.setScalar(1.36);
  K.player.scale.set(1.1, 1, 1.1); K.partner.scale.set(1.1, 1, 1.1);   // sturdier, rounder
};

/* ---------- boot ---------- */
function boot() {
  const tTex = performance.now(); G.buildTextures(); G.buildMaterials(); G.applyTextureSets(); const texMs = Math.round(performance.now() - tTex);
  const T = (G.BOOT_MS = {}), mark = (k, f) => { const t0 = performance.now(); f(); T[k] = Math.round(performance.now() - t0); };
  mark('sky', G.buildSky); mark('terrain', G.buildTerrain); mark('mountains', G.buildMountains); mark('forest', G.buildForest);
  mark('path', G.buildPath); mark('cabin', G.buildCabin); mark('interior', G.buildInterior); mark('fx', G.buildFX);
  mark('batch', () => { G.BATCH = G.mergeStatic(G.world); });
  T.textures = texMs;
  SNOW = snowSystem(4500); smokeSystem();
  PLAYER.m = G.makeHuman({ height: 1.84, skin: '#d9ab8e', outfit: 'hoodie', top: '#3f4146', legs: '#25272c', hair: '#1e140f', hairStyle: 'shaggy', socks: '#2f2b28', seed: 11 });
  PARTNER.m = G.makeHuman({ height: 1.6, fem: true, skin: '#e8bfa4', outfit: 'sweater', legs: '#2c2626', hair: '#5e3a26', hairStyle: 'bun', socks: '#e6dccd', eyes: '#4a3020', lips: '#c47a70', seed: 23 });
  placeChar(PLAYER, G.pathX(27) + 0.35, 27, Math.PI); placeChar(PARTNER, G.pathX(27) - 0.45, 26.6, Math.PI);
  PLAYER.hugPose = [-0.95, 0.25, -1.3, -0.7];   // he's taller: arms around her back rather than over her head
  // The two of them as children, for the prologue: bigger heads, bobble hats, one red scarf.
  const KIDS = (G.KIDS = {
    player: G.makeHuman({ height: 1.14, skin: '#dcae90', outfit: 'hoodie', top: '#34506e', legs: '#2a2c33', hair: '#1e140f', hairStyle: 'shaggy', socks: '#3a3a40', seed: 12 }),
    partner: G.makeHuman({ height: 1.04, fem: true, skin: '#eac2a8', outfit: 'hoodie', top: '#c08a3e', legs: '#3a2e2a', hair: '#5e3a26', hairStyle: 'bun', socks: '#e6dccd', eyes: '#4a3020', lips: '#c98078', seed: 24 }),
  });
  kidDress(KIDS.player, '#3e5f8a', '#b8322a', '#2d4a66'); kidDress(KIDS.partner, '#e9e2d4', null, '#b5413a');
  KIDS.player.visible = KIDS.partner.visible = false;
  KIDS.adults = { player: PLAYER.m, partner: PARTNER.m };
  buildNav();
  // The loading screen waits for the two of them; the children (only in the prologue) finish loading behind the title.
  const bodies = Promise.all([G.attachBlenderBody(PLAYER.m, 'player'), G.attachBlenderBody(PARTNER.m, 'partner')]);
  G.kidsReady = bodies.then(() => Promise.all([G.attachBlenderBody(KIDS.player, 'player', { kid: true }), G.attachBlenderBody(KIDS.partner, 'partner', { kid: true })])).then(() => { (G.onKids || []).forEach((f) => { try { f(); } catch (e) { console.error('[onKids]', e); } }); });
  buildPost();
  document.querySelectorAll('#quality button').forEach((b) => b.addEventListener('click', () => { G.qName = b.dataset.q; G.applyQuality(); }));
  $('timeBtn').addEventListener('click', () => G.cycleTime());
  $('statsBtn').addEventListener('click', toggleStats);
  $('endClose').addEventListener('click', () => Story.closeEnd());
  if ($('endMore')) $('endMore').addEventListener('click', () => G.jumpTo('firstsnow'));
  initPauseUI();
  (G.afterBuild || []).forEach((f) => { try { f(); } catch (e) { console.error('[afterBuild]', e); } });
  G.applyQuality();
  CAM.shot = titleShot; CAM.cut = true;
  // Keep the loading screen up until the character bodies are in (with a safety timeout).
  Promise.race([bodies, new Promise((r) => setTimeout(r, 8000))]).then(() => {
    (G.onBodies || []).forEach((f) => { try { f(); } catch (e) { console.error('[onBodies]', e); } });   // e.g. fit the outdoor clothes to a realistic body
    try { warmUp(); } catch (e) { console.warn('warm-up skipped', e); }
    G.BOOT_MS.total = Math.round(performance.now());
    $('loading').classList.add('done');
  });
  const start = async (fromSave) => {
    if (STATE.started || $('begin').disabled) return;
    $('begin').disabled = true; if ($('continue')) $('continue').disabled = true;
    G.Audio.start();
    // Dip to black under the title, let the title dissolve, then open the first scene behind the fade.
    $('fade').classList.add('on');
    await wait(0.7);
    $('title').classList.add('hide');
    STATE.started = true;
    document.body.classList.add('playing');
    if (G.Story.begin) G.Story.begin(fromSave); else { Story.intro(); await wait(0.9); $('fade').classList.remove('on'); }
  };
  // Jumping to a chapter (testing, or replaying a part): from the title or the pause menu. Whatever scene was running
  // is left hanging where it was (its next line never comes), the screen is cleared, and the chapter starts fresh.
  G.CHAPTERS = [['prologue', 'Prologue · The winter fair'], ['morning', 'Act I · Morning'], ['walk', 'Act I · The walk'], ['evening', 'Act II · Evening'], ['bedtime', 'Act III · Bedtime'], ['night', 'Act III · The night'], ['elsewhere', 'Act III · Elsewhere (as her)'], ['lastbirthday', 'Act IV · The same day'], ['act4_home', 'Act IV · Together, on the way home'], ['ending_foundme', 'Ending · You Found Me'], ['ending_uncertain', 'Ending · Uncertain Morning'], ['ending_iknow', 'Ending · I Know It’s You'], ['ending_perfect', 'Ending · The Perfect Partner'], ['ending_stay', 'Ending · Stay Here'], ['ending_replaced', 'Ending · Replaced'], ['firstsnow', 'Ending · The First Snow']];
  G.jumpTo = async (id) => {
    if (!G.CH || !G.CH[id]) return;
    setPaused(false);
    $('fade').classList.add('on'); $('fade').style.background = '#000';
    await wait(0.6);
    if (!STATE.started) { $('title').classList.add('hide'); STATE.started = true; document.body.classList.add('playing'); $('begin').disabled = true; G.Audio.start(); }
    DLG.q.length = 0; DLG.cur = null; $('subs').className = ''; document.body.classList.remove('talking');
    G.UI.reset && G.UI.reset();
    $('endcard').classList.remove('show'); document.body.classList.remove('ending');
    STATE.nightDone = false; STATE.ending = null; STATE.paused = false; STATE.watchDoor = false;
    G.unswitch();
    PLAYER.script = PARTNER.script = null;
    if (G.NIGHT && G.NIGHT.swapped && G.swapBodies) G.swapBodies();
    G.setHold && G.setHold(false);
    releaseCamera(); CAM.cut = true;
    G.post.grade.uniforms.uMem.value = 0; STATE.fog = null; if (G.WEATHER) G.WEATHER.hold = null; STATE.snowStill = false; STATE.hush = false;
    (G.onJump || []).forEach((f) => { try { f(); } catch (e) { console.error('[jump]', e); } });
    const S = G.S; if (S && !S.flags.sign) S.flags.sign = 'pinecones';
    G.go(id);
    await wait(0.4);
    // The chapter fades itself in; if it doesn't within a few seconds, lift the fade anyway.
    wait(4).then(() => { if (!document.getElementById('card').classList.contains('show')) { $('fade').classList.remove('on'); $('fade').style.background = ''; } });
  };
  // Testing: the story's hidden numbers, readable and settable from the pause menu.
  const TV = [['bond', 'vars'], ['trust', 'vars'], ['corruption', 'vars'], ['suspicion', 'vars'], ['taken', 'vars'], ['keptHer', 'flags'], ['sleptBeside', 'flags'], ['fakeWithdrawn', 'flags']];
  const tbox = $('pTest');
  const syncTest = () => { if (!tbox || !G.S) return; tbox.querySelectorAll('input').forEach((el) => { const [k, w] = TV.find((v) => v[0] === el.dataset.k); const v = G.S[w][k]; if (el.type === 'checkbox') el.checked = !!v; else el.value = +(v || 0).toFixed(2); }); };
  if (tbox) {
    tbox.innerHTML = TV.map(([k, w]) => `<label class="tv"><span>${k}</span><input data-k="${k}" ${w === 'flags' ? 'type="checkbox"' : 'type="number" step="0.5"'}></label>`).join('');
    tbox.addEventListener('change', (e) => { const el = e.target, row = TV.find((v) => v[0] === el.dataset.k); if (!row || !G.S) return; G.S[row[1]][row[0]] = el.type === 'checkbox' ? el.checked : +el.value; });
    $('pTestWrap').addEventListener('toggle', syncTest);
    G.syncTest = syncTest;
  }
  // Who you play as, chosen on the title screen (kept between sessions).
  const syncAs = () => document.querySelectorAll('[data-as]').forEach((b) => b.setAttribute('aria-pressed', String((SETTINGS.playAs || 'player') === b.dataset.as)));
  document.querySelectorAll('[data-as]').forEach((b) => b.addEventListener('click', () => { SETTINGS.playAs = b.dataset.as; saveSettings(); syncAs(); }));
  syncAs();
  // Tense or gentle nights.
  const syncNights = () => {
    document.querySelectorAll('[data-nights]').forEach((b) => b.setAttribute('aria-pressed', String((SETTINGS.nights || 'tense') === b.dataset.nights)));
    if ($('nightsNote')) $('nightsNote').textContent = G.gentle() ? 'Nothing chases you.' : '';
  };
  document.querySelectorAll('[data-nights]').forEach((b) => b.addEventListener('click', () => { SETTINGS.nights = b.dataset.nights; saveSettings(); syncNights(); }));
  syncNights();
  // The little games (pouring, stirring, flipping, throwing): normal, or easier (wider warm zones, slower).
  const syncHands = () => {
    document.querySelectorAll('[data-hands]').forEach((b) => b.setAttribute('aria-pressed', String((SETTINGS.hands || 'normal') === b.dataset.hands)));
    if ($('handsNote')) $('handsNote').textContent = G.easyHands() ? 'Wider, slower.' : '';
  };
  document.querySelectorAll('[data-hands]').forEach((b) => b.addEventListener('click', () => { SETTINGS.hands = b.dataset.hands; saveSettings(); syncHands(); }));
  syncHands();
  // Dialogue: flowing (each line moves on by itself), or press to continue.
  const syncFlow = () => document.querySelectorAll('[data-flow]').forEach((b) => b.setAttribute('aria-pressed', String((SETTINGS.flow || 'auto') === b.dataset.flow)));
  document.querySelectorAll('[data-flow]').forEach((b) => b.addEventListener('click', () => { SETTINGS.flow = b.dataset.flow; saveSettings(); syncFlow(); }));
  syncFlow();
  // Music: the quiet piano on or off (the ambience stays).
  const syncMusic = () => document.querySelectorAll('[data-music]').forEach((b) => b.setAttribute('aria-pressed', String((SETTINGS.music || 'on') === b.dataset.music)));
  document.querySelectorAll('[data-music]').forEach((b) => b.addEventListener('click', () => { SETTINGS.music = b.dataset.music; saveSettings(); syncMusic(); }));
  syncMusic();
  // The endings you've reached (kept in this browser), with a nudge towards the ones you haven't.
  const ENDINGS = [
    ['foundme', 'You Found Me', 'Follow the trail. Go home together.'],
    ['uncertain', 'Uncertain Morning', 'Go home, but not quite sure who with.'],
    ['iknow', 'I Know It’s You', 'Let it get to you a little. Choose each other anyway.'],
    ['perfect', 'The Perfect Partner', 'Sit down to the perfect breakfast, or go home with whoever comes first.'],
    ['stay', 'Stay Here', 'At the door in the meadow, stay.'],
    ['replaced', 'Replaced', 'Let it win the night.'],
    ['firstsnow', 'The First Snow', 'After any ending: one more morning.'],
  ];
  const seenEndings = () => { try { return JSON.parse(localStorage.getItem('snowed.endings') || '[]'); } catch (e) { return []; } };
  const syncEndBtn = () => { if ($('endingsBtn')) $('endingsBtn').textContent = 'Endings ' + ENDINGS.filter(([id]) => seenEndings().includes(id)).length + '/' + ENDINGS.length; };
  const showEndings = () => {
    const seen = seenEndings(), n = ENDINGS.filter(([id]) => seen.includes(id)).length;
    $('endingsSub').textContent = n ? n + ' of ' + ENDINGS.length + ' found. None of them is the right one.' : 'None found yet. None of them is the right one.';
    $('endingsList').innerHTML = ENDINGS.map(([id, name, hint]) => {
      const f = seen.includes(id);
      return `<div class="ending ${f ? 'found' : 'locked'}"><div class="et"><div class="en">${f ? name : '· · ·'}</div><div class="eh">${hint}</div></div>${f ? `<button class="btn small" type="button" data-replay="${id}">Replay</button>` : ''}</div>`;
    }).join('');
    $('endings').hidden = false;
  };
  if ($('endingsBtn')) {
    $('endingsBtn').addEventListener('click', showEndings);
    $('endingsClose').addEventListener('click', () => { $('endings').hidden = true; });
    $('endings').addEventListener('click', (e) => {
      if (e.target === $('endings')) { $('endings').hidden = true; return; }
      const id = e.target.dataset && e.target.dataset.replay; if (!id) return;
      $('endings').hidden = true; G.jumpTo(id === 'firstsnow' ? 'firstsnow' : 'ending_' + id);
    });
    syncEndBtn(); G.syncEndings = syncEndBtn;
  }
  for (const sel of [$('chapterSel'), $('pChapter')]) {
    if (!sel) continue;
    sel.innerHTML = '<option value="">Jump to…</option>' + G.CHAPTERS.map(([id, t]) => `<option value="${id}">${t}</option>`).join('');
    sel.addEventListener('change', () => { const v = sel.value; sel.value = ''; if (v) G.jumpTo(v); });
  }
  $('begin').addEventListener('click', () => start(false));
  if ($('continue')) $('continue').addEventListener('click', () => start(true));
  requestAnimationFrame(frame);
  window.DEMO = { G, STATE, PLAYER, PARTNER, CAM, SHOTS, Story, partnerAI, steer, skipIntro() { $('title').classList.add('hide'); STATE.started = true; document.body.classList.add('playing'); DLG.q.length = 0; if (DLG.cur) { const r = DLG.cur.res; DLG.cur = null; } STATE.busy = false; STATE.sceneShot = false; PLAYER.script = null; PARTNER.script = null; STATE.watchDoor = false; placeChar(PLAYER, 6.5, 8.5, Math.PI); placeChar(PARTNER, 5.8, 8.8, Math.PI); PARTNER.mode = 'follow'; releaseCamera(); CAM.cut = true; }, setQ(q) { G.qName = q; G.applyQuality(); }, placeChar, simPartner(dt, n) { for (let i = 0; i < n; i++) partnerAI(dt, 0); },
    // Testing aid: run the game for `sec` seconds of game time without rendering.
    async advance(sec, dt = 1 / 30) { for (let k = 0; k < sec / dt; k++) { simulate(dt); await new Promise((r) => setTimeout(r, 0)); } }, keys, press(code) { pressed.add(code); keys.add(code); }, release(code) { keys.delete(code); }, STATE_DLG: DLG };
}
// Once every script has loaded, real assets listed in assets.js load (none by default), then the world is built around them.
const launch = () => G.loadAssets().catch((e) => console.warn('[assets]', e)).then(() => {
  try { boot(); } catch (e) { console.error(e); $('loading').textContent = 'This demo needs WebGL. ' + e.message; }
});
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', launch); else launch();
})();
