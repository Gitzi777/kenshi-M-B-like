// Terres Arides — monde 3D : scène, terrain, décor, drapeaux, villes.
'use strict';

// ---------- État global ----------
const state = {
  mode: 'create', money: 0, goods: { food: 0, cloth: 0, iron: 0, spices: 0, arrows: 0 },
  day: 1, dayTimer: 20, kills: 0, order: 'follow', ko: 0, panel: null, currentTown: null,
  factions: {}, relations: {}, warSince: {}, rep: {}, allegiance: null,
  settlements: [], parties: [], chronicle: [],
  timeScale: 1, eventTimer: 70, spawnTimer: 3, priceTimer: 20, saveTimer: 60, garrisonTimer: 60,
};
const F = id => state.factions[id];
const relKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;

// ---------- Terrain ----------
function rawHeight(x, z) {
  return Math.sin(x * 0.011) * 3 + Math.cos(z * 0.013) * 3 + Math.sin((x + z) * 0.027) * 1.2 +
    Math.sin(x * 0.004 + 1) * Math.cos(z * 0.005 - 2) * 9;
}
// zones aplanies (villes de départ et ruines)
const FLAT_SPOTS = [
  ...SETTLEMENT_DEFS.map(s => ({ x: s.x, z: s.z, r: s.type === 'camp' ? 24 : 34, h: rawHeight(s.x, s.z) })),
  ...RUINS.map(r => ({ x: r.x, z: r.z, r: 18, h: rawHeight(r.x, r.z) })),
];
function heightAt(x, z) {
  let h = rawHeight(x, z);
  for (const s of FLAT_SPOTS) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.r + 40) h += (s.h - h) * (1 - smooth(s.r + 2, s.r + 40, d));
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
scene.fog = new T.Fog(SKY_DAY.clone(), 70, 300);

const camera = new T.PerspectiveCamera(65, 1, 0.1, 1200);
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

// sol
(function buildTerrain() {
  const geo = new T.PlaneGeometry(WORLD + 300, WORLD + 300, 240, 240);
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

// obstacles circulaires {x, z, r}
const obstacles = [];
const nearFlat = (x, z, margin) => FLAT_SPOTS.some(s => Math.hypot(x - s.x, z - s.z) < s.r + margin);

(function buildDecor() {
  const rng = mulberry32(42);
  const dummy = new T.Object3D();
  const rocks = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), mat('#8a7558'), 650);
  rocks.castShadow = true; rocks.receiveShadow = true;
  let n = 0;
  while (n < 650) {
    const x = (rng() - 0.5) * WORLD, z = (rng() - 0.5) * WORLD;
    if (nearFlat(x, z, 14)) continue;
    const s = rng() < 0.12 ? 2.5 + rng() * 4 : 0.3 + rng() * 1.4;
    dummy.position.set(x, heightAt(x, z) + s * 0.3, z);
    dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    dummy.scale.set(s, s * (0.6 + rng() * 0.5), s);
    dummy.updateMatrix();
    rocks.setMatrixAt(n++, dummy.matrix);
    if (s > 1.2) obstacles.push({ x, z, r: s * 0.9 });
  }
  scene.add(rocks);

  const cacti = new T.InstancedMesh(new T.CylinderGeometry(0.25, 0.3, 1, 6), mat('#6f7d3c'), 260);
  cacti.castShadow = true;
  n = 0;
  while (n < 260) {
    const x = (rng() - 0.5) * WORLD, z = (rng() - 0.5) * WORLD;
    if (nearFlat(x, z, 8)) continue;
    const h = 1.5 + rng() * 2.5;
    dummy.position.set(x, heightAt(x, z) + h / 2, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, h, 1);
    dummy.updateMatrix();
    cacti.setMatrixAt(n++, dummy.matrix);
  }
  scene.add(cacti);
})();

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

// ruines de Valmor
(function buildRuins() {
  const rng = mulberry32(99);
  for (const r of RUINS) {
    const g = new T.Group();
    const h = heightAt(r.x, r.z);
    g.position.set(r.x, h, r.z);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2, rad = 9 + rng() * 3;
      const ch = 1 + rng() * 6;
      const col = mesh(new T.CylinderGeometry(0.7, 0.8, ch, 8), '#d8cbb0');
      col.position.set(Math.cos(a) * rad, ch / 2, Math.sin(a) * rad);
      col.rotation.z = (rng() - 0.5) * 0.2;
      g.add(col);
      obstacles.push({ x: r.x + Math.cos(a) * rad, z: r.z + Math.sin(a) * rad, r: 0.9 });
    }
    for (let i = 0; i < 4; i++) {
      const w = mesh(new T.BoxGeometry(6 + rng() * 4, 1 + rng() * 2.5, 1), '#c9b994');
      const a = rng() * Math.PI * 2;
      w.position.set(Math.cos(a) * 4, 0.8, Math.sin(a) * 4);
      w.rotation.y = rng() * 3;
      g.add(w);
    }
    const statue = mesh(new T.BoxGeometry(1.4, 4, 1), '#bfb39a');
    statue.position.y = 2;
    statue.rotation.z = 0.5;
    g.add(statue);
    const label = textSprite(r.name, 0.8, '#e8dcc0');
    label.position.y = 11;
    g.add(label);
    scene.add(g);
  }
})();

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

function makeFlagPole(f, height = 7) {
  const g = new T.Group();
  const pole = mesh(new T.CylinderGeometry(0.06, 0.08, height, 6), '#4a3826');
  pole.position.y = height / 2;
  const cloth = new T.Mesh(new T.PlaneGeometry(2.4, 1.6), new T.MeshBasicMaterial({ map: factionFlag(f), side: T.DoubleSide }));
  cloth.position.set(1.2, height - 0.9, 0);
  g.add(pole, cloth);
  return { g, cloth };
}

// ---------- Villes et camps ----------
function settlementMult(s) {
  const m = { food: 1, cloth: 1, iron: 1, spices: 1, arrows: 1 };
  m[s.produces] = 0.6;
  m[s.demands] = 1.5;
  return m;
}

function buildSettlement(s) {
  const g = new T.Group();
  g.position.set(s.x, s.h, s.z);
  const rng = mulberry32(Math.round(s.x * 13 + s.z * 7));
  const ly = (lx, lz) => heightAt(s.x + lx, s.z + lz) - s.h;
  const fac = F(s.faction);
  s.flags = [];
  const addFlag = (lx, lz, height) => {
    const fp = makeFlagPole(fac, height);
    fp.g.position.set(lx, ly(lx, lz), lz);
    g.add(fp.g);
    s.flags.push(fp.cloth);
  };

  if (s.type === 'ville') {
    const segs = 40;
    const segLen = 2 * Math.PI * s.r / segs + 0.4;
    for (let i = 0; i < segs; i++) {
      const a = i / segs * Math.PI * 2;
      if (Math.abs(angleDiff(a, s.gate)) < 0.18) continue;
      const wx = Math.cos(a) * s.r, wz = Math.sin(a) * s.r;
      const w = mesh(new T.BoxGeometry(segLen, 5, 1.2), '#8d7350');
      w.position.set(wx, ly(wx, wz) + 2, wz);
      w.rotation.y = -a - Math.PI / 2;
      g.add(w);
    }
    for (const side of [-1, 1]) {
      const a = s.gate + side * 0.22;
      const tx = Math.cos(a) * s.r, tz = Math.sin(a) * s.r;
      const tower = mesh(new T.CylinderGeometry(1.8, 2.1, 8, 8), '#7a6243');
      tower.position.set(tx, ly(tx, tz) + 4, tz);
      g.add(tower);
      addFlag(tx, tz, 11);
    }
    const houses = [];
    let tries = 0;
    while (houses.length < 10 && tries++ < 250) {
      const a = rng() * Math.PI * 2, r = 10 + rng() * (s.r - 17);
      const hx = Math.cos(a) * r, hz = Math.sin(a) * r;
      if (Math.abs(angleDiff(a, s.gate)) < 0.5) continue;
      const w = 5 + rng() * 4, dpt = 5 + rng() * 3, h = 3 + rng() * 2.5;
      if (houses.some(o => Math.hypot(o.x - hx, o.z - hz) < o.r + Math.max(w, dpt) / 2 + 1.5)) continue;
      houses.push({ x: hx, z: hz, r: Math.max(w, dpt) / 2 });
      const house = mesh(new T.BoxGeometry(w, h, dpt), rng() < 0.5 ? '#b39468' : '#a3835a');
      house.position.set(hx, ly(hx, hz) + h / 2, hz);
      house.rotation.y = rng() * Math.PI;
      const roof = mesh(new T.BoxGeometry(w + 0.6, 0.4, dpt + 0.6), '#6e5538');
      roof.position.y = h / 2 + 0.2;
      house.add(roof);
      g.add(house);
      obstacles.push({ x: s.x + hx, z: s.z + hz, r: Math.max(w, dpt) / 2 + 0.3 });
    }
    const clothes = ['#b8452e', '#2e6db8', '#d1a12c'];
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2 + 0.5;
      const sx = Math.cos(a) * 5, sz = Math.sin(a) * 5;
      const stall = new T.Group();
      stall.position.set(sx, ly(sx, sz), sz);
      stall.rotation.y = -a;
      const table = mesh(new T.BoxGeometry(2.4, 0.9, 1.2), '#6e5538');
      table.position.y = 0.45;
      const tarp = mesh(new T.BoxGeometry(3, 0.1, 2), clothes[i]);
      tarp.position.y = 2.3;
      for (const [px, pz] of [[-1.3, -0.8], [1.3, -0.8], [-1.3, 0.8], [1.3, 0.8]]) {
        const post = mesh(new T.BoxGeometry(0.1, 2.3, 0.1), '#4a3826');
        post.position.set(px, 1.15, pz);
        stall.add(post);
      }
      stall.add(table, tarp);
      g.add(stall);
      obstacles.push({ x: s.x + sx, z: s.z + sz, r: 1.4 });
    }
    addFlag(0, 0, 14);
  } else {
    // camp : palissade de pieux et tentes
    const n = Math.round(2 * Math.PI * s.r / 1.3);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      if (Math.abs(angleDiff(a, s.gate)) < 0.25) continue;
      const px = Math.cos(a) * s.r, pz = Math.sin(a) * s.r;
      const stake = mesh(new T.CylinderGeometry(0.25, 0.3, 3.2, 5), '#6e5538');
      stake.position.set(px, ly(px, pz) + 1.6, pz);
      stake.rotation.z = (rng() - 0.5) * 0.15;
      g.add(stake);
    }
    const cloths = [fac.colors[0], fac.colors[1], '#c9b48a', '#a8743a'];
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2 + 0.3, r = 9 + rng() * 6;
      if (Math.abs(angleDiff(a, s.gate)) < 0.4) continue;
      const tx = Math.cos(a) * r, tz = Math.sin(a) * r;
      const tent = mesh(new T.ConeGeometry(2.6, 3.2, 6), pick(cloths));
      tent.position.set(tx, ly(tx, tz) + 1.6, tz);
      g.add(tent);
      obstacles.push({ x: s.x + tx, z: s.z + tz, r: 2.4 });
    }
    const fire = mesh(new T.ConeGeometry(0.6, 1, 5), '#e8862a', false);
    fire.material = new T.MeshBasicMaterial({ color: '#ff9a3c' });
    fire.position.set(3, ly(3, 0) + 0.5, 0);
    g.add(fire);
    addFlag(0, 0, 9);
  }
  const label = textSprite(s.name);
  label.position.y = s.type === 'ville' ? 18 : 13;
  g.add(label);
  scene.add(g);
  s.root = g;
}

function makeSettlement(def, isNew = false) {
  const s = {
    name: def.name, x: def.x, z: def.z, faction: def.faction, type: def.type || 'ville',
    r: (def.type || 'ville') === 'camp' ? 22 : 34, capital: !!def.capital, isNew,
    produces: def.produces, demands: def.demands,
    garrison: def.garrison != null ? def.garrison : (def.type === 'camp' ? 5 : 8),
    guards: [], fluct: def.fluct || { food: 1, cloth: 1, iron: 1, spices: 1, arrows: 1 },
  };
  s.h = heightAt(s.x, s.z);
  s.gate = Math.atan2(-s.z, -s.x);
  s.mult = settlementMult(s);
  state.settlements.push(s);
  buildSettlement(s);
  return s;
}

function setOwner(s, fid) {
  s.faction = fid;
  for (const cloth of s.flags) { cloth.material.map = factionFlag(F(fid)); cloth.material.needsUpdate = true; }
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
const gatePos = (s, inside = 6) => ({ x: s.x + Math.cos(s.gate) * (s.r - inside), z: s.z + Math.sin(s.gate) * (s.r - inside) });
