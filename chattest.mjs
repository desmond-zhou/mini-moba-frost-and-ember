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
console.log('B sees room chat:', await B.$eval('#room .rchat .log', e => e.textContent.includes('房间里说话')));
await B.click('.card[data-k="mage"]'); await B.click('#goBtn'); await A.click('.card[data-k="warden"]'); await sleep(600); await A.click('#goBtn');
await A.waitForFunction(() => window.__moba.G && window.__moba.G.net, { timeout: 15000 }); await B.waitForFunction(() => window.__moba.G && window.__moba.G.net, { timeout: 15000 }); await sleep(3000);
console.log('same side:', await A.evaluate(() => window.__moba.G.player.team) === await B.evaluate(() => window.__moba.G.player.team));
// 小明: a signal, 开团, and a line of team chat (Enter, type, Enter)
await A.evaluate(() => { const G = window.__moba.G; G.signal('attack', G.player.x + 8, G.player.z); }); await sleep(1500);
await A.evaluate(() => window.__moba.G.setRally(true)); await sleep(1500);
await A.keyboard.press('Enter'); await A.keyboard.type('跟我上中路'); await A.keyboard.press('Enter'); await sleep(1500);
const seen = await B.evaluate(() => { const G = window.__moba.G; return { pings: G.pings.map(p => p.type), rallyBy: G.rallyBy.map(h => h && h.pname), chat: document.getElementById('chat').textContent, toast: document.getElementById('toast').textContent }; });
console.log('B sees:', JSON.stringify(seen));
await B.screenshot({ path: 'runs/chat_B.png' });
await a.close(); await b.close();
