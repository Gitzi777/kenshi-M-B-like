// Terres Arides — interface : HUD, ville, inventaire, fouille, carte du monde, création, sauvegarde.
'use strict';

const $ = id => document.getElementById(id);

// ---------- Messages ----------
function logMsg(text, kind = '') {
  const log = $('log');
  const d = document.createElement('div');
  d.textContent = text;
  if (kind) d.className = kind;
  log.appendChild(d);
  while (log.children.length > 7) log.removeChild(log.firstChild);
  setTimeout(() => d.remove(), kind === 'news' ? 14000 : 9000);
}
const floats = [];
function floatText(pos, text, color) {
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = text;
  el.style.color = color;
  $('floats').appendChild(el);
  floats.push({ el, p: new T.Vector3(pos.x + rand(-0.3, 0.3), pos.y + 2.2, pos.z), t: 1.2 });
}
const _proj = new T.Vector3();
function updateFloats(dt) {
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.t -= dt; f.p.y += dt * 0.8;
    if (f.t <= 0) { f.el.remove(); floats.splice(i, 1); continue; }
    _proj.copy(f.p).project(camera);
    if (_proj.z > 1) { f.el.style.display = 'none'; continue; }
    f.el.style.display = '';
    f.el.style.left = (_proj.x + 1) / 2 * window.innerWidth + 'px';
    f.el.style.top = (1 - _proj.y) / 2 * window.innerHeight + 'px';
    f.el.style.opacity = Math.min(1, f.t);
  }
}

// ---------- Poids et prix ----------
const weightUsed = () => Object.entries(state.goods).reduce((a, [g, n]) => a + GOODS[g].w * n, 0) +
  player.inv.reduce((a, id) => a + (ITEMS[id] ? ITEMS[id].w : 0), 0);
const weightMax = () => BASE_CARRY + squad().length * CARRY_PER_MEMBER;
const overloaded = () => player && weightUsed() > weightMax();
function price(s, g) {
  const buy = Math.max(1, Math.round(GOODS[g].base * s.mult[g] * s.fluct[g] * (state.allegiance === s.faction ? 0.85 : 1)));
  return { buy, sell: Math.max(1, Math.round(buy * 0.8)) };
}
const itemBuyPrice = (s, id) => Math.round(ITEMS[id].price * (state.allegiance === s.faction ? 0.8 : 1));
const itemSellPrice = id => Math.max(1, Math.round(ITEMS[id].price * 0.45));
const recruitCost = () => 80 + 50 * squad().length;
function repLabel(fid) {
  const f = F(fid);
  if (state.allegiance === fid) return ['Ton suzerain', 'good'];
  if (f.bandit || playerHostileTo(fid)) return ['Ennemi', 'bad'];
  const r = state.rep[fid] || 0;
  if (r < 0) return ['Méfiant', 'warn'];
  if (r < 15) return ['Neutre', ''];
  if (r < 40) return ['Ami', 'good'];
  return ['Allié', 'good'];
}
const relBadge = fid => { const [t, c] = repLabel(fid); return `<span class="badge ${c}">${t} (${Math.round(state.rep[fid] || 0)})</span>`; };

// ---------- HUD ----------
function renderHud() {
  $('money').textContent = state.money;
  $('food').textContent = state.goods.food;
  $('arrowsCount').textContent = state.goods.arrows;
  $('cargo').textContent = `${Math.round(weightUsed())}/${weightMax()}`;
  $('cargo').parentElement.classList.toggle('bad', overloaded());
  $('day').textContent = state.day;
  $('speed').textContent = state.timeScale > 1 ? `⏩ ×${state.timeScale}` : '';
  $('allegiance').innerHTML = state.allegiance ? `${flagImg(F(state.allegiance), 16)} ${esc(F(state.allegiance).name)}` : '';
  $('pName').textContent = player.name;
  $('pLevel').textContent = `niv ${player.level} · ⚔ ${damageOf(player)} · 🛡 ${armorOf(player)}`;
  $('pHp').style.width = Math.max(0, player.hp / player.maxHp * 100) + '%';
  $('pHpText').textContent = `${Math.ceil(Math.max(0, player.hp))} / ${player.maxHp} PV`;
  const w = player.mode === 'bow' && bowOf(player) ? `🏹 ${bowOf(player).name}` : `⚔ ${weaponOf(player).name}`;
  $('pWeapon').textContent = w + (player.equip.bow ? ' (X pour changer)' : '');
  const sq = squad();
  $('squadList').innerHTML = sq.length ? sq.map(u => `
    <div class="member">${esc(u.name)} <small>⚔ ${damageOf(u)} · 🛡 ${armorOf(u)}</small>
      <div class="bar"><div style="width:${Math.max(0, u.hp / u.maxHp * 100)}%"></div></div></div>`).join('')
    : '<small>Tu voyages seul. Recrute à la taverne.</small>';
  const orders = { follow: 'Ordre : suivez-moi', charge: 'Ordre : chargez !', hold: 'Ordre : tenez la position' };
  $('orderLabel').textContent = sq.length ? orders[state.order] : '';
  // invite d'action
  const pr = $('prompt');
  let txt = '';
  if (!state.panel && state.ko <= 0) {
    const corpse = nearCorpse();
    if (corpse) txt = `F : fouiller ${corpse.name}`;
    else if (state.currentTown) txt = `E : entrer dans ${state.currentTown.name}`;
  }
  pr.textContent = txt;
  pr.classList.toggle('hidden', !txt);
}

function nearCorpse() {
  let best = null, bd = 2.6;
  for (const u of units) {
    if (!u.dead || lootEmpty(u.loot)) continue;
    const d = d2(u.pos, player.pos);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

function updateIndicators() {
  const ind = $('dirInd');
  ind.dataset.dir = player.mode === 'bow' ? '' : mouseDir;
  let threat = null;
  for (const u of units) {
    if (!alive(u) || !u.atk || u.atk.hit || u.target !== player) continue;
    if (d2(u.pos, player.pos) < weaponOf(u).reach + 1.2) { threat = u.atk.dir; break; }
  }
  const th = $('threat');
  th.textContent = threat ? DIRS[threat] : '';
  th.dataset.dir = threat || '';
}

function drawMinimap() {
  const m = $('minimap');
  const g = m.getContext('2d');
  const S = m.width, R = 250, k = S / (2 * R);
  const px = player.pos.x, pz = player.pos.z;
  const toM = (x, z) => [S / 2 + (x - px) * k, S / 2 + (z - pz) * k];
  g.clearRect(0, 0, S, S);
  g.save();
  g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#b8955c'; g.fillRect(0, 0, S, S);
  for (const s of state.settlements) {
    const [x, y] = toM(s.x, s.z);
    g.fillStyle = F(s.faction).map;
    g.beginPath(); g.arc(x, y, s.type === 'ville' ? 7 : 5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1a1208'; g.stroke();
  }
  for (const p of state.parties) {
    if (p.mat) continue;
    const [x, y] = toM(p.x, p.z);
    g.fillStyle = F(p.faction).bandit ? '#7a0f0f' : F(p.faction).map;
    g.fillRect(x - 2.5, y - 2.5, 5, 5);
  }
  for (const u of units) {
    if (u.dead || u.isPlayer) continue;
    const [x, y] = toM(u.pos.x, u.pos.z);
    g.fillStyle = isPlayerSide(u) ? '#4fc3f7' : hostile(player, u) ? '#e53935' : F(u.faction).map;
    g.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  g.translate(S / 2, S / 2); g.rotate(-player.yaw);
  g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(0, 7); g.lineTo(4.5, -4); g.lineTo(-4.5, -4); g.closePath(); g.fill();
  g.restore();
}

// ---------- Panneaux ----------
function openPanel(name) {
  state.panel = name;
  if (document.pointerLockElement) document.exitPointerLock();
  for (const id of ['town', 'inventory', 'loot', 'worldmap']) $(id).classList.add('hidden');
  const el = $({ town: 'town', inv: 'inventory', loot: 'loot', map: 'worldmap' }[name]);
  el.classList.remove('hidden');
  renderPanel();
}
function closePanel() {
  state.panel = null;
  for (const id of ['town', 'inventory', 'loot', 'worldmap']) $(id).classList.add('hidden');
}
function togglePanel(name) { if (state.panel === name) closePanel(); else openPanel(name); }
function renderPanel() {
  if (state.panel === 'town') renderTown();
  else if (state.panel === 'inv') renderInventory();
  else if (state.panel === 'loot') renderLoot();
  else if (state.panel === 'map') renderMap();
}

// ---------- Ville ----------
state.townTab = 'marche';
function renderTown() {
  const s = state.currentTown;
  const el = $('town');
  if (!s) { closePanel(); return; }
  const f = F(s.faction);
  const tabs = [['marche', 'Marché'], ['armurier', 'Armurier'], ['taverne', 'Taverne'], ['faction', 'Faction']];
  let body = '';
  if (playerHostileTo(s.faction) && state.townTab !== 'faction') {
    body = `<p class="bad">Les marchands ${esc(f.of)} refusent de traiter avec un ennemi. Les gardes vont t'attaquer.</p>
      <p class="note">Va voir l'onglet Faction pour payer une amende.</p>`;
  } else if (state.townTab === 'marche') {
    let rows = '';
    for (const g in GOODS) {
      const p = price(s, g);
      const n = g === 'arrows' ? 10 : 1;
      rows += `<tr><td>${GOODS[g].icon} ${GOODS[g].name}${n > 1 ? ' ×10' : ''}</td><td>${state.goods[g]}</td>
        <td><button data-buy="${g}" ${state.money < p.buy * n ? 'disabled' : ''}>Acheter ${p.buy * n}</button></td>
        <td><button data-sell="${g}" ${state.goods[g] < n ? 'disabled' : ''}>Vendre ${p.sell * n}</button></td></tr>`;
    }
    body = `<table><tr><th>Marchandise</th><th>Sac</th><th></th><th></th></tr>${rows}</table>
      <div class="note">Ici, ${GOODS[s.produces].name.toLowerCase()} est bon marché et ${GOODS[s.demands].name.toLowerCase()} se vend cher. Maj + clic = ×5.</div>`;
  } else if (state.townTab === 'armurier') {
    const shop = f.shop.length ? f.shop : ['dague', 'machette', 'tunique', 'bandana'];
    body = `<h4>À vendre</h4><div class="items">${shop.map(id => `
      <div class="item"><span><b>${ITEMS[id].name}</b><small>${SLOT_NAMES[ITEMS[id].slot]} · ${itemStats(id)}</small></span>
        <button data-buyitem="${id}" ${state.money < itemBuyPrice(s, id) ? 'disabled' : ''}>${itemBuyPrice(s, id)} 💰</button></div>`).join('')}</div>
      <h4>Ton sac</h4><div class="items">${player.inv.length ? player.inv.map((id, i) => `
      <div class="item"><span><b>${ITEMS[id].name}</b><small>${itemStats(id)}</small></span>
        <button data-sellitem="${i}">Vendre ${itemSellPrice(id)} 💰</button></div>`).join('') : '<small>Rien à vendre. Fouille les corps (F) pour trouver du butin.</small>'}</div>`;
  } else if (state.townTab === 'taverne') {
    const cost = recruitCost();
    const full = squad().length + 1 >= MAX_SQUAD;
    const sworn = state.allegiance === s.faction;
    const rumors = state.chronicle.slice(-3).reverse().map(c => `<li>« ${esc(c.text)} »</li>`).join('');
    body = `<div class="note">Un mercenaire te suit et se bat pour toi. Escouade : ${squad().length + 1}/${MAX_SQUAD}</div>
      <button data-recruit ${state.money < cost || full ? 'disabled' : ''}>Recruter un mercenaire (${cost} 💰)</button>
      ${sworn ? `<button data-recruitvet ${state.money < 250 || full ? 'disabled' : ''}>Recruter un vétéran ${esc(f.of)} (250 💰)</button>` : ''}
      <button data-rest ${state.money < 10 ? 'disabled' : ''}>Dormir à l'auberge, tout le monde soigné (10 💰)</button>
      <h4>Rumeurs</h4><ul class="rumors">${rumors || '<li>Rien de neuf.</li>'}</ul>`;
  } else {
    body = factionDetail(f, true);
  }
  el.innerHTML = `
    <div class="phead">${flagImg(f, 26)}<div><h3>${esc(s.name)}</h3><small>${s.type === 'camp' ? 'Camp' : 'Ville'} ${esc(f.of)} · garnison ${s.garrison} · 💰 ${state.money}</small></div>
      <button class="x" data-close>✕</button></div>
    <div class="tabs">${tabs.map(([k, n]) => `<button class="${state.townTab === k ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div>
    <div class="pbody">${body}</div>`;
}

function factionDetail(f, inTown) {
  const rels = majorFactions().filter(o => o.id !== f.id)
    .map(o => `<li>${flagImg(o, 14)} ${esc(o.name)} : <span class="badge ${atWar(f.id, o.id) || f.bandit ? 'bad' : 'good'}">${atWar(f.id, o.id) || f.bandit ? 'guerre' : 'paix'}</span></li>`).join('');
  const towns = settlementsOf(f.id).map(s => s.name).join(', ') || 'aucune';
  const r = state.rep[f.id] || 0;
  let actions = '';
  if (inTown && !f.bandit) {
    if (state.allegiance === f.id) actions = `<button data-leave>Rompre ton serment</button>`;
    else if (!playerHostileTo(f.id)) actions = `<button data-swear ${r < 10 ? 'disabled' : ''}>Prêter serment à ${esc(f.leader)}</button>
      <div class="note">${r < 10 ? 'Il faut au moins 10 de réputation. Combats ses ennemis ou commerce ici.' : 'Tu porteras ses couleurs. Ses ennemis deviendront les tiens. -20 % chez ses marchands.'}</div>`;
    if (r < 0) actions += `<button data-fine ${state.money < 150 ? 'disabled' : ''}>Payer une amende (150 💰, +30 réputation)</button>`;
  }
  return `<div class="fdetail">
    <div class="fhead">${flagImg(f, 48)}<div><h3>${esc(f.name)}</h3><small>${esc(f.leader)} · ${esc(f.motto)}</small></div></div>
    <p>${esc(f.lore)}</p>
    <p class="note">Territoire : ${esc(towns)}${f.founded ? ` · fondée au jour ${f.founded}` : ''}</p>
    <p>Ta réputation : ${relBadge(f.id)}</p>
    <h4>Relations</h4><ul class="rels">${rels || '<li>Aucune.</li>'}</ul>
    ${actions}</div>`;
}

$('town').addEventListener('click', e => {
  const b = e.target.closest('button');
  const s = state.currentTown;
  if (!b || !s) return;
  const d = b.dataset;
  const times = e.shiftKey ? 5 : 1;
  if ('close' in d) { closePanel(); return; }
  if (d.tab) state.townTab = d.tab;
  else if (d.buy) {
    const n = d.buy === 'arrows' ? 10 : 1;
    for (let i = 0; i < times; i++) {
      const p = price(s, d.buy).buy * n;
      if (state.money < p) break;
      state.money -= p; state.goods[d.buy] += n; trade(s);
    }
  } else if (d.sell) {
    const n = d.sell === 'arrows' ? 10 : 1;
    for (let i = 0; i < times; i++) {
      if (state.goods[d.sell] < n) break;
      state.money += price(s, d.sell).sell * n; state.goods[d.sell] -= n; trade(s);
    }
  } else if (d.buyitem) {
    const p = itemBuyPrice(s, d.buyitem);
    if (state.money >= p) { state.money -= p; player.inv.push(d.buyitem); trade(s); logMsg(`Acheté : ${ITEMS[d.buyitem].name}. Ouvre l'inventaire (I) pour l'équiper.`); }
  } else if (d.sellitem) {
    const id = player.inv[Number(d.sellitem)];
    if (id) { player.inv.splice(Number(d.sellitem), 1); state.money += itemSellPrice(id); trade(s); }
  } else if ('recruit' in d) recruit(s, false);
  else if ('recruitvet' in d) recruit(s, true);
  else if ('rest' in d) {
    state.money -= 10;
    for (const u of [player, ...squad()]) { u.hp = u.maxHp; drawBar(u); }
    logMsg("Une bonne nuit à l'auberge. Tout le monde est soigné.");
  } else if ('swear' in d) swearAllegiance(s.faction);
  else if ('leave' in d) breakAllegiance(false);
  else if ('fine' in d) {
    state.money -= 150;
    state.rep[s.faction] = (state.rep[s.faction] || 0) + 30;
    logMsg(`Tu paies ton amende. ${theF(F(s.faction), true)} ${vb(F(s.faction), 'passe', 'passent')} l'éponge… pour cette fois.`);
  }
  renderTown();
  renderHud();
});

function trade(s) {
  const f = s.faction;
  if (!F(f).bandit) state.rep[f] = Math.min(25, (state.rep[f] || 0) + 0.3);
}

function recruit(s, veteran) {
  const cost = veteran ? 250 : recruitCost();
  if (state.money < cost || squad().length + 1 >= MAX_SQUAD) return;
  state.money -= cost;
  let u;
  if (veteran) {
    u = makeTroop(s.faction, 'veteran', player.pos.x + rand(-2, 2), player.pos.z + rand(-2, 2), { name: pick(NAMES) });
    u.faction = 'player';
    u.sworn = true;
  } else {
    const tier = Math.random();
    u = makeUnit({
      faction: 'player', x: player.pos.x + rand(-2, 2), z: player.pos.z + rand(-2, 2),
      maxHp: randInt(70, 100), str: randInt(2, 4), speed: 4.7, blockChance: 0.3, blockSkill: 0.5,
      equip: tier < 0.5 ? { weapon: 'machette', armor: 'tunique', helmet: 'capuche' }
        : tier < 0.85 ? { weapon: 'sabre', armor: 'cuir', helmet: 'casque_cuir' }
        : { weapon: 'dague', bow: 'arc_court', armor: 'tunique', helmet: 'capuche' },
      arrows: 20,
      look: { body: player.look.body, skin: pick(SKIN_COLORS), pants: '#3b2f22', height: rand(0.93, 1.08) },
    });
    if (u.equip.bow) u.archer = true;
  }
  u.bar.color = '#6fcf5a'; drawBar(u);
  dressUnit(u);
  logMsg(`${u.name} rejoint ton escouade !`);
}

function swearAllegiance(fid) {
  if (state.allegiance) breakAllegiance(true);
  state.allegiance = fid;
  state.rep[fid] = Math.max(state.rep[fid] || 0, 20);
  refreshPlayerDress();
  addChronicle(`${player.name} prête serment à ${F(fid).leader} et rejoint ${theF(F(fid))}.`, '🛡');
}
function breakAllegiance(silent) {
  const fid = state.allegiance;
  if (!fid) return;
  state.allegiance = null;
  if (!silent) {
    state.rep[fid] = (state.rep[fid] || 0) - 15;
    addChronicle(`${player.name} rompt son serment envers ${theF(F(fid))}.`, '💔');
  }
  refreshPlayerDress();
}
function refreshPlayerDress() {
  dressUnit(player);
  for (const u of squad()) dressUnit(u);
}

// ---------- Inventaire ----------
state.invSel = 0;
function renderInventory() {
  const members = [player, ...squad()];
  if (state.invSel >= members.length) state.invSel = 0;
  const u = members[state.invSel];
  const slots = ['weapon', 'bow', 'armor', 'helmet'].map(slot => {
    const id = u.equip[slot];
    return `<div class="item"><span><small>${SLOT_NAMES[slot]}</small><b>${id ? ITEMS[id].name : '—'}</b><small>${id ? itemStats(id) : ''}</small></span>
      ${id ? `<button data-unequip="${slot}">Retirer</button>` : ''}</div>`;
  }).join('');
  const bag = player.inv.map((id, i) => `
    <div class="item"><span><b>${ITEMS[id].name}</b><small>${SLOT_NAMES[ITEMS[id].slot]} · ${itemStats(id)} · ${ITEMS[id].w} kg</small></span>
      <span><button data-equip="${i}">Équiper</button> <button data-drop="${i}">Jeter</button></span></div>`).join('');
  const goods = Object.entries(state.goods).filter(([, n]) => n > 0).map(([g, n]) => `${GOODS[g].icon} ${GOODS[g].name} : ${n}`).join(' · ');
  $('inventory').innerHTML = `
    <div class="phead"><h3>Inventaire</h3><button class="x" data-close>✕</button></div>
    <div class="tabs">${members.map((m, i) => `<button class="${i === state.invSel ? 'on' : ''}" data-sel="${i}">${esc(m.name)}</button>`).join('')}</div>
    <div class="pbody two">
      <div><h4>${esc(u.name)}</h4>
        <div class="statline">❤ ${Math.ceil(u.hp)}/${u.maxHp} · ⚔ ${damageOf(u)} · 🛡 ${armorOf(u)} · 🏃 ${speedOf(u).toFixed(1)}${u.isPlayer ? ` · niv ${u.level}` : ''}</div>
        <div class="items">${slots}</div></div>
      <div><h4>Sac commun <small>${Math.round(weightUsed())}/${weightMax()} kg${overloaded() ? ' — surchargé, vous ralentissez !' : ''}</small></h4>
        <div class="items">${bag || '<small>Vide. Achète chez l\'armurier ou fouille les corps.</small>'}</div>
        <p class="note">${goods || 'Aucune marchandise.'}</p></div>
    </div>`;
}
$('inventory').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  const members = [player, ...squad()];
  const u = members[state.invSel] || player;
  if ('close' in d) { closePanel(); return; }
  if (d.sel) state.invSel = Number(d.sel);
  else if (d.equip) {
    const i = Number(d.equip), id = player.inv[i], slot = ITEMS[id].slot;
    player.inv.splice(i, 1);
    if (u.equip[slot]) player.inv.push(u.equip[slot]);
    u.equip[slot] = id;
    if (slot === 'bow') u.archer = true;
    dressUnit(u);
  } else if (d.unequip) {
    player.inv.push(u.equip[d.unequip]);
    u.equip[d.unequip] = null;
    if (d.unequip === 'bow') { u.archer = false; if (u.mode === 'bow') setMode(u, 'melee'); }
    dressUnit(u);
  } else if (d.drop) player.inv.splice(Number(d.drop), 1);
  renderInventory();
  renderHud();
});

// ---------- Fouille ----------
function renderLoot() {
  const c = state.lootTarget;
  if (!c || !c.loot) { closePanel(); return; }
  const l = c.loot;
  const goods = Object.entries(l.goods).filter(([, n]) => n > 0);
  $('loot').innerHTML = `
    <div class="phead"><h3>Corps : ${esc(c.name)}</h3><button class="x" data-close>✕</button></div>
    <div class="pbody">
      <div class="items">
        ${l.coins ? `<div class="item"><span><b>💰 ${l.coins} pièces</b></span><button data-coins>Prendre</button></div>` : ''}
        ${goods.map(([g, n]) => `<div class="item"><span><b>${GOODS[g].icon} ${GOODS[g].name} ×${n}</b></span><button data-good="${g}">Prendre</button></div>`).join('')}
        ${l.items.map((id, i) => `<div class="item"><span><b>${ITEMS[id].name}</b><small>${SLOT_NAMES[ITEMS[id].slot]} · ${itemStats(id)}</small></span><button data-item="${i}">Prendre</button></div>`).join('')}
        ${lootEmpty(l) ? '<small>Il ne reste rien.</small>' : ''}
      </div>
      <button data-all ${lootEmpty(l) ? 'disabled' : ''}>Tout prendre</button>
    </div>`;
}
$('loot').addEventListener('click', e => {
  const b = e.target.closest('button');
  const c = state.lootTarget;
  if (!b || !c) return;
  const d = b.dataset, l = c.loot;
  if ('close' in d) { closePanel(); return; }
  const takeCoins = () => { state.money += l.coins; l.coins = 0; };
  const takeGood = g => { state.goods[g] += l.goods[g]; l.goods[g] = 0; };
  const takeItem = i => { player.inv.push(l.items[i]); l.items.splice(i, 1); };
  if ('coins' in d) takeCoins();
  else if (d.good) takeGood(d.good);
  else if (d.item) takeItem(Number(d.item));
  else if ('all' in d) { takeCoins(); for (const g in l.goods) takeGood(g); while (l.items.length) takeItem(0); }
  renderLoot();
  renderHud();
  if (lootEmpty(l)) setTimeout(() => { if (state.panel === 'loot' && lootEmpty(l)) closePanel(); }, 400);
});

// ---------- Carte du monde ----------
state.mapTab = 'factions';
state.mapSel = null;
let terrainImg = null, territoryImg = null, territoryKey = '';
const MAPRES = 150;
function buildTerrainImg() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 300;
  const g = cv.getContext('2d');
  const img = g.createImageData(300, 300);
  for (let j = 0; j < 300; j++) for (let i = 0; i < 300; i++) {
    const x = -HALF + (i + 0.5) / 300 * WORLD, z = -HALF + (j + 0.5) / 300 * WORLD;
    const h = heightAt(x, z), k = clamp((h + 12) / 24, 0, 1);
    const shade = 1 + (heightAt(x + 4, z + 4) - h) * -0.06;
    const o = (j * 300 + i) * 4;
    img.data[o] = (160 + k * 50) * shade; img.data[o + 1] = (125 + k * 42) * shade; img.data[o + 2] = (80 + k * 26) * shade; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return cv;
}
function buildTerritoryImg() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = MAPRES;
  const g = cv.getContext('2d');
  const img = g.createImageData(MAPRES, MAPRES);
  const col = {};
  for (const f of Object.values(state.factions)) {
    const c = new T.Color(f.map);
    col[f.id] = [c.r * 255, c.g * 255, c.b * 255];
  }
  for (let j = 0; j < MAPRES; j++) for (let i = 0; i < MAPRES; i++) {
    const x = -HALF + (i + 0.5) / MAPRES * WORLD, z = -HALF + (j + 0.5) / MAPRES * WORLD;
    let best = null, bd = 180, second = Infinity;
    for (const s of state.settlements) {
      const d = Math.hypot(x - s.x, z - s.z);
      if (d < bd) { second = bd; bd = d; best = s; } else if (d < second) second = d;
    }
    if (!best) continue;
    const o = (j * MAPRES + i) * 4;
    const [r, gg, b] = col[best.faction];
    const border = second - bd < 6 && second < 180;
    img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b;
    img.data[o + 3] = border ? 150 : 70 * (1 - bd / 180) + 25;
  }
  g.putImageData(img, 0, 0);
  return cv;
}

function renderMap() {
  const el = $('worldmap');
  if (!el.dataset.built) {
    el.dataset.built = '1';
    el.innerHTML = `<div class="mapwrap"><canvas id="mapCanvas"></canvas><div class="maplegend">
      <span><i class="dot me"></i> Toi</span><span><i class="sq"></i> Ville</span><span><i class="tri"></i> Camp</span>
      <span><i class="dot"></i> Patrouille / caravane</span><span><i class="big"></i> Armée</span><span>Clique une ville pour voir sa faction</span></div></div>
      <div class="mapside"><div class="phead"><h3>Terres Arides</h3><button class="x" data-close>✕</button></div>
      <div class="tabs" id="mapTabs"></div><div class="pbody" id="mapSide"></div></div>`;
    $('mapCanvas').addEventListener('click', mapClick);
  }
  drawWorldMap();
  renderMapSide();
}

function mapLayout() {
  const cv = $('mapCanvas');
  const rect = cv.parentElement.getBoundingClientRect();
  const size = Math.max(200, Math.min(rect.width, rect.height - 34));
  return { cv, size };
}

function drawWorldMap() {
  const { cv, size } = mapLayout();
  if (cv.width !== Math.round(size)) { cv.width = cv.height = Math.round(size); }
  const g = cv.getContext('2d');
  const S = cv.width, k = S / WORLD;
  const toM = (x, z) => [(x + HALF) * k, (z + HALF) * k];
  if (!terrainImg) terrainImg = buildTerrainImg();
  const key = state.settlements.map(s => s.name + s.faction).join() + Object.values(state.factions).map(f => f.map).join();
  if (key !== territoryKey) { territoryImg = buildTerritoryImg(); territoryKey = key; }
  g.imageSmoothingEnabled = true;
  g.drawImage(terrainImg, 0, 0, S, S);
  g.drawImage(territoryImg, 0, 0, S, S);
  // ruines
  g.font = `italic ${Math.max(10, S / 70)}px system-ui`;
  g.textAlign = 'center';
  for (const r of RUINS) {
    const [x, y] = toM(r.x, r.z);
    g.fillStyle = '#6b5e4a';
    g.fillRect(x - 3, y - 3, 6, 6);
    g.fillStyle = 'rgba(40,30,20,.85)';
    g.fillText(r.name, x, y + 14);
  }
  // groupes
  for (const p of state.parties) {
    const [x, y] = toM(p.x, p.z);
    const f = F(p.faction);
    g.fillStyle = f.bandit ? '#3a0a0a' : f.map;
    g.strokeStyle = '#1a1208'; g.lineWidth = 1;
    if (p.kind === 'army') {
      g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); g.stroke();
      const t = state.settlements.find(s => s.name === p.target);
      if (t) {
        const [tx, ty] = toM(t.x, t.z);
        g.setLineDash([4, 4]); g.strokeStyle = f.map; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x, y); g.lineTo(tx, ty); g.stroke(); g.setLineDash([]);
      }
      if (f._flagCanvas) g.drawImage(f._flagCanvas, x + 4, y - 16, 15, 10);
    } else if (p.kind === 'caravan') {
      g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + 4, y); g.lineTo(x, y + 4); g.lineTo(x - 4, y); g.fill(); g.stroke();
    } else {
      g.beginPath(); g.arc(x, y, 3.2, 0, Math.PI * 2); g.fill(); g.stroke();
    }
  }
  // villes
  g.font = `bold ${Math.max(11, S / 60)}px system-ui`;
  for (const s of state.settlements) {
    const [x, y] = toM(s.x, s.z);
    const f = F(s.faction);
    factionFlag(f);
    g.fillStyle = f.map; g.strokeStyle = '#1a1208'; g.lineWidth = 2;
    if (s.type === 'ville') { g.fillRect(x - 7, y - 7, 14, 14); g.strokeRect(x - 7, y - 7, 14, 14); }
    else { g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 8, y + 6); g.lineTo(x - 8, y + 6); g.closePath(); g.fill(); g.stroke(); }
    g.drawImage(f._flagCanvas, x - 13, y - 34, 26, 17);
    g.strokeStyle = '#1a1208'; g.lineWidth = 1; g.strokeRect(x - 13, y - 34, 26, 17);
    g.fillStyle = '#fff4dc'; g.strokeStyle = 'rgba(20,14,8,.9)'; g.lineWidth = 3;
    g.strokeText(s.name, x, y + 22); g.fillText(s.name, x, y + 22);
  }
  // joueur
  const [px, py] = toM(player.pos.x, player.pos.z);
  g.save(); g.translate(px, py); g.rotate(-player.yaw);
  g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(0, 9); g.lineTo(6, -6); g.lineTo(-6, -6); g.closePath(); g.fill(); g.stroke();
  g.restore();
}

function mapClick(e) {
  const { cv } = mapLayout();
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * WORLD - HALF, z = (e.clientY - r.top) / r.height * WORLD - HALF;
  const s = nearestSettlement({ x, z });
  if (s && d2(s, { x, z }) < 40) { state.mapSel = s.faction; state.mapTab = 'factions'; renderMapSide(); }
}

function renderMapSide() {
  const tabs = [['factions', 'Factions'], ['chroniques', 'Chroniques'], ['histoire', 'Histoire']];
  $('mapTabs').innerHTML = tabs.map(([k, n]) => `<button class="${state.mapTab === k ? 'on' : ''}" data-mtab="${k}">${n}</button>`).join('');
  let html = '';
  if (state.mapTab === 'factions') {
    if (state.mapSel && F(state.mapSel)) html = `<button data-back>← Toutes les factions</button>` + factionDetail(F(state.mapSel), false);
    else {
      html = aliveFactions().map(f => {
        const towns = settlementsOf(f.id).length;
        const troops = partiesOf(f.id).reduce((a, p) => a + partyTroops(p).length, 0) + settlementsOf(f.id).reduce((a, s) => a + s.garrison, 0);
        const wars = enemiesOf(f.id).map(o => o.name);
        return `<div class="fcard" data-fsel="${f.id}">${flagImg(f, 30)}<div><b>${esc(f.name)}</b>
          <small>${towns} ${towns > 1 ? 'places' : 'place'} · ${troops} combattants · ${relBadge(f.id)}</small>
          <small class="wars">${f.bandit ? 'En guerre contre tout le monde' : wars.length ? '⚔ ' + esc(wars.join(', ')) : '🕊 En paix'}</small></div></div>`;
      }).join('');
    }
  } else if (state.mapTab === 'chroniques') {
    html = `<ul class="chron">${[...state.chronicle].reverse().map(c => `<li><span>Jour ${c.day}</span> ${c.icon} ${esc(c.text)}</li>`).join('')}</ul>`;
  } else {
    const dead = Object.values(state.factions).filter(f => !f.alive);
    html = WORLD_LORE.map(p => `<p>${esc(p)}</p>`).join('') +
      `<h4>Lieux de l'Empire déchu</h4><ul>${RUINS.map(r => `<li>${esc(r.name)}</li>`).join('')}</ul>` +
      (dead.length ? `<h4>Factions disparues</h4><ul>${dead.map(f => `<li>${flagImg(f, 14)} ${esc(f.name)} (jour ${f.died})</li>`).join('')}</ul>` : '');
  }
  $('mapSide').innerHTML = html;
}
$('worldmap').addEventListener('click', e => {
  const t = e.target.closest('[data-close],[data-mtab],[data-fsel],[data-back]');
  if (!t) return;
  const d = t.dataset;
  if ('close' in d) { closePanel(); return; }
  if (d.mtab) { state.mapTab = d.mtab; state.mapSel = null; }
  if (d.fsel) state.mapSel = d.fsel;
  if ('back' in d) state.mapSel = null;
  renderMapSide();
});

// ---------- Sauvegarde ----------
function unitSave(u) {
  return { name: u.name, look: u.look, equip: u.equip, inv: u.inv || [], hp: Math.max(1, Math.round(u.hp)), maxHp: u.maxHp,
    str: u.str, agi: u.agi, speed: u.speedBase, level: u.level, xp: u.xp, x: u.pos.x, z: u.pos.z, arrows: u.arrows,
    archer: !!u.archer, sworn: !!u.sworn, stats: u.stats };
}
function saveGame(silent) {
  if (state.mode !== 'play' || state.ko > 0) return false;
  const strip = f => { const o = {}; for (const k in f) if (!k.startsWith('_')) o[k] = f[k]; return o; };
  const data = {
    v: 1, uid: _uid, player: unitSave(player), squad: squad().map(unitSave),
    money: state.money, goods: state.goods, day: state.day, dayTimer: state.dayTimer, kills: state.kills, order: state.order,
    rep: state.rep, allegiance: state.allegiance, relations: state.relations, warSince: state.warSince, clock: state.clock || 0,
    factions: Object.values(state.factions).map(strip),
    settlements: state.settlements.map(s => ({ name: s.name, x: s.x, z: s.z, faction: s.faction, type: s.type, capital: s.capital,
      isNew: s.isNew, produces: s.produces, demands: s.demands, garrison: s.garrison, fluct: s.fluct })),
    parties: state.parties.map(p => ({ faction: p.faction, kind: p.kind, x: p.x, z: p.z, troops: partyTroops(p), dest: p.dest,
      home: p.home, target: p.target })),
    chronicle: state.chronicle, saved: Date.now(),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    if (!silent) logMsg('💾 Partie sauvegardée.');
    return true;
  } catch (err) {
    if (!silent) logMsg('Sauvegarde impossible dans ce navigateur.', 'warn');
    return false;
  }
}
function readSave() {
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch (err) { return null; }
}

function loadGame(data) {
  _uid = Math.max(_uid, data.uid || 1);
  state.factions = {};
  for (const f of data.factions) state.factions[f.id] = f;
  Object.assign(state, {
    money: data.money, goods: { ...state.goods, ...data.goods }, day: data.day, dayTimer: data.dayTimer, kills: data.kills,
    order: data.order || 'follow', rep: data.rep, allegiance: data.allegiance, relations: data.relations,
    warSince: data.warSince || {}, clock: data.clock || 0, chronicle: data.chronicle || [],
  });
  for (const sd of data.settlements) {
    const s = state.settlements.find(o => o.name === sd.name);
    if (s) { setOwner(s, sd.faction); Object.assign(s, { capital: sd.capital, garrison: sd.garrison, fluct: sd.fluct }); }
    else makeSettlement(sd, true);
  }
  for (const pd of data.parties) {
    if (!F(pd.faction) || !pd.troops.length) continue;
    makeParty(pd.faction, pd.kind, pd.x, pd.z, pd.troops, { dest: pd.dest, home: pd.home, target: pd.target });
  }
  if (player) removeUnit(player);
  player = createPlayer(data.player);
  player.inv = data.player.inv || [];
  for (const m of data.squad) {
    const u = makeUnit({ faction: 'player', x: m.x, z: m.z, name: m.name, look: m.look, equip: m.equip, hp: m.hp, maxHp: m.maxHp,
      str: m.str, agi: m.agi, speed: m.speed, level: m.level, xp: m.xp, arrows: m.arrows, blockChance: 0.3 });
    u.archer = m.archer; u.sworn = m.sworn;
    dressUnit(u);
  }
}

function createPlayer(d) {
  const p = makeUnit({ faction: 'player', isPlayer: true, x: d.x, z: d.z, name: d.name, look: d.look, equip: d.equip,
    hp: d.hp, maxHp: d.maxHp, str: d.str, agi: d.agi, speed: d.speed, level: d.level, xp: d.xp, stats: d.stats });
  p.inv = [];
  return p;
}

// ---------- Création du personnage ----------
const creation = { name: 'Vagabond', origin: ORIGINS[0], body: BODY_COLORS[0], skin: SKIN_COLORS[1], height: 1, stats: { F: 4, A: 4, E: 4 } };
const FREE_POINTS = 6;
const pointsLeft = () => FREE_POINTS - (creation.stats.F + creation.stats.A + creation.stats.E - 12);
function finalStats() {
  const s = { ...creation.stats };
  for (const k in creation.origin.bonus) s[k] += creation.origin.bonus[k];
  return s;
}
function previewPlayer() {
  const start = state.settlements[0];
  const g = gatePos(start, 6);
  const pos = player ? { x: player.pos.x, z: player.pos.z } : g;
  if (player) removeUnit(player);
  player = makeUnit({ faction: 'player', isPlayer: true, x: pos.x, z: pos.z, name: creation.name,
    look: { body: creation.body, skin: creation.skin, height: creation.height, pants: '#3b2f22' },
    equip: { ...creation.origin.equip } });
  player.inv = [];
}
function renderCreation() {
  $('cOrigins').innerHTML = ORIGINS.map(o =>
    `<div class="choice ${o === creation.origin ? 'sel' : ''}" data-origin="${o.id}"><b>${o.name}</b><small>${o.desc}</small></div>`).join('');
  $('cBody').innerHTML = BODY_COLORS.map(c =>
    `<div class="swatch ${c === creation.body ? 'sel' : ''}" data-body="${c}" style="background:${c}"></div>`).join('');
  $('cSkin').innerHTML = SKIN_COLORS.map(c =>
    `<div class="swatch ${c === creation.skin ? 'sel' : ''}" data-skin="${c}" style="background:${c}"></div>`).join('');
  const fs = finalStats();
  $('cPoints').textContent = `(${pointsLeft()} points à répartir)`;
  $('cStats').innerHTML = STATS.map(s => `
    <div class="stat"><span>${s.name}</span>
      <button data-minus="${s.key}" ${creation.stats[s.key] <= 1 ? 'disabled' : ''}>−</button>
      <b>${fs[s.key]}</b>
      <button data-plus="${s.key}" ${pointsLeft() <= 0 || creation.stats[s.key] >= 10 ? 'disabled' : ''}>+</button>
      <small>${s.hint}</small></div>`).join('');
  const save = readSave();
  $('cContinue').classList.toggle('hidden', !save);
  if (save) $('cContinue').textContent = `Continuer : ${save.player.name}, jour ${save.day}`;
}
$('creation').addEventListener('click', e => {
  const el = e.target.closest('[data-origin],[data-body],[data-skin],[data-plus],[data-minus]');
  if (!el) return;
  const d = el.dataset;
  if (d.origin) creation.origin = ORIGINS.find(o => o.id === d.origin);
  if (d.body) creation.body = d.body;
  if (d.skin) creation.skin = d.skin;
  if (d.plus && pointsLeft() > 0 && creation.stats[d.plus] < 10) creation.stats[d.plus]++;
  if (d.minus && creation.stats[d.minus] > 1) creation.stats[d.minus]--;
  renderCreation();
  if (d.body || d.skin || d.origin) previewPlayer();
});
$('cName').addEventListener('input', e => { creation.name = e.target.value.trim(); });
$('cHeight').addEventListener('input', e => { creation.height = Number(e.target.value); previewPlayer(); });

function enterPlay() {
  state.mode = 'play';
  $('creation').classList.add('hidden');
  $('hud').classList.remove('hidden');
}

function startNewGame() {
  previewPlayer();
  const s = finalStats();
  const start = state.settlements[0];
  const g = gatePos(start, 6);
  Object.assign(player, {
    name: creation.name || 'Sans-nom', stats: s, str: Math.round(s.F * 1.2), agi: s.A,
    speedBase: 4.4 + s.A * 0.2, maxHp: 50 + s.E * 10,
  });
  player.hp = player.maxHp;
  player.pos.set(g.x, heightAt(g.x, g.z), g.z);
  state.money = creation.origin.money;
  Object.assign(state.goods, creation.origin.goods);
  cam.yaw = Math.atan2(Math.cos(start.gate), Math.sin(start.gate));
  player.yaw = cam.yaw;
  enterPlay();
  populateWorld();
  $('intro').classList.remove('hidden');
  $('introText').innerHTML = WORLD_LORE.map(p => `<p>${esc(p)}</p>`).join('') +
    `<p><b>${esc(player.name)}</b>, ${esc(creation.origin.name.toLowerCase())}, arrive à ${start.name} avec ${state.money} 💰.</p>`;
  state.panel = 'intro';
  logMsg('Appuie sur M pour la carte du monde, I pour l\'inventaire.');
}
$('cStart').addEventListener('click', startNewGame);
$('cContinue').addEventListener('click', () => {
  const data = readSave();
  if (!data) return;
  loadGame(data);
  cam.yaw = player.yaw;
  enterPlay();
  logMsg(`Bon retour, ${player.name}. Jour ${state.day}.`);
});
$('introGo').addEventListener('click', () => { $('intro').classList.add('hidden'); state.panel = null; });
$('saveBtn').addEventListener('click', () => saveGame(false));
$('mapBtn').addEventListener('click', () => togglePanel('map'));
$('invBtn').addEventListener('click', () => togglePanel('inv'));
