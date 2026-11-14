// game.js — rules of the match: units, combat, abilities, minion waves, towers, jungle camps, economy, bot AI.
import { MAP, MODE, LANES, TOWERS, FROST, EMBER, NEUTRAL, sideOf, nearestLane, RIVER, RIDGE_ENDS, POS, SEATS, SEAT_FIT, SEAT_BIAS, SUPPORTS, INSIGHT, INSIGHT_LVL, CAMPS, TEAM_COL, HEROES, HERO_ORDER, ITEMS, ITEM_TIERS, RANK, realmOf, T, BRUSH, brushAt } from './config.js';
import { clamp, dist, dist2, angLerp, lerp } from './util.js';
import * as THREE from 'three';
import { Graph, AStar, NavNode, NavEdge, Vector3 as YVec, Think, GoalEvaluator, MemorySystem } from 'yuka';
import { createVfx } from './vfx.js';
import { BARKS, VOICE, voice } from './barks.js';

const isStruct = e => e.kind === 'tower' || e.kind === 'core';
const HOT = [3.2, 1.3, 0.3], WHITE = [1.6, 1.6, 1.6], GOLD = [2.2, 1.6, 0.4], DUST = [0.24, 0.21, 0.17], FLAME = [1.0, 0.36, 0.07];

export function createGame(R, W, M, fx, audio, ui, opts) {
  const mirror = opts.difficulty === 'mirror';                         // test mode: both sides play by exactly the same numbers
  const diff = mirror ? { enemy: 0.96, react: 1, aim: 1.4 } : T.difficulty[opts.difficulty] || T.difficulty.normal;
  const G = { t: 0, over: false, winner: -1, overT: 0, units: [], heroes: [], proj: [], zones: [], kills: [0, 0], player: null, firstBlood: false, structs: [null, null], camps: [], spawnQ: [], nextWave: T.waveFirst, wave: 0, buffT: [0, 0], avgLvl: [1, 1], focus: { x: 0, z: 0 } };
  let uid = 0;
  const V = createVfx(fx, audio);
  const close = e => dist2(e.x, e.z, G.focus.x, G.focus.z) < 26;

  // ---------------- fog of war (where the mode has it) ----------------
  // A coarse grid over the map holds how well the player's side sees each cell. It darkens the ground through a plane laid
  // just above it and is what the minimap dims by. The rules themselves do not read it: sight is decided unit against unit.
  const FOG = !!MODE.fog; let fogT = 0, paintFog = () => {};
  if (FOG) {
    const CELL = 2, fw = Math.ceil(MAP.hx * 2 / CELL), fh = Math.ceil(MAP.hz * 2 / CELL), want = new Float32Array(fw * fh), cur = new Float32Array(fw * fh), px = new Uint8Array(fw * fh);
    const tex = new THREE.DataTexture(px, fw, fh, THREE.RedFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(MAP.hx * 2 + 160, MAP.hz * 2 + 140).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: { tFog: { value: tex }, uHalf: { value: new THREE.Vector2(MAP.hx, MAP.hz) } }, transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform sampler2D tFog; uniform vec2 uHalf; varying vec2 vW; void main(){ vec2 uv = clamp((vW + uHalf) / (uHalf * 2.0), 0.0, 1.0); float v = texture2D(tFog, uv).r; gl_FragColor = vec4(0.012, 0.018, 0.035, (1.0 - smoothstep(0.05, 0.95, v)) * 0.62); }',
    }));
    plane.position.y = 0.13; plane.renderOrder = -2; plane.userData.noAO = true; plane.frustumCulled = false; M.root.add(plane);
    G.fog = { w: fw, h: fh, data: cur, plane };
    paintFog = () => {
      want.fill(0); const mine = G.player.team;
      const stamp = (ux, uz, R0) => { const cx = (ux + MAP.hx) / CELL, cz = (uz + MAP.hz) / CELL, rc = R0 / CELL, x0 = Math.max(0, Math.floor(cx - rc)), x1 = Math.min(fw - 1, Math.ceil(cx + rc)), z0 = Math.max(0, Math.floor(cz - rc)), z1 = Math.min(fh - 1, Math.ceil(cz + rc)); for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz) / rc; if (d < 1) { const v = d < 0.62 ? 1 : (1 - d) / 0.38, i = z * fw + x; if (v > want[i]) want[i] = v; } } };
      { const f = POS.fountain(mine), c = POS.core(mine); stamp(f.x, f.z, 30); stamp(c.x, c.z, 30); }   // home is never in the dark
      for (const u of G.units) {
        if (!u.alive || u.team !== mine) continue; const R0 = T.sight[u.kind]; if (!R0) continue;
        const cx = (u.x + MAP.hx) / CELL, cz = (u.z + MAP.hz) / CELL, rc = R0 / CELL, x0 = Math.max(0, Math.floor(cx - rc)), x1 = Math.min(fw - 1, Math.ceil(cx + rc)), z0 = Math.max(0, Math.floor(cz - rc)), z1 = Math.min(fh - 1, Math.ceil(cz + rc));
        for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz) / rc; if (d < 1) { const v = d < 0.62 ? 1 : (1 - d) / 0.38, i = z * fw + x; if (v > want[i]) want[i] = v; } }
      }
      for (let i = 0; i < cur.length; i++) { cur[i] += (want[i] - cur[i]) * 0.45; px[i] = cur[i] * 255; }
      tex.needsUpdate = true;
    };
  }
  // ---------------- the brain (三路) ----------------
  // What a bot does with its own time is a choice among a handful of options. Each is a Yuka GoalEvaluator: it scores the
  // option 0–1 from what the bot can see (ctx), Think multiplies by the seat's bias and takes the best, and the winner
  // leaves its pick on the bot for botThink to act on.
  class Want extends GoalEvaluator {
    constructor(mode, bias, score) { super(bias); this.mode = mode; this.score = score; this.pick = null; }
    calculateDesirability(h) { this.pick = null; const v = this.characterBias > 0 ? this.score(h.ai.ctx, this, h) : 0; return v > 0 ? v : 0; }
    setGoal(h) { h.ai.pick = { mode: this.mode, ...(this.pick || {}) }; }
  }
  function makeBrain(h, bias) {
    const b = new Think(h);
    b.addEvaluator(new Want('lane', bias.lane, () => 0.5));
    b.addEvaluator(new Want('escort', bias.escort, c => (c.carry ? 0.6 : 0)));                                   // 护法 stays with 养剑
    b.addEvaluator(new Want('jungle', bias.jungle, (c, ev) => {
      if (c.hpF < 0.5 || (c.eh && c.ehD < 9) || c.grouped) return 0; if (!h.ai.jungler && (!c.holding || h.level < 2 || c.woodsTaken)) return 0;
      const camp = c.nearestCamp(h.ai.jungler ? 999 : 48); if (!camp) return 0; ev.pick = { camp }; return 0.62 - dist(h, camp.c) / 400 + (c.teamJungler ? 0 : 0.35);
    }));
    b.addEvaluator(new Want('gank', bias.gank, (c, ev) => {
      if (h.level < 3 || c.hpF < 0.6 || G.t < (h.ai.gankAt || 0) || c.grouped || (!h.ai.jungler && !c.holding)) return 0;
      const g = c.bestGank(); if (!g) return 0; ev.pick = g; return clamp(0.34 + g.sc * 0.3, 0, 0.95);
    }));
    b.addEvaluator(new Want('ambush', bias.ambush, (c, ev) => { if (G.t < h.ai.ambushAt || !h.ai.sly || c.hpF < 0.6 || c.eh || !c.hasFront || c.grouped) return 0; const br = c.ambushSpot(); if (!br) return 0; ev.pick = { brush: br }; return 0.56; }));
    b.addEvaluator(new Want('help', bias.help, (c, ev) => { ev.pick = { lane: c.neediest() }; return 0.45; }));       // 巡山 with nothing to clear
    return b;
  }
  // what each side remembers of the other: where each of them was last seen, and when (Yuka MemorySystem)
  G.mem = [new MemorySystem(), new MemorySystem()];
  // Team talk. A bot says in a few words what it is about to do; only your own side's is shown, never two lines from the
  // same mouth close together, and not everyone at once.
  let chatAt = -9;
  const PAIRS = [
    ['archer', 'linshuang', ['霜，这回并肩。', '嗯。火别灭。'], ['霜……别让我为难。', '各守各的岛。出手吧。']],
    ['mage', 'yuanshan', ['前辈，上卷我读完了。', '那就替我把后面的走完。'], ['前辈，得罪了。', '让我看看上卷你读懂了几成。']],
    ['mage', 'keeper', ['伯祖，我回来了。', '门我守着，你放手去算。'], ['伯祖，得罪了。', '想过这道门，先过我。']],
    ['ranger', 'qingya', ['师父，听雪我练熟了。', '出剑，别回头。'], ['师父，请赐教。', '让为师看看你的听雪。']],
    ['warden', 'qingya', ['……师父。', '不语，守好关。'], ['……', '还是不肯开口？出尺吧。']],
    ['peiji', 'wenren', ['别再走火。', '管好你的天刑台。'], ['闻人遥，随我回天刑台。', '拿得住我再说。']],
    ['mage', 'ranger', ['紫烟，星图我来推，你只管出剑。', '那你算快些，我的剑不等人。'], ['紫烟，这回各走各的星路。', '正好，看看天衍这门功课谁学得深。']],
    ['peiji', 'storm', ['沈渊，戴罪立功。', '……依约行事。'], ['沈渊，谁放你出来的？', '代管大人，今日各凭本事。']],
    ['warden', 'wenren', ['……（看了一眼右臂）', '那一线，我没忘。别挡着我。'], ['……（提尺）', '你的右臂好了？再来一线。']],
    ['cryo', 'ranger', ['冰桥我来架。', '有劳寒漪长老。'], ['这回不替你架桥了。', '长老，得罪。']],
    ['berserker', 'mage', ['小子，老铁给你开路。', '有劳前辈。'], ['小子，别怪老铁手重。', '前辈，你的刀路我算过。']],
    ['gunner', 'berserker', ['老铁，再拔一回桩？', '拔！符管够不？'], ['老铁，让开。', '吴峰主，你那叠符吓不住我。']],
    ['yanzhao', 'mage', ['我替你遮着。', '有你在，我放心算。'], ['这次……我遮的是你的眼。', '照雪，星我还是看得见。']],
    ['bloodlord', 'mage', ['小辈，那颗星本座还记着。', '此一时，彼一时。'], ['周易！星落之仇，今日清算。', '上回一颗星，这回还是一颗。']],
    ['shade', 'mage', ['你揭过我一次。', '这次我们同路。'], ['又是你。', '红衣，我还是认得出你。']],
    ['warden', 'ranger', ['……（把尺往前一横）', '师兄还是老样子。前面交给你。'], ['……（摇头）', '师兄，今天我不让。']],
    ['healer', 'qingya', ['陆小子，回来了就好。', '孙伯，经阁的地还是您扫？'], ['陆小子，下手轻些，老头子骨头脆。', '孙伯，您装糊涂这招骗不了我。']],
    ['healer', 'mage', ['易小子，伤了就往我这儿靠。', '孙伯，您那葫芦里到底装了多少？'], ['易小子，老头子今天不帮你喽。', '孙伯，您的丹我认得，骗不过我。']],
    ['linshuang', 'mage', ['当年替我们传话的，是你。', '三百年的话，传到了就好。'], ['传话的人，也要拦我？', '前辈，各为其主。']],
    ['archer', 'mage', ['小子，那句话你传得好。', '前辈的火，一直没灭。'], ['小子，火不认人。', '前辈，我算得到火往哪烧。']],
    ['gunner', 'cryo', ['寒长老，冰原那回，天元宗欠你一座桥。', '吴峰主少说两句，符省着点用。'], ['寒长老，冻不住我的符。', '那就试试。']],
    ['gunner', 'bloodlord', ['……血魂宗的人，也配与天元宗同列？', '本座不在乎同列，只在乎血。'], ['血海原上没炸死你，今日补上。', '吴峰主，你的符还是那么吵。']],
    ['cryo', 'bloodlord', ['你的血池，冻过一回。', '……玄霜宗的冰，本座记得。'], ['血池冻得住，你也冻得住。', '这一回，本座的血不会凉。']],
    ['berserker', 'bloodlord', ['北荒的狼不跟魔头一伙，这回例外。', '老铁，你那口破刀，本座看着碍眼。'], ['北荒的账，今天一起算。', '一个向导，也敢拦本座？']],
    ['storm', 'mage', ['这回，星影别对着我。', '只要你的雷别落在我们头上。'], ['又是你的星影。', '沈副使，这回依约，不留手。']],
    ['storm', 'wenren', ['天刑台的旧人，就剩我们两个了。', '……别跟我提天刑台。'], ['你师父的印，还在我手里。', '那就来拿走你的命。']],
    ['peiji', 'warden', ['刑律堂与天刑台，今日同判。', '……（点头）'], ['韩首座，律法之争，场上见。', '……（提尺）']],
    ['peiji', 'yanzhao', ['公审那日，委屈你了。', '代管大人秉公而已。'], ['言姑娘，这次你遮不住。', '代管大人，我遮的从来不是自己。']],
    ['warden', 'shade', ['……（盯着她看了一眼）', '首座放心，我这回是真的站这边。'], ['……（提尺）', '首座的尺，当年没落下来。今天也一样。']],
    ['keeper', 'linshuang', ['三百年的岛，五十年的门，都守住了。', '前辈守的门，比我的岛冷。'], ['冰岛的人，也要过天衍城的门？', '前辈，门是门，岛是岛。']],
    ['qingya', 'yuanshan', ['太上长老。', '青崖，你的剑还是那么直。'], ['太上长老，请。', '让老夫看看，你的剑直到几分。']],
    ['shade', 'bloodlord', ['宗主，取谁的命？', '红衣，一个不留。'], ['宗主，血魂宗的路我不走了。', '暗子也敢反？']],
  ];
  let jeerAt = -99; const FOE_SAYS = { kill: 'eKill', die: 'eDie', ahead: 'eAhead', behind: 'eBehind', eStart: 'eStart', focus: 'focus' };
  function chat(h, text, force, vars) {                                // text: a literal, a list to pick from, or an event key spoken in the speaker's own manner
    if (h.isPlayer || G.over) return; const foe = h.team !== G.player.team; let hold = 0;
    if (foe && !Array.isArray(text)) { text = FOE_SAYS[text]; if (!text) return; }   // the other side never reports to its own in your hearing: it only talks at you
    if (text === 'ins') hold = 11000;
    if (Array.isArray(text)) text = text[Math.floor(Math.random() * text.length)]; else if (VOICE.base[text]) text = voice(h.def.id, text, vars);
    if (!text) return;
    if (foe) { if (!force && (G.t - jeerAt < 22 || G.t - (h.chatT || -99) < 60 || Math.random() < 0.45)) return; jeerAt = G.t; }   // the other side: seldom, for company
    else if (!force && (G.t - (h.chatT || -9) < 4 || G.t - chatAt < 1.2)) return; else chatAt = G.t;
    h.chatT = G.t; ui.chat(h, text, foe, hold);
  }
  // a line of speech: only for those in view, never two at once from the same mouth, and not everyone talking over each other
  let sayAt = -9; const sayQ = [];
  function say(h, kind, chance = 1) {
    const set = BARKS[h.def.id] && BARKS[h.def.id][kind]; if (!set || G.over && kind !== 'die') return;
    if (G.t - (h.sayT || -9) < 4 || G.t - sayAt < 1.1 || Math.random() > chance || !near(h) || !canSee(G.player, h)) return;
    h.sayT = sayAt = G.t; fx.say(h.x, h.h + 1.6, h.z, set[Math.floor(Math.random() * set.length)], h.team === G.player.team);
  }
  // ---------------- units ----------------
  const faceOf = team => (team === EMBER ? Math.PI : 0) + Math.atan2(MAP.az, MAP.ax);      // looking at the other base
  const spawnAt = (team, k) => { const f = POS.fountain(team), a = team === FROST ? 2 : -2; return { x: f.x + MAP.ax * a - MAP.az * k, z: f.z + MAP.az * a + MAP.ax * k }; };
  function unit(kind, team, x, z, s) {
    const e = {
      id: ++uid, kind, team, x, z, y: 0, px: x, pz: z, vx: 0, vz: 0, r: s.r, h: s.h, hp: s.hp, maxHp: s.hp, alive: true, ad: s.ad || 0, ap: 0, range: s.range || 0, period: s.period || 1, wind: s.wind || 0.3, ms: s.ms || 0, ranged: !!s.ranged,
      facing: faceOf(team), target: null, atkT: 0, windT: -1, slowT: 0, slowPct: 0, stunT: 0, shield: 0, shieldT: 0, hasteT: 0, hasteMs: 0, hasteAs: 0, moving: false, curSpeed: 0, flash: 0, tauntT: 0, taunter: null, knock: null, hitK: 0, hitX: 0, hitZ: 0, barShown: 1, barLag: 1, lagT: 0, healT: 0, cutK: 0, animAtk: 0, animCast: 0, combatT: 9, brush: -1, hid: false, revealT: 0, view: null, think: Math.random() * 0.3, goneT: 0,
    };
    G.units.push(e); return e;
  }
  const hostile = (team, e) => e.team !== team;
  // a tower can be hit once the one in front of it in its lane is down; the core once any lane's last tower is down
  const vulnerable = e => { const s = G.structs[e.team]; return e.kind === 'tower' ? (e.tier === 1 || !s.lanes[e.lane][e.tier - 2].alive) : e.kind === 'core' ? s.lanes.some(L => !L[L.length - 1].alive) : true; };
  const valid = (t, team) => t && t.alive && (!isStruct(t) || vulnerable(t));
  const canSee = (who, t) => !t.hid || t.team === who.team;          // in the brush and unseen by the other side
  const speedOf = e => e.ms * (e.slowT > 0 ? 1 - e.slowPct : 1) * (e.hasteT > 0 ? 1 + e.hasteMs : 1);
  const pasAs = e => (e.kind !== 'hero' ? 0 : e.def.id === 'berserker' ? (1 - e.hp / e.maxHp) * 0.6 : e.def.id === 'archer' ? e.pStack * 0.06 : 0);
  const asOf = e => (e.hasteT > 0 ? 1 + e.hasteAs : 1) + (e.itemAs || 0) + pasAs(e);
  const frontStruct = (team, lane = 0) => { const s = G.structs[team]; for (const t of s.lanes[lane]) if (t.alive) return t; return s.core; };
  const near = (a, b) => Math.abs(a.x - G.focus.x) < 46 && Math.abs(a.z - G.focus.z) < 34;

  for (const team of [FROST, EMBER]) {
    const mk = td => {
      const tier = td.tier, tw = unit('tower', team, td.x, td.z, { r: 2.5, h: 12.3, hp: T.towerHp * (tier === 3 ? 1.3 : tier === 2 ? 1.15 : 1), ad: T.towerAd, range: T.towerRange, period: T.towerPeriod, ranged: true });
      tw.tier = tier; tw.lane = td.lane; tw.s = td.s; tw.ramp = 0; tw.view = M.tower(team, td.x, td.z); tw.warn = fx.decalMesh(3, T.towerRange * 2 / 0.88, [1.6, 0.2, 0.1], 0.9); tw.warn.position.set(td.x, 0.09, td.z); tw.warn.visible = false; M.root.add(tw.warn); tw.beam = fx.beamMesh(); M.root.add(tw.beam);
      tw.name = LANES[td.lane].name + ['外', '内', '高地'][tier - 1] + '塔'; return tw;
    };
    const c = POS.core(team), core = unit('core', team, c.x, c.z, { r: 5.4, h: 12.5, hp: T.coreHp }); core.view = M.core(team, c.x, c.z); core.name = '阵眼';
    const list = TOWERS.filter(t => t.team === team).map(mk);
    G.structs[team] = { list, lanes: LANES.map((_, i) => list.filter(t => t.lane === i).sort((a, b) => a.tier - b.tier)), core };
    const f = POS.fountain(team); M.fountain(team, f.x, f.z);
  }

  const solids = [...G.structs[FROST].list, G.structs[FROST].core, ...G.structs[EMBER].list, G.structs[EMBER].core];

  function recalc(h) {
    const d = h.def, L = h.level - 1, tn = (MODE.heroTune && MODE.heroTune[d.id]) || {};
    let hp = (d.hp + d.hpG * L) * (tn.hp || 1), ad = (d.ad + d.adG * L) * (tn.ad || 1), ap = (d.ap + d.apG * L) * (tn.ap || 1), ms = d.ms, ls = 0, cdr = 0, mana = d.mana + d.manaG * L, as = 0, crit = 0, sv = 0, dr = 0, regen = 0, slowHit = null;
    for (const it of h.items) { hp += it.hp || 0; ad += it.ad || 0; ap += it.ap || 0; ms += it.ms || 0; ls += it.ls || 0; cdr += it.cdr || 0; mana += it.mana || 0; as += it.as || 0; crit += it.crit || 0; sv += it.sv || 0; dr += it.dr || 0; regen += it.regen || 0; if (it.slowHit) slowHit = it.slowHit; }
    if (d.id === 'qingya') ls += 0.12;                                 // 独行
    if (hp > h.maxHp) h.hp += hp - h.maxHp; if (mana > h.maxMana) h.mana += mana - h.maxMana;
    h.maxHp = hp; h.ad = ad; h.ap = ap; h.ms = ms; h.ls = ls; h.cdr = Math.min(cdr, 0.4); h.maxMana = mana; h.itemAs = as; h.critB = crit; h.sv = sv; h.dr = Math.min(dr, 0.3); h.regenB = regen; h.slowHit = slowHit; h.pow = tn.pow || 1;   // pow: this mode's multiplier on what the cultivator's moves put out
  }
  // ---- items: what a purchase would cost given what is already in the bag, and making it ----
  function planBuy(id, pool) { const it = ITEMS[id]; let cost = it.cost; if (it.parts) for (const pid of it.parts) { const k = pool.indexOf(pid); if (k >= 0) pool.splice(k, 1); else cost += planBuy(pid, pool); } return cost; }
  const priceOf = (h, id) => planBuy(id, h.items.map(x => x.id));
  const canShop = h => !h.alive || h.atHome;                         // fallen, or home and not yet stepped out: walking back in does not count, only 归宗 does   // 万宝阁 only trades at home, or with the fallen
  function buyItem(h, id) {   // returns '' on success, else the reason
    const it = ITEMS[id]; if (!it) return '没有这件物品';
    if (!canShop(h)) return MODE.noRecall ? '出过山门就不能买了 · 一路只有出山前和陨落时能买' : '出过山门就不能买了，走回来也不算 · 归宗（B）或陨落时再来';
    if (it.tier === 3 && h.items.some(x => x.id === id)) return '同一件法宝只能持有一件';
    const pool = h.items.map(x => x.id), cost = planBuy(id, pool);
    if (pool.length + 1 > 6) return '储物戒已满';
    if (h.gold < cost) return '灵石不足';
    h.gold -= cost; h.items = [...pool.map(k => ITEMS[k]), it]; recalc(h); return '';
  }
  function botWant(h) {       // what the next piece of the build costs from here; bots go home for it once they can pay
    const have = k => h.items.some(x => x.id === k);
    for (const id of [...h.def.build, ...ITEM_TIERS[2]]) { if (have(id)) continue; const miss = ITEMS[id].tier === 3 ? ITEMS[id].parts.find(q => !have(q)) : null, pool = h.items.map(x => x.id), cost = planBuy(miss || id, pool); return pool.length + 1 > 6 ? 1e9 : cost; }   // one 灵器 at a time
    return 1e9;
  }
  function botShop(h) {       // work toward the next 法宝 in the hero's build, buying the biggest step it can afford
    if (!canShop(h)) return;
    const have = k => h.items.some(x => x.id === k);
    const step = id => { if (ITEMS[id].tier === 3 && have(id)) return false; if (h.gold >= priceOf(h, id)) return buyItem(h, id) === ''; const parts = ITEMS[id].parts; if (parts) for (const pid of parts) if (!have(pid) && step(pid)) return true; return false; };
    for (const id of [...h.def.build, ...ITEM_TIERS[2]]) { if (have(id)) continue; step(id); return; }
  }
  // ---- ability ranks ----
  const rankOf = (h, i) => (i === 3 ? RANK.ult : RANK.basic);
  const canLearn = (h, i) => { const R = rankOf(h, i), r = h.ranks[i]; return h.sp > 0 && r < R.max && h.level >= R.lvl[r]; };
  function learn(h, i) {
    if (!canLearn(h, i)) return false; h.ranks[i]++; h.sp--;
    if (near(h)) { fx.ringWave(h.x, h.z, 6, h.fxCol, 0.45); fx.pillar(h.x, h.z, 1.2, 7, h.fxCol, 0.45); } if (h.isPlayer) audio.play('level');
    return true;
  }
  // the ability as it currently stands for this hero: cooldown and durations follow its rank
  function eff(h, i) {
    const s = h.def.skills[i], R = rankOf(h, i), r = Math.max(1, h.ranks[i]), top = r === R.max ? RANK.top : 1;
    const e = { ...s, cd: s.cd * R.cd[r - 1], rank: r, slow: s.slow ? [s.slow[0], s.slow[1] * top] : s.slow, stun: s.stun ? s.stun * top : s.stun, dur: s.dur && s.kind !== 'zone' && s.kind !== 'heal' ? s.dur * top : s.dur };
    if (i === 3) for (const q of h.ins) {                              // 感悟 only ever reshape the 绝招
      for (const k in q[2]) { if (k === 'dmg') e.dmgK = (e.dmgK || 1) * q[2][k]; else if (e[k] !== undefined) e[k] *= q[2][k]; }
      for (const k in q[3]) { if (k === 'slowT') { if (e.slow) e.slow = [e.slow[0], e.slow[1] + q[3][k]]; } else if (k === 'slowP') { if (e.slow) e.slow = [Math.min(0.8, e.slow[0] + q[3][k]), e.slow[1]]; } else e[k] = (e[k] || 0) + q[3][k]; }
      e.desc = (e.desc || s.desc) + `〔感悟 · ${q[0]}：${q[1]}〕`;
    }
    return e;
  }
  const N = MODE.team, slotZ = slot => (slot - (N - 1) / 2) * 2.8;
  function makeHero(defId, team, isPlayer, slot, lane = 0, laneOff = slotZ(slot)) {
    const d = HEROES[defId], sp = spawnAt(team, slotZ(slot));
    const h = unit('hero', team, sp.x, sp.z, { r: 0.95 + (d.size - 1.3) * 0.38, h: d.size * 3.55 + 0.35 + (d.tall || 0), hp: d.hp, ad: d.ad, range: d.range, period: d.period, wind: d.wind, ms: d.ms, ranged: d.ranged });
    Object.assign(h, { def: d, name: d.name, isPlayer, level: 1, xp: 0, gold: T.startGold, mana: d.mana, maxMana: d.mana, items: [], ranks: [0, 0, 0, 0], ins: [], insPend: [], sp: 1, cds: [0, 0, 0, 0], kills: 0, deaths: 0, assists: 0, respawnT: 0, order: null, dash: null, dmgLog: new Map(), ls: 0, cdr: 0, multi: 0, multiT: -99, pStack: 0, pT: 0, pCd: 0, pTgt: null, atHome: true, dealt: 0, earned: T.startGold, recallT: 0, recallFx: null, slot, ai: { state: 'lane', lane, castLock: 1.5 + Math.random() * 2, laneOff, ambushAt: 28 + Math.random() * 30, jungleAt: 45 + Math.random() * 30, shopAt: 0, sly: team === FROST || Math.random() < (diff.react > 1.5 ? 0.4 : 1), nose: team === FROST ? 0.7 : diff.react > 1.5 ? 0.35 : diff.react > 1 ? 0.7 : 1 } });
    const tg = TEAM_COL[team].glow, mix = [tg[0] * 0.38 + d.tint[0] * 0.62, tg[1] * 0.38 + d.tint[1] * 0.62, tg[2] * 0.38 + d.tint[2] * 0.62], mx = Math.max(mix[0], mix[1], mix[2]);
    h.fxCol = [mix[0] / mx, mix[1] / mx, mix[2] / mx]; h.lsBuff = 0;
    h.view = M.hero(d, team, isPlayer); recalc(h); h.hp = h.maxHp; h.mana = h.maxMana; G.heroes.push(h); return h;
  }
  const mine = opts.hero && HEROES[opts.hero] ? opts.hero : 'mage';
  const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  if (N === 3) {                                                     // 一路: three a side from the other eleven, nobody twice
    const rest = shuffle(HERO_ORDER.filter(k => k !== mine));
    const pickSide = (pool, n) => { // one front-liner per side when possible, then whoever is left
      const out = [], melee = pool.findIndex(k => !HEROES[k].ranged); if (melee >= 0) out.push(pool.splice(melee, 1)[0]);
      while (out.length < n) out.push(pool.shift()); return out;
    };
    const foes = pickSide(rest, 3), allies = HEROES[mine].ranged ? pickSide(rest, 2) : [rest.shift(), rest.shift()];
    [mine, ...allies].forEach((k, i) => { const h = makeHero(k, FROST, i === 0, i === 0 ? 1 : i === 1 ? 0 : 2); if (i === 0) G.player = h; });
    foes.forEach((k, i) => makeHero(k, EMBER, false, i));
  } else {                                                           // 三路: five positions a side; the two sides may field the same cultivator
    // Seats come from config. Whoever is fixed (the player, with or without a chosen seat) is placed first; the rest of the side
    // is filled seat by seat with someone who suits it and is not already on the team.
    const fits = i => HERO_ORDER.filter(k => SEAT_FIT[k].includes(i)).sort((x, y) => SEAT_FIT[x].indexOf(i) - SEAT_FIT[y].indexOf(i));
    const draft = (fixed, seat) => {
      const seats = SEATS.map(() => null), used = new Set();
      if (fixed) { const k = seat >= 0 && seat < SEATS.length ? seat : SEAT_FIT[fixed][0]; seats[k] = fixed; used.add(fixed); }
      SEATS.forEach((q, i) => { if (seats[i]) return; const pool = fits(i).filter(k => !used.has(k)), best = pool.filter(k => SEAT_FIT[k][0] === i); const c = shuffle(best.length ? best : pool)[0] || shuffle(HERO_ORDER.filter(k => !used.has(k)))[0]; seats[i] = c; used.add(c); });
      return seats;
    };
    const seatUp = (k, i, team, me) => { const h = makeHero(k, team, me, i, SEATS[i].lane, SEATS[i].off); h.seat = SEATS[i].pos; h.ai.home = SEATS[i].lane; h.ai.jungler = !!SEATS[i].jungle; h.ai.thinkAt = 6 + Math.random() * 2; h.ai.brain = makeBrain(h, SEAT_BIAS[SEATS[i].pos]); return h; };
    draft(mine, opts.seat ?? -1).forEach((k, i) => { const h = seatUp(k, i, FROST, k === mine); if (k === mine) G.player = h; });
    draft(null, -1).forEach((k, i) => seatUp(k, i, EMBER, false));
  }
  G.focus.x = G.player.x; G.focus.z = G.player.z;

  // ---------------- movement ----------------
  function collide(e, dx, dz, step) {
    const push = (o, rr) => {
      const ox = e.x - o.x, oz = e.z - o.z, d2 = ox * ox + oz * oz;
      if (d2 >= rr * rr) return;
      const d = Math.sqrt(d2) || 0.001, nx = ox / d, nz = oz / d;
      e.x = o.x + nx * rr; e.z = o.z + nz * rr;
      const tx = -nz, tz = nx, s = tx * dx + tz * dz >= 0 ? 1 : -1; // slide around
      e.x += tx * s * step * 0.7; e.z += tz * s * step * 0.7;
    };
    for (const o of W.obstacles) { if (Math.abs(o.x - e.x) < 5 && Math.abs(o.z - e.z) < 5) push(o, o.r + e.r * 0.8); }
    for (const o of solids) if (o.alive && o !== e && Math.abs(o.x - e.x) < 9 && Math.abs(o.z - e.z) < 9) push(o, o.r + e.r * 0.7);
    e.x = clamp(e.x, -MAP.hx + 1.5, MAP.hx - 1.5); e.z = clamp(e.z, -MAP.hz + 1.5, MAP.hz - 1.5);
  }
  function moveToward(e, tx, tz, dt) {
    let dx = tx - e.x, dz = tz - e.z; const d = Math.hypot(dx, dz); if (d < 1e-3) return;
    const sp = speedOf(e), step = Math.min(d, sp * dt); dx /= d; dz /= d;
    e.x += dx * step; e.z += dz * step; e.facing = angLerp(e.facing, Math.atan2(dz, dx), dt * 14); e.moving = true; e.curSpeed = sp;
    collide(e, dx, dz, step);
  }
  // ---------------- finding the way ----------------
  // Where the map has walls (三路's ridges and precincts), cultivators do not just walk at what they want. A graph of
  // waypoints — along the lanes, at the camps, the brush, the river, and just past the end of every ridge — is joined
  // wherever two points can see each other; when the straight walk is blocked, A* over that graph (Yuka) gives the turns.
  const blocked = (ax, az, bx, bz, pad = 1.05) => { const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1; for (const w of W.walls) { const t = clamp(((w.x - ax) * dx + (w.z - az) * dz) / L2, 0, 1), qx = ax + dx * t - w.x, qz = az + dz * t - w.z, rr = w.r + pad; if (qx * qx + qz * qz < rr * rr) return true; } return false; };
  const NAV = W.walls.length ? (() => {
    const pts = [...RIDGE_ENDS.map(p => ({ ...p })), ...CAMPS.map(c => ({ x: c.x, z: c.z })), ...BRUSH.map(b => ({ x: b.x, z: b.z })), POS.fountain(FROST), POS.fountain(EMBER), POS.core(FROST), POS.core(EMBER)];
    for (const L of LANES) { const n = Math.round((L.s1 - L.s0) / 10); for (let i = 0; i <= n; i++) pts.push(L.at(L.s0 + (L.s1 - L.s0) * i / n, 0)); }
    for (let i = 0; i <= 16; i++) pts.push(RIVER.at(i / 16, 0));
    const nodes = pts.filter(p => Math.abs(p.x) < MAP.hx - 1 && Math.abs(p.z) < MAP.hz - 1 && !W.walls.some(w => (p.x - w.x) ** 2 + (p.z - w.z) ** 2 < (w.r + 1.3) ** 2));
    const g = new Graph(); nodes.forEach((p, i) => g.addNode(new NavNode(i, new YVec(p.x, 0, p.z))));
    let edges = 0; for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) { const d = dist(nodes[i], nodes[j]); if (d < 36 && !blocked(nodes[i].x, nodes[i].z, nodes[j].x, nodes[j].z)) { g.addEdge(new NavEdge(i, j, d)); g.addEdge(new NavEdge(j, i, d)); edges++; } }
    const seen = (x, z) => { let best = -1, bd = 1e9; for (let i = 0; i < nodes.length; i++) { const d = (nodes[i].x - x) ** 2 + (nodes[i].z - z) ** 2; if (d < bd && !blocked(x, z, nodes[i].x, nodes[i].z, 0.6)) { bd = d; best = i; } } return best; };
    return { g, nodes, edges, seen };
  })() : null;
  G.nav = NAV;
  function route(x, z, tx, tz) {                                       // the waypoints to walk, or null when the way is clear
    if (!blocked(x, z, tx, tz)) return null;
    const a = NAV.seen(x, z), b = NAV.seen(tx, tz); if (a < 0 || b < 0) return null;
    const s = new AStar(NAV.g, a, b); s.search(); const path = s.found ? s.getPath().map(i => NAV.nodes[i]) : [NAV.nodes[a]];
    path.push({ x: tx, z: tz }); return path;
  }
  function go(h, tx, tz, dt) {
    if (!NAV || h.kind !== 'hero') return moveToward(h, tx, tz, dt);
    const n = h.nav || (h.nav = { tx: 1e9, tz: 0, path: null, i: 0, t: 0 });
    if (Math.abs(tx - n.tx) + Math.abs(tz - n.tz) > 3 || G.t > n.t) { n.tx = tx; n.tz = tz; n.t = G.t + 0.7; n.path = route(h.x, h.z, tx, tz); n.i = 0; }
    if (!n.path) return moveToward(h, tx, tz, dt);
    while (n.i < n.path.length - 1 && (dist2(h.x, h.z, n.path[n.i].x, n.path[n.i].z) < 1.8 || !blocked(h.x, h.z, n.path[n.i + 1].x, n.path[n.i + 1].z))) n.i++;   // cut the corner as soon as the next one is in view
    moveToward(h, n.path[n.i].x, n.path[n.i].z, dt);
  }
  // returns true while in range (attacking), false if the unit needs to close in
  function tryAttack(e, dt) {
    const t = e.target, d = dist(e, t) - t.r;
    if (d > e.range + (e.windT >= 0 ? 1.5 : 0)) { e.windT = -1; return false; }
    e.facing = angLerp(e.facing, Math.atan2(t.z - e.z, t.x - e.x), dt * 16);
    if (e.windT < 0 && e.atkT <= 0) { e.windT = e.wind; e.animAtk = 1; }
    return true;
  }
  function strike(e) {
    const t = e.target; if (!t || !t.alive || dist(e, t) - t.r > e.range + 2.5) return;
    const col = e.fxCol || TEAM_COL[e.team].glow, hero = e.kind === 'hero', crit = hero && Math.random() < 0.18 + (e.critB || 0);
    let dmg = e.ad * (crit ? 1.6 : 1) * (hero && e.hasteT > 0 && e.hasteAd ? 1 + e.hasteAd : 1), slow = null, boom = false, fat = 1;
    e.revealT = 1.2; e.veilT = 0;                                      // swinging gives you away
    if (hero) {                                                        // passives that ride on basic attacks
      const id = e.def.id;
      if (id === 'ranger') { if (e.pStack) { e.pStack = 0; dmg *= 1.35; slow = [0.3, 1.2]; fat = 1.5; if (e.cds[0] > 0) e.cds[0] = Math.max(0, e.cds[0] - 1.2); } }   // 剑意相续: armed by any move
      else if (id === 'gunner') { e.pT = 6; if (++e.pStack >= 4) { e.pStack = 0; dmg *= 1.25; boom = true; fat = 1.6; } }
      else if (id === 'archer') { if (e.pTgt === t) e.pStack = Math.min(5, e.pStack + 1); else { e.pTgt = t; e.pStack = 1; } e.pT = 3; }
      else if (id === 'cryo') slow = [0.2, 1];
    }
    if (e.ranged) {
      const big = e.kind === 'tower', o = big ? 0 : 0.9;
      const heat = big && t.kind === 'hero' ? t.heat || 0 : 0, tc = heat ? [col[0] * (1 - heat * 0.15) + 1.0 * heat * 0.25, col[1] * (1 - heat * 0.2) + 0.25 * heat * 0.2, col[2] * (1 - heat * 0.22) + 0.08 * heat * 0.2] : col;
      shoot(e, e.x + Math.cos(e.facing) * o, big ? e.view.muzzleY : e.h * 0.58, e.z + Math.sin(e.facing) * o, { homing: t, speed: big ? 26 : 34, dmg: dmg * (1 + T.heatStep * heat), basic: true, crit, tower: big, slow, boom, emp: fat > 1 && !boom, color: tc, size: big ? 0.55 + heat * 0.1 : hero ? (crit ? 0.42 : 0.34) * fat : 0.2, long: hero ? 2.4 : 1, bright: big ? 4 + heat * 0.6 : hero ? 3.6 + (fat - 1) * 2 : 2.4 });
      if (big) audio.play('tower', e.x, e.z); else if (hero) audio.play(e.def.style === 'staff' ? 'cast' : e.def.style === 'gun' ? 'xbow' : e.def.id === 'ranger' ? 'sword' : e.def.id === 'archer' ? 'fire' : 'bow', e.x, e.z, e.def.id === 'ranger' ? 0.6 : 1);
    } else { damage(e, t, dmg, { basic: true, crit }); if (slow) applySlow(t, slow); }
    if (near(e)) V.basic(e, t, col, crit);
  }
  function tickAttack(e, dt) {
    const k = dt * asOf(e);
    e.atkT -= k;
    if (e.windT >= 0) { e.windT -= k; if (e.windT < 0) { strike(e); e.atkT = e.period - e.wind; } }
  }

  // ---------------- damage, death, rewards ----------------
  function heal(e, amt) { if (e.alive) e.hp = Math.min(e.maxHp, e.hp + amt); }
  function giveGold(h, g, show) { h.gold += g; h.earned += g; if (show && h.isPlayer) { fx.text(show.x, show.h + 0.4, show.z, '+' + Math.round(g), 'gold'); audio.play('coin'); } }
  function addXp(h, x) {
    if (h.level >= T.maxLevel) return;
    h.xp += x;
    while (h.level < T.maxLevel && h.xp >= T.xpNeed(h.level)) {
      h.xp -= T.xpNeed(h.level); h.level++; if (h.ranks[0] + h.ranks[1] + h.ranks[2] + h.ranks[3] + h.sp < 12) h.sp++; recalc(h);
      if (h.level === 5 || h.level === 9) { tribulation(h, h.level === 9); say(h, 'up'); }
      { const t = INSIGHT_LVL.indexOf(h.level); if (t >= 0) { h.insPend.push(t); if (!h.isPlayer || G.autoPlay) takeInsight(h, pickInsight(h)); } }
      if (h.alive && near(h)) { fx.ringWave(h.x, h.z, 7, GOLD, 0.6); fx.burst(h.x, 1.5, h.z, GOLD, { n: 18, speed: 3, up: 9, life: 0.8, size: 0.5, grav: 4 }); }
      if (h.isPlayer) { fx.pillar(h.x, h.z, 1.6, 9, GOLD, 0.6); fx.text(h.x, h.h + 1.4, h.z, '突破 · ' + realmOf(h.level), 'level'); audio.play('level'); if (h.level === 4) ui.announce('筑基巅峰 · 可以领悟绝招了', 'good'); else if (h.level === 5) ui.announce('结丹 · 雷劫将至', 'good'); else if (h.level === 8) ui.announce('金丹巅峰 · 绝招可至小成', 'good'); else if (h.level === 9) ui.announce('碎丹成婴 · 雷劫将至', 'good'); else if (h.level === 12) ui.announce('元婴巅峰 · 绝招可至大成', 'good'); }
    }
  }
  // 雷劫. Breaking through to 金丹 or 元婴 roots you for a breath inside a ward while the sky gathers, then lightning falls
  // around you: enemies caught in it are hurt and held. Everyone can see it coming.
  // 雷劫: first ten breaths under a closing sky in which the one crossing may still move and pick their ground; then the bolts, one wave a
  // second (结丹 five, 成婴 nine), the one crossing held for all of it and given 罡气. Every wave aims at every cultivator within a screen
  // of them — friend, foe, the one crossing — each with a closing ring; standing together, a wave still strikes each person once only.
  // A wave is worth 罡气 ÷ waves, so the nine (or five) together come exactly to the 罡气: crossing alone cannot kill.
  const TRIB = { prep: 10, every: 1.0, warn: 0.9, r: 2.8, reach: 24, small: { bolts: 5, part: 1 / 3 }, big: { bolts: 9, part: 2 / 3 } };
  function tribulation(h, big = h.tribBig) {
    if (!h.alive || h.dash) { h.tribDue = true; h.tribBig = big; return; }
    h.tribDue = false; const K = big ? TRIB.big : TRIB.small;
    const q = { h, big, t: 0, live: false, n: 0, bolts: K.bolts, part: K.part, dur: TRIB.prep + K.bolts * TRIB.every + 0.4 }; G.tribs.push(q); h.tribQ = q;
    if (h.isPlayer) ui.toast(`十息后落雷，${big ? '九' : '五'}道：趁现在找个地方站好`);
    else if (dist(h, G.player) < 30) ui.toast(`${h.name}要渡雷劫了，离远些`);
  }
  function startBolts(q) {
    const h = q.h; q.live = true; q.x = h.x; q.z = h.z; h.tribQ = null; q.dmg = h.maxHp * q.part / q.bolts;
    stopRecall(h); h.stunT = Math.max(h.stunT, q.bolts * TRIB.every); h.windT = -1; h.order = null; h.dash = null;
    h.shield = Math.max(h.shield, h.maxHp * q.part); h.shieldT = q.bolts * TRIB.every + 1.5;
    if (near(h)) V.tribStart(h); if (h.isPlayer) ui.announce(q.big ? '九道天雷' : '五道天雷', 'bad');
  }
  function updateTribs(dt) {
    let k = 0;
    for (let i = G.tribs.length - 1; i >= 0; i--) {
      const q = G.tribs[i], h = q.h; q.t += dt;
      if (!q.live) {
        if (q.t < TRIB.prep) { q.x = h.x; q.z = h.z; }
        else if (!h.alive || h.dash) q.t = TRIB.prep;                  // the sky waits for them
        else { startBolts(q); q.next = TRIB.prep; }
      }
      while (q.live && q.n < q.bolts && q.t >= q.next) {              // a wave: one ring on each cultivator within a screen
        const wave = new Set();
        for (const e of G.heroes) if (e.alive && dist2(e.x, e.z, q.x, q.z) < TRIB.reach) {
          const a = Math.random() * 6.283, d = e === h ? 0 : Math.random() * 1.2, bx = e.x + Math.cos(a) * d, bz = e.z + Math.sin(a) * d;
          G.bolts.push({ x: bx, z: bz, t: 0, dmg: q.dmg, wave }); if (near({ x: bx, z: bz })) V.tribWarn(bx, bz, TRIB.r, TRIB.warn);
        }
        q.n++; q.next += TRIB.every;
      }
      if (q.t >= q.dur) { G.tribs.splice(i, 1); if (h.tribQ === q) h.tribQ = null; continue; }
      const d = dist2(q.x, q.z, G.focus.x ?? q.x, G.focus.z ?? q.z); if (d < 34) k = Math.max(k, Math.min(1, q.t / 1.2, (q.dur - q.t) / 1.5) * (d < 22 ? 1 : (34 - d) / 12));
    }
    G.tribK = k;                                                       // how much of the sky and the camera it takes (main.js)
    for (let i = G.bolts.length - 1; i >= 0; i--) {
      const b = G.bolts[i]; if ((b.t += dt) < TRIB.warn) continue; G.bolts.splice(i, 1);
      for (const e of G.units) if (e.alive && !isStruct(e) && !b.wave.has(e) && dist2(e.x, e.z, b.x, b.z) <= TRIB.r + e.r) { b.wave.add(e); damage(null, e, b.dmg * (e.kind === 'hero' ? 1 : 0.6), { ability: true }); if (e.isPlayer) ui.buzz(50); }
      if (near(b)) V.tribBolt(b.x, b.z, TRIB.r);
    }
  }
  function shareXp(team, src, xp) {
    const hs = G.heroes.filter(h => h.team === team && h.alive && dist(h, src) < 19);
    const k = [0, 1, 0.72, 0.56][hs.length] || 0; for (const h of hs) addXp(h, xp * k);
  }
  function damage(src, tgt, amt, o = {}) {
    if (!tgt.alive || G.over) return 0;
    if (isStruct(tgt) && (!vulnerable(tgt) || o.ability)) return 0;
    if (src) {
      if (src.kind === 'hero') { if (G.buffT[src.team] > 0) amt *= 1.15; if (!src.isPlayer && src.team === EMBER) amt *= diff.enemy; if ((!src.isPlayer || mirror) && src.team === FROST) amt *= 0.96; }
      if (src.kind === 'minion' && tgt.kind === 'hero') amt *= 0.5;
      if (src.kind === 'hero' && tgt.kind === 'hero') amt *= 0.75 * (1 - (tgt.dr || 0));      // duels last longer than wave clear
      if (src.kind === 'tower' && tgt.kind === 'hero') amt *= 0.85;
      if (src.kind === 'minion' && isStruct(tgt)) amt *= 0.5;
      if (src.kind === 'hero' && isStruct(tgt)) { let escort = false; for (const u of G.units) if (u.alive && u.kind === 'minion' && u.team === src.team && dist(u, tgt) < 14) { escort = true; break; } amt *= escort ? 0.75 : 0.3; }
      if (src.kind === 'hero' && !isStruct(tgt)) { const id = src.def.id; if (id === 'shade' && tgt.hp < tgt.maxHp * 0.4) amt *= 1.25; else if (id === 'cryo' && (tgt.slowT > 0 || tgt.stunT > 0)) amt *= 1.12;
        else if (tgt.kind === 'neutral' && (id === 'qingya' || id === 'wenren')) amt *= id === 'qingya' ? 1.4 : 1.35;             // 独行 / 走火入魔
        else if (id === 'linshuang' && o.basic && dist(src, tgt) > 7) amt *= 1.18;                                               // 霜弦: from far away
        if (id === 'peiji' && o.ability) tgt.lawT = G.t + 3; }                                                                   // 铁律
      src.combatT = 0;
    }
    if (tgt.lawT > G.t) amt *= 1.07; if (tgt.vulnT > G.t) amt *= 1 + tgt.vulnK;
    if (tgt.kind === 'hero' && src && src.kind === 'hero') for (const a of G.heroes) if (a.alive && a.team === tgt.team && a.def.id === 'yanzhao' && dist(a, tgt) < 9) { amt *= 0.92; break; }   // 蔽目之体
    if (tgt.hasteT > 0 && tgt.hasteDr) amt *= 1 - tgt.hasteDr;
    if (tgt.kind === 'hero' && tgt.def.id === 'berserker') amt *= 1 - 0.22 * (1 - tgt.hp / tgt.maxHp);
    if (tgt.kind === 'hero' && tgt.def.id === 'warden') { amt *= 1 - 0.04 * tgt.pStack; if (src && src.kind !== 'minion') { tgt.pStack = Math.min(5, tgt.pStack + 1); tgt.pT = 4; } }
    if (amt > 0) { if (tgt.recallT > 0) stopRecall(tgt); if (src) tgt.revealT = Math.max(tgt.revealT, 1); }
    if (tgt.shield > 0) { const a = Math.min(tgt.shield, amt); tgt.shield -= a; amt -= a; }
    tgt.hp -= amt; tgt.flash = 1; tgt.combatT = 0;
    if (tgt.kind === 'hero' && tgt.hp > 0 && tgt.hp < tgt.maxHp * 0.3 && !(tgt.yinT > G.t)) {            // 余荫: 陆玄机 steps in for an ally in trouble
      const y = G.heroes.find(a => a.alive && a.team === tgt.team && a.def.id === 'yuanshan' && dist(a, tgt) < 11);
      if (y) { tgt.yinT = G.t + 30; tgt.shield = Math.max(tgt.shield, tgt.maxHp * 0.18); tgt.shieldT = 4; if (near(tgt)) { fx.ringWave(tgt.x, tgt.z, 8, y.fxCol, 0.5); fx.line(y.x, y.h * 0.7, y.z, tgt.x, tgt.h * 0.6, tgt.z, y.fxCol, 8, 0.4, 0.3); audio.play('shield', tgt.x, tgt.z); } }
    }
    if (tgt.kind === 'hero' && tgt.def.id === 'keeper' && tgt.hp > 0 && tgt.hp < tgt.maxHp * 0.4 && tgt.pCd <= 0) {   // 守门: a shield when it matters
      tgt.pCd = 45; tgt.shield = Math.max(tgt.shield, tgt.maxHp * 0.16); tgt.shieldT = 4; audio.play('shield', tgt.x, tgt.z);
      if (near(tgt)) { fx.ringWave(tgt.x, tgt.z, 9, tgt.fxCol, 0.5); if (tgt.isPlayer) fx.text(tgt.x, tgt.h + 1.4, tgt.z, '守门', 'heal'); }
    }
    if (src && amt > 0) {   // the blow is felt: flinch away from it, get shoved a little, and the attacker's world stops for a beat
      const hx = tgt.x - src.x, hz = tgt.z - src.z, hd = Math.hypot(hx, hz) || 1; tgt.hitK = 1; tgt.hitX = hx / hd; tgt.hitZ = hz / hd;
      if (o.basic && !isStruct(tgt)) { const kb = (tgt.kind === 'hero' ? 0.18 : 0.42) * (o.crit ? 1.8 : 1); tgt.x += tgt.hitX * kb; tgt.z += tgt.hitZ * kb; }
      if (o.basic && src.isPlayer) { fx.hitStop(o.crit ? 0.075 : 0.038); fx.shake(o.crit ? 0.34 : 0.14); fx.punch(o.crit ? 0.24 : 0.08); }
      else if (tgt.isPlayer && amt > tgt.maxHp * 0.05) fx.shake(0.2);
    }
    if (src && src.kind === 'hero') {
      if (tgt.kind === 'hero') { src.dealt += amt; tgt.dmgLog.set(src, G.t); for (const tw of G.structs[tgt.team].list) { if (tw.alive && dist(tw, src) <= tw.range + src.r && (!tw.target || tw.target.kind !== 'hero')) { tw.target = src; tw.atkT = Math.max(tw.atkT, 0.3); if (src.isPlayer) { ui.toast('你在塔下攻击了敌方修士 · 灵塔转火'); audio.play('horn'); } } } }
      if (tgt.kind === 'neutral') for (const u of tgt.camp.units) if (u.alive && !u.aggro) u.aggro = src;
      if (o.basic) { const ls = src.ls + (src.hasteT > 0 ? src.lsBuff || 0 : 0); if (ls > 0) heal(src, amt * ls); if (src.slowHit) applySlow(tgt, src.slowHit); }
      else if (o.ability && src.sv > 0) heal(src, amt * src.sv * (tgt.kind === 'hero' ? 1 : 0.35));
      if (o.ability) {
        const id = src.def.id;
        if (id === 'mage' && tgt.kind === 'hero' && src.pCd <= 0) { src.pCd = 0.6; src.mana = Math.min(src.maxMana, src.mana + src.maxMana * 0.05); for (let i = 0; i < 4; i++) if (src.cds[i] > 0.6) src.cds[i] -= 0.6; if (near(src)) V.insight(src, tgt); }
        else if (id === 'storm' && !isStruct(tgt) && tgt.hp > 0 && !(tgt.markCd > G.t)) {     // 雷印: three marks, then the sky answers
          tgt.markCol = src.fxCol; tgt.markCd = G.t + 0.7; tgt.marks = (tgt.markT > G.t ? tgt.marks : 0) + 1; tgt.markT = G.t + 6;
          if (near(tgt)) fx.line(tgt.x, tgt.h + 3.5, tgt.z, tgt.x, tgt.h * 0.5, tgt.z, src.fxCol, 6, 0.45, 0.22);
          if (tgt.marks >= 3) {
            tgt.marks = 0; tgt.markCd = G.t + 3.2; applyStun(tgt, 0.5);          // and a while before the next mark will take
            if (near(tgt)) { fx.pillar(tgt.x, tgt.z, 1.1, 10, src.fxCol, 0.35); fx.ringWave(tgt.x, tgt.z, 7, src.fxCol, 0.4); audio.play('zap', tgt.x, tgt.z); }
            damage(src, tgt, 30 + tgt.maxHp * (tgt.kind === 'hero' ? 0.06 : 0.12), { proc: true });
          }
        }
      }
      if (o.drain) { const got = amt * o.drain * (tgt.kind === 'hero' ? 1 : 0.35); heal(src, got); if (near(src) && got > 4) fx.line(tgt.x, 1.6, tgt.z, src.x, 1.8, src.z, [1.6, 0.1, 0.12], 8, 0.4, 0.3); }
    }
    if (amt > 0.5 && ((src && src.isPlayer) || tgt.isPlayer)) fx.text(tgt.x, tgt.h + 0.5, tgt.z, Math.round(amt) + (o.crit ? '!' : ''), tgt.isPlayer ? 'hurt' : o.crit ? 'crit' : o.ability ? 'magic' : 'hit');
    if (tgt.isPlayer) G.hurtFlash = Math.min(1, (G.hurtFlash || 0) + amt / tgt.maxHp * 2.5);
    if (tgt.hp <= 0 && tgt.alive) kill(tgt, src);
    return amt;
  }
  function kill(tgt, src) {
    tgt.alive = false; tgt.hp = 0; tgt.target = null; tgt.windT = -1; tgt.dash = null; tgt.y = 0; tgt.moving = false; tgt.goneT = 0;
    const col = TEAM_COL[tgt.team].glow, killer = src && src.kind === 'hero' ? src : null;
    if (tgt.recallT > 0) stopRecall(tgt, true);
    if (!isStruct(tgt)) for (const b of G.heroes) if (b.alive && b.def.id === 'bloodlord' && b.team !== tgt.team && dist(b, tgt) < 11) {   // 血炼
      heal(b, b.maxHp * (tgt.kind === 'hero' ? 0.14 : 0.035)); if (near(b)) fx.line(tgt.x, 1.4, tgt.z, b.x, 1.8, b.z, [1.6, 0.1, 0.12], 8, 0.4, 0.3);
    }
    if (tgt.kind === 'minion' || tgt.kind === 'neutral') {
      const s = tgt.stats; if (near(tgt)) { fx.dust(tgt.x, tgt.z, DUST, { n: tgt.kind === 'neutral' ? 12 : 5, speed: 3, size: tgt.kind === 'neutral' ? 2.4 : 1.5, life: 0.9 }); fx.burst(tgt.x, 1, tgt.z, col, { n: 5, speed: 5, life: 0.45, size: 0.26 }); }
      if (killer) giveGold(killer, s.gold, tgt);
      if (killer && tgt.kind === 'neutral' && killer.def.id === 'qingya') heal(killer, killer.maxHp * 0.04);
      if (killer && killer.isPlayer) { if (tgt.nk && tgt.nk !== 'golem') { fx.slowmo(0.6, 0.28); fx.punch(0.4); } else { fx.hitStop(0.05); fx.punch(0.14); } }   // the last blow is felt
      if (tgt.kind === 'minion') shareXp(1 - tgt.team, tgt, s.xp);
      else if (src && src.team !== NEUTRAL) {
        shareXp(src.team, tgt, s.xp);
        const ours = src.team === G.player.team, cls = ours ? 'good' : 'bad', who = ours ? '我方' : '敌方';
        if (tgt.nk === 'guardian') {
          G.buffT[src.team] = 70; for (const h of G.heroes) if (h.team === src.team) giveGold(h, 90);
          { const sp = G.heroes.find(h => h.team === src.team && h.alive && !h.isPlayer); if (sp) chat(sp, 'obj'); }
          ui.announce(`${who}镇压血海残魂 · 全队伤害提升`, cls); audio.play('horn'); fx.ringWave(tgt.x, tgt.z, 26, col, 0.9);
        } else if (tgt.nk === 'puppet' || tgt.nk === 'abyss') {       // 破阵 / 渊息: the side's next waves march much stronger
          const [k, secs] = T.surge[tgt.nk]; G.surgeT[src.team] = secs; G.surgeK[src.team] = k; for (const h of G.heroes) if (h.team === src.team) giveGold(h, tgt.stats.gold);
          if (tgt.nk === 'abyss') G.buffT[src.team] = secs;
          ui.announce(tgt.nk === 'abyss' ? `${who}镇压渊主残念 · 弟子大幅强化` : `${who}镇压镇渊傀 · 弟子强化`, cls); audio.play('horn'); fx.ringWave(tgt.x, tgt.z, 26, col, 0.9);
        }
        if (tgt.camp.units.every(u => !u.alive)) tgt.camp.respawnT = s.respawn;
      }
    } else if (tgt.kind === 'hero') {
      const rec = []; for (const [h, t] of tgt.dmgLog) if (G.t - t < 10 && h !== killer) rec.push([h, t]);
      rec.sort((a, b) => b[1] - a[1]);
      const k = killer || (rec.length ? rec.shift()[0] : null);
      const ended = tgt.streak || 0, worth = clamp(1 + 0.14 * ended - 0.16 * (tgt.fallen || 0), 0.5, 1.8); tgt.streak = 0; tgt.fallen = (tgt.fallen || 0) + 1;
      if (near(tgt)) V.fall(tgt, tgt.team === FROST); if (tgt.isPlayer) ui.buzz(220); else if (k && k.isPlayer) ui.buzz([40, 50, 90]);
      tgt.deaths++; tgt.respawnT = (T.respawn(tgt.level) + G.t / 60 * 1.4) * T.respawnK * clamp(1 - (G.kills[1 - tgt.team] - G.kills[tgt.team]) * 0.035, 0.55, 1);   // the side that is losing the kill race comes back sooner
      tgt.order = null; tgt.dmgLog.clear(); tgt.shield = 0; tgt.slowT = tgt.stunT = tgt.hasteT = 0; tgt.veilT = 0; tgt.heat = 0;
      G.kills[1 - tgt.team]++;
      if (k) {
        const fair = clamp(0.35 + 0.65 * tgt.level / k.level, 0.4, 1.4) * worth; // less for stomping a weaker hero, more for an upset or ending a streak
        k.streak = (k.streak || 0) + 1; k.fallen = 0;
        chat(k, 'kill', false, { t: tgt.name }); chat(tgt, 'die');
        k.kills++; giveGold(k, T.killGold * fair + (G.firstBlood ? 0 : 100), tgt); addXp(k, (80 + 16 * tgt.level) * fair);
        k.multi = G.t - k.multiT < 10 ? k.multi + 1 : 1; k.multiT = G.t; k.bestMulti = Math.max(k.bestMulti || 0, k.multi); k.bestStreak = Math.max(k.bestStreak || 0, k.streak || 0); if (k.isPlayer && k.streak === 3) ui.toast('你连镇三人，对面盯上你了');
      }
      for (const [a] of rec) { const fair = clamp(0.35 + 0.65 * tgt.level / a.level, 0.4, 1.4) * worth; a.fallen = 0; a.assists++; giveGold(a, T.assistGold * fair); addXp(a, (40 + 8 * tgt.level) * fair); }
      say(tgt, 'die'); if (k) sayQ.push({ h: k, at: G.t + 1.3, chance: k.isPlayer ? 1 : 0.7 });
      for (const a of [k, ...rec.map(r => r[0])]) if (a && a.alive && a.def.id === 'wenren') a.cds[2] = 0;
      for (const a of [k, ...rec.map(r => r[0])]) if (a && a.alive && a.def.id === 'shade') { heal(a, a.maxHp * 0.2); if (near(a)) V.healed(a, a.fxCol); }   // 索命
      ui.feed(k, tgt, src);
      const good = tgt.team !== G.player.team;
      // what the sky announces: the first to fall, several at once, a run without falling, a run cut short
      const STREAK = [, , , '锋芒毕露', '气贯长虹', '道心通明', '万法不侵', '一人镇一宗'], cls = good ? 'good' : 'bad';
      if (!G.firstBlood) { G.firstBlood = true; ui.announce((k ? k.name + ' · ' : '') + '开锋', cls); }
      else if (G.heroes.every(h => h.team !== tgt.team || !h.alive)) ui.announce(good ? '敌方满门尽陨' : '我方满门尽陨', cls);
      else if (k && k.multi >= 3) ui.announce(k.name + ' · 三花聚顶', cls);
      else if (k && k.multi === 2) { ui.announce(k.name + ' · 一气双镇', cls); audio.play('star', undefined, undefined, 0.9); }
      else if (k && ended >= 3) ui.announce(`${k.name} 斩了 ${tgt.name} 的道 · 终结 ${ended} 连镇`, cls);
      else if (k && k.streak >= 3) { ui.announce(`${k.name} · ${STREAK[Math.min(7, k.streak)]}`, cls); audio.play('star', undefined, undefined, 0.9); }
      else if (tgt.isPlayer) ui.announce('你已陨落', 'bad'); else if (k && k.isPlayer) ui.announce('镇压 ' + tgt.name, 'good');
      fx.burst(tgt.x, 1.6, tgt.z, col, { n: 34, speed: 9, up: 9, life: 1.0, size: 0.32, grav: 14 }); fx.ringWave(tgt.x, tgt.z, 10, col, 0.6); fx.dust(tgt.x, tgt.z, DUST, { n: 12, speed: 4, size: 2.4, life: 1.3 }); fx.flash(tgt.x, 2.5, tgt.z, col, 260, 0.5);
      audio.play(tgt.isPlayer ? 'death' : 'kill', tgt.x, tgt.z); if (near(tgt)) fx.shake(0.35);
      if (k && k.isPlayer) { fx.slowmo(0.65, 0.2); fx.punch(0.55); } else if (tgt.isPlayer) fx.slowmo(0.8, 0.3); else if (near(tgt) && rec.some(r => r[0].isPlayer)) fx.slowmo(0.4, 0.4);
    } else {
      const good = tgt.team !== G.player.team;
      fx.explosion(tgt.x, tgt.z, tgt.kind === 'core' ? 3 : 2.1, FLAME); for (let i = 0; i < 4; i++) fx.burst(tgt.x, 3 + i * 2, tgt.z, col, { n: 26, speed: 12, up: 10, life: 1.2, size: 0.4, spread: 2, grav: 16 });
      fx.ringWave(tgt.x, tgt.z, 30, col, 0.9); fx.ringWave(tgt.x, tgt.z, 18, WHITE, 0.5); fx.shake(tgt.kind === 'core' ? 1.2 : 0.7); audio.play('boom', tgt.x, tgt.z); if (near(tgt)) fx.slowmo(tgt.kind === 'core' ? 1.3 : 0.7, 0.28);
      if (tgt.kind === 'tower') {
        tgt.warn.visible = false; tgt.beam.visible = false;
      for (const h of G.heroes) if (h.team !== tgt.team) { giveGold(h, T.towerGold, h.isPlayer ? tgt : null); addXp(h, 90); }
        ui.announce(good ? '敌方灵塔已被摧毁' : '我方灵塔被摧毁', good ? 'good' : 'bad'); audio.play('horn');
        { const sp = G.heroes.find(h => h.team === G.player.team && h.alive && !h.isPlayer); if (sp) chat(sp, good ? 'towerUp' : 'towerDown'); }
      } else { G.over = true; G.winner = 1 - tgt.team; G.overT = 0; fx.slowmo(2.2, 0.22); fx.shake(0.9); ui.buzz([60, 60, 200]); G.focus.tx = tgt.x; G.focus.tz = tgt.z; }
    }
  }
  const applySlow = (e, s) => { if (s && e.alive && !isStruct(e)) { e.slowT = Math.max(e.slowT, s[1]); e.slowPct = Math.max(e.slowT > 0 ? e.slowPct : 0, s[0]); } };
  const applyStun = (e, t) => { if (t && e.alive && !isStruct(e)) { if (e.isPlayer && e.stunT <= 0) ui.buzz(70); e.stunT = Math.max(e.stunT, t); e.windT = -1; } };
  function eachEnemy(team, x, z, r, fn) {
    for (const e of G.units) { if (!e.alive || e.team === team || isStruct(e)) continue; if (dist2(e.x, e.z, x, z) <= r + e.r) fn(e); }
  }

  // ---------------- projectiles & zones ----------------
  function shoot(src, x, y, z, o) {
    const c = o.color, k = o.bright || 3;
    const bolt = near(src) ? fx.bolt([c[0] * k, c[1] * k, c[2] * k], o.size, o.size, o.size * (o.long || 1)) : null;
    const glow = bolt ? fx.decal({ mode: 0, x, z, size: o.size * 9 + 2, color: c, dur: 99, manual: true, alpha: 0.45 }) : null;
    const lamp = bolt && !o.basic ? fx.lamp(c, 80) : null;
    G.proj.push({ src, team: src.team, x, y, z, left: o.range || 99, hit: o.pierce ? new Set() : null, bolt, glow, lamp, spin: Math.random() * 6, ...o });
  }
  function endProj(p, i, pop) {
    fx.freeBolt(p.bolt); fx.release(p.glow); fx.freeLamp(p.lamp); G.proj.splice(i, 1);
    if (pop && near(p)) fx.burst(p.x, p.y, p.z, p.color, { n: pop, speed: 5, life: 0.3, size: 0.3 });
  }
  function updateProj(dt) {
    for (let i = G.proj.length - 1; i >= 0; i--) {
      const p = G.proj[i], step = p.speed * dt;
      if (p.homing) {
        const t = p.homing; if (!t.alive) { endProj(p, i, 3); continue; }
        const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
        if (d <= step + t.r * 0.6) { damage(p.src, t, p.dmg, { basic: p.basic, crit: p.crit }); if (p.slow) applySlow(t, p.slow); if (p.emp && near(t)) V.empowered(t, p.color); if (p.boom) { eachEnemy(p.team, t.x, t.z, 3.4, o => { if (o !== t) damage(p.src, o, p.dmg * 0.6, { ability: true }); }); if (near(t)) { fx.explosion(t.x, t.z, 0.75, FLAME); audio.play('boom', t.x, t.z); } } if (p.tower && t.kind === 'hero' && t.alive) { t.heat = Math.min(T.heatMax, (t.heat || 0) + 1); t.heatT = T.heatHold; if (t.isPlayer) fx.text(t.x, t.h + 1.4, t.z, '下一发塔伤 ×' + (1 + T.heatStep * t.heat).toFixed(1), 'hurt'); } if (near(t)) V.basicHit(t, p.dx || 0, p.dz || 0, p.color, p.src.kind === 'tower' ? 2 : p.src.kind === 'hero' ? 1 : 0, p.crit); endProj(p, i, 0); continue; }
        p.x += dx / d * step; p.z += dz / d * step; p.y += (t.h * 0.55 - p.y) * Math.min(1, step / d); p.dx = dx / d; p.dz = dz / d;
      } else {
        if (p.returning) { const c = p.src, qx = c.x - p.x, qz = c.z - p.z, qd = Math.hypot(qx, qz) || 1; if (qd < 1.5 || !c.alive) { endProj(p, i, 0); continue; } p.dx = qx / qd; p.dz = qz / qd; }   // on its way back to the hand
        p.x += p.dx * step; p.z += p.dz * step; p.left -= step;
        let dead = false;
        for (const e of G.units) {
          if (!e.alive || e.team === p.team || isStruct(e) || (p.heroOnly && e.kind !== 'hero') || dist2(e.x, e.z, p.x, p.z) > p.width + e.r) continue;
          if (p.hit) { if (p.hit.has(e)) continue; p.hit.add(e); }
          damage(p.src, e, p.dmg * (p.exec && e.kind === 'hero' ? 1 + (1 - e.hp / e.maxHp) * p.exec : 1), { ability: true }); applySlow(e, p.slow); applyStun(e, p.stun);
          if (p.pull === 'self' && e.alive && p.src.alive) { const c = p.src, qx = c.x - e.x, qz = c.z - e.z, qd = Math.hypot(qx, qz) || 1, gap = c.r + e.r + 0.4; c.knock = { sx: c.x, sz: c.z, tx: e.x + qx / qd * gap, tz: e.z + qz / qd * gap, t: 0, dur: Math.min(0.4, 0.1 + qd / 40) }; c.dash = null; applyStun(e, (p.stun || 0) + (T.selfPullStun || 0)); if (c.kind === 'hero' && !c.isPlayer) c.order = { type: 'attack', target: e }; }   // the line hauls its owner in
          else if (p.pull && e.alive && p.src.alive) { const c = p.src, qx = e.x - c.x, qz = e.z - c.z, qd = Math.hypot(qx, qz) || 1, gap = c.r + e.r + 0.5; e.knock = { sx: e.x, sz: e.z, tx: c.x + qx / qd * gap, tz: c.z + qz / qd * gap, t: 0, dur: 0.32 }; applyStun(e, 0.32 + (p.stun || 0)); e.dash = null; }
          if (near(e)) V.projHit(p, e);
          if (!p.hit) {
            if (p.splash) { eachEnemy(p.team, p.x, p.z, p.splash, o => { if (o !== e) { damage(p.src, o, p.dmg * 0.6, { ability: true }); applyStun(o, p.stun); } }); if (near(p)) V.projBurst(p); }
            dead = true; break;
          }
        }
        if (!dead && p.left <= 0 && p.back && !p.returning) { p.returning = true; p.hit = new Set(); p.left = 99; p.dmg *= p.back; if (near(p)) V.turn(p); }   // 回燕 turns round
        else if (dead || p.left <= 0) { endProj(p, i, dead ? 0 : 4); continue; }
      }
      if (p.bolt) {
        p.bolt.m.position.set(p.x, p.y, p.z); p.bolt.m.rotation.y = Math.atan2(p.dx || 0, p.dz || 1);
        p.glow.m.position.set(p.x, 0.08, p.z); if (p.lamp) p.lamp.l.position.set(p.x, p.y + 0.6, p.z);
        V.projTick(p, dt);
      }
    }
  }
  function addZone(h, x, z, s, dmg) {
    V.telegraph(x, z, s.radius, s.delay || 0.01, (s.dur || 0) + 0.05, h.team === G.player.team, s.kind === 'heal');
    G.zones.push({ src: h, team: h.team, x, z, r: s.radius, t: 0, delay: s.delay || 0, dur: s.dur || 0, tick: s.tick || 0, next: s.delay || 0, s, dmg, sid: s.vfx, heal: s.kind === 'heal', col: h.fxCol });
  }
  function updateZones(dt) {
    for (let i = G.zones.length - 1; i >= 0; i--) {
      const z = G.zones[i]; z.t += dt; const vis = near(z);
      if (vis) V.zoneTick(z, dt);
      if (z.t >= z.next) {
        if (z.heal) { for (const a of G.heroes) if (a.alive && a.team === z.team && dist2(a.x, a.z, z.x, z.z) <= z.r + a.r) { heal(a, z.dmg); if (near(a)) { V.healed(a, z.col); if (a.isPlayer || z.src.isPlayer) fx.text(a.x, a.h + 0.5, a.z, '+' + Math.round(z.dmg), 'heal'); } } }
        else eachEnemy(z.team, z.x, z.z, z.r, e => { damage(z.src, e, z.dmg, { ability: true, drain: z.s.drain }); applySlow(e, z.s.slow); applyStun(e, z.s.stun); if (z.s.vuln && e.alive) { e.vulnK = z.s.vuln[0]; e.vulnT = G.t + z.s.vuln[1]; } });
        if (vis) V.zoneFire(z, close(z));
        if (z.tick && z.t < z.delay + z.dur - 0.01) z.next += z.tick; else G.zones.splice(i, 1);
      }
    }
  }

  // ---------------- abilities ----------------
  const skillDmg = (h, s, i) => ((s.b + s.l * (h.level - 1) * 0.5) * rankOf(h, i).dmg[Math.max(1, h.ranks[i]) - 1] + (s.ad || 0) * h.ad + (s.ap || 0) * h.ap) * (h.pow || 1) * (s.dmgK || 1);
  const canCast = (h, i) => { const s = h.def.skills[i]; return h.alive && !h.dash && h.stunT <= 0 && h.cds[i] <= 0 && h.mana >= s.mana && h.ranks[i] > 0 && !(h.tauntT > 0) && !G.over; };
  function cast(h, i, ax, az) {
    if (!canCast(h, i)) return false;
    const s = eff(h, i);
    let dx = ax - h.x, dz = az - h.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { dx = Math.cos(h.facing); dz = Math.sin(h.facing); d = 0.05; } else { dx /= d; dz /= d; }
    const col = h.fxCol, dmg = s.b !== undefined ? skillDmg(h, s, i) : 0, cd = Math.min(d, s.range || 0), tx = h.x + dx * cd, tz = h.z + dz * cd, ally = h.team === G.player.team;
    const A = { dx, dz, tx, tz, ally, ox: h.x, oz: h.z };
    let victim = null;
    if (s.kind === 'strike') { // needs an enemy hero: the one nearest the aim point, within reach
      let bd = 1e9; for (const e of G.heroes) { if (!e.alive || e.team === h.team || !canSee(h, e) || dist(h, e) > s.range + 1) continue; const q = dist2(e.x, e.z, ax, az); if (q < bd) { bd = q; victim = e; } }
      if (!victim) return false;
    }
    stopRecall(h); h.revealT = 1.5;
    h.mana -= s.mana; h.cds[i] = s.cd * (1 - h.cdr); if (h.def.id === 'ranger') { h.pStack = 1; h.pT = 4; }
    const selfCast = s.kind === 'shield' || s.kind === 'haste' || s.kind === 'nova' || s.kind === 'taunt' || ((s.kind === 'heal' || s.kind === 'zone') && !s.range);
    if (!selfCast) h.facing = Math.atan2(dz, dx);
    h.animCast = 1; h.windT = -1; h.veilT = 0;
    switch (s.kind) {
      case 'cone': {
        const half = s.angle * Math.PI / 360;
        eachEnemy(h.team, h.x, h.z, s.range, e => { let a = Math.atan2(e.z - h.z, e.x - h.x) - h.facing; a = Math.atan2(Math.sin(a), Math.cos(a)); if (Math.abs(a) <= half + 0.15) { damage(h, e, dmg, { ability: true, drain: s.drain }); applySlow(e, s.slow); applyStun(e, s.stun); } });
        break;
      }
      case 'nova':
        eachEnemy(h.team, h.x, h.z, s.radius, e => { damage(h, e, dmg, { ability: true }); applySlow(e, s.slow); applyStun(e, s.stun); if (s.pull && e.alive) { const qx = e.x - h.x, qz = e.z - h.z, qd = Math.hypot(qx, qz) || 1, gap = h.r + e.r + 0.6; if (qd > gap) e.knock = { sx: e.x, sz: e.z, tx: h.x + qx / qd * gap, tz: h.z + qz / qd * gap, t: 0, dur: 0.3 }; e.dash = null; } });   // pull: everyone in reach is hauled in
        if (s.hpR) { h.shield = Math.max(h.shield, h.maxHp * s.hpR); h.shieldT = 3.5; }
        break;
      case 'shield': for (const a of G.heroes) if (a.alive && a.team === h.team && (a === h || (s.aoe && dist(a, h) < s.aoe))) { a.shield = Math.max(a.shield, dmg + (a === h ? h.maxHp * (s.hpR || 0) : 0)); a.shieldT = s.dur; } break;
      case 'taunt': eachEnemy(h.team, h.x, h.z, s.radius, e => { e.tauntT = s.dur; e.taunter = h; e.windT = -1; }); h.shield = Math.max(h.shield, dmg + h.maxHp * (s.hpR || 0)); h.shieldT = s.dur + 2; break;
      case 'haste':                                                    // rng / adK: a stance rather than a sprint; aoe: handed to those nearby who have none running; veil: out of sight
        for (const a of G.heroes) { if (!a.alive || a.team !== h.team || (a !== h && !(s.aoe && dist(a, h) < s.aoe && a.hasteT <= 0))) continue; a.hasteT = s.dur; a.hasteMs = s.ms; a.hasteAs = s.as || 0; a.lsBuff = s.ls || 0; a.hasteDr = s.dr || 0; a.hasteRng = s.rng || 0; a.hasteAd = s.adK || 0; if (s.veil) { a.veilT = s.dur; a.revealT = 0; } if (s.b !== undefined) { heal(a, dmg); if (a.isPlayer || h.isPlayer) fx.text(a.x, a.h + 0.5, a.z, '+' + Math.round(dmg), 'heal'); } }
        break;
      case 'heal': if (s.dur) addZone(h, tx, tz, s, dmg); else { A.healed = []; for (const a of G.heroes) if (a.alive && a.team === h.team && dist2(a.x, a.z, tx, tz) <= s.radius + a.r) { heal(a, dmg); A.healed.push(a); if (a.isPlayer || h.isPlayer) fx.text(a.x, a.h + 0.5, a.z, '+' + Math.round(dmg), 'heal'); } } break;
      case 'dash': h.dash = { dx, dz, left: clamp(d, 4, s.range), speed: s.speed, hit: s.b !== undefined ? new Set() : null, s, dmg }; if (s.reset) { h.atkT = 0; h.windT = -1; } break;
      case 'backdash':
        h.dash = { dx: -dx, dz: -dz, left: s.range, speed: s.speed, hit: null, s };
        shoot(h, h.x, 1.8, h.z, { dx, dz, speed: 36, range: s.projRange, width: 0.85, dmg, slow: s.slow, color: col, size: 0.28, long: 4, bright: 3.6, sid: 'pierce' });
        break;
      case 'leap': h.dash = { leap: true, sx: h.x, sz: h.z, ex: tx, ez: tz, t: 0, dur: s.delay, s, dmg }; V.telegraph(tx, tz, s.radius, s.delay, 0, ally); break;
      case 'blink': h.x = tx; h.z = tz; collide(h, dx, dz, 0.2); break;
      case 'strike': {
        const bx = victim.x - h.x, bz = victim.z - h.z, bd = Math.hypot(bx, bz) || 1;
        h.x = victim.x + bx / bd * (victim.r + h.r + 0.3); h.z = victim.z + bz / bd * (victim.r + h.r + 0.3); collide(h, 0, 0, 0);
        h.facing = Math.atan2(victim.z - h.z, victim.x - h.x); A.victim = victim;
        damage(h, victim, dmg * (1 + (1 - victim.hp / victim.maxHp) * (s.exec || 0) * 4), { ability: true }); applyStun(victim, s.stun);
        h.order = { type: 'attack', target: victim }; h.atkT = 0;
        break;
      }
      case 'proj': shoot(h, h.x + dx, 1.8, h.z + dz, { dx, dz, speed: s.speed, range: s.range, width: s.width, dmg, pierce: s.pierce, splash: s.splash, slow: s.slow, stun: s.stun, pull: s.pull, exec: s.exec, heroOnly: s.heroOnly, back: s.back, color: col, size: s.big || (s.vfx === 'sunarrow' ? 0.75 : s.pierce ? 0.3 : 0.5), long: s.pierce || s.vfx === 'sunarrow' ? 4 : 1, bright: 3.6, sid: s.vfx }); break;
      case 'fan': for (let k = 0; k < s.n; k++) { const a = h.facing + (k - (s.n - 1) / 2) * s.spread; shoot(h, h.x + Math.cos(a), 1.8, h.z + Math.sin(a), { dx: Math.cos(a), dz: Math.sin(a), speed: s.speed, range: s.range, width: s.width, dmg, slow: s.slow, color: col, size: 0.24, long: 3, bright: 3.4, sid: 'fan' }); } break;
      case 'zone': addZone(h, tx, tz, s, dmg); break;
    }
    if (near(h) || near({ x: tx, z: tz })) V.cast(h, s, A);
    if (i === 3) { say(h, 'ult', h.isPlayer ? 1 : 0.6); if (h.isPlayer) { ui.buzz(35); fx.hitStop(0.09); fx.zoomIn(1); fx.punch(0.3); ui.ultName(s.name, RANK.ult.name[s.rank - 1]); } }
    return true;
  }
  function updateDash(h, dt) {
    const D = h.dash, col = h.fxCol; h.moving = false;
    if (D.leap) {
      D.t += dt; const k = Math.min(1, D.t / D.dur); h.x = lerp(D.sx, D.ex, k); h.z = lerp(D.sz, D.ez, k); h.y = Math.sin(k * Math.PI) * 5;
      if (near(h)) V.leapTick(h, col);
      if (k >= 1) {
        h.y = 0; h.dash = null; collide(h, 0, 0, 0);
        eachEnemy(h.team, h.x, h.z, D.s.radius, e => { damage(h, e, D.dmg, { ability: true }); applyStun(e, D.s.stun); applySlow(e, D.s.slow); });
        if (near(h)) V.leapLand(h, D.s, col, close(h));
      }
      return;
    }
    const step = Math.min(D.left, D.speed * dt); h.x += D.dx * step; h.z += D.dz * step; D.left -= step; collide(h, D.dx, D.dz, 0);
    if (D.hit) eachEnemy(h.team, h.x, h.z, D.s.hitR, e => { if (D.hit.has(e)) return; D.hit.add(e); damage(h, e, D.dmg * (D.s.exec && e.kind === 'hero' ? 1 + (1 - e.hp / e.maxHp) * D.s.exec * 4 : 1), { ability: true }); applyStun(e, D.s.stun); if (near(e)) V.dashHit(e, col); });
    if (near(h)) V.dashTick(h, D, col, step);
    if (D.left <= 0.01) h.dash = null;
  }

  // ---------------- heroes ----------------
  // 归宗: stand still for a few breaths and the sect's formation pulls you home. Any order, any hit, any cast breaks it.
  function startRecall(h) {
    if (MODE.noRecall || !h.alive || h.dash || h.stunT > 0 || h.recallT > 0 || G.over) return false;   // 一路 has no 归宗: you buy when you set out and when you fall
    const f = POS.fountain(h.team); if (h.atHome && dist2(h.x, h.z, f.x, f.z) < T.shopR) return false;   // already home with the shop open: nothing to gain
    h.recallT = T.recallTime; h.order = null; h.target = null; h.windT = -1;
    if (near(h)) h.recallFx = fx.decal({ mode: 5, x: h.x, z: h.z, size: 7, color: h.fxCol || TEAM_COL[h.team].glow, dur: T.recallTime, hold: 0.05, alpha: 0.85 });
    if (h.isPlayer) audio.play('recall');
    return true;
  }
  function stopRecall(h, quiet) {
    if (!(h.recallT > 0)) return; h.recallT = 0;
    if (h.recallFx) { fx.release(h.recallFx); h.recallFx = null; }
    if (!quiet && h.isPlayer) ui.toast('归宗被打断');
  }
  function tickRecall(h, dt) {
    h.recallT -= dt; h.moving = false; h.windT = -1;
    const c = TEAM_COL[h.team].glow, shown = near(h) && canSee(G.player, h);
    if (h.recallFx) { h.recallFx.m.visible = shown; h.recallFx.m.rotation.y += dt * 1.4; }
    if (shown && Math.floor((h.recallT + dt) * 2) !== Math.floor(h.recallT * 2)) fx.pillar(h.x, h.z, 1.5, 6 + (T.recallTime - h.recallT) * 2, c, 0.55);   // a column of light that grows as the pull builds
    if (shown) { const a = G.t * 5 + h.id; for (let k = 0; k < 2; k++) fx.spark(h.x + Math.cos(a + k * 3.14) * 2.3, 0.2, h.z + Math.sin(a + k * 3.14) * 2.3, 0, 7 + Math.random() * 5, 0, c, 0.42, 0.7); }
    if (h.recallT > 0) return;
    const f = POS.fountain(h.team); h.recallT = 0; G.recalls++; if (h.recallFx) { fx.release(h.recallFx); h.recallFx = null; }
    if (shown) { fx.pillar(h.x, h.z, 1.8, 13, c, 0.5); fx.ringWave(h.x, h.z, 9, c, 0.5); }
    { const sp = spawnAt(h.team, slotZ(h.slot)); h.x = sp.x; h.z = sp.z; } h.order = null; h.target = null; h.facing = faceOf(h.team); h.ai.state = 'lane'; h.atHome = true;
    if (near(h) || h.isPlayer) { fx.pillar(h.x, h.z, 1.8, 13, c, 0.5); fx.ringWave(h.x, h.z, 9, c, 0.6); }
    if (h.isPlayer) audio.play('arrive'); else audio.play('arrive', h.x, h.z, 0.6);
  }
  function respawn(h) {
    const sp = spawnAt(h.team, slotZ(h.slot)); h.x = sp.x; h.z = sp.z; h.alive = true; h.atHome = true; h.hp = h.maxHp; h.mana = h.maxMana; h.barShown = h.barLag = 1; h.order = null; h.facing = faceOf(h.team); h.ai.state = 'lane';
    fx.ringWave(h.x, h.z, 9, TEAM_COL[h.team].glow, 0.7); for (let k = 0; k < 30; k++) fx.spark(h.x + (Math.random() - 0.5) * 1.5, Math.random() * 2, h.z + (Math.random() - 0.5) * 1.5, 0, 6 + Math.random() * 10, 0, TEAM_COL[h.team].glow, 0.7, 0.9);
    if (h.isPlayer) { audio.play('level'); G.focus.x = h.x; G.focus.z = h.z; }
  }
  function autoAcquire(h, reach = h.range + (h.ranged ? 1.5 : 4), nearest = false) {
    let best = null, bs = 1e9;
    for (const u of G.units) {
      if (!u.alive || u.team === h.team || !valid(u) || !canSee(h, u) || (!nearest && u.kind === 'neutral' && u.aggro !== h)) continue;
      const d = dist(h, u) - u.r; if (d > reach) continue;
      const s = nearest ? d : d - (u.kind === 'hero' ? 3 : 0) + (isStruct(u) ? 4 : 0); if (s < bs) { bs = s; best = u; }
    }
    return best;
  }
  function execOrder(h, dt) {
    const o = h.order; h.moving = false;
    if (!o) { if (h.isPlayer) { const t = autoAcquire(h); if (t) h.order = { type: 'attack', target: t, auto: true }; } return; }
    if (o.type === 'attack') {
      const t = o.target; if (!valid(t) || !canSee(h, t) || (o.auto && dist(h, t) > h.range + 9)) { h.order = null; h.target = null; return; }
      h.target = t; if (!tryAttack(h, dt)) go(h, t.x, t.z, dt);
    } else if (o.type === 'amove') {   // attack-move: walk to the point; the moment anything hostile is in reach, fight the nearest one
      if (!valid(o.target) || !canSee(h, o.target) || dist(h, o.target) - o.target.r > h.range + 5) o.target = autoAcquire(h, Math.max(h.range + 2, 8), true);
      if (o.target) { h.target = o.target; if (!tryAttack(h, dt)) go(h, o.target.x, o.target.z, dt); }
      else { h.windT = -1; if (dist2(h.x, h.z, o.x, o.z) < 0.5) h.order = null; else go(h, o.x, o.z, dt); }
    } else if (o.type === 'move') {
      h.windT = -1; if (dist2(h.x, h.z, o.x, o.z) < 0.35) h.order = null; else go(h, o.x, o.z, dt);
    } else { h.windT = -1; moveToward(h, h.x + o.dx * 4, h.z + o.dz * 4, dt); }
  }
  function updateHero(h, dt) {
    h.omen = h.tribQ ? (h.tribQ.big ? 2 : 1) : h.alive && (h.level === 4 || h.level === 8) && h.xp >= T.xpNeed(h.level) * 0.72 ? (h.level === 8 ? 2 : 1) : 0;
    if (h.omen && h.omenAt !== h.level) { h.omenAt = h.level; if (h.isPlayer) ui.toast(h.omen === 2 ? '成婴的雷劫快到了：九道，找个地方' : '结丹的雷劫快到了：五道，找个地方'); else if (h.team !== G.player.team && canSee(G.player, h)) { const sp = G.heroes.find(a => a.team === G.player.team && a.alive && !a.isPlayer && dist(a, h) < 22); if (sp) chat(sp, [`${h.name}头上起雷云了，快渡劫了`], true); } }
    h.vulnOn = h.vulnT > G.t || h.lawT > G.t; V.status(h, near(h) && canSee(G.player, h));
    if (h.alive && !h.moving && !h.target && h.combatT > 5 && h.recallT <= 0 && near(h)) { if ((h.idleT = (h.idleT || 0) + dt) > (h.idleN || 6)) { h.idleT = 0; h.idleN = 5 + Math.random() * 6; h.animCast = 0.75; } } else h.idleT = 0;   // standing about: a small gesture now and then
    if (h.alive && (h.pfxT = (h.pfxT || 0) - dt) <= 0 && near(h) && canSee(G.player, h)) {
      h.pfxT = 0.09; V.passive(h, G.t);
      if (h.def.id === 'shade') for (const e of G.heroes) if (e.alive && e.team !== h.team && e.hp < e.maxHp * 0.4 && dist(e, h) < 13 && canSee(G.player, e)) V.doom(e);
    }
    if (!h.alive) { h.respawnT -= dt; if ((!h.isPlayer || G.autoPlay) && (h.think -= dt) <= 0) { h.think = 0.6; if (h.gold >= 300) botShop(h); } if (h.respawnT <= 0) respawn(h); return; }
    const f = POS.fountain(h.team), dHome = dist2(h.x, h.z, f.x, f.z), atBase = dHome < T.fountainR, ooc = h.combatT > 5;
    if (h.atHome && dHome >= T.shopR) h.atHome = false;                 // stepped out of the gate
    heal(h, h.maxHp * dt * (0.008 + (h.regenB || 0) + (ooc ? 0.03 : 0) + (atBase ? 0.16 : 0) + (G.buffT[h.team] > 0 ? 0.01 : 0)));
    h.mana = Math.min(h.maxMana, h.mana + h.maxMana * dt * (0.016 + (ooc ? 0.03 : 0) + (atBase ? 0.2 : 0)));
    for (let i = 0; i < 4; i++) if (h.cds[i] > 0) h.cds[i] -= dt;
    h.range = h.def.range + (h.hasteT > 0 ? h.hasteRng || 0 : 0);
    if (h.tribDue) tribulation(h);
    if (h.pCd > 0) h.pCd -= dt; if (h.pT > 0 && (h.pT -= dt) <= 0) { h.pStack = 0; h.pTgt = null; }
    if (h.def.id === 'healer') for (const a of G.heroes) if (a.alive && a.team === h.team && dist(a, h) < 9) heal(a, a.maxHp * 0.01 * dt);   // 药香
    if (h.heat > 0 && (h.heatT -= dt) <= 0) { h.heat--; h.heatT = 1; }
    { const pg = T.passiveGold * dt * (1 + clamp((G.kills[1 - h.team] - G.kills[h.team]) * 0.05, 0, 0.6)); h.gold += pg; h.earned += pg; } addXp(h, 2.2 * dt * (1 + Math.max(0, G.avgLvl[1 - h.team] - h.level) * 0.8));   // those who fall behind catch up faster
    if (h.dash) { stopRecall(h); updateDash(h, dt); return; }
    if (h.stunT > 0) { stopRecall(h); h.moving = false; return; }
    if (h.tauntT > 0 && h.taunter) h.order = { type: 'attack', target: h.taunter };   // taunted: nothing to do but swing at the one who called
    else if ((!h.isPlayer || G.autoPlay) && !(h.recallT > 0)) { h.think -= dt; if (h.think <= 0) { h.think = 0.22 + Math.random() * 0.08; botThink(h, 0.26); } }
    if (h.recallT > 0) { if (h.order) stopRecall(h); else { tickRecall(h, dt); return; } }
    execOrder(h, dt); tickAttack(h, dt);
    if (h.moving && near(h)) { h.stepD = (h.stepD || 0) + h.curSpeed * dt; if (h.stepD > 2.4) { h.stepD = 0; fx.smoke(h.x, 0.25, h.z, (Math.random() - 0.5), 0.5, (Math.random() - 0.5), DUST, 1.0, 0.7, 0.16, 1.6); } }
  }

  // ---------------- bots ----------------
  function botThink(h, dtT) {
    const ai = h.ai, team = h.team, dir = team === FROST ? 1 : -1, f = POS.fountain(team), hpF = h.hp / h.maxHp, TRI = LANES.length > 1 && !!ai.brain;
    if (LANES.length > 1) {
      const plan = G.plan[team], g = ai.gank;
      if (g && (G.t > g.until || !g.u.alive || hpF < 0.4 || (g.u.hid && G.t - g.seen > 4))) ai.gank = null; else if (g && !g.u.hid) g.seen = G.t;
      const grouped = plan.mode === 'group' && ai.state !== 'retreat';
      if (grouped && (ai.state === 'jungle' || ai.state === 'ambush')) ai.state = 'lane';
      ai.lane = ai.gank ? ai.gank.lane : grouped ? plan.lane : ai.jungler ? (ai.help ?? ai.home) : ai.home;
    }
    if (h.sp > 0) for (const i of [3, ...[0, 1, 2].filter(k => h.ranks[k] === 0), 0, 2, 1]) if (learn(h, i)) break;   // the ultimate first, then one rank in everything, then depth
    if (h.gold >= 300) botShop(h);
    let eh = null, ehD = 1e9, em = null, emD = 1e9, nEH = 0, nAH = 0, nEM = 0, front = dir > 0 ? -1e9 : 1e9, hasFront = false;
    const etw = frontStruct(1 - team, ai.lane), twR = etw.kind === 'tower' ? etw.range : 6, L = LANES[ai.lane];
    const sOf = st => (st.kind === 'core' ? (st.team === FROST ? L.s0 : L.s1) : st.s), pj = q => (L.func ? q.x : L.proj(q.x, q.z)), at = s => L.at(s, ai.laneOff), hs = pj(h), es = sOf(etw);
    let alliesAtTw = 0;
    for (const u of G.units) {
      if (!u.alive || u === h) continue; const d = dist(h, u);
      if (u.team === team) {
        if (u.kind === 'hero' && d < 14) nAH++;
        if (u.kind === 'minion' && u.lane === ai.lane) { const us = L.func ? u.x : u.s; hasFront = true; front = dir > 0 ? Math.max(front, us) : Math.min(front, us); if (dist(u, etw) < twR + 1) alliesAtTw++; }
      } else if (u.hid) continue;
      else if (u.kind === 'hero') { if (d < 16) nEH++; if (d < ehD) { ehD = d; eh = u; } }
      else if (u.kind === 'minion') { if (d < 12) nEM++; if (d < emD) { emD = d; em = u; } }
    }
    if (ehD > 15) eh = null; if (emD > 11.5) em = null;
    const dTw = dist(h, etw), diveOK = etw.kind !== 'tower' || (alliesAtTw >= 1 && etw.target !== h && (h.heat || 0) < 2);
    const danger = u => etw.kind === 'tower' && dist(u, etw) < twR + 1.2;
    const wasBack = ai.state === 'retreat';
    if (ai.state === 'retreat') { if (hpF > 0.8) ai.state = 'lane'; } else if (hpF < (h.def.id === 'shade' || h.def.id === 'qingya' || h.def.id === 'wenren' ? 0.36 : 0.27) || (hpF < 0.45 && nEH > nAH + 1)) ai.state = 'retreat';
    const retreat = ai.state === 'retreat', outnum = nEH > nAH + 1, ownS = frontStruct(team, ai.lane);
    if (retreat && !wasBack) chat(h, eh ? 'retreat' : 'rest'); else if (outnum && eh && ehD < 12 && G.t - (G.helpAt || -99) > 25) { G.helpAt = G.t; chat(h, `${LANES[ai.lane].name || '这边'}对面人多，来个人`); }
    // the last enemy hero we had eyes on: if they slip into the grass, the bolder bots go in after them
    if (eh) { const s0 = ai.seen; ai.seen = { u: eh, x: eh.x, z: eh.z, t: G.t, go: s0 && s0.u === eh && G.t - s0.t < 4 ? s0.go : Math.random() < ai.nose }; }
    const sn = ai.seen, hunt = !eh && !retreat && sn && sn.go && G.t - sn.t < 4 && sn.u.alive && sn.u.hid && hpF > 0.45 && (!danger(sn) || diveOK);
    // home to spend: enough for the next piece, nobody around, nothing pressing
    if (!retreat && !eh && h.combatT > 4 && G.t > ai.shopAt && (dist(h, f) > 42 || (!h.atHome && dist(h, f) < T.shopR)) && h.gold >= botWant(h)) { ai.shopAt = G.t + 30; if (startRecall(h)) { G.botStat.shop++; chat(h, '回去置办法器，马上来'); return; } }
    const campUp = c => c.units.some(u => u.alive), holding = hasFront && dir * (front - sOf(ownS)) > 8;
    const nearestCamp = far => { let best = null, bd = far; for (const c of G.camps) { if (c.c.kind !== 'golem' || dir * sideOf(c.c.x, c.c.z) > 0 || !campUp(c)) continue; const d = dist(h, c.c); if (d < bd) { bd = d; best = c; } } return best; };
    const ambushSpot = () => { let best = null, bd = 14; for (const b of BRUSH) { const d = dist(h, b) - (team !== G.player.team && G.favBrush === b ? 7 : 0); if (d < bd && dir * (pj(b) - front) < 5 && !danger(b)) { bd = d; best = b; } } return best; };
    if (!TRI) {
      // 一路: now and then, lie in wait in the grass beside the lane; when the lane is quiet and holding, slip off to clear a camp
      if (ai.state === 'lane' && G.t > ai.ambushAt) {
        ai.ambushAt = G.t + 22 + Math.random() * 26;
        if (ai.sly && hpF > 0.6 && !eh && hasFront) { const best = ambushSpot(); if (best) { G.botStat.ambush++; ai.state = 'ambush'; ai.amb = best; ai.ambS = pj(best); ai.ambUntil = G.t + 8 + Math.random() * 6; } }
      }
      if (ai.state === 'lane' && G.t > ai.jungleAt) {
        ai.jungleAt = G.t + 25 + Math.random() * 25;
        if (hpF > 0.7 && !eh && h.level >= 2 && !SUPPORTS.includes(h.def.id) && holding && !G.heroes.some(o => o !== h && o.team === team && o.alive && o.ai.state === 'jungle')) {
          const best = nearestCamp(48); if (best) { ai.state = 'jungle'; ai.camp = best; ai.jungleUntil = G.t + 28; G.botStat.jungle++; }
        }
      }
    } else if (ai.state === 'lane' && !ai.gank && G.t > ai.thinkAt) {
      // 三路: free to choose. Lay out what this bot can see and let its brain pick.
      ai.thinkAt = G.t + 1.4 + Math.random() * 0.4;
      const mates = G.heroes.filter(o => o.team === team && o.alive && o !== h);
      ai.ctx = {
        eh, ehD, hpF, hasFront, holding, grouped: G.plan[team].mode === 'group', nearestCamp, ambushSpot,
        carry: h.seat === '护法' ? mates.find(o => o.seat === '养剑') || null : null,
        teamJungler: mates.some(o => o.ai.jungler), woodsTaken: mates.some(o => o.ai.state === 'jungle' || o.ai.jungler),
        // a gank worth making: someone seen on our half of a lane or already hurt, away from their tower, with one of ours there
        bestGank: () => { let best = null, bs = 0.85; for (const e of G.heroes) {
          if (e.team === team || !e.alive || e.hid) continue; const ln = nearestLane(e.x, e.z), Lg = LANES[ln]; if (Lg.dist(e.x, e.z) > 12 || (!ai.jungler && ln === ai.home)) continue;
          const tw = frontStruct(1 - team, ln); if (tw.kind === 'tower' && dist(e, tw) < tw.range + 5) continue;
          const pals = mates.filter(o => dist(o, e) < 17).length; if (!pals) continue;
          const over = dir * ((Lg.s0 + Lg.s1) / 2 - Lg.proj(e.x, e.z)) / 28, sc = over + (1 - e.hp / e.maxHp) * 1.3 + pals * 0.25 - dist(h, e) / 110; if (sc > bs) { bs = sc; best = { u: e, lane: ln, sc }; } } return best; },
        // the lane most outnumbered, for a jungler with nothing to clear
        neediest: () => { let need = -9, pickL = ai.home; for (let ln = 0; ln < LANES.length; ln++) { let foes = 0, mine = 0; for (const o of G.heroes) { if (!o.alive || o === h) continue; if (o.team !== team) { if (!o.hid && nearestLane(o.x, o.z) === ln) foes++; } else if (o.ai.lane === ln) mine++; } const v = foes - mine + (ln === ai.home ? 0.1 : 0); if (v > need) { need = v; pickL = ln; } } return pickL; },
      };
      ai.pick = null; ai.brain.arbitrate(); const pk = ai.pick || { mode: 'lane' }; ai.escort = null; ai.mode = pk.mode;
      if (pk.mode === 'jungle') { ai.state = 'jungle'; ai.camp = pk.camp; ai.jungleUntil = G.t + (ai.jungler ? 40 : 28); G.botStat.jungle++; }
      else if (pk.mode === 'gank') { ai.gank = { u: pk.u, lane: pk.lane, until: G.t + 18, seen: G.t }; ai.gankAt = G.t + (ai.jungler ? 32 : 55); ai.lane = pk.lane; G.botStat.gank++; chat(h, `我去抓${LANES[pk.lane].name}的${pk.u.name}`); }
      else if (pk.mode === 'ambush') { ai.ambushAt = G.t + 22 + Math.random() * 26; G.botStat.ambush++; ai.state = 'ambush'; ai.amb = pk.brush; ai.ambS = pj(pk.brush); ai.ambUntil = G.t + 8 + Math.random() * 6; }
      else if (pk.mode === 'help') ai.help = pk.lane;
      else if (pk.mode === 'escort') ai.escort = ai.ctx.carry;
    }
    if (ai.state === 'ambush' && (G.t > ai.ambUntil || hpF < 0.5 || (eh && ehD < h.range + 5) || (h.combatT < 0.4 && !h.hid) || !hasFront || Math.abs(front - ai.ambS) > 18)) ai.state = 'lane';   // time is up, or the prey has come
    const ambush = ai.state === 'ambush';
    // the 血海残魂: once everyone is 金丹, healthy and the lane is safe, the whole side goes for it together
    if (ai.state === 'lane' && G.t > 240 && G.t > G.gCall[team] && h.level >= 5 && hpF > 0.7 && !eh && (G.buffT[team] <= 0 || G.surgeT[team] <= 0)) {
      G.gCall[team] = G.t + 40;
      const gc = G.camps.filter(c => c.c.kind !== 'golem').sort((a, b) => campUp(b) - campUp(a) || dist(h, a.c) - dist(h, b.c))[0], party = G.heroes.filter(o => o.team === team && o.alive && o.hp / o.maxHp > 0.6 && (!o.isPlayer || G.autoPlay) && (o.ai.state === 'lane' || o.ai.state === 'jungle'));
      if (campUp(gc) && party.length >= 2 && holding && Math.random() < 0.55) {
        for (const o of party) { o.ai.state = 'guardian'; o.ai.camp = gc; o.ai.jungleUntil = G.t + 45; } G.botStat.guardian++; chat(h, `打${gc.units[0] ? gc.units[0].name : '河道目标'}，都来`, true);
        if (team === G.player.team && !G.autoPlay) { G.pings.push({ x: gc.c.x, z: gc.c.z, t: G.t }); audio.play('ping'); }
      }
    }
    if (ai.state === 'jungle' && (G.t > ai.jungleUntil || (eh && (!ai.jungler || ehD < 9)) || !campUp(ai.camp) || hpF < 0.4)) ai.state = 'lane';
    if (ai.state === 'guardian' && (G.t > ai.jungleUntil || !campUp(ai.camp) || hpF < 0.35 || (eh && outnum))) ai.state = 'lane';
    const woods = ai.state === 'jungle' || ai.state === 'guardian';
    // What the leader has asked for. It is weighed, not obeyed: nobody walks into a tower that has no disciples to shoot at,
    // into a crowd the side cannot match, or anywhere at all on a sliver of health. A bot that will not go says so once.
    let sig = ai.sig && G.t < ai.sig.until && !retreat ? ai.sig : null, sigAct = null, sigTw = null;
    // 开团 is a standing order rather than a single call: while it is on, the side keeps to its leader and takes the leader's
    // fights. It is weighed the same way as any signal, every think, so nobody follows into a death.
    if (G.rally && team === G.player.team && !h.isPlayer && G.player.alive && !retreat) {
      const pl = G.player, tu = pl.order && pl.order.type === 'attack' && pl.order.target && pl.order.target.alive ? pl.order.target : null;
      sig = ai.rally = Object.assign(ai.rally || { id: -1, said: false }, { type: 'attack', x: pl.x, z: pl.z, unit: tu, until: G.t + 1 });
    } else if (ai.rally) ai.rally = null;
    if (sig) {
      if (sig.type === 'retreat') sigAct = 'back';
      else {
        sigTw = G.structs[1 - team].list.find(t => t.alive && dist(t, sig) < t.range + 1.5) || null;
        if (sigTw && G.units.some(u => u.alive && u.kind === 'minion' && u.team === team && dist(u, sigTw) < sigTw.range + 1)) sigTw = null;   // the tower is busy with disciples: fine
        let foes = 0, pals = 1; for (const o of G.heroes) { if (!o.alive || o === h) continue; if (o.team !== team) { if (!o.hid && dist(o, sig) < 13) foes++; } else if (dist(o, sig) < 13 || (sig.id === -1 ? !!o.ai.rally : o.ai.sig && o.ai.sig.id === sig.id && G.t < o.ai.sig.until)) pals++; }
        sigAct = hpF > 0.4 && foes <= pals + 1 ? sig.type : 'no';
      }
      if (!sig.said) { sig.said = true; if (near(h)) { const say = { back: ['撤', '走'], gather: ['来了', '这就到'], attack: ['上', '随你'], no: ['过不去', '太险，去不得'] }[sigAct]; fx.say(h.x, h.h + 1.6, h.z, say[Math.floor(Math.random() * say.length)], team === G.player.team); } }
      if (sigAct !== 'no' && ai.state !== 'lane') ai.state = 'lane';
    }
    // ---- the fight itself: who each seat goes for, and how it carries itself (both modes) ----
    //   镇关 walks in first once the side is there.   中军 and 养剑 pick the most hurt one in reach, shoot, and step back from
    //   whoever closes on them; they do not stand in front of their own front line.   护法 keeps to the one it guards.
    //   巡山 goes for the soft and the wounded, and in a brawl waits for someone else to start it.
    const role = SEAT_FIT[h.def.id][0], thr = eh, thrD = ehD; let wait = false, kite = false;
    if (eh && !retreat) {
      if (nEH > 1 || role === 4) { let ps = -1e9; for (const e of G.heroes) { if (!e.alive || e.team === team || e.hid) continue; const d = dist(h, e); if (d > 14.5) continue; const lost = 1 - e.hp / e.maxHp, sc = role === 4 ? (e.ranged ? 1.6 : 0) + lost * 3 - d * 0.08 : role === 1 || role === 2 ? lost * 1.6 - d * 0.22 : -d * 0.3, mark = e.isPlayer && (e.streak || 0) >= 3 ? 1.3 : 0; if (sc + mark > ps && mark && G.t - (G.focusAt || -99) > 28) { G.focusAt = G.t; const ln = voice(h.def.id, 'focus', { t: e.name }); if (near(h)) fx.say(h.x, h.h + 1.6, h.z, ln, false); chat(h, [ln], true); } if (sc + mark > ps) { ps = sc + mark; eh = e; ehD = d; continue; } if (sc > ps) { ps = sc; eh = e; ehD = d; } } }
      if (role === 4 && nAH >= 1 && nEH >= 2 && eh.hp / eh.maxHp > 0.6 && (ai.waitT || 0) < 2 && !G.heroes.some(o => o.alive && o.team === team && o !== h && dist(o, eh) < 9 && o.combatT < 2)) wait = true;   // ...but not for long
      if (h.ranged && role !== 0 && role !== 4 && !thr.ranged && thrD < 4.8 && hpF < 0.85 && h.windT < 0 && h.atkT > h.period * 0.3) kite = true;   // only from someone with a blade, and only once it has started to hurt
    }
    ai.waitT = wait ? (ai.waitT || 0) + dtT : Math.max(0, (ai.waitT || 0) - dtT * 0.25);
    // (一路 has only three a side: a 护法 that stands back and leaves the last hits is a body short, so there it fights with the rest)
    let dodged = false;
    for (const b of G.bolts) if (dist2(h.x, h.z, b.x, b.z) < TRIB.r + 1 && Math.random() < 0.7) { let ox = h.x - b.x, oz = h.z - b.z; const d = Math.hypot(ox, oz) || 1; if (d < 0.4) { ox = 1; oz = 0; } h.order = { type: 'move', x: b.x + ox / d * (TRIB.r + 2.6), z: b.z + oz / d * (TRIB.r + 2.6) }; dodged = true; break; }   // step out of a closing ring
    if (!dodged) for (const z of G.zones) if (z.team !== team && dist2(h.x, h.z, z.x, z.z) < z.r + 0.8 && Math.random() < (team === EMBER ? 0.75 / diff.react : 0.6)) {
      let ox = h.x - z.x, oz = h.z - z.z; const d = Math.hypot(ox, oz) || 1; if (d < 0.5) { const tn = L.tan(hs); ox = -dir * tn.x; oz = -dir * tn.z; }
      h.order = { type: 'move', x: z.x + ox / d * (z.r + 2.5), z: z.z + oz / d * (z.r + 2.5) }; dodged = true; break;
    }
    if (!dodged) {
      if (retreat) {   // run for home — or, with someone on your heels, duck into grass they are not closer to, and leave from there
        if ((!eh || (h.hid && ehD > 5)) && h.combatT > 2.5 && dist(h, f) > 42 && startRecall(h)) return;
        let hide = null;
        if (eh && ehD < 13 && ai.sly) { if (h.hid) hide = h; else { let bd = 9; for (const b of BRUSH) { const d = dist(h, b); if (d < bd && dist(eh, b) > d + 2 && dir * (pj(b) - hs) < 3) { bd = d; hide = b; } } } }
        if (hide && hide !== h && !ai.hiding) G.botStat.hide++; ai.hiding = !!hide;
        h.order = hide === h ? null : hide ? { type: 'move', x: hide.x, z: hide.z } : { type: 'move', x: f.x, z: f.z };
      }
      else if (sigAct === 'back') { const q = at(sOf(ownS) - dir * 2); h.order = dist(h, q) > 4 ? { type: 'move', x: q.x, z: q.z } : null; }
      else if (kite) { const q = at(hs - dir * 3.5); h.order = { type: 'move', x: q.x, z: q.z }; }                                  // between shots, away from whoever is closing
      else if (wait && !woods) { const dx = h.x - eh.x, dz = h.z - eh.z, d = Math.hypot(dx, dz) || 1; h.order = d < 9 ? { type: 'move', x: eh.x + dx / d * 10.5, z: eh.z + dz / d * 10.5 } : null; }   // hover at the edge until it starts
      else if (sigAct === 'gather' || sigAct === 'attack') {
        let tgt = sig.unit && valid(sig.unit) && canSee(h, sig.unit) ? sig.unit : null;                 // the thing that was pointed at
        if (tgt && tgt.kind === 'tower' && tgt === sigTw) tgt = null;                                  // ...but not a tower nobody is tanking
        if (!tgt && eh && ehD < h.range + 5 && (!danger(eh) || diveOK)) tgt = eh;
        let px = sig.x, pz = sig.z + (h.slot - (N - 1) / 2) * 1.6;
        if (sigTw) { const dx = h.x - sigTw.x, dz = h.z - sigTw.z, d = Math.hypot(dx, dz) || 1, R0 = sigTw.range + 3.5; px = sigTw.x + dx / d * R0; pz = sigTw.z + dz / d * R0; if (tgt && dist(tgt, sigTw) < sigTw.range + 1) tgt = null; }   // wait at the edge of its reach
        if (tgt && (sigAct === 'attack' || dist(h, tgt) < h.range + 3)) h.order = { type: 'attack', target: tgt };
        else if (dist2(h.x, h.z, px, pz) > 4) h.order = { type: 'move', x: px, z: pz };
        else if (em && emD < h.range + 2 && (!danger(em) || diveOK)) h.order = { type: 'attack', target: em };
        else h.order = null;
      }
      else if (outnum && eh && ehD < 12 && dist(h, ownS) > 8 && !(eh.hp / eh.maxHp < 0.25 && ehD < h.range + 2)) { const q = at(sOf(ownS) + dir * 3); h.order = { type: 'move', x: q.x, z: q.z }; }
      else if (woods && !eh) { let t = null, bd = 1e9; for (const u of ai.camp.units) if (u.alive) { const d = dist(h, u); if (d < bd) { bd = d; t = u; } } if (t) { h.order = { type: 'attack', target: t }; em = t; emD = bd; nEM = 3; } }
      else if (ai.gank && !ai.gank.u.hid && (!danger(ai.gank.u) || diveOK) && !outnum) h.order = { type: 'attack', target: ai.gank.u };   // the gank itself
      else if (hunt) { if (!sn.counted) { sn.counted = true; G.botStat.hunt++; } const b = brushAt(sn.x, sn.z, 3.5), gx = b >= 0 ? BRUSH[b].x : sn.x, gz = b >= 0 ? BRUSH[b].z : sn.z; h.order = { type: 'move', x: gx, z: gz }; }
      else if (ambush) { h.order = dist(h, ai.amb) > 1.3 ? { type: 'move', x: ai.amb.x, z: ai.amb.z } : null; }
      else if (danger(h) && !diveOK) { const q = at(es - dir * (twR + 4)); h.order = { type: 'move', x: q.x, z: q.z }; }
      else {
        let tgt = null;
        if (eh && (!danger(eh) || (diveOK && eh.hp / eh.maxHp < 0.5)) && (ehD < h.range + 4 || eh.hp / eh.maxHp < 0.45 || !em || (role === 0 && nAH >= 2 && ehD < 12 && hpF > 0.45))) tgt = eh;   // 镇关 goes in first when the side is with it
        else if (em && (!danger(em) || diveOK) && !(ai.escort && ai.escort.alive && dist(h, ai.escort) < 14 && em.hp < em.maxHp * 0.4)) tgt = em;   // a 护法 leaves the last hit to the one it is guarding
        else if (vulnerable(etw) && dTw < 17 && diveOK) tgt = etw;
        if (tgt) h.order = { type: 'attack', target: tgt };
        else {
          const own = frontStruct(team, ai.lane);
          let gs = hasFront ? front - dir * (h.ranged ? 4.5 : 1.5) : sOf(own) + dir * 4;
          if (ai.escort && ai.escort.alive && ai.escort.ai.lane === ai.lane) gs = pj(ai.escort) + dir * (h.ranged ? -1.5 : 1.8);          // beside (or just ahead of) the carry
          if (h.ranged && role !== 0 && nEH > 0) { let ts = null; for (const o of G.heroes) if (o.alive && o.team === team && o !== h && !o.ranged && o.ai.lane === ai.lane && dist(o, h) < 16) { const v = pj(o); ts = ts === null ? v : dir > 0 ? Math.max(ts, v) : Math.min(ts, v); } if (ts !== null) gs = dir > 0 ? Math.min(gs, ts - 2.5) : Math.max(gs, ts + 2.5); }   // behind the front line while they are about
          if (etw.kind === 'tower' && !diveOK) { const lim = es - dir * (twR + 3.5); gs = dir > 0 ? Math.min(gs, lim) : Math.max(gs, lim); }
          const q = at(gs); if (Math.abs(gs - hs) > 1.2 || (!L.func && dist(h, q) > 3)) h.order = { type: 'move', x: q.x, z: q.z }; else h.order = null;
        }
      }
    }
    // --- abilities ---
    if (ambush) return;                                                // not a sound while waiting
    ai.castLock -= dtT; if (ai.castLock > 0) return;
    const err = team === EMBER ? diff.aim : 1.4, manaF = h.mana / h.maxMana;
    const lead = (t, d) => ({ x: t.x + t.vx * d * 0.85 + (Math.random() - 0.5) * err * 2, z: t.z + t.vz * d * 0.85 + (Math.random() - 0.5) * err * 2 });
    for (const i of [3, 0, 1, 2]) {
      if (!canCast(h, i)) continue; const s = h.def.skills[i]; let aim = null;
      switch (s.kind) {
        case 'proj':
          if (s.pull === 'self') { if (eh && ehD < s.range * 0.9 && !retreat && !outnum && hpF > 0.6 && !danger(eh) && ((nEH === 1 && eh.hp / eh.maxHp < 0.6) || (nAH >= nEH && G.heroes.some(o => o.alive && o.team === team && o !== h && dist(o, eh) < 13)))) aim = lead(eh, ehD / s.speed); else if (woods && em && emD > 4 && emD < s.range * 0.9) aim = em; break; }   // it hauls him in: only where he would walk in anyway
          if (eh && ehD < s.range * 0.9 && (!s.exec || eh.hp / eh.maxHp < 0.62)) aim = lead(eh, ehD / s.speed); else if (nEM >= 3 && manaF > 0.55 && em && !retreat) aim = em; break;
        case 'cone': if (eh && ehD < s.range * 0.8) aim = eh; else if (nEM >= 3 && emD < s.range * 0.7 && manaF > 0.55) aim = em; break;
        case 'nova': if (eh && ehD < s.radius * 0.85) aim = h; else if (nEM >= 3 && emD < s.radius * 0.7 && manaF > 0.5) aim = h; break;
        case 'fan': if (eh && ehD < s.range * 0.85) aim = lead(eh, ehD / s.speed); else if (nEM >= 3 && manaF > 0.6 && em && !retreat) aim = em; break;
        case 'strike': if (eh && ehD < s.range && !retreat && !outnum && (eh.hp / eh.maxHp < 0.5 || (hpF > 0.7 && nAH + 1 >= nEH)) && (!danger(eh) || diveOK)) aim = eh; break;
        case 'heal': { let low = null, lf = s.dur ? 0.6 : 0.7; for (const a of G.heroes) if (a.alive && a.team === team && dist(a, h) < (s.range || s.radius * 0.8) + 1 && a.hp / a.maxHp < lf) { lf = a.hp / a.maxHp; low = a; } if (low) aim = s.range ? low : h; break; }
        case 'taunt': if (eh && ehD < s.radius * 0.85 && !retreat && (nAH >= 1 || hpF > 0.5)) aim = h; break;
        case 'zone': if (!s.range) { if (eh && ehD < s.radius * 0.8 && !retreat) aim = h; break; } if (eh && ehD < s.range + s.radius * 0.4 && (i !== 3 || eh.hp / eh.maxHp < 0.8 || nEH >= 2)) aim = lead(eh, s.delay * 0.6); else if (i !== 3 && nEM >= 4 && manaF > 0.7 && em && !retreat) aim = em; break;
        case 'leap': if (eh && ehD < s.range && hpF > 0.4 && !retreat && !outnum && (!danger(eh) || diveOK)) aim = eh; break;
        case 'dash': if (retreat) { if (eh && ehD < 9) aim = f; } else if (s.b !== undefined && eh && !outnum && ehD > (i === 3 ? 1 : 3.5) && ehD < s.range && hpF > 0.45 && (i !== 3 || eh.hp / eh.maxHp < 0.6) && !h.ranged && (!danger(eh) || diveOK)) aim = eh; break;   // someone who fights from range keeps the dash for getting out
        case 'backdash': if (eh && ehD < 6.5) aim = eh; break;
        case 'blink': if ((retreat && eh && ehD < 9) || (s.kite && thr && !thr.ranged && thrD < s.kite && hpF < 0.9)) aim = f; break;   // kite: also to get a blade off her
        case 'shield': if (eh && ehD < 11 && h.combatT < 1.5) aim = h; break;
        case 'haste':
          if (s.veil) { if ((retreat && eh && ehD < 11) || (!s.aoe && eh && !retreat && ehD > 4.5 && ehD < 12 && hpF > 0.5) || (s.aoe && eh && ehD < 11 && G.heroes.some(a => a.alive && a.team === team && dist(a, h) < s.aoe && a.hp / a.maxHp < 0.55 && a.combatT < 2))) aim = h; }   // to close in unseen, to get away, or to cover someone who is about to fall
          else if ((eh && ehD < Math.max(h.range + 2 + (s.rng || 0), s.dr && !s.as ? 8 : 0) && !retreat) || (retreat && eh && ehD < 10 && s.ms > 0)) aim = h;
          break;
      }
      if (aim) { cast(h, i, aim.x, aim.z); ai.castLock = (0.5 + Math.random() * 0.8) * (team === EMBER ? diff.react : 1); return; }
    }
  }

  // ---------------- the side's plan ----------------
  // Once a second each side decides whether to keep to its lanes or gather. Past T.groupAt it gathers to push the lane where
  // the enemy has given most ground, holds that for a while, goes back to the lanes to farm, and gathers again — the rests
  // getting shorter as the match ages. Three or more of them seen at one of our inner towers and everyone goes there instead.
  function teamThink(team) {
    const tp = G.plan[team]; if (G.t < tp.next) return; tp.next = G.t + 1; const en = 1 - team;
    for (const r of G.mem[team].records) {                               // someone we were watching has not been seen for a while: say so, once
      const e = r.entity; if (!e.alive || r.visible || r.called || G.t - r.timeLastSensed < 9 || G.t - r.timeLastSensed > 20) continue; r.called = true;
      const ln = nearestLane(r.lastSensedPosition.x, r.lastSensedPosition.z), sp = G.heroes.find(h => h.team === team && h.alive && !h.isPlayer && h.ai.lane === ln); if (sp && G.t > 150) chat(sp, LANES[ln].name ? `${LANES[ln].name}的${e.name}不见了，小心` : `${e.name}不见了，小心草丛`);
    }
    if (LANES.length < 2) return;                                      // one lane: nothing to plan
    let siege = -1; for (let ln = 0; ln < LANES.length; ln++) { const tw = frontStruct(team, ln); if (tw.kind === 'tower' && tw.tier === 1) continue; let c = 0; for (const e of G.heroes) if (e.team === en && e.alive && !e.hid && dist(e, tw) < 24) c++; if (c >= 3) siege = ln; }
    if (siege >= 0) { if (tp.mode !== 'group' || tp.lane !== siege) { const sp = G.heroes.find(h => h.team === team && h.alive && !h.isPlayer); if (sp) chat(sp, `${LANES[siege].name}被压了，回防！`, true); } tp.mode = 'group'; tp.lane = siege; tp.until = Math.max(tp.until, G.t + 10); return; }
    if (tp.mode === 'group') { if (G.t > tp.until) { tp.mode = 'rest'; tp.until = G.t + clamp(34 - (G.t - T.groupAt) / 25, 10, 34); } return; }
    if (G.t < T.groupAt || G.t < tp.until) return;
    if (G.heroes.filter(h => h.team === team && h.alive).length < 4) { tp.until = G.t + 6; return; }       // not while people are down
    let best = 0, bs = -1e9; for (let ln = 0; ln < LANES.length; ln++) { const tw = frontStruct(en, ln), fallen = G.structs[en].lanes[ln].filter(t => !t.alive).length, sc = fallen * 1.2 + (tw.kind === 'tower' ? 1 - tw.hp / tw.maxHp : 2) + Math.random() * 0.6; if (sc > bs) { bs = sc; best = ln; } }
    tp.mode = 'group'; tp.lane = best; tp.until = G.t + 42; G.botStat.group++;
    if (team === G.player.team && !G.autoPlay) { const q = frontStruct(en, best), sp = G.heroes.find(h => h.team === team && h.alive && !h.isPlayer); if (sp) chat(sp, `集合，一起推${LANES[best].name}`, true); G.pings.push({ x: q.x, z: q.z, t: G.t, type: 'attack' }); audio.play('ping'); }
  }

  // ---------------- minions, neutrals, towers ----------------
  function spawnMinion(team, type, off, lane = 0) {
    const s = T.minion[type], c = POS.core(team), dir = team === FROST ? 1 : -1, grow = (1 + 0.1 * (G.t / 60) + Math.max(0, G.t - T.lateAt) / 60 * T.lateK) * (G.surgeT[team] > 0 ? G.surgeK[team] : 1); // waves hit much harder after 6 minutes so matches always end
    const L = LANES[lane], sp = L.func ? { x: c.x + dir * 7, z: c.z + off } : L.at((team === FROST ? L.s0 : L.s1) + dir * 10, off), m = unit('minion', team, sp.x, sp.z, { ...s, hp: s.hp * grow, ad: s.ad * grow });
    m.stats = s; m.off = off; m.type = type; m.lane = lane; m.s = L.proj(m.x, m.z); m.facing = faceOf(team); m.view = M.minion(type, team);
  }
  function updateMinion(m, dt) {
    m.s = LANES[m.lane].proj(m.x, m.z);                                // how far along its lane
    m.moving = false; if (m.stunT > 0) return;
    m.think -= dt;
    if (m.think <= 0) {
      m.think = 0.25 + Math.random() * 0.1;
      let best = null, bd = 9.5;
      for (const u of G.units) { if (!u.alive || u.team === m.team || u.team === NEUTRAL || !valid(u) || !canSee(m, u)) continue; const d = dist(m, u) - u.r - (u.kind === 'hero' ? -1.5 : 0); if (d < bd) { bd = d; best = u; } }
      if (best || !valid(m.target) || !canSee(m, m.target) || dist(m, m.target) > 13) m.target = best;
    }
    if (m.tauntT > 0 && m.taunter) m.target = m.taunter;
    if (valid(m.target)) { if (!tryAttack(m, dt)) moveToward(m, m.target.x, m.target.z, dt); }
    else { const dir = m.team === FROST ? 1 : -1, L = LANES[m.lane], core = G.structs[1 - m.team].core; if (Math.abs((dir > 0 ? L.s1 : L.s0) - m.s) < 8) moveToward(m, core.x, core.z, dt); else { const q = L.at(m.s + dir * 3, m.off); moveToward(m, q.x, q.z, dt); } }
    tickAttack(m, dt);
  }
  function spawnCamp(camp) {
    const kind = c0 => (c0.kind === 'guardian' && T.bossAt && G.t >= T.bossAt ? 'abyss' : c0.kind), c = camp.c, k = kind(c), s = T.neutral[k]; camp.units.length = 0;
    for (let i = 0; i < c.n; i++) {
      const x = c.x + (c.n > 1 ? (i - 0.5) * 3.4 : 0), z = c.z + (i % 2) * 0.8;
      const u = unit('neutral', NEUTRAL, x, z, s); u.stats = s; u.nk = k; u.camp = camp; u.home = { x, z }; u.aggro = null; u.facing = Math.PI / 2;
      u.name = { guardian: '血海残魂', puppet: '镇渊傀', abyss: '渊主残念' }[k] || '血傀'; u.view = M.minion(k, NEUTRAL, { guardian: 1.9, puppet: 1.85, abyss: 2.15 }[k] || 1.15); camp.units.push(u);
    }
  }
  function updateNeutral(u, dt) {
    u.moving = false; if (u.stunT > 0) return;
    if (u.tauntT > 0 && u.taunter) u.aggro = u.taunter;
    const a = u.aggro;
    if (a && (!a.alive || dist(u, u.home) > 15 || dist(a, u.home) > 20)) { u.aggro = null; u.windT = -1; }
    if (u.aggro) { u.target = u.aggro; if (!tryAttack(u, dt)) moveToward(u, u.aggro.x, u.aggro.z, dt); tickAttack(u, dt); }
    else if (dist(u, u.home) > 0.4) { moveToward(u, u.home.x, u.home.z, dt); heal(u, u.maxHp * dt * 0.25); }
    else { u.facing = angLerp(u.facing, Math.PI / 2, dt * 4); if (u.hp < u.maxHp) heal(u, u.maxHp * dt * 0.25); }
  }
  // Tower rules. It keeps shooting what it has until that dies or leaves. When it needs a new target it takes the nearest
  // minion, and a hero only if no minion is in range. One exception jumps the queue: a hero who damages an allied hero
  // inside its range is locked at once (handled where damage is dealt). Every hit on a hero adds heat (see config).
  function updateTower(tw, dt) {
    tw.atkT -= dt; let t = tw.target; const p = G.player;
    if (t && (!t.alive || t.hid || dist(tw, t) > tw.range + t.r)) t = tw.target = null;
    if (!t) {
      let bd = 1e9, hero = null, hd = 1e9;
      for (const u of G.units) { if (!u.alive || u.team === tw.team || u.team === NEUTRAL || isStruct(u) || u.hid) continue; const d = dist(tw, u) - u.r; if (d > tw.range) continue; if (u.kind === 'hero') { if (d < hd) { hd = d; hero = u; } } else if (d < bd) { bd = d; t = u; } }
      t = t || hero;
      if (t) { tw.target = t; if (t.kind === 'hero') { tw.atkT = Math.max(tw.atkT, T.towerLock); if (t.isPlayer) { ui.toast('灵塔锁定了你'); audio.play('warn'); } } }   // a moment to react before the first shot
    }
    // the line of sight: faint on a minion; on a hero it runs from yellow to red with heat and brightens as the shot comes
    if (t && near(tw)) {
      const heat = t.kind === 'hero' ? t.heat || 0 : -1, k = 1 - clamp(tw.atkT / tw.period, 0, 1), g = TEAM_COL[tw.team].glow;
      tw.beam.userData.set(tw.x, tw.view.muzzleY, tw.z, t.x, t.h * 0.55, t.z, heat < 0 ? g : [1.0, 0.62 - heat * 0.14, 0.14 - heat * 0.03], heat < 0 ? 0.05 : 0.05 + heat * 0.02 + k * 0.05, heat < 0 ? 0.1 + 0.18 * k : 0.25 + 0.55 * k);
    } else tw.beam.visible = false;
    // the range ring: shown whenever the player is close to an enemy tower — pale while it is busy with minions, red when it wants you
    const inR = p.alive && p.team !== tw.team && dist(tw, p) < tw.range + 4.5;
    tw.warn.visible = inR;
    if (inR) { const mine = t === p, u = tw.warn.material.uniforms; u.uColor.value.setRGB(mine ? 1.8 : 0.45, mine ? 0.2 : 0.55, mine ? 0.1 : 0.7); u.uAlpha.value = mine ? 0.75 + 0.25 * Math.sin(G.t * 11) : 0.4; }
    if (t && tw.atkT <= 0) { tw.atkT = tw.period; tw.ad = T.towerAd * (1 + 0.04 * G.t / 60); strike(tw); }
  }

  // ---------------- player commands ----------------
  const P = () => G.player;
  G.cmdMove = (x, z) => { const h = P(); if (h.alive) { h.order = { type: 'move', x: clamp(x, -MAP.hx + 1.5, MAP.hx - 1.5), z: clamp(z, -MAP.hz + 1.5, MAP.hz - 1.5) }; h.target = null; } };
  G.cmdAttackMove = (x, z) => { const h = P(); if (h.alive) h.order = { type: 'amove', x: clamp(x, -MAP.hx + 1.5, MAP.hx - 1.5), z: clamp(z, -MAP.hz + 1.5, MAP.hz - 1.5), target: null }; };
  G.cmdAttack = t => { const h = P(); if (h.alive && valid(t)) h.order = { type: 'attack', target: t }; };
  G.cmdDir = (dx, dz) => { const h = P(); if (!h.alive) return; if (dx === 0 && dz === 0) { if (h.order && h.order.type === 'dir') h.order = null; } else h.order = { type: 'dir', dx, dz }; };
  G.cmdStop = () => { const h = P(); h.order = null; h.target = null; h.windT = -1; stopRecall(h); };
  G.recall = () => { const h = P(); if (MODE.noRecall) { ui.toast('一路不能归宗：万宝阁只在出山前和陨落时开'); return false; } if (h.recallT > 0) return true; const ok = startRecall(h); if (!ok && h.alive && !G.over) ui.toast(h.stunT > 0 || h.dash ? '现在无法归宗' : '已经在山门内，万宝阁开着'); return ok; };
  G.pings = []; G.recalls = 0; G.gCall = [0, 0]; G.botStat = { ambush: 0, hunt: 0, hide: 0, shop: 0, jungle: 0, guardian: 0, gank: 0, group: 0 };
  G.plan = [0, 1].map(() => ({ mode: 'rest', lane: 0, until: 0, next: 0 }));
  G.tribs = []; G.bolts = []; G.tribK = 0; G.surgeT = [0, 0]; G.surgeK = [1, 1];                              // 破阵 / 渊息: this side's disciples march stronger
  let pingAt = -9;
  // Signals: 集合 (come here), 进攻 (take this), 撤退 (fall back). A mark on the ground and the map, a sound, and every allied
  // bot in earshot weighs it (see botThink). unit = what was pointed at, for 进攻.
  let sigId = 0;
  G.signal = (type, x, z, unit = null) => {
    if (G.over || G.t - pingAt < 1.2) return false; pingAt = G.t; x = clamp(x, -MAP.hx + 2, MAP.hx - 2); z = clamp(z, -MAP.hz + 2, MAP.hz - 2);
    const c = { gather: [0.5, 1.5, 0.9], attack: [1.9, 0.35, 0.2], retreat: [1.8, 1.4, 0.3] }[type], me = P(), id = ++sigId;
    G.pings.push({ x, z, t: G.t, type });
    fx.pillar(x, z, 0.9, 14, c, 0.9); fx.ringWave(x, z, 12, c, 0.7); fx.decal({ mode: 1, x, z, size: 1, size0: 9, color: c, dur: 0.6 }); audio.play(type === 'retreat' ? 'warn' : 'ping');
    ui.toast({ gather: '集合！', attack: '进攻！', retreat: '撤退！' }[type]);
    const reach = type === 'retreat' ? 50 : 90;
    for (const h of G.heroes) if (h.team === me.team && !h.isPlayer && h.alive && dist2(h.x, h.z, x, z) < reach) h.ai.sig = { id, type, x, z, unit, until: G.t + (type === 'retreat' ? 7 : 12), said: false };
    { let best = null, bd = 1e9; for (const h of G.heroes) if (h.team === me.team && !h.isPlayer) { const d = dist2(h.x, h.z, x, z); if (d < bd) { bd = d; best = h; } }
      if (best) chat(best, !best.alive ? 'deadAck' : bd > reach ? 'far' : best.hp / best.maxHp < 0.4 && type !== 'retreat' ? 'hurt' : { gather: 'ackGather', attack: 'ackAttack', retreat: 'ackRetreat' }[type], true); }
    return true;
  };
  G.ping = (x, z) => G.signal('gather', x, z);
  G.rally = false;
  G.setRally = on => { G.rally = on === undefined ? !G.rally : !!on; if (G.rally && !P().alive) G.rally = false; ui.rally(G.rally); if (G.rally) { audio.play('horn'); const p = P(); fx.ringWave(p.x, p.z, 16, [1.9, 0.45, 0.25], 0.8); const one = L => L[Math.floor(Math.random() * L.length)]; fx.say(p.x, p.h + 1.6, p.z, one(['随我开团！', '都过来，跟我上！', '集合，开打！']), true); let k = 0; for (const a of G.heroes) if (a.alive && a.team === p.team && a !== p && k < 2) { chat(a, 'rally', true); k++; } } return G.rally; };
  G.passive = () => { const h = P(), d = h.def.passive; return { stacks: d.pct ? Math.round((1 - h.hp / h.maxHp) * 60) : d.max ? h.pStack : 0, cd: d.cd ? Math.max(0, h.pCd) : 0 }; };
  G.pick = (x, z, slack = 1.3) => {
    let best = null, bd = 1e9;
    for (const u of G.units) { if (!u.alive || u.team === P().team || !valid(u) || u.hid) continue; const d = dist2(u.x, u.z, x, z) - u.r; if (d < slack && d < bd) { bd = d; best = u; } }
    return best;
  };
  G.nearestEnemy = (range, heroFirst = true) => {
    const h = P(); let best = null, bs = 1e9;
    for (const u of G.units) { if (!u.alive || u.team === h.team || !valid(u) || u.hid) continue; const d = dist(h, u) - u.r; if (d > range) continue; const s = d - (heroFirst && u.kind === 'hero' ? 8 : 0) + (isStruct(u) ? 6 : 0) + (u.kind === 'neutral' && u.aggro !== h ? 5 : 0); if (s < bs) { bs = s; best = u; } }
    return best;
  };
  G.canCast = i => canCast(P(), i);
  G.strikeTarget = (i, ax, az) => { const h = P(), s = h.def.skills[i]; let best = null, bd = 1e9; for (const e of G.heroes) { if (!e.alive || e.team === h.team || e.hid || dist(h, e) > s.range + 1) continue; const q = dist2(e.x, e.z, ax, az); if (q < bd) { bd = q; best = e; } } return best; };
  G.castAt = (i, x, z) => { const h = P(), ok = cast(h, i, x, z); if (!ok && h.alive) { const s = h.def.skills[i]; ui.toast(h.ranks[i] < 1 ? '还没学会这一招：按 1-4 或点招式上方的 + 号' : h.cds[i] > 0 ? '招式调息中' : h.mana < s.mana ? '灵力不足' : s.kind === 'strike' ? '附近没有敌方修士' : ''); } return ok; };
  // touch: aim automatically — at the best enemy in range, otherwise along the facing / stick direction
  G.castAuto = (i, sx = 0, sz = 0) => {
    const h = P(), s = h.def.skills[i]; if (!h.alive) return false;
    const reach = s.kind === 'cone' ? s.range * 0.9 : s.kind === 'backdash' ? 9 : (s.range || 0) + (s.radius || 0) * 0.5;
    if (s.kind === 'heal') { let low = h, lf = h.hp / h.maxHp; if (s.range) for (const a of G.heroes) if (a.alive && a.team === h.team && dist(a, h) < s.range && a.hp / a.maxHp < lf) { lf = a.hp / a.maxHp; low = a; } return G.castAt(i, low.x, low.z); }
    const t = (s.kind === 'blink' || s.kind === 'shield' || s.kind === 'haste' || s.kind === 'nova' || s.kind === 'taunt' || (s.kind === 'zone' && !s.range) || (s.kind === 'dash' && s.b === undefined)) ? null : G.nearestEnemy(reach || 8);
    if (t && s.kind !== 'dash') return G.castAt(i, t.x + t.vx * (s.delay || 0) * 0.5, t.z + t.vz * (s.delay || 0) * 0.5);
    if (t) return G.castAt(i, t.x, t.z);
    const fx_ = sx || sz ? sx : Math.cos(h.facing), fz_ = sx || sz ? sz : Math.sin(h.facing), d = s.kind === 'backdash' ? -6 : (s.range || 6) * 0.85;
    return G.castAt(i, h.x + fx_ * d, h.z + fz_ * d);
  };
  G.canShop = () => canShop(P());
  G.buy = id => { const why = buyItem(P(), id); if (why) ui.toast(why); else audio.play('buy'); return !why; };
  G.price = id => priceOf(P(), id);
  G.learn = i => learn(P(), i);
  G.canLearn = i => canLearn(P(), i);
  G.skill = i => eff(P(), i);
  G.skillDmg = (i, rank) => { const h = P(), keep = h.ranks[i]; h.ranks[i] = rank; const s = eff(h, i), v = s.b !== undefined ? skillDmg(h, s, i) : 0; h.ranks[i] = keep; return v; };
  // 感悟: what is waiting to be chosen, and choosing it
  // the choice is only offered in a quiet moment: out of combat for a few breaths and nobody of theirs close by (or while fallen)
  const calm = h => !h.alive || (h.combatT > 3.5 && !G.heroes.some(e => e.alive && e.team !== h.team && !e.hid && dist(e, h) < 16));
  G.insight = () => { const h = P(), t = h.insPend[0]; if (t !== undefined) { if (calm(h)) h.insShow = G.t; else if (G.t - (h.insShow || -9) > 0.4) return null; } return t === undefined ? null : { tier: t, opts: INSIGHT[h.def.id][t].map(q => ({ name: q[0], desc: q[1], skill: h.def.skills[3] })) }; };
  // which of two turnings suits the other side: wide when they bunch up in melee, longer holds against the nimble, harder hits into the
  // thick-skinned, finishing power into the frail, reach against those who fight from range, a shorter 调息 when they can heal it back
  const WHY = { area: '对面爱扎堆', cc: '对面腿脚快', fast: '不给他们躲的工夫', dmg: '对面皮厚', exec: '对面身板脆', cd: '这一仗要打久', range: '对面手长', dur: '把他们多困一会儿', sustain: '同门得多撑几口气', spread: '人多，得照应周全' };
  const pickInsight = h => {
    const t = h.insPend[0], opts = INSIGHT[h.def.id][t], E = G.heroes.filter(o => o.team !== h.team).map(o => o.def), n = E.length || 1;
    const melee = E.filter(d => !d.ranged).length / n, tank = E.filter(d => d.hp >= 1100).length / n, frail = E.filter(d => d.hp < 900).length / n, heal = E.filter(d => SUPPORTS.includes(d.id)).length / n;
    const nimble = E.filter(d => d.skills.some(s => s.kind === 'dash' || s.kind === 'blink' || s.kind === 'strike' || s.kind === 'backdash' || s.veil)).length / n;
    const W = { area: 0.55 + melee * 0.9 + (n >= 5 ? 0.15 : 0), cc: 0.55 + nimble * 0.8, fast: 0.5 + nimble * 0.9, dmg: 0.6 + tank * 1.1, exec: 0.6 + frail * 1.0, cd: 0.85 + heal * 0.9, range: 0.5 + (1 - melee) * 0.8, dur: 0.55 + melee * 0.5 + tank * 0.4, sustain: 0.95, spread: 0.6 + (n >= 5 ? 0.5 : 0) };
    const sc = opts.map(q => (W[q[4]] || 0.7) + Math.random() * 0.12); return sc[1] > sc[0] ? 1 : 0;
  };
  const takeInsight = (h, k) => {
    const t = h.insPend.shift(); if (t === undefined) return false; const q = INSIGHT[h.def.id][t][k ? 1 : 0]; h.ins.push(q);
    if (near(h)) { fx.pillar(h.x, h.z, 1.4, 12, h.fxCol, 0.6); fx.ringWave(h.x, h.z, 9, h.fxCol, 0.5); }
    if (h.isPlayer) { audio.play('star'); ui.announce(`感悟 · ${q[0]}`, 'good'); ui.buzz(40); }
    else if (h.team === G.player.team) chat(h, 'ins', true, { i: q[0], w: WHY[q[4]], d: q[1] });   // allies report what they took and why; the other side keeps it to itself
    return true;
  };
  G.chooseInsight = k => (G.insight() ? takeInsight(P(), k) : false);

  // ---------------- frame update ----------------
  const BAR = { kill: [1.0, 0.9, 0.3], self: [0.3, 0.95, 0.42], ally: [0.3, 0.62, 1.0], enemy: [1.0, 0.27, 0.2], neutral: [0.95, 0.78, 0.3] };
  CAMPS.forEach(c => { const camp = { c, units: [], respawnT: 0 }; G.camps.push(camp); spawnCamp(camp); });

  G.update = (dt, time) => {
    if (G.over) { G.overT += dt; dt *= 0.35; }
    else {
      G.t += dt;
      if (G.t >= G.nextWave) {
        G.nextWave += T.waveEvery; G.wave++;
        if (G.wave === 1) { ui.announce('两宗弟子已下山', ''); audio.play('horn'); }
        if (G.wave > 3 && G.t - (G.moodAt || 0) > 50) {                 // how the match is going, said by whoever feels it — either side
          const pt = G.player.team, lead = (G.kills[pt] - G.kills[1 - pt]) + (G.structs[pt].list.filter(x => x.alive).length - G.structs[1 - pt].list.filter(x => x.alive).length) * 2.5;
          if (Math.abs(lead) >= 6) { G.moodAt = G.t; const pick = t => { const L = G.heroes.filter(h => h.team === t && h.alive && !h.isPlayer); return L[Math.floor(Math.random() * L.length)]; }, foe = pick(1 - pt), ally = pick(pt);
            if (foe) chat(foe, lead > 0 ? 'behind' : 'ahead', true); if (ally && Math.random() < 0.6) chat(ally, lead > 0 ? 'ahead' : 'behind'); }
        }
        if ((G.wave === 2 || G.wave === 7) && (G.pairN || 0) < 2) {      // people with history say so: once early, once more a few minutes in, never the same pair twice
          const by = id => G.heroes.filter(h => h.def.id === id), pt = G.player.team, said = G.pairDone || (G.pairDone = new Set()); let done = false;
          const order = PAIRS.map((p, k) => [p, k]).sort((a, b) => (by(b[0][0]).some(h => h.isPlayer) || by(b[0][1]).some(h => h.isPlayer) ? 1 : 0) - (by(a[0][0]).some(h => h.isPlayer) || by(a[0][1]).some(h => h.isPlayer) ? 1 : 0) || Math.random() - 0.5);   // the player's own ties first
          for (const [[a, b, same, opp], k] of order) { if (done) break; if (said.has(k)) continue; for (const A of by(a)) { if (done) break; for (const B of by(b)) { if (A === B) continue; const L = A.team === B.team ? same : opp;
            fx.say(A.x, A.h + 1.6, A.z, L[0], A.team === pt); fx.say(B.x, B.h + 1.6, B.z, L[1], B.team === pt); if (!A.isPlayer) ui.chat(A, L[0], A.team !== pt, 8000); if (!B.isPlayer) ui.chat(B, L[1], B.team !== pt, 8000);
            said.add(k); G.pairN = (G.pairN || 0) + 1; done = true; break; } } }
        }
        if (G.wave === 1) { const sp = G.heroes.filter(h => h.team === G.player.team && !h.isPlayer); if (sp[0]) chat(sp[0], 'start', true); if (sp[1]) chat(sp[1], sp[1].ai.jungler ? ['我去巡山，有事喊我'] : 'start', true); const foe = G.heroes.filter(h => h.team !== G.player.team); if (foe.length) chat(foe[Math.floor(Math.random() * foe.length)], 'eStart', true); }
        for (const team of [FROST, EMBER]) for (let lane = 0; lane < LANES.length; lane++) {
          const lost = !G.structs[1 - team].lanes[lane][1].alive; // the side that broke through gets a stronger wave down that lane
          const list = ['melee', 'melee', 'melee', 'ranged']; if (G.t > 300) list.push('ranged'); if (lost) list.unshift('melee');
          list.forEach((type, i) => G.spawnQ.push({ t: G.t + i * 0.7, team, type, lane, off: ((i % 3) - 1) * 1.7 }));
        }
      }
      for (let i = G.spawnQ.length - 1; i >= 0; i--) if (G.spawnQ[i].t <= G.t) { const q = G.spawnQ[i]; G.spawnQ.splice(i, 1); spawnMinion(q.team, q.type, q.off, q.lane); }
      for (const c of G.camps) if (c.respawnT > 0) { c.respawnT -= dt; if (c.respawnT <= 0) spawnCamp(c); }
      if (G.rally && !G.player.alive) G.setRally(false);               // the order falls with the one who gave it
      teamThink(FROST); teamThink(EMBER);
      if (T.bossAt && !G.bossUp && G.t >= T.bossAt) {                  // 渊主残念 rises in the upper pit, whatever was there
        G.bossUp = true; const camp = G.camps.find(c => c.c.kind === 'guardian');
        if (camp) { for (const u of camp.units) if (u.alive) { u.alive = false; u.hp = 0; u.goneT = 0; } camp.respawnT = 0; spawnCamp(camp); ui.announce('渊主残念现世', ''); audio.play('horn'); G.pings.push({ x: camp.c.x, z: camp.c.z, t: G.t, type: 'attack' }); fx.pillar(camp.c.x, camp.c.z, 3, 26, [1.6, 0.1, 0.2], 1.6); }
      }
      for (const team of [FROST, EMBER]) { if (G.surgeT[team] > 0) G.surgeT[team] -= dt; if (G.buffT[team] > 0) G.buffT[team] -= dt; let n = 0, sum = 0; for (const h of G.heroes) if (h.team === team) { n++; sum += h.level; } G.avgLvl[team] = sum / n; }
      for (const e of G.units) { e.brush = !e.alive || isStruct(e) ? -1 : brushAt(e.x, e.z); if (e.revealT > 0) e.revealT -= dt; }
      { const p = G.player, b = p.alive ? p.brush : -1; if (b >= 0 && b !== G.pBrushWas) { const n = G.pBrushN || (G.pBrushN = {}); n[b] = (n[b] || 0) + 1; if (n[b] >= 3 && n[b] >= (n[G.favIdx] || 0)) { G.favIdx = b; G.favBrush = BRUSH[b]; } } G.pBrushWas = b; }   // the grass the player keeps going back to
      // who can be seen. Brush hides you from anyone not in it with you; in a mode with fog you must also be within sight of
      // something on the other side (a cultivator, a disciple, a tower). Striking, casting or being hit shows you for a moment.
      for (const e of G.units) {
        if (e.team === NEUTRAL || isStruct(e) || !e.alive || e.revealT > 0) { e.hid = false; continue; }
        if (e.veilT > 0) { let seen = false; for (const o of G.units) if (o.alive && o.team === 1 - e.team && !isStruct(o) && dist2(o.x, o.z, e.x, e.z) < 3.2) { seen = true; break; } e.hid = !seen; continue; }
        if (e.brush < 0 && !FOG) { e.hid = false; continue; }
        let sight = !FOG, bush = e.brush < 0; const foe = 1 - e.team;
        for (const o of G.units) {
          if (!o.alive || o.team !== foe) continue; const d = dist2(o.x, o.z, e.x, e.z);
          if (!sight && d < T.sight[o.kind] + e.r) sight = true;
          if (!bush && !isStruct(o) && (o.brush === e.brush || d < 2.6)) bush = true;
          if (sight && bush) break;
        }
        e.hid = !(sight && bush);
      }
      if (FOG && (fogT -= dt) <= 0) { fogT = 0.12; paintFog(); }
      for (const e of G.heroes) { if (!e.alive) continue; const m = G.mem[1 - e.team]; if (!e.hid) { if (!m.hasRecord(e)) m.createRecord(e); const r = m.getRecord(e); r.timeLastSensed = G.t; r.lastSensedPosition.set(e.x, 0, e.z); r.visible = true; r.called = false; } else if (m.hasRecord(e)) m.getRecord(e).visible = false; }
      while (G.pings.length && G.t - G.pings[0].t > 4) G.pings.shift();
      while (sayQ.length && sayQ[0].at <= G.t) { const q = sayQ.shift(); if (q.h.alive) say(q.h, 'kill', q.chance); }
      for (const e of G.units) {
        e.px = e.x; e.pz = e.z;
        if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowPct = 0; } if (e.stunT > 0) e.stunT -= dt; if (e.hasteT > 0) e.hasteT -= dt; if (e.veilT > 0) e.veilT -= dt;
        if (e.shieldT > 0) { e.shieldT -= dt; if (e.shieldT <= 0) e.shield = 0; }
        e.combatT += dt;
        if (e.tauntT > 0) { e.tauntT -= dt; if (e.tauntT <= 0 || !e.taunter || !e.taunter.alive) { e.tauntT = 0; e.taunter = null; } }
        if (e.knock && e.alive) { const K = e.knock; K.t += dt; const k = Math.min(1, K.t / K.dur); e.x = lerp(K.sx, K.tx, k); e.z = lerp(K.sz, K.tz, k); e.moving = false; if (k >= 1) e.knock = null; if (e.kind !== 'hero') continue; }
        if (e.kind === 'hero') updateHero(e, dt);
        else if (!e.alive) continue;
        else if (e.kind === 'minion') updateMinion(e, dt);
        else if (e.kind === 'neutral') updateNeutral(e, dt);
        else if (e.kind === 'tower') updateTower(e, dt);
      }
      // fountains burn intruders
      for (const team of [FROST, EMBER]) { const f = POS.fountain(team); for (const e of G.units) if (e.alive && e.team === 1 - team && dist2(e.x, e.z, f.x, f.z) < T.fountainR) { damage(null, e, e.maxHp * 0.6 * dt + 60 * dt); if (Math.random() < 0.3) fx.line(f.x, 3, f.z, e.x, 1.5, e.z, TEAM_COL[team].glow, 12, 0.6, 0.2); } }
      // soft separation so units do not stack
      const U = G.units;
      for (let i = 0; i < U.length; i++) {
        const a = U[i]; if (!a.alive || isStruct(a) || a.dash) continue;
        for (let j = i + 1; j < U.length; j++) {
          const b = U[j]; if (!b.alive || isStruct(b) || b.dash) continue;
          const dx = b.x - a.x, dz = b.z - a.z, rr = (a.r + b.r) * 0.9; if (Math.abs(dx) > rr || Math.abs(dz) > rr) continue;
          const d = Math.hypot(dx, dz); if (d >= rr || d < 1e-4) continue;
          const k = (rr - d) / d * 0.5, wa = a.kind === 'hero' ? 0.35 : 1, wb = b.kind === 'hero' ? 0.35 : 1, sum = wa + wb;
          a.x -= dx * k * wa / sum * 2; a.z -= dz * k * wa / sum * 2; b.x += dx * k * wb / sum * 2; b.z += dz * k * wb / sum * 2;
        }
      }
      updateProj(dt); updateZones(dt); updateTribs(dt);
      const inv = 1 / Math.max(dt, 1e-3);
      for (const e of G.units) { e.vx = (e.x - e.px) * inv; e.vz = (e.z - e.pz) * inv; }
      if (G.hurtFlash > 0) G.hurtFlash = Math.max(0, G.hurtFlash - dt * 1.6);
    }
    // views, bars, cleanup
    const p = G.player;
    if (G.peek && !G.over) { G.focus.tx = G.peek.x; G.focus.tz = G.peek.z; } else if (!G.over && p.alive) { G.focus.tx = p.x; G.focus.tz = p.z; }
    const beat = Math.floor(G.t / 0.09) !== Math.floor((G.t - dt) / 0.09);
    fx.barsBegin();
    for (let i = G.units.length - 1; i >= 0; i--) {
      const e = G.units[i];
      if (!e.alive && (e.kind === 'minion' || e.kind === 'neutral')) { e.goneT += dt; e.view.update(dt, e, time); if (e.goneT > 0.5) { M.freeMinion(e.view); G.units.splice(i, 1); } continue; }
      e.view.update(dt, e, time);
      const unseen = e.hid && e.team !== p.team;
      if (beat && e.marks > 0 && e.markT > G.t && e.alive && !unseen && near(e)) V.marks(e, e.marks, e.markCol, G.t);
      if (e.alive && !isStruct(e)) e.view.obj.visible = !unseen;
      if (e.view.ghost) e.view.ghost(e.alive && e.brush >= 0 && !unseen, e.team === p.team, e.hid);
      if (!e.alive || unseen || !near(e)) continue;
      const frac = e.hp / e.maxHp, y = e.h + 0.7 + (e.y || 0) + (e.kind === 'hero' && e.level >= 9 ? 1.15 : 0);   // room for the 元婴 above the head
      if (frac < e.barShown - 0.002) { e.barLag = Math.max(e.barLag, e.barShown); e.barShown = frac; e.lagT = 0.32; e.cutK = 1; }       // hurt: the solid part drops at once, the lost chunk lingers in red
      else if (frac > e.barShown + 0.012) { if (e.healT <= 0 && frac - e.barShown > 0.03) e.healT = 0.28; e.healT -= dt; if (e.healT <= 0) e.barShown = Math.min(frac, e.barShown + dt * 0.9); } // healed: white first, then it fills in
      else { e.barShown = frac; e.healT = 0; }
      if ((e.lagT -= dt) <= 0) e.barLag = Math.max(e.barShown, e.barLag - dt * 0.75); if (e.barLag < e.barShown) e.barLag = e.barShown;
      e.cutK = Math.max(0, e.cutK - dt * 3.2);
      const sh = Math.min(1 - Math.max(frac, e.barLag), e.shield / e.maxHp), shown = e.barShown, lag = e.barLag, cut = e.cutK;
      const ripe = p.alive && e.team !== p.team && (e.kind === 'minion' || e.kind === 'neutral') && e.hp <= p.ad * (G.buffT[p.team] > 0 ? 1.15 : 1);   // one basic attack from you would finish it
      const c = ripe ? BAR.kill : e === p ? BAR.self : e.team === NEUTRAL ? BAR.neutral : e.team === p.team ? BAR.ally : BAR.enemy;
      if (e.kind === 'hero') fx.bar(e.x, y, e.z, shown, sh, 96, 14, c, e.maxHp / 300, Math.max(0.001, e.mana / e.maxMana), lag, frac, cut);
      else if (e.kind === 'minion') fx.bar(e.x, y, e.z, shown, 0, ripe ? 48 : 40, ripe ? 7 : 5, c, 0, 0, lag, frac, cut);
      else if (e.kind === 'neutral') { if (frac < 1 || e.aggro) fx.bar(e.x, y, e.z, shown, 0, e.nk === 'abyss' ? 150 : e.nk !== 'golem' ? 110 : 56, 7, c, 0, 0, lag, frac, cut); }
      else if (vulnerable(e) || frac < 1) fx.bar(e.x, y, e.z, shown, 0, e.kind === 'core' ? 150 : 110, 9, c, 0, 0, lag, frac, cut);
    }
    fx.barsEnd();
  };

  G.vulnerable = vulnerable; G.frontStruct = frontStruct;
  return G;
}
