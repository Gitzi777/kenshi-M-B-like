// Terres Arides — villes : bâtiments où l'on entre, murs, toits, prisons, cellules, coffres, maisons.
'use strict';

// ---------- Murs (collisions par segments) ----------
let wallSegs = [];
let segGrid = new Map();
const SEG_CELL = 12;
function addSeg(ax, az, bx, bz, t = 0.3) {
  const sg = { ax, az, bx, bz, t, on: true };
  wallSegs.push(sg);
  const x0 = Math.floor((Math.min(ax, bx) - 1) / SEG_CELL), x1 = Math.floor((Math.max(ax, bx) + 1) / SEG_CELL);
  const z0 = Math.floor((Math.min(az, bz) - 1) / SEG_CELL), z1 = Math.floor((Math.max(az, bz) + 1) / SEG_CELL);
  for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
    const k = i + ',' + j;
    if (!segGrid.has(k)) segGrid.set(k, []);
    segGrid.get(k).push(sg);
  }
  return sg;
}
function pushOutOfWalls(u) {
  const l = segGrid.get(Math.floor(u.pos.x / SEG_CELL) + ',' + Math.floor(u.pos.z / SEG_CELL));
  if (!l) return;
  for (const sg of l) {
    if (!sg.on) continue;
    const vx = sg.bx - sg.ax, vz = sg.bz - sg.az;
    const len2 = vx * vx + vz * vz || 1;
    const t = clamp(((u.pos.x - sg.ax) * vx + (u.pos.z - sg.az) * vz) / len2, 0, 1);
    const px = sg.ax + vx * t, pz = sg.az + vz * t;
    const dx = u.pos.x - px, dz = u.pos.z - pz;
    const d = Math.hypot(dx, dz);
    const min = sg.t + 0.32;
    if (d < min && d > 0.0001) { u.pos.x = px + dx / d * min; u.pos.z = pz + dz / d * min; }
  }
}
// un segment de mur coupe-t-il la ligne entre deux points ? (sert à la vue des gardes)
function wallBetween(a, b) {
  for (const sg of wallSegs) {
    if (!sg.on) continue;
    if (Math.abs(sg.ax - a.x) > 40 && Math.abs(sg.bx - a.x) > 40) continue;
    const d1 = (b.x - a.x) * (sg.az - a.z) - (b.z - a.z) * (sg.ax - a.x);
    const d2_ = (b.x - a.x) * (sg.bz - a.z) - (b.z - a.z) * (sg.bx - a.x);
    const d3 = (sg.bx - sg.ax) * (a.z - sg.az) - (sg.bz - sg.az) * (a.x - sg.ax);
    const d4 = (sg.bx - sg.ax) * (b.z - sg.az) - (sg.bz - sg.az) * (b.x - sg.ax);
    if (d1 * d2_ < 0 && d3 * d4 < 0) return true;
  }
  return false;
}

// ---------- Construction ----------
const SERVICE_NAMES = { esclaves: 'Marché aux esclaves', auberge: 'Auberge', marche: 'Marché', bazar: 'Bazar', forge: 'Forge', tailleur: 'Tailleur', atelier: 'Menuisier', palais: 'Palais', caserne: 'Caserne', prison: 'Prison' };
const SERVICE_KEEPER = { esclaves: "Marchand d'esclaves", auberge: 'Aubergiste', marche: 'Marchand', bazar: 'Brocanteur', forge: 'Forgeron', tailleur: 'Tailleur', atelier: 'Menuisier', palais: 'Intendant', caserne: 'Sergent', prison: 'Geôlier' };

function buildSettlement(s) {
  const g = new T.Group();
  g.position.set(s.x, s.h, s.z);
  const rng = mulberry32(Math.round(s.x * 13 + s.z * 7));
  const ly = (lx, lz) => heightAt(s.x + lx, s.z + lz) - s.h;
  const fac = F(s.faction);
  Object.assign(s, { flags: [], stalls: [], services: [], blockers: [], buildings: [], cells: [], chests: [], homes: [] });
  const solid = m => { s.blockers.push(m); return m; };
  const box = (w, h, d, color, x = 0, y = 0, z = 0) => { const m = mesh(new T.BoxGeometry(w, h, d), color); m.position.set(x, y, z); return m; };
  const addFlag = (lx, lz, height) => {
    const fp = makeFlagPole(fac, height);
    fp.g.position.set(lx, ly(lx, lz), lz);
    g.add(fp.g);
    s.flags.push(fp.cloth);
  };
  const glow = (w, h, d, color, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshBasicMaterial({ color })); m.position.set(x, y, z); return m; };

  // Bâtiment creux : 4 murs, une porte devant (+z), un toit qui disparaît quand on est dedans
  function building(lx, lz, yaw, w, d, h, color, roofColor) {
    const b = new T.Group();
    b.position.set(lx, ly(lx, lz), lz);
    b.rotation.y = yaw;
    g.add(b);
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const W = (x, z) => ({ x: s.x + lx + x * c + z * sn, z: s.z + lz - x * sn + z * c });
    const seg = (x1, z1, x2, z2) => { const a = W(x1, z1), e = W(x2, z2); return addSeg(a.x, a.z, e.x, e.z); };
    const hw = w / 2, hd = d / 2, door = 1.9;
    b.add(box(w, 0.12, d, '#7a6248', 0, 0.06, 0));
    b.add(solid(box(w, h, 0.3, color, 0, h / 2, -hd)), solid(box(0.3, h, d, color, -hw, h / 2, 0)), solid(box(0.3, h, d, color, hw, h / 2, 0)));
    const side = (w - door) / 2;
    b.add(solid(box(side, h, 0.3, color, -hw + side / 2, h / 2, hd)), solid(box(side, h, 0.3, color, hw - side / 2, h / 2, hd)));
    b.add(box(door, h - 2.6, 0.3, color, 0, 2.6 + (h - 2.6) / 2, hd));
    seg(-hw, -hd, hw, -hd); seg(-hw, -hd, -hw, hd); seg(hw, -hd, hw, hd);
    seg(-hw, hd, -door / 2, hd); seg(door / 2, hd, hw, hd);
    const roof = new T.Group();
    const r = mesh(new T.ConeGeometry(Math.max(w, d) * 0.75, 2.2, 4), roofColor);
    r.rotation.y = Math.PI / 4; r.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d)); r.position.y = h + 1.1;
    roof.add(r, box(w + 0.4, 0.2, d + 0.4, roofColor, 0, h + 0.05, 0));
    b.add(roof);
    const info = { W, c: W(0, 0), yaw, hw, hd, roof, b };
    s.buildings.push(info);
    return { b, W, seg, info };
  }
  const local = (W, x, z) => W(x, z);
  const serviceRec = (type, W, sp, kp, keeperYaw, extra = {}) => {
    const keeper = genPerson(rng);
    const name = type === 'auberge' ? `Au ${rpick(rng, INN_A)} ${rpick(rng, INN_B)}`
      : type === 'palais' ? `Palais ${deN(s.name)}` : type === 'prison' ? `Prison ${deN(s.name)}`
      : type === 'caserne' ? `Caserne ${deN(s.name)}` : `${SERVICE_NAMES[type]} de ${keeper.split(' ')[0]}`;
    const p = local(W, sp[0], sp[1]), k = local(W, kp[0], kp[1]);
    const v = { type, name, keeper, x: p.x, z: p.z, kx: k.x, kz: k.z, yaw: keeperYaw, radius: 2.4, ...extra };
    s.services.push(v);
    return v;
  };
  const chest = (W, x, z, lock, kind, b, yawLocal = 0) => {
    const m = box(1.1, 0.7, 0.7, '#6b4a2b', x, 0.35, z);
    m.add(box(1.15, 0.12, 0.75, '#3a3a3a', 0, 0.12, 0));
    m.rotation.y = yawLocal;
    b.add(m);
    const p = W(x, z);
    const ch = { x: p.x, z: p.z, lock, kind, owner: s.name, coins: 0, items: [], goods: {}, refill: 0 };
    fillChest(ch);
    s.chests.push(ch);
    return ch;
  };
  const sign = (b, text, y) => { const sp = textSprite(text, 0.45, '#ffe9b8'); sp.position.set(0, y, 0); b.add(sp); };

  const ROOF = ['#7a4a2a', '#6e5538', '#5a4026', '#6e3a5a'];
  // chaque type de bâtiment : taille et aménagement intérieur
  const INTERIOR = {
    auberge: (w, d) => ({ w: 12, d: 9, h: 4.2, color: '#a3835a', fill: ({ b, W }) => {
      b.add(box(0.8, 1.1, 5, '#5a3a20', -3.4, 0.55, -1.2));
      for (let i = 0; i < 3; i++) b.add(box(1.2, 0.8, 1.2, '#6e5538', 2.2, 0.4, -2.6 + i * 2.6), box(0.5, 0.5, 0.5, '#5a4630', 3.3, 0.25, -2.6 + i * 2.6));
      for (let i = 0; i < 3; i++) b.add(box(1, 0.5, 2, '#c9b48a', -5 + i * 1.3 + 7.5, 0.25, -3.4).translateX(0));
      b.add(box(0.6, 1.6, 4, '#4a3020', -5.4, 0.8, -1.2));
      return { sp: [-2.4, -1.2], kp: [-4.6, -1.2], ky: Math.PI / 2 };
    } }),
    bazar: () => ({ w: 9, d: 7, h: 3.6, color: '#b39468', fill: ({ b }) => {
      b.add(box(5, 1.1, 0.8, '#5a3a20', 0, 0.55, -1.2));
      for (let i = 0; i < 4; i++) b.add(box(1.6, 2.2, 0.5, '#6e5538', -3 + i * 2, 1.1, -3.1), box(0.4, 0.3, 0.3, ['#b8452e', '#2e6db8', '#d1a12c', '#7a9a4a'][i], -3 + i * 2, 1.6, -2.85));
      return { sp: [0, -0.2], kp: [0, -2.2], ky: 0 };
    } }),
    forge: () => ({ w: 9, d: 7, h: 3.8, color: '#7a6243', fill: ({ b }) => {
      b.add(solid(box(2, 1.4, 1.6, '#5f5850', -2.8, 0.7, -2.2)), glow(1.2, 0.3, 1, '#ff7a2a', -2.8, 1.45, -2.1));
      b.add(box(0.8, 5, 0.8, '#4a4440', -2.8, 4, -2.6));
      b.add(box(0.9, 0.5, 0.4, '#3a3a3a', 0.6, 0.9, -1), box(0.4, 0.6, 0.3, '#5a4630', 0.6, 0.35, -1));
      for (let i = 0; i < 4; i++) b.add(box(0.08, 1, 0.08, '#c9ccd1', 3 + i * 0.25, 1.4, -3.2));
      return { sp: [0.6, 0.6], kp: [0.6, -2], ky: 0 };
    } }),
    tailleur: () => ({ w: 8, d: 6, h: 3.4, color: '#b8a07a', fill: ({ b }) => {
      b.add(box(4, 1, 0.8, '#5a3a20', 0, 0.5, -0.8));
      ['#b8452e', '#2e6db8', '#d1a12c', '#f2efe6', '#6b4a2b'].forEach((c2, i) => b.add(box(0.3, 1.4, 0.3, c2, -2.6 + i * 1.2, 0.7, -2.6)));
      return { sp: [0, 0.3], kp: [0, -1.8], ky: 0 };
    } }),
    atelier: () => ({ w: 8, d: 6, h: 3.4, color: '#8a6a48', fill: ({ b }) => {
      b.add(box(3, 0.9, 1.2, '#6e5538', 0, 0.45, -1));
      for (let i = 0; i < 3; i++) { const l = mesh(new T.CylinderGeometry(0.25, 0.25, 3, 6), '#7a5230'); l.rotation.z = Math.PI / 2; l.position.set(-2.4, 0.25 + i * 0.4, -2.4); b.add(l); }
      return { sp: [0, 0.4], kp: [0, -2.2], ky: 0 };
    } }),
    caserne: () => ({ w: 11, d: 8, h: 3.8, color: '#8d7350', fill: ({ b }) => {
      for (let i = 0; i < 4; i++) b.add(box(1, 0.5, 2, '#9a8a68', -4 + i * 2.6, 0.25, -2.6));
      b.add(box(2, 1, 1, '#5a3a20', 3.6, 0.5, 1.8));
      return { sp: [2.6, 1.8], kp: [4.2, 1], ky: -Math.PI / 2 };
    } }),
    palais: () => ({ w: 14, d: 11, h: 6, color: '#c9b48a', fill: ({ b, W }) => {
      b.add(box(1.6, 2.2, 1, '#b8932a', 0, 1.1, -4.6), box(2, 0.05, 9, '#8a1e1e', 0, 0.15, 0.3));
      for (const x of [-4, 4]) for (const z of [-3, 1]) b.add(box(0.6, 6, 0.6, '#e2d6b8', x, 3, z));
      const th = W(0, -3.6);
      s.throne = { x: th.x, z: th.z, yaw: 0 };
      return { sp: [-4.5, 3.5], kp: [-5.6, 2.4], ky: 0 };
    } }),
    prison: () => ({ w: 13, d: 10, h: 4, color: '#6f6a60', fill: ({ b, W, seg }) => {
      b.add(box(2.2, 1, 1, '#5a3a20', -4.6, 0.5, 2.6));
      // trois cellules contre le mur du fond
      for (let i = 0; i < 3; i++) {
        const cx = -4 + i * 4;
        const z0 = -5, z1 = -2;
        b.add(box(0.2, 3, 3, '#4a4440', cx - 2, 1.5, -3.5), box(0.2, 3, 3, '#4a4440', cx + 2, 1.5, -3.5));
        seg(cx - 2, z0, cx - 2, z1); seg(cx + 2, z0, cx + 2, z1);
        for (let k = 0; k < 9; k++) { const bx = cx - 2 + k * 0.5; if (Math.abs(bx - cx) > 0.6) b.add(box(0.06, 2.8, 0.06, '#2a2a2a', bx, 1.4, z1)); }
        seg(cx - 2, z1, cx - 0.65, z1); seg(cx + 0.65, z1, cx + 2, z1);
        const doorMesh = new T.Group();
        for (let k = 0; k < 3; k++) doorMesh.add(box(0.06, 2.8, 0.06, '#3a3a3a', -0.45 + k * 0.45, 1.4, 0));
        doorMesh.add(box(1.3, 0.08, 0.08, '#3a3a3a', 0, 2.5, 0));
        doorMesh.position.set(cx, 0, z1);
        b.add(doorMesh);
        const door = seg(cx - 0.65, z1, cx + 0.65, z1);
        const center = W(cx, -3.6), front = W(cx, -0.9);
        s.cells.push({ x: center.x, z: center.z, fx: front.x, fz: front.z, door, doorMesh, open: false, lock: 35 + Math.round(rng() * 25) });
      }
      chest(W, 5, 3.2, 45, 'confiscation', b);
      const board = box(2, 1.2, 0.05, '#c9b48a', 3.4, 2, 4.8);
      b.add(board);
      const gp = W(2.5, 1);
      s.prisonGuard = { x: gp.x, z: gp.z };
      return { sp: [-4.6, 3.8], kp: [-4.6, 1.6], ky: 0 };
    } }),
    maison: () => ({ w: 7, d: 6, h: 3, color: rng() < 0.5 ? '#b39468' : '#a3835a', fill: ({ b, W }) => {
      b.add(box(1, 0.5, 2, '#c9b48a', -2.2, 0.25, -1.6), box(1.2, 0.8, 1.2, '#6e5538', 1.6, 0.4, -1.2));
      chest(W, 2.4, -2.3, 20 + Math.round(rng() * 15), 'maison', b);
      return null;
    } }),
  };

  if (s.type === 'ville') {
    const segs = 48;
    const segLen = 2 * Math.PI * s.r / segs + 0.4;
    for (let i = 0; i < segs; i++) {
      const a = i / segs * Math.PI * 2;
      if (Math.abs(angleDiff(a, s.gate)) < 0.14) continue;
      const wx = Math.cos(a) * s.r, wz = Math.sin(a) * s.r;
      const w = mesh(new T.BoxGeometry(segLen, 5, 1.2), '#8d7350');
      w.position.set(wx, ly(wx, wz) + 2, wz);
      w.rotation.y = -a - Math.PI / 2;
      g.add(solid(w));
    }
    for (const sd of [-1, 1]) {
      const a = s.gate + sd * 0.17;
      const tx = Math.cos(a) * s.r, tz = Math.sin(a) * s.r;
      const tower = mesh(new T.CylinderGeometry(1.8, 2.1, 8, 8), '#7a6243');
      tower.position.set(tx, ly(tx, tz) + 4, tz);
      g.add(solid(tower));
      addFlag(tx, tz, 11);
    }
    const types = ['auberge', 'bazar', 'forge', 'tailleur', 'atelier', 'prison', s.capital ? 'palais' : 'caserne'];
    const angles = [];
    types.forEach((t, i) => {
      const a = s.gate + Math.PI + (i - 3) * 0.82;
      angles.push(a);
      const spec = INTERIOR[t]();
      const r = 21;
      const lx = Math.cos(a) * r, lz = Math.sin(a) * r;
      const yaw = Math.atan2(-Math.cos(a), -Math.sin(a));
      const bld = building(lx, lz, yaw, spec.w, spec.d, spec.h, spec.color, rpick(rng, ROOF));
      const f = spec.fill(bld);
      const v = serviceRec(t, bld.W, f.sp, f.kp, yaw + f.ky);
      sign(bld.b, v.name, spec.h + 3);
    });
    // maisons sur l'anneau extérieur
    const houses = [];
    let tries = 0;
    while (houses.length < 9 && tries++ < 300) {
      const a = rng() * Math.PI * 2, r = 33 + rng() * 3;
      if (Math.abs(angleDiff(a, s.gate)) < 0.4) continue;
      const hx = Math.cos(a) * r, hz = Math.sin(a) * r;
      if (houses.some(o => Math.hypot(o.x - hx, o.z - hz) < 10)) continue;
      houses.push({ x: hx, z: hz });
      const spec = INTERIOR.maison();
      const yaw = Math.atan2(-Math.cos(a), -Math.sin(a));
      const bld = building(hx, hz, yaw, spec.w, spec.d, spec.h, spec.color, rpick(rng, ROOF));
      spec.fill(bld);
      const door = bld.W(0, 4), bed = bld.W(-2.2, -1.6);
      s.homes.push({ door, bed });
    }
    addFlag(4, -4, 14);
    if (fac.slavery) slaveMarket(s, g, ly, rng, s.gate + 0.9, 12);
  } else if (s.type === 'camp') {
    const n = Math.round(2 * Math.PI * s.r / 1.3);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      if (Math.abs(angleDiff(a, s.gate)) < 0.22) continue;
      const px = Math.cos(a) * s.r, pz = Math.sin(a) * s.r;
      const stake = mesh(new T.CylinderGeometry(0.25, 0.3, 3.2, 5), '#6e5538');
      stake.position.set(px, ly(px, pz) + 1.6, pz);
      g.add(solid(stake));
    }
    const types = ['auberge', 'bazar', 'forge', 'tailleur', 'atelier', 'caserne'];
    types.forEach((t, i) => {
      const a = s.gate + Math.PI + (i - 2.5) * 0.95;
      const r = 14, lx = Math.cos(a) * r, lz = Math.sin(a) * r;
      const yaw = Math.atan2(-Math.cos(a), -Math.sin(a));
      const tb = new T.Group();
      tb.position.set(lx, ly(lx, lz), lz); tb.rotation.y = yaw; g.add(tb);
      const size = t === 'auberge' ? 8 : 6;
      if (t === 'forge') tb.add(box(0.9, 0.5, 0.4, '#3a3a3a', 0, 0.9, 0), glow(0.8, 0.6, 0.8, '#ff8a3c', -1.6, 0.3, 0));
      else { const tent = mesh(new T.ConeGeometry(size * 0.55, size * 0.6, 6), t === 'auberge' ? fac.colors[0] : rpick(rng, [fac.colors[1], '#a8743a', '#c9b48a'])); tent.position.y = size * 0.3; tb.add(solid(tent)); addObstacle(s.x + lx, s.z + lz, size * 0.5); }
      const c = Math.cos(yaw), sn = Math.sin(yaw);
      const W = (x, z) => ({ x: s.x + lx + x * c + z * sn, z: s.z + lz - x * sn + z * c });
      const front = t === 'forge' ? 1.6 : size * 0.55 + 1;
      const v = serviceRec(t, W, [0, front + 0.8], [0, front], yaw);
      sign(tb, v.name, size * 0.6 + 2);
    });
    makeCage(s, g, ly, rng, 0, -9, 30);
    if (fac.slavery) slaveMarket(s, g, ly, rng, s.gate + 0.9, 8);
    addFlag(4, -4, 9);
  } else {
    // repaire : huttes, totems, feu, cage à prisonniers
    const cann = fac.culture === 'cannibale';
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + rng(), r = 9 + rng() * 5;
      const hx = Math.cos(a) * r, hz = Math.sin(a) * r;
      const hut = mesh(new T.ConeGeometry(2.4, 3, 6), cann ? '#4a3a2a' : '#5a4a3a');
      hut.position.set(hx, ly(hx, hz) + 1.5, hz);
      g.add(solid(hut));
      addObstacle(s.x + hx, s.z + hz, 2.2);
    }
    for (let i = 0; i < 5; i++) {
      const a = rng() * Math.PI * 2, r = 4 + rng() * 10, tx = Math.cos(a) * r, tz = Math.sin(a) * r;
      g.add(box(0.15, 2.6, 0.15, '#4a3826', tx, ly(tx, tz) + 1.3, tz), box(0.3, 0.3, 0.3, '#e8e0d0', tx, ly(tx, tz) + 2.7, tz));
    }
    g.add(glow(1.2, 1, 1.2, '#ff7a2a', 0, ly(0, 0) + 0.5, 0));
    if (cann) for (let i = 0; i < 8; i++) g.add(box(0.5, 0.12, 0.12, '#efe8d8', rand(-2, 2), ly(0, 0) + 0.06, rand(-2, 2)));
    makeCage(s, g, ly, rng, 5, 5, cann ? 25 : 30);
    addFlag(3, -3, 6);
  }
  // marché en plein air au centre
  if (s.type !== 'repaire') {
    const clothes = ['#b8452e', '#2e6db8', '#d1a12c'];
    const nst = s.type === 'ville' ? 3 : 2;
    for (let i = 0; i < nst; i++) {
      const a = s.gate + (i - (nst - 1) / 2) * 1.1;
      const sx = Math.cos(a) * 5, sz = Math.sin(a) * 5;
      const stall = new T.Group();
      stall.position.set(sx, ly(sx, sz), sz);
      stall.rotation.y = -a + Math.PI / 2;
      stall.add(box(2.4, 0.9, 1.2, '#6e5538', 0, 0.45, 0), box(3, 0.1, 2, clothes[i], 0, 2.3, 0));
      for (const [px, pz] of [[-1.3, -0.8], [1.3, -0.8], [-1.3, 0.8], [1.3, 0.8]]) stall.add(box(0.1, 2.3, 0.1, '#4a3826', px, 1.15, pz));
      g.add(stall);
      addObstacle(s.x + sx, s.z + sz, 1.4);
      s.stalls.push({ x: s.x + Math.cos(a) * 3.4, z: s.z + Math.sin(a) * 3.4, yaw: Math.atan2(Math.cos(a), Math.sin(a)) });
    }
    s.services.push({ type: 'marche', name: `Marché ${deN(s.name)}`, keeper: genPerson(rng), x: s.x, z: s.z, yaw: 0, radius: 6 });
  }
  const label = textSprite(s.name);
  label.position.y = s.type === 'ville' ? 22 : 14;
  g.add(label);
  worldGroup.add(g);
  s.root = g;
}

// cage à prisonniers en plein air (camps et repaires)
function makeCage(s, g, ly, rng, lx, lz, lock) {
  const W = (x, z) => ({ x: s.x + lx + x, z: s.z + lz + z });
  const cg = new T.Group();
  cg.position.set(lx, ly(lx, lz), lz);
  const bar = (x, z) => { const m = new T.Mesh(new T.BoxGeometry(0.08, 2.6, 0.08), mat('#4a3826')); m.position.set(x, 1.3, z); cg.add(m); };
  for (let k = 0; k <= 6; k++) { bar(-1.5 + k * 0.5, -1.5); bar(-1.5, -1.5 + k * 0.5); bar(1.5, -1.5 + k * 0.5); }
  bar(-1.5, 1.5); bar(-1, 1.5); bar(1, 1.5); bar(1.5, 1.5);
  const roof = new T.Mesh(new T.BoxGeometry(3.2, 0.12, 3.2), mat('#5a4630')); roof.position.y = 2.65; cg.add(roof);
  const doorMesh = new T.Group();
  for (let k = 0; k < 3; k++) { const m = new T.Mesh(new T.BoxGeometry(0.08, 2.6, 0.08), mat('#3a2a1a')); m.position.set(-0.5 + k * 0.5, 1.3, 0); doorMesh.add(m); }
  doorMesh.position.set(0, 0, 1.5);
  cg.add(doorMesh);
  g.add(cg);
  const P = (x, z) => W(x, z);
  const sg = (a, b) => addSeg(P(...a).x, P(...a).z, P(...b).x, P(...b).z, 0.15);
  sg([-1.5, -1.5], [1.5, -1.5]); sg([-1.5, -1.5], [-1.5, 1.5]); sg([1.5, -1.5], [1.5, 1.5]);
  sg([-1.5, 1.5], [-0.75, 1.5]); sg([0.75, 1.5], [1.5, 1.5]);
  const door = sg([-0.75, 1.5], [0.75, 1.5]);
  const c = W(0, 0), f = W(0, 2.6);
  const cell = { x: c.x, z: c.z, fx: f.x, fz: f.z, door, doorMesh, open: false, lock, cage: true };
  s.cells.push(cell);
  return cell;
}

// marché aux esclaves : une cage et son marchand, près de la place
function slaveMarket(s, g, ly, rng, a, r) {
  const lx = Math.cos(a) * r, lz = Math.sin(a) * r;
  const cell = makeCage(s, g, ly, rng, lx, lz, 45);
  cell.market = true;
  const kx = s.x + lx + Math.cos(a) * 0, kz = s.z + lz + 3.4;
  s.services.push({ type: 'esclaves', name: `Marché aux esclaves ${deN(s.name)}`, keeper: genPerson(rng), x: kx, z: kz + 0.8, kx, kz, yaw: 0, radius: 2.4 });
}

function fillChest(ch) {
  ch.refill = 2;
  if (ch.kind === 'confiscation') return;
  const rich = { palais: 1, maison: 0.15 }[ch.kind] || 0.3;
  ch.coins = randInt(10, 60) + Math.round(rand(100, 500) * rich);
  ch.items = [];
  ch.goods = {};
  if (Math.random() < 0.5) ch.items.push(pick(['dague', 'sabre', 'tunique', 'capuche', 'cuir', 'casque_cuir']) + (Math.random() < 0.3 ? '#2' : ''));
  if (Math.random() < 0.5) ch.goods[pick(['food', 'cloth', 'spices', 'salt'])] = randInt(1, 5);
}

// le toit d'un bâtiment disparaît quand quelqu'un de ton escouade est dedans
function insideBuilding(info, p) {
  const dx = p.x - info.c.x, dz = p.z - info.c.z;
  const c = Math.cos(info.yaw), sn = Math.sin(info.yaw);
  const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
  return Math.abs(lx) < info.hw && Math.abs(lz) < info.hd;
}
function updateRoofs() {
  if (!player) return;
  for (const s of state.settlements) {
    if (!s.buildings || d2(s, player.pos) > s.r + 30) continue;
    for (const bl of s.buildings) bl.roof.visible = !team().some(u => !u.dead && d2(u.pos, bl.c) < 9 && insideBuilding(bl, u.pos));
  }
}
const serviceAt = (p, s) => {
  if (!s) return null;
  let best = null, bd = Infinity;
  for (const v of s.services) {
    const d = Math.hypot(p.x - v.x, p.z - v.z);
    if (d < (v.radius || 2.4) && d < bd) { bd = d; best = v; }
  }
  return best;
};
