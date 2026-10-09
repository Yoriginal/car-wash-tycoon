/* HUD haut (Monde et Station) : trésorerie, date et météo, niveau, cloche d'alertes. */
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const JOURS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const WX_ICON = { sun: 'sun', cloud: 'cloud', rain: 'rain', snow: 'snow' };

function hudDateText() {
  const d = E.dateOf(S.d);
  const jour = `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
  return S.mode === 'turn' ? jour : `${jour} · ${String(S.h).padStart(2, '0')} h`;
}
// niveau du joueur : objectifs remplis (1 au départ, 9 au maximum)
function playerLevel() { return Math.min(E.OBJECTIVES.length, S.obj + 1); }
// résultat d'exploitation de la journée en cours (CA − coûts, hors investissements)
function todayNet() { return Math.round(S.today.rev - S.today.cost); }
// événement le plus marquant en cours (pollen, sel, vacances...)
function currentEvent() {
  const ev = S.events.filter(e => !e.zone || S.sectors[E.zoneDef(e.zone).sector].revealed);
  return ev.length ? ev[0].label.replace('Épisode de pollen', 'Pollen').replace('Sel sur les routes', 'Sel').replace(/(Départs|Retours) (en|de) vacances/, 'Vacances') : '';
}

function hudRender() {
  const cash = $('#cash');
  cash.textContent = fmt(S.cash);
  cash.classList.toggle('neg', S.cash < 0);
  const net = todayNet();
  const tr = $('#trend');
  tr.textContent = `${net >= 0 ? '▲' : '▼'} ${signed(net)} aujourd'hui`;
  tr.className = 'trend ' + (net >= 0 ? 'up' : 'down');
  $('#hud-date').textContent = hudDateText();
  const w = S.weather.today;
  const wx = $('#wx');
  if (wx.dataset.w !== w) { wx.innerHTML = icon(WX_ICON[w]); wx.dataset.w = w; $('#wx-name').textContent = E.WEATHER[w].n; }
  const ev = currentEvent();
  const evEl = $('#wx-ev');
  if (evEl.textContent !== ev) { evEl.textContent = ev; evEl.hidden = !ev; }
  $('#niveau').textContent = playerLevel();
  const n = alertCount();
  const badge = $('#bell-n');
  badge.textContent = n > 9 ? '9+' : n;
  badge.hidden = !n;
}

// compteur de la cloche : alertes à traiter (pannes, files pleines, découvert, offres)
function alertCount() { return alertesListe().filter(a => a.compte).length; }
