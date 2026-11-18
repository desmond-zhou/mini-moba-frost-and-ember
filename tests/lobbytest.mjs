// lobbytest.mjs — the lobby and the room as a person uses them, in two browsers against the room server on this machine
// (dev page http://localhost:5179 → ws://localhost:8790). node tests/lobbytest.mjs
// Covers: lobby chat by button, opening a room (four-digit number), copy-invite feedback, an invitee with no name is asked for
// one and then lands in the room, renaming in the room, room chat by button, the ready row and the ten-second countdown, the
// host's separate 立即开战 (it starts at once, ready or not: checked in servertest.mjs),
// the match starting by itself, and people's names over their heads as 名字（修士）.
import puppeteer from 'puppeteer-core';
const BASE = process.env.BASE || 'http://localhost:5179/', sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, what) => { console.log((c ? 'ok   ' : 'FAIL ') + what); if (!c) fails++; };
const L = () => puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 120000, args: ['--no-sandbox', '--enable-webgl'] });
const errs = [];
const mk = async (b, name, q = '', w = 1280, h = 760) => {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h }); p.on('pageerror', e => errs.push(e.message));
  if (name) await p.evaluateOnNewDocument(n => localStorage.setItem('frostember.name', n), name);
  await p.goto(BASE + '?dyn=0&q=low' + q, { waitUntil: 'load' }); await p.waitForFunction(() => document.getElementById('boot').classList.contains('done'), { timeout: 30000 }); return p;
};
const a = await L(), b = await L();
try {
  const A = await mk(a, '小明'); await A.click('#netBtn'); await A.waitForFunction(() => document.querySelector('#lbOnline').textContent.includes('在线'), { timeout: 8000 });
  await A.type('#lbIn', '用按钮发送'); await A.click('#lbSend'); await sleep(500);
  ok((await A.$eval('#lbLog', e => e.textContent)).includes('小明用按钮发送'), 'lobby chat sends with the button');
  ok(await A.$eval('#nStatus', e => !e.textContent.includes('道号')), 'no stale "起个道号" message once named');
  await A.click('#nCreate1'); await A.waitForSelector('#room .rhead b'); const code = await A.$eval('#room .rhead b', e => e.textContent);
  ok(/^\d{4}$/.test(code), 'room number is four digits: ' + code);
  await A.click('#room [data-a=copy]'); await sleep(400);
  ok((await A.$eval('#room [data-a=copy]', e => e.textContent)).includes('已复制') || (await A.$eval('#ttoast', e => e.textContent)).includes(code), 'copy invite gives feedback');
  ok((await A.$eval('#ttoast', e => e.textContent)).includes(`?room=${code}`), 'the invite is a link to the public site with the room number');
  const B = await mk(b, '', '&room=' + code, 390, 844); await sleep(2000);
  ok(await B.$eval('#netPane', e => !e.hidden) && (await B.$eval('#nStatus', e => e.textContent)).includes(code), 'an invitee with no name is asked for one (and told which room)');
  await B.type('#nName', '阿华'); await B.keyboard.press('Enter');
  await B.waitForSelector('#room .seat.mine', { timeout: 8000 }).catch(() => null);
  ok(await B.evaluate(() => !document.getElementById('room').hidden && document.querySelector('#room .seat.mine b').textContent.startsWith('阿华')), 'after naming, the invitee is in the room');
  await A.$eval('#room .rname', e => { e.value = ''; }); await A.type('#room .rname', '小明二号'); await A.keyboard.press('Enter'); await sleep(800);
  ok((await B.evaluate(() => [...document.querySelectorAll('#room .seat b')].map(b => b.textContent).join('|'))).includes('小明二号（'), 'renaming in the room shows to the other as 名字（…）');
  await A.type('#room .rsay', '房间里点发送'); await A.click('#room .rsend'); await sleep(600);
  ok((await B.$eval('#room .rchat .log', e => e.textContent)).includes('房间里点发送'), 'room chat sends with the button');
  ok((await A.$eval('#room .rwait', e => e.textContent)).includes('选一位修士'), 'ready row asks you to pick first');
  await A.click('.card[data-k="warden"]'); await B.click('.card[data-k="mage"]'); await sleep(500);
  await A.click('#room .rready'); await sleep(400);
  ok((await A.$eval('#room .rwait', e => e.textContent)).includes('阿华'), 'ready row names who is still being waited for');
  ok(await A.$eval('#room .rstart', e => !e.hidden && getComputedStyle(e).borderStyle === 'dashed') && await B.$eval('#room .rstart', e => e.hidden), '立即开战: only the host has it, and it looks unlike 准备');

  await B.click('#room .rready'); await sleep(800);
  ok((await A.$eval('#room .rwait', e => e.textContent)).includes('秒后开战'), 'everyone ready → countdown shows');
  await B.click('#room .rready'); await sleep(800);
  ok(!(await A.$eval('#room .rwait', e => e.textContent)).includes('秒后开战'), 'un-ready → countdown gone');
  await B.click('#room .rready'); const t0 = Date.now();
  await A.waitForFunction(() => window.__moba.G && window.__moba.G.net, { timeout: 15000 }); const dt = (Date.now() - t0) / 1000;
  ok(dt > 8 && dt < 13, `the match starts by itself after the countdown (${dt.toFixed(1)} s)`);
  await sleep(4000);
  const tags = await A.evaluate(() => [...document.querySelectorAll('.nametag:not([hidden])')].map(e => e.textContent));
  ok(tags.some(t => t === '小明二号（韩不语）'), 'own name tag reads 名字（修士）: ' + tags.join(', '));
  ok(await A.evaluate(() => { const G = window.__moba.G; return G.heroes.filter(h => !h.pname).every(h => G.nm(h) === h.name); }), 'bots are named by their cultivator alone');
  await A.screenshot({ path: 'runs/lobbytest_game.png' });
} catch (e) { ok(false, 'unexpected: ' + e.message); }
ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' / ') : ''));
await Promise.race([Promise.all([a.close(), b.close()]), sleep(3000)]);
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
