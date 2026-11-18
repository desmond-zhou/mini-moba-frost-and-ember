// chattest.mjs — two players on the same side through the real server: room chat, in-match team chat, signals and 开团 seen by the other.
// node chattest.mjs [base]   (default the public site)
import puppeteer from 'puppeteer-core';
const BASE = process.argv[2] || 'https://moba.app.desmondzhou.com/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const L = () => puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 300000, args: ['--no-sandbox', '--enable-webgl'] });
const mk = async (b, name) => { const p = await b.newPage(); await p.setViewport({ width: 1280, height: 760 }); p.on('pageerror', e => console.log(name, 'PAGEERROR', e.message));
  await p.evaluateOnNewDocument(n => localStorage.setItem('frostember.name', n), name); await p.goto(BASE + '?dyn=0&q=low', { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('boot').classList.contains('done'), { timeout: 30000 }); return p; };
const a = await L(), b = await L(), A = await mk(a, '小明'), B = await mk(b, '阿华');
await A.click('#netBtn'); await sleep(2500); await A.click('#nCreate1'); await A.waitForSelector('#room .rhead b'); const code = await A.$eval('#room .rhead b', e => e.textContent);
await B.click('#netBtn'); await sleep(2500); await B.click(`.lbr[data-code="${code}"]`); await B.waitForSelector('#room .seat.mine');
await B.click('#room .tf .seat.empty'); await sleep(800);                                    // move to the frost side, next to 小明
await A.type('#room .rchat input', '房间里说话'); await A.keyboard.press('Enter'); await sleep(800);
let fails = 0; const ok = (c, what) => { console.log((c ? 'ok   ' : 'FAIL ') + what); if (!c) fails++; };
ok(await B.$eval('#room .rchat .log', e => e.textContent.includes('房间里说话')), 'room chat reaches the other player');
await B.click('.card[data-k="mage"]'); await B.click('#goBtn'); await A.click('.card[data-k="warden"]'); await sleep(600); await A.click('#goBtn');
await A.waitForFunction(() => window.__moba.G && window.__moba.G.net, { timeout: 25000 }); await B.waitForFunction(() => window.__moba.G && window.__moba.G.net, { timeout: 25000 }); await sleep(3000);
ok(await A.evaluate(() => window.__moba.G.player.team) === await B.evaluate(() => window.__moba.G.player.team), 'both on the same side');
// 小明: a signal, 开团, and a line of team chat (Enter, type, Enter)
await A.evaluate(() => { const G = window.__moba.G; G.signal('attack', G.player.x + 8, G.player.z); }); await sleep(1500);
await A.evaluate(() => window.__moba.G.setRally(true)); await sleep(1500);
await A.keyboard.press('Enter'); await A.keyboard.type('跟我上中路'); await A.keyboard.press('Enter'); await sleep(1500);
const seen = await B.evaluate(() => { const G = window.__moba.G; return { pings: G.pings.map(p => p.type), rallyBy: G.rallyBy.map(h => h && h.pname), chat: document.getElementById('chat').textContent, toast: document.getElementById('toast').textContent }; });
ok(seen.toast.includes('小明（韩不语）') && seen.toast.includes('进攻'), 'a signal shows to the ally as 小明（韩不语）：进攻！');
ok(seen.rallyBy.includes('小明'), '开团 reaches the ally');
ok(seen.chat.includes('小明（韩不语）跟我上中路'), 'team chat shows as 小明（韩不语）…');
await B.screenshot({ path: 'runs/chat_B.png' });
await Promise.race([Promise.all([a.close(), b.close()]), sleep(3000)]);
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
