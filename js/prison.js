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
  if (f && !f.bandit && f.alive) return imprison(downed, captor, false);
  if (captor === 'cannibales') return imprison(downed, captor, true);
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

function imprison(downed, fid, cannibal) {
  const f = F(fid);
  const towns = state.settlements.filter(s => s.faction === fid && s.cells && s.cells.length);
  if (!towns.length) return resolveDefeat(downed, 'bandits');
  const s = towns.reduce((a, b) => d2(a, player.pos) < d2(b, player.pos) ? a : b);
  const free = s.cells.filter(c => !c.open);
  const cell = s.cells.find(c => !c.occupied) || s.cells[0];
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
  const days = cannibal ? 0 : (playerHostileTo(fid) ? 3 : 2);
  state.jail = { ids: downed.map(u => u.id), town: s.name, faction: fid, cell: s.cells.indexOf(cell),
    release: (state.clock || 0) + days * DAY_LENGTH, eatAt: cannibal ? (state.clock || 0) + DAY_LENGTH * 1.5 : null };
  if (!downed.includes(player)) {} else if (team().some(u => !u.jailed && !(u.down > 0))) {
    logMsg('D\'autres membres de ton escouade sont libres : appuie sur C pour en prendre le contrôle et venir vous délivrer.', 'warn');
  }
  showBanner(cannibal ? 'Capturés par les cannibales !' : 'Capturés !', cannibal
    ? `Les ${f.name} vous enferment dans leur cage à ${s.name}. Ils vous mangeront dans un jour et demi si vous ne vous échappez pas. Crochète la porte (E) ou fais-vous délivrer.`
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
