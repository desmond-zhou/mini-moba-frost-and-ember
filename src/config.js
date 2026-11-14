// config.js — map layout, hero kits, items, tuning. Everything the game needs to know that is not code.
export const MAP = { hx: 80, hz: 48 };
export const FROST = 0, EMBER = 1, NEUTRAL = 2;
export const laneZ = x => 10 * Math.sin(x * Math.PI / 80);
export const riverX = z => 6 * Math.sin(z * Math.PI * 1.5 / 48);
export const sideSign = team => (team === FROST ? -1 : 1);

export const POS = {
  core: t => ({ x: sideSign(t) * 64, z: laneZ(sideSign(t) * 64) }),
  fountain: t => ({ x: sideSign(t) * 75, z: laneZ(sideSign(t) * 75) }),
  tower: (t, tier) => { const x = sideSign(t) * (tier === 1 ? 24 : 46); return { x, z: laneZ(x) + (t === FROST ? 3.4 : -3.4) }; },
};

export const CAMPS = [
  { x: -30, z: 25, r: 7, kind: 'golem', n: 2 },
  { x: 30, z: -25, r: 7, kind: 'golem', n: 2 },
  { x: -15, z: -28, r: 7, kind: 'golem', n: 2 },
  { x: 15, z: 28, r: 7, kind: 'golem', n: 2 },
  { x: -1.5, z: 36, r: 9, kind: 'guardian', n: 1 },
];

// tall grass: whoever stands inside cannot be seen from outside, until they strike, cast, get hit, or an enemy walks in
export const BRUSH = [
  { x: -15, z: -15.4, r: 3.6 }, { x: 15, z: 15.4, r: 3.6 }, { x: -13, z: 4.6, r: 3.4 }, { x: 13, z: -4.6, r: 3.4 },
  { x: -4, z: 21, r: 3.6 }, { x: 4, z: -21, r: 3.6 }, { x: -22, z: 17, r: 3.6 }, { x: 22, z: -17, r: 3.6 },
  { x: -24, z: -23, r: 3.6 }, { x: 24, z: 23, r: 3.6 }, { x: -12, z: 38, r: 3.4 }, { x: 9.5, z: 40, r: 3.4 },
];
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
};
export const HERO_ORDER = ['warden', 'keeper', 'bloodlord', 'berserker', 'shade', 'archer', 'ranger', 'gunner', 'mage', 'cryo', 'storm', 'healer'];

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

export const T = {
  maxLevel: 12, xpNeed: L => 90 + 55 * L,
  waveFirst: 6, waveEvery: 24,
  towerHp: 2650, towerAd: 150, towerRange: 13.5, towerPeriod: 1.05,
  // tower fire heats its target: every consecutive hit on a hero makes the next one hit harder; the heat cools off out of range
  heatStep: 0.4, heatMax: 4, heatHold: 3.5, towerLock: 0.55,
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
