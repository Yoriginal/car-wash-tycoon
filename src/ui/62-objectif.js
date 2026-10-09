/* Bulle d'objectif : capsule sombre posée en bas de la scène (toucher = Missions). */
// progression affichable seulement quand elle se calcule simplement à partir de l'état
function objProgress(i) {
  const mine = Object.values(S.stations).filter(x => x.owner === 'player').length;
  switch (i) {
    case 1: return { v: Math.min(1000, S.totals.rev), max: 1000, t: `${fmt(Math.min(1000, S.totals.rev))} / ${fmt(1000)}` };
    case 4: return { v: Math.min(2, mine), max: 2, t: `${Math.min(2, mine)} / 2` };
    case 5: { const best = Math.max(0, ...S.hist.map(h => h.rev)); return { v: Math.min(1000, best), max: 1000, t: `${fmt(Math.min(1000, best))} / ${fmt(1000)}` }; }
    case 6: return { v: Math.min(5, mine), max: 5, t: `${Math.min(5, mine)} / 5` };
    case 8: { const nw = S.cash + E.patrimoine(S) - E.debt(S); return { v: Math.max(0, Math.min(2e6, nw)), max: 2e6, t: `${kfmt(Math.max(0, nw))} / 2 M€` }; }
  }
  return null;
}
function objRender() {
  const ob = $('#objective');
  if (S.obj >= E.OBJECTIVES.length) { ob.hidden = true; return; }
  ob.hidden = false;
  if (!ob.dataset.ready) { ob.querySelector('.obj-ic').innerHTML = icon('target'); ob.dataset.ready = '1'; }
  const t = E.OBJECTIVES[S.obj].t;
  const txt = ob.querySelector('.txt');
  if (txt.textContent !== t) txt.textContent = t;
  const p = objProgress(S.obj);
  const j = ob.querySelector('.jauge');
  j.hidden = !p;
  ob.querySelector('.obj-val').textContent = p ? p.t : `${S.obj + 1} / ${E.OBJECTIVES.length}`;
  if (p) j.firstElementChild.style.width = Math.round(100 * p.v / p.max) + '%';
}
// fiche météo : effet du temps et des événements sur la demande
function meteoSheet() {
  const w = S.weather.today;
  const f = E.WEATHER[w].f;
  const rebond = w === 'sun' && (S.weather.yesterday === 'rain' || S.weather.yesterday === 'snow');
  const ev = S.events.filter(e => !e.zone || S.sectors[E.zoneDef(e.zone).sector].revealed);
  openSheet(`<div class="sheet-head">${icon(WX_ICON[w])}<h2>${E.WEATHER[w].n}</h2></div>
    <p class="petites-caps">Saison : ${E.seasonOf(S.d)}</p>
    <p>Effet sur la demande aujourd'hui : <b class="num">${f >= 1 ? '+' : '−'}${Math.round(Math.abs(f - 1) * 100)} %</b>${rebond ? ', et le premier soleil après la pluie fait venir 40 % de clients en plus.' : '.'}</p>
    ${ev.length ? `<div class="stack">${ev.map(e => `<div class="row between"><span>${esc(e.label)}${e.zone ? ' · ' + esc(E.zoneDef(e.zone).name) : ''}</span><b class="num">${e.f >= 1 ? '+' : '−'}${Math.round(Math.abs(e.f - 1) * 100)} %</b></div>`).join('')}</div>` : '<p class="sub">Aucun événement en cours.</p>'}`);
}
