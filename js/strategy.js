// Terres Arides — monde vivant : factions, relations, groupes en mouvement, événements.
'use strict';

// ---------- Factions ----------
const aliveFactions = () => Object.values(state.factions).filter(f => f.alive);
const majorFactions = () => aliveFactions().filter(f => !f.bandit && !f.isPlayer);
const settlementsOf = fid => state.settlements.filter(s => s.faction === fid);
const partiesOf = fid => state.parties.filter(p => p.faction === fid);
const atWar = (a, b) => state.relations[relKey(a, b)] === 'war';
function enemiesOf(fid) { return majorFactions().filter(f => f.id !== fid && atWar(fid, f.id)); }

function setRelation(a, b, rel) {
  const k = relKey(a, b);
  state.relations[k] = rel;
  if (rel === 'war') state.warSince[k] = state.clock || 0;
}

// ---------- Chroniques ----------
function addChronicle(text, icon = '📜') {
  state.chronicle.push({ day: state.day, text, icon });
  if (state.chronicle.length > 120) state.chronicle.shift();
  if (state.mode === 'play') logMsg(`${icon} ${text}`, 'news');
}

// ---------- Groupes (patrouilles, armées, caravanes, bandes) ----------
const partyPower = p => partyTroops(p).reduce((a, t) => a + (TROOP_POWER[t] || 1), 0);
function partyTroops(p) { return p.mat ? p.units.filter(u => !u.dead).map(u => u.troop) : p.troops; }
const PARTY_LABEL = { patrol: 'Patrouille', army: 'Armée', caravan: 'Caravane', bandits: 'Bande', travel: 'Voyageurs' };
const partyName = p => `${PARTY_LABEL[p.kind]} ${F(p.faction).of}`;

function rollTroops(fid, n, kind) {
  const f = F(fid);
  const out = [];
  for (let i = 0; i < n; i++) {
    if (f.bandit) out.push(i === 0 && n >= 4 ? 'chef' : (Math.random() < 0.25 ? 'archer' : 'pillard'));
    else {
      const r = Math.random();
      const vet = kind === 'army' ? 0.35 : kind === 'caravan' ? 0.1 : 0.2;
      out.push(r < vet ? 'veteran' : r < vet + 0.28 ? 'archer' : 'recrue');
    }
  }
  return out;
}

function makeParty(fid, kind, x, z, troops, extra = {}) {
  const p = {
    id: uid(), faction: fid, kind, x, z, troops,
    dest: extra.dest || { x, z }, home: extra.home || null, target: extra.target || null,
    timer: 0, mat: false, units: [], aggro: false,
  };
  p.name = partyName(p);
  state.parties.push(p);
  return p;
}

function removeParty(p) {
  if (p.mat) for (const u of p.units) if (!u.dead) removeUnit(u);
  p.units = [];
  const i = state.parties.indexOf(p);
  if (i >= 0) state.parties.splice(i, 1);
}

const placeName = p => {
  const s = nearestSettlement(p);
  return s && d2(s, p) < 120 ? `près ${deN(s.name)}` : 'en pleine nature';
};

function materialize(p) {
  p.mat = true;
  const ms = partyMembers(p);
  p.units = p.troops.map((troop, i) => {
    const a = i * 2.4, r = i ? 1.5 + i * 0.5 : 0;
    const extra = { party: p, banner: i === 0 && p.kind !== 'bandits' && p.kind !== 'travel' };
    let lead = null;
    if (i === 0 && troop === 'general' && p.general) { Object.assign(extra, { rank: 'general' }); lead = 'Général'; }
    else if (i === 0 && p.kind === 'patrol') { Object.assign(extra, { rank: 'captain' }); lead = 'Capitaine'; }
    else if (i === 0 && p.kind === 'caravan') { Object.assign(extra, { rank: 'captain' }); lead = 'Maître de caravane'; }
    if (troop === 'voyageur') Object.assign(extra, { equip: { weapon: pick(['baton', null, 'dague']), armor: 'tunique', helmet: pick(['capuche', 'turban', null]) }, title: 'Voyageur' });
    const u = makeTroop(p.faction, troop, p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, extra);
    const m = personById(ms[i]);
    bindUnit(u, m);
    if (lead && !(m && m.epithet)) u.title = lead;
    if (i === 0 && m) { if (p.kind === 'army') p.general = m.name; else p.captain = m.name; }
    return u;
  });
}
function dematerialize(p) {
  p.members = p.units.filter(u => !u.dead).map(u => u.pid || null);
  p.troops = p.units.filter(u => !u.dead).map(u => u.troop);
  for (const u of p.units) if (!u.dead) removeUnit(u); else u.party = null;
  p.units = [];
  p.mat = false;
  p.aggro = false;
}

function randomWildPoint(minFromTown = 60, minFromPlayer = 150) {
  let x, z, tries = 0;
  do {
    x = rand(-HALF + 30, HALF - 30); z = rand(-HALF + 30, HALF - 30);
  } while (++tries < 80 && (nearSettlement(x, z, minFromTown) || (player && Math.hypot(x - player.pos.x, z - player.pos.z) < minFromPlayer)));
  return { x, z };
}

function spawnPatrol(fid) {
  const own = settlementsOf(fid);
  if (!own.length) return null;
  const s = pick(own);
  const g = gatePos(s, -10);
  return makeParty(fid, 'patrol', g.x, g.z, rollTroops(fid, randInt(3, 6), 'patrol'), { home: s.name });
}
const spawnCaravan = fid => planCaravan(fid);
function spawnBandits(near, fid = 'bandits') {
  if (!F(fid) || !F(fid).alive) return null;
  let pt = near;
  if (!pt) {
    const lairs = settlementsOf(fid);
    if (lairs.length && Math.random() < 0.7) {
      const l = pick(lairs), a = rand(0, Math.PI * 2), r = rand(40, 140);
      pt = { x: clamp(l.x + Math.cos(a) * r, -HALF + 20, HALF - 20), z: clamp(l.z + Math.sin(a) * r, -HALF + 20, HALF - 20) };
      if (player && d2(pt, player.pos) < SPAWN_DIST + 10) pt = randomWildPoint();
    } else pt = randomWildPoint();
  }
  const n = clamp(randInt(2, 3) + Math.floor(state.day / 2), 2, 7);
  return makeParty(fid, 'bandits', pt.x, pt.z, rollTroops(fid, n, 'bandits'));
}

// ---------- Hiérarchie : souverain, généraux, capitaines ----------
function ensureHierarchy(f) {
  if (f.bandit) return;
  if (!f.generals) f.generals = [genPerson(), genPerson(), genPerson()].slice(0, 2 + (Math.random() < 0.5 ? 1 : 0)).map(name => ({ name, status: 'libre' }));
}
function freeGeneral(f) {
  ensureHierarchy(f);
  return f.generals.find(g => g.status === 'libre') || null;
}
function generalByName(f, name) { return f && f.generals ? f.generals.find(g => g.name === name) : null; }
function releaseGeneral(p, died) {
  const g = generalByName(F(p.faction), p.general);
  if (!g) return;
  g.status = died ? 'mort' : 'libre';
  if (died) addChronicle(`Le général ${g.name} ${F(p.faction).of} est tombé ${placeName(p)}.`, '⚰');
}
function generalFell(u, by) {
  const f = F(u.faction);
  const g = generalByName(f, u.name);
  if (g) g.status = 'mort';
  if (u.party) u.party.general = null;
  addChronicle(`Le général ${u.name} ${f.of} a été tué${by && isPlayerSide(by) ? ` par ${by.name}` : ''} ${placeName(u.pos)}.`, '⚰');
  if (by && isPlayerSide(by)) state.rep[f.id] = (state.rep[f.id] || 0) - 15;
}
function rulerFell(u, by) {
  const f = F(u.faction);
  const old = f.leader;
  f.leader = `${pick(LEADER_TITLE)} ${genName()}`;
  addChronicle(`${old} ${f.of} a été assassiné${by && isPlayerSide(by) ? ` par ${by.name}` : ''} ! ${f.leader} prend le pouvoir.`, '👑');
  if (by && isPlayerSide(by)) state.rep[f.id] = (state.rep[f.id] || 0) - 50;
  if (Math.random() < 0.4) eventSplit(f);
}
function promoteGenerals() {
  for (const f of majorFactions()) {
    ensureHierarchy(f);
    const active = f.generals.filter(g => g.status !== 'mort');
    if (active.length < 2 && Math.random() < 0.5) {
      // le soldat le plus prestigieux de la faction devient général
      const best = people().filter(m => m.alive && m.job === 'soldat' && m.faction === f.id && !m.party && m.fame >= 8).sort((a, b) => b.fame - a.fame)[0];
      const name = best ? best.name : genPerson();
      f.generals = f.generals.filter(g => g.status !== 'mort').concat({ name, status: 'libre', pid: best ? best.id : null });
      addChronicle(best ? `${personName(best)}, ${rankLabel(best).toLowerCase()} aux ${Math.round(best.kills)} victoires, est promu général ${f.of}.` : `${name} est promu général ${f.of}.`, '🎖');
    }
  }
}
// raid de bandits ou de cannibales contre une ville mal défendue
function raiseRaid(fid) {
  const f = F(fid);
  const lairs = settlementsOf(fid);
  if (!lairs.length) return null;
  let best = null, bs = Infinity, from = null;
  for (const t of state.settlements) {
    if (t.faction === fid || t.type === 'repaire' || t.garrison > 7) continue;
    for (const l of lairs) {
      const d = d2(l, t);
      if (d > 520) continue;
      const score = t.garrison * 60 + d;
      if (score < bs) { bs = score; best = t; from = l; }
    }
  }
  if (!best) return null;
  const g = gatePos(from, -6);
  const p = makeParty(fid, 'army', g.x, g.z, ['chef', ...rollTroops(fid, randInt(8, 12), 'bandits')], { target: best.name, home: from.name });
  p.dest = { x: best.x, z: best.z };
  partyMembers(p);
  const chief = people().filter(m => m.alive && m.job === 'bandit' && m.faction === fid && m.fame >= 10 && !m.party).sort((a, b) => b.fame - a.fame)[0];
  if (chief) { personDies(personById(p.members[0])); p.members[0] = chief.id; chief.party = p.id; chief.loc = null; }
  p.general = personName(personById(p.members[0]));
  addChronicle(`${theF(f, true)} ${vb(f, 'lance', 'lancent')} un raid sur ${best.name}, mené par ${p.general} !`, '🐺');
  return p;
}

function raiseArmy(fid) {
  const enemies = enemiesOf(fid);
  // les villes tombées aux mains des bandits sont aussi des cibles
  const targets = state.settlements.filter(s => enemies.some(e => e.id === s.faction) || (s.faction === 'player' && playerHostileTo(fid)) || (F(s.faction).bandit && s.type !== 'repaire' && d2(s, nearestSettlement(s, x => x.faction === fid) || s) < 600));
  const own = settlementsOf(fid);
  if (!targets.length || !own.length) return null;
  let best = null, bd = Infinity, from = null;
  for (const o of own) for (const t of targets) { const d = d2(o, t); if (d < bd) { bd = d; best = t; from = o; } }
  const gen = freeGeneral(F(fid));
  if (!gen) return null;
  const g = gatePos(from, -12);
  const p = makeParty(fid, 'army', g.x, g.z, ['general', ...rollTroops(fid, randInt(7, 11), 'army')], { target: best.name, home: from.name });
  p.dest = { x: best.x, z: best.z };
  p.general = gen.name;
  gen.status = 'armée';
  partyMembers(p);
  const gp = gen.pid && personById(gen.pid);
  if (gp && gp.alive) { personDies(personById(p.members[0])); p.members[0] = gp.id; gp.party = p.id; gp.loc = null; }
  else { const m = personById(p.members[0]); m.name = gen.name; m.fame = Math.max(m.fame, 20); }
  addChronicle(`Le général ${gen.name} lève une armée ${F(fid).of} à ${from.name} et marche sur ${best.name}.`, '📯');
  return p;
}

// ---------- Batailles hors de vue ----------
function autoBattle(a, b) {
  const pa = partyPower(a) * rand(0.75, 1.25), pb = partyPower(b) * rand(0.75, 1.25);
  const [win, lose, pw, pl] = pa >= pb ? [a, b, pa, pb] : [b, a, pb, pa];
  const losses = Math.round(win.troops.length * clamp(pl / pw, 0.1, 0.9) * 0.6);
  membersDie(win, losses);
  win.troops.splice(0, losses);
  membersDie(lose, lose.troops.length);
  // les survivants gagnent en prestige
  for (const id of (win.members || []).slice(0, 3)) { const m = personById(id); if (m) { m.kills += 1; addFame(m, rand(0.5, 2)); } }
  const where = placeName(lose);
  if (lose.kind === 'caravan' && F(win.faction).bandit) addChronicle(`${theF(F(win.faction), true)} ${vb(F(win.faction), 'a', 'ont')} pillé une caravane ${F(lose.faction).of} ${where}.`, '🐺');
  else if (lose.kind === 'army' || win.kind === 'army') addChronicle(`Bataille ${where} : ${theF(F(win.faction))} ${vb(F(win.faction), 'écrase', 'écrasent')} l'${lose.kind === 'army' ? 'armée' : 'escorte'} ${F(lose.faction).of}.`, '⚔');
  if (lose.general) releaseGeneral(lose, Math.random() < 0.5);
  removeParty(lose);
  if (!win.troops.length) { if (win.general) releaseGeneral(win, true); removeParty(win); }
}

function siege(p, s) {
  const old = s.faction;
  const atk = partyPower(p) * rand(0.8, 1.25);
  const def = (s.garrison * 1.3 + 2) * (s.capital ? 1.3 : 1) * rand(0.8, 1.2);
  if (atk > def && s.type === 'base') {
    // une base n'est pas une ville : on la pille
    for (const g in s.stock) s.stock[g] = Math.floor(s.stock[g] * 0.5);
    const lost = Math.floor(state.goods.food * 0.2);
    state.goods.food -= lost;
    s.garrison = 0;
    addChronicle(`${theF(F(p.faction), true)} ${vb(F(p.faction), 'pille', 'pillent')} ${s.name} !`, '🔥');
    logMsg(`🔥 Ta base ${s.name} a été pillée en ton absence !`, 'warn');
    membersDie(p, Math.floor(p.troops.length / 3));
    p.kind = 'bandits'; p.target = null; p.name = partyName(p);
    return old;
  }
  if (atk > def) {
    const survivors = Math.max(2, Math.round(partyTroops(p).length * 0.6));
    if (p.general) releaseGeneral(p, false);
    partyMembers(p);
    membersDie(p, p.troops.length - survivors);
    const settlers = p;
    removeParty(p);
    captureSettlement(s, p.faction, survivors);
    membersSettle(settlers, s, F(p.faction).bandit ? 'bandit' : 'soldat');
  } else {
    const lost = s.garrison - Math.max(1, Math.round(s.garrison - atk / 1.5));
    s.garrison -= lost;
    garrisonLoses(s, lost);
    if (p.general) releaseGeneral(p, Math.random() < 0.4);
    membersDie(p, p.troops.length);
    removeParty(p);
    addChronicle(`${s.name} a repoussé l'assaut ${F(p.faction).of}. Les murs tiennent.`, '🛡');
  }
  return old;
}

function captureSettlement(s, fid, garrison) {
  const old = s.faction;
  despawnGuards(s);
  despawnTownCivilians(s);
  for (const m of people()) if (m.alive && !m.party && m.loc === s.name && m.job === 'soldat') { if (Math.random() < 0.6) personDies(m); else m.job = 'habitant'; }
  for (const m of people()) if (m.alive && !m.party && m.loc === s.name) m.faction = fid;
  setOwner(s, fid);
  s.garrison = garrison;
  s.capital = false;
  addChronicle(`${s.name} est tombée ! ${theF(F(fid), true)} ${vb(F(fid), "s'empare", "s'emparent")} de la ville ${F(old).of}.`, '🔥');
  if (state.allegiance === old && player) logMsg(`Ta faction a perdu ${s.name}.`, 'warn');
}

// ---------- Garnisons (gardes visibles quand tu es proche) ----------
// soldats de la garnison (les personnes réelles qui vivent dans la ville)
function garrisonPeople(s) {
  const fac = F(s.faction);
  const job = fac && fac.bandit ? 'bandit' : 'soldat';
  let list = people().filter(m => m.alive && !m.party && m.loc === s.name && m.job === job);
  while (list.length < s.garrison) list.push(newPerson({ home: s.name, job, faction: s.faction, lvl: randInt(15, 30), fame: randInt(0, 5) }));
  return list;
}
function garrisonLoses(s, n) {
  const list = garrisonPeople(s).sort(() => Math.random() - 0.5);
  for (let i = 0; i < n && i < list.length; i++) personDies(list[i]);
}
function spawnGuards(s) {
  s.guardsMat = true;
  s.guards = [];
  s.reinforce = 0;
  const n = Math.min(s.garrison, 6);
  for (let i = 0; i < n; i++) addGuard(s, i);
  // le souverain réside au palais de sa capitale
  const fac = F(s.faction);
  if (s.throne && !fac.bandit && s.faction !== 'player') {
    const u = makeTroop(s.faction, 'general', s.throne.x, s.throne.z, { guardOf: s, name: fac.leader, title: '', rank: 'ruler' });
    u.home = { x: s.throne.x, z: s.throne.z, yaw: s.buildings.find(b => b.hw === 7) ? s.buildings.find(b => b.hw === 7).yaw : 0 };
    s.guards.push(u);
  }
  // un gardien veille dans la prison
  if (s.prisonGuard && n > 0) {
    const u = makeTroop(s.faction, fac.bandit ? 'pillard' : 'veteran', s.prisonGuard.x, s.prisonGuard.z, { guardOf: s, title: 'Gardien' });
    u.home = { x: s.prisonGuard.x, z: s.prisonGuard.z, yaw: 0 };
    s.guards.push(u);
  }
}
function addGuard(s, i) {
  const fac = F(s.faction);
  const spots = [
    [s.gate - 0.12, s.r - 3], [s.gate + 0.12, s.r - 3], [s.gate, s.r - 9],
    [s.gate + Math.PI, 8], [s.gate + Math.PI / 2, s.r - 6], [s.gate - Math.PI / 2, s.r - 6],
  ];
  const [a, r] = spots[i % spots.length];
  const x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
  const troop = fac.bandit ? 'pillard' : (i === 2 || i === 3 ? 'archer' : 'veteran');
  const u = makeTroop(s.faction, troop, x, z, { guardOf: s, title: 'Garde' });
  const used = new Set((s.guards || []).map(g => g.pid));
  const m = garrisonPeople(s).find(m => !used.has(m.id));
  if (m) { bindUnit(u, m); if (!m.epithet) u.title = `Garde · ${rankLabel(m)}`; }
  u.home = { x, z, yaw: Math.atan2(Math.cos(s.gate), Math.sin(s.gate)) };
  s.guards.push(u);
}
function despawnGuards(s) {
  for (const u of s.guards || []) if (!u.dead) removeUnit(u);
  s.guards = [];
  s.guardsMat = false;
}
function updateGarrisons(dt) {
  for (const s of state.settlements) {
    const near = player && d2(s, player.pos) < 210;
    if (near && !s.guardsMat) spawnGuards(s);
    else if (!near && s.guardsMat) despawnGuards(s);
    if (!s.guardsMat) continue;
    // renforts seulement en temps de calme, et seulement s'il reste des soldats dans la ville
    const posted = s.guards.filter(u => !u.dead && !u.rank).length;
    const fighting = units.some(u => alive(u) && !u.civil && d2(u.pos, s) < s.r + 35 && hostileF(u.faction, s.faction));
    if (!fighting && posted < Math.min(s.garrison, 6)) {
      s.reinforce = (s.reinforce || 0) + dt;
      if (s.reinforce > 45) { s.reinforce = 0; addGuard(s, s.guards.length); logMsg(`Une relève de gardes prend son poste à ${s.name}.`); }
    } else s.reinforce = 0;
    // assaut en direct : une armée ennemie dans les murs et plus de garnison
    if (s.garrison <= 0) {
      const army = state.parties.find(p => p.mat && p.kind === 'army' && hostileF(p.faction, s.faction) &&
        p.units.some(u => alive(u) && d2(u.pos, s) < s.r));
      if (army) {
        const survivors = army.units.filter(alive).length;
        removeParty(army);
        captureSettlement(s, army.faction, Math.max(2, survivors));
      }
    }
  }
}

// ---------- Mise à jour des groupes ----------
function partyThink(p) {
  const f = F(p.faction);
  const power = partyPower(p);
  if (p.kind === 'army') {
    const t = state.settlements.find(s => s.name === p.target);
    if (!t || !hostileF(p.faction, t.faction)) {
      p.kind = 'patrol'; p.name = partyName(p);
      const h = nearestSettlement(p, s => s.faction === p.faction);
      p.home = h ? h.name : null;
    } else p.dest = { x: t.x, z: t.z };
    return;
  }
  if (p.kind === 'caravan' || p.kind === 'travel') return;
  // chasse un groupe ennemi plus faible à proximité
  let prey = null, bd = p.kind === 'bandits' ? 70 : 90;
  for (const q of state.parties) {
    if (q === p || !hostileF(p.faction, q.faction)) continue;
    const d = d2(p, q);
    if (d < bd && partyPower(q) < power * (p.kind === 'bandits' ? 0.9 : 1.2)) { bd = d; prey = q; }
  }
  if (prey) { p.dest = { x: prey.x, z: prey.z }; return; }
  // ou rôde
  const home = state.settlements.find(s => s.name === p.home);
  const cx = home && p.kind === 'patrol' ? home.x : p.x, cz = home && p.kind === 'patrol' ? home.z : p.z;
  const radius = p.kind === 'patrol' ? 150 : 90;
  for (let i = 0; i < 20; i++) {
    const nx = clamp(cx + rand(-radius, radius), -HALF + 20, HALF - 20), nz = clamp(cz + rand(-radius, radius), -HALF + 20, HALF - 20);
    if (!nearSettlement(nx, nz, f.bandit ? 50 : 15)) { p.dest = { x: nx, z: nz }; break; }
  }
}

function updateParties(dt) {
  for (const p of [...state.parties]) {
    if (!state.parties.includes(p)) continue;
    const f = F(p.faction);
    if (!f || !f.alive) { removeParty(p); continue; }
    p.timer -= dt;
    if (p.timer <= 0) { p.timer = rand(5, 10); partyThink(p); }
    if (p.mat) {
      const leader = p.units.find(alive);
      if (!leader) {
        if (p.kind === 'army') { addChronicle(`L'armée ${f.of} a été anéantie ${placeName(p)}.`, '⚔'); if (p.general) releaseGeneral(p, true); }
        removeParty(p);
        continue;
      }
      p.x = leader.pos.x; p.z = leader.pos.z;
      if (player && d2(p, player.pos) > DESPAWN_DIST) dematerialize(p);
    } else {
      const dx = p.dest.x - p.x, dz = p.dest.z - p.z, d = Math.hypot(dx, dz);
      const speed = p.kind === 'army' ? 2.6 : 2.3;
      if (d > 1) { const st = Math.min(d, speed * dt); p.x += dx / d * st; p.z += dz / d * st; }
      if (player && state.mode === 'play' && d2(p, player.pos) < SPAWN_DIST) materialize(p);
    }
    if (!p.troops.length && !p.mat) { removeParty(p); continue; }
    // arrivée
    if (p.kind === 'travel' && d2(p, p.dest) < 8) { travelArrive(p); removeParty(p); continue; }
    if (p.kind === 'caravan') {
      if (p.arrived != null) {
        p.arrived -= dt;
        if (p.arrived <= 0) { if (!p.mat) membersSettle(p, settlementByName(p.home), 'soldat'); removeParty(p); continue; }
      } else if (d2(p, p.dest) < 8) {
        caravanArrive(p);
        if (!p.mat) { membersSettle(p, settlementByName(p.home), 'soldat'); removeParty(p); continue; }
        const dst = settlementByName(p.target);
        p.arrived = 10;
        if (dst) p.dest = { x: dst.x, z: dst.z };
      }
    }
    if (p.kind === 'army') {
      const t = state.settlements.find(s => s.name === p.target);
      if (t && d2(p, t) < t.r + 6 && (!p.mat || !t.guardsMat)) siege(p, t);
    }
  }
  // batailles automatiques entre groupes hors de vue
  const off = state.parties.filter(p => !p.mat);
  for (let i = 0; i < off.length; i++) {
    for (let j = i + 1; j < off.length; j++) {
      const a = off[i], b = off[j];
      if (!state.parties.includes(a) || !state.parties.includes(b)) continue;
      if (d2(a, b) < 8 && hostileF(a.faction, b.faction)) autoBattle(a, b);
    }
  }
}

// ---------- Naissance des groupes ----------
function spawnTick() {
  if (state.parties.length > 45) return;
  for (const f of majorFactions()) {
    const own = settlementsOf(f.id);
    const ps = partiesOf(f.id);
    if (own.length && ps.filter(p => p.kind === 'patrol').length < own.length + 1 && Math.random() < 0.5) spawnPatrol(f.id);
    if (own.length && ps.filter(p => p.kind === 'caravan').length < own.length + 1 && Math.random() < 0.5) planCaravan(f.id);
    const banditTowns = state.settlements.some(s => F(s.faction).bandit && s.type !== 'repaire');
    if ((enemiesOf(f.id).length || banditTowns) && !ps.some(p => p.kind === 'army') && Math.random() < 0.12) raiseArmy(f.id);
  }
  for (const f of aliveFactions().filter(f => f.bandit)) {
    if (!partiesOf(f.id).some(p => p.kind === 'army') && Math.random() < 0.04) raiseRaid(f.id);
  }
  for (const f of aliveFactions().filter(f => f.bandit)) if (partiesOf(f.id).length < (f.id === 'bandits' ? 7 : 5)) spawnBandits(null, f.id);
}

// ---------- Événements mondiaux ----------
const WAR_REASONS = ["après le pillage d'une caravane", 'pour le contrôle des mines', "à la suite d'un assassinat",
  'pour une dette jamais payée', 'après une insulte à son chef', 'pour des terres fertiles', 'pour le commerce du sel'];

function createFaction(parent, place) {
  const used = new Set(aliveFactions().map(f => f.map));
  let f;
  for (let i = 0; i < 10; i++) { f = genFaction(Math.random, { place }); if (!used.has(f.map)) break; }
  f.founded = state.day;
  f.parent = parent ? parent.id : null;
  state.factions[f.id] = f;
  state.rep[f.id] = parent ? (state.rep[parent.id] || 0) : 0;
  ensureHierarchy(f);
  for (const o of majorFactions()) {
    if (o.id === f.id) continue;
    setRelation(f.id, o.id, 'peace');
  }
  if (parent) setRelation(f.id, parent.id, 'war');
  return f;
}

function eventSplit(forced) {
  if (majorFactions().length >= 9) return false;
  const candidates = majorFactions().filter(f => settlementsOf(f.id).length >= 2);
  if (!candidates.length) return false;
  const parent = forced && candidates.includes(forced) ? forced : pick(candidates);
  const towns = settlementsOf(parent.id).filter(s => !s.capital);
  const s = pick(towns.length ? towns : settlementsOf(parent.id).slice(1));
  if (!s) return false;
  const f = createFaction(parent, s.name);
  despawnGuards(s);
  despawnTownCivilians(s);
  setOwner(s, f.id);
  s.capital = true;
  addChronicle(`Scission ! ${s.name} se soulève contre ${parent.of} : ${f.leader} fonde ${theF(f)}.`, '🔥');
  spawnPatrol(f.id);
  return true;
}

function eventNewFaction() {
  if (majorFactions().length >= 8) return false;
  let spot = null;
  for (let i = 0; i < 80 && !spot; i++) {
    const x = rand(-HALF + 70, HALF - 70), z = rand(-HALF + 70, HALF - 70);
    if (elevAt(x, z) < 0.6 && !state.settlements.some(s => Math.hypot(x - s.x, z - s.z) < 170) &&
      !state.nodes.some(n => Math.hypot(x - n.x, z - n.z) < 40) &&
      !(player && Math.hypot(x - player.pos.x, z - player.pos.z) < 90)) spot = { x, z };
  }
  if (!spot) return false;
  const place = genName();
  const f = createFaction(null, place);
  makeSettlement({ name: place, x: spot.x, z: spot.z, faction: f.id, type: 'camp', capital: true, garrison: 5, pop: randInt(50, 80) });
  for (const n of state.nodes) if (!n.owner && d2(n, spot) < 200) { n.owner = place; refreshNodeFlag(n); }
  const near = nearestSettlement(spot, s => s.faction !== f.id && !F(s.faction).bandit);
  const war = near && Math.random() < 0.3;
  if (war) setRelation(f.id, near.faction, 'war');
  addChronicle(`${f.leader} fonde ${place} et proclame ${theF(f)}.` + (war ? ` La guerre éclate avec ${theF(F(near.faction))}.` : ''), '🏴');
  spawnPatrol(f.id); spawnPatrol(f.id);
  return true;
}

function eventWar() {
  const pairs = [];
  const fs = majorFactions();
  // au plus une guerre à la fois entre grandes factions
  const warring = fs.filter(f => fs.some(o => o !== f && atWar(f.id, o.id)));
  if (warring.length) return false;
  for (const a of fs) for (const b of fs) if (a.id < b.id && !atWar(a.id, b.id)) pairs.push([a, b]);
  if (!pairs.length) return false;
  const [a, b] = pick(pairs);
  setRelation(a.id, b.id, 'war');
  addChronicle(`${theF(a, true)} ${vb(a, 'déclare', 'déclarent')} la guerre ${toF(b)} ${pick(WAR_REASONS)} !`, '⚔');
  return true;
}

function eventPeace() {
  const pairs = [];
  const fs = majorFactions();
  for (const a of fs) for (const b of fs) {
    if (a.id < b.id && atWar(a.id, b.id) && (state.clock || 0) - (state.warSince[relKey(a.id, b.id)] || 0) > 100) pairs.push([a, b]);
  }
  if (!pairs.length) return false;
  const [a, b] = pick(pairs);
  setRelation(a.id, b.id, 'peace');
  addChronicle(`${theF(a, true)} et ${theF(b)} signent la paix. Pour combien de temps ?`, '🕊');
  return true;
}

function eventEconomy() {
  const s = pick(state.settlements);
  const r = Math.random();
  if (r < 0.3) {
    s.stock.food += 120;
    addChronicle(`Récolte record à ${s.name} : les céréales débordent des greniers.`, '🌾');
  } else if (r < 0.55) {
    const g = pick(TRADE_GOODS);
    s.stock[g] = Math.floor(s.stock[g] * 0.2);
    addChronicle(`Pénurie de ${GOODS[g].name.toLowerCase()} à ${s.name} : un entrepôt a brûlé.`, '🔥');
  } else if (r < 0.75) {
    const mines = state.nodes.filter(n => n.owner && n.disabled <= 0);
    if (!mines.length) return false;
    const n = pick(mines);
    n.disabled = 3;
    addChronicle(`Accident : ${RESOURCES[n.type].name.toLowerCase()} près ${deN(nearestSettlement(n).name)} est à l'arrêt pour 3 jours.`, '⚠');
  } else {
    s.pop = Math.round(s.pop * 0.85);
    addChronicle(`Une fièvre frappe ${s.name}. La population diminue.`, '🤒');
  }
  return true;
}

function eventRaidNode() {
  const mine = state.nodes.filter(n => n.owner === 'player' && n.stock > 5 && !nodeWorkers(n).length);
  if (!mine.length) return false;
  const n = pick(mine);
  const lost = Math.round(n.stock);
  n.stock = 0;
  addChronicle(`Des pillards ont vidé ton exploitation (${RESOURCES[n.type].name.toLowerCase()}) : ${lost} ${GOODS[RESOURCES[n.type].good].name.toLowerCase()} perdus. Place des compagnons pour la garder.`, '🐺');
  return true;
}

function eventRaid() {
  const s = pick(state.settlements);
  const a = rand(0, Math.PI * 2);
  const pt = { x: clamp(s.x + Math.cos(a) * 110, -HALF + 20, HALF - 20), z: clamp(s.z + Math.sin(a) * 110, -HALF + 20, HALF - 20) };
  const p = makeParty('bandits', 'bandits', pt.x, pt.z, rollTroops('bandits', randInt(6, 9), 'bandits'));
  p.dest = { x: pt.x, z: pt.z };
  addChronicle(`${F('bandits').leader} lance une grande razzia près ${deN(s.name)}. Voyageurs, méfiez-vous.`, '🐺');
  return true;
}

function checkExtinctions() {
  for (const f of majorFactions()) {
    if (!settlementsOf(f.id).length && !partiesOf(f.id).length) {
      f.alive = false;
      f.died = state.day;
      addChronicle(`${theF(f, true)} ${vb(f, 'a', 'ont')} disparu.`, '💀');
      if (state.allegiance === f.id) { state.allegiance = null; refreshPlayerDress(); }
    }
  }
}

function worldEvent() {
  checkExtinctions();
  const r = Math.random();
  let ok = false;
  // le monde reste globalement stable : les guerres sont rares, la paix revient
  if (r < 0.07) ok = eventWar();
  else if (r < 0.30) ok = eventPeace();
  else if (r < 0.35) ok = eventSplit();
  else if (r < 0.41) ok = eventNewFaction();
  else if (r < 0.83) ok = eventEconomy();
  else ok = Math.random() < 0.5 ? eventRaidNode() || eventRaid() : eventRaid();
  if (!ok) eventEconomy();
}

function updateWorld(dt) {
  state.clock = (state.clock || 0) + dt;
  updateParties(dt);
  updateGarrisons(dt);
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) { state.spawnTimer = 8; spawnTick(); }
  state.eventTimer -= dt;
  if (state.eventTimer <= 0) { state.eventTimer = rand(110, 180); worldEvent(); }
  state.garrisonTimer -= dt;
  if (state.garrisonTimer <= 0) {
    state.garrisonTimer = 60;
    // la garnison se reconstitue avec les habitants qui s'enrôlent (pas de soldats tombés du ciel)
    for (const s of state.settlements) {
      if (s.garrison >= (s.type === 'ville' ? 10 : 6) || s.guardsMat && units.some(u => alive(u) && !u.civil && d2(u.pos, s) < s.r + 35 && hostileF(u.faction, s.faction))) continue;
      const rec = people().find(m => m.alive && !m.party && m.loc === s.name && ['habitant', 'ouvrier'].includes(m.job));
      if (rec || s.type === 'repaire') { if (rec) { rec.job = F(s.faction).bandit ? 'bandit' : 'soldat'; rec.faction = s.faction; rec.node = null; } s.garrison++; }
    }
    promoteGenerals();
  }
  updateEconomy(dt);
}

// premier peuplement du monde
function populateWorld() {
  generatePeople();
  for (const f of majorFactions()) { spawnPatrol(f.id); spawnPatrol(f.id); spawnCaravan(f.id); }
  for (let i = 0; i < 5; i++) spawnBandits();
  for (let i = 0; i < 4; i++) spawnBandits(null, 'cannibales');
  for (let i = 0; i < 3; i++) { spawnBandits(null, 'racket'); spawnBandits(null, 'esclavagistes'); }
  for (const f of majorFactions()) ensureHierarchy(f);
  for (let i = 0; i < 5; i++) recordHistory();
  for (const k in state.relations) {
    if (state.relations[k] === 'war') {
      const [a, b] = k.split('|').map(F);
      addChronicle(`${theF(a, true)} et ${theF(b)} sont en guerre.`, '⚔');
    }
  }
}
