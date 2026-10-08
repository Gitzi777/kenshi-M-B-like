// Terres Arides — ta faction, ta base (construction) et tes villes.
'use strict';

// ---------- Fonder sa faction ----------
const EMBLEM_NAMES = { coin: 'Pièce', hammer: 'Marteau', sun: 'Soleil', crescent: 'Croissant', skull: 'Crâne', star: 'Étoile', tower: 'Tour', eye: 'Œil', swords: 'Épées', triangle: 'Triangle' };
const PF_COLORS = ['#3d5a7a', '#7a2e2e', '#2e5a3a', '#6a4a8a', '#8a6a2a', '#2a2a2a', '#c9b48a', '#2e6a6a'];
const isPF = f => f && f.isPlayer;
function playerFaction() { return state.factions.player || null; }
function foundFaction(name, c0, c1, emblem) {
  if (playerFaction()) return playerFaction();
  const f = {
    id: 'player', isPlayer: true, name, art: 'la', of: `de la ${name}`, gov: 'Compagnie', culture: 'guerrier', place: null,
    map: c0, colors: [c0, c1, '#f2ead8'], flag: { pattern: 'bicolor-v', emblem: emblem || 'star' },
    leader: player.name, outfit: { body: c0, pants: '#2d2419', tabard: true },
    troops: JSON.parse(JSON.stringify(CULTURES.guerrier.troops)), shop: [...CULTURES.guerrier.shop], alive: true, founded: state.day, slavery: false, generals: [],
  };
  state.factions.player = f;
  // les drapeaux de tes exploitations prennent tes couleurs
  Object.assign(PLAYER_FLAG, { colors: f.colors, flag: f.flag, name });
  delete PLAYER_FLAG._flagTex;
  for (const n of state.nodes) refreshNodeFlag(n);
  addChronicle(`${player.name} fonde ${f.name}.`, '🏴');
  logMsg(`🏴 Tu fondes ${f.name} !`, 'news');
  return f;
}

// ---------- Constructions ----------
const STRUCTS = {
  palissade: { name: 'Palissade', cost: { wood: 3 }, time: 6, w: 4, d: 0.6, wall: true },
  porte: { name: 'Porte de palissade', cost: { wood: 4 }, time: 6, w: 4, d: 0.6, wall: true, gap: true },
  tour: { name: 'Tour de guet', cost: { wood: 8, iron: 2 }, time: 16, w: 3, d: 3 },
  maison: { name: 'Maison (lits, repos)', cost: { wood: 14, iron: 3 }, time: 28, w: 6, d: 6, house: true },
  forge: { name: 'Forge', cost: { wood: 6, iron: 6 }, time: 16, w: 3, d: 3, station: 'forge' },
  atelier: { name: 'Établi de menuisier', cost: { wood: 8 }, time: 10, w: 3, d: 2, station: 'atelier' },
  tailleur: { name: 'Table de tailleur', cost: { wood: 5, cloth: 4 }, time: 10, w: 3, d: 2, station: 'tailleur' },
  coffre: { name: 'Entrepôt (caisses)', cost: { wood: 4 }, time: 5, w: 1.6, d: 1.6 },
  champ: { name: 'Champ (vivres)', cost: { wood: 4 }, time: 12, w: 9, d: 9, field: true },
  feu: { name: 'Feu de camp', cost: { wood: 2 }, time: 3, w: 1.6, d: 1.6, fire: true },
  etendard: { name: 'Étendard', cost: { wood: 2, cloth: 2 }, time: 5, w: 1, d: 1, flag: true },
};
const costTxt = c => Object.entries(c).map(([g, n]) => `${n} ${GOODS[g].icon}`).join(' ');
const canPay = c => Object.entries(c).every(([g, n]) => (state.goods[g] || 0) >= n);
function pay(c) { for (const [g, n] of Object.entries(c)) state.goods[g] -= n; }

// modèle 3D d'une construction (achevée ou en chantier)
function structModel(st, done) {
  const S = STRUCTS[st.type];
  const g = new T.Group();
  const add = (geo, color, x, y, z, tex) => { const m = mesh(geo, color, true, tex); m.position.set(x, y, z); g.add(m); return m; };
  const stake = (x, z, h = 2.6) => { const m = add(new T.CylinderGeometry(0.16, 0.2, h, 6), '#7a5a38', x, h / 2, z, 'wood'); const t = new T.Mesh(new T.ConeGeometry(0.16, 0.4, 6), mat('#6a4a2a')); t.position.set(x, h + 0.2, z); g.add(t); return m; };
  if (!done) {
    // chantier : poutres et cordes
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new T.BoxGeometry(0.15, 2.2, 0.15), '#9a7a50', x * S.w / 2.2, 1.1, z * S.d / 2.2, 'wood');
    add(new T.BoxGeometry(S.w, 0.12, 0.12), '#9a7a50', 0, 2.1, S.d / 2.2, 'wood');
    add(new T.BoxGeometry(S.w, 0.12, 0.12), '#9a7a50', 0, 2.1, -S.d / 2.2, 'wood');
    add(new T.BoxGeometry(1.2, 0.5, 0.8), '#8a6a40', S.w * 0.3, 0.25, 0, 'wood');
    return g;
  }
  switch (st.type) {
    case 'palissade': for (let i = 0; i < 9; i++) stake(-1.8 + i * 0.45, 0, 2.4 + (i % 3) * 0.2); add(new T.BoxGeometry(4, 0.12, 0.1), '#5a4030', 0, 1.6, 0.2, 'wood'); break;
    case 'porte': for (const x of [-1.9, -1.5, 1.5, 1.9]) stake(x, 0, 3.2); add(new T.BoxGeometry(4.2, 0.3, 0.3), '#5a4030', 0, 3.1, 0, 'wood'); break;
    case 'tour': {
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new T.CylinderGeometry(0.15, 0.18, 6, 6), '#6a4a2a', x * 1.2, 3, z * 1.2, 'wood');
      add(new T.BoxGeometry(3, 0.2, 3), '#7a5a38', 0, 4.8, 0, 'wood');
      for (const [x, z, w, d] of [[0, -1.45, 3, 0.1], [0, 1.45, 3, 0.1], [-1.45, 0, 0.1, 3], [1.45, 0, 0.1, 3]]) add(new T.BoxGeometry(w, 0.8, d), '#7a5a38', x, 5.3, z, 'wood');
      const r = add(new T.ConeGeometry(2.4, 1.6, 4), '#6a3a26', 0, 7.2, 0, 'tiles'); r.rotation.y = Math.PI / 4;
      for (const x of [-1.2, 1.2]) add(new T.CylinderGeometry(0.08, 0.08, 1.6, 4), '#6a4a2a', x, 6.1, 1.2);
      break;
    }
    case 'maison': {
      if (ASSETS.ready && ASSETS.village) {
        const kit = buildHouseModel(6, 6, 3.3, mulberry32(Math.round(st.x * 7 + st.z * 13)), 'Plaster');
        for (const m of kit.walls) g.add(m);
        const roof = new T.Group(); for (const m of kit.roof) roof.add(m); g.add(roof); g.userData.roof = roof;
      } else {
        add(new T.BoxGeometry(6, 3.2, 6), '#b8a080', 0, 1.6, 0, 'plaster');
        const r = add(new T.ConeGeometry(4.6, 2.2, 4), '#7a3a26', 0, 4.3, 0, 'tiles'); r.rotation.y = Math.PI / 4;
      }
      for (const x of [-1.8, 1.8]) { add(new T.BoxGeometry(1, 0.4, 2), '#8a6a48', x, 0.3, -1.5, 'wood'); add(new T.BoxGeometry(0.9, 0.12, 1.8), '#e8dcc0', x, 0.55, -1.5); }
      break;
    }
    case 'forge':
      add(new T.BoxGeometry(1.6, 1.2, 1.4), '#5f5850', -0.6, 0.6, -0.5, 'stone');
      add(new T.BoxGeometry(0.9, 0.5, 0.4), '#3a3a3a', 0.9, 0.85, 0.4);
      add(new T.BoxGeometry(0.4, 0.6, 0.3), '#5a4630', 0.9, 0.3, 0.4, 'wood');
      if (ASSETS.ready && ASSETS.village) { const c = villageProp('Prop_Chimney', 0.8); c.position.set(-0.6, 1.2, -0.5); g.add(c); }
      { const fire = new T.Mesh(new T.BoxGeometry(0.8, 0.3, 0.8), new T.MeshBasicMaterial({ color: '#ff8a3c' })); fire.position.set(-0.6, 1.25, -0.2); g.add(fire); }
      break;
    case 'atelier':
      add(new T.BoxGeometry(2.4, 0.9, 1.1), '#7a5a38', 0, 0.45, 0, 'wood');
      for (let i = 0; i < 3; i++) { const l = add(new T.CylinderGeometry(0.2, 0.2, 2.4, 6), '#8a5a30', 0, 0.2 + i * 0.36, -1); l.rotation.z = Math.PI / 2; }
      break;
    case 'tailleur':
      add(new T.BoxGeometry(2.4, 0.9, 1.1), '#7a5a38', 0, 0.45, 0, 'wood');
      ['#b8452e', '#2e6db8', '#d1a12c', '#f2efe6'].forEach((c, i) => add(new T.CylinderGeometry(0.15, 0.15, 1, 8), c, -0.9 + i * 0.6, 1.4, 0).rotation.x = Math.PI / 2);
      break;
    case 'coffre':
      if (ASSETS.ready && ASSETS.village) { for (const [x, z, s] of [[0, 0, 0.9], [0.9, 0.3, 0.7], [0.3, 0.9, 0.6]]) { const c = villageProp('Prop_Crate', s); c.position.set(x - 0.4, 0, z - 0.4); g.add(c); } }
      else add(new T.BoxGeometry(1.2, 1, 1.2), '#8a6a40', 0, 0.5, 0, 'wood');
      break;
    case 'champ':
      for (let i = 0; i < 6; i++) add(new T.BoxGeometry(8.4, 0.35, 0.8), '#6a8a3a', 0, 0.18, -3.6 + i * 1.45);
      for (let i = 0; i < 6; i++) for (let k = 0; k < 8; k++) add(new T.ConeGeometry(0.22, 0.7, 5), '#c9b040', -3.6 + k * 1.03, 0.6, -3.6 + i * 1.45);
      break;
    case 'feu': {
      for (let i = 0; i < 5; i++) { const l = add(new T.CylinderGeometry(0.08, 0.08, 1, 5), '#5a3a20', 0, 0.15, 0); l.rotation.set(Math.PI / 2, i * 1.25, 0); }
      for (let i = 0; i < 8; i++) add(new T.DodecahedronGeometry(0.18, 0), '#6a6460', Math.cos(i * 0.8) * 0.6, 0.1, Math.sin(i * 0.8) * 0.6);
      const fl = new T.Mesh(new T.ConeGeometry(0.3, 0.8, 6), new T.MeshBasicMaterial({ color: '#ffb347' })); fl.position.y = 0.5; g.add(fl); g.userData.flame = fl;
      break;
    }
    case 'etendard': {
      const pf = playerFaction() || PLAYER_FLAG;
      const fp = makeFlagPole(pf, 6);
      g.add(fp.g);
      g.userData.cloth = fp.cloth;
      break;
    }
  }
  return g;
}

// ---------- Ta base ----------
function baseSettlement() { return state.base ? settlementByName(state.base.name) : null; }
function createBase(name, x, z) {
  const g = new T.Group();
  worldGroup.add(g);
  const s = {
    name, x, z, faction: 'player', type: 'base', r: 24, capital: false, pop: 6, garrison: 0, guards: [], civilians: [],
    stock: Object.fromEntries(TRADE_GOODS.map(t => [t, 0])), hist: {}, h: heightAt(x, z), gate: Math.atan2(-z, -x), biome: biomeAt(x, z),
    flags: [], stalls: [], services: [], blockers: [], buildings: [], cells: [], chests: [], homes: [], root: g, civMat: true, guardsMat: false,
  };
  state.settlements.push(s);
  state.base = state.base || { name, x, z, structs: [] };
  return s;
}
// la base grandit avec ses constructions
function refreshBaseBounds() {
  const s = baseSettlement();
  if (!s || !state.base.structs.length) return;
  let cx = 0, cz = 0;
  for (const st of state.base.structs) { cx += st.x; cz += st.z; }
  cx /= state.base.structs.length; cz /= state.base.structs.length;
  let r = 14;
  for (const st of state.base.structs) r = Math.max(r, Math.hypot(st.x - cx, st.z - cz) + 6);
  s.x = cx; s.z = cz; s.r = Math.min(60, r);
  state.base.x = cx; state.base.z = cz;
}
function placeStruct(type, x, z, yaw, done = false) {
  const s = baseSettlement();
  const st = { id: uid(), type, x, z, yaw, progress: done ? 1 : 0, done };
  state.base.structs.push(st);
  realizeStruct(st);
  refreshBaseBounds();
  return st;
}
function realizeStruct(st) {
  const s = baseSettlement();
  if (st.mesh) { s.root.remove(st.mesh); }
  const m = structModel(st, st.done);
  m.position.set(st.x, heightAt(st.x, st.z), st.z);
  m.rotation.y = st.yaw;
  s.root.add(m);
  st.mesh = m;
  const S = STRUCTS[st.type];
  if (st.done && !st.collided) {
    st.collided = true;
    const c = Math.cos(st.yaw), sn = Math.sin(st.yaw);
    const W = (lx, lz) => ({ x: st.x + lx * c + lz * sn, z: st.z - lx * sn + lz * c });
    const seg = (x1, z1, x2, z2) => { const a = W(x1, z1), b = W(x2, z2); addSeg(a.x, a.z, b.x, b.z); };
    if (S.wall && !S.gap) seg(-2, 0, 2, 0);
    else if (S.gap) { seg(-2, 0, -1.3, 0); seg(1.3, 0, 2, 0); }
    else if (S.house) {
      const hw = 3, hd = 3, door = 1.9;
      seg(-hw, -hd, hw, -hd); seg(-hw, -hd, -hw, hd); seg(hw, -hd, hw, hd); seg(-hw, hd, -door / 2, hd); seg(door / 2, hd, hw, hd);
      const info = { W, c: W(0, 0), yaw: st.yaw, hw, hd, roof: m.userData.roof || new T.Group(), b: m };
      s.buildings.push(info);
      s.homes.push({ door: W(0, hd + 1), info });
      s.blockers.push(...m.children.filter(o => o.isMesh));
    } else if (S.station) {
      s.services.push({ type: S.station, name: `${S.name} (${s.name})`, keeper: player.name, x: st.x, z: st.z, kx: st.x, kz: st.z, yaw: st.yaw, radius: 2.8, own: true });
      addObstacle(st.x, st.z, 1.1);
    } else if (!S.field) addObstacle(st.x, st.z, Math.max(S.w, S.d) * 0.45);
    if (S.flag) s.flags.push(m.userData.cloth);
  }
}

// ---------- Mode construction (touche B) ----------
const build = { type: null, yaw: 0, ghost: null, ok: false };
function startPlacing(type) {
  closePanel();
  build.type = type; build.yaw = player.yaw;
  if (build.ghost) scene.remove(build.ghost);
  build.ghost = structModel({ type }, true);
  build.ghost.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; o.material.depthWrite = false; o.castShadow = false; } });
  scene.add(build.ghost);
  logMsg(`🔨 ${STRUCTS[type].name} : clic pour poser, R pour tourner, Échap pour annuler.`);
}
function stopPlacing() { if (build.ghost) scene.remove(build.ghost); build.ghost = null; build.type = null; }
function placementSpot() {
  if (isFollow() && mouse.ground) return { x: mouse.ground.x, z: mouse.ground.z };
  return { x: player.pos.x + Math.sin(player.yaw) * 5, z: player.pos.z + Math.cos(player.yaw) * 5 };
}
function updatePlacing() {
  if (!build.type || !build.ghost) return;
  const p = placementSpot();
  const S = STRUCTS[build.type];
  // trop près d'une ville, d'une exploitation ou trop loin de toi : interdit
  const town = state.settlements.find(s => s.type !== 'base' && Math.hypot(s.x - p.x, s.z - p.z) < s.r + 25);
  const node = state.nodes.find(n => Math.hypot(n.x - p.x, n.z - p.z) < 16);
  const far = Math.hypot(p.x - player.pos.x, p.z - player.pos.z) > 25;
  const bs = baseSettlement();
  const tooFarFromBase = bs && Math.hypot(bs.x - p.x, bs.z - p.z) > 90;
  build.ok = !town && !node && !far && !tooFarFromBase && canPay(S.cost);
  build.why = town ? 'trop près d\'une ville' : node ? 'trop près d\'une exploitation' : far ? 'trop loin de toi' : tooFarFromBase ? 'trop loin de ta base' : !canPay(S.cost) ? `il manque des matériaux (${costTxt(S.cost)})` : '';
  build.ghost.position.set(p.x, heightAt(p.x, p.z), p.z);
  build.ghost.rotation.y = build.yaw;
  build.ghost.traverse(o => { if (o.isMesh) o.material.color.setRGB(build.ok ? 0.6 : 1, build.ok ? 1 : 0.4, build.ok ? 0.6 : 0.4); });
}
function confirmPlacing() {
  if (!build.type) return false;
  if (!build.ok) { logMsg(`Impossible ici : ${build.why}.`, 'warn'); sfx('fail', null, 0.6); return true; }
  const p = placementSpot();
  if (!state.base) {
    const s = createBase(state.pendingBaseName || `Fort ${player.name}`, p.x, p.z);
    addChronicle(`${player.name} pose les premières pierres de ${s.name}.`, '🏗');
  }
  pay(STRUCTS[build.type].cost);
  placeStruct(build.type, p.x, p.z, build.yaw);
  sfx('thunk', p);
  burst({ x: p.x, y: heightAt(p.x, p.z) + 0.2, z: p.z }, { n: 12, color: ['#c9b48a', '#a8916a'], speed: 2, up: 1, life: 0.8, size: 0.14, grav: 1, grow: 2 });
  if (!canPay(STRUCTS[build.type].cost)) stopPlacing();
  return true;
}

// ---------- Chantiers : ton escouade construit ----------
function unfinished() { return state.base ? state.base.structs.filter(st => !st.done) : []; }
function updateBase(dt) {
  if (!state.base) return;
  const s = baseSettlement();
  for (const st of unfinished()) {
    const builders = team().filter(u => alive(u) && !u.jailed && Math.hypot(u.pos.x - st.x, u.pos.z - st.z) < Math.max(STRUCTS[st.type].w, STRUCTS[st.type].d) * 0.6 + 2.5 && !u.atk && (u.isPlayer ? !(keys.KeyW || keys.KeyS) : true));
    if (!builders.length) continue;
    for (const u of builders) { u.working = true; u.yaw = turnToward(u.yaw, Math.atan2(st.x - u.pos.x, st.z - u.pos.z), dt * 5); trainSkill(u, 'bois', dt * 0.05); }
    st.progress += dt * builders.reduce((a, u) => a + 1 + sk(u, 'bois') / 80, 0) / STRUCTS[st.type].time;
    if (Math.random() < dt * 2) sfx('thunk', st, 0.4);
    if (st.progress >= 1) {
      st.done = true;
      realizeStruct(st);
      for (const u of builders) u.working = false;
      logMsg(`🏗 ${STRUCTS[st.type].name} terminé(e) !`, 'news');
      sfx('skill', null, 0.5);
    }
  }
  // flammes des feux de camp
  for (const st of state.base.structs) if (st.done && st.mesh.userData.flame) { const f = st.mesh.userData.flame; f.scale.set(1 + Math.sin(gfxTime.value * 13 + st.x) * 0.15, 1 + Math.sin(gfxTime.value * 17) * 0.25, 1); }
  // les champs nourrissent la base
  state.baseTimer = (state.baseTimer || 0) + dt;
  if (state.baseTimer > DAY_LENGTH / 4) {
    state.baseTimer = 0;
    const fields = state.base.structs.filter(st => st.done && st.type === 'champ').length;
    if (fields) { state.goods.food += fields * 2; logMsg(`🌾 Tes champs donnent ${fields * 2} vivres.`); }
  }
}
// les membres de l'escouade inoccupés vont aider sur les chantiers proches
function squadBuildTask(u, dt) {
  if (!state.base || u.target || state.order === 'charge') return false;
  const sites = unfinished().filter(st => Math.hypot(st.x - u.pos.x, st.z - u.pos.z) < 45 && Math.hypot(st.x - player.pos.x, st.z - player.pos.z) < 45);
  if (!sites.length) return false;
  const st = sites.sort((a, b) => Math.hypot(a.x - u.pos.x, a.z - u.pos.z) - Math.hypot(b.x - u.pos.x, b.z - u.pos.z))[0];
  const S = STRUCTS[st.type];
  const r = Math.max(S.w, S.d) * 0.6 + 1.5;
  const a = (u.id % 6) / 6 * Math.PI * 2;
  const tx = st.x + Math.cos(a) * r, tz = st.z + Math.sin(a) * r;
  if (Math.hypot(tx - u.pos.x, tz - u.pos.z) > 1) steer(u, tx, tz, dt, 1.2, 0.5);
  else u.moving = 0;
  return true;
}

// ---------- Panneau : faction, base, constructions ----------
function renderBuild() {
  const f = playerFaction();
  let body = '';
  if (!f) {
    body = `<p class="note">Fonde ta propre faction pour bâtir une base, prendre des villes et lever ton étendard.</p>
      <label class="row">Nom de ta faction <input id="pfName" maxlength="28" value="Compagnie ${esc(deN(player.name))}"></label>
      <div class="label">Couleur principale</div><div class="swatches" id="pfC0">${PF_COLORS.map((c, i) => `<div class="swatch ${i === 0 ? 'sel' : ''}" data-c0="${c}" style="background:${c}"></div>`).join('')}</div>
      <div class="label">Couleur secondaire</div><div class="swatches" id="pfC1">${PF_COLORS.map((c, i) => `<div class="swatch ${i === 6 ? 'sel' : ''}" data-c1="${c}" style="background:${c}"></div>`).join('')}</div>
      <div class="label">Emblème</div><div class="swatches">${FLAG_EMBLEMS.map((e, i) => `<button class="${i === 0 ? 'on' : ''}" data-emb="${e}">${EMBLEM_NAMES[e] || e}</button>`).join('')}</div>
      <button class="big" data-found>Fonder ma faction</button>`;
  } else {
    const s = baseSettlement();
    const towns = state.settlements.filter(t => t.faction === 'player' && t.type !== 'base');
    body = `<div class="fhead">${flagImg(f, 28)}<div><h3>${esc(f.name)}</h3><small>Chef : ${esc(player.name)} · ${towns.length} ville(s)${s ? ' · base : ' + esc(s.name) : ''}</small></div></div>
      ${!state.base ? `<label class="row">Nom de ta future base <input id="baseName" maxlength="24" value="${esc(state.pendingBaseName || 'Fort ' + player.name)}"></label>` : ''}
      <h4>Construire</h4>
      <p class="note">Choisis un plan, place-le dehors (loin des villes), puis reste à côté : toi et ton escouade construisez. Bois, fer et tissu s'achètent ou se récoltent.</p>
      <div class="items">${Object.entries(STRUCTS).map(([k, S]) => `<div class="item"><span><b>${S.name}</b><small>${costTxt(S.cost)}</small></span>
        <button data-place="${k}" ${canPay(S.cost) ? '' : 'disabled'}>Construire</button></div>`).join('')}</div>
      ${s ? `<h4>Garnison de la base</h4><p class="note">${s.garrison} garde(s). Ils défendent la base quand tu pars.</p>
        <button data-hire ${state.money < 100 ? 'disabled' : ''}>Engager un garde (100 💰)</button>` : ''}
      ${towns.length ? `<h4>Tes villes</h4><div class="items">${towns.map(t => `<div class="item"><span><b>${esc(t.name)}</b><small>${t.garrison} gardes · ${Math.round(t.pop)} habitants · impôt ≈ ${Math.round(t.pop * 0.3)} 💰/jour</small></span>
        <button data-hiretown="${esc(t.name)}" ${state.money < 100 || t.garrison >= 10 ? 'disabled' : ''}>Engager un garde (100 💰)</button></div>`).join('')}</div>` : ''}`;
  }
  $('buildpanel').innerHTML = `<div class="phead"><h3>${f ? 'Ma faction' : 'Fonder une faction'}</h3><button class="x" data-close>✕</button></div><div class="pbody">${body}</div>`;
}
const pfDraft = { c0: PF_COLORS[0], c1: PF_COLORS[6], emb: FLAG_EMBLEMS[0] };
document.getElementById('buildpanel').addEventListener('click', e => {
  const t = e.target.closest('[data-close],[data-c0],[data-c1],[data-emb],[data-found],[data-place],[data-hire],[data-hiretown]');
  if (!t) return;
  const d = t.dataset;
  if ('close' in d) { closePanel(); return; }
  if (d.c0) { pfDraft.c0 = d.c0; document.querySelectorAll('[data-c0]').forEach(x => x.classList.toggle('sel', x === t)); return; }
  if (d.c1) { pfDraft.c1 = d.c1; document.querySelectorAll('[data-c1]').forEach(x => x.classList.toggle('sel', x === t)); return; }
  if (d.emb) { pfDraft.emb = d.emb; document.querySelectorAll('[data-emb]').forEach(x => x.classList.toggle('on', x === t)); return; }
  if ('found' in d) { foundFaction(($('pfName').value || '').trim() || `Compagnie ${deN(player.name)}`, pfDraft.c0, pfDraft.c1, pfDraft.emb); renderBuild(); return; }
  if (d.place) { const bn = $('baseName'); if (bn) state.pendingBaseName = bn.value.trim() || state.pendingBaseName; startPlacing(d.place); return; }
  if ('hire' in d || d.hiretown) {
    const s = d.hiretown ? settlementByName(d.hiretown) : baseSettlement();
    if (s && state.money >= 100) { state.money -= 100; s.garrison++; newPerson({ home: s.name, job: 'soldat', faction: 'player', lvl: randInt(15, 30) }); if (s.guardsMat) addGuard(s, s.guards.length); logMsg('Un garde rejoint ta base.'); renderBuild(); }
  }
});

// ---------- Prendre une ville ----------
// quand la garnison est vaincue et que tu es dans la ville, tu peux la revendiquer
function capturableTown() {
  const s = state.currentTown;
  if (!s || s.type === 'base' || s.type === 'repaire' || s.faction === 'player') return null;
  if (!playerHostileTo(s.faction) || !s.guardsMat) return null;
  // plus aucun défenseur debout dans la ville : les survivants se rendent
  if ((s.guards || []).some(g => alive(g))) return null;
  if (units.some(u => alive(u) && !u.civil && u.faction === s.faction && u.party && u.party.kind !== 'caravan' && u.party.kind !== 'travel' && d2(u.pos, s) < s.r)) return null;
  return s;
}
function takeTown(s) {
  if (!playerFaction()) foundFaction(`Compagnie ${deN(player.name)}`, PF_COLORS[0], PF_COLORS[6]);
  const old = s.faction;
  state.rep[old] = -100;
  captureSettlement(s, 'player', 0);
  for (const m of people()) if (m.alive && !m.party && m.loc === s.name) m.faction = 'player';
  logMsg(`🏴 ${s.name} est à toi ! Engage des gardes (B) pour la tenir.`, 'news');
  sfx('skill');
}
// impôts quotidiens de tes villes
function collectTaxes() {
  let total = 0;
  for (const s of state.settlements) if (s.faction === 'player' && s.type !== 'base') total += Math.round(s.pop * 0.3);
  if (total) { state.money += total; logMsg(`💰 Impôts de tes villes : +${total}.`); }
}

// ---------- Sauvegarde ----------
function baseSaveData() {
  return state.base ? { name: state.base.name, x: state.base.x, z: state.base.z, structs: state.base.structs.map(({ id, type, x, z, yaw, progress, done }) => ({ id, type, x, z, yaw, progress, done })) } : null;
}
function baseLoad(data, settlementData) {
  state.base = null;
  if (!data) return;
  const sd = settlementData || {};
  const s = createBase(data.name, data.x, data.z);
  Object.assign(s, { garrison: sd.garrison || 0, pop: sd.pop || 6, stock: sd.stock || s.stock });
  state.base = { name: data.name, x: data.x, z: data.z, structs: [] };
  for (const st of data.structs) { state.base.structs.push(st); realizeStruct(st); }
  refreshBaseBounds();
}
