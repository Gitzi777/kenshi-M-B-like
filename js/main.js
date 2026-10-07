// Terres Arides — contrôles, caméra, boucle de jeu, démarrage.
'use strict';

// ---------- Entrées ----------
const keys = {};
const cam = { yaw: 0, pitch: 0.35, dist: 6 };
let locked = false, rightHeld = false;
let mouseDir = 'haut';
const dirAcc = { x: 0, y: 0 };

const canvasEl = renderer.domElement;
canvasEl.addEventListener('contextmenu', e => e.preventDefault());
canvasEl.addEventListener('mousedown', e => {
  if (state.mode !== 'play' || state.panel || state.ko > 0) return;
  if (!locked) {
    try { const p = canvasEl.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* facultatif */ }
  }
  if (e.button === 0) {
    if (player.mode === 'bow') {
      if (state.goods.arrows > 0) player.draw = 0;
      else logMsg("Plus de flèches ! Achètes-en au marché ou fouille les archers.", 'warn');
    } else startAttack(player, mouseDir);
  }
  if (e.button === 2) rightHeld = true;
});
window.addEventListener('mouseup', e => {
  if (e.button === 2) rightHeld = false;
  if (e.button === 0 && player && player.mode === 'bow' && player.draw >= 0) releaseArrow();
});
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvasEl; });
window.addEventListener('mousemove', e => {
  if (state.mode !== 'play' || state.panel) return;
  if (locked || (e.buttons & 2)) {
    cam.yaw -= e.movementX * 0.0035;
    cam.pitch = clamp(cam.pitch + e.movementY * 0.003, -0.25, 1.2);
    dirAcc.x += e.movementX; dirAcc.y += e.movementY;
    if (Math.hypot(dirAcc.x, dirAcc.y) > 6) {
      mouseDir = Math.abs(dirAcc.x) > Math.abs(dirAcc.y) ? (dirAcc.x < 0 ? 'gauche' : 'droite') : (dirAcc.y < 0 ? 'haut' : 'estoc');
    }
  }
});
canvasEl.addEventListener('wheel', e => {
  e.preventDefault();
  cam.dist = clamp(cam.dist * (e.deltaY > 0 ? 1.1 : 0.9), 2.5, 18);
}, { passive: false });

window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (state.mode !== 'play' || state.panel === 'intro') return;
  const k = e.key.toLowerCase();
  if (k === 'escape') { closePanel(); return; }
  if (state.ko > 0) return;
  if (k === 'm') togglePanel('map');
  else if (k === 'i' || e.code === 'Tab') togglePanel('inv');
  else if (k === 'e') { if (state.panel === 'town') closePanel(); else if (state.currentTown && !state.panel) openPanel('town'); }
  else if (k === 'f' && !state.panel) {
    const c = nearCorpse();
    if (c) { state.lootTarget = c; openPanel('loot'); }
  } else if (state.panel) return;
  else if (k === 'x') {
    if (bowOf(player)) { setMode(player, player.mode === 'bow' ? 'melee' : 'bow'); logMsg(player.mode === 'bow' ? 'Arc en main.' : 'Arme de mêlée en main.'); }
    else logMsg("Tu n'as pas d'arc équipé.");
  } else if (k === 't') {
    state.timeScale = state.timeScale > 1 ? 1 : 4;
    logMsg(state.timeScale > 1 ? '⏩ Le temps passe plus vite (T pour revenir).' : 'Vitesse normale.');
  } else if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
    state.order = { Digit1: 'follow', Digit2: 'charge', Digit3: 'hold' }[e.code];
    if (state.order === 'hold') squad().forEach(u => (u.holdPos = u.pos.clone()));
    if (squad().length) logMsg({ follow: '« Suivez-moi ! »', charge: '« Chargez ! »', hold: '« Tenez la position ! »' }[state.order]);
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; rightHeld = false; });

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
  // cherche ce que vise le centre de l'écran : un personnage ou le sol
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
  const speed = 30 + 25 * power;
  const aim = aimVelocity(from, target, speed);
  fireArrow(player, from, aim.dir, aim.speed, (bow.dmg + player.str * 0.3) * (0.4 + 0.6 * power));
  state.goods.arrows--;
}

// ---------- Joueur ----------
function updatePlayer(dt) {
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  player.block = rightHeld && player.mode === 'melee' && !player.atk ? { dir: mouseDir } : null;
  if (player.draw >= 0) player.draw += dt;
  const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
  let mx = fx * f - fz * s, mz = fz * f + fx * s;
  const len = Math.hypot(mx, mz);
  const combat = player.block || player.atk || player.draw >= 0;
  if (len > 0) {
    mx /= len; mz /= len;
    const run = keys.ShiftLeft || keys.ShiftRight ? 1.6 : 1;
    const mul = combat ? 0.5 : run;
    player.pos.x += mx * speedOf(player) * mul * dt;
    player.pos.z += mz * speedOf(player) * mul * dt;
    player.moving = mul;
    if (!combat) player.yaw = turnToward(player.yaw, Math.atan2(mx, mz), dt * 12);
  } else player.moving = 0;
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

  // soins
  for (const u of [player, ...squad()]) {
    if (u === player && state.ko > 0) continue;
    const regen = settlementAt(u.pos) && !playerHostileTo(settlementAt(u.pos).faction) ? 3 : (state.goods.food > 0 ? 0.3 : 0);
    const before = Math.ceil(u.hp);
    u.hp = Math.min(u.maxHp, u.hp + regen * dt);
    if (Math.ceil(u.hp) !== before) drawBar(u);
  }

  // jours et nourriture
  state.dayTimer += dt;
  if (state.dayTimer >= DAY_LENGTH) {
    state.dayTimer = 0;
    state.day++;
    const need = 1 + squad().length;
    if (state.goods.food >= need) {
      state.goods.food -= need;
      logMsg(`Jour ${state.day}. Vous mangez ${need} nourriture.`);
    } else {
      state.goods.food = 0;
      logMsg(`Jour ${state.day}. Pas assez de nourriture : tout le monde a faim (-20 PV).`, 'warn');
      for (const u of [player, ...squad()]) { u.hp -= 20; drawBar(u); if (u.hp <= 0) kill(u, null); }
    }
  }

  const town = settlementAt(player.pos);
  if (town !== state.currentTown) {
    state.currentTown = town;
    if (town) logMsg(`Tu entres à ${town.name} (${F(town.faction).name}). E pour le marché.`);
  }

  // le temps accéléré s'arrête quand le danger approche
  if (state.timeScale > 1 && units.some(u => alive(u) && hostile(player, u) && d2(u.pos, player.pos) < 50)) {
    state.timeScale = 1;
    logMsg('⚠ Danger à proximité : le temps reprend son cours normal.', 'warn');
  }

  state.saveTimer -= dt;
  if (state.saveTimer <= 0) { state.saveTimer = 60; saveGame(true); }
}

function updateCamera(dt) {
  if (state.mode === 'create') {
    cam.yaw += dt * 0.4;
    const p = player.pos;
    camera.position.set(p.x + Math.sin(cam.yaw) * 4, p.y + 1.8, p.z + Math.cos(cam.yaw) * 4);
    camera.lookAt(p.x, p.y + 1.1, p.z);
    return;
  }
  const aiming = player.draw >= 0;
  const dist = aiming ? Math.min(cam.dist, 3.2) : cam.dist;
  const target = new T.Vector3(player.pos.x, player.pos.y + 1.7, player.pos.z);
  const cp = Math.cos(cam.pitch);
  const x = target.x - Math.sin(cam.yaw) * dist * cp;
  const z = target.z - Math.cos(cam.yaw) * dist * cp;
  const y = Math.max(target.y + Math.sin(cam.pitch) * dist, heightAt(x, z) + 0.6);
  camera.position.set(x, y, z);
  const shoulder = aiming ? 0.9 : 0.6;
  const look = target.clone();
  look.x += -Math.cos(cam.yaw) * shoulder; look.z += Math.sin(cam.yaw) * shoulder;
  camera.lookAt(look);
}

function updateSky() {
  const phase = state.dayTimer / DAY_LENGTH;
  const light = clamp(0.55 + 0.6 * Math.sin(phase * Math.PI * 2 + 0.3), 0.12, 1);
  sun.intensity = light * 1.1;
  hemi.intensity = 0.2 + 0.5 * light;
  scene.background.copy(SKY_NIGHT).lerp(SKY_DAY, light);
  scene.fog.color.copy(scene.background);
  const a = phase * Math.PI * 2;
  const p = player.pos;
  sun.position.set(p.x + Math.cos(a) * 60, p.y + 80, p.z + Math.sin(a) * 60 + 30);
  sun.target.position.copy(p);
}

// drapeaux qui flottent
function waveFlags(t) {
  for (const s of state.settlements) for (const c of s.flags) c.rotation.y = Math.sin(t * 2 + s.x) * 0.25;
}

// ---------- Démarrage ----------
initFactions();
for (const def of SETTLEMENT_DEFS) makeSettlement(def);
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
    if (hudTimer <= 0) { hudTimer = 0.2; renderHud(); drawMinimap(); }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.addEventListener('beforeunload', () => saveGame(true));
