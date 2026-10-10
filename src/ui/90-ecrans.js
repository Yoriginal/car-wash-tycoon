/* Feuilles ouvertes depuis le dock et le HUD : Empire (mur des stations), Finances (guichet),
   Missions (tableau de liège), Vestiaire (équipe), Réglages (boîte à gants).
   Elles s'ouvrent par-dessus l'écran en cours (Monde ou Station) et se referment pour y revenir. */

// ---------- Empire ----------
function etatLigne(st) {
  const down = st.units.filter(u => u.down > 0);
  const q = st.q.portique + st.q.hp, cap = E.qmaxOf(st);
  if (down.length) {
    const u = down[0];
    return { k: 'critique', rang: 0, t: `${E.EQUIP[u.type].name} ${E.EQUIP[u.type].tiers[u.tier].n} en panne · ${Math.max(1, Math.ceil(u.down / 24))} j${down.length > 1 ? ` (+${down.length - 1})` : ''}` };
  }
  if (q >= cap) return { k: 'critique', rang: 1, t: `File pleine · ${q}/${cap}` };
  if (!st.units.length) return { k: 'opportunite', rang: 2, t: 'À équiper' };
  if (E.freeSlots(st) > 0) return { k: 'opportunite', rang: 3, t: `${pluriel(E.freeSlots(st), 'emplacement')} libre${E.freeSlots(st) > 1 ? 's' : ''} · file ${q}/${cap}` };
  return { k: 'ok', rang: 4, t: `Tout tourne · file ${q}/${cap}` };
}
function vignette(st) {
  const u = st.units[0];
  const name = u ? `equipements/${TYPE_KEY[u.type]}_${TIER_KEY[u.tier]}_${unitState(st, u, { portique: 0, hp: 0 }) === 'usure' ? 'usure' : u.down > 0 ? 'panne' : 'actif'}` : 'equipements/emplacement_libre';
  return `<span class="vignette">${sprite(name, { J: u && u.down > 0 ? Math.max(1, Math.ceil(u.down / 24)) + ' j' : '' })}</span>`;
}
FEUILLES.empire = f => {
  const mine = Object.values(S.stations).filter(st => st.owner === 'player');
  const ca30 = st => st.hist.slice(-30).reduce((a, x) => a + x.rev, 0);
  const tri = f.tri || 'etat';
  const liste = mine.map(st => ({ st, e: etatLigne(st), ca: ca30(st) }))
    .sort((a, b) => tri === 'ca' ? b.ca - a.ca : a.e.rang - b.e.rang || b.ca - a.ca);
  const secteurs = new Set(mine.map(st => E.sectorOfLot(st.lot))).size;
  const kpis = `<div class="kpis3">
    <div><b class="num">${kfmt(liste.reduce((a, x) => a + x.ca, 0))}</b><small>CA 30 jours</small></div>
    <div><b class="num">${kfmt(E.patrimoine(S))}</b><small>Valeur</small></div>
    <div><b class="num">${S.staff.length}</b><small>Équipe</small></div></div>`;
  const seg = `<div class="segment">${[['ca', 'Par CA'], ['etat', 'Par état']].map(([k, t]) => `<button data-fa="emp-tri" data-v="${k}" class="${tri === k ? 'on' : ''}" aria-pressed="${tri === k}">${t}</button>`).join('')}</div>`;
  const lignes = liste.map(({ st, e, ca }) => {
    const z = E.zoneOf(S, st.lot);
    return `<button class="st-ligne" data-fa="emp-station" data-lot="${st.lot}" data-test="empire-${st.lot}">
      ${vignette(st)}
      <span class="st-mil"><b class="st-nom">${esc(stationLabel(st.lot))}</b>
        <small>Palier ${z.stage + 1} · ${esc(E.STAGES[z.stage].n)}${st.staff ? ' · 1 employé' : ''}</small>
        <span class="st-etat ${e.k}">${picto(e.k, 16)}${esc(e.t)}</span></span>
      <span class="st-ca"><b class="num">${fmt(ca)}</b><small>30 j</small></span>
    </button>`;
  }).join('');
  const corps = kpis + (mine.length > 1 ? seg : '') + `<div class="st-liste">${lignes || '<p class="f-vide">Plus aucune station. Trouve un terrain sur la carte.</p>'}</div>`;
  const actions = bouton({ label: 'Trouver un nouveau terrain', ic: 'map', fa: 'emp-carte', neon: !mine.length })
    + bouton({ label: 'Équipe', ic: 'cap', montant: S.staff.length ? `${S.staff.length} · ${fmt(S.staff.length * E.STAFF_DAY)}/j` : '', fa: 'ouvrir', data: { k: 'vestiaire' } });
  return feuille({ ic: 'empire', titre: 'Empire', sous: `Mur des stations · ${pluriel(mine.length, 'station')} · ${pluriel(secteurs, 'secteur')}`, corps, actions,
    note: mine.length > 1 ? 'Toucher une station ouvre son écran. Le tri « par état » remonte les pannes en premier.' : '' });
};

// ---------- Finances ----------
function courbeTresorerie() {
  const h = S.hist.slice(-60);
  if (h.length < 2) return '<p class="f-texte t-flou">La courbe apparaît après quelques jours de jeu.</p>';
  const W = 340, H = 96;
  const vals = h.map(x => x.cash);
  const lo = Math.min(0, ...vals), hi = Math.max(1, ...vals);
  const x = i => i * W / (h.length - 1), y = v => H - 4 - (v - lo) / (hi - lo) * (H - 10);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const zero = lo < 0 ? `<line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="#EE3B30" stroke-width="1" stroke-dasharray="4 3"/>` : '';
  return `<svg class="courbe" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Trésorerie sur ${h.length} jours">
      <polygon points="0,${H} ${pts} ${W},${H}" fill="#E3F6F3"/>${zero}
      <polyline points="${pts}" fill="none" stroke="#14BFAE" stroke-width="2.4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>
    <div class="courbe-l"><span>Trésorerie · ${h.length} jours</span><span>aujourd'hui</span></div>`;
}
function banqueInfo(f) {
  const lim = E.creditLimit(S);
  const rate = E.loanRate(S, f.montant);
  return { lim, rate, mens: E.monthlyPay(f.montant, rate, f.ans) };
}
FEUILLES.banque = f => {
  const pat = E.patrimoine(S), dette = E.debt(S), nette = S.cash + pat - dette;
  const lim = E.creditLimit(S);
  f.ans = f.ans || 7;
  if (!f.montant || f.montant > lim) f.montant = Math.min(lim, Math.max(5000, Math.round(lim / 2 / 1000) * 1000));
  const bilan = `<div class="bilan">
    <div><b class="num${S.cash < 0 ? ' neg' : ''}">${fmt(S.cash)}</b><small>Trésorerie</small></div>
    <div><b class="num">${fmt(pat)}</b><small>Patrimoine</small></div>
    <div><b class="num">${fmt(dette)}</b><small>Dette</small></div>
    <div><b class="num ${nette >= 0 ? 'pos' : 'neg'}">${fmt(nette)}</b><small>Valeur nette</small></div></div>`;
  let emprunt;
  if (lim < 5000) emprunt = `<p class="f-texte">${picto('critique', 16)} Capacité d'emprunt épuisée : rembourse ou fais grandir ton patrimoine et ton CA.</p>`;
  else {
    const i = banqueInfo(f);
    emprunt = `<div class="f-ligne sans"><span>Montant</span><b class="prix-val num" data-bq="montant">${fmt(f.montant)}</b></div>
      <div class="prix-piste" style="--p:${(f.montant - 5000) / Math.max(1, lim - 5000)}"><input type="range" class="prix-range banque-range" data-test="banque-montant" min="5000" max="${lim}" step="1000" value="${f.montant}" aria-label="Montant à emprunter"></div>
      <div class="f-ligne sans"><span>Durée</span><span class="segment petit">${[3, 5, 7, 10].map(a => `<button data-fa="bq-ans" data-v="${a}" class="${f.ans === a ? 'on' : ''}" aria-pressed="${f.ans === a}">${a} ans</button>`).join('')}</span></div>
      <div class="f-ligne sans"><span>Mensualité</span><b class="num" data-bq="mens">${fmt(i.mens)}/mois</b></div>
      <p class="f-texte t-flou" data-bq="taux">Taux ${virgule((i.rate * 100).toFixed(1))} % · ${f.ans * 12} mensualités</p>
      ${bouton({ label: 'Emprunter', ic: 'loan', montant: `<span data-bq="btn">${fmt(f.montant)}</span>`, fa: 'bq-emprunter', test: 'emprunter' })}`;
  }
  const prets = S.loans.map(l => f.confirm === l.id
    ? `<div class="pret-conf">${bouton({ label: `Solder ce prêt`, ic: 'check', montant: fmt(Math.round(l.remaining)), fa: 'bq-solder', data: { id: l.id }, off: S.cash < l.remaining, danger: false })}${bouton({ label: 'Garder', fa: 'annuler' })}</div>`
    : `<button class="pret" data-fa="bq-pret" data-id="${l.id}"><span><b>${fmt(Math.round(l.remaining))} restants</b><small>${fmt(l.monthly)}/mois · ${l.left} mois · ${virgule((l.rate * 100).toFixed(1))} %</small></span><span class="pret-s">solder</span></button>`).join('');
  const corps = bilan + courbeTresorerie()
    + `<div class="f-h2"><h3>Emprunter</h3><small>jusqu'à ${fmt(lim)}</small></div>${emprunt}`
    + (S.loans.length ? `<div class="f-h2"><h3>Prêts en cours</h3></div><div class="prets">${prets}</div>` : '');
  return feuille({ ic: 'bank', titre: 'Finances', sous: 'Guichet de la Caisse du Chrome', corps,
    note: S.cash < 0 ? `Découvert autorisé : ${fmt(E.OVERDRAFT)}. Au-delà pendant 90 jours, la banque vend une station.` : '' });
};
function banqueMaj(v) {
  const f = ui.f; if (!f || f.kind !== 'banque') return;
  f.montant = v;
  const i = banqueInfo(f), box = $('#backdrop');
  const set2 = (k, t) => { const el = box.querySelector(`[data-bq="${k}"]`); if (el) el.textContent = t; };
  set2('montant', fmt(v)); set2('btn', fmt(v)); set2('mens', `${fmt(i.mens)}/mois`);
  set2('taux', `Taux ${virgule((i.rate * 100).toFixed(1))} % · ${f.ans * 12} mensualités`);
  const r = box.querySelector('.banque-range'); if (r) r.parentNode.style.setProperty('--p', (v - 5000) / Math.max(1, i.lim - 5000));
}

// ---------- Missions ----------
function dateCourte(d) { const x = E.dateOf(d); return `${x.getUTCDate()} ${MOIS[x.getUTCMonth()]}`; }
FEUILLES.missions = () => {
  const n = E.OBJECTIVES.length;
  const objs = E.OBJECTIVES.map((o, i) => {
    if (i < S.obj) return `<div class="mis fait">${picto('ok', 20)}<s>${esc(o.t)}</s></div>`;
    if (i === S.obj) {
      const p = objProgress(i);
      return `<div class="mis cours">${icon('target')}<span class="mis-col"><b>${esc(o.t)}</b>${p ? `<span class="jauge rose"><i style="width:${Math.round(100 * p.v / p.max)}%"></i></span>` : ''}</span>${p ? `<small class="num">${p.t}</small>` : ''}</div>`;
    }
    return `<div class="mis verrou">${icon('lock')}<span>${esc(o.t)}</span></div>`;
  }).join('');
  const fini = S.obj >= n ? `<div class="tampon">${picto('recompense', 22)}Tous les objectifs sont remplis : place au bac à sable.</div>` : '';
  const rivaux = E.RIVALS.map(r => {
    const rs = S.rivals.find(x => x.id === r.id) || {};
    const tot = Object.values(S.stations).filter(st => st.owner === r.id).length;
    const vus = Object.values(S.stations).filter(st => st.owner === r.id && sectorRevealed(st.lot)).length;
    return `<div class="rival"><i style="background:${r.id === 'disc' ? '#FF7A1A' : '#8A5BE0'}"></i><span><b>${esc(r.name)}</b><small>${r.profile === 'discounter' ? 'Prix bas, s\'installe vite près des magasins' : 'Parie sur les zones naissantes'} · ${vus}/${tot} station${tot > 1 ? 's' : ''} repérée${vus > 1 ? 's' : ''}${rs.bankrupt ? ' · en faillite' : ''}</small></span></div>`;
  }).join('');
  const evts = S.events.length ? `<div class="f-h2"><h3>En ce moment</h3></div><div class="evts">${S.events.map(e => `<span>${e.f >= 1 ? picto('opportunite', 14) : picto('critique', 14)}${esc(e.label)}${e.zone ? ' · ' + esc(E.zoneDef(e.zone).name) : ''} <b class="num">${e.f >= 1 ? '+' : '−'}${Math.round(Math.abs(e.f - 1) * 100)} %</b></span>`).join('')}</div>` : '';
  const journal = S.log.slice(0, 40).map(l => `<div class="jr ${l.kind}"><span class="num">${dateCourte(l.d)}</span><span>${esc(l.text)}</span></div>`).join('');
  const corps = `<div class="f-ligne sans titre-joueur"><span>Titre : <b>${esc(E.title(S))}</b></span><small>niveau ${playerLevel()} / ${n}</small></div>
    <div class="missions">${objs}</div>${fini}
    <div class="f-h2"><h3>Rivaux</h3></div><div class="rivaux">${rivaux}</div>${evts}
    <div class="f-h2"><h3>Journal</h3></div><div class="journal">${journal || '<p class="f-vide">Rien pour l\'instant.</p>'}</div>`;
  return feuille({ ic: 'missions', titre: 'Missions', sous: 'Tableau de liège · objectifs, rivaux, journal', corps,
    actions: bouton({ label: 'Réglages', ic: 'sliders', fa: 'ouvrir', data: { k: 'reglages' }, test: 'reglages' }) });
};

// ---------- Vestiaire (toute l'équipe) ----------
FEUILLES.vestiaire = f => {
  const lignes = S.staff.map(e => `<div class="perso-l">${silhouette(44)}<span><b>${esc(e.name)}</b><small>${e.stations.length ? e.stations.map(l => esc(stationLabel(l))).join(', ') : 'Sans affectation'} · ${fmt(E.STAFF_DAY)}/j</small></span>
      ${f.confirm === e.id ? '' : `<button class="capsule petite" data-fa="vest-licencier" data-id="${e.id}">Licencier</button>`}</div>
      ${f.confirm === e.id ? `<div class="pret-conf">${bouton({ label: `Confirmer : licencier ${esc(e.name)}`, fa: 'vest-licencier-ok', data: { id: e.id }, danger: true })}${bouton({ label: 'Garder', fa: 'annuler' })}</div>` : ''}`).join('');
  return feuille({ ic: 'cap', titre: 'Équipe', sous: `Vestiaire · ${pluriel(S.staff.length, 'salarié')} · ${fmt(S.staff.length * E.STAFF_DAY)}/j`,
    corps: lignes || `<p class="f-vide">Aucun employé. Embauche depuis l'outil Équipe d'une station : +${Math.round(E.STAFF_BONUS[1] * 100)} % de CA.</p>`,
    note: 'Pour affecter ou partager un employé, ouvre l\'outil Équipe de la station concernée.' });
};

// ---------- Réglages ----------
FEUILLES.reglages = f => {
  const mode = `<div class="segment">${[['realtime', 'Temps réel'], ['turn', 'Tour par tour']].map(([k, t]) => `<button data-fa="reg-mode" data-v="${k}" class="${S.mode === k ? 'on' : ''}" aria-pressed="${S.mode === k}">${t}</button>`).join('')}</div>
    <p class="f-texte t-flou">${S.mode === 'turn' ? 'Une semaine par tour, avec le bouton du cadran.' : '1 jour = 20 s à la vitesse ×1.'}</p>`;
  let sauvegarde = `<p class="f-texte">Sauvegarde automatique ${Save.status === 'cloud' ? 'sur ton compte Claude et sur cet appareil' : 'sur cet appareil'}. Hors ligne, tes stations tournent à 50 % pendant 8 h maximum.</p>`;
  if (f.importer) sauvegarde += `<textarea id="importCode" class="code" rows="3" placeholder="Colle ici le code de partie"></textarea>`;
  let copies = '';
  if (PREVIEW) {
    const lst = PREVIEW_BACKUPS.map((k, i) => { try { const b = JSON.parse(localStorage.getItem(k) || 'null'); return b && b.at ? { n: i + 1, at: b.at } : null; } catch (e) { return null; } }).filter(Boolean);
    if (lst.length) copies = `<div class="f-h2"><h3>Copies de l'aperçu</h3></div><p class="f-texte t-flou">Ta partie est copiée à chaque ouverture de l'aperçu. En cas de souci, reviens à une copie :</p>`
      + lst.map(b => bouton({ label: `Copie du ${new Date(b.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`, ic: 'clock', fa: 'reg-copie', data: { n: b.n } })).join('');
  }
  const actions = (f.importer
    ? bouton({ label: 'Charger cette partie', ic: 'check', fa: 'reg-importer-ok', neon: true }) + bouton({ label: 'Annuler', fa: 'reg-importer-non' })
    : bouton({ label: 'Copier ma partie', ic: 'sell', fa: 'reg-exporter' }) + bouton({ label: 'Importer une partie', ic: 'down', fa: 'reg-importer' }))
    + copies
    + (f.confirm ? bouton({ label: 'Effacer et recommencer', fa: 'reg-reset-ok', danger: true }) + bouton({ label: 'Garder ma partie', fa: 'annuler' })
      : bouton({ label: 'Nouvelle partie', fa: 'reg-reset' }));
  return feuille({ ic: 'sliders', titre: 'Réglages', sous: `Boîte à gants · version ${APP_VERSION}${PREVIEW ? ' · aperçu' : ''}`,
    corps: `<div class="f-h2"><h3>Rythme</h3></div>${mode}<div class="f-h2"><h3>Sauvegarde</h3></div>${sauvegarde}`, actions });
};

// ---------- actions ----------
function ecransAct(a, el) {
  const f = ui.f || {};
  switch (a) {
    case 'emp-tri': f.tri = el.dataset.v; break;
    case 'emp-station': closeSheet(true); go('station', el.dataset.lot); return true;
    case 'emp-carte': closeSheet(true); go('map'); return true;
    case 'bq-ans': f.ans = +el.dataset.v; break;
    case 'bq-emprunter': {
      const r = E.borrow(S, f.montant, f.ans);
      if (r.ok) { toast(`Prêt de ${fmt(r.loan.principal)} accordé.`, 'good'); f.montant = 0; }
      else if (r.msg) toast(r.msg, 'bad');
      break;
    }
    case 'bq-pret': f.confirm = el.dataset.id; break;
    case 'bq-solder': { const r = E.repay(S, el.dataset.id); if (!r.ok && r.msg) toast(r.msg, 'bad'); f.confirm = null; break; }
    case 'vest-licencier': f.confirm = el.dataset.id; break;
    case 'vest-licencier-ok': E.fire(S, el.dataset.id); f.confirm = null; break;
    case 'reg-mode': S.mode = el.dataset.v; ui.wasPaused = S.mode === 'turn'; break;
    case 'reg-exporter': {
      const code = exportCode();
      const ok = () => toast('Code de partie copié : colle-le dans « Importer une partie » de l\'autre version.', 'good');
      const ko = () => { f.importer = true; feuilleRefresh(); const ta = $('#importCode'); if (ta) { ta.value = code; ta.select(); } toast('Copie automatique refusée : sélectionne le code et copie-le.', 'info'); };
      try { navigator.clipboard.writeText(code).then(ok, ko); } catch (e) { ko(); }
      return true;
    }
    case 'reg-importer': f.importer = true; break;
    case 'reg-importer-non': f.importer = false; break;
    case 'reg-importer-ok': {
      const ta = $('#importCode');
      if (ta && importCode(ta.value)) { toast('Partie importée.', 'good'); return true; }
      toast('Code invalide : recopie-le en entier.', 'bad');
      return true;
    }
    case 'reg-copie': {
      try {
        const b = JSON.parse(localStorage.getItem(PREVIEW_BACKUPS[+el.dataset.n - 1]) || 'null');
        const st = b && b.raw ? E.migrate(JSON.parse(b.raw)) : null;
        if (!st) { toast('Copie illisible.', 'bad'); return true; }
        restore(st, false); Save.touch(); Save.cloud(true);
        toast('Partie restaurée depuis la copie.', 'good');
      } catch (e) { toast('Copie illisible.', 'bad'); }
      return true;
    }
    case 'reg-reset': f.confirm = true; break;
    case 'reg-reset-ok': closeSheet(true); act('reset', { dataset: {} }); return true;
    default: return false;
  }
  renderHud(); Save.touch(); feuilleRefresh();
  return true;
}
// ouverture depuis le dock et le HUD
const NAV_FEUILLE = { stations: 'empire', journal: 'missions', finances: 'banque' };
function navOpen(id) {
  if (id === 'journal') ui.missionNew = false;
  if (NAV_FEUILLE[id]) { feuilleOpen(NAV_FEUILLE[id], { lot: ui.lot }); dockRender(); return; }
  closeSheet(true); go(id);
}
