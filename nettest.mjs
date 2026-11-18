// nettest.mjs — two players through the real lobby and a real online match (server/server.mjs must be running on :8790).
// node nettest.mjs [mode] [seconds] [shots-prefix]   → room code, the lobby and in-match screenshots, desync check from the server log
import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const [mode = 'tri', secs = '60', shot = 'net'] = process.argv.slice(2);
const BASE = process.env.BASE || 'http://localhost:5179/';
const QS = process.env.SERVER ? '&server=' + encodeURIComponent(process.env.SERVER) : '';     // SERVER=wss://host:port/ws: test against that server
const BOT = process.env.HUMAN ? '' : 'netbot=1&';                  // HUMAN=1: instead of handing the seat to the bot, click about like a person
const launch = () => puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function client(name, url, size = [1280, 760]) {
  const b = await launch(), p = await b.newPage(); await p.setViewport({ width: size[0], height: size[1] });
  p.on('pageerror', e => console.error(name, 'PAGEERROR', e.message)); p.on('console', m => { if (m.type() === 'error') console.error(name, 'console', m.text().slice(0, 200)); });
  await p.evaluateOnNewDocument(n => { localStorage.setItem('frostember.name', n); }, name);
  await p.goto(url, { waitUntil: 'load' }); await sleep(1500); return { b, p };
}
const A = await client('甲', BASE + `?${BOT}dyn=0&q=low${QS}`);
await A.p.click('#netBtn'); await sleep(400);
await A.p.click(mode === 'tri' ? '#nCreate3' : '#nCreate1');
await A.p.waitForSelector('#room .rhead b', { timeout: 8000 });
const code = await A.p.$eval('#room .rhead b', e => e.textContent); console.log('room', code);
const B = await client('乙', BASE + `?room=${code}&${BOT}dyn=0&q=low${QS}`, [390, 844]);
await B.p.waitForSelector('#room .seat.mine', { timeout: 8000 });
await B.p.click('.card[data-k="mage"]'); await sleep(300); await B.p.click('#goBtn'); await sleep(300);
await A.p.click('.card[data-k="warden"]'); await sleep(600);
await A.p.screenshot({ path: shot + '_lobby.png' }); await B.p.screenshot({ path: shot + '_lobby_phone.png' });
await A.p.click('#goBtn');
await A.p.waitForFunction(() => window.__moba.G && window.__moba.G.net, { timeout: 25000 }); await B.p.waitForFunction(() => window.__moba.G && window.__moba.G.net, { timeout: 25000 });
console.log('started');
if (process.env.HUMAN) for (const p of [A.p, B.p]) await p.evaluate(() => {   // a restless player: moves, casts, learns, buys, signals
  const m = window.__moba, ids = ['jian', 'zhang', 'jia', 'fu', 'huiyuan', 'xuening', 'qingfeng', 'xingwen', 'zhenxue', 'xingdun'];
  setInterval(() => { const G = m.G; if (!G || G.over) return; const h = G.player, r = Math.random(), x = h.x + (Math.random() - 0.5) * 30, z = h.z + (Math.random() - 0.5) * 20;
    if (r < 0.45) G.cmdMove(x, z); else if (r < 0.7) G.castAt(Math.floor(Math.random() * 4), x, z); else if (r < 0.8) G.learn(Math.floor(Math.random() * 4)); else if (r < 0.88) G.buy(ids[Math.floor(Math.random() * ids.length)]);
    else if (r < 0.92) G.signal(['gather', 'attack', 'retreat'][Math.floor(Math.random() * 3)], x, z); else if (r < 0.95) G.cmdAttackMove(x, z); else if (r < 0.97) G.recall(); else G.chooseInsight(Math.random() < 0.5 ? 0 : 1); }, 250);
});
const info = p => p.evaluate(() => { const G = window.__moba.G; return G ? { t: +G.t.toFixed(1), tick: G.tick, me: G.player.pname + '/' + G.player.def.id + '/t' + G.player.team, kills: G.kills.join(':'), humans: G.heroes.filter(h => h.pname).map(h => h.pname + (h.isPlayer ? '' : '(托管)')).join(',') } : null; });
for (let t = 0; t < +secs; t += 15) { await sleep(15000); console.log(t + 15, JSON.stringify(await info(A.p)), JSON.stringify(await info(B.p))); }
await A.p.screenshot({ path: shot + '_game.png' }); await B.p.screenshot({ path: shot + '_game_phone.png' });
// B drops out and comes back
if (process.env.RECONNECT !== '0') {
  await B.p.close(); console.log('B closed'); await sleep(6000);
  const p2 = await B.b.newPage(); await p2.setViewport({ width: 390, height: 844 }); p2.on('pageerror', e => console.error('乙2 PAGEERROR', e.message));
  await p2.goto(BASE + `?${BOT}dyn=0&q=low${QS}`, { waitUntil: 'load' });
  await p2.waitForFunction(() => window.__moba.G && window.__moba.G.net && window.__moba.G.t > 5, { timeout: 30000 });
  await sleep(8000); console.log('after rejoin', JSON.stringify(await info(A.p)), JSON.stringify(await info(p2)));
  await p2.screenshot({ path: shot + '_rejoin_phone.png' });
}
if (process.env.TOEND) {                                                // play it out: the end screen, then back to the room
  for (let i = 0; i < 1200 && await A.p.evaluate(() => document.getElementById('end').hidden); i++) await sleep(3000);
  console.log('end', JSON.stringify(await info(A.p))); await A.p.screenshot({ path: shot + '_end.png' });
  await sleep(14000); await A.p.click('#endRoom'); await sleep(1500); await A.p.screenshot({ path: shot + '_back.png' });
  console.log('back in room', await A.p.evaluate(() => !document.getElementById('room').hidden && document.querySelector('#room .rhead b').textContent));
}
const log = process.env.SERVER ? '' : fs.readFileSync('runs/server.log', 'utf8').split('\n').slice(-12).join('\n'); console.log(log);
const desync = await A.p.evaluate(() => window.__desync || 0); console.log('desync seen by client:', desync);
const mine = log.split('\n').filter(l => l.includes(' ' + code + ' '));                       // only this match's lines: other tests (servertest) make a desync on purpose
await Promise.race([Promise.all([A.b.close(), B.b.close()]), sleep(3000)]); process.exit(desync || mine.some(l => /DESYNC/.test(l)) ? 1 : 0);
