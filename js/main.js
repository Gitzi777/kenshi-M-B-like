// Terres Arides — contrôles (3e personne et vue tactique), caméra, boucle de jeu, démarrage.
'use strict';

// ---------- Entrées ----------
const keys = {};
const cam = { yaw: 0, pitch: 0.3, dist: 6, sy: 0, sp: 0.3, sd: 6, tx: 0, ty: 0, tz: 0, init: false };
const rts = { x: 0, z: 0, yaw: 0, pitch: 0.95, dist: 40, sx: 0, sz: 0, sdist: 40, init: false };
let locked = false, rightHeld = false, midDrag = null, boxSel = null;
let mouseDir = 'haut';
const dirAcc = { x: 0, y: 0 };
state.selected = [];
state.run = false;

const canvasEl = renderer.domElement;
const isRTS = () => settings.camMode === 'rts';

function setCamMode(mode) {
  settings.camMode = mode;
  saveSettings();
  if (mode === 'rts') {
    if (document.pointerLockElement) document.exitPointerLock();
    rts.x = player.pos.x; rts.z = player.pos.z; rts.yaw = cam.yaw; rts.init = false;
    state.selected = [player];
    logMsg('🎥 Vue tactique : ZQSD déplacer la caméra · molette zoom · clic molette ou flèches tourner · clic gauche sélectionner · clic droit ordre.');
  } else {
    state.selected = [];
    cam.yaw = player.yaw; cam.init = false;
    player.cmd = null;
    logMsg('🎥 Vue à la 3e personne.');
  }
  updateRings();
}

canvasEl.addEventListener('contextmenu', e => e.preventDefault());
canvasEl.addEventListener('mousedown', e => {
  if (state.mode !== 'play' || state.panel || state.ko > 0) return;
  if (isRTS()) {
    if (e.button === 1) { midDrag = { x: e.clientX, y: e.clientY }; e.preventDefault(); }
    if (e.button === 0) boxSel = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, shift: e.shiftKey };
    if (e.button === 2) rtsOrder(e.clientX, e.clientY);
    return;
  }
  if (!locked) {
    try { const p = canvasEl.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* facultatif */ }
  }
  if (e.button === 0) {
    if (player.mode === 'bow') {
      if (state.goods.arrows > 0) player.draw = 0;
      else logMsg('Plus de flèches ! Achètes-en au marché ou fabrique-en chez le menuisier.', 'warn');
    } else startAttack(player, mouseDir);
  }
  if (e.button === 2) rightHeld = true;
});
window.addEventListener('mouseup', e => {
  if (e.button === 2) rightHeld = false;
  if (e.button === 1) midDrag = null;
  if (e.button === 0 && boxSel) { finishSelection(e.shiftKey); boxSel = null; $('selbox').classList.add('hidden'); }
  if (e.button === 0 && player && player.mode === 'bow' && player.draw >= 0) releaseArrow();
});
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvasEl; });
window.addEventListener('mousemove', e => {
  if (state.mode !== 'play' || state.panel) return;
  if (isRTS()) {
    if (midDrag) {
      rts.yaw -= (e.clientX - midDrag.x) * 0.006;
      rts.pitch = clamp(rts.pitch + (e.clientY - midDrag.y) * 0.004, 0.35, 1.45);
      midDrag = { x: e.clientX, y: e.clientY };
    }
    if (boxSel) {
      boxSel.x1 = e.clientX; boxSel.y1 = e.clientY;
      const b = $('selbox');
      if (Math.abs(boxSel.x1 - boxSel.x0) + Math.abs(boxSel.y1 - boxSel.y0) > 8) {
        b.classList.remove('hidden');
        Object.assign(b.style, { left: Math.min(boxSel.x0, boxSel.x1) + 'px', top: Math.min(boxSel.y0, boxSel.y1) + 'px',
          width: Math.abs(boxSel.x1 - boxSel.x0) + 'px', height: Math.abs(boxSel.y1 - boxSel.y0) + 'px' });
      }
    }
    return;
  }
  if (locked || (e.buttons & 2)) {
    // certains navigateurs envoient parfois des sauts énormes : on les ignore
    const mx = clamp(e.movementX, -80, 80), my = clamp(e.movementY, -80, 80);
    const k = 0.0022 * settings.sens;
    cam.yaw -= mx * k;
    cam.pitch = clamp(cam.pitch + my * k * (settings.invertY ? -1 : 1), -0.3, 1.25);
    dirAcc.x += e.movementX; dirAcc.y += e.movementY;
    if (Math.hypot(dirAcc.x, dirAcc.y) > 6) {
      mouseDir = Math.abs(dirAcc.x) > Math.abs(dirAcc.y) ? (dirAcc.x < 0 ? 'gauche' : 'droite') : (dirAcc.y < 0 ? 'haut' : 'estoc');
    }
  }
});
canvasEl.addEventListener('wheel', e => {
  e.preventDefault();
  if (isRTS()) rts.dist = clamp(rts.dist * (e.deltaY > 0 ? 1.12 : 0.89), 8, 160);
  else cam.dist = clamp(cam.dist * (e.deltaY > 0 ? 1.1 : 0.9), 2.5, 18);
}, { passive: false });

function giveOrder(o) {
  state.order = o;
  for (const u of squad()) if (u.assignedNode == null) u.cmd = null;
  if (o === 'hold') squad().forEach(u => { if (u.assignedNode == null) u.cmd = { type: 'hold', x: u.pos.x, z: u.pos.z }; });
  if (squad().length) logMsg({ follow: '« Suivez-moi ! »', charge: '« Chargez ! »', hold: '« Tenez la position ! »', close: '« Restez groupés ! »' }[o]);
}
function attackMyTarget() {
  // la cible est ce que vise le centre de l'écran (ou la sélection en vue tactique)
  camera.getWorldDirection(_dir);
  let best = null, bs = 0.97;
  for (const u of units) {
    if (!alive(u) || isPlayerSide(u) || u.civil || d2(u.pos, player.pos) > 45) continue;
    const v = new T.Vector3(u.pos.x - camera.position.x, u.pos.y + 1 - camera.position.y, u.pos.z - camera.position.z).normalize();
    const dot = v.dot(_dir);
    if (dot > bs) { bs = dot; best = u; }
  }
  if (!best) { logMsg('Aucune cible visée.'); return; }
  for (const u of squad()) if (u.assignedNode == null) u.cmd = { type: 'attack', target: best };
  logMsg(`« Attaquez ${best.name} ! »`);
}
function cycleControl() {
  const list = team().filter(u => !(u.down > 0));
  if (list.length < 2) return;
  const next = list[(list.indexOf(player) + 1) % list.length];
  takeControl(next);
  if (isRTS()) { state.selected = [next]; updateRings(); }
  logMsg(`Tu contrôles maintenant ${next.name}.`);
}

window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (state.mode !== 'play') return;
  const k = e.key.toLowerCase();
  if (k === 'escape') { closePanel(); return; }
  if (state.ko > 0) return;
  if (k === 'o') { togglePanel('settings'); return; }
  if (k === 'm') togglePanel('map');
  else if (k === 'i' || e.code === 'Tab') togglePanel('inv');
  else if (k === 'e') {
    if (state.panel === 'town' || state.panel === 'node') closePanel();
    else if (!state.panel && state.currentService) openBuilding(state.currentTown, state.currentService);
    else if (!state.panel && state.currentNode) openPanel('node');
  } else if (k === 'f' && !state.panel) {
    const c = nearCorpse();
    if (c) { state.lootTarget = c; openPanel('loot'); }
  } else if (state.panel) return;
  else if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) {
    state.run = !state.run;
    logMsg(state.run ? '🏃 Course activée (Maj pour marcher).' : '🚶 Marche.');
  } else if (k === 'v') setCamMode(isRTS() ? 'tps' : 'rts');
  else if (k === 'c') cycleControl();
  else if (k === 'x') {
    if (bowOf(player)) { setMode(player, player.mode === 'bow' ? 'melee' : 'bow'); logMsg(player.mode === 'bow' ? 'Arc en main.' : 'Arme de mêlée en main.'); }
    else logMsg("Tu n'as pas d'arc équipé.");
  } else if (k === 't') {
    state.timeScale = state.timeScale > 1 ? 1 : 4;
    logMsg(state.timeScale > 1 ? '⏩ Le temps passe plus vite (T pour revenir).' : 'Vitesse normale.');
  } else if (e.code === 'Space' && isRTS()) { rts.x = player.pos.x; rts.z = player.pos.z; }
  else if (/^Digit[1-5]$/.test(e.code)) {
    const n = Number(e.code.slice(5));
    if (n === 5) attackMyTarget();
    else giveOrder({ 1: 'follow', 2: 'charge', 3: 'hold', 4: 'close' }[n]);
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; rightHeld = false; midDrag = null; });

// ---------- Vue tactique : sélection et ordres ----------
const raycaster = new T.Raycaster();
function screenToGround(sx, sy) {
  const ndc = new T.Vector2(sx / window.innerWidth * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  let t = 0;
  for (let i = 0; i < 800; i++) {
    t += 1;
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    if (y < heightAt(x, z)) {
      let a = t - 1, b = t;
      for (let k = 0; k < 8; k++) { const m = (a + b) / 2; if (o.y + d.y * m < heightAt(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; }
      return { x: o.x + d.x * b, z: o.z + d.z * b };
    }
  }
  return null;
}
const toScreen = p => {
  _proj.set(p.x, p.y + 1, p.z).project(camera);
  return { x: (_proj.x + 1) / 2 * window.innerWidth, y: (1 - _proj.y) / 2 * window.innerHeight, ok: _proj.z < 1 };
};
function unitUnder(sx, sy, filter) {
  let best = null, bd = 26;
  for (const u of units) {
    if (!filter(u)) continue;
    const s = toScreen(u.pos);
    if (!s.ok) continue;
    const d = Math.hypot(s.x - sx, s.y - sy);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}
function finishSelection(shift) {
  const b = boxSel;
  const mine = team().filter(u => !(u.down > 0));
  let picked;
  if (Math.abs(b.x1 - b.x0) + Math.abs(b.y1 - b.y0) < 8) {
    const u = unitUnder(b.x0, b.y0, u => mine.includes(u));
    picked = u ? [u] : [];
  } else {
    const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
    picked = mine.filter(u => { const s = toScreen(u.pos); return s.ok && s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1; });
  }
  state.selected = shift ? [...new Set([...state.selected, ...picked])] : picked;
  updateRings();
}
function rtsOrder(sx, sy) {
  const sel = state.selected.filter(u => team().includes(u) && !(u.down > 0));
  const group = sel.length ? sel : [player];
  const enemy = unitUnder(sx, sy, u => alive(u) && !isPlayerSide(u) && !u.civil);
  if (enemy) {
    for (const u of group) { u.cmd = { type: 'attack', target: enemy }; u.assignedNode = null; }
    floatText(enemy.pos, '⚔', '#ff8a7a');
    return;
  }
  const corpse = unitUnder(sx, sy, u => u.dead && !lootEmpty(u.loot));
  const pt = screenToGround(sx, sy);
  if (!pt) return;
  const cols = Math.ceil(Math.sqrt(group.length));
  group.forEach((u, i) => {
    const cx = (i % cols) - (cols - 1) / 2, cz = Math.floor(i / cols) - (Math.ceil(group.length / cols) - 1) / 2;
    u.cmd = { type: 'move', x: pt.x + cx * 1.6, z: pt.z + cz * 1.6 };
    u.assignedNode = null;
  });
  if (corpse && group.includes(player)) player.cmd = { type: 'move', x: corpse.pos.x, z: corpse.pos.z, loot: corpse };
  clickMarker(pt);
}
let marker = null;
function clickMarker(pt) {
  if (!marker) {
    marker = new T.Mesh(new T.RingGeometry(0.5, 0.75, 20), new T.MeshBasicMaterial({ color: '#7dff7d', transparent: true, side: T.DoubleSide, depthWrite: false }));
    marker.rotation.x = -Math.PI / 2;
    scene.add(marker);
  }
  marker.position.set(pt.x, heightAt(pt.x, pt.z) + 0.1, pt.z);
  marker.material.opacity = 1;
}
const ringGeo = new T.RingGeometry(0.55, 0.7, 20);
function updateRings() {
  for (const u of units) {
    const want = isRTS() && state.selected.includes(u);
    if (want && !u.ring) {
      u.ring = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: '#7dff7d', side: T.DoubleSide, depthWrite: false }));
      u.ring.rotation.x = -Math.PI / 2;
      scene.add(u.ring);
    } else if (!want && u.ring) { scene.remove(u.ring); u.ring = null; }
  }
}

// ---------- Tir à l'arc du joueur ----------
const _dir = new T.Vector3();
function releaseArrow() {
  const bow = bowOf(player);
  const draw = player.draw;
  player.draw = -1;
  if (!bow || state.goods.arrows <= 0 || draw < 0.15) return;
  const power = clamp(draw / (bow.draw * (1 - player.agi * 0.03)), 0.3, 1);
  camera.getWorldDirection(_dir);
  const o = camera.position;
  let t = bow.range;
  for (const u of units) {
    if (!alive(u) || isPlayerSide(u)) continue;
    const cx = u.pos.x - o.x, cy = u.pos.y + 1.1 - o.y, cz = u.pos.z - o.z;
    const t0 = cx * _dir.x + cy * _dir.y + cz * _dir.z;
    if (t0 <= 0 || t0 > t) continue;
    if (cx * cx + cy * cy + cz * cz - t0 * t0 < 0.5) t = t0;
  }
  for (let s = 2; s < t; s += 1) {
    if (o.y + _dir.y * s < heightAt(o.x + _dir.x * s, o.z + _dir.z * s)) { t = s; break; }
  }
  const target = new T.Vector3().copy(o).addScaledVector(_dir, t);
  const from = new T.Vector3(player.pos.x, player.pos.y + 1.5, player.pos.z);
  const aim = aimVelocity(from, target, 30 + 25 * power);
  fireArrow(player, from, aim.dir, aim.speed, (bow.dmg + player.str * 0.3) * (0.4 + 0.6 * power));
  state.goods.arrows--;
}

// ---------- Personnage contrôlé ----------
function updatePlayer(dt) {
  if (player.down > 0) return;
  if (isRTS()) {
    // en vue tactique, ton personnage obéit aux ordres et se défend seul
    if (!player.cmd) {
      const e = nearestHostile(player, 7);
      if (e) player.cmd = { type: 'attack', target: e };
    }
    player.block = null;
    return;
  }
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  player.block = rightHeld && player.mode === 'melee' && !player.atk ? { dir: mouseDir } : null;
  if (player.draw >= 0) player.draw += dt;
  const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
  let mx = fx * f - fz * s, mz = fz * f + fx * s;
  const len = Math.hypot(mx, mz);
  if (len > 0) player.cmd = null;
  if (state.harvest) {
    if (len > 0 || player.atk) { state.harvest = null; logMsg('Récolte interrompue.'); }
    else {
      state.harvest.t -= dt;
      player.working = true;
      player.yaw = turnToward(player.yaw, Math.atan2(state.harvest.node.x - player.pos.x, state.harvest.node.z - player.pos.z), dt * 6);
      if (state.harvest.t <= 0) { player.working = false; finishHarvest(); }
      return;
    }
  }
  player.working = false;
  const combat = player.block || player.atk || player.draw >= 0;
  if (len > 0) {
    mx /= len; mz /= len;
    const mul = combat ? 0.5 : state.run ? 1.6 : 1;
    player.pos.x += mx * speedOf(player) * mul * dt;
    player.pos.z += mz * speedOf(player) * mul * dt;
    player.moving = mul;
    if (!combat) player.yaw = turnToward(player.yaw, Math.atan2(mx, mz), dt * 12);
  } else if (!player.cmd) player.moving = 0;
  if (combat) player.yaw = turnToward(player.yaw, cam.yaw, dt * 14);
}

// ---------- Boucle de jeu ----------
function update(dt) {
  if (state.ko > 0) {
    state.ko -= dt;
    if (state.ko <= 0) wakeUp();
  } else updatePlayer(dt);
  updateUnits(dt);
  updateArrows(dt);
  updateWorld(dt);
  updateWildlife(dt);
  updateStorm(dt);

  // soins
  for (const u of team()) {
    if (u.down > 0 || state.ko > 0) continue;
    const s = settlementAt(u.pos);
    const regen = s && !playerHostileTo(s.faction) ? 3 : (state.goods.food > 0 ? 0.3 : 0);
    const before = Math.ceil(u.hp);
    u.hp = Math.min(u.maxHp, u.hp + regen * dt);
    if (Math.ceil(u.hp) !== before) drawBar(u);
  }

  // jours et nourriture
  state.dayTimer += dt;
  if (state.dayTimer >= DAY_LENGTH) {
    state.dayTimer = 0;
    state.day++;
    const need = team().length;
    if (state.goods.food >= need) {
      state.goods.food -= need;
      logMsg(`Jour ${state.day}. Vous mangez ${need} vivres.`);
    } else {
      state.goods.food = 0;
      logMsg(`Jour ${state.day}. Pas assez de vivres : tout le monde a faim (-20 PV).`, 'warn');
      for (const u of team()) { if (u.down > 0) continue; u.hp -= 20; drawBar(u); if (u.hp <= 0) kill(u, null); }
    }
  }

  const town = settlementAt(player.pos);
  state.currentNode = town ? null : nodeAt(player.pos, 14);
  state.currentService = town ? serviceAt(player.pos, town) : null;
  if (town !== state.currentTown && state.panel !== 'town') {
    state.currentTown = town;
    if (town) logMsg(town.type === 'repaire' ? `⚠ Tu entres dans le repaire ${F(town.faction).of} !` : `Tu entres à ${town.name} (${F(town.faction).name}). Approche-toi d'un bâtiment et appuie sur E.`);
  }

  if (state.timeScale > 1 && units.some(u => alive(u) && hostile(player, u) && d2(u.pos, player.pos) < 50)) {
    state.timeScale = 1;
    logMsg('⚠ Danger à proximité : le temps reprend son cours normal.', 'warn');
  }
  state.saveTimer -= dt;
  if (state.saveTimer <= 0) { state.saveTimer = 60; saveGame(true); }
}

// ---------- Caméras ----------
function cameraBlockers() {
  const out = [];
  for (const s of state.settlements) if (s.blockers && d2(s, player.pos) < s.r + 40) out.push(...s.blockers);
  return out;
}
const _from = new T.Vector3(), _to = new T.Vector3();
function updateCamera(dt) {
  if (state.mode === 'create') {
    cam.yaw += dt * 0.4;
    const p = player.pos;
    camera.position.set(p.x + Math.sin(cam.yaw) * 4, p.y + 1.8, p.z + Math.cos(cam.yaw) * 4);
    camera.lookAt(p.x, p.y + 1.1, p.z);
    return;
  }
  if (isRTS()) {
    const k = 1 - Math.exp(-dt * 10);
    const pan = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), side = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const sp = rts.dist * 1.1 * dt;
    rts.x += (Math.sin(rts.yaw) * pan - Math.cos(rts.yaw) * side) * sp;
    rts.z += (Math.cos(rts.yaw) * pan + Math.sin(rts.yaw) * side) * sp;
    if (keys.ArrowLeft) rts.yaw += dt * 1.6;
    if (keys.ArrowRight) rts.yaw -= dt * 1.6;
    if (keys.ArrowUp) rts.pitch = clamp(rts.pitch + dt, 0.35, 1.45);
    if (keys.ArrowDown) rts.pitch = clamp(rts.pitch - dt, 0.35, 1.45);
    rts.x = clamp(rts.x, -HALF, HALF); rts.z = clamp(rts.z, -HALF, HALF);
    if (!rts.init) { rts.sx = rts.x; rts.sz = rts.z; rts.sdist = rts.dist; rts.init = true; }
    rts.sx += (rts.x - rts.sx) * k; rts.sz += (rts.z - rts.sz) * k; rts.sdist += (rts.dist - rts.sdist) * k;
    const ty = heightAt(rts.sx, rts.sz);
    const cp = Math.cos(rts.pitch);
    const x = rts.sx - Math.sin(rts.yaw) * rts.sdist * cp, z = rts.sz - Math.cos(rts.yaw) * rts.sdist * cp;
    camera.position.set(x, Math.max(ty + Math.sin(rts.pitch) * rts.sdist, heightAt(x, z) + 2), z);
    camera.lookAt(rts.sx, ty, rts.sz);
    cam.yaw = rts.yaw;
    for (const u of units) if (u.ring) u.ring.position.set(u.pos.x, u.pos.y + 0.08, u.pos.z);
    if (marker) marker.material.opacity = Math.max(0, marker.material.opacity - dt);
    return;
  }
  const aiming = player.draw >= 0;
  const wantDist = aiming ? Math.min(cam.dist, 3.2) : cam.dist;
  const k = settings.smooth ? 1 - Math.exp(-dt * 14) : 1;
  const kp = settings.smooth ? 1 - Math.exp(-dt * 10) : 1;
  if (!cam.init) { cam.sy = cam.yaw; cam.sp = cam.pitch; cam.sd = wantDist; cam.tx = player.pos.x; cam.ty = player.pos.y; cam.tz = player.pos.z; cam.init = true; }
  cam.sy += angleDiff(cam.sy, cam.yaw) * k;
  cam.sp += (cam.pitch - cam.sp) * k;
  cam.tx += (player.pos.x - cam.tx) * kp; cam.ty += (player.pos.y - cam.ty) * kp; cam.tz += (player.pos.z - cam.tz) * kp;
  const target = _from.set(cam.tx, cam.ty + 1.6, cam.tz);
  // la caméra ne traverse pas les murs : on la rapproche s'il y a un obstacle
  const cp = Math.cos(cam.sp);
  _to.set(-Math.sin(cam.sy) * cp, Math.sin(cam.sp), -Math.cos(cam.sy) * cp);
  let dist = wantDist;
  const blockers = cameraBlockers();
  if (blockers.length) {
    raycaster.set(target, _to);
    raycaster.far = wantDist;
    const hit = raycaster.intersectObjects(blockers, false)[0];
    if (hit) dist = Math.max(1.2, hit.distance - 0.4);
  }
  cam.sd = dist < cam.sd ? dist : cam.sd + (dist - cam.sd) * kp;
  const x = target.x + _to.x * cam.sd, z = target.z + _to.z * cam.sd;
  const y = Math.max(target.y + _to.y * cam.sd, heightAt(x, z) + 0.8);
  camera.position.set(x, y, z);
  const look = target.clone();
  if (aiming) { look.x += -Math.cos(cam.sy) * 0.8; look.z += Math.sin(cam.sy) * 0.8; }
  look.y += 0.2;
  camera.lookAt(look);
}

const STORM_COLOR = new T.Color('#c9935a');
function updateSky() {
  const phase = state.dayTimer / DAY_LENGTH;
  const light = clamp(0.55 + 0.6 * Math.sin(phase * Math.PI * 2 + 0.3), 0.12, 1);
  sun.intensity = light * 0.95;
  hemi.intensity = 0.2 + 0.4 * light;
  scene.background.copy(SKY_NIGHT).lerp(SKY_DAY, light);
  const storm = state.storm > 0 && player && biomeAt(player.pos.x, player.pos.z) === 'desert';
  if (storm) scene.background.lerp(STORM_COLOR, 0.85);
  scene.fog.color.copy(scene.background);
  const far = isRTS() ? 520 : 340;
  scene.fog.near += ((storm ? 8 : 90) - scene.fog.near) * 0.05;
  scene.fog.far += ((storm ? 45 : far) - scene.fog.far) * 0.05;
  const a = phase * Math.PI * 2;
  const p = isRTS() ? { x: rts.sx, y: heightAt(rts.sx, rts.sz), z: rts.sz } : player.pos;
  sun.position.set(p.x + Math.cos(a) * 60, p.y + 80, p.z + Math.sin(a) * 60 + 30);
  sun.target.position.set(p.x, p.y, p.z);
  const sh = isRTS() ? clamp(rts.sdist * 1.2, 45, 140) : 45;
  if (sun.shadow.camera.right !== sh) {
    Object.assign(sun.shadow.camera, { left: -sh, right: sh, top: sh, bottom: -sh });
    sun.shadow.camera.updateProjectionMatrix();
  }
}

function waveFlags(t) {
  for (const s of state.settlements) for (const c of s.flags) c.rotation.y = Math.sin(t * 2 + s.x) * 0.25;
  for (const n of state.nodes) if (n.flag) n.flag.rotation.y = Math.sin(t * 2 + n.x) * 0.25;
}

// ---------- Démarrage ----------
{
  const save = readSave();
  generateWorld(save && save.seed ? save.seed : randomSeed());
}
renderCreation();
previewPlayer();

let last = performance.now();
let hudTimer = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.mode === 'play' && !state.panel) {
    for (let i = 0; i < state.timeScale; i++) update(dt);
  }
  dirAcc.x *= 0.85; dirAcc.y *= 0.85;
  for (const u of units) animate(u, dt);
  updateCamera(dt);
  updateSky();
  waveFlags(now / 1000);
  renderer.render(scene, camera);
  updateFloats(dt);
  if (state.mode === 'play') {
    updateIndicators();
    hudTimer -= dt;
    if (hudTimer <= 0) {
      hudTimer = 0.2;
      renderHud(); drawMinimap();
      state.selected = state.selected.filter(u => team().includes(u));
      updateRings();
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.addEventListener('beforeunload', () => saveGame(true));
