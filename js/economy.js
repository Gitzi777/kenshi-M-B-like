// Terres Arides — économie : stocks, production, consommation, prix, caravanes marchandes, vie des civils.
'use strict';

// ---------- Prix ----------
const TARGET_DAYS = 4;
const targetStock = (s, g) => s.pop * CONSUMPTION[g] / 100 * TARGET_DAYS + 8;
// le prix monte quand le stock est sous la réserve souhaitée, et baisse quand il déborde
function marketPrice(s, g) {
  if (g === 'arrows') return 1;
  const r = targetStock(s, g) / (s.stock[g] + 2);
  return Math.max(1, Math.round(GOODS[g].base * clamp(Math.pow(r, 0.65), 0.35, 3.5)));
}
function price(s, g) {
  const p = marketPrice(s, g);
  const disc = state.allegiance === s.faction ? 0.9 : 1;
  return { buy: Math.max(1, Math.round(p * disc)), sell: Math.max(1, Math.round(p * 0.85)) };
}
function itemBuyPrice(s, id) {
  const it = ITEMS[id];
  const k = clamp(marketPrice(s, it.mat) / GOODS[it.mat].base, 0.7, 1.8);
  return Math.round(it.price * k * (state.allegiance === s.faction ? 0.8 : 1));
}
const itemSellPrice = id => Math.max(1, Math.round(ITEMS[id].price * 0.45));
const nodePrice = n => Math.round(RESOURCES[n.type].rate * GOODS[RESOURCES[n.type].good].base * 7);
const nodeIndex = n => state.nodes.indexOf(n);
const nodeWorkers = n => squad().filter(a => a.assignedNode === nodeIndex(n));
function nodeRate(n) {
  const base = RESOURCES[n.type].rate;
  if (n.owner === 'player') return base * 0.5 * nodeWorkers(n).length;
  return n.owner ? base : 0;
}

// ---------- Journal du commerce ----------
function logTrade(t) {
  state.trades.push({ day: state.day, ...t });
  if (state.trades.length > 40) state.trades.shift();
}

// ---------- Production et consommation ----------
function econTick(dt) {
  const days = dt / DAY_LENGTH;
  for (const n of state.nodes) {
    if (n.disabled > 0) { n.disabled -= days; continue; }
    const amt = nodeRate(n) * days;
    if (n.owner === 'player') n.stock = Math.min(250, n.stock + amt);
    else {
      const s = settlementByName(n.owner);
      if (s) s.stock[RESOURCES[n.type].good] += amt;
    }
  }
  for (const s of state.settlements) {
    // artisans locaux : un peu de bois et de céréales partout
    s.stock.food += 2 * days;
    s.stock.wood += 1 * days;
    for (const g of TRADE_GOODS) {
      s.stock[g] = Math.max(0, s.stock[g] - s.pop * CONSUMPTION[g] / 100 * days);
      s.stock[g] = Math.min(s.stock[g], targetStock(s, g) * 6);
    }
    // la population suit la nourriture
    if (s.stock.food < 1) s.pop = Math.max(30, s.pop - 6 * days);
    else if (s.stock.food > targetStock(s, 'food')) s.pop = Math.min(400, s.pop + 3 * days);
  }
}

function recordHistory() {
  for (const s of state.settlements) {
    for (const g of TRADE_GOODS) {
      if (!s.hist[g]) s.hist[g] = [];
      s.hist[g].push(marketPrice(s, g));
      if (s.hist[g].length > 30) s.hist[g].shift();
    }
  }
}

// ---------- Caravanes : acheter là où c'est bon marché, vendre là où c'est cher ----------
function planCaravan(fid) {
  let best = null;
  for (const src of settlementsOf(fid)) {
    for (const dst of state.settlements) {
      if (dst === src || hostileF(fid, dst.faction)) continue;
      const dist = d2(src, dst);
      if (dist > 800) continue;
      for (const g of TRADE_GOODS) {
        const qty = Math.min(20, Math.floor(src.stock[g] - targetStock(src, g) * 0.4));
        if (qty < 4) continue;
        const buy = marketPrice(src, g), sell = marketPrice(dst, g);
        const profit = (sell - buy) * qty - dist * 0.08;
        if (!best || profit > best.profit) best = { src, dst, g, qty, buy, sell, profit };
      }
    }
  }
  if (!best || best.profit < 30) return null;
  const { src, dst, g, qty, buy } = best;
  src.stock[g] -= qty;
  const gp = gatePos(src, -10);
  const p = makeParty(fid, 'caravan', gp.x, gp.z, rollTroops(fid, randInt(2, 4), 'caravan'),
    { target: dst.name, home: src.name, dest: gatePos(dst, -6) });
  p.cargo = { good: g, qty, buy, from: src.name };
  logTrade({ kind: 'achat', faction: fid, where: src.name, to: dst.name, good: g, qty, price: buy });
  return p;
}

function caravanArrive(p) {
  const dst = settlementByName(p.target);
  if (!dst || !p.cargo) return;
  const sell = marketPrice(dst, p.cargo.good);
  dst.stock[p.cargo.good] += p.cargo.qty;
  logTrade({ kind: 'vente', faction: p.faction, where: dst.name, from: p.cargo.from, good: p.cargo.good, qty: p.cargo.qty, price: sell,
    profit: (sell - p.cargo.buy) * p.cargo.qty });
  if (p.mat) {
    const lead = p.units.find(alive);
    if (lead) floatText(lead.pos, `Vend ${p.cargo.qty} ${GOODS[p.cargo.good].icon} à ${sell} 💰`, '#ffe9a8');
  }
  p.cargo = null;
}

// ---------- Exploitations du joueur ----------
function claimNode(n, bought) {
  const old = nodeFaction(n);
  n.owner = 'player';
  n.stock = 0;
  refreshNodeFlag(n);
  despawnNodeCivilians(n);
  addChronicle(`${player.name} ${bought ? 'achète' : 'revendique'} ${RESOURCES[n.type].name.toLowerCase()}${old ? ' ' + F(old).of : ''}.`, '⚒');
}

// ---------- Vie des civils (visible seulement près de toi) ----------
function makeCivilian(fid, x, z, task, name) {
  const fac = F(fid);
  const tool = task.type === 'work' ? (task.good === 'iron' || task.good === 'wood' ? 'hache' : 'baton') : null;
  return makeUnit({
    faction: fid, civil: true, task, x, z, name, maxHp: 40, speed: 3.2,
    equip: { weapon: tool, armor: 'tunique', helmet: task.type === 'stall' ? 'turban' : (Math.random() < 0.5 ? 'capuche' : null) },
    look: { body: pick(['#8a6a48', '#6e5a40', '#9a8a68', fac ? fac.colors[0] : '#7a5a3a']), pants: '#3b2f22', skin: pick(SKIN_COLORS), height: rand(0.92, 1.05) },
  });
}

function spawnNodeCivilians(n) {
  n.civ = [];
  const fid = nodeFaction(n);
  if (!fid || fid === 'player' || !F(fid)) return;
  const R = RESOURCES[n.type];
  for (let i = 0; i < 3; i++) {
    const x = n.x + rand(-6, 6), z = n.z + rand(-6, 6);
    n.civ.push(makeCivilian(fid, x, z, { type: 'work', x, z, yaw: rand(-3, 3), good: R.good }, 'Ouvrier'));
  }
  const s = settlementByName(n.owner);
  if (s && d2(s, n) < 320) {
    const g = gatePos(s, 4);
    const h = makeCivilian(fid, n.x + 3, n.z + 3, { type: 'haul', node: { x: n.x + 3, z: n.z + 3 }, town: g, phase: 'load', wait: 2, good: R.good, townName: s.name }, 'Porteur');
    n.civ.push(h);
  }
}
function despawnNodeCivilians(n) {
  for (const u of n.civ || []) if (!u.dead) removeUnit(u);
  n.civ = null;
}

function spawnTownCivilians(s) {
  s.civilians = [];
  for (const st of s.stalls) {
    s.civilians.push(makeCivilian(s.faction, st.x, st.z, { type: 'stall', x: st.x, z: st.z, yaw: st.yaw, town: s.name, timer: rand(2, 8) }, 'Marchand'));
  }
  for (let i = 0; i < 5; i++) {
    const a = rand(0, Math.PI * 2), r = rand(6, s.r - 8);
    s.civilians.push(makeCivilian(s.faction, s.x + Math.cos(a) * r, s.z + Math.sin(a) * r, { type: 'wander', town: s.name, wait: rand(0, 3) }, 'Habitant'));
  }
}
function despawnTownCivilians(s) {
  for (const u of s.civilians || []) if (!u.dead) removeUnit(u);
  s.civilians = [];
  s.civMat = false;
}

function updateCivilianSpawns() {
  if (!player) return;
  for (const n of state.nodes) {
    const near = d2(n, player.pos) < 150;
    if (near && !n.civ) spawnNodeCivilians(n);
    else if (!near && n.civ) despawnNodeCivilians(n);
  }
  for (const s of state.settlements) {
    const near = d2(s, player.pos) < 200;
    if (near && !s.civMat) { s.civMat = true; spawnTownCivilians(s); }
    else if (!near && s.civMat) despawnTownCivilians(s);
  }
}

function updateCivil(u, dt) {
  u.working = false;
  if (u.flee > 0) {
    u.flee -= dt;
    const dx = u.pos.x - u.fleeFrom.x, dz = u.pos.z - u.fleeFrom.z, d = Math.hypot(dx, dz) || 1;
    steer(u, u.pos.x + dx / d * 10, u.pos.z + dz / d * 10, dt, 1.7, 0.1);
    return;
  }
  const t = u.task;
  if (!t) return;
  if (t.type === 'work') {
    if (steer(u, t.x, t.z, dt, 0.7, 0.4)) { u.working = true; u.moving = 0; u.yaw = turnToward(u.yaw, t.yaw, dt * 4); }
  } else if (t.type === 'haul') {
    if (t.phase === 'load') {
      t.wait -= dt;
      u.moving = 0;
      if (t.wait <= 0) { t.phase = 'toTown'; u.carry = true; dressUnit(u); }
    } else if (t.phase === 'toTown') {
      if (steer(u, t.town.x, t.town.z, dt, 0.8, 1.5)) {
        floatText(u.pos, `+3 ${GOODS[t.good].icon} livré à ${t.townName}`, '#ffe9a8');
        u.carry = false; dressUnit(u); t.phase = 'back';
      }
    } else if (steer(u, t.node.x, t.node.z, dt, 0.8, 1)) { t.phase = 'load'; t.wait = 4; }
  } else if (t.type === 'stall') {
    if (steer(u, t.x, t.z, dt, 0.7, 0.3)) { u.moving = 0; u.yaw = turnToward(u.yaw, t.yaw, dt * 4); }
    t.timer -= dt;
    if (t.timer <= 0) {
      t.timer = rand(7, 14);
      const s = settlementByName(t.town);
      if (s && d2(s, player.pos) < 45 && (state.clock || 0) - (s.lastShout || 0) > 4) {
        s.lastShout = state.clock || 0;
        const g = pick(TRADE_GOODS);
        floatText(u.pos, `${GOODS[g].icon} ${GOODS[g].name} ${marketPrice(s, g)} 💰 !`, '#f2e6c8');
      }
    }
  } else if (t.type === 'wander') {
    const s = settlementByName(t.town);
    if (!s) return;
    if (!t.dest) {
      t.wait -= dt;
      u.moving = 0;
      if (t.wait > 0) return;
      if (Math.random() < 0.4 && s.stalls.length) { const st = pick(s.stalls); t.dest = { x: st.x + rand(-1, 1) - Math.sin(st.yaw) * -1.2, z: st.z + rand(-1, 1) }; t.shop = true; }
      else { const a = rand(0, Math.PI * 2), r = rand(4, s.r - 8); t.dest = { x: s.x + Math.cos(a) * r, z: s.z + Math.sin(a) * r }; t.shop = false; }
    }
    if (steer(u, t.dest.x, t.dest.z, dt, 0.55, 1.2)) {
      if (t.shop) {
        const g = pick(['food', 'food', 'cloth', 'salt', 'spices', 'wood']);
        if (s.stock[g] >= 1) {
          s.stock[g] -= 1;
          if (d2(s, player.pos) < 40) floatText(u.pos, `achète 1 ${GOODS[g].icon} (${marketPrice(s, g)} 💰)`, '#d8e8ff');
        }
      }
      t.dest = null; t.wait = rand(2, 6);
    }
  }
}

// ---------- Compagnons au travail ----------
function updateAssignedWorker(u, dt) {
  const n = state.nodes[u.assignedNode];
  if (!n || n.owner !== 'player') { u.assignedNode = null; return false; }
  const spot = { x: n.x + Math.cos(u.id) * 5, z: n.z + Math.sin(u.id) * 5 };
  if (steer(u, spot.x, spot.z, dt, d2(u.pos, spot) > 20 ? 1.5 : 0.8, 0.5)) {
    u.moving = 0;
    u.working = true;
  } else u.working = false;
  return true;
}

function updateEconomy(dt) {
  state.econTimer -= dt;
  if (state.econTimer <= 0) { econTick(2 - state.econTimer); state.econTimer = 2; }
  state.histTimer -= dt;
  if (state.histTimer <= 0) { state.histTimer = 12; recordHistory(); }
  updateCivilianSpawns();
}
