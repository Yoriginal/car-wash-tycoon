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

console.log('Version 3 (moteur)');
const fs = require('node:fs');
const fixture = () => JSON.parse(fs.readFileSync(require('node:path').join(__dirname, 'fixtures/save-v1.1.json'), 'utf8'));
test('carte en villes : 3 à 6 terrains par ville, identifiants existants conservés', () => {
  for (const sc of E.SECTORS) {
    const n = E.LOTS.filter(l => E.sectorOfLot(l.id) === sc.id).length;
    assert.ok(n >= 3 && n <= 6, `${sc.name} : ${n} terrains`);
  }
  for (const id of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']) assert.ok(E.lotDef(id), 'terrain ' + id);
  // aucun terrain ne se chevauche dans sa ville
  for (const a of E.LOTS) for (const b of E.LOTS) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 35, `${a.id}/${b.id} trop proches`);
});
test('partie 1.1 migrée : stations, trésorerie et jour intacts, nouveaux terrains libres', () => {
  const old = fixture();
  const s = E.migrate(fixture());
  assert.ok(s);
  assert.equal(s.v, E.SAVE_VERSION);
  assert.equal(s.d, old.d); assert.equal(s.cash, old.cash);
  assert.deepEqual(Object.keys(s.stations).sort(), Object.keys(old.stations).sort());
  for (const k of Object.keys(old.stations)) assert.deepEqual(s.stations[k].units, old.stations[k].units);
  assert.equal(s.lots.length, E.LOTS.length);
  assert.ok(s.lots.filter(l => !old.lots.some(o => o.id === l.id)).every(l => !l.owner));
  E.advanceDays(s, 30); noNaN(s);
});
test('historique annuel reconstitué à la migration (CA total conservé)', () => {
  const old = fixture();
  const s = E.migrate(fixture());
  const tot = Object.values(s.years).reduce((a, y) => a + y.rev.reduce((b, x) => b + x, 0), 0);
  assert.ok(Math.abs(tot - old.totals.rev) < 50, `CA annuel ${tot} vs total ${old.totals.rev}`);
});
test('historique annuel : un an de jeu passe à l\'année suivante', () => {
  const s = E.newGame(); E.buyUnit(s, 'A', 'hp', 0); E.buyUnit(s, 'A', 'hp', 0);
  E.advanceDays(s, 400);
  const ys = Object.keys(s.years).sort();
  assert.deepEqual(ys, ['2027', '2028']);
  const sum = ys.reduce((a, y) => a + s.years[y].rev.reduce((b, x) => b + x, 0), 0);
  assert.ok(Math.abs(sum - s.totals.rev) < 400 * 2, `années ${sum} vs total ${s.totals.rev}`);
  assert.ok(s.stations.A.years['2027'].served > 0);
});
test('clients découragés comptés quand la file sature ou que le prix est haut', () => {
  const s = E.newGame(); E.buyUnit(s, 'A', 'hp', 0);
  s.zones.find(z => z.id === 'bruyeres').stage = 4;     // très forte demande pour une seule piste
  E.advanceDays(s, 20);
  const h = s.stations.A.hist.slice(-10);
  assert.ok(h.reduce((a, x) => a + x.deter, 0) > 0, 'découragés par la file');
  const s2 = E.newGame(); E.buyUnit(s2, 'A', 'hp', 0); s2.stations.A.prices.hp = 15;
  E.advanceDays(s2, 20);
  assert.ok(s2.stations.A.hist.slice(-10).reduce((a, x) => a + x.cher, 0) > 0, 'découragés par le prix');
  const s3 = E.newGame(); E.buyUnit(s3, 'A', 'hp', 0); s3.stations.A.prices.hp = 1;
  E.advanceDays(s3, 10);
  assert.equal(s3.stations.A.hist.reduce((a, x) => a + x.cher, 0), 0, 'aucun découragé par le prix sous la référence');
});
test('nommer sa station : gardé dans la sauvegarde', () => {
  const s = E.newGame();
  assert.ok(E.renameStation(s, 'A', '  Chez   Yoann  ').ok);
  const back = E.migrate(roundtrip(s));
  assert.equal(back.stations.A.name, 'Chez Yoann');
  assert.equal(E.stationName(back, 'A'), 'Chez Yoann');
  assert.equal(E.renameStation(s, 'G', 'X').ok, false, 'pas de renommage chez un rival');
});

test('absence : les stations tournent vraiment, proportionnellement au temps, avec un plafond', () => {
  const mk = () => { const s = E.newGame(); E.buyUnit(s, 'A', 'hp', 0); E.buyUnit(s, 'A', 'hp', 0); E.advanceDays(s, 30); return s; };
  const now = Date.now();
  const s1 = mk(); s1.lastSeen = now - 10 * 60000;              // 10 min : rien
  assert.equal(E.offline(s1, now), null);
  const s2 = mk(); const d2 = s2.d; s2.lastSeen = now - 24 * 3600000;
  const r2 = E.offline(s2, now);
  assert.equal(r2.days, Math.min(E.OFFLINE_MAX_DAYS, 24 * E.OFFLINE_DAYS_PER_HOUR));
  assert.equal(s2.d, d2 + r2.days);
  assert.ok(r2.rev > 0 && r2.served > 0, 'CA et lavages pendant l\'absence');
  const s3 = mk(); s3.lastSeen = now - 30 * 24 * 3600000;       // un mois : plafonné
  assert.equal(E.offline(s3, now).days, E.OFFLINE_MAX_DAYS);
  const s4 = mk(); s4.mode = 'turn'; s4.lastSeen = now - 24 * 3600000;
  assert.equal(E.offline(s4, now), null, 'le tour par tour attend le joueur');
  noNaN(s2);
});

console.log('Satisfaction et prix par gamme');
test('prix de référence selon la gamme : portique 8/10/12 €, piste HP 4/5/6 € (avant palier)', () => {
  assert.deepEqual(E.EQUIP.portique.tiers.map(t => t.ref), [8, 10, 12]);
  assert.deepEqual(E.EQUIP.hp.tiers.map(t => t.ref), [4, 5, 6]);
  const s = E.newGame(); s.cash = 1e6;
  E.buyUnit(s, 'A', 'hp', 2);
  assert.equal(E.refPrice(s, 'A', 'hp'), Math.round(6 * E.STAGES[0].ref * 2) / 2);
  assert.equal(s.stations.A.prices.hp, E.refPrice(s, 'A', 'hp'), 'premier équipement : prix au prix habituel de sa gamme');
});
test('migration : les prix gardent le même écart à la référence', () => {
  const old = fixture();
  const s = E.migrate(fixture());
  const st = s.stations.C, o = old.stations.C;
  const tier = Math.max(...st.units.filter(u => u.type === 'hp').map(u => u.tier));
  assert.equal(st.prices.hp, Math.round(o.prices.hp * E.EQUIP.hp.tiers[tier].ref / 5 * 2) / 2);
});
test('satisfaction : note sur 5, baisse avec un prix abusif et des pannes, pèse sur l\'attractivité', () => {
  const run = f => { const s = E.newGame(); s.cash = 1e6; E.buyUnit(s, 'A', 'hp', 1); E.buyUnit(s, 'A', 'hp', 1); f(s); E.advanceDays(s, 60); return s.stations.A; };
  const bien = run(() => {});
  const cher = run(s => { s.stations.A.prices.hp = 12; });
  const panne = run(s => { s.stations.A.contract = 0; for (let d = 0; d < 60; d++) s.stations.A.units[0].down = 999; });
  assert.ok(bien.note >= 1 && bien.note <= 5, 'note ' + bien.note);
  assert.ok(cher.avis.prix < bien.avis.prix - 1, `prix ${cher.avis.prix} vs ${bien.avis.prix}`);
  assert.ok(cher.note < bien.note, 'la note baisse avec un prix abusif');
  assert.ok(panne.avis.pannes < bien.avis.pannes, `pannes ${panne.avis.pannes} vs ${bien.avis.pannes}`);
  assert.ok(E.reputation({ note: 4.5 }) > 1 && E.reputation({ note: 2 }) < 1);
  const s = E.migrate(roundtrip(E.newGame())); assert.equal(s.stations.A.note, null);
});

test('étude : le potentiel reste après l\'achat et se renouvelle', () => {
  const s = E.newGame(); s.cash = 1e6;
  assert.ok(E.study(s, 'B').ok);
  const e1 = E.lotState(s, 'B').etude;
  assert.ok(e1 && e1.dem > 0 && e1.d === s.d);
  assert.ok(E.buyLot(s, 'B').ok);
  assert.deepEqual(E.lotState(s, 'B').etude, e1, 'toujours là après l\'achat');
  E.advanceDays(s, 40); s.zones.find(z => z.id === 'croix').stage = 2;
  assert.ok(E.study(s, 'B').ok, 'nouvelle étude possible');
  const e2 = E.lotState(s, 'B').etude;
  assert.ok(e2.d > e1.d && e2.stage === 2 && e2.dem > e1.dem);
});

console.log(`\n${passed} tests OK` + (process.exitCode ? ' — ÉCHECS ci-dessus' : ''));
