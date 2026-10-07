// Terres Arides — monde procédural : relief, biomes, décor, factions, villes, ressources.
'use strict';

// ---------- État global ----------
const state = {
  mode: 'create', seed: 0, money: 0, goods: { food: 0, wood: 0, iron: 0, cloth: 0, spices: 0, salt: 0, arrows: 0 },
  day: 1, dayTimer: 20, kills: 0, order: 'follow', ko: 0, panel: null, currentTown: null, currentNode: null,
  factions: {}, relations: {}, warSince: {}, rep: {}, allegiance: null,
  settlements: [], nodes: [], parties: [], chronicle: [], trades: [],
  timeScale: 1, eventTimer: 90, spawnTimer: 3, saveTimer: 60, garrisonTimer: 60, econTimer: 0, histTimer: 0,
};
const F = id => state.factions[id];
const relKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;

// ---------- Scène ----------
const view = document.getElementById('view');
const renderer = new T.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
view.appendChild(renderer.domElement);

const scene = new T.Scene();
const SKY_DAY = new T.Color('#cfd8dc');
const SKY_NIGHT = new T.Color('#0d1222');
scene.background = SKY_DAY.clone();
scene.fog = new T.Fog(SKY_DAY.clone(), 90, 340);

const camera = new T.PerspectiveCamera(65, 1, 0.1, 1500);
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
function mesh(geo, color, shadow = true) {
  const m = new T.Mesh(geo, mat(color));
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}
const hsl = (h, s, l) => '#' + new T.Color().setHSL(((h % 1) + 1) % 1, s, l).getHexString();

let worldGroup = new T.Group();
scene.add(worldGroup);

// ---------- Relief et biomes ----------
let elevN = makeNoise(1), moistN = makeNoise(2), detailN = makeNoise(3);
let FLAT_SPOTS = [];
const GRID_N = 240, GRID_SIZE = WORLD + 300, CELL = GRID_SIZE / GRID_N;
let hgrid = new Float32Array((GRID_N + 1) * (GRID_N + 1));

const elevAt = (x, z) => elevN(x / 260, z / 260);
function biomeAt(x, z) {
  const e = elevAt(x, z), m = moistN(x / 220, z / 220);
  if (e > 0.64) return 'montagne';
  if (e < 0.42 && m < 0.42) return 'sel';
  if (m > 0.57) return 'foret';
  if (m > 0.47) return 'steppe';
  return 'desert';
}
function rawHeight(x, z) {
  const e = elevAt(x, z);
  let h = (e - 0.5) * 30 + (detailN(x / 40, z / 40, 2) - 0.5) * 3;
  h += smooth(0.6, 0.8, e) * 42;
  return h;
}
function flatHeight(x, z) {
  let h = rawHeight(x, z);
  for (const s of FLAT_SPOTS) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.r + 40) h += (s.h - h) * (1 - smooth(s.r + 2, s.r + 40, d));
  }
  return h;
}
function buildHeightGrid() {
  for (let j = 0; j <= GRID_N; j++) for (let i = 0; i <= GRID_N; i++) {
    hgrid[j * (GRID_N + 1) + i] = flatHeight(-GRID_SIZE / 2 + i * CELL, -GRID_SIZE / 2 + j * CELL);
  }
}
function heightAt(x, z) {
  const fx = clamp((x + GRID_SIZE / 2) / CELL, 0, GRID_N - 0.001), fz = clamp((z + GRID_SIZE / 2) / CELL, 0, GRID_N - 0.001);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const k = j * (GRID_N + 1) + i;
  const a = hgrid[k], b = hgrid[k + 1], c = hgrid[k + GRID_N + 1], d = hgrid[k + GRID_N + 2];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ---------- Obstacles (grille de recherche rapide) ----------
let obstacles = [];
let obsGrid = new Map();
const OBS_CELL = 20;
function addObstacle(x, z, r) {
  const o = { x, z, r };
  obstacles.push(o);
  const key = Math.floor(x / OBS_CELL) + ',' + Math.floor(z / OBS_CELL);
  if (!obsGrid.has(key)) obsGrid.set(key, []);
  obsGrid.get(key).push(o);
}
function obstaclesNear(x, z) {
  const ix = Math.floor(x / OBS_CELL), iz = Math.floor(z / OBS_CELL), out = [];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const l = obsGrid.get((ix + a) + ',' + (iz + b));
    if (l) out.push(...l);
  }
  return out;
}

// ---------- Drapeaux ----------
function drawEmblem(g, emblem, color, cx, cy, s) {
  const cv = document.createElement('canvas');
  cv.width = g.canvas.width; cv.height = g.canvas.height;
  const e = cv.getContext('2d');
  e.fillStyle = color; e.strokeStyle = color;
  const circle = (x, y, r) => { e.beginPath(); e.arc(x, y, r, 0, Math.PI * 2); e.fill(); };
  const cut = fn => { e.globalCompositeOperation = 'destination-out'; fn(); e.globalCompositeOperation = 'source-over'; };
  switch (emblem) {
    case 'coin': circle(cx, cy, s); cut(() => circle(cx, cy, s * 0.55)); circle(cx, cy, s * 0.3); break;
    case 'hammer': e.fillRect(cx - s * 0.15, cy - s * 0.4, s * 0.3, s * 1.3); e.fillRect(cx - s * 0.75, cy - s * 0.9, s * 1.5, s * 0.6); break;
    case 'sun':
      circle(cx, cy, s * 0.55);
      e.lineWidth = s * 0.16;
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        e.beginPath(); e.moveTo(cx + Math.cos(a) * s * 0.7, cy + Math.sin(a) * s * 0.7);
        e.lineTo(cx + Math.cos(a) * s * 1.05, cy + Math.sin(a) * s * 1.05); e.stroke();
      }
      break;
    case 'crescent': circle(cx, cy, s); cut(() => circle(cx + s * 0.45, cy - s * 0.15, s * 0.85)); break;
    case 'skull':
      circle(cx, cy - s * 0.15, s * 0.8); e.fillRect(cx - s * 0.45, cy + s * 0.3, s * 0.9, s * 0.55);
      cut(() => { circle(cx - s * 0.32, cy - s * 0.15, s * 0.22); circle(cx + s * 0.32, cy - s * 0.15, s * 0.22);
        e.fillRect(cx - s * 0.05, cy + s * 0.45, s * 0.1, s * 0.4); });
      break;
    case 'star':
      e.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * 0.42 : s;
        e.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      e.fill(); break;
    case 'tower':
      e.fillRect(cx - s * 0.5, cy - s * 0.5, s, s * 1.4);
      for (let i = 0; i < 3; i++) e.fillRect(cx - s * 0.5 + i * s * 0.4, cy - s * 0.85, s * 0.2, s * 0.4);
      cut(() => e.fillRect(cx - s * 0.15, cy + s * 0.4, s * 0.3, s * 0.5));
      break;
    case 'eye':
      e.beginPath(); e.ellipse(cx, cy, s, s * 0.55, 0, 0, Math.PI * 2); e.fill();
      cut(() => circle(cx, cy, s * 0.35)); circle(cx, cy, s * 0.15); break;
    case 'swords':
      e.lineWidth = s * 0.22; e.lineCap = 'round';
      e.beginPath(); e.moveTo(cx - s, cy - s); e.lineTo(cx + s, cy + s); e.moveTo(cx + s, cy - s); e.lineTo(cx - s, cy + s); e.stroke();
      break;
    default:
      e.beginPath(); e.moveTo(cx, cy - s); e.lineTo(cx + s, cy + s * 0.8); e.lineTo(cx - s, cy + s * 0.8); e.fill();
  }
  g.drawImage(cv, 0, 0);
}
function drawFlag(g, f, w, h) {
  const [c0, c1, c2] = f.colors;
  g.fillStyle = c0; g.fillRect(0, 0, w, h);
  g.fillStyle = c1;
  switch (f.flag.pattern) {
    case 'bicolor-h': g.fillRect(0, h / 2, w, h / 2); break;
    case 'bicolor-v': g.fillRect(w / 2, 0, w / 2, h); break;
    case 'diagonal': g.beginPath(); g.moveTo(w, 0); g.lineTo(w, h); g.lineTo(0, h); g.fill(); break;
    case 'cross': g.fillRect(w * 0.3, 0, w * 0.12, h); g.fillRect(0, h * 0.44, w, h * 0.12); break;
    case 'border': g.fillRect(0, 0, w, h); g.fillStyle = c0; g.fillRect(w * 0.08, h * 0.12, w * 0.84, h * 0.76); break;
  }
  drawEmblem(g, f.flag.emblem, c2, w / 2, h / 2, h * 0.28);
}
function factionFlag(f) {
  if (!f._flagTex) {
    const cv = document.createElement('canvas');
    cv.width = 96; cv.height = 64;
    drawFlag(cv.getContext('2d'), f, 96, 64);
    f._flagCanvas = cv;
    f._flagTex = new T.CanvasTexture(cv);
    f._flagURL = cv.toDataURL();
  }
  return f._flagTex;
}
const flagImg = (f, h = 18) => `<img class="flag" src="${factionFlag(f) && f._flagURL}" style="height:${h}px" alt="">`;
// drapeau du joueur (pour ses exploitations) et drapeau neutre
const PLAYER_FLAG = { id: 'player', name: 'Toi', colors: ['#3d5a7a', '#e8dcc0', '#222222'], flag: { pattern: 'bicolor-v', emblem: 'star' } };
const NEUTRAL_FLAG = { id: 'neutre', name: 'Libre', colors: ['#8a8070', '#8a8070', '#5a5040'], flag: { pattern: 'plain', emblem: 'triangle' } };

function makeFlagPole(f, height = 7) {
  const g = new T.Group();
  const pole = mesh(new T.CylinderGeometry(0.06, 0.08, height, 6), '#4a3826');
  pole.position.y = height / 2;
  const cloth = new T.Mesh(new T.PlaneGeometry(2.4, 1.6), new T.MeshBasicMaterial({ map: factionFlag(f), side: T.DoubleSide }));
  cloth.position.set(1.2, height - 0.9, 0);
  g.add(pole, cloth);
  return { g, cloth };
}
function setClothFlag(cloth, f) { cloth.material.map = factionFlag(f); cloth.material.needsUpdate = true; }

function textSprite(text, size = 1, color = '#fff4dc') {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 96;
  const g = cv.getContext('2d');
  g.font = 'bold 52px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = 'rgba(30,20,10,.8)';
  g.strokeText(text, 256, 48);
  g.fillStyle = color;
  g.fillText(text, 256, 48);
  const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), depthWrite: false }));
  sp.scale.set(16 * size, 3 * size, 1);
  return sp;
}

// ---------- Génération des factions ----------
function genFaction(rng, opts = {}) {
  const place = opts.place || genName(rng);
  if (opts.cannibal) {
    return {
      id: 'cannibales', name: `Cannibales ${deN(place)}`, art: 'les', of: `des Cannibales ${deN(place)}`, culture: 'cannibale', bandit: true,
      map: '#5a1010', colors: ['#3a1010', '#d8d0c0', '#8a1a1a'], flag: { pattern: 'border', emblem: 'skull' },
      leader: `Grand Mangeur ${genName(rng)}`, outfit: { body: '#7a4a3a', pants: '#3a2a1a', tabard: false },
      troops: JSON.parse(JSON.stringify(CULTURES.cannibale.troops)), shop: [], alive: true, founded: 0,
    };
  }
  if (opts.bandit) {
    // trois sortes de bandits : pillards (hostiles), rançonneurs (exigent un péage), esclavagistes (capturent)
    const K = {
      pillard:  { id: 'bandits',       label: 'Brigands',      map: '#1d1d1d', colors: ['#1f1a17', '#a01e1e', '#e0d0b0'], emblem: 'skull',  body: '#5a3a2a', chief: 'Chef' },
      racket:   { id: 'racket',        label: 'Rançonneurs',   map: '#8a6a1a', colors: ['#4a3a14', '#d8b84a', '#1a1408'], emblem: 'coin',   body: '#6e5a2a', chief: 'Percepteur' },
      slaver:   { id: 'esclavagistes', label: 'Esclavagistes', map: '#3a2a4a', colors: ['#2a1a3a', '#9a8aa8', '#e8e0f0'], emblem: 'swords', body: '#4a3a5a', chief: 'Maître' },
    }[opts.kind || 'pillard'];
    return {
      id: K.id, name: `${K.label} ${deN(place)}`, art: 'les', of: `des ${K.label} ${deN(place)}`, culture: 'brigand', bandit: true,
      behavior: opts.kind || 'pillard', slavery: opts.kind === 'slaver',
      map: K.map, colors: K.colors, flag: { pattern: 'plain', emblem: K.emblem },
      leader: `${K.chief} ${genName(rng)}`, outfit: { body: K.body, pants: '#2d2419', tabard: false },
      troops: JSON.parse(JSON.stringify(CULTURES.brigand.troops)), shop: [], alive: true, founded: 0,
    };
  }
  const gov = rpick(rng, GOVERNMENTS);
  const culture = rpick(rng, gov.cultures);
  const C = CULTURES[culture];
  const hue = opts.hue != null ? opts.hue : rng();
  const name = `${gov.t} ${deN(place)}`;
  const main = hsl(hue, 0.45 + rng() * 0.2, 0.25 + rng() * 0.15);
  const second = hsl(hue + 0.35 + rng() * 0.3, 0.55, 0.5 + rng() * 0.1);
  const emblem = rng() < 0.5 ? '#f2ead8' : hsl(hue + 0.5, 0.6, 0.8);
  return {
    id: 'f' + uid(), name, art: gov.art, of: `${OF_ART[gov.art]} ${name}`, gov: gov.t, culture, place,
    map: hsl(hue, 0.65, 0.55), colors: [main, second, emblem],
    flag: { pattern: rpick(rng, FLAG_PATTERNS), emblem: rpick(rng, FLAG_EMBLEMS) },
    leader: `${rpick(rng, LEADER_TITLE)} ${genName(rng)}`,
    outfit: { body: main, pants: hsl(hue, 0.2, 0.15), tabard: C.tabard },
    troops: JSON.parse(JSON.stringify(C.troops)), shop: [...C.shop], alive: true, founded: 0,
    slavery: rng() < ({ fanatique: 0.6, marchand: 0.5, nomade: 0.35, lourd: 0.3, guerrier: 0.3 }[culture] || 0.3),
  };
}

function makeSettlement(def) {
  const s = {
    name: def.name, x: def.x, z: def.z, faction: def.faction, type: def.type || 'ville',
    r: { camp: 26, repaire: 18 }[def.type] || 44, capital: !!def.capital,
    pop: def.pop || 100, garrison: def.garrison != null ? def.garrison : ({ camp: 5, repaire: 6 }[def.type] || 8),
    guards: [], civilians: [], stock: def.stock || null, hist: def.hist || {},
  };
  s.h = heightAt(s.x, s.z);
  s.gate = Math.atan2(-s.z, -s.x);
  s.biome = biomeAt(s.x, s.z);
  if (!s.stock) {
    s.stock = {};
    for (const g of TRADE_GOODS) s.stock[g] = Math.round(s.pop * CONSUMPTION[g] / 100 * rand(2, 5));
  }
  state.settlements.push(s);
  buildSettlement(s);
  return s;
}
function setOwner(s, fid) {
  s.faction = fid;
  for (const cloth of s.flags) setClothFlag(cloth, F(fid));
  for (const n of state.nodes) if (n.owner === s.name) refreshNodeFlag(n);
}
const settlementAt = (p, margin = 0) => state.settlements.find(s => Math.hypot(p.x - s.x, p.z - s.z) < s.r + margin) || null;
const nearSettlement = (x, z, margin) => state.settlements.some(s => Math.hypot(x - s.x, z - s.z) < s.r + margin);
function nearestSettlement(p, filter = () => true) {
  let best = null, bd = Infinity;
  for (const s of state.settlements) {
    if (!filter(s)) continue;
    const d = d2(s, p);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
const settlementByName = name => state.settlements.find(s => s.name === name) || null;
const gatePos = (s, inside = 6) => ({ x: s.x + Math.cos(s.gate) * (s.r - inside), z: s.z + Math.sin(s.gate) * (s.r - inside) });

// ---------- Exploitations ----------
function nodeFaction(n) {
  if (n.owner === 'player') return 'player';
  const s = settlementByName(n.owner);
  return s ? s.faction : null;
}
const nodeFlag = n => n.owner === 'player' ? PLAYER_FLAG : (nodeFaction(n) ? F(nodeFaction(n)) : NEUTRAL_FLAG);
function refreshNodeFlag(n) { if (n.flag) setClothFlag(n.flag, nodeFlag(n)); }

function buildNode(n) {
  const R = RESOURCES[n.type];
  const g = new T.Group();
  const h0 = heightAt(n.x, n.z);
  g.position.set(n.x, h0, n.z);
  const ly = (lx, lz) => heightAt(n.x + lx, n.z + lz) - h0;
  const rng = mulberry32(Math.round(n.x * 31 + n.z * 17));
  const add = (m, x, y, z) => { m.position.set(x, ly(x, z) + y, z); g.add(m); return m; };
  if (n.type === 'ferme' || n.type === 'coton' || n.type === 'epices') {
    for (let i = 0; i < 8; i++) {
      const row = add(mesh(new T.BoxGeometry(12, 0.6, 0.7), R.crop, false), 0, 0.3, -7 + i * 1.8);
      row.rotation.y = 0.05 * (rng() - 0.5);
    }
    add(mesh(new T.BoxGeometry(3, 2.5, 3), '#a3835a'), 9, 1.25, 0);
    addObstacle(n.x + 9, n.z, 2);
  } else if (n.type === 'bois') {
    for (let i = 0; i < 4; i++) {
      const log = add(mesh(new T.CylinderGeometry(0.35, 0.35, 4, 7), '#7a5230'), 0, 0.35 + Math.floor(i / 2) * 0.6, -1 + (i % 2) * 0.75 + Math.floor(i / 2) * 0.35);
      log.rotation.z = Math.PI / 2;
    }
    for (let i = 0; i < 6; i++) add(mesh(new T.CylinderGeometry(0.4, 0.45, 0.6, 7), '#6b4a2b'), rand(-8, 8), 0.3, rand(-8, 8));
    add(mesh(new T.BoxGeometry(4, 2.6, 3), '#6e5538'), 6, 1.3, 4);
    addObstacle(n.x + 6, n.z + 4, 2.4);
    addObstacle(n.x, n.z, 2);
  } else if (n.type === 'fer') {
    const mound = add(mesh(new T.DodecahedronGeometry(5, 0), '#5f5850'), 0, 1.5, -4);
    mound.scale.set(1.2, 0.8, 1);
    add(mesh(new T.BoxGeometry(2.2, 2.6, 1), '#1a1410'), 0, 1.3, 0.6);
    for (let i = 0; i < 6; i++) add(mesh(new T.DodecahedronGeometry(0.5, 0), '#7a4a3a'), 3 + rand(-1, 1), 0.3, 2 + rand(-1, 1));
    add(mesh(new T.BoxGeometry(1.2, 0.8, 2), '#5a4630'), -3, 0.6, 3);
    addObstacle(n.x, n.z - 4, 5.5);
  } else if (n.type === 'elevage') {
    const R2 = 9;
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2;
      const post = add(mesh(new T.BoxGeometry(0.15, 1.2, 0.15), '#6e5538'), Math.cos(a) * R2, 0.6, Math.sin(a) * R2);
      const rail = add(mesh(new T.BoxGeometry(0.1, 0.1, 2 * Math.PI * R2 / 16), '#7a5a38'), Math.cos(a + 0.2) * R2, 0.9, Math.sin(a + 0.2) * R2);
      rail.rotation.y = -a - 0.2;
      post.rotation.y = -a;
    }
    for (let i = 0; i < 4; i++) {
      const beast = makeAnimalModel({ size: 1.1, color: rng() < 0.5 ? '#8a6a48' : '#c9b48a' });
      const bx = rand(-5, 5), bz = rand(-5, 5);
      beast.root.position.set(bx, ly(bx, bz), bz);
      beast.root.rotation.y = rng() * 6;
      g.add(beast.root);
    }
    add(mesh(new T.BoxGeometry(3, 2.4, 3), '#8a6a48'), 11, 1.2, 4);
    addObstacle(n.x + 11, n.z + 4, 2);
  } else if (n.type === 'sel') {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) add(mesh(new T.BoxGeometry(4, 0.12, 4), '#dfe8ec', false), -5 + i * 5, 0.05, -5 + j * 5);
    for (let i = 0; i < 4; i++) add(mesh(new T.ConeGeometry(0.9, 1.2, 6), '#f4f4f0'), 8, 0.6, -4 + i * 2.5);
  }
  if (n.workshop) buildWorkshop(n, g, ly);
  const fp = makeFlagPole(nodeFlag(n), 6);
  fp.g.position.set(-4, ly(-4, 7), 7);
  g.add(fp.g);
  n.flag = fp.cloth;
  const label = textSprite(R.name, 0.6, '#f2e6c8');
  label.position.y = 9;
  g.add(label);
  worldGroup.add(g);
  n.root = g;
}
function buildWorkshop(n, g, ly) {
  const w = new T.Group();
  w.position.set(-8, ly(-8, -6), -6);
  w.add(part(0.9, 0.5, 0.4, '#3a3a3a', 0, 0.9, 0), part(0.4, 0.6, 0.3, '#5a4630', 0, 0.35, 0), part(2, 0.9, 1, '#6e5538', 2.4, 0.45, 0));
  for (const [x, z] of [[-1.5, -1.5], [3.9, -1.5], [-1.5, 1.5], [3.9, 1.5]]) w.add(part(0.15, 2.6, 0.15, '#4a3826', x, 1.3, z));
  w.add(part(6, 0.15, 3.6, '#7a5a38', 1.2, 2.6, 0));
  g.add(w);
  n.workshopMesh = w;
}
const nodeAt = (p, r = 14) => state.nodes.find(n => Math.hypot(p.x - n.x, p.z - n.z) < r) || null;

// ---------- Génération du monde ----------
function disposeGroup(g) {
  g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && o.material.map) o.material.map.dispose();
  });
}

function generateWorld(seed, keepFactions = null) {
  // nettoyage d'un monde précédent
  scene.remove(worldGroup);
  disposeGroup(worldGroup);
  worldGroup = new T.Group();
  scene.add(worldGroup);
  obstacles = []; obsGrid = new Map(); wallSegs = []; segGrid = new Map();
  Object.assign(state, { seed, settlements: [], nodes: [], parties: [], chronicle: [], trades: [], factions: {}, relations: {}, warSince: {}, rep: {} });

  const rng = mulberry32(seed);
  elevN = makeNoise(seed); moistN = makeNoise(seed + 101); detailN = makeNoise(seed + 7);

  // factions
  const nf = 3 + Math.floor(rng() * 2);
  const hue0 = rng();
  const facs = [];
  for (let i = 0; i < nf; i++) facs.push(genFaction(rng, { hue: hue0 + i / nf + rng() * 0.05 }));
  facs.push(genFaction(rng, { bandit: true, kind: 'pillard' }), genFaction(rng, { bandit: true, kind: 'racket' }),
    genFaction(rng, { bandit: true, kind: 'slaver' }), genFaction(rng, { cannibal: true }));
  for (const f of facs) { state.factions[f.id] = f; state.rep[f.id] = f.bandit && f.behavior !== 'racket' ? -100 : 0; }
  const majors = facs.filter(f => !f.bandit);
  for (const a of majors) for (const b of majors) if (a.id < b.id) state.relations[relKey(a.id, b.id)] = 'peace';
  // au départ : au plus une guerre
  if (rng() < 0.5) {
    const a = rpick(rng, majors), b = rpick(rng, majors);
    if (a !== b) { state.relations[relKey(a.id, b.id)] = 'war'; state.warSince[relKey(a.id, b.id)] = 0; }
  }

  // emplacements des villes
  const sites = [];
  const usedNames = new Set();
  const okSite = (x, z, minD) => Math.abs(x) < HALF - 70 && Math.abs(z) < HALF - 70 && elevAt(x, z) < 0.6 &&
    sites.every(s => Math.hypot(s.x - x, s.z - z) > minD);
  const uniqueName = () => { let n; do { n = genName(rng); } while (usedNames.has(n)); usedNames.add(n); return n; };
  for (const f of majors) {
    let cap = null;
    for (let t = 0; t < 400 && !cap; t++) {
      const x = (rng() - 0.5) * WORLD, z = (rng() - 0.5) * WORLD;
      if (okSite(x, z, 300 - t * 0.4)) cap = { x, z };
    }
    if (!cap) continue;
    const camp = CULTURES[f.culture].camp;
    sites.push({ ...cap, faction: f.id, type: camp ? 'camp' : 'ville', capital: true, name: f.place || uniqueName(), pop: randInt(140, 220) });
    usedNames.add(f.place);
    const extra = rng() < 0.6 ? 1 : 0;
    for (let k = 0; k < extra; k++) {
      for (let t = 0; t < 200; t++) {
        const a = rng() * Math.PI * 2, r = 130 + rng() * 140;
        const x = cap.x + Math.cos(a) * r, z = cap.z + Math.sin(a) * r;
        if (okSite(x, z, 160)) {
          sites.push({ x, z, faction: f.id, type: camp || rng() < 0.3 ? 'camp' : 'ville', name: uniqueName(), pop: randInt(70, 150) });
          break;
        }
      }
    }
  }
  // repaires des brigands (déserts, steppes) et des cannibales (forêts, montagnes)
  for (const f of facs.filter(f => f.bandit)) {
    const wanted = f.culture === 'cannibale' ? ['foret', 'montagne'] : ['desert', 'steppe', 'sel'];
    const lairs = f.culture === 'cannibale' ? 2 : 1;
    for (let k = 0; k < lairs; k++) {
      for (let t = 0; t < 400; t++) {
        const x = (rng() - 0.5) * WORLD, z = (rng() - 0.5) * WORLD;
        if (!wanted.includes(biomeAt(x, z)) && t < 300) continue;
        if (okSite(x, z, 200)) { sites.push({ x, z, faction: f.id, type: 'repaire', name: uniqueName(), pop: 30 }); break; }
      }
    }
  }
  FLAT_SPOTS = sites.map(s => ({ x: s.x, z: s.z, r: { camp: 28, repaire: 20 }[s.type] || 46, h: rawHeight(s.x, s.z) }));
  buildHeightGrid();
  buildTerrain();

  // exploitations
  const nodeSpots = [];
  for (let t = 0; t < 3000 && nodeSpots.length < 60; t++) {
    const x = (rng() - 0.5) * (WORLD - 80), z = (rng() - 0.5) * (WORLD - 80);
    if (sites.some(s => Math.hypot(s.x - x, s.z - z) < 80) || nodeSpots.some(n => Math.hypot(n.x - x, n.z - z) < 55)) continue;
    const b = biomeAt(x, z);
    const e = elevAt(x, z);
    let type = null;
    if (b === 'montagne') type = e < 0.7 ? 'fer' : null;
    else if (b === 'foret') type = rng() < 0.6 ? 'bois' : 'ferme';
    else if (b === 'steppe') { const r = rng(); type = r < 0.4 ? 'ferme' : r < 0.7 ? 'coton' : 'elevage'; }
    else if (b === 'desert') type = rng() < 0.3 ? 'epices' : null;
    else if (b === 'sel') type = 'sel';
    if (type) nodeSpots.push({ x, z, type });
  }
  FLAT_SPOTS.push(...nodeSpots.map(n => ({ x: n.x, z: n.z, r: 10, h: rawHeight(n.x, n.z) })));
  buildHeightGrid();
  rebuildTerrainHeights();

  buildDecor(rng, sites, nodeSpots);
  for (const s of sites) makeSettlement(s);
  for (const ns of nodeSpots) {
    const near = nearestSettlement(ns, s => !F(s.faction).bandit);
    const n = { id: uid(), type: ns.type, x: ns.x, z: ns.z, owner: near && d2(near, ns) < 260 ? near.name : null,
      stock: 0, workers: [], disabled: 0 };
    state.nodes.push(n);
    buildNode(n);
  }
}

let terrainMesh = null;
function buildTerrain() {
  const geo = new T.PlaneGeometry(GRID_SIZE, GRID_SIZE, GRID_N, GRID_N);
  geo.rotateX(-Math.PI / 2);
  geo.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
  terrainMesh = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  terrainMesh.receiveShadow = true;
  worldGroup.add(terrainMesh);
  rebuildTerrainHeights();
}
function rebuildTerrainHeights() {
  const geo = terrainMesh.geometry;
  const pos = geo.attributes.position, col = geo.attributes.color;
  const c = new T.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const b = BIOMES[biomeAt(x, z)].color;
    const k = (detailN(x / 15, z / 15, 1) - 0.5) * 0.08 + clamp(h / 120, -0.05, 0.12);
    c.setRGB(b[0] + k, b[1] + k, b[2] + k);
    col.setXYZ(i, c.r, c.g, c.b);
  }
  pos.needsUpdate = true; col.needsUpdate = true;
  geo.computeVertexNormals();
}

function buildDecor(rng, sites, nodeSpots) {
  const dummy = new T.Object3D();
  const blocked = (x, z) => sites.some(s => Math.hypot(s.x - x, s.z - z) < 55) || nodeSpots.some(n => Math.hypot(n.x - x, n.z - z) < 16);
  const scatter = (count, accept, place) => {
    const out = [];
    for (let t = 0; t < count * 6 && out.length < count; t++) {
      const x = (rng() - 0.5) * WORLD, z = (rng() - 0.5) * WORLD;
      if (blocked(x, z) || !accept(biomeAt(x, z), x, z)) continue;
      out.push(place(x, z));
    }
    return out;
  };
  const instanced = (geo, color, list) => {
    const m = new T.InstancedMesh(geo, mat(color), Math.max(1, list.length));
    m.castShadow = true; m.receiveShadow = true;
    list.forEach((d, i) => {
      dummy.position.set(d.x, d.y, d.z); dummy.rotation.set(d.rx || 0, d.ry || 0, d.rz || 0);
      dummy.scale.set(d.sx, d.sy, d.sz); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    });
    m.count = list.length;
    worldGroup.add(m);
  };
  // rochers (beaucoup en montagne)
  const rocks = scatter(900, b => b === 'montagne' || rng() < 0.25, (x, z) => {
    const big = biomeAt(x, z) === 'montagne' ? rng() < 0.4 : rng() < 0.1;
    const s = big ? 2.5 + rng() * 4 : 0.3 + rng() * 1.3;
    if (s > 1.2) addObstacle(x, z, s * 0.9);
    return { x, y: heightAt(x, z) + s * 0.3, z, rx: rng() * 3, ry: rng() * 3, rz: rng() * 3, sx: s, sy: s * (0.6 + rng() * 0.5), sz: s };
  });
  instanced(new T.DodecahedronGeometry(1, 0), '#8a7a68', rocks);
  // arbres (forêts denses, steppe clairsemée)
  const trees = scatter(1100, b => b === 'foret' || (b === 'steppe' && rng() < 0.08), (x, z) => {
    const h = 4 + rng() * 4;
    addObstacle(x, z, 0.5);
    return { x, z, h, y: heightAt(x, z) };
  });
  instanced(new T.CylinderGeometry(0.25, 0.35, 1, 6), '#5a4026', trees.map(t => ({ x: t.x, y: t.y + t.h * 0.25, z: t.z, sx: 1, sy: t.h * 0.5, sz: 1 })));
  instanced(new T.ConeGeometry(1.6, 1, 7), '#2f5a26', trees.map(t => ({ x: t.x, y: t.y + t.h * 0.62, z: t.z, ry: t.h, sx: 1 + t.h * 0.1, sy: t.h * 0.8, sz: 1 + t.h * 0.1 })));
  // cactus
  const cacti = scatter(300, b => b === 'desert', (x, z) => {
    const h = 1.5 + rng() * 2.5;
    return { x, y: heightAt(x, z) + h / 2, z, sx: 1, sy: h, sz: 1 };
  });
  instanced(new T.CylinderGeometry(0.25, 0.3, 1, 6), '#6f7d3c', cacti);
  // buissons
  const bushes = scatter(500, b => b === 'steppe' || (b === 'desert' && rng() < 0.3), (x, z) => {
    const s = 0.5 + rng() * 0.8;
    return { x, y: heightAt(x, z) + s * 0.3, z, ry: rng() * 3, sx: s * 1.3, sy: s * 0.7, sz: s * 1.3 };
  });
  instanced(new T.DodecahedronGeometry(1, 0), '#7d8a4a', bushes);
  // cristaux de sel
  const salt = scatter(300, b => b === 'sel', (x, z) => {
    const s = 0.3 + rng() * 0.7;
    return { x, y: heightAt(x, z) + s * 0.5, z, ry: rng() * 3, sx: s, sy: s * 1.5, sz: s };
  });
  instanced(new T.OctahedronGeometry(1, 0), '#f4f6f6', salt);
}
