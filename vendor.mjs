// vendor.mjs — the dev server serves plain ES modules, but Tone.js pulls in packages with bare imports. Bundle it once into
// vendor/tone.js for the import map (`npm run dev` does this). The release build bundles from node_modules directly.
import { build } from 'esbuild';
await build({ entryPoints: ['node_modules/tone/build/esm/index.js'], bundle: true, format: 'esm', outfile: 'vendor/tone.js', minify: true, legalComments: 'none', logLevel: 'error' });
