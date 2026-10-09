/* Feuilles (panneaux) de l'écran Station : Prix, Entretien, fiche équipement, Catalogue, Équipe,
   Station, File d'attente.
   En-tête commun : poignée, icône du lieu, titre, sous-titre en petites capitales, « en pause ».
   Actions empilées en bas, la recommandée en néon en haut de la pile, montant aligné à droite.
   Ouvrir une feuille met le temps en pause ; la fermer (glisser vers le bas ou toucher le décor)
   relance la vitesse précédente. Le moteur n'est appelé que par ses fonctions publiques. */

const A0_UI = 0.5;          // part de « clients qui vont ailleurs » du modèle (estimation affichée seulement)
const HEURES_OUVERTES = 15; // 7 h – 22 h
const ATTR_ETOILES = { 1: 2, 1.2: 3, 1.4: 4 };

// ---------- briques communes ----------
function feuille({ ic, titre, sous = '', corps = '', actions = '', note = '' }) {
  return `<header class="f-tete">
      <span class="f-ic">${icon(ic)}</span><h2 class="f-titre">${esc(titre)}</h2>
      <span class="f-pause">${icon('pause')}en pause</span>
      ${sous ? `<p class="petites-caps f-sous">${sous}</p>` : ''}
    </header>
    <div class="f-corps">${corps}</div>
    ${actions ? `<div class="f-actions">${actions}</div>` : ''}
    ${note ? `<p class="f-note">${note}</p>` : ''}`;
}
function bouton({ label, ic, montant, fa, data = {}, neon = false, off = false, test, danger = false }) {
  const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${escSvg(v)}"`).join('');
  return `<button class="capsule bloc action${neon ? ' neon' : ''}${danger ? ' danger' : ''}" data-fa="${fa}"${attrs}${test ? ` data-test="${test}"` : ''}${off ? ' disabled' : ''}>${ic ? icon(ic) : ''}<span class="lib">${label}</span>${montant ? `<b class="montant">${montant}</b>` : ''}</button>`;
}
function ligne(l, v, cls = '') { return `<div class="f-ligne ${cls}"><span>${l}</span><b class="num">${v}</b></div>`; }
function jauge(part, cls = '') { return `<span class="f-jauge ${cls}"><i style="width:${Math.round(Math.max(0, Math.min(1, part)) * 100)}%"></i></span>`; }
function etoiles(n, max = 5) { return `<span class="etoiles" aria-label="${n} étoiles sur ${max}">${'★'.repeat(n)}<span>${'★'.repeat(max - n)}</span></span>`; }
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const virgule = v => String(v).replace('.', ',');

// ---------- ouverture / rafraîchissement ----------
const FEUILLES = {};
function feuilleOpen(kind, args = {}) {
  const same = ui.f && ui.f.kind === kind && ui.sheet;
  ui.f = Object.assign({ kind, lot: ui.lot }, args);
  feuilleRender(same);
}
function feuilleRender(still = true) {
  if (!ui.f) return;
  const html = FEUILLES[ui.f.kind](ui.f);
  if (!html) { closeSheet(); return; }
  const sc = still ? ($('#backdrop .sheet') || {}).scrollTop || 0 : 0;
  openSheet(html, { feuille: true, still });
  if (sc) $('#backdrop .sheet').scrollTop = sc;
}
const feuilleRefresh = () => feuilleRender(true);

// ---------- Prix ----------
// estimation « ≈ N clients/jour » : modèle de partage de la demande du moteur, recalé sur les 7 derniers jours
function attractAvec(st, prices) {
  const save = st.prices;
  st.prices = prices;
  const a = E.attract(S, st);
  st.prices = save;
  return a;
}
function estimClients(lotId, prices) {
  const st = S.stations[lotId];
  const working = st.units.some(u => u.down === 0) ? st : null;
  if (!st.units.length) return { total: 0, parType: {} };
  const zone = E.lotDef(lotId).zone;
  const autres = Object.values(S.stations).filter(x => x !== st && E.lotDef(x.lot).zone === zone && x.units.some(u => u.down === 0))
    .reduce((a, x) => a + E.attract(S, x), 0);
  const D = E.zoneDemand(S, zone, S.d);
  const modele = p => { const a = attractAvec(st, p); return D * a / (autres + a + A0_UI); };
  let k = 1;
  const h = st.hist.slice(-7);
  if (h.length && working) {
    const vu = h.reduce((a, x) => a + x.served + x.lost, 0) / h.length;
    const m = modele(st.prices);
    if (m > 0 && vu > 0) k = Math.max(0.3, Math.min(3, vu / m));
  }
  const total = modele(prices) * k;
  // répartition par type (même règle que le moteur)
  const w = {};
  let ws = 0;
  for (const t of E.TYPES) {
    const us = st.units.filter(u => u.type === t);
    if (!us.length) continue;
    const best = Math.max(...us.map(u => E.EQUIP[t].tiers[u.tier].attr));
    w[t] = E.EQUIP[t].share * best * E.priceFactor(prices[t], E.refPrice(S, lotId, t));
    ws += w[t];
  }
  const parType = {};
  for (const t in w) parType[t] = ws ? total * w[t] / ws : 0;
  return { total, parType };
}
function capJour(st, t) {
  return st.units.filter(u => u.type === t).reduce((a, u) => a + E.EQUIP[t].tiers[u.tier].cap, 0) * HEURES_OUVERTES;
}
const NIVEAUX_PRIX = [
  { max: 0.55, n: 'Très cher', c: 'rouge' },
  { max: 0.85, n: 'Cher', c: 'ambre' },
  { max: 1.2, n: 'Juste', c: 'vert' },
  { max: 9, n: 'Bon marché', c: 'aqua' }
];
function niveauPrix(pf) { return NIVEAUX_PRIX.findIndex(n => pf <= n.max); }
function prixLigneInfo(lotId, t) {
  const st = S.stations[lotId];
  const ref = E.refPrice(S, lotId, t);
  const pf = E.priceFactor(st.prices[t], ref);
  const niv = niveauPrix(pf);
  const est = estimClients(lotId, st.prices).parType[t] || 0;
  const cap = capJour(st, t);
  return { ref, niv, est: Math.round(est), cap, plein: est > cap * 0.8 };
}
FEUILLES.prix = ({ lot }) => {
  const st = S.stations[lot];
  if (!st) return '';
  const types = E.TYPES.filter(t => st.units.some(u => u.type === t));
  const refs = E.TYPES.map(t => `${E.EQUIP[t].name.toLowerCase()} ${euro(E.refPrice(S, lot, t))}`).join(', ');
  let corps = '';
  if (!types.length) corps = `<p class="f-vide">Installe d'abord un équipement : son prix se règle ici.</p>`;
  for (const t of types) {
    const best = Math.max(...st.units.filter(u => u.type === t).map(u => u.tier));
    const i = prixLigneInfo(lot, t);
    const p = st.prices[t];
    corps += `<div class="prix-ligne" data-t="${t}">
      <div class="prix-tete"><b>${E.EQUIP[t].name} · ${E.EQUIP[t].tiers[best].n}</b>
        <span class="prix-reglage"><button class="rond petit" data-fa="prix-pas" data-t="${t}" data-d="-0.5" aria-label="Baisser de 50 centimes">−</button><b class="prix-val num" data-pv="${t}">${euro(p)}</b><button class="rond petit" data-fa="prix-pas" data-t="${t}" data-d="0.5" aria-label="Monter de 50 centimes">+</button></span></div>
      <div class="prix-piste" style="--p:${(p - 1) / 39};--r:${(i.ref - 1) / 39}">
        <input type="range" class="prix-range" data-t="${t}" data-test="prix-${t}" min="1" max="40" step="0.5" value="${p}" aria-label="Prix ${E.EQUIP[t].name}">
        <span class="prix-ref" aria-hidden="true"><i></i>réf. ${euro(i.ref)}</span>
      </div>
      <div class="prix-bas">
        <span class="prix-niv" data-pn="${t}">${NIVEAUX_PRIX.map((n, j) => `<i class="${n.c}${j === i.niv ? ' on' : ''}"></i>`).join('')}<b>${NIVEAUX_PRIX[i.niv].n}</b></span>
        <span class="prix-est" data-pe="${t}">${icon('car')}<b class="num">≈ ${i.est} clients/j</b></span>
      </div>
      <p class="prix-cap${i.plein ? ' alerte' : ''}" data-pc="${t}">${i.plein ? picto('critique', 16) + ' ' : ''}Capacité : ${i.cap} lavages/j${i.plein ? ' : la file va déborder' : ''}</p>
    </div>`;
  }
  return feuille({
    ic: 'tag', titre: 'Prix', sous: `${esc(stationLabel(lot))} · réf. zone : ${refs}`, corps,
    actions: types.length ? '' : bouton({ label: 'Ouvrir le catalogue', ic: 'plus', fa: 'ouvrir', data: { k: 'catalogue' }, neon: true }),
    note: types.length ? 'Estimation approximative, d\'après les 7 derniers jours. Le temps reprend à la fermeture.' : ''
  });
};
function prixMaj(t) {
  const lot = ui.f && ui.f.lot, st = S.stations[lot];
  if (!st) return;
  const box = $('#backdrop');
  for (const tt of E.TYPES) {
    if (!st.units.some(u => u.type === tt)) continue;
    const i = prixLigneInfo(lot, tt);
    const pv = box.querySelector(`[data-pv="${tt}"]`); if (pv) pv.textContent = euro(st.prices[tt]);
    const r = box.querySelector(`.prix-range[data-t="${tt}"]`);
    if (r && tt === t && +r.value !== st.prices[tt]) r.value = st.prices[tt];
    if (r) r.parentNode.style.setProperty('--p', (st.prices[tt] - 1) / 39);
    const pn = box.querySelector(`[data-pn="${tt}"]`);
    if (pn) { pn.querySelectorAll('i').forEach((el, j) => el.classList.toggle('on', j === i.niv)); pn.querySelector('b').textContent = NIVEAUX_PRIX[i.niv].n; }
    const pe = box.querySelector(`[data-pe="${tt}"] b`); if (pe) pe.textContent = `≈ ${i.est} clients/j`;
    const pc = box.querySelector(`[data-pc="${tt}"]`);
    if (pc) { pc.classList.toggle('alerte', i.plein); pc.innerHTML = `${i.plein ? picto('critique', 16) + ' ' : ''}Capacité : ${i.cap} lavages/j${i.plein ? ' : la file va déborder' : ''}`; }
  }
}
function prixSet(t, v) {
  const st = S.stations[ui.f.lot];
  st.prices[t] = Math.max(1, Math.min(40, Math.round(v * 2) / 2));
  prixMaj(t);
  Save.touch();
}

// ---------- Entretien ----------
FEUILLES.entretien = ({ lot }) => {
  const st = S.stations[lot];
  if (!st) return '';
  const slots = E.usedSlots(st);
  const pannes = st.units.filter(u => u.down > 0);
  const surcout = E.TYPES.map(t => `+${virgule(E.EQUIP[t].chem.toFixed(2))} € par ${t === 'hp' ? 'piste' : 'portique'}`).join(' · ');
  const chimie = E.CHEM.map((c, i) => `<button class="choix${st.chem === i ? ' choisi' : ''}" data-fa="chimie" data-v="${i}" aria-pressed="${st.chem === i}">
      <span class="choix-t">${c.n}${st.chem === i ? icon('check', 'ic coche') : ''}</span>
      <span class="choix-d">${i ? `+${Math.round((c.attr - 1) * 100)} % d'attractivité` : 'Qualité correcte'}</span>
      <span class="choix-p">${i ? surcout : 'Sans surcoût'}</span></button>`).join('');
  const contrats = E.CONTRACTS.map((c, i) => `<button class="choix${st.contract === i ? ' choisi' : ''}" data-fa="contrat" data-v="${i}" data-test="contrat-${i}" aria-pressed="${st.contract === i}">
      <span class="choix-t">${c.n}${st.contract === i ? icon('check', 'ic coche') : ''}</span>
      <span class="choix-d">Intervention sous ${c.delay} j</span>
      <span class="choix-p">${c.perUnitDay ? `${fmt(c.perUnitDay * slots * 30)}/mois` : 'Rien par mois'} · ${c.repairMul === 1 ? 'réparation facturée' : c.repairMul ? 'pièces facturées' : 'tout inclus'}</span></button>`).join('');
  const corps = `${pannes.length ? `<div class="f-alerte">${picto('critique', 20)}<span>${pannes.map(u => `${E.EQUIP[u.type].name} ${E.EQUIP[u.type].tiers[u.tier].n} en panne : intervention dans ${Math.max(1, Math.ceil(u.down / 24))} j`).join('<br>')}</span></div>` : ''}
    <h3 class="f-h3">Chimie</h3><div class="choix-grille deux">${chimie}</div>
    <h3 class="f-h3">Contrat de maintenance</h3><div class="choix-grille">${contrats}</div>`;
  return feuille({ ic: 'wrench', titre: 'Entretien', sous: `${esc(stationLabel(lot))} · ${pluriel(slots, 'emplacement')} équipé${slots > 1 ? 's' : ''}`, corps,
    note: 'Un nouveau contrat s\'applique aux prochaines pannes.' });
};

// ---------- fiche équipement ----------
FEUILLES.unite = ({ lot, i, confirm }) => {
  const st = S.stations[lot];
  const u = st && st.units[i];
  if (!u) return '';
  const eq = E.EQUIP[u.type], t = eq.tiers[u.tier];
  const ans = u.age / 365;
  const usure = u.age > t.life * 365 * 0.7;
  const etat = unitState(st, u, { portique: 0, hp: 0 });
  const jours = Math.max(1, Math.ceil(u.down / 24));
  const ct = E.CONTRACTS[st.contract];
  const visuel = `<div class="f-visuel">${sprite(`equipements/${TYPE_KEY[u.type]}_${TIER_KEY[u.tier]}_${u.down > 0 ? 'panne' : etat === 'usure' ? 'usure' : 'actif'}`, { J: jours + ' j' })}</div>`;
  let corps = visuel;
  if (u.down > 0) corps += `<div class="f-alerte">${picto('critique', 20)}<span><b>En panne : intervention dans ${pluriel(jours, 'jour')}.</b><br>Contrat ${ct.n}${st.contract < 3 ? ` · avec ${E.CONTRACTS[st.contract + 1].n} : sous ${E.CONTRACTS[st.contract + 1].delay} j` : ''}</span></div>`;
  else if (usure) corps += `<div class="f-alerte ambre">${picto('opportunite', 20)}<span>Fin de vie proche : les pannes deviennent plus fréquentes. Pense à le remplacer.</span></div>`;
  corps += `<div class="f-lignes">
    <div class="f-ligne"><span>Âge</span><b class="num">${virgule(ans.toFixed(1))} an${ans >= 2 ? 's' : ''} / ${t.life} ans</b></div>${jauge(ans / t.life, usure ? 'ambre' : '')}
    ${ligne('Fiabilité', `${virgule(t.fail)} panne${t.fail > 1 ? 's' : ''}/an${usure ? ', en hausse' : ''}`)}
    ${ligne('Capacité', `${t.cap} lavages/h`)}
    ${ligne('Emplacements', eq.slots)}
    ${ligne('Valeur de revente', fmt(E.unitResale(u)))}
  </div>`;
  let actions = '';
  if (u.down > 0) actions += bouton({ label: 'Voir l\'entretien', ic: 'wrench', fa: 'ouvrir', data: { k: 'entretien' }, neon: true });
  actions += confirm
    ? bouton({ label: 'Confirmer la revente', ic: 'sell', montant: fmt(E.unitResale(u)), fa: 'unite-revendre-ok', danger: true, test: 'revendre-ok' }) + bouton({ label: 'Garder', fa: 'annuler' })
    : bouton({ label: 'Revendre', ic: 'sell', montant: fmt(E.unitResale(u)), fa: 'unite-revendre', test: 'revendre' });
  const poste = st.units.slice(0, i).reduce((a, x) => a + E.EQUIP[x.type].slots, 0) + 1;
  return feuille({ ic: 'wrench', titre: `${eq.name} ${t.n}`, sous: `${esc(stationLabel(lot))} · poste ${poste}${eq.slots > 1 ? '-' + (poste + 1) : ''}`, corps, actions });
};

// ---------- Catalogue ----------
function catalogueDefaut(st) {
  const free = E.freeSlots(st);
  const type = free >= 2 && !st.units.some(u => u.type === 'portique') ? 'portique' : 'hp';
  const tiers = E.EQUIP[type].tiers;
  let tier = 0;
  tiers.forEach((t, i) => { if (t.price <= S.cash) tier = i; });
  return { type, tier };
}
function pretPour(prix, marge = 0) {
  const need = Math.ceil((prix + marge - Math.max(0, S.cash)) / 1000) * 1000;
  if (need <= 0) return null;
  if (need > E.creditLimit(S)) return { need, refuse: true };
  return { need, mensuel: E.monthlyPay(need, E.loanRate(S, need), 7) };
}
FEUILLES.catalogue = f => {
  const st = S.stations[f.lot];
  if (!st) return '';
  if (!f.type) Object.assign(f, catalogueDefaut(st));
  if (f.tier == null) f.tier = 0;
  const eq = E.EQUIP[f.type];
  const free = E.freeSlots(st);
  const rentre = free >= eq.slots;
  const seg = `<div class="segment" role="tablist">${E.TYPES.map(t => `<button role="tab" data-fa="cat-type" data-t="${t}" data-test="type-${t}" aria-selected="${t === f.type}" class="${t === f.type ? 'on' : ''}">${t === 'hp' ? 'Pistes HP' : 'Portiques'}</button>`).join('')}</div>`;
  const cartes = eq.tiers.map((t, i) => {
    const on = i === f.tier;
    return `<button class="gamme${on ? ' on' : ''}${rentre ? '' : ' grise'}" data-fa="cat-gamme" data-v="${i}" data-test="tier-${i}" aria-pressed="${on}">
      <span class="gamme-visuel">${sprite(`equipements/${TYPE_KEY[f.type]}_${TIER_KEY[i]}_${on && rentre ? 'actif' : 'arret'}`, { J: '' })}</span>
      <b class="gamme-prix num">${fmt(t.price)}</b>${etoiles(ATTR_ETOILES[t.attr] || 3)}
      <span class="gamme-stats"><span>${icon('car')}${t.cap} / h</span><span>${icon('wrench')}${virgule(t.fail)} / an</span><span>${icon('clock')}${t.life} ans</span><span>${icon('plus')}${pluriel(eq.slots, 'empl.').replace('empl.s', 'empl.')}</span></span>
      ${rentre ? '' : `<span class="gamme-raison">${picto('critique', 18)}Ne rentre pas : ${eq.slots} emplacements</span>`}
    </button>`;
  }).join('');
  const legende = `<p class="gamme-legende"><span>${icon('car')}lavages/h</span><span>${icon('wrench')}pannes/an</span><span>${icon('clock')}durée de vie</span><span>${icon('plus')}place</span></p>`;
  const t = eq.tiers[f.tier];
  const assez = S.cash >= t.price;
  const pret = assez ? null : pretPour(t.price);
  let actions = '';
  if (rentre) {
    actions += bouton({ label: `Acheter le ${t.n}`, ic: 'plus', montant: fmt(t.price), fa: 'cat-acheter', neon: assez, off: !assez, test: `buy-${f.type}-${f.tier}` });
    if (pret && !pret.refuse) actions += bouton({ label: 'Acheter avec un prêt', ic: 'loan', montant: `${fmt(pret.mensuel)}/mois`, fa: 'cat-pret', neon: true, test: 'buy-loan' });
  }
  const unNom = f.type === 'hp' ? 'une piste HP' : 'un portique';
  let note = `${pluriel(free, 'emplacement')} libre${free > 1 ? 's' : ''} · ${unNom} demande ${pluriel(eq.slots, 'emplacement')}.`;
  if (!rentre) note = `${free ? pluriel(free, 'emplacement') + ' libre' + (free > 1 ? 's' : '') : 'Aucun emplacement libre'} : ${unNom} demande ${pluriel(eq.slots, 'emplacement')}.`;
  else if (pret && pret.refuse) note += ` Trésorerie insuffisante, et la banque ne prête pas ${fmt(pret.need)} pour l'instant.`;
  else if (pret) note += ` Prêt de ${fmt(pret.need)} sur 7 ans.`;
  note += ` Prix de référence de la zone : ${euro(E.refPrice(S, f.lot, f.type))}.`;
  return feuille({ ic: 'station', titre: 'Catalogue', sous: `Showroom · ${esc(stationLabel(f.lot))} · ${pluriel(free, 'emplacement')} libre${free > 1 ? 's' : ''}`,
    corps: seg + `<div class="gammes">${cartes}</div>` + legende, actions, note });
};

// ---------- Équipe ----------
function silhouette(size = 56) {
  return `<svg class="silhouette" width="${size}" height="${size}" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="27" fill="#EFEBE3"/><circle cx="28" cy="21" r="9" fill="#E9C9A8"/><path d="M19 15 Q28 6 37 15 L37 17 L19 17 Z" fill="#1B2024"/><rect x="17" y="15.5" width="22" height="3" rx="1.5" fill="#1B2024"/><path d="M11 50 Q11 34 28 34 Q45 34 45 50 Z" fill="#14BFAE"/><path d="M24 34 L28 41 L32 34" fill="#F4F0E6"/></svg>`;
}
FEUILLES.equipe = ({ lot, confirm }) => {
  const st = S.stations[lot];
  if (!st) return '';
  const emp = st.staff ? S.staff.find(e => e.id === st.staff) : null;
  const sect = E.sectorOfLot(lot);
  const dispo = S.staff.filter(e => e !== emp && e.stations.length < 3 && e.stations.every(l => E.sectorOfLot(l) === sect));
  const bonusDe = n => Math.round((E.STAFF_BONUS[Math.min(3, n)] || 0) * 100);
  let corps = '', actions = '';
  if (emp) {
    corps = `<div class="f-perso">${silhouette()}<span><b>${esc(emp.name)}</b><small>+${bonusDe(emp.stations.length)} % de CA ici · couvre ${pluriel(emp.stations.length, 'station')} · ${fmt(E.STAFF_DAY)}/j</small></span></div>
      ${emp.stations.length > 1 ? `<p class="f-texte">Partagé·e avec : ${emp.stations.filter(l => l !== lot).map(l => esc(E.lotDef(l).name)).join(', ')}.</p>` : ''}`;
    actions = bouton({ label: 'Retirer de cette station', fa: 'eq-retirer' })
      + (confirm ? bouton({ label: `Confirmer : licencier ${esc(emp.name)}`, fa: 'eq-licencier-ok', danger: true }) + bouton({ label: 'Garder', fa: 'annuler' })
        : bouton({ label: 'Licencier', fa: 'eq-licencier' }));
  } else {
    corps = `<div class="f-perso vide">${silhouette()}<span><b>Personne sur place</b><small>Une personne sur place : +${bonusDe(1)} % de CA (+${bonusDe(2)} % si partagée sur 2 stations, +${bonusDe(3)} % sur 3).</small></span></div>`;
    actions = bouton({ label: 'Embaucher', ic: 'cap', montant: `${fmt(E.STAFF_DAY)}/j`, fa: 'eq-embaucher', neon: !dispo.length, test: 'embaucher' })
      + dispo.map(e => bouton({ label: `Partager ${esc(e.name)} (${e.stations.length}/3)`, montant: `+${bonusDe(e.stations.length + 1)} %`, fa: 'eq-partager', data: { emp: e.id } })).join('');
  }
  return feuille({ ic: 'cap', titre: 'Équipe', sous: `Vestiaire · ${esc(stationLabel(lot))} · ${pluriel(S.staff.length, 'salarié')}`, corps, actions,
    note: 'Un employé peut couvrir jusqu\'à 3 stations du même secteur.' });
};

// ---------- Station ----------
FEUILLES.station = ({ lot, confirm }) => {
  const st = S.stations[lot];
  if (!st || st.owner !== 'player') return '';
  const z = E.zoneOf(S, lot);
  const h = st.hist.slice(-30);
  const rev = h.reduce((a, x) => a + x.rev, 0), net = h.reduce((a, x) => a + x.rev - x.cost, 0), lost = h.reduce((a, x) => a + x.lost, 0);
  const equip = st.units.reduce((a, u) => a + E.unitResale(u), 0);
  const offre = S.offers.find(o => o.lot === lot);
  let corps = `<div class="f-lignes">
    ${ligne('Valeur de la station', fmt(E.stationValue(S, lot)), 'fort')}
    ${ligne('dont terrain', fmt(E.lotPrice(S, lot)), 'sous')}
    ${ligne('dont équipements', fmt(equip), 'sous')}
    ${ligne('Emplacements', `${E.usedSlots(st)} / ${E.slotsOf(st)}`)}
    ${ligne('File d\'attente max.', `${E.qmaxOf(st)} voitures`)}
    ${ligne(`CA sur ${h.length || 0} j`, fmt(rev))}
    ${ligne('Résultat', signed(net), net >= 0 ? '' : 'neg')}
    ${ligne('Clients perdus', lost)}
  </div>`;
  let actions = '';
  if (offre) {
    const jours = Math.max(0, offre.until - Math.floor(S.d));
    corps = `<div class="f-offre">${picto('opportunite', 26)}<span><b>La parcelle voisine se libère</b><small>+${pluriel(offre.slots, 'emplacement')}, +${offre.q} places de file · encore ${pluriel(jours, 'jour')}</small></span></div>` + corps;
    const pret = S.cash >= offre.price ? null : pretPour(offre.price);
    actions += bouton({ label: 'Racheter la parcelle', ic: 'plus', montant: fmt(offre.price), fa: 'st-racheter', neon: !pret, off: !!pret, test: 'racheter' });
    if (pret && !pret.refuse) actions += bouton({ label: 'Racheter avec un prêt', ic: 'loan', montant: `${fmt(pret.mensuel)}/mois`, fa: 'st-racheter-pret', neon: true });
  }
  actions += confirm
    ? bouton({ label: 'Confirmer la vente', ic: 'sell', montant: fmt(E.stationValue(S, lot)), fa: 'st-vendre-ok', danger: true }) + bouton({ label: 'Garder la station', fa: 'annuler' })
    : bouton({ label: 'Vendre la station', ic: 'sell', montant: fmt(E.stationValue(S, lot)), fa: 'st-vendre' });
  return feuille({ ic: 'station', titre: E.lotDef(lot).name, sous: `Palier ${z.stage + 1} · ${esc(E.STAGES[z.stage].n)}`, corps, actions });
};

// ---------- File d'attente ----------
FEUILLES.file = ({ lot }) => {
  const st = S.stations[lot];
  if (!st) return '';
  const q = st.q.portique + st.q.hp, cap = E.qmaxOf(st);
  const h = st.hist.slice(-7);
  const lost7 = h.reduce((a, x) => a + x.lost, 0);
  const capH = E.TYPES.reduce((a, t) => a + st.units.filter(u => u.type === t && u.down === 0).reduce((b, u) => b + E.EQUIP[t].tiers[u.tier].cap, 0), 0);
  const free = E.freeSlots(st);
  let conseil, actions = '';
  if (!st.units.length) { conseil = 'Aucun équipement : installe un premier poste.'; actions = bouton({ label: 'Ouvrir le catalogue', ic: 'plus', fa: 'ouvrir', data: { k: 'catalogue' }, neon: true }); }
  else if (lost7 > 0 && free > 0) { conseil = 'Des clients repartent faute de place : un équipement de plus absorberait la file.'; actions = bouton({ label: 'Ajouter un équipement', ic: 'plus', fa: 'ouvrir', data: { k: 'catalogue' }, neon: true }) + bouton({ label: 'Ajuster les prix', ic: 'tag', fa: 'ouvrir', data: { k: 'prix' } }); }
  else if (lost7 > 0) { conseil = 'La station est pleine : monter un peu les prix rapporte plus par lavage et raccourcit la file.'; actions = bouton({ label: 'Ajuster les prix', ic: 'tag', fa: 'ouvrir', data: { k: 'prix' }, neon: true }); }
  else conseil = 'La file s\'écoule bien : aucun client perdu ces 7 derniers jours.';
  const corps = `<div class="f-lignes">
    ${ligne('En file maintenant', `${q} / ${cap}`)}
    ${ligne('Perdus aujourd\'hui', st.day.lost)}
    ${ligne(`Perdus sur ${h.length || 0} j`, lost7)}
    ${ligne('Capacité en marche', `${capH} lavages/h`)}
  </div><p class="f-texte">${lost7 > 0 ? picto('critique', 18) : picto('ok', 18)} ${conseil}</p>`;
  return feuille({ ic: 'queue', titre: 'File d\'attente', sous: esc(stationLabel(lot)), corps, actions });
};

// ---------- actions des feuilles ----------
function feuilleAct(a, el) {
  const f = ui.f || {};
  const lot = f.lot;
  const st = S.stations[lot];
  let r;
  if (mondeAct(a)) return;
  switch (a) {
    case 'ouvrir': feuilleOpen(el.dataset.k, { lot }); return;
    case 'annuler': f.confirm = null; feuilleRefresh(); return;
    case 'prix-pas': prixSet(el.dataset.t, st.prices[el.dataset.t] + +el.dataset.d); return;
    case 'chimie': st.chem = +el.dataset.v; break;
    case 'contrat': st.contract = +el.dataset.v; break;
    case 'unite-revendre': f.confirm = true; break;
    case 'unite-revendre-ok': r = E.sellUnit(S, lot, f.i); if (r.ok) { closeSheet(); toast(`Équipement revendu ${fmt(r.v)}.`, 'info'); renderHud(); Save.touch(); } return;
    case 'cat-type': f.type = el.dataset.t; f.tier = catalogueDefautTier(f.type); break;
    case 'cat-gamme': f.tier = +el.dataset.v; break;
    case 'cat-acheter': case 'cat-pret': {
      const t = E.EQUIP[f.type].tiers[f.tier];
      if (a === 'cat-pret') { const p = pretPour(t.price); if (p && !p.refuse) { r = E.borrow(S, p.need, 7); if (!r.ok) break; } }
      r = E.buyUnit(S, lot, f.type, f.tier);
      if (r.ok) { closeSheet(); toast(`${E.EQUIP[f.type].name} ${t.n} installé.`, 'good'); renderHud(); Save.touch(); return; }
      break;
    }
    case 'eq-embaucher': { const e = E.hire(S); E.assign(S, e.id, lot); toast(`${e.name} est embauché·e.`, 'good'); break; }
    case 'eq-partager': r = E.assign(S, el.dataset.emp, lot); break;
    case 'eq-retirer': E.unassign(S, lot); break;
    case 'eq-licencier': f.confirm = true; break;
    case 'eq-licencier-ok': E.fire(S, st.staff); f.confirm = null; break;
    case 'st-racheter': case 'st-racheter-pret': {
      const o = S.offers.find(x => x.lot === lot);
      if (!o) break;
      if (a === 'st-racheter-pret') { const p = pretPour(o.price); if (p && !p.refuse) { r = E.borrow(S, p.need, 7); if (!r.ok) break; } }
      r = E.takeOffer(S, o.id);
      if (r.ok) toast('Parcelle rachetée : 2 emplacements de plus.', 'good');
      break;
    }
    case 'st-vendre': f.confirm = true; break;
    case 'st-vendre-ok': r = E.sellStation(S, lot); closeSheet(true); go('stations'); toast(`Station vendue ${fmt(r.v)}.`, 'info'); renderHud(); Save.touch(); return;
  }
  if (r && !r.ok && r.msg) toast(r.msg, 'bad');
  renderHud();
  Save.touch();
  feuilleRefresh();
}
function catalogueDefautTier(type) {
  let tier = 0;
  E.EQUIP[type].tiers.forEach((t, i) => { if (t.price <= S.cash) tier = i; });
  return tier;
}

// ---------- gestes : curseur de prix, glisser vers le bas pour fermer ----------
function feuillesBind() {
  document.addEventListener('input', e => {
    const r = e.target.closest && e.target.closest('.prix-range');
    if (r) prixSet(r.dataset.t, +r.value);
  });
  let drag = null;
  const bd = $('#backdrop');
  bd.addEventListener('pointerdown', e => {
    const sh = e.target.closest('.sheet.feuille');
    if (!sh || !e.target.closest('.f-tete, .grab')) return;
    drag = { y: e.clientY, sh, dy: 0, id: e.pointerId };
    sh.setPointerCapture(e.pointerId);
  });
  bd.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dy = Math.max(0, e.clientY - drag.y);
    drag.sh.style.transform = `translateY(${drag.dy}px)`;
  });
  const fin = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (d.dy > 90) closeSheet();
    else { d.sh.style.transition = 'transform .18s ease'; d.sh.style.transform = ''; setTimeout(() => { d.sh.style.transition = ''; }, 200); }
  };
  bd.addEventListener('pointerup', fin);
  bd.addEventListener('pointercancel', fin);
}
