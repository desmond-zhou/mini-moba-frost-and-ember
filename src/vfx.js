// vfx.js — the choreography of every ability: what it looks and sounds like when it is cast, while it travels, and when it lands.
// Rules live in game.js; this file only spends particles, decals, lights and screen punch. Each hero has their own colour,
// and each ability names a look (`vfx`) so several abilities can share one.
export function createVfx(fx, audio) {
  const V = {}, R = Math.random, W = [1.7, 1.7, 1.7], DUST = [0.24, 0.21, 0.17], FLAME = [1.0, 0.36, 0.07], ROCK = [0.085, 0.075, 0.065], SNOW = [0.55, 0.62, 0.7];
  const ALLY = [0.25, 0.8, 1.5], FOE = [1.8, 0.3, 0.12];
  const m = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const chunks = (x, z, n, sp, up, size = 0.34, a0 = 0, spread = 6.283, col = ROCK) => {
    for (let i = 0; i < n; i++) { const a = a0 + (R() - 0.5) * spread, s = sp * (0.3 + R() * 0.7); fx.debris(x + Math.cos(a) * 0.6, 0.4, z + Math.sin(a) * 0.6, Math.cos(a) * s, up * (0.5 + R()), Math.sin(a) * s, col, size * (0.6 + R() * 0.9), 1.0 + R() * 0.7); }
  };
  const embers = (x, z, c, n, r) => { for (let i = 0; i < n; i++) { const a = R() * 6.283, d = r * Math.sqrt(R()); fx.spark(x + Math.cos(a) * d, 0.3 + R(), z + Math.sin(a) * d, (R() - 0.5) * 1.5, 1.5 + R() * 3, (R() - 0.5) * 1.5, c, 0.22 + R() * 0.2, 1.2 + R() * 1.6, -0.8, 0.6, 0.02); } };
  const spiral = (x, z, c, n, r, up) => { for (let i = 0; i < n; i++) { const a = R() * 6.283; fx.spark(x + Math.cos(a) * r, 0.3 + R() * 2.5, z + Math.sin(a) * r, -Math.sin(a) * 9, up * (0.4 + R()), Math.cos(a) * 9, c, 0.3, 0.45 + R() * 0.3, 0, 1.5, 0.06); } };
  const cloud = (x, y, z, c, n, r, size, life, op = 0.45) => { for (let i = 0; i < n; i++) { const a = R() * 6.283, d = r * Math.sqrt(R()); fx.smoke(x + Math.cos(a) * d, y + R() * 1.2, z + Math.sin(a) * d, Math.cos(a) * 1.5, 0.3 + R(), Math.sin(a) * 1.5, c, size * (0.7 + R() * 0.6), life * (0.7 + R() * 0.6), op, 1.2, -0.2, 1.5); } };
  const lightning = (x, z, c, h = 22) => {
    let px = x + (R() - 0.5) * 5, py = h, pz = z + (R() - 0.5) * 5; const n = 7;
    for (let i = 1; i <= n; i++) { const t = i / n, nx = x + (R() - 0.5) * 3 * (1 - t), ny = h * (1 - t), nz = z + (R() - 0.5) * 3 * (1 - t); fx.line(px, py, pz, nx, ny, nz, m(c, 2.4), 9, 0.75, 0.17); px = nx; py = ny; pz = nz; }
    fx.pillar(x, z, 0.55, h, m(c, 1.6), 0.22); fx.flare(x, 1, z, m(c, 2.6), 9, 0.2); fx.flash(x, 3, z, c, 420, 0.3);
    fx.burst(x, 0.5, z, m(c, 1.6), { n: 16, speed: 11, up: 8, life: 0.4, size: 0.24, grav: 18 }); fx.decal({ mode: 6, x, z, size: 6, color: c, dur: 1.2, seed: R() });
  };
  const slash = (x, z, f, sz, half, c, y = 1.8, dur = 0.3) => fx.decal({ mode: 7, x, z, y, size: sz, size0: sz * 0.74, color: c, dur, rot: -f, arc: half, seed: R() });

  // the circle drawn on the ground before an area ability lands — a turning rune; blue for your side, red for the enemy's, green for healing
  V.telegraph = (x, z, radius, delay, hold, ally, heal) => fx.decal({ mode: 5, x, z, size: radius * 2.08, color: heal ? (ally ? [0.45, 1.3, 0.4] : [1.3, 0.8, 0.2]) : ally ? ALLY : FOE, dur: delay, hold, seed: R() });
  V.healed = (a, c) => { embers(a.x, a.z, m(c, 1.3), 10, 1.2); fx.ringWave(a.x, a.z, 4.5, c, 0.4); fx.flare(a.x, a.h * 0.6, a.z, c, 3.5, 0.25); };

  V.cast = (h, s, a) => {
    const c = h.fxCol, x = h.x, z = h.z, f = h.facing, { dx, dz, tx, tz } = a;
    audio.layer(s.vfx, x, z);
    if (s.key === 'R' && s.rank > 1) {                                  // 大成: a second ring and a column; 圆满: gold over everything
      fx.ringWave(x, z, 11, c, 0.5); fx.pillar(x, z, 1.4, 13, c, 0.5);
      if (s.rank > 2) { const g = [2.2, 1.7, 0.6]; fx.ringWave(x, z, 17, g, 0.65); fx.pillar(x, z, 2.2, 21, g, 0.7); fx.flash(x, 3, z, g, 380, 0.5); fx.shake(0.3); }
    }
    switch (s.vfx) {
      case 'cleave': {
        const half = s.angle * Math.PI / 360, sz = s.range * 2.15;
        slash(x, z, f, sz, half, m(c, 1.15)); slash(x, z, f, sz * 1.03, half, m(c, 0.55), 0.14, 0.4);
        fx.decal({ mode: 6, x: x + dx * s.range * 0.42, z: z + dz * s.range * 0.42, size: s.range * 1.7, color: c, dur: 2.0, seed: R() });
        for (let k = 0; k < 30; k++) { const an = f + (R() * 2 - 1) * half, sp = s.range * (2.2 + R() * 1.6); fx.spark(x + Math.cos(an) * 1.4, 0.5 + R() * 1.8, z + Math.sin(an) * 1.4, Math.cos(an) * sp, 1 + R() * 3, Math.sin(an) * sp, k % 3 ? c : W, 0.5, 0.3, 4, 2.5); }
        chunks(x + dx * 2.5, z + dz * 2.5, 11, 9, 8, 0.36, f, half * 2);
        fx.dust(x + dx * 3.2, z + dz * 3.2, DUST, { n: 9, speed: 6, size: 2.1, r: 1.8 });
        fx.flare(x + dx * 2.4, 1.9, z + dz * 2.4, m(c, 1.4), 4.5, 0.18); fx.flash(x + dx * 2, 2, z + dz * 2, c, 200, 0.3);
        fx.punch(0.16); fx.shake(0.22); audio.play('slash', x, z); break;
      }
      case 'gate': {
        const half = s.angle * Math.PI / 360, sz = s.range * 2.1;
        slash(x, z, f, sz, half, m(c, 1.15), 1.6, 0.26); slash(x, z, f, sz * 0.8, half, [1.5, 1.5, 1.5], 0.9, 0.2);
        fx.dome(x + dx * 2.2, z + dz * 2.2, 0.6, 2.8, c, 0.26); chunks(x + dx * 2.5, z + dz * 2.5, 7, 8, 7, 0.32, f, half * 2); fx.dust(x + dx * 3, z + dz * 3, DUST, { n: 9, speed: 7, size: 2.2, r: 1.5 });
        fx.flare(x + dx * 2.2, 2, z + dz * 2.2, [2, 1.9, 1.6], 6.5, 0.16); fx.flash(x + dx * 2, 2, z + dz * 2, c, 220, 0.3); fx.punch(0.2); fx.shake(0.3); audio.play('smack', x, z); audio.play('slash', x, z); break;
      }
      case 'bloodclaw': {
        const sz = s.range * 2.1;
        for (let k = -1; k <= 1; k++) slash(x, z, f + k * 0.3, sz * (1 - Math.abs(k) * 0.08), 0.13, m(c, 1.7), 1.2 + (k + 1) * 0.5, 0.28);
        slash(x, z, f, sz, s.angle * Math.PI / 360, m(c, 0.45), 0.14, 0.4);
        for (let k = 0; k < 26; k++) { const an = f + (R() * 2 - 1) * 0.6, sp = s.range * (2 + R() * 1.6); fx.spark(x + Math.cos(an) * 1.4, 0.6 + R() * 2, z + Math.sin(an) * 1.4, Math.cos(an) * sp, 1 + R() * 3, Math.sin(an) * sp, m(c, 1.4), 0.4, 0.3, 6, 2.4); }
        fx.flare(x + dx * 2.4, 1.9, z + dz * 2.4, m(c, 1.6), 5, 0.18); fx.flash(x + dx * 2, 2, z + dz * 2, c, 200, 0.3); fx.punch(0.14); fx.shake(0.2); audio.play('slash', x, z); break;
      }
      case 'taunt':
        fx.dome(x, z, 1, s.radius, m(c, 0.8), 0.42); fx.ringWave(x, z, s.radius * 2.2, c, 0.45); fx.ringWave(x, z, s.radius * 1.4, m(W, 0.6), 0.3); fx.pillar(x, z, 2, 9, m(c, 0.8), 0.5);
        fx.decal({ mode: 5, x, z, size: s.radius * 2.08, color: m(c, 0.6), dur: 0.3, hold: 1.2, seed: R() }); spiral(x, z, c, 22, 2, 6); fx.flare(x, 3, z, m(c, 2), 8, 0.25);
        fx.flash(x, 2.5, z, c, 260, 0.4); fx.punch(0.2); fx.shake(0.3); audio.play('shout', x, z); audio.play('shield', x, z); break;
      case 'hook': fx.flare(x + dx * 1.3, 2, z + dz * 1.3, m(c, 1.8), 4.5, 0.16); fx.ringWave(x, z, 5, c, 0.25); audio.play('whoosh', x, z); break;
      case 'bloodsea':
        fx.decal({ mode: 0, x, z, size: s.radius * 2.5, color: [c[0] * 0.8, c[1] * 0.5, c[2] * 0.5], dur: 0.4, hold: s.dur, alpha: 0.85 }); fx.pillar(x, z, 2.2, 10, c, 0.6); fx.dome(x, z, 1, s.radius, c, 0.5);
        cloud(x, 0.4, z, [c[0] * 0.14, 0.01, 0.01], 12, s.radius * 0.7, 3, 1.4, 0.6); fx.flare(x, 2.5, z, m(c, 1.8), 7, 0.28); fx.punch(0.2); audio.play('charge', x, z); break;
      case 'firestep': for (let k = 0; k < 6; k++) fx.fire(x + (R() - 0.5), 0.6 + R(), z + (R() - 0.5), -dx * 3, 1.5, -dz * 3, c, 1.8, 0.35); fx.flare(x, 1.6, z, m(c, 1.6), 4.5, 0.16); fx.ringWave(x, z, 5, c, 0.25); audio.play('whoosh', x, z); break;
      case 'sunarrow':
        fx.flare(x + dx * 1.8, 2, z + dz * 1.8, [3, 2.2, 1.2], 11, 0.24); fx.pillar(x, z, 1.4, 10, c, 0.4); fx.ringWave(x, z, 9, c, 0.35); fx.ringWave(x + dx * 3, z + dz * 3, 6, W, 0.25);
        fx.dust(x - dx, z - dz, DUST, { n: 12, speed: 8, size: 2.2 }); for (let k = 0; k < 8; k++) fx.fire(x + dx * 1.5, 1.8, z + dz * 1.5, dx * 6 + (R() - 0.5) * 4, 1 + R() * 2, dz * 6 + (R() - 0.5) * 4, c, 2, 0.35);
        fx.flash(x + dx * 2, 2, z + dz * 2, c, 320, 0.35); fx.punch(0.25); fx.shake(0.35); audio.play('boom', x, z); audio.play('arrow', x, z); break;
      case 'concuss': {
        const half = s.angle * Math.PI / 360;
        for (let k = 0; k < 36; k++) { const an = f + (R() * 2 - 1) * half, sp = s.range * (2.6 + R() * 2); fx.spark(x + Math.cos(an) * 1.2, 1.2 + R(), z + Math.sin(an) * 1.2, Math.cos(an) * sp, R() * 2, Math.sin(an) * sp, k % 2 ? m(c, 1.5) : W, 0.36, 0.26, 0, 2.5); }
        for (let k = 1; k <= 3; k++) slash(x, z, f, s.range * (0.7 + k * 0.45), half, m(W, 0.5 + 0.2 * k), 1.6, 0.16 + k * 0.06);
        fx.flare(x + dx * 1.5, 1.8, z + dz * 1.5, [2.4, 2.2, 1.8], 9, 0.18); fx.flash(x + dx * 2, 2, z + dz * 2, [1, 0.95, 0.8], 380, 0.25);
        cloud(x + dx * 2, 1, z + dz * 2, [0.3, 0.28, 0.25], 6, 1.5, 2.2, 0.8, 0.3); fx.punch(0.3); fx.shake(0.3); audio.play('blast', x, z); break;
      }
      case 'whirl': case 'frostnova': {
        const ice = s.vfx === 'frostnova', r = s.radius;
        slash(x, z, f + Math.PI, r * 2.2, Math.PI, m(c, 1.15), 1.7, 0.34); slash(x, z, f, r * 2.3, Math.PI, m(c, 0.6), 0.14, 0.42);
        fx.dome(x, z, 0.6, r * 1.05, m(c, 1.2), 0.36); fx.ringWave(x, z, r * 2.4, c, 0.4); fx.flare(x, 1.8, z, m(c, 2), 7, 0.22);
        for (let k = 0; k < 34; k++) { const an = R() * 6.283, sp = r * (2 + R() * 1.6); fx.spark(x + Math.cos(an) * 1.2, 0.5 + R() * 2, z + Math.sin(an) * 1.2, Math.cos(an) * sp - Math.sin(an) * 5, 1 + R() * 2, Math.sin(an) * sp + Math.cos(an) * 5, k % 3 ? c : W, 0.42, 0.32, 3, 2.4); }
        if (ice) { fx.decal({ mode: 6, x, z, size: r * 2.5, color: c, dur: 2.2, seed: R() }); cloud(x, 0.5, z, SNOW, 12, r * 0.8, 2.6, 1.2, 0.4); chunks(x, z, 14, 9, 7, 0.3, 0, 6.283, [0.5, 0.62, 0.72]); audio.play(s.vfx === 'whirl' ? 'heavy' : 'magic', x, z); }
        else { chunks(x, z, 10, 9, 7); fx.dust(x, z, DUST, { n: 12, speed: 8, size: 2.2, r: 1.5 }); audio.play('slash', x, z); }
        fx.flash(x, 2, z, c, 240, 0.32); fx.punch(0.2); fx.shake(0.25); break;
      }
      case 'bulwark': case 'ward':
        fx.dome(x, z, 0.8, s.aoe ? s.aoe : 3.6, m(c, 1.2), 0.42); fx.ringWave(x, z, s.aoe ? s.aoe * 2 : 8, c, 0.45); fx.pillar(x, z, 1.7, 7, c, 0.4);
        spiral(x, z, c, 16, 1.6, 5); fx.flare(x, 2.6, z, m(c, 1.6), 5, 0.25); fx.flash(x, 2.5, z, c, 180, 0.35); audio.play('shield', x, z); break;
      case 'charge': case 'iceslide': case 'shadowstep':
        if (s.vfx === 'shadowstep') cloud(x, 0.6, z, [c[0] * 0.12, c[1] * 0.12, c[2] * 0.12], 9, 1, 2.4, 0.7, 0.6); else fx.dust(x, z, s.vfx === 'iceslide' ? SNOW : DUST, { n: 12, speed: 7, size: 2.2 });
        fx.ringWave(x, z, 7, c, 0.3); fx.flare(x, 2, z, m(c, 1.5), 4.5, 0.18); if (s.vfx === 'charge') chunks(x, z, 6, 6, 6, 0.3, f + Math.PI, 2); audio.play('whoosh', x, z); break;
      case 'skyfall':
        fx.dust(x, z, DUST, { n: 16, speed: 8, size: 2.6 }); fx.ringWave(x, z, 9, c, 0.35); chunks(x, z, 8, 7, 9); fx.pillar(x, z, 1.3, 8, c, 0.3); audio.play('whoosh', x, z); break;
      case 'starbolt': case 'orb': case 'vine': case 'axe':
        fx.flare(x + dx * 1.4, 2.4, z + dz * 1.4, m(c, 2), 5, 0.2); fx.ringWave(x + dx, z + dz, 4.5, c, 0.25); spiral(x + dx, z + dz, c, 8, 0.8, 2); audio.play(s.vfx === 'axe' || s.vfx === 'vine' ? 'whoosh' : s.vfx === 'starbolt' ? 'cast' : 'zap', x, z, s.vfx === 'vine' ? 0.7 : 1); break;
      case 'fan':
        fx.flare(x + dx * 1.3, 2, z + dz * 1.3, m(c, 2), 4.5, 0.16); slash(x, z, f, 5.5, 0.5, m(c, 1.2), 1.7, 0.18); audio.play('arrow', x, z); break;
      case 'well': fx.flare(x, 3.6, z, m(c, 1.6), 4.5, 0.25); spiral(x, z, c, 10, 1.2, 4); audio.play('charge', x, z); break;
      case 'phase':
        fx.pillar(a.ox, a.oz, 0.9, 10, c, 0.38); fx.burst(a.ox, 1.8, a.oz, c, { n: 22, speed: 5, up: 6, life: 0.5, size: 0.28, grav: 2 }); fx.ringWave(a.ox, a.oz, 5, c, 0.3);
        fx.line(a.ox, 2, a.oz, x, 2, z, m(c, 1.4), 26, 0.6, 0.38);
        fx.pillar(x, z, 1.1, 11, c, 0.45); fx.dome(x, z, 0.5, 2.8, c, 0.3); fx.ringWave(x, z, 6.5, c, 0.35); fx.burst(x, 1.8, z, c, { n: 26, speed: 7, up: 7, life: 0.55, size: 0.28, grav: 3 });
        fx.flare(x, 2.4, z, m(c, 2.2), 7, 0.24); fx.flash(x, 2.4, z, c, 260, 0.4); audio.play('magic', x, z); break;
      case 'reap': {
        const t = a.victim;
        cloud(a.ox, 0.6, a.oz, [c[0] * 0.1, c[1] * 0.1, c[2] * 0.1], 8, 1, 2.4, 0.7, 0.6); fx.line(a.ox, 1.8, a.oz, x, 1.8, z, m(c, 1.3), 22, 0.5, 0.32);
        slash(t.x, t.z, f + 0.7, 7.5, 1.3, m(c, 1.9), 2.0, 0.26); slash(t.x, t.z, f - 0.7, 7.5, 1.3, [1.8, 1.8, 1.8], 1.6, 0.3);
        fx.flare(t.x, 2, t.z, m(c, 2.4), 9, 0.22); fx.burst(t.x, 1.6, t.z, m(c, 1.5), { n: 30, speed: 12, up: 6, life: 0.5, size: 0.28, grav: 12 });
        fx.ringWave(t.x, t.z, 8, c, 0.35); fx.flash(t.x, 2, t.z, c, 320, 0.35); fx.punch(0.42); fx.hitStop(0.05); fx.shake(0.4); audio.play('slash', x, z); break;
      }
      case 'mend':
        fx.decal({ mode: 5, x: tx, z: tz, size: s.radius * 2.08, color: [0.45, 1.3, 0.4], dur: 0.5, hold: 0.25, seed: R() }); fx.pillar(tx, tz, s.radius * 0.5, 8, c, 0.6);
        embers(tx, tz, m(c, 1.4), 26, s.radius); fx.ringWave(tx, tz, s.radius * 2.2, c, 0.5); fx.flare(tx, 2, tz, m(c, 1.5), 6, 0.3);
        for (const al of a.healed || []) V.healed(al, c);
        fx.flash(tx, 2, tz, c, 200, 0.4); audio.play('shield', x, z); break;
      case 'bloom': fx.pillar(x, z, 2, 12, c, 0.7); fx.dome(x, z, 0.8, s.radius, c, 0.6); embers(x, z, m(c, 1.4), 30, s.radius); fx.flare(x, 3, z, m(c, 1.6), 7, 0.3); audio.play('heal', x, z); break;
      case 'swallow':                                                  // 回燕: a crescent thrown flat
        slash(x + dx * 1.5, z + dz * 1.5, f, 6, 1.5, m(c, 1.5), 1.6, 0.28); fx.flare(x + dx * 1.4, 1.8, z + dz * 1.4, m(c, 2), 4.5, 0.16); audio.play('sword', x, z); audio.play('whoosh', x, z, 0.6); break;
      case 'greatwave':                                                // 万剑听雪: the whole field in one stroke
        for (let k = 0; k < 3; k++) slash(x + dx * (2 + k * 2.2), z + dz * (2 + k * 2.2), f, 9 + k * 3, 1.2, m(c, 1.7 - k * 0.3), 1.8, 0.4 + k * 0.08);
        fx.line(x, 1.6, z, x + dx * 30, 1.6, z + dz * 30, m(c, 1.6), 40, 0.7, 0.4); fx.flash(x, 3, z, c, 420, 0.4); fx.shake(0.4); fx.punch(0.3); audio.play('sword', x, z); audio.play('whoosh', x, z, 0.9); break;
      case 'snipe':                                                    // 冰封三百年: a line of sight, then the shot
        fx.line(x, 1.9, z, x + dx * 29, 1.9, z + dz * 29, m(c, 2.2), 46, 0.34, 0.5); fx.flare(x + dx * 1.6, 2, z + dz * 1.6, [2.6, 2.8, 3], 8, 0.25); fx.ringWave(x, z, 9, c, 0.35);
        fx.dust(x - dx, z - dz, SNOW, { n: 12, speed: 7, size: 2 }); fx.flash(x, 2.5, z, c, 380, 0.35); fx.shake(0.35); fx.punch(0.25); audio.play('ice', x, z); audio.play('heavy', x, z, 0.8); break;
      case 'emplace':                                                  // 镇岳: feet planted
        fx.decal({ mode: 5, x, z, size: 7.5, color: m(c, 0.9), dur: 0.4, hold: s.dur, seed: R() }); fx.dome(x, z, 0.4, 2.4, c, 0.3); chunks(x, z, 8, 5, 5, 0.3); fx.dust(x, z, DUST, { n: 10, speed: 5, size: 1.8 }); fx.shake(0.2); audio.play('thud', x, z); audio.play('tower', x, z, 0.5); break;
      case 'stride':                                                   // 踏星: a wall that runs
        fx.dome(x, z, 0.8, 3.4, c, 0.4); fx.ringWave(x, z, 9, c, 0.4); for (let k = 0; k < 5; k++) fx.flare(x + Math.cos(f) * (1 + k * 0.9), 0.5, z + Math.sin(f) * (1 + k * 0.9), m(c, 1.6), 2.2, 0.2 + k * 0.05); fx.dust(x, z, DUST, { n: 10, speed: 8, size: 2 }); audio.play('shield', x, z); audio.play('whoosh', x, z, 0.7); break;
      case 'seize':                                                    // 镇渊: chains drawn tight to the centre
        for (let k = 0; k < 10; k++) { const a = k * 0.6283 + R() * 0.2; fx.line(x + Math.cos(a) * s.radius, 0.4 + R() * 2.4, z + Math.sin(a) * s.radius, x, 1.6, z, m(c, 1.9), 16, 0.5, 0.34); }
        fx.decal({ mode: 1, x, z, size: 2.5, size0: s.radius * 2.1, color: m(c, 0.9), dur: 0.34 }); fx.pillar(x, z, 1.8, 14, c, 0.5); fx.flash(x, 3, z, c, 420, 0.45); fx.shake(0.5); fx.punch(0.3); chunks(x, z, 14, 4, 9, 0.3); audio.play('earth', x, z); audio.play('heavy', x, z); break;
      case 'verdict':                                                  // 一剑清正: one straight line
        fx.line(x, 1.7, z, x + dx * 13, 1.7, z + dz * 13, [2.6, 2.6, 2.4], 30, 0.6, 0.38); for (let k = 0; k < 4; k++) slash(x + dx * (2 + k * 3), z + dz * (2 + k * 3), f, 5, 0.9, m(c, 1.6), 1.7, 0.3 + k * 0.05);
        fx.flash(x, 2.5, z, c, 360, 0.35); fx.punch(0.3); audio.play('sword', x, z); audio.play('slash', x, z, 0.8); break;
      case 'flashstep':                                                // 雷行: he is the bolt
        { let px = x, pz = z; for (let k = 1; k <= 6; k++) { const t = k / 6 * 8.5, nx = x + dx * t + (R() - 0.5) * 1.4, nz = z + dz * t + (R() - 0.5) * 1.4; fx.line(px, 1.6 + R(), pz, nx, 1.2 + R() * 1.4, nz, m(c, 2.4), 8, 0.6, 0.22); px = nx; pz = nz; } }
        fx.flare(x, 2, z, m(c, 2.4), 6, 0.18); fx.flash(x, 2.5, z, c, 320, 0.25); audio.play('zap', x, z); audio.play('thunder', x, z, 0.5); break;
      case 'teamveil':                                                 // 藏形幕: a curtain let down over everyone near
        fx.dome(x, z, 1, s.aoe, [c[0] * 0.5, c[1] * 0.5, c[2] * 0.6], 0.7); fx.decal({ mode: 1, x, z, size: 3, size0: s.aoe * 2, color: m(c, 0.7), dur: 0.5 }); cloud(x, 0.5, z, [0.05, 0.06, 0.09], 30, s.aoe * 0.8, 3.4, 1.6, 0.6); spiral(x, z, c, 20, 2, 5); audio.play('wind', x, z); audio.play('shield', x, z, 0.6); break;
      case 'pill':                                                     // 行气丹: one flicked to each
        fx.ringWave(x, z, s.aoe * 2, c, 0.5); for (let k = 0; k < 8; k++) { const a = k * 0.785; fx.spark(x, 2.2, z, Math.cos(a) * 14, 6, Math.sin(a) * 14, m(c, 1.8), 0.4, 0.4, 14, 0.5, 0.05); } embers(x, z, m(c, 1.4), 22, s.aoe * 0.7); fx.flare(x, 2.4, z, m(c, 1.6), 4.5, 0.22); audio.play('heal', x, z); audio.play('wind', x, z, 0.6); break;
      case 'meteor': case 'blizzard': case 'tempest': case 'barrage': case 'bolt': case 'shell': case 'stasis':
        fx.flare(x, 4.2, z, m(c, 2), 6, 0.3); fx.pillar(x, z, 1.2, 12, c, 0.5); spiral(x, z, c, 14, 1.4, 6); audio.play(s.vfx === 'shell' || s.vfx === 'barrage' ? 'whoosh' : 'charge', x, z); break;
      case 'pierce': case 'icelance': case 'firearrow':
        fx.flare(x + dx * 1.6, 2, z + dz * 1.6, m(c, 2.2), 5.5, 0.18);
        for (let k = 1; k <= 3; k++) fx.decal({ mode: 1, x: x + dx * k * 3.4, z: z + dz * k * 3.4, size: 3.2 + k * 0.8, color: m(c, 0.7), dur: 0.22 + k * 0.07 });
        fx.dust(x - dx, z - dz, s.vfx === 'icelance' ? SNOW : DUST, { n: 5, speed: 4, size: 1.5 }); audio.play('arrow', x, z); break;
      case 'veil': case 'rage':
        fx.ringWave(x, z, 8, c, 0.4); fx.dome(x, z, 0.6, 2.8, c, 0.32); spiral(x, z, c, 26, 1.5, 7); fx.flare(x, 2.2, z, m(c, 1.5), 4.5, 0.22);
        if (s.vfx === 'veil') cloud(x, 0.5, z, [c[0] * 0.1, c[1] * 0.1, c[2] * 0.1], 16, 1.8, 3, 1.4, 0.7);
        else if (s.vfx === 'rage') { fx.pillar(x, z, 1.6, 10, c, 0.5); embers(x, z, c, 18, 1.5); fx.flash(x, 2, z, c, 220, 0.4); fx.punch(0.15); }
        audio.play('whoosh', x, z); break;
      case 'backshot':
        fx.flare(x + dx * 1.2, 2, z + dz * 1.2, m(c, 2), 4.5, 0.18); fx.dust(x, z, DUST, { n: 9, speed: 6, size: 1.8 }); fx.ringWave(x, z, 5, c, 0.25); audio.play('arrow', x, z); break;
    }
  };

  // ---- basic attacks ----
  // weight: 0 = minion, 1 = hero, 2 = tower. Sparks fly on along the direction of the blow.
  V.basicHit = (t, dx, dz, c, weight, crit, who) => {
    const y = t.h * 0.5, k = (weight === 0 ? 0.55 : 1) * (crit ? 1.7 : 1), hot = [2.6, 2.1, 1.4];
    for (let i = 0; i < Math.round(10 * k); i++) fx.spark(t.x, y + (R() - 0.5), t.z, dx * (8 + R() * 13) + (R() - 0.5) * 9, 1 + R() * 6, dz * (8 + R() * 13) + (R() - 0.5) * 9, i % 2 ? hot : m(c, 1.5), 0.26 * (crit ? 1.3 : 1), 0.34, 18, 1);
    fx.flare(t.x - dx * t.r * 0.6, y, t.z - dz * t.r * 0.6, crit ? [3, 2.6, 1.6] : [1.9, 1.7, 1.4], (weight === 0 ? 2.4 : 4.2) * (crit ? 1.7 : 1), 0.13);
    fx.decal({ mode: 1, x: t.x, z: t.z, size: (t.r * 2 + 2.6) * (crit ? 1.6 : 1), size0: t.r * 2, color: crit ? [2, 1.7, 0.9] : m(c, 0.8), dur: 0.22 });
    if (weight > 0) { fx.smoke(t.x, 0.5, t.z, dx * 2.5, 0.8, dz * 2.5, DUST, 1.4, 0.5, 0.24); fx.flash(t.x, 2, t.z, crit ? [1, 0.9, 0.6] : c, crit ? 220 : 100, 0.2); }
    if (crit) { fx.dome(t.x, t.z, 0.4, t.r + 1.8, [1.5, 1.3, 0.7], 0.24); chunks(t.x, t.z, 5, 7, 6, 0.24, Math.atan2(dz, dx), 1.4); audio.play('crit', t.x, t.z); }
    if (who) audio.play('h_' + who, t.x, t.z, 1, 'smack'); else audio.play(weight === 0 ? 'hit' : 'smack', t.x, t.z);
  };
  V.basic = (e, t, c, crit) => {
    if (e.ranged) { if (e.kind !== 'minion') fx.flare(e.x + Math.cos(e.facing) * 0.9, e.kind === 'tower' ? e.view.muzzleY : e.h * 0.58, e.z + Math.sin(e.facing) * 0.9, m(c, 1.6), e.kind === 'tower' ? 5 : crit ? 4.2 : 2.8, 0.14); return; }
    const hero = e.kind === 'hero', dx = t.x - e.x, dz = t.z - e.z, d = Math.hypot(dx, dz) || 1;
    if (hero) {
      const sz = (e.range + 2.2) * 2 * (crit ? 1.2 : 1), col = [1.2 + c[0] * 0.6, 1.1 + c[1] * 0.6, 1.0 + c[2] * 0.6];
      slash(e.x, e.z, e.facing, sz, 1.05, col, 1.9, 0.22); slash(e.x, e.z, e.facing, sz * 0.86, 0.85, m(c, 0.9), 1.3, 0.28);
      audio.play('w_' + e.def.id, e.x, e.z, 1, e.def.style === 'axe' || e.def.style === 'shield' ? 'heavy' : 'slash');
    }
    V.basicHit(t, dx / d, dz / d, c, hero ? 1 : 0, crit, hero ? e.def.id : null);
  };

  // ---- projectiles ----
  V.projTick = (p, dt) => {
    if (p.sid === 'swallow') { p.spin += dt * 20; if ((p.fxN = (p.fxN || 0) + 1) % 2 === 0) slash(p.x, p.z, p.spin, 3.6, 1.3, m(p.color, 1.5), p.y, 0.14); }
    const c = p.color, id = p.sid;
    if (id === 'starbolt') {
      p.spin += dt * 20; const nx = -p.dz, nz = p.dx;
      for (const s of [0, Math.PI]) { const co = Math.cos(p.spin + s) * 0.62, si = Math.sin(p.spin + s) * 0.62; fx.spark(p.x + nx * co, p.y + si, p.z + nz * co, -p.dx * 5, 0, -p.dz * 5, m(c, 1.3), 0.34, 0.34, 0, 0, 0.03); }
      fx.fire(p.x - p.dx * 0.5, p.y, p.z - p.dz * 0.5, -p.dx * 4, 0.6, -p.dz * 4, c, 1.5, 0.3, 0.2);
      if (R() < 0.3) fx.flare(p.x, p.y, p.z, m(c, 1.4), 2.4, 0.1);
    } else if (id === 'hook') {                      // a chain of blood between the caster and the claw
      const sx = p.src.x, sz = p.src.z, n = Math.min(22, Math.ceil(Math.hypot(p.x - sx, p.z - sz) / 0.7));
      fx.line(sx, 1.8, sz, p.x, p.y, p.z, m(c, 1.3), n, 0.34, 0.06); fx.flare(p.x, p.y, p.z, m(c, 1.5), 2.6, 0.08);
    } else if (id === 'sunarrow') {
      for (let k = 0; k < 2; k++) fx.fire(p.x - p.dx * k, p.y, p.z - p.dz * k, -p.dx * 5 + (R() - 0.5) * 2, 0.8, -p.dz * 5 + (R() - 0.5) * 2, c, 2.8, 0.4, 0.4);
      for (let k = 0; k < 3; k++) fx.spark(p.x + (R() - 0.5), p.y + (R() - 0.5), p.z + (R() - 0.5), -p.dx * 12 + (R() - 0.5) * 6, R() * 3, -p.dz * 12 + (R() - 0.5) * 6, [3, 1.8, 0.6], 0.36, 0.4, 8, 0.5);
      fx.smoke(p.x, p.y, p.z, 0, 0.8, 0, [0.07, 0.06, 0.055], 1.6, 0.8, 0.3); if (R() < 0.4) fx.flare(p.x, p.y, p.z, [2.6, 1.8, 0.8], 5, 0.1);
    } else if (id === 'pierce' || id === 'icelance' || id === 'fan' || id === 'firearrow') {
      for (let k = 0; k < 3; k++) fx.spark(p.x - p.dx * k * 0.5 + (R() - 0.5) * 0.3, p.y + (R() - 0.5) * 0.3, p.z - p.dz * k * 0.5 + (R() - 0.5) * 0.3, -p.dx * 14, 0, -p.dz * 14, m(c, 1.3), 0.34, 0.26, 0, 0, 0.09);
      if (id === 'icelance' && R() < 0.6) fx.smoke(p.x, p.y, p.z, 0, 0.3, 0, SNOW, 1.0, 0.6, 0.3); else if (id === 'firearrow') fx.fire(p.x, p.y, p.z, -p.dx * 3, 0.6, -p.dz * 3, c, 1.3, 0.3); else if (id === 'shellshot') fx.fire(p.x, p.y, p.z, -p.dx * 3, 0.5, -p.dz * 3, FLAME, 1.2, 0.25);
      else if (R() < 0.35) fx.smoke(p.x, 0.5, p.z, (R() - 0.5), 0.6, (R() - 0.5), DUST, 1.1, 0.5, 0.12);
    } else if (id === 'orb') {
      for (let k = 0; k < 2; k++) { const a = R() * 6.283, b = R() * 6.283, r = 0.9; fx.line(p.x, p.y, p.z, p.x + Math.cos(a) * Math.cos(b) * r, p.y + Math.sin(b) * r, p.z + Math.sin(a) * Math.cos(b) * r, m(c, 1.8), 4, 0.3, 0.09); }
      if (R() < 0.5) fx.flare(p.x, p.y, p.z, m(c, 1.6), 3.2, 0.1);
    } else if (id === 'axe') {
      p.spin += dt * 26; fx.spark(p.x + Math.cos(p.spin) * 0.7, p.y, p.z + Math.sin(p.spin) * 0.7, -Math.sin(p.spin) * 8, 0, Math.cos(p.spin) * 8, m(c, 1.4), 0.34, 0.22, 0, 0, 0.08);
      fx.spark(p.x - Math.cos(p.spin) * 0.7, p.y, p.z - Math.sin(p.spin) * 0.7, Math.sin(p.spin) * 8, 0, -Math.cos(p.spin) * 8, W, 0.3, 0.2, 0, 0, 0.08);
    } else if (id === 'vine') {
      p.spin += dt * 14; fx.spark(p.x - p.dz * Math.sin(p.spin) * 0.5, p.y + Math.cos(p.spin) * 0.3, p.z + p.dx * Math.sin(p.spin) * 0.5, 0, 0, 0, m(c, 1.2), 0.4, 0.5, 0, 0, 0);
    } else fx.spark(p.x, p.y, p.z, (R() - 0.5) * 1.5, R(), (R() - 0.5) * 1.5, c, p.size * 2.2, 0.28, 0, 0, 0);
  };
  V.projHit = (p, e) => {
    const c = p.color, id = p.sid;
    if (id === 'hook') { fx.flare(e.x, 1.8, e.z, m(c, 2), 6, 0.18); fx.ringWave(e.x, e.z, 6, c, 0.3); fx.burst(e.x, 1.6, e.z, m(c, 1.4), { n: 16, speed: 8, life: 0.4, size: 0.28, grav: 10 }); fx.line(p.src.x, 1.8, p.src.z, e.x, 1.6, e.z, m(c, 1.6), 20, 0.5, 0.34); fx.punch(0.15); audio.play('smack', e.x, e.z); }
    else if (id === 'pierce' || id === 'icelance' || id === 'fan' || id === 'firearrow') { for (let k = 0; k < 12; k++) fx.spark(e.x, 1.2 + R(), e.z, p.dx * (10 + R() * 12) + (R() - 0.5) * 8, 2 + R() * 5, p.dz * (10 + R() * 12) + (R() - 0.5) * 8, m(c, 1.4), 0.3, 0.35, 14, 1); fx.flare(e.x, 1.8, e.z, m(c, 1.6), 3.4, 0.14); if (id === 'icelance') cloud(e.x, 0.8, e.z, SNOW, 3, 0.6, 1.6, 0.7, 0.35); }
    else if (id === 'vine') { spiral(e.x, e.z, c, 14, e.r + 0.4, 1); fx.decal({ mode: 5, x: e.x, z: e.z, size: e.r * 2 + 3, color: c, dur: 0.3, hold: 0.5, seed: R() }); fx.flare(e.x, 1.6, e.z, m(c, 1.5), 4, 0.2); }
    else if (id === 'axe') { fx.flare(e.x, 1.8, e.z, [1.8, 1.6, 1.3], 5, 0.16); fx.burst(e.x, 1.5, e.z, [2.4, 1.8, 1.0], { n: 16, speed: 10, up: 6, life: 0.35, size: 0.26, grav: 18 }); fx.punch(0.1); }
    else fx.burst(e.x, 1.5, e.z, c, { n: 10, speed: 7, life: 0.35, size: 0.28 });
    audio.play('thud', e.x, e.z); audio.layer(p.sid, e.x, e.z, 0.6);
  };
  V.projBurst = p => {
    const c = p.color, r = p.splash;
    if (p.sid === 'sunarrow') { fx.explosion(p.x, p.z, 1.3, FLAME); fx.decal({ mode: 6, x: p.x, z: p.z, size: r * 2.6, color: [1.4, 0.45, 0.06], dur: 3, seed: R() }); chunks(p.x, p.z, 14, 11, 11); fx.punch(0.45); fx.shake(0.6); audio.play('boom', p.x, p.z); }
    fx.ringWave(p.x, p.z, r * 2.6, c, 0.35); fx.dome(p.x, p.z, 0.4, r * 1.15, c, 0.28); fx.flare(p.x, 1.6, p.z, m(c, 2.2), 7, 0.22);
    fx.burst(p.x, 1.4, p.z, m(c, 1.3), { n: 26, speed: 10, up: 6, life: 0.55, size: 0.3, grav: 8 });
    if (p.sid === 'orb') { for (let k = 0; k < 5; k++) { const a = R() * 6.283; fx.line(p.x, 1.6, p.z, p.x + Math.cos(a) * r, 0.4 + R() * 2, p.z + Math.sin(a) * r, m(c, 2), 8, 0.5, 0.16); } }
    else for (let k = 0; k < 6; k++) fx.fire(p.x, 1.4, p.z, (R() - 0.5) * 6, 1 + R() * 2, (R() - 0.5) * 6, c, 2.2, 0.4);
    fx.flash(p.x, 2, p.z, c, 240, 0.35);
  };

  // ---- area abilities ----
  V.zoneTick = (z, dt) => {
    const c = z.col, pre = z.t < z.delay, id = z.sid, k = pre ? 1 - z.t / z.delay : 0;
    if (id === 'well' && pre) {
      for (let j = 0; j < 3; j++) { const a = R() * 6.28, r = z.r * (0.55 + R() * 0.55); fx.spark(z.x + Math.cos(a) * r, 0.3 + R() * 2.4, z.z + Math.sin(a) * r, -Math.cos(a) * r * 1.7 - Math.sin(a) * 6, 0.5, -Math.sin(a) * r * 1.7 + Math.cos(a) * 6, c, 0.38, 0.5, 0, 0, 0.06); }
      if (R() < 0.3) fx.smoke(z.x + (R() - 0.5) * z.r, 0.6, z.z + (R() - 0.5) * z.r, 0, 0.3, 0, [c[0] * 0.08, c[1] * 0.08, c[2] * 0.08], 2.2, 0.6, 0.3, 0.6);
    } else if (id === 'meteor' && pre) {
      const mx = z.x - 9 * k, my = 30 * k + 1, mz = z.z - 6 * k;
      fx.fire(mx, my, mz, 3 * k, 5, 2 * k, FLAME, 3.6, 0.45); fx.fire(mx, my, mz, 0, 0, 0, c, 2.2, 0.2, 0.2); fx.smoke(mx, my + 0.5, mz, 2 * k, 3, k, [0.07, 0.065, 0.06], 2.4, 1.2, 0.45);
      for (let j = 0; j < 2; j++) fx.spark(mx + (R() - 0.5), my + (R() - 0.5), mz + (R() - 0.5), 9 * k + (R() - 0.5) * 6, 8, 6 * k + (R() - 0.5) * 6, [3.2, 1.3, 0.3], 0.36, 0.5, 14);
      if (R() < 0.4) fx.flare(mx, my, mz, [2.4, 1.2, 0.5], 5, 0.1);
      if (R() < 0.5) { const a = R() * 6.28, r = z.r * Math.sqrt(R()); fx.spark(z.x + Math.cos(a) * r, 0.2, z.z + Math.sin(a) * r, 0, 3 + R() * 4, 0, FLAME, 0.3, 0.5, 0, 0, 0.05); }
    } else if (id === 'shell' && pre) {
      const sx = z.src.x, sz = z.src.z, t = 1 - k, px = sx + (z.x - sx) * t, pz = sz + (z.z - sz) * t, py = 1.8 + Math.sin(t * Math.PI) * 9;
      fx.fire(px, py, pz, 0, 0, 0, FLAME, 1.4, 0.22, 0.2); fx.smoke(px, py, pz, 0, 0.5, 0, [0.1, 0.09, 0.08], 1.2, 0.7, 0.35); fx.spark(px, py, pz, 0, 0, 0, [2.6, 1.6, 0.6], 0.5, 0.12, 0, 0, 0);
    } else if (id === 'bolt' && pre) {
      for (let j = 0; j < 2; j++) { const a = R() * 6.28, r = z.r * (0.6 + R() * 0.8); fx.spark(z.x + Math.cos(a) * r, 0.3 + R() * 3, z.z + Math.sin(a) * r, -Math.cos(a) * r * 3, 4, -Math.sin(a) * r * 3, m(c, 1.5), 0.3, 0.3, 0, 0, 0.07); }
      if (R() < 0.25) fx.flare(z.x + (R() - 0.5) * 3, 18 + R() * 4, z.z + (R() - 0.5) * 3, m(c, 1.6), 5, 0.12);
    } else if (id === 'rain' && z.t > z.delay - 0.3) {
      for (let j = 0; j < 6; j++) { const a = R() * 6.28, r = z.r * Math.sqrt(R()); fx.spark(z.x + Math.cos(a) * r + 1.6, 11, z.z + Math.sin(a) * r + 1, -5, -36, -3, m(c, 1.5), 0.36, 0.3, 0, 0, 0.075); }
    } else if (id === 'blizzard' && z.t > z.delay - 0.4) {
      for (let j = 0; j < 5; j++) { const a = R() * 6.28, r = z.r * Math.sqrt(R()); fx.spark(z.x + Math.cos(a) * r + 3, 9, z.z + Math.sin(a) * r, -9, -20, 2 + (R() - 0.5) * 4, [1.2, 1.4, 1.6], 0.24, 0.45, 0, 0, 0.05); }
      if (R() < 0.5) { const a = R() * 6.28, r = z.r * Math.sqrt(R()); fx.smoke(z.x + Math.cos(a) * r, 0.5 + R() * 2, z.z + Math.sin(a) * r, -3, 0.2, 1, SNOW, 3, 1.2, 0.28, 0.8, 0, 0.5); }
    } else if ((id === 'tempest' || id === 'barrage') && z.t > z.delay - 0.6) {
      if (id === 'tempest') { if (R() < 0.5) { const a = R() * 6.28, r = z.r * Math.sqrt(R()); fx.smoke(z.x + Math.cos(a) * r, 13 + R() * 2, z.z + Math.sin(a) * r, 1, 0, 0.5, [0.06, 0.06, 0.08], 5, 1.4, 0.5, 0.5, 0, 0.5); } }
      else if (R() < 0.35) { const a = R() * 6.28, r = z.r * Math.sqrt(R()), px = z.x + Math.cos(a) * r, pz = z.z + Math.sin(a) * r; fx.spark(px + 3, 16, pz + 2, -9, -48, -6, [2.6, 1.5, 0.5], 0.5, 0.33, 0, 0, 0.09); }
    } else if (id === 'stasis' && pre) {
      for (let j = 0; j < 3; j++) { const a = R() * 6.28, r = z.r * Math.sqrt(R()); fx.spark(z.x + Math.cos(a) * r, 0.3 + R() * 4, z.z + Math.sin(a) * r, -Math.sin(a) * 2 * k, 0.4, Math.cos(a) * 2 * k, m(c, 1.3), 0.3, 0.5, 0, 0, 0.03); }
    } else if (id === 'bloodsea') {
      for (let j = 0; j < 3; j++) { const a = R() * 6.28, r = z.r * Math.sqrt(R()); fx.spark(z.x + Math.cos(a) * r, 0.15, z.z + Math.sin(a) * r, 0, 2.5 + R() * 4, 0, m(c, 1.3), 0.28, 0.6 + R() * 0.5, 3, 0.4, 0.05); }
      if (R() < 0.35) { const a = R() * 6.28, r = z.r * Math.sqrt(R()); fx.smoke(z.x + Math.cos(a) * r, 0.4, z.z + Math.sin(a) * r, 0, 0.5, 0, [c[0] * 0.16, 0.01, 0.012], 2.6, 1.0, 0.45, 0.8, -0.3); }
    } else if (id === 'bloom') {
      for (let j = 0; j < 2; j++) { const a = R() * 6.28, r = z.r * Math.sqrt(R()); fx.spark(z.x + Math.cos(a) * r, 0.2, z.z + Math.sin(a) * r, 0, 2 + R() * 3, 0, m(c, 1.3), 0.26, 1.0 + R(), -0.5, 0.5, 0.03); }
    }
  };
  V.zoneFire = (z, close) => {
    audio.layer(z.sid, z.x, z.z, z.tick ? 0.55 : 0.9);
    if (z.s.key === 'R' && z.s.rank > 1) { fx.ringWave(z.x, z.z, z.r * 2.7, z.col, 0.4); if (z.s.rank > 2) { fx.ringWave(z.x, z.z, z.r * 3.2, [2.2, 1.7, 0.6], 0.55); fx.pillar(z.x, z.z, z.r * 0.3, 17, [2.2, 1.7, 0.6], 0.5); } }
    const c = z.col, x = z.x, zz = z.z, r = z.r, id = z.sid;
    if (id === 'meteor') {
      fx.explosion(x, zz, 1.7, FLAME); fx.dome(x, zz, 1.5, r * 1.4, [1.6, 0.7, 0.2], 0.5); fx.pillar(x, zz, 2.4, 19, [1.5, 0.6, 0.15], 0.6);
      fx.decal({ mode: 6, x, z: zz, size: r * 3.0, color: [1.4, 0.45, 0.06], dur: 4.5, seed: R() });
      fx.ringWave(x, zz, r * 3.2, [3.2, 1.3, 0.3], 0.6); fx.ringWave(x, zz, r * 2.2, W, 0.35); fx.flare(x, 2.5, zz, [3, 2, 1], 14, 0.3);
      fx.burst(x, 1, zz, m(c, 1.2), { n: 30, speed: 11, up: 7, life: 0.8, size: 0.3 }); chunks(x, zz, 28, 13, 14, 0.44); embers(x, zz, FLAME, 26, r);
      fx.punch(0.75); if (close) fx.hitStop(0.07); fx.shake(0.95); audio.play('boom', x, zz);
    } else if (id === 'well') {
      fx.pillar(x, zz, r * 0.5, 14, c, 0.55); fx.dome(x, zz, r * 1.15, 0.5, m(c, 1.3), 0.4); fx.ringWave(x, zz, r * 2.5, c, 0.4);
      fx.decal({ mode: 6, x, z: zz, size: r * 2.3, color: c, dur: 1.6, seed: R() }); fx.flare(x, 2, zz, m(c, 2.2), 9, 0.28);
      fx.burst(x, 1, zz, c, { n: 32, speed: 8, up: 12, life: 0.75, size: 0.3, grav: 6 }); fx.dust(x, zz, DUST, { n: 10, speed: 6, size: 2.2, r: 1.5 }); embers(x, zz, c, 12, r * 0.8);
      fx.flash(x, 2, zz, c, 300, 0.4); fx.punch(0.25); fx.shake(0.3); audio.play('magic', x, zz);
    } else if (id === 'shell') {
      fx.explosion(x, zz, 1.0, FLAME); fx.ringWave(x, zz, r * 2.6, [3, 1.4, 0.4], 0.4); fx.dome(x, zz, 0.6, r * 1.1, [1.5, 0.7, 0.2], 0.3); chunks(x, zz, 12, 10, 10); fx.flare(x, 1.5, zz, [2.6, 1.8, 0.9], 9, 0.2);
      fx.punch(0.3); fx.shake(0.45); audio.play('blast', x, zz);
    } else if (id === 'bolt') {
      lightning(x, zz, c); fx.ringWave(x, zz, r * 2.4, c, 0.3); fx.dome(x, zz, 0.4, r, m(c, 1.2), 0.25); fx.punch(0.35); if (close) fx.hitStop(0.03); fx.shake(0.4); audio.play('zapcrack', x, zz);
    } else if (id === 'trib') {
      lightning(x, zz, [1.6, 1.5, 0.9], 26); for (let j = 0; j < 6; j++) { const a = j * 1.047 + R(), d = r * (0.45 + R() * 0.5); lightning(x + Math.cos(a) * d, zz + Math.sin(a) * d, c, 18); }
      fx.ringWave(x, zz, r * 2.3, c, 0.45); fx.dome(x, zz, 0.5, r, m(c, 1.3), 0.4); fx.scorch(x, zz, r * 1.2, 8); fx.flash(x, 3, zz, c, 420, 0.5); fx.punch(0.5); if (close) fx.hitStop(0.05); fx.shake(0.7);
      audio.play('thunder', x, zz); audio.play('boom', x, zz);
    } else if (id === 'tempest') {
      for (let j = 0; j < 2; j++) { const a = R() * 6.28, d = r * Math.sqrt(R()) * 0.85; lightning(x + Math.cos(a) * d, zz + Math.sin(a) * d, c, 15); }
      fx.ringWave(x, zz, r * 2.1, m(c, 0.6), 0.3); fx.punch(0.22); fx.shake(0.3); audio.play('zapcrack', x, zz, 0.8);
    } else if (id === 'barrage') {
      for (let j = 0; j < 2; j++) { const a = R() * 6.28, d = r * Math.sqrt(R()) * 0.85, px = x + Math.cos(a) * d, pz = zz + Math.sin(a) * d; fx.explosion(px, pz, 0.75, FLAME); fx.ringWave(px, pz, 7, [3, 1.4, 0.4], 0.35); chunks(px, pz, 6, 9, 9); }
      fx.punch(0.28); fx.shake(0.5); audio.play('blast', x, zz, 0.85);
    } else if (id === 'blizzard') {
      for (let j = 0; j < 4; j++) { const a = R() * 6.28, d = r * Math.sqrt(R()), px = x + Math.cos(a) * d, pz = zz + Math.sin(a) * d; fx.flare(px, 0.5, pz, [1.4, 1.7, 2], 2.6, 0.16); fx.burst(px, 0.3, pz, [1.2, 1.5, 1.8], { n: 4, speed: 4, up: 4, life: 0.4, size: 0.2 }); }
      cloud(x, 0.4, zz, SNOW, 4, r * 0.8, 3, 1, 0.3); fx.ringWave(x, zz, r * 2.1, m(c, 0.5), 0.35); audio.play('whoosh', x, zz);
    } else if (id === 'stasis') {                  // time stops inside the circle: a dome that holds, motes hanging still in the air
      fx.dome(x, zz, r, r * 1.03, m(c, 0.3), z.s.stun + 0.1); fx.decal({ mode: 5, x, z: zz, size: r * 2.08, color: m(c, 0.7), dur: 0.2, hold: z.s.stun, seed: R() }); fx.pillar(x, zz, r * 0.5, 12, m(c, 0.7), 0.5);
      for (let j = 0; j < 46; j++) { const a = R() * 6.28, d = r * Math.sqrt(R()); fx.spark(x + Math.cos(a) * d, 0.3 + R() * 5, zz + Math.sin(a) * d, 0, 0, 0, m(c, 1.2 + R()), 0.24 + R() * 0.2, z.s.stun * (0.8 + R() * 0.3), 0, 0, 0); }
      fx.ringWave(x, zz, r * 2.3, c, 0.5); fx.flare(x, 3, zz, m(c, 1.6), 8, 0.25); fx.flash(x, 3, zz, c, 300, 0.5); fx.punch(0.3); if (close) fx.hitStop(0.05); fx.shake(0.4); audio.play('magic', x, zz); audio.play('thud', x, zz, 0.8);
    } else if (id === 'bloodsea') {
      fx.ringWave(x, zz, r * 2.1, m(c, 0.6), 0.4); fx.burst(x, 0.4, zz, m(c, 1.3), { n: 10, speed: 5, up: 7, life: 0.5, size: 0.24, spread: r, grav: 9 });
    } else if (id === 'bloom') {
      fx.ringWave(x, zz, r * 2.1, m(c, 0.7), 0.45); embers(x, zz, m(c, 1.3), 10, r);
    } else {
      for (let j = 0; j < 5; j++) { const a = R() * 6.28, d = r * Math.sqrt(R()), px = x + Math.cos(a) * d, pz = zz + Math.sin(a) * d; fx.flare(px, 0.4, pz, m(c, 1.4), 2.4, 0.14); fx.burst(px, 0.3, pz, c, { n: 3, speed: 4, up: 5, life: 0.3, size: 0.22 }); }
      fx.dust(x, zz, DUST, { n: 4, speed: 2, size: 1.4, r: r * 0.8, opacity: 0.25 }); fx.ringWave(x, zz, r * 2.1, m(c, 0.5), 0.3); audio.play('arrow', x, zz);
    }
  };

  // ---- dashes and leaps ----
  V.dashTick = (h, D, c, step) => {
    const bx = -D.dx, bz = -D.dz, id = D.s.vfx;
    for (let k = 0; k < 3; k++) fx.spark(h.x + (R() - 0.5) * 1.2, 0.4 + R() * 2.6, h.z + (R() - 0.5) * 1.2, bx * 9, 0.5, bz * 9, c, 0.36, 0.3, 0, 0, 0.08);
    if (id === 'shadowstep') fx.smoke(h.x, 1.2, h.z, bx, 0.3, bz, [c[0] * 0.1, c[1] * 0.1, c[2] * 0.1], 2.2, 0.6, 0.55); else if (id === 'firestep') fx.fire(h.x, 0.8, h.z, bx * 2, 1.2, bz * 2, c, 1.8, 0.4); else fx.smoke(h.x, 0.5, h.z, bx * 2, 0.8, bz * 2, id === 'iceslide' ? SNOW : DUST, 1.8, 0.7, 0.3);
    D.trail = (D.trail || 0) + step;
    if (D.trail > 1.3) { D.trail = 0; fx.decal({ mode: 0, x: h.x, z: h.z, size: D.hit ? 4.2 : 3.2, color: c, dur: id === 'iceslide' ? 1.6 : 0.7, alpha: 0.75, fade: true }); if (id === 'charge') chunks(h.x, h.z, 2, 4, 5, 0.26); }
  };
  V.dashHit = (e, c) => { fx.flare(e.x, 1.8, e.z, [1.8, 1.7, 1.5], 4.5, 0.16); fx.burst(e.x, 1.4, e.z, W, { n: 14, speed: 9, life: 0.32, size: 0.26, grav: 14 }); fx.ringWave(e.x, e.z, 5, c, 0.25); fx.punch(0.12); fx.shake(0.22); audio.play('thud', e.x, e.z, 0.8); };
  V.leapTick = (h, c) => { for (let k = 0; k < 2; k++) fx.spark(h.x + (R() - 0.5), h.y + 1 + R() * 2, h.z + (R() - 0.5), (R() - 0.5) * 2, -2, (R() - 0.5) * 2, c, 0.4, 0.4, 0, 0, 0.05); fx.fire(h.x, h.y + 1.5, h.z, 0, -1, 0, c, 1.8, 0.3, 0.3); };
  V.leapLand = (h, s, c, close) => {
    const x = h.x, z = h.z, r = s.radius;
    fx.dome(x, z, 1, r * 1.3, m(c, 1.4), 0.42); fx.pillar(x, z, 1.8, 10, c, 0.4);
    fx.decal({ mode: 6, x, z, size: r * 2.9, color: c, dur: 2.6, seed: R() });
    fx.ringWave(x, z, r * 2.8, c, 0.5); fx.ringWave(x, z, r * 1.7, W, 0.3); fx.flare(x, 1.5, z, m(c, 2), 10, 0.25);
    fx.dust(x, z, DUST, { n: 26, speed: 12, size: 3, life: 1.2, r: 1.5 }); chunks(x, z, 22, 12, 12, 0.42);
    fx.burst(x, 0.5, z, [2.2, 1.7, 1.0], { n: 28, speed: 14, up: 9, life: 0.6, size: 0.26, grav: 22 }); embers(x, z, c, 14, r * 0.8);
    fx.scorch(x, z, r * 1.5, 10); fx.flash(x, 2, z, c, 300, 0.45); fx.punch(0.5); if (close) fx.hitStop(0.06); fx.shake(0.8); audio.play('slam', x, z);
  };

  // ---- things that stay on a hero: the shield bubble, speed buffs ----
  // ---- passives you can read on the field (called about eleven times a second for each hero in view) ----
  V.passive = (h, t) => {
    const id = h.def.id, c = h.fxCol, n = h.pStack, y = h.h;
    const orbit = (k, r, yy, col, size, speed) => { for (let i = 0; i < k; i++) { const a = t * speed + i * 6.283 / k + h.id; fx.flare(h.x + Math.cos(a) * r, yy, h.z + Math.sin(a) * r, col, size, 0.16); } };
    if (id === 'archer' && n > 0) orbit(n, 1.5, y * 0.55, [2.2, 0.9, 0.2], 1.0, 4);                                    // one ember per stack
    else if (id === 'warden' && n > 0) orbit(n, 1.8, 0.9, [1.6, 1.4, 0.9], 1.0, 1.6);                                  // one stone per layer
    else if (id === 'ranger' && n === 1) orbit(2, 1.2, y * 0.6, m(c, 2), 1.4, 7);                                      // the third sword is ready
    else if (id === 'gunner' && n === 3) { fx.fire(h.x + Math.cos(h.facing) * 1.1, y * 0.55, h.z + Math.sin(h.facing) * 1.1, 0, 1.2, 0, [1, 0.5, 0.12], 1.1, 0.3); orbit(1, 1.3, y * 0.55, [2.4, 1.3, 0.3], 1.3, 8); }
    else if (id === 'berserker') { const k = 1 - h.hp / h.maxHp; if (k > 0.3 && R() < k) fx.fire(h.x + (R() - 0.5) * 1.4, 0.5 + R() * 2.5, h.z + (R() - 0.5) * 1.4, 0, 2, 0, [1, 0.25, 0.08], 1.2 + k, 0.4); }
    else if (id === 'healer') { if (R() < 0.5) { const a = R() * 6.283, r = R() * 8; fx.spark(h.x + Math.cos(a) * r, 0.2, h.z + Math.sin(a) * r, 0, 2.5, 0, [0.6, 1.6, 0.5], 0.3, 0.9); } }
    else if (id === 'keeper' && h.pCd <= 0 && h.hp < h.maxHp * 0.6) orbit(1, 1.9, 1.2, m(c, 1.6), 1.2, 2);             // the gate is about to close
  };
  V.marks = (e, n, c, t) => { for (let i = 0; i < n; i++) { const a = t * 2.4 + i * 3.1416; fx.flare(e.x + Math.cos(a) * 0.8, e.h + 1.5, e.z + Math.sin(a) * 0.8, [c[0] * 2.2, c[1] * 2.2, c[2] * 2.2], 1.3, 0.16); } };   // 雷印 circling overhead
  V.doom = e => fx.flare(e.x, e.h + 1.8, e.z, [2.4, 0.15, 0.2], 1.6, 0.16);                                             // low enough that 柳红衣 hits harder
  V.insight = (h, tgt) => { fx.line(tgt.x, tgt.h * 0.6, tgt.z, h.x, h.h * 0.7, h.z, m(h.fxCol, 1.4), 7, 0.4, 0.3); fx.flare(h.x, h.h + 0.6, h.z, m(h.fxCol, 2), 3, 0.2); };
  V.empowered = (t, c) => { fx.ringWave(t.x, t.z, 6, c, 0.3); fx.flare(t.x, t.h * 0.5, t.z, [2.4, 2.2, 1.8], 5, 0.16); };
  V.fall = (h, frost) => {                                            // a cultivator comes apart the way their sect would: ice, or embers
    const x = h.x, z = h.z;
    if (frost) { chunks(x, z, 16, 8, 9, 0.3, 0, 6.283, [0.6, 0.78, 0.95]); fx.burst(x, 1.6, z, [1.2, 1.7, 2.4], { n: 26, speed: 10, up: 7, life: 0.7, size: 0.26, grav: 16 }); fx.ringWave(x, z, 9, [0.5, 0.9, 1.6], 0.5); fx.dust(x, z, SNOW, { n: 12, speed: 6, size: 2.2 }); }
    else { embers(x, z, [2.2, 0.7, 0.15], 34, 1.6); for (let k = 0; k < 7; k++) fx.fire(x + (R() - 0.5) * 1.6, 0.5 + R() * 2, z + (R() - 0.5) * 1.6, (R() - 0.5) * 2, 2 + R() * 2, (R() - 0.5) * 2, FLAME, 1.6, 0.5 + R() * 0.3); cloud(x, 0.6, z, [0.05, 0.03, 0.03], 10, 1.2, 2.6, 1.4, 0.55); fx.ringWave(x, z, 9, [1.8, 0.5, 0.15], 0.5); }
    fx.pillar(x, z, 0.9, 16, frost ? [0.6, 1, 1.8] : [1.9, 0.5, 0.2], 0.7);
  };
  // 雷劫: a ring closes on the spot a bolt has chosen, then the bolt
  V.tribWarn = (x, z, r, delay) => { fx.decal({ mode: 1, x, z, size: r * 2.1, size0: r * 6.5, color: [2.2, 1.9, 0.7], dur: delay }); fx.decal({ mode: 5, x, z, size: r * 2.1, color: [1.6, 1.3, 0.4], dur: delay, hold: 0.05, seed: R() }); };
  V.tribBolt = (x, z, r) => { lightning(x, z, [1.7, 1.6, 1.0], 26); fx.ringWave(x, z, r * 3.2, [2.0, 1.8, 0.8], 0.4); chunks(x, z, 8, 6, 8, 0.28); fx.scorch(x, z, r * 1.7, 9); fx.shake(0.35); };   // the sound is played once a wave by game.js
  V.tribStart = (h) => { fx.pillar(h.x, h.z, 2.6, 24, [2.0, 1.8, 0.9], 1.4); fx.ringWave(h.x, h.z, 20, [2.0, 1.8, 0.9], 0.9); fx.dome(h.x, h.z, 1, 5, [1.6, 1.5, 0.8], 0.8); audio.play('charge', h.x, h.z); audio.play('thunder', h.x, h.z, 0.5); };
  V.turn = p => { fx.flare(p.x, p.y, p.z, m(p.color, 2), 4, 0.16); slash(p.x, p.z, R() * 6.283, 4, 1.6, m(p.color, 1.4), 1.6, 0.22); };
  V.status = (h, vis) => {
    if (vis && h.omen) { h.fxO = (h.fxO || 0) + 1; const y = h.h + 1.7, big = h.omen === 2;   // 雷云: a small dark cloud that follows, flickering
      if (h.fxO % 3 === 0) fx.smoke(h.x + (R() - 0.5) * (big ? 2.6 : 1.8), y + R() * 0.5, h.z + (R() - 0.5) * (big ? 2.6 : 1.8), 0, 0.05, 0, [0.03, 0.03, 0.06], big ? 2.6 : 1.9, 1.0, 0.8, 0.25, 0);
      { const a = h.fxO * 0.21, rr = big ? 1.5 : 1.1; fx.spark(h.x + Math.cos(a) * rr, y + Math.sin(a * 2.3) * 0.25, h.z + Math.sin(a) * rr, -Math.sin(a) * 3, 0, Math.cos(a) * 3, [2.2, 1.9, 0.9], big ? 0.3 : 0.22, 0.35, 0, 0, 0.08); }   // a ring of static turning overhead
      if (h.fxO % (big ? 12 : 20) === 0) { const ox = (R() - 0.5) * 1.6, oz = (R() - 0.5) * 1.6; fx.line(h.x + ox, y, h.z + oz, h.x + ox * 0.4, y - 1.6, h.z + oz * 0.4, [2.6, 2.3, 1.2], 5, 0.4, 0.14); fx.flare(h.x + ox, y, h.z + oz, [2.4, 2.1, 1.1], 2.2, 0.1); } }
    if (vis && h.alive && h.vulnOn) { h.fxV = (h.fxV || 0) + 1; if (h.fxV % 5 === 0) { fx.spark(h.x + (R() - 0.5) * 0.8, h.h + 2.2, h.z, 0, -5, 0, [2.6, 0.25, 0.2], 0.34, 0.3, 0, 0, 0.09); fx.flare(h.x, h.h + 1.5, h.z, [2.4, 0.2, 0.18], 1.5, 0.12); } }   // 易伤: a red mark bleeding down over the head
    if (vis && h.alive && h.veilT > 0 && R() < 0.5) fx.smoke(h.x + (R() - 0.5) * 1.4, 0.4 + R() * 2.4, h.z + (R() - 0.5) * 1.4, 0, 0.6, 0, [0.04, 0.03, 0.05], 1.6, 0.6, 0.4);
    const on = vis && h.alive && h.shield > 0;
    if (on && !h.bub) h.bub = fx.bubble(h.fxCol, h.r * 1.9 + 1.5);
    if (!on && h.bub) { fx.freeBubble(h.bub); h.bub = null; }
    if (h.bub) h.bub.m.position.set(h.x, h.h * 0.45 + (h.y || 0), h.z);
    if (vis && h.alive && h.hasteT > 0) {
      h.fxA = (h.fxA || 0) + 0.55;
      for (let k = 0; k < 2; k++) { const a = h.fxA + k * Math.PI, y = 0.3 + ((h.fxA * 0.35 + k * 1.7) % 3.4); fx.spark(h.x + Math.cos(a) * 1.4, y, h.z + Math.sin(a) * 1.4, -Math.sin(a) * 8, 1.5, Math.cos(a) * 8, h.fxCol, 0.32, 0.3, 0, 0, 0.07); }
      if (h.lsBuff && R() < 0.4) fx.fire(h.x + (R() - 0.5), 0.6 + R() * 2, h.z + (R() - 0.5), 0, 1.5, 0, h.fxCol, 1.3, 0.35, 0.3);
    }
  };
  return V;
}
