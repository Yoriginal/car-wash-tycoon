// Build : assemble src/ en deux sorties
//   dist/                  -> PWA publiée sur GitHub Pages
//   build/artifact.html    -> version autonome (archive, plus publiée dans Claude)
//
// Assemblage de la page :
//   src/body.html          squelette, avec les marqueurs /*STYLE*/ /*ENGINE*/ /*APP*/
//   src/assets/tokens.css  + src/style.css
//   src/engine.js          moteur (jamais modifié par l'interface)
//   src/assets/**.svg      -> objet ASSETS (graphismes) + ASSET_DEFS (définitions communes)
//   src/ui/*.js            modules d'interface, concaténés par ordre alphabétique dans une seule portée
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// PREVIEW=1 : build de l'aperçu (servi dans /preview/), avec nom et bandeau distincts
const PREVIEW = process.env.PREVIEW === '1';
const read = p => readFileSync(join(root, p), 'utf8');
const pkg = JSON.parse(read('package.json'));

// --- graphismes ---
const assets = {};
let assetBytes = 0;
for (const dir of ['equipements', 'monde', 'icones', 'ui']) {
  const d = join(root, 'src/assets', dir);
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d).filter(f => f.endsWith('.svg')).sort()) {
    const svg = readFileSync(join(d, f), 'utf8').trim();
    assets[`${dir}/${f.replace(/\.svg$/, '')}`] = svg;
    assetBytes += svg.length;
  }
}
const defs = existsSync(join(root, 'src/assets/defs.svg')) ? read('src/assets/defs.svg').trim() : '';
const assetJs = `const APP_VERSION = ${JSON.stringify(pkg.version)};\nconst ASSET_DEFS = ${JSON.stringify(defs)};\nconst ASSETS = ${JSON.stringify(assets)};\n`;

// --- interface ---
const uiFiles = readdirSync(join(root, 'src/ui')).filter(f => f.endsWith('.js')).sort();
const ui = uiFiles.map(f => `// ===== ${f} =====\n` + read(`src/ui/${f}`)).join('\n');
const app = `(() => {\n'use strict';\n${assetJs}\n${ui}\n})();`;

const tokens = existsSync(join(root, 'src/assets/tokens.css')) ? read('src/assets/tokens.css') : '';
const engine = read('src/engine.js').replace("if (typeof module !== 'undefined') module.exports = E;", '');
const page = read('src/body.html')
  .replace('/*STYLE*/', () => tokens + '\n' + read('src/style.css'))
  .replace('/*ENGINE*/', () => engine)
  .replace('/*APP*/', () => app);

// archive autonome
mkdirSync(join(root, 'build'), { recursive: true });
writeFileSync(join(root, 'build/artifact.html'), page);

// PWA
const dist = join(root, 'dist');
if (existsSync(dist)) rmSync(dist, { recursive: true });
mkdirSync(dist);
let head = read('pwa/head.html');
if (PREVIEW) head = head.replace('content="Car Wash"', 'content="CW Aperçu"').replace('</head>', '<script>window.CWT_PREVIEW = true;</script>\n</head>');
const index = head + page + read('pwa/tail.html');
writeFileSync(join(dist, 'index.html'), index);
const hash = createHash('sha1').update(index).digest('hex').slice(0, 10);
writeFileSync(join(dist, 'sw.js'), read('pwa/sw.js').replace('__VERSION__', hash).replace('__CHANNEL__', PREVIEW ? 'preview' : 'main'));
const manifest = JSON.parse(read('pwa/manifest.webmanifest'));
if (PREVIEW) { manifest.name = 'Car Wash Tycoon — Aperçu'; manifest.short_name = 'CW Aperçu'; }
writeFileSync(join(dist, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));
cpSync(join(root, 'pwa/icons'), join(dist, 'icons'), { recursive: true });
writeFileSync(join(dist, '.nojekyll'), '');

console.log(`Build OK${PREVIEW ? ' (aperçu)' : ''} : version ${pkg.version}, cache ${hash}, page ${(index.length / 1024).toFixed(0)} Ko dont graphismes ${(assetBytes / 1024).toFixed(0)} Ko, ${uiFiles.length} modules`);
