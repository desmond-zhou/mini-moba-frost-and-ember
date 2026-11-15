// skillsound.js — what each cultivator's moves sound like, reasoned from who they are and what the move physically is, not from the
// visual effect it happens to share with someone else. Each entry lists sounds (name, gain) for:
//   cast — as the move goes off;  land — when an area lands (each tick of a lasting one);  hit — when its projectile strikes.
// A move with no entry keeps the look-based sounds in vfx.js. Every move also carries its cultivator's signature (sig_<id>, sfx.js),
// quietly, so you can tell who cast it by ear.
export const SIG_GAIN = 0.5;
export const SKSND = {
  // 韩不语 · the mute executioner: everything restrained, low, iron; the sword intent sealed in the ruler only ever hums
  cleave: { cast: [['heavy', 0.9], ['slash', 0.6]] },
  bulwark: { cast: [['shield', 0.7], ['sword', 0.45]] },                 // 封意: the sealed sword intent wraps him
  charge: { cast: [['whoosh', 0.8], ['earth', 0.6]] },
  skyfall: { cast: [['heavy', 0.8]] },                                   // the landing is the slam (vfx leapLand)
  // 周远川 · fifty years at a gate: wood, iron, a city's weight; his time-stop is stillness, not ice
  gate: { cast: [['smack', 0.9], ['earth', 0.5]] },
  taunt: { cast: [['shout', 0.9], ['shield', 0.5]] },
  starstride: { cast: [['shield', 0.6], ['whoosh', 0.8]] },
  stasis: { cast: [['charge', 0.8]], land: [['magic', 0.8], ['thud', 0.9]] },
  // 裴寂 · the tribunal: a rod of law and decrees; wood and voice, no blood
  rod: { cast: [['whoosh', 0.7], ['h_peiji', 0.8]] },
  writ: { cast: [['shout', 0.8], ['thud', 0.8]] },
  enforce: { cast: [['whoosh', 0.7], ['h_peiji', 0.9], ['thud', 0.6]] },
  abyssseal: { cast: [['earth', 0.8], ['heavy', 0.8], ['shout', 0.5]] },
  // 血屠子 · the blood path: thick, wet, slow; even his 罡气 is blood
  bloodclaw: { cast: [['slash', 0.8], ['blood', 0.8]] },
  hook: { cast: [['whoosh', 0.8], ['blood', 0.6]] },
  bloodshield: { cast: [['blood', 0.9], ['shield', 0.35]] },
  bloodsea: { cast: [['charge', 0.6], ['blood', 0.9]], land: [['blood', 0.55]] },
  // 老铁 · a northern guide with a chipped blade: brute weight and breath
  whirl: { cast: [['heavy', 1], ['slash', 0.7]] },
  axe: { cast: [['whoosh', 0.9]], hit: [['h_berserker', 0.9]] },
  rage: { cast: [['shout', 0.8], ['wind', 0.5]] },                       // 北荒血性: a roar, then breathing hard
  quake: { cast: [['heavy', 0.9]] },
  // 陆青崖 · 清正: one clean sword, no flourish
  breeze: { cast: [['whoosh', 0.8], ['sword', 0.5]] },
  upright: { cast: [['shield', 0.6], ['sword', 0.45]] },
  dispel: { cast: [['slash', 0.9], ['sword', 0.4]] },
  // 柳红衣 · the hidden hand: silk, needles, mist; the blood is in the soul-eating, not in noise
  shadowstep: { cast: [['whoosh', 0.6], ['w_shade', 0.7]] },
  fan: { cast: [['arrow', 0.7], ['blood', 0.35]] },
  veil: { cast: [['wind', 0.6], ['blood', 0.45]] },
  // 闻人遥 · qi running backwards: ragged, burning, bursting
  fateline: { cast: [['whoosh', 0.8], ['blood', 0.6]] },
  frenzy: { cast: [['charge', 0.6], ['blood', 0.5]] },
  flit: { cast: [['whoosh', 0.7], ['w_wenren', 0.7]] },
  burnvein: { cast: [['blast', 0.8], ['fire', 0.6], ['blood', 0.5]] },  // the veins burn and burst outward
  // 沈焰 · a heart-fire kept three hundred years
  quickdraw: { cast: [['fire', 0.8]] },
  firearrow: { cast: [['w_archer', 0.9], ['fire', 0.7]] },
  firestep: { cast: [['whoosh', 0.8], ['fire', 0.6]] },
  // 林霜 · a heavy bow, cold and patient
  frostfeather: { cast: [['w_linshuang', 0.9], ['ice', 0.6]] },
  icethorn: { cast: [['ice', 0.5]], land: [['ice', 0.8], ['thud', 0.6]] },
  snowstep: { cast: [['whoosh', 0.7], ['w_linshuang', 0.7]] },
  // 苏紫烟 · 听雪: snow and a blade of wind; her mirror is glass, not stars
  pierce: { cast: [['w_ranger', 0.8], ['sword', 0.7]] },
  mirrorstep: { cast: [['shield', 0.5], ['whoosh', 0.6]] },
  // 吴镇岳 · a proud peak master: paper, powder, crossbow
  shell: { cast: [['whoosh', 0.6], ['fire', 0.4]], land: [['blast', 0.9], ['fire', 0.5]] },
  // 周易 · starlight, reckoned; his alone is the star voice
  well: { cast: [['charge', 0.7], ['star', 0.7]], land: [['magic', 0.8]] },
  phase: { cast: [['magic', 0.6], ['star', 0.6]] },
  // 寒漪 · the frost elder: quiet hiss, then the freeze bursts
  frostnova: { cast: [['ice', 0.9], ['blast', 0.5]] },
  iceslide: { cast: [['whoosh', 0.7], ['ice', 0.6]] },
  // 孙伯 · a sweeper with a gourd: pills, paper, herbs
  mend: { cast: [['heal', 0.8]] },
  vine: { cast: [['whoosh', 0.6]] },
  ward: { cast: [['heal', 0.7], ['wind', 0.6]] },
  bloom: { cast: [['heal', 1]], land: [['heal', 0.35]] },
  // 言照雪 · the veiled body: hush and dark, never ice
  veilbolt: { cast: [['whoosh', 0.6], ['magic', 0.5]] },
  skyveil: { cast: [['shield', 0.7], ['wind', 0.5]] },
  eclipse: { cast: [['charge', 0.6], ['wind', 0.7]], land: [['wind', 0.35]] },
  // 陆玄机 · the diviner of the first scroll: coins and lots, an ill omen, a turned fate
  coin: { cast: [['w_yuanshan', 0.9], ['cast', 0.4]], hit: [['h_yuanshan', 0.9], ['blast', 0.4]] },
  omen: { cast: [['charge', 0.5]], land: [['magic', 0.7], ['thud', 0.7]] },
  refate: { cast: [['heal', 0.8]] },
  misfortune: { cast: [['charge', 0.8], ['magic', 0.6]], land: [['magic', 0.8], ['heavy', 0.7], ['thud', 0.8]] },
};
