// run.mjs — every automated check in one go, with a summary. npm run test:quick (about 6 minutes) / npm run test:all (about 25).
// Starts what it needs on this machine (the dev page on :5179, the room server on :8790) and never touches the public server.
// Rule: whenever a problem is found by hand, add a check for it to one of these suites, so the suite keeps growing.
import { spawn } from 'node:child_process'; import net from 'node:net'; import fs from 'node:fs';   // each suite's whole output is kept in runs/suite_*.log
const full = process.argv.includes('--all');
const busy = port => new Promise(r => { const s = net.connect(port, '127.0.0.1'); s.on('connect', () => { s.end(); r(true); }); s.on('error', () => r(false)); });
const started = [];
if (!(await busy(5179))) started.push(spawn('node', ['serve.mjs'], { stdio: 'ignore' }));
if (!(await busy(8790))) started.push(spawn('node', ['server/server.mjs'], { stdio: 'ignore' }));
await new Promise(r => setTimeout(r, 1200));
const run = (cmd, args, env = {}, check = out => true) => new Promise(res => {
  const t0 = Date.now(), p = spawn(cmd, args, { env: { ...process.env, ...env } }); let out = '';
  p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; });
  p.on('close', code => { fs.writeFileSync(`runs/suite_${args.join('_').replace(/[^\w.-]+/g, '_').slice(0, 60)}.log`, out); res({ ok: code === 0 && check(out), code, out, secs: Math.round((Date.now() - t0) / 1000) }); });
});
const smoke = mode => out => /^sim: \{/m.test(out) && !/PAGEERROR|SIMERR|"fatal":"[^"]/.test(out);
const suites = [
  ['room server rules (protocol)', 'node', ['servertest.mjs']],
  ['single player smoke · 一路', 'node', ['test.mjs', 'auto=mage&bot=1&dyn=0&mode=single', 'runs/smoke_s.png', '90'], {}, smoke('single')],
  ['single player smoke · 三路', 'node', ['test.mjs', 'auto=mage&bot=1&dyn=0&mode=tri', 'runs/smoke_t.png', '90'], {}, smoke('tri')],
  ['same result on every machine · 一路', 'node', ['dettest.mjs', 'single', full ? '1200' : '300']],
  ['same result on every machine · 三路', 'node', ['dettest.mjs', 'tri', full ? '1500' : '300']],
  ['lobby and room, as a person uses them', 'node', ['tests/lobbytest.mjs']],
  ['chat, signals and 开团 between allies', 'node', ['chattest.mjs', 'http://localhost:5179/']],
  ['online match, people clicking about, drop and rejoin · 一路', 'node', ['nettest.mjs', 'single', '45', 'runs/t_single'], { HUMAN: '1' }, out => /desync seen by client: 0/.test(out) && /after rejoin/.test(out)],
];
if (full) suites.push(
  ['online match, people clicking about, drop and rejoin · 三路', 'node', ['nettest.mjs', 'tri', '90', 'runs/t_tri'], { HUMAN: '1' }, out => /desync seen by client: 0/.test(out) && /after rejoin/.test(out)],
  ['a whole online match to the end and back to the room', 'node', ['nettest.mjs', 'single', '15', 'runs/t_end'], { TOEND: '1', RECONNECT: '0' }, out => /back in room \d{4}/.test(out) && /desync seen by client: 0/.test(out)],
);
const results = [];
for (const [name, cmd, args, env, check] of suites) {
  process.stdout.write(`… ${name}\r`);
  const r = await run(cmd, args, env, check); results.push([name, r]);
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${name}  (${r.secs} s)`);
  if (!r.ok) console.log(r.out.split('\n').filter(l => /FAIL|Error|DIFF|PAGEERROR|desync/.test(l)).slice(0, 8).map(l => '      ' + l.slice(0, 200)).join('\n'));
}
for (const p of started) p.kill();
const bad = results.filter(([, r]) => !r.ok).length;
console.log(`\n${results.length - bad}/${results.length} suites passed`); process.exit(bad ? 1 : 0);
