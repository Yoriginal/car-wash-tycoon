// Test d'interface : le jeu se lance, une partie 1.1 se charge intacte, et une nouvelle partie
// va de l'écran titre à la première vente sans erreur.  npm run test:ui
const { chromium } = require('playwright');
const { spawn, execSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '..');
const PORT = 8790;
const fixture = readFileSync(join(__dirname, 'fixtures/save-v1.1.json'), 'utf8');
const F = JSON.parse(fixture);

let failed = 0;
const ok = (c, m) => { if (c) console.log('  ✓ ' + m); else { console.error('  ✗ ' + m); failed++; } };

(async () => {
  if (!process.env.SKIP_BUILD) execSync('node scripts/build.mjs', { cwd: root, stdio: 'ignore' });
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '-d', join(root, 'dist')], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const browser = await chromium.launch();
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const url = `http://localhost:${PORT}/`;

    // 1. sauvegarde 1.1 existante
    let pg = await ctx.newPage();
    pg.on('pageerror', e => errors.push(String(e)));
    await pg.addInitScript(f => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('cwt-save-v3', f); sessionStorage.setItem('seeded', '1'); } }, fixture);
    await pg.goto(url); await pg.waitForTimeout(900);
    const st = await pg.evaluate(() => ({ d: __CWT.S.d, n: Object.values(__CWT.S.stations).filter(x => x.owner === 'player').length, units: __CWT.S.stations.C.units.length }));
    ok(st.d === F.d, `partie 1.1 rechargée au jour ${st.d}`);
    ok(st.n === 2 && st.units === F.stations.C.units.length, 'stations et équipements intacts');
    const raw = await pg.evaluate(() => JSON.parse(localStorage.getItem('cwt-save-v3')));
    ok(raw.v === F.v && JSON.stringify(Object.keys(raw).sort()) === JSON.stringify(Object.keys(F).sort()), 'format de sauvegarde inchangé');
    await pg.close();

    // 2. nouvelle partie : écran titre → première vente
    pg = await ctx.newPage();
    pg.on('pageerror', e => errors.push(String(e)));
    await pg.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); sessionStorage.setItem('seeded', '1'); } });
    await pg.goto(url); await pg.waitForTimeout(700);
    await pg.click('[data-test="start"]');
    await pg.waitForTimeout(300);
    await pg.click('[data-test="slot-free"]');
    await pg.waitForTimeout(300);
    if (await pg.$('[data-test="type-hp"]')) { await pg.click('[data-test="type-hp"]'); await pg.waitForTimeout(200); }
    await pg.click('[data-test="tier-0"]'); await pg.waitForTimeout(150);
    await pg.click('[data-test="buy-hp-0"]');
    await pg.waitForTimeout(300);
    const units = await pg.evaluate(() => __CWT.S.stations.A.units.length);
    ok(units === 1, 'premier équipement installé');
    await pg.click('[data-test="speed-10"]');
    await pg.waitForTimeout(5000);
    const rev = await pg.evaluate(() => __CWT.S.totals.rev);
    ok(rev > 0, `première vente encaissée (${Math.round(rev)} €)`);
    await pg.screenshot({ path: join(root, 'build/ui-smoke.png') });

    // 3. feuilles : prix au curseur, entretien, fiche équipement, fermeture en touchant le décor
    await pg.click('[data-test="tool-prix"]'); await pg.waitForTimeout(300);
    const d0 = await pg.evaluate(() => __CWT.S.d);
    await pg.$eval('[data-test="prix-hp"]', el => { el.value = '7.5'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await pg.waitForTimeout(600);
    const pr = await pg.evaluate(() => ({ p: __CWT.S.stations.A.prices.hp, d: __CWT.S.d }));
    ok(pr.p === 7.5, 'prix réglé au curseur');
    ok(pr.d === d0, 'temps en pause pendant la feuille');
    await pg.mouse.click(195, 40); await pg.waitForTimeout(300);
    ok(!(await pg.$('.sheet.feuille')), 'feuille fermée en touchant le décor');
    await pg.click('[data-test="tool-entretien"]'); await pg.waitForTimeout(300);
    await pg.click('[data-test="contrat-2"]'); await pg.waitForTimeout(200);
    ok(await pg.evaluate(() => __CWT.S.stations.A.contract === 2), 'contrat d\'entretien choisi');
    await pg.mouse.click(195, 40); await pg.waitForTimeout(300);
    await pg.click('[data-test="unit-0"]'); await pg.waitForTimeout(300);
    ok(!!(await pg.$('[data-test="revendre"]')), 'fiche équipement ouverte depuis le diorama');
    await pg.screenshot({ path: join(root, 'build/ui-smoke-fiche.png') });
  } catch (e) { console.error('  ✗ ' + e.message); failed++; }
  finally { await browser.close(); srv.kill(); }
  ok(errors.length === 0, 'aucune erreur JavaScript' + (errors.length ? ' : ' + errors.slice(0, 3).join(' | ') : ''));
  if (failed) process.exitCode = 1;
})();
