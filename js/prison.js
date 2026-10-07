// Terres Arides — défaite, capture, prison, crochetage, vol, transport des corps, primes, soins.
'use strict';

state.jail = null;          // { ids, town, faction, release, eatAt }
state.picking = null;       // crochetage en cours
state.carrying = null;      // corps porté

const bountyOf = u => u.rank === 'general' ? 400 : u.troop === 'chef' ? 150 : F(u.faction) && F(u.faction).bandit ? 60 : 50;
const memberById = id => units.find(u => u.id === id);

function showBanner(title, text, secs = 5) {
  $('koTitle').textContent = title;
  $('koText').textContent = text;
  $('ko').classList.remove('hidden');
  state.ko = secs;
}

// ---------- Défaite ----------
function resolveDefeat(downed, captor) {
  if (!downed.length) return;
  for (const u of units) if (u.target && downed.includes(u.target)) u.target = null;
  if (document.pointerLockElement) document.exitPointerLock();
  const f = F(captor);
  if (f && !f.bandit && f.alive) return imprison(downed, captor, 'prison');
  if (captor === 'cannibales') return imprison(downed, captor, 'cannibal');
  if (f && f.behavior === 'slaver') return imprison(downed, captor, 'slave');
  // brigands ou bêtes : on vous dépouille et on vous laisse au sol
  const lost = captor === 'bandits' ? Math.floor(state.money / 2) : 0;
  state.money -= lost;
  if (captor === 'bandits') for (const g of ['food', 'spices', 'salt', 'cloth']) state.goods[g] = Math.floor(state.goods[g] / 2);
  for (const u of units) if (!isPlayerSide(u) && downed.some(d => d2(d.pos, u.pos) < 40)) { u.target = null; u.ignoreUntil = (state.clock || 0) + 60; }
  showBanner('K.O.', captor === 'bandits'
    ? `Les brigands vous dépouillent (-${lost} 💰, la moitié des marchandises) et vous laissent dans la poussière.`
    : 'Vous perdez connaissance. Les bêtes finissent par se désintéresser de vous.');
  addChronicle(`${player.name} et ses compagnons ont été laissés pour morts ${placeName(player.pos)}.`, '💀');
}

function imprison(downed, fid, mode) {
  const f = F(fid);
  const cannibal = mode === 'cannibal', slave = mode === 'slave';
  const towns = state.settlements.filter(s => s.faction === fid && s.cells && s.cells.some(c => !c.market));
  if (!towns.length) return resolveDefeat(downed, 'bandits');
  const s = towns.reduce((a, b) => d2(a, player.pos) < d2(b, player.pos) ? a : b);
  const free = s.cells.filter(c => !c.open);
  const cells = s.cells.filter(c => !c.market);
  const cell = cells.find(c => !c.occupied) || cells[0];
  const chest = s.chests.find(c => c.kind === 'confiscation');
  // confiscation de l'équipement
  for (const u of downed) {
    if (u.carrying) dropCarried(u);
    for (const slot of ['weapon', 'bow', 'armor', 'helmet']) {
      if (u.equip[slot] && u.equip[slot] !== 'haillons') { if (chest) chest.items.push(u.equip[slot]); u.equip[slot] = null; }
    }
    u.equip.armor = 'haillons';
    u.sheathed = true;
    dressUnit(u);
    u.down = 0; u.hp = Math.round(u.maxHp * 0.35); drawBar(u);
    u.pos.set(cell.x + rand(-0.6, 0.6), heightAt(cell.x, cell.z), cell.z + rand(-0.6, 0.6));
    u.jailed = { town: s.name, cell: s.cells.indexOf(cell) };
    u.cmd = null; u.target = null; u.assignedNode = null;
  }
  if (chest && player.inv.length && downed.includes(player)) { chest.items.push(...player.inv); player.inv = []; }
  const taken = Math.floor(state.money * 0.5);
  if (chest) chest.coins += taken;
  state.money -= taken;
  cell.occupied = true;
  closeCell(cell);
  despawnGuards(s); spawnGuards(s);
  const days = cannibal || slave ? 0 : (playerHostileTo(fid) ? 3 : 2);
  state.jail = { ids: downed.map(u => u.id), town: s.name, faction: fid, cell: s.cells.indexOf(cell), slave,
    release: slave ? Infinity : (state.clock || 0) + days * DAY_LENGTH, eatAt: cannibal ? (state.clock || 0) + DAY_LENGTH * 1.5 : null };
  if (!downed.includes(player)) {} else if (team().some(u => !u.jailed && !(u.down > 0))) {
    logMsg('D\'autres membres de ton escouade sont libres : appuie sur C pour en prendre le contrôle et venir vous délivrer.', 'warn');
  }
  showBanner(cannibal ? 'Capturés par les cannibales !' : slave ? 'Réduits en esclavage !' : 'Capturés !', cannibal
    ? `Les ${f.name} vous enferment dans leur cage à ${s.name}. Ils vous mangeront dans un jour et demi si vous ne vous échappez pas. Crochète la porte (E) ou fais-vous délivrer.`
    : slave ? `Les ${f.name} vous mettent aux fers dans leur camp de ${s.name}. Personne ne vous libérera : il faut crocheter la cage (E) ou qu'un compagnon libre vienne vous chercher.`
    : `${theF(f, true)} ${vb(f, 'vous jette', 'vous jettent')} en prison à ${s.name} pour ${days} jours. Ton équipement est dans un coffre de la prison. Attends (T pour accélérer) ou crochète la serrure (E près de la porte).`, 7);
  addChronicle(`${player.name} a été capturé et emprisonné à ${s.name}.`, '⛓');
}

function closeCell(c) { c.open = false; c.door.on = true; if (c.doorMesh) c.doorMesh.visible = true; }
function openCell(c) { c.open = true; c.door.on = false; if (c.doorMesh) c.doorMesh.visible = false; c.occupied = false; }

function updateJail(dt) {
  const j = state.jail;
  if (!j) return;
  const s = settlementByName(j.town);
  const cell = s && s.cells[j.cell];
  const jailed = j.ids.map(memberById).filter(u => u && u.jailed);
  // qui est encore dans sa cellule ?
  for (const u of jailed) {
    if (cell && d2(u.pos, cell) > 4) {
      u.jailed = null;
      u.fugitive = { f: j.faction, until: (state.clock || 0) + DAY_LENGTH };
      logMsg(`${u.name} s'est évadé ! Les gardes ${F(j.faction).of} le recherchent.`, 'warn');
    }
  }
  const still = j.ids.map(memberById).filter(u => u && u.jailed);
  if (!still.length) { state.jail = null; if (cell) cell.occupied = false; return; }
  if (j.eatAt && state.clock >= j.eatAt) {
    const victim = still[0];
    addChronicle(`${victim.name} a été dévoré par les cannibales.`, '🍖');
    logMsg(`☠ ${victim.name} a été dévoré par les cannibales…`, 'warn');
    victim.dead = true; removeUnit(victim);
    j.ids = j.ids.filter(id => id !== victim.id);
    j.eatAt = state.clock + DAY_LENGTH * 0.5;
    if (victim === player) {
      const next = team()[0];
      if (next) takeControl(next); else return gameOver();
    }
    return;
  }
  if (!j.eatAt && state.clock >= j.release) {
    if (cell) openCell(cell);
    const g = gatePos(s, 6);
    for (const u of still) { u.jailed = null; u.pos.set(g.x + rand(-2, 2), heightAt(g.x, g.z), g.z + rand(-2, 2)); }
    state.jail = null;
    showBanner('Libérés', `Votre peine est purgée. Vous voilà dehors à ${s.name}. Ton équipement est resté dans le coffre de la prison.`, 4);
  }
}

function gameOver() {
  state.mode = 'over';
  $('koTitle').textContent = 'Fin de partie';
  $('koText').innerHTML = 'Toute ton escouade a péri. <br><button id="restartBtn" class="big">Recommencer</button>';
  $('ko').classList.remove('hidden');
  try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* rien */ }
  $('restartBtn').onclick = () => location.reload();
}

// ---------- Crochetage ----------
function lockTargetNear(p) {
  const s = settlementAt(p, 4);
  if (!s) return null;
  for (const c of s.cells || []) {
    if (c.open) continue;
    const inside = d2(p, c) < 1.8, front = Math.hypot(p.x - c.fx, p.z - c.fz) < 1.8;
    if (inside || front) return { kind: 'cell', ref: c, s, lock: c.lock, name: c.cage ? 'Cage' : 'Porte de cellule' };
  }
  for (const ch of s.chests || []) {
    if (d2(p, ch) < 1.8) return { kind: 'chest', ref: ch, s, lock: ch.lock, name: { confiscation: 'Coffre des confiscations', maison: 'Coffre', palais: 'Trésor' }[ch.kind] || 'Coffre' };
  }
  return null;
}
const pickChance = (u, lock) => clamp(0.5 + ((u.skills.crochetage || 0) - lock) / 40, 0.05, 0.95);

function renderLock() {
  const t = state.lockTarget;
  if (!t) { closePanel(); return; }
  const u = player, ch = pickChance(u, t.lock);
  const owned = t.kind === 'chest' && t.ref.opened;
  $('lockpanel').innerHTML = `
    <div class="phead"><h3>${t.name}</h3><button class="x" data-close>✕</button></div>
    <div class="pbody">
      <p>Serrure de niveau <b>${t.lock}</b> · ${esc(u.name)} : crochetage <b>${Math.floor(u.skills.crochetage || 0)}</b> · chance <b>${Math.round(ch * 100)} %</b> · 🗝 ${state.goods.picks} crochets</p>
      ${owned ? '<button data-loot>Fouiller le coffre</button>' : `<button data-pick ${state.goods.picks > 0 ? '' : 'disabled'}>Crocheter (3 s)</button>`}
      <p class="note">Un échec peut casser un crochet. Si un garde ${F(t.s.faction).of} te voit, tu seras recherché. Chaque tentative améliore ta compétence. Achète des crochets au bazar.</p>
    </div>`;
}
$('lockpanel').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if ('close' in b.dataset) { closePanel(); return; }
  if ('pick' in b.dataset) { state.picking = { t: 3, target: state.lockTarget }; closePanel(); logMsg('Crochetage en cours… ne bouge pas.'); }
  if ('loot' in b.dataset) openChest(state.lockTarget);
});

function witnesses(p, fid) {
  return units.filter(u => alive(u) && !isPlayerSide(u) && u.faction === fid && (u.guardOf || (u.civil && u.task && u.task.type === 'stall')) &&
    d2(u.pos, p) < (u.civil ? 7 : 14) && !wallBetween(u.pos, p));
}
function finishPick() {
  const t = state.picking.target;
  state.picking = null;
  player.working = false;
  const u = player, sk = u.skills.crochetage || 0;
  u.skills.crochetage = Math.min(100, sk + Math.max(0.8, 3.5 * (1 - sk / 110)));
  const ok = Math.random() < pickChance(u, t.lock);
  const fid = t.s.faction;
  const seen = witnesses(u.pos, fid);
  if (seen.length && Math.random() < 0.6) {
    const w = seen[0];
    floatText(w.pos, 'Au voleur !', '#ff6b6b');
    u.fugitive = { f: fid, until: (state.clock || 0) + DAY_LENGTH };
    if (state.jail && t.kind === 'cell') state.jail.release += DAY_LENGTH;
    logMsg(`${w.name} t'a vu ! Les gardes ${F(fid).of} te poursuivent.`, 'warn');
    state.rep[fid] = (state.rep[fid] || 0) - 10;
  }
  if (!ok) {
    if (Math.random() < 0.5) { state.goods.picks--; logMsg('Le crochet casse. Raté.'); } else logMsg('Raté. La serrure résiste.');
    return;
  }
  if (t.kind === 'cell') {
    openCell(t.ref);
    logMsg('🔓 La porte s\'ouvre ! Sortez discrètement.');
  } else {
    t.ref.opened = true;
    logMsg('🔓 Le coffre est ouvert.');
    openChest(t);
  }
}
function openChest(t) {
  const ch = t.ref;
  state.lootTarget = { name: t.name, loot: { coins: ch.coins, items: ch.items, goods: ch.goods, chest: ch, owner: t.s.faction }, isChest: true };
  openPanel('loot');
}

// ---------- Porter un corps ----------
function pickUpNear() {
  let best = null, bd = 2.2;
  for (const u of units) {
    if (u === player || !(u.down > 0) || u.dead || u.carriedBy) continue;
    const d = d2(u.pos, player.pos);
    if (d < bd) { bd = d; best = u; }
  }
  if (!best) { logMsg('Personne à terre à portée.'); return; }
  if (best.party) { best.party.units = best.party.units.filter(x => x !== best); best.party = null; }
  if (best.guardOf) { best.guardOf.guards = best.guardOf.guards.filter(x => x !== best); best.guardOf = null; }
  best.carriedBy = player;
  player.carrying = best;
  setSheathed(player, true);
  logMsg(`Tu portes ${best.name} sur ton épaule. G pour le poser.${isPlayerSide(best) ? '' : ' Livre-le à une prison pour la prime.'}`);
}
function dropCarried(u) {
  const c = u.carrying;
  if (!c) return;
  c.carriedBy = null;
  c.pos.set(u.pos.x + Math.sin(u.yaw) * 0.8, heightAt(u.pos.x, u.pos.z), u.pos.z + Math.cos(u.yaw) * 0.8);
  u.carrying = null;
}
function updateCarry() {
  for (const u of units) {
    if (!u.carrying) continue;
    const c = u.carrying;
    if (c.dead) { u.carrying = null; continue; }
    c.pos.set(u.pos.x - Math.sin(u.yaw) * 0.1, u.pos.y + 1.45, u.pos.z - Math.cos(u.yaw) * 0.1);
    c.yaw = u.yaw + Math.PI / 2;
  }
}
// livrer un prisonnier à une prison : prime
function deliverPrisoner(s) {
  const c = player.carrying;
  if (!c || isPlayerSide(c)) return;
  const fid = s.faction;
  if (!hostileF(fid, c.faction) && !isFugitiveFor(c, fid)) { logMsg(`${theF(F(fid), true)} n'a rien contre ${c.name}.`); return; }
  const prime = bountyOf(c);
  state.money += prime;
  state.rep[fid] = Math.min(60, (state.rep[fid] || 0) + 5);
  player.carrying = null;
  removeUnit(c);
  logMsg(`💰 ${c.name} est jeté en cellule. Prime : ${prime} 💰.`);
  addChronicle(`${player.name} a livré ${c.name} ${F(c.faction) ? F(c.faction).of : ''} à la prison de ${s.name}.`, '⛓');
}

// ---------- Soins ----------
function useKit() {
  if (state.goods.kits <= 0) { logMsg("Pas de trousse de soins. Achètes-en au bazar."); return; }
  let target = null, bd = 2.5;
  for (const u of team()) {
    if (u === player) continue;
    const d = d2(u.pos, player.pos);
    if ((u.down > 0 || u.hp < u.maxHp) && d < bd) { bd = d; target = u; }
  }
  if (!target && player.hp < player.maxHp) target = player;
  if (!target) { logMsg('Personne à soigner.'); return; }
  state.goods.kits--;
  if (target.down > 0) { target.down = 0; target.hp = Math.round(target.maxHp * 0.4); logMsg(`Tu relèves ${target.name}.`); }
  else target.hp = Math.min(target.maxHp, target.hp + 45);
  drawBar(target);
  floatText(target.pos, '+ soins', '#8fdc7a');
}

function updatePicking(dt) {
  if (!state.picking) return;
  const moving = keys.KeyW || keys.KeyS || keys.KeyA || keys.KeyD;
  if (moving || player.down > 0) { state.picking = null; player.working = false; logMsg('Crochetage interrompu.'); return; }
  state.picking.t -= dt;
  player.working = true;
  if (state.picking.t <= 0) finishPick();
}

// ---------- Achever un ennemi assommé ----------
function finishOffNear(target) {
  let o = target;
  if (!o) {
    let bd = 2.4;
    for (const u of units) {
      if (!(u.down > 0) || u.dead || isPlayerSide(u) || u.carriedBy) continue;
      const d = d2(u.pos, player.pos);
      if (d < bd) { bd = d; o = u; }
    }
  }
  if (!o) { logMsg('Personne à achever à portée.'); return; }
  if (player.sheathed) setSheathed(player, false);
  player.yaw = Math.atan2(o.pos.x - player.pos.x, o.pos.z - player.pos.z);
  player.atk = { t: 0, dir: 'haut', windup: 0.25, total: 0.6, hit: true };
  // tuer quelqu'un d'une faction neutre sous les yeux de témoins fait de toi un meurtrier
  const f = F(o.faction);
  if (f && !hostileF('player', o.faction)) {
    const seen = witnesses(o.pos, o.faction).concat(units.filter(u => alive(u) && u.faction === o.faction && !u.civil && d2(u.pos, o.pos) < 18));
    if (seen.length) playerAttacked(o.faction);
    else state.rep[o.faction] = (state.rep[o.faction] || 0) - 2;
  }
  const loot = o.loot;
  o.down = 0; o.hp = 0; o.noKO = true;
  kill(o, player);
  if (loot) o.loot = loot;
  floatText(o.pos, 'achevé', '#ff6b6b');
  logMsg(`${player.name} achève ${o.name}.`);
}

// ---------- Rançonneurs : péage sur les routes ----------
state.tollPaid = state.tollPaid || {};
state.tollAngry = state.tollAngry || {};
const tollPrice = () => Math.max(20, Math.round(state.money * 0.25));
const tollFood = () => 2 + team().length;
function updateToll() {
  if (state.panel || !player || player.jailed) return;
  for (const p of state.parties) {
    if (!p.mat || p.kind !== 'bandits') continue;
    const f = F(p.faction);
    if (!f || f.behavior !== 'racket' || playerHostileTo(f.id) || (state.tollPaid[f.id] || 0) > (state.clock || 0)) continue;
    const lead = p.units.find(alive);
    if (!lead) continue;
    const d = d2(lead.pos, player.pos);
    if (d < 35) p.dest = { x: player.pos.x, z: player.pos.z };
    if (d < 6 || (d < 15 && settlementAt(player.pos, 4))) { state.toll = { party: p, fid: f.id, lead }; openPanel('toll'); return; }
  }
}
function renderToll() {
  const t = state.toll;
  if (!t) { closePanel(); return; }
  const f = F(t.fid);
  $('tollpanel').innerHTML = `
    <div class="phead">${flagImg(f, 26)}<h3>${esc(displayName(t.lead))}</h3></div>
    <div class="pbody">
      <p>« Halte ! Ici c'est le territoire ${esc(f.of)}. Tu passes si tu paies : <b>${tollPrice()} 💰</b> ou <b>${tollFood()} 🌾 vivres</b>. Sinon on se sert sur ton cadavre. »</p>
      <button data-tpay ${state.money >= tollPrice() ? '' : 'disabled'}>Payer ${tollPrice()} 💰</button>
      <button data-tfood ${state.goods.food >= tollFood() ? '' : 'disabled'}>Donner ${tollFood()} vivres</button>
      <button data-trefuse>Refuser (ils attaquent)</button>
      <p class="note">Une fois payé, ils te laissent tranquille pendant un jour.</p>
    </div>`;
}
$('tollpanel').addEventListener('click', e => {
  const b = e.target.closest('button');
  const t = state.toll;
  if (!b || !t) return;
  const now = state.clock || 0;
  if ('tpay' in b.dataset) { state.money -= tollPrice(); state.tollPaid[t.fid] = now + DAY_LENGTH; logMsg('Tu paies le péage. Ils te laissent passer.'); }
  else if ('tfood' in b.dataset) { state.goods.food -= tollFood(); state.tollPaid[t.fid] = now + DAY_LENGTH; logMsg('Tu leur donnes des vivres. Ils te laissent passer.'); }
  else { state.tollAngry[t.fid] = now + DAY_LENGTH * 0.5; logMsg(`« Mauvaise réponse. » ${theF(F(t.fid), true)} attaquent !`, 'warn'); }
  const p = t.party;
  if (state.tollPaid[t.fid] > now) p.dest = { x: p.x + rand(-80, 80), z: p.z + rand(-80, 80) };
  state.toll = null;
  closePanel();
});

// ---------- Marché aux esclaves ----------
const slavePrice = u => Math.round(50 + u.maxHp * 0.6 + (u.level || 1) * 20 + (u.troop === 'veteran' || u.troop === 'chef' ? 60 : 0));
function rollSlaves(s) {
  const list = [];
  for (let i = 0; i < randInt(2, 4); i++) {
    const skills = { forge: 0, couture: 0, bois: 0, recolte: randInt(5, 30), crochetage: 0 };
    if (Math.random() < 0.5) skills[pick(['forge', 'couture', 'bois'])] = randInt(10, 35);
    list.push({ name: genPerson(), maxHp: randInt(60, 95), str: randInt(1, 4), skills, price: randInt(70, 150) });
  }
  state.slaves = { town: s.name, list };
}
function slaveMarketHTML(s) {
  const f = F(s.faction);
  if (!f.slavery) return `<p class="bad">${theF(f, true)} ${vb(f, 'interdit', 'interdisent')} l'esclavage : le marché est fermé.</p>`;
  if (!state.slaves || state.slaves.town !== s.name) rollSlaves(s);
  const c = player.carrying;
  const full = squad().length + 1 >= MAX_SQUAD;
  return `<h4>À vendre</h4><div class="items">${state.slaves.list.map((r, i) => `<div class="item"><span><b>${esc(r.name)}</b>
      <small>❤ ${r.maxHp} · force ${r.str}${Object.entries(r.skills).filter(([, v]) => v >= 10).map(([k, v]) => ` · ${SKILLS[k]} ${v}`).join('')}</small></span>
      <button data-buyslave="${i}" ${state.money < r.price || full ? 'disabled' : ''}>Acheter (${r.price} 💰)</button></div>`).join('') || '<small>Plus rien à vendre.</small>'}</div>
    <h4>Vendre</h4>
    ${c && !isPlayerSide(c) ? `<button data-sellcarried>Vendre ${esc(c.name)}, que tu portes (${slavePrice(c)} 💰)</button>` : '<p class="note">Assomme quelqu\'un, porte-le (G) jusqu\'ici et vends-le.</p>'}
    <div class="items">${squad().map(u => `<div class="item"><span><b>${esc(u.name)}</b><small>membre de ton escouade</small></span>
      <button data-sellmember="${u.id}">Vendre (${slavePrice(u)} 💰)</button></div>`).join('')}</div>`;
}
function slaveMarketClick(d, s) {
  if (d.buyslave != null) {
    const r = state.slaves.list[Number(d.buyslave)];
    if (!r || state.money < r.price) return;
    state.money -= r.price;
    state.slaves.list.splice(Number(d.buyslave), 1);
    const u = makeUnit({ faction: 'player', x: player.pos.x + rand(-2, 2), z: player.pos.z + rand(-2, 2), name: r.name,
      maxHp: r.maxHp, hp: r.maxHp * 0.7, str: r.str, speed: 4.6, skills: r.skills, equip: { armor: 'haillons' }, sheathed: true,
      look: { body: '#8a7a60', skin: pick(SKIN_COLORS), pants: '#3b2f22', height: rand(0.93, 1.05) } });
    u.title = 'Ancien esclave';
    logMsg(`Tu achètes ${u.name}. Il rejoint ton escouade.`);
  } else if ('sellcarried' in d) {
    const c = player.carrying;
    if (!c) return;
    state.money += slavePrice(c);
    player.carrying = null;
    removeUnit(c);
    logMsg(`Tu vends ${c.name} comme esclave.`);
  } else if (d.sellmember) {
    const u = squad().find(x => x.id === Number(d.sellmember));
    if (!u) return;
    state.money += slavePrice(u);
    removeUnit(u);
    logMsg(`Tu vends ${u.name} au marchand d'esclaves.`, 'warn');
    addChronicle(`${player.name} a vendu son compagnon ${u.name} comme esclave à ${s.name}.`, '⛓');
  }
}
