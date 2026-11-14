// audio.js — everything is synthesised with Web Audio; there are no audio files.
// Music: a slow generative piece in a minor pentatonic mode — plucked-string melody, a breathy flute, soft sustained
// fifths underneath, all through a generated reverb; drums join only while the player is fighting.
// Effects: layered (body + air + a ring of inharmonic partials), placed around the listener with HRTF panning, duller and
// wetter with distance, fed through early reflections and a long reverb, pitched a little differently every time, and
// thinned out when many would sound at once. Abilities add a layer for their element. Ambience follows the camera.
export function createAudio(lite) {
  const A = { lite: !!lite, muted: false, listener: { x: 0, z: 0 }, intensity: 0 };
  let ctx = null, master = null, musicBus = null, revIn = null, roomIn = null, sfx = null, noiseBuf = null, out = null, tune = 1; const last = {};
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  A.init = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    try { ctx = new C(); } catch { return; }
    master = ctx.createGain(); master.gain.value = A.muted ? 0 : 0.88;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; master.connect(comp); comp.connect(ctx.destination);
    const meter = ctx.createAnalyser(); meter.fftSize = 2048; comp.connect(meter); const buf = new Float32Array(2048);
    A.level = () => { meter.getFloatTimeDomainData(buf); let pk = 0, sq = 0; for (const v of buf) { pk = Math.max(pk, Math.abs(v)); sq += v * v; } return [pk, Math.sqrt(sq / buf.length)]; };   // for checking loudness
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // reverb: a 2.8 s stereo impulse of decaying, darkened noise
    const len = Math.floor(ctx.sampleRate * 2.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const b = ir.getChannelData(ch); let y = 0; for (let i = 0; i < len; i++) { const x = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); y += (x - y) * 0.32; b[i] = y * (i < 400 ? i / 400 : 1); } }
    const rev = ctx.createConvolver(); rev.buffer = ir; const revOut = ctx.createGain(); revOut.gain.value = 0.9; rev.connect(revOut); revOut.connect(master);
    revIn = ctx.createGain(); revIn.connect(rev);
    // the room: a handful of early echoes thrown to either side, then the long tail. This is what gives a dry click a place to be.
    roomIn = ctx.createGain(); const toRev = ctx.createGain(); toRev.gain.value = 0.9; roomIn.connect(toRev); toRev.connect(revIn);
    for (const [dl, pn, gn] of [[0.017, -0.8, 0.5], [0.029, 0.8, 0.42], [0.043, -0.4, 0.28], [0.061, 0.45, 0.2]]) {
      const d = ctx.createDelay(0.1), f = ctx.createBiquadFilter(), g = ctx.createGain(); d.delayTime.value = dl; f.type = 'lowpass'; f.frequency.value = 3600; g.gain.value = gn;
      roomIn.connect(d); d.connect(f); f.connect(g); if (ctx.createStereoPanner) { const sp = ctx.createStereoPanner(); sp.pan.value = pn; g.connect(sp); sp.connect(master); } else g.connect(master);
    }
    musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master); const ms = ctx.createGain(); ms.gain.value = 0.55; musicBus.connect(ms); ms.connect(revIn);
    sfx = ctx.createGain(); sfx.connect(master); out = sfx;
    A.setVolume(A.vol.music, A.vol.sfx);
    startAmbience(); startMusic();
  };
  A.vol = { music: 1, sfx: 1 };
  A.setVolume = (music, fxv) => { A.vol.music = music; A.vol.sfx = fxv; if (!ctx) return; const t = ctx.currentTime; musicBus.gain.setTargetAtTime(0.5 * music, t, 0.05); sfx.gain.setTargetAtTime(fxv, t, 0.05); roomIn.gain.setTargetAtTime(fxv, t, 0.05); };
  A.setMuted = m => { A.muted = m; if (master) master.gain.value = m ? 0 : 0.88; };
  A.pause = p => { if (ctx) { try { p ? ctx.suspend() : ctx.resume(); } catch { /* ignore */ } } };

  // ---------------- effects ----------------
  // Building blocks. Every sound is a few layers: a body (sine thump), air (filtered noise) and, for anything struck or
  // conjured, a ring of inharmonic partials — the part that lets the ear tell steel from ice from a temple bell.
  const env = (g, t, a, d, peak) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  function tone(type, f0, f1, dur, vol, delay = 0, attack = 0.008) {
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0 * tune, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * tune), t + dur);
    env(g, t, attack, dur, vol); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + attack + 0.05);
  }
  function noise(dur, type, f0, f1, vol, q = 1, delay = 0, attack = 0.008) {
    const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0 * tune, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1 * tune), t + dur);
    env(g, t, attack, dur, vol); s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + attack + 0.05);
  }
  function ring(f, dur, vol, ratios = [1, 2.76, 5.4], delay = 0) {          // struck metal, glass, bells: partials that are not harmonics, the high ones dying first
    const t = ctx.currentTime + delay;
    ratios.forEach((r, i) => { const o = ctx.createOscillator(), g = ctx.createGain(), d = dur / (1 + i * 0.7); o.type = 'sine'; o.frequency.value = f * r * tune * (1 + (Math.random() - 0.5) * 0.004); env(g, t, 0.004, d, vol / (1 + i * 0.8)); o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.06); });
  }
  function flutter(dur, type, f0, f1, vol, rate, q = 0.7, delay = 0) {       // noise that breathes: flame, thunder rolling away
    const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), trem = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0 * tune, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1 * tune), t + dur);
    env(g, t, 0.03, dur, vol); trem.gain.value = 0.65; l.frequency.value = rate * (0.8 + Math.random() * 0.4); lg.gain.value = 0.35; l.connect(lg); lg.connect(trem.gain);
    s.connect(f); f.connect(trem); trem.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.1); l.start(t); l.stop(t + dur + 0.1);
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const S = {
    // --- blows landing ---
    hit: v => { noise(0.08, 'lowpass', 650, 200, 0.15 * v, 0.7); if (Math.random() < 0.3) ring(rnd(1300, 2100), 0.1, 0.022 * v, [1, 2.4]); },      // minions: a dull knock, now and then a clink
    smack: v => { tone('sine', 170, 45, 0.2, 0.48 * v); noise(0.05, 'bandpass', 2400, 900, 0.26 * v, 0.8); noise(0.14, 'lowpass', 520, 110, 0.3 * v); ring(rnd(1700, 2200), 0.24, 0.045 * v, [1, 1.5, 2.8]); },
    thud: v => { tone('sine', 140, 58, 0.13, 0.3 * v); noise(0.07, 'bandpass', 1400, 450, 0.16 * v); },
    crit: () => { ring(1320, 0.55, 0.07, [1, 1.5, 2.01, 2.99]); tone('triangle', 880, 1320, 0.16, 0.06, 0.02); noise(0.06, 'highpass', 6000, 9000, 0.05); },
    // --- swings and shots ---
    slash: v => { noise(0.2, 'bandpass', 600, 4200, 0.22 * v, 0.9); noise(0.1, 'highpass', 5000, 8000, 0.06 * v, 1, 0.03); ring(rnd(2300, 3000), 0.32, 0.028 * v, [1, 1.34]); },
    heavy: v => { noise(0.3, 'bandpass', 200, 1500, 0.3 * v, 0.7); tone('sine', 120, 66, 0.22, 0.18 * v, 0.05); },
    bow: v => { tone('triangle', 196, 150, 0.17, 0.16 * v); tone('sine', 780, 390, 0.06, 0.06 * v); noise(0.15, 'highpass', 2600, 6000, 0.11 * v, 1, 0.012); },
    xbow: v => { noise(0.035, 'bandpass', 3200, 1700, 0.26 * v, 2); tone('square', 240, 118, 0.07, 0.05 * v); tone('sine', 112, 58, 0.15, 0.22 * v); noise(0.17, 'highpass', 3000, 6500, 0.07 * v, 1, 0.02); },
    cast: v => { tone('sine', 740, 990, 0.14, 0.08 * v); ring(rnd(1400, 1600), 0.32, 0.045 * v, [1, 2.02, 3.01]); noise(0.12, 'bandpass', 4200, 2600, 0.03 * v, 4); },
    arrow: v => { noise(0.17, 'highpass', 2500, 5200, 0.13 * v); tone('sine', 900, 420, 0.1, 0.05 * v); },
    whoosh: v => { noise(0.34, 'bandpass', 260, 2300, 0.25 * v, 0.7); noise(0.22, 'bandpass', 900, 300, 0.1 * v, 1, 0.12); },
    // --- the elements ---
    zap: v => { noise(0.05, 'highpass', 5000, 9000, 0.16 * v, 1, 0, 0.003); tone('sawtooth', 1800, 200, 0.09, 0.06 * v); tone('triangle', 880, 260, 0.17, 0.07 * v); flutter(0.6, 'lowpass', 420, 70, 0.2 * v, 13, 0.7, 0.03); },
    thunder: v => { noise(0.05, 'highpass', 4000, 9000, 0.26 * v, 1, 0, 0.003); tone('sawtooth', 1400, 90, 0.13, 0.09 * v); flutter(1.4, 'lowpass', 520, 55, 0.4 * v, 9, 0.6, 0.04); noise(0.9, 'bandpass', 900, 200, 0.08 * v, 0.8, 0.2); },
    ice: v => { ring(rnd(2200, 2900), 0.55, 0.055 * v, [1, 1.41, 2.3, 3.1]); noise(0.09, 'highpass', 6500, 3000, 0.13 * v, 1); noise(0.32, 'bandpass', 5200, 2600, 0.045 * v, 6, 0.05); },
    fire: v => { flutter(0.7, 'bandpass', 320, 1800, 0.3 * v, 17, 0.6); noise(0.5, 'lowpass', 900, 200, 0.18 * v, 0.7, 0.08); noise(0.25, 'highpass', 4000, 7000, 0.035 * v, 1, 0.05); },
    blood: v => { tone('sine', 160, 48, 0.36, 0.26 * v); noise(0.32, 'lowpass', 700, 150, 0.28 * v, 2); noise(0.13, 'bandpass', 1400, 500, 0.09 * v, 3, 0.06); },
    star: v => { [1568, 2093, 2637].forEach((f, i) => tone('sine', f, f, 0.42, 0.04 * v, i * 0.045)); ring(3136, 0.8, 0.022 * v, [1, 1.5], 0.1); },
    sword: v => { ring(rnd(1650, 1900), 0.75, 0.055 * v, [1, 1.34, 2.2, 3.3]); noise(0.24, 'bandpass', 1500, 6000, 0.13 * v, 1.2); },
    wind: v => { noise(0.55, 'bandpass', 500, 2600, 0.15 * v, 0.5, 0, 0.06); noise(0.4, 'highpass', 3000, 5200, 0.045 * v, 1, 0.1); },
    heal: v => { [523, 659, 784, 1047].forEach((f, i) => tone('sine', f, f, 0.5, 0.05 * v, i * 0.07, 0.03)); ring(1568, 1.0, 0.028 * v, [1, 2], 0.2); },
    earth: v => { tone('sine', 92, 34, 0.5, 0.48 * v); noise(0.42, 'lowpass', 520, 80, 0.38 * v); noise(0.55, 'bandpass', 1800, 500, 0.07 * v, 0.6, 0.1); },
    shout: v => { tone('sawtooth', 185, 120, 0.45, 0.07 * v, 0, 0.03); noise(0.42, 'bandpass', 950, 650, 0.1 * v, 3, 0, 0.03); tone('sine', 92, 60, 0.4, 0.2 * v); },
    magic: v => { tone('sine', 520, 1040, 0.3, 0.1 * v); tone('triangle', 780, 1560, 0.36, 0.05 * v, 0.03); ring(2080, 0.65, 0.035 * v, [1, 1.5, 2]); noise(0.3, 'bandpass', 3000, 6000, 0.035 * v, 3); },
    charge: v => { tone('sine', 180, 760, 0.55, 0.1 * v); noise(0.55, 'bandpass', 400, 2400, 0.06 * v, 2, 0, 0.05); ring(660, 0.75, 0.03 * v, [1, 1.5], 0.35); },
    shield: v => { tone('sine', 330, 660, 0.34, 0.1 * v); tone('sine', 495, 990, 0.4, 0.07 * v, 0.04); ring(1320, 0.95, 0.04 * v, [1, 2.76, 5.4], 0.05); },
    // --- the battlefield ---
    tower: v => { tone('triangle', 170, 60, 0.24, 0.14 * v); noise(0.16, 'lowpass', 1200, 300, 0.17 * v); ring(520, 0.55, 0.05 * v, [1, 2.76]); },
    boom: v => { noise(1.0, 'lowpass', 900, 55, 0.58 * v); tone('sine', 110, 28, 0.8, 0.5 * v); noise(0.25, 'bandpass', 2400, 600, 0.15 * v, 0.7); flutter(0.8, 'bandpass', 1200, 300, 0.08 * v, 11, 0.5, 0.15); },
    kill: v => { ring(98, 2.8, 0.3 * v, [1, 1.48, 2.02, 2.74, 3.76, 4.07]); noise(0.25, 'lowpass', 1800, 200, 0.2 * v); tone('sine', 196, 92, 0.5, 0.14 * v); },             // a gong for each one put down
    death: () => { tone('triangle', 220, 55, 1.0, 0.2); tone('sine', 110, 40, 1.1, 0.2); ring(147, 2.6, 0.12, [1, 1.48, 2.74]); },
    horn: () => { tone('triangle', 147, 147, 1.0, 0.09, 0, 0.06); tone('triangle', 220.5, 220, 1.0, 0.07, 0.05, 0.06); ring(294, 3.0, 0.1, [1, 2.0, 2.76, 4.1], 0.02); },       // horn under a temple bell
    warn: () => { ring(660, 0.3, 0.07, [1, 2.76]); ring(660, 0.3, 0.07, [1, 2.76], 0.17); },
    // --- yours ---
    coin: () => { ring(1568, 0.28, 0.06, [1, 2.5]); tone('sine', 2093, 2093, 0.16, 0.06, 0.06); },
    buy: () => { ring(1568, 0.28, 0.06, [1, 2.5]); ring(1047, 0.6, 0.05, [1, 2, 3], 0.07); },
    level: () => [587, 698, 880, 1175].forEach((f, i) => { tone('triangle', f, f, 0.3, 0.07, i * 0.08); ring(f * 2, 0.8, 0.03, [1, 2.76], i * 0.08); }),
    ping: () => { ring(1175, 0.9, 0.09, [1, 2.01]); ring(1568, 1.1, 0.08, [1, 2.01], 0.14); },
    recall: () => { tone('sine', 220, 880, 1.3, 0.05, 0, 0.2); ring(880, 1.5, 0.035, [1, 1.5, 2], 0.4); noise(1.2, 'bandpass', 800, 3600, 0.035, 2, 0, 0.3); },
    arrive: () => { noise(0.5, 'bandpass', 2600, 300, 0.2, 0.7); ring(660, 1.8, 0.08, [1, 1.5, 2.5]); tone('sine', 110, 55, 0.4, 0.2); },
    heart: () => { tone('sine', 72, 40, 0.16, 0.32); tone('sine', 64, 38, 0.17, 0.22, 0.24); },
    click: () => tone('sine', 880, 1100, 0.05, 0.06),
  };
  // how often each may repeat, and which ones give way when the air is already full
  const GAP = { hit: 0.11, thud: 0.07, smack: 0.06, slash: 0.06, heavy: 0.06, bow: 0.05, xbow: 0.05, cast: 0.05, boom: 0.09, ice: 0.12, fire: 0.12, thunder: 0.14, zap: 0.08, blood: 0.12, star: 0.1, sword: 0.1, heal: 0.15, earth: 0.1, wind: 0.15, kill: 0.2, tower: 0.08 };
  const SOFT = { hit: 1, thud: 1, tower: 1 }, WET = { boom: 0.3, thunder: 0.35, kill: 0.4, horn: 0.4, death: 0.4, earth: 0.25, ice: 0.25, star: 0.3, heal: 0.3, magic: 0.25, shield: 0.25, sword: 0.22, level: 0.3, ping: 0.35, arrive: 0.35, recall: 0.3, crit: 0.2 };
  const TRIM = { boom: 0.62, earth: 0.55, kill: 0.55, death: 0.62, blood: 0.7, arrive: 0.75, heart: 0.8, smack: 0.85, bow: 0.8, slash: 1.5, zap: 1.5, ice: 1.45, magic: 1.4, thunder: 1.35, sword: 1.3, star: 1.3, fire: 1.3, xbow: 1.3, crit: 1.25 };
  const recent = [];
  // x, z = where it happens in the world. The listener stands at the camera's focus, facing up the screen: left and right
  // are true to the picture, things up-screen sound ahead and things down-screen behind (with headphones). Distance dulls
  // the sound and sends more of it to the room.
  A.play = (name, x, z, gain = 1) => {
    if (!ctx || A.muted || ctx.state !== 'running' || !S[name]) return;
    let v = gain * (TRIM[name] || 1), dx = 0, dz = 0, far = 0;
    if (x !== undefined) { dx = x - A.listener.x; dz = z - A.listener.z; const d = Math.hypot(dx, dz); if (d > (SOFT[name] ? 30 : 58)) return; v *= 1 / (1 + (d / 17) * (d / 17)); far = Math.min(1, d / 42); }
    const now = ctx.currentTime; if (now - (last[name] || -1) < (GAP[name] || 0.04)) return;
    while (recent.length && now - recent[0] > 0.09) recent.shift();
    if (recent.length >= (SOFT[name] ? 3 : 9)) return;                 // busy: small sounds step aside first
    last[name] = now; recent.push(now);
    try {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 17000 - far * 12800;
      const send = ctx.createGain(); send.gain.value = (WET[name] || 0.1) + far * 0.4; lp.connect(send); send.connect(roomIn);
      if (x === undefined) lp.connect(sfx);
      else if (A.lite || !ctx.createPanner) { if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(dx / 20, -1, 1) * 0.85; lp.connect(p); p.connect(sfx); } else lp.connect(sfx); }
      else {
        const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'linear'; p.rolloffFactor = 0; const k = 0.3;
        if (p.positionX) { p.positionX.value = dx * k; p.positionY.value = -1.2; p.positionZ.value = dz * k - 1.4; } else p.setPosition(dx * k, -1.2, dz * k - 1.4);
        const mk = ctx.createGain(); mk.gain.value = 1.5; lp.connect(p); p.connect(mk); mk.connect(sfx);                                       // HRTF costs some level; give it back
      }
      out = lp; tune = 0.94 + Math.random() * 0.12; S[name](v);
    } catch (e) { A.lastErr = String(e); } finally { out = sfx; tune = 1; }
  };
  // an extra layer by what the ability is made of, so ice, thunder, flame, blood, starlight and steel each have a voice
  const ELEMENT = {
    icelance: 'ice', frostnova: 'ice', iceslide: 'ice', blizzard: 'ice', stasis: 'ice',
    bolt: 'thunder', orb: 'zap', tempest: 'thunder', concuss: 'thunder',
    firearrow: 'fire', firestep: 'fire', sunarrow: 'fire', shell: 'fire', barrage: 'fire', meteor: 'fire',
    bloodclaw: 'blood', hook: 'blood', bloodsea: 'blood', reap: 'blood', veil: 'blood',
    starbolt: 'star', well: 'star', phase: 'star',
    pierce: 'sword', backshot: 'sword', rain: 'sword', cleave: 'sword', fan: 'sword',
    gale: 'wind', rage: 'wind', shadowstep: 'wind',
    mend: 'heal', bloom: 'heal', ward: 'heal',
    skyfall: 'earth', charge: 'earth', whirl: 'earth', gate: 'earth', taunt: 'shout',
  };
  A.layer = (id, x, z, gain = 0.85) => { const n = ELEMENT[id]; if (n) A.play(n, x, z, gain); };
  A.names = () => Object.keys(S);

  // ---------------- ambience ----------------
  // Three quiet beds that follow the camera: wind everywhere (keener over the snow), the river when it is near, a low
  // furnace rumble over the ash. A far bird now and then; your own heartbeat when you are close to falling.
  let amb = null, ambT = 0, birdT = 6, heartT = 0;
  function startAmbience() {
    const loop = (type, f, q, pan) => {
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0;
      s.connect(fl); fl.connect(g); let sp = null; if (ctx.createStereoPanner) { sp = ctx.createStereoPanner(); sp.pan.value = pan; g.connect(sp); sp.connect(sfx); } else g.connect(sfx);
      const sd = ctx.createGain(); sd.gain.value = 0.3; g.connect(sd); sd.connect(roomIn); s.start(0, Math.random()); return { fl, g, sp };
    };
    amb = { wind: loop('bandpass', 420, 0.5, -0.3), wind2: loop('bandpass', 900, 1.2, 0.4), water: loop('bandpass', 1500, 0.8, 0), ash: loop('lowpass', 150, 0.7, 0) };
    const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 0.09; lg.gain.value = 160; l.connect(lg); lg.connect(amb.wind.fl.frequency); lg.connect(amb.wind2.fl.frequency); l.start();   // gusts
    const l2 = ctx.createOscillator(), lg2 = ctx.createGain(); l2.frequency.value = 0.31; lg2.gain.value = 260; l2.connect(lg2); lg2.connect(amb.water.fl.frequency); l2.start();                            // the river never holds one note
  }
  A.ambient = (x, z, riverDx, low, dt) => {
    if (!ctx || !amb || ctx.state !== 'running') return;
    ambT -= dt; birdT -= dt; heartT -= dt;
    if (low && heartT <= 0 && !A.muted) { heartT = 0.9; out = sfx; try { S.heart(); } catch { /* ignore */ } }
    if (ambT > 0) return; ambT = 0.2;
    const t = ctx.currentTime, fr = clamp((-x - 12) / 30, 0, 1), em = clamp((x - 12) / 30, 0, 1), near = clamp(1 - Math.abs(riverDx) / 15, 0, 1);
    amb.wind.g.gain.setTargetAtTime(0.02 + 0.016 * fr, t, 0.6); amb.wind2.g.gain.setTargetAtTime(0.004 + 0.02 * fr, t, 0.6);
    amb.water.g.gain.setTargetAtTime(0.034 * near * near, t, 0.4); if (amb.water.sp) amb.water.sp.pan.setTargetAtTime(clamp(riverDx / 10, -0.8, 0.8), t, 0.3);
    amb.ash.g.gain.setTargetAtTime(0.07 * em, t, 0.6);
    if (birdT <= 0 && !A.muted) {                                      // somewhere in the trees
      birdT = 7 + Math.random() * 11;
      if (fr < 0.6 && em < 0.6) { const f = 2100 + Math.random() * 900, px = A.listener.x + (Math.random() - 0.5) * 60, pz = A.listener.z - 10 - Math.random() * 25; A.play('bird', px, pz); A.birdF = f; }
    }
  };
  S.bird = v => { const f = A.birdF || 2400; tone('sine', f, f * 0.8, 0.12, 0.05 * v, 0, 0.02); tone('sine', f * 1.12, f * 0.9, 0.14, 0.045 * v, 0.17, 0.02); if (Math.random() < 0.5) tone('sine', f, f * 0.82, 0.12, 0.04 * v, 0.36, 0.02); };
  WET.bird = 0.5;

  // ---------------- music ----------------
  function startMusic() {
    const PENTA = [0, 3, 5, 7, 10], BASE = 220, BEAT = 60 / 66, STEP = BEAT / 2;       // A minor pentatonic, 66 bpm, eighth-note grid
    const hz = deg => BASE * Math.pow(2, (PENTA[((deg % 5) + 5) % 5] + 12 * Math.floor(deg / 5)) / 12);
    const CHORDS = [[-10, -7, -5, -3], [-11, -8, -6, -4], [-8, -5, -3, -1], [-9, -6, -4, -2]];   // open fifths and fourths, as scale degrees
    const pan = (node, p) => { if (!ctx.createStereoPanner) { node.connect(musicBus); return; } const sp = ctx.createStereoPanner(); sp.pan.value = p; node.connect(sp); sp.connect(musicBus); };
    function pluck(f, t, vol, p = 0) {               // a plucked silk string: bright pick, quick settle in pitch, long dark tail
      const dur = clamp(2.6 - Math.log2(f / 110) * 0.55, 0.9, 2.6), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(7000, f * 9), t); lp.frequency.exponentialRampToValueAtTime(Math.max(500, f * 1.6), t + dur * 0.7);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      for (const [mult, lvl, type] of [[1, 1, 'triangle'], [2, 0.32, 'sine'], [3, 0.12, 'sine']]) {
        const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f * mult * 1.014, t); o.frequency.exponentialRampToValueAtTime(f * mult, t + 0.07);
        og.gain.value = lvl; o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.05);
      }
      const n = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain(); n.buffer = noiseBuf; nf.type = 'highpass'; nf.frequency.value = 2500;
      ng.gain.setValueAtTime(vol * 0.5, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.025); n.connect(nf); nf.connect(ng); ng.connect(lp); n.start(t, Math.random()); n.stop(t + 0.04);
      lp.connect(g); pan(g, p);
    }
    function flute(f, t, dur, vol, p = 0) {          // a bamboo flute: soft attack, breath, vibrato that grows in
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.22); g.gain.setValueAtTime(vol, t + dur - 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.35);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(dur, 0.9)); lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 0.5);
      for (const [mult, lvl] of [[1, 1], [2, 0.16], [3, 0.05]]) { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * mult; lg.connect(o.frequency); og.gain.value = lvl; o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.5); }
      const n = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain(); n.buffer = noiseBuf; n.loop = true; nf.type = 'bandpass'; nf.frequency.value = f * 2; nf.Q.value = 1.5; ng.gain.value = 0.1;
      n.connect(nf); nf.connect(ng); ng.connect(g); n.start(t, Math.random()); n.stop(t + dur + 0.5);
      pan(g, p);
    }
    let padVoices = [];
    function pad(chord, t) {                         // slow swell of fifths and fourths, spread across the stereo field
      for (const v of padVoices) { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0.0001, t, 1.3); for (const o of v.os) o.stop(t + 7); }
      padVoices = chord.map((deg, i) => {
        const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; g.gain.setValueAtTime(0.0001, t); g.gain.setTargetAtTime(0.05, t, 1.6);
        const os = [-5, 5].map(det => { const o = ctx.createOscillator(); o.type = det < 0 ? 'sine' : 'triangle'; o.frequency.value = hz(deg + 5); o.detune.value = det; o.connect(lp); o.start(t); return o; });
        lp.connect(g); pan(g, (i / (chord.length - 1) - 0.5) * 1.2); return { g, os };
      });
    }
    function drum(t, vol, big) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(big ? 96 : 150, t); o.frequency.exponentialRampToValueAtTime(big ? 42 : 80, t + 0.22);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 0.45 : 0.2)); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.5);
      const n = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain(); n.buffer = noiseBuf; nf.type = 'lowpass'; nf.frequency.value = big ? 320 : 900;
      ng.gain.setValueAtTime(vol * 0.5, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); n.connect(nf); nf.connect(ng); ng.connect(musicBus); n.start(t, Math.random()); n.stop(t + 0.12);
    }
    // melody: phrases that wander by step over two octaves and come to rest on the chord, with rests between them
    let step = 0, nextT = ctx.currentTime + 0.4, deg = 2, phrase = 0, rest = 4, hold = 0, chordI = 0, inten = 0, fluteWait = 12;
    function schedule(t) {
      const bar = step % 8 === 0, beat = step % 2 === 0;
      inten += (A.intensity - inten) * 0.12;
      if (step % 16 === 0) { chordI = (step / 16) % CHORDS.length; pad(CHORDS[chordI], t); }
      if (bar) pluck(hz(CHORDS[chordI][0] + 5), t, 0.13, -0.15);
      if (hold > 0) hold--;
      else if (rest > 0) { rest--; if (rest === 0) { phrase = 4 + Math.floor(Math.random() * 6); if (Math.random() < 0.3) for (let k = 0; k < 4; k++) pluck(hz(deg - 4 + k), t - 0.3 + k * 0.075, 0.06, 0.2); } }
      else if (phrase > 0) {
        const r = Math.random(); deg += r < 0.34 ? 1 : r < 0.68 ? -1 : r < 0.8 ? 2 : r < 0.92 ? -2 : 0;
        if (deg > 9) deg -= 2; if (deg < -3) deg += 2;
        if (phrase === 1) { const tones = CHORDS[chordI].map(c => ((c % 5) + 5) % 5); let best = deg, bd = 9; for (let d2 = deg - 2; d2 <= deg + 2; d2++) if (tones.includes(((d2 % 5) + 5) % 5) && Math.abs(d2 - deg) < bd) { bd = Math.abs(d2 - deg); best = d2; } deg = best; }
        if (Math.random() < 0.18) pluck(hz(deg + 1), t - 0.07, 0.05, 0.2);                      // grace note
        pluck(hz(deg), t, 0.16 + Math.random() * 0.05, 0.2 + (Math.random() - 0.5) * 0.3);
        if (Math.random() < 0.14) pluck(hz(deg - 5), t, 0.06, 0.35);                              // octave below, softly
        hold = phrase === 1 ? 3 : [0, 0, 1, 1, 2][Math.floor(Math.random() * 5)]; phrase--;
        if (phrase === 0) rest = 3 + Math.floor(Math.random() * 6);
      }
      if (bar && --fluteWait <= 0 && Math.random() < 0.5) { const c = CHORDS[chordI]; flute(hz(c[1 + Math.floor(Math.random() * 3)] + 15), t, BEAT * (2.5 + Math.random() * 2.5), 0.045, -0.35); fluteWait = 3 + Math.floor(Math.random() * 3); }
      if (inten > 0.25) { const s8 = step % 8; if (s8 === 0 || s8 === 5) drum(t, 0.3 * inten, true); else if (s8 === 2 || s8 === 4 || s8 === 7) drum(t, 0.14 * inten, false); }
      step++;
    }
    setInterval(() => {
      if (ctx.state !== 'running') return;
      if (nextT < ctx.currentTime - 0.2) nextT = ctx.currentTime + 0.15;                          // the tab was asleep: pick up from now
      while (nextT < ctx.currentTime + 0.6) { schedule(nextT); nextT += STEP; }
    }, 150);
  }
  return A;
}
