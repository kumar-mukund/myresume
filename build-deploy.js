/* Prepares a public-safe copy for deployment (e.g. Netlify) — strips the
   hardcoded NVIDIA API key out of master_resume_builder.html before it goes
   anywhere public. Your local file is untouched; only dist/index.html
   (the deployed copy) loses the key. Visitors of the deployed site type
   their own key into the Ask AI widget instead, same as before it was
   hardcoded locally.

   Run: node build-deploy.js */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'master_resume_builder.html');
const OUT_DIR = path.join(__dirname, 'dist');
const OUT = path.join(OUT_DIR, 'index.html');

let html = fs.readFileSync(SRC, 'utf8');

const keyPattern = /const CHAT_DEFAULT_API_KEY = '[^']*';/;
if (!keyPattern.test(html)) {
  console.error('Could not find CHAT_DEFAULT_API_KEY in the source file — aborting so nothing gets deployed with an unexpected key.');
  process.exit(1);
}
html = html.replace(keyPattern, "const CHAT_DEFAULT_API_KEY = '';");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html);

// Check for a real key (a long nvapi- token), not the harmless "nvapi-..." placeholder hint in the input field.
const stillHasKey = /nvapi-[A-Za-z0-9_-]{20,}/.test(html);
console.log(stillHasKey ? '⚠ WARNING: a real-looking API key is still present in the output — check before deploying.' : '✓ No API key present in dist/index.html.');
console.log('Wrote', OUT);
