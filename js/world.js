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
// couleurs : on écrit en sRGB, le rendu travaille en linéaire
const lin = c => new T.Color(c).convertSRGBToLinear();
const setLin = (color, c) => color.set(c).convertSRGBToLinear();
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

const hemi = new T.HemisphereLight(0xc4daf2, 0x8f7250, 0.8);
scene.add(hemi);
const sun = new T.DirectionalLight(0xfff0d0, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
sun.shadow.radius = 3;
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 300 });
scene.add(sun, sun.target);

// matériaux : couleur sRGB convertie, léger grain ; tex = 'plaster' | 'tiles' | 'wood' | 'stone'
const matCache = {};
function mat(color, tex = 'grain') {
  const key = color + '|' + tex;
  if (!matCache[key]) {
    matCache[key] = toonMat({ color: new T.Color(color).convertSRGBToLinear(), flatShading: true, roughness: 0.9,
      map: typeof TEX !== 'undefined' ? TEX[tex] : null });
  }
  return matCache[key];
}
function mesh(geo, color, shadow = true, tex) {
  const m = new T.Mesh(geo, mat(color, tex));
  // les petits objets ne projettent pas d'ombre (beaucoup moins de travail pour la carte graphique)
  if (shadow) { geo.computeBoundingSphere(); if (geo.boundingSphere.radius < 0.9) shadow = false; }
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}
const hsl = (h, s, l) => '#' + new T.Color().setHSL(((h % 1) + 1) % 1, s, l).getHexString();

let worldGroup = new T.Group();
scene.add(worldGroup);

// ---------- Relief et biomes ----------
let elevN = makeNoise(1), moistN = makeNoise(2), detailN = makeNoise(3);
let FLAT_SPOTS = [];
const GRID_N = 300, GRID_SIZE = WORLD + 300, CELL = GRID_SIZE / GRID_N;
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
// ---------- Rivières, lacs, ponts ----------
// une rivière : une ligne de points { x, z, h } (h = niveau du lit avant creusement)
let RIVERS = [], LAKES = [], BRIDGES = [];
const RIVER_W = 12, RIVER_DEPTH = 1.3, WATER_DROP = 0.75;
let riverGrid = new Map();
const RIV_CELL = 40, RIV_REACH = 95;
function planWater(seed) {
  const rng = mulberry32(seed + 555);
  RIVERS = []; LAKES = []; BRIDGES = []; riverGrid = new Map();
  const nR = 1 + (rng() < 0.7 ? 1 : 0);
  for (let r = 0; r < nR; r++) {
    // part du bord du monde et suit les terres basses en serpentant
    const a0 = rng() * Math.PI * 2 + r * Math.PI;
    let x = Math.cos(a0) * (HALF + 140), z = Math.sin(a0) * (HALF + 140);
    const goal = a0 + Math.PI + (rng() - 0.5) * 1.6;
    let head = Math.atan2(Math.sin(goal) * (HALF + 140) - z, Math.cos(goal) * (HALF + 140) - x);
    const pts = [];
    for (let i = 0; i < 420; i++) {
      pts.push({ x, z });
      if (i > 20 && Math.hypot(x, z) > HALF + 150) break;
      let best = head, bestE = 1e9;
      for (const da of [-0.32, -0.16, 0, 0.16, 0.32]) {
        const a = head + da;
        const e = elevAt(x + Math.cos(a) * 70, z + Math.sin(a) * 70) + Math.abs(da) * 0.05 + rng() * 0.02;
        if (e < bestE) { bestE = e; best = a; }
      }
      const toGoal = Math.atan2(Math.sin(goal) * (HALF + 160) - z, Math.cos(goal) * (HALF + 160) - x);
      head = best + Math.atan2(Math.sin(toGoal - best), Math.cos(toGoal - best)) * 0.12;
      x += Math.cos(head) * 10; z += Math.sin(head) * 10;
    }
    // niveau de l'eau : plancher des hauteurs voisines, lissé
    const raw = pts.map(p => rawHeight(p.x, p.z));
    let hs = raw.map((_, i) => Math.min(...raw.slice(Math.max(0, i - 6), i + 7)));
    for (let pass = 0; pass < 4; pass++) hs = hs.map((_, i) => (hs[Math.max(0, i - 2)] + hs[Math.max(0, i - 1)] + hs[i] + hs[Math.min(hs.length - 1, i + 1)] + hs[Math.min(hs.length - 1, i + 2)]) / 5);
    pts.forEach((p, i) => { p.h = Math.min(hs[i], raw[i]) - 0.4; });
    RIVERS.push(pts);
    const ri = RIVERS.length - 1;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const cx0 = Math.floor((Math.min(a.x, b.x) - RIV_REACH) / RIV_CELL), cx1 = Math.floor((Math.max(a.x, b.x) + RIV_REACH) / RIV_CELL);
      const cz0 = Math.floor((Math.min(a.z, b.z) - RIV_REACH) / RIV_CELL), cz1 = Math.floor((Math.max(a.z, b.z) + RIV_REACH) / RIV_CELL);
      for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
        const k = cx + ',' + cz;
        if (!riverGrid.has(k)) riverGrid.set(k, []);
        riverGrid.get(k).push([ri, i]);
      }
    }
  }
  // lacs dans les creux, loin des montagnes
  for (let t = 0; t < 400 && LAKES.length < 3; t++) {
    const x = (rng() - 0.5) * (WORLD - 200), z = (rng() - 0.5) * (WORLD - 200);
    const e = elevAt(x, z);
    if (e > 0.47 || e < 0.3) continue;
    if (LAKES.some(l => Math.hypot(l.x - x, l.z - z) < 300) || riverInfo(x, z).d < 120) continue;
    const R = 26 + rng() * 22;
    // le niveau du lac est sous le point le plus bas de ses rives
    let rim = 1e9;
    for (let k = 0; k < 24; k++) rim = Math.min(rim, rawHeight(x + Math.cos(k / 24 * Math.PI * 2) * R * 1.3, z + Math.sin(k / 24 * Math.PI * 2) * R * 1.3));
    if (rawHeight(x, z) - rim > 5) continue;
    LAKES.push({ x, z, R, h: Math.min(rim, rawHeight(x, z)) - 1.1, nz: makeNoise(seed + t), ph: rng() * 6 });
  }
}
// distance à la rivière la plus proche et niveau de son eau à cet endroit
const _ri = { d: 1e9, h: 0, t: 0, dx: 1, dz: 0 };
function riverInfo(x, z) {
  _ri.d = 1e9;
  const l = riverGrid.get(Math.floor(x / RIV_CELL) + ',' + Math.floor(z / RIV_CELL));
  if (!l) return _ri;
  for (const [ri, i] of l) {
    const a = RIVERS[ri][i], b = RIVERS[ri][i + 1];
    const vx = b.x - a.x, vz = b.z - a.z, L2 = vx * vx + vz * vz || 1;
    const t = clamp(((x - a.x) * vx + (z - a.z) * vz) / L2, 0, 1);
    const d = Math.hypot(x - a.x - vx * t, z - a.z - vz * t);
    if (d < _ri.d) { _ri.d = d; _ri.h = a.h + (b.h - a.h) * t; _ri.dx = vx; _ri.dz = vz; }
  }
  return _ri;
}
const lakeRadius = (l, x, z) => l.R * (0.82 + l.nz(Math.cos(Math.atan2(z - l.z, x - l.x) + l.ph) * 1.3 + 2, Math.sin(Math.atan2(z - l.z, x - l.x) + l.ph) * 1.3 + 2) * 0.4);
// distance au bord de l'eau (négative dans l'eau)
function waterDist(x, z) {
  let best = riverInfo(x, z).d - RIVER_W * 0.7;
  for (const l of LAKES) {
    const d = Math.hypot(x - l.x, z - l.z);
    if (d < l.R * 1.5 + 60) best = Math.min(best, d - lakeRadius(l, x, z));
  }
  return best;
}
// creuse le lit des rivières et des lacs (ne fait que descendre le sol)
function carveWater(x, z, h) {
  const r = riverInfo(x, z);
  if (r.d < RIV_REACH) {
    const prof = 1 - smooth(0, RIVER_W, r.d);
    const target = r.h + WATER_DROP - RIVER_DEPTH * prof + Math.max(0, r.d - RIVER_W * 0.8) * 0.38;
    if (target < h) h = target;
  }
  for (const l of LAKES) {
    const d = Math.hypot(x - l.x, z - l.z);
    if (d > l.R * 1.5 + 70) continue;
    const R = lakeRadius(l, x, z);
    const target = l.h + WATER_DROP - 2.6 * (1 - smooth(0, R, d)) + Math.max(0, d - R * 0.85) * 0.3;
    if (target < h) h = target;
  }
  return h;
}
// ponts : là où une route traverse une rivière, la route passe au-dessus
function planBridges() {
  BRIDGES = [];
  for (const road of ROADS) {
    for (let i = 0; i < road.length - 1; i++) {
      const p = road[i], q = road[i + 1];
      // point du segment le plus proche de l'eau
      let mx = 0, mz = 0, bd = 1e9;
      for (let k = 0; k <= 8; k++) {
        const x = p.x + (q.x - p.x) * k / 8, z = p.z + (q.z - p.z) * k / 8, d = riverInfo(x, z).d;
        if (d < bd) { bd = d; mx = x; mz = z; }
      }
      if (bd > 3 || BRIDGES.some(b => Math.hypot(b.x - mx, b.z - mz) < 40)) continue;
      const r = riverInfo(mx, mz);
      // le pont est perpendiculaire à la rivière, dans le sens de la route
      const L = Math.hypot(r.dx, r.dz) || 1;
      let ax = -r.dz / L, az = r.dx / L;
      if (ax * (q.x - p.x) + az * (q.z - p.z) < 0) { ax = -ax; az = -az; }
      const half = RIVER_W + 5;
      const bank = Math.max(rawHeight(mx + ax * half, mz + az * half), rawHeight(mx - ax * half, mz - az * half));
      const deck = Math.max(r.h + WATER_DROP + 1.5, Math.min(bank, r.h + 4));
      BRIDGES.push({ x: mx, z: mz, ax, az, half, deck, water: r.h + WATER_DROP });
      // la route passe droit sur le pont : on remplace les points proches par les deux têtes de pont
      const reach = half + 10;
      let i0 = i, i1 = i + 1;
      while (i0 > 1 && Math.hypot(road[i0].x - mx, road[i0].z - mz) < reach) i0--;
      while (i1 < road.length - 2 && Math.hypot(road[i1].x - mx, road[i1].z - mz) < reach) i1++;
      const heads = [{ x: mx - ax * (half + 4), z: mz - az * (half + 4) }, { x: mx + ax * (half + 4), z: mz + az * (half + 4) }];
      road.splice(i0 + 1, i1 - i0 - 1, ...heads);
      i = i0 + 2;
    }
  }
  indexRoads();
}
function bridgeHeight(x, z, h) {
  for (const b of BRIDGES) {
    const dx = x - b.x, dz = z - b.z;
    const along = Math.abs(dx * b.ax + dz * b.az), across = Math.abs(dx * b.az - dz * b.ax);
    if (across > 2.7 || along > b.half + 24) continue;
    const ramp = along < b.half + 2 ? b.deck : b.deck - (along - b.half - 2) * 0.35;
    if (ramp > h) h = ramp;
  }
  return h;
}
// niveau de l'eau (grille précalculée) ; -1e4 = pas d'eau
let wgrid = null;
function buildWaterGrid() {
  wgrid = new Float32Array((GRID_N + 1) * (GRID_N + 1)).fill(-1e4);
  for (let j = 0; j <= GRID_N; j++) for (let i = 0; i <= GRID_N; i++) {
    const x = -GRID_SIZE / 2 + i * CELL, z = -GRID_SIZE / 2 + j * CELL;
    const r = riverInfo(x, z);
    let w = r.d < RIVER_W + 3 ? r.h + WATER_DROP : -1e4;
    for (const l of LAKES) if (Math.hypot(x - l.x, z - l.z) < lakeRadius(l, x, z) + 4) w = Math.max(w, l.h + WATER_DROP);
    wgrid[j * (GRID_N + 1) + i] = w;
  }
}
function waterLevelAt(x, z) {
  if (!wgrid) return -1e4;
  const i = Math.round(clamp((x + GRID_SIZE / 2) / CELL, 0, GRID_N)), j = Math.round(clamp((z + GRID_SIZE / 2) / CELL, 0, GRID_N));
  return wgrid[j * (GRID_N + 1) + i];
}
const waterDepthAt = (x, z) => waterLevelAt(x, z) - groundAt(x, z);
// sol où l'on marche : le terrain, ou le tablier d'un pont
const groundAt = (x, z) => BRIDGES.length ? bridgeHeight(x, z, heightAt(x, z)) : heightAt(x, z);

function flatHeight(x, z) {
  let h = carveWater(x, z, rawHeight(x, z));
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
    f._flagTex.encoding = T.sRGBEncoding;
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
  const tx = new T.CanvasTexture(cv); tx.encoding = T.sRGBEncoding;
  const sp = new T.Sprite(new T.SpriteMaterial({ map: tx, depthWrite: false }));
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
  Object.assign(state, { seed, settlements: [], nodes: [], parties: [], chronicle: [], trades: [], factions: {}, relations: {}, warSince: {}, rep: {}, obj: null, water: null });

  const rng = mulberry32(seed);
  elevN = makeNoise(seed); moistN = makeNoise(seed + 101); detailN = makeNoise(seed + 7);
  BRIDGES = []; wgrid = null;
  planWater(seed);

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
  const okSite = (x, z, minD) => Math.abs(x) < HALF - 70 && Math.abs(z) < HALF - 70 && elevAt(x, z) < 0.6 && waterDist(x, z) > 85 &&
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
    if (sites.some(s => Math.hypot(s.x - x, s.z - z) < 80) || nodeSpots.some(n => Math.hypot(n.x - x, n.z - z) < 55) || waterDist(x, z) < 28) continue;
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

  planRoads(sites.map(s => ({ ...s, r: { camp: 26, repaire: 18 }[s.type] || 44, gate: Math.atan2(-s.z, -s.x) })));
  planBridges();
  buildHeightGrid();
  buildWaterGrid();
  TERRAIN_SPOTS = { sites: sites.map(s => ({ x: s.x, z: s.z, r: { camp: 26, repaire: 18 }[s.type] || 44 })), nodes: nodeSpots };
  rebuildTerrainHeights();
  buildRoads();
  buildWater();
  buildBridges();
  buildMesas(rng, sites, nodeSpots);
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
let TERRAIN_SPOTS = { sites: [], nodes: [] };
const TERRAIN_SEG = 300;
function buildTerrain() {
  const geo = new T.PlaneGeometry(GRID_SIZE, GRID_SIZE, TERRAIN_SEG, TERRAIN_SEG);
  geo.rotateX(-Math.PI / 2);
  geo.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * GRID_SIZE / 7, uv.getY(i) * GRID_SIZE / 7);
  terrainMesh = new T.Mesh(geo, toonMat({ vertexColors: true, roughness: 1, map: TEX.ground }));
  terrainMesh.receiveShadow = true;
  worldGroup.add(terrainMesh);
  rebuildTerrainHeights();
}
// palette du sol (sRGB) : chaque biome se fond dans le suivant
const GROUND = {
  desert: lin('#d2a065'), dune: lin('#e2b97e'), steppe: lin('#b4a656'), steppeDry: lin('#c9b064'), foret: lin('#55803a'),
  foretDark: lin('#3f6430'), montagne: lin('#9a8576'), rock: lin('#7a6a5e'), redRock: lin('#b05a36'), snow: lin('#f0f0f2'), sel: lin('#ece6d8'),
  town: lin('#bfa47c'), field: lin('#7a5c3e'), road: lin('#a88a64'), bank: lin('#6f9a44'), wetSand: lin('#9c8460'), stone: lin('#8e8a80'),
};
const _gc = new T.Color(), _gt = new T.Color();
function terrainColor(x, z, h, flat) {
  const e = elevAt(x, z), m = moistN(x / 220, z / 220);
  const big = detailN(x / 70, z / 70, 2), fine = detailN(x / 9, z / 9, 1);
  // plaines : désert → steppe → forêt
  const wSteppe = smooth(0.45, 0.49, m), wForest = smooth(0.55, 0.59, m);
  _gc.copy(GROUND.desert).lerp(GROUND.dune, smooth(0.45, 0.7, big));
  _gt.copy(GROUND.steppe).lerp(GROUND.steppeDry, smooth(0.4, 0.75, big));
  _gc.lerp(_gt, wSteppe);
  _gt.copy(GROUND.foret).lerp(GROUND.foretDark, smooth(0.35, 0.7, big));
  _gc.lerp(_gt, wForest);
  // marais salants
  const wSalt = (1 - smooth(0.40, 0.44, e)) * (1 - smooth(0.40, 0.44, m));
  _gc.lerp(GROUND.sel, wSalt);
  // montagnes : roche, falaises dans les pentes, neige sur les sommets
  _gc.lerp(GROUND.montagne, smooth(0.62, 0.66, e));
  // falaises : rouges dans le désert, grises ailleurs
  _gt.copy(GROUND.redRock).lerp(GROUND.rock, Math.max(wForest, smooth(0.62, 0.7, e)));
  _gc.lerp(_gt, smooth(0.86, 0.7, flat) * 0.85);
  // berges vertes et sable mouillé au bord de l'eau
  if (RIVERS.length || LAKES.length) {
    const wd = waterDist(x, z);
    if (wd < 22) {
      _gc.lerp(GROUND.bank, (1 - smooth(4, 22, wd)) * 0.75);
      _gc.lerp(GROUND.wetSand, 1 - smooth(-1, 4, wd));
    }
  }
  _gc.lerp(GROUND.snow, smooth(40, 50, h) * smooth(0.7, 0.85, flat));
  // terre battue des villes, champs labourés
  for (const s of TERRAIN_SPOTS.sites) {
    const d = Math.hypot(s.x - x, s.z - z);
    if (d < s.r + 6) _gc.lerp(GROUND.town, (1 - smooth(s.r - 6, s.r + 6, d)) * 0.75);
  }
  for (const n of TERRAIN_SPOTS.nodes) {
    const d = Math.hypot(n.x - x, n.z - z);
    if (d < 14) _gc.lerp(['ferme', 'coton', 'epices'].includes(n.type) ? GROUND.field : GROUND.town, (1 - smooth(8, 14, d)) * 0.7);
  }
  if (ROADS.length) { const rd = onRoad(x, z); if (rd < 4) _gc.lerp(GROUND.road, (1 - smooth(1.5, 4, rd)) * 0.55); }
  // variations : grandes taches et petit grain
  const k = 0.9 + big * 0.16 + (fine - 0.5) * 0.1;
  return _gc.multiplyScalar(k);
}
function rebuildTerrainHeights() {
  const geo = terrainMesh.geometry;
  const pos = geo.attributes.position, col = geo.attributes.color;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const nor = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const c = terrainColor(pos.getX(i), pos.getZ(i), pos.getY(i), nor.getY(i));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}

// ---------- Décor : arbres, rochers, buissons, cactus ----------
let FAR_DECOR = [], DECOR_CHUNKS = [];
const _zero = new T.Matrix4().makeScale(0, 0, 0);
function hideFarDecorNear(focus, R) {
  const touched = new Set();
  for (const f of FAR_DECOR) {
    const hide = Math.abs(f.x - focus.x) < R && Math.abs(f.z - focus.z) < R && Math.hypot(f.x - focus.x, f.z - focus.z) < R;
    if (hide === f.hidden) continue;
    f.hidden = hide;
    f.m.setMatrixAt(f.i, hide ? _zero : f.mat);
    touched.add(f.m);
  }
  for (const m of touched) m.instanceMatrix.needsUpdate = true;
}
const DECOR = {};
function decorModels() {
  if (DECOR.pine) return DECOR;
  const cyl = (rt, rb, h, seg = 6) => new T.CylinderGeometry(rt, rb, h, seg);
  const ico = (r, d = 1) => new T.IcosahedronGeometry(r, d);
  // pin : tronc et étages de branches (hauteur 1, mis à l'échelle)
  // étage de branches : jupe en étoile qui retombe un peu
  const skirt = (r, h, seg) => {
    const g = new T.ConeGeometry(r, h, seg * 2, 1, true);
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      if (P.getY(i) > -h / 2 + 0.001) continue;
      const a = Math.atan2(P.getZ(i), P.getX(i));
      const k = Math.round((a / (Math.PI * 2)) * seg * 2) % 2 ? 0.72 : 1.08;
      P.setXYZ(i, P.getX(i) * k, P.getY(i) - (k > 1 ? 0.03 : -0.02), P.getZ(i) * k);
    }
    return g;
  };
  DECOR.pine = mergeParts([
    { geo: cyl(0.035, 0.06, 0.45).translate(0, 0.22, 0), color: '#5a3e26', shade: [0.7, 1] },
    { geo: skirt(0.34, 0.4, 7).translate(0, 0.36, 0), color: '#2b4f24', shade: [0.5, 1.0], jitter: 0.12 },
    { geo: skirt(0.28, 0.34, 7).translate(0.01, 0.52, 0).rotateY(0.4), color: '#30572a', shade: [0.55, 1.05], jitter: 0.12 },
    { geo: skirt(0.21, 0.3, 6).translate(0, 0.67, 0).rotateY(0.9), color: '#36622e', shade: [0.6, 1.1], jitter: 0.12 },
    { geo: skirt(0.14, 0.24, 6).translate(0, 0.81, 0).rotateY(1.3), color: '#3c6a32', shade: [0.65, 1.12], jitter: 0.1 },
    { geo: new T.ConeGeometry(0.07, 0.2, 6).translate(0, 0.95, 0), color: '#427434', shade: [0.7, 1.15] },
  ]);
  // feuillu : tronc tordu et houppier en boules
  const leaves = [];
  const blobs = [[0, 0.72, 0, 0.3], [0.2, 0.62, 0.08, 0.22], [-0.18, 0.64, -0.1, 0.23], [0.05, 0.86, -0.12, 0.2], [-0.08, 0.8, 0.16, 0.21], [0.16, 0.8, -0.14, 0.17]];
  for (const [x, y, z, r] of blobs) leaves.push({ geo: ico(r, 1).translate(x, y, z), color: '#4f7a34', shade: [0.55, 1.12], jitter: 0.18 });
  DECOR.oak = mergeParts([
    { geo: cyl(0.04, 0.075, 0.55).translate(0, 0.27, 0), color: '#5e4430', shade: [0.65, 1] },
    { geo: cyl(0.02, 0.035, 0.3).rotateZ(0.8).translate(0.12, 0.5, 0), color: '#5e4430' },
    { geo: cyl(0.02, 0.035, 0.28).rotateZ(-0.9).translate(-0.11, 0.5, 0), color: '#5e4430' },
    ...leaves,
  ]);
  // arbre mort du désert
  DECOR.dead = mergeParts([
    { geo: cyl(0.03, 0.06, 0.7).translate(0, 0.35, 0), color: '#6e5a48', shade: [0.7, 1] },
    { geo: cyl(0.012, 0.025, 0.4).rotateZ(0.9).translate(0.15, 0.62, 0), color: '#6e5a48' },
    { geo: cyl(0.012, 0.025, 0.35).rotateZ(-1.0).translate(-0.13, 0.55, 0.02), color: '#6e5a48' },
    { geo: cyl(0.01, 0.02, 0.25).rotateX(0.9).translate(0, 0.72, 0.1), color: '#6e5a48' },
  ]);
  // cactus à bras
  DECOR.cactus = mergeParts([
    { geo: cyl(0.12, 0.14, 1, 8).translate(0, 0.5, 0), color: '#5f7a3a', shade: [0.7, 1.05] },
    { geo: new T.SphereGeometry(0.12, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1, 0), color: '#6c8a42' },
    { geo: cyl(0.07, 0.08, 0.35, 7).rotateZ(Math.PI / 2).translate(0.2, 0.45, 0), color: '#5f7a3a' },
    { geo: cyl(0.07, 0.07, 0.35, 7).translate(0.35, 0.62, 0), color: '#668240', shade: [0.85, 1.05] },
    { geo: cyl(0.06, 0.07, 0.25, 7).rotateZ(Math.PI / 2).translate(-0.18, 0.62, 0), color: '#5f7a3a' },
    { geo: cyl(0.06, 0.06, 0.28, 7).translate(-0.3, 0.75, 0), color: '#668240' },
  ]);
  // buisson
  DECOR.bush = mergeParts([[0, 0.3, 0, 0.42], [0.3, 0.22, 0.1, 0.3], [-0.28, 0.2, -0.05, 0.32], [0.05, 0.25, 0.3, 0.28]]
    .map(([x, y, z, r]) => ({ geo: ico(r, 1).translate(x, y, z), color: '#7a8a46', shade: [0.55, 1.1], jitter: 0.15 })));
  // rochers
  DECOR.rocks = [rockGeo(11), rockGeo(23), rockGeo(37)].map(g => mergeParts([{ geo: g, color: '#9a8c7c', shade: [0.6, 1.08], jitter: 0.1 }]));
  // cristaux de sel
  DECOR.salt = mergeParts([[0, 0, 0.6], [0.25, 0.15, 0.4], [-0.2, -0.1, 0.45]].map(([x, rz, h]) => ({ geo: new T.OctahedronGeometry(0.2, 0).scale(1, h / 0.2, 1).rotateZ(rz).translate(x, h * 0.8, 0), color: '#f2f4f4', shade: [0.85, 1.1] })));
  // touffe d'herbe sèche (loin du joueur)
  DECOR.tuft = grass.mesh.geometry;
  return DECOR;
}
function buildDecor(rng, sites, nodeSpots) {
  FAR_DECOR = []; DECOR_CHUNKS = []; NEAR.list = []; NEAR.cx = 1e9;
  const M = decorModels();
  const dummy = new T.Object3D();
  const col = new T.Color();
  const blocked = (x, z) => sites.some(s => Math.hypot(s.x - x, s.z - z) < 55) || nodeSpots.some(n => Math.hypot(n.x - x, n.z - z) < 16) || onRoad(x, z) < 4 ||
    waterDist(x, z) < 1.5 || MESAS.some(m => Math.hypot(m.x - x, m.z - z) < m.r + 2);
  const scatter = (count, accept, place) => {
    const out = [];
    for (let t = 0; t < count * 6 && out.length < count; t++) {
      const x = (rng() - 0.5) * WORLD, z = (rng() - 0.5) * WORLD;
      if (blocked(x, z) || !accept(biomeAt(x, z), x, z)) continue;
      out.push(place(x, z));
    }
    return out;
  };
  const foliage = toonMat({ vertexColors: true, flatShading: true, roughness: 0.85 });
  const windy = (amp, minY) => addWind(toonMat({ vertexColors: true, flatShading: true, roughness: 0.85 }), amp, minY);
  // kind / near : quand les modèles détaillés sont chargés, ils remplacent cette version simple près du joueur
  // le décor est découpé en zones de 160 m : seules les zones visibles sont dessinées
  const CH = 160;
  const instanced = (geo, material, list, shadow = true, kind = null, near = null) => {
    const chunks = new Map();
    for (const d of list) {
      const k = Math.floor(d.x / CH) + ',' + Math.floor(d.z / CH);
      if (!chunks.has(k)) chunks.set(k, []);
      chunks.get(k).push(d);
    }
    geo.computeBoundingSphere();
    for (const [k, items] of chunks) {
      const [cx, cz] = k.split(',').map(v => (Number(v) + 0.5) * CH);
      const g2 = geo.clone();
      g2.boundingSphere = new T.Sphere(new T.Vector3(0, 0, 0), CH * 0.75 + 30);
      const m = new T.InstancedMesh(g2, material, items.length);
      m.position.set(cx, 0, cz);
      m.castShadow = shadow && !ASSETS.ready; m.receiveShadow = true;
      items.forEach((d, i) => {
        dummy.position.set(d.x - cx, d.y, d.z - cz); dummy.rotation.set(d.rx || 0, d.ry || 0, d.rz || 0);
        dummy.scale.set(d.sx, d.sy, d.sz); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
        if (kind && ASSETS.ready && (!d.skipNear)) {
          FAR_DECOR.push({ m, i, x: d.x, z: d.z, mat: dummy.matrix.clone(), hidden: false });
          addNearSpot(typeof kind === 'function' ? kind(d) : kind, { x: d.x, y: d.y + (near.dy || 0), z: d.z, ry: d.ry || 0, s: near.s(d), seed: rng() });
        }
        col.setRGB(1, 1, 1).multiplyScalar(d.tint || 1);
        if (d.hue) col.lerp(d.hue, 0.25);
        m.setColorAt(i, col);
      });
      worldGroup.add(m);
      DECOR_CHUNKS.push(m);
    }
  };
  const autumn = [lin('#c9a040'), lin('#b8622e'), lin('#9aaa40')];
  // forêts : pins et feuillus, en bosquets
  const groves = [];
  for (let i = 0; i < 160; i++) {
    const x = (rng() - 0.5) * WORLD, z = (rng() - 0.5) * WORLD;
    if (biomeAt(x, z) === 'foret' || (biomeAt(x, z) === 'steppe' && rng() < 0.15) || (biomeAt(x, z) === 'montagne' && rng() < 0.3)) groves.push({ x, z, r: 15 + rng() * 40 });
  }
  const inGrove = (x, z) => groves.some(g => Math.hypot(g.x - x, g.z - z) < g.r);
  const pines = [], oaks = [];
  scatter(2200, (b, x, z) => (b === 'foret' && (inGrove(x, z) || rng() < 0.35)) || ((b === 'steppe' || b === 'montagne') && inGrove(x, z) && rng() < 0.5), (x, z) => {
    const b = biomeAt(x, z);
    const pine = b === 'montagne' || (b === 'foret' ? rng() < 0.55 : rng() < 0.3);
    const h = pine ? 6 + rng() * 7 : 4.5 + rng() * 4;
    addObstacle(x, z, 0.55);
    const d = { x, y: heightAt(x, z) - 0.15, z, ry: rng() * 6, sx: h * (0.8 + rng() * 0.3), sy: h, sz: h * (0.8 + rng() * 0.3), tint: 0.82 + rng() * 0.3, hue: !pine && rng() < 0.12 ? pick(autumn) : null };
    (pine ? pines : oaks).push(d);
    return d;
  });
  const pineMat = windy(0.05, 0.25); pineMat.side = T.DoubleSide;
  instanced(M.pine, pineMat, pines, true, 'pin', { s: d => d.sy / 7.3, dy: 0.1 });
  instanced(M.oak, windy(0.07, 0.4), oaks, true, d => d.sy > 7.8 && rng() < 0.25 ? 'tordu' : 'feuillu', { s: d => d.sy > 7.8 ? d.sy / 9 : d.sy / 6.2, dy: 0.1 });
  // arbres morts, cactus
  instanced(M.dead, foliage, scatter(140, b => b === 'desert' || b === 'sel', (x, z) => {
    const h = 3 + rng() * 3;
    return { x, y: heightAt(x, z) - 0.1, z, ry: rng() * 6, sx: h, sy: h, sz: h, tint: 0.9 + rng() * 0.2 };
  }), true, 'mort', { s: d => d.sy / 8, dy: 0.1 });
  instanced(M.cactus, foliage, scatter(380, b => b === 'desert', (x, z) => {
    const h = 1.6 + rng() * 2.6;
    if (h > 3) addObstacle(x, z, 0.4);
    return { x, y: heightAt(x, z) - 0.05, z, ry: rng() * 6, sx: h, sy: h, sz: h, tint: 0.85 + rng() * 0.25 };
  }));
  // rochers : gros blocs en montagne, cailloux partout
  for (let v = 0; v < 3; v++) {
    instanced(M.rocks[v], foliage, scatter(330, b => b === 'montagne' || rng() < 0.22, (x, z) => {
      const b = biomeAt(x, z);
      const big = b === 'montagne' ? rng() < 0.45 : rng() < 0.12;
      const sz = big ? 2.2 + rng() * 4.5 : 0.25 + rng() * 1.1;
      if (sz > 1.2) addObstacle(x, z, sz * 0.85);
      const tint = b === 'desert' ? lin('#d8b080') : b === 'foret' ? lin('#7a8a5a') : b === 'sel' ? lin('#e0dcd0') : null;
      return { x, y: heightAt(x, z) + sz * 0.12, z, ry: rng() * 6, rx: (rng() - 0.5) * 0.4, sx: sz * (0.8 + rng() * 0.5), sy: sz * (0.6 + rng() * 0.5), sz: sz * (0.8 + rng() * 0.5), tint: 0.8 + rng() * 0.3, hue: tint, skipNear: sz < 0.6 };
    }), true, 'rocher', { s: d => d.sx / 1.7, dy: -0.2 });
  }
  // buissons, touffes
  instanced(M.bush, windy(0.25, 0.1), scatter(900, b => b === 'steppe' || b === 'foret' || (b === 'desert' && rng() < 0.3), (x, z) => {
    const sz = 0.6 + rng() * 1.1;
    const b = biomeAt(x, z);
    return { x, y: heightAt(x, z) - 0.1, z, ry: rng() * 6, sx: sz * 1.2, sy: sz * (0.8 + rng() * 0.4), sz: sz * 1.2, tint: 0.8 + rng() * 0.35, hue: b === 'desert' ? lin('#b8a060') : b === 'foret' ? lin('#4f7a34') : null, skipNear: b === 'desert' };
  }), true, 'buisson', { s: d => d.sx * 0.9 });
  instanced(M.tuft, windy(0.5, 0), scatter(2600, b => b !== 'sel', (x, z) => {
    const sz = 0.8 + rng() * 1.2, b = biomeAt(x, z);
    return { x, y: heightAt(x, z) - 0.05, z, ry: rng() * 6, sx: sz, sy: sz, sz: sz, tint: 0.85 + rng() * 0.3, hue: b === 'foret' ? lin('#5a8a3a') : b === 'desert' ? lin('#d0b070') : null, skipNear: b === 'desert' || b === 'montagne' || rng() < 0.4 };
  }), false, 'plante', { s: d => d.sx * 0.7 });
  // sel
  instanced(M.salt, foliage, scatter(380, b => b === 'sel', (x, z) => {
    const sz = 0.6 + rng() * 1.4;
    return { x, y: heightAt(x, z) - 0.05, z, ry: rng() * 6, sx: sz, sy: sz, sz: sz, tint: 0.9 + rng() * 0.15 };
  }));
}
