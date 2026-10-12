/* Satisfaction des clients : note sur 5 (façon avis Google) et 5 critères tenus par le moteur
   (prix, attente, pannes, qualité du lavage, accueil). Les avis écrits sont tirés des critères :
   on lit ce que disent les clients et on devine ce qui cloche. */

const AVIS_CRITERES = [
  { k: 'prix', n: 'Prix', ic: 'tag' },
  { k: 'attente', n: 'Attente', ic: 'queue' },
  { k: 'pannes', n: 'Fiabilité', ic: 'wrench' },
  { k: 'qualite', n: 'Qualité du lavage', ic: 'star' },
  { k: 'accueil', n: 'Accueil', ic: 'cap' }
];
const AVIS_PHRASES = {
  prix: {
    mal: ['Bien trop cher pour un lavage.', 'À ce prix-là, je vais chez le voisin.', 'Le programme a encore augmenté…'],
    bien: ['Prix honnête, je reviendrai.', 'Pas cher et efficace !', 'Le meilleur rapport qualité-prix du coin.']
  },
  attente: {
    mal: ['Une file interminable, j\'ai fait demi-tour.', 'Vingt minutes d\'attente un samedi…', 'Toujours du monde, il manque des pistes.'],
    bien: ['Pas d\'attente, top !', 'Servi tout de suite.', 'Jamais de bouchon, c\'est rare.']
  },
  pannes: {
    mal: ['Encore une piste en panne !', 'Équipement hors service, très déçu.', 'Ça tombe en panne tout le temps ici.'],
    bien: ['Tout fonctionnait parfaitement.', 'Matériel nickel, rien à redire.']
  },
  qualite: {
    mal: ['Il reste des traces partout.', 'Lavage moyen, le matériel est fatigué.', 'La mousse ne mousse pas beaucoup…'],
    bien: ['Carrosserie brillante, impeccable !', 'La mousse premium, un régal.', 'Ma voiture n\'a jamais été aussi propre.']
  },
  accueil: {
    mal: ['Personne pour m\'aider avec le monnayeur.', 'Station un peu laissée à l\'abandon.'],
    bien: ['Personnel sympa et de bon conseil.', 'Accueil au top, merci !']
  }
};
const AVIS_NOMS = ['Julie M.', 'Karim B.', 'Sophie L.', 'Thomas R.', 'Nadia K.', 'Pierre G.', 'Léa D.', 'Marc P.', 'Inès T.', 'Hugo F.', 'Claire V.', 'Yanis O.'];
const AVIS_SEUIL_MAL = 3.2, AVIS_SEUIL_BIEN = 4.2;

function noteDe(st) { return st.note == null ? null : st.note; }
function noteTxt(n) { return n == null ? '—' : virgule(n.toFixed(1)); }
// étoiles partielles (SVG) : la forme porte la valeur, le chiffre l'accompagne toujours
function etoilesSvg(note, size = 16, vide = '#D8D2C6') {
  const n = note == null ? 0 : note;
  const path = 'M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z';
  const id = 'et' + Math.random().toString(36).slice(2, 8);
  return `<svg class="etoiles-svg" width="${size * 5}" height="${size}" viewBox="0 0 120 24" aria-hidden="true">
    <defs><clipPath id="${id}"><rect width="${Math.max(0, Math.min(5, n)) * 24}" height="24"/></clipPath></defs>
    ${[0, 1, 2, 3, 4].map(i => `<path d="${path}" transform="translate(${i * 24},0)" fill="${vide}"/>`).join('')}
    <g clip-path="url(#${id})">${[0, 1, 2, 3, 4].map(i => `<path d="${path}" transform="translate(${i * 24},0)" fill="#F5A300"/>`).join('')}</g></svg>`;
}
// critère le plus faible (ce qui cloche) et le plus fort
function avisExtremes(st) {
  if (!st.avis) return null;
  const l = AVIS_CRITERES.map(c => ({ ...c, v: st.avis[c.k] })).sort((a, b) => a.v - b.v);
  return { pire: l[0], meilleur: l[l.length - 1], liste: l };
}
// petit générateur pseudo-aléatoire stable (mêmes avis pour une station un jour donné)
function graine(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296); }
function avisClients(st, n = 3) {
  const x = avisExtremes(st);
  if (!x) return [];
  const r = graine(st.lot + Math.floor(S.d / 3));
  const pick = a => a[Math.floor(r() * a.length)];
  const out = [];
  for (const c of x.liste) {
    if (out.length >= n) break;
    if (c.v < AVIS_SEUIL_MAL) out.push({ c, txt: pick(AVIS_PHRASES[c.k].mal), etoiles: Math.max(1, Math.round(c.v - 0.6)), qui: pick(AVIS_NOMS) });
  }
  for (const c of x.liste.slice().reverse()) {
    if (out.length >= n) break;
    if (c.v >= AVIS_SEUIL_BIEN) out.push({ c, txt: pick(AVIS_PHRASES[c.k].bien), etoiles: Math.min(5, Math.round(c.v + 0.3)), qui: pick(AVIS_NOMS) });
  }
  if (!out.length) out.push({ c: x.pire, txt: 'Correct, sans plus.', etoiles: 3, qui: pick(AVIS_NOMS) });
  return out;
}
// la remarque mise en avant dans le décor
function avisBulle(st) {
  const a = avisClients(st, 1)[0];
  return a ? { txt: a.txt, mal: a.c.v < AVIS_SEUIL_MAL } : null;
}
// conseil et action pour le critère le plus faible
function avisConseil(st) {
  const x = avisExtremes(st);
  if (!x || x.pire.v >= AVIS_SEUIL_MAL) return { txt: 'Tes clients sont contents : continue comme ça.', act: null };
  const usee = st.units.findIndex(u => u.age > E.EQUIP[u.type].tiers[u.tier].life * 365 * 0.85);
  switch (x.pire.k) {
    case 'prix': return { txt: 'Tes prix sont au-dessus du prix habituel du coin : les clients le disent.', act: { label: 'Ajuster les prix', ic: 'tag', k: 'prix' } };
    case 'attente': return E.freeSlots(st) > 0
      ? { txt: 'Trop d\'attente aux heures de pointe : un poste de plus absorberait la file.', act: { label: 'Ajouter un équipement', ic: 'plus', k: 'catalogue' } }
      : { txt: 'Trop d\'attente et plus de place : un prix un peu plus haut lisse l\'affluence.', act: { label: 'Ajuster les prix', ic: 'tag', k: 'prix' } };
    case 'pannes': return { txt: 'Les pannes font fuir : un meilleur contrat d\'entretien répare plus vite.', act: { label: 'Voir l\'entretien', ic: 'wrench', k: 'entretien' } };
    case 'qualite': return usee >= 0
      ? { txt: 'Un équipement en fin de vie abîme la qualité du lavage : pense à le remplacer.', act: { label: 'Voir l\'équipement usé', ic: 'wrench', k: 'unite', i: usee } }
      : st.chem === 0
        ? { txt: 'Le lavage est jugé moyen : la chimie Premium et une gamme supérieure font la différence.', act: { label: 'Passer en chimie Premium', ic: 'wrench', k: 'entretien' } }
        : { txt: 'Le lavage est jugé moyen : une gamme supérieure ferait la différence.', act: { label: 'Voir le catalogue', ic: 'plus', k: 'catalogue' } };
    case 'accueil': return { txt: 'Personne sur place : un employé rassure les clients (et rapporte du CA).', act: { label: 'Voir l\'équipe', ic: 'cap', k: 'equipe' } };
  }
  return { txt: '', act: null };
}

FEUILLES.avis = ({ lot }) => {
  const st = S.stations[lot];
  if (!st) return '';
  const note = noteDe(st);
  if (note == null) return feuille({ ic: 'star', titre: 'Avis clients', sous: esc(stationLabel(lot)),
    corps: `<p class="f-texte">Pas encore d'avis : ils arrivent après les premiers jours de lavage.</p>` });
  const m = stationMois(st);
  const tete = `<div class="avis-tete"><b class="num">${noteTxt(note)}</b>${etoilesSvg(note, 22)}<small>${Math.max(1, Math.round(m.lavages * 0.04)).toLocaleString('fr-FR')} avis ce mois-ci · effet sur l'affluence ${signedPct(E.reputation(st) - 1)}</small></div>`;
  const crit = AVIS_CRITERES.map(c => {
    const v = st.avis[c.k];
    const etat = v < AVIS_SEUIL_MAL ? 'critique' : v >= AVIS_SEUIL_BIEN ? 'ok' : null;
    return `<div class="avis-crit">${icon(c.ic)}<span>${c.n}</span>${etoilesSvg(v, 13)}<b class="num">${noteTxt(v)}</b>${etat ? picto(etat, 16) : '<i></i>'}</div>`;
  }).join('');
  const co = avisConseil(st);
  const dits = avisClients(st, 3).map(a => `<div class="avis-dit">${etoilesSvg(a.etoiles, 12)}<p>« ${esc(a.txt)} »</p><small>${esc(a.qui)} · ${a.c.n.toLowerCase()}</small></div>`).join('');
  const corps = tete + `<div class="avis-crits">${crit}</div>`
    + `<p class="f-texte">${co.act ? picto('critique', 16) : picto('ok', 16)} ${esc(co.txt)}</p>`
    + `<div class="f-h2"><h3>Ce qu'ils disent</h3></div><div class="avis-dits">${dits}</div>`;
  const actions = co.act ? bouton({ label: co.act.label, ic: co.act.ic, fa: 'ouvrir', data: co.act.i != null ? { k: co.act.k, i: co.act.i } : { k: co.act.k }, neon: true, test: 'avis-action' }) : '';
  return feuille({ ic: 'star', titre: 'Avis clients', sous: `${esc(stationLabel(lot))} · note sur un mois environ`, corps, actions,
    note: 'Une bonne note attire plus de clients, une mauvaise en fait fuir.' });
};
function signedPct(x) { const p = Math.round(x * 100); return (p >= 0 ? '+' : '−') + Math.abs(p) + ' %'; }
