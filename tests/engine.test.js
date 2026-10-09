// Tests du moteur : lancés par `npm test` et par GitHub avant chaque mise en ligne.
// Si un test échoue, la version n'est PAS déployée.
const assert = require('node:assert/strict');
const E = require('../src/engine.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}
const roundtrip = s => JSON.parse(JSON.stringify(s));
function noNaN(obj, path = 'state') {
  if (typeof obj === 'number') assert.ok(Number.isFinite(obj), `${path} = ${obj}`);
  else if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) noNaN(v, `${path}.${k}`);
}
// petit joueur automatique : équipe, emprunte, achète
function bot(s, days) {
  for (let d = 0; d < days; d++) {
    E.advanceDays(s, 1);
    E.checkObjectives(s);
    if (d % 60 === 0) { const sec = s.sectors.find(x => !x.revealed); if (sec && s.cash > 15000) E.reveal(s, sec.id); }
    for (const st of Object.values(s.stations).filter(x => x.owner === 'player')) {
      if (!st.units.some(u => u.type === 'portique') && E.freeSlots(st) >= 2 && s.cash > 50000) E.buyUnit(s, st.lot, 'portique', 0);
      else if (E.freeSlots(st) >= 1 && s.cash > 20000 && (!st.units.length || st.hist.slice(-7).reduce((a, x) => a + x.lost, 0) > 15)) E.buyUnit(s, st.lot, 'hp', 0);
    }
    if (d % 15 === 0) {
      const c = s.lots.filter(l => !l.owner && s.sectors[E.sectorOfLot(l.id)].revealed)
        .map(l => ({ l, price: l.sale ? l.sale.price : E.lotPrice(s, l.id) }))
        .filter(c => c.price + 60000 < s.cash + E.creditLimit(s) * 0.6)[0];
      if (c) { const need = c.price + 50000 - s.cash; if (need > 0) E.borrow(s, Math.min(need, E.creditLimit(s)), 7); if (s.cash >= c.price) E.buyLot(s, c.l.id); }
    }
    if (s.over) break;
  }
}

console.log('Moteur');
test('nouvelle partie valide', () => {
  const s = E.newGame();
  assert.equal(s.v, E.SAVE_VERSION);
  assert.equal(s.stations.A.owner, 'player');
  assert.ok(s.cash > 0);
  noNaN(s);
});
test('une journée sans équipement ne plante pas', () => {
  const s = E.newGame(); E.advanceDays(s, 3); noNaN(s);
});
test('acheter un équipement débite la trésorerie', () => {
  const s = E.newGame(); const c = s.cash;
  assert.ok(E.buyUnit(s, 'A', 'hp', 0).ok);
  assert.equal(s.cash, c - E.EQUIP.hp.tiers[0].price);
});
test('pas d\'achat au-delà des emplacements', () => {
  const s = E.newGame(); s.cash = 1e6;
  assert.ok(E.buyUnit(s, 'A', 'portique', 0).ok);
  assert.equal(E.buyUnit(s, 'A', 'hp', 0).ok, false);
});
test('une station équipée encaisse du chiffre d\'affaires', () => {
  const s = E.newGame(); E.buyUnit(s, 'A', 'hp', 0); E.buyUnit(s, 'A', 'hp', 0);
  E.advanceDays(s, 30);
  assert.ok(s.totals.rev > 500, 'CA 30 j = ' + s.totals.rev);
});
test('prêt : mensualités cohérentes', () => {
  const s = E.newGame();
  const r = E.borrow(s, 20000, 5);
  assert.ok(r.ok);
  assert.ok(r.loan.monthly > 20000 / 60 && r.loan.monthly < 20000 / 60 * 1.3);
});

console.log('Simulation longue (5 ans, 5 parties)');
test('5 ans de jeu automatique sans erreur ni NaN', () => {
  for (let i = 0; i < 5; i++) {
    const s = E.newGame(); E.borrow(s, 20000, 5); E.buyUnit(s, 'A', 'portique', 0);
    bot(s, 365 * 5);
    noNaN(s);
    assert.ok(s.d >= 1, 'jours écoulés');
  }
});
test('équilibre : un joueur raisonnable progresse', () => {
  let ok = 0;
  for (let i = 0; i < 5; i++) {
    const s = E.newGame(); E.borrow(s, 20000, 5); E.buyUnit(s, 'A', 'portique', 0);
    bot(s, 365 * 3);
    const mine = Object.values(s.stations).filter(x => x.owner === 'player').length;
    if (!s.over && mine >= 2) ok++;
  }
  assert.ok(ok >= 3, `seulement ${ok}/5 parties progressent`);
});

console.log('Sauvegardes');
test('sauvegarde → JSON → rechargement identique', () => {
  const s = E.newGame(); E.buyUnit(s, 'A', 'hp', 0); E.advanceDays(s, 20);
  const back = E.migrate(roundtrip(s));
  assert.ok(back);
  assert.deepEqual(back.stations.A.units, s.stations.A.units);
  assert.equal(back.d, s.d);
  E.advanceDays(back, 10); noNaN(back);
});
test('sauvegarde illisible refusée sans planter', () => {
  assert.equal(E.migrate(null), null);
  assert.equal(E.migrate({}), null);
  assert.equal(E.migrate({ v: E.SAVE_VERSION + 1, stations: {} }), null);
});
test('sauvegarde incomplète réparée', () => {
  const s = roundtrip(E.newGame()); delete s.offers; delete s.today; delete s.events;
  const back = E.migrate(s);
  assert.ok(back && Array.isArray(back.offers) && back.today);
  E.advanceDays(back, 5); noNaN(back);
});
test('chaque ancien format de sauvegarde a une migration', () => {
  // si SAVE_VERSION augmente, une étape MIGRATIONS[n] doit exister pour chaque n de 3 à SAVE_VERSION-1
  for (let v = 3; v < E.SAVE_VERSION; v++) {
    const s = roundtrip(E.newGame()); s.v = v;
    assert.ok(E.migrate(s), `pas de migration depuis le format ${v}`);
  }
});

console.log(`\n${passed} tests OK` + (process.exitCode ? ' — ÉCHECS ci-dessus' : ''));
