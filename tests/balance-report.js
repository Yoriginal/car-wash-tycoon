// Rapport d'équilibrage (informatif, hors tests) : node tests/balance-report.js
// Bot joueur simple pour équilibrer l'économie
const E = require('../src/engine.js');
const fmt = v => Math.round(v).toLocaleString('fr-FR');

function run(strategy, years = 4, verbose = false) {
  const s = E.newGame();
  const timeline = [];
  // jour 0 : équipement de départ
  if (strategy === 'hp') { E.buyUnit(s, 'A', 'hp', 0); E.buyUnit(s, 'A', 'hp', 0); }
  else { E.borrow(s, 20000, 5); E.buyUnit(s, 'A', 'portique', 0); }
  const days = years * 365;
  for (let d = 0; d < days; d++) {
    E.advanceDays(s, 1);
    E.checkObjectives(s);
    // reconnaissance progressive
    if (d % 60 === 0) { const sec = s.sectors.find(x => !x.revealed); if (sec && s.cash > 15000) E.reveal(s, sec.id); }
    // expansion : meilleur terrain visible abordable
    const mine = Object.values(s.stations).filter(x => x.owner === 'player');
    // équiper les stations
    for (const st of mine) {
      const free = E.freeSlots(st);
      if (!st.units.some(u => u.type === 'portique') && free >= 2 && s.cash > 50000) E.buyUnit(s, st.lot, 'portique', 0);
      else if (free >= 1 && s.cash > 20000) {
        const h = st.hist.slice(-7); const lost = h.reduce((a, x) => a + x.lost, 0);
        if (lost > 15 || !st.units.length) E.buyUnit(s, st.lot, 'hp', s.cash > 60000 ? 1 : 0);
      }
    }
    if (d % 15 === 0) {
      const cands = s.lots.filter(l => !l.owner && s.sectors[E.sectorOfLot(l.id)].revealed)
        .map(l => ({ l, price: l.sale ? l.sale.price : E.lotPrice(s, l.id) }))
        .filter(c => c.price + 60000 < s.cash + E.creditLimit(s) * 0.6)
        .sort((a, b) => E.zoneDemand(s, E.lotDef(b.l.id).zone, s.day) / b.price - E.zoneDemand(s, E.lotDef(a.l.id).zone, s.day) / a.price);
      const c = cands[0];
      if (c) {
        const need = c.price + 50000 - s.cash;
        if (need > 0) E.borrow(s, Math.min(need, E.creditLimit(s)), 7);
        if (s.cash >= c.price) E.buyLot(s, c.l.id);
      }
    }
    if (d % 90 === 0) {
      const n = mine.length, net = E.avgNet(s, 30), rev = E.avgRev(s, 30);
      timeline.push(`j${d} st=${n} cash=${fmt(s.cash)} rev/j=${fmt(rev)} net/j=${fmt(net)} dette=${fmt(E.debt(s))} patri=${fmt(E.patrimoine(s))} obj=${s.obj}`);
    }
    if (s.over) { timeline.push('GAME OVER j' + d); break; }
  }
  const rivals = s.rivals.map(r => `${r.id}: cash=${fmt(r.cash)} st=${Object.values(s.stations).filter(x => x.owner === r.id).length}`);
  return { timeline, rivals, s };
}

for (const strat of ['hp', 'portique']) {
  console.log('=== stratégie', strat);
  const r = run(strat, 5);
  console.log(r.timeline.join('\n'));
  console.log(r.rivals.join(' | '));
  console.log('zones', r.s.zones.map(z => z.id + ':' + z.stage).join(' '));
  console.log('log extrait:', r.s.log.slice(0, 8).map(l => 'j' + l.d + ' ' + l.text).join('\n  '));
}
// station seule : rendement rural
const s = E.newGame(); E.borrow(s, 20000, 5); E.buyUnit(s, 'A', 'portique', 0);
E.advanceDays(s, 60);
const h = s.stations.A.hist.slice(-30);
console.log('Rural portique Éco : servis/j', (h.reduce((a, x) => a + x.served, 0) / 30).toFixed(1), 'rev/j', (h.reduce((a, x) => a + x.rev, 0) / 30).toFixed(0), 'perdus/j', (h.reduce((a, x) => a + x.lost, 0) / 30).toFixed(1), 'cost/j', (h.reduce((a, x) => a + x.cost, 0) / 30).toFixed(0));
