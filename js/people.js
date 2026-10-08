// Terres Arides — habitants persistants : chaque PNJ a une vie même hors de vue.
// Métiers, richesse, prestige, grades ; ils s'enrôlent, voyagent, deviennent mercenaires ou bandits, rachètent des commerces.
'use strict';

const JOBS = {
  habitant: 'Habitant', ouvrier: 'Ouvrier', artisan: 'Artisan', marchand: 'Marchand', soldat: 'Soldat',
  mercenaire: 'Mercenaire', bandit: 'Bandit', voyageur: 'Voyageur', compagnon: 'Compagnon',
};
const EPITHETS = ['le Boucher', 'la Lame', "l'Implacable", 'le Borgne', 'Main-Rouge', 'le Chacal', 'la Hyène', 'Brise-Os',
  'le Balafré', 'Cœur-de-Fer', 'le Silencieux', 'la Vipère', 'le Sanglant', 'Sans-Pitié', 'le Faucon', 'Crocs-Noirs'];
// grades selon le prestige
const RANKS = [
  { min: 0, soldat: 'Recrue', bandit: 'Pillard' },
  { min: 4, soldat: 'Vétéran', bandit: 'Brigand aguerri' },
  { min: 10, soldat: 'Sergent', bandit: 'Lieutenant' },
  { min: 20, soldat: 'Champion', bandit: 'Seigneur de guerre' },
];
const rankOf = p => RANKS.reduce((r, x, i) => (p.fame >= x.min ? i : r), 0);
const rankLabel = p => {
  const r = RANKS[rankOf(p)];
  return p.job === 'bandit' ? r.bandit : p.job === 'soldat' ? r.soldat : JOBS[p.job] || '';
};
const personName = p => p.epithet ? `${p.name} « ${p.epithet} »` : p.name;

const people = () => state.people || (state.people = []);
const personById = id => (state.peopleIdx || {})[id] || null;
function indexPeople() { state.peopleIdx = {}; for (const p of people()) state.peopleIdx[p.id] = p; }

function newPerson(o = {}) {
  const lvl = o.lvl != null ? o.lvl : randInt(3, 18);
  const p = {
    id: uid(), name: o.name || genPerson(), home: o.home || null, loc: o.loc || o.home || null,
    job: o.job || 'habitant', faction: o.faction || null, wealth: o.wealth != null ? o.wealth : randInt(5, 60),
    fame: o.fame || 0, kills: 0, alive: true, epithet: null, party: null, shop: null, node: null,
    courage: Math.random(), greed: Math.random(), born: state.day || 1,
    skills: { forge: 0, couture: 0, bois: 0, recolte: randInt(0, 20), crochetage: 0, ...baseCombat(lvl), ...(o.skills || {}) },
  };
  people().push(p);
  if (state.peopleIdx) state.peopleIdx[p.id] = p;
  return p;
}

// ---------- Génération ----------
function generatePeople() {
  state.people = [];
  indexPeople();
  for (const s of state.settlements) {
    if (s.type === 'repaire') continue;
    const ville = s.type === 'ville';
    // commerçants : chaque boutique a un propriétaire
    s.services.forEach((v, i) => {
      if (v.type === 'marche' || v.type === 'palais' || v.type === 'caserne' || v.type === 'prison') return;
      const craft = { forge: 'forge', tailleur: 'couture', atelier: 'bois' }[v.type];
      const p = newPerson({ name: v.keeper, home: s.name, job: craft ? 'artisan' : 'marchand', faction: s.faction,
        wealth: randInt(150, 450), skills: craft ? { [craft]: randInt(25, 60) } : {} });
      p.shop = `${s.name}|${i}`;
      v.owner = p.id;
    });
    // soldats de la garnison
    for (let i = 0; i < s.garrison; i++) newPerson({ home: s.name, job: 'soldat', faction: s.faction, lvl: randInt(15, 35), fame: randInt(0, 6), wealth: randInt(10, 60) });
    // habitants, ouvriers, mercenaires
    for (let i = 0; i < (ville ? 10 : 5); i++) newPerson({ home: s.name, job: Math.random() < 0.5 ? 'ouvrier' : 'habitant', faction: s.faction });
    if (ville) for (let i = 0; i < randInt(2, 4); i++) newPerson({ home: s.name, job: 'mercenaire', faction: null, lvl: randInt(15, 40), wealth: randInt(10, 50) });
  }
  // les ouvriers sont rattachés aux exploitations de leur ville
  for (const n of state.nodes) {
    const s = settlementByName(n.owner);
    if (!s) continue;
    const free = people().filter(p => p.job === 'ouvrier' && p.loc === s.name && p.node == null);
    free.slice(0, 3).forEach(p => { p.node = state.nodes.indexOf(n); });
  }
}

// après un chargement : les boutiques retrouvent leur propriétaire
function relinkShops() {
  for (const p of people()) {
    if (!p.alive || !p.shop) continue;
    const sv = shopService(p);
    if (sv && sv.v) { sv.v.owner = p.id; sv.v.keeper = p.name; }
  }
}

// ---------- Lien avec les unités visibles ----------
// une unité incarne une personne : même nom, mêmes compétences (le même objet), même prestige
function bindUnit(u, p) {
  if (!u || !p) return u;
  u.pid = p.id;
  u.name = p.name;
  p.skills = Object.assign(u.skills, p.skills);
  u.skills = p.skills;
  u.maxHp += Math.round(sk(u, 'endurance') * 0.6);
  u.hp = u.maxHp;
  u.level = levelOf(u);
  if (p.epithet) u.title = p.epithet;
  else if (p.job === 'soldat' || p.job === 'bandit') u.title = rankLabel(p);
  return u;
}
const personOf = u => (u && u.pid ? personById(u.pid) : null);

// membres d'un groupe : un identifiant de personne par soldat
function partyMembers(p) {
  if (!p.members) p.members = [];
  const job = p.kind === 'travel' ? 'voyageur' : F(p.faction) && F(p.faction).bandit ? 'bandit' : p.kind === 'caravan' ? 'soldat' : 'soldat';
  const lvlFor = t => ({ recrue: 10, archer: 16, pillard: 12, veteran: 32, chef: 42, general: 55, voyageur: 6 }[t] || 15);
  p.troops.forEach((t, i) => {
    let m = p.members[i] && personById(p.members[i]);
    if (!m || !m.alive) {
      m = newPerson({ job, faction: p.faction, lvl: lvlFor(t), fame: t === 'veteran' ? randInt(4, 8) : t === 'chef' ? randInt(10, 16) : t === 'general' ? randInt(20, 30) : randInt(0, 3), wealth: randInt(5, 40) });
      p.members[i] = m.id;
    }
    m.party = p.id; m.loc = null;
  });
  p.members.length = p.troops.length;
  return p.members;
}
function membersDie(p, n) {
  const ms = partyMembers(p);
  for (let i = 0; i < n && i < ms.length; i++) personDies(personById(ms[i]));
  ms.splice(0, n);
}
// le groupe se disperse : les survivants vont dans une ville
function membersSettle(p, town, job) {
  for (const id of p.members || []) {
    const m = personById(id);
    if (!m || !m.alive) continue;
    m.party = null; m.loc = town ? town.name : m.home;
    if (job) m.job = job;
    if (town && job === 'soldat') m.faction = town.faction;
  }
  p.members = [];
}
function personDies(m, by) {
  if (!m || !m.alive) return;
  m.alive = false; m.party = null;
  if (m.shop) shopVacant(m);
  if (m.fame >= 15) addChronicle(`${personName(m)}, ${rankLabel(m).toLowerCase()} redouté${by ? `, est tombé sous les coups de ${by.name}` : ', est mort'}.`, '⚰');
}

// ---------- Prestige et grades ----------
function addFame(p, gain) {
  p.fame += gain;
  if (!p.epithet && p.fame >= 15) {
    p.epithet = pick(EPITHETS);
    const f = F(p.faction);
    addChronicle(`On murmure le nom de ${personName(p)}${f ? `, ${f.bandit ? 'brigand' : 'soldat'} ${f.of}` : ''} : ${p.kills} victimes déjà.`, '💀');
    return true;
  }
  return false;
}
function gainFame(u, victim, ko) {
  const p = personOf(u);
  if (!p || !victim) return;
  const vp = personOf(victim);
  const gain = (victim.animal ? 0.4 : 1) * (ko ? 0.7 : 1) + (vp ? vp.fame * 0.25 : victim.rank === 'general' ? 6 : 0) + (victim.isPlayer ? 3 : 0);
  const before = rankOf(p);
  p.kills += 1;
  const named = addFame(p, gain);
  const after = rankOf(p);
  if (named) { u.title = p.epithet; refreshLabel(u); }
  if (after > before) {
    u.title = rankLabel(p);
    if (u.troop === 'recrue' || u.troop === 'pillard') u.troop = p.job === 'bandit' ? 'chef' : 'veteran';
    refreshLabel(u);
    if (player && d2(u.pos, player.pos) < 40) floatText(u.pos, `↑ ${rankLabel(p)}`, '#ffcf6a');
  }
}

// ---------- Commerces ----------
function shopService(m) {
  if (!m.shop) return null;
  const [town, i] = m.shop.split('|');
  const s = settlementByName(town);
  return s ? { s, v: s.services[Number(i)] } : null;
}
function shopVacant(m) {
  const sv = shopService(m);
  m.shop = null;
  if (!sv || !sv.v) return;
  // le plus riche des habitants rachète l'affaire
  const buyer = people().filter(p => p.alive && p.loc === sv.s.name && !p.party && !p.shop && ['habitant', 'ouvrier', 'marchand', 'artisan', 'mercenaire'].includes(p.job))
    .sort((a, b) => b.wealth - a.wealth)[0];
  if (buyer) {
    buyer.shop = `${sv.s.name}|${sv.s.services.indexOf(sv.v)}`;
    buyer.job = ['forge', 'tailleur', 'atelier'].includes(sv.v.type) ? 'artisan' : 'marchand';
    buyer.wealth = Math.max(0, buyer.wealth - 150);
    sv.v.owner = buyer.id; sv.v.keeper = buyer.name;
    addChronicle(`${buyer.name} rachète ${sv.v.name.split(' de ')[0].toLowerCase()} de ${m.name} à ${sv.s.name}.`, '🏪');
    sv.v.name = sv.v.type === 'auberge' ? sv.v.name : `${SERVICE_NAMES[sv.v.type]} de ${buyer.name.split(' ')[0]}`;
  } else { sv.v.owner = null; sv.v.keeper = 'Un commis'; }
}

// ---------- Vie quotidienne (hors de vue) ----------
const INCOME = { habitant: 1, ouvrier: 3, artisan: 6, marchand: 7, soldat: 4, mercenaire: 0, bandit: 0, voyageur: 0, compagnon: 0 };
function peopleTick() {
  const list = people();
  if (!list.length) return;
  let news = 0;
  for (let k = 0; k < 14; k++) {
    const p = pick(list);
    if (!p.alive || p.party || p.job === 'compagnon') continue;
    const s = settlementByName(p.loc);
    if (!s) continue;
    // revenus et dépenses
    let inc = INCOME[p.job] || 0;
    if (p.shop) inc += Math.round(s.pop / 60);
    if (p.job === 'ouvrier' && p.node != null && state.nodes[p.node] && state.nodes[p.node].disabled > 0) inc = 0;
    p.wealth = Math.max(0, p.wealth + inc - 2);
    // les artisans progressent dans leur métier
    if (p.job === 'artisan') for (const c of ['forge', 'couture', 'bois']) if (p.skills[c] > 0) p.skills[c] = Math.min(100, p.skills[c] + 0.1);
    const f = F(s.faction);
    const hungry = s.stock.food < targetStock(s, 'food') * 0.3;
    const r = Math.random();
    // la misère pousse au brigandage
    if (['habitant', 'ouvrier'].includes(p.job) && p.wealth < 12 && p.greed > 0.55 && r < (hungry ? 0.35 : 0.12)) {
      if (joinBandits(p, s) && news++ < 1) addChronicle(`Ruiné${hungry ? ' et affamé' : ''}, ${p.name} quitte ${s.name} pour rejoindre ${theF(F(p.faction))}.`, '🐺');
      continue;
    }
    // le courage pousse à l'enrôlement
    if (['habitant', 'ouvrier'].includes(p.job) && p.courage > 0.6 && f && !f.bandit && r < 0.15) {
      if (enlist(p, s) && news++ < 1 && Math.random() < 0.3) addChronicle(`${p.name} s'enrôle dans les troupes ${f.of} à ${s.name}.`, '🛡');
      continue;
    }
    // les plus solides se vendent comme mercenaires
    if (p.job === 'habitant' && (sk(p, 'attaque') > 22 || p.courage > 0.75) && p.wealth < 40 && r < 0.12) { p.job = 'mercenaire'; p.faction = null; continue; }
    // les chômeurs cherchent du travail dans les exploitations
    if (p.job === 'habitant' && r < 0.2) {
      const n = state.nodes.find(n => n.owner === s.name && people().filter(o => o.alive && o.node === state.nodes.indexOf(n)).length < 3);
      if (n) { p.job = 'ouvrier'; p.node = state.nodes.indexOf(n); continue; }
    }
    // les riches sans commerce rachètent une boutique vacante
    if (!p.shop && p.wealth > 250) {
      const v = s.services.find(v => v.owner === null);
      if (v) { p.wealth -= 200; p.shop = `${s.name}|${s.services.indexOf(v)}`; p.job = 'marchand'; v.owner = p.id; v.keeper = p.name; addChronicle(`${p.name} ouvre ${v.name.toLowerCase()} à ${s.name}.`, '🏪'); continue; }
    }
    // départ en voyage (mercenaires surtout, ou ceux qui cherchent une vie meilleure)
    const travelChance = p.job === 'mercenaire' ? (s.type === 'ville' ? 0.05 : 0.4) : p.shop || p.job === 'soldat' ? 0 : 0.03;
    if (r < travelChance) travel(p, s);
  }
}
function joinBandits(p, s) {
  const fid = p.greed > 0.85 && F('esclavagistes') && F('esclavagistes').alive ? 'esclavagistes' : 'bandits';
  if (!F(fid) || !F(fid).alive) return false;
  p.job = 'bandit'; p.faction = fid; p.node = null;
  if (p.shop) shopVacant(p);
  // rejoint une bande hors de vue, ou en fonde une près du repaire
  let band = state.parties.find(q => !q.mat && q.faction === fid && q.kind === 'bandits' && q.troops.length < 8 && d2(q, s) < 500);
  if (!band) band = spawnBandits(null, fid);
  if (!band) return false;
  partyMembers(band);
  band.troops.push('pillard'); band.members.push(p.id);
  p.party = band.id; p.loc = null;
  return true;
}
function enlist(p, s) {
  p.job = 'soldat'; p.faction = s.faction; p.node = null;
  const max = s.type === 'ville' ? 10 : 6;
  if (s.garrison < max) { s.garrison++; return true; }
  const pat = state.parties.find(q => !q.mat && q.faction === s.faction && q.kind === 'patrol' && q.home === s.name && q.troops.length < 8);
  if (pat) { partyMembers(pat); pat.troops.push('recrue'); pat.members.push(p.id); p.party = pat.id; p.loc = null; }
  return true;
}
function travel(p, s) {
  const dests = state.settlements.filter(o => o !== s && o.type !== 'repaire' && !F(o.faction).bandit && d2(o, s) < 700 && (p.job !== 'mercenaire' || o.type === 'ville'));
  if (!dests.length) return;
  const dst = pick(dests);
  const group = [p, ...people().filter(o => o !== p && o.alive && !o.party && o.loc === s.name && o.job === p.job && !o.shop && o.job !== 'soldat').slice(0, randInt(0, 2))];
  const g = gatePos(s, -8);
  const q = makeParty(s.faction, 'travel', g.x, g.z, group.map(() => 'voyageur'), { home: s.name, target: dst.name, dest: gatePos(dst, -6) });
  q.members = group.map(m => m.id);
  q.name = `Voyageurs ${F(s.faction).of}`;
  for (const m of group) { m.party = q.id; m.loc = null; m.node = null; m.prevJob = m.job; }
}
function travelArrive(q) {
  const dst = settlementByName(q.target);
  for (const id of q.members || []) {
    const m = personById(id);
    if (!m || !m.alive) continue;
    m.party = null; m.loc = dst ? dst.name : m.home;
    m.job = m.prevJob === 'mercenaire' ? 'mercenaire' : 'habitant';
    if (dst && m.job !== 'mercenaire') m.faction = dst.faction;
  }
  q.members = [];
}

// ---------- Renommés : une vraie menace peut fonder sa propre bande ----------
function renownTick() {
  const famous = people().filter(p => p.alive && p.job === 'bandit' && p.fame >= 15 && !p.leads);
  for (const p of famous.slice(0, 1)) {
    const q = state.parties.find(x => x.id === p.party);
    if (!q || q.mat) continue;
    const i = q.members.indexOf(p.id);
    if (i <= 0) { p.leads = q.id; continue; } // déjà en tête
    q.members.splice(i, 1); q.troops.splice(i, 1);
    const band = makeParty(p.faction, 'bandits', q.x + rand(-20, 20), q.z + rand(-20, 20), ['chef', ...rollTroops(p.faction, randInt(4, 7), 'bandits')]);
    partyMembers(band);
    personDies(personById(band.members[0]));
    band.members[0] = p.id;
    band.name = `Bande de ${personName(p)}`;
    p.party = band.id; p.leads = band.id;
    addChronicle(`${personName(p)} réunit sa propre bande. Les routes deviennent dangereuses.`, '💀');
  }
}

// ---------- Mercenaires de la taverne ----------
function tavernMercs(s) {
  return people().filter(p => p.alive && p.loc === s.name && !p.party && p.job === 'mercenaire');
}
const mercPrice = p => Math.round(60 + (sk(p, 'attaque') + sk(p, 'defense')) * 2.5 + p.fame * 10);

// figures les plus redoutées du monde
const notables = (n = 8) => people().filter(p => p.alive && p.fame >= 6).sort((a, b) => b.fame - a.fame).slice(0, n);

function updatePeople(dt) {
  if (!state.people) return;
  if (!state.peopleIdx) indexPeople();
  state.peopleTimer = (state.peopleTimer || 0) - dt;
  if (state.peopleTimer <= 0) { state.peopleTimer = 12; peopleTick(); renownTick(); }
}
