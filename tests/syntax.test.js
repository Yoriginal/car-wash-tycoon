// Vérifie que la page construite contient un JavaScript valide et les fichiers PWA attendus.
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '..');
require('node:child_process').execSync('node scripts/build.mjs', { cwd: root, stdio: 'inherit' });
let fail = 0;
const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach((code, i) => { try { new Function(code); } catch (e) { console.error(`  ✗ script ${i} invalide : ${e.message}`); fail++; } });
for (const f of ['dist/sw.js', 'dist/manifest.webmanifest', 'dist/icons/icon-192.png', 'dist/icons/icon-512.png', 'dist/icons/icon-180.png', 'build/artifact.html']) {
  if (!existsSync(join(root, f))) { console.error('  ✗ manquant : ' + f); fail++; }
}
JSON.parse(readFileSync(join(root, 'dist/manifest.webmanifest'), 'utf8'));
if (fail) { process.exitCode = 1; } else console.log(`  ✓ ${scripts.length} scripts valides, fichiers PWA présents`);
