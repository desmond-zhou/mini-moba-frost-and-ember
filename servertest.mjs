// servertest.mjs — the room server's rules, checked over its own protocol (no browser): node servertest.mjs [ws url]
// Starts nothing: point it at a running server (default the one on this machine, ws://localhost:8790/ws).
import WebSocket from 'ws';
const URL_ = process.argv[2] || 'ws://localhost:8790/ws', sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, what) => { console.log((c ? 'ok   ' : 'FAIL ') + what); if (!c) fails++; };
function client(name, v = 'test', cid) {
  const ws = new WebSocket(URL_), C = { ws, got: [], last: {}, name };
  ws.on('message', d => { const m = JSON.parse(d); C.got.push(m); C.last[m.t] = m; });
  C.send = m => ws.send(JSON.stringify(m));
  C.ready = new Promise(r => ws.on('open', () => { C.send({ t: 'hello', name, v, cid }); r(); }));
  C.wait = async (t, pred = () => true, ms = 4000) => { const t0 = Date.now(); for (;;) { const m = [...C.got].reverse().find(x => x.t === t && pred(x)); if (m) return m; if (Date.now() - t0 > ms) return null; await sleep(30); } };
  C.clear = () => { C.got = []; };
  return C;
}
const A = client('甲'), B = client('乙'); await A.ready; await B.ready;
ok(await A.wait('welcome'), 'hello → welcome'); const cidB = (await B.wait('welcome')).cid; ok(await A.wait('lobby'), 'hello → lobby list');
// lobby chat
B.send({ t: 'lchat', text: '大厅有人吗' }); ok(await A.wait('lchat', m => m.line && m.line.text === '大厅有人吗'), 'lobby chat reaches others');
// rooms: four digits, listed in the lobby
A.send({ t: 'create', mode: 'single' }); const room = await A.wait('room'); ok(room && /^\d{4}$/.test(room.code), 'room number is four digits: ' + (room && room.code));
ok(await B.wait('lobby', m => m.rooms.some(r => r.code === room.code)), 'the new room shows in the lobby');
// names are unique in a room
const B2 = client('甲', 'test'); await B2.ready; await B2.wait('lobby'); B2.send({ t: 'join', code: room.code });
const r2 = await B2.wait('room'); ok(r2 && r2.members.map(m => m.name).sort().join() === '甲,甲2', 'a second 甲 becomes 甲2');
B2.send({ t: 'leave' }); await B2.wait('left');
// another version may not join
const O = client('旧版', 'other'); await O.ready; await O.wait('lobby'); O.send({ t: 'join', code: room.code });
ok(await O.wait('err', m => /版本/.test(m.msg)), 'a page with other rules is turned away'); O.ws.close();
// wrong code
B.send({ t: 'join', code: '0000' === room.code ? '0001' : '0000' }); ok(await B.wait('err', m => /没有/.test(m.msg)), 'unknown room number → error');
// join, pick, ready, countdown, cancel, ready again → the match starts by itself
B.send({ t: 'join', code: room.code }); await B.wait('room', m => m.members.length === 2);
A.send({ t: 'hero', id: 'warden' }); B.send({ t: 'hero', id: 'warden' }); await sleep(300);
const rv = await A.wait('room'); const heroes = rv.seats.flat().filter(q => q.hero).map(q => q.hero);
ok(heroes.length === 1, '一路: the same cultivator cannot be taken twice');
B.send({ t: 'hero', id: 'mage' }); await sleep(200);
A.send({ t: 'ready', on: true }); B.send({ t: 'ready', on: true });
ok(await A.wait('room', m => m.countIn > 8000), 'everyone ready → countdown of ten seconds');
B.send({ t: 'ready', on: false }); ok(await A.wait('room', m => m.countIn === 0 && m.seats.flat().some(q => q && q.cid && !q.ready)), 'someone un-readies → countdown cancelled');
B.send({ t: 'ready', on: true }); A.clear(); B.clear();
const st = await A.wait('start', () => true, 13000); ok(st && st.lineup.length === 6 && st.lineup.filter(q => q.human).length === 2, 'after ten seconds the match starts, bots fill the other four');
const bst = await B.wait('start'); ok(bst && bst.seed === st.seed && bst.me !== st.me, 'both get the same seed, each their own seat');
ok(await A.wait('turn', m => m.n > 5), 'turns arrive');
// commands: a valid one is passed on, a bad one dropped
A.send({ t: 'cmd', q: { c: 'move', x: 1.234567, z: 2 } }); A.send({ t: 'cmd', q: { c: 'nuke' } }); A.send({ t: 'cmd', q: { c: 'cast', i: 9, x: 0, z: 0 } });
const tc = await B.wait('turn', m => m.c.length > 0); ok(tc && tc.c.length === 1 && tc.c[0][1].c === 'move' && tc.c[0][1].x === 1.23, 'commands: valid passed on (rounded), invalid dropped');
// team chat stays in the team (A and B are on different sides in this room? check by seat)
// fingerprints: a mismatch is reported to the room
A.send({ t: 'hash', k: 40, h: 1 }); B.send({ t: 'hash', k: 40, h: 2 }); ok(await A.wait('desync'), 'differing fingerprints → desync reported');
// a drop hands the seat to the bot; coming back replays the match
B.ws.close(); const bot = await A.wait('turn', m => m.c.some(([, q]) => q.c === 'bot' && q.on)); ok(bot, 'a dropped player → bot takes the seat');
const B3 = client('乙', 'test', cidB); await B3.ready; const back = await B3.wait('start'); ok(back && back.log.length > 0, 'rejoin with the same id → start + the turn log (' + (back && back.log.length) + ' turns)');
ok(await A.wait('turn', m => m.c.some(([, q]) => q.c === 'bot' && q.on === false)), 'back → the seat is a person again');
// the same id in a second page: the first is told it was replaced and not to come back
const B4 = client('乙', 'test', cidB); await B4.ready; ok(await B3.wait('kicked'), 'second page with the same id → the first gets "kicked"');
// over → room back to the lobby after a while (12 s)
A.clear(); A.send({ t: 'over', w: 0 }); ok(await A.wait('room', m => m.state === 'lobby', 15000), 'after the match the room returns to waiting');
// limits: a flood closes the socket
const F = client('刷屏'); await F.ready; await F.wait('lobby'); let closed = false; F.ws.on('close', () => { closed = true; });
for (let i = 0; i < 400; i++) F.send({ t: 'ping', c: i }); await sleep(500); ok(closed, 'flooding (400 messages at once) → disconnected');
// leaving: the last one out closes the room
A.send({ t: 'leave' }); B4.send({ t: 'leave' }); await sleep(500);
const L = client('看客'); await L.ready; const lv = await L.wait('lobby'); ok(lv && !lv.rooms.some(r => r.code === room.code), 'the last one out closes the room'); if (lv) console.log('     rooms left:', JSON.stringify(lv.rooms.map(r => [r.code, r.state, r.seats.flat().filter(Boolean).map(q => q.name)])));
for (const c of [A, B4, L]) c.ws.close();
// 立即开战: the host may skip the countdown once everyone else is ready, not before
const H = client('房主'), G2 = client('客人'); await H.ready; await G2.ready; await H.wait('lobby'); await G2.wait('lobby');
H.send({ t: 'create', mode: 'single' }); const hr = await H.wait('room'); G2.send({ t: 'join', code: hr.code }); await G2.wait('room');
H.send({ t: 'hero', id: 'storm' }); G2.send({ t: 'hero', id: 'archer' }); await sleep(300);
H.clear(); H.send({ t: 'start' });
const hs = await H.wait('start', () => true, 1500); ok(hs, '立即开战 starts at once, even though nobody pressed 准备 (someone may have forgotten)');
for (const c of [H, G2]) c.ws.close();
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0);
