/* Dock sombre (zone du pouce) : navigation + cadran de vitesse ; outils de la Station au-dessus.
   Cadran : toucher = pause / reprise ; glisser ou toucher un repère = vitesse.
   En mode tour par tour : toucher = tour suivant (une semaine). */
const DIAL_STOPS = [{ v: 0, a: -62, t: 'II' }, { v: 1, a: -22, t: '1' }, { v: 3, a: 22, t: '3' }, { v: 10, a: 62, t: '10' }];
const NAV = [
  { id: 'map', ic: 'map', t: 'Monde' },
  { id: 'stations', ic: 'empire', t: 'Empire' },
  { id: 'dial' },
  { id: 'journal', ic: 'missions', t: 'Missions' },
  { id: 'finances', ic: 'bank', t: 'Banque' },
];
const TOOLS = [
  { id: 'prix', ic: 'tag', t: 'Prix' },
  { id: 'entretien', ic: 'wrench', t: 'Entretien' },
  { id: 'equipe', ic: 'cap', t: 'Équipe' },
  { id: 'station', ic: 'station', t: 'Station' },
];

function dockBuild() {
  $('#hud-cash .coin-wrap').innerHTML = coin(28);
  $('#hud-bell .bell-ic').innerHTML = ASSETS['icones/bell'];
  $('#nav').innerHTML = NAV.map(n => n.id === 'dial'
    ? `<div class="dial-wrap"><div class="dial" id="dial" role="slider" aria-label="Vitesse du temps" tabindex="0"></div></div>`
    : `<button class="nav-btn" data-nav="${n.id}" data-test="nav-${n.id}"><span class="rond">${icon(n.ic)}<span class="nav-picto"></span></span><span class="nav-t">${n.t}</span></button>`).join('');
  $('#tools').innerHTML = TOOLS.map(t => `<button class="capsule tool" data-tool="${t.id}" data-test="tool-${t.id}">${icon(t.ic)}<span>${t.t}</span></button>`).join('');
  dialBind($('#dial'));
}

function dockRender() {
  const ouverte = ui.sheet && ui.f && Object.keys(NAV_FEUILLE).find(k => NAV_FEUILLE[k] === ui.f.kind);
  const active = ouverte || (ui.sheet ? '' : ui.tab === 'map' ? 'map' : '');
  for (const b of $$('#nav .nav-btn')) b.classList.toggle('actif', b.dataset.nav === active);
  $('#tools').hidden = ui.tab !== 'station';
  const h = $('#dock').offsetHeight;
  if (h && h !== ui.dockH) { ui.dockH = h; document.documentElement.style.setProperty('--dock-h', h + 'px'); }
  dialRender();
}

function currentSpeed() { return S.mode === 'turn' ? 'turn' : paused ? 0 : S.speed; }
function dialRender() {
  const el = $('#dial');
  const sp = currentSpeed();
  const key = sp + '|' + S.mode;
  if (el.dataset.k === key) return;
  el.dataset.k = key;
  if (S.mode === 'turn') {
    el.innerHTML = `<svg viewBox="0 0 76 76" aria-hidden="true"><circle cx="38" cy="38" r="35" fill="#1B2024" stroke="#14BFAE" stroke-width="2.5"/>
      <text x="38" y="35" text-anchor="middle" font-family="Barlow Condensed" font-weight="700" font-size="11" fill="#F4F0E6" letter-spacing="1">TOUR</text>
      <text x="38" y="50" text-anchor="middle" font-family="Barlow Condensed" font-weight="700" font-size="13" fill="#14BFAE">suivant ▸</text></svg>`;
    el.setAttribute('aria-valuetext', 'Tour par tour');
    el.dataset.test = 'turn';
    return;
  }
  const stop = DIAL_STOPS.find(s => s.v === sp) || DIAL_STOPS[1];
  const rad = (stop.a - 90) * Math.PI / 180;
  const nx = 38 + Math.cos(rad) * 22, ny = 38 + Math.sin(rad) * 22;
  const ticks = DIAL_STOPS.map(s => {
    const r = (s.a - 90) * Math.PI / 180;
    const on = s.v === sp;
    return `<text x="${38 + Math.cos(r) * 26}" y="${38 + Math.sin(r) * 26 + 4}" text-anchor="middle" font-family="Barlow Condensed" font-weight="700" font-size="${on ? 12 : 10.5}" fill="${on ? '#14BFAE' : '#F4F0E6'}" opacity="${on ? 1 : .75}">${s.t}</text>`;
  }).join('');
  const label = sp === 0 ? 'PAUSE' : '×' + sp;
  el.innerHTML = `<svg viewBox="0 0 76 76" aria-hidden="true"><circle cx="38" cy="38" r="35" fill="#1B2024" stroke="#14BFAE" stroke-width="2.5"/>${ticks}
    <line x1="38" y1="38" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#EE3B30" stroke-width="3" stroke-linecap="round"/><circle cx="38" cy="38" r="3.6" fill="#F4F0E6"/>
    <text x="38" y="62" text-anchor="middle" font-family="Barlow Condensed" font-weight="700" font-size="${sp === 0 ? 10 : 13}" fill="#14BFAE">${label}</text></svg>
    ${DIAL_STOPS.map(s => `<button class="dial-hit" data-test="speed-${s.v}" data-speed="${s.v}" aria-label="${s.v ? 'Vitesse ×' + s.v : 'Pause'}" style="left:${38 + Math.sin(s.a * Math.PI / 180) * 26}px;top:${38 - Math.cos(s.a * Math.PI / 180) * 26}px"></button>`).join('')}`;
  el.setAttribute('aria-valuetext', sp === 0 ? 'En pause' : 'Vitesse ×' + sp);
  el.dataset.test = 'dial';
}

function setSpeed(v) {
  if (v === 0) { if (!paused) ui.lastSpeed = S.speed; paused = true; }
  else { S.speed = v; paused = false; }
  if (ui.sheet) ui.wasPaused = paused;
  dialRender();
}
function togglePause() {
  if (paused) setSpeed(ui.lastSpeed || S.speed || 1);
  else setSpeed(0);
}
function nextTurn() { E.advanceDays(S, 7); afterTick(true); Save.touch(); }

function dialBind(el) {
  let start = null, dragging = false;
  const pick = (x, y) => {
    const r = el.getBoundingClientRect();
    const a = Math.atan2(x - (r.left + r.width / 2), -(y - (r.top + r.height / 2))) * 180 / Math.PI;
    let best = DIAL_STOPS[0];
    for (const s of DIAL_STOPS) if (Math.abs(s.a - a) < Math.abs(best.a - a)) best = s;
    if (best.v !== currentSpeed()) setSpeed(best.v);
  };
  el.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY, target: e.target }; dragging = false; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => {
    if (!start || S.mode === 'turn') return;
    if (!dragging && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) dragging = true;
    if (dragging) pick(e.clientX, e.clientY);
  });
  el.addEventListener('pointerup', e => {
    if (!start) return;
    const t = start.target; start = null;
    if (dragging) return;
    if (S.mode === 'turn') { nextTurn(); return; }
    const hit = t.closest && t.closest('.dial-hit');
    if (hit) setSpeed(+hit.dataset.speed); else togglePause();
  });
  el.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); S.mode === 'turn' ? nextTurn() : togglePause(); }
    const i = DIAL_STOPS.findIndex(s => s.v === currentSpeed());
    if (e.key === 'ArrowRight' && i < DIAL_STOPS.length - 1) setSpeed(DIAL_STOPS[i + 1].v);
    if (e.key === 'ArrowLeft' && i > 0) setSpeed(DIAL_STOPS[i - 1].v);
  });
  // clic direct (souris, tests) sur un repère
  el.addEventListener('click', e => { const hit = e.target.closest('.dial-hit'); if (hit && e.detail === 0) setSpeed(+hit.dataset.speed); });
}

// outils de la Station (étape 2 : mènent à la section ; étape 4 : ouvrent une feuille)
function toolOpen(id) {
  if (ui.tab !== 'station' || !S.stations[ui.lot]) return;
  feuilleOpen(id, { lot: ui.lot });
}
