// unit.test.mjs — fast checks of the pieces that need no browser: node --test tests/unit.test.mjs
//   dmath (same numbers everywhere), config invariants (heroes, seats, items, insights, tables), the online clock (net.js advance)
import test from 'node:test'; import assert from 'node:assert/strict';
import { DMath, seedSim, vis } from '../src/dmath.js';
import { HEROES, HERO_ORDER, ITEMS, SEATS, SEAT_FIT, INSIGHT, INSIGHT_LVL, MODES, T } from '../src/config.js';
import { createNet } from '../src/net.js';

test('dmath: sin, cos, atan2, hypot are close to the real thing', () => {
  for (let i = 0; i < 20000; i++) {
    const x = (i - 10000) / 50, y = Math.sin(i) * 40, z = Math.cos(i * 1.3) * 40;
    assert.ok(Math.abs(DMath.sin(x) - Math.sin(x)) < 1e-8, 'sin ' + x); assert.ok(Math.abs(DMath.cos(x) - Math.cos(x)) < 1e-8, 'cos ' + x);
    assert.ok(Math.abs(DMath.atan2(y, z) - Math.atan2(y, z)) < 1e-9, `atan2 ${y} ${z}`); assert.ok(Math.abs(DMath.hypot(y, z) - Math.hypot(y, z)) < 1e-12);
  }
  assert.equal(DMath.atan2(0, 0), 0); assert.equal(DMath.hypot(3, 4), 5); assert.equal(DMath.sin(0), 0);
});
test('dmath: the match dice repeat from the same seed and differ between seeds', () => {
  seedSim(42); const a = Array.from({ length: 100 }, () => DMath.random()); seedSim(42); const b = Array.from({ length: 100 }, () => DMath.random());
  seedSim(43); const c = Array.from({ length: 100 }, () => DMath.random());
  assert.deepEqual(a, b); assert.notDeepEqual(a, c); assert.ok(a.every(v => v >= 0 && v < 1));
  seedSim(42); vis(); vis(); assert.equal(DMath.random(), a[0], 'dice for show never move the match dice');
});
test('dmath: only + − × ÷ and sqrt inside (no transcendental Math calls)', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/dmath.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  const used = [...src.matchAll(/\bN\.(\w+)/g)].map(m => m[1]).filter(k => !['PI', 'floor', 'sqrt', 'imul', 'random'].includes(k));
  assert.deepEqual([...new Set(used)], [], 'native Math functions used by dmath: ' + used.join(', '));
});
test('the modules that decide what happens use DMath, and nothing there uses ** (rounding differs by browser)', async () => {
  const fs = await import('node:fs');
  for (const f of ['game', 'config', 'util', 'world']) {
    const src = fs.readFileSync(new URL(`../src/${f}.js`, import.meta.url), 'utf8');
    assert.match(src, /import \{ DMath as Math[ ,}]/, f + '.js imports DMath as Math');
    assert.equal((src.replace(/\/\/.*$/gm, '').match(/\*\*\s*\d/g) || []).length, 0, f + '.js uses **');
  }
});

test('config: eighteen cultivators, each with a passive, four moves, a seat they suit and two insights', () => {
  assert.equal(HERO_ORDER.length, 18); assert.equal(new Set(HERO_ORDER.map(k => HEROES[k].name)).size, 18, 'names are unique');
  for (const k of HERO_ORDER) {
    const h = HEROES[k]; assert.ok(h, k); assert.equal(h.skills.length, 4, k + ' has four moves'); assert.ok(h.passive && h.passive.name, k + ' passive');
    assert.ok(Array.isArray(SEAT_FIT[k]) && SEAT_FIT[k].length && SEAT_FIT[k].every(i => i >= 0 && i < SEATS.length), k + ' seats');
    assert.ok(INSIGHT[k] && INSIGHT[k].length === INSIGHT_LVL.length, k + ' insights per level');
    for (const tier of INSIGHT[k]) assert.equal(tier.length, 2, k + ' two options per insight');
    for (const s of h.skills) assert.ok(s.name && s.kind && s.mana >= 0, k + ' move ' + s.name);
  }
});
test('config: items — parts exist, costs positive, no item is part of itself', () => {
  for (const [id, it] of Object.entries(ITEMS)) {
    assert.ok(it.cost > 0, id + ' cost'); assert.ok(it.name, id + ' name');
    for (const p of it.parts || []) { assert.ok(ITEMS[p], `${id} part ${p} exists`); assert.notEqual(p, id); }
  }
  for (const k of HERO_ORDER) for (const id of HEROES[k].build || []) assert.ok(ITEMS[id], `${k} build item ${id}`);
});
test('config: per-mode tables keep the author\'s rule (0.90–1.15, ≤0.08 apart between modes)', () => {
  const a = MODES.single.heroTune, b = MODES.tri.heroTune;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) for (const s of new Set([...Object.keys(a[k] || {}), ...Object.keys(b[k] || {})])) {
    const x = (a[k] || {})[s] ?? 1, y = (b[k] || {})[s] ?? 1;
    assert.ok(x >= 0.9 && x <= 1.15 && y >= 0.9 && y <= 1.15, `${k}.${s} in range`); assert.ok(Math.abs(x - y) <= 0.08 + 1e-9, `${k}.${s} gap`);
  }
});
test('config: modes — one路 3 a side, 三路 5 a side, bot difficulties', () => {
  assert.equal(MODES.single.team, 3); assert.equal(MODES.tri.team, 5); assert.equal(SEATS.length, 5);
  for (const d of ['easy', 'normal', 'hard']) assert.ok(T.difficulty[d], d);
});

// the online clock: turns are played in order, commands before the turn's steps, three steps a turn, a fingerprint every
// `hashEvery` turns, "over" once, a big backlog caught up quickly but in bounded slices
function fakeMatch(turns, opts = {}) {
  const N = createNet(), log = [], sent = [];
  N.send = m => { sent.push(m); return true; };
  const G = { byLi: [{ li: 0 }, { li: 1 }], over: false, steps: 0, exec(h, q) { log.push(['cmd', h.li, q.c, G.steps]); }, hash: () => 7, ...opts };
  N.begin({ tpt: 3, hashEvery: 2, log: turns }, G);
  return { N, G, log, sent, step: () => { G.steps++; log.push(['step', G.steps]); } };
}
test('net: commands apply before their turn\'s three steps, in order', () => {
  const m = fakeMatch([[[0, { c: 'move' }]], [], [[1, { c: 'cast' }], [0, { c: 'stop' }]]]);
  m.N.advance(9 / 60 + 1e-6, m.step);
  assert.equal(m.G.steps, 9);
  assert.deepEqual(m.log.filter(e => e[0] === 'cmd'), [['cmd', 0, 'move', 0], ['cmd', 1, 'cast', 6], ['cmd', 0, 'stop', 6]]);
  assert.deepEqual(m.sent.filter(s => s.t === 'hash').map(s => s.k), [2], 'a fingerprint every 2 turns');
});
test('net: starved of turns, the match waits instead of running ahead', () => {
  const m = fakeMatch([[]]); m.N.advance(1, m.step); assert.equal(m.G.steps, 3, 'only the one turn it has');
  m.N.turn({ n: 2, c: [] }); m.N.advance(1 / 60 + 1e-6, m.step); assert.ok(m.G.steps >= 4 && m.G.steps <= 6, 'no banked time: ' + m.G.steps);
});
test('net: a large backlog (rejoining) is caught up in slices of at most 3000 steps a frame', () => {
  const m = fakeMatch(Array.from({ length: 4000 }, () => []));
  const r1 = m.N.advance(1 / 60, m.step); assert.ok(m.G.steps <= 3001 && m.G.steps > 2000, 'first slice ' + m.G.steps); assert.ok(r1.behind > 0);
  for (let i = 0; i < 10 && m.N.match.queue.length; i++) m.N.advance(1 / 60, m.step);
  assert.ok(m.N.match.queue.length <= 3, 'caught up: ' + m.N.match.queue.length + ' turns left');
});
test('net: "over" is reported once', () => {
  const m = fakeMatch(Array.from({ length: 10 }, () => [])); m.G.over = true; m.N.advance(10 / 60, m.step); m.N.advance(10 / 60, m.step);
  assert.equal(m.sent.filter(s => s.t === 'over').length, 1);
});
test('net: the stick and right-click stream is thinned to the latest value, other commands go at once and in order', async () => {
  const N = createNet(), sent = []; N.send = m => { sent.push(m.q); return true; };
  N.cmd({ c: 'dir', dx: 1, dz: 0 }); N.cmd({ c: 'dir', dx: 0, dz: 1 }); N.cmd({ c: 'cast', i: 0, x: 1, z: 1 }); N.cmd({ c: 'move', x: 1, z: 1 }); N.cmd({ c: 'move', x: 2, z: 2 });
  await new Promise(r => setTimeout(r, 80));
  assert.deepEqual(sent.map(q => q.c + (q.dz ?? q.x ?? q.i ?? '')), ['dir1', 'cast1', 'move2']);
});

// the hub's per-address limits, with fake sockets (no network): the public is limited, this machine (the tests) is not
import { createHub } from '../server/hub.mjs';
const fakeWs = () => { const w = { readyState: 1, out: [], send(t) { w.out.push(JSON.parse(t)); }, close() { w.readyState = 3; } }; return w; };
test('hub: an address opening rooms too fast is told to wait; loopback (tests) is not limited', () => {
  for (const [ip, limited] of [['203.0.113.9', true], ['127.0.0.1', false]]) {
    const H = createHub({ log: () => {} }), ws = fakeWs(); H.open(ws, ip); H.message(ws, JSON.stringify({ t: 'hello', name: '测' }));
    for (let i = 0; i < 7; i++) H.message(ws, JSON.stringify({ t: 'create', mode: 'single' }));
    const refused = ws.out.some(m => m.t === 'err' && /频繁/.test(m.msg));
    assert.equal(refused, limited, ip); for (const r of H.rooms.values()) if (r.game) clearInterval(r.game.timer);
  }
});
test('hub: more than 8 connections from one public address are refused', () => {
  const H = createHub({ log: () => {} }); const res = Array.from({ length: 10 }, () => H.open(fakeWs(), '198.51.100.7'));
  assert.equal(res.filter(Boolean).length, 8);
});
