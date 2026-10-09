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

  // ---------------- icônes ----------------
  const ICON = {
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
    stations: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 20V9l9-5 9 5v11"/><path d="M7 20v-7h10v7"/><path d="M10 13v7M14 13v7"/></svg>',
    money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v5M17.5 9.5v5"/></svg>',
    journal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 3h11a1 1 0 011 1v16a1 1 0 01-1 1H6a2 2 0 01-2-2V5a2 2 0 012-2z"/><path d="M8 8h7M8 12h7M8 16h4"/></svg>',
    pause: '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor"/></svg>',
    sun: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffc94a" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2" fill="#ffc94a"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>',
    cloud: '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M7 18h10a4 4 0 00.6-7.95A6 6 0 006.2 9.1 4.5 4.5 0 007 18z" fill="#c7d2e0"/></svg>',
    rain: '<svg width="22" height="22" viewBox="0 0 24 24" stroke-linecap="round"><path d="M7 14h10a4 4 0 00.6-7.95A6 6 0 006.2 5.1 4.5 4.5 0 007 14z" fill="#9fb2cc"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" stroke="#36e3d0" stroke-width="2"/></svg>',
    snow: '<svg width="22" height="22" viewBox="0 0 24 24" stroke="#fff3d9" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/></svg>',
    portique: '<svg viewBox="0 0 40 32"><rect x="3" y="4" width="34" height="26" rx="3" fill="none" stroke="#c7d2e0" stroke-width="2.4"/><rect x="9" y="8" width="5" height="20" rx="2" fill="#ff4f9a"/><rect x="26" y="8" width="5" height="20" rx="2" fill="#36e3d0"/></svg>',
    hp: '<svg viewBox="0 0 40 32"><path d="M4 9l16-6 16 6v3H4z" fill="#36e3d0"/><path d="M8 12v18M32 12v18" stroke="#c7d2e0" stroke-width="2.4"/><path d="M15 20q5-6 12-3" stroke="#8cc8ff" stroke-width="2" fill="none" stroke-dasharray="2 2"/></svg>'
  };

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
  function dateLabel() {
    const d = E.dateOf(S.d);
    const wd = d.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' });
    const dm = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    return `${wd} ${dm}`;
  }
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
    if (ui.tab === 'map') m.innerHTML = viewMonde();
    else if (ui.tab === 'stations') m.innerHTML = viewStations();
    else if (ui.tab === 'station') m.innerHTML = viewStation(ui.lot);
    else if (ui.tab === 'finances') m.innerHTML = viewFinances();
    else m.innerHTML = viewJournal();
    m.classList.toggle('plein', ui.tab === 'map');
    m.scrollTop = keep;
    Dio.detach();
    if (ui.tab === 'finances') bindLoan();
    if (ui.tab === 'map') mondeAttach();
    liveUpdate();
  }

  // ---------------- helpers ----------------
  const myStations = () => Object.values(S.stations).filter(st => st.owner === 'player');
  const ownerName = o => o === 'player' ? 'Toi' : (E.RIVALS.find(r => r.id === o) || {}).name;
  const ownerColor = o => o === 'player' ? '#36e3d0' : (E.RIVALS.find(r => r.id === o) || {}).color || '#ccc';
  const sectorRevealed = lotId => S.sectors[E.sectorOfLot(lotId)].revealed;
  function stageChip(lotId) { const z = E.zoneOf(S, lotId); return `<span class="chip stage">${esc(E.STAGES[z.stage].n)}</span>`; }
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

  // ---------------- vue carte ----------------
  // ---------------- feuille terrain ----------------
  function sheetLot(lotId) { ouvrirTerrain(lotId); }
  function sheetFog(secId) { ouvrirBrouillard(secId); }

  // ---------------- vue stations ----------------
  function viewStations() {
    const mine = myStations();
    let html = `<div class="view-title"><h2>Mes stations</h2><span class="sub">${esc(E.title(S))}</span></div>`;
    if (!mine.length) return html + `<div class="empty">Plus aucune station. Achète un terrain sur la carte.</div>`;
    html += `<div class="stack">` + mine.map(st => {
      const l = E.lotDef(st.lot);
      const h = last(st, 30);
      const rev30 = sum(h, x => x.rev), net30 = rev30 - sum(h, x => x.cost);
      const down = st.units.filter(u => u.down > 0).length;
      const lost7 = sum(last(st, 7), x => x.lost);
      return `<button class="card st-card" data-act="open-station" data-lot="${st.lot}">
        <div class="top"><span class="nm">${esc(l.name)}</span><span class="rev" data-live="rev-${st.lot}">${fmt(st.day.rev)}</span></div>
        <div class="row wrap">${stageChip(st.lot)}<span class="chip">${st.units.length} équip. · ${E.usedSlots(st)}/${E.slotsOf(st)} empl.</span>${down ? `<span class="chip bad">${down} en panne</span>` : ''}${lost7 > 20 ? `<span class="chip warn">${lost7} clients perdus (7 j)</span>` : ''}${st.staff ? '<span class="chip good">Employé</span>' : ''}${!st.units.length ? '<span class="chip warn">À équiper</span>' : ''}</div>
        <div class="row between sub"><span>30 j : CA ${kfmt(rev30)} · résultat ${kfmt(net30)}</span><span data-live="q-${st.lot}"></span></div>
        <div class="gauge"><i data-live="g-${st.lot}" style="width:0%"></i></div>
      </button>`;
    }).join('') + `</div>`;
    const rivalsSt = Object.values(S.stations).filter(st => st.owner !== 'player' && sectorRevealed(st.lot));
    if (rivalsSt.length) {
      html += `<h3>Rivaux connus</h3><div class="stack">` + rivalsSt.map(st => `<div class="row between card"><span>${esc(E.lotDef(st.lot).name)}</span><span class="chip" style="border-color:${ownerColor(st.owner)};color:${ownerColor(st.owner)}">${esc(ownerName(st.owner))}</span></div>`).join('') + `</div>`;
    }
    return html;
  }

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

  // ---------------- vue finances ----------------
  function viewFinances() {
    const pat = E.patrimoine(S), debt = E.debt(S);
    const lim = E.creditLimit(S);
    if (!ui.loanAmt || ui.loanAmt > lim) ui.loanAmt = Math.min(lim, Math.max(5000, Math.round(lim / 2 / 1000) * 1000));
    let html = `<div class="view-title"><h2>Finances</h2><span class="sub">${esc(E.title(S))}</span></div>
      <div class="big-kpis">
        <div class="kpi"><div class="l">Trésorerie</div><div class="v money" data-live="f-cash">${fmt(S.cash)}</div></div>
        <div class="kpi"><div class="l">Patrimoine</div><div class="v">${kfmt(pat)}</div></div>
        <div class="kpi"><div class="l">Dette</div><div class="v">${kfmt(debt)}</div></div>
        <div class="kpi"><div class="l">Valeur nette</div><div class="v">${kfmt(S.cash + pat - debt)}</div></div>
      </div>
      <h3>60 derniers jours</h3><div class="card">${chartSvg()}</div>
      <h3>Banque</h3>
      <div class="card stack">`;
    if (lim < 5000) html += `<p class="sub" style="margin:0">Capacité d'emprunt épuisée. Rembourse ou augmente ton patrimoine et ton CA.</p>`;
    else html += `<div class="row between"><span class="sub">Capacité d'emprunt</span><b class="num" style="font-size:18px">${fmt(lim)}</b></div>
        <label class="row between" for="loanAmt"><span>Montant</span><b class="num" style="font-size:20px;color:var(--mustard)" id="loanAmtV">${fmt(ui.loanAmt)}</b></label>
        <input type="range" id="loanAmt" min="5000" max="${lim}" step="1000" value="${ui.loanAmt}">
        <div class="seg" id="loanYears">${[3, 5, 7, 10].map(y => `<button data-years="${y}" aria-pressed="${ui.loanYears === y}">${y} ans</button>`).join('')}</div>
        <div class="row between"><span class="sub" id="loanInfo"></span></div>
        <button class="btn block" data-act="borrow">Emprunter</button>`;
    html += `</div>`;
    if (S.loans.length) {
      html += `<h3>Prêts en cours</h3><div class="stack">` + S.loans.map(l => `<div class="card loan"><span><b class="num" style="font-size:17px">${fmt(l.remaining)}</b> restants<div class="sub">${fmt(l.monthly)}/mois · ${l.left} mois · ${(l.rate * 100).toFixed(1).replace('.', ',')} %</div></span><button class="btn ghost small" data-act="repay" data-id="${l.id}" ${S.cash < l.remaining ? 'disabled' : ''}>Solder</button></div>`).join('') + `</div>`;
    }
    html += `<h3>Équipe</h3>`;
    if (!S.staff.length) html += `<p class="sub">Aucun employé. Embauche depuis la fiche d'une station : +20 % de CA.</p>`;
    else html += `<div class="stack">` + S.staff.map(e => `<div class="card row between"><span><b>${esc(e.name)}</b><div class="sub">${e.stations.length ? e.stations.map(x => esc(E.lotDef(x).name)).join(', ') : 'Sans affectation'} · ${fmt(E.STAFF_DAY)}/j</div></span>${ui.confirm === 'fire-' + e.id ? `<span class="confirm"><button class="btn danger small" data-act="fire" data-id="${e.id}">Confirmer</button><button class="btn ghost small" data-act="cancel">Non</button></span>` : `<button class="btn ghost small" data-act="ask" data-key="fire-${e.id}">Licencier</button>`}</div>`).join('') + `</div>`;
    html += `<h3>Réglages</h3><div class="card stack">
      <div><div class="sub" style="margin-bottom:6px">Rythme de jeu</div><div class="seg">
        <button data-act="mode" data-v="realtime" aria-pressed="${S.mode === 'realtime'}">Temps réel<small>1 jour = 20 s en ×1</small></button>
        <button data-act="mode" data-v="turn" aria-pressed="${S.mode === 'turn'}">Tour par tour<small>Une semaine par tour</small></button></div></div>
      <p class="sub" style="margin:0">Version ${APP_VERSION}. Sauvegarde ${Save.status === 'cloud' ? 'sur ton compte Claude et sur cet appareil' : 'sur cet appareil'}, automatique. Hors ligne, tes stations tournent à 50 % pendant 8 h maximum.</p>
      <div class="row wrap"><button class="btn ghost small" data-act="export">Copier ma partie</button><button class="btn ghost small" data-act="import-open">Importer une partie</button></div>
      ${ui.importOpen ? `<label class="sub" for="importCode">Colle le code copié depuis l'autre version du jeu :</label><textarea id="importCode" rows="3" style="width:100%;background:var(--night-2);color:var(--cream);border:1px solid var(--line);border-radius:10px;padding:8px;font:12px monospace"></textarea><div class="row"><button class="btn small" data-act="import">Charger cette partie</button><button class="btn ghost small" data-act="import-close">Annuler</button></div>` : ''}
      ${ui.confirm === 'reset' ? `<div class="confirm"><button class="btn danger" data-act="reset">Effacer et recommencer</button><button class="btn ghost" data-act="cancel">Annuler</button></div>` : `<button class="btn ghost" data-act="ask" data-key="reset">Nouvelle partie</button>`}
    </div>`;
    return html;
  }
  function chartSvg() {
    const h = S.hist.slice(-60);
    if (h.length < 2) return '<p class="sub" style="margin:0">Le graphique apparaît après quelques jours de jeu.</p>';
    const W = 320, H = 120, pad = 22;
    const max = Math.max(50, ...h.map(x => Math.max(x.rev, x.cost)));
    const bw = (W - pad) / 60;
    const y = v => H - 14 - (v / max) * (H - 26);
    let bars = h.map((x, i) => `<rect x="${pad + i * bw + 0.5}" y="${y(x.rev)}" width="${Math.max(1, bw - 1)}" height="${H - 14 - y(x.rev)}" fill="#36e3d0" opacity="0.85"/>`).join('');
    const line = h.map((x, i) => `${pad + i * bw + bw / 2},${y(x.cost)}`).join(' ');
    const ticks = [0, max / 2, max].map(v => `<line x1="${pad}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="#2c4670" stroke-width="0.6"/><text x="${pad - 3}" y="${y(v) + 3}" text-anchor="end" font-size="8" fill="#9fb2cc" font-family="Barlow Condensed, sans-serif">${kfmt(v).replace(' €', '')}</text>`).join('');
    const rev = sum(h, x => x.rev), cost = sum(h, x => x.cost);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Chiffre d'affaires et coûts quotidiens">${ticks}${bars}<polyline points="${line}" fill="none" stroke="#ff4f9a" stroke-width="1.6"/><text x="${pad}" y="${H - 2}" font-size="8" fill="#9fb2cc" font-family="Barlow, sans-serif">il y a ${h.length} j</text><text x="${W}" y="${H - 2}" text-anchor="end" font-size="8" fill="#9fb2cc" font-family="Barlow, sans-serif">hier</text></svg>
      <div class="row wrap sub" style="margin-top:6px"><span><i style="display:inline-block;width:10px;height:10px;background:#36e3d0;margin-right:4px"></i>CA ${kfmt(rev)}</span><span><i style="display:inline-block;width:10px;height:2px;background:#ff4f9a;margin-right:4px;vertical-align:3px"></i>Coûts d'exploitation ${kfmt(cost)}</span><span>Résultat ${kfmt(rev - cost)}</span></div>`;
  }
  function bindLoan() {
    const r = $('#loanAmt'); if (!r) return;
    const upd = () => {
      ui.loanAmt = +r.value;
      $('#loanAmtV').textContent = fmt(ui.loanAmt);
      const rate = E.loanRate(S, ui.loanAmt);
      $('#loanInfo').textContent = `${(rate * 100).toFixed(1).replace('.', ',')} % · ${fmt(E.monthlyPay(ui.loanAmt, rate, ui.loanYears))} par mois pendant ${ui.loanYears * 12} mois`;
    };
    r.addEventListener('input', upd);
    $$('#loanYears button').forEach(b => b.addEventListener('click', () => { ui.loanYears = +b.dataset.years; $$('#loanYears button').forEach(x => x.setAttribute('aria-pressed', x === b)); upd(); }));
    upd();
  }

  // ---------------- vue journal ----------------
  function viewJournal() {
    let html = `<div class="view-title"><h2>Journal</h2><span class="sub">${esc(E.title(S))}</span></div>
      <h3>Objectifs</h3><div class="objs">` + E.OBJECTIVES.map((o, i) => `<div class="obj ${i < S.obj ? 'done' : i === S.obj ? 'cur' : ''}"><span class="b">${i < S.obj ? '✓' : i + 1}</span><span>${esc(o.t)}</span></div>`).join('') + `</div>`;
    if (S.obj >= E.OBJECTIVES.length) html += `<p class="sub">Tous les objectifs sont remplis. Place au bac à sable : toujours plus.</p>`;
    if (S.events.length) html += `<h3>En ce moment</h3><div class="row wrap">` + S.events.map(e => `<span class="chip ${e.f >= 1 ? 'good' : 'bad'}">${esc(e.label)}${e.zone ? ' · ' + esc(E.zoneDef(e.zone).name) : ''} · ${e.f >= 1 ? '+' : '−'}${Math.round(Math.abs(e.f - 1) * 100)} %</span>`).join('') + `</div>`;
    html += `<h3>Rivaux</h3><div class="stack">` + E.RIVALS.map(r => {
      const rs = S.rivals.find(x => x.id === r.id);
      const n = Object.values(S.stations).filter(st => st.owner === r.id).length;
      const known = Object.values(S.stations).filter(st => st.owner === r.id && sectorRevealed(st.lot)).length;
      return `<div class="card rival"><span class="av" style="background:${r.color}">${esc(r.short)}</span><span><b>${esc(r.name)}</b><div class="sub">${r.profile === 'discounter' ? 'Prix bas, gros volumes' : 'Parie sur les zones naissantes'}${rs.bankrupt ? ' · en faillite' : ''}</div></span><span class="chip">Repérées ${known}/${n}</span></div>`;
    }).join('') + `</div>`;
    html += `<h3>Événements</h3><div class="log">` + S.log.slice(0, 80).map(l => `<div class="log-item ${l.kind}"><span class="d">J${l.d + 1}</span><span class="t">${esc(l.text)}</span></div>`).join('') + `</div>`;
    return html;
  }

  // ---------------- mises à jour en direct ----------------
  function liveUpdate() {
    const m = $('main');
    if (ui.tab === 'station') {
      const st = S.stations[ui.lot]; if (!st) return;
      stationLive();
      for (const t of E.TYPES) { set(m, 'price-' + t, euro(st.prices[t])); set(m, 'pf-' + t, Math.round(E.priceFactor(st.prices[t], E.refPrice(S, ui.lot, t)) * 100)); }
    } else if (ui.tab === 'stations') {
      for (const st of myStations()) {
        set(m, 'rev-' + st.lot, fmt(st.day.rev));
        const q = st.q.portique + st.q.hp, qm = E.qmaxOf(st);
        set(m, 'q-' + st.lot, `file ${q}/${qm}`);
        const g = m.querySelector(`[data-live="g-${st.lot}"]`); if (g) g.style.width = Math.min(100, q / qm * 100) + '%';
      }
    } else if (ui.tab === 'finances') set(m, 'f-cash', fmt(S.cash));
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
      case 'intro-go': S.seenIntro = true; closeSheet(true); paused = false; go('station', 'A'); Save.touch(); return;
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
    Dio.draw(t);
    requestAnimationFrame(frame);
  }
  function afterTick(forceRender) {
    // nouveaux événements -> toasts
    if (S.log[0] !== ui.logTop) {
      const fresh = [];
      for (const l of S.log) { if (l === ui.logTop) break; fresh.push(l); }
      ui.logTop = S.log[0];
      for (const l of fresh.reverse()) if (l.kind !== 'info' || /Neige|Monnayeur/.test(l.text)) toast(l.text, l.kind);
      if (!ui.sheet && ui.tab !== 'finances') forceRender = true;
    }
    if (S.d !== ui.lastDay) { ui.lastDay = S.d; if (ui.tab === 'station' || ui.tab === 'stations') forceRender = true; }
    for (const t of E.checkObjectives(S)) toast('Objectif rempli : ' + t, 'goal');
    if (S.over) gameOver();
    if (forceRender && !ui.sheet) renderView();
    if (forceRender) renderHud();
  }

  function intro() {
    openSheet(`<div class="intro"><div class="intro-logo"><div class="script">Car Wash</div><div class="sign">TYCOON</div></div>
      <p>Département de la Mousse, 1er mars 2027. Tu possèdes un terrain vague aux Bruyères et ${fmt(S.cash)} en poche.</p>
      <p>Installe ton premier équipement, fixe tes prix, puis explore la carte. Un portique attire plus de monde que des pistes HP, mais il coûte plus cher : la banque est là pour ça.</p>
      <p>L'emplacement fait tout. Les zones grandissent avec le temps : sois le premier au bon endroit.</p>
      ${installHint()}
      <button class="btn block" data-test="start" data-act="intro-go">Ouvrir la station</button></div>`, { center: true, noClose: true });
  }
  function installHint() {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    if (!ios || standalone || window.claude) return '';
    return `<p class="signal" style="border-left-color:var(--turq);background:rgba(54,227,208,.08)">Pour l'installer comme une app : touche <b>Partager</b> en bas de Safari, puis <b>Sur l'écran d'accueil</b>.</p>`;
  }
  function gameOver() {
    if (ui.goShown) return; ui.goShown = true;
    openSheet(`<div class="intro"><div class="intro-logo"><div class="script" style="color:var(--cherry)">Faillite</div></div>
      <p>La banque a fermé le robinet. Ton empire a tenu ${S.d} jours et encaissé ${fmt(S.totals.rev)} de chiffre d'affaires.</p>
      <button class="btn block" data-act="reset">Nouvelle partie</button></div>`, { center: true, noClose: true });
  }

  // ---------------- diorama animé ----------------
  const Dio = {
    cv: null, ctx: null, lot: null, w: 0, h: 0, drops: [],
    attach(cv, lot) { this.cv = cv; this.lot = lot; this.ctx = cv.getContext('2d'); this.resize(); },
    detach() { this.cv = null; },
    resize() {
      if (!this.cv) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = this.cv.getBoundingClientRect();
      this.w = r.width; this.h = r.height;
      this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    draw(t) {
      if (!this.cv || !this.cv.isConnected) return;
      const st = S.stations[this.lot]; if (!st) return;
      const c = this.ctx, W = this.w, H = this.h, time = t / 1000;
      const open = S.h >= E.OPEN && S.h < E.CLOSE;
      const anyDown = st.units.some(u => u.down > 0);
      // ciel
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#081022'); g.addColorStop(1, '#16294a');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(255,243,217,.6)';
      for (let i = 0; i < 26; i++) { const x = (i * 97 + st.lot.charCodeAt(0) * 13) % W, y = (i * 53) % 52 + 4; c.fillRect(x, y, 1.2, 1.2); }
      // enseigne
      const sx = W / 2, sy = 24;
      let alpha = 1;
      if (anyDown && Math.sin(time * 23) > 0.6) alpha = 0.35;
      c.save(); c.globalAlpha = alpha;
      c.strokeStyle = '#ff4f9a'; c.lineWidth = 2; c.shadowColor = '#ff4f9a'; c.shadowBlur = 12;
      roundRect(c, sx - 92, sy - 18, 184, 40, 10); c.stroke();
      c.shadowBlur = 14; c.fillStyle = '#fff3d9'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.font = '22px Yellowtail, cursive';
      const nm = shortName(E.lotDef(this.lot).name);
      c.fillText(nm, sx, sy + 4);
      c.shadowColor = '#36e3d0'; c.fillStyle = '#36e3d0'; c.font = '9px Bungee, sans-serif';
      c.fillText(open ? 'CAR WASH · OUVERT' : 'CAR WASH · FERMÉ', sx, sy + 17);
      c.restore();
      // sol
      const gy = H - 44, by = 66;
      c.fillStyle = '#26385a'; c.fillRect(0, gy, W, 8);
      c.fillStyle = '#141d2e'; c.fillRect(0, gy + 8, W, H - gy - 8);
      c.strokeStyle = '#ffc94a'; c.lineWidth = 2; c.setLineDash([12, 10]); c.lineDashOffset = -time * 20 % 22;
      c.beginPath(); c.moveTo(0, H - 12); c.lineTo(W, H - 12); c.stroke(); c.setLineDash([]);
      // baies
      const slots = E.slotsOf(st), m = 10, sw = (W - 2 * m) / slots;
      let si = 0;
      const busyLeft = { portique: st.cur.served.portique, hp: st.cur.served.hp };
      for (const u of st.units) {
        const n = E.EQUIP[u.type].slots, x = m + si * sw, w = n * sw;
        const tier = E.EQUIP[u.type].tiers[u.tier];
        let busy = false;
        if (u.down === 0 && busyLeft[u.type] > 0) { busy = true; busyLeft[u.type] -= tier.cap; }
        this.bay(c, u, x + 2, by, w - 4, gy - by, busy && open, time);
        si += n;
      }
      for (; si < slots; si++) {
        const x = m + si * sw;
        c.strokeStyle = 'rgba(54,227,208,.35)'; c.setLineDash([4, 4]); c.lineWidth = 1.2;
        roundRect(c, x + 4, by + 10, sw - 8, gy - by - 12, 6); c.stroke(); c.setLineDash([]);
        c.fillStyle = 'rgba(54,227,208,.5)'; c.font = '700 18px "Barlow Condensed", sans-serif'; c.textAlign = 'center';
        c.fillText('+', x + sw / 2, by + (gy - by) / 2 + 6);
      }
      // file d'attente
      const q = st.q.portique + st.q.hp, qm = E.qmaxOf(st);
      const fit = Math.floor((W - 20) / 38);
      const shown = Math.min(q, fit);
      for (let i = 0; i < shown; i++) {
        const x = 8 + i * 38 + Math.sin(time * 3 + i) * 0.8;
        drawCar(c, x, H - 18, 32, CAR_COLORS[(i + st.lot.charCodeAt(0)) % CAR_COLORS.length], 1);
      }
      if (q >= qm * 0.9 && open && Math.sin(time * 4) > 0) {
        c.fillStyle = '#ffc94a'; c.font = '10px Bungee, sans-serif'; c.textAlign = 'right';
        c.fillText('TUUT !', W - 8, H - 30);
      }
      if (!st.units.length) {
        c.fillStyle = 'rgba(255,243,217,.85)'; c.font = '600 13px Barlow, sans-serif'; c.textAlign = 'center';
        c.fillText('Terrain vague : ajoute un équipement', W / 2, by + (gy - by) / 2 + 26);
      }
    },
    bay(c, u, x, y, w, h, busy, time) {
      const broken = u.down > 0;
      c.save();
      if (u.type === 'portique') {
        // toit + façade
        c.fillStyle = '#1f3456'; roundRect(c, x, y, w, 12, 4); c.fill();
        c.fillStyle = '#c7d2e0'; c.font = '8px Bungee, sans-serif'; c.textAlign = 'center';
        c.fillText(E.EQUIP.portique.tiers[u.tier].n.toUpperCase(), x + w / 2, y + 9);
        c.fillStyle = 'rgba(8,16,34,.6)'; c.fillRect(x + 4, y + 12, w - 8, h - 12);
        if (busy) drawCar(c, x + w / 2 - 22, y + h - 4, 44, '#8ff0d8', 1.25);
        // arche chrome
        const ax = busy ? x + w / 2 - 26 + Math.sin(time * 1.6) * 14 : x + w / 2 - 26;
        c.strokeStyle = broken ? '#5a6478' : '#c7d2e0'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(ax, y + h); c.lineTo(ax, y + 18); c.lineTo(ax + 52, y + 18); c.lineTo(ax + 52, y + h); c.stroke();
        // rouleaux
        for (const [rx, col] of [[ax + 5, '#ff4f9a'], [ax + 40, '#36e3d0']]) {
          c.fillStyle = broken ? '#3a4458' : col; c.fillRect(rx, y + 22, 7, h - 26);
          if (!broken) {
            c.fillStyle = 'rgba(255,255,255,.35)';
            const off = busy ? (time * 40) % 8 : 0;
            for (let k = y + 22 + off; k < y + h - 4; k += 8) c.fillRect(rx, k, 7, 2);
          }
        }
        if (busy) for (let i = 0; i < 4; i++) bubble(c, ax + 10 + ((time * 37 + i * 13) % 34), y + 30 + ((time * 50 + i * 21) % (h - 36)));
      } else {
        // auvent HP
        c.fillStyle = broken ? '#3a4458' : '#36e3d0';
        c.beginPath(); c.moveTo(x, y + 14); c.lineTo(x + w / 2, y + 2); c.lineTo(x + w, y + 14); c.closePath(); c.fill();
        c.fillStyle = '#0d1729'; c.font = '8px Bungee, sans-serif'; c.textAlign = 'center'; c.fillText('HP', x + w / 2, y + 12);
        c.strokeStyle = '#c7d2e0'; c.lineWidth = 2.2;
        c.beginPath(); c.moveTo(x + 3, y + 14); c.lineTo(x + 3, y + h); c.moveTo(x + w - 3, y + 14); c.lineTo(x + w - 3, y + h); c.stroke();
        if (busy) {
          const cw = Math.min(40, w - 10);
          drawCar(c, x + w / 2 - cw / 2, y + h - 4, cw, '#ffd36b', cw / 34);
          c.strokeStyle = 'rgba(140,200,255,.85)'; c.lineWidth = 1.4; c.setLineDash([2, 3]); c.lineDashOffset = -time * 30;
          c.beginPath(); c.moveTo(x + w - 6, y + 22); c.quadraticCurveTo(x + w / 2 + 6, y + 18 + Math.sin(time * 6) * 4, x + w / 2, y + h - 18); c.stroke(); c.setLineDash([]);
        }
      }
      if (broken && Math.sin(time * 6) > -0.2) {
        c.fillStyle = 'rgba(255,90,95,.18)'; c.fillRect(x, y, w, h);
        c.fillStyle = '#ff5a5f'; c.font = '9px Bungee, sans-serif'; c.textAlign = 'center';
        c.shadowColor = '#ff5a5f'; c.shadowBlur = 8; c.fillText('PANNE', x + w / 2, y + h / 2 + 4);
      }
      c.restore();
    }
  };
  const CAR_COLORS = ['#8ff0d8', '#ff9ec7', '#ffd36b', '#8cc8ff', '#ff7b7b', '#fff1cf', '#c6a8ff'];
  function shortName(n) { const p = n.split(','); const s = p[0].replace(/^(Terrain des |Carrefour de la |Aire du )/, ''); return s.length > 18 ? s.slice(0, 17) + '…' : s; }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function bubble(c, x, y) { c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 2.2, 0, Math.PI * 2); c.stroke(); }
  function drawCar(c, x, yb, w, color, s = 1) {
    // voiture rétro vue de profil : yb = bas des roues
    const h = w * 0.42;
    c.save();
    c.fillStyle = color;
    // caisse
    roundRect(c, x, yb - h * 0.78, w, h * 0.44, h * 0.16); c.fill();
    // aileron arrière
    c.beginPath(); c.moveTo(x + 1, yb - h * 0.7); c.lineTo(x + w * 0.12, yb - h * 0.98); c.lineTo(x + w * 0.2, yb - h * 0.7); c.fill();
    // cabine
    c.beginPath(); c.moveTo(x + w * 0.24, yb - h * 0.74); c.lineTo(x + w * 0.34, yb - h * 1.08); c.lineTo(x + w * 0.66, yb - h * 1.08); c.lineTo(x + w * 0.78, yb - h * 0.74); c.closePath(); c.fill();
    c.fillStyle = 'rgba(13,23,41,.75)';
    c.beginPath(); c.moveTo(x + w * 0.3, yb - h * 0.76); c.lineTo(x + w * 0.37, yb - h * 1.0); c.lineTo(x + w * 0.63, yb - h * 1.0); c.lineTo(x + w * 0.72, yb - h * 0.76); c.closePath(); c.fill();
    // chrome
    c.fillStyle = '#e6edf5'; c.fillRect(x - 1, yb - h * 0.42, w + 2, Math.max(1.5, h * 0.08));
    // roues
    for (const wx of [x + w * 0.24, x + w * 0.76]) {
      c.fillStyle = '#05080f'; c.beginPath(); c.arc(wx, yb - h * 0.2, h * 0.22, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c7d2e0'; c.beginPath(); c.arc(wx, yb - h * 0.2, h * 0.09, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  // ---------------- démarrage ----------------
  function bindUI() {
    document.addEventListener('click', e => {
      const nav = e.target.closest('[data-nav]');
      if (nav) { navOpen(nav.dataset.nav); return; }
      const tool = e.target.closest('[data-tool]');
      if (tool) { toolOpen(tool.dataset.tool); return; }
      if (e.target.closest('#hud-cash')) { navOpen('finances'); return; }
      if (e.target.closest('#hud-bell') || e.target.closest('#objective')) { navOpen('journal'); return; }
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
      if (e.target.id === 'backdrop' && ui.sheet && !$('#backdrop [data-act="intro-go"]') && !$('#backdrop [data-act="reset"]')) closeSheet();
    });
    document.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.pin, .fog')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
      if (e.key === 'Escape' && ui.sheet && !$('#backdrop [data-act="intro-go"]')) closeSheet();
    });
    window.addEventListener('resize', () => { Dio.resize(); mondeApply(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { Save.local(); Save.cloud(true); } });
    window.addEventListener('pagehide', () => Save.local());
  }

  function offlineWelcome() {
    const off = E.offline(S, Date.now());
    if (!off || off.gain <= 0) return false;
    S.cash += off.gain;
    S.lastSeen = Date.now();
    const hh = Math.floor(off.hours), mm = Math.round((off.hours - hh) * 60);
    openSheet(`<div class="intro"><div class="intro-logo"><div class="script">Bon retour</div></div>
      <p>Pendant ton absence (${hh ? hh + ' h ' : ''}${mm} min), tes stations ont continué de tourner à mi-régime.</p>
      <p style="text-align:center"><b class="num" style="font-size:32px;color:var(--mustard)">+${fmt(off.gain)}</b></p>
      <button class="btn block" data-act="offline-ok">Reprendre</button></div>`, { center: true, noClose: true });
    return true;
  }
  // remplace la partie en cours par une partie chargée
  function restore(st, welcome) {
    S = st;
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
