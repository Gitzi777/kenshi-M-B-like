// Terres Arides — prototype 3D à la 3e personne (Kenshi / Mount & Blade)
// Création de perso, monde ouvert, combat, escouade, commerce.
'use strict';

const T = THREE;

// ---------- Réglages ----------
const WORLD = 900;              // le monde va de -450 à +450 (mètres)
const HALF = WORLD / 2;
const DAY_LENGTH = 240;         // secondes réelles par jour
const CARRY_PER_MEMBER = 20;
const MAX_SQUAD = 8;            // toi compris
const MAX_GROUPS = 8;

const GOODS = {
  food:   { name: 'Nourriture', icon: '🍖', base: 8 },
  cloth:  { name: 'Tissu',      icon: '🧵', base: 16 },
  iron:   { name: 'Fer',        icon: '⛏️', base: 26 },
  spices: { name: 'Épices',     icon: '🌶️', base: 42 },
};

const TOWNS = [
  { name: 'Port-Sable',  x: -230, z: -200, r: 32, mult: { food: 0.6, cloth: 1.0, iron: 1.1, spices: 1.5 } },
  { name: 'Forge-Noire', x: 250,  z: -230, r: 32, mult: { food: 1.5, cloth: 1.1, iron: 0.6, spices: 1.0 } },
  { name: 'Oasis-Rouge', x: 230,  z: 240,  r: 32, mult: { food: 1.0, cloth: 1.5, iron: 1.2, spices: 0.6 } },
  { name: 'Hautemur',    x: -250, z: 220,  r: 32, mult: { food: 1.1, cloth: 0.6, iron: 1.5, spices: 1.2 } },
];

const ORIGINS = [
  { id: 'vagabond', name: 'Vagabond', desc: 'Rien à perdre. 150 💰 et un peu de nourriture.', money: 150, inv: { food: 4 }, bonus: {} },
  { id: 'marchand', name: 'Marchand ruiné', desc: '400 💰 et du tissu à revendre, mais -1 Force.', money: 400, inv: { food: 4, cloth: 6 }, bonus: { F: -1 } },
  { id: 'deserteur', name: 'Déserteur', desc: '+1 Force, +1 Endurance. Seulement 40 💰.', money: 40, inv: { food: 3 }, bonus: { F: 1, E: 1 } },
  { id: 'esclave', name: 'Esclave évadé', desc: '+2 Agilité. Aucune pièce. Bonne chance.', money: 0, inv: { food: 1 }, bonus: { A: 2 } },
];
const BODY_COLORS = ['#7a5a3a', '#3d5a7a', '#7a2e2e', '#4a6b3a', '#c9b48a', '#3a3a3a'];
const SKIN_COLORS = ['#f1c9a5', '#d9a47a', '#a8714a', '#6e4428', '#3f2615'];
const STATS = [
  { key: 'F', name: 'Force', hint: 'dégâts' },
  { key: 'A', name: 'Agilité', hint: 'vitesse, frappes' },
  { key: 'E', name: 'Endurance', hint: 'points de vie' },
];
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
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
function angleDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
function turnToward(cur, target, maxStep) { const d = angleDiff(cur, target); return cur + clamp(d, -maxStep, maxStep); }

// ---------- Terrain ----------
function rawHeight(x, z) {
  return Math.sin(x * 0.011) * 3 + Math.cos(z * 0.013) * 3 + Math.sin((x + z) * 0.027) * 1.2 +
    Math.sin(x * 0.004 + 1) * Math.cos(z * 0.005 - 2) * 9;
}
for (const t of TOWNS) {
  t.h = rawHeight(t.x, t.z);
  t.gate = Math.atan2(-t.z, -t.x);       // porte tournée vers le centre du monde
}
function heightAt(x, z) {
  let h = rawHeight(x, z);
  for (const t of TOWNS) {
    const d = Math.hypot(x - t.x, z - t.z);
    if (d < t.r + 40) h += (t.h - h) * (1 - smooth(t.r + 2, t.r + 40, d));
  }
  return h;
}

// ---------- Scène ----------
const view = document.getElementById('view');
const renderer = new T.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
view.appendChild(renderer.domElement);

const scene = new T.Scene();
const SKY_DAY = new T.Color('#d9c4a0');
const SKY_NIGHT = new T.Color('#0d1222');
scene.background = SKY_DAY.clone();
scene.fog = new T.Fog(SKY_DAY.clone(), 60, 260);

const camera = new T.PerspectiveCamera(65, 1, 0.1, 1000);
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const hemi = new T.HemisphereLight(0xfff1d6, 0x6b5536, 0.6);
scene.add(hemi);
const sun = new T.DirectionalLight(0xfff0d0, 1.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 300 });
scene.add(sun, sun.target);

const matCache = {};
function mat(color) {
  if (!matCache[color]) matCache[color] = new T.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95 });
  return matCache[color];
}

// sol
(function buildTerrain() {
  const geo = new T.PlaneGeometry(WORLD + 200, WORLD + 200, 200, 200);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const rng = mulberry32(7);
  const c = new T.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const k = clamp((h + 12) / 24, 0, 1);
    c.setRGB(0.62 + k * 0.2, 0.48 + k * 0.17, 0.3 + k * 0.1);
    c.offsetHSL(0, 0, (rng() - 0.5) * 0.04);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);
})();

// obstacles (rochers, bâtiments) : cercles {x, z, r}
const obstacles = [];
function nearTown(x, z, margin) { return TOWNS.some(t => Math.hypot(x - t.x, z - t.z) < t.r + margin); }

(function buildDecor() {
  const rng = mulberry32(42);
  const dummy = new T.Object3D();
  const rocks = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), mat('#8a7558'), 420);
  rocks.castShadow = true; rocks.receiveShadow = true;
  let n = 0;
  while (n < 420) {
    const x = (rng() - 0.5) * WORLD, z = (rng() - 0.5) * WORLD;
    if (nearTown(x, z, 12)) continue;
    const s = rng() < 0.12 ? 2.5 + rng() * 4 : 0.3 + rng() * 1.4;
    dummy.position.set(x, heightAt(x, z) + s * 0.3, z);
    dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    dummy.scale.set(s, s * (0.6 + rng() * 0.5), s);
    dummy.updateMatrix();
    rocks.setMatrixAt(n++, dummy.matrix);
    if (s > 1.2) obstacles.push({ x, z, r: s * 0.9 });
  }
  scene.add(rocks);

  const cacti = new T.InstancedMesh(new T.CylinderGeometry(0.25, 0.3, 1, 6), mat('#6f7d3c'), 180);
  cacti.castShadow = true;
  n = 0;
  while (n < 180) {
    const x = (rng() - 0.5) * WORLD, z = (rng() - 0.5) * WORLD;
    if (nearTown(x, z, 8)) continue;
    const h = 1.5 + rng() * 2.5;
    dummy.position.set(x, heightAt(x, z) + h / 2, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, h, 1);
    dummy.updateMatrix();
    cacti.setMatrixAt(n++, dummy.matrix);
  }
  scene.add(cacti);
})();

function textSprite(text, size = 1) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 96;
  const g = cv.getContext('2d');
  g.font = 'bold 56px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = 'rgba(30,20,10,.8)';
  g.strokeText(text, 256, 48);
  g.fillStyle = '#fff4dc';
  g.fillText(text, 256, 48);
  const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), depthWrite: false }));
  sp.scale.set(16 * size, 3 * size, 1);
  return sp;
}

function buildTown(t) {
  const g = new T.Group();
  g.position.set(t.x, t.h, t.z);
  const rng = mulberry32(Math.round(t.x * 13 + t.z));
  // muraille avec une porte
  const segs = 36;
  const segLen = 2 * Math.PI * t.r / segs + 0.4;
  for (let i = 0; i < segs; i++) {
    const a = i / segs * Math.PI * 2;
    if (Math.abs(angleDiff(a, t.gate)) < 0.2) continue;
    const w = new T.Mesh(new T.BoxGeometry(segLen, 4.5, 1.2), mat('#8d7350'));
    w.position.set(Math.cos(a) * t.r, 2, Math.sin(a) * t.r);
    w.rotation.y = -a - Math.PI / 2;
    w.castShadow = true; w.receiveShadow = true;
    g.add(w);
  }
  for (const s of [-1, 1]) {
    const a = t.gate + s * 0.24;
    const tower = new T.Mesh(new T.CylinderGeometry(1.8, 2.1, 7, 8), mat('#7a6243'));
    tower.position.set(Math.cos(a) * t.r, 3.5, Math.sin(a) * t.r);
    tower.castShadow = true;
    g.add(tower);
  }
  // maisons
  const houses = [];
  let tries = 0;
  while (houses.length < 9 && tries++ < 200) {
    const a = rng() * Math.PI * 2, r = 10 + rng() * (t.r - 17);
    const hx = Math.cos(a) * r, hz = Math.sin(a) * r;
    if (Math.abs(angleDiff(a, t.gate)) < 0.5) continue; // garder l'allée de la porte libre
    const w = 5 + rng() * 4, dpt = 5 + rng() * 3, h = 3 + rng() * 2.5;
    if (houses.some(o => Math.hypot(o.x - hx, o.z - hz) < (o.r + Math.max(w, dpt) / 2 + 1.5))) continue;
    houses.push({ x: hx, z: hz, r: Math.max(w, dpt) / 2 });
    const house = new T.Mesh(new T.BoxGeometry(w, h, dpt), mat(rng() < 0.5 ? '#b39468' : '#a3835a'));
    house.position.set(hx, h / 2, hz);
    house.rotation.y = rng() * Math.PI;
    house.castShadow = true; house.receiveShadow = true;
    const roof = new T.Mesh(new T.BoxGeometry(w + 0.6, 0.4, dpt + 0.6), mat('#6e5538'));
    roof.position.y = h / 2 + 0.2;
    house.add(roof);
    g.add(house);
    obstacles.push({ x: t.x + hx, z: t.z + hz, r: Math.max(w, dpt) / 2 + 0.3 });
  }
  // étal du marché au centre
  const clothes = ['#b8452e', '#2e6db8', '#d1a12c'];
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + 0.5;
    const stall = new T.Group();
    stall.position.set(Math.cos(a) * 5, 0, Math.sin(a) * 5);
    stall.rotation.y = -a;
    const table = new T.Mesh(new T.BoxGeometry(2.4, 0.9, 1.2), mat('#6e5538'));
    table.position.y = 0.45;
    const tarp = new T.Mesh(new T.BoxGeometry(3, 0.1, 2), mat(clothes[i]));
    tarp.position.y = 2.3;
    for (const [px, pz] of [[-1.3, -0.8], [1.3, -0.8], [-1.3, 0.8], [1.3, 0.8]]) {
      const post = new T.Mesh(new T.BoxGeometry(0.1, 2.3, 0.1), mat('#4a3826'));
      post.position.set(px, 1.15, pz);
      stall.add(post);
    }
    stall.add(table, tarp);
    g.add(stall);
    obstacles.push({ x: t.x + Math.cos(a) * 5, z: t.z + Math.sin(a) * 5, r: 1.4 });
  }
  const label = textSprite(t.name);
  label.position.y = 16;
  g.add(label);
  scene.add(g);
}
TOWNS.forEach(buildTown);

// ---------- Personnages ----------
function makeCharacter(look) {
  const root = new T.Group();
  const body = new T.Group();
  body.scale.setScalar(look.height || 1);
  root.add(body);
  const own = c => new T.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9 });
  const mBody = own(look.body), mSkin = own(look.skin), mPants = own(look.pants || '#3b2f22');
  const box = (w, h, d, m) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.castShadow = true; return b; };

  const limb = (x, y, w, h, m) => {
    const pivot = new T.Group();
    pivot.position.set(x, y, 0);
    const mesh = box(w, h, w, m);
    mesh.position.y = -h / 2;
    pivot.add(mesh);
    body.add(pivot);
    return pivot;
  };
  const legL = limb(-0.14, 0.9, 0.19, 0.9, mPants);
  const legR = limb(0.14, 0.9, 0.19, 0.9, mPants);
  const torso = box(0.52, 0.66, 0.3, mBody);
  torso.position.y = 1.24;
  body.add(torso);
  const head = box(0.3, 0.32, 0.3, mSkin);
  head.position.y = 1.76;
  body.add(head);
  if (look.hat) {
    const hat = box(0.36, 0.12, 0.36, own(look.hat));
    hat.position.y = 1.96;
    body.add(hat);
  }
  const armL = limb(-0.34, 1.52, 0.14, 0.62, mBody);
  const armR = limb(0.34, 1.52, 0.14, 0.62, mBody);
  // épée tenue dans la main droite, lame vers l'avant
  const sword = new T.Group();
  sword.position.y = -0.6;
  const blade = box(0.05, 0.05, 1.0, own('#c9ccd1'));
  blade.position.z = 0.55;
  const guard = box(0.25, 0.05, 0.05, own('#5a4630'));
  guard.position.z = 0.05;
  sword.add(blade, guard);
  armR.add(sword);
  return { root, body, legL, legR, armL, armR, torso, hurtMats: [mBody, mSkin] };
}

function makeBar(color) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 8;
  const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), depthTest: false }));
  sp.scale.set(1, 0.13, 1);
  sp.renderOrder = 10;
  return { sp, cv, color };
}
function drawBar(u) {
  if (!u.bar) return;
  const g = u.bar.cv.getContext('2d');
  g.fillStyle = '#2a0b05'; g.fillRect(0, 0, 64, 8);
  g.fillStyle = u.bar.color; g.fillRect(1, 1, 62 * Math.max(0, u.hp / u.maxHp), 6);
  u.bar.sp.material.map.needsUpdate = true;
}

const units = [];
function makeUnit(team, x, z, o = {}) {
  const look = o.look || {};
  const c = makeCharacter(look);
  c.root.position.set(x, heightAt(x, z), z);
  scene.add(c.root);
  const maxHp = o.maxHp || 80;
  const u = {
    team, c, pos: c.root.position, name: o.name || pick(NAMES), look,
    maxHp, hp: maxHp, atk: o.atk || 8, speed: o.speed || 4.6, cooldown: o.cooldown || 1.1,
    blockChance: o.blockChance || 0.2,
    yaw: rand(-3, 3), moving: 0, walk: 0,
    atkCd: rand(0, 1), atkTime: -1, hitDone: false,
    blocking: false, blockTimer: 0, hurt: 0, knock: { x: 0, z: 0 },
    target: null, retarget: 0, dead: false, deadTime: 0,
    group: o.group || null, offset: o.offset || { x: 0, z: 0 },
    home: o.home || null, level: 1, xp: 0,
  };
  if (team !== 'player') {
    u.bar = makeBar({ ally: '#6fcf5a', bandit: '#ff6b4a', guard: '#9fc3ff' }[team]);
    u.bar.sp.position.y = 2.25 * (look.height || 1);
    c.root.add(u.bar.sp);
    drawBar(u);
  }
  units.push(u);
  return u;
}

const hostile = (a, b) => a.team === 'bandit' ? b.team !== 'bandit' : b.team === 'bandit';
const alive = u => u && !u.dead && !(u.team === 'player' && state.ko > 0);

// ---------- État ----------
const state = {
  mode: 'create', money: 0, inv: { food: 0, cloth: 0, iron: 0, spices: 0 },
  day: 1, dayTimer: 20, spawnTimer: 5, priceTimer: 15, kills: 0,
  order: 'follow', ko: 0, menu: false, currentTown: null,
  groups: [],
};
for (const t of TOWNS) t.fluct = { food: 1, cloth: 1, iron: 1, spices: 1 };
let player = null;
const squad = () => units.filter(u => u.team === 'ally' && !u.dead);
const cargoUsed = () => Object.values(state.inv).reduce((a, b) => a + b, 0);
const cargoMax = () => (squad().length + 1) * CARRY_PER_MEMBER;
const townAt = (p, margin = 0) => TOWNS.find(t => Math.hypot(p.x - t.x, p.z - t.z) < t.r + margin) || null;
function price(t, g) {
  const buy = Math.max(1, Math.round(GOODS[g].base * t.mult[g] * t.fluct[g]));
  return { buy, sell: Math.max(1, Math.round(buy * 0.8)) };
}
const recruitCost = () => 80 + 50 * squad().length;

// ---------- Messages ----------
function logMsg(text) {
  const log = document.getElementById('log');
  const d = document.createElement('div');
  d.textContent = text;
  log.appendChild(d);
  while (log.children.length > 6) log.removeChild(log.firstChild);
  setTimeout(() => d.remove(), 9000);
}
const floats = [];
function floatText(pos, text, color) {
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = text;
  el.style.color = color;
  document.getElementById('floats').appendChild(el);
  floats.push({ el, p: new T.Vector3(pos.x + rand(-0.3, 0.3), pos.y + 2.2, pos.z), t: 1.2 });
}

// ---------- Combat ----------
function startAttack(u) {
  if (u.atkCd > 0 || u.atkTime >= 0 || u.blocking) return false;
  u.atkTime = 0; u.hitDone = false; u.atkCd = u.cooldown;
  // les IA proches tentent de parer
  for (const o of units) {
    if (!alive(o) || o.team === 'player' || !hostile(u, o) || d2(u.pos, o.pos) > 3.5) continue;
    if (Math.random() < o.blockChance && o.atkTime < 0) { o.blocking = true; o.blockTimer = 0.7; }
  }
  return true;
}

function facing(u, other) {
  const dx = other.pos.x - u.pos.x, dz = other.pos.z - u.pos.z;
  const d = Math.hypot(dx, dz) || 1;
  return (Math.sin(u.yaw) * dx + Math.cos(u.yaw) * dz) / d;
}

function resolveHit(u) {
  let hits = 0;
  for (const o of units) {
    if (!alive(o) || !hostile(u, o)) continue;
    if (d2(u.pos, o.pos) > 2.4 || facing(u, o) < 0.35) continue;
    damage(o, u);
    if (++hits >= (u.team === 'player' ? 3 : 1)) break;
  }
  if (!hits && u.team === 'player') floatText(u.pos, '~', '#ccc');
}

function damage(o, u) {
  let dmg = u.atk * rand(0.8, 1.2);
  if (o.blocking && facing(o, u) > 0.3) {
    dmg *= 0.15;
    floatText(o.pos, 'paré', '#9fc3ff');
  }
  dmg = Math.round(dmg);
  o.hp -= dmg;
  o.hurt = 0.15;
  const dx = o.pos.x - u.pos.x, dz = o.pos.z - u.pos.z, d = Math.hypot(dx, dz) || 1;
  o.knock.x = dx / d * 4; o.knock.z = dz / d * 4;
  if (dmg > 0) floatText(o.pos, '-' + dmg, o.team === 'bandit' ? '#ffd27a' : '#ff6b6b');
  drawBar(o);
  if (o.team === 'bandit' && o.group) o.group.aggro = true;
  if (!o.target && o.team !== 'player') o.target = u;
  if (u.team === 'player') gainXp(u, 2);
  if (o.hp <= 0) kill(o, u);
}

function gainXp(u, n) {
  u.xp += n;
  const need = u.level * 40;
  if (u.xp < need) return;
  u.xp -= need;
  u.level++;
  u.maxHp += 10; u.hp = Math.min(u.maxHp, u.hp + 30); u.atk += 1.5;
  floatText(u.pos, 'Niveau ' + u.level + ' !', '#7ad7ff');
  logMsg(`${u.name} passe niveau ${u.level}.`);
}

function kill(o, killer) {
  if (o.team === 'player') { knockOut(); return; }
  o.dead = true;
  o.blocking = false;
  if (o.bar) o.bar.sp.visible = false;
  if (o.team === 'bandit') {
    state.kills++;
    const loot = randInt(6, 18) + (o.name === 'Chef bandit' ? 30 : 0);
    state.money += loot;
    floatText(o.pos, '+' + loot + ' 💰', '#ffe066');
    if (killer && killer.team === 'player') gainXp(killer, 12);
    if (Math.random() < 0.3 && cargoUsed() < cargoMax()) {
      const g = pick(['food', 'cloth', 'iron']);
      state.inv[g]++;
      logMsg(`Butin : 1 ${GOODS[g].name.toLowerCase()}.`);
    }
  } else if (o.team === 'ally') {
    logMsg(`☠ ${o.name} est mort.`);
  }
}

function knockOut() {
  if (state.ko > 0) return;
  state.ko = 4;
  player.hp = 0;
  player.blocking = false;
  const lost = Math.floor(state.money / 2);
  state.money -= lost;
  for (const g in state.inv) state.inv[g] = Math.floor(state.inv[g] / 2);
  document.getElementById('koText').textContent =
    `Les bandits te dépouillent (-${lost} 💰, la moitié de ton sac). Tu te réveilleras en ville…`;
  document.getElementById('ko').classList.remove('hidden');
  for (const u of units) if (u.target === player) u.target = null;
  if (document.pointerLockElement) document.exitPointerLock();
}

function wakeUp() {
  let best = TOWNS[0];
  for (const t of TOWNS) if (d2(t, player.pos) < d2(best, player.pos)) best = t;
  const sx = best.x + Math.cos(best.gate) * (best.r - 6), sz = best.z + Math.sin(best.gate) * (best.r - 6);
  player.pos.set(sx, heightAt(sx, sz), sz);
  player.hp = Math.round(player.maxHp * 0.3);
  squad().forEach((a, i) => a.pos.set(sx + rand(-3, 3), 0, sz + rand(-3, 3)));
  document.getElementById('ko').classList.add('hidden');
  logMsg(`Tu te réveilles à ${best.name}, couvert de bleus.`);
}

// ---------- Déplacements ----------
function steer(u, tx, tz, dt, speedMul = 1, stop = 0.3) {
  const dx = tx - u.pos.x, dz = tz - u.pos.z;
  const d = Math.hypot(dx, dz);
  if (d <= stop) { u.moving = 0; return true; }
  u.yaw = turnToward(u.yaw, Math.atan2(dx, dz), dt * 8);
  const step = Math.min(d - stop + 0.01, u.speed * speedMul * dt);
  const nx = u.pos.x + dx / d * step, nz = u.pos.z + dz / d * step;
  if (u.team === 'bandit' && nearTown(nx, nz, 6)) { u.moving = 0; return false; }
  u.pos.x = nx; u.pos.z = nz;
  u.moving = speedMul;
  return false;
}

function collide(u) {
  for (const o of obstacles) {
    const dx = u.pos.x - o.x, dz = u.pos.z - o.z;
    const d = Math.hypot(dx, dz);
    const min = o.r + 0.4;
    if (d < min && d > 0.001) { u.pos.x = o.x + dx / d * min; u.pos.z = o.z + dz / d * min; }
  }
  for (const t of TOWNS) {
    const dx = u.pos.x - t.x, dz = u.pos.z - t.z;
    const d = Math.hypot(dx, dz);
    if (Math.abs(d - t.r) < 1.1 && Math.abs(angleDiff(Math.atan2(dz, dx), t.gate)) > 0.17) {
      const nr = d < t.r ? t.r - 1.1 : t.r + 1.1;
      u.pos.x = t.x + dx / d * nr; u.pos.z = t.z + dz / d * nr;
    }
  }
  u.pos.x = clamp(u.pos.x, -HALF, HALF);
  u.pos.z = clamp(u.pos.z, -HALF, HALF);
}

function separate() {
  const live = units.filter(u => !u.dead);
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      const d = Math.hypot(dx, dz) || 0.01;
      if (d < 0.8) {
        const p = (0.8 - d) / 2;
        a.pos.x -= dx / d * p; a.pos.z -= dz / d * p;
        b.pos.x += dx / d * p; b.pos.z += dz / d * p;
      }
    }
  }
}

function nearestHostile(u, range, from = u.pos) {
  let best = null, bd = range;
  for (const o of units) {
    if (!alive(o) || !hostile(u, o)) continue;
    if (u.team === 'bandit' && townAt(o.pos, 2)) continue;
    const d = d2(from, o.pos);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

function fight(u, e, dt) {
  const d = d2(u.pos, e.pos);
  if (d > 1.9) steer(u, e.pos.x, e.pos.z, dt, 1.3, 1.7);
  else {
    u.moving = 0;
    u.yaw = turnToward(u.yaw, Math.atan2(e.pos.x - u.pos.x, e.pos.z - u.pos.z), dt * 8);
    if (Math.abs(angleDiff(u.yaw, Math.atan2(e.pos.x - u.pos.x, e.pos.z - u.pos.z))) < 0.5) startAttack(u);
  }
}

// ---------- IA ----------
function updateAlly(u, dt, idx) {
  u.retarget -= dt;
  if (u.target && (!alive(u.target) || u.retarget <= 0)) u.target = null;
  if (!u.target) {
    u.retarget = 0.5;
    if (state.order === 'charge') u.target = nearestHostile(u, 90);
    else if (state.order === 'follow') {
      const e = nearestHostile(u, 16);
      u.target = e && d2(e.pos, player.pos) < 25 ? e : null;
    } else u.target = nearestHostile(u, 8, u.holdPos || u.pos);
  }
  if (u.target) { fight(u, u.target, dt); return; }
  if (state.order === 'hold') {
    const h = u.holdPos || u.pos;
    steer(u, h.x, h.z, dt, 1, 0.4);
    return;
  }
  // formation derrière le joueur
  const row = Math.floor(idx / 3), col = (idx % 3) - 1;
  const back = 2.5 + row * 1.6, side = col * 1.6;
  const py = player.yaw;
  const tx = player.pos.x - Math.sin(py) * back - Math.cos(py) * side;
  const tz = player.pos.z - Math.cos(py) * back + Math.sin(py) * side;
  const far = Math.hypot(tx - u.pos.x, tz - u.pos.z);
  steer(u, tx, tz, dt, far > 5 ? 1.7 : 1, 0.5);
}

function updateBandit(u, dt) {
  const g = u.group;
  if (u.target && (!alive(u.target) || townAt(u.target.pos, 2) || d2(u.pos, u.target.pos) > 45)) u.target = null;
  if (!u.target) u.target = nearestHostile(u, g.aggro ? 35 : 22);
  if (u.target) { g.aggro = true; fight(u, u.target, dt); }
  else steer(u, g.x + u.offset.x, g.z + u.offset.z, dt, 0.5, 0.6);
}

function updateGuard(u, dt) {
  if (u.target && (!alive(u.target) || d2(u.target.pos, u.home) > 50)) u.target = null;
  if (!u.target) u.target = nearestHostile(u, 30);
  if (u.target && d2(u.target.pos, u.home) < 50) fight(u, u.target, dt);
  else {
    if (steer(u, u.home.x, u.home.z, dt, 1, 0.4)) u.yaw = turnToward(u.yaw, u.home.yaw, dt * 4);
  }
}

function spawnGroup() {
  let x, z, tries = 0;
  do {
    x = rand(-HALF + 20, HALF - 20); z = rand(-HALF + 20, HALF - 20);
  } while (++tries < 60 && (nearTown(x, z, 70) || (player && Math.hypot(x - player.pos.x, z - player.pos.z) < 90)));
  const g = { x, z, timer: 0, aggro: false };
  state.groups.push(g);
  const size = clamp(randInt(1, 2) + Math.floor(state.day / 2), 1, 6);
  for (let i = 0; i < size; i++) {
    const chief = i === 0 && size >= 3;
    makeUnit('bandit', x + rand(-4, 4), z + rand(-4, 4), {
      name: chief ? 'Chef bandit' : 'Bandit', group: g,
      maxHp: chief ? 120 : 45 + state.day * 4, atk: chief ? 13 : 6 + state.day * 0.6,
      speed: 4.2, cooldown: 1.3, blockChance: chief ? 0.35 : 0.15,
      offset: { x: rand(-4, 4), z: rand(-4, 4) },
      look: { body: pick(['#5a3a2a', '#4a4030', '#6b3b2b']), skin: pick(SKIN_COLORS), pants: '#2d2419',
        hat: chief ? '#2a2a2a' : '#8a2020', height: rand(0.95, 1.08) },
    });
  }
}

function updateGroups(dt) {
  for (const g of state.groups) {
    const members = units.filter(u => u.group === g && !u.dead);
    if (!members.length) { g.empty = true; continue; }
    g.aggro = members.some(m => m.target);
    g.timer -= dt;
    if (g.timer <= 0) {
      g.timer = rand(8, 16);
      for (let i = 0; i < 20; i++) {
        const nx = clamp(g.x + rand(-60, 60), -HALF + 20, HALF - 20);
        const nz = clamp(g.z + rand(-60, 60), -HALF + 20, HALF - 20);
        if (!nearTown(nx, nz, 25)) { g.x = nx; g.z = nz; break; }
      }
    }
  }
  state.groups = state.groups.filter(g => !g.empty);
}

function spawnGuards(t) {
  const spots = [
    [t.gate - 0.12, t.r - 3], [t.gate + 0.12, t.r - 3], [t.gate, t.r - 9],
    [t.gate + Math.PI, 8],
  ];
  for (const [a, r] of spots) {
    const x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
    const u = makeUnit('guard', x, z, {
      name: 'Garde', maxHp: 220, atk: 16, speed: 4.6, cooldown: 1.0, blockChance: 0.4,
      look: { body: '#6f7378', skin: pick(SKIN_COLORS), pants: '#3a3d40', hat: '#9aa0a6', height: 1.05 },
    });
    u.home = { x, z, yaw: Math.atan2(Math.cos(t.gate), Math.sin(t.gate)) };
  }
}

// ---------- Joueur ----------
const keys = {};
const cam = { yaw: 0, pitch: 0.35, dist: 6 };
let locked = false, rightHeld = false;

function updatePlayer(dt) {
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  player.blocking = rightHeld && locked && player.atkTime < 0;
  const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
  let mx = fx * f - fz * s, mz = fz * f + fx * s;
  const len = Math.hypot(mx, mz);
  const combat = player.blocking || player.atkTime >= 0;
  if (len > 0) {
    mx /= len; mz /= len;
    const run = keys.ShiftLeft || keys.ShiftRight ? 1.6 : 1;
    const mul = player.blocking ? 0.45 : run;
    player.pos.x += mx * player.speed * mul * dt;
    player.pos.z += mz * player.speed * mul * dt;
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

  const sq = squad();
  for (const u of units) {
    if (u.dead) { u.deadTime += dt; continue; }
    u.atkCd -= dt;
    if (u.blockTimer > 0) { u.blockTimer -= dt; if (u.blockTimer <= 0) u.blocking = false; }
    if (u.atkTime >= 0) {
      u.atkTime += dt / 0.45;
      if (!u.hitDone && u.atkTime >= 0.45) { u.hitDone = true; resolveHit(u); }
      if (u.atkTime >= 1) u.atkTime = -1;
    }
    if (u.team === 'ally') updateAlly(u, dt, sq.indexOf(u));
    else if (u.team === 'bandit') updateBandit(u, dt);
    else if (u.team === 'guard') updateGuard(u, dt);
    u.pos.x += u.knock.x * dt; u.pos.z += u.knock.z * dt;
    u.knock.x *= 0.85; u.knock.z *= 0.85;
  }
  separate();
  for (const u of units) if (!u.dead) { collide(u); u.pos.y = heightAt(u.pos.x, u.pos.z); }

  // retirer les corps
  for (let i = units.length - 1; i >= 0; i--) {
    if (units[i].dead && units[i].deadTime > 12) { scene.remove(units[i].c.root); units.splice(i, 1); }
  }
  updateGroups(dt);

  // soins
  for (const u of [player, ...squad()]) {
    if (u === player && state.ko > 0) continue;
    const regen = townAt(u.pos) ? 3 : (state.inv.food > 0 ? 0.3 : 0);
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
    if (state.inv.food >= need) {
      state.inv.food -= need;
      logMsg(`Jour ${state.day}. Vous mangez ${need} nourriture.`);
    } else {
      state.inv.food = 0;
      logMsg(`Jour ${state.day}. Pas assez de nourriture : tout le monde a faim (-20 PV).`);
      for (const u of [player, ...squad()]) { u.hp -= 20; drawBar(u); if (u.hp <= 0) kill(u, null); }
    }
  }

  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    state.spawnTimer = 25;
    if (state.groups.length < MAX_GROUPS) spawnGroup();
  }
  state.priceTimer -= dt;
  if (state.priceTimer <= 0) {
    state.priceTimer = 20;
    for (const t of TOWNS) for (const g in GOODS) t.fluct[g] = clamp(t.fluct[g] + rand(-0.12, 0.12), 0.75, 1.3);
  }

  const town = townAt(player.pos);
  if (town !== state.currentTown) {
    state.currentTown = town;
    if (town) logMsg(`Tu entres à ${town.name}. Appuie sur E pour le marché.`);
  }
}

// animation des personnages
function animate(u, dt) {
  const c = u.c;
  c.root.rotation.y = u.yaw;
  const down = u.dead || (u === player && state.ko > 0);
  c.body.rotation.x = down ? Math.max(c.body.rotation.x - dt * 4, -Math.PI / 2) : 0;
  if (down) return;
  u.walk += dt * (u.moving ? 6 + u.moving * 4 : 0);
  const sw = u.moving ? Math.sin(u.walk) * 0.7 : 0;
  c.legL.rotation.x = sw; c.legR.rotation.x = -sw;
  c.armL.rotation.x = -sw * 0.6; c.armL.rotation.z = 0;
  c.armR.rotation.z = 0;
  if (u.atkTime >= 0) {
    const t = u.atkTime;
    c.armR.rotation.x = t < 0.4 ? -0.6 - 2.0 * (t / 0.4) : -2.6 + 2.2 * ((t - 0.4) / 0.6);
    c.armR.rotation.z = t < 0.4 ? -0.4 : 0.3;
  } else if (u.blocking) {
    c.armR.rotation.x = -1.3; c.armR.rotation.z = 0.9;
    c.armL.rotation.x = -1.2; c.armL.rotation.z = -0.4;
  } else c.armR.rotation.x = -0.5 + sw * 0.3;
  u.hurt -= dt;
  const flash = u.hurt > 0 ? 0.6 : 0;
  for (const m of c.hurtMats) m.emissive.setRGB(flash, 0, 0);
}

function updateCamera(dt) {
  if (state.mode === 'create') {
    cam.yaw += dt * 0.4;
    const p = player.pos;
    camera.position.set(p.x + Math.sin(cam.yaw) * 4, p.y + 1.8, p.z + Math.cos(cam.yaw) * 4);
    camera.lookAt(p.x, p.y + 1.1, p.z);
    return;
  }
  const target = new T.Vector3(player.pos.x, player.pos.y + 1.7, player.pos.z);
  const cp = Math.cos(cam.pitch);
  let x = target.x - Math.sin(cam.yaw) * cam.dist * cp;
  let z = target.z - Math.cos(cam.yaw) * cam.dist * cp;
  let y = target.y + Math.sin(cam.pitch) * cam.dist;
  y = Math.max(y, heightAt(x, z) + 0.6);
  camera.position.set(x, y, z);
  // décale légèrement la visée vers la droite (vue épaule)
  const look = target.clone();
  look.x += -Math.cos(cam.yaw) * 0.6; look.z += Math.sin(cam.yaw) * 0.6;
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

// ---------- Interface ----------
function renderHud() {
  document.getElementById('money').textContent = state.money;
  document.getElementById('food').textContent = state.inv.food;
  document.getElementById('cargo').textContent = `${cargoUsed()}/${cargoMax()}`;
  document.getElementById('day').textContent = state.day;
  document.getElementById('pName').textContent = player.name;
  document.getElementById('pLevel').textContent = `niv ${player.level} · ⚔ ${Math.round(player.atk)}`;
  document.getElementById('pHp').style.width = Math.max(0, player.hp / player.maxHp * 100) + '%';
  document.getElementById('pHpText').textContent = `${Math.ceil(Math.max(0, player.hp))} / ${player.maxHp} PV`;
  const sq = squad();
  document.getElementById('squadList').innerHTML = sq.length ? sq.map(u => `
    <div class="member">${u.name} <small>⚔ ${Math.round(u.atk)}</small>
      <div class="bar"><div style="width:${Math.max(0, u.hp / u.maxHp * 100)}%"></div></div></div>`).join('')
    : '<small>Tu voyages seul. Recrute en ville.</small>';
  const orders = { follow: 'Ordre : suivez-moi', charge: 'Ordre : chargez !', hold: 'Ordre : tenez la position' };
  document.getElementById('orderLabel').textContent = sq.length ? orders[state.order] : '';
  const pr = document.getElementById('prompt');
  if (state.currentTown && !state.menu && state.ko <= 0) {
    pr.textContent = `E : marché et taverne de ${state.currentTown.name}`;
    pr.classList.remove('hidden');
  } else pr.classList.add('hidden');
}

function drawMinimap() {
  const m = document.getElementById('minimap');
  const g = m.getContext('2d');
  const S = m.width, k = S / WORLD;
  const toM = (x, z) => [(x + HALF) * k, (z + HALF) * k];
  g.clearRect(0, 0, S, S);
  g.save();
  g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#b8955c'; g.fillRect(0, 0, S, S);
  for (const t of TOWNS) {
    const [x, y] = toM(t.x, t.z);
    g.fillStyle = '#5a4630'; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
  }
  for (const u of units) {
    if (u.dead || u === player) continue;
    const [x, y] = toM(u.pos.x, u.pos.z);
    g.fillStyle = { bandit: '#c0392b', ally: '#3b7dd8', guard: '#e8e8e8' }[u.team];
    g.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  const [px, py] = toM(player.pos.x, player.pos.z);
  g.translate(px, py); g.rotate(-player.yaw);
  g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(0, 6); g.lineTo(4, -4); g.lineTo(-4, -4); g.closePath(); g.fill();
  g.restore();
}

function renderTown() {
  const el = document.getElementById('town');
  const t = state.currentTown;
  if (!state.menu || !t) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const full = cargoUsed() >= cargoMax();
  let rows = '';
  for (const g in GOODS) {
    const p = price(t, g);
    rows += `<tr><td>${GOODS[g].icon} ${GOODS[g].name}</td><td>${state.inv[g]}</td>
      <td><button data-buy="${g}" ${state.money < p.buy || full ? 'disabled' : ''}>Acheter ${p.buy}</button></td>
      <td><button data-sell="${g}" ${state.inv[g] <= 0 ? 'disabled' : ''}>Vendre ${p.sell}</button></td></tr>`;
  }
  const cost = recruitCost();
  const hurt = [player, ...squad()].some(u => u.hp < u.maxHp);
  el.innerHTML = `
    <h3>🏰 ${t.name} — 💰 ${state.money}</h3>
    <table><tr><th>Marchandise</th><th>Sac</th><th></th><th></th></tr>${rows}</table>
    <div class="note">Maj + clic = ×5. Sac : ${cargoUsed()}/${cargoMax()}</div>
    <hr>
    <b>Taverne</b>
    <div class="note">Un mercenaire te suivra et se battra pour toi. (${squad().length + 1}/${MAX_SQUAD})</div>
    <button data-recruit ${state.money < cost || squad().length + 1 >= MAX_SQUAD ? 'disabled' : ''}>Recruter un mercenaire (${cost} 💰)</button>
    <button data-rest ${state.money < 10 || !hurt ? 'disabled' : ''}>Se reposer, tout le monde soigné (10 💰)</button>
    <hr>
    <button data-close>Fermer (E)</button>`;
}

document.getElementById('town').addEventListener('click', e => {
  const b = e.target.closest('button');
  const t = state.currentTown;
  if (!b || !t) return;
  const times = e.shiftKey ? 5 : 1;
  if (b.dataset.buy) {
    for (let i = 0; i < times; i++) {
      const p = price(t, b.dataset.buy).buy;
      if (state.money < p || cargoUsed() >= cargoMax()) break;
      state.money -= p; state.inv[b.dataset.buy]++;
    }
  } else if (b.dataset.sell) {
    for (let i = 0; i < times; i++) {
      if (state.inv[b.dataset.sell] <= 0) break;
      state.money += price(t, b.dataset.sell).sell; state.inv[b.dataset.sell]--;
    }
  } else if ('recruit' in b.dataset) {
    const cost = recruitCost();
    if (state.money >= cost && squad().length + 1 < MAX_SQUAD) {
      state.money -= cost;
      const u = makeUnit('ally', player.pos.x + rand(-2, 2), player.pos.z + rand(-2, 2), {
        maxHp: randInt(70, 100), atk: randInt(8, 12), speed: 4.8, cooldown: 1.15, blockChance: 0.25,
        look: { body: player.look.body, skin: pick(SKIN_COLORS), pants: '#3b2f22', height: rand(0.93, 1.08) },
      });
      logMsg(`${u.name} rejoint ton escouade !`);
    }
  } else if ('rest' in b.dataset) {
    state.money -= 10;
    for (const u of [player, ...squad()]) { u.hp = u.maxHp; drawBar(u); }
    logMsg('Une bonne nuit à l\'auberge. Tout le monde est soigné.');
  } else if ('close' in b.dataset) { toggleMenu(); return; }
  renderTown();
  renderHud();
});

function toggleMenu() {
  if (!state.menu && !state.currentTown) return;
  state.menu = !state.menu;
  if (state.menu && document.pointerLockElement) document.exitPointerLock();
  renderTown();
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

function rebuildPreview() {
  const pos = player ? player.pos.clone() : null;
  if (player) { scene.remove(player.c.root); units.splice(units.indexOf(player), 1); }
  const t = TOWNS[0];
  const sx = t.x + Math.cos(t.gate) * (t.r - 6), sz = t.z + Math.sin(t.gate) * (t.r - 6);
  player = makeUnit('player', pos ? pos.x : sx, pos ? pos.z : sz, {
    name: creation.name || 'Sans-nom',
    look: { body: creation.body, skin: creation.skin, height: creation.height, pants: '#3b2f22' },
  });
}

function renderCreation() {
  document.getElementById('cOrigins').innerHTML = ORIGINS.map(o =>
    `<div class="choice ${o === creation.origin ? 'sel' : ''}" data-origin="${o.id}"><b>${o.name}</b><small>${o.desc}</small></div>`).join('');
  document.getElementById('cBody').innerHTML = BODY_COLORS.map(c =>
    `<div class="swatch ${c === creation.body ? 'sel' : ''}" data-body="${c}" style="background:${c}"></div>`).join('');
  document.getElementById('cSkin').innerHTML = SKIN_COLORS.map(c =>
    `<div class="swatch ${c === creation.skin ? 'sel' : ''}" data-skin="${c}" style="background:${c}"></div>`).join('');
  const fs = finalStats();
  document.getElementById('cPoints').textContent = `(${pointsLeft()} points à répartir)`;
  document.getElementById('cStats').innerHTML = STATS.map(s => `
    <div class="stat"><span>${s.name}</span>
      <button data-minus="${s.key}" ${creation.stats[s.key] <= 1 ? 'disabled' : ''}>−</button>
      <b>${fs[s.key]}</b>
      <button data-plus="${s.key}" ${pointsLeft() <= 0 || creation.stats[s.key] >= 10 ? 'disabled' : ''}>+</button>
      <small>${s.hint}</small></div>`).join('');
}

document.getElementById('creation').addEventListener('click', e => {
  const el = e.target.closest('[data-origin],[data-body],[data-skin],[data-plus],[data-minus]');
  if (!el) return;
  const d = el.dataset;
  if (d.origin) creation.origin = ORIGINS.find(o => o.id === d.origin);
  if (d.body) creation.body = d.body;
  if (d.skin) creation.skin = d.skin;
  if (d.plus && pointsLeft() > 0 && creation.stats[d.plus] < 10) creation.stats[d.plus]++;
  if (d.minus && creation.stats[d.minus] > 1) creation.stats[d.minus]--;
  renderCreation();
  if (d.body || d.skin) rebuildPreview();
});
document.getElementById('cName').addEventListener('input', e => { creation.name = e.target.value.trim(); });
document.getElementById('cHeight').addEventListener('input', e => { creation.height = Number(e.target.value); rebuildPreview(); });

function startGame() {
  rebuildPreview();
  const s = finalStats();
  player.name = creation.name || 'Sans-nom';
  player.maxHp = player.hp = 50 + s.E * 10;
  player.atk = 5 + s.F * 1.6;
  player.speed = 4.4 + s.A * 0.2;
  player.cooldown = Math.max(0.55, 1.0 - s.A * 0.035);
  state.money = creation.origin.money;
  Object.assign(state.inv, creation.origin.inv);
  const t = TOWNS[0];
  const sx = t.x + Math.cos(t.gate) * (t.r - 6), sz = t.z + Math.sin(t.gate) * (t.r - 6);
  player.pos.set(sx, heightAt(sx, sz), sz);
  cam.yaw = Math.atan2(Math.cos(t.gate), Math.sin(t.gate));
  player.yaw = cam.yaw;
  state.mode = 'play';
  document.getElementById('creation').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  logMsg(`${player.name} arrive à ${t.name}, seul, avec ${state.money} 💰.`);
  logMsg('Clique dans le jeu pour contrôler la caméra avec la souris.');
}
document.getElementById('cStart').addEventListener('click', startGame);

// ---------- Entrées ----------
const canvasEl = renderer.domElement;
canvasEl.addEventListener('contextmenu', e => e.preventDefault());
canvasEl.addEventListener('mousedown', e => {
  if (state.mode !== 'play' || state.menu || state.ko > 0) return;
  if (!locked) {
    try { const p = canvasEl.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* facultatif */ }
  }
  if (e.button === 0) startAttack(player);
  if (e.button === 2) rightHeld = true;
});
window.addEventListener('mouseup', e => { if (e.button === 2) rightHeld = false; });
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvasEl; });
window.addEventListener('mousemove', e => {
  if (state.mode !== 'play' || state.menu) return;
  if (locked || (e.buttons & 2)) {
    cam.yaw -= e.movementX * 0.0035;
    cam.pitch = clamp(cam.pitch + e.movementY * 0.003, -0.2, 1.2);
  }
});
canvasEl.addEventListener('wheel', e => {
  e.preventDefault();
  cam.dist = clamp(cam.dist * (e.deltaY > 0 ? 1.1 : 0.9), 2.5, 18);
}, { passive: false });

window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (state.mode !== 'play') return;
  if (e.code === 'KeyE') toggleMenu();
  if (e.code === 'Escape' && state.menu) toggleMenu();
  if (e.code === 'Digit1') { state.order = 'follow'; }
  if (e.code === 'Digit2') { state.order = 'charge'; }
  if (e.code === 'Digit3') { state.order = 'hold'; squad().forEach(u => (u.holdPos = u.pos.clone())); }
  if (e.code.startsWith('Digit') && squad().length) logMsg({ follow: '« Suivez-moi ! »', charge: '« Chargez ! »', hold: '« Tenez la position ! »' }[state.order]);
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; rightHeld = false; });

// ---------- Démarrage ----------
TOWNS.forEach(spawnGuards);
for (let i = 0; i < 5; i++) spawnGroup();
renderCreation();
rebuildPreview();

let last = performance.now();
let hudTimer = 0;
const tmp = new T.Vector3();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.mode === 'play' && !state.menu) update(dt);
  for (const u of units) animate(u, dt);
  updateCamera(dt);
  updateSky();
  renderer.render(scene, camera);

  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.t -= dt; f.p.y += dt * 0.8;
    tmp.copy(f.p).project(camera);
    if (f.t <= 0 || tmp.z > 1) { if (f.t <= 0) { f.el.remove(); floats.splice(i, 1); } else f.el.style.display = 'none'; continue; }
    f.el.style.display = '';
    f.el.style.left = (tmp.x + 1) / 2 * window.innerWidth + 'px';
    f.el.style.top = (1 - tmp.y) / 2 * window.innerHeight + 'px';
    f.el.style.opacity = Math.min(1, f.t);
  }

  if (state.mode === 'play') {
    hudTimer -= dt;
    if (hudTimer <= 0) { hudTimer = 0.2; renderHud(); drawMinimap(); }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
