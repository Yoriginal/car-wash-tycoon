/* Animations sobres (brief § 7) : pièce qui vole vers la trésorerie avec « +N € », voiture qui repart
   quand un client renonce. Coupées si l'appareil demande moins de mouvement. */
const moinsDeMouvement = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

function animGain(montant) {
  const app = $('#app'), scene = $('#scene-svg'), cible = $('#hud-cash .coin-wrap');
  if (!app || !scene || !cible || moinsDeMouvement()) return;
  const A = app.getBoundingClientRect(), s = scene.getBoundingClientRect(), c = cible.getBoundingClientRect();
  const x0 = Math.min(s.right, A.right) - A.left - 90, y0 = s.top - A.top + s.height * 0.55;
  const x1 = c.left - A.left, y1 = c.top - A.top;
  const p = document.createElement('div');
  p.className = 'vol-piece'; p.innerHTML = coin(24);
  p.style.left = x0 + 'px'; p.style.top = y0 + 'px';
  app.appendChild(p);
  p.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${(x1 - x0) * 0.5}px,${(y1 - y0) * 0.5 - 40}px) scale(1.15)`, opacity: 1, offset: 0.5 }, { transform: `translate(${x1 - x0}px,${y1 - y0}px) scale(.8)`, opacity: .2 }],
    { duration: 600, easing: 'ease-in' }).onfinish = () => p.remove();
  const t = document.createElement('div');
  t.className = 'gain-txt'; t.textContent = '+' + fmt(montant);
  t.style.left = (c.right - A.left + 4) + 'px'; t.style.top = (c.bottom - A.top) + 'px';
  app.appendChild(t);
  t.animate([{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1, offset: 0.25 }, { transform: 'translateY(-6px)', opacity: 0 }], { duration: 1100, delay: 450, easing: 'ease-out', fill: 'backwards' }).onfinish = () => t.remove();
}
function animPerdu() {
  const svg = $('#scene-svg svg');
  if (!svg || moinsDeMouvement()) return;
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('class', 'voiture-perdue');
  g.innerHTML = carSvg('#C8435F', 120, ST.LANE_Y + 36, 0.62, false)
    + `<g stroke="#EE3B30" stroke-width="2" stroke-linecap="round"><path d="M114 ${ST.LANE_Y + 38} l-6 -4"/><path d="M113 ${ST.LANE_Y + 44} h-8"/><path d="M114 ${ST.LANE_Y + 50} l-6 4"/></g>`;
  svg.appendChild(g);
  g.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(260px)', opacity: 0 }], { duration: 900, easing: 'ease-in' }).onfinish = () => g.remove();
}
// appelée à chaque mise à jour de l'écran Station
function animStation(st) {
  const a = ui.anim;
  if (!a || a.lot !== st.lot || st.day.rev < a.rev) { ui.anim = { lot: st.lot, rev: st.day.rev, lost: st.day.lost, cumul: 0, tg: 0, tp: 0 }; return; }
  const now = performance.now();
  a.cumul += st.day.rev - a.rev; a.rev = st.day.rev;
  if (a.cumul >= 1 && now - a.tg > 1500 && !ui.sheet) { animGain(Math.round(a.cumul)); a.cumul = 0; a.tg = now; }
  if (st.day.lost > a.lost && now - a.tp > 1200 && !ui.sheet) { animPerdu(); a.tp = now; }
  a.lost = st.day.lost;
}
