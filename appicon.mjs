// appicon.mjs — the web-app icon (home screen, browser tab, installed app), drawn as SVG in code like everything else.
// A frost-and-ember taiji (frost on the left, ember on the right), each half carrying a seed of the other, inside a brass
// ring with the eight trigram marks; across its face a crossed sword (tip to the upper right) and fly-whisk 拂尘 (silver hair
// to the upper left): the sword-cultivator and the Daoist. Everything sits inside the ring (the author's ask, 2026-11-20); the
// two crossed pieces pass between the taiji's two seeds, so neither is covered. The square around it is dark ink: iOS and
// Android round the corners themselves. It reads at 16 px (two colours and a ring) and rewards a look at home-screen size.
// iconSVG({ plain, mask }) — plain drops the fine detail (and the sword and whisk) for the 16–32 px tab icon; mask shrinks it
// into Android's round safe zone. Rendered to PNG by icon.mjs.
export function iconSVG({ plain = false, mask = false } = {}) {
  const C = 256, R = 150, r = R / 2;
  // the taiji: big half-circle down the left, then the two small half-circles (frost's head at the top, ember's at the bottom)
  const frost = `M${C},${C - R} A${R},${R} 0 0,0 ${C},${C + R} A${r},${r} 0 0,1 ${C},${C} A${r},${r} 0 0,0 ${C},${C - R} Z`;
  const ember = `M${C},${C - R} A${R},${R} 0 0,1 ${C},${C + R} A${r},${r} 0 0,1 ${C},${C} A${r},${r} 0 0,0 ${C},${C - R} Z`;
  const ring = R + 22;
  const trigrams = [0b111, 0b110, 0b101, 0b100, 0b011, 0b010, 0b001, 0b000].map((bits, k) => {   // 先天八卦 order, round the ring
    const a = k * 45, lines = [];   // 乾 at the top
    for (let i = 0; i < 3; i++) {
      const y = -(ring + 14 + i * 9), w = 26;
      lines.push((bits >> (2 - i)) & 1 ? `<rect x="${-w / 2}" y="${y - 2.5}" width="${w}" height="5" rx="1"/>`
        : `<rect x="${-w / 2}" y="${y - 2.5}" width="${w * 0.4}" height="5" rx="1"/><rect x="${w * 0.1}" y="${y - 2.5}" width="${w * 0.4}" height="5" rx="1"/>`);
    }
    return `<g transform="translate(${C},${C}) rotate(${a})">${lines.join('')}</g>`;
  }).join('');
  const facets = plain ? '' : `<g stroke="#f4fbff" stroke-width="2" fill="none" opacity=".3" stroke-linecap="round">
      <path d="M140,262 L170,236 L186,276 L158,304 Z"/><path d="M170,236 L176,196"/><path d="M158,304 L150,336"/><path d="M196,140 l10,-14"/></g>`;
  const wisps = plain ? '' : `<g fill="none" stroke="#fff1cf" stroke-width="2.4" opacity=".4" stroke-linecap="round">
      <path d="M340,300 C356,274 334,256 352,230"/><path d="M362,262 C374,244 360,230 372,212"/><path d="M300,388 C318,370 304,356 318,340"/></g>`;
  // the sword (jian), drawn pointing up and then laid on the diagonal: double-edged blade with a ridge, brass guard, bound
  // grip, pommel, an ember tassel. In front of the taiji, all of it inside the disk.
  const sword = `<g transform="translate(${C},${C}) rotate(45)" filter="url(#drop)">
      <path d="M0,-138 L9,-114 L9,40 L-9,40 L-9,-114 Z" fill="url(#blade)" stroke="#0a0d14" stroke-width="2"/>
      <path d="M0,-134 L0,38" stroke="#ffffff" stroke-width="1.6" opacity=".7"/>
      <path d="M-26,46 C-18,40 -9,40 0,36 C9,40 18,40 26,46 C18,52 9,52 0,57 C-9,52 -18,52 -26,46 Z" fill="url(#br)" stroke="#0a0d14" stroke-width="2"/>
      <rect x="-6" y="56" width="12" height="38" rx="2" fill="#2a1712" stroke="#0a0d14" stroke-width="2"/>
      ${[0, 1, 2, 3].map(i => `<path d="M-6,${61 + i * 8} L6,${66 + i * 8}" stroke="#8a5a32" stroke-width="2.4"/>`).join('')}
      <circle cx="0" cy="101" r="8" fill="url(#br)" stroke="#0a0d14" stroke-width="2"/>
      <path d="M0,109 C-3,118 4,124 -1,136 M0,109 C3,119 -4,126 2,138" stroke="#ff6a2a" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    </g>`;
  // the fly-whisk (拂尘): jade handle with brass caps and a ring, and a fan of silver horsetail hair, drooping to one side
  const hair = Array.from({ length: 19 }, (_, i) => {
    const t = i / 18 - 0.5, end = t * 64 + 8, len = 120 + 16 * Math.cos(t * 2.8) + ((i * 7) % 5) * 2;   // ragged, longest in the middle
    return `<path d="M${(t * 10).toFixed(1)},-40 C${(t * 18 + 10).toFixed(1)},-66 ${(end + 20).toFixed(1)},-${(len - 22).toFixed(1)} ${end.toFixed(1)},-${len.toFixed(1)}" stroke="${i % 4 ? '#f2f8ff' : '#b4d4ee'}" stroke-width="${i % 2 ? 1.8 : 2.6}" opacity="${(0.65 + 0.35 * Math.cos(t * 2.6)).toFixed(2)}"/>`;
  }).join('');
  const whisk = `<g transform="translate(${C},${C}) rotate(-45)" filter="url(#drop)">
      <g fill="none" stroke-linecap="round">${hair}</g>
      <rect x="-5" y="-30" width="10" height="122" rx="4" fill="url(#jade)" stroke="#0a0d14" stroke-width="2"/>
      <path d="M-7,-44 L7,-44 L9,-28 L-9,-28 Z" fill="url(#br)" stroke="#0a0d14" stroke-width="2"/>
      <rect x="-7" y="88" width="14" height="10" rx="2" fill="url(#br)" stroke="#0a0d14" stroke-width="2"/>
      <circle cx="0" cy="106" r="7" fill="none" stroke="url(#br)" stroke-width="3.5"/>
      <path d="M0,113 C-3,121 3,127 -1,137 M0,113 C3,122 -3,129 2,139" stroke="#ff6a2a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="72%"><stop offset="0" stop-color="#172133"/><stop offset=".6" stop-color="#0b1019"/><stop offset="1" stop-color="#05070b"/></radialGradient>
    <radialGradient id="tf" cx="12%" cy="40%" r="75%"><stop offset="0" stop-color="#6fc3ff" stop-opacity=".32"/><stop offset="1" stop-color="#6fc3ff" stop-opacity="0"/></radialGradient>
    <radialGradient id="te" cx="88%" cy="60%" r="75%"><stop offset="0" stop-color="#ff8a4d" stop-opacity=".34"/><stop offset="1" stop-color="#ff8a4d" stop-opacity="0"/></radialGradient>
    <radialGradient id="fr" gradientUnits="userSpaceOnUse" cx="200" cy="200" r="180"><stop offset="0" stop-color="#e8f7ff"/><stop offset=".35" stop-color="#7cc8ff"/><stop offset=".8" stop-color="#2a6cb8"/><stop offset="1" stop-color="#173f78"/></radialGradient>
    <radialGradient id="em" gradientUnits="userSpaceOnUse" cx="312" cy="312" r="180"><stop offset="0" stop-color="#ffe2a0"/><stop offset=".3" stop-color="#ff9a4a"/><stop offset=".75" stop-color="#d4421e"/><stop offset="1" stop-color="#7a1c10"/></radialGradient>
    <radialGradient id="orb" cx="50%" cy="50%" r="50%"><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>
    <radialGradient id="eyeE"><stop offset="0" stop-color="#fff3d0"/><stop offset=".45" stop-color="#ffb060"/><stop offset="1" stop-color="#e2541f"/></radialGradient>
    <radialGradient id="eyeF"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#a6dcff"/><stop offset="1" stop-color="#3586d6"/></radialGradient>
    <linearGradient id="br" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6dc9c"/><stop offset=".5" stop-color="#dfbd78"/><stop offset="1" stop-color="#8f6a2c"/></linearGradient>
    <linearGradient id="blade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8fa6bf"/><stop offset=".5" stop-color="#eef6ff"/><stop offset="1" stop-color="#6d8299"/></linearGradient>
    <linearGradient id="jade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1f6b5a"/><stop offset=".5" stop-color="#7fd1b4"/><stop offset="1" stop-color="#1b5a4b"/></linearGradient>
    <filter id="drop" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="3" stdDeviation="3.5" flood-color="#000" flood-opacity=".7"/></filter>
    <filter id="soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="8"/></filter>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
    <clipPath id="cf"><path d="${frost}"/></clipPath><clipPath id="ce"><path d="${ember}"/></clipPath>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <rect width="512" height="512" fill="url(#tf)"/><rect width="512" height="512" fill="url(#te)"/>
  <g transform="${plain || mask ? `translate(${C} ${C}) scale(${plain ? 1.36 : 0.9}) translate(${-C} ${-C})` : ''}">
  <circle cx="${C}" cy="${C}" r="${ring}" fill="#070a10"/>
  <g>
    <path d="${frost}" fill="#6fc3ff" filter="url(#glow)" opacity=".55"/>
    <path d="${ember}" fill="#ff7a3a" filter="url(#glow)" opacity=".6"/>
  </g>
  <g clip-path="url(#cf)"><rect width="512" height="512" fill="url(#fr)"/>${facets}</g>
  <g clip-path="url(#ce)"><rect width="512" height="512" fill="url(#em)"/>${wisps}</g>
  <circle cx="${C}" cy="${C}" r="${R}" fill="url(#orb)"/>
  <g>
    ${plain ? '' : `<circle cx="${C}" cy="${C - r}" r="34" fill="#ff8a4d" opacity=".35" filter="url(#soft)"/><circle cx="${C}" cy="${C + r}" r="34" fill="#9fd8ff" opacity=".4" filter="url(#soft)"/>`}
    <circle cx="${C}" cy="${C - r}" r="${plain ? 24 : 20}" fill="url(#eyeE)"/>
    <circle cx="${C}" cy="${C + r}" r="${plain ? 24 : 20}" fill="url(#eyeF)"/>
  </g>
  <circle cx="${C}" cy="${C}" r="${R + 6}" fill="none" stroke="#05070b" stroke-width="6" opacity=".7"/>
  <circle cx="${C}" cy="${C}" r="${ring}" fill="none" stroke="url(#br)" stroke-width="${plain ? 14 : 9}"/>
  ${plain ? '' : `<circle cx="${C}" cy="${C}" r="${ring - 10}" fill="none" stroke="#dfbd78" stroke-width="1.5" opacity=".55"/>`}
  ${plain ? '' : `<g fill="url(#br)">${trigrams}</g>`}
  ${plain ? '' : whisk + sword}
  </g>
</svg>`;
}
