/* Moments forts et alertes, tous dérivés de l'état du moteur (aucune donnée ajoutée à la sauvegarde).
   - Pop-ups (carte centrale, bandeau de couleur, Bulle) : panne, parcelle voisine, objectif atteint,
     retour après absence, alerte banque, vente forcée, faillite. Une file d'attente les montre un par un.
   - Cloche : liste des alertes en cours, chacune mène à l'objet concerné.
   - Prochaine action : un seul objet en néon (panne > file pleine > emplacement libre > étude). */

const PANNE_MIN_H = 13;   // un monnayeur bloqué (12 h) va dans la cloche, pas en pop-up

// ---------- détection des moments forts (comparaison avec l'état précédent) ----------
function instantane() {
  const pannes = {};
  for (const st of Object.values(S.stations)) if (st.owner === 'player') pannes[st.lot] = st.units.map(u => u.down > 0);
  return { pannes, offres: new Set(S.offers.map(o => o.id)), decouvert: S.overdraftDays || 0, log: S.log[0] };
}
function evenementsScan() {
  const prev = ui.prev;
  const now = instantane();
  ui.prev = now;
  if (!prev) return;
  ui.pops = ui.pops || [];
  // pannes nouvelles (une seule pop-up par jour de jeu, le reste va dans la cloche)
  for (const lot in now.pannes) {
    const st = S.stations[lot], av = prev.pannes[lot];
    if (!av || av.length !== now.pannes[lot].length) continue;
    st.units.forEach((u, i) => {
      if (!av[i] && u.down >= PANNE_MIN_H && ui.panneJour !== Math.floor(S.d)) {
        ui.panneJour = Math.floor(S.d);
        ui.pops.push({ k: 'panne', lot, i });
      }
    });
  }
  for (const o of S.offers) if (!prev.offres.has(o.id) && S.stations[o.lot]) ui.pops.push({ k: 'opp', id: o.id });
  if (now.decouvert >= 1 && prev.decouvert === 0) ui.pops.push({ k: 'banque' });
  // vente forcée par la banque (lue dans le journal)
  for (const l of S.log) { if (l === prev.log) break; if (/forcé la vente/.test(l.text)) ui.pops.push({ k: 'vente', text: l.text }); }
}
// plusieurs objectifs atteints d'un coup : une seule carte
function popupMission(titre) {
  ui.pops = ui.pops || [];
  const m = ui.pops.find(p => p.k === 'mission');
  if (m) m.titres.push(titre); else ui.pops.push({ k: 'mission', titres: [titre] });
  ui.missionNew = true;
}
function popupNext() {
  if (ui.sheet || !ui.pops || !ui.pops.length || (S && S.over)) return;
  while (ui.pops.length) {
    const p = ui.pops.shift();
    const html = popupHtml(p);
    if (html) { ui.pop = p; openSheet(html, { center: true, noClose: true }); $('#backdrop .sheet').classList.add('popup'); return; }
  }
}

// ---------- cartes ----------
function bandeau(cls, humeur, surtitre, titre, droite = '') {
  return `<div class="pop-band ${cls}">${bulle(humeur, 54)}<span><small>${surtitre}</small><b>${titre}</b></span>${droite}</div>`;
}
function popupHtml(p) {
  switch (p.k) {
    case 'panne': {
      const st = S.stations[p.lot], u = st && st.units[p.i];
      if (!u || u.down <= 0) return '';
      const ct = E.CONTRACTS[st.contract], j = Math.max(1, Math.ceil(u.down / 24));
      const mieux = E.CONTRACTS.find(c => c.delay < ct.delay);
      return bandeau('rouge', 'oups', 'Panne', `${E.EQUIP[u.type].name} ${E.EQUIP[u.type].tiers[u.tier].n}`, `<span class="pop-picto">${picto('critique', 28)}</span>`)
        + `<div class="pop-corps">${ligne('Station', esc(stationLabel(p.lot)))}${ligne('Intervention', `dans ${pluriel(j, 'jour')}`)}${ligne('Contrat', ct.n)}
          ${mieux ? `<p class="f-texte t-flou">Avec le contrat ${mieux.n} : intervention sous ${pluriel(mieux.delay, 'jour')}.</p>` : ''}</div>
        <div class="f-actions">${bouton({ label: 'Voir la station', ic: 'station', fa: 'pop-station', data: { lot: p.lot }, neon: true, test: 'pop-station' })}${bouton({ label: 'Plus tard', fa: 'pop-fermer' })}</div>`;
    }
    case 'opp': {
      const o = S.offers.find(x => x.id === p.id);
      if (!o || !S.stations[o.lot]) return '';
      const st = S.stations[o.lot];
      const jours = Math.max(0, o.until - Math.floor(S.d));
      const avant = E.slotsOf(st);
      const cases = Array.from({ length: avant }, () => '<i></i>').join('') + Array.from({ length: o.slots }, () => '<i class="neuf"></i>').join('');
      const pret = S.cash >= o.price ? null : pretPour(o.price);
      return bandeau('ambre', 'joie', 'Opportunité', 'Parcelle voisine', `<span class="pop-cpt">${icon('clock')}${jours} j</span>`)
        + `<div class="pop-corps">${ligne('Station', esc(stationLabel(o.lot)))}${ligne('Emplacements', '+' + o.slots)}${ligne('Places de file', '+' + o.q)}${ligne('Prix', fmt(o.price))}
          <div class="pop-cases"><span>${cases}</span><b>${avant} → ${avant + o.slots} postes</b></div></div>
        <div class="f-actions">${bouton({ label: 'Racheter', ic: 'plus', montant: fmt(o.price), fa: 'pop-racheter', data: { id: o.id }, neon: !pret, off: !!pret, test: 'pop-racheter' })}
          ${pret && !pret.refuse ? bouton({ label: 'Racheter avec un prêt', ic: 'loan', montant: `${fmt(pret.mensuel)}/mois`, fa: 'pop-racheter-pret', data: { id: o.id }, neon: true }) : ''}
          ${bouton({ label: 'Plus tard', fa: 'pop-fermer' })}</div>`;
    }
    case 'mission': {
      const conf = Array.from({ length: 18 }, (_, i) => `<i style="left:${(i * 37) % 100}%;top:${(i * 53) % 70}%;background:${['#FF2E7A', '#14BFAE', '#F5A300', '#1E97E0'][i % 4]};transform:rotate(${i * 47}deg)"></i>`).join('');
      return `<div class="pop-mission"><div class="confettis" aria-hidden="true">${conf}</div>${bulle('joie', 92)}
          <div class="tampon-mission">Mission${(p.titres || []).length > 1 ? 's' : ''} accomplie${(p.titres || []).length > 1 ? 's' : ''}</div>
          ${(p.titres || [p.titre]).map(t => `<b>${esc(t)}</b>`).join('')}<small>Titre : ${esc(E.title(S))} · niveau ${playerLevel()} / ${E.OBJECTIVES.length}</small>
          ${S.obj < E.OBJECTIVES.length ? `<small class="pop-suite">Prochain objectif : ${esc(E.OBJECTIVES[S.obj].t)}</small>` : ''}</div>
        <div class="f-actions">${bouton({ label: 'Continuer', fa: 'pop-fermer', neon: true, test: 'pop-continuer' })}</div>`;
    }
    case 'absence': {
      const hh = Math.floor(p.hours), mm = Math.round((p.hours - hh) * 60);
      return `<div class="pop-titre">Pendant ton absence</div>
        <div class="ticket">${ligne('Durée', `${hh ? hh + ' h ' : ''}${String(mm).padStart(hh ? 2 : 1, '0')}${hh ? '' : ' min'}`)}${ligne('Régime', 'mi-régime (50 %)')}${ligne('Stations', Object.values(S.stations).filter(st => st.owner === 'player').length)}
          <div class="ticket-total"><span>Gains</span><b class="num">+${fmt(p.gain)}</b></div></div>
        <div class="f-actions">${bouton({ label: 'Encaisser', ic: 'coin', fa: 'pop-fermer', neon: true, test: 'pop-encaisser' })}</div>`;
    }
    case 'banque':
      if (S.cash >= -E.OVERDRAFT) return '';
      return bandeau('rouge', 'oups', 'Alerte de la banque', 'Découvert dépassé', `<span class="pop-picto">${picto('critique', 28)}</span>`)
        + `<div class="pop-corps">${ligne('Trésorerie', fmt(S.cash))}${ligne('Découvert autorisé', fmt(-E.OVERDRAFT))}
          <p class="f-texte">Si la trésorerie reste sous le découvert pendant 90 jours, la banque vend une station. Emprunte, vends un équipement ou baisse tes coûts.</p></div>
        <div class="f-actions">${bouton({ label: 'Voir la banque', ic: 'bank', fa: 'pop-banque', neon: true })}${bouton({ label: 'Plus tard', fa: 'pop-fermer' })}</div>`;
    case 'vente':
      return bandeau('rouge', 'oups', 'Banque', 'Vente forcée', `<span class="pop-picto">${picto('critique', 28)}</span>`)
        + `<div class="pop-corps"><p class="f-texte">${esc(p.text)}</p></div>
        <div class="f-actions">${bouton({ label: 'Voir la banque', ic: 'bank', fa: 'pop-banque', neon: true })}${bouton({ label: 'Plus tard', fa: 'pop-fermer' })}</div>`;
    case 'faillite':
      return bandeau('rouge', 'oups', 'Game over', 'Faillite')
        + `<div class="pop-corps"><p class="f-texte">La banque a fermé le robinet. Ton empire a tenu ${S.d} jours et encaissé ${fmt(S.totals.rev)} de chiffre d'affaires.</p></div>
        <div class="f-actions">${bouton({ label: 'Nouvelle partie', fa: 'pop-reset', neon: true })}</div>`;
  }
  return '';
}
function popupAct(a, el) {
  switch (a) {
    case 'pop-fermer': ui.pop = null; closeSheet(); return true;
    case 'al-go': alerteGo(+el.dataset.i); return true;
    case 'pop-station': ui.pop = null; closeSheet(true); go('station', el.dataset.lot); setTimeout(popupNext, 300); return true;
    case 'pop-banque': ui.pop = null; closeSheet(true); navOpen('finances'); return true;
    case 'pop-reset': closeSheet(true); act('reset', { dataset: {} }); return true;
    case 'pop-racheter': case 'pop-racheter-pret': {
      const o = S.offers.find(x => x.id === el.dataset.id);
      if (!o) { closeSheet(); return true; }
      let r;
      if (a === 'pop-racheter-pret') { const p = pretPour(o.price); if (p && !p.refuse) r = E.borrow(S, p.need, 7); }
      r = E.takeOffer(S, o.id);
      if (r.ok) toast('Parcelle rachetée : 2 emplacements de plus.', 'good'); else if (r.msg) toast(r.msg, 'bad');
      ui.pop = null; closeSheet(); renderHud(); Save.touch();
      return true;
    }
  }
  return false;
}

// ---------- cloche : alertes en cours ----------
function alertesListe() {
  const out = [];
  const mine = Object.values(S.stations).filter(st => st.owner === 'player');
  if (S.cash < -E.OVERDRAFT) out.push({ k: 'critique', t: 'Découvert dépassé', s: `Depuis ${pluriel(S.overdraftDays || 1, 'jour')} · vente forcée à 90 jours`, go: { banque: 1 }, compte: 1 });
  for (const st of mine) {
    st.units.forEach((u, i) => { if (u.down > 0) out.push({ k: 'critique', t: `${E.EQUIP[u.type].name} ${E.EQUIP[u.type].tiers[u.tier].n} en panne`, s: `${stationLabel(st.lot)} · intervention dans ${Math.max(1, Math.ceil(u.down / 24))} j`, go: { lot: st.lot, unite: i }, compte: 1 }); });
    if (st.q.portique + st.q.hp >= E.qmaxOf(st)) out.push({ k: 'critique', t: 'File pleine', s: `${stationLabel(st.lot)} · des clients repartent`, go: { lot: st.lot, file: 1 }, compte: 1 });
  }
  for (const o of S.offers) if (S.stations[o.lot]) out.push({ k: 'opportunite', t: 'Parcelle voisine à racheter', s: `${stationLabel(o.lot)} · encore ${pluriel(Math.max(0, o.until - Math.floor(S.d)), 'jour')} · ${fmt(o.price)}`, go: { lot: o.lot, station: 1 }, compte: 1 });
  for (const l of S.lots) if (l.sale && sectorRevealed(l.id)) out.push({ k: 'opportunite', t: 'Station à céder', s: `${E.lotDef(l.id).name} · ${fmt(l.sale.price)}`, go: { terrain: l.id }, compte: 1 });
  for (const st of mine) if (E.freeSlots(st) > 0) out.push({ k: 'opportunite', t: `${pluriel(E.freeSlots(st), 'emplacement')} libre${E.freeSlots(st) > 1 ? 's' : ''}`, s: `${stationLabel(st.lot)} · à équiper`, go: { lot: st.lot, catalogue: 1 } });
  for (const z of S.zones) {
    const zd = E.zoneDef(z.id);
    if (z.pending && S.sectors[zd.sector].revealed) out.push({ k: 'opportunite', t: `Signal faible : ${zd.name}`, s: z.pending.signal, go: { zone: z.id } });
  }
  for (const st of Object.values(S.stations)) if (st.owner !== 'player' && sectorRevealed(st.lot) && mine.some(m => E.lotDef(m.lot).zone === E.lotDef(st.lot).zone)) out.push({ k: 'info', t: `${ownerName(st.owner)} dans ta zone`, s: E.lotDef(st.lot).name, go: { terrain: st.lot } });
  return out;
}
FEUILLES.alertes = () => {
  const l = alertesListe();
  const corps = l.length
    ? `<div class="alertes">${l.map((a, i) => `<button class="alerte" data-fa="al-go" data-i="${i}" data-test="alerte-${i}">${picto(a.k, 22)}<span><b>${esc(a.t)}</b><small>${esc(a.s)}</small></span></button>`).join('')}</div>`
    : `<p class="f-texte">${picto('ok', 18)} Tout tourne : aucune alerte en cours.</p>`;
  return feuille({ ic: 'bell', titre: 'Alertes', sous: `${pluriel(l.filter(a => a.compte).length, 'alerte')} à traiter`, corps });
};
function alerteGo(i) {
  const a = alertesListe()[i];
  if (!a) { feuilleRefresh(); return; }
  const g = a.go;
  closeSheet(true);
  if (g.banque) { navOpen('finances'); return; }
  if (g.terrain) { go('map'); ouvrirTerrain(g.terrain); return; }
  if (g.zone) { go('map'); const zd = E.zoneDef(g.zone); mondeViser(zd.x, zd.y); return; }
  go('station', g.lot);
  if (g.unite != null) feuilleOpen('unite', { lot: g.lot, i: g.unite });
  else if (g.file) feuilleOpen('file', { lot: g.lot });
  else if (g.station) feuilleOpen('station', { lot: g.lot });
  else if (g.catalogue) feuilleOpen('catalogue', { lot: g.lot, type: null, tier: null });
}

// ---------- prochaine action conseillée (un seul néon) ----------
const PRIX_MIN_EQUIP = () => Math.min(...E.TYPES.map(t => E.EQUIP[t].tiers[0].price));
const tutoEnCours = () => { const t = Prefs.get().tuto; return typeof t === 'number' && t >= 1; };
function cibleStation(lot) {
  const st = S.stations[lot];
  if (tutoEnCours()) return null;   // la main de Bulle suffit
  if (!st) return null;
  const i = st.units.findIndex(u => u.down > 0);
  if (i >= 0) return { t: 'unit', i };
  if (st.q.portique + st.q.hp >= E.qmaxOf(st)) return { t: 'file' };
  if (E.freeSlots(st) > 0 && S.cash >= PRIX_MIN_EQUIP()) return { t: 'slot' };
  return null;
}
function cibleMonde() {
  if (tutoEnCours()) return null;
  const mine = Object.values(S.stations).filter(st => st.owner === 'player');
  for (const rang of ['unit', 'file', 'slot']) {
    const st = mine.find(m => { const c = cibleStation(m.lot); return c && c.t === rang; });
    if (st) return st.lot;
  }
  if (S.cash >= E.STUDY_COST + 5000 && !S.lots.some(l => l.studied && !l.owner)) {
    const libres = E.LOTS.filter(l => sectorRevealed(l.id) && !E.lotState(S, l.id).owner && !E.lotState(S, l.id).studied);
    if (libres.length) return libres.sort((a, b) => E.lotPrice(S, a.id) - E.lotPrice(S, b.id))[0].id;
  }
  return null;
}
// pictos posés sur les ronds du dock
function dockPictos() {
  const crit = Object.values(S.stations).some(st => st.owner === 'player' && (st.units.some(u => u.down > 0) || st.q.portique + st.q.hp >= E.qmaxOf(st)));
  const set3 = (nav, html) => { const el = $(`#nav [data-nav="${nav}"] .nav-picto`); if (el && el.dataset.v !== html) { el.innerHTML = html; el.dataset.v = html; } };
  set3('stations', crit ? picto('critique', 18) : '');
  set3('journal', ui.missionNew ? picto('recompense', 18) : '');
  set3('finances', S.cash < -E.OVERDRAFT ? picto('critique', 18) : '');
}
