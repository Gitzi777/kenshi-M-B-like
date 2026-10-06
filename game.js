// Terres Arides — prototype inspiré de Kenshi / Mount & Blade
// Monde ouvert vu de dessus, combat en temps réel, escouade, commerce.

'use strict';

// ---------- Réglages ----------
const WORLD = { w: 4000, h: 3000 };
const DAY_LENGTH = 90;          // secondes réelles par jour
const CARRY_PER_MEMBER = 20;
const MAX_SQUAD = 8;
const MAX_BANDIT_GROUPS = 7;

const GOODS = {
  food:   { name: 'Nourriture', icon: '🍖', base: 8 },
  cloth:  { name: 'Tissu',      icon: '🧵', base: 16 },
  iron:   { name: 'Fer',        icon: '⛏️', base: 26 },
  spices: { name: 'Épices',     icon: '🌶️', base: 42 },
};

const NAMES = ['Kael', 'Mira', 'Ruk', 'Sanna', 'Torv', 'Ylva', 'Bren', 'Oska', 'Hal', 'Zia',
  'Dorn', 'Lisk', 'Vetch', 'Ama', 'Grell', 'Nox', 'Pell', 'Rhea', 'Sorn', 'Tam'];

// ---------- Utilitaires ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- Canvas ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const mini = document.getElementById('minimap');
const mctx = mini.getContext('2d');
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ---------- Décor (fixe) ----------
const decoRng = mulberry32(1234);
const decor = [];
for (let i = 0; i < 900; i++) {
  const kind = decoRng() < 0.6 ? 'rock' : 'bush';
  decor.push({ x: decoRng() * WORLD.w, y: decoRng() * WORLD.h, r: kind === 'rock' ? 4 + decoRng() * 14 : 5 + decoRng() * 8, kind });
}
const patches = [];
for (let i = 0; i < 60; i++) {
  patches.push({ x: decoRng() * WORLD.w, y: decoRng() * WORLD.h, r: 120 + decoRng() * 260, dark: decoRng() < 0.5 });
}

// ---------- État du jeu ----------
let state;
let nextId = 1;
const camera = { x: 0, y: 0, zoom: 1 };

function makeTowns() {
  return [
    { name: 'Port-Sable',   x: 1000, y: 800,  r: 150, mult: { food: 0.6, cloth: 1.0, iron: 1.1, spices: 1.5 } },
    { name: 'Forge-Noire',  x: 3050, y: 700,  r: 150, mult: { food: 1.5, cloth: 1.1, iron: 0.6, spices: 1.0 } },
    { name: 'Oasis-Rouge',  x: 2500, y: 2300, r: 150, mult: { food: 1.0, cloth: 1.5, iron: 1.2, spices: 0.6 } },
    { name: 'Hautemur',     x: 700,  y: 2300, r: 150, mult: { food: 1.1, cloth: 0.6, iron: 1.5, spices: 1.2 } },
  ].map(t => ({ ...t, fluct: { food: 1, cloth: 1, iron: 1, spices: 1 } }));
}

function makeUnit(team, x, y, opts = {}) {
  const maxHp = opts.maxHp || 100;
  return {
    id: nextId++, team, x, y,
    name: opts.name || pick(NAMES),
    maxHp, hp: maxHp,
    atk: opts.atk || 10,
    speed: opts.speed || 85,
    radius: 9,
    range: 14,
    cd: Math.random(),
    dest: null,
    target: null,
    forced: false,         // ordre d'attaque donné par le joueur
    selected: false,
    xp: 0, level: 1,
    group: opts.group || null,
    offset: opts.offset || { x: 0, y: 0 },
    dead: false,
  };
}

function newGame() {
  nextId = 1;
  const towns = makeTowns();
  const start = towns[0];
  state = {
    towns,
    units: [],
    groups: [],
    money: 250,
    inv: { food: 6, cloth: 0, iron: 0, spices: 0 },
    time: 0,
    day: 1,
    dayTimer: 0,
    spawnTimer: 3,
    priceTimer: 0,
    kills: 0,
    floats: [],
    paused: false,
    over: false,
    currentTown: null,
  };
  state.units.push(makeUnit('player', start.x - 15, start.y, { name: 'Toi', maxHp: 120, atk: 12 }));
  state.units.push(makeUnit('player', start.x + 15, start.y + 10, { name: pick(NAMES) }));
  state.units.forEach(u => (u.selected = true));
  for (let i = 0; i < 4; i++) spawnBanditGroup();
  centerCamera();
  document.getElementById('gameover').classList.add('hidden');
  logMsg('Bienvenue dans les Terres Arides. Commerce, survis, recrute.');
  renderTown(true);
}

const players = () => state.units.filter(u => u.team === 'player' && !u.dead);
const enemies = () => state.units.filter(u => u.team === 'bandit' && !u.dead);
const cargoUsed = () => Object.values(state.inv).reduce((a, b) => a + b, 0);
const cargoMax = () => players().length * CARRY_PER_MEMBER;

function townAt(p, margin = 0) {
  return state.towns.find(t => dist(p, t) < t.r + margin) || null;
}

function price(town, good) {
  const buy = Math.max(1, Math.round(GOODS[good].base * town.mult[good] * town.fluct[good]));
  const sell = Math.max(1, Math.round(buy * 0.8));
  return { buy, sell };
}

function recruitCost() { return 60 + 40 * players().length; }

// ---------- Bandits ----------
function spawnBanditGroup() {
  let x, y, tries = 0;
  do {
    x = rand(100, WORLD.w - 100);
    y = rand(100, WORLD.h - 100);
    tries++;
  } while (tries < 50 && (state.towns.some(t => dist({ x, y }, t) < t.r + 350) ||
    players().some(p => dist({ x, y }, p) < 700)));
  const size = clamp(randInt(2, 3) + Math.floor(state.day / 3), 2, 7);
  const group = { id: nextId++, x, y, wx: x, wy: y, wanderTimer: 0, aggro: false };
  state.groups.push(group);
  for (let i = 0; i < size; i++) {
    const strong = Math.random() < 0.15 + state.day * 0.02;
    state.units.push(makeUnit('bandit', x + rand(-30, 30), y + rand(-30, 30), {
      name: strong ? 'Chef bandit' : 'Bandit',
      maxHp: strong ? 110 : 60 + state.day * 3,
      atk: strong ? 13 : 7 + Math.floor(state.day / 2),
      speed: 75,
      group,
      offset: { x: rand(-35, 35), y: rand(-35, 35) },
    }));
  }
}

// ---------- Messages ----------
function logMsg(text) {
  const log = document.getElementById('log');
  const d = document.createElement('div');
  d.textContent = text;
  log.appendChild(d);
  while (log.children.length > 6) log.removeChild(log.firstChild);
  setTimeout(() => d.remove(), 9000);
}
function floatText(x, y, text, color) {
  state.floats.push({ x, y, text, color, t: 1.2 });
}

// ---------- Mise à jour ----------
function moveToward(u, tx, ty, dt, stopDist = 2) {
  const dx = tx - u.x, dy = ty - u.y;
  const d = Math.hypot(dx, dy);
  if (d <= stopDist) return true;
  const step = Math.min(d, u.speed * dt);
  let nx = u.x + dx / d * step;
  let ny = u.y + dy / d * step;
  if (u.team === 'bandit') {
    // les bandits n'entrent pas en ville
    const t = state.towns.find(t => Math.hypot(nx - t.x, ny - t.y) < t.r + 25);
    if (t) return false;
  }
  u.x = clamp(nx, 10, WORLD.w - 10);
  u.y = clamp(ny, 10, WORLD.h - 10);
  return false;
}

function nearestEnemy(u, maxRange) {
  let best = null, bd = maxRange;
  for (const o of state.units) {
    if (o.dead || o.team === u.team) continue;
    if (u.team === 'bandit' && townAt(o, 10)) continue; // protégés en ville
    const d = dist(u, o);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

function attack(u, t, dt) {
  const reach = u.radius + t.radius + u.range;
  if (dist(u, t) > reach) {
    moveToward(u, t.x, t.y, dt, reach - 2);
    return;
  }
  u.cd -= dt;
  if (u.cd > 0) return;
  u.cd = 1 + Math.random() * 0.3;
  if (Math.random() < 0.15) {
    floatText(t.x, t.y - 14, 'raté', '#ccc');
    return;
  }
  const dmg = Math.round(u.atk * rand(0.8, 1.25));
  t.hp -= dmg;
  floatText(t.x, t.y - 14, '-' + dmg, u.team === 'player' ? '#ffd27a' : '#ff6b6b');
  if (u.team === 'player') gainXp(u, 2);
  if (t.hp <= 0) kill(t, u);
}

function gainXp(u, n) {
  u.xp += n;
  const need = u.level * 30;
  if (u.xp >= need) {
    u.xp -= need;
    u.level++;
    u.maxHp += 12;
    u.hp = Math.min(u.maxHp, u.hp + 25);
    u.atk += 2;
    floatText(u.x, u.y - 26, 'Niveau ' + u.level + ' !', '#7ad7ff');
    logMsg(`${u.name} passe niveau ${u.level}.`);
  }
}

function kill(t, killer) {
  t.dead = true;
  t.selected = false;
  if (t.team === 'bandit') {
    state.kills++;
    const loot = randInt(8, 22) + (t.name === 'Chef bandit' ? 25 : 0);
    state.money += loot;
    floatText(t.x, t.y - 26, '+' + loot + ' 💰', '#ffe066');
    if (killer) gainXp(killer, 10);
    if (Math.random() < 0.3 && cargoUsed() < cargoMax()) {
      const g = pick(['food', 'cloth', 'iron']);
      state.inv[g]++;
      logMsg(`Butin : 1 ${GOODS[g].name.toLowerCase()}.`);
    }
  } else {
    logMsg(`☠ ${t.name} est mort.`);
  }
}

function updatePlayer(u, dt) {
  if (u.target && u.target.dead) { u.target = null; u.forced = false; }
  if (u.forced && u.target) { attack(u, u.target, dt); return; }
  if (u.dest) {
    if (moveToward(u, u.dest.x, u.dest.y, dt)) u.dest = null;
    return;
  }
  // inactif : riposte automatique
  if (!u.target || dist(u, u.target) > 260) u.target = nearestEnemy(u, 170);
  if (u.target) attack(u, u.target, dt);
}

function updateBandit(u, dt) {
  const g = u.group;
  if (u.target && (u.target.dead || townAt(u.target, 10) || dist(u, u.target) > 450)) u.target = null;
  if (!u.target) u.target = nearestEnemy(u, g.aggro ? 320 : 210);
  if (u.target) {
    g.aggro = true;
    attack(u, u.target, dt);
  } else {
    moveToward(u, g.wx + u.offset.x, g.wy + u.offset.y, dt * 0.6, 4);
  }
}

function updateGroups(dt) {
  for (const g of state.groups) {
    const members = state.units.filter(u => u.group === g && !u.dead);
    if (!members.length) { g.empty = true; continue; }
    g.aggro = members.some(m => m.target);
    g.wanderTimer -= dt;
    if (g.wanderTimer <= 0) {
      g.wanderTimer = rand(6, 14);
      for (let i = 0; i < 20; i++) {
        const nx = clamp(g.wx + rand(-400, 400), 100, WORLD.w - 100);
        const ny = clamp(g.wy + rand(-400, 400), 100, WORLD.h - 100);
        if (!state.towns.some(t => Math.hypot(nx - t.x, ny - t.y) < t.r + 120)) { g.wx = nx; g.wy = ny; break; }
      }
    }
  }
  state.groups = state.groups.filter(g => !g.empty);
}

function separate() {
  const us = state.units;
  for (let i = 0; i < us.length; i++) {
    for (let j = i + 1; j < us.length; j++) {
      const a = us[i], b = us[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const min = a.radius + b.radius;
      if (d < min) {
        const push = (min - d) / 2;
        a.x -= dx / d * push; a.y -= dy / d * push;
        b.x += dx / d * push; b.y += dy / d * push;
      }
    }
  }
}

function update(dt) {
  state.time += dt;

  for (const u of state.units) {
    if (u.dead) continue;
    if (u.team === 'player') updatePlayer(u, dt);
    else updateBandit(u, dt);
  }
  state.units = state.units.filter(u => !u.dead);
  separate();
  updateGroups(dt);

  // soins
  for (const u of players()) {
    const regen = townAt(u) ? 6 : (state.inv.food > 0 ? 0.4 : 0);
    u.hp = Math.min(u.maxHp, u.hp + regen * dt);
  }

  // jours et nourriture
  state.dayTimer += dt;
  if (state.dayTimer >= DAY_LENGTH) {
    state.dayTimer = 0;
    state.day++;
    const need = players().length;
    if (state.inv.food >= need) {
      state.inv.food -= need;
      logMsg(`Jour ${state.day}. L'escouade mange ${need} nourriture.`);
    } else {
      state.inv.food = 0;
      logMsg(`Jour ${state.day}. Pas assez de nourriture ! Tout le monde souffre de la faim.`);
      for (const u of players()) {
        u.hp -= 25;
        if (u.hp <= 0) kill(u, null);
      }
      state.units = state.units.filter(u => !u.dead);
    }
  }

  // bandits
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    state.spawnTimer = 18;
    if (state.groups.length < MAX_BANDIT_GROUPS) spawnBanditGroup();
  }

  // prix qui bougent
  state.priceTimer -= dt;
  if (state.priceTimer <= 0) {
    state.priceTimer = 15;
    for (const t of state.towns) for (const g in GOODS) {
      t.fluct[g] = clamp(t.fluct[g] + rand(-0.12, 0.12), 0.75, 1.3);
    }
    renderTown(true);
  }

  for (const f of state.floats) { f.t -= dt; f.y -= 20 * dt; }
  state.floats = state.floats.filter(f => f.t > 0);

  // ville actuelle
  const town = players().map(p => townAt(p)).find(Boolean) || null;
  if (town !== state.currentTown) {
    state.currentTown = town;
    if (town) logMsg(`Vous entrez à ${town.name}.`);
    renderTown(true);
  }

  if (!players().length && !state.over) {
    state.over = true;
    document.getElementById('goStats').textContent =
      `Survécu ${state.day} jour(s) — ${state.kills} bandit(s) vaincu(s) — ${state.money} 💰`;
    document.getElementById('gameover').classList.remove('hidden');
  }
}

// ---------- Caméra ----------
const keys = {};
function centerCamera() {
  const ps = players();
  if (!ps.length) return;
  const sel = ps.filter(p => p.selected);
  const list = sel.length ? sel : ps;
  camera.x = list.reduce((a, p) => a + p.x, 0) / list.length;
  camera.y = list.reduce((a, p) => a + p.y, 0) / list.length;
}
function updateCamera(dt) {
  const sp = 600 / camera.zoom * dt;
  if (keys['arrowleft'] || keys['a'] || keys['q']) camera.x -= sp;
  if (keys['arrowright'] || keys['d']) camera.x += sp;
  if (keys['arrowup'] || keys['w'] || keys['z']) camera.y -= sp;
  if (keys['arrowdown'] || keys['s']) camera.y += sp;
  camera.x = clamp(camera.x, 0, WORLD.w);
  camera.y = clamp(camera.y, 0, WORLD.h);
}
function screenToWorld(sx, sy) {
  return {
    x: (sx - canvas.width / 2) / camera.zoom + camera.x,
    y: (sy - canvas.height / 2) / camera.zoom + camera.y,
  };
}

// ---------- Rendu ----------
function draw() {
  const W = canvas.width, H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#120e09';
  ctx.fillRect(0, 0, W, H);

  ctx.setTransform(camera.zoom, 0, 0, camera.zoom,
    W / 2 - camera.x * camera.zoom, H / 2 - camera.y * camera.zoom);

  const view = {
    x0: camera.x - W / 2 / camera.zoom - 50, x1: camera.x + W / 2 / camera.zoom + 50,
    y0: camera.y - H / 2 / camera.zoom - 50, y1: camera.y + H / 2 / camera.zoom + 50,
  };
  const inView = (x, y, r = 0) => x + r > view.x0 && x - r < view.x1 && y + r > view.y0 && y - r < view.y1;

  // sol
  ctx.fillStyle = '#c9a66b';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  for (const p of patches) {
    if (!inView(p.x, p.y, p.r)) continue;
    ctx.fillStyle = p.dark ? 'rgba(120, 90, 50, 0.18)' : 'rgba(240, 210, 150, 0.2)';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }

  // routes
  ctx.strokeStyle = 'rgba(150, 115, 70, 0.55)';
  ctx.lineWidth = 18;
  ctx.beginPath();
  const T = state.towns;
  const roads = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]];
  for (const [a, b] of roads) { ctx.moveTo(T[a].x, T[a].y); ctx.lineTo(T[b].x, T[b].y); }
  ctx.stroke();

  // décor
  for (const d of decor) {
    if (!inView(d.x, d.y, d.r)) continue;
    ctx.fillStyle = d.kind === 'rock' ? '#8a7558' : '#7d8a4a';
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
  }

  // villes
  for (const t of T) {
    if (!inView(t.x, t.y, t.r + 40)) continue;
    ctx.fillStyle = 'rgba(90, 70, 45, 0.35)';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0.2, Math.PI * 2 - 0.2); ctx.stroke();
    const br = mulberry32(t.x * 7 + t.y);
    for (let i = 0; i < 9; i++) {
      const a = br() * Math.PI * 2, r = br() * (t.r - 45);
      ctx.fillStyle = br() < 0.5 ? '#a08560' : '#8f7550';
      const s = 20 + br() * 18;
      ctx.fillRect(t.x + Math.cos(a) * r - s / 2, t.y + Math.sin(a) * r - s / 2, s, s * 0.8);
    }
    ctx.fillStyle = '#fff4dc';
    ctx.font = 'bold 20px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(t.name, t.x, t.y - t.r - 14);
  }

  // destinations
  for (const u of players()) {
    if (u.selected && u.dest) {
      ctx.strokeStyle = 'rgba(120, 220, 120, 0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(u.dest.x, u.dest.y, 4, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // unités
  for (const u of state.units) {
    if (!inView(u.x, u.y, 20)) continue;
    if (u.selected) {
      ctx.strokeStyle = '#7dff7d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(u.x, u.y, u.radius + 4, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = u.team === 'player' ? '#3b7dd8' : (u.name === 'Chef bandit' ? '#7a1010' : '#c0392b');
    ctx.beginPath(); ctx.arc(u.x, u.y, u.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 1.5; ctx.stroke();
    // barre de vie
    const w = 22;
    ctx.fillStyle = '#300';
    ctx.fillRect(u.x - w / 2, u.y - u.radius - 8, w, 3);
    ctx.fillStyle = u.team === 'player' ? '#6fcf5a' : '#ff7b5a';
    ctx.fillRect(u.x - w / 2, u.y - u.radius - 8, w * Math.max(0, u.hp / u.maxHp), 3);
    if (u.team === 'player' && camera.zoom > 0.7) {
      ctx.fillStyle = '#fff'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(u.name, u.x, u.y + u.radius + 11);
    }
  }

  // textes flottants
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px system-ui';
  for (const f of state.floats) {
    ctx.globalAlpha = Math.min(1, f.t);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // assombrissement nuit
  const phase = state.dayTimer / DAY_LENGTH;
  const night = Math.max(0, Math.sin((phase - 0.6) * Math.PI / 0.4)) * 0.35;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (night > 0) {
    ctx.fillStyle = `rgba(10, 15, 40, ${night})`;
    ctx.fillRect(0, 0, W, H);
  }

  // rectangle de sélection
  if (drag && drag.moved) {
    ctx.strokeStyle = '#7dff7d'; ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(125,255,125,0.08)';
    const x = Math.min(drag.sx, drag.ex), y = Math.min(drag.sy, drag.ey);
    const w = Math.abs(drag.ex - drag.sx), h = Math.abs(drag.ey - drag.sy);
    ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
  }

  if (state.paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 32px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('PAUSE', W / 2, H / 2);
  }

  drawMinimap();
}

function drawMinimap() {
  const sx = mini.width / WORLD.w, sy = mini.height / WORLD.h;
  mctx.fillStyle = '#b8955c';
  mctx.fillRect(0, 0, mini.width, mini.height);
  for (const t of state.towns) {
    mctx.fillStyle = '#5a4630';
    mctx.beginPath(); mctx.arc(t.x * sx, t.y * sy, 5, 0, Math.PI * 2); mctx.fill();
  }
  for (const u of state.units) {
    mctx.fillStyle = u.team === 'player' ? '#3b7dd8' : '#c0392b';
    mctx.fillRect(u.x * sx - 1.5, u.y * sy - 1.5, 3, 3);
  }
  const vw = canvas.width / camera.zoom, vh = canvas.height / camera.zoom;
  mctx.strokeStyle = '#fff'; mctx.lineWidth = 1;
  mctx.strokeRect((camera.x - vw / 2) * sx, (camera.y - vh / 2) * sy, vw * sx, vh * sy);
}

// ---------- Interface HTML ----------
let hudTimer = 0;
function renderHud() {
  document.getElementById('money').textContent = state.money;
  document.getElementById('food').textContent = state.inv.food;
  document.getElementById('cargo').textContent = `${cargoUsed()}/${cargoMax()}`;
  document.getElementById('day').textContent = state.day;

  const list = document.getElementById('squadList');
  list.innerHTML = players().map(u => `
    <div class="member ${u.selected ? 'sel' : ''}" data-id="${u.id}">
      <b>${u.name}</b> <small>niv ${u.level} · ⚔ ${u.atk}</small>
      <div class="bar"><div style="width:${Math.max(0, u.hp / u.maxHp * 100)}%"></div></div>
      <small>${Math.ceil(u.hp)} / ${u.maxHp} PV</small>
    </div>`).join('');

  // met à jour les boutons de la ville sans les recréer (sinon les clics se perdent)
  const t = state.currentTown;
  if (!t) return;
  const full = cargoUsed() >= cargoMax();
  for (const b of document.querySelectorAll('#town button')) {
    if (b.dataset.buy) b.disabled = state.money < price(t, b.dataset.buy).buy || full;
    else if (b.dataset.sell) b.disabled = state.inv[b.dataset.sell] <= 0;
    else if ('recruit' in b.dataset) b.disabled = state.money < recruitCost() || players().length >= MAX_SQUAD;
  }
}

function renderTown(force) {
  const el = document.getElementById('town');
  const t = state.currentTown;
  if (!t) { el.classList.add('hidden'); return; }
  if (!force) return;
  el.classList.remove('hidden');
  const full = cargoUsed() >= cargoMax();
  let rows = '';
  for (const g in GOODS) {
    const p = price(t, g);
    rows += `<tr>
      <td>${GOODS[g].icon} ${GOODS[g].name}</td>
      <td>${state.inv[g]}</td>
      <td><button data-buy="${g}" ${state.money < p.buy || full ? 'disabled' : ''}>Acheter ${p.buy}</button></td>
      <td><button data-sell="${g}" ${state.inv[g] <= 0 ? 'disabled' : ''}>Vendre ${p.sell}</button></td>
    </tr>`;
  }
  const cost = recruitCost();
  el.innerHTML = `
    <h3>🏰 ${t.name}</h3>
    <table>
      <tr><th>Marchandise</th><th>Sac</th><th></th><th></th></tr>
      ${rows}
    </table>
    <div class="note">Maj + clic = ×5. Les blessés se soignent ici.</div>
    <hr style="border-color:#6b5536">
    <button data-recruit ${state.money < cost || players().length >= MAX_SQUAD ? 'disabled' : ''}>
      Recruter un combattant (${cost} 💰)</button>
    <div class="note">${players().length}/${MAX_SQUAD} membres</div>`;
}

document.getElementById('town').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || !state.currentTown) return;
  const t = state.currentTown;
  const times = e.shiftKey ? 5 : 1;
  if (b.dataset.buy) {
    const g = b.dataset.buy;
    for (let i = 0; i < times; i++) {
      const p = price(t, g).buy;
      if (state.money < p || cargoUsed() >= cargoMax()) break;
      state.money -= p; state.inv[g]++;
    }
  } else if (b.dataset.sell) {
    const g = b.dataset.sell;
    for (let i = 0; i < times; i++) {
      if (state.inv[g] <= 0) break;
      state.money += price(t, g).sell; state.inv[g]--;
    }
  } else if ('recruit' in b.dataset) {
    const cost = recruitCost();
    if (state.money >= cost && players().length < MAX_SQUAD) {
      state.money -= cost;
      const u = makeUnit('player', t.x + rand(-20, 20), t.y + rand(-20, 20), {
        maxHp: randInt(85, 110), atk: randInt(8, 12),
      });
      state.units.push(u);
      logMsg(`${u.name} rejoint l'escouade !`);
    }
  }
  renderTown(true);
  renderHud();
});

document.getElementById('squadList').addEventListener('click', e => {
  const m = e.target.closest('.member');
  if (!m) return;
  const id = Number(m.dataset.id);
  for (const u of players()) {
    if (e.shiftKey) { if (u.id === id) u.selected = !u.selected; }
    else u.selected = u.id === id;
  }
  if (!e.shiftKey) centerCamera();
  renderHud();
});

// ---------- Entrées ----------
let drag = null;
canvas.addEventListener('mousedown', e => {
  if (e.button === 0) drag = { sx: e.clientX, sy: e.clientY, ex: e.clientX, ey: e.clientY, moved: false, shift: e.shiftKey };
});
window.addEventListener('mousemove', e => {
  if (!drag) return;
  drag.ex = e.clientX; drag.ey = e.clientY;
  if (Math.hypot(drag.ex - drag.sx, drag.ey - drag.sy) > 6) drag.moved = true;
});
window.addEventListener('mouseup', e => {
  if (e.button !== 0 || !drag) return;
  const ps = players();
  if (drag.moved) {
    const a = screenToWorld(Math.min(drag.sx, drag.ex), Math.min(drag.sy, drag.ey));
    const b = screenToWorld(Math.max(drag.sx, drag.ex), Math.max(drag.sy, drag.ey));
    for (const u of ps) {
      const inside = u.x >= a.x && u.x <= b.x && u.y >= a.y && u.y <= b.y;
      u.selected = drag.shift ? (u.selected || inside) : inside;
    }
  } else {
    const w = screenToWorld(e.clientX, e.clientY);
    const hit = ps.find(u => dist(u, w) < u.radius + 6);
    if (drag.shift) { if (hit) hit.selected = !hit.selected; }
    else ps.forEach(u => (u.selected = u === hit));
  }
  drag = null;
  renderHud();
});

canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (state.over) return;
  const w = screenToWorld(e.clientX, e.clientY);
  let squad = players().filter(u => u.selected);
  if (!squad.length) squad = players();
  const enemy = enemies().find(u => dist(u, w) < u.radius + 8);
  if (enemy) {
    for (const u of squad) { u.target = enemy; u.forced = true; u.dest = null; }
    floatText(enemy.x, enemy.y - 20, '⚔', '#fff');
    return;
  }
  // formation en grille autour du point cliqué
  const cols = Math.ceil(Math.sqrt(squad.length));
  squad.forEach((u, i) => {
    const cx = (i % cols) - (cols - 1) / 2;
    const cy = Math.floor(i / cols) - (Math.ceil(squad.length / cols) - 1) / 2;
    u.dest = { x: clamp(w.x + cx * 26, 10, WORLD.w - 10), y: clamp(w.y + cy * 26, 10, WORLD.h - 10) };
    u.target = null; u.forced = false;
  });
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  camera.zoom = clamp(camera.zoom * (e.deltaY < 0 ? 1.1 : 0.9), 0.4, 2.2);
}, { passive: false });

mini.addEventListener('click', e => {
  const r = mini.getBoundingClientRect();
  camera.x = (e.clientX - r.left) / mini.width * WORLD.w;
  camera.y = (e.clientY - r.top) / mini.height * WORLD.h;
});

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k === ' ') { e.preventDefault(); centerCamera(); }
  if (k === 'p') state.paused = !state.paused;
  if (k === 'h') toggleHelp();
  if (k === 'e') { players().forEach(u => (u.selected = true)); renderHud(); }
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

const help = document.getElementById('help');
function toggleHelp() {
  help.classList.toggle('hidden');
  state.paused = !help.classList.contains('hidden');
}
document.getElementById('helpBtn').onclick = toggleHelp;
document.getElementById('closeHelp').onclick = toggleHelp;
document.getElementById('restart').onclick = () => { newGame(); };

// ---------- Boucle ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  updateCamera(dt);
  if (!state.paused && !state.over) update(dt);
  hudTimer -= dt;
  if (hudTimer <= 0) { hudTimer = 0.25; renderHud(); }
  draw();
  requestAnimationFrame(loop);
}

newGame();
state.paused = true; // l'aide est affichée au lancement
requestAnimationFrame(loop);
