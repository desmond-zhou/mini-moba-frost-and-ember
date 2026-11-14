// sfx.js — the sound bank. Every effect is designed with Tone.js (membrane drums for bodies, filtered noise for air and grit,
// plucked strings, FM voices, saturation), rendered offline once at start-up into a few variations, and handed to audio.js
// as plain AudioBuffers. audio.js plays them through its own spatial chain, so a hit costs one buffer source at play time.
// Nothing is metallic unless it should be: ordinary blows are thumps and cracks, blades sing through resonant noise.
import * as Tone from 'tone';

const R = (a, b) => a + Math.random() * (b - a);
const PENTA = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784, 880, 1046.5];
const pick = a => a[Math.floor(Math.random() * a.length)];

// building blocks, used inside an offline render; `o` is where everything ends up
function kit(o, T0 = 0) {                                            // T0: where this variation starts in a shared render
  const db = v => Tone.gainToDb(Math.max(v, 1e-4));
  // a membrane: the body of a blow, a drum, a heartbeat
  const thump = (t, f, d, v, oct = 3, pd = 0.04, dest = o) => { t += T0; const s = new Tone.MembraneSynth({ pitchDecay: pd, octaves: oct, oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: d, sustain: 0, release: 0.03 }, volume: db(v) }).connect(dest); s.triggerAttackRelease(f, d, t); };
  // filtered noise with its own envelope and a filter sweep: air, cracks, splashes, roars
  const burst = (t0, { c = 'pink', ft = 'bandpass', f0 = 1000, f1 = f0, q = 1, a = 0.002, d = 0.1, v = 0.5, sw = d, dest = o, lfo = 0, depth = 0.6 }) => {
    const t = t0 + T0, n = new Tone.Noise(c), f = new Tone.Filter({ type: ft, frequency: f0, Q: q }), g = new Tone.Gain(0);
    n.chain(f, g, dest); n.start(t); n.stop(t + a + d + 0.08);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0005, t + a + d);
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + a + sw);
    if (lfo) { const tg = new Tone.Gain(1 - depth); g.disconnect(); g.chain(tg, dest); new Tone.LFO(lfo * R(0.85, 1.15), 1 - depth, 1).connect(tg.gain).start(t).stop(t + a + d + 0.05); }
  };
  // many tiny resonant grains: ice crackling, embers, gravel
  const grains = (t, n, span, f0, f1, q, v, c = 'white', dest = o) => { for (let i = 0; i < n; i++) burst(t + Math.random() * span, { c, ft: 'bandpass', f0: R(f0, f1), q, a: 0.001, d: R(0.015, 0.05), v: v * R(0.5, 1), dest }); };
  // a voice with pitch glide
  const voice = (t, type, f0, f1, d, v, a = 0.005, dest = o) => { t += T0; const s = new Tone.Synth({ oscillator: { type }, envelope: { attack: a, decay: d, sustain: 0, release: 0.05 }, volume: db(v) }).connect(dest); s.triggerAttackRelease(f0, d, t); s.frequency.setValueAtTime(f0, t); s.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + a + d); };
  const fm = (t, f, d, v, h = 2, mi = 3, a = 0.004, dest = o) => { t += T0; const s = new Tone.FMSynth({ harmonicity: h, modulationIndex: mi, envelope: { attack: a, decay: d, sustain: 0, release: 0.1 }, modulationEnvelope: { attack: a, decay: d * 0.6, sustain: 0, release: 0.1 }, volume: db(v) }).connect(dest); s.triggerAttackRelease(f, d, t); };
  // a plucked string (Karplus–Strong), computed here rather than with Tone's PluckSynth, whose AudioWorklet will not load from a
  // blob URL inside a sandboxed page
  const pluck = (t, f, v, damp = 3200, dest = o) => { t += T0;
    const sr = Tone.getContext().sampleRate, len = Math.floor(sr * 0.7), N = Math.max(2, Math.round(sr / f)), a = new Float32Array(len), mix = Math.min(0.92, Math.max(0.2, damp / 7000));
    for (let i = 0; i < N; i++) a[i] = Math.random() * 2 - 1;
    for (let i = N; i < len; i++) a[i] = (a[i - N] * mix + a[i - N - 1 < 0 ? 0 : i - N - 1] * (1 - mix)) * 0.996;
    for (let i = 0; i < len; i++) a[i] *= v * 0.6;
    new Tone.ToneBufferSource(Tone.ToneAudioBuffer.fromArray(a)).connect(dest).start(t); };
  const grit = (amt, dest = o) => new Tone.Distortion({ distortion: amt, wet: 0.7 }).connect(dest);
  const tone = (hz, dest = o) => new Tone.Filter({ type: 'lowpass', frequency: hz, Q: 0.5 }).connect(dest);
  return { thump, burst, grains, voice, fm, pluck, grit, tone, T0 };
}

// each entry: [seconds to render, design]. Designs randomise a little so the variations differ.
const BANK = {
  // --- blows landing ---
  hit: [0.18, K => { K.thump(0, R(110, 140), 0.07, 0.5, 2); K.burst(0, { c: 'brown', ft: 'lowpass', f0: 1100, f1: 250, d: 0.06, v: 0.8 }); }],
  smack: [0.4, K => { const g = K.grit(0.35); K.thump(0, R(85, 105), 0.2, 1, 3, 0.05, g); K.burst(0, { c: 'white', f0: R(2200, 2900), f1: 700, q: 0.9, a: 0.001, d: 0.05, v: 0.7 }); K.burst(0.004, { c: 'brown', ft: 'lowpass', f0: 900, f1: 140, d: 0.17, v: 0.9, dest: g }); }],
  thud: [0.3, K => { K.thump(0, R(70, 85), 0.15, 0.9, 2.5); K.burst(0, { c: 'pink', ft: 'lowpass', f0: 1400, f1: 300, d: 0.08, v: 0.6 }); }],
  crit: [0.6, K => { const g = K.grit(0.45); K.thump(0, 62, 0.32, 1, 4, 0.06, g); K.burst(0, { c: 'white', f0: 3000, f1: 9000, q: 1.5, a: 0.001, d: 0.1, v: 0.6 }); K.burst(0.01, { c: 'brown', ft: 'lowpass', f0: 1200, f1: 120, d: 0.3, v: 1, dest: g }); K.burst(0.02, { c: 'white', f0: R(2600, 3200), q: 28, d: 0.35, v: 0.25 }); }],
  // --- swings and shots ---
  slash: [0.35, K => { K.burst(0, { c: 'pink', f0: R(450, 600), f1: R(4200, 5200), q: 1.3, a: 0.02, d: 0.16, v: 0.9 }); K.burst(0.05, { c: 'white', ft: 'highpass', f0: 6000, d: 0.05, v: 0.25 }); K.burst(0.03, { c: 'white', f0: R(2700, 3400), q: 26, d: 0.22, v: 0.22 }); }],
  heavy: [0.5, K => { K.burst(0, { c: 'brown', f0: 140, f1: 1300, q: 0.8, a: 0.05, d: 0.28, v: 1 }); K.thump(0.07, 68, 0.26, 0.8, 3); }],
  bow: [0.5, K => { K.pluck(0, R(95, 115), 0.9, 2600); K.burst(0.01, { c: 'pink', ft: 'highpass', f0: 2600, f1: 6000, a: 0.01, d: 0.14, v: 0.35 }); }],
  xbow: [0.4, K => { K.burst(0, { c: 'white', f0: 3600, f1: 1800, q: 2, a: 0.001, d: 0.025, v: 0.8 }); K.pluck(0.005, R(70, 82), 0.8, 1800); K.thump(0.005, 90, 0.1, 0.6, 2); K.burst(0.02, { c: 'pink', ft: 'highpass', f0: 3000, f1: 6500, d: 0.15, v: 0.25 }); }],
  cast: [0.45, K => { const f = pick(PENTA.slice(4)); K.fm(0, f, 0.28, 0.35, 1.5, 2, 0.01); K.burst(0, { c: 'pink', f0: 1600, f1: 5200, q: 2, a: 0.03, d: 0.25, v: 0.35 }); }],
  arrow: [0.3, K => { K.burst(0, { c: 'pink', ft: 'highpass', f0: R(2300, 2800), f1: R(5200, 6000), a: 0.01, d: 0.16, v: 0.8 }); }],
  whoosh: [0.55, K => { K.burst(0, { c: 'pink', f0: 280, f1: 2300, q: 0.8, a: 0.08, d: 0.3, v: 1 }); K.burst(0.15, { c: 'pink', f0: 900, f1: 300, q: 1, d: 0.22, v: 0.4 }); }],
  // --- the elements ---
  zap: [0.7, K => { K.burst(0, { c: 'white', ft: 'highpass', f0: 4500, a: 0.001, d: 0.04, v: 0.9 }); K.fm(0, R(380, 460), 0.14, 0.3, 7.1, 22); K.grains(0.01, 18, 0.25, 2500, 7000, 4, 0.5); K.burst(0.03, { c: 'brown', ft: 'lowpass', f0: 500, f1: 70, d: 0.55, v: 0.6, lfo: 14 }); }],
  thunder: [1.8, K => { const g = K.grit(0.4); K.burst(0, { c: 'white', ft: 'highpass', f0: 3200, a: 0.001, d: 0.06, v: 1 }); K.grains(0, 30, 0.18, 1500, 6000, 3, 0.6); K.thump(0.02, 42, 0.9, 1, 3, 0.1, g); K.burst(0.04, { c: 'brown', ft: 'lowpass', f0: 420, f1: 50, a: 0.03, d: 1.5, v: 1, lfo: 8, depth: 0.7, dest: g }); }],
  ice: [0.7, K => { K.burst(0, { c: 'white', ft: 'highpass', f0: 6500, f1: 3000, a: 0.001, d: 0.07, v: 0.7 }); K.grains(0, 22, 0.22, 2400, 6400, 22, 0.6); K.fm(0.02, R(2000, 2600), 0.4, 0.12, 2.5, 1.5); K.burst(0.05, { c: 'white', f0: 5200, f1: 2600, q: 6, d: 0.35, v: 0.18 }); }],
  fire: [0.9, K => { K.burst(0, { c: 'pink', f0: 300, f1: 1500, q: 0.7, a: 0.04, d: 0.7, v: 1, lfo: 17, depth: 0.5 }); K.burst(0.06, { c: 'brown', ft: 'lowpass', f0: 900, f1: 200, d: 0.5, v: 0.6 }); K.grains(0.05, 26, 0.6, 2500, 7500, 3, 0.35); }],
  blood: [0.5, K => { K.thump(0, R(100, 120), 0.3, 0.8, 2.5); K.burst(0, { c: 'brown', ft: 'lowpass', f0: 700, f1: 140, q: 3, d: 0.3, v: 0.9 }); K.burst(0.05, { c: 'pink', f0: 1300, f1: 320, q: 6, d: 0.15, v: 0.5 }); }],
  star: [0.9, K => { [0, 0.05, 0.1].forEach((dt, i) => K.fm(dt, PENTA[7 + i] * 2, 0.45, 0.22, 3, 1.2, 0.005)); K.burst(0.02, { c: 'white', f0: 8000, q: 4, a: 0.02, d: 0.5, v: 0.25 }); }],
  sword: [0.8, K => { K.burst(0, { c: 'pink', f0: 1400, f1: 6000, q: 1.2, a: 0.01, d: 0.2, v: 0.6 }); K.burst(0.005, { c: 'white', f0: R(2500, 3100), q: 40, a: 0.002, d: 0.6, v: 0.35 }); K.burst(0.005, { c: 'white', f0: R(4200, 4800), q: 40, d: 0.35, v: 0.18 }); }],
  wind: [0.9, K => { K.burst(0, { c: 'pink', f0: 400, f1: 1800, q: 0.6, a: 0.12, d: 0.55, v: 1, sw: 0.4 }); K.burst(0.12, { c: 'white', ft: 'highpass', f0: 3000, f1: 5200, a: 0.1, d: 0.35, v: 0.25 }); }],
  heal: [1.3, K => { [0, 0.07, 0.14, 0.21].forEach((dt, i) => K.voice(dt, 'triangle', PENTA[5 + i], PENTA[5 + i], 0.7, 0.28, 0.03)); K.burst(0.05, { c: 'pink', f0: 3000, f1: 6000, q: 3, a: 0.1, d: 0.8, v: 0.18 }); }],
  earth: [1.0, K => { const g = K.grit(0.5); K.thump(0, 52, 0.6, 1, 4, 0.08, g); K.burst(0, { c: 'brown', ft: 'lowpass', f0: 320, f1: 55, a: 0.005, d: 0.6, v: 1, dest: g }); K.grains(0.06, 24, 0.5, 600, 2200, 2, 0.4, 'pink'); }],
  shout: [0.7, K => { const f1 = new Tone.Filter({ type: 'bandpass', frequency: 700, Q: 4 }), f2 = new Tone.Filter({ type: 'bandpass', frequency: 1150, Q: 5 }), o = K.tone(4000); f1.connect(o); f2.connect(o); K.voice(0, 'sawtooth', 190, 125, 0.45, 0.9, 0.03, f1); K.voice(0, 'sawtooth', 190, 125, 0.45, 0.6, 0.03, f2); K.thump(0, 85, 0.3, 0.5, 1.5); }],
  magic: [0.8, K => { K.fm(0, 520, 0.35, 0.35, 2, 4, 0.02); K.fm(0.04, 780, 0.4, 0.2, 1.5, 2, 0.02); K.burst(0.02, { c: 'pink', f0: 2500, f1: 7000, q: 3, a: 0.05, d: 0.5, v: 0.25 }); }],
  charge: [0.9, K => { K.voice(0, 'sine', 140, 720, 0.6, 0.45, 0.05); K.burst(0, { c: 'pink', f0: 400, f1: 2600, q: 2, a: 0.3, d: 0.4, v: 0.5, sw: 0.7, lfo: 11 }); }],
  shield: [0.8, K => { K.fm(0, 330, 0.45, 0.4, 1.5, 1.5, 0.02); K.fm(0.03, 495, 0.5, 0.25, 1.5, 1.2, 0.02); K.burst(0.02, { c: 'white', f0: 2600, q: 18, a: 0.02, d: 0.55, v: 0.18 }); }],
  // --- the battlefield ---
  tower: [0.6, K => { const g = K.grit(0.3); K.thump(0, 90, 0.25, 0.9, 3, 0.05, g); K.burst(0, { c: 'white', f0: 1800, f1: 500, q: 1, a: 0.001, d: 0.08, v: 0.6 }); K.burst(0.01, { c: 'brown', ft: 'lowpass', f0: 1000, f1: 160, d: 0.3, v: 0.7, dest: g }); }],
  boom: [1.6, K => { const g = K.grit(0.6); K.thump(0, 46, 1.0, 1, 5, 0.12, g); K.burst(0, { c: 'brown', ft: 'lowpass', f0: 1400, f1: 45, a: 0.002, d: 1.3, v: 1, dest: g }); K.burst(0, { c: 'white', f0: 2400, f1: 600, a: 0.001, d: 0.12, v: 0.6 }); K.grains(0.1, 30, 1.0, 900, 3500, 2, 0.3, 'pink'); }],
  kill: [2.6, K => { K.thump(0, 58, 1.0, 1, 2, 0.08); K.burst(0, { c: 'brown', ft: 'lowpass', f0: 500, f1: 80, d: 0.6, v: 0.7 }); K.fm(0.01, 98, 2.4, 0.3, 1.4, 2.2, 0.005); }],   // a temple drum with a low bell behind it
  death: [1.8, K => { K.voice(0, 'triangle', 220, 55, 1.2, 0.4, 0.02); K.thump(0, 55, 1.0, 0.8, 1.5); K.fm(0.05, 147, 1.6, 0.18, 1.4, 1.5); }],
  horn: [2.6, K => { const o = K.tone(1800); const s = new Tone.FMSynth({ harmonicity: 1, modulationIndex: 2.5, oscillator: { type: 'sawtooth' }, envelope: { attack: 0.18, decay: 0.6, sustain: 0.6, release: 0.9 }, volume: -6 }).connect(o); s.triggerAttackRelease(147, 1.1, K.T0); const s2 = new Tone.FMSynth({ harmonicity: 1, modulationIndex: 2, envelope: { attack: 0.2, decay: 0.5, sustain: 0.5, release: 0.9 }, volume: -10 }).connect(o); s2.triggerAttackRelease(220, 1.0, K.T0 + 0.05); K.fm(0.05, 294, 2.2, 0.15, 1.4, 1.6); }],
  warn: [0.45, K => { K.thump(0, 720, 0.07, 0.8, 0.5, 0.01); K.thump(0.17, 720, 0.07, 0.8, 0.5, 0.01); }],   // two knocks on a wooden block
  // --- yours ---
  coin: [0.4, K => { K.fm(0, 1568, 0.22, 0.4, 3.5, 2); K.fm(0.06, 2093, 0.2, 0.3, 3.5, 2); }],
  buy: [0.6, K => { K.pluck(0, 392, 0.7, 5000); K.pluck(0.07, 587, 0.6, 5000); K.fm(0.07, 1175, 0.4, 0.15, 2, 1); }],
  level: [1.1, K => { [587, 698, 880, 1175].forEach((f, i) => { K.pluck(i * 0.08, f, 0.7, 6000); K.fm(i * 0.08, f * 2, 0.5, 0.08, 2, 1); }); }],
  ping: [0.7, K => { K.thump(0, 560, 0.12, 0.9, 0.6, 0.01); K.thump(0.14, 750, 0.12, 0.8, 0.6, 0.01); K.fm(0.14, 1500, 0.4, 0.1, 2, 1); }],   // 木鱼, then a small chime
  recall: [1.8, K => { K.voice(0, 'sine', 220, 880, 1.4, 0.35, 0.3); K.burst(0, { c: 'pink', f0: 800, f1: 3600, q: 2, a: 0.4, d: 1.1, v: 0.35, sw: 1.3 }); K.fm(0.5, 880, 1.2, 0.12, 1.5, 1); }],
  arrive: [1.4, K => { K.burst(0, { c: 'pink', f0: 2600, f1: 300, q: 0.7, a: 0.01, d: 0.5, v: 0.9 }); K.thump(0.04, 60, 0.45, 0.9, 3); K.fm(0.06, 660, 1.1, 0.15, 1.5, 1.5); }],
  heart: [0.6, K => { K.thump(0, 62, 0.16, 1, 1.5); K.thump(0.24, 56, 0.17, 0.7, 1.5); }],
  click: [0.12, K => { K.thump(0, 1100, 0.03, 0.6, 0.3, 0.005); }],
};
export const names = Object.keys(BANK);

// render the whole bank, `n` variations each, handing each sound over as soon as it is ready. All variations of one sound share a
// single offline render (laid end to end with a gap) — far cheaper than one render each. The sounds heard most come first.
const FIRST = ['hit', 'smack', 'thud', 'slash', 'bow', 'xbow', 'cast', 'arrow', 'sword', 'whoosh', 'tower', 'crit', 'heavy'];
export async function renderBank(ctx, onSound, n = 3) {
  try { Tone.setContext(ctx); } catch { /* Tone keeps its own context; the offline renders do not need it */ }
  const sr = ctx.sampleRate, order = [...FIRST, ...names.filter(k => !FIRST.includes(k))];
  for (const name of order) {
    const [dur, design] = BANK[name], slot = dur + 0.15, out = [];
    try {
      const tb = await Tone.Offline(() => { const o = new Tone.Gain(1).toDestination(); for (let i = 0; i < n; i++) design(kit(o, i * slot)); }, slot * n, 1, sr);
      const all = tb.getChannelData(0), len = Math.floor(dur * sr), fade = Math.floor(sr * 0.02);
      for (let i = 0; i < n; i++) {
        const st = Math.floor(i * slot * sr); let pk = 0; for (let k = 0; k < len; k++) pk = Math.max(pk, Math.abs(all[st + k] || 0));
        if (!(pk > 1e-5)) continue;
        const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0), s = 0.95 / pk;
        for (let k = 0; k < len; k++) d[k] = (all[st + k] || 0) * s * (k > len - fade ? (len - k) / fade : 1);   // normalised, and no click at the end
        out.push(b);
      }
    } catch (e) { renderBank.err = (renderBank.err || '') + name + ': ' + String(e).slice(0, 120) + '\n'; }
    if (out.length) onSound(name, out);
    await new Promise(r => setTimeout(r, 0));                         // let a frame through between sounds
  }
}

// ---------------- the music's instruments ----------------
// A few recorded-once notes per instrument; audio.js pitches them with playbackRate to the score's pentatonic notes.
//   qin  — 古琴: a long, dark plucked silk string; after the attack the pitch breathes a little (吟)
//   xiao — 箫: soft attack, breath noise, vibrato that grows in; long enough to be faded out at any length
//   taiko / tang — a big war drum and a small one;  drone — a low, uneasy bed for a tribulation
function qinNote(f, len, sr) {
  const n = Math.floor(sr * len), N = Math.max(2, Math.round(sr / f)), a = new Float32Array(n);
  for (let i = 0; i < N; i++) a[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(Math.PI * i / N));
  for (let i = N; i < n; i++) a[i] = (a[i - N] * 0.38 + a[i - N - 1 < 0 ? 0 : i - N - 1] * 0.62) * 0.9985;   // dark and long
  return a;
}
const MUSIC = {
  qin110: [3.2, K => { const sr = Tone.getContext().sampleRate, s = new Tone.ToneBufferSource(Tone.ToneAudioBuffer.fromArray(qinNote(110, 3.2, sr))), f = new Tone.Filter({ type: 'lowpass', frequency: 2400, Q: 0.6 }), body = new Tone.Filter({ type: 'peaking', frequency: 220, gain: 4, Q: 1 });
    s.chain(body, f, K.o); new Tone.LFO(4.6, 0.996, 1.004).connect(s.playbackRate).start(0.5); s.start(0); K.thump(0, 70, 0.12, 0.15, 1); }],
  qin220: [2.6, K => { const sr = Tone.getContext().sampleRate, s = new Tone.ToneBufferSource(Tone.ToneAudioBuffer.fromArray(qinNote(220, 2.6, sr))), f = new Tone.Filter({ type: 'lowpass', frequency: 3200, Q: 0.6 });
    s.chain(f, K.o); new Tone.LFO(4.8, 0.996, 1.004).connect(s.playbackRate).start(0.45); s.start(0); }],
  qin440: [2.0, K => { const sr = Tone.getContext().sampleRate, s = new Tone.ToneBufferSource(Tone.ToneAudioBuffer.fromArray(qinNote(440, 2.0, sr))), f = new Tone.Filter({ type: 'lowpass', frequency: 4200, Q: 0.6 });
    s.chain(f, K.o); new Tone.LFO(5, 0.997, 1.003).connect(s.playbackRate).start(0.4); s.start(0); }],
  xiao440: [3.4, K => { const v = new Tone.Vibrato({ frequency: 5.2, depth: 0.08 }), lp = new Tone.Filter({ type: 'lowpass', frequency: 2600 }); v.chain(lp, K.o);
    const s = new Tone.FMSynth({ harmonicity: 1, modulationIndex: 0.6, oscillator: { type: 'sine' }, envelope: { attack: 0.28, decay: 0.2, sustain: 0.85, release: 0.6 }, volume: -4 }).connect(v); s.triggerAttackRelease(440, 2.6, 0);
    K.burst(0, { c: 'pink', f0: 880, q: 1.6, a: 0.25, d: 2.9, v: 0.12, sw: 2.9, dest: lp }); }],
  taiko: [1.0, K => { const g = K.grit(0.2); K.thump(0, 52, 0.7, 1, 2, 0.06, g); K.burst(0, { c: 'brown', ft: 'lowpass', f0: 420, f1: 120, a: 0.002, d: 0.22, v: 0.8 }); K.burst(0, { c: 'pink', f0: 1500, f1: 600, q: 1, a: 0.001, d: 0.03, v: 0.35 }); }],
  tang: [0.5, K => { K.thump(0, 125, 0.25, 1, 1.5, 0.03); K.burst(0, { c: 'pink', f0: 1100, f1: 500, q: 1.2, a: 0.001, d: 0.06, v: 0.45 }); }],
  drone: [6.0, K => { const s = new Tone.FMSynth({ harmonicity: 0.5, modulationIndex: 3, envelope: { attack: 1.2, decay: 0.5, sustain: 0.9, release: 1.5 }, modulationEnvelope: { attack: 2, decay: 1, sustain: 0.8, release: 1.5 }, volume: -6 }).connect(K.tone(500)); s.triggerAttackRelease(55, 4.3, 0);
    K.burst(0, { c: 'brown', ft: 'lowpass', f0: 160, a: 1.2, d: 4.6, v: 0.5, sw: 4.6, lfo: 0.7, depth: 0.5 }); }],
};
export async function renderMusic(ctx, onSound) {
  const sr = ctx.sampleRate;
  for (const [name, [dur, design]] of Object.entries(MUSIC)) {
    try {
      const tb = await Tone.Offline(() => { const o = new Tone.Gain(1).toDestination(); const K = kit(o); K.o = o; design(K); }, dur, 1, sr);
      const src = tb.getChannelData(0); let pk = 0; for (let k = 0; k < src.length; k++) pk = Math.max(pk, Math.abs(src[k]));
      if (!(pk > 1e-5)) continue; const b = ctx.createBuffer(1, src.length, sr), d = b.getChannelData(0), fade = Math.floor(sr * 0.05);
      for (let k = 0; k < src.length; k++) d[k] = src[k] / pk * 0.95 * (k > src.length - fade ? (src.length - k) / fade : 1);
      onSound(name, b);
    } catch (e) { renderMusic.err = (renderMusic.err || '') + name + ': ' + String(e).slice(0, 120) + '\n'; }
    await new Promise(r => setTimeout(r, 0));
  }
}
