/* ============================================================
   CAR WASH TYCOON — moteur de simulation (pur, sans DOM)
   Valeurs fictives, à calibrer.
   ============================================================ */
const E = (() => {
  // ---------- versions ----------
  // GAME_VERSION : affichée au joueur, à incrémenter à chaque release (voir CHANGELOG.md)
  // SAVE_VERSION : format de sauvegarde. Toute modification de la structure de l'état
  // doit l'incrémenter ET ajouter une étape dans MIGRATIONS (jamais casser une partie).
  const GAME_VERSION = '1.1.0';
  const SAVE_VERSION = 3;
  const MIGRATIONS = {
    // n: state => { ...transforme un état au format n vers n+1... }
    // exemple : 3: st => { st.nouveauChamp = st.nouveauChamp ?? valeurParDefaut; },
  };

  const DAY_SEC = 20;               // 1 jour de jeu = 20 s en x1
  const OPEN = 7, CLOSE = 22;       // heures d'ouverture
  const HOUR_W = [3, 5, 7, 9, 10, 8, 6, 6, 7, 9, 10, 9, 6, 3, 2]; // 7h..21h, somme 100
  const DOW = [1.3, 0.85, 0.8, 0.9, 0.95, 1.15, 1.6];          // dim..sam
  const START = Date.UTC(2027, 2, 1); // 1er mars 2027
  const A0 = 0.5;                    // option « ailleurs / à la maison »

  const EQUIP = {
    portique: {
      name: 'Portique', slots: 2, share: 0.6, ref: 10, varCost: 1.4, chem: 0.6, repair: 900,
      tiers: [
        { n: 'Éco', price: 45000, cap: 7, attr: 1.0, fail: 5, life: 8 },
        { n: 'Pro', price: 75000, cap: 8, attr: 1.2, fail: 3, life: 12 },
        { n: 'Premium', price: 120000, cap: 9, attr: 1.4, fail: 1.5, life: 15 }
      ]
    },
    hp: {
      name: 'Piste HP', slots: 1, share: 0.4, ref: 5, varCost: 0.5, chem: 0.25, repair: 300,
      tiers: [
        { n: 'Éco', price: 9000, cap: 5, attr: 1.0, fail: 4, life: 8 },
        { n: 'Pro', price: 15000, cap: 5, attr: 1.2, fail: 2.5, life: 12 },
        { n: 'Premium', price: 24000, cap: 6, attr: 1.4, fail: 1.5, life: 15 }
      ]
    }
  };
  const TYPES = ['portique', 'hp'];

  const CONTRACTS = [
    { n: 'Aucun', delay: 5, perUnitDay: 0, repairMul: 1, desc: 'Intervention à la demande, facturée' },
    { n: 'Essentiel', delay: 3, perUnitDay: 1.5, repairMul: 0.5, desc: 'Pièces facturées' },
    { n: 'Confort', delay: 2, perUnitDay: 3, repairMul: 0, desc: 'Tout inclus' },
    { n: 'Premium', delay: 1, perUnitDay: 5, repairMul: 0, desc: 'Tout inclus, 24 h' }
  ];

  const STAGES = [
    { n: 'Rural', dem: 1, price: 1, ref: 0.85 },
    { n: "Magasin d'ancrage", dem: 1.8, price: 1.8, ref: 0.92 },
    { n: "Zone d'activité", dem: 3, price: 3, ref: 1.0 },
    { n: 'Zone commerciale', dem: 5, price: 6, ref: 1.1 },
    { n: 'Pôle péri-urbain', dem: 8, price: 12, ref: 1.2 }
  ];

  const CHEM = [{ n: 'Standard', attr: 1 }, { n: 'Premium', attr: 1.15 }];
  const FIXED_DAY = 12, PER_UNIT_DAY = 4, STAFF_DAY = 75, OVERDRAFT = 15000;
  const RECON_COST = 2000, STUDY_COST = 3000, START_CASH = 40000;
  const STAFF_BONUS = [0, 0.20, 0.15, 0.10];

  const SECTORS = [
    { id: 0, name: 'Les Bruyères', x: 0, y: 266, w: 150, h: 134 },
    { id: 1, name: 'Côte du Phare', x: 150, y: 266, w: 150, h: 134 },
    { id: 2, name: 'Vallée du Morin', x: 0, y: 133, w: 150, h: 133 },
    { id: 3, name: 'Plateau du Moulin', x: 150, y: 133, w: 150, h: 133 },
    { id: 4, name: 'Pays de Kerval', x: 0, y: 0, w: 150, h: 133 },
    { id: 5, name: 'Vaucelles', x: 150, y: 0, w: 150, h: 133 }
  ];

  // zones : base = clients/jour au stade rural ; growth/decline = proba par mois de lancer un changement
  const ZONES = [
    { id: 'bruyeres', name: 'Les Bruyères', sector: 0, x: 62, y: 330, base: 45, stage: 0, min: 0, max: 1, growth: 0.06, decline: 0 },
    { id: 'croix', name: 'La Croix-Verte', sector: 0, x: 108, y: 292, base: 40, stage: 0, min: 0, max: 0, growth: 0, decline: 0 },
    { id: 'gildas', name: 'Saint-Gildas', sector: 1, x: 196, y: 300, base: 36, stage: 0, min: 0, max: 2, growth: 0.2, decline: 0 },
    { id: 'plages', name: 'Route des Plages', sector: 1, x: 252, y: 360, base: 44, stage: 0, min: 0, max: 1, growth: 0.04, decline: 0, seasonal: true },
    { id: 'pont', name: 'Pont-Morin', sector: 2, x: 70, y: 200, base: 40, stage: 1, min: 0, max: 2, growth: 0.14, decline: 0.05 },
    { id: 'moulin', name: 'ZA du Moulin', sector: 3, x: 220, y: 196, base: 40, stage: 1, min: 1, max: 3, growth: 0.45, decline: 0.02 },
    { id: 'kerval', name: 'Kerval', sector: 4, x: 70, y: 62, base: 42, stage: 3, min: 2, max: 3, growth: 0, decline: 0.08 },
    { id: 'porte', name: 'Porte de Vaucelles', sector: 5, x: 226, y: 60, base: 50, stage: 4, min: 3, max: 4, growth: 0, decline: 0.02 }
  ];

  const LOTS = [
    { id: 'A', name: 'Terrain des Bruyères', zone: 'bruyeres', x: 52, y: 346, slots: 2, q: 4, loc: 1.0 },
    { id: 'B', name: 'Carrefour de la Croix-Verte', zone: 'croix', x: 116, y: 310, slots: 5, q: 10, loc: 1.1 },
    { id: 'K', name: 'Saint-Gildas, route de la gare', zone: 'gildas', x: 186, y: 318, slots: 3, q: 6, loc: 1.0 },
    { id: 'L', name: 'Aire du Phare', zone: 'plages', x: 262, y: 378, slots: 4, q: 8, loc: 1.0 },
    { id: 'C', name: 'Pont-Morin, sortie de bourg', zone: 'pont', x: 54, y: 216, slots: 3, q: 6, loc: 1.0 },
    { id: 'D', name: 'Pont-Morin, place du marché', zone: 'pont', x: 98, y: 206, slots: 2, q: 4, loc: 1.2 },
    { id: 'E', name: 'ZA du Moulin, parking du Super', zone: 'moulin', x: 248, y: 204, slots: 4, q: 8, loc: 1.2 },
    { id: 'F', name: 'ZA du Moulin, lot 7', zone: 'moulin', x: 200, y: 222, slots: 6, q: 12, loc: 0.9 },
    { id: 'G', name: 'Kerval, galerie marchande', zone: 'kerval', x: 40, y: 66, slots: 4, q: 8, loc: 1.1 },
    { id: 'H', name: 'Kerval, rond-point Nord', zone: 'kerval', x: 96, y: 84, slots: 6, q: 12, loc: 1.0 },
    { id: 'M', name: 'Kerval, ZI des Landes', zone: 'kerval', x: 30, y: 112, slots: 8, q: 16, loc: 0.8 },
    { id: 'I', name: 'Porte de Vaucelles, rocade', zone: 'porte', x: 266, y: 74, slots: 8, q: 20, loc: 1.25 },
    { id: 'J', name: 'Porte de Vaucelles, Drive', zone: 'porte', x: 204, y: 92, slots: 5, q: 10, loc: 1.0 }
  ];

  const RIVALS = [
    { id: 'disc', name: 'Discount Wash', short: 'DW', profile: 'discounter', color: '#ff8a3d', cash: 40000 },
    { id: 'splash', name: 'Splash & Co', short: 'S&', profile: 'speculateur', color: '#b98cff', cash: 80000 }
  ];

  const SIGNALS_UP = [
    'Permis de construire affiché',
    'Rond-point en travaux',
    "Rumeur : une enseigne de Drive arrive",
    'Panneau « Ici bientôt votre hypermarché »',
    'Lotissement de 120 maisons en chantier'
  ];
  const SIGNALS_DOWN = [
    "Rumeur : le magasin d'ancrage pourrait fermer",
    'Projet de déviation de la rocade',
    'Cellules commerciales à louer'
  ];

  // ---------- utilitaires ----------
  const rnd = Math.random;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = a => a[Math.floor(rnd() * a.length)];
  function poisson(l) {
    if (l <= 0) return 0;
    if (l > 30) return Math.max(0, Math.round(l + Math.sqrt(l) * gauss()));
    let L = Math.exp(-l), k = 0, p = 1;
    do { k++; p *= rnd(); } while (p > L);
    return k - 1;
  }
  function gauss() { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const r100 = v => Math.round(v / 100) * 100;
  const r1000 = v => Math.round(v / 1000) * 1000;

  function dateOf(day) { return new Date(START + Math.floor(day) * 86400000); }
  function seasonOf(day) {
    const m = dateOf(day).getUTCMonth();
    if (m >= 2 && m <= 4) return 'printemps';
    if (m >= 5 && m <= 7) return 'été';
    if (m >= 8 && m <= 10) return 'automne';
    return 'hiver';
  }
  const SEASON_F = { printemps: 1.05, 'été': 1.0, automne: 0.9, hiver: 0.95 };
  const WEATHER = {
    sun: { n: 'Soleil', f: 1.15 },
    cloud: { n: 'Nuageux', f: 0.95 },
    rain: { n: 'Pluie', f: 0.25 },
    snow: { n: 'Neige', f: 0.3 }
  };
  const W_PROB = { // [sun, cloud, rain, snow]
    printemps: [0.38, 0.32, 0.30, 0],
    'été': [0.58, 0.27, 0.15, 0],
    automne: [0.25, 0.35, 0.40, 0],
    hiver: [0.24, 0.40, 0.30, 0.06]
  };

  // ---------- nouvelle partie ----------
  function newGame() {
    const s = {
      v: SAVE_VERSION, day: 0, d: 0, h: 0, acc: 0, cash: START_CASH, speed: 1, mode: 'realtime',
      sectors: SECTORS.map(x => ({ id: x.id, revealed: x.id === 0 })),
      zones: ZONES.map(z => ({ id: z.id, stage: z.stage, pending: null })),
      lots: LOTS.map(l => ({ id: l.id, owner: null, studied: false, sale: null })),
      stations: {},
      staff: [], loans: [], offers: [],
      rivals: RIVALS.map(r => ({ id: r.id, cash: r.cash, bankrupt: false })),
      weather: { today: 'sun', yesterday: 'cloud' },
      events: [],               // {kind, zone|null, until, f}
      log: [], hist: [],         // hist: {d, cash, rev, cost}
      today: { rev: 0, cost: 0, capex: 0, fin: 0 },
      totals: { rev: 0, served: 0 },
      obj: 0, nextId: 1, overdraftDays: 0, over: false,
      lastSeen: Date.now(), created: Date.now(), seenIntro: false
    };
    s.lots.find(l => l.id === 'A').owner = 'player';
    s.stations.A = newStation(s, 'A', 'player');
    // rivaux déjà en place
    const g = s.lots.find(l => l.id === 'G'); g.owner = 'disc';
    s.stations.G = newStation(s, 'G', 'disc');
    s.stations.G.units = [unit('hp', 0), unit('hp', 0), unit('portique', 0)];
    s.stations.G.prices = { portique: 8.5, hp: 4 };
    const j = s.lots.find(l => l.id === 'J'); j.owner = 'splash';
    s.stations.J = newStation(s, 'J', 'splash');
    s.stations.J.units = [unit('portique', 1), unit('hp', 1), unit('hp', 1)];
    s.stations.J.contract = 2;
    s.stations.J.prices = { portique: 12, hp: 6 };
    s.stations.A.prices = defaultPrices(s, 'A');
    log(s, "Bienvenue aux Bruyères. Ton terrain vague t'attend : installe un premier équipement.", 'info');
    return s;
  }
  function unit(type, tier) { return { type, tier, age: 0, down: 0 }; }
  function newStation(s, lotId, owner) {
    return {
      lot: lotId, owner, units: [], chem: 0, contract: 0,
      prices: defaultPrices(s, lotId), staff: null,
      q: { portique: 0, hp: 0 }, cur: { served: { portique: 0, hp: 0 }, cap: { portique: 0, hp: 0 } },
      day: { served: 0, lost: 0, rev: 0, cost: 0, arr: 0 },
      hist: [], since: s.day
    };
  }

  // ---------- accès ----------
  const lotDef = id => LOTS.find(l => l.id === id);
  const zoneDef = id => ZONES.find(z => z.id === id);
  const zoneOf = (s, lotId) => s.zones.find(z => z.id === lotDef(lotId).zone);
  const lotState = (s, id) => s.lots.find(l => l.id === id);
  const sectorOfLot = lotId => zoneDef(lotDef(lotId).zone).sector;

  function refPrice(s, lotId, type) {
    const z = zoneOf(s, lotId);
    return Math.round(EQUIP[type].ref * STAGES[z.stage].ref * 2) / 2;
  }
  function defaultPrices(s, lotId) { return { portique: refPrice(s, lotId, 'portique'), hp: refPrice(s, lotId, 'hp') }; }

  function lotPrice(s, lotId) {
    const d = lotDef(lotId), z = zoneOf(s, lotId);
    return r1000((12000 + 5000 * d.slots) * STAGES[z.stage].price * (1 + (d.loc - 1) * 1.5));
  }
  function unitResale(u) {
    const t = EQUIP[u.type].tiers[u.tier];
    const left = Math.max(0, 1 - u.age / (t.life * 365));
    return r100(t.price * 0.45 * left);
  }
  function stationValue(s, lotId) {
    const st = s.stations[lotId];
    return lotPrice(s, lotId) + (st ? st.units.reduce((a, u) => a + unitResale(u), 0) : 0);
  }
  function slotsOf(st) { return lotDef(st.lot).slots + (st.extraSlots || 0); }
  function qmaxOf(st) { return lotDef(st.lot).q + (st.extraQ || 0); }
  function usedSlots(st) { return st.units.reduce((a, u) => a + EQUIP[u.type].slots, 0); }
  function freeSlots(st) { return slotsOf(st) - usedSlots(st); }
  function zoneDemand(s, zoneId, day) {
    const zd = zoneDef(zoneId), z = s.zones.find(x => x.id === zoneId);
    let d = zd.base * STAGES[z.stage].dem;
    if (zd.seasonal) {
      const se = seasonOf(day);
      d *= se === 'été' ? 1.9 : se === 'hiver' ? 0.45 : 1;
    }
    return d;
  }
  function priceFactor(price, ref) { return clamp(Math.pow(ref / Math.max(0.5, price), 1.5), 0, 1.5); }

  // attractivité d'une station (avant pénalité de file)
  function attract(s, st) {
    const d = lotDef(st.lot);
    let a = 0;
    for (const t of TYPES) {
      const us = st.units.filter(u => u.type === t);
      if (!us.length) continue;
      const best = Math.max(...us.map(u => EQUIP[t].tiers[u.tier].attr));
      a += EQUIP[t].share * best * priceFactor(st.prices[t], refPrice(s, st.lot, t));
    }
    return a * CHEM[st.chem].attr * d.loc;
  }
  function staffBonus(s, st) {
    if (!st.staff) return 0;
    const e = s.staff.find(x => x.id === st.staff);
    if (!e) return 0;
    return STAFF_BONUS[Math.min(3, e.stations.length)] || 0;
  }

  // ---------- multiplicateurs de demande du jour ----------
  function dayMult(s, zoneId) {
    const day = s.day;
    let f = SEASON_F[seasonOf(day)];
    const w = s.weather;
    f *= WEATHER[w.today].f;
    if (w.today === 'sun' && (w.yesterday === 'rain' || w.yesterday === 'snow')) f *= 1.4;
    f *= DOW[dateOf(day).getUTCDay()];
    for (const ev of s.events) if (!ev.zone || ev.zone === zoneId) f *= ev.f;
    return f;
  }

  // ---------- simulation d'une heure ----------
  function simHour(s, hour) {
    const idx = hour - OPEN;
    const open = idx >= 0 && idx < HOUR_W.length;
    const stations = Object.values(s.stations);
    // par zone : partage de la demande (modèle gravitaire)
    const byZone = {};
    for (const st of stations) {
      const z = lotDef(st.lot).zone;
      (byZone[z] = byZone[z] || []).push(st);
    }
    for (const st of stations) {
      st.cur = { served: { portique: 0, hp: 0 }, cap: { portique: 0, hp: 0 } };
      // réparations / temps d'arrêt
      for (const u of st.units) if (u.down > 0) u.down = Math.max(0, u.down - 1);
    }
    if (!open) {
      if (hour === CLOSE) for (const st of stations) { st.q.portique = 0; st.q.hp = 0; }
      return;
    }
    for (const zId in byZone) {
      const list = byZone[zId];
      const demand = zoneDemand(s, zId, s.day) * dayMult(s, zId) * HOUR_W[idx] / 100;
      const atts = list.map(st => {
        const fill = (st.q.portique + st.q.hp) / Math.max(1, qmaxOf(st));
        const working = st.units.some(u => u.down === 0);
        return working ? attract(s, st) * (1 - 0.5 * clamp(fill, 0, 1)) : 0;
      });
      const sum = atts.reduce((a, b) => a + b, 0) + A0;
      list.forEach((st, i) => {
        if (!atts[i]) return;
        const lambda = demand * atts[i] / sum;
        const arrivals = poisson(lambda);
        st.day.arr += arrivals;
        // répartition par type
        const w = {};
        let ws = 0;
        for (const t of TYPES) {
          const us = st.units.filter(u => u.type === t && u.down === 0);
          if (!us.length) { w[t] = 0; continue; }
          const best = Math.max(...us.map(u => EQUIP[t].tiers[u.tier].attr));
          w[t] = EQUIP[t].share * best * priceFactor(st.prices[t], refPrice(s, st.lot, t));
          ws += w[t];
        }
        const qmax = qmaxOf(st);
        let lost = 0;
        for (const t of TYPES) {
          if (!w[t]) continue;
          let a = Math.round(arrivals * w[t] / ws);
          // renoncement si la file est longue
          const fill = (st.q.portique + st.q.hp) / qmax;
          if (fill > 0.7) { const b = Math.round(a * 0.3); a -= b; lost += b; }
          st.q[t] += a;
        }
        // capacité
        for (const t of TYPES) {
          const cap = st.units.filter(u => u.type === t && u.down === 0).reduce((a, u) => a + EQUIP[t].tiers[u.tier].cap, 0);
          st.cur.cap[t] = cap;
          const served = Math.min(st.q[t], cap);
          st.q[t] -= served;
          st.cur.served[t] = served;
          const price = st.prices[t];
          const rev = served * price * (1 + staffBonus(s, st));
          const cost = served * (EQUIP[t].varCost + (st.chem ? EQUIP[t].chem : 0));
          st.day.served += served; st.day.rev += rev; st.day.cost += cost;
          money(s, st.owner, rev - cost, rev, cost);
        }
        // débordement de file
        const tot = st.q.portique + st.q.hp;
        if (tot > qmax) {
          const over = tot - qmax;
          const fp = st.q.portique / tot;
          const dp = Math.round(over * fp);
          st.q.portique -= dp; st.q.hp -= (over - dp);
          lost += over;
        }
        st.day.lost += lost;
      });
    }
  }

  function money(s, owner, net, rev, cost) {
    if (owner === 'player') {
      s.cash += net; s.today.rev += rev || 0; s.today.cost += cost || 0;
      if (rev) s.totals.rev += rev;
    } else {
      const r = s.rivals.find(x => x.id === owner);
      if (r) r.cash += net;
    }
  }

  // ---------- fin de journée ----------
  function endOfDay(s) {
    const out = [];
    // coûts fixes, contrats
    for (const st of Object.values(s.stations)) {
      let c = FIXED_DAY + PER_UNIT_DAY * st.units.length;
      c += st.units.reduce((a, u) => a + CONTRACTS[st.contract].perUnitDay * EQUIP[u.type].slots, 0);
      st.day.cost += c;
      money(s, st.owner, -c, 0, c);
      st.hist.push({ rev: Math.round(st.day.rev), served: st.day.served, lost: st.day.lost, cost: Math.round(st.day.cost) });
      if (st.hist.length > 60) st.hist.shift();
      st.day = { served: 0, lost: 0, rev: 0, cost: 0, arr: 0 };
      // vieillissement et pannes
      for (const u of st.units) {
        u.age += 1;
        const t = EQUIP[u.type].tiers[u.tier];
        const lifeDays = t.life * 365;
        let p = t.fail / 365;
        if (u.age > lifeDays * 0.7) p *= 1 + 2 * (u.age - lifeDays * 0.7) / (lifeDays * 0.3);
        if (u.age > lifeDays) p *= 2;
        if (s.weather.today === 'snow') p *= 2;
        if (u.down === 0 && rnd() < p) {
          const ct = CONTRACTS[st.contract];
          u.down = ct.delay * 24;
          const bill = r100(EQUIP[u.type].repair * ct.repairMul * (0.7 + rnd() * 0.6));
          if (bill) { money(s, st.owner, -bill, 0, bill); }
          if (st.owner === 'player') log(s, `Panne : ${EQUIP[u.type].name} ${t.n} à ${lotDef(st.lot).name}. Intervention sous ${ct.delay} j${bill ? ` (${fmt(bill)})` : ''}.`, 'bad');
        }
        if (st.owner === 'player' && u.age === Math.round(lifeDays * 0.9)) log(s, `${EQUIP[u.type].name} ${t.n} de ${lotDef(st.lot).name} arrive en fin de vie : pense à le remplacer.`, 'bad');
      }
      // incident : monnayeur bloqué
      if (st.owner === 'player' && st.units.length && rnd() < 0.003) {
        const u = pick(st.units);
        if (u.down === 0) { u.down = 12; log(s, `Monnayeur bloqué sur un ${EQUIP[u.type].name.toLowerCase()} à ${lotDef(st.lot).name} (12 h d'arrêt).`, 'bad'); }
      }
    }
    // salaires
    for (const e of s.staff) { s.cash -= STAFF_DAY; s.today.cost += STAFF_DAY; }
    // historique joueur
    s.hist.push({ d: Math.floor(s.day), cash: Math.round(s.cash), rev: Math.round(s.today.rev), cost: Math.round(s.today.cost), capex: Math.round(s.today.capex), fin: Math.round(s.today.fin) });
    if (s.hist.length > 120) s.hist.shift();
    s.today = { rev: 0, cost: 0, capex: 0, fin: 0 };

    const day = Math.floor(s.day) + 1; // jour qui commence
    // mensuel
    if (day % 30 === 0) monthly(s);
    if (day % 10 === 0) rivalsAct(s);
    // découvert
    if (s.cash < -OVERDRAFT) {
      s.overdraftDays++;
      if (s.overdraftDays === 1) log(s, `Alerte de la banque : tu dépasses ton découvert autorisé de ${fmt(OVERDRAFT)}. Sous 90 jours, une station sera vendue.`, 'bad');
      if (s.overdraftDays >= 90) forcedSale(s);
    } else if (s.cash < 0) {
      s.cash -= Math.round(-s.cash * 0.01 / 30); // agios
      s.overdraftDays = 0;
    } else s.overdraftDays = 0;
    // offres expirées
    s.offers = s.offers.filter(o => o.until > day);
    // événements expirés
    s.events = s.events.filter(e => e.until > day);
    nextWeather(s, day);
    seasonalEvents(s, day);
    return out;
  }

  function nextWeather(s, day) {
    const se = seasonOf(day);
    const p = W_PROB[se];
    // persistance : 45 % de chances de garder le temps de la veille
    let w;
    if (rnd() < 0.45 && p[['sun', 'cloud', 'rain', 'snow'].indexOf(s.weather.today)] > 0) w = s.weather.today;
    else {
      let r = rnd(), acc = 0; w = 'sun';
      const k = ['sun', 'cloud', 'rain', 'snow'];
      for (let i = 0; i < 4; i++) { acc += p[i]; if (r < acc) { w = k[i]; break; } }
    }
    s.weather.yesterday = s.weather.today;
    s.weather.today = w;
    if (w === 'snow' && !s.events.some(e => e.kind === 'sel')) {
      s.events.push({ kind: 'sel', label: 'Sel sur les routes', zone: null, until: day + 7, f: 1.4 });
      if (!s.lastSnowLog || day - s.lastSnowLog > 20) log(s, 'Neige : les routes sont salées. Gros besoin de lavage dans les jours qui viennent.', 'info');
      s.lastSnowLog = day;
    }
  }

  function seasonalEvents(s, day) {
    const d = dateOf(day), m = d.getUTCMonth(), dm = d.getUTCDate();
    const se = seasonOf(day);
    if (se === 'printemps' && rnd() < 0.025 && !s.events.some(e => e.kind === 'pollen')) {
      s.events.push({ kind: 'pollen', label: 'Épisode de pollen', zone: null, until: day + 5, f: 1.35 });
      log(s, 'Épisode de pollen : les carrosseries jaunissent, la demande grimpe.', 'good');
    }
    if (se === 'été' && rnd() < 0.02 && !s.events.some(e => e.kind === 'canicule')) {
      s.events.push({ kind: 'canicule', label: 'Canicule', zone: null, until: day + 4, f: 0.85 });
      log(s, 'Canicule : les clients restent au frais, la demande baisse.', 'bad');
    }
    if (m === 6 && dm === 1) {
      s.events.push({ kind: 'departs', label: 'Départs en vacances', zone: 'plages', until: day + 12, f: 1.6 });
      s.events.push({ kind: 'departs2', label: 'Départs en vacances', zone: null, until: day + 8, f: 1.1 });
      log(s, 'Départs en vacances : la Route des Plages déborde de monde.', 'good');
    }
    if (m === 7 && dm === 22) {
      s.events.push({ kind: 'retours', label: 'Retours de vacances', zone: null, until: day + 10, f: 1.3 });
      log(s, 'Retours de vacances : des voitures pleines de sable et de moustiques partout.', 'good');
    }
  }

  // ---------- mensuel : prêts, zones, offres ----------
  function monthly(s) {
    const day = Math.floor(s.day) + 1;
    // prêts
    for (const l of s.loans) {
      if (l.left <= 0) continue;
      const interest = l.remaining * l.rate / 12;
      const princ = Math.min(l.remaining, l.monthly - interest);
      l.remaining = Math.max(0, l.remaining - princ);
      l.left--;
      s.cash -= l.monthly; s.today.fin += l.monthly;
    }
    const done = s.loans.filter(l => l.left <= 0 || l.remaining < 1);
    for (const l of done) log(s, `Prêt de ${fmt(l.principal)} entièrement remboursé.`, 'good');
    s.loans = s.loans.filter(l => !(l.left <= 0 || l.remaining < 1));
    // zones
    for (const z of s.zones) {
      const zd = zoneDef(z.id);
      if (z.pending) {
        if (day >= z.pending.at) {
          z.stage += z.pending.dir;
          const up = z.pending.dir > 0;
          z.pending = null;
          log(s, `${zd.name} devient « ${STAGES[z.stage].n} ». ${up ? 'Le flux et le prix des terrains montent.' : 'Le flux et le prix des terrains baissent.'}`, 'zone');
          // les prix de référence changent : le joueur garde ses prix
        }
        continue;
      }
      if (z.stage < zd.max && rnd() < zd.growth) {
        z.pending = { dir: 1, at: day + 45 + Math.floor(rnd() * 40), signal: pick(SIGNALS_UP) };
        if (s.sectors[zd.sector].revealed) log(s, `${zd.name} : ${z.pending.signal.toLowerCase()}.`, 'zone');
      } else if (z.stage > zd.min && rnd() < zd.decline) {
        z.pending = { dir: -1, at: day + 40 + Math.floor(rnd() * 30), signal: pick(SIGNALS_DOWN) };
        if (s.sectors[zd.sector].revealed) log(s, `${zd.name} : ${z.pending.signal.toLowerCase()}.`, 'zone');
      }
    }
    // parcelle voisine
    for (const st of Object.values(s.stations)) {
      if (st.owner !== 'player') continue;
      if (st.extended || s.offers.some(o => o.lot === st.lot)) continue;
      if (rnd() < 0.05) {
        const price = r1000(10000 * STAGES[zoneOf(s, st.lot).stage].price);
        s.offers.push({ id: 'o' + (s.nextId++), lot: st.lot, price, slots: 2, q: 4, until: day + 20 });
        log(s, `La parcelle voisine de ${lotDef(st.lot).name} se libère : +2 emplacements pour ${fmt(price)}. Offre valable 20 jours.`, 'good');
      }
    }
  }

  function forcedSale(s) {
    const mine = Object.values(s.stations).filter(st => st.owner === 'player');
    if (!mine.length) { s.over = true; log(s, 'Faillite : plus rien à vendre. Game over.', 'bad'); return; }
    mine.sort((a, b) => stationValue(s, a.lot) - stationValue(s, b.lot));
    const st = mine[0];
    const v = Math.round(stationValue(s, st.lot) * 0.7);
    sellStation(s, st.lot, 0.7);
    s.overdraftDays = 0;
    log(s, `La banque a forcé la vente de ${lotDef(st.lot).name} pour ${fmt(v)}.`, 'bad');
    if (s.cash < -OVERDRAFT && !Object.values(s.stations).some(x => x.owner === 'player')) {
      s.over = true; log(s, 'Faillite : plus rien à vendre. Game over.', 'bad');
    }
  }

  // ---------- IA rivales ----------
  function rivalsAct(s) {
    for (const r of s.rivals) {
      if (r.bankrupt) continue;
      const def = RIVALS.find(x => x.id === r.id);
      const mine = Object.values(s.stations).filter(st => st.owner === r.id);
      // faillite
      if (r.cash < -30000) {
        const st = mine.sort((a, b) => stationValue(s, a.lot) - stationValue(s, b.lot))[0];
        if (st) {
          const val = r1000(stationValue(s, st.lot) * 0.6);
          const ls = lotState(s, st.lot);
          r.cash += val;
          ls.owner = null; ls.sale = { price: val, units: st.units.map(u => ({ ...u })) };
          delete s.stations[st.lot];
          log(s, `${def.name} en difficulté revend ${lotDef(st.lot).name} équipé : ${fmt(val)}.`, 'rival');
        } else r.bankrupt = true;
        continue;
      }
      // prix
      for (const st of mine) {
        for (const t of TYPES) {
          const ref = refPrice(s, st.lot, t);
          let target = def.profile === 'discounter' ? ref * 0.8 : ref * 1.0;
          const rivalsHere = Object.values(s.stations).filter(o => o !== st && lotDef(o.lot).zone === lotDef(st.lot).zone && o.units.some(u => u.type === t));
          const cheapest = Math.min(...rivalsHere.map(o => o.prices[t]), Infinity);
          if (def.profile === 'discounter' && cheapest < st.prices[t] * 1.02) target = Math.max(ref * 0.55, cheapest * 0.92);
          st.prices[t] = Math.round((st.prices[t] * 0.5 + target * 0.5) * 2) / 2;
        }
        // agrandissement si saturée
        const h = st.hist.slice(-10);
        const lost = h.reduce((a, x) => a + x.lost, 0), arr = h.reduce((a, x) => a + x.served + x.lost, 0);
        if (arr && lost / arr > 0.12 && freeSlots(st) >= 1) {
          const tier = def.profile === 'discounter' ? 0 : 1;
          const type = freeSlots(st) >= 2 && !st.units.some(u => u.type === 'portique') ? 'portique' : 'hp';
          const price = EQUIP[type].tiers[tier].price;
          if (r.cash > price + 10000) { r.cash -= price; st.units.push(unit(type, tier)); }
        }
      }
      // expansion (prudente : 4 stations max, jamais dans le secteur de départ du joueur)
      if (r.cash < 60000 || mine.length >= 4 || rnd() < 0.6) continue;
      const cands = s.lots.filter(l => !l.owner && sectorOfLot(l.id) !== 0).map(l => {
        const z = zoneOf(s, l.id), zd = zoneDef(z.id), d = lotDef(l.id);
        const price = l.sale ? l.sale.price : lotPrice(s, l.id);
        const dem = zoneDemand(s, z.id, s.day);
        const comp = Object.values(s.stations).filter(st => lotDef(st.lot).zone === z.id).length;
        let score;
        if (def.profile === 'discounter') score = dem * d.loc / (1 + comp * 0.7) / Math.sqrt(price);
        else score = (zd.growth * 3 + (z.pending && z.pending.dir > 0 ? 1.5 : 0) + 0.3) * d.slots / Math.sqrt(price) * 40 / (1 + comp * 0.4);
        // juteux : le joueur sature
        const playerHere = Object.values(s.stations).filter(st => st.owner === 'player' && lotDef(st.lot).zone === z.id);
        for (const ps of playerHere) {
          const h = ps.hist.slice(-10); const lo = h.reduce((a, x) => a + x.lost, 0);
          if (lo > 40) score *= 1.6;
        }
        return { l, price, score };
      }).filter(c => c.price < r.cash * 0.8).sort((a, b) => b.score - a.score);
      const c = cands[0];
      if (!c || rnd() < 0.5) continue;
      r.cash -= c.price;
      c.l.owner = r.id;
      const st = s.stations[c.l.id] = newStation(s, c.l.id, r.id);
      if (c.l.sale) { st.units = c.l.sale.units; c.l.sale = null; }
      st.contract = def.profile === 'discounter' ? 1 : 2;
      const tier = def.profile === 'discounter' ? 0 : 1;
      let budget = r.cash - 15000;
      const d = lotDef(c.l.id);
      if (freeSlots(st) >= 2 && budget > EQUIP.portique.tiers[tier].price) { st.units.push(unit('portique', tier)); budget -= EQUIP.portique.tiers[tier].price; r.cash -= EQUIP.portique.tiers[tier].price; }
      while (freeSlots(st) >= 1 && budget > EQUIP.hp.tiers[tier].price && st.units.length < Math.ceil(d.slots / 1.5)) {
        st.units.push(unit('hp', tier)); budget -= EQUIP.hp.tiers[tier].price; r.cash -= EQUIP.hp.tiers[tier].price;
      }
      st.prices = { portique: Math.round(refPrice(s, c.l.id, 'portique') * (def.profile === 'discounter' ? 0.8 : 1) * 2) / 2, hp: Math.round(refPrice(s, c.l.id, 'hp') * (def.profile === 'discounter' ? 0.8 : 1) * 2) / 2 };
      const known = s.sectors[sectorOfLot(c.l.id)].revealed;
      log(s, `${def.name} s'installe ${known ? 'à ' + d.name : 'dans un secteur encore inconnu'}.`, 'rival');
    }
  }

  // ---------- actions du joueur ----------
  function reveal(s, sectorId) {
    const sec = s.sectors[sectorId];
    if (sec.revealed) return { ok: false, msg: 'Déjà reconnu' };
    if (s.cash < RECON_COST) return { ok: false, msg: 'Trésorerie insuffisante' };
    s.cash -= RECON_COST; s.today.capex += RECON_COST; sec.revealed = true;
    log(s, `Secteur ${SECTORS[sectorId].name} reconnu.`, 'info');
    return { ok: true };
  }
  function study(s, lotId) {
    const l = lotState(s, lotId);
    if (l.studied) return { ok: false, msg: 'Déjà étudié' };
    if (s.cash < STUDY_COST) return { ok: false, msg: 'Trésorerie insuffisante' };
    s.cash -= STUDY_COST; s.today.capex += STUDY_COST; l.studied = true;
    log(s, `Étude d'implantation livrée : ${lotDef(lotId).name}.`, 'info');
    return { ok: true };
  }
  function buyLot(s, lotId) {
    const l = lotState(s, lotId);
    if (l.owner) return { ok: false, msg: 'Terrain déjà pris' };
    const price = l.sale ? l.sale.price : lotPrice(s, lotId);
    if (s.cash < price) return { ok: false, msg: 'Trésorerie insuffisante' };
    s.cash -= price; s.today.capex += price;
    l.owner = 'player';
    const st = s.stations[lotId] = newStation(s, lotId, 'player');
    if (l.sale) { st.units = l.sale.units; l.sale = null; }
    log(s, `Terrain acheté : ${lotDef(lotId).name} pour ${fmt(price)}.`, 'good');
    return { ok: true };
  }
  function buyUnit(s, lotId, type, tier) {
    const st = s.stations[lotId];
    const e = EQUIP[type], t = e.tiers[tier];
    if (freeSlots(st) < e.slots) return { ok: false, msg: "Pas assez d'emplacements libres" };
    if (s.cash < t.price) return { ok: false, msg: 'Trésorerie insuffisante' };
    s.cash -= t.price; s.today.capex += t.price;
    st.units.push(unit(type, tier));
    log(s, `${e.name} ${t.n} installé à ${lotDef(lotId).name}.`, 'good');
    return { ok: true };
  }
  function sellUnit(s, lotId, idx) {
    const st = s.stations[lotId];
    const u = st.units[idx]; if (!u) return { ok: false };
    const v = unitResale(u);
    s.cash += v; st.units.splice(idx, 1);
    log(s, `${EQUIP[u.type].name} ${EQUIP[u.type].tiers[u.tier].n} revendu ${fmt(v)}.`, 'info');
    return { ok: true, v };
  }
  function sellStation(s, lotId, mul = 1) {
    const st = s.stations[lotId];
    const v = Math.round(stationValue(s, lotId) * mul);
    if (st.staff) unassign(s, lotId);
    s.cash += v;
    delete s.stations[lotId];
    const l = lotState(s, lotId); l.owner = null;
    s.offers = s.offers.filter(o => o.lot !== lotId);
    if (mul === 1) log(s, `${lotDef(lotId).name} vendu ${fmt(v)}.`, 'info');
    return { ok: true, v };
  }
  function takeOffer(s, offerId) {
    const o = s.offers.find(x => x.id === offerId);
    if (!o) return { ok: false };
    if (s.cash < o.price) return { ok: false, msg: 'Trésorerie insuffisante' };
    s.cash -= o.price; s.today.capex += o.price;
    const st = s.stations[o.lot];
    st.extended = true; st.extraSlots = (st.extraSlots || 0) + o.slots; st.extraQ = (st.extraQ || 0) + o.q;
    s.offers = s.offers.filter(x => x !== o);
    log(s, `Parcelle voisine rachetée : ${lotDef(o.lot).name} gagne 2 emplacements.`, 'good');
    return { ok: true };
  }
  // ---------- personnel ----------
  function hire(s) {
    const e = { id: 'e' + (s.nextId++), name: pick(['Kevin', 'Sandrine', 'Mehdi', 'Gwen', 'Loïc', 'Nadia', 'Yann', 'Chloé', 'Rudy', 'Maëlle']), stations: [] };
    s.staff.push(e);
    log(s, `${e.name} rejoint l'équipe (${fmt(STAFF_DAY)} par jour).`, 'info');
    return e;
  }
  function assign(s, empId, lotId) {
    const e = s.staff.find(x => x.id === empId);
    const st = s.stations[lotId];
    if (!e || !st) return { ok: false };
    if (e.stations.length >= 3) return { ok: false, msg: '3 stations maximum par employé' };
    if (e.stations.length && e.stations.some(l => sectorOfLot(l) !== sectorOfLot(lotId))) return { ok: false, msg: 'Partage possible seulement dans un même secteur' };
    if (st.staff) unassign(s, lotId);
    e.stations.push(lotId); st.staff = e.id;
    return { ok: true };
  }
  function unassign(s, lotId) {
    const st = s.stations[lotId];
    const e = s.staff.find(x => x.id === st.staff);
    if (e) e.stations = e.stations.filter(l => l !== lotId);
    st.staff = null;
  }
  function fire(s, empId) {
    const e = s.staff.find(x => x.id === empId);
    if (!e) return;
    for (const l of e.stations) if (s.stations[l]) s.stations[l].staff = null;
    s.staff = s.staff.filter(x => x !== e);
    log(s, `${e.name} quitte l'équipe.`, 'info');
  }

  // ---------- banque ----------
  function patrimoine(s) {
    return Object.values(s.stations).filter(st => st.owner === 'player').reduce((a, st) => a + stationValue(s, st.lot), 0);
  }
  function debt(s) { return s.loans.reduce((a, l) => a + l.remaining, 0); }
  function avgRev(s, n = 30) {
    const h = s.hist.slice(-n); if (!h.length) return 0;
    return h.reduce((a, x) => a + x.rev, 0) / h.length;
  }
  function avgNet(s, n = 7) {
    const h = s.hist.slice(-n); if (!h.length) return 0;
    return h.reduce((a, x) => a + x.rev - x.cost, 0) / h.length;
  }
  function creditLimit(s) {
    return Math.max(0, r1000(30000 + 0.8 * patrimoine(s) + 250 * avgRev(s) - debt(s)));
  }
  function loanRate(s, extra = 0) {
    const p = patrimoine(s) + 1;
    return 0.03 + 0.05 * clamp((debt(s) + extra) / (p + extra * 0.5), 0, 1);
  }
  function monthlyPay(amount, rate, years) {
    const i = rate / 12, n = years * 12;
    return Math.round(amount * i / (1 - Math.pow(1 + i, -n)));
  }
  function borrow(s, amount, years) {
    amount = r1000(amount);
    if (amount <= 0) return { ok: false };
    if (amount > creditLimit(s)) return { ok: false, msg: 'Au-delà de ta capacité d\'emprunt' };
    const rate = loanRate(s, amount);
    const l = { id: 'l' + (s.nextId++), principal: amount, remaining: amount, rate, years, left: years * 12, monthly: monthlyPay(amount, rate, years) };
    s.loans.push(l); s.cash += amount;
    log(s, `Prêt accordé : ${fmt(amount)} sur ${years} ans à ${(rate * 100).toFixed(1).replace('.', ',')} %, ${fmt(l.monthly)} par mois.`, 'info');
    return { ok: true, loan: l };
  }
  function repay(s, loanId) {
    const l = s.loans.find(x => x.id === loanId);
    if (!l) return { ok: false };
    const amt = Math.round(l.remaining);
    if (s.cash < amt) return { ok: false, msg: 'Trésorerie insuffisante' };
    s.cash -= amt; s.loans = s.loans.filter(x => x !== l);
    log(s, `Prêt soldé par anticipation : ${fmt(amt)}.`, 'good');
    return { ok: true };
  }

  // ---------- horloge ----------
  // avance de `hours` heures de jeu (peut être fractionnaire)
  function advance(s, hours) {
    if (s.over) return;
    s.acc += hours;
    while (s.acc >= 1) {
      s.acc -= 1;
      simHour(s, s.h);
      s.h++;
      if (s.h >= 24) { s.h = 0; endOfDay(s); s.d++; }
      s.day = s.d + s.h / 24;
      if (s.over) return;
    }
  }
  function advanceDays(s, n) { advance(s, n * 24); }

  // gains hors ligne
  function offline(s, now) {
    const ms = now - (s.lastSeen || now);
    const hours = Math.min(8, ms / 3600000);
    if (hours < 0.05) return 0;
    const g = Math.max(0, Math.round(avgNet(s, 7) * hours * 3 * 0.5));
    return { hours, gain: g };
  }

  function log(s, text, kind = 'info') {
    s.log.unshift({ d: Math.floor(s.day), text, kind });
    if (s.log.length > 150) s.log.length = 150;
  }
  function fmt(v) {
    const n = Math.round(v);
    return (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('fr-FR').replace(/\s/g, '\u00a0') + '\u00a0€';
  }

  // ---------- objectifs ----------
  const OBJECTIVES = [
    { t: 'Installe ton premier équipement aux Bruyères', done: s => s.stations.A && s.stations.A.units.length > 0 },
    { t: 'Lance le temps et encaisse 1 000 € de chiffre d\'affaires', done: s => s.totals.rev >= 1000 },
    { t: 'Reconnais un secteur voisin', done: s => s.sectors.filter(x => x.revealed).length >= 2 },
    { t: "Commande une étude d'implantation", done: s => s.lots.some(l => l.studied) },
    { t: 'Achète un deuxième terrain', done: s => Object.values(s.stations).filter(x => x.owner === 'player').length >= 2 },
    { t: 'Atteins 1 000 € de chiffre d\'affaires en une journée', done: s => s.hist.some(h => h.rev >= 1000) },
    { t: 'Possède 5 stations', done: s => Object.values(s.stations).filter(x => x.owner === 'player').length >= 5 },
    { t: 'Installe-toi en zone péri-urbaine', done: s => Object.values(s.stations).some(x => x.owner === 'player' && zoneOf(s, x.lot).stage === 4) },
    { t: 'Valeur nette de 2 000 000 €', done: s => s.cash + patrimoine(s) - debt(s) >= 2000000 }
  ];
  const TITLES = [
    [0, 'Laveur du dimanche'], [2, 'Patron de station'], [3, 'Roi du rouleau'], [5, 'Baron de la mousse'],
    [8, 'Magnat du lustrage'], [11, 'Empereur du Car Wash']
  ];
  function title(s) {
    const n = Object.values(s.stations).filter(x => x.owner === 'player').length;
    let t = TITLES[0][1];
    for (const [k, v] of TITLES) if (n >= k) t = v;
    return t;
  }
  function checkObjectives(s) {
    const done = [];
    while (s.obj < OBJECTIVES.length && OBJECTIVES[s.obj].done(s)) { done.push(OBJECTIVES[s.obj].t); s.obj++; }
    return done;
  }

  // ---------- chargement d'une sauvegarde ----------
  // Renvoie un état jouable au format courant, ou null si la sauvegarde est illisible.
  function migrate(st) {
    if (!st || typeof st !== 'object' || typeof st.v !== 'number' || !st.stations) return null;
    if (st.v > SAVE_VERSION) return null; // sauvegarde d'une version plus récente du jeu
    try {
      while (st.v < SAVE_VERSION) {
        const step = MIGRATIONS[st.v];
        if (!step) return null;
        step(st);
        st.v++;
      }
      return repair(st);
    } catch (e) { return null; }
  }
  // complète les champs manquants avec des valeurs par défaut (tolérance aux sauvegardes partielles)
  function repair(st) {
    const base = newGameSkeleton();
    for (const k of Object.keys(base)) if (st[k] === undefined) st[k] = base[k];
    st.today = Object.assign({ rev: 0, cost: 0, capex: 0, fin: 0 }, st.today);
    st.totals = Object.assign({ rev: 0, served: 0 }, st.totals);
    for (const st2 of Object.values(st.stations)) {
      st2.q = st2.q || { portique: 0, hp: 0 };
      st2.cur = st2.cur || { served: { portique: 0, hp: 0 }, cap: { portique: 0, hp: 0 } };
      st2.day = st2.day || { served: 0, lost: 0, rev: 0, cost: 0, arr: 0 };
      st2.hist = st2.hist || [];
      st2.prices = st2.prices || defaultPrices(st, st2.lot);
    }
    return st;
  }
  function newGameSkeleton() {
    return { speed: 1, mode: 'realtime', staff: [], loans: [], offers: [], events: [], log: [], hist: [], obj: 0, nextId: 1, overdraftDays: 0, over: false, seenIntro: true, acc: 0 };
  }

  return {
    GAME_VERSION, SAVE_VERSION, migrate,
    DAY_SEC, OPEN, CLOSE, EQUIP, TYPES, CONTRACTS, STAGES, CHEM, SECTORS, ZONES, LOTS, RIVALS, WEATHER,
    FIXED_DAY, PER_UNIT_DAY, STAFF_DAY, OVERDRAFT, RECON_COST, STUDY_COST, STAFF_BONUS, OBJECTIVES,
    newGame, advance, advanceDays, lotDef, zoneDef, zoneOf, lotState, sectorOfLot, refPrice, lotPrice,
    unitResale, stationValue, slotsOf, qmaxOf, usedSlots, freeSlots, zoneDemand, attract, staffBonus, dateOf, seasonOf,
    reveal, study, buyLot, buyUnit, sellUnit, sellStation, takeOffer, hire, assign, unassign, fire,
    patrimoine, debt, avgRev, avgNet, creditLimit, loanRate, monthlyPay, borrow, repay, offline,
    log, fmt, checkObjectives, title, priceFactor, dayMult
  };
})();
if (typeof module !== 'undefined') module.exports = E;
