// appicon.mjs — the web-app icon (home screen, browser tab, installed app), drawn as SVG in code like everything else.
// A frost-and-ember taiji turned 45° (frost top-left, ember bottom-right, as on the title), each half carrying a seed of the
// other, inside a brass ring with the eight trigram marks, over a crossed sword (tip to the ember corner) and fly-whisk 拂尘
// (silver hair to the frost corner): the sword-cultivator and the Daoist, the two figures of a 修仙 world. It fills the whole square: iOS and Android round the corners
// themselves. It reads at 16 px (two colours and a ring) and rewards a look at home-screen size (facets, wisps, glow).
// iconSVG({ plain, mask }) — plain drops the fine detail for the 16–32 px tab icon. Rendered to PNG by icon.mjs.
export function iconSVG({ plain = false, mask = false } = {}) {   // mask: shrunk into Android's round safe zone (radius 0.8)
  const C = 256, R = 150, r = R / 2;
  // the taiji upright (frost on the left), turned later: big half-circle down the left, then the two small half-circles
  const frost = `M${C},${C - R} A${R},${R} 0 0,0 ${C},${C + R} A${r},${r} 0 0,1 ${C},${C} A${r},${r} 0 0,0 ${C},${C - R} Z`;
  const ember = `M${C},${C - R} A${R},${R} 0 0,1 ${C},${C + R} A${r},${r} 0 0,1 ${C},${C} A${r},${r} 0 0,0 ${C},${C - R} Z`;
  const ring = R + 22;
  const trigrams = [0b111, 0b110, 0b101, 0b100, 0b011, 0b010, 0b001, 0b000].map((bits, k) => {   // 先天八卦 order, round the ring
    const a = k * 45 + 22.5, lines = [];   // off the diagonals, which the sword and whisk use
    for (let i = 0; i < 3; i++) {
      const y = -(ring + 14 + i * 9), w = 26;
      lines.push((bits >> (2 - i)) & 1 ? `<rect x="${-w / 2}" y="${y - 2.5}" width="${w}" height="5" rx="1"/>`
        : `<rect x="${-w / 2}" y="${y - 2.5}" width="${w * 0.4}" height="5" rx="1"/><rect x="${w * 0.1}" y="${y - 2.5}" width="${w * 0.4}" height="5" rx="1"/>`);
    }
    return `<g transform="translate(${C},${C}) rotate(${a})">${lines.join('')}</g>`;
  }).join('');
  const facets = plain ? '' : `<g stroke="#f4fbff" stroke-width="2" fill="none" opacity=".35" stroke-linecap="round">
      <path d="M158,232 L196,196 L214,248 L178,286 Z"/><path d="M196,196 L230,150"/><path d="M214,248 L238,270"/><path d="M178,286 L150,300"/>
      <path d="M190,140 l14,-10 M170,175 l-16,4"/></g>`;
  const wisps = plain ? '' : `<g fill="none" stroke="#fff1cf" stroke-width="2.4" opacity=".45" stroke-linecap="round">
      <path d="M318,300 C340,270 312,250 336,222"/><path d="M296,350 C322,326 300,304 324,282"/><path d="M350,330 C366,312 352,296 368,280"/></g>`;
  // the sword (jian): straight double-edged blade with a ridge, brass guard, bound grip, pommel, an ember tassel
  const sword = `<g transform="translate(${C},${C}) rotate(45) scale(.9) translate(0,18)">
      <path d="M0,-338 L13,-300 L13,190 L-13,190 L-13,-300 Z" fill="url(#blade)" stroke="#0a0d14" stroke-width="2.5"/>
      <path d="M0,-334 L0,186" stroke="#ffffff" stroke-width="2" opacity=".55"/><path d="M-13,-300 L-13,190" stroke="#ff9a5c" stroke-width="1.5" opacity=".5"/>
      <path d="M-34,196 C-24,188 -12,188 0,182 C12,188 24,188 34,196 C24,204 12,204 0,210 C-12,204 -24,204 -34,196 Z" fill="url(#br)" stroke="#0a0d14" stroke-width="2.5"/>
      <rect x="-9" y="210" width="18" height="66" rx="3" fill="#2a1712" stroke="#0a0d14" stroke-width="2.5"/>
      ${[0, 1, 2, 3, 4, 5].map(i => `<path d="M-9,${216 + i * 10} L9,${222 + i * 10}" stroke="#7a4a2a" stroke-width="3"/>`).join('')}
      <circle cx="0" cy="286" r="12" fill="url(#br)" stroke="#0a0d14" stroke-width="2.5"/>
      <path d="M0,298 C-4,312 6,322 -2,338 M0,298 C4,314 -6,326 4,342 M0,298 C0,316 0,330 0,346" stroke="#ff6a2a" stroke-width="3" fill="none" stroke-linecap="round"/>
    </g>`;
  // the fly-whisk (拂尘): a jade-and-brass handle with a ring, and a long fan of silver horsetail hair streaming out
  const hair = Array.from({ length: 23 }, (_, i) => {   // horsetail: narrow at the cap, fanning out and drooping to one side
    const t = i / 22 - 0.5, end = t * 112 + 18, len = 284 + 36 * Math.cos(t * 2.8) + ((i * 7) % 5) * 4;   // ragged, longest in the middle
    return `<path d="M${t * 16},-176 C${t * 30 + 20},-230 ${end + 40},-${len - 40} ${end},-${len}" stroke="${i % 4 ? '#eaf5ff' : '#a9cdec'}" stroke-width="${i % 2 ? 2.4 : 3.4}" opacity="${(0.55 + 0.45 * Math.cos(t * 2.6)).toFixed(2)}"/>`;
  }).join('');
  const whisk = `<g transform="translate(${C},${C}) rotate(-45) scale(.9)">
      <path d="M-10,-190 L10,-190 L12,-172 L-12,-172 Z" fill="url(#br)" stroke="#0a0d14" stroke-width="2"/>
      <g fill="none" stroke-linecap="round">${hair}</g>
      <rect x="-9" y="176" width="18" height="104" rx="6" fill="url(#jade)" stroke="#0a0d14" stroke-width="2.5"/>
      <rect x="-12" y="172" width="24" height="14" rx="3" fill="url(#br)" stroke="#0a0d14" stroke-width="2"/>
      <rect x="-11" y="268" width="22" height="12" rx="3" fill="url(#br)" stroke="#0a0d14" stroke-width="2"/>
      <circle cx="0" cy="294" r="11" fill="none" stroke="url(#br)" stroke-width="5"/>
      <path d="M0,305 C-3,318 4,326 -1,340 M0,305 C3,320 -4,330 2,344" stroke="#ff6a2a" stroke-width="3" fill="none" stroke-linecap="round"/>
    </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="72%"><stop offset="0" stop-color="#172133"/><stop offset=".6" stop-color="#0b1019"/><stop offset="1" stop-color="#05070b"/></radialGradient>
    <radialGradient id="tf" cx="22%" cy="22%" r="80%"><stop offset="0" stop-color="#6fc3ff" stop-opacity=".32"/><stop offset="1" stop-color="#6fc3ff" stop-opacity="0"/></radialGradient>
    <radialGradient id="te" cx="78%" cy="78%" r="80%"><stop offset="0" stop-color="#ff8a4d" stop-opacity=".34"/><stop offset="1" stop-color="#ff8a4d" stop-opacity="0"/></radialGradient>
    <radialGradient id="fr" gradientUnits="userSpaceOnUse" cx="200" cy="196" r="170"><stop offset="0" stop-color="#e8f7ff"/><stop offset=".35" stop-color="#7cc8ff"/><stop offset=".8" stop-color="#2a6cb8"/><stop offset="1" stop-color="#173f78"/></radialGradient>
    <radialGradient id="em" gradientUnits="userSpaceOnUse" cx="312" cy="316" r="170"><stop offset="0" stop-color="#ffe2a0"/><stop offset=".3" stop-color="#ff9a4a"/><stop offset=".75" stop-color="#d4421e"/><stop offset="1" stop-color="#7a1c10"/></radialGradient>
    <radialGradient id="orb" cx="50%" cy="50%" r="50%"><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>
    <radialGradient id="eyeE"><stop offset="0" stop-color="#fff3d0"/><stop offset=".45" stop-color="#ffb060"/><stop offset="1" stop-color="#e2541f"/></radialGradient>
    <radialGradient id="eyeF"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#a6dcff"/><stop offset="1" stop-color="#3586d6"/></radialGradient>
    <linearGradient id="br" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6dc9c"/><stop offset=".5" stop-color="#dfbd78"/><stop offset="1" stop-color="#8f6a2c"/></linearGradient>
    <linearGradient id="blade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8fa6bf"/><stop offset=".5" stop-color="#eef6ff"/><stop offset="1" stop-color="#6d8299"/></linearGradient>
    <linearGradient id="jade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1f6b5a"/><stop offset=".5" stop-color="#7fd1b4"/><stop offset="1" stop-color="#1b5a4b"/></linearGradient>
    <filter id="soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="8"/></filter>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
    <clipPath id="cf"><path d="${frost}" transform="rotate(-45 ${C} ${C})"/></clipPath><clipPath id="ce"><path d="${ember}" transform="rotate(-45 ${C} ${C})"/></clipPath>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <rect width="512" height="512" fill="url(#tf)"/><rect width="512" height="512" fill="url(#te)"/>
  <g transform="${plain || mask ? `translate(${C} ${C}) scale(${plain ? 1.36 : 0.9}) translate(${-C} ${-C})` : ''}">
  ${plain ? '' : whisk + sword}
  <circle cx="${C}" cy="${C}" r="${ring}" fill="#070a10"/>
  <g transform="rotate(-45 ${C} ${C})">
    <path d="${frost}" fill="#6fc3ff" filter="url(#glow)" opacity=".55"/>
    <path d="${ember}" fill="#ff7a3a" filter="url(#glow)" opacity=".6"/>
  </g>
  <g clip-path="url(#cf)"><rect width="512" height="512" fill="url(#fr)"/>${facets}</g>
  <g clip-path="url(#ce)"><rect width="512" height="512" fill="url(#em)"/>${wisps}</g>
  <circle cx="${C}" cy="${C}" r="${R}" fill="url(#orb)"/>
  <g transform="rotate(-45 ${C} ${C})">
    ${plain ? '' : `<circle cx="${C}" cy="${C - r}" r="34" fill="#ff8a4d" opacity=".35" filter="url(#soft)"/><circle cx="${C}" cy="${C + r}" r="34" fill="#9fd8ff" opacity=".4" filter="url(#soft)"/>`}
    <circle cx="${C}" cy="${C - r}" r="${plain ? 24 : 20}" fill="url(#eyeE)"/>
    <circle cx="${C}" cy="${C + r}" r="${plain ? 24 : 20}" fill="url(#eyeF)"/>
  </g>
  <circle cx="${C}" cy="${C}" r="${R + 6}" fill="none" stroke="#05070b" stroke-width="6" opacity=".7"/>
  <circle cx="${C}" cy="${C}" r="${ring}" fill="none" stroke="url(#br)" stroke-width="${plain ? 14 : 9}"/>
  ${plain ? '' : `<circle cx="${C}" cy="${C}" r="${ring - 10}" fill="none" stroke="#dfbd78" stroke-width="1.5" opacity=".55"/>`}
  ${plain ? '' : `<g fill="url(#br)">${trigrams}</g>`}
  </g>
</svg>`;
}
