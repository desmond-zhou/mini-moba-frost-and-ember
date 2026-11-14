// ui.js — DOM HUD: title / hero select, score, hero console, shop, minimap, kill feed, end screen.
import { HEROES, HERO_ORDER, ITEMS, ITEM_TIERS, TIER_NAME, RANK, REALM, realmOf, T, MAP, laneZ, riverX, CAMPS, BRUSH, FROST, EMBER, NEUTRAL, TEAM_COL } from './config.js';
import { skillIcon, itemIcon } from './icons.js';
import { portrait } from './portraits.js';

// the colour a hero's abilities glow with on the player's side (same mix as in game.js)
const accent = d => { const tg = TEAM_COL[FROST].glow, c = [tg[0] * 0.38 + d.tint[0] * 0.62, tg[1] * 0.38 + d.tint[1] * 0.62, tg[2] * 0.38 + d.tint[2] * 0.62], mx = Math.max(...c); return c.map(v => v / mx); };
const icon = (d, s) => skillIcon(s.icon, accent(d));
const pasIcon = d => skillIcon(d.passive.icon, [1.0, 0.82, 0.42]);
const face = d => portrait(d.id, accent(d));
const faceOf = h => portrait(h.def.id, h.fxCol);

const $ = id => document.getElementById(id);
const kfmt = n => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n)));
const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const store = { get(k, d) { try { return localStorage.getItem('frostember.' + k) || d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('frostember.' + k, v); } catch { /* private mode */ } } };

export function createUI(isTouch, audio) {
  const ui = { shopOpen: false, onCast: null, onBuy: null };
  const el = {}; for (const id of ['hud', 'title', 'end', 'cards', 'detail', 'diff', 'portrait', 'rosF', 'rosE', 'goBtn', 'help', 'kF', 'kE', 'clock', 'pipF', 'pipE', 'buff', 'feed', 'announce', 'toast', 'dead', 'deadT', 'tip', 'touch', 'pName', 'pLvl', 'skills', 'hpFill', 'hpTxt', 'mpFill', 'mpTxt', 'xpFill', 'gold', 'kda', 'items', 'shop', 'shopGrid', 'shopBtn', 'shopX', 'mini', 'endMark', 'endSub', 'endTable', 'againBtn', 'muteBtn', 'qBtn', 'pas', 'chan', 'chanFill', 'score', 'recallBtn', 'top', 'shopNote', 'menu', 'menuBtn', 'mResume', 'mRestart', 'mQuit', 'vMusic', 'vSfx', 'ult']) el[id] = $(id);
  document.body.classList.toggle('touch', isTouch);
  el.touch.hidden = !isTouch;
  const cache = new Map();
  const txt = (e, v) => { if (cache.get(e) !== v) { cache.set(e, v); e.textContent = v; } };
  const sx = (e, v) => { v = Math.round(v * 500) / 500; if (cache.get(e) !== v) { cache.set(e, v); e.style.transform = `scaleX(${v})`; } };

  // ---------- title ----------
  ui.showTitle = onStart => {
    let hero = store.get('hero', 'mage'), diffK = store.get('diff', 'normal');
    if (!HEROES[hero]) hero = 'mage'; if (!T.difficulty[diffK]) diffK = 'normal';
    el.cards.innerHTML = HERO_ORDER.map(k => { const h = HEROES[k]; return `<button type="button" class="card" data-k="${k}"><i class="pt" style="background-image:url(${face(h)})"></i><h3>${h.name}</h3><div class="role">${h.role}</div><div class="ics">${h.skills.map(sk => `<i style="background-image:url(${icon(h, sk)})"></i>`).join('')}</div></button>`; }).join('');
    const detail = () => { const h = HEROES[hero]; el.detail.innerHTML = `<i class="big" style="background-image:url(${face(h)})"></i><h3>${h.name}<small>${h.title}</small></h3><p>${h.blurb}</p><ul><li class="pv"><i style="background-image:url(${pasIcon(h)})"></i><div><b>被动 · ${h.passive.name}</b><span>${h.passive.desc}</span></div></li>${h.skills.map(sk => `<li><i style="background-image:url(${icon(h, sk)})"></i><div><b>${sk.key} · ${sk.name}</b><span>${sk.desc}</span></div></li>`).join('')}</ul>`; };
    el.diff.innerHTML = Object.entries(T.difficulty).map(([k, d]) => `<button type="button" data-k="${k}">${d.name}</button>`).join('');
    const paint = () => { for (const c of el.cards.children) c.classList.toggle('on', c.dataset.k === hero); for (const c of el.diff.children) c.classList.toggle('on', c.dataset.k === diffK); detail(); };
    el.cards.onclick = e => { const c = e.target.closest('.card'); if (c) { hero = c.dataset.k; paint(); audio.init(); audio.play('click'); } };
    el.diff.onclick = e => { const c = e.target.closest('button'); if (c) { diffK = c.dataset.k; paint(); audio.init(); audio.play('click'); } };
    el.goBtn.onclick = () => { store.set('hero', hero); store.set('diff', diffK); el.title.hidden = true; onStart(hero, diffK); };
    el.help.innerHTML = isTouch
      ? '左侧摇杆移动，松开摇杆自动攻击附近敌人。招式按钮点一下自动瞄准；按住往外拖可以自己瞄，松手释放。点右上角灵石打开万宝阁（只有在山门内或陨落时才能买），旁边是归宗（站定 4 秒，挨打或移动会打断）。按住小地图可以看别处，轻点小地图给队友发信号；点顶部比分看计分板。躲进高草丛，外面的敌人就看不见你，出手或挨打才会暴露。'
      : '<kbd>鼠标左/右键</kbd>移动或攻击目标 <kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd><kbd>R</kbd>按住瞄准、松开释放（右键取消） <kbd>A</kbd>再点左键是攻击移动（路上一有敌人进入范围就打最近的） <kbd>S</kbd>停止 <kbd>B</kbd>归宗 <kbd>P</kbd>万宝阁 <kbd>Tab</kbd>计分板 <kbd>滚轮</kbd>缩放<br>小地图：左键按住查看，右键移动过去，<kbd>Alt</kbd>+点击给队友发信号。躲进高草丛，外面的敌人看不见你，出手或挨打才会暴露。归宗要站定 4 秒，挨打或下命令会打断。万宝阁只有在山门内（出生点附近）或陨落时才能买东西。<br>镇压弟子和邪祟拿灵石，置办法器，推掉两座灵塔后摧毁敌方阵眼。境界从筑基初期到元婴巅峰共十二层，每突破一层得一点感悟（绝招共三重，对应三个大境界的巅峰：筑基巅峰初悟、金丹巅峰大成、元婴巅峰圆满），按 <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> 或点招式上方的 + 号学习和提升招式。灵塔先打弟子；在塔下打敌方修士会被立刻锁定，连续挨塔打每发伤害再加 40%，离开一会儿才降温。队友和对手每局从其余十一人里随机。';
    paint(); el.hud.hidden = true; el.end.hidden = true; el.title.hidden = false;
  };

  // ---------- match HUD ----------
  let skillEls = [], shopTiles = [], roster = [], scoreRows = [], scoreHead = [], lastItems = '', miniBg = null, miniT = 0, G = null, tipT = 0;
  ui.bind = (game, actions) => {
    G = game; const p = G.player, d = p.def; cache.clear(); lastItems = '';
    el.pName.textContent = ''; el.portrait.style.backgroundImage = `url(${faceOf(p)})`;
    el.skills.innerHTML = d.skills.map((s, i) => `<div class="sk" data-i="${i}"><button type="button" class="up" hidden aria-label="提升">＋</button><button type="button" class="skill${i === 3 ? ' ult' : ''}" data-i="${i}" style="background-image:url(${icon(d, s)})"><span class="key">${s.key}</span><span class="nm">${s.name}</span><span class="cost">${s.mana}</span><span class="pips">${'<i></i>'.repeat(3)}</span><i class="cd"></i><b class="cdn"></b></button></div>`).join('');
    skillEls = [...el.skills.querySelectorAll('.skill')].map(b => ({ b, cd: b.querySelector('.cd'), cdn: b.querySelector('.cdn'), up: b.parentElement.querySelector('.up'), pips: [...b.querySelectorAll('.pips i')], was: 0 }));
    skillEls.forEach(({ b, up }, i) => {
      b.onpointerdown = e => { e.preventDefault(); e.stopPropagation(); actions.skillDown(i, e); b.animate([{ transform: 'scale(.9)' }, { transform: 'scale(1)' }], { duration: 160 }); };
      b.onpointermove = e => actions.skillMove(i, e); b.onpointerup = e => actions.skillUp(i, e); b.onpointercancel = e => actions.skillUp(i, e, true);
      up.onpointerdown = e => { e.preventDefault(); e.stopPropagation(); G.learn(i); };
      if (!isTouch) { b.onpointerenter = () => showTip(i); b.onpointerleave = () => { el.tip.hidden = true; }; up.onpointerenter = () => showTip(i); up.onpointerleave = () => { el.tip.hidden = true; }; }
    });
    // the shop: three grades, each tile shows what it is made from and what it would cost you right now
    const tile = k => { const it = ITEMS[k]; return `<button type="button" class="item t${it.tier}" data-k="${k}"><i class="ic" style="background-image:url(${itemIcon(it)})"></i><b>${it.name}</b><span class="tp">${it.tip}</span>${it.parts ? `<span class="parts">${it.parts.map(q => `<i data-p="${q}" title="${ITEMS[q].name}" style="background-image:url(${itemIcon(ITEMS[q])})"></i>`).join('<u>+</u>')}</span>` : ''}<em></em></button>`; };
    const note = ['直接购买', '由一件凡器炼成', '由两件灵器合成，每种只能持有一件'];
    el.shopGrid.innerHTML = ITEM_TIERS.map((ids, t) => `<h3>${TIER_NAME[t + 1]}<small>${note[t]}</small></h3><div class="tier">${ids.map(tile).join('')}</div>`).join('');
    shopTiles = [...el.shopGrid.querySelectorAll('.item')].map(b => ({ b, k: b.dataset.k, em: b.querySelector('em'), parts: [...b.querySelectorAll('.parts i')] }));
    el.shopGrid.onclick = e => { const c = e.target.closest('.item'); if (c) G.buy(c.dataset.k); };
    const ros = (box, team) => { const hs = G.heroes.filter(h => h.team === team); box.innerHTML = hs.map(h => `<i style="background-image:url(${faceOf(h)})"${h.isPlayer ? ' class="me"' : ''}><b></b><u></u></i>`).join(''); return hs.map((h, i) => ({ h, e: box.children[i], lv: box.children[i].querySelector('b'), dead: box.children[i].querySelector('u') })); };
    roster = [...ros(el.rosF, FROST), ...ros(el.rosE, EMBER)];
    el.shopBtn.onclick = () => ui.toggleShop(); el.shopX.onclick = () => ui.toggleShop(false);
    el.recallBtn.onclick = () => { audio.init(); G.recall(); };
    // the passive: a round tile beside the portrait; hover or tap to read it
    el.pas.style.backgroundImage = `url(${pasIcon(d)})`;
    const pasTip = () => { el.tip.innerHTML = `<i style="background-image:url(${pasIcon(d)});border-radius:50%"></i><div><b>被动 · ${d.passive.name}</b><br>${d.passive.desc}</div>`; el.tip.hidden = false; };
    if (isTouch) el.pas.onpointerdown = e => { e.preventDefault(); e.stopPropagation(); pasTip(); tipT = 3.5; };
    else { el.pas.onpointerenter = pasTip; el.pas.onpointerleave = () => { el.tip.hidden = true; }; }
    // the scoreboard (hold Tab; tap the score on touch)
    el.score.innerHTML = [FROST, EMBER].map(t => `<section class="${t === FROST ? 'frost' : 'ember'}"><h3>${t === FROST ? '霜' : '烬'}<b></b></h3>${G.heroes.filter(h => h.team === t).map(h => `<div class="row${h.isPlayer ? ' me' : ''}"><i class="fp" style="background-image:url(${faceOf(h)})"></i><span class="nm">${h.name}${h.isPlayer ? '（你）' : ''}<small>${h.def.role}</small></span><span class="st"></span><span class="lv"></span><span class="kda"></span><span class="its"></span><span class="dmg"></span></div>`).join('')}</section>`).join('') + `<p>${isTouch ? '再点一下顶部比分收起' : '按住 Tab 查看'} · 镇压 / 陨落 / 合力 · 伤害指对修士造成的伤害</p>`;
    scoreHead = [...el.score.querySelectorAll('h3 b')];
    const rows = [...el.score.querySelectorAll('.row')], order = [...G.heroes.filter(h => h.team === FROST), ...G.heroes.filter(h => h.team === EMBER)];
    scoreRows = order.map((h, i) => ({ h, e: rows[i], lv: rows[i].querySelector('.lv'), kda: rows[i].querySelector('.kda'), its: rows[i].querySelector('.its'), st: rows[i].querySelector('.st'), dmg: rows[i].querySelector('.dmg'), sig: null }));
    el.top.onpointerdown = e => { if (e.pointerType === 'touch' || isTouch) { e.preventDefault(); ui.showScore(el.score.hidden); } };
    ui.showScore(false); el.chan.hidden = true; el.tip.hidden = true;
    el.feed.innerHTML = ''; el.hud.hidden = false; el.end.hidden = true; ui.toggleShop(false);
  };
  // the pause menu: the world stops while it is open (main.js checks ui.menuOpen)
  ui.menuOpen = false; ui.onMenu = {};
  ui.toggleMenu = on => { ui.menuOpen = on === undefined ? !ui.menuOpen : on; el.menu.hidden = !ui.menuOpen; if (ui.menuOpen) { ui.toggleShop(false); ui.showScore(false); } };
  el.menuBtn.onclick = () => { audio.init(); ui.toggleMenu(); }; el.mResume.onclick = () => ui.toggleMenu(false);
  el.mRestart.onclick = () => { ui.toggleMenu(false); if (ui.onMenu.restart) ui.onMenu.restart(); }; el.mQuit.onclick = () => { ui.toggleMenu(false); if (ui.onMenu.quit) ui.onMenu.quit(); };
  el.menu.onpointerdown = e => { if (e.target === el.menu) ui.toggleMenu(false); };
  el.vMusic.value = store.get('vm', '100'); el.vSfx.value = store.get('vs', '100');
  const vol = () => { audio.setVolume(el.vMusic.value / 100, el.vSfx.value / 100); store.set('vm', el.vMusic.value); store.set('vs', el.vSfx.value); };
  el.vMusic.oninput = vol; el.vSfx.oninput = () => { vol(); audio.play('coin'); }; vol();
  // your ultimate's name, written across the lower screen for a moment
  ui.ultName = (name, rank) => { el.ult.firstElementChild.textContent = name; el.ult.lastElementChild.textContent = rank; el.ult.animate([{ opacity: 0, transform: 'scale(1.5)', filter: 'blur(6px)' }, { opacity: 1, transform: 'scale(1)', filter: 'blur(0)', offset: 0.14 }, { opacity: 1, transform: 'scale(1.03)', offset: 0.7 }, { opacity: 0, transform: 'scale(1.08)' }], { duration: 1300, easing: 'ease-out' }); };
  ui.showScore = on => { if (el.score.hidden === !on) return; el.score.hidden = !on; };
  ui.toggleShop = on => { ui.shopOpen = on === undefined ? !ui.shopOpen : on; el.shop.hidden = !ui.shopOpen; if (ui.shopOpen) audio.play('click'); };
  function showTip(i) {
    const p = G.player, s = G.skill(i), R = i === 3 ? RANK.ult : RANK.basic, r = p.ranks[i], word = s.kind === 'shield' ? '罡气' : s.kind === 'heal' ? '治疗' : '伤害';
    let nums = `灵力 ${s.mana} · 调息 ${(s.cd * (1 - p.cdr)).toFixed(1)} 秒`;
    if (s.b !== undefined) nums += ` · ${word} ${Math.round(G.skillDmg(i, Math.max(1, r)))}`;
    let next = '';
    if (r < R.max) { const nr = r + 1; next = `<em class="nx">${r ? '下一重' : '学会后'}「${R.name[nr - 1]}」${s.b !== undefined ? `：${word} ${Math.round(G.skillDmg(i, nr))}` : ''}${R.cd[nr - 1] < 1 ? `，调息 -${Math.round((1 - R.cd[nr - 1]) * 100)}%` : ''}${nr === R.max ? '，控制和增益时间 +25%' : ''}（需 ${realmOf(R.lvl[nr - 1])}）</em>`; }
    el.tip.innerHTML = `<i style="background-image:url(${icon(p.def, s)})"></i><div><b>${s.key} · ${s.name}</b> <span class="rk">${r ? R.name[r - 1] : '未学'}</span><br>${s.desc}<em>${nums}</em>${next}</div>`; el.tip.hidden = false;
  }
  ui.announce = (text, cls) => { el.announce.textContent = text; el.announce.className = cls || ''; el.announce.animate([{ opacity: 0, transform: 'scale(1.25)' }, { opacity: 1, transform: 'scale(1)', offset: 0.12 }, { opacity: 1, offset: 0.8 }, { opacity: 0, transform: 'scale(0.98)' }], { duration: 2600, easing: 'ease-out' }); };
  ui.toast = text => { if (!text) return; el.toast.textContent = text; el.toast.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 1300 }); };
  const who = u => (u.kind === 'hero' ? `<i class="fp" style="background-image:url(${faceOf(u)})"></i><span class="${u.team === FROST ? 'frost' : 'ember'}">${u.name}</span>` : u.name || (u.kind === 'minion' ? '弟子' : '护山大阵'));
  ui.feed = (k, tgt, src) => {
    const d = document.createElement('div');
    d.innerHTML = k ? `${who(k)} 镇压了 ${who(tgt)}` : `${who(tgt)} 被${src ? who(src) : '护山大阵'}镇杀`;
    el.feed.prepend(d); while (el.feed.children.length > 4) el.feed.lastChild.remove(); setTimeout(() => d.remove(), 6000);
  };

  function drawMini() {
    const c = el.mini, g = c.getContext('2d'), w = c.width, h = c.height, kx = w / (MAP.hx * 2), kz = h / (MAP.hz * 2);
    const X = x => (x + MAP.hx) * kx, Z = z => (z + MAP.hz) * kz;
    if (!miniBg) {
      miniBg = document.createElement('canvas'); miniBg.width = w; miniBg.height = h; const b = miniBg.getContext('2d');
      const gr = b.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#1a2c44'); gr.addColorStop(0.5, '#12241a'); gr.addColorStop(1, '#3a1c12'); b.fillStyle = gr; b.fillRect(0, 0, w, h);
      b.lineCap = 'round'; b.strokeStyle = '#1d5b68'; b.lineWidth = 9 * kx; b.beginPath(); for (let z = -MAP.hz; z <= MAP.hz; z += 2) b.lineTo(X(riverX(z)), Z(z)); b.stroke();
      b.strokeStyle = '#5a5648'; b.lineWidth = 10 * kx; b.beginPath(); for (let x = -75; x <= 75; x += 2) b.lineTo(X(x), Z(laneZ(x))); b.stroke();
      b.fillStyle = 'rgba(96,150,70,.5)'; for (const br of BRUSH) { b.beginPath(); b.arc(X(br.x), Z(br.z), br.r * kx, 0, 6.3); b.fill(); }
      b.fillStyle = 'rgba(255,214,110,.5)'; for (const cp of CAMPS) { b.beginPath(); b.arc(X(cp.x), Z(cp.z), cp.kind === 'guardian' ? 7 : 4.5, 0, 6.3); b.fill(); }
    }
    g.drawImage(miniBg, 0, 0);
    const col = t => TEAM_COL[t].css, me = G.player.team;
    for (const u of G.units) {
      if (!u.alive || (u.hid && u.team !== me)) continue; const x = X(u.x), z = Z(u.z);
      if (u.kind === 'tower' || u.kind === 'core') { const s = u.kind === 'core' ? 15 : 10; g.fillStyle = col(u.team); g.fillRect(x - s / 2, z - s / 2, s, s); g.strokeStyle = '#000'; g.lineWidth = 1.5; g.strokeRect(x - s / 2, z - s / 2, s, s); }
      else if (u.kind === 'minion') { g.fillStyle = col(u.team); g.fillRect(x - 2, z - 2, 4, 4); }
    }
    for (const u of G.heroes) { if (!u.alive || (u.hid && u.team !== me)) continue; g.beginPath(); g.arc(X(u.x), Z(u.z), u.isPlayer ? 8.5 : 7, 0, 6.3); g.fillStyle = col(u.team); g.fill(); g.lineWidth = u.isPlayer ? 3 : 1.5; g.strokeStyle = u.isPlayer ? '#fff' : '#000'; g.stroke(); }
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,.6)'; g.strokeRect(X(G.focus.x - 27), Z(G.focus.z - 19), 54 * kx, 33 * kz);      // what the camera sees
    for (const pg of G.pings) { const a = G.t - pg.t, r = 5 + (a * 26) % 24; g.lineWidth = 3; g.strokeStyle = `rgba(140,255,200,${Math.max(0, 1 - a / 4)})`; g.beginPath(); g.arc(X(pg.x), Z(pg.z), r, 0, 6.3); g.stroke(); g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(X(pg.x), Z(pg.z), 4, 0, 6.3); g.fill(); }
  }

  ui.update = dt => {
    const p = G.player;
    txt(el.kF, String(G.kills[FROST])); txt(el.kE, String(G.kills[EMBER])); txt(el.clock, fmt(G.t));
    [el.pipF, el.pipE].forEach((pe, t) => { const s = G.structs[t]; [s.t1, s.t2, s.core].forEach((u, i) => { const off = !u.alive; if (cache.get(pe.children[i]) !== off) { cache.set(pe.children[i], off); pe.children[i].classList.toggle('off', off); } }); });
    const bt = G.buffT[p.team], be = G.buffT[1 - p.team];
    const heat = p.alive && p.heat > 0 ? `灵塔灼烧 ${p.heat} 层 · 下一发 ×${(1 + T.heatStep * p.heat).toFixed(1)}` : '';
    const brush = p.alive && p.brush >= 0 ? (p.hid ? '隐于草丛 · 敌人看不见你' : '草丛中 · 已暴露') : '';
    txt(el.buff, [heat, brush, bt > 0 ? `魂血之力 ${Math.ceil(bt)}s · 伤害 +15%` : be > 0 ? `敌方持有魂血之力 ${Math.ceil(be)}s` : ''].filter(Boolean).join('　'));
    if (cache.get('heat') !== !!heat) { cache.set('heat', !!heat); el.buff.classList.toggle('hot', !!heat); }
    sx(el.hpFill, p.hp / p.maxHp); sx(el.mpFill, p.mana / p.maxMana); sx(el.xpFill, p.level >= T.maxLevel ? 1 : p.xp / T.xpNeed(p.level));
    txt(el.hpTxt, `${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`); txt(el.mpTxt, `${Math.floor(p.mana)} / ${Math.round(p.maxMana)}`);
    txt(el.pLvl, realmOf(p.level)); txt(el.gold, String(Math.floor(p.gold))); txt(el.kda, `${p.kills} / ${p.deaths} / ${p.assists}`);
    const sig = p.items.map(x => x.id).join();
    if (sig !== lastItems) { lastItems = sig; el.items.innerHTML = Array.from({ length: 6 }, (_, i) => { const it = p.items[i]; return it ? `<i class="t${it.tier}" title="${it.name}：${it.tip}" style="background-image:url(${itemIcon(it)})"></i>` : '<i></i>'; }).join(''); }
    skillEls.forEach((se, i) => {
      const { b, cd, cdn, up, pips } = se;
      const s = p.def.skills[i], left = p.cds[i], rank = p.ranks[i], locked = rank < 1, tot = G.skill(i).cd * (1 - p.cdr);
      const k = left > 0 ? Math.round(Math.min(1, left / tot) * 100) / 100 : locked ? 1 : 0;
      if (cache.get(cd) !== k) { cache.set(cd, k); cd.style.setProperty('--p', k); }
      if (se.was > 0 && left <= 0 && !locked) b.animate([{ filter: 'brightness(2.6)', transform: 'scale(1.12)' }, { filter: 'brightness(1)', transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
      se.was = left;
      txt(cdn, left > 0 ? (left < 1 ? left.toFixed(1) : String(Math.ceil(left))) : '');
      const cls = (locked ? 'locked ' : '') + (!locked && left <= 0 && p.mana < s.mana ? 'nomana ' : '') + (!locked && left <= 0 && p.mana >= s.mana ? 'ready' : '');
      if (cache.get(b) !== cls) { cache.set(b, cls); b.className = 'skill ' + (i === 3 ? 'ult ' : '') + cls; }
      const can = G.canLearn(i); if (cache.get(up) !== can) { cache.set(up, can); up.hidden = !can; }
      if (cache.get(pips) !== rank) { cache.set(pips, rank); pips.forEach((e, j) => e.classList.toggle('on', j < rank)); }
    });
    // passive tile, recall bar, scoreboard
    const pd = p.def.passive, ps = G.passive(), pv = ps.cd > 0 ? String(Math.ceil(ps.cd)) : pd.pct ? (ps.stacks > 0 ? '+' + ps.stacks + '%' : '') : pd.max ? (ps.stacks > 0 ? ps.stacks + '/' + pd.max : '') : '';
    txt(el.pas.firstElementChild, pv); if (cache.get(el.pas) !== ps.cd > 0) { cache.set(el.pas, ps.cd > 0); el.pas.classList.toggle('off', ps.cd > 0); }
    if (tipT > 0 && (tipT -= dt) <= 0) el.tip.hidden = true;
    const ch = p.alive && p.recallT > 0; if (el.chan.hidden === ch) el.chan.hidden = !ch; if (ch) sx(el.chanFill, 1 - p.recallT / T.recallTime);
    if (!el.score.hidden) {
      scoreHead.forEach((e, t) => txt(e, String(G.kills[t])));
      for (const r of scoreRows) {
        const h = r.h; txt(r.lv, realmOf(h.level)); txt(r.kda, `${h.kills} / ${h.deaths} / ${h.assists}`); txt(r.st, h.alive ? '' : `重聚 ${Math.ceil(h.respawnT)}s`); txt(r.dmg, `伤害 ${kfmt(h.dealt)} · 灵石 ${kfmt(h.earned)}`);
        if (cache.get(r.e) !== h.alive) { cache.set(r.e, h.alive); r.e.classList.toggle('dead', !h.alive); }
        const sg = h.items.map(x => x.id).join(); if (sg !== r.sig) { r.sig = sg; r.its.innerHTML = h.items.map(it => `<i title="${it.name}" style="background-image:url(${itemIcon(it)})"></i>`).join(''); }
      }
    }
    for (const r of roster) { txt(r.lv, String(r.h.level)); const d = r.h.alive ? '' : String(Math.ceil(r.h.respawnT)); if (cache.get(r.e) !== d) { cache.set(r.e, d); r.dead.textContent = d; r.e.classList.toggle('dead', !r.h.alive); } }
    if (el.dead.hidden === p.alive) el.dead.hidden = p.alive; if (!p.alive) txt(el.deadT, `${Math.ceil(p.respawnT)} 秒后重聚`);
    const shopOK = G.canShop(); if (cache.get(el.shopBtn) !== shopOK) { cache.set(el.shopBtn, shopOK); el.shopBtn.classList.toggle('away', !shopOK); el.shopNote.hidden = shopOK; el.shopGrid.classList.toggle('away', !shopOK); }
    if (ui.shopOpen) for (const t of shopTiles) {
      const it = ITEMS[t.k], price = G.price(t.k), have = p.items.filter(x => x.id === t.k).length, full = it.tier === 3 && have > 0;
      const st = (full ? 'own ' : '') + (!full && p.gold < price ? 'poor' : '') + (have ? ' has' : '');
      if (cache.get(t.b) !== st) { cache.set(t.b, st); t.b.className = `item t${it.tier} ${st}`; }
      txt(t.em, full ? '已持有' : `${price} 灵石${have ? ` · 已有 ${have}` : ''}`);
      for (const pe of t.parts) { const own = p.items.some(x => x.id === pe.dataset.p); if (cache.get(pe) !== own) { cache.set(pe, own); pe.classList.toggle('own', own); } }
    }
    miniT -= dt; if (miniT <= 0 || G.peek) { miniT = 0.12; drawMini(); }
  };

  ui.showEnd = onAgain => {
    const win = G.winner === G.player.team;
    el.endMark.textContent = win ? '宗门大捷' : '山门失守'; el.endSub.textContent = `用时 ${fmt(G.t)} · 镇压 ${G.kills[FROST]} : ${G.kills[EMBER]}`;
    const score = h => h.kills * 3 + h.assists * 1.5 - h.deaths * 1.2 + h.dealt / 1500 + (h.team === G.winner ? 2 : 0), best = G.heroes.reduce((a, h) => (score(h) > score(a) ? h : a)), top = Math.max(...G.heroes.map(h => h.dealt));
    el.endTable.innerHTML = '<tr><th>阵营</th><th></th><th>修士</th><th>境界</th><th>镇压</th><th>陨落</th><th>合力</th><th>伤害</th><th>灵石</th></tr>' + G.heroes.map(h => `<tr${h === best ? ' class="best"' : ''}><td class="${h.team === FROST ? 'frost' : 'ember'}">${h.team === FROST ? '霜' : '烬'}</td><td><i class="fp" style="background-image:url(${faceOf(h)})"></i></td><td>${h.name}${h.isPlayer ? '（你）' : ''}${h === best ? '<span class="tag">本局最佳</span>' : ''}</td><td>${realmOf(h.level)}</td><td>${h.kills}</td><td>${h.deaths}</td><td>${h.assists}</td><td>${h.dealt === top ? '<b>' + kfmt(h.dealt) + '</b>' : kfmt(h.dealt)}</td><td>${kfmt(h.earned)}</td></tr>`).join('');
    ui.toggleMenu(false); el.hud.hidden = true; el.end.hidden = false; el.againBtn.onclick = () => { el.end.hidden = true; onAgain(); };
  };
  el.muteBtn.onclick = () => { audio.init(); audio.setMuted(!audio.muted); el.muteBtn.textContent = audio.muted ? '声音 关' : '声音 开'; };
  ui.el = el;
  return ui;
}
