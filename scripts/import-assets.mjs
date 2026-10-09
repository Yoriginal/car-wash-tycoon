// Import du pack Claude Design (design/pack) vers src/assets (versions nettoyées pour le jeu).
// À relancer seulement si le pack change : node scripts/import-assets.mjs
//
// Nettoyage appliqué :
//  - « & » non échappés corrigés (2 fichiers invalides dans le pack d'origine) ;
//  - bloc <defs> commun retiré de chaque fichier et regroupé dans src/assets/defs.svg ;
//  - halo SVG (filter k_glow) remplacé par la classe « kglow » (halo CSS appliqué seulement si utile) ;
//  - éléments du monde : fond de planche, route de planche et légendes retirés, cadre recadré ;
//  - textes dynamiques remplacés par des marqueurs {{...}} remplis par le jeu ;
//  - police Inter (absente du jeu) remplacée par Barlow Condensed.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'design/pack');
const OUT = join(root, 'src/assets');

const defs = new Map();
const fixAmp = s => s.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');

function clean(svg, { tile = false, markers = [] } = {}) {
  svg = fixAmp(svg);
  // défs communes
  svg = svg.replace(/<defs>([\s\S]*?)<\/defs>/g, (_, inner) => {
    const re = /<(filter|pattern|linearGradient|radialGradient|clipPath|mask|symbol)\b[^>]*\bid="([^"]+)"[\s\S]*?<\/\1>/g;
    let m;
    while ((m = re.exec(inner))) if (!defs.has(m[2])) defs.set(m[2], m[0]);
    return '';
  });
  svg = svg.replace(/\sfilter="url\(#k_glow\)"/g, ' class="kglow"');
  svg = svg.replace(/font-family="Inter"/g, 'font-family="Barlow Condensed"');
  svg = svg.replace(/\swidth="\d+(\.\d+)?" height="\d+(\.\d+)?"\s*>/, '>');
  if (tile) {
    // fond et route de planche, légendes sous le dessin, cadre 150 × 118
    svg = svg.replace(/<rect width="150" height="118" fill="#EEE8DA"\/>/, '');
    svg = svg.replace(/<path d="M0,96 H150" stroke="#D3CCBD" stroke-width="10"\/>/, '');
    svg = svg.replace(/<text x="[\d.]+" y="(1[2-9]\d|[2-9]\d\d)(\.\d+)?"[^>]*>[^<]*<\/text>/g, '');
    svg = svg.replace(/viewBox="0 0 150 156"/, 'viewBox="0 0 150 118"');
  }
  for (const [from, to] of markers) svg = from instanceof RegExp ? svg.replace(from, to) : svg.split(from).join(to);
  return svg.replace(/\s+\/>/g, '/>').replace(/>\s+</g, '><').trim();
}

function each(dir) { return readdirSync(join(SRC, dir)).filter(f => f.endsWith('.svg')).sort(); }
if (existsSync(OUT)) rmSync(OUT, { recursive: true });
for (const d of ['equipements', 'monde', 'icones', 'ui']) mkdirSync(join(OUT, d), { recursive: true });

let n = 0, before = 0, after = 0;
function put(dir, file, opts) {
  const raw = readFileSync(join(SRC, dir, file), 'utf8');
  const out = clean(raw, opts);
  writeFileSync(join(OUT, dir, file), out + '\n');
  n++; before += raw.length; after += out.length;
}

// équipements : texte « 2 j » des pannes remplacé par le vrai délai
for (const f of each('equipements')) put('equipements', f, { markers: [['>2 j<', '>{{J}}<']] });

// monde : uniquement ce que la carte et la station utilisent
const MONDE = {
  // ma station : le picto d'état « ok » du dessin est retiré, le jeu pose le picto de l'état réel
  'ma_station.svg': { tile: true, markers: [['>BRUYÈRES<', '>{{NOM}}<'], [/<rect x="120\.35"[^>]*\/><path d="M124\.22[^>]*\/>/, '']] },
  'rival_discount_wash.svg': { tile: true }, 'rival_splash_co.svg': { tile: true },
  'fonds_a_ceder.svg': { tile: true }, 'terrain_libre.svg': { tile: true }, 'terrain_etudie.svg': { tile: true },
  'signal_faible.svg': { tile: true },
  'zone_palier_1.svg': { tile: true }, 'zone_palier_2.svg': { tile: true }, 'zone_palier_3.svg': { tile: true },
  'zone_palier_4.svg': { tile: true }, 'zone_palier_5.svg': { tile: true },
  'enseigne.svg': { markers: [['>Les Bruyères<', '>{{NOM}}<'], ['>9 €<', '>{{P1}}<'], ['>4 €<', '>{{P2}}<']] },
};
for (const [f, o] of Object.entries(MONDE)) put('monde', f, o);
for (const f of each('icones')) put('icones', f);
for (const f of ['bulle_ok.svg', 'bulle_joie.svg', 'bulle_oups.svg']) put('ui', f);

writeFileSync(join(OUT, 'defs.svg'), `<svg xmlns="http://www.w3.org/2000/svg"><defs>${[...defs.values()].join('')}</defs></svg>\n`);
writeFileSync(join(root, 'design/pack/tokens.css').replace('design/pack', 'src/assets'), readFileSync(join(SRC, 'tokens.css'), 'utf8'));
console.log(`${n} SVG importés, ${defs.size} définitions communes, ${(before / 1024).toFixed(0)} Ko → ${(after / 1024).toFixed(0)} Ko`);
