// Terres Arides — interface : HUD, villes, exploitations, inventaire, fouille, carte, réglages, création, sauvegarde.
'use strict';

const $ = id => document.getElementById(id);

// ---------- Réglages ----------
const settings = { sens: 1, invertY: false, directional: false, smooth: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (err) { /* réglages par défaut */ }
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (err) { /* ignoré */ } }

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
  if (!player || d2(pos, player.pos) > 70) return;
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = text;
  el.style.color = color;
  $('floats').appendChild(el);
  floats.push({ el, p: new T.Vector3(pos.x + rand(-0.3, 0.3), pos.y + 2.2, pos.z), t: text.length > 6 ? 2.2 : 1.2 });
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

// ---------- Poids, réputation ----------
const weightUsed = () => Object.entries(state.goods).reduce((a, [g, n]) => a + GOODS[g].w * n, 0) +
  player.inv.reduce((a, id) => a + (ITEMS[id] ? ITEMS[id].w : 0), 0);
const weightMax = () => BASE_CARRY + squad().length * CARRY_PER_MEMBER;
const overloaded = () => player && weightUsed() > weightMax();
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
function sparkline(hist, w = 64, h = 18) {
  if (!hist || hist.length < 2) return '';
  const mn = Math.min(...hist), mx = Math.max(...hist), span = mx - mn || 1;
  const pts = hist.map((v, i) => `${(i / (hist.length - 1) * w).toFixed(1)},${(h - 2 - (v - mn) / span * (h - 4)).toFixed(1)}`).join(' ');
  const up = hist[hist.length - 1] >= hist[0];
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${up ? '#ff9a7a' : '#8fdc7a'}" stroke-width="1.5"/></svg>`;
}
function trend(s, g) {
  const h = s.hist[g];
  if (!h || h.length < 2) return '';
  const now = marketPrice(s, g), before = h[Math.max(0, h.length - 4)];
  if (now > before * 1.05) return '<span class="bad">▲</span>';
  if (now < before * 0.95) return '<span class="good">▼</span>';
  return '<span class="note">=</span>';
}

// ---------- HUD ----------
function renderHud() {
  $('money').textContent = state.money;
  $('food').textContent = Math.floor(state.goods.food);
  $('arrowsCount').textContent = state.goods.arrows;
  $('cargo').textContent = `${Math.round(weightUsed())}/${weightMax()}`;
  $('cargo').parentElement.classList.toggle('bad', overloaded());
  $('day').textContent = state.day;
  $('biome').textContent = BIOMES[biomeAt(player.pos.x, player.pos.z)].name;
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
    <div class="member">${esc(u.name)} <small>⚔ ${damageOf(u)} · 🛡 ${armorOf(u)}${u.assignedNode != null ? ' · ⚒ au travail' : ''}</small>
      <div class="bar"><div style="width:${Math.max(0, u.hp / u.maxHp * 100)}%"></div></div></div>`).join('')
    : '<small>Tu voyages seul. Recrute à la taverne.</small>';
  const orders = { follow: 'Ordre : suivez-moi', charge: 'Ordre : chargez !', hold: 'Ordre : tenez la position' };
  $('orderLabel').textContent = sq.length ? orders[state.order] : '';
  const pr = $('prompt');
  let txt = '';
  if (state.harvest) txt = `Récolte en cours… ${Math.ceil(state.harvest.t)} s`;
  else if (!state.panel && state.ko <= 0) {
    const corpse = nearCorpse();
    if (corpse) txt = `F : fouiller ${corpse.name}`;
    else if (state.currentTown) txt = `E : entrer dans ${state.currentTown.name}`;
    else if (state.currentNode) txt = `E : ${RESOURCES[state.currentNode.type].name}`;
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
  ind.dataset.dir = settings.directional && player.mode !== 'bow' ? mouseDir : '';
  ind.classList.toggle('simple', !settings.directional);
  let threat = null;
  if (settings.directional) {
    for (const u of units) {
      if (!alive(u) || !u.atk || u.atk.hit || u.target !== player) continue;
      if (d2(u.pos, player.pos) < weaponOf(u).reach + 1.2) { threat = u.atk.dir; break; }
    }
  }
  $('threat').textContent = threat ? DIRS[threat] : '';
}

const GOOD_COLORS = { food: '#e8c547', wood: '#8a5a2a', iron: '#9aa0a6', cloth: '#f4f1e8', spices: '#d0452e', salt: '#a8d8f0' };
function drawMinimap() {
  const m = $('minimap');
  const g = m.getContext('2d');
  const S = m.width, R = 250, k = S / (2 * R);
  const px = player.pos.x, pz = player.pos.z;
  const toM = (x, z) => [S / 2 + (x - px) * k, S / 2 + (z - pz) * k];
  g.clearRect(0, 0, S, S);
  g.save();
  g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.clip();
  if (!terrainImg || terrainSeed !== state.seed) { terrainImg = buildTerrainImg(); terrainSeed = state.seed; }
  const sx = (px - R + HALF) / WORLD * 300, sz = (pz - R + HALF) / WORLD * 300, sw = 2 * R / WORLD * 300;
  g.fillStyle = '#8a7a60'; g.fillRect(0, 0, S, S);
  g.drawImage(terrainImg, sx, sz, sw, sw, 0, 0, S, S);
  for (const n of state.nodes) {
    const [x, y] = toM(n.x, n.z);
    g.fillStyle = GOOD_COLORS[RESOURCES[n.type].good];
    g.strokeStyle = n.owner === 'player' ? '#4fc3f7' : '#1a1208';
    g.lineWidth = n.owner === 'player' ? 2 : 1;
    g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill(); g.stroke();
  }
  for (const s of state.settlements) {
    const [x, y] = toM(s.x, s.z);
    g.fillStyle = F(s.faction).map;
    g.beginPath(); g.arc(x, y, s.type === 'ville' ? 7 : 5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1a1208'; g.lineWidth = 1.5; g.stroke();
  }
  for (const p of state.parties) {
    if (p.mat) continue;
    const [x, y] = toM(p.x, p.z);
    g.fillStyle = F(p.faction).bandit ? '#7a0f0f' : F(p.faction).map;
    g.fillRect(x - 2.5, y - 2.5, 5, 5);
  }
  for (const u of units) {
    if (u.dead || u.isPlayer || u.civil) continue;
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
const PANELS = { town: 'town', inv: 'inventory', loot: 'loot', map: 'worldmap', node: 'nodepanel', settings: 'settings' };
function openPanel(name) {
  state.panel = name;
  if (document.pointerLockElement) document.exitPointerLock();
  for (const id of Object.values(PANELS)) $(id).classList.add('hidden');
  $(PANELS[name]).classList.remove('hidden');
  renderPanel();
}
function closePanel() {
  state.panel = null;
  for (const id of Object.values(PANELS)) $(id).classList.add('hidden');
}
function togglePanel(name) { if (state.panel === name) closePanel(); else openPanel(name); }
function renderPanel() {
  const r = { town: renderTown, inv: renderInventory, loot: renderLoot, map: renderMap, node: renderNode, settings: renderSettings }[state.panel];
  if (r) r();
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
    for (const g of [...TRADE_GOODS, 'arrows']) {
      const p = price(s, g);
      const n = g === 'arrows' ? 10 : 1;
      const stock = g === 'arrows' ? '∞' : Math.floor(s.stock[g]);
      const canBuy = state.money >= p.buy * n && (g === 'arrows' || s.stock[g] >= 1);
      rows += `<tr><td>${GOODS[g].icon} ${GOODS[g].name}${n > 1 ? ' ×10' : ''}</td><td class="num">${stock}</td>
        <td>${g === 'arrows' ? '' : sparkline(s.hist[g]) + ' ' + trend(s, g)}</td><td class="num">${Math.floor(state.goods[g])}</td>
        <td><button data-buy="${g}" ${canBuy ? '' : 'disabled'}>Acheter ${p.buy * n}</button></td>
        <td><button data-sell="${g}" ${state.goods[g] < n ? 'disabled' : ''}>Vendre ${p.sell * n}</button></td></tr>`;
    }
    body = `<table><tr><th>Marchandise</th><th>Stock</th><th>Prix (récent)</th><th>Sac</th><th></th><th></th></tr>${rows}</table>
      <div class="note">${s.pop | 0} habitants. Le prix monte quand le stock baisse et chute quand on en apporte beaucoup. Maj + clic = ×5.</div>`;
  } else if (state.townTab === 'armurier') {
    const shop = f.shop.length ? f.shop : ['dague', 'machette', 'tunique', 'bandana'];
    body = `<div class="note">Les prix suivent ceux du fer, du bois et du coton de la ville.</div>
      <h4>À vendre</h4><div class="items">${shop.map(id => `
      <div class="item"><span><b>${ITEMS[id].name}</b><small>${SLOT_NAMES[ITEMS[id].slot]} · ${itemStats(id)}</small></span>
        <button data-buyitem="${id}" ${state.money < itemBuyPrice(s, id) ? 'disabled' : ''}>${itemBuyPrice(s, id)} 💰</button></div>`).join('')}</div>
      <h4>Ton sac</h4><div class="items">${player.inv.length ? player.inv.map((id, i) => `
      <div class="item"><span><b>${ITEMS[id].name}</b><small>${itemStats(id)}</small></span>
        <button data-sellitem="${i}">Vendre ${itemSellPrice(id)} 💰</button></div>`).join('') : '<small>Rien à vendre.</small>'}</div>`;
  } else if (state.townTab === 'taverne') {
    const cost = recruitCost();
    const full = squad().length + 1 >= MAX_SQUAD;
    const sworn = state.allegiance === s.faction;
    const rumors = state.chronicle.slice(-3).reverse().map(c => `<li>« ${esc(c.text)} »</li>`).join('');
    body = `<div class="note">Un mercenaire te suit, se bat pour toi, ou travaille dans tes exploitations. Escouade : ${squad().length + 1}/${MAX_SQUAD}</div>
      <button data-recruit ${state.money < cost || full ? 'disabled' : ''}>Recruter un mercenaire (${cost} 💰)</button>
      ${sworn ? `<button data-recruitvet ${state.money < 250 || full ? 'disabled' : ''}>Recruter un vétéran ${esc(f.of)} (250 💰)</button>` : ''}
      <button data-rest ${state.money < 10 ? 'disabled' : ''}>Dormir à l'auberge, tout le monde soigné (10 💰)</button>
      <h4>Nouvelles</h4><ul class="rumors">${rumors || '<li>Rien de neuf.</li>'}</ul>`;
  } else body = factionDetail(f, true);
  el.innerHTML = `
    <div class="phead">${flagImg(f, 26)}<div><h3>${esc(s.name)}</h3><small>${s.type === 'camp' ? 'Camp' : 'Ville'} ${esc(f.of)} · ${BIOMES[s.biome].name} · garnison ${s.garrison} · 💰 ${state.money}</small></div>
      <button class="x" data-close>✕</button></div>
    <div class="tabs">${tabs.map(([k, n]) => `<button class="${state.townTab === k ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div>
    <div class="pbody">${body}</div>`;
}

function factionDetail(f, inTown) {
  const rels = majorFactions().filter(o => o.id !== f.id)
    .map(o => `<li>${flagImg(o, 14)} ${esc(o.name)} : <span class="badge ${atWar(f.id, o.id) || f.bandit ? 'bad' : 'good'}">${atWar(f.id, o.id) || f.bandit ? 'guerre' : 'paix'}</span></li>`).join('');
  const towns = settlementsOf(f.id);
  const nodes = state.nodes.filter(n => nodeFaction(n) === f.id);
  const prod = {};
  for (const n of nodes) prod[RESOURCES[n.type].good] = (prod[RESOURCES[n.type].good] || 0) + 1;
  const r = state.rep[f.id] || 0;
  let actions = '';
  if (inTown && !f.bandit) {
    if (state.allegiance === f.id) actions = `<button data-leave>Rompre ton serment</button>`;
    else if (!playerHostileTo(f.id)) actions = `<button data-swear ${r < 10 ? 'disabled' : ''}>Prêter serment à ${esc(f.leader)}</button>
      <div class="note">${r < 10 ? 'Il faut au moins 10 de réputation. Combats ses ennemis ou commerce ici.' : 'Tu porteras ses couleurs. Ses ennemis deviendront les tiens. Réductions chez ses marchands.'}</div>`;
    if (r < 0) actions += `<button data-fine ${state.money < 150 ? 'disabled' : ''}>Payer une amende (150 💰, +30 réputation)</button>`;
  }
  const styles = { lourd: 'infanterie lourde', marchand: 'mercenaires', fanatique: 'fanatiques', nomade: 'archers nomades', guerrier: 'guerriers', brigand: 'pillards' };
  return `<div class="fdetail">
    <div class="fhead">${flagImg(f, 48)}<div><h3>${esc(f.name)}</h3><small>${esc(f.leader)} · troupes : ${styles[f.culture] || ''}</small></div></div>
    <p class="note">${towns.length ? `${towns.length} ${towns.length > 1 ? 'places' : 'place'} : ${esc(towns.map(s => s.name).join(', '))} · ${towns.reduce((a, s) => a + s.pop, 0) | 0} habitants` : 'Aucune ville'}
      ${nodes.length ? `<br>Exploitations : ${Object.entries(prod).map(([g, n]) => `${GOODS[g].icon}×${n}`).join(' ')}` : ''}
      ${f.founded ? `<br>Fondée au jour ${f.founded}` : ''}</p>
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
    const g = d.buy, n = g === 'arrows' ? 10 : 1;
    for (let i = 0; i < times; i++) {
      const p = price(s, g).buy * n;
      if (state.money < p || (g !== 'arrows' && s.stock[g] < 1)) break;
      state.money -= p; state.goods[g] += n;
      if (g !== 'arrows') s.stock[g] -= 1;
      trade(s);
    }
  } else if (d.sell) {
    const g = d.sell, n = g === 'arrows' ? 10 : 1;
    for (let i = 0; i < times; i++) {
      if (state.goods[g] < n) break;
      state.money += price(s, g).sell * n; state.goods[g] -= n;
      if (g !== 'arrows') s.stock[g] += 1;
      trade(s);
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
  if (!F(s.faction).bandit) state.rep[s.faction] = Math.min(25, (state.rep[s.faction] || 0) + 0.3);
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

// ---------- Exploitations ----------
function renderNode() {
  const n = state.currentNode;
  if (!n) { closePanel(); return; }
  const R = RESOURCES[n.type], G = GOODS[R.good];
  const fid = nodeFaction(n);
  const owner = n.owner === 'player' ? 'Toi' : fid ? `${F(fid).name} (${n.owner})` : 'Personne';
  const workers = nodeWorkers(n);
  const idle = squad().filter(a => a.assignedNode == null);
  let actions = '';
  if (n.owner === 'player') {
    actions = `<p>Stock : <b>${Math.floor(n.stock)} ${G.icon} ${G.name}</b> · production ${nodeRate(n).toFixed(1)} / jour</p>
      <button data-collect ${n.stock < 1 ? 'disabled' : ''}>Ramasser le stock</button>
      <button data-harvest>Récolter à la main (+2, 3 s)</button>
      <h4>Ouvriers (${workers.length})</h4>
      <div class="note">Chaque compagnon posté ici produit ${(R.rate * 0.5).toFixed(1)} ${G.name.toLowerCase()} par jour et défend l'exploitation contre les pillards.</div>
      <div class="items">${workers.map(a => `<div class="item"><span><b>${esc(a.name)}</b></span><button data-recall="${a.id}">Rappeler</button></div>`).join('')}
      ${idle.map(a => `<div class="item"><span><b>${esc(a.name)}</b><small>dans ton escouade</small></span><button data-assign="${a.id}">Mettre au travail</button></div>`).join('')}
      ${!workers.length && !idle.length ? '<small>Recrute des mercenaires à la taverne pour les mettre au travail.</small>' : ''}</div>
      <button data-abandon>Abandonner l'exploitation</button>`;
  } else if (fid) {
    const hostileOwner = playerHostileTo(fid);
    actions = `<p>Production ${R.rate} ${G.name.toLowerCase()} / jour, livrée à ${esc(n.owner)}.</p>
      <button data-harvest>Récolter à la main (+2, réputation -4)</button>
      ${hostileOwner ? '<p class="bad">Cette faction est ton ennemie : impossible de lui acheter.</p>'
        : `<button data-buynode ${state.money < nodePrice(n) ? 'disabled' : ''}>Racheter l'exploitation (${nodePrice(n)} 💰)</button>
           <div class="note">${esc(n.owner)} perdra cette production : ses prix vont monter.</div>`}`;
  } else {
    actions = `<p>Personne n'exploite ce lieu.</p>
      <button data-harvest>Récolter à la main (+2, 3 s)</button>
      <button data-claim ${state.money < 100 ? 'disabled' : ''}>Revendiquer et installer un camp (100 💰)</button>`;
  }
  $('nodepanel').innerHTML = `
    <div class="phead">${flagImg(nodeFlag(n), 26)}<div><h3>${R.name}</h3><small>${G.icon} ${G.name} · ${BIOMES[biomeAt(n.x, n.z)].name} · propriétaire : ${esc(owner)}${n.disabled > 0 ? ' · <span class="bad">à l\'arrêt</span>' : ''}</small></div>
      <button class="x" data-close>✕</button></div>
    <div class="pbody">${actions}</div>`;
}
$('nodepanel').addEventListener('click', e => {
  const b = e.target.closest('button');
  const n = state.currentNode;
  if (!b || !n) return;
  const d = b.dataset;
  if ('close' in d) { closePanel(); return; }
  const G = RESOURCES[n.type].good;
  if ('collect' in d) { const q = Math.floor(n.stock); state.goods[G] += q; n.stock -= q; logMsg(`Tu ramasses ${q} ${GOODS[G].name.toLowerCase()}.`); }
  else if ('harvest' in d) { state.harvest = { node: n, t: 3 }; closePanel(); return; }
  else if ('buynode' in d) { state.money -= nodePrice(n); const fid = nodeFaction(n); if (fid) state.rep[fid] = (state.rep[fid] || 0) + 3; claimNode(n, true); }
  else if ('claim' in d) { state.money -= 100; claimNode(n, false); }
  else if (d.assign) { const a = squad().find(u => u.id === Number(d.assign)); if (a) { a.assignedNode = nodeIndex(n); logMsg(`${a.name} se met au travail.`); } }
  else if (d.recall) { const a = squad().find(u => u.id === Number(d.recall)); if (a) a.assignedNode = null; }
  else if ('abandon' in d) {
    for (const a of nodeWorkers(n)) a.assignedNode = null;
    const s = nearestSettlement(n);
    n.owner = s && d2(s, n) < 260 ? s.name : null;
    refreshNodeFlag(n);
  }
  renderNode();
  renderHud();
});

function finishHarvest() {
  const n = state.harvest.node;
  const g = RESOURCES[n.type].good;
  state.goods[g] += 2;
  floatText(player.pos, `+2 ${GOODS[g].icon} ${GOODS[g].name}`, '#ffe9a8');
  const fid = nodeFaction(n);
  if (fid && fid !== 'player') {
    state.rep[fid] = (state.rep[fid] || 0) - 4;
    if (playerHostileTo(fid)) playerAttacked(fid);
    else logMsg(`Les ouvriers ${F(fid).of} n'apprécient pas que tu te serves (réputation -4).`, 'warn');
  }
  state.harvest = null;
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
  const goods = Object.entries(state.goods).filter(([, n]) => n >= 1).map(([g, n]) => `${GOODS[g].icon} ${GOODS[g].name} : ${Math.floor(n)}`).join(' · ');
  $('inventory').innerHTML = `
    <div class="phead"><h3>Inventaire</h3><button class="x" data-close>✕</button></div>
    <div class="tabs">${members.map((m, i) => `<button class="${i === state.invSel ? 'on' : ''}" data-sel="${i}">${esc(m.name)}</button>`).join('')}</div>
    <div class="pbody two">
      <div><h4>${esc(u.name)}</h4>
        <div class="statline">❤ ${Math.ceil(u.hp)}/${u.maxHp} · ⚔ ${damageOf(u)} · 🛡 ${armorOf(u)} · 🏃 ${speedOf(u).toFixed(1)}${u.isPlayer ? ` · niv ${u.level}` : ''}</div>
        <div class="items">${slots}</div></div>
      <div><h4>Sac commun <small>${Math.round(weightUsed())}/${weightMax()} kg${overloaded() ? ' — surchargé, vous ralentissez !' : ''}</small></h4>
        <div class="items">${bag || '<small>Aucun équipement en réserve.</small>'}</div>
        <p class="note">${goods || 'Aucune marchandise.'}</p></div>
    </div>`;
}
$('inventory').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  const u = [player, ...squad()][state.invSel] || player;
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
    <div class="pbody"><div class="items">
        ${l.coins ? `<div class="item"><span><b>💰 ${l.coins} pièces</b></span><button data-coins>Prendre</button></div>` : ''}
        ${goods.map(([g, n]) => `<div class="item"><span><b>${GOODS[g].icon} ${GOODS[g].name} ×${n}</b></span><button data-good="${g}">Prendre</button></div>`).join('')}
        ${l.items.map((id, i) => `<div class="item"><span><b>${ITEMS[id].name}</b><small>${SLOT_NAMES[ITEMS[id].slot]} · ${itemStats(id)}</small></span><button data-item="${i}">Prendre</button></div>`).join('')}
        ${lootEmpty(l) ? '<small>Il ne reste rien.</small>' : ''}
      </div>
      <button data-all ${lootEmpty(l) ? 'disabled' : ''}>Tout prendre</button></div>`;
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
let terrainImg = null, terrainSeed = -1, territoryImg = null, territoryKey = '';
const MAPRES = 150;
function buildTerrainImg() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 300;
  const g = cv.getContext('2d');
  const img = g.createImageData(300, 300);
  for (let j = 0; j < 300; j++) for (let i = 0; i < 300; i++) {
    const x = -HALF + (i + 0.5) / 300 * WORLD, z = -HALF + (j + 0.5) / 300 * WORLD;
    const h = heightAt(x, z), b = BIOMES[biomeAt(x, z)].color;
    const shade = clamp(1 + (heightAt(x + 4, z + 4) - h) * -0.05, 0.6, 1.3);
    const o = (j * 300 + i) * 4;
    img.data[o] = b[0] * 255 * shade; img.data[o + 1] = b[1] * 255 * shade; img.data[o + 2] = b[2] * 255 * shade; img.data[o + 3] = 255;
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
  for (const f of Object.values(state.factions)) { const c = new T.Color(f.map); col[f.id] = [c.r * 255, c.g * 255, c.b * 255]; }
  for (let j = 0; j < MAPRES; j++) for (let i = 0; i < MAPRES; i++) {
    const x = -HALF + (i + 0.5) / MAPRES * WORLD, z = -HALF + (j + 0.5) / MAPRES * WORLD;
    let best = null, bd = 200, second = Infinity;
    for (const s of state.settlements) {
      const d = Math.hypot(x - s.x, z - s.z);
      if (d < bd) { second = bd; bd = d; best = s; } else if (d < second) second = d;
    }
    if (!best) continue;
    const o = (j * MAPRES + i) * 4;
    const [r, gg, b] = col[best.faction];
    const border = second - bd < 6 && second < 200;
    img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b;
    img.data[o + 3] = border ? 170 : 55 * (1 - bd / 200) + 15;
  }
  g.putImageData(img, 0, 0);
  return cv;
}

function renderMap() {
  const el = $('worldmap');
  if (!el.dataset.built) {
    el.dataset.built = '1';
    el.innerHTML = `<div class="mapwrap"><canvas id="mapCanvas"></canvas><div class="maplegend" id="mapLegend"></div></div>
      <div class="mapside"><div class="phead"><h3>Carte du monde</h3><button class="x" data-close>✕</button></div>
      <div class="tabs" id="mapTabs"></div><div class="pbody" id="mapSide"></div></div>`;
    $('mapCanvas').addEventListener('click', mapClick);
    $('mapLegend').innerHTML = Object.values(BIOMES).map(b => `<span><i style="background:rgb(${b.color.map(c => c * 255 | 0).join(',')})"></i> ${b.name}</span>`).join('') +
      Object.entries(RESOURCES).map(([, r]) => `<span><i class="dot" style="background:${GOOD_COLORS[r.good]}"></i> ${r.name}</span>`).join('') +
      '<span><i class="dot me"></i> Toi</span><span>■ Ville ▲ Camp ◆ Caravane ● Armée</span>';
  }
  drawWorldMap();
  renderMapSide();
}
function mapLayout() {
  const cv = $('mapCanvas');
  const rect = cv.parentElement.getBoundingClientRect();
  return { cv, size: Math.max(200, Math.min(rect.width, rect.height - 60)) };
}
function drawWorldMap() {
  const { cv, size } = mapLayout();
  if (cv.width !== Math.round(size)) cv.width = cv.height = Math.round(size);
  const g = cv.getContext('2d');
  const S = cv.width, k = S / WORLD;
  const toM = (x, z) => [(x + HALF) * k, (z + HALF) * k];
  if (!terrainImg || terrainSeed !== state.seed) { terrainImg = buildTerrainImg(); terrainSeed = state.seed; }
  const key = state.seed + state.settlements.map(s => s.name + s.faction).join();
  if (key !== territoryKey) { territoryImg = buildTerritoryImg(); territoryKey = key; }
  g.imageSmoothingEnabled = true;
  g.drawImage(terrainImg, 0, 0, S, S);
  g.drawImage(territoryImg, 0, 0, S, S);
  for (const n of state.nodes) {
    const [x, y] = toM(n.x, n.z);
    g.fillStyle = GOOD_COLORS[RESOURCES[n.type].good];
    g.strokeStyle = n.owner === 'player' ? '#4fc3f7' : '#1a1208';
    g.lineWidth = n.owner === 'player' ? 2.5 : 1;
    g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); g.stroke();
  }
  for (const p of state.parties) {
    const [x, y] = toM(p.x, p.z);
    const f = F(p.faction);
    g.fillStyle = f.bandit ? '#3a0a0a' : f.map;
    g.strokeStyle = '#1a1208'; g.lineWidth = 1;
    if (p.kind === 'army') {
      g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); g.stroke();
      const t = settlementByName(p.target);
      if (t) {
        const [tx, ty] = toM(t.x, t.z);
        g.setLineDash([4, 4]); g.strokeStyle = f.map; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x, y); g.lineTo(tx, ty); g.stroke(); g.setLineDash([]);
      }
    } else if (p.kind === 'caravan') {
      g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + 4, y); g.lineTo(x, y + 4); g.lineTo(x - 4, y); g.fill(); g.stroke();
      if (p.cargo) { g.fillStyle = GOOD_COLORS[p.cargo.good]; g.fillRect(x - 1.5, y - 1.5, 3, 3); }
    } else { g.beginPath(); g.arc(x, y, 3.2, 0, Math.PI * 2); g.fill(); g.stroke(); }
  }
  g.font = `bold ${Math.max(11, S / 60)}px system-ui`;
  g.textAlign = 'center';
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
  const tabs = [['factions', 'Factions'], ['economie', 'Économie'], ['chroniques', 'Chroniques']];
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
  } else if (state.mapTab === 'economie') {
    const head = TRADE_GOODS.map(g => `<th title="${GOODS[g].name}">${GOODS[g].icon}</th>`).join('');
    const rows = state.settlements.map(s => `<tr><td>${flagImg(F(s.faction), 12)} ${esc(s.name)}<small> ${s.pop | 0} hab.</small></td>${TRADE_GOODS.map(g => {
      const p = marketPrice(s, g), r = p / GOODS[g].base;
      return `<td class="num ${r < 0.8 ? 'good' : r > 1.4 ? 'bad' : ''}">${p}</td>`;
    }).join('')}</tr>`).join('');
    const trades = [...state.trades].reverse().slice(0, 25).map(t => {
      const f = F(t.faction);
      return t.kind === 'achat'
        ? `<li><span>Jour ${t.day}</span>${f ? flagImg(f, 12) : ''} Une caravane achète ${t.qty} ${GOODS[t.good].icon} à ${esc(t.where)} (${t.price} 💰) pour ${esc(t.to)}</li>`
        : `<li><span>Jour ${t.day}</span>${f ? flagImg(f, 12) : ''} Une caravane vend ${t.qty} ${GOODS[t.good].icon} à ${esc(t.where)} (${t.price} 💰), bénéfice ${t.profit >= 0 ? '+' : ''}${t.profit} 💰</li>`;
    }).join('');
    html = `<p class="note">Prix actuels. <span class="good">Vert</span> = bon marché, <span class="bad">rouge</span> = cher. Achète là où c'est vert, revends là où c'est rouge.</p>
      <div class="scroll-x"><table class="eco"><tr><th></th>${head}</tr>${rows}</table></div>
      <h4>Derniers échanges</h4><ul class="chron">${trades || '<li>Aucun échange pour l\'instant.</li>'}</ul>`;
  } else {
    html = `<ul class="chron">${[...state.chronicle].reverse().map(c => `<li><span>Jour ${c.day}</span> ${c.icon} ${esc(c.text)}</li>`).join('')}</ul>`;
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

// ---------- Réglages ----------
function renderSettings() {
  $('settings').innerHTML = `
    <div class="phead"><h3>Réglages</h3><button class="x" data-close>✕</button></div>
    <div class="pbody">
      <label class="row">Sensibilité de la souris <input id="sSens" type="range" min="0.2" max="2.5" step="0.05" value="${settings.sens}"> <b id="sSensV">${settings.sens.toFixed(2)}</b></label>
      <label class="row"><input id="sInv" type="checkbox" ${settings.invertY ? 'checked' : ''}> Inverser l'axe vertical</label>
      <label class="row"><input id="sSmooth" type="checkbox" ${settings.smooth ? 'checked' : ''}> Caméra lissée</label>
      <label class="row"><input id="sDir" type="checkbox" ${settings.directional ? 'checked' : ''}> Combat directionnel (la souris choisit la direction des coups et des parades, comme Mount & Blade)</label>
      <p class="note">Sans combat directionnel : clic gauche pour enchaîner les coups, clic droit maintenu pour parer dans toutes les directions.</p>
    </div>`;
}
$('settings').addEventListener('input', e => {
  if (e.target.id === 'sSens') { settings.sens = Number(e.target.value); $('sSensV').textContent = settings.sens.toFixed(2); }
  if (e.target.id === 'sInv') settings.invertY = e.target.checked;
  if (e.target.id === 'sDir') settings.directional = e.target.checked;
  if (e.target.id === 'sSmooth') settings.smooth = e.target.checked;
  saveSettings();
});
$('settings').addEventListener('click', e => { if (e.target.closest('[data-close]')) closePanel(); });

// ---------- Sauvegarde ----------
function unitSave(u) {
  return { name: u.name, look: u.look, equip: u.equip, inv: u.inv || [], hp: Math.max(1, Math.round(u.hp)), maxHp: u.maxHp,
    str: u.str, agi: u.agi, speed: u.speedBase, level: u.level, xp: u.xp, x: u.pos.x, z: u.pos.z, arrows: u.arrows,
    archer: !!u.archer, sworn: !!u.sworn, stats: u.stats, node: u.assignedNode };
}
function saveGame(silent) {
  if (state.mode !== 'play' || state.ko > 0) return false;
  const strip = f => { const o = {}; for (const k in f) if (!k.startsWith('_')) o[k] = f[k]; return o; };
  const data = {
    v: 2, seed: state.seed, uid: _uid, player: unitSave(player), squad: squad().map(unitSave),
    money: state.money, goods: state.goods, day: state.day, dayTimer: state.dayTimer, kills: state.kills, order: state.order,
    rep: state.rep, allegiance: state.allegiance, relations: state.relations, warSince: state.warSince, clock: state.clock || 0,
    factions: Object.values(state.factions).map(strip),
    settlements: state.settlements.map(s => ({ name: s.name, x: s.x, z: s.z, faction: s.faction, type: s.type, capital: s.capital,
      garrison: s.garrison, pop: s.pop, stock: s.stock, hist: s.hist })),
    nodes: state.nodes.map(n => ({ owner: n.owner, stock: n.stock, disabled: n.disabled })),
    parties: state.parties.map(p => ({ faction: p.faction, kind: p.kind, x: p.x, z: p.z, troops: partyTroops(p), dest: p.dest,
      home: p.home, target: p.target, cargo: p.cargo || null })),
    chronicle: state.chronicle, trades: state.trades, saved: Date.now(),
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
  if (state.seed !== data.seed) { if (player) { removeUnit(player); player = null; } generateWorld(data.seed); }
  _uid = Math.max(_uid, data.uid || 1);
  state.factions = {};
  for (const f of data.factions) state.factions[f.id] = f;
  Object.assign(state, {
    money: data.money, goods: { ...state.goods, ...data.goods }, day: data.day, dayTimer: data.dayTimer, kills: data.kills,
    order: data.order || 'follow', rep: data.rep, allegiance: data.allegiance, relations: data.relations,
    warSince: data.warSince || {}, clock: data.clock || 0, chronicle: data.chronicle || [], trades: data.trades || [],
  });
  for (const sd of data.settlements) {
    const s = settlementByName(sd.name);
    if (s) { Object.assign(s, { capital: sd.capital, garrison: sd.garrison, pop: sd.pop, stock: sd.stock, hist: sd.hist || {} }); setOwner(s, sd.faction); }
    else makeSettlement(sd);
  }
  data.nodes.forEach((nd, i) => {
    const n = state.nodes[i];
    if (!n) return;
    Object.assign(n, nd);
    refreshNodeFlag(n);
  });
  for (const pd of data.parties) {
    if (!F(pd.faction) || !pd.troops.length) continue;
    const p = makeParty(pd.faction, pd.kind, pd.x, pd.z, pd.troops, { dest: pd.dest, home: pd.home, target: pd.target });
    p.cargo = pd.cargo;
  }
  if (player) removeUnit(player);
  player = createPlayer(data.player);
  player.inv = data.player.inv || [];
  for (const m of data.squad) {
    const u = makeUnit({ faction: 'player', x: m.x, z: m.z, name: m.name, look: m.look, equip: m.equip, hp: m.hp, maxHp: m.maxHp,
      str: m.str, agi: m.agi, speed: m.speed, level: m.level, xp: m.xp, arrows: m.arrows, blockChance: 0.3 });
    u.archer = m.archer; u.sworn = m.sworn; u.assignedNode = m.node != null ? m.node : null;
    dressUnit(u);
  }
  PLAYER_FLAG.colors[0] = player.look.body;
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
const startTown = () => state.settlements.find(s => s.capital && s.type === 'ville') || state.settlements[0];
function previewPlayer() {
  const g = gatePos(startTown(), 6);
  if (player) removeUnit(player);
  player = makeUnit({ faction: 'player', isPlayer: true, x: g.x, z: g.z, name: creation.name,
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
  const majors = majorFactions();
  $('cWorld').innerHTML = `Monde n° ${state.seed} · ${majors.length} factions · ${state.settlements.length} places · ${state.nodes.length} exploitations
    <div class="wflags">${majors.map(f => flagImg(f, 16) + ' ' + esc(f.name)).join('<br>')}</div>`;
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
const randomSeed = () => Math.floor(Math.random() * 99999) + 1;
$('cReroll').addEventListener('click', () => {
  if (player) { removeUnit(player); player = null; }
  generateWorld(randomSeed());
  previewPlayer();
  renderCreation();
});

function enterPlay() {
  state.mode = 'play';
  $('creation').classList.add('hidden');
  $('hud').classList.remove('hidden');
}
function startNewGame() {
  previewPlayer();
  const s = finalStats();
  const start = startTown();
  const g = gatePos(start, 6);
  Object.assign(player, {
    name: creation.name || 'Sans-nom', stats: s, str: Math.round(s.F * 1.2), agi: s.A,
    speedBase: 4.4 + s.A * 0.2, maxHp: 50 + s.E * 10,
  });
  player.hp = player.maxHp;
  player.pos.set(g.x, heightAt(g.x, g.z), g.z);
  state.money = creation.origin.money;
  for (const k in state.goods) state.goods[k] = 0;
  Object.assign(state.goods, creation.origin.goods);
  PLAYER_FLAG.colors[0] = creation.body;
  cam.yaw = Math.atan2(Math.cos(start.gate), Math.sin(start.gate));
  player.yaw = cam.yaw;
  enterPlay();
  populateWorld();
  logMsg(`${player.name} arrive à ${start.name}. M : carte · I : inventaire · E : interagir · O : réglages.`);
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
$('saveBtn').addEventListener('click', () => saveGame(false));
$('mapBtn').addEventListener('click', () => togglePanel('map'));
$('invBtn').addEventListener('click', () => togglePanel('inv'));
$('setBtn').addEventListener('click', () => togglePanel('settings'));
$('cSettings').addEventListener('click', () => { openPanel('settings'); });
