/* Écran Station : diorama SVG touchable.
   De haut en bas : enseigne Googie et bâtiment de palier, bâtiment de lavage (un poste par
   emplacement, portique = poste double), parvis avec la file et son panneau ; puis 4 indicateurs.
   Tout ce qui est sombre se touche : plaques/équipements, emplacements libres, enseigne, panneau de file. */

const ST = { POSTE_W: 86, POSTE_H: 108, X0: 14, ROOF_Y: 168, BAY_Y: 192, GROUND_Y: 300, LANE_Y: 330, H: 392 };
const TIER_KEY = ['eco', 'pro', 'premium'];
const TYPE_KEY = { portique: 'portique', hp: 'piste' };
const SCENE_CARS = ['#C8435F', '#3E8E86', '#E0A631', '#5C7FA6', '#B9BEC1', '#E9E4D8', '#3A3F44'];

// silhouette de voiture du kit (64 × 26), couleur au choix
function carSvg(color, x, y, k = 0.6, flip = false) {
  const t = flip ? `translate(${x + 64 * k},${y}) scale(${-k},${k})` : `translate(${x},${y}) scale(${k})`;
  return `<g transform="${t}"><path d="M2,18 Q2,13 8,12 L20,11 Q24,5 32,4 L42,4 Q48,5 51,11 L57,11 L63,5.5 L63.5,14 Q64,20.5 60,21 L6,21 Q2,21 2,18 Z" fill="${color}" stroke="#8E989B" stroke-width="1" stroke-linejoin="round"/><path d="M24.5,11 Q27,6.4 32,6.3 L36,6.3 L36,11 Z M38,6.3 L42,6.3 Q46,7 48,11 L38,11 Z" fill="#1b2a30" opacity=".85"/><path d="M7,15.2 L58,15.2" stroke="#E8EEEE" stroke-width="1.2" opacity=".85"/><circle cx="15" cy="21" r="4.6" fill="#111" stroke="#8E989B"/><circle cx="15" cy="21" r="2.6" fill="#F4F0E6"/><circle cx="50" cy="21" r="4.6" fill="#111" stroke="#8E989B"/><circle cx="50" cy="21" r="2.6" fill="#F4F0E6"/></g>`;
}

// état visuel d'un équipement : panne > fin de vie > en marche > à l'arrêt.
// « En marche » ne suit pas l'heure (pas de clignotement jour/nuit en vitesse ×10) :
// un poste est en marche dès que la station a lavé des voitures aujourd'hui ou hier.
function unitState(st, u) {
  const t = E.EQUIP[u.type].tiers[u.tier];
  if (u.down > 0) return 'panne';
  if (u.age > t.life * 365 * 0.85) return 'usure';
  const hier = st.hist.length ? st.hist[st.hist.length - 1].served : 0;
  return st.day.served > 0 || hier > 0 ? 'actif' : 'arret';
}
function stationOpen() { return S.h >= E.OPEN && S.h < E.CLOSE; }
// nom choisi par le joueur (dans la sauvegarde depuis la v3), sinon nom de la zone
function stationNom(lotId) {
  const st = S.stations[lotId];
  return (st && st.owner === 'player' && st.name) || null;
}
// noms donnés avec la 2.0 (gardés dans les préférences d'interface) : repris une fois dans la sauvegarde
function nomsVersSauvegarde() {
  const p = Prefs.get();
  if (!p.noms) return;
  for (const [lot, n] of Object.entries(p.noms)) if (S.stations[lot] && !S.stations[lot].name) E.renameStation(S, lot, n);
  delete p.noms; Prefs.save(); Save.touch();
}
function stationLabel(lotId) { return stationNom(lotId) || E.zoneDef(E.lotDef(lotId).zone).name.replace(/^ZA du /, 'ZA ').replace(/^Porte de /, ''); }

// enseigne Googie : nom + panneau tarifaire des types installés ; grésille si un équipement est en panne
function enseigneSvg(st, broken) {
  const nom = stationLabel(st.lot);
  const rows = E.TYPES.filter(t => st.units.some(u => u.type === t));
  const lines = rows.length ? rows : [];
  const fs = nom.length > 15 ? 12.5 : nom.length > 12 ? 15 : 19;
  const tarif = lines.map((t, i) => `<text x="40" y="${100 + i * 14}" font-family="Barlow Condensed" font-weight="700" font-size="11" fill="#F5A300">${t === 'hp' ? 'PISTE HP' : 'PORTIQUE'}</text><text x="134" y="${100 + i * 14}" text-anchor="end" font-family="Barlow Condensed" font-weight="700" font-size="12" fill="#F5A300">${euro(st.prices[t])}</text>`).join('');
  const h = lines.length ? 20 + lines.length * 14 : 0;
  return `<g class="enseigne${broken ? ' gresille' : ''}" data-sa="enseigne" role="button" aria-label="Enseigne et prix">
    <path d="M86,${h ? 86 + h : 80} L86,${ST.ROOF_Y}" stroke="#56656C" stroke-width="5"/>
    <path d="M12,34 L156,10 L170,64 L26,82 Z" fill="#11171B" stroke="#FF2E7A" stroke-width="2.2" class="neon-rose"/>
    <text x="92" y="44" text-anchor="middle" font-family="Monoton" font-size="15" fill="#14BFAE" transform="rotate(-8 92 44)">LAVAGE</text>
    <text class="enseigne-nom" x="96" y="68" text-anchor="middle" font-family="Righteous" font-size="${fs}" fill="#FF2E7A" transform="rotate(-8 96 68)">${escSvg(nom)}</text>
    ${h ? `<path d="M36,86 L150,86 L${150 - 8},${86 + h} L28,${86 + h} Z" fill="#0B0F12" stroke="#14BFAE" stroke-width="1.4"/>${tarif}` : ''}
  </g>`;
}

function postesSvg(st, cible) {
  let x = ST.X0 + 6, out = '', i = 0;
  const k = ST.POSTE_H / 150;
  st.units.forEach((u, idx) => {
    const n = E.EQUIP[u.type].slots;
    const w = n * ST.POSTE_W;
    const state = unitState(st, u);
    const name = `equipements/${TYPE_KEY[u.type]}_${TIER_KEY[u.tier]}_${state}`;
    const jours = Math.max(1, Math.ceil(u.down / 24)) + ' j';
    const sx = x + (w - ST.POSTE_W) / 2;
    out += `<g class="poste etat-${state}" data-sa="unit" data-i="${idx}" data-test="unit-${idx}" role="button" aria-label="${E.EQUIP[u.type].name} ${E.EQUIP[u.type].tiers[u.tier].n}, ${state}">
      ${n > 1 ? `<rect x="${x}" y="${ST.BAY_Y}" width="${w}" height="${ST.POSTE_H * 124 / 150}" fill="#E7E3DB"/><rect x="${x}" y="${ST.BAY_Y + ST.POSTE_H * 124 / 150}" width="${w}" height="${ST.POSTE_H * 26 / 150}" fill="#CFCBC3"/>` : ''}
      <g transform="translate(${sx},${ST.BAY_Y}) scale(${k})">${innerSvg(sprite(name, { J: jours }))}</g>
      ${cible && cible.t === 'unit' && cible.i === idx ? `<rect class="neon-cible" x="${x + 3}" y="${ST.BAY_Y - 6}" width="${w - 6}" height="${ST.POSTE_H + 4}" rx="12" fill="none" stroke="#14BFAE" stroke-width="3"/>` : ''}
      ${i ? `<line x1="${x}" y1="${ST.BAY_Y}" x2="${x}" y2="${ST.BAY_Y + ST.POSTE_H}" stroke="#9A9486" stroke-width="1.4"/>` : ''}
    </g>`;
    x += w; i += n;
  });
  const free = E.freeSlots(st);
  for (let f = 0; f < free; f++) {
    out += `<g class="poste libre" data-sa="slot" data-test="slot-free" role="button" aria-label="Emplacement libre : ajouter un équipement">
      <g transform="translate(${x},${ST.BAY_Y}) scale(${k})">${innerSvg(sprite('equipements/emplacement_libre'))}</g>
      ${cible && cible.t === 'slot' && f === 0 ? `<circle class="neon-cible" cx="${x + ST.POSTE_W / 2}" cy="${ST.BAY_Y + 75 * k}" r="${22 * k + 6}" fill="none" stroke="#14BFAE" stroke-width="3"/>` : ''}
      ${i ? `<line x1="${x}" y1="${ST.BAY_Y}" x2="${x}" y2="${ST.BAY_Y + ST.POSTE_H}" stroke="#9A9486" stroke-width="1.4"/>` : ''}
    </g>`;
    x += ST.POSTE_W; i++;
  }
  return out;
}
// contenu d'un sprite sans sa balise <svg> (pour l'imbriquer dans la scène)
function innerSvg(svg) { return svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''); }

function fileSvg(st, cible) {
  const q = st.q.portique + st.q.hp, cap = E.qmaxOf(st);
  const full = q >= cap;
  const dots = Math.min(cap, 10);
  const lit = Math.round(dots * q / cap);
  const dotsSvg = Array.from({ length: dots }, (_, j) => `<rect x="${12 + j * 8.4}" y="22" width="6.4" height="9" rx="3" fill="${j < lit ? (full ? '#EE3B30' : '#22A447') : '#3A4146'}"/>`).join('');
  return `<g class="panneau-file${full ? ' complet' : ''}" data-sa="file" data-test="file" role="button" aria-label="File d'attente ${q} sur ${cap}">
    <path d="M58,40 V58" stroke="#56656C" stroke-width="3"/>
    <rect x="0" y="0" width="${Math.max(100, 24 + dots * 8.4)}" height="40" rx="20" fill="#1B2024"/>
    ${cible && cible.t === 'file' ? `<rect class="neon-cible" x="-4" y="-4" width="${Math.max(100, 24 + dots * 8.4) + 8}" height="48" rx="24" fill="none" stroke="#14BFAE" stroke-width="3"/>` : ''}
    <text x="${full ? 30 : 14}" y="16" font-family="Barlow Condensed" font-weight="700" font-size="11" letter-spacing="1" fill="${full ? '#EE3B30' : '#F4F0E6'}">${full ? 'COMPLET' : 'FILE'} ${q}/${cap}</text>
    ${full ? `<g transform="translate(10,4) scale(.6)">${innerSvg(picto('critique'))}</g>` : ''}
    ${dotsSvg}
  </g>`;
}

function queueCarsSvg(st, W) {
  const q = st.q.portique + st.q.hp;
  const step = 46, x0 = 134;
  const fit = Math.max(0, Math.floor((W - x0 - 10) / step));
  let out = '';
  for (let j = 0; j < Math.min(q, fit); j++) out += carSvg(SCENE_CARS[(j + st.lot.charCodeAt(0)) % SCENE_CARS.length], x0 + j * step, ST.LANE_Y + 10, 0.62, true);
  if (q > fit) out += `<text x="${W - 12}" y="${ST.LANE_Y + 26}" text-anchor="end" font-family="Barlow Condensed" font-weight="700" font-size="13" fill="#171B1E">+${q - fit}</text>`;
  return out;
}

function stationSceneSvg(lotId) {
  const st = S.stations[lotId];
  const slots = E.slotsOf(st);
  const bw = slots * ST.POSTE_W + 12;
  const W = Math.max(390, ST.X0 + bw + 16 + (S.offers.some(o => o.lot === lotId) ? 70 : 0));
  const z = E.zoneOf(S, lotId);
  const night = false; // décor toujours de jour : le cycle jour/nuit défilait trop vite en ×10
  const broken = st.units.some(u => u.down > 0);
  const offer = S.offers.find(o => o.lot === lotId);
  const emp = st.staff ? S.staff.find(e => e.id === st.staff) : null;
  const cible = cibleStation(lotId);
  return `<svg class="diorama2" viewBox="0 0 ${W} ${ST.H}" width="${W}" height="${ST.H}" role="img" aria-label="Station ${escSvg(E.lotDef(lotId).name)}">
    <rect width="${W}" height="${ST.GROUND_Y}" fill="${night ? '#2B3440' : '#E4EFEC'}"/>
    ${night ? Array.from({ length: 18 }, (_, j) => `<circle cx="${(j * 89 + 23) % W}" cy="${(j * 37) % 120 + 8}" r="1" fill="#F4F0E6" opacity=".7"/>`).join('') : `<g fill="#fff" opacity=".9"><ellipse cx="${W - 120}" cy="30" rx="26" ry="9"/><ellipse cx="${W - 98}" cy="24" rx="16" ry="9"/><ellipse cx="210" cy="52" rx="20" ry="7"/></g>`}
    <text x="${W - 14}" y="22" text-anchor="end" font-family="Barlow Condensed" font-weight="700" font-size="11" letter-spacing="1.6" fill="${night ? '#C9CED1' : '#6A7276'}">PALIER ${z.stage + 1} · ${escSvg(E.STAGES[z.stage].n.toUpperCase())}</text>
    <rect x="0" y="${ST.ROOF_Y - 4}" width="${W}" height="${ST.GROUND_Y - ST.ROOF_Y}" fill="${night ? '#3A4552' : '#D3E2DA'}"/>
    <g transform="translate(${W - 160},${ST.ROOF_Y - 4 - 96})">${innerSvg(sprite('monde/zone_palier_' + (z.stage + 1)))}</g>
    <rect x="0" y="${ST.GROUND_Y - 8}" width="${W}" height="${ST.H - ST.GROUND_Y + 8}" fill="#D9D3C7"/>
    <rect x="0" y="${ST.LANE_Y - 4}" width="${W}" height="${ST.H - ST.LANE_Y + 4}" fill="#CBC5B8"/>
    <path d="M0 ${ST.LANE_Y + 52} H${W}" stroke="#F4F0E6" stroke-width="2" stroke-dasharray="14 12"/>
    <!-- bâtiment de lavage -->
    <path d="M${ST.X0} ${ST.ROOF_Y} l12 -12 h${bw} l-12 12 z" fill="#F4F1EA" stroke="#9A9486" stroke-width="1"/>
    <path d="M${ST.X0 + bw} ${ST.ROOF_Y} l12 -12 v${ST.GROUND_Y - ST.ROOF_Y} l-12 12 z" fill="#DDD8CC" stroke="#9A9486" stroke-width="1"/>
    <rect x="${ST.X0}" y="${ST.ROOF_Y}" width="${bw}" height="${ST.BAY_Y - ST.ROOF_Y}" fill="#FFFFFF" stroke="#9A9486" stroke-width="1"/>
    <path d="M${ST.X0 + 4} ${ST.ROOF_Y + 18} H${ST.X0 + bw - 4}" stroke="#FF2E7A" stroke-width="2.4" class="${night ? 'neon-rose' : ''}"/>
    <rect x="${ST.X0}" y="${ST.BAY_Y}" width="${bw}" height="${ST.GROUND_Y - ST.BAY_Y}" fill="#B8B2A6"/>
    ${postesSvg(st, cible)}
    ${night ? `<rect x="${ST.X0}" y="${ST.BAY_Y}" width="${bw}" height="${ST.POSTE_H}" fill="#1B2024" opacity=".35" pointer-events="none"/>` : ''}
    ${offer ? `<g class="a-vendre" data-sa="offre" role="button" aria-label="Parcelle voisine à vendre"><rect x="${ST.X0 + bw + 22}" y="${ST.BAY_Y + 20}" width="56" height="70" fill="none" stroke="#6A7276" stroke-width="1.4" stroke-dasharray="5 4"/><rect x="${ST.X0 + bw + 14}" y="${ST.BAY_Y}" width="72" height="22" rx="11" fill="#1B2024"/><text x="${ST.X0 + bw + 50}" y="${ST.BAY_Y + 15}" text-anchor="middle" font-family="Barlow Condensed" font-weight="700" font-size="10.5" letter-spacing=".8" fill="#F4F0E6">À VENDRE</text><g transform="translate(${ST.X0 + bw + 40},${ST.BAY_Y + 46}) scale(.9)">${innerSvg(picto('opportunite'))}</g></g>` : ''}
    ${enseigneSvg(st, broken)}
    ${emp ? `<g class="employe" data-sa="employe" role="button" aria-label="Employé ${escSvg(emp.name)}" transform="translate(${ST.X0 + bw - 26},${ST.GROUND_Y - 2})"><circle cx="10" cy="6" r="6" fill="#E9C9A8"/><path d="M2 30 V18 Q2 12 10 12 Q18 12 18 18 V30 Z" fill="#14BFAE"/><rect x="4" y="0" width="12" height="4" rx="2" fill="#1B2024"/></g>` : ''}
    <g transform="translate(14,${ST.LANE_Y + 2})">${fileSvg(st, cible)}</g>
    <g class="file-voitures">${queueCarsSvg(st, W)}</g>
  </svg>`;
}

// indicateurs mensuels : 30 derniers jours glissants (29 jours d'historique + la journée en cours)
function stationMois(st) {
  const h = st.hist.slice(-29);
  const somme = k => h.reduce((a, x) => a + (x[k] || 0), 0) + (st.day[k] || 0);
  const rev = somme('rev'), cost = somme('cost');
  // clients perdus : repartis d'une file pleine + découragés par la file + découragés par le prix
  const repartis = Math.round(somme('lost')), file = Math.round(somme('deter')), prix = Math.round(somme('cher'));
  return { lavages: somme('served'), perdus: repartis + file + prix, repartis, file, prix, rev: Math.round(rev), net: Math.round(rev - cost), jours: h.length + 1 };
}
function stationKpisHtml(st) {
  const m = stationMois(st);
  return `<div class="kpi2"><span class="ic vert">${ASSETS['icones/car']}</span><span><b class="num" data-live="served">${m.lavages.toLocaleString('fr-FR')}</b><small>lavages</small></span></div>
    <div class="kpi2"><span class="ic rouge">${ASSETS['icones/carout']}</span><span><b class="num" data-live="lost">${m.perdus.toLocaleString('fr-FR')}</b><small>perdus</small></span></div>
    <div class="kpi2"><span class="ic ambre">${coin(22)}</span><span><b class="num" data-live="rev">${kfmt(m.rev)}</b><small>CA</small></span></div>
    <div class="kpi2"><span class="ic">${ASSETS['icones/up']}</span><span><b class="num" data-live="net">${kfmt(m.net)}</b><small>résultat</small></span></div>
    <p class="kpis2-l">Sur 30 jours glissants</p>`;
}

// signature : la scène n'est reconstruite que si ce qui se voit a changé
function stationSig(lotId) {
  const st = S.stations[lotId];
  return [E.slotsOf(st), st.staff, S.offers.some(o => o.lot === lotId), st.prices.portique, st.prices.hp, E.zoneOf(S, lotId).stage,
    st.units.map(u => u.type + u.tier + unitState(st, u) + (u.down > 0 ? Math.ceil(u.down / 24) : '')).join(','),
    st.q.portique + st.q.hp, JSON.stringify(cibleStation(lotId))].join('|');
}
function stationViewHtml(lotId) {
  const st = S.stations[lotId];
  return `<section class="station-ecran">
    <div class="scene-wrap" id="scene-wrap"><div id="scene-svg" data-sig="${stationSig(lotId)}">${stationSceneSvg(lotId)}</div></div>
    <div class="kpis2" id="station-kpis">${stationKpisHtml(st)}</div>
  </section>`;
}
function stationLive() {
  const st = S.stations[ui.lot];
  if (!st) return;
  const sig = stationSig(ui.lot);
  const box = $('#scene-svg');
  if (box && box.dataset.sig !== sig) { box.innerHTML = stationSceneSvg(ui.lot); box.dataset.sig = sig; }
  const k = $('#station-kpis');
  if (k) { const m = stationMois(st); set(k, 'served', m.lavages.toLocaleString('fr-FR')); set(k, 'lost', m.perdus.toLocaleString('fr-FR')); set(k, 'rev', kfmt(m.rev)); set(k, 'net', kfmt(m.net)); }
}

// objets touchés dans la scène : chacun ouvre son panneau
function stationAct(a, el) {
  const lot = ui.lot;
  switch (a) {
    case 'slot': feuilleOpen('catalogue', { lot, type: null, tier: null }); return true;
    case 'unit': feuilleOpen('unite', { lot, i: +el.dataset.i }); return true;
    case 'enseigne': feuilleOpen('prix', { lot }); return true;
    case 'file': feuilleOpen('file', { lot }); return true;
    case 'offre': feuilleOpen('station', { lot }); return true;
    case 'employe': feuilleOpen('equipe', { lot }); return true;
  }
  return false;
}
