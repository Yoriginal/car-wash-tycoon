/* Écran Monde (accueil) : carte claire du département, déplaçable et zoomable au doigt.
   Coordonnées du moteur (300 × 400). Brouillard = papier jauni + nuages + rond sombre à cadenas ;
   zones dessinées selon leur palier ; terrains libres, étudiés, à céder ; ma station (enseigne néon
   + picto d'état) ; rivaux (enseigne à leurs couleurs + picto info) ; signal faible (grue) ;
   petites voitures sur les routes. La vue (centre, zoom) vit dans l'interface, jamais dans la sauvegarde. */

const MW = 300, MH = 400;
const TK = 0.27;                 // échelle des tuiles 150 × 118 du pack sur la carte
const Z_MAX = 7;
const ROUTES = [
  [[52, 346], [62, 330], [108, 292], [116, 310]], [[108, 292], [70, 200], [54, 216]], [[70, 200], [98, 206], [220, 196], [248, 204]],
  [[220, 196], [200, 222], [196, 300], [186, 318]], [[196, 300], [252, 360], [262, 378]], [[70, 200], [70, 62], [40, 66]],
  [[70, 62], [96, 84], [204, 92], [226, 60], [266, 74]], [[30, 112], [70, 62]], [[220, 196], [226, 60]], [[62, 330], [196, 300]]
];
const RIVAL_SPRITE = { disc: 'monde/rival_discount_wash', splash: 'monde/rival_splash_co' };
const MONDE_CARS = ['#C8435F', '#3E8E86', '#E0A631', '#5C7FA6', '#3A3F44', '#14BFAE', '#B9BEC1', '#FF7A1A'];

// ---------- dessin ----------
const tileAt = (x, y) => `translate(${(x - 75 * TK).toFixed(2)},${(y - 96 * TK).toFixed(2)}) scale(${TK})`;
function sectorOk(id) { return S.sectors[id].revealed; }
function etatStation(st) {
  if (!st.units.length) return 'opportunite';
  if (st.units.some(u => u.down > 0) || st.q.portique + st.q.hp >= E.qmaxOf(st)) return 'critique';
  return 'ok';
}
function potentielEtoiles(lotId) { return Math.max(1, Math.min(5, Math.ceil(potRange(lotId).exact / 80))); }

function parcelleSvg(l, etudie) {
  // parcelle en pointillé, une case par emplacement (la taille reflète le terrain)
  const n = l.slots, cw = 14, gap = 6, w = 16 + n * cw + (n - 1) * gap, x0 = 75 - w / 2;
  const coul = etudie ? '#14BFAE' : '#6A7276';
  let out = `<rect x="${x0}" y="44" width="${w}" height="44" fill="${etudie ? 'rgba(20,191,174,.08)' : 'none'}" stroke="${coul}" stroke-width="2" stroke-dasharray="6 4"/>`;
  for (let i = 0; i < n; i++) out += `<rect x="${x0 + 8 + i * (cw + gap)}" y="54" width="${cw}" height="22" fill="none" stroke="${coul}" stroke-width="1" opacity=".6"/>`;
  out += `<rect x="73.5" y="22" width="3" height="24" fill="#8E999C"/>`;
  if (etudie) {
    const k = potentielEtoiles(l.id);
    out += `<rect x="37" y="6" width="76" height="20" rx="10" fill="#1B2024"/>`;
    for (let i = 0; i < 5; i++) out += `<g transform="translate(${42 + i * 13.4},9.4) scale(.55)"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z" fill="${i < k ? '#F5A300' : '#4A5156'}"/></g>`;
  } else {
    out += `<rect x="45" y="6" width="60" height="20" rx="10" fill="#1B2024"/><text x="75" y="20" text-anchor="middle" font-family="Barlow Condensed" font-weight="700" font-size="10" letter-spacing=".6" fill="#F4F0E6">À VENDRE</text>`;
  }
  return out;
}

function lotSvg(l) {
  const ls = E.lotState(S, l.id);
  const own = ls.owner;
  const sel = ui.f && ui.f.kind === 'terrain' && ui.f.lot === l.id;
  const cible = !sel && !ui.sheet && mondeCible === l.id;
  let inner, label;
  if (own === 'player') {
    const st = S.stations[l.id];
    inner = innerSvg(sprite('monde/ma_station', { NOM: stationLabel(l.id).toUpperCase() }))
      + `<g transform="translate(118,10) scale(1)">${innerSvg(picto(etatStation(st), 24))}</g>`;
    label = `Ma station ${l.name}`;
  } else if (own) {
    inner = innerSvg(sprite(RIVAL_SPRITE[own] || 'monde/rival_discount_wash'));
    label = `${ownerName(own)} : ${l.name}`;
  } else if (ls.sale) {
    inner = innerSvg(sprite('monde/fonds_a_ceder'));
    label = `Station à céder : ${l.name}`;
  } else {
    inner = parcelleSvg(l, ls.studied);
    label = `Terrain ${ls.studied ? 'étudié' : 'à vendre'} : ${l.name}`;
  }
  return `<g class="pin${sel ? ' choisi' : ''}" data-lot="${l.id}" data-test="lot-${l.id}" role="button" tabindex="0" aria-label="${escSvg(label)}" transform="${tileAt(l.x, l.y)}">
    <rect x="10" y="0" width="130" height="100" fill="transparent"/>
    ${sel || cible ? `<rect class="neon-sel${cible ? ' neon-cible' : ''}" x="8" y="-2" width="134" height="104" rx="16" fill="none" stroke="#14BFAE" stroke-width="4"/>` : ''}
    ${inner}
  </g>`;
}

function zoneSvg(zd) {
  const z = S.zones.find(x => x.id === zd.id);
  const k = 0.22;
  let out = `<g class="zone" transform="translate(${zd.x - 75 * k},${zd.y - 96 * k - 3}) scale(${k})" opacity=".95">${innerSvg(sprite('monde/zone_palier_' + (z.stage + 1)))}</g>`;
  out += `<text x="${zd.x}" y="${zd.y - 20}" text-anchor="middle" font-family="Barlow Condensed" font-weight="700" font-size="5" letter-spacing=".9" fill="#6A7276">${escSvg(zd.name.toUpperCase())}</text>`;
  if (z.pending) out += `<g class="signal" transform="translate(${zd.x + 6},${zd.y - 28}) scale(.2)">${innerSvg(sprite('monde/signal_faible'))}</g>`;
  return out;
}

function brouillardSvg(sc) {
  const cx = sc.x + sc.w / 2, cy = sc.y + sc.h / 2;
  let nuages = '';
  for (let i = 0; i < 14; i++) {
    const x = sc.x + ((i * 53 + sc.id * 31) % sc.w), y = sc.y + ((i * 37 + sc.id * 17) % sc.h), r = 16 + (i * 7 % 13);
    nuages += `<circle cx="${x}" cy="${y}" r="${r}"/>`;
  }
  return `<g class="fog" data-sector="${sc.id}" data-test="fog-${sc.id}" role="button" tabindex="0" aria-label="Secteur inconnu : reconnaître pour ${fmt(E.RECON_COST)}">
    <rect x="${sc.x}" y="${sc.y}" width="${sc.w}" height="${sc.h}" fill="#ECE2C6"/>
    <g clip-path="url(#fogc${sc.id})" fill="#FBF8F1" opacity=".96">${nuages}</g>
    <circle cx="${cx}" cy="${cy - 4}" r="11" fill="#1B2024"/>
    <g transform="translate(${cx - 6},${cy - 10}) scale(.5)" fill="none" stroke="#F4F0E6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${innerSvg(ASSETS['icones/lock'] || '')}</g>
    <text x="${cx}" y="${cy + 17}" text-anchor="middle" font-family="Barlow Condensed" font-weight="700" font-size="8.5" fill="#171B1E">${fmt(E.RECON_COST)}</text>
  </g>`;
}

function voituresSvg() {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return '';
  let out = '';
  ROUTES.forEach((r, i) => {
    const sects = r.map(p => E.SECTORS.find(sc => p[0] >= sc.x && p[0] <= sc.x + sc.w && p[1] >= sc.y && p[1] <= sc.y + sc.h));
    if (sects.some(sc => !sc || !sectorOk(sc.id))) return;
    let len = 0;
    for (let j = 1; j < r.length; j++) len += Math.hypot(r[j][0] - r[j - 1][0], r[j][1] - r[j - 1][1]);
    const aller = 'M' + r.map(p => p.join(',')).join(' L');
    const path = aller + ' L' + r.slice().reverse().slice(1).map(p => p.join(',')).join(' L');
    const dur = (len * 2 / 9).toFixed(1);
    for (let c = 0; c < (len > 80 ? 2 : 1); c++) {
      out += `<rect x="-2.4" y="-1.3" width="4.8" height="2.6" rx=".9" fill="${MONDE_CARS[(i * 3 + c) % MONDE_CARS.length]}"><animateMotion dur="${dur}s" begin="-${(dur * (c * 0.5 + (i % 3) * 0.17)).toFixed(1)}s" repeatCount="indefinite" rotate="auto" path="${path}"/></rect>`;
    }
  });
  return out;
}

let mondeCible = null;
function mondeObjetsSvg() {
  mondeCible = cibleMonde();
  let out = '';
  for (const zd of E.ZONES) if (sectorOk(zd.sector)) out += zoneSvg(zd);
  const lots = E.LOTS.filter(l => sectorRevealed(l.id)).sort((a, b) => a.y - b.y);
  for (const l of lots) out += lotSvg(l);
  for (const sc of E.SECTORS) if (!sectorOk(sc.id)) out += brouillardSvg(sc);
  for (const sc of E.SECTORS) if (sectorOk(sc.id)) out += `<text x="${sc.x + 5}" y="${sc.y + 10}" font-family="Barlow Condensed" font-weight="700" font-size="6" letter-spacing="1.2" fill="#8B8678">${escSvg(sc.name.toUpperCase())}</text>`;
  return out;
}
function mondeSig() {
  return JSON.stringify([S.sectors.map(s => s.revealed), S.zones.map(z => [z.stage, !!z.pending]), S.lots.map(l => [l.owner, l.studied, !!l.sale]),
    Object.values(S.stations).filter(st => st.owner === 'player').map(st => etatStation(st)), ui.f && ui.f.kind === 'terrain' ? ui.f.lot : '', cibleMonde(), !!ui.sheet]);
}

function viewMonde() {
  const pl = pts => pts.map(p => p.join(',')).join(' ');
  return `<div class="monde" id="monde">
    <svg id="monde-svg" viewBox="0 0 ${MW} ${MH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Carte du département">
      <defs>${E.SECTORS.map(sc => `<clipPath id="fogc${sc.id}"><rect x="${sc.x}" y="${sc.y}" width="${sc.w}" height="${sc.h}"/></clipPath>`).join('')}
        <pattern id="papier" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".5" fill="#D9D0BC"/></pattern></defs>
      <rect x="-200" y="-200" width="${MW + 400}" height="${MH + 400}" fill="#E4DCC8"/>
      <rect width="${MW}" height="${MH}" fill="#EEE8DA"/><rect width="${MW}" height="${MH}" fill="url(#papier)" opacity=".7"/>
      <path d="M300 300 C 270 330, 280 360, 236 400 L300 400 Z" fill="#BFE0E6"/>
      <path d="M0 150 C 40 160, 30 240, 110 250 S 160 330, 140 400" fill="none" stroke="#A9D6E5" stroke-width="5" stroke-linecap="round"/>
      ${ROUTES.map(r => `<polyline points="${pl(r)}" fill="none" stroke="#D3CCBD" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}
      ${E.SECTORS.map(sc => `<rect x="${sc.x}" y="${sc.y}" width="${sc.w}" height="${sc.h}" fill="none" stroke="#B8AE98" stroke-width=".7" stroke-dasharray="4 3"/>`).join('')}
      <g id="monde-voitures">${voituresSvg()}</g>
      <g id="monde-objets" data-sig="${escSvg(mondeSig())}">${mondeObjetsSvg()}</g>
    </svg>
  </div>`;
}
function mondeLive() {
  const g = $('#monde-objets');
  if (!g) return;
  const sig = mondeSig();
  if (g.dataset.sig !== sig) {
    const carsSig = S.sectors.map(s => s.revealed).join();
    g.innerHTML = mondeObjetsSvg(); g.dataset.sig = sig;
    const v = $('#monde-voitures');
    if (v && v.dataset.s !== carsSig) { v.innerHTML = voituresSvg(); v.dataset.s = carsSig; }
  }
}

// ---------- vue : déplacer et zoomer ----------
function mondeBox() { const el = $('#monde'); return el ? { w: el.clientWidth || 390, h: el.clientHeight || 600 } : { w: 390, h: 600 }; }
function zFit() { const b = mondeBox(); return Math.min(b.w / MW, b.h / MH); }
function mondeVue() {
  if (!ui.vue) {
    const mine = Object.values(S.stations).find(st => st.owner === 'player');
    const l = mine ? E.lotDef(mine.lot) : E.lotDef('A');
    ui.vue = { cx: l.x + 20, cy: l.y - 20, z: Math.max(zFit(), 2.6) };
  }
  return ui.vue;
}
function mondeApply() {
  const svg = $('#monde-svg');
  if (!svg) return;
  const b = mondeBox(), v = mondeVue();
  v.z = Math.max(zFit(), Math.min(Z_MAX, v.z));
  const w = b.w / v.z, h = b.h / v.z;
  const marge = 30;
  v.cx = w >= MW ? MW / 2 : Math.max(w / 2 - marge, Math.min(MW - w / 2 + marge, v.cx));
  v.cy = h >= MH ? MH / 2 : Math.max(h / 2 - marge, Math.min(MH - h / 2 + marge, v.cy));
  svg.setAttribute('viewBox', `${(v.cx - w / 2).toFixed(2)} ${(v.cy - h / 2).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
}
// centre un point de la carte dans la moitié haute (quand une fiche couvre le bas)
function mondeViser(x, y) {
  const v = mondeVue(), b = mondeBox();
  v.z = Math.max(v.z, 2.6);
  v.cx = x; v.cy = y + b.h * 0.22 / v.z;
  mondeApply();
}
function mondeAttach() {
  const el = $('#monde');
  if (!el) return;
  mondeApply();
  const pts = new Map();
  let moved = 0, pinch = null;
  el.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) moved = 0;
    if (pts.size === 2) pinch = null;
  });
  el.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const v = mondeVue();
    if (pts.size === 1) {
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 8 && !el.hasPointerCapture(e.pointerId)) el.setPointerCapture(e.pointerId);
      if (moved > 8) { v.cx -= dx / v.z; v.cy -= dy / v.z; mondeApply(); }
    } else if (pts.size === 2) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (pinch) {
        mondeZoom(v.z * d / pinch.d, mx, my);
        v.cx -= (mx - pinch.mx) / v.z; v.cy -= (my - pinch.my) / v.z; mondeApply();
      }
      pinch = { d, mx, my };
      moved = 99;
      return;
    }
    p.x = e.clientX; p.y = e.clientY;
  });
  const up = e => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (!pts.size && moved > 8) { ui.mondeGlisse = true; setTimeout(() => { ui.mondeGlisse = false; }, 0); }
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => { e.preventDefault(); mondeZoom(mondeVue().z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY); }, { passive: false });
  // après un glissé, le relâchement ne doit pas ouvrir un terrain
  el.addEventListener('click', e => { if (ui.mondeGlisse) { e.stopPropagation(); e.preventDefault(); } }, true);
}
// zoom autour d'un point de l'écran (le point de la carte sous le doigt ne bouge pas)
function mondeZoom(z, sx, sy) {
  const el = $('#monde'), v = mondeVue();
  if (!el) return;
  const r = el.getBoundingClientRect();
  const wx = v.cx + (sx - r.left - r.width / 2) / v.z, wy = v.cy + (sy - r.top - r.height / 2) / v.z;
  const nz = Math.max(zFit(), Math.min(Z_MAX, z));
  v.cx = wx - (sx - r.left - r.width / 2) / nz; v.cy = wy - (sy - r.top - r.height / 2) / nz; v.z = nz;
  mondeApply();
}

// ---------- fiches ----------
function jaugeTerrain(titre, valeur, part, cls) {
  return `<div class="t-jauge"><div class="f-ligne"><span>${titre}</span><b>${valeur}</b></div>${jauge(part, cls)}</div>`;
}
FEUILLES.terrain = ({ lot }) => {
  const l = E.lotDef(lot), ls = E.lotState(S, lot), z = E.zoneOf(S, lot), zd = E.zoneDef(z.id);
  const pr = potRange(lot);
  const prix = ls.sale ? ls.sale.price : E.lotPrice(S, lot);
  const comps = Object.values(S.stations).filter(st => E.lotDef(st.lot).zone === z.id && st.lot !== lot);
  const nRiv = comps.filter(st => st.owner !== 'player').length;
  const conc = ['aucune', 'faible', 'moyenne', 'forte'][Math.min(3, comps.length)];
  const etudie = ls.studied || ls.owner === 'player';
  const cases = Array.from({ length: l.slots }, () => '<i></i>').join('');
  const file = Array.from({ length: Math.min(l.q, 12) }, () => '<u></u>').join('');
  const tendance = z.pending ? (z.pending.dir > 0 ? 'en hausse' : 'en baisse') : etudie ? trendText(z).toLowerCase() : 'inconnue';
  let corps = `<div class="t-plan"><span class="t-cases">${cases}<span class="t-file">${file}</span></span>
      <span class="t-infos"><b>${pluriel(l.slots, 'emplacement')}</b><small>file de ${l.q} voitures</small><small>${nRiv ? pluriel(nRiv, 'rival') + ' dans la zone' : 'aucun rival dans la zone'}${zd.seasonal ? ' · saisonnier' : ''}</small></span></div>
    ${jaugeTerrain('Potentiel', etudie ? `≈ ${pr.exact} clients/j` : `${pr.lo} à ${pr.hi} clients/j`, (etudie ? pr.exact : pr.hi) / 400, etudie ? '' : 'flou')}
    ${jaugeTerrain('Concurrence', conc, comps.length / 3, 'ambre')}
    <div class="t-jauge"><div class="f-ligne"><span>Tendance</span><b>${tendance}</b></div>
      ${z.pending ? `<p class="f-texte">${picto('opportunite', 16)} ${esc(z.pending.signal)}</p>` : etudie ? '' : '<p class="f-texte t-flou">Une étude révèle le potentiel exact et la tendance.</p>'}</div>`;
  if (etudie) corps += `<p class="f-texte">Prix de référence : portique ${euro(E.refPrice(S, lot, 'portique'))}, piste HP ${euro(E.refPrice(S, lot, 'hp'))}.</p>`;
  if (ls.sale) corps += `<div class="f-offre">${picto('opportunite', 24)}<span><b>Vendu équipé</b><small>${ls.sale.units.map(u => E.EQUIP[u.type].name + ' ' + E.EQUIP[u.type].tiers[u.tier].n).join(', ')}</small></span></div>`;
  let actions = '';
  if (ls.owner === 'player') actions = bouton({ label: 'Voir la station', ic: 'station', fa: 'aller-station', neon: true });
  else if (ls.owner) corps += `<p class="f-texte">${picto('info', 16)} Propriété de ${esc(ownerName(ls.owner))}. Si elle fait faillite, elle revendra peut-être.</p>`;
  else {
    const assez = S.cash >= prix;
    const pret = assez ? null : pretPour(prix, 5000);
    if (!ls.studied) actions += bouton({ label: 'Étudier', ic: 'eye', montant: fmt(E.STUDY_COST), fa: 'etudier', neon: S.cash >= E.STUDY_COST, off: S.cash < E.STUDY_COST, test: 'etudier' });
    actions += bouton({ label: 'Acheter', ic: 'plus', montant: fmt(prix), fa: 'acheter-terrain', neon: ls.studied && assez, off: !assez, test: 'acheter-terrain' });
    if (pret && !pret.refuse) actions += bouton({ label: 'Acheter avec un prêt', ic: 'loan', montant: `${fmt(pret.mensuel)}/mois`, fa: 'acheter-terrain-pret', neon: !!ls.studied });
    else if (pret) corps += `<p class="f-texte">${picto('critique', 16)} Il te manque ${fmt(prix - Math.max(0, S.cash))} et la banque ne prête que ${fmt(E.creditLimit(S))}.</p>`;
  }
  return feuille({ ic: ls.owner === 'player' ? 'station' : 'map', titre: l.name, sous: `Palier ${z.stage + 1} · ${esc(E.STAGES[z.stage].n)} · ${esc(zd.name)}`, corps, actions });
};
FEUILLES.reconnaissance = ({ sector }) => {
  const sc = E.SECTORS[sector];
  return feuille({ ic: 'lock', titre: sc.name, sous: 'Secteur non reconnu',
    corps: `<p class="f-texte">Une reconnaissance dévoile ses zones, ses terrains et leur potentiel en fourchette large. Les signaux faibles (chantiers, rumeurs) deviennent visibles.</p>`,
    actions: bouton({ label: 'Reconnaître', ic: 'eye', montant: fmt(E.RECON_COST), fa: 'reconnaitre', neon: S.cash >= E.RECON_COST, off: S.cash < E.RECON_COST, test: 'reconnaitre' }) });
};
function mondeAct(a) {
  const f = ui.f || {};
  let r;
  switch (a) {
    case 'aller-station': closeSheet(true); go('station', f.lot); return true;
    case 'etudier': r = E.study(S, f.lot); break;
    case 'acheter-terrain': case 'acheter-terrain-pret': {
      const ls = E.lotState(S, f.lot);
      const prix = ls.sale ? ls.sale.price : E.lotPrice(S, f.lot);
      if (a === 'acheter-terrain-pret') { const p = pretPour(prix, 5000); if (p && !p.refuse) { r = E.borrow(S, p.need, 7); if (!r.ok) break; } }
      r = E.buyLot(S, f.lot);
      if (r.ok) { const lot = f.lot; closeSheet(true); go('station', lot); toast('Terrain acheté : installe tes équipements.', 'good'); renderHud(); Save.touch(); return true; }
      break;
    }
    case 'reconnaitre':
      r = E.reveal(S, f.sector);
      if (r.ok) { closeSheet(); toast('Secteur reconnu : de nouveaux terrains apparaissent.', 'good'); renderHud(); Save.touch(); return true; }
      break;
    default: return false;
  }
  if (r && !r.ok && r.msg) toast(r.msg, 'bad');
  renderHud(); Save.touch(); feuilleRefresh(); mondeLive();
  return true;
}
function ouvrirTerrain(lot) {
  const ls = E.lotState(S, lot);
  if (ls.owner === 'player') { go('station', lot); return; }
  feuilleOpen('terrain', { lot });
  const l = E.lotDef(lot);
  mondeLive(); mondeViser(l.x, l.y);
}
function ouvrirBrouillard(sector) { feuilleOpen('reconnaissance', { sector }); }
