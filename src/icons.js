// icons.js — every ability icon is drawn on a canvas at load: a dark tile tinted with the hero's colour and a glowing glyph.
// Glyphs are drawn in a −50…50 box with two helpers: S (a glowing stroke with a white core) and F (a glowing fill).
const cache = {}, PI = Math.PI;

export function skillIcon(name, col) {
  const key = name + col.map(v => v.toFixed(2)).join();
  if (cache[key]) return cache[key];
  const N = 128, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d');
  const rgb = (k = 1, a = 1) => `rgba(${Math.min(255, col[0] * 255 * k) | 0},${Math.min(255, col[1] * 255 * k) | 0},${Math.min(255, col[2] * 255 * k) | 0},${a})`;
  const bg = g.createRadialGradient(N * 0.5, N * 0.4, 4, N * 0.5, N * 0.52, N * 0.8);
  bg.addColorStop(0, rgb(0.5)); bg.addColorStop(0.5, rgb(0.17)); bg.addColorStop(1, '#04060a'); g.fillStyle = bg; g.fillRect(0, 0, N, N);
  g.globalAlpha = 0.5; for (let i = 0; i < 26; i++) { g.fillStyle = rgb(1.3, 0.05 + Math.random() * 0.12); const x = Math.random() * N, y = Math.random() * N, r = 0.6 + Math.random() * 1.6; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } g.globalAlpha = 1;
  g.translate(N / 2, N / 2); g.scale(N / 100, N / 100); g.lineCap = 'round'; g.lineJoin = 'round';
  const S = (w, fn, a = 1) => {   // glowing stroke with a hot white core
    g.save(); g.globalAlpha = a; g.shadowColor = rgb(1.3); g.shadowBlur = 9; g.strokeStyle = rgb(1.25); g.lineWidth = w; g.beginPath(); fn(g); g.stroke();
    g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = Math.max(0.8, w * 0.34); g.beginPath(); fn(g); g.stroke(); g.restore();
  };
  const F = (fn, a = 1, white = 0.55) => {
    g.save(); g.globalAlpha = a; g.shadowColor = rgb(1.3); g.shadowBlur = 10; const gr = g.createLinearGradient(-30, -34, 30, 34); gr.addColorStop(0, `rgba(255,255,255,${white})`); gr.addColorStop(0.5, rgb(1.35)); gr.addColorStop(1, rgb(0.7));
    g.fillStyle = gr; g.beginPath(); fn(g); g.fill(); g.restore();
  };
  (GLYPH[name] || GLYPH.starbolt)(S, F, g);
  return (cache[key] = cv.toDataURL());
}

// small shape helpers
const line = (...p) => g => { g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); };
const arc = (x, y, r, a0, a1, ccw) => g => g.arc(x, y, r, a0, a1, ccw);
const poly = (...p) => g => { g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); };
const star = (x, y, r, n = 4, inner = 0.28, rot = 0) => g => { for (let i = 0; i < n * 2; i++) { const a = rot + i * PI / n - PI / 2, q = i % 2 ? r * inner : r; i ? g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) : g.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); };
const arrow = (S, F, x0, y0, x1, y1, w = 4, head = 11) => { const a = Math.atan2(y1 - y0, x1 - x0); S(w, line(x0, y0, x1 - Math.cos(a) * head * 0.6, y1 - Math.sin(a) * head * 0.6)); F(poly(x1, y1, x1 - Math.cos(a - 0.5) * head, y1 - Math.sin(a - 0.5) * head, x1 - Math.cos(a + 0.5) * head, y1 - Math.sin(a + 0.5) * head)); };
const flake = (S, x, y, r, w = 2.6) => { for (let i = 0; i < 6; i++) { const a = i * PI / 3, c = Math.cos(a), s = Math.sin(a); S(w, line(x, y, x + c * r, y + s * r)); S(w * 0.8, line(x + c * r * 0.55, y + s * r * 0.55, x + Math.cos(a + 0.6) * r * 0.85, y + Math.sin(a + 0.6) * r * 0.85)); S(w * 0.8, line(x + c * r * 0.55, y + s * r * 0.55, x + Math.cos(a - 0.6) * r * 0.85, y + Math.sin(a - 0.6) * r * 0.85)); } };
const boltPath = (x, y, s = 1) => poly(x + 6 * s, y - 30 * s, x - 10 * s, y + 2 * s, x - 1 * s, y + 2 * s, x - 8 * s, y + 30 * s, x + 12 * s, y - 6 * s, x + 2 * s, y - 6 * s);
const shield = s => g => { g.moveTo(0, -34 * s); g.lineTo(27 * s, -23 * s); g.lineTo(25 * s, 4 * s); g.quadraticCurveTo(20 * s, 26 * s, 0, 36 * s); g.quadraticCurveTo(-20 * s, 26 * s, -25 * s, 4 * s); g.lineTo(-27 * s, -23 * s); g.closePath(); };

const TIER_COL = [null, [0.74, 0.8, 0.88], [0.35, 0.86, 1.0], [1.0, 0.78, 0.3]];
export const itemIcon = it => skillIcon(it.icon, TIER_COL[it.tier]);

const GLYPH = {
  // ---- items ----
  i_sword(S, F) { F(poly(34, -40, 40, -34, -8, 14, -14, 8)); S(2, line(34, -38, -10, 10)); S(6, line(-22, 2, -2, 22)); S(5, line(-14, 14, -30, 30)); F(arc(-33, 33, 5, 0, 7)); },
  i_staff(S, F) { S(5, line(-30, 38, 12, -12)); S(4, arc(20, -22, 15, PI * 0.35, PI * 1.6)); F(arc(21, -23, 7, 0, 7)); F(star(-24, -22, 6, 4, 0.3), 0.7); F(star(32, 16, 5, 4, 0.3), 0.6); },
  i_armor(S, F) { F(g => { g.moveTo(-30, -30); g.quadraticCurveTo(-12, -22, 0, -30); g.quadraticCurveTo(12, -22, 30, -30); g.lineTo(34, -6); g.lineTo(22, 0); g.lineTo(20, 34); g.lineTo(-20, 34); g.lineTo(-22, 0); g.lineTo(-34, -6); g.closePath(); }, 0.35, 0.2); S(4, g => { g.moveTo(-30, -30); g.quadraticCurveTo(-12, -22, 0, -30); g.quadraticCurveTo(12, -22, 30, -30); g.lineTo(34, -6); g.lineTo(22, 0); g.lineTo(20, 34); g.lineTo(-20, 34); g.lineTo(-22, 0); g.lineTo(-34, -6); g.closePath(); }); for (const y of [-6, 8, 22]) S(2.2, line(-18, y, 18, y), 0.8); },
  i_talisman(S, F) { F(poly(-16, -40, 16, -40, 16, 40, -16, 40), 0.3, 0.2); S(3.6, poly(-16, -40, 16, -40, 16, 40, -16, 40)); S(3, line(-8, -28, 8, -28)); S(3, g => { g.moveTo(0, -28); g.lineTo(0, -8); g.lineTo(-8, 2); g.lineTo(8, 10); g.lineTo(-8, 20); g.lineTo(6, 30); }); },
  i_pill(S, F) { F(arc(0, 4, 24, 0, 7), 0.5, 0.35); S(4, arc(0, 4, 24, 0, 7)); S(3, g => { g.arc(-6, 4, 10, PI * 0.1, PI * 1.2); g.arc(6, 4, 9, PI * 1.2, PI * 2.3); }); F(star(26, -28, 8, 4, 0.3), 0.8); F(star(-30, -20, 5, 4, 0.3), 0.6); },
  i_gourd(S, F) { F(g => { g.arc(0, 18, 22, 0, 7); g.arc(0, -14, 14, 0, 7); }, 0.4, 0.25); S(4, arc(0, 18, 22, -PI * 0.38, PI * 1.38)); S(4, arc(0, -14, 14, PI * 0.72, PI * 2.28)); S(4, line(0, -28, 0, -40)); S(3, line(-10, -2, 10, -2)); F(g => { g.moveTo(30, -8); g.quadraticCurveTo(38, 4, 30, 10); g.quadraticCurveTo(22, 4, 30, -8); }, 0.9); },
  i_tingxue(S, F) { F(poly(-3, -44, 3, -44, 5, 16, -5, 16)); S(6, line(-16, 18, 16, 18)); S(5, line(0, 22, 0, 38)); F(arc(0, 42, 4.5, 0, 7)); flake(S, -28, -16, 11, 1.8); flake(S, 28, 0, 9, 1.6); },
  i_ruler(S, F) { F(poly(26, -42, 40, -28, -26, 40, -40, 26), 0.6, 0.25); S(3.6, poly(26, -42, 40, -28, -26, 40, -40, 26)); for (let i = 0; i < 5; i++) { const t = (i + 1) / 6, x = 33 - t * 66 - 7, y = -35 + t * 66 - 7; S(2.2, line(x, y, x + 8, y + 8)); } F(star(8, -8, 7, 4, 0.3)); },
  i_disc(S, F) { S(4.5, arc(0, 0, 38, 0, 7)); S(2.4, arc(0, 0, 27, 0, 7), 0.8); for (let i = 0; i < 8; i++) { const a = i * PI / 4, c = Math.cos(a), sn = Math.sin(a); S(2.6, line(c * 29, sn * 29, c * 36, sn * 36)); } S(3.4, poly(-9, -9, 9, -9, 9, 9, -9, 9)); S(2.4, arc(0, 0, 16, 0, 7)); F(star(0, -19, 4, 4, 0.3)); F(star(17, 10, 3.5, 4, 0.3)); F(star(-16, 11, 3.5, 4, 0.3)); },
  i_mirror(S, F) { F(arc(0, -8, 26, 0, 7), 0.35, 0.3); S(5, arc(0, -8, 26, 0, 7)); S(5, line(0, 20, 0, 42)); S(4, line(-8, 42, 8, 42)); F(g => { g.moveTo(0, 8); g.bezierCurveTo(-16, 0, -10, -18, 0, -28); g.bezierCurveTo(8, -18, 16, 0, 0, 8); }); },
  i_bracer(S, F) { F(g => { g.moveTo(-28, -26); g.quadraticCurveTo(0, -36, 28, -26); g.lineTo(22, 30); g.quadraticCurveTo(0, 38, -22, 30); g.closePath(); }, 0.35, 0.2); S(4, g => { g.moveTo(-28, -26); g.quadraticCurveTo(0, -36, 28, -26); g.lineTo(22, 30); g.quadraticCurveTo(0, 38, -22, 30); g.closePath(); }); S(2, line(-12, -10, 4, -16, 12, 2, -6, 14, -12, -10), 0.9); for (const [x, y] of [[-12, -10], [4, -16], [12, 2], [-6, 14]]) F(star(x, y, 5, 4, 0.3)); },
  i_dunying(S, F) { S(2.4, arc(-10, -4, 24, 0, 7), 0.4); F(g => { g.arc(8, -6, 25, 0, 7); g.arc(18, -12, 21, 0, 7, true); }, 0.95, 0.5); S(4, arc(8, -6, 25, 0, 7)); S(5, line(8, 21, 8, 42)); S(2, line(-36, 10, -24, 14), 0.6); S(2, line(-38, 22, -22, 26), 0.6); },
  // ---- abilities ----
  gate(S, F) { F(poly(-24, -38, 24, -38, 24, 34, 0, 42, -24, 34), 0.4, 0.2); S(4.5, poly(-24, -38, 24, -38, 24, 34, 0, 42, -24, 34)); S(3, line(0, -38, 0, 40)); for (const [x, y] of [[-12, -24], [12, -24], [-12, 16], [12, 16]]) F(arc(x, y, 3.2, 0, 7)); S(4, line(-14, -2, 14, -2)); S(2.4, line(30, -20, 44, -24), 0.8); S(2.4, line(30, 0, 46, 0), 0.8); S(2.4, line(30, 20, 44, 24), 0.8); },
  taunt(S, F) { F(arc(0, 2, 12, 0, 7)); S(4, arc(0, 2, 24, -PI * 0.3, PI * 0.3)); S(4, arc(0, 2, 24, PI * 0.7, PI * 1.3)); S(3, arc(0, 2, 36, -PI * 0.25, PI * 0.25), 0.8); S(3, arc(0, 2, 36, PI * 0.75, PI * 1.25), 0.8); S(5, line(0, -42, 0, -22)); F(arc(0, 30, 4, 0, 7)); },
  stasis(S, F) { S(3.4, arc(0, 0, 40, 0, 7)); F(poly(-18, -26, 18, -26, 2, 0, 18, 26, -18, 26, -2, 0), 0.5, 0.3); S(4, poly(-18, -26, 18, -26, 2, 0, 18, 26, -18, 26, -2, 0)); S(3, line(-22, -28, 22, -28)); S(3, line(-22, 28, 22, 28)); for (let i = 0; i < 12; i++) { const a = i * PI / 6; S(2, line(Math.cos(a) * 34, Math.sin(a) * 34, Math.cos(a) * 39, Math.sin(a) * 39), 0.8); } },
  bloodclaw(S, F) { for (const x of [-22, 0, 22]) F(g => { g.moveTo(x - 6, -40); g.quadraticCurveTo(x + 14, -6, x + 6, 40); g.quadraticCurveTo(x + 2, 0, x - 6, -40); }); F(g => { g.moveTo(-34, 30); g.quadraticCurveTo(-28, 42, -34, 46); g.quadraticCurveTo(-40, 42, -34, 30); }, 0.8); },
  hook(S, F) { for (let i = 0; i < 4; i++) S(3.4, g => g.ellipse(-34 + i * 13, 30 - i * 13, 7, 4.5, -PI / 4, 0, 7)); S(6, g => { g.moveTo(14, -16); g.lineTo(30, -32); g.arc(22, -26, 16, -0.6, PI * 0.9); }); F(poly(2, -8, 8, -24, -8, -22)); },
  bloodsea(S, F) { F(g => { g.moveTo(0, -42); g.bezierCurveTo(22, -14, 24, 4, 0, 10); g.bezierCurveTo(-24, 4, -22, -14, 0, -42); }); for (const y of [20, 32]) S(4, g => { g.moveTo(-40, y); g.quadraticCurveTo(-27, y - 9, -14, y); g.quadraticCurveTo(0, y + 9, 14, y); g.quadraticCurveTo(27, y - 9, 40, y); }, y === 20 ? 1 : 0.7); },
  quick(S, F) { for (const [y, a] of [[-22, 0.7], [0, 1], [22, 0.7]]) { S(3.4, line(-38, y, 18, y), a); F(poly(38, y, 18, y - 9, 18, y + 9), a); } S(2, line(-44, -11, -30, -11), 0.6); S(2, line(-44, 11, -30, 11), 0.6); },
  firestep(S, F) { F(g => { g.moveTo(-18, 38); g.bezierCurveTo(-44, 26, -34, -4, -22, -14); g.bezierCurveTo(-22, 0, -12, 0, -12, -34); g.bezierCurveTo(8, -14, 14, 18, -18, 38); }, 0.9, 0.5); for (const x of [6, 22]) S(5, line(x, -18, x + 16, 0, x, 18), x === 22 ? 1 : 0.7); },
  sunarrow(S, F) { S(3, arc(8, -6, 26, 0, 7), 0.6); for (let i = 0; i < 8; i++) { const a = i * PI / 4 + 0.3, c = Math.cos(a), s = Math.sin(a); S(2.6, line(8 + c * 31, -6 + s * 31, 8 + c * 40, -6 + s * 40), 0.8); } arrow(S, F, -40, 40, 30, -28, 6, 18); F(star(8, -6, 10, 4, 0.35)); },
  cleave(S, F) { F(g => { g.arc(-4, 10, 38, PI * 1.08, PI * 1.92); g.arc(4, 20, 34, PI * 1.86, PI * 1.14, true); g.closePath(); }); S(2.4, line(-8, 30, -16, 40)); S(2.4, line(2, 28, 4, 42)); S(2.4, line(12, 30, 22, 38)); },
  bulwark(S, F) { F(shield(1), 0.35, 0.2); S(4.5, shield(1)); S(3, line(0, -22, 0, 24)); S(3, line(-16, -6, 16, -6)); },
  charge(S, F) { for (const x of [-30, -10, 10]) S(6, line(x, -22, x + 20, 0, x, 22), x === 10 ? 1 : 0.6 + (x + 30) / 100); S(2, line(-44, -12, -34, -12)); S(2, line(-44, 12, -34, 12)); },
  skyfall(S, F) { F(poly(0, 2, -17, -26, -6, -22, -6, -42, 6, -42, 6, -22, 17, -26)); S(3.5, arc(0, 24, 30, PI * 1.12, PI * 1.88)); S(2.5, arc(0, 30, 42, PI * 1.2, PI * 1.8)); S(2.6, line(0, 8, -4, 22, 2, 34)); S(2.2, line(-8, 12, -22, 26)); S(2.2, line(8, 12, 24, 24)); },
  starbolt(S, F) { S(3, line(-38, 34, -8, 8)); S(2, line(-40, 18, -20, 2)); S(2, line(-22, 38, -4, 22)); F(star(10, -8, 30, 4, 0.26)); F(star(-26, -26, 8, 4, 0.3), 0.8); F(star(34, 26, 6, 4, 0.3), 0.7); },
  well(S, F) { S(4, g => { for (let i = 0; i <= 90; i++) { const a = i / 90 * PI * 5, r = 3 + i * 0.4; i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r); } }); F(arc(0, 0, 5, 0, 7)); S(2, arc(0, 0, 44, 0.3, 1.4)); S(2, arc(0, 0, 44, 3.4, 4.5)); },
  phase(S, F) { S(2.4, poly(-28, -18, -16, 0, -28, 18, -40, 0), 0.5); F(poly(26, -24, 42, 0, 26, 24, 10, 0)); S(3.4, line(-12, 0, -2, -8, 2, 8, 10, 0)); },
  meteor(S, F) { F(poly(22, 8, -36, -40, -14, -10, -40, -20, -8, 6, -30, 6, 6, 26), 0.75, 0.3); F(arc(14, 14, 15, 0, 7)); S(3, arc(8, 40, 30, PI * 1.25, PI * 1.75)); },
  pierce(S, F) { S(2.6, g => g.ellipse(-12, 10, 7, 15, -0.8, 0, 7)); S(2.6, g => g.ellipse(12, -12, 6, 13, -0.8, 0, 7), 0.8); arrow(S, F, -38, 34, 36, -32, 4.5, 14); },
  backshot(S, F) { arrow(S, F, -14, -6, 40, -30, 4.5, 13); S(4, g => { g.moveTo(-2, 8); g.quadraticCurveTo(-14, 40, -38, 22); }); F(poly(-44, 14, -28, 16, -38, 30)); },
  rain(S, F) { for (const [x, y] of [[-26, -30], [0, -38], [26, -28], [-12, -12], [14, -10]]) arrow(S, F, x + 6, y, x - 4, y + 26, 2.6, 8); S(3, g => g.ellipse(0, 30, 36, 10, 0, 0, 7)); },
  dagger(S, F) { S(2, line(-40, -6, -22, 4), 0.6); S(2, line(-34, 14, -14, 20), 0.6); F(poly(38, -38, 4, -14, -2, 4, 16, -2)); S(5, line(-12, -2, 8, 14)); S(5, line(-2, 6, -22, 28)); F(arc(-26, 32, 5, 0, 7)); },
  fan(S, F) { for (const a of [-0.55, 0, 0.55]) { const c = Math.cos(a - PI / 2), s = Math.sin(a - PI / 2); F(poly(c * 44, 34 + s * 44, c * 14 - s * 5, 34 + s * 14 + c * 5, c * 14 + s * 5, 34 + s * 14 - c * 5)); S(3.4, line(c * 14, 34 + s * 14, c * 2, 34 + s * 2)); } F(arc(0, 36, 6, 0, 7)); },
  smoke(S, F) { F(g => { g.arc(-16, 6, 17, 0, 7); g.arc(8, -8, 21, 0, 7); g.arc(22, 12, 14, 0, 7); g.arc(0, 18, 15, 0, 7); }, 0.4, 0.15); S(3.2, arc(-16, 6, 17, PI * 0.6, PI * 1.6)); S(3.2, arc(8, -8, 21, PI * 1.05, PI * 1.95)); S(3.2, arc(22, 12, 14, -PI * 0.4, PI * 0.6)); S(3.2, arc(0, 18, 15, PI * 0.15, PI * 0.9)); S(3, line(-8, 4, 0, 8)); S(3, line(8, 4, 16, 8)); },
  reap(S, F) { S(3, arc(0, 0, 34, 0, 7), 0.5); S(2.4, line(0, -44, 0, -30)); S(2.4, line(0, 44, 0, 30)); S(2.4, line(-44, 0, -30, 0)); S(2.4, line(44, 0, 30, 0)); F(g => { g.moveTo(-36, 30); g.quadraticCurveTo(-4, -4, 36, -34); g.quadraticCurveTo(6, 6, -36, 30); }); F(star(0, 0, 9, 4, 0.3)); },
  mend(S, F) { F(arc(0, 6, 22, 0, 7), 0.4, 0.2); S(4, arc(0, 6, 22, 0, 7)); S(4, line(0, -6, 0, 18)); S(4, line(-12, 6, 12, 6)); F(g => { g.moveTo(0, -40); g.quadraticCurveTo(14, -30, 4, -16); g.quadraticCurveTo(-8, -26, 0, -40); }); S(2, line(-30, -20, -24, -32)); S(2, line(30, -14, 36, -26)); },
  vine(S, F) { S(5, g => { g.moveTo(-40, 26); g.bezierCurveTo(-20, -30, 0, 40, 18, -6); g.arc(24, -12, 9, PI * 0.7, PI * 2.4); }); for (const [x, y, a] of [[-24, 0, -0.6], [-2, 12, 2.4], [8, -8, -0.3]]) F(g => { g.save(); g.translate(x, y); g.rotate(a); g.moveTo(0, 0); g.quadraticCurveTo(8, -12, 0, -20); g.quadraticCurveTo(-8, -12, 0, 0); g.restore(); }); },
  ward(S, F) { F(poly(-17, -38, 17, -38, 17, 30, 0, 40, -17, 30), 0.3, 0.15); S(4, poly(-17, -38, 17, -38, 17, 30, 0, 40, -17, 30)); S(3, line(-8, -26, 8, -26)); S(3, line(0, -26, 0, 22)); S(3, line(-9, -10, 9, -10, -9, 4, 9, 4)); S(2.4, arc(0, 0, 44, PI * 1.15, PI * 1.45), 0.7); S(2.4, arc(0, 0, 44, -PI * 0.45, -PI * 0.15), 0.7); },
  bloom(S, F) { for (const a of [-1.15, -0.58, 0, 0.58, 1.15]) F(g => { g.save(); g.translate(0, 24); g.rotate(a); g.moveTo(0, 0); g.quadraticCurveTo(13, -24, 0, -50); g.quadraticCurveTo(-13, -24, 0, 0); g.restore(); }, a === 0 ? 1 : 0.75, a === 0 ? 0.6 : 0.3); S(3, g => g.ellipse(0, 30, 34, 8, 0, 0, 7)); },
  icelance(S, F) { S(2, line(-42, 30, -24, 20)); S(2, line(-34, 40, -18, 30)); F(poly(40, -38, 6, -20, -24, 24, 20, -6)); S(2, line(40, -38, -24, 24)); F(poly(-6, -34, 2, -26, -6, -18, -14, -26), 0.7); F(poly(32, 10, 38, 16, 32, 22, 26, 16), 0.7); },
  frostnova(S, F) { flake(S, 0, 0, 30, 3.4); S(2.4, arc(0, 0, 42, 0, 7), 0.6); },
  slide(S, F) { S(4.5, g => { g.moveTo(-42, 18); g.quadraticCurveTo(-10, 2, 14, 12); g.quadraticCurveTo(30, 18, 42, 8); }); S(2.6, g => { g.moveTo(-40, 30); g.quadraticCurveTo(-8, 14, 16, 24); g.quadraticCurveTo(30, 30, 40, 22); }, 0.7); arrow(S, F, -24, -12, 26, -22, 4.5, 13); flake(S, -28, -28, 9, 1.6); },
  blizzard(S, F) { flake(S, -20, -16, 15, 2.2); flake(S, 18, -4, 19, 2.6); flake(S, -8, 24, 11, 2); S(2.4, line(-44, 4, -30, 0)); S(2.4, line(24, 30, 42, 26)); S(2.4, line(8, -34, 28, -38)); },
  whirl(S, F) { F(g => { g.arc(0, 0, 36, PI * 0.9, PI * 1.9); g.arc(0, 0, 26, PI * 1.9, PI * 0.9, true); g.closePath(); }); F(g => { g.arc(0, 0, 36, -PI * 0.1, PI * 0.9); g.arc(0, 0, 26, PI * 0.9, -PI * 0.1, true); g.closePath(); }, 0.55, 0.2); F(poly(40, -14, 26, 6, 46, 8)); F(poly(-40, 14, -26, -6, -46, -8)); F(arc(0, 0, 6, 0, 7)); },
  axe(S, F) { S(5, line(-30, 32, 22, -22)); F(g => { g.moveTo(10, -36); g.quadraticCurveTo(42, -36, 40, -2); g.lineTo(24, -12); g.lineTo(20, -24); g.closePath(); }); S(2.4, arc(-6, 6, 40, PI * 0.55, PI * 0.95), 0.7); S(2.4, arc(-6, 6, 40, -PI * 0.6, -PI * 0.25), 0.7); },
  rage(S, F) { F(g => { g.moveTo(0, 40); g.bezierCurveTo(-34, 30, -26, -6, -8, -18); g.bezierCurveTo(-10, -4, 0, -4, 0, -42); g.bezierCurveTo(22, -20, 34, 14, 0, 40); }); F(g => { g.moveTo(0, 36); g.bezierCurveTo(-14, 28, -10, 10, 0, 0); g.bezierCurveTo(12, 12, 14, 28, 0, 36); }, 0.9, 0.95); },
  shell(S, F) { S(2.4, g => { g.setLineDash([5, 6]); g.moveTo(-42, 30); g.quadraticCurveTo(-24, -40, 6, -6); }, 0.8); F(poly(-12, -6, 28, -6, 28, 36, -12, 36), 0.9, 0.35); S(3, line(-4, 4, 20, 4)); S(3, line(8, 4, 8, 28)); S(3, line(-4, 16, 20, 16, -4, 28, 20, 28)); F(star(34, -22, 12, 6, 0.4), 0.9); },
  concuss(S, F) { for (let i = -2; i <= 2; i++) { const a = i * 0.28; S(3.2, line(-34 + Math.cos(a) * 12, Math.sin(a) * 12, -34 + Math.cos(a) * 70, Math.sin(a) * 70), 1 - Math.abs(i) * 0.15); } S(3.4, arc(-34, 0, 34, -0.75, 0.75)); S(3.4, arc(-34, 0, 54, -0.7, 0.7), 0.8); F(star(-34, 0, 13, 6, 0.45)); },
  barrage(S, F) { for (const [x, y] of [[-24, -22], [4, -34], [26, -12]]) { S(3, line(x + 10, y - 14, x + 2, y - 2), 0.8); F(poly(x - 6, y - 4, x + 6, y - 4, x + 6, y + 12, x - 6, y + 12)); } F(star(-18, 30, 12, 6, 0.45), 0.9); F(star(16, 28, 15, 6, 0.45)); S(2.4, line(-42, 40, 42, 40), 0.6); },
  bolt(S, F) { F(boltPath(0, -6, 1.15)); S(2.6, line(-6, 34, -22, 42)); S(2.6, line(-6, 34, 12, 42)); S(2.6, arc(-6, 36, 26, PI * 1.2, PI * 1.8), 0.7); },
  orb(S, F) { F(arc(0, 0, 20, 0, 7), 0.45, 0.2); S(4, arc(0, 0, 20, 0, 7)); S(3, g => { g.arc(-5, 0, 10, PI * 0.2, PI * 1.3); g.arc(6, 0, 8, PI * 1.3, PI * 2.4); }); for (let i = 0; i < 6; i++) { const a = i * PI / 3 + 0.3, c = Math.cos(a), s = Math.sin(a); S(2.4, line(c * 26, s * 26, c * 33 - s * 5, s * 33 + c * 5, c * 42, s * 42)); } },
  bolt2(S, F) { S(2.4, poly(-34, -14, -24, 0, -34, 14, -44, 0), 0.5); F(g => { g.save(); g.rotate(-PI / 2); boltPath(0, 4, 1.05)(g); g.restore(); }); S(2, line(-18, -22, 0, -26)); S(2, line(4, 26, 24, 22)); },
  tempest(S, F) { F(g => { g.arc(-16, -18, 14, 0, 7); g.arc(6, -24, 17, 0, 7); g.arc(24, -14, 12, 0, 7); g.rect(-28, -18, 62, 14); }, 0.5, 0.2); S(3, arc(-16, -18, 14, PI * 0.7, PI * 1.6)); S(3, arc(6, -24, 17, PI * 1.05, PI * 1.95)); S(3, arc(24, -14, 12, -PI * 0.5, PI * 0.4)); S(3, line(-28, -4, 34, -4)); F(boltPath(-16, 22, 0.55)); F(boltPath(6, 26, 0.6)); F(boltPath(26, 20, 0.5)); },
};
