// Build : assemble src/ en deux sorties
//   dist/                  -> PWA publiée sur GitHub Pages
//   build/artifact.html    -> version publiée dans Claude (artifact)
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// PREVIEW=1 : build de l'aperçu (servi dans /preview/), avec nom et bandeau distincts
const PREVIEW = process.env.PREVIEW === '1';
const read = p => readFileSync(join(root, p), 'utf8');

const engine = read('src/engine.js').replace("if (typeof module !== 'undefined') module.exports = E;", '');
const page = read('src/body.html')
  .replace('/*STYLE*/', () => read('src/style.css'))
  .replace('/*ENGINE*/', () => engine)
  .replace('/*APP*/', () => read('src/app.js'));

// artifact Claude
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

const version = (engine.match(/GAME_VERSION = '([^']+)'/) || [])[1];
console.log(`Build OK${PREVIEW ? ' (aperçu)' : ''} : version ${version}, cache ${hash}, ${(index.length / 1024).toFixed(0)} Ko`);
