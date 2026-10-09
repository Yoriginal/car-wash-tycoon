/* Interface historique (V1.1) : remplacée progressivement par les modules de la refonte. */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const fmt = E.fmt;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const euro = v => (Math.round(v * 2) / 2).toLocaleString('fr-FR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
  const kfmt = v => Math.abs(v) >= 1e6 ? (v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' M€' : Math.abs(v) >= 1e4 ? Math.round(v / 1000).toLocaleString('fr-FR') + ' k€' : fmt(v);
  const LS_KEY = 'cwt-save-v3'; // clé de stockage : ne JAMAIS la changer (les migrations gèrent le format)

  let S = null;                  // état du jeu
  const ui = { tab: 'map', lot: null, sheet: null, wasPaused: false, confirm: null, loanAmt: 0, loanYears: 7, toastQ: [], lastToast: 0, logTop: null, dirty: false };
  let paused = false;

  // ---------------- sauvegarde ----------------
  const Save = {
    status: 'local', ref: null, lastCloud: 0, pending: null, fresh: false, ready: false,
    local() {
      if (this.fresh && !this.ready && !S.seenIntro) return;
      try { S.savedAt = Date.now(); S.lastSeen = Date.now(); localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) { /* stockage indisponible */ }
    },
    readLocal() {
      try { const t = localStorage.getItem(LS_KEY); return t ? JSON.parse(t) : null; } catch (e) { return null; }
    },
    async cloud(force) {
      if (!this.ref) return;
      if (!this.ready) return;
      if (!force && Date.now() - this.lastCloud < 30000) { this.schedule(); return; }
      this.lastCloud = Date.now();
      try {
        S.savedAt = Date.now(); S.lastSeen = Date.now();
        await this.ref.set({ state: JSON.stringify(S), savedAt: S.savedAt, day: S.d });
        this.status = 'cloud';
      } catch (e) { this.status = 'local'; }
    },
    schedule() {
      clearTimeout(this.pending);
      this.pending = setTimeout(() => this.cloud(true), 3000);
    },
    touch() { this.local(); this.schedule(); },
    async init() {
      const c = window.claude;
      if (!c || !c.use) { this.ready = true; this.fresh = false; return; }
      try {
        const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
        if (!db || !user) { this.ready = true; return; }
        const id = await user.id();
        if (!id) { this.ready = true; return; }
        this.ref = db.doc('data/users/' + id + '/save');
        const snap = await this.ref.get();
        this.status = 'cloud';
        if (snap.exists) {
          const d = snap.data();
          // la sauvegarde en ligne gagne si la partie locale vient d'être créée, ou si elle est plus récente
          if (d && d.state && (this.fresh || (d.savedAt || 0) > (S.savedAt || 0) + 5000)) {
            const st = E.migrate(JSON.parse(d.state));
            if (st) { restore(st, true); toast('Partie récupérée.', 'good'); }
          }
        }
        this.ready = true;
        this.fresh = false;
        this.cloud(true);
      } catch (e) { this.status = 'local'; this.ready = true; }
    }
  };

  // ---------------- toasts ----------------
  function toast(text, kind = 'info') {
    ui.toastQ.push({ text, kind });
  }
  function pumpToasts() {
    const now = performance.now();
    if (!ui.toastQ.length || now - ui.lastToast < 1400) return;
    const box = $('#toasts');
    if (box.children.length >= 2) box.firstElementChild.remove();
    const t = ui.toastQ.shift();
    const el = document.createElement('div');
    el.className = 'toast ' + t.kind;
    el.textContent = t.text;
    box.appendChild(el);
    ui.lastToast = now;
    setTimeout(() => el.remove(), 3600);
    if (ui.toastQ.length > 3) ui.toastQ.splice(0, ui.toastQ.length - 3);
  }

  // ---------------- HUD ----------------

  function renderHud() { hudRender(); dockRender(); objRender(); }
  function renderSpeed() { dialRender(); }

  // ---------------- navigation ----------------
  function go(tab, lot = null) {
    ui.tab = tab; ui.lot = lot; ui.confirm = null;
    renderView();
    dockRender();
    $('main').scrollTop = 0;
  }
  function renderAll() { renderHud(); renderView(); }
  function renderView() {
    const m = $('main');
    const keep = m.scrollTop;
    // deux écrans de jeu : Station et Monde (tout le reste s'ouvre en feuille)
    if (ui.tab === 'station') m.innerHTML = viewStation(ui.lot);
    else { ui.tab = 'map'; m.innerHTML = viewMonde(); }
    m.classList.toggle('plein', ui.tab === 'map');
    m.scrollTop = keep;
    if (ui.tab === 'map') mondeAttach();
    liveUpdate();
  }

  // ---------------- helpers ----------------
  const ownerName = o => o === 'player' ? 'Toi' : (E.RIVALS.find(r => r.id === o) || {}).name;
  const sectorRevealed = lotId => S.sectors[E.sectorOfLot(lotId)].revealed;
  function potRange(lotId) {
    const z = E.zoneOf(S, lotId);
    const d = E.zoneDemand(S, z.id, S.d);
    return { exact: Math.round(d), lo: Math.round(d * 0.6 / 5) * 5, hi: Math.round(d * 1.4 / 5) * 5 };
  }
  function trendText(z) {
    const zd = E.zoneDef(z.id);
    if (z.pending) return z.pending.dir > 0 ? 'Mutation en cours : croissance imminente' : 'Mutation en cours : déclin imminent';
    if (zd.growth >= 0.3) return 'Forte croissance probable';
    if (zd.growth >= 0.1) return 'Croissance possible';
    if (zd.decline >= 0.05) return 'Risque de déclin';
    return 'Stable';
  }
  function last(st, n) { return st.hist.slice(-n); }
  function sum(a, f) { return a.reduce((x, y) => x + f(y), 0); }

  // ---------------- feuille terrain ----------------
  function sheetLot(lotId) { ouvrirTerrain(lotId); }
  function sheetFog(secId) { ouvrirBrouillard(secId); }

  // ---------------- vue station ----------------
  function viewStation(lotId) {
    const st = S.stations[lotId];
    if (!st || st.owner !== 'player') { ui.tab = 'map'; return viewMonde(); }
    const l = E.lotDef(lotId), z = E.zoneOf(S, lotId);
    const h = last(st, 30);
    const rev30 = sum(h, x => x.rev), net30 = rev30 - sum(h, x => x.cost);
    let html = `<h2 class="station-titre">${esc(l.name)}</h2>
      ${stationViewHtml(lotId)}
      <p class="sub" style="margin:8px 0 0">30 derniers jours : CA ${fmt(rev30)} · résultat ${fmt(net30)} · ${sum(h, x => x.lost)} clients perdus</p>`;
    return html;
  }

  function sheetAddUnit(lotId, type) { feuilleOpen('catalogue', { lot: lotId, type: type || null, tier: type ? catalogueDefautTier(type) : null }); }

  // ---------------- mises à jour en direct ----------------
  function liveUpdate() {
    const m = $('main');
    if (ui.tab === 'station') {
      const st = S.stations[ui.lot]; if (!st) return;
      stationLive();
    }
    else if (ui.tab === 'map') mondeLive();
  }
  function set(root, k, v) { const el = root.querySelector(`[data-live="${k}"]`); if (el && el.textContent !== String(v)) el.textContent = v; }

  // ---------------- feuilles modales ----------------
  function openSheet(html, opts = {}) {
    if (!ui.sheet) { ui.wasPaused = paused; paused = true; }
    ui.sheet = true;
    const bd = $('#backdrop');
    if (!opts.feuille) ui.f = null;
    bd.className = 'backdrop' + (opts.center ? ' modal-center' : '');
    bd.innerHTML = `<div class="sheet${opts.feuille ? ' feuille' : ''}${opts.still ? ' still' : ''}" role="dialog" aria-modal="true">${opts.center ? '' : '<div class="grab"></div>'}${html}${opts.noClose || opts.feuille ? '' : '<button class="btn ghost block" style="margin-top:12px" data-act="close">Fermer</button>'}</div>`;
    bd.hidden = false;
    renderSpeed();
  }
  function closeSheet(silent) {
    const bd = $('#backdrop');
    if (!ui.sheet) return;
    bd.hidden = true; bd.innerHTML = '';
    ui.sheet = null; ui.f = null;
    paused = ui.wasPaused;
    if (!silent) renderAll(); else dockRender();
    setTimeout(popupNext, 250);
  }

  // ---------------- actions ----------------
  function act(a, el) {
    const lot = el.dataset.lot;
    let r;
    switch (a) {
      case 'tab': go(el.dataset.tab); return;
      case 'close': closeSheet(); return;
      case 'open-station': closeSheet(true); go('station', lot); return;
      case 'reveal': r = E.reveal(S, +el.dataset.sector); if (r.ok) { closeSheet(); toast('Secteur reconnu : de nouveaux terrains apparaissent.', 'good'); } break;
      case 'study': r = E.study(S, lot); if (r.ok) sheetLot(lot); break;
      case 'buy-lot': r = E.buyLot(S, lot); if (r.ok) { closeSheet(true); go('station', lot); toast('Terrain acheté. Installe tes équipements.', 'good'); } break;
      case 'buy-lot-loan': r = E.borrow(S, +el.dataset.amt, 7); if (r.ok) { r = E.buyLot(S, lot); if (r.ok) { closeSheet(true); go('station', lot); toast('Prêt accordé, terrain acheté.', 'good'); } } break;
      case 'add-unit': sheetAddUnit(lot); return;
      case 'unit-type': sheetAddUnit(lot, el.dataset.t); return;
      case 'buy-unit': r = E.buyUnit(S, lot, el.dataset.t, +el.dataset.tier); if (r.ok) { closeSheet(); toast(`${E.EQUIP[el.dataset.t].name} installé.`, 'good'); } break;
      case 'ask': ui.confirm = el.dataset.key; renderView(); return;
      case 'cancel': ui.confirm = null; renderView(); return;
      case 'sell-unit': E.sellUnit(S, ui.lot, +el.dataset.i); ui.confirm = null; renderView(); break;
      case 'sell-station': r = E.sellStation(S, lot); ui.confirm = null; go('map'); toast(`Station vendue ${fmt(r.v)}.`, 'info'); break;
      case 'price': {
        const st = S.stations[ui.lot];
        st.prices[el.dataset.t] = Math.max(1, Math.min(40, st.prices[el.dataset.t] + +el.dataset.d));
        liveUpdate(); Save.touch(); return;
      }
      case 'chem': S.stations[ui.lot].chem = +el.dataset.v; renderView(); break;
      case 'contract': S.stations[ui.lot].contract = +el.dataset.v; renderView(); break;
      case 'hire-assign': { const e = E.hire(S); E.assign(S, e.id, lot); renderView(); toast(`${e.name} est embauché·e.`, 'good'); break; }
      case 'assign': r = E.assign(S, el.dataset.emp, lot); if (!r.ok) toast(r.msg, 'bad'); renderView(); break;
      case 'unassign': E.unassign(S, lot); renderView(); break;
      case 'fire': E.fire(S, el.dataset.id); ui.confirm = null; renderView(); break;
      case 'offer': r = E.takeOffer(S, el.dataset.id); renderView(); break;
      case 'borrow': r = E.borrow(S, ui.loanAmt, ui.loanYears); if (r.ok) { toast(`Prêt de ${fmt(ui.loanAmt)} accordé.`, 'good'); ui.loanAmt = 0; renderView(); } break;
      case 'repay': r = E.repay(S, el.dataset.id); renderView(); break;
      case 'mode': S.mode = el.dataset.v; if (S.mode === 'turn') paused = true; else paused = false; renderAll(); break;
      case 'turn-day': E.advanceDays(S, 1); afterTick(true); break;
      case 'turn-week': E.advanceDays(S, 7); afterTick(true); break;
      case 'reset': try { localStorage.removeItem(LS_KEY); } catch (e) { } S = E.newGame(); ui.confirm = null; Save.touch(); go('station', 'A'); intro(); return;
      case 'intro-go': S.seenIntro = true; closeSheet(true); paused = coachDebut(); go('station', 'A'); Save.touch(); return;
      case 'offline-ok': closeSheet(); return;
      case 'export': {
        const code = exportCode();
        const done = () => toast('Code de partie copié. Colle-le dans « Importer une partie » de l\'autre version.', 'good');
        const fallback = () => { ui.importOpen = true; renderView(); const ta = $('#importCode'); if (ta) { ta.value = code; ta.select(); } toast('Copie auto refusée : sélectionne le code et copie-le.', 'info'); };
        try { navigator.clipboard.writeText(code).then(done, fallback); } catch (e) { fallback(); }
        return;
      }
      case 'import-open': ui.importOpen = true; renderView(); return;
      case 'import-close': ui.importOpen = false; renderView(); return;
      case 'import': {
        const ta = $('#importCode');
        if (ta && importCode(ta.value)) { ui.importOpen = false; toast('Partie importée.', 'good'); }
        else toast('Code invalide : recopie-le en entier.', 'bad');
        return;
      }
    }
    if (r && !r.ok && r.msg) toast(r.msg, 'bad');
    renderHud();
    Save.touch();
  }

  // ---------------- boucle ----------------
  let lastT = 0, liveT = 0, localT = 0;
  function frame(t) {
    const dt = Math.min(0.25, (t - lastT) / 1000 || 0);
    lastT = t;
    if (S && !S.over && S.mode === 'realtime' && !paused && !document.hidden) {
      E.advance(S, dt * 24 / E.DAY_SEC * S.speed);
      afterTick(false);
    }
    if (S && S.over && !ui.goShown) { renderAll(); gameOver(); }
    if (t - liveT > 250) { liveT = t; renderHud(); liveUpdate(); }
    if (t - localT > 10000) { localT = t; Save.local(); if (Save.ref && Date.now() - Save.lastCloud > 30000) Save.cloud(true); }
    pumpToasts();
    requestAnimationFrame(frame);
  }
  function afterTick(forceRender) {
    // nouveaux événements -> toasts
    if (S.log[0] !== ui.logTop) {
      const fresh = [];
      for (const l of S.log) { if (l === ui.logTop) break; fresh.push(l); }
      ui.logTop = S.log[0];
      // les moments forts ont leur pop-up : pas de toast en double
      for (const l of fresh.reverse()) if ((l.kind !== 'info' || /Neige|Monnayeur/.test(l.text)) && !/^Panne :|^La parcelle voisine|^Alerte de la banque|forcé la vente|^Faillite/.test(l.text)) toast(l.text, l.kind);
    }
    if (S.d !== ui.lastDay) { ui.lastDay = S.d; if (ui.tab === 'station') forceRender = true; }
    for (const t of E.checkObjectives(S)) popupMission(t);
    evenementsScan();
    if (S.over) gameOver();
    else popupNext();
    if (forceRender && !ui.sheet) renderView();
    if (forceRender) renderHud();
  }

  function intro() {
    openSheet(`<div class="titre-jeu">
      <div class="logo-neon" aria-label="Car Wash Tycoon"><span class="l1">CAR WASH</span><span class="l2">TYCOON</span></div>
      ${bulle('joie', 96)}
      <p>Département de la Mousse, 1<sup>er</sup> mars 2027. Un terrain vague aux Bruyères et ${fmt(S.cash)} en poche.</p>
      <p class="petit">L'emplacement fait tout : sois le premier au bon endroit.</p>
      ${installHint()}
      <div class="f-actions"><button class="capsule bloc action neon" data-test="start" data-act="intro-go">${icon('station')}<span class="lib">Jouer</span></button></div></div>`, { center: true, noClose: true });
    $('#backdrop .sheet').classList.add('popup', 'titre');
  }
  function installHint() {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    if (!ios || standalone || window.claude) return '';
    return `<p class="petit">Pour l'installer comme une app : touche <b>Partager</b> en bas de Safari, puis <b>Sur l'écran d'accueil</b>.</p>`;
  }
  function gameOver() {
    if (ui.goShown) return; ui.goShown = true;
    closeSheet(true);
    openSheet(popupHtml({ k: 'faillite' }), { center: true, noClose: true });
    $('#backdrop .sheet').classList.add('popup');
  }

  // ---------------- démarrage ----------------
  function bindUI() {
    document.addEventListener('click', e => {
      const nav = e.target.closest('[data-nav]');
      if (nav) { navOpen(nav.dataset.nav); return; }
      const tool = e.target.closest('[data-tool]');
      if (tool) { toolOpen(tool.dataset.tool); return; }
      if (e.target.closest('#hud-cash')) { navOpen('finances'); return; }
      if (e.target.closest('#hud-bell')) { feuilleOpen('alertes'); return; }
      if (e.target.closest('#objective')) { navOpen('journal'); return; }
      if (e.target.closest('#hud-meteo')) { meteoSheet(); return; }
      const fog = e.target.closest('.fog');
      if (fog) { sheetFog(+fog.dataset.sector); return; }
      const pin = e.target.closest('.pin, .lot-row');
      if (pin) { sheetLot(pin.dataset.lot); return; }
      const fa = e.target.closest('[data-fa]');
      if (fa && !fa.disabled) { feuilleAct(fa.dataset.fa, fa); return; }
      const sa = e.target.closest('[data-sa]');
      if (sa && ui.tab === 'station' && stationAct(sa.dataset.sa, sa)) return;
      const a = e.target.closest('[data-act]');
      if (a && !a.disabled) { act(a.dataset.act, a); return; }
      if (e.target.id === 'backdrop' && ui.sheet && !$('#backdrop [data-act="intro-go"]') && !$('#backdrop [data-act="reset"]') && !$('#backdrop [data-fa="pop-reset"]')) closeSheet();
    });
    document.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.pin, .fog')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
      if (e.key === 'Escape' && ui.sheet && !$('#backdrop [data-act="intro-go"]') && !$('#backdrop [data-fa="pop-reset"]')) closeSheet();
    });
    window.addEventListener('resize', () => mondeApply());
    document.addEventListener('visibilitychange', () => { if (document.hidden) { Save.local(); Save.cloud(true); } });
    window.addEventListener('pagehide', () => Save.local());
  }


  function offlineWelcome() {
    const off = E.offline(S, Date.now());
    if (!off || off.gain <= 0) return false;
    S.cash += off.gain;
    S.lastSeen = Date.now();
    ui.pops = ui.pops || [];
    ui.pops.unshift({ k: 'absence', hours: off.hours, gain: off.gain });
    popupNext();
    return true;
  }

  // remplace la partie en cours par une partie chargée
  function restore(st, welcome) {
    S = st;
    ui.prev = null; ui.pops = [];
    ui.logTop = S.log[0]; ui.goShown = false; ui.confirm = null;
    closeSheet(true);
    paused = S.mode === 'turn';
    go('map');
    if (welcome) offlineWelcome();
    Save.local();
  }
  function exportCode() {
    try { return btoa(unescape(encodeURIComponent(JSON.stringify(S)))); } catch (e) { return ''; }
  }
  function importCode(code) {
    try {
      const st = E.migrate(JSON.parse(decodeURIComponent(escape(atob(code.trim())))));
      if (!st) return false;
      restore(st, false);
      Save.touch(); Save.cloud(true);
      return true;
    } catch (e) { return false; }
  }

  function start(data) {
    let loaded = null;
    if (data && data.state) { try { loaded = JSON.parse(data.state); } catch (e) { } }
    if (!loaded) loaded = Save.readLocal();
    if (loaded && loaded.v !== E.SAVE_VERSION) { try { localStorage.setItem('cwt-backup-v' + loaded.v, JSON.stringify(loaded)); } catch (e) { } }
    loaded = E.migrate(loaded);
    Save.fresh = !loaded;
    S = Save.fresh ? E.newGame() : loaded;
    if (S.mode === 'turn') paused = true;
    if (data && data.ui) Object.assign(ui, data.ui, { sheet: null, toastQ: [] });
    ui.logTop = S.log[0];
    bindUI();
    dockBuild();
    go(ui.tab || 'map', ui.lot);
    if (!(data && data.state)) {
      if (!S.seenIntro) { paused = true; intro(); }
      else offlineWelcome();
    }
    if (!Save.fresh) Save.local();
    Save.init();
    if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
      try { window.claude.hot.snapshot(() => ({ state: JSON.stringify(S), ui: { tab: ui.tab, lot: ui.lot, loanYears: ui.loanYears } })); } catch (e) { }
    }
    if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) { } }
    requestAnimationFrame(t => { lastT = t; frame(t); });
  }
