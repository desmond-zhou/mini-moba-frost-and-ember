// config.js — map layout, hero kits, items, tuning. Everything the game needs to know that is not code.
export const FROST = 0, EMBER = 1, NEUTRAL = 2;
export const sideSign = team => (team === FROST ? -1 : 1);

// ---------------------------------------------------------------------------------------------------------------------
// Two modes share every mechanic (abilities, passives, items, realms, brush, recall). What differs is the ground they are
// fought on and a handful of numbers, and each mode keeps its own: 一路's are frozen, 三路's are tuned on their own.
//
// A lane is a path from the frost core to the ember core, measured by s along it; frost marches toward larger s. Everything
// that moves along a lane (disciples, bots, tower placement) works in s and asks the lane for a point: at(s, sideways).
//   一路: the old curve z = f(x). s is simply x, sideways is simply z — the numbers come out exactly as they always did.
//   三路: the 王者 layout. Bases in opposite corners, the middle lane on the diagonal, the side lanes hugging the edges and
//         turning at the far corners, the river on the other diagonal, four quarters of jungle between.
// ---------------------------------------------------------------------------------------------------------------------
const funcLane = (name, f, half, towers) => ({
  name, func: true, f, s0: -half, s1: half, towers,
  at: (s, o = 0) => ({ x: s, z: f(s) + o }), proj: x => x, dist: (x, z) => Math.abs(z - f(x)), tan: () => ({ x: 1, z: 0 }),
  towerS: (team, tier) => sideSign(team) * towers[tier - 1], towerOff: team => (team === FROST ? 3.4 : -3.4),
});
// corner-cutting keeps the ends and rounds every turn
const chaikin = (pts, n) => { for (let k = 0; k < n; k++) { const out = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } out.push(pts[pts.length - 1]); pts = out; } return pts; };
function polyline(ctrl, smooth = 2) {
  const P = chaikin(ctrl, smooth), cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const len = cum[cum.length - 1], n = P.length - 1;
  const seg = s => { s = Math.max(0, Math.min(len, s)); let i = 0; while (i < n - 1 && cum[i + 1] < s) i++; return i; };
  const tan = s => { const i = seg(s), d = cum[i + 1] - cum[i] || 1; return { x: (P[i + 1][0] - P[i][0]) / d, z: (P[i + 1][1] - P[i][1]) / d }; };
  const at = (s, o = 0) => { const i = seg(s), d = cum[i + 1] - cum[i] || 1, k = (s - cum[i]) / d, tx = (P[i + 1][0] - P[i][0]) / d, tz = (P[i + 1][1] - P[i][1]) / d; return { x: P[i][0] + (P[i + 1][0] - P[i][0]) * k - tz * o, z: P[i][1] + (P[i + 1][1] - P[i][1]) * k + tx * o }; };
  // nearest point on the path: [distance, s, signed sideways offset]
  const near = (x, z) => { let bd = 1e9, bs = 0, bo = 0; for (let i = 0; i < n; i++) { const ax = P[i][0], az = P[i][1], dx = P[i + 1][0] - ax, dz = P[i + 1][1] - az, L2 = dx * dx + dz * dz || 1, k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), qx = x - ax - dx * k, qz = z - az - dz * k, d = Math.hypot(qx, qz); if (d < bd) { bd = d; bs = cum[i] + Math.sqrt(L2) * k; bo = (dx * qz - dz * qx) / Math.sqrt(L2); } } return [bd, bs, bo]; };
  return { P, len, at, tan, near };
}
const pathLane = (name, ctrl, towers) => { const p = polyline(ctrl); return {
  name, path: p, s0: 0, s1: p.len, towers, at: p.at, tan: p.tan, proj: (x, z) => p.near(x, z)[1], dist: (x, z) => p.near(x, z)[0],
  towerS: (team, tier) => p.len / 2 + sideSign(team) * towers[tier - 1], towerOff: team => (team === FROST ? 3.4 : -3.4),
}; };
const mirror = list => list.flatMap(b => (b.x === 0 && b.z === 0 ? [b] : [b, { ...b, x: -b.x, z: -b.z }]));   // the maps are point-symmetric

const sineZ = x => 10 * Math.sin(x * Math.PI / 80), sineRiver = z => 6 * Math.sin(z * Math.PI * 1.5 / 48);
export const MODES = {
  single: {
    id: 'single', name: '一路 · 速战', team: 3, blurb: '一条路，3 对 3，十五分钟上下。',
    map: { hx: 80, hz: 48, ax: 1, az: 0, biome: 1, mini: [210, 126], base: 15, baseF: 4 },
    core: t => ({ x: sideSign(t) * 64, z: sineZ(sideSign(t) * 64) }), fountain: t => ({ x: sideSign(t) * 75, z: sineZ(sideSign(t) * 75) }),
    lanes: () => [{ ...funcLane('', sineZ, 64, [24, 46]), glsl: '10.0 * sin(p.x * 0.0392699)' }], mid: 0,
    river: () => ({ func: true, glsl: '6.0 * sin(p.y * 0.0981748)', f: sineRiver, dist: (x, z) => Math.abs(x - sineRiver(z)), signed: (x, z) => sineRiver(z) - x, at: (t, o) => { const z = (t * 2 - 1) * 48; return { x: sineRiver(z) + o, z }; } }),
    camps: [
      { x: -30, z: 25, r: 7, kind: 'golem', n: 2 }, { x: 30, z: -25, r: 7, kind: 'golem', n: 2 },
      { x: -15, z: -28, r: 7, kind: 'golem', n: 2 }, { x: 15, z: 28, r: 7, kind: 'golem', n: 2 },
      { x: -1.5, z: 36, r: 9, kind: 'guardian', n: 1 },
    ],
    brush: [
      { x: -15, z: -15.4, r: 3.6 }, { x: 15, z: 15.4, r: 3.6 }, { x: -13, z: 4.6, r: 3.4 }, { x: 13, z: -4.6, r: 3.4 },
      { x: -4, z: 21, r: 3.6 }, { x: 4, z: -21, r: 3.6 }, { x: -22, z: 17, r: 3.6 }, { x: 22, z: -17, r: 3.6 },
      { x: -24, z: -23, r: 3.6 }, { x: 24, z: 23, r: 3.6 }, { x: -12, z: 38, r: 3.4 }, { x: 9.5, z: 40, r: 3.4 },
    ],
    tune: {}, heroTune: { healer: { hp: 1.06, ap: 1.1 } },
  },
  tri: {
    id: 'tri', name: '三路 · 宗门大战', team: 5, fog: true, blurb: '王者式地图：对角山门、上中下三路、河道与四片野区，5 对 5，有战争迷雾，二十分钟上下。开发中：电脑会分路、打野抓人、后期集结，但还比较初级。',
    // frost holds the lower-left corner, ember the upper-right (the camera looks north, so -z is up the screen)
    map: { hx: 80, hz: 80, ax: Math.SQRT1_2, az: -Math.SQRT1_2, biome: 1.24, mini: [168, 168], base: 25, baseF: 13 },   // base: radius of each sect's precinct
    core: t => ({ x: sideSign(t) * 56, z: -sideSign(t) * 56 }), fountain: t => ({ x: sideSign(t) * 68, z: -sideSign(t) * 68 }),
    lanes: () => [
      pathLane('上路', [[-56, 56], [-65, 34], [-67, -46], [-46, -67], [34, -65], [56, -56]], [40, 72, 100]),
      pathLane('中路', [[-56, 56], [-30, 27], [-3, 2], [3, -2], [30, -27], [56, -56]], [26, 46, 63]),
      pathLane('下路', [[-56, 56], [-34, 65], [46, 67], [67, 46], [65, -34], [56, -56]], [40, 72, 100]),
    ], mid: 1,
    river: () => { const p = polyline([[-74, -74], [-52, -56], [-36, -30], [-12, -14], [0, 0], [12, 14], [36, 30], [52, 56], [74, 74]]); return { path: p, dist: (x, z) => p.near(x, z)[0], signed: (x, z) => -p.near(x, z)[2], at: (t, o) => p.at(t * p.len, o) }; },
    camps: [
      ...mirror([{ x: -44, z: 8, r: 6.5, kind: 'golem', n: 2 }, { x: -40, z: -22, r: 6.5, kind: 'golem', n: 2 }, { x: -8, z: 44, r: 6.5, kind: 'golem', n: 2 }, { x: 22, z: 40, r: 6.5, kind: 'golem', n: 2 }]),
      { x: -26, z: -24, r: 8, kind: 'guardian', n: 1 }, { x: 26, z: 24, r: 8, kind: 'guardian', n: 1 },
    ],
    brush: mirror([
      { x: -14, z: -1, r: 3.3 }, { x: -1, z: 14, r: 3.3 }, { x: -54, z: -34, r: 3.4 }, { x: -34, z: -54, r: 3.4 },
      { x: -33, z: 12, r: 3.3 }, { x: -8, z: 34, r: 3.3 }, { x: -51, z: -3, r: 3.3 }, { x: 3, z: 53, r: 3.3 },
      { x: -47, z: -31, r: 3.3 }, { x: -22, z: -8, r: 3.2 },
    ]),
    // Ridges that wall the jungle off from the lanes, with gaps to go in by. Given for frost's upper quarter; the other three
    // quarters are its reflection across the middle lane and across the centre of the map.
    ridges: [[[-57, 24], [-57, 4]], [[-57, -12], [-57, -26]], [[-48, 34], [-38, 24]], [[-30, 16], [-18, 4]]],
    // 三路's own numbers. Everything not named here falls back to the shared table.
    tune: {
      waveEvery: 28, coreHp: 5200, lateAt: 720, lateK: 0.3, respawnK: 1.15, startGold: 300,
      groupAt: 600,                                                    // from here on the bots gather to push a lane together, again and again
      // a full-time jungler lives off these, so each camp pays less and comes back slower than in 一路
      neutral: {
        golem: { hp: 520, ad: 26, range: 2.2, period: 1.2, wind: 0.35, ms: 6, r: 1.3, h: 3.4, gold: 26, xp: 40, respawn: 62 },
        guardian: { hp: 2600, ad: 70, range: 3.4, period: 1.4, wind: 0.45, ms: 5.5, r: 2.5, h: 6.6, gold: 90, xp: 220, respawn: 100 },
      },
    },
    heroTune: {},                                                   // e.g. storm: { hp: 1.06 } — multipliers on base stats, this mode only
  },
};

// 三路's five seats: where each one goes and how it behaves. (Which cultivators suit which seat is in SEAT_FIT below.)
export const SEATS = [
  { pos: '镇关', lane: 0, off: 0, note: '上路单人，扛线' },
  { pos: '中军', lane: 1, off: 0, note: '中路单人' },
  { pos: '养剑', lane: 2, off: -1.4, note: '下路，主输出' },
  { pos: '护法', lane: 2, off: 1.4, note: '下路，护着养剑位' },
  { pos: '巡山', lane: 0, off: 1.4, jungle: true, note: '清野区，看哪路有机会就去抓人，哪路吃紧去哪路' },
];
// How much each seat cares for each thing a bot can choose to do with its time. The brain scores every option 0–1 and
// multiplies by these; the highest wins. (Retreating, answering a signal and the side's group calls are not choices.)
export const SEAT_BIAS = {
  镇关: { lane: 1.0, escort: 0, jungle: 0.4, gank: 0.6, ambush: 0.6, help: 0 },
  中军: { lane: 1.0, escort: 0, jungle: 0.5, gank: 0.95, ambush: 0.95, help: 0 },
  养剑: { lane: 1.1, escort: 0, jungle: 0.3, gank: 0.3, ambush: 0.5, help: 0 },
  护法: { lane: 0.7, escort: 1.3, jungle: 0, gank: 0.8, ambush: 0.6, help: 0 },
  巡山: { lane: 0.3, escort: 0, jungle: 1.4, gank: 1.3, ambush: 1.0, help: 1.0 },
};
// Best seats first, per cultivator. The first is the seat they were built for wherever simulation does not argue against it;
// after it come seats where they scored clearly above average (docs/打位演算.md). Rerun `node seats.mjs` when the bots change.
export const SEAT_FIT = {
  warden: [3, 0], keeper: [0], peiji: [0], berserker: [0, 4], qingya: [0, 4], bloodlord: [1, 0],
  mage: [1, 2], cryo: [1, 2], storm: [1, 2], yuanshan: [3, 1],
  archer: [2, 1], ranger: [2, 1], gunner: [2], linshuang: [2],
  healer: [3], yanzhao: [3], shade: [4, 1], wenren: [4],
};

export let MODE = MODES.single;
export const MAP = { hx: 80, hz: 48, ax: 1, az: 0, biome: 1, mini: [210, 126], base: 15, baseF: 4 };
export const LANES = [], CAMPS = [], BRUSH = [], TOWERS = [];
export const RIDGES = [], RIDGE_ENDS = [];                          // wall segments [[x,z],[x,z]] and a point just past each end, for paths to round
export let MID = 0, RIVER = null;
export const laneZ = (x, lane = MID) => LANES[lane].f(x);            // 一路 only
// where a point sits between the two bases: negative toward frost, positive toward ember
export const sideOf = (x, z) => x * MAP.ax + z * MAP.az;
export const biomeX = (x, z) => (x * MAP.ax + z * MAP.az) / MAP.biome;
export const biomeGLSL = (v, zc = 'z') => (MAP.az === 0 && MAP.biome === 1 ? `${v}.x` : `((${v}.x * ${MAP.ax.toFixed(6)} + ${v}.${zc} * ${MAP.az.toFixed(6)}) / ${MAP.biome.toFixed(6)})`);
export const nearestLane = (x, z) => { let best = 0, bd = 1e9; for (let i = 0; i < LANES.length; i++) { const d = LANES[i].dist(x, z); if (d < bd) { bd = d; best = i; } } return best; };
export const POS = { core: t => MODE.core(t), fountain: t => MODE.fountain(t) };
export const brushAt = (x, z, pad = 0) => { for (let i = 0; i < BRUSH.length; i++) { const b = BRUSH[i], dx = x - b.x, dz = z - b.z, r = b.r + pad; if (dx * dx + dz * dz < r * r) return i; } return -1; };

export const TEAM_NAME = ['霜', '烬'];
export const TEAM_COL = [
  { main: '#2c62b5', dark: '#111f3a', glow: [0.3, 0.72, 1.0], css: '#6fc3ff' },
  { main: '#b5421a', dark: '#3a1409', glow: [1.0, 0.3, 0.045], css: '#ff8a4d' },
  { main: '#8d8474', dark: '#3a352d', glow: [0.3, 1.0, 0.75], css: '#7fe8c4' },
];

// dmg(level) = b + l*(level-1) + ad*AD + ap*AP.  kind = the rule (game.js), vfx = the look (vfx.js), icon = the glyph (icons.js)
const S = (key, id, name, kind, o, desc) => ({ key, id, name, kind, vfx: o.vfx || id, icon: o.icon || id, desc, ...o });
export const HEROES = {
  warden: {
    id: 'warden', size: 1.42, tint: [1.0, 0.85, 0.55], style: 'sword', name: '韩不语', short: '韩', title: '刑律堂首座 · 镇关', role: '体修 · 近战', blurb: '人称哑刑官。一把封着剑意的重尺冲阵开团，用定身为同门创造机会。',
    hp: 1060, hpG: 114, mana: 260, manaG: 22, ad: 62, adG: 4, ap: 0, apG: 0, ms: 6.8, range: 2.9, period: 0.95, wind: 0.26, ranged: false, r: 1.05, h: 5.2,
    build: ['heichi', 'xingluo', 'tingxue'],
    passive: { name: '不动如山', icon: 'bulwark', max: 5, desc: '被修士、灵塔或邪祟打中时叠一层，每层减伤 4%，最多 5 层；4 秒没挨打就散去。' },
    skills: [
      S('Q', 'cleave', '断罪', 'cone', { range: 6.8, angle: 75, cd: 5, mana: 30, b: 66, l: 13, ad: 0.8, slow: [0.3, 1.5] }, '重尺横扫前方扇形，造成伤害并减速。'),
      S('W', 'bulwark', '封意', 'shield', { cd: 12, mana: 45, b: 165, l: 36, ad: 0.7, dur: 3.5 }, '以尺中封存的剑意护身，获得一层吸收伤害的罡气。'),
      S('E', 'charge', '破阵', 'dash', { range: 10, speed: 30, cd: 10, mana: 40, b: 50, l: 12, ad: 0.6, stun: 0.5, hitR: 1.9 }, '向指定方向冲锋，撞到的敌人受伤并短暂定身。'),
      S('R', 'skyfall', '镇关', 'leap', { range: 11.5, radius: 5.2, delay: 0.55, cd: 55, mana: 80, b: 175, l: 40, ad: 1.1, stun: 1.0, lvl: 4 }, '跃向目标区域，落地时重创并定身范围内敌人。'),
    ],
  },
  mage: {
    id: 'mage', size: 1.28, tall: 0.1, tint: [0.75, 0.4, 1.0], style: 'staff', name: '周易', short: '易', title: '天衍传人', role: '术修 · 远程', blurb: '以命盘调度星力。伤害极高但身板脆弱，靠推演预判打出爆发。',
    hp: 860, hpG: 96, mana: 420, manaG: 34, ad: 46, adG: 2.5, ap: 14, apG: 7.5, ms: 6.4, range: 9.2, period: 1.0, wind: 0.22, ranged: true, r: 0.95, h: 5.4,
    build: ['mingpan', 'zhaohun', 'xingluo'],
    passive: { name: '推演', icon: 'i_disc', desc: '招式命中敌方修士时回复 5% 灵力，并让所有招式的调息缩短 0.6 秒。' },
    skills: [
      S('Q', 'starbolt', '星引', 'proj', { range: 17, speed: 27, width: 0.95, cd: 3.5, mana: 30, b: 90, l: 19, ap: 0.8, splash: 2.4 }, '引一缕星力射出，命中第一个敌人后小范围爆开。'),
      S('W', 'well', '星垣阵', 'zone', { range: 13, radius: 4.4, delay: 0.65, cd: 9, mana: 55, b: 82, l: 17, ap: 0.55, slow: [0.45, 2] }, '在目标位置布下星垣阵，阵成时造成伤害并大幅减速。'),
      S('E', 'phase', '星遁', 'blink', { range: 8.5, cd: 10, mana: 40 }, '借星力瞬移到指定方向的位置。'),
      S('R', 'meteor', '星落', 'zone', { range: 16, radius: 6.8, delay: 1.1, cd: 60, mana: 100, b: 270, l: 62, ap: 1.05, lvl: 4 }, '以命盘引一颗星辰坠向目标区域，延迟后造成毁灭性伤害。'),
    ],
  },
  ranger: {
    id: 'ranger', size: 1.22, tint: [0.4, 1.0, 0.6], style: 'bow', name: '苏紫烟', short: '烟', title: '听雪剑主', role: '剑修 · 远程', blurb: '御剑出手最远、剑招最快，持续输出强，需要保持距离。',
    hp: 830, hpG: 93, mana: 300, manaG: 24, ad: 54, adG: 3.7, ap: 0, apG: 0, ms: 6.6, range: 9.2, period: 0.94, wind: 0.18, ranged: true, r: 0.95, h: 5.0,
    build: ['tingxue', 'dunying', 'heichi'],
    passive: { name: '剑意三叠', icon: 'i_tingxue', max: 3, desc: '每第三次普攻伤害 +25%，并让目标减速 30%。' },
    skills: [
      S('Q', 'pierce', '听雪', 'proj', { range: 19, speed: 36, width: 0.85, cd: 5, mana: 35, b: 60, l: 14, ad: 1.0, pierce: true }, '斩出一道带着寒气的剑气，贯穿路径上所有敌人。'),
      S('W', 'gale', '轻身符', 'haste', { cd: 13, mana: 40, dur: 4, ms: 0.35, as: 0.4 }, '拍一张轻身符，短时间内身轻如燕，出剑更快。'),
      S('E', 'backshot', '遁影', 'backdash', { range: 7, speed: 28, cd: 9, mana: 40, b: 40, l: 10, ad: 0.5, slow: [0.5, 1.5], projRange: 13 }, '借遁影镜向后掠开，同时朝目标方向补一道减速剑气。'),
      S('R', 'rain', '万剑听雪', 'zone', { range: 15, radius: 6.6, delay: 0.5, dur: 3, tick: 0.5, cd: 55, mana: 90, b: 38, l: 9, ad: 0.3, slow: [0.25, 0.8], lvl: 4 }, '剑气如雪落向目标区域，持续造成伤害并减速。'),
    ],
  },
  shade: {
    id: 'shade', size: 1.2, tint: [1.0, 0.2, 0.55], style: 'dual', name: '柳红衣', short: '红', title: '血魂暗子', role: '影修 · 近战', blurb: '一抹红影来去无声，专挑残血和落单的敌人下手，自己也很脆。',
    hp: 1100, hpG: 118, mana: 280, manaG: 22, ad: 74, adG: 4.8, ap: 0, apG: 0, ms: 7.4, range: 2.7, period: 0.72, wind: 0.16, ranged: false, r: 0.95, h: 4.9,
    build: ['dunying', 'tingxue', 'heichi'],
    passive: { name: '索命', icon: 'dagger', desc: '对气血低于 40% 的目标伤害 +25%；参与镇压修士后回复自身 20% 气血。' },
    skills: [
      S('Q', 'shadowstep', '红袖', 'dash', { range: 7.5, speed: 36, cd: 4.5, mana: 30, b: 80, l: 15, ad: 0.85, hitR: 1.7, reset: true, vfx: 'shadowstep', icon: 'dagger' }, '化作一道红影穿过敌人，对路径上的目标造成伤害。'),
      S('W', 'fan', '噬魂针', 'fan', { range: 11, speed: 30, width: 0.7, n: 3, spread: 0.2, cd: 6, mana: 35, b: 50, l: 10, ad: 0.5, slow: [0.25, 1] }, '扇形打出三枚噬魂针，命中的敌人受伤并减速。'),
      S('E', 'veil', '血雾', 'haste', { cd: 11, mana: 35, dur: 3.5, ms: 0.45, as: 0.35, ls: 0.2, dr: 0.4, vfx: 'veil', icon: 'smoke' }, '遁入血雾，短时间内大幅提升移动和攻击速度，普攻吸血，受到的伤害 -40%。'),
      S('R', 'reap', '噬魂', 'strike', { range: 12, cd: 45, mana: 80, b: 190, l: 44, ad: 1.2, exec: 0.22, lvl: 4 }, '瞬移到目标修士身后斩击，目标损失的气血越多伤害越高。'),
    ],
  },
  healer: {
    id: 'healer', size: 1.16, tall: 0.35, tint: [0.75, 1.0, 0.3], style: 'staff', name: '孙伯', short: '孙', title: '藏经阁扫地人', role: '丹修 · 辅助', blurb: '装了三十年糊涂的老人。丹药和符箓让同门多扛几轮，缚灵符能定住冲上来的敌人。',
    hp: 870, hpG: 96, mana: 440, manaG: 36, ad: 46, adG: 2.5, ap: 12, apG: 7, ms: 6.5, range: 9, period: 1.0, wind: 0.22, ranged: true, r: 0.95, h: 5.2,
    build: ['mingpan', 'xingluo', 'zhaohun'],
    passive: { name: '药香', icon: 'i_gourd', desc: '身边的同门（含自己）每秒多回复 1% 气血。' },
    skills: [
      S('Q', 'mend', '回元丹', 'heal', { range: 11, radius: 4.8, cd: 6.5, mana: 50, b: 125, l: 26, ap: 0.7 }, '弹出一枚回元丹化开，治疗目标区域内的所有同门修士。'),
      S('W', 'vine', '缚灵符', 'proj', { range: 15, speed: 26, width: 0.9, cd: 9, mana: 45, b: 60, l: 14, ap: 0.5, stun: 1.1 }, '打出一张缚灵符，命中的第一个敌人受伤并被缠住。'),
      S('E', 'ward', '镇血符', 'shield', { cd: 12, mana: 55, b: 115, l: 25, ap: 0.5, dur: 3.5, aoe: 7.5 }, '给自己和附近的同门修士各贴一张镇血符，化作罡气。'),
      S('R', 'bloom', '清魂阵', 'heal', { range: 0, radius: 8, dur: 4, tick: 0.5, cd: 60, mana: 100, b: 54, l: 12, ap: 0.25, lvl: 4 }, '在脚下布下清魂阵，持续治疗范围内的同门修士。'),
    ],
  },
  cryo: {
    id: 'cryo', size: 1.27, tint: [0.6, 0.95, 1.0], style: 'staff', name: '寒漪', short: '漪', title: '玄霜宗长老', role: '冰修 · 远程', blurb: '修寒冰道。减速、冻结、封路，把敌人留在同门的火力范围里。',
    hp: 840, hpG: 94, mana: 430, manaG: 34, ad: 46, adG: 2.5, ap: 14, apG: 7.5, ms: 6.4, range: 8.8, period: 1.0, wind: 0.22, ranged: true, r: 0.95, h: 5.3,
    build: ['mingpan', 'xingluo', 'zhaohun'],
    passive: { name: '霜蚀', icon: 'frostnova', desc: '普攻附带 20% 减速；对已被减速或定身的目标伤害 +12%。' },
    skills: [
      S('Q', 'icelance', '玄霜刺', 'proj', { range: 16, speed: 30, width: 0.85, cd: 4.5, mana: 30, b: 80, l: 17, ap: 0.7, pierce: true, slow: [0.35, 1.8] }, '射出贯穿敌人的玄霜冰刺，造成伤害并减速。'),
      S('W', 'frostnova', '冻血', 'nova', { radius: 5.2, cd: 10, mana: 55, b: 70, l: 15, ap: 0.5, stun: 0.9 }, '寒气以自身为中心炸开，冻结周围的敌人。'),
      S('E', 'iceslide', '踏冰', 'dash', { range: 7.5, speed: 26, cd: 10, mana: 35, vfx: 'iceslide', icon: 'slide' }, '沿冰面向指定方向滑行一段距离。'),
      S('R', 'blizzard', '雪原封天', 'zone', { range: 14, radius: 7, delay: 0.6, dur: 4, tick: 0.5, cd: 60, mana: 100, b: 46, l: 10, ap: 0.34, slow: [0.4, 1], lvl: 4 }, '在目标区域降下暴风雪，持续造成伤害并大幅减速。'),
    ],
  },
  berserker: {
    id: 'berserker', size: 1.46, tint: [1.0, 0.3, 0.12], style: 'axe', name: '老铁', short: '铁', title: '北荒刀客', role: '刀修 · 近战', blurb: '北荒来的向导，一口崩了刃的厚背刀。越打越凶，靠吸血在人堆里站住。',
    hp: 1240, hpG: 130, mana: 250, manaG: 20, ad: 68, adG: 4.4, ap: 0, apG: 0, ms: 6.9, range: 3.0, period: 0.88, wind: 0.24, ranged: false, r: 1.05, h: 5.3,
    build: ['heichi', 'dunying', 'tingxue'],
    passive: { name: '越战越勇', icon: 'rage', pct: true, desc: '气血越低出刀越快、皮越硬：濒死时攻速 +60%，受到的伤害 -22%。' },
    skills: [
      S('Q', 'whirl', '回风刀', 'nova', { radius: 4.6, cd: 4, mana: 25, b: 75, l: 15, ad: 0.9 }, '厚背刀抡圆了横扫一圈，伤害周围所有敌人。'),
      S('W', 'axe', '掷刀', 'proj', { range: 12, speed: 28, width: 0.95, cd: 7, mana: 30, b: 55, l: 12, ad: 0.7, slow: [0.4, 1.5] }, '掷出一口短刀，命中的第一个敌人受伤并减速。'),
      S('E', 'rage', '北荒血性', 'haste', { cd: 14, mana: 40, dur: 6, ms: 0.25, as: 0.7, ls: 0.3, dr: 0.15 }, '进入狂怒，大幅提升攻击速度并获得普攻吸血，受到的伤害 -15%。'),
      S('R', 'quake', '断岳', 'leap', { range: 12, radius: 5, delay: 0.5, cd: 50, mana: 80, b: 170, l: 40, ad: 1.3, slow: [0.5, 2], lvl: 4, vfx: 'skyfall', icon: 'skyfall' }, '高高跃起砸向目标区域，造成巨额伤害并减速。'),
    ],
  },
  gunner: {
    id: 'gunner', size: 1.33, tint: [1.0, 0.72, 0.2], style: 'gun', name: '吴镇岳', short: '岳', title: '天元宗峰主', role: '符修 · 远程', blurb: '破魂弩配一腰雷火符，从远处压制一片区域，被近身就得炸符脱身。',
    hp: 810, hpG: 90, mana: 310, manaG: 24, ad: 58, adG: 4.0, ap: 0, apG: 0, ms: 6.5, range: 9.4, period: 0.95, wind: 0.2, ranged: true, r: 0.95, h: 5.0,
    build: ['tingxue', 'dunying', 'heichi'],
    passive: { name: '连珠', icon: 'shell', max: 4, desc: '每第四次普攻换上雷火符：伤害 +25%，并炸伤目标周围的敌人。' },
    skills: [
      S('Q', 'shell', '雷火符', 'zone', { range: 13, radius: 3.6, delay: 0.55, cd: 5, mana: 35, b: 75, l: 16, ad: 0.8 }, '朝目标位置甩出一张雷火符，落地爆炸。'),
      S('W', 'concuss', '雷音符', 'cone', { range: 7, angle: 60, cd: 11, mana: 45, b: 40, l: 10, ad: 0.4, stun: 0.7 }, '捏碎一张雷音符，巨响震晕前方扇形范围内的敌人。'),
      S('E', 'rocketjump', '炸符退', 'backdash', { range: 8, speed: 30, cd: 10, mana: 40, b: 45, l: 10, ad: 0.5, projRange: 12 }, '脚下炸一张符借力后撤，同时向前补一发弩箭。'),
      S('R', 'barrage', '万符齐发', 'zone', { range: 17, radius: 7.5, delay: 0.8, dur: 2.5, tick: 0.5, cd: 60, mana: 100, b: 60, l: 14, ad: 0.45, lvl: 4 }, '把整叠雷火符撒向目标区域，接连爆炸。'),
    ],
  },
  storm: {
    id: 'storm', size: 1.3, tall: 0.4, tint: [0.95, 0.9, 0.35], style: 'staff', name: '沈渊', short: '渊', title: '天刑台执法副使', role: '雷修 · 远程', blurb: '掌一方刑印引雷。落雷又快又准，连续命中能把敌人劈得动弹不得。',
    hp: 800, hpG: 91, mana: 420, manaG: 34, ad: 46, adG: 2.5, ap: 12, apG: 7.5, ms: 6.5, range: 9, period: 1.0, wind: 0.2, ranged: true, r: 0.95, h: 5.3,
    build: ['mingpan', 'zhaohun', 'xingluo'],
    passive: { name: '雷印', icon: 'bolt2', desc: '招式命中会在敌人身上留一道雷印，叠满三道即引爆：按最大气血造成伤害并定身 0.5 秒，之后 3.2 秒内不再留印。' },
    skills: [
      S('Q', 'bolt', '刑雷', 'zone', { range: 14, radius: 3, delay: 0.45, cd: 4.2, mana: 35, b: 80, l: 18, ap: 0.68 }, '短暂延迟后在目标位置劈下一道闪电。'),
      S('W', 'orb', '锁魂珠', 'proj', { range: 15, speed: 20, width: 1.0, cd: 8, mana: 50, b: 60, l: 14, ap: 0.5, splash: 3.2, stun: 0.4 }, '放出一枚缓慢飞行的雷珠，命中后爆开并短暂麻痹。'),
      S('E', 'flashstep', '雷行', 'blink', { range: 8, cd: 12, mana: 40, vfx: 'phase', icon: 'bolt2' }, '化作一道电光闪现到指定方向的位置。'),
      S('R', 'tempest', '天刑', 'zone', { range: 15, radius: 6.5, delay: 1.0, dur: 2, tick: 0.4, cd: 60, mana: 100, b: 55, l: 12, ap: 0.33, stun: 0.25, lvl: 4 }, '召来雷暴反复轰击目标区域，每一击都会短暂麻痹。'),
    ],
  },
  keeper: {
    id: 'keeper', size: 1.5, tint: [0.4, 0.6, 1.0], style: 'shield', name: '周远川', short: '川', title: '天衍城守门人', role: '盾修 · 近战', blurb: '在雪原守了五十年门。最能扛，嘲讽把敌人钉在自己身上，静时阵一落整片都动不了。',
    hp: 1220, hpG: 132, mana: 280, manaG: 22, ad: 56, adG: 3.4, ap: 0, apG: 0, ms: 6.6, range: 2.9, period: 1.05, wind: 0.28, ranged: false, r: 1.1, h: 5.3,
    build: ['heichi', 'xingluo', 'tingxue'],
    passive: { name: '守门', icon: 'ward', cd: 45, desc: '气血低于 40% 时自动撑起相当于 16% 最大气血的罡气，持续 4 秒。每 45 秒一次。' },
    skills: [
      S('Q', 'gate', '闭门', 'cone', { range: 6, angle: 95, cd: 8, mana: 35, b: 55, l: 12, ad: 0.6, stun: 0.9, vfx: 'gate' }, '门盾向前猛撞，伤害并定身扇形范围内的敌人。'),
      S('W', 'taunt', '守门', 'taunt', { radius: 6.5, dur: 1.3, cd: 14, mana: 50, b: 110, l: 30, hpR: 0.08 }, '喝令周围敌人只能攻击自己，同时获得一层罡气。'),
      S('E', 'starstride', '踏星', 'dash', { range: 8, speed: 26, cd: 11, mana: 40, b: 45, l: 10, ad: 0.5, stun: 0.5, hitR: 2, vfx: 'charge', icon: 'charge' }, '举盾向前冲撞，撞到的敌人受伤并短暂定身。'),
      S('R', 'stasis', '静时阵', 'zone', { range: 10, radius: 6.5, delay: 0.9, cd: 65, mana: 100, b: 120, l: 30, ad: 0.6, stun: 1.5 }, '在目标区域布下封城用的静时阵，阵成时范围内的敌人被定住。'),
    ],
  },
  bloodlord: {
    id: 'bloodlord', size: 1.46, tint: [1.0, 0.1, 0.12], style: 'dual', name: '血屠子', short: '屠', title: '血魂宗主', role: '血修 · 近战', blurb: '以血养身的魔道宗主。血锁把人拽到面前，打得越久吸得越多，很难杀死。',
    hp: 1290, hpG: 136, mana: 300, manaG: 24, ad: 66, adG: 4.1, ap: 0, apG: 0, ms: 6.7, range: 3.0, period: 1.0, wind: 0.24, ranged: false, r: 1.1, h: 5.3,
    build: ['heichi', 'dunying', 'xingluo'],
    passive: { name: '血食', icon: 'bloodsea', desc: '附近有敌方弟子或邪祟死去时回复 3.5% 气血，死的是修士则回复 14%。' },
    skills: [
      S('Q', 'bloodclaw', '血爪', 'cone', { range: 6.2, angle: 80, cd: 5.5, mana: 30, b: 68, l: 14, ad: 0.75, drain: 0.55, vfx: 'bloodclaw' }, '血爪撕开前方扇形，并把造成伤害的一部分吸为自身气血。'),
      S('W', 'hook', '血锁', 'proj', { range: 13, speed: 27, width: 1.0, cd: 11, mana: 50, b: 60, l: 13, ad: 0.55, stun: 0.6, pull: true }, '甩出一道血锁，把命中的第一个敌人拽到自己面前。'),
      S('E', 'bloodshield', '化血', 'shield', { cd: 12, mana: 45, b: 130, l: 32, hpR: 0.1, dur: 4, vfx: 'bulwark', icon: 'bulwark' }, '化血为甲，获得一层随自身气血上限提高的罡气。'),
      S('R', 'bloodsea', '血海', 'zone', { range: 0, radius: 7, delay: 0.4, dur: 4, tick: 0.5, cd: 60, mana: 100, b: 48, l: 11, ad: 0.34, slow: [0.3, 0.8], drain: 0.7 }, '脚下漫开一片血海，持续伤害并减速范围内的敌人，同时为自己回血。'),
    ],
  },
  archer: {
    id: 'archer', size: 1.27, tint: [1.0, 0.52, 0.12], style: 'archer', name: '沈焰', short: '焰', title: '火岛守岛人', role: '弓修 · 远程', blurb: '一张火弓守了火岛三百年。全靠普攻吃饭，连珠一开输出最高，但被近身就很危险。',
    hp: 790, hpG: 88, mana: 300, manaG: 24, ad: 56, adG: 3.8, ap: 0, apG: 0, ms: 6.7, range: 9.8, period: 0.78, wind: 0.16, ranged: true, r: 0.95, h: 5.0,
    build: ['tingxue', 'dunying', 'heichi'],
    passive: { name: '焚心', icon: 'firearrow', max: 5, desc: '连续射同一个目标，每箭攻速 +6%，最多 5 层；换目标或停手 3 秒后清零。' },
    skills: [
      S('Q', 'quickdraw', '连珠', 'haste', { cd: 11, mana: 40, dur: 4, ms: 0.1, as: 0.65, vfx: 'rage', icon: 'quick' }, '短时间内普攻速度大幅提升。'),
      S('W', 'firearrow', '火羽', 'proj', { range: 18, speed: 34, width: 0.9, cd: 6, mana: 35, b: 55, l: 13, ad: 0.9, pierce: true, slow: [0.3, 1.2] }, '射出一支贯穿敌人的火羽箭，造成伤害并减速。'),
      S('E', 'firestep', '掠火', 'dash', { range: 6, speed: 30, cd: 7, mana: 30, reset: true }, '踏着火光滑出一小段，并立刻可以再射一箭。'),
      S('R', 'sunarrow', '焚天', 'proj', { range: 40, speed: 32, width: 1.5, cd: 60, mana: 100, b: 200, l: 50, ad: 1.2, splash: 4.5, stun: 0.9 }, '射出一支能飞越半个战场的巨箭，命中第一个敌人后爆炸并定身。'),
    ],
  },

  // ---- six more, to fill the seats that were thin: two who protect, two who hunt, one more archer, one more wall ----
  yanzhao: {
    id: 'yanzhao', size: 1.2, tint: [0.72, 0.8, 1.0], style: 'staff', name: '言照雪', short: '雪', title: '蔽目之体', role: '幕修 · 辅助', blurb: '天生蔽目之体，能遮住不该被看见的东西。站在同门身边，替他们挡下一部分伤害。',
    hp: 930, hpG: 100, mana: 430, manaG: 35, ad: 46, adG: 2.5, ap: 12, apG: 7, ms: 6.5, range: 8.8, period: 1.0, wind: 0.22, ranged: true, r: 0.95, h: 5.1,
    build: ['xingluo', 'mingpan', 'zhaohun'],
    passive: { name: '蔽目之体', icon: 'smoke', desc: '身边的同门（含自己）受到修士的伤害 -8%。' },
    skills: [
      S('Q', 'veilbolt', '蔽目', 'proj', { range: 15, speed: 26, width: 0.95, cd: 7.5, mana: 45, b: 72, l: 16, ap: 0.6, stun: 0.95, vfx: 'vine', icon: 'smoke' }, '放出一缕蔽目之力，命中的第一个敌人眼前一黑，被定在原地。'),
      S('W', 'skyveil', '遮天幕', 'shield', { cd: 11, mana: 55, b: 140, l: 30, ap: 0.55, dur: 3.5, aoe: 8, vfx: 'ward', icon: 'ward' }, '给自己和附近的同门各罩上一层幕，化作罡气。'),
      S('E', 'mirrorheal', '照影', 'heal', { range: 11, radius: 4.6, cd: 7, mana: 50, b: 115, l: 25, ap: 0.68, vfx: 'mend', icon: 'mend' }, '照出目标区域内同门无伤时的影子，为他们回复气血。'),
      S('R', 'eclipse', '蔽天', 'zone', { range: 0, radius: 7.5, delay: 0.5, dur: 4, tick: 0.5, cd: 60, mana: 100, b: 44, l: 10, ap: 0.32, slow: [0.4, 1], lvl: 4, vfx: 'blizzard', icon: 'blizzard' }, '以自己为中心张开蔽天之幕，幕中的敌人持续受伤并步履维艰。'),
    ],
  },
  yuanshan: {
    id: 'yuanshan', size: 1.24, tall: 0.2, tint: [1.0, 0.84, 0.4], style: 'staff', name: '周远山', short: '山', title: '携钱南下的人', role: '卜修 · 辅助', blurb: '周易的祖父，五十年前带着天衍钱南下。一枚铜钱定吉凶，专替后辈挡灾。',
    hp: 960, hpG: 102, mana: 420, manaG: 34, ad: 46, adG: 2.5, ap: 12, apG: 7, ms: 6.4, range: 8.6, period: 1.0, wind: 0.22, ranged: true, r: 0.95, h: 5.3,
    build: ['xingluo', 'mingpan', 'zhaohun'],
    passive: { name: '余荫', icon: 'i_disc', desc: '身边的同门气血跌破 30% 时，替他挡一次：给一层相当于其 22% 最大气血的罡气。每人 30 秒一次。' },
    skills: [
      S('Q', 'coin', '天衍钱', 'proj', { range: 15, speed: 30, width: 0.9, cd: 5, mana: 38, b: 92, l: 19, ap: 0.75, slow: [0.35, 1.5], splash: 2.2, vfx: 'starbolt', icon: 'starbolt' }, '弹出一枚天衍钱，命中第一个敌人后炸开，造成伤害并减速。'),
      S('W', 'omen', '卜吉', 'shield', { cd: 13, mana: 55, b: 100, l: 24, ap: 0.45, dur: 3.5, aoe: 7.5, vfx: 'bulwark', icon: 'bulwark' }, '起一卦吉象，自己和附近同门各得一层罡气。'),
      S('E', 'refate', '改命', 'heal', { range: 10, radius: 4.2, cd: 7.5, mana: 55, b: 135, l: 28, ap: 0.72, vfx: 'mend', icon: 'bloom' }, '把目标区域内同门的伤势改轻几分，回复气血。'),
      S('R', 'misfortune', '逆运', 'zone', { range: 14, radius: 6.5, delay: 0.75, cd: 60, mana: 100, b: 175, l: 40, ap: 0.8, stun: 1.4, lvl: 4, vfx: 'stasis', icon: 'stasis' }, '在目标区域布下逆运之局，局成时范围内的敌人受伤并被定住。'),
    ],
  },
  qingya: {
    id: 'qingya', size: 1.34, tint: [0.5, 1.0, 0.85], style: 'sword', name: '陆青崖', short: '崖', title: '清正', role: '剑修 · 近战', blurb: '苏紫烟与韩不语的师父，蒙冤被逐，宗主后来为他题"清正"二字。一人一剑，最擅长独行清剿。',
    hp: 1190, hpG: 126, mana: 280, manaG: 22, ad: 74, adG: 4.8, ap: 0, apG: 0, ms: 7.2, range: 2.9, period: 0.85, wind: 0.2, ranged: false, r: 1.0, h: 5.2,
    build: ['tingxue', 'heichi', 'dunying'],
    passive: { name: '独行', icon: 'pierce', desc: '普攻吸血 12%。对邪祟的伤害 +40%，每清掉一只回复 4% 气血。' },
    skills: [
      S('Q', 'breeze', '清风', 'dash', { range: 8, speed: 34, cd: 5, mana: 30, b: 75, l: 15, ad: 0.8, hitR: 1.8, reset: true, vfx: 'shadowstep', icon: 'slide' }, '一步掠过，对路径上的敌人造成伤害，落地可立刻再出一剑。'),
      S('W', 'upright', '正气', 'shield', { cd: 10, mana: 40, b: 160, l: 34, ad: 0.7, hpR: 0.08, dur: 4, vfx: 'bulwark', icon: 'bulwark' }, '一身正气护体，获得一层罡气。'),
      S('E', 'dispel', '破妄', 'cone', { range: 6.6, angle: 80, cd: 5.5, mana: 30, b: 70, l: 14, ad: 0.85, slow: [0.35, 1.5], drain: 0.35, vfx: 'cleave', icon: 'cleave' }, '横剑扫开前方扇形，造成伤害并减速，伤害的一部分化为自身气血。'),
      S('R', 'verdict', '一剑清正', 'strike', { range: 12, cd: 45, mana: 80, b: 200, l: 45, ad: 1.2, exec: 0.2, lvl: 4, vfx: 'reap', icon: 'pierce' }, '瞬息间到目标修士身前出剑，目标损失的气血越多伤害越高。'),
    ],
  },
  wenren: {
    id: 'wenren', size: 1.26, tint: [1.0, 0.35, 0.6], style: 'dual', name: '闻人遥', short: '遥', title: '大司刑关门弟子', role: '刑修 · 近战', blurb: '闻人策的关门弟子，练功走火，出手再无分寸。在野外游荡，逮着落单的就下死手。',
    hp: 1090, hpG: 117, mana: 280, manaG: 22, ad: 72, adG: 4.7, ap: 0, apG: 0, ms: 7.3, range: 2.8, period: 0.78, wind: 0.17, ranged: false, r: 0.95, h: 5.0,
    build: ['dunying', 'tingxue', 'heichi'],
    passive: { name: '走火入魔', icon: 'rage', desc: '对邪祟的伤害 +35%。参与镇压修士后，「掠影」立刻可以再用。' },
    skills: [
      S('Q', 'fateline', '判命线', 'proj', { range: 12, speed: 30, width: 0.95, cd: 11, mana: 45, b: 55, l: 12, ad: 0.55, stun: 0.4, pull: true, vfx: 'hook', icon: 'hook' }, '甩出一道判命血线，把命中的第一个敌人拽到自己面前。'),
      S('W', 'frenzy', '走火', 'haste', { cd: 11, mana: 35, dur: 4.5, ms: 0.3, as: 0.6, ls: 0.25, dr: 0.3, vfx: 'rage', icon: 'rage' }, '任由真气逆行，短时间内出手和脚步都快得反常，普攻吸血，受到的伤害 -30%。'),
      S('E', 'flit', '掠影', 'dash', { range: 7, speed: 32, cd: 6, mana: 30, b: 55, l: 12, ad: 0.6, hitR: 1.7, reset: true, vfx: 'shadowstep', icon: 'dagger' }, '贴地掠出一段，划伤路径上的敌人。'),
      S('R', 'burnvein', '焚脉', 'nova', { radius: 5.6, cd: 50, mana: 80, b: 195, l: 44, ad: 1.15, stun: 1.1, lvl: 4, vfx: 'whirl', icon: 'whirl' }, '逆行的真气从周身炸开，重创并定住周围的敌人。'),
    ],
  },
  linshuang: {
    id: 'linshuang', size: 1.24, tint: [0.55, 0.85, 1.0], style: 'archer', name: '林霜', short: '霜', title: '冰岛守岛人', role: '弓修 · 远程', blurb: '三百年前的天衍传人，与沈焰分守冰火两岛。她的箭不快，但中了箭的人再也快不起来。',
    hp: 800, hpG: 89, mana: 300, manaG: 24, ad: 53, adG: 3.7, ap: 0, apG: 0, ms: 6.6, range: 9.5, period: 0.88, wind: 0.18, ranged: true, r: 0.95, h: 5.0,
    build: ['tingxue', 'dunying', 'heichi'],
    passive: { name: '霜弦', icon: 'icelance', desc: '普攻附带 10% 减速；对已被减速或定身的目标，普攻伤害 +12%。' },
    skills: [
      S('Q', 'frostfeather', '霜羽', 'proj', { range: 18, speed: 34, width: 0.9, cd: 6.5, mana: 35, b: 50, l: 12, ad: 0.8, pierce: true, slow: [0.3, 1.5], vfx: 'icelance', icon: 'icelance' }, '射出一支贯穿敌人的霜羽箭，造成伤害并减速。'),
      S('W', 'stillheart', '冰心', 'haste', { cd: 13, mana: 40, dur: 4, ms: 0.12, as: 0.42, vfx: 'gale', icon: 'quick' }, '心如冰镜，短时间内开弓大幅加快。'),
      S('E', 'snowstep', '踏雪', 'backdash', { range: 7, speed: 28, cd: 9, mana: 40, b: 40, l: 10, ad: 0.5, slow: [0.5, 1.5], projRange: 13, vfx: 'backshot', icon: 'backshot' }, '踏雪后撤，同时朝目标方向补一支减速箭。'),
      S('R', 'icebound', '冰封三百年', 'zone', { range: 15, radius: 6.6, delay: 0.5, dur: 3, tick: 0.5, cd: 58, mana: 90, b: 32, l: 8, ad: 0.26, slow: [0.3, 0.8], lvl: 4, vfx: 'blizzard', icon: 'blizzard' }, '把冰岛的风雪引到目标区域，持续伤害并减速。'),
    ],
  },
  peiji: {
    id: 'peiji', size: 1.48, tint: [0.88, 0.9, 1.0], style: 'axe', name: '裴寂', short: '寂', title: '天刑台代管', role: '律修 · 近战', blurb: '闻人策伏法后代管天刑台。一根刑杖在手，站在哪里，哪里就是规矩。',
    hp: 1170, hpG: 126, mana: 280, manaG: 22, ad: 57, adG: 3.5, ap: 0, apG: 0, ms: 6.6, range: 3.0, period: 1.0, wind: 0.26, ranged: false, r: 1.1, h: 5.3,
    build: ['heichi', 'xingluo', 'tingxue'],
    passive: { name: '铁律', icon: 'gate', desc: '被他的招式打中的敌人，3 秒内受到的所有伤害 +7%。' },
    skills: [
      S('Q', 'rod', '刑杖', 'cone', { range: 6.2, angle: 85, cd: 7, mana: 35, b: 58, l: 12, ad: 0.6, stun: 0.6, vfx: 'gate', icon: 'gate' }, '刑杖横扫前方扇形，造成伤害并定身。'),
      S('W', 'writ', '天刑令', 'taunt', { radius: 6.5, dur: 1.4, cd: 14, mana: 50, b: 110, l: 30, hpR: 0.08, vfx: 'taunt', icon: 'taunt' }, '亮出天刑令，周围的敌人只能冲他来，自己获得一层罡气。'),
      S('E', 'enforce', '执法', 'dash', { range: 8.5, speed: 28, cd: 10, mana: 40, b: 50, l: 11, ad: 0.55, stun: 0.5, hitR: 2, vfx: 'charge', icon: 'charge' }, '大步上前，撞到的敌人受伤并短暂定身。'),
      S('R', 'abyssseal', '镇渊', 'leap', { range: 11, radius: 5.4, delay: 0.55, cd: 55, mana: 80, b: 165, l: 38, ad: 1.05, stun: 0.95, lvl: 4, vfx: 'skyfall', icon: 'skyfall' }, '跃起砸向目标区域，落地时重创并定住范围内的敌人。'),
    ],
  },
};
export const HERO_ORDER = ['warden', 'keeper', 'peiji', 'bloodlord', 'berserker', 'qingya', 'shade', 'wenren', 'archer', 'linshuang', 'ranger', 'gunner', 'mage', 'cryo', 'storm', 'healer', 'yanzhao', 'yuanshan'];
export const SUPPORTS = ['healer', 'yanzhao', 'yuanshan'];

// Items come in three grades, as in the novel: 凡器 (bought outright) → 灵器 (one 凡器 refined) → 法宝 (two 灵器 fused).
// Each entry lists its TOTAL stats; `cost` is the fee for this step only, `parts` are consumed. Buying a finished item
// buys whatever parts you are missing in one go.
const I = (id, name, tier, cost, stats, tip, parts, icon) => ({ id, name, tier, cost, parts: parts || null, tip, icon, ...stats });
export const ITEMS = {
  jian: I('jian', '精铁剑', 1, 340, { ad: 15 }, '+15 攻击力', null, 'i_sword'),
  zhang: I('zhang', '灵木杖', 1, 340, { ap: 30 }, '+30 术法强度', null, 'i_staff'),
  jia: I('jia', '玄铁甲', 1, 340, { hp: 300 }, '+300 气血', null, 'i_armor'),
  fu: I('fu', '轻身符', 1, 300, { ms: 0.45 }, '身法 +7%', null, 'i_talisman'),
  huiyuan: I('huiyuan', '回元丹', 1, 300, { mana: 150, cdr: 0.06 }, '+150 灵力，招式调息 -6%', null, 'i_pill'),
  xuening: I('xuening', '血凝丹', 1, 320, { ls: 0.06, regen: 0.004 }, '普攻吸血 6%，气血回复加快', null, 'i_gourd'),
  qingfeng: I('qingfeng', '青锋剑', 2, 420, { ad: 34, as: 0.12 }, '+34 攻击力，攻速 +12%', ['jian'], 'i_sword'),
  xingwen: I('xingwen', '星纹杖', 2, 420, { ap: 68 }, '+68 术法强度', ['zhang'], 'i_staff'),
  zhenxue: I('zhenxue', '镇血甲', 2, 420, { hp: 650 }, '+650 气血', ['jia'], 'i_armor'),
  xingdun: I('xingdun', '星遁符', 2, 360, { ms: 0.85 }, '身法 +13%', ['fu'], 'i_talisman'),
  qinghun: I('qinghun', '清魂丹', 2, 400, { mana: 320, cdr: 0.12 }, '+320 灵力，招式调息 -12%', ['huiyuan'], 'i_pill'),
  huaxue: I('huaxue', '化血丹', 2, 420, { ad: 10, ls: 0.12, regen: 0.006 }, '+10 攻击力，普攻吸血 12%', ['xuening'], 'i_gourd'),
  tingxue: I('tingxue', '听雪剑', 3, 560, { ad: 62, as: 0.28, crit: 0.1, ms: 0.85, slowHit: [0.2, 1] }, '+62 攻击力，攻速 +28%，会心 +10%，身法 +13%。普攻带寒气，命中减速', ['qingfeng', 'xingdun'], 'i_tingxue'),
  heichi: I('heichi', '镇关尺', 3, 560, { ad: 48, as: 0.12, hp: 900, dr: 0.1 }, '+48 攻击力，+900 气血。尺中剑意护体，受到修士的伤害 -10%', ['qingfeng', 'zhenxue'], 'i_ruler'),
  mingpan: I('mingpan', '命盘', 3, 560, { ap: 120, mana: 450, cdr: 0.22 }, '+120 术法强度，+450 灵力，招式调息 -22%', ['xingwen', 'qinghun'], 'i_disc'),
  zhaohun: I('zhaohun', '照魂镜', 3, 560, { ap: 95, ad: 10, ls: 0.12, sv: 0.14 }, '+95 术法强度。照出魂血：招式伤害的 14% 化为自身气血', ['xingwen', 'huaxue'], 'i_mirror'),
  xingluo: I('xingluo', '星络护腕', 3, 560, { hp: 900, mana: 400, cdr: 0.18, regen: 0.008 }, '+900 气血，+400 灵力，招式调息 -18%，气血回复大幅加快', ['zhenxue', 'qinghun'], 'i_bracer'),
  dunying: I('dunying', '遁影镜', 3, 560, { ad: 30, ms: 1.1, ls: 0.16, crit: 0.12 }, '+30 攻击力，身法 +17%，会心 +12%，普攻吸血 16%', ['xingdun', 'huaxue'], 'i_dunying'),
};
export const ITEM_TIERS = [['jian', 'zhang', 'jia', 'fu', 'huiyuan', 'xuening'], ['qingfeng', 'xingwen', 'zhenxue', 'xingdun', 'qinghun', 'huaxue'], ['tingxue', 'heichi', 'mingpan', 'zhaohun', 'xingluo', 'dunying']];
export const TIER_NAME = ['', '凡器', '灵器', '法宝'];

// Ability ranks. Basic abilities have three (入门 → 小成 → 大成), the ultimate three, one at the peak of each great realm (筑基巅峰 → 金丹巅峰 → 元婴巅峰). One point per hero level;
// a rank can only be taken once the hero is high enough. The top rank also lengthens the ability's slows, stuns and buffs.
// the twelve levels are twelve small realms
export const REALM = ['筑基初期', '筑基中期', '筑基后期', '筑基巅峰', '金丹初期', '金丹中期', '金丹后期', '金丹巅峰', '元婴初期', '元婴中期', '元婴后期', '元婴巅峰'];
export const realmOf = L => `${REALM[L - 1]}（${L}）`;
export const RANK = {
  basic: { max: 3, lvl: [1, 3, 5], dmg: [0.85, 1.05, 1.3], cd: [1, 0.92, 0.84], name: ['入门', '小成', '大成'] },
  ult: { max: 3, lvl: [4, 8, 12], dmg: [1, 1.3, 1.6], cd: [1, 0.86, 0.72], name: ['初悟', '大成', '圆满'] },
  top: 1.25,
};

const T_BASE = {
  lateAt: 360, lateK: 0.4, respawnK: 1, groupAt: 1e9,
  sight: { hero: 20, minion: 13, neutral: 0, tower: 17, core: 20 },      // how far each kind of unit sees, where the mode has fog                               // when waves start to snowball, and how fast; respawn scale
  maxLevel: 12, xpNeed: L => 90 + 55 * L,
  waveFirst: 6, waveEvery: 24,
  towerHp: 2650, towerAd: 150, towerRange: 13.5, towerPeriod: 1.05,
  // tower fire heats its target: every consecutive hit on a hero makes the next one hit harder; the heat cools off out of range
  heatStep: 0.65, heatMax: 4, heatHold: 3.5, towerLock: 0.55,
  coreHp: 4200,
  fountainR: 9, recallTime: 4, shopR: 15,
  minion: {
    melee: { hp: 310, ad: 15, range: 1.9, period: 1.1, wind: 0.3, ms: 4.9, r: 0.7, h: 2.5, gold: 22, xp: 42 },
    ranged: { hp: 200, ad: 24, range: 8.2, period: 1.3, wind: 0.3, ms: 4.9, r: 0.62, h: 2.7, gold: 17, xp: 32, ranged: true },
  },
  neutral: {
    golem: { hp: 520, ad: 26, range: 2.2, period: 1.2, wind: 0.35, ms: 6, r: 1.3, h: 3.4, gold: 48, xp: 70, respawn: 50 },
    guardian: { hp: 2600, ad: 70, range: 3.4, period: 1.4, wind: 0.45, ms: 5.5, r: 2.5, h: 6.6, gold: 90, xp: 220, respawn: 100 },
  },
  killGold: 220, assistGold: 90, towerGold: 160, passiveGold: 2.2, startGold: 300,
  respawn: L => 6 + 2.0 * L,
  difficulty: { easy: { name: '简单', enemy: 0.72, react: 1.7, aim: 2.8 }, normal: { name: '普通', enemy: 0.96, react: 1.15, aim: 1.6 }, hard: { name: '困难', enemy: 1.02, react: 0.75, aim: 0.8 } },
};

export const T = { ...T_BASE };
// Switch mode: the map, the lanes, the camps, the brush, the towers and the tuning table are all swapped in place, so every
// module that imported them keeps working with the new ground under it. The world has to be rebuilt afterwards.
export function setMode(id) {
  const m = MODES[id] || MODES.single; MODE = m; MID = m.mid;
  Object.assign(MAP, m.map); RIVER = m.river();
  LANES.length = 0; LANES.push(...m.lanes()); CAMPS.length = 0; CAMPS.push(...m.camps); BRUSH.length = 0; BRUSH.push(...m.brush);
  for (const k of Object.keys(T)) delete T[k]; Object.assign(T, T_BASE, m.tune);
  RIDGES.length = 0; RIDGE_ENDS.length = 0;
  for (const [a, b] of m.ridges || []) for (const f of [p => p, p => [-p[1], -p[0]], p => [-p[0], -p[1]], p => [p[1], p[0]]]) {
    const A = f(a), B = f(b), d = Math.hypot(B[0] - A[0], B[1] - A[1]), ux = (B[0] - A[0]) / d, uz = (B[1] - A[1]) / d;
    RIDGES.push([A, B]); RIDGE_ENDS.push({ x: A[0] - ux * 3.6, z: A[1] - uz * 3.6 }, { x: B[0] + ux * 3.6, z: B[1] + uz * 3.6 });
  }
  TOWERS.length = 0;
  for (const team of [FROST, EMBER]) LANES.forEach((L, lane) => L.towers.forEach((_, i) => { const s = L.towerS(team, i + 1); TOWERS.push({ team, lane, tier: i + 1, s, ...L.at(s, L.towerOff(team)) }); }));
  return m;
}
setMode('single');
