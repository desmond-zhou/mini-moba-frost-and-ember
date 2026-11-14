// portraits.js — a painted bust for each of the nine, drawn on a canvas at load (no image files).
// One routine paints backdrop, robe, neck, head, features and hair from a small spec; each hero then adds what is
// theirs alone — the cloth over 韩不语's mouth, 孙伯's straw hat, 寒漪's crown of ice, 沈渊's black gauze cap.
const cache = {}, PI = Math.PI;
const INK = '#111318', HAIR = '#16120f';

const SPEC = {
  warden: { skin: '#b88f72', hair: HAIR, robe: '#1b1e29', robe2: '#0d0f15', collar: '#2c62b5', inner: '#0c0d12', eye: '#2a2622', brow: 3.6, tilt: 3.5, jaw: 1.06, male: true },
  mage: { skin: '#cba888', hair: HAIR, robe: '#2c575c', robe2: '#173236', collar: '#d9d3bd', inner: '#e9e4d2', eye: '#2b3a44', brow: 2.4, tilt: 0.5, jaw: 0.96, male: true, knot: true },
  ranger: { skin: '#dcc0a8', hair: HAIR, robe: '#4c3b7a', robe2: '#2a2048', collar: '#d7d2e4', inner: '#efeaf6', eye: '#3a2f5a', brow: 1.8, tilt: 1, jaw: 0.9, long: true, locks: true, lips: '#a8505a' },
  shade: { skin: '#d8b8a0', hair: HAIR, robe: '#7f1220', robe2: '#3d0810', collar: '#14151b', inner: '#2a0a10', eye: '#7a1420', brow: 2, tilt: 3, jaw: 0.9, long: true, locks: true, lips: '#8e1420', shadow: 'rgba(140,20,35,.5)' },
  healer: { skin: '#b08e72', hair: '#d8d4c8', robe: '#5a5042', robe2: '#322c24', collar: '#8a7d66', inner: '#3a342b', eye: '#3a3128', brow: 3, tilt: -2.5, jaw: 1.0, male: true, old: true },
  cryo: { skin: '#e2d2c8', hair: '#c9d3de', robe: '#7d9db6', robe2: '#3d566b', collar: '#b9cfe0', inner: '#e6f1f8', eye: '#5aa8d8', brow: 1.7, tilt: 1.8, jaw: 0.9, long: true, locks: true, lips: '#a27c86' },
  berserker: { skin: '#a67a58', hair: '#2a2119', robe: '#4f4132', robe2: '#2a2119', collar: '#7b6a55', inner: '#a67a58', eye: '#3b2a1c', brow: 4, tilt: 3, jaw: 1.12, male: true },
  gunner: { skin: '#bb9474', hair: HAIR, robe: '#3c4f66', robe2: '#1f2a38', collar: '#6d7480', inner: '#2c3a4c', eye: '#2c2620', brow: 3.2, tilt: 1.5, jaw: 1.04, male: true, knot: true },
  keeper: { skin: '#b99678', hair: '#8f8f8f', robe: '#3b4452', robe2: '#1d222b', collar: '#59616c', inner: '#2a303a', eye: '#3a4656', brow: 3.2, tilt: -1, jaw: 1.06, male: true, knot: true, old: true },
  bloodlord: { skin: '#cdbdb6', hair: '#cfc8be', robe: '#2a0c10', robe2: '#0d0406', collar: '#7a1018', inner: '#12060a', eye: '#e01828', brow: 2.6, tilt: 5.5, jaw: 0.98, male: true, long: true, locks: true, shadow: 'rgba(90,10,20,.55)' },
  archer: { skin: '#c79f7d', hair: HAIR, robe: '#8a2f14', robe2: '#3d150a', collar: '#e0a040', inner: '#2a1a12', eye: '#b8641c', brow: 2.8, tilt: 2.2, jaw: 1.0, male: true, knot: true },
  storm: { skin: '#c4a58a', hair: HAIR, robe: '#1a1820', robe2: '#0a090d', collar: '#b08a3e', inner: '#221f2b', eye: '#6a5a1c', brow: 2.2, tilt: 4.5, jaw: 0.95, male: true },
};

function shade(hex, k) { const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * k)))); return `rgb(${c[0]},${c[1]},${c[2]})`; }

// what only this person has. Drawn before (under) or after (over) the front hair.
const EXTRA = {
  warden: { over(g, tc) {
    g.fillStyle = INK; g.beginPath(); g.moveTo(63, 100); g.quadraticCurveTo(96, 92, 129, 100); g.lineTo(124, 122); g.quadraticCurveTo(96, 140, 68, 122); g.closePath(); g.fill();           // cloth over the mouth
    g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1; for (const y of [108, 116]) { g.beginPath(); g.moveTo(70, y); g.quadraticCurveTo(96, y + 5, 122, y); g.stroke(); }
    g.fillStyle = INK; g.beginPath(); g.moveTo(58, 62); g.quadraticCurveTo(96, 30, 134, 62); g.lineTo(130, 46); g.quadraticCurveTo(96, 22, 62, 46); g.closePath(); g.fill(); g.fillRect(78, 22, 36, 22);   // flat cap
    g.fillStyle = tc; g.shadowColor = tc; g.shadowBlur = 8; g.beginPath(); g.moveTo(96, 44); g.lineTo(103, 51); g.lineTo(96, 58); g.lineTo(89, 51); g.closePath(); g.fill(); g.shadowBlur = 0;
    for (const s of [-1, 1]) { g.fillStyle = '#2a2e3a'; g.beginPath(); g.ellipse(96 + s * 62, 150, 30, 20, s * 0.3, 0, 7); g.fill(); g.strokeStyle = '#9c7a35'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(96 + s * 62, 152, 26, 16, s * 0.3, PI, 2 * PI); g.stroke(); }
  } },
  mage: { over(g, tc) {
    g.strokeStyle = tc; g.lineWidth = 4; g.beginPath(); g.moveTo(88, 34); g.lineTo(104, 34); g.stroke(); g.lineWidth = 3; g.beginPath(); g.moveTo(104, 34); g.quadraticCurveTo(122, 40, 126, 62); g.stroke();   // ribbon
    g.strokeStyle = '#c9a04a'; g.lineWidth = 2.4; g.beginPath(); g.arc(150, 150, 15, 0, 7); g.stroke(); g.strokeRect(144, 144, 12, 12);          // a 天衍钱 at the shoulder
    g.fillStyle = tc; g.shadowColor = tc; g.shadowBlur = 10; for (const [x, y, r] of [[34, 46, 2.2], [160, 36, 1.8], [150, 84, 1.5], [28, 100, 1.6]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } g.shadowBlur = 0;
  } },
  ranger: { over(g, tc) {
    g.strokeStyle = '#cfd6e2'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(70, 34); g.lineTo(128, 26); g.stroke(); g.fillStyle = tc; g.shadowColor = tc; g.shadowBlur = 8; g.beginPath(); g.arc(130, 26, 4, 0, 7); g.fill(); g.shadowBlur = 0;   // silver hairpin
    g.fillStyle = HAIR; g.beginPath(); g.arc(96, 30, 13, 0, 7); g.fill();
    g.strokeStyle = 'rgba(210,230,255,.75)'; g.lineWidth = 1.4; for (const [x, y] of [[36, 60], [158, 96], [30, 128]]) for (let k = 0; k < 3; k++) { const a = k * PI / 3; g.beginPath(); g.moveTo(x - Math.cos(a) * 5, y - Math.sin(a) * 5); g.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); g.stroke(); }
  } },
  shade: { over(g, tc) {
    g.fillStyle = 'rgba(150,18,34,.86)'; g.beginPath(); g.moveTo(64, 98); g.quadraticCurveTo(96, 90, 128, 98); g.lineTo(122, 126); g.quadraticCurveTo(96, 150, 70, 126); g.closePath(); g.fill();          // red veil
    g.strokeStyle = 'rgba(255,200,120,.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(64, 98); g.quadraticCurveTo(96, 90, 128, 98); g.stroke();
    g.fillStyle = HAIR; g.beginPath(); g.arc(96, 32, 15, 0, 7); g.fill(); g.strokeStyle = '#c9a04a'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(74, 24); g.lineTo(122, 42); g.stroke();
    g.fillStyle = tc; g.shadowColor = tc; g.shadowBlur = 8; g.beginPath(); g.arc(124, 43, 3.5, 0, 7); g.fill(); g.shadowBlur = 0;
  } },
  healer: { over(g) {
    g.fillStyle = '#e4e0d4'; g.beginPath(); g.moveTo(76, 110); g.quadraticCurveTo(96, 104, 116, 110); g.quadraticCurveTo(112, 150, 96, 170); g.quadraticCurveTo(80, 150, 76, 110); g.fill();                 // long white beard
    g.strokeStyle = 'rgba(120,112,98,.6)'; g.lineWidth = 1; for (const x of [88, 96, 104]) { g.beginPath(); g.moveTo(x, 116); g.quadraticCurveTo(x + (x - 96) * 0.3, 140, 96, 164); g.stroke(); }
    g.fillStyle = '#e4e0d4'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(96 + s * 8, 76); g.quadraticCurveTo(96 + s * 24, 68, 96 + s * 34, 84); g.quadraticCurveTo(96 + s * 22, 76, 96 + s * 8, 80); g.fill(); }   // drooping brows
    const hat = g.createLinearGradient(0, 20, 0, 70); hat.addColorStop(0, '#c2ab70'); hat.addColorStop(1, '#7a6a40'); g.fillStyle = hat;
    g.beginPath(); g.moveTo(96, 8); g.lineTo(176, 66); g.quadraticCurveTo(96, 84, 16, 66); g.closePath(); g.fill();                                 // straw hat
    g.strokeStyle = 'rgba(60,48,24,.45)'; g.lineWidth = 1; for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(96, 10); g.lineTo(96 + i * 12, 70); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(96, 76, 40, 8, 0, 0, PI); g.fill();
  } },
  cryo: { over(g) {
    g.shadowColor = '#9fe0ff'; g.shadowBlur = 12;
    for (let i = -2; i <= 2; i++) { const x = 96 + i * 13, h = 30 - Math.abs(i) * 8, y = 46 + Math.abs(i) * 3; const gr = g.createLinearGradient(x, y - h, x, y); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#6fc3ff'); g.fillStyle = gr; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + 5, y); g.lineTo(x, y + 6); g.lineTo(x - 5, y); g.closePath(); g.fill(); }
    g.shadowBlur = 0; g.fillStyle = 'rgba(160,220,255,.85)'; g.beginPath(); g.moveTo(96, 62); g.lineTo(99, 67); g.lineTo(96, 72); g.lineTo(93, 67); g.closePath(); g.fill();    // frost mark between the brows
    g.strokeStyle = 'rgba(210,235,255,.7)'; g.lineWidth = 1.3; for (const [x, y] of [[32, 50], [160, 60], [150, 118], [38, 112]]) for (let k = 0; k < 3; k++) { const a = k * PI / 3; g.beginPath(); g.moveTo(x - Math.cos(a) * 5, y - Math.sin(a) * 5); g.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); g.stroke(); }
  } },
  berserker: { over(g, tc) {
    g.fillStyle = 'rgba(30,22,16,.75)'; g.beginPath(); g.moveTo(66, 100); g.quadraticCurveTo(96, 96, 126, 100); g.quadraticCurveTo(124, 126, 96, 134); g.quadraticCurveTo(68, 126, 66, 100); g.fill();     // beard
    g.fillStyle = shade('#a67a58', 0.92); g.beginPath(); g.ellipse(96, 108, 12, 4.5, 0, 0, 7); g.fill();
    g.strokeStyle = '#6a3b2c'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(108, 70); g.lineTo(120, 100); g.stroke(); g.lineWidth = 1; for (const t of [0.3, 0.6]) { g.beginPath(); g.moveTo(108 + 12 * t - 4, 70 + 30 * t + 1); g.lineTo(108 + 12 * t + 4, 70 + 30 * t - 1); g.stroke(); }   // scar
    g.fillStyle = tc; g.fillRect(62, 56, 68, 9); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(62, 62, 68, 3);                                           // headband
    for (let i = 0; i < 11; i++) { const a = PI + i / 10 * PI, x = 96 + Math.cos(a) * 62, y = 150 + Math.sin(a) * 16; g.fillStyle = i % 2 ? '#7b6a55' : '#8f7d66'; g.beginPath(); g.arc(x, y, 15, 0, 7); g.fill(); }   // fur collar
  } },
  gunner: { over(g, tc) {
    g.strokeStyle = '#8b929c'; g.lineWidth = 4; g.beginPath(); g.arc(96, 36, 14, PI * 0.1, PI * 0.9, true); g.stroke(); g.fillStyle = '#8b929c'; g.fillRect(91, 16, 10, 12);        // metal crown round the topknot
    g.fillStyle = 'rgba(22,18,15,.85)'; g.beginPath(); g.moveTo(82, 110); g.quadraticCurveTo(96, 106, 110, 110); g.lineTo(106, 113); g.quadraticCurveTo(96, 110, 86, 113); g.closePath(); g.fill();   // moustache
    g.beginPath(); g.moveTo(90, 120); g.lineTo(102, 120); g.lineTo(96, 136); g.closePath(); g.fill();
    for (const s of [-1, 1]) for (let r = 0; r < 3; r++) { g.fillStyle = r % 2 ? '#596069' : '#6d7480'; g.beginPath(); g.ellipse(96 + s * (52 + r * 10), 148 + r * 9, 22, 9, s * 0.25, 0, 7); g.fill(); }   // lamellar shoulders
    g.fillStyle = '#c9b25a'; g.fillRect(140, 150, 14, 30); g.fillStyle = tc; g.shadowColor = tc; g.shadowBlur = 8; g.fillRect(145, 156, 4, 18); g.shadowBlur = 0;      // a 雷火符
  } },
  keeper: { over(g, tc) {
    g.strokeStyle = '#9a9a9a'; g.lineWidth = 3.4; g.lineCap = 'round'; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(96 + sd * 8, 77); g.quadraticCurveTo(96 + sd * 16, 73, 96 + sd * 24, 78); g.stroke(); }   // grey brows
    g.fillStyle = 'rgba(150,150,150,.9)'; g.beginPath(); g.moveTo(70, 104); g.quadraticCurveTo(96, 98, 122, 104); g.quadraticCurveTo(118, 132, 96, 140); g.quadraticCurveTo(74, 132, 70, 104); g.fill();          // short grey beard
    g.fillStyle = '#b99678'; g.beginPath(); g.ellipse(96, 110, 11, 4, 0, 0, 7); g.fill();
    for (let i = 0; i < 12; i++) { const a = PI + i / 11 * PI, x = 96 + Math.cos(a) * 64, y = 152 + Math.sin(a) * 18; g.fillStyle = i % 2 ? '#b9b4a8' : '#cfcabe'; g.beginPath(); g.arc(x, y, 16, 0, 7); g.fill(); }  // fur mantle
    g.fillStyle = '#e8eef6'; g.beginPath(); g.moveTo(150, 132); g.lineTo(158, 110); g.lineTo(166, 130); g.lineTo(174, 112); g.lineTo(178, 138); g.quadraticCurveTo(164, 160, 150, 146); g.closePath(); g.fill();    // a star-fox peering over his shoulder
    g.fillStyle = '#17120e'; g.beginPath(); g.arc(158, 136, 2, 0, 7); g.arc(170, 136, 2, 0, 7); g.fill(); g.fillStyle = tc; g.shadowColor = tc; g.shadowBlur = 8; g.beginPath(); g.arc(164, 127, 3, PI, 2 * PI); g.fill(); g.shadowBlur = 0;
  } },
  bloodlord: { over(g, tc) {
    g.fillStyle = tc; g.shadowColor = tc; g.shadowBlur = 10; g.beginPath(); g.moveTo(96, 60); g.lineTo(100, 70); g.lineTo(96, 80); g.lineTo(92, 70); g.closePath(); g.fill();                 // blood mark
    for (const sd of [-1, 1]) { g.beginPath(); g.arc(96 + sd * 14, 87.6, 3.6, 0, 7); g.fill(); } g.shadowBlur = 0;                                                    // eyes that glow
    g.strokeStyle = 'rgba(120,10,24,.6)'; g.lineWidth = 1.2; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(96 + sd * 22, 96); g.quadraticCurveTo(96 + sd * 26, 108, 96 + sd * 18, 118); g.stroke(); }
    g.fillStyle = '#d9d2c4'; for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) { const x = 96 + sd * (46 + i * 16), y = 150 - i * 4; g.beginPath(); g.moveTo(x - 6, y + 10); g.lineTo(x + sd * (4 + i * 3), y - 24 - i * 4); g.lineTo(x + 6, y + 10); g.closePath(); g.fill(); }   // bone spikes
  } },
  archer: { over(g, tc) {
    g.fillStyle = '#c8401a'; g.fillRect(62, 56, 68, 8); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(62, 62, 68, 2.5);                                                 // red headband
    g.strokeStyle = '#c8401a'; g.lineWidth = 5; g.beginPath(); g.moveTo(128, 60); g.quadraticCurveTo(146, 70, 142, 96); g.stroke();
    g.strokeStyle = '#e0a040'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(88, 34); g.lineTo(104, 34); g.stroke();
    g.strokeStyle = '#5e2f18'; g.lineWidth = 5; g.beginPath(); g.moveTo(26, 192); g.quadraticCurveTo(8, 120, 34, 44); g.stroke(); g.strokeStyle = tc; g.lineWidth = 1.2; g.beginPath(); g.moveTo(30, 190); g.lineTo(35, 46); g.stroke();   // the bow over his shoulder
    for (let i = 0; i < 3; i++) { const x = 150 + i * 9; g.strokeStyle = '#5e4630'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 150); g.lineTo(x + 6, 112); g.stroke(); g.fillStyle = tc; g.shadowColor = tc; g.shadowBlur = 8; g.beginPath(); g.moveTo(x + 6, 104); g.lineTo(x + 11, 116); g.lineTo(x + 1, 116); g.closePath(); g.fill(); g.shadowBlur = 0; }  // fire-fletched arrows
    g.fillStyle = tc; g.shadowColor = tc; g.shadowBlur = 8; for (const [x, y, r] of [[46, 30, 2], [160, 52, 1.8], [150, 86, 1.4]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } g.shadowBlur = 0;
  } },
  storm: { over(g, tc) {
    g.fillStyle = INK; g.beginPath(); g.moveTo(60, 60); g.quadraticCurveTo(96, 40, 132, 60); g.lineTo(128, 42); g.quadraticCurveTo(96, 28, 64, 42); g.closePath(); g.fill(); g.fillRect(74, 6, 44, 34);   // 乌纱帽
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(96 + s * 22, 30); g.lineTo(96 + s * 78, 22); g.lineTo(96 + s * 78, 32); g.lineTo(96 + s * 22, 40); g.closePath(); g.fill(); }
    g.fillStyle = '#b08a3e'; g.fillRect(90, 42, 12, 10);
    g.strokeStyle = 'rgba(22,18,15,.85)'; g.lineWidth = 2; g.beginPath(); g.moveTo(84, 111); g.quadraticCurveTo(96, 107, 108, 111); g.stroke(); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(96 + s * 12, 111); g.lineTo(96 + s * 15, 124); g.stroke(); }   // thin moustache
    g.strokeStyle = tc; g.shadowColor = tc; g.shadowBlur = 10; g.lineWidth = 2; g.beginPath(); g.moveTo(150, 46); g.lineTo(142, 66); g.lineTo(152, 66); g.lineTo(140, 92); g.stroke(); g.beginPath(); g.moveTo(40, 96); g.lineTo(46, 110); g.lineTo(38, 110); g.lineTo(46, 128); g.stroke(); g.shadowBlur = 0;
  } },
};

export function portrait(id, tint = [0.4, 0.75, 1]) {
  const key = id + tint.map(v => v.toFixed(2)).join();
  if (cache[key]) return cache[key];
  const P = SPEC[id], X = EXTRA[id], N = 192, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d');
  const tc = `rgb(${Math.round(tint[0] * 255)},${Math.round(tint[1] * 255)},${Math.round(tint[2] * 255)})`, ta = a => `rgba(${Math.round(tint[0] * 255)},${Math.round(tint[1] * 255)},${Math.round(tint[2] * 255)},${a})`;
  // backdrop: night sky in the hero's colour, a pale disc behind the head
  const bg = g.createRadialGradient(96, 70, 6, 96, 96, 150); bg.addColorStop(0, ta(0.55)); bg.addColorStop(0.5, ta(0.16)); bg.addColorStop(1, '#05070b'); g.fillStyle = '#05070b'; g.fillRect(0, 0, N, N); g.fillStyle = bg; g.fillRect(0, 0, N, N);
  g.strokeStyle = ta(0.3); g.lineWidth = 1.5; g.beginPath(); g.arc(96, 80, 74, 0, 7); g.stroke(); g.fillStyle = ta(0.08); g.beginPath(); g.arc(96, 80, 74, 0, 7); g.fill();
  // hair that falls behind the shoulders
  if (P.long) { g.fillStyle = shade(P.hair, 0.8); g.beginPath(); g.moveTo(58, 70); g.quadraticCurveTo(40, 130, 46, 192); g.lineTo(146, 192); g.quadraticCurveTo(152, 130, 134, 70); g.closePath(); g.fill(); }
  // robe and crossed collar
  const rg = g.createLinearGradient(0, 124, 0, 192); rg.addColorStop(0, P.robe); rg.addColorStop(1, P.robe2); g.fillStyle = rg;
  g.beginPath(); g.moveTo(10, 192); g.quadraticCurveTo(24, 142, 72, 128); g.lineTo(120, 128); g.quadraticCurveTo(168, 142, 182, 192); g.closePath(); g.fill();
  g.fillStyle = P.inner; g.beginPath(); g.moveTo(80, 128); g.lineTo(112, 128); g.lineTo(98, 168); g.closePath(); g.fill();
  g.fillStyle = P.collar; g.beginPath(); g.moveTo(74, 126); g.lineTo(86, 126); g.lineTo(112, 192); g.lineTo(96, 192); g.closePath(); g.fill(); g.beginPath(); g.moveTo(118, 126); g.lineTo(106, 126); g.lineTo(88, 170); g.lineTo(98, 180); g.closePath(); g.fill();
  // neck and head
  g.fillStyle = shade(P.skin, 0.78); g.fillRect(84, 108, 24, 26);
  const jw = 30 * P.jaw, hg = g.createLinearGradient(64, 52, 128, 126); hg.addColorStop(0, shade(P.skin, 1.1)); hg.addColorStop(0.6, P.skin); hg.addColorStop(1, shade(P.skin, 0.72)); g.fillStyle = hg;
  g.beginPath(); g.moveTo(96 - 30, 82); g.bezierCurveTo(96 - 30, 48, 96 + 30, 48, 96 + 30, 82); g.bezierCurveTo(96 + 30, 104, 96 + jw * 0.55, 128, 96, 129); g.bezierCurveTo(96 - jw * 0.55, 128, 96 - 30, 104, 96 - 30, 82); g.closePath(); g.fill();
  g.fillStyle = shade(P.skin, 0.85); g.beginPath(); g.ellipse(65, 90, 4, 8, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(127, 90, 4, 8, 0, 0, 7); g.fill();
  if (P.shadow) for (const s of [-1, 1]) { g.fillStyle = P.shadow; g.beginPath(); g.ellipse(96 + s * 14, 85, 10, 5, s * -0.15, 0, 7); g.fill(); }
  // eyes, brows, nose, mouth
  for (const s of [-1, 1]) {
    const ex = 96 + s * 14, ey = 88;
    g.fillStyle = '#f2ece2'; g.beginPath(); g.moveTo(ex - 8, ey + 0.5); g.quadraticCurveTo(ex, ey - 5.5, ex + 8, ey + 0.5 - s * P.tilt * 0.25); g.quadraticCurveTo(ex, ey + 4, ex - 8, ey + 0.5); g.fill();
    g.fillStyle = P.eye; g.beginPath(); g.arc(ex, ey - 0.4, 3.4, 0, 7); g.fill(); g.fillStyle = '#0b0a09'; g.beginPath(); g.arc(ex, ey - 0.4, 1.6, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(ex - 1.2, ey - 1.6, 0.9, 0, 7); g.fill();
    g.strokeStyle = '#17120e'; g.lineWidth = P.male ? 1.6 : 2.1; g.beginPath(); g.moveTo(ex - 8.5, ey + 0.5); g.quadraticCurveTo(ex, ey - 6, ex + 8.5 + (P.male ? 0 : s * 2), ey - (P.male ? 0 : 1.5)); g.stroke();
    g.strokeStyle = P.old ? '#d8d4c8' : shade(P.hair === HAIR ? '#241c16' : P.hair, 0.8); g.lineWidth = P.brow; g.lineCap = 'round'; g.beginPath(); g.moveTo(ex - s * 9, ey - 9 - P.tilt * 0.9); g.quadraticCurveTo(ex, ey - 12 - P.tilt * 0.2, ex + s * 9, ey - 10 + P.tilt * 0.5); if (!P.old) g.stroke();
  }
  g.strokeStyle = shade(P.skin, 0.62); g.lineWidth = 1.5; g.beginPath(); g.moveTo(97, 90); g.quadraticCurveTo(99, 100, 95, 104); g.quadraticCurveTo(97, 106, 100, 104); g.stroke();
  g.strokeStyle = P.lips || shade(P.skin, 0.5); g.lineWidth = P.lips ? 3 : 2; g.beginPath(); g.moveTo(88, 113); g.quadraticCurveTo(96, P.male ? 114 : 116.5, 104, 113); g.stroke();
  if (P.old) { g.strokeStyle = shade(P.skin, 0.66); g.lineWidth = 1; for (const [x0, y0, x1, y1] of [[76, 66, 116, 66], [80, 71, 112, 71], [72, 96, 78, 104], [120, 96, 114, 104]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); } }
  // front hair: hairline, the topknot, and for the women two locks beside the face
  g.fillStyle = P.hair; g.beginPath(); g.moveTo(63, 86); g.bezierCurveTo(56, 34, 136, 34, 129, 86); g.bezierCurveTo(124, 62, 112, 56, 96, 60); g.bezierCurveTo(80, 56, 68, 62, 63, 86); g.closePath(); g.fill();
  if (P.knot) { g.beginPath(); g.arc(96, 34, 12, 0, 7); g.fill(); }
  if (P.locks) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(96 + s * 30, 66); g.quadraticCurveTo(96 + s * 38, 110, 96 + s * 30, 150); g.quadraticCurveTo(96 + s * 26, 110, 96 + s * 27, 70); g.closePath(); g.fill(); }
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(96 + i * 7, 40); g.quadraticCurveTo(96 + i * 9, 50, 96 + i * 10, 62); g.stroke(); }
  X.over(g, tc);
  // rim light in the hero's colour from the upper right, and a vignette
  g.globalCompositeOperation = 'soft-light'; const rl = g.createRadialGradient(150, 40, 4, 150, 40, 130); rl.addColorStop(0, ta(0.9)); rl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rl; g.fillRect(0, 0, N, N);
  g.globalCompositeOperation = 'source-over'; const vg = g.createRadialGradient(96, 90, 70, 96, 96, 140); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = vg; g.fillRect(0, 0, N, N);
  return (cache[key] = cv.toDataURL());
}
