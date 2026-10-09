/* Onboarding avec Bulle et la main, puis info-bulles de première fois.
   L'avancement est une préférence d'interface (localStorage « cwt-ui-v1 »), jamais dans la sauvegarde :
   { tuto: numéro d'étape | 'fini', vus: { panne, file, signal, pret } }. */

const UI_KEY = 'cwt-ui-v1';
const Prefs = {
  d: null,
  get() { if (!this.d) { try { this.d = JSON.parse(localStorage.getItem(UI_KEY) || '{}') || {}; } catch (e) { this.d = {}; } } return this.d; },
  save() { try { localStorage.setItem(UI_KEY, JSON.stringify(this.d)); } catch (e) { /* stockage indisponible */ } }
};

const ouverte = k => ui.sheet && ui.f && ui.f.kind === k;
const surStation = () => ui.tab === 'station' && !ui.sheet;
const mineA = () => Object.values(S.stations).find(st => st.owner === 'player');
// étapes du tutoriel : cible (sélecteur), texte, fin d'étape ; « ok » = bouton dans la bulle
const TUTO = [
  { // 1 · arrivée sur le terrain
    cible: () => surStation() ? '[data-test="slot-free"]' : null,
    texte: () => 'Salut, moi c\'est Bulle ! Voici ton terrain. Touche l\'emplacement libre pour installer ton premier équipement.',
    fait: () => ouverte('catalogue') || (mineA() && mineA().units.length > 0)
  },
  { // 2 · catalogue : piste HP Éco
    entre: () => { if (ouverte('catalogue') && (ui.f.type !== 'hp' || ui.f.tier !== 0)) { ui.f.type = 'hp'; ui.f.tier = 0; feuilleRefresh(); } },
    cible: () => ouverte('catalogue') ? (ui.f.type === 'hp' && ui.f.tier === 0 ? '[data-test="buy-hp-0"]' : '[data-test="type-hp"]') : surStation() ? '[data-test="slot-free"]' : null,
    texte: () => ouverte('catalogue') ? 'Commence petit : une piste HP Éco suffit pour démarrer. Achète-la.' : 'Touche l\'emplacement libre.',
    fait: () => mineA() && mineA().units.length > 0
  },
  { // 3 · lancer le temps
    cible: () => ui.sheet ? null : '[data-test="speed-1"]',
    texte: () => 'Lance le temps : touche ×1 sur le cadran. Glisse l\'aiguille pour aller plus vite, touche le centre pour la pause.',
    fait: () => !paused && S.mode === 'realtime'
  },
  { // 3 bis · premières voitures
    cible: () => null,
    texte: () => 'Les premières voitures arrivent… Attends le premier lavage.',
    fait: () => S.totals.rev > 0
  },
  { // 4 · prix
    cible: () => surStation() ? '[data-sa="enseigne"]' : null,
    texte: () => 'Ka-ching ! Ton enseigne affiche tes prix : touche-la pour les régler.',
    fait: () => ouverte('prix')
  },
  { // 4 bis · prix de référence
    cible: () => ouverte('prix') ? '.prix-ref' : null,
    texte: () => '« réf. » est le prix habituel du coin. Plus cher : moins de clients mais plus de marge. Moins cher : plus de monde dans la file.',
    ok: 'Compris',
    fait: () => false
  },
  { // 5 · retour au Monde
    cible: () => ui.sheet ? null : '[data-nav="map"]',
    texte: () => ui.sheet ? 'Ferme le panneau : glisse-le vers le bas ou touche le décor.' : 'Direction la carte : touche Monde.',
    fait: () => ui.tab === 'map'
  },
  { // 6 · brouillard
    cible: () => ui.tab === 'map' && !ui.sheet ? coachFog() : null,
    texte: () => `Ce brouillard cache des terrains. Une reconnaissance coûte ${fmt(E.RECON_COST)} : touche le cadenas.`,
    fait: () => ouverte('reconnaissance') || S.sectors.filter(s => s.revealed).length >= 2 || S.cash < E.RECON_COST
  },
  { // 6 bis · reconnaître
    cible: () => ouverte('reconnaissance') ? '[data-test="reconnaitre"]' : null,
    texte: () => ouverte('reconnaissance') ? 'Lance la reconnaissance.' : 'Touche le cadenas d\'un brouillard.',
    fait: () => S.sectors.filter(s => s.revealed).length >= 2 || S.cash < E.RECON_COST
  },
  { // 7 · fin
    cible: () => ui.sheet ? null : '#objective',
    texte: () => 'Ton prochain objectif est toujours ici, en bas. Le reste, c\'est toi le patron. Bonne route !',
    ok: 'C\'est parti',
    fait: () => false
  }
];
// cadenas de brouillard visible à l'écran (sinon le premier, la carte se recentre dessus)
function coachFog() {
  const app = $('#app').getBoundingClientRect();
  const ronds = [...document.querySelectorAll('.fog-rond')];
  const vu = ronds.find(c => { const r = c.getBoundingClientRect(); return r.top > app.top + 60 && r.bottom < app.bottom - 200 && r.left > app.left && r.right < app.right; });
  if (vu) return `[data-sector="${vu.closest('.fog').dataset.sector}"] .fog-rond`;
  const sc = E.SECTORS.find(s => !S.sectors[s.id].revealed);
  if (!sc) return null;
  mondeViser(sc.x + sc.w / 2, sc.y + sc.h / 2);
  return `[data-sector="${sc.id}"] .fog-rond`;
}

// info-bulles de première fois (après le tutoriel)
const ASTUCES = {
  panne: { quand: () => Object.values(S.stations).some(st => st.owner === 'player' && st.units.some(u => u.down > 0)),
    cible: () => ui.tab === 'station' && S.stations[ui.lot] && S.stations[ui.lot].units.some(u => u.down > 0) ? `[data-test="unit-${S.stations[ui.lot].units.findIndex(u => u.down > 0)}"]` : '#hud-bell',
    texte: 'Une panne ! Le délai d\'intervention dépend du contrat d\'entretien : un meilleur contrat répare plus vite.' },
  file: { quand: () => Object.values(S.stations).some(st => st.owner === 'player' && st.q.portique + st.q.hp >= E.qmaxOf(st)),
    cible: () => ui.tab === 'station' ? '[data-test="file"]' : '#hud-bell',
    texte: 'File pleine : des clients repartent. Ajoute un poste, ou monte un peu les prix pour lisser l\'affluence.' },
  signal: { quand: () => S.zones.some(z => z.pending && S.sectors[E.zoneDef(z.id).sector].revealed),
    cible: () => '#hud-bell',
    texte: 'Signal faible : une zone va changer de palier. Les bons emplacements se prennent avant que le flux ne grimpe.' },
  pret: { quand: () => S.loans.length > 0,
    cible: () => '#hud-cash',
    texte: 'Prêt en cours : la mensualité part chaque mois. Tu peux le solder dans la Banque quand tu veux.' }
};

// ---------- affichage ----------
function coachBuild() {
  if ($('#coach')) return;
  const el = document.createElement('div');
  el.id = 'coach'; el.hidden = true;
  el.innerHTML = `<div class="coach-bulle" role="status" aria-live="polite"><span class="coach-face">${bulle('ok', 44)}</span><p class="coach-txt"></p>
      <div class="coach-btns"><button class="capsule petite neon" data-coach="ok" hidden></button><button class="coach-passer" data-coach="passer">Passer le tutoriel</button></div></div>
    <div class="coach-main" aria-hidden="true">${ASSETS['icones/hand'] || ''}</div>`;
  $('#app').appendChild(el);
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-coach]');
    if (!b) return;
    const p = Prefs.get();
    if (b.dataset.coach === 'passer') { p.tuto = 'fini'; Prefs.save(); coachHide(); return; }
    if (ui.astuce) { (p.vus = p.vus || {})[ui.astuce] = 1; ui.astuce = null; Prefs.save(); coachHide(); return; }
    if (typeof p.tuto === 'number') { p.tuto++; if (p.tuto > TUTO.length) p.tuto = 'fini'; Prefs.save(); if (ouverte('prix') && p.tuto === 7) closeSheet(); coachTick(); }
  });
}
function coachHide() { const el = $('#coach'); if (el) el.hidden = true; }
function coachShow(texte, sel, ok, passer, humeur = 'ok') {
  const el = $('#coach');
  const app = $('#app').getBoundingClientRect();
  const cible = sel ? document.querySelector(sel) : null;
  const r = cible ? cible.getBoundingClientRect() : null;
  const visible = r && r.width > 0 && r.bottom > app.top && r.top < app.bottom;
  el.hidden = false;
  const txt = el.querySelector('.coach-txt');
  if (txt.textContent !== texte) txt.textContent = texte;
  const bok = el.querySelector('[data-coach="ok"]');
  bok.hidden = !ok; if (ok) bok.textContent = ok;
  el.querySelector('[data-coach="passer"]').hidden = !passer;
  if (el.dataset.h !== humeur) { el.querySelector('.coach-face').innerHTML = bulle(humeur, 44); el.dataset.h = humeur; }
  const bu = el.querySelector('.coach-bulle'), main = el.querySelector('.coach-main');
  const H = app.height, bh = bu.offsetHeight || 120;
  let top;
  if (visible) {
    const cy = r.top - app.top + r.height / 2, cx = r.left - app.left + r.width / 2;
    const bas = cy > H * 0.5;
    // la main pointe la cible : par en dessous (doigt vers le haut) ou par au-dessus (doigt vers le bas)
    main.hidden = false;
    main.className = 'coach-main' + (bas ? ' haut' : '');
    main.style.left = Math.round(cx - 22) + 'px';
    main.style.top = Math.round(bas ? r.top - app.top - 52 : r.bottom - app.top + 4) + 'px';
    top = bas ? Math.max(8 + (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0), r.top - app.top - 66 - bh) : Math.min(H - bh - 8, r.bottom - app.top + 62);
  } else {
    main.hidden = true;
    top = Math.round(H * 0.16);
  }
  bu.style.top = Math.round(top) + 'px';
}
function coachTick() {
  if (!S || !$('#coach')) return;
  const p = Prefs.get();
  // partie déjà commencée avant l'onboarding : pas de tutoriel
  if (p.tuto == null) { p.tuto = S.seenIntro ? 'fini' : 0; Prefs.save(); }
  const intro = $('#backdrop [data-act="intro-go"]');
  if (intro || (ui.sheet && ui.pop) || S.over) { coachHide(); return; }
  if (typeof p.tuto === 'number' && p.tuto >= 1) {
    let e = TUTO[p.tuto - 1];
    while (e && e.fait()) { p.tuto++; Prefs.save(); e = TUTO[p.tuto - 1]; if (e && e.entre) e.entre(); }
    if (!e) { p.tuto = 'fini'; Prefs.save(); coachHide(); return; }
    if (e.entre) e.entre();
    coachShow(e.texte(), e.cible(), e.ok, true, p.tuto === 5 ? 'joie' : 'ok');
    return;
  }
  if (p.tuto !== 'fini') { coachHide(); return; }
  // info-bulles de première fois, une à la fois, hors panneaux
  const vus = p.vus || {};
  if (ui.astuce && !vus[ui.astuce]) {
    if (ui.sheet) { coachHide(); return; }
    const a = ASTUCES[ui.astuce];
    coachShow(a.texte, a.cible(), 'OK', false, ui.astuce === 'panne' || ui.astuce === 'file' ? 'oups' : 'ok');
    return;
  }
  if (!ui.sheet) for (const k in ASTUCES) if (!vus[k] && ASTUCES[k].quand()) { ui.astuce = k; coachTick(); return; }
  coachHide();
}
// démarrage du tutoriel quand le joueur touche « Jouer » sur l'écran titre
function coachDebut() {
  const p = Prefs.get();
  p.tuto = 1; Prefs.save();
  return true;
}
