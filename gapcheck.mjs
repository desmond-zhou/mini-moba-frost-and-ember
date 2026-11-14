// gapcheck.mjs — the author's rule for the two per-mode tables: every multiplier within 0.90–1.15, and the same stat for the
// same cultivator no more than 0.08 apart between modes. Exits 1 if any entry breaks it.   node gapcheck.mjs
import { MODES } from './src/config.js';
const a = MODES.single.heroTune, b = MODES.tri.heroTune; let bad = 0;
for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) for (const k of ['hp', 'ad', 'ap', 'pow']) {
  const x = (a[id] || {})[k] || 1, y = (b[id] || {})[k] || 1;
  if (Math.abs(x - y) > 0.0801 || Math.min(x, y) < 0.9 || Math.max(x, y) > 1.15) { bad++; console.log(`${id}.${k}: single ${x}, tri ${y}`); }
}
console.log(bad ? `${bad} entries break the rule` : 'both tables within the rule'); process.exit(bad ? 1 : 0);
