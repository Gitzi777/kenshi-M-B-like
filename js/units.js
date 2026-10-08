// Terres Arides — personnages, animaux, équipement, combat, flèches, IA.
'use strict';

// ---------- Modèle 3D d'un humain ----------
const HAIR_COLORS = ['#2a1d14', '#3b2a1c', '#5a3a22', '#7a5530', '#1a1a1a', '#8a8070', '#a0522d'];
function makeCharacter(look) {
  const root = new T.Group();
  const body = new T.Group();
  body.scale.setScalar(look.height || 1);
  root.add(body);
  const own = (c, r = 0.85) => toonMat({ color: lin(c), roughness: r, map: TEX.grain });
  const mBody = own(look.body), mSkin = own(look.skin, 0.7), mPants = own(look.pants || '#3b2f22');
  const seed = Math.abs(Math.round(((look.skin || '').charCodeAt(2) || 7) * 31 + (look.height || 1) * 997 + (look.body || '').length * 13));
  const mHair = own(look.hair || HAIR_COLORS[seed % HAIR_COLORS.length], 0.95);
  const mBoot = own('#2e241a'), mBelt = own('#3a2c1e'), mDark = new T.MeshBasicMaterial({ color: '#15100c' });
  const add = (geo, m, x, y, z, parent = body) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  // membre articulé : la forme pend sous le pivot (épaule ou hanche)
  const limb = (x, y, rTop, rBot, h, m) => {
    const pivot = new T.Group();
    pivot.position.set(x, y, 0);
    add(new T.CylinderGeometry(rTop, rBot, h, 10), m, 0, -h / 2, 0, pivot);
    body.add(pivot);
    return pivot;
  };
  const legL = limb(-0.12, 0.92, 0.1, 0.075, 0.9, mPants);
  const legR = limb(0.12, 0.92, 0.1, 0.075, 0.9, mPants);
  for (const lg of [legL, legR]) add(new T.BoxGeometry(0.15, 0.18, 0.26), mBoot, 0, -0.84, 0.04, lg);
  // buste en tonneau, épaules plus larges
  const torso = add(new T.CylinderGeometry(0.27, 0.21, 0.66, 14), mBody, 0, 1.24, 0);
  torso.scale.z = 0.62;
  add(new T.CylinderGeometry(0.215, 0.215, 0.07, 8), mBelt, 0, 0.94, 0).scale.z = 0.66;
  add(new T.BoxGeometry(0.07, 0.06, 0.02), own('#b8932a', 0.4), 0, 0.94, 0.14);
  add(new T.CylinderGeometry(0.22, 0.24, 0.2, 8), mPants, 0, 0.86, 0).scale.z = 0.66;
  add(new T.CylinderGeometry(0.06, 0.07, 0.1, 6), mSkin, 0, 1.6, 0);
  const tabard = new T.Mesh(new T.BoxGeometry(0.34, 0.72, 0.02), own('#ffffff'));
  tabard.position.set(0, 1.2, 0.15);
  tabard.visible = false;
  body.add(tabard);
  // tête : visage, yeux, nez, cheveux
  const head = new T.Group();
  head.position.y = 1.76;
  body.add(head);
  add(new T.SphereGeometry(0.16, 16, 12), mSkin, 0, 0, 0, head).scale.set(1, 1.12, 1.02);
  add(new T.BoxGeometry(0.035, 0.035, 0.02), mDark, -0.06, 0.02, 0.15, head);
  add(new T.BoxGeometry(0.035, 0.035, 0.02), mDark, 0.06, 0.02, 0.15, head);
  add(new T.BoxGeometry(0.035, 0.06, 0.05), mSkin, 0, -0.03, 0.16, head);
  const hair = new T.Group();
  head.add(hair);
  const style = seed % 4;
  if (style !== 3) add(new T.SphereGeometry(0.168, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), mHair, 0, 0.015, -0.01, hair).scale.set(1.02, 1.14, 1.05);
  if (style === 1) add(new T.BoxGeometry(0.2, 0.14, 0.12), mHair, 0, -0.06, -0.12, hair);
  if (style === 2 || style === 3) add(new T.BoxGeometry(0.18, 0.1, 0.07), mHair, 0, -0.13, 0.11, hair); // barbe
  const headSlot = new T.Group();
  headSlot.position.y = 1.76;
  body.add(headSlot);
  // bras et mains
  const armL = limb(-0.33, 1.5, 0.075, 0.06, 0.6, mBody);
  const armR = limb(0.33, 1.5, 0.075, 0.06, 0.6, mBody);
  add(new T.SphereGeometry(0.075, 8, 6), mBody, -0.33, 1.5, 0);
  add(new T.SphereGeometry(0.075, 8, 6), mBody, 0.33, 1.5, 0);
  for (const a of [armL, armR]) add(new T.IcosahedronGeometry(0.06, 1), mSkin, 0, -0.63, 0, a);
  const weaponSlot = new T.Group();
  weaponSlot.position.y = -0.6;
  armR.add(weaponSlot);
  const bowSlot = new T.Group();
  bowSlot.position.y = -0.6;
  armL.add(bowSlot);
  const backSlot = new T.Group();
  backSlot.position.set(0, 1.2, -0.17);
  body.add(backSlot);
  const hipSlot = new T.Group();
  hipSlot.position.set(0.26, 0.98, 0.02);
  hipSlot.rotation.x = Math.PI * 0.62;
  body.add(hipSlot);
  return { root, body, legL, legR, armL, armR, torso, tabard, head, hair, headSlot, weaponSlot, bowSlot, backSlot, hipSlot, mBody, mSkin, mPants, hurtMats: [mBody, mSkin] };
}

// ---------- Modèle 3D d'un animal (quadrupède) ----------
function makeAnimalModel(sp) {
  const root = new T.Group();
  const body = new T.Group();
  body.scale.setScalar(sp.size);
  root.add(body);
  const m = toonMat({ color: lin(sp.color), flatShading: true, roughness: 0.9, map: TEX.grain });
  const dark = toonMat({ color: lin('#1a1410'), flatShading: true });
  // formes arrondies : ellipsoïdes plutôt que des cubes
  const box = (w, h, d, mm, x, y, z) => {
    const geo = w > 0.09 && h > 0.09 && d > 0.09 ? new T.IcosahedronGeometry(0.5, 1).scale(w * 1.12, h * 1.12, d * 1.12) : new T.BoxGeometry(w, h, d);
    const b = new T.Mesh(geo, mm); b.position.set(x, y, z); b.castShadow = true; return b;
  };
  const scorpion = sp.shape === 'scorpion';
  const torso = box(0.5, scorpion ? 0.3 : 0.42, scorpion ? 1.0 : 1.1, m, 0, scorpion ? 0.45 : 0.8, 0);
  body.add(torso);
  const headG = new T.Group();
  headG.position.set(0, scorpion ? 0.45 : 0.95, scorpion ? 0.6 : 0.62);
  headG.add(box(0.3, 0.28, 0.4, m, 0, 0, 0.12), box(0.05, 0.05, 0.05, dark, 0.09, 0.06, 0.33), box(0.05, 0.05, 0.05, dark, -0.09, 0.06, 0.33));
  if (!scorpion) headG.add(box(0.08, 0.14, 0.06, m, 0.1, 0.18, -0.02), box(0.08, 0.14, 0.06, m, -0.1, 0.18, -0.02));
  else headG.add(box(0.12, 0.08, 0.4, m, 0.3, -0.05, 0.25), box(0.12, 0.08, 0.4, m, -0.3, -0.05, 0.25));
  body.add(headG);
  const tail = new T.Group();
  tail.position.set(0, scorpion ? 0.5 : 0.85, -0.55);
  if (scorpion) { tail.add(box(0.1, 0.8, 0.1, m, 0, 0.4, -0.1), box(0.12, 0.12, 0.3, dark, 0, 0.8, 0.1)); }
  else tail.add(box(0.07, 0.07, 0.35, m, 0, 0, -0.15));
  body.add(tail);
  const legH = scorpion ? 0.35 : 0.6;
  const leg = (x, z) => {
    const pivot = new T.Group();
    pivot.position.set(x, legH, z);
    const lg = new T.Mesh(new T.CylinderGeometry(0.07, 0.045, legH, 6), m);
    lg.position.y = -legH / 2; lg.castShadow = true;
    pivot.add(lg);
    body.add(pivot);
    return pivot;
  };
  const armL = leg(-0.18, 0.38), armR = leg(0.18, 0.38), legL = leg(-0.18, -0.38), legR = leg(0.18, -0.38);
  const dummy = () => new T.Group();
  return { root, body, legL, legR, armL, armR, torso, head: headG, tail, tabard: { visible: false, material: { color: new T.Color() } },
    headSlot: dummy(), weaponSlot: dummy(), bowSlot: dummy(), backSlot: dummy(), hipSlot: dummy(), mBody: m, mSkin: m, hurtMats: [m] };
}

function clearGroup(g) { while (g.children.length) g.remove(g.children[0]); }
const METAL = {};
function metal(color) {
  if (!METAL[color]) METAL[color] = toonMat({ color: lin(color), roughness: 0.32, metalness: 0.55, flatShading: true });
  return METAL[color];
}
function part(w, h, d, color, x = 0, y = 0, z = 0, mm) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), mm || mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function buildWeapon(id) {
  const g = new T.Group();
  const it = IT(id);
  if (!it) return g;
  const L = it.len;
  switch (it.model) {
    case 'blade': {
      const bl = new T.Mesh(new T.CylinderGeometry(0.004, 0.035, L, 4).rotateX(Math.PI / 2).scale(1, 0.35, 1), metal(it.color));
      bl.position.z = L / 2 + 0.13; bl.castShadow = true;
      g.add(bl, part(0.24, 0.04, 0.05, '#7a6040', 0, 0, 0.1, metal('#8a7048')), part(0.04, 0.04, 0.16, '#3a2a1e', 0, 0, 0), part(0.06, 0.06, 0.06, '#8a7048', 0, 0, -0.09, metal('#8a7048')));
      break;
    }
    case 'staff': g.add(part(0.06, 0.06, L, it.color, 0, 0, L / 2 - 0.4)); break;
    case 'mace': { g.add(part(0.05, 0.05, L, '#5a4630', 0, 0, L / 2)); const h = new T.Mesh(new T.DodecahedronGeometry(0.12, 0), metal(it.color)); h.position.z = L; h.castShadow = true; g.add(h); break; }
    case 'axe': g.add(part(0.05, 0.05, L, '#5a4630', 0, 0, L / 2), part(0.03, 0.3, 0.24, it.color, 0, 0.12, L - 0.1, metal(it.color))); break;
    case 'spear': {
      g.add(part(0.05, 0.05, L, '#6e5538', 0, 0, L / 2 - 0.5));
      const tip = new T.Mesh(new T.ConeGeometry(0.06, 0.3, 4), metal(it.color));
      tip.rotation.x = Math.PI / 2;
      tip.position.z = L - 0.35;
      g.add(tip);
      break;
    }
  }
  return g;
}
function buildBow() {
  const g = new T.Group();
  g.add(part(0.04, 0.04, 0.45, '#5a3a20'));
  const l1 = part(0.035, 0.035, 0.5, '#5a3a20', 0, -0.08, 0.42); l1.rotation.x = 0.35;
  const l2 = part(0.035, 0.035, 0.5, '#5a3a20', 0, -0.08, -0.42); l2.rotation.x = -0.35;
  g.add(l1, l2, part(0.01, 0.01, 1.3, '#e8e0d0', 0, -0.2, 0));
  return g;
}
function buildHelmet(id, fac) {
  const g = new T.Group();
  const it = IT(id);
  if (!it) return g;
  const facColor = fac && fac.id !== 'player' ? fac.colors[1] : null;
  switch (it.model) {
    case 'band': { const t = new T.Mesh(new T.TorusGeometry(0.165, 0.03, 6, 16), mat(facColor || '#a01e1e')); t.rotation.x = Math.PI / 2; t.position.y = 0.07; g.add(t); break; }
    case 'hood': {
      const m = mat(facColor || '#6b5536');
      const h = new T.Mesh(new T.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), m); h.position.set(0, 0.02, -0.02); h.scale.set(1, 1.15, 1.1); h.castShadow = true;
      const c = new T.Mesh(new T.CylinderGeometry(0.2, 0.3, 0.5, 12, 1, true, Math.PI * 0.3, Math.PI * 1.4), m); c.position.set(0, -0.33, -0.04); c.castShadow = true;
      m.side = T.DoubleSide;
      g.add(h, c); break;
    }
    case 'turban': {
      const m = mat(facColor || '#ece2cc');
      for (let k = 0; k < 3; k++) { const t = new T.Mesh(new T.TorusGeometry(0.15 - k * 0.03, 0.05, 6, 16), m); t.rotation.x = Math.PI / 2; t.position.y = 0.08 + k * 0.06; t.castShadow = true; g.add(t); }
      break;
    }
    case 'cap': { const d = new T.Mesh(new T.SphereGeometry(0.18, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(it.color)); d.position.y = 0.03; d.castShadow = true; g.add(d); break; }
    case 'helm': { const d = new T.Mesh(new T.SphereGeometry(0.19, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), metal(it.color)); d.position.y = 0.02; d.castShadow = true; g.add(d, part(0.04, 0.16, 0.04, it.color, 0, -0.04, 0.18, metal(it.color))); break; }
    case 'greathelm': { const d = new T.Mesh(new T.CylinderGeometry(0.19, 0.2, 0.42, 10), metal(it.color)); d.position.y = 0.02; d.castShadow = true; g.add(d, part(0.26, 0.04, 0.02, '#111', 0, 0.04, 0.2)); break; }
  }
  return g;
}

// Habille un personnage selon son équipement et sa faction
function dressUnit(u) {
  if (u.animal) return;
  const c = u.c;
  if (c.skinned) { dressSkinned(u); return; }
  const fac = u.faction === 'player' ? (state.allegiance ? F(state.allegiance) : null) : F(u.faction);
  const armor = IT(u.equip.armor);
  const bodyHex = armor && armor.color ? armor.color : u.look.body;
  setLin(c.mBody.color, bodyHex);
  if (c.hair) c.hair.visible = !u.equip.helmet || ['band'].includes(IT(u.equip.helmet) && IT(u.equip.helmet).model);
  const showTabard = fac && fac.outfit && fac.outfit.tabard && (u.faction !== 'player' || u.isPlayer || u.sworn);
  c.tabard.visible = !!showTabard;
  if (showTabard) {
    setLin(c.tabard.material.color, fac.colors[0].toLowerCase() === String(bodyHex).toLowerCase() ? fac.colors[1] : fac.colors[0]);
  }
  clearGroup(c.headSlot);
  if (u.equip.helmet) c.headSlot.add(buildHelmet(u.equip.helmet, fac));
  clearGroup(c.weaponSlot);
  clearGroup(c.bowSlot);
  clearGroup(c.backSlot);
  clearGroup(c.hipSlot);
  if (u.mode === 'bow' && IT(u.equip.bow) && !u.sheathed) c.bowSlot.add(buildBow());
  else {
    // arme rangée : à la ceinture ; dégainée : en main
    if (u.equip.weapon) (u.sheathed || u.fists ? c.hipSlot : c.weaponSlot).add(buildWeapon(u.equip.weapon));
    if (u.equip.bow) { const b = buildBow(); b.rotation.z = 0.6; c.backSlot.add(b); }
  }
  if (u.carry) c.backSlot.add(part(0.55, 0.5, 0.4, '#8a6a40', 0, 0.15, -0.1));
  if (u.banner && F(u.faction)) {
    const fp = makeFlagPole(F(u.faction), 3.2);
    fp.g.scale.setScalar(0.6);
    fp.g.position.set(0.15, -0.6, -0.05);
    c.backSlot.add(fp.g);
  }
}

// ---------- Unités ----------
const units = [];
let player = null;
const isPlayerSide = u => u.faction === 'player';
const alive = u => u && !u.dead && !(u.down > 0) && !(u.isPlayer && state.ko > 0) && !u.hidden;
// ton escouade : ni les gardes de tes villes, ni leurs habitants
const squad = () => units.filter(u => u.faction === 'player' && !u.isPlayer && !u.dead && !u.guardOf && !u.civil);
const team = () => units.filter(u => u.faction === 'player' && !u.dead && !u.guardOf && !u.civil);
const displayName = u => u.title ? `${u.title} ${u.name}` : u.name;

function makeBar(color) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 8;
  const tx = new T.CanvasTexture(cv); tx.encoding = T.sRGBEncoding;
  const sp = new T.Sprite(new T.SpriteMaterial({ map: tx, depthTest: false }));
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
function unitColor(u) {
  if (isPlayerSide(u)) return '#6fcf5a';
  if (u.animal) return u.faction === 'predateur' ? '#ff5a3c' : '#d8c8a0';
  const f = F(u.faction);
  return !f || f.map === '#1d1d1d' ? '#ff5a3c' : f.map;
}
// étiquette de nom au-dessus de la tête (créée à la demande)
function makeLabel(u) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 40;
  const g = cv.getContext('2d');
  g.font = 'bold 22px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 5; g.strokeStyle = 'rgba(20,14,8,.85)';
  const txt = displayName(u);
  g.strokeText(txt, 128, 20);
  g.fillStyle = isPlayerSide(u) ? '#b8f0a8' : u.rank ? '#ffd27a' : '#f2e6c8';
  g.fillText(txt, 128, 20);
  const tx = new T.CanvasTexture(cv); tx.encoding = T.sRGBEncoding;
  const sp = new T.Sprite(new T.SpriteMaterial({ map: tx, depthTest: false, transparent: true, sizeAttenuation: false }));
  sp.scale.set(0.16, 0.025, 1);
  sp.position.y = u.animal ? 1.6 * u.species.size : 2.55 * (u.look.height || 1);
  sp.renderOrder = 11;
  u.c.root.add(sp);
  u.label = sp;
}
function refreshLabel(u) { if (u.label) { u.c.root.remove(u.label); u.label = null; } }

// silhouette par défaut d'un PNJ selon sa faction et son rôle
function defaultModel(o) {
  if (o.civil) return pick(['rogue', 'mage', 'rogue_hooded', 'rogue']);
  if (o.troop === 'general') return 'knight';
  if (o.troop === 'archer') return pick(['rogue', 'rogue_hooded']);
  const f = F(o.faction);
  const list = f && CULTURE_MODEL[f.culture] || ['rogue', 'barbarian', 'knight'];
  return pick(list);
}
function makeUnit(o) {
  const look = o.look || {};
  if (!o.species && ASSETS.ready) { if (!look.model) look.model = defaultModel(o); if (!look.tint) look.tint = look.body; }
  const c = o.species ? makeAnimalModel(o.species) : ASSETS.ready ? makeSkinnedCharacter(look) : makeCharacter(look);
  c.root.position.set(o.x, heightAt(o.x, o.z), o.z);
  scene.add(c.root);
  const maxHp = o.maxHp || 80;
  const u = {
    id: uid(), faction: o.faction, troop: o.troop || null, name: o.name || pick(FIRST_NAMES), title: o.title || '', rank: o.rank || null, look,
    equip: { weapon: null, bow: null, armor: null, helmet: null, ...(o.equip || {}) },
    c, pos: c.root.position, isPlayer: !!o.isPlayer,
    maxHp, hp: o.hp != null ? o.hp : maxHp, str: o.str || 2, agi: o.agi || 0, speedBase: o.speed || 4.6,
    blockChance: o.blockChance != null ? o.blockChance : 0.3, blockSkill: o.blockSkill || 0.5,
    arrows: o.arrows || 0, coins: o.coins || 0, goods: o.goods || {},
    level: o.level || 1, xp: o.xp || 0, stats: o.stats || null,
    skills: { forge: 0, couture: 0, bois: 0, recolte: 0, crochetage: 0, ...baseCombat(o.combat || 5), ...(o.skills || {}) },
    sheathed: !!o.sheathed, jailed: null, fugitive: null, carriedBy: null, lastHitBy: null,
    yaw: rand(-3, 3), moving: 0, walk: 0, twist: 0,
    atkCd: rand(0, 1), atk: null, block: null, stagger: 0, draw: -1,
    hurt: 0, knock: { x: 0, z: 0 }, down: 0,
    target: null, retarget: 0, dead: false, deadTime: 0, loot: null, cmd: null,
    party: o.party || null, home: o.home || null, guardOf: o.guardOf || null, banner: !!o.banner,
    mode: 'melee', sworn: false, civil: !!o.civil, task: o.task || null, flee: 0, carry: false,
    animal: !!o.species, species: o.species || null, natural: o.natural || null, inv: [],
  };
  if (!u.civil) {
    u.bar = makeBar(unitColor(u));
    u.bar.sp.position.y = u.animal ? 1.35 * o.species.size : 2.3 * (look.height || 1);
    u.bar.sp.visible = !u.isPlayer;
    c.root.add(u.bar.sp);
    drawBar(u);
  }
  dressUnit(u);
  units.push(u);
  return u;
}
function removeUnit(u) {
  scene.remove(u.c.root);
  const i = units.indexOf(u);
  if (i >= 0) units.splice(i, 1);
  if (u.ring) scene.remove(u.ring);
}

// Crée un soldat d'une faction à partir d'un type de troupe
function makeTroop(fid, troop, x, z, extra = {}) {
  const fac = F(fid);
  const tpl = (fac.troops && fac.troops[troop]) || CULTURES.guerrier.troops[troop] || CULTURES.guerrier.troops.veteran;
  const base = TROOP_BASE[troop] || TROOP_BASE.recrue;
  const bonus = fac.bandit ? Math.min(state.day, 10) * 3 : 0;
  const general = troop === 'general';
  const u = makeUnit({
    faction: fid, troop, x, z, name: genPerson(), title: base.label,
    maxHp: base.hp + bonus, str: base.str + (fac.bandit ? Math.floor(state.day / 3) : 0),
    speed: 4.3, blockChance: troop === 'veteran' || troop === 'chef' || general ? 0.45 : 0.25, blockSkill: troop === 'veteran' || general ? 0.7 : 0.45,
    equip: general ? { weapon: pick(['epee#2', 'hache#2', 'cimeterre#2']), armor: 'plaques', helmet: 'heaume' }
      : { weapon: pick(tpl.weapon), bow: tpl.bow || null, armor: tpl.armor, helmet: tpl.helmet },
    arrows: tpl.bow ? randInt(12, 20) : 0,
    coins: general ? randInt(80, 150) : fac.bandit ? randInt(3, 20) : randInt(5, 30),
    look: { body: fac.outfit.body, pants: fac.outfit.pants, skin: fac.culture === 'cannibale' ? '#8a4a32' : pick(SKIN_COLORS), height: rand(0.94, 1.08) + (general ? 0.05 : 0) },
    combat: (TROOP_SKILL[troop] || 15) + (fac.bandit ? Math.min(state.day, 15) : 0),
    ...extra,
  });
  if (tpl.bow && !general) u.archer = true;
  return u;
}

function makeAnimal(key, x, z) {
  const sp = SPECIES[key];
  const u = makeUnit({
    faction: sp.pred ? 'predateur' : 'gibier', species: sp, x, z, name: sp.name, maxHp: sp.hp, str: 0, speed: sp.speed,
    blockChance: 0, natural: { name: 'Crocs', dmg: sp.dmg, cd: sp.cd, reach: sp.reach },
  });
  u.speciesKey = key;
  u.home = { x, z };
  return u;
}

// ---------- Statistiques dérivées ----------
const weaponOf = u => u.natural || (u.fists ? FIST : IT(u.equip.weapon) || FIST);
const isFists = u => !u.natural && weaponOf(u) === FIST;
const TROOP_SKILL = { recrue: 8, milicien: 12, guerrier: 22, archer: 18, veteran: 38, chef: 45, general: 60, pillard: 14, garde: 25 };
function baseCombat(v) {
  const r = () => Math.max(0, Math.round(v + rand(-v * 0.3, v * 0.3)));
  return { attaque: r(), defense: r(), poings: r(), arc: r(), force: r(), endurance: r(), athletisme: r(), soins: Math.round(v * 0.5) };
}
const sk = (u, k) => (u.skills && u.skills[k]) || 0;
// s'entraîner : rapide au début, de plus en plus lent, plus rapide face à plus fort que soi
function trainSkill(u, k, amount = 1, foe = null) {
  if (!u.skills || u.animal) return;
  const v = sk(u, k);
  if (v >= 100) return;
  let rate = amount * 0.6 * Math.pow(1 - v / 101, 1.4);
  if (foe && foe.skills) rate *= clamp((sk(foe, k === 'defense' || k === 'endurance' ? 'attaque' : 'defense') + 15) / (v + 15), 0.4, 2.5);
  const nv = Math.min(100, v + rate);
  u.skills[k] = nv;
  if (Math.floor(nv) > Math.floor(v)) {
    if (k === 'endurance') { u.maxHp += 1; u.hp += 1; }
    u.level = levelOf(u);
    if (isPlayerSide(u) && (u.isPlayer || Math.floor(nv) % 5 === 0)) {
      floatText(u.pos, `${SKILLS[k]} ${Math.floor(nv)}`, '#7ad7ff');
      if (u.isPlayer) sfx('skill', null, 0.6);
    }
  }
}
const levelOf = u => 1 + Math.floor((sk(u, 'attaque') + sk(u, 'defense') + sk(u, 'endurance') + sk(u, 'force') + sk(u, 'athletisme')) / 50);
const bowOf = u => IT(u.equip.bow) || null;
const armorOf = u => (IT(u.equip.armor) ? IT(u.equip.armor).armor : 0) + (IT(u.equip.helmet) ? IT(u.equip.helmet).armor : 0);
function speedOf(u) {
  let s = (u.speedBase + (IT(u.equip.armor) && IT(u.equip.armor).speed || 0)) * (1 + sk(u, 'athletisme') * 0.0025);
  if (isPlayerSide(u) && typeof overloaded === 'function' && overloaded()) s *= 0.6;
  if (isPlayerSide(u) && state.storm > 0 && biomeAt(u.pos.x, u.pos.z) === 'desert') s *= 0.8;
  return s;
}
const cooldownOf = u => weaponOf(u).cd * (1 - u.agi * 0.03) * (1 - sk(u, isFists(u) ? 'poings' : 'attaque') * 0.002);
const damageOf = u => {
  if (u.natural) return Math.round(u.natural.dmg + u.str);
  const fists = isFists(u);
  const s = sk(u, fists ? 'poings' : 'attaque');
  return Math.round((weaponOf(u).dmg + u.str + sk(u, 'force') / 10) * (1 + s * (fists ? 0.012 : 0.008)));
};

// ---------- Relations ----------
function playerHostileTo(fid) {
  const f = F(fid);
  if (!f || fid === 'player') return false;
  // les rançonneurs restent neutres tant qu'on paie leur péage
  if (f.bandit) return f.behavior !== 'racket' || (state.tollAngry && state.tollAngry[fid] > (state.clock || 0)) || (state.rep[fid] || 0) <= -20;
  if ((state.rep[fid] || 0) <= -20) return true;
  if (state.allegiance && state.allegiance !== fid && state.relations[relKey(state.allegiance, fid)] === 'war') return true;
  return false;
}
function hostileF(a, b) {
  if (a === b) return false;
  if (a === 'predateur' || b === 'predateur') return a !== 'gibier' && b !== 'gibier';
  if (a === 'gibier' || b === 'gibier') return false;
  if (a === 'player') return playerHostileTo(b);
  if (b === 'player') return playerHostileTo(a);
  const fa = F(a), fb = F(b);
  if (!fa || !fb) return false;
  if (fa.bandit || fb.bandit) return true;
  return state.relations[relKey(a, b)] === 'war';
}
const isFugitiveFor = (o, fid) => o.fugitive && o.fugitive.f === fid && (state.clock || 0) < o.fugitive.until;
const hostile = (u, o) => hostileF(u.faction, o.faction) || u.angryAt === o || o.angryAt === u || isFugitiveFor(o, u.faction) || isFugitiveFor(u, o.faction);
// ton camp ne frappe que ses ennemis, sauf si l'option « frapper les neutres » est active
// (ou si on donne l'ordre d'attaquer précisément cette cible)
const canHit = (u, o) => o !== u && (isPlayerSide(u)
  ? !isPlayerSide(o) && !!(settings.hitNeutrals || hostile(u, o) || o.animal || (u.cmd && u.cmd.type === 'attack' && u.cmd.target === o))
  : hostile(u, o));

// ---------- Murs entre deux points (coups, flèches, chemins) ----------
const hasRing = s => s.type !== 'repaire' && s.type !== 'base';
const ringGap = s => (s.type === 'ville' ? 0.15 : 0.22) * 34 / s.r;
// la ligne a→b traverse-t-elle l'enceinte d'une ville ailleurs qu'à la porte ?
function ringBetween(a, b) {
  const vx = b.x - a.x, vz = b.z - a.z, A = vx * vx + vz * vz;
  if (A < 1e-9) return false;
  for (const s of state.settlements) {
    if (!hasRing(s)) continue;
    const fx = a.x - s.x, fz = a.z - s.z;
    if (Math.abs(fx) > s.r + 80 || Math.abs(fz) > s.r + 80) continue;
    // intersections du segment avec le cercle du mur
    const B = 2 * (fx * vx + fz * vz), C = fx * fx + fz * fz - s.r * s.r;
    const disc = B * B - 4 * A * C;
    if (disc <= 0) continue;
    const sq = Math.sqrt(disc);
    for (const t of [(-B - sq) / (2 * A), (-B + sq) / (2 * A)]) {
      if (t < 0 || t > 1) continue;
      const cx = fx + vx * t, cz = fz + vz * t;
      if (Math.abs(angleDiff(Math.atan2(cz, cx), s.gate)) > ringGap(s)) return true;
    }
  }
  return false;
}
const blockedBetween = (a, b) => ringBetween(a, b) || wallBetween(a, b);

function playerAttacked(fid) {
  if (!F(fid) || playerHostileTo(fid)) return;
  state.rep[fid] = Math.min(state.rep[fid] || 0, -25);
  const f = F(fid);
  logMsg(`⚠ ${theF(f, true)} ${vb(f, 'te considère', 'te considèrent')} désormais comme un ennemi !`, 'warn');
  addChronicle(`${player.name} a attaqué des gens ${f.of}.`, '⚠');
  if (state.allegiance === fid) breakAllegiance(true);
}

// ---------- Combat ----------
function facing(u, other) {
  const dx = other.pos.x - u.pos.x, dz = other.pos.z - u.pos.z;
  const d = Math.hypot(dx, dz) || 1;
  return (Math.sin(u.yaw) * dx + Math.cos(u.yaw) * dz) / d;
}

function startAttack(u, dir) {
  if (u.atkCd > 0 || u.atk || u.stagger > 0 || u.mode === 'bow' || u.carrying) return false;
  if (u.isPlayer && u.block) return false;
  if (u.sheathed) { setSheathed(u, false); return false; }
  const windup = u.isPlayer ? 0.28 : u.animal ? 0.35 : 0.5;
  if (u.isPlayer && !settings.directional) { u.combo = ((u.combo || 0) + 1) % 3; dir = ['droite', 'gauche', 'haut'][u.combo]; }
  if (isFists(u)) { u.combo = ((u.combo || 0) + 1) % 2; dir = 'estoc'; }
  u.atk = { t: 0, dir: dir || pick(Object.keys(DIRS)), windup, total: windup + 0.35, hit: false };
  if (u.animal && Math.random() < 0.35) sfx('growl', u.pos, u.species.size);
  u.atkCd = cooldownOf(u) + windup;
  const reach = weaponOf(u).reach;
  for (const o of units) {
    if (o === u || o.isPlayer || o.animal || !alive(o) || !canHit(u, o) || o.atk || o.mode === 'bow') continue;
    if (d2(u.pos, o.pos) > reach + 1.5 || facing(o, u) < 0.3 || blockedBetween(u.pos, o.pos)) continue;
    if (Math.random() < o.blockChance + sk(o, 'defense') * 0.004) {
      const others = Object.keys(DIRS).filter(d => d !== u.atk.dir);
      o.block = { dir: Math.random() < o.blockSkill + sk(o, 'defense') * 0.003 ? u.atk.dir : pick(others), t: windup + 0.6 };
    }
  }
  return true;
}

function resolveHit(u) {
  const w = weaponOf(u);
  let hits = 0;
  sfx(w.dmg >= 14 ? 'heavy' : 'swing', u.pos, 0.8);
  // petit pas en avant au moment du coup (élan)
  if (u.isPlayer) { u.knock.x += Math.sin(u.yaw) * 2.2; u.knock.z += Math.cos(u.yaw) * 2.2; }
  for (const o of units) {
    if (!alive(o) || !canHit(u, o)) continue;
    if (d2(u.pos, o.pos) > w.reach + 0.3 || facing(u, o) < 0.35) continue;
    if (!isPlayerSide(u) && !hostile(u, o)) continue;
    if (blockedBetween(u.pos, o.pos)) continue;
    if (u.cmd && u.cmd.type === 'attack' && u.cmd.target !== o && !hostile(u, o)) continue;
    damage(o, u, damageOf(u) * rand(0.85, 1.15), u.atk.dir, false);
    if (isPlayerSide(u) || Math.random() < 0.3) { trainSkill(u, isFists(u) ? 'poings' : 'attaque', 1, o); trainSkill(u, 'force', 0.3 + w.dmg / 40); }
    if (++hits >= (u.isPlayer ? 2 : 1)) break;
  }
  if (!hits && u.isPlayer) floatText(u.pos, '~', '#ccc');
}

function damage(o, by, amount, dir, ranged) {
  if (!alive(o)) return;
  if (o.dodge && o.dodge.t < o.dodge.iframes) { floatText(o.pos, 'esquive', '#cfe8ff'); trainSkill(o, 'athletisme', 0.8, by); return; }
  let blocked = false;
  if (!ranged && o.block && facing(o, by) > 0.3) {
    if (o.block.dir === dir || (o.isPlayer && !settings.directional) || (isPlayerSide(o) && !o.isPlayer)) {
      blocked = true;
      amount *= 0.08;
      floatText(o.pos, 'paré !', '#9fc3ff');
      sfx('block', o.pos);
      burst({ x: (o.pos.x + by.pos.x) / 2, y: o.pos.y + 1.3, z: (o.pos.z + by.pos.z) / 2 }, { n: 10, color: ['#fff3b0', '#ffd060', '#ffffff'], speed: 5, up: 3, life: 0.35, size: 0.05, grav: 12 });
      if (o.isPlayer || by.isPlayer) impact(0.18, 0.05);
      trainSkill(o, 'defense', 1.2, by);
      by.stagger = 0.5;
      by.atkCd += 0.3;
    } else if (o.isPlayer) floatText(o.pos, 'mauvaise parade', '#ffb0a0');
  }
  amount *= Math.max(0.3, 1 - armorOf(o) * 0.055) * (1 - sk(o, 'endurance') * 0.003);
  if (!blocked) {
    trainSkill(o, 'endurance', ranged ? 0.6 : 0.9, by);
    if (!ranged && !o.block) trainSkill(o, 'defense', 0.35, by);
    const fists = !ranged && isFists(by);
    sfx(ranged ? 'arrowHit' : fists ? 'punch' : 'hit', o.pos);
    const dx = o.pos.x - by.pos.x, dz = o.pos.z - by.pos.z, dd = Math.hypot(dx, dz) || 1;
    const hp = { x: o.pos.x, y: o.pos.y + (o.animal ? 0.6 * o.species.size : 1.2), z: o.pos.z };
    burst(hp, { n: fists ? 6 : 12, color: fists ? ['#e8d8b8', '#cbb894'] : o.animal || !o.species ? ['#7a1010', '#a01818', '#5a0808'] : ['#7a1010'], speed: 4, up: 2.5, life: 0.5, size: 0.06, dir: { x: dx / dd, z: dz / dd }, spread: 0.7 });
    burst({ x: o.pos.x, y: o.pos.y + 0.05, z: o.pos.z }, { n: 5, color: ['#c9b48a', '#a8916a'], speed: 1.5, up: 0.8, life: 0.7, size: 0.12, grav: 1, grow: 1.5 });
    if (by.isPlayer) impact(0.22, 0.07);
    else if (o.isPlayer) impact(0.32, 0.05);
    o.flinch = 0.25;
    o.hurtId = (o.hurtId || 0) + 1;
  }
  amount = Math.max(blocked ? 0 : 1, Math.round(amount));
  if (isPlayerSide(by) && !isPlayerSide(o) && !o.animal && !isFugitiveFor(by, o.faction) && !hostileF('player', o.faction)) playerAttacked(o.faction);
  o.lastHitBy = by.faction;
  o.hp -= amount;
  if (amount > 0) {
    o.hurt = 0.15;
    floatText(o.pos, '-' + amount, isPlayerSide(o) ? '#ff6b6b' : '#ffd27a');
  }
  if (!blocked) {
    const dx = o.pos.x - by.pos.x, dz = o.pos.z - by.pos.z, d = Math.hypot(dx, dz) || 1;
    const k = ranged ? 1.5 : 4;
    o.knock.x = dx / d * k; o.knock.z = dz / d * k;
    if (o.atk && !o.atk.hit && Math.random() < 0.5) o.atk = null;
  }
  drawBar(o);
  if (o.animal && !o.species.pred) {
    if (o.species.fights) { o.angryAt = by; o.target = by; }
    else { o.flee = 8; o.fleeFrom = { x: by.pos.x, z: by.pos.z }; }
  } else if (!o.isPlayer && (!o.target || Math.random() < 0.5) && hostile(o, by)) o.target = by;
  if (o.party) o.party.aggro = true;
  if (o.civil) { o.flee = 6; o.fleeFrom = { x: by.pos.x, z: by.pos.z }; }
  // les soldats proches défendent les leurs (civils, compagnons d'armes)
  if (!isPlayerSide(o) && !o.animal && by && by.faction !== o.faction) {
    for (const d of units) {
      if (d === o || d.faction !== o.faction || d.civil || !alive(d) || d.target === by || d2(d.pos, o.pos) > 35) continue;
      if (!hostile(d, by)) d.angryAt = by;
      if (!d.target || Math.random() < 0.5) d.target = by;
      if (d.party) d.party.aggro = true;
    }
  }
  if (isPlayerSide(by)) gainXp(by, 2);
  if (o.hp <= 0) kill(o, by);
}

function gainXp(u, n) {
  // plus de niveaux à gagner : on progresse en se servant de ses compétences (comme dans Kenshi)
  u.xp += n;
  u.level = levelOf(u);
}

function makeLoot(o) {
  if (o.animal) return { items: [], coins: 0, goods: { ...o.species.loot } };
  const loot = { items: [], coins: o.coins || 0, goods: { ...o.goods } };
  const keep = isPlayerSide(o) ? 1 : 0.55;
  for (const slot of ['weapon', 'bow', 'armor', 'helmet']) {
    const id = o.equip[slot];
    if (id && id !== 'haillons' && Math.random() < keep) loot.items.push(id);
  }
  if (o.arrows > 0) loot.goods.arrows = (loot.goods.arrows || 0) + o.arrows;
  if (Math.random() < 0.35) loot.goods.food = (loot.goods.food || 0) + randInt(1, 2);
  if (o.party && o.party.cargo) {
    const share = Math.ceil(o.party.cargo.qty / Math.max(1, o.party.units.length));
    loot.goods[o.party.cargo.good] = (loot.goods[o.party.cargo.good] || 0) + share;
    loot.coins += randInt(10, 40);
  }
  if (o.carry && o.task && o.task.good) loot.goods[o.task.good] = (loot.goods[o.task.good] || 0) + 3;
  return loot;
}
const lootEmpty = l => !l || (!l.items.length && !l.coins && !Object.values(l.goods).some(v => v > 0));

function kill(o, by) {
  if (typeof questOnKill === 'function') questOnKill(o, by);
  // ton escouade n'est jamais tuée : elle tombe K.O. comme dans Kenshi
  if (isPlayerSide(o) && !o.guardOf && !o.civil) { downUnit(o); return; }
  // les humains tombent souvent K.O. au lieu de mourir (on peut les fouiller, les porter, les livrer)
  const koChance = by && isFists(by) ? 1 : 0.5;
  if (!o.animal && !o.civil && o.rank !== 'ruler' && !o.down && !o.noKO && Math.random() < koChance) { npcDown(o, by); return; }
  sfx('death', o.pos, 0.7);
  if (by && (by.isPlayer || o.isPlayer)) impact(0.3, 0.12);
  o.dead = true;
  o.atk = null; o.block = null; o.draw = -1;
  if (o.bar) o.bar.sp.visible = false;
  if (o.label) o.label.visible = false;
  o.loot = makeLoot(o);
  if (o.guardOf && !o.koCounted) o.guardOf.garrison = Math.max(0, o.guardOf.garrison - 1);
  if (o.pid) personDies(personOf(o), by);
  if (by) gainFame(by, o, false);
  if (o.civil && o.task && o.task.type === 'work' && typeof addChronicle === 'function' && by && F(by.faction) && F(by.faction).bandit && Math.random() < 0.3)
    addChronicle(`${theF(F(by.faction), true)} ${vb(F(by.faction), 'a', 'ont')} massacré des ouvriers ${F(o.faction) ? F(o.faction).of : ''} ${placeName(o.pos)}.`, '🩸');
  if (o.rank === 'general' && typeof generalFell === 'function') generalFell(o, by);
  if (o.rank === 'ruler' && typeof rulerFell === 'function') rulerFell(o, by);
  if (by && isPlayerSide(by)) {
    state.kills++;
    gainXp(by, o.animal ? 6 : 12);
    const f = F(o.faction);
    if (f && !f.bandit) state.rep[o.faction] = (state.rep[o.faction] || 0) - 3;
    if (f) for (const id in state.factions) {
      if (id !== o.faction && F(id).alive && !F(id).bandit && hostileF(id, o.faction)) state.rep[id] = Math.min(60, (state.rep[id] || 0) + 2);
    }
  }
}

function npcDown(o, by) {
  o.down = rand(40, 70); o.hp = 0;
  if (by) gainFame(by, o, true);
  // un garde assommé ne compte plus dans la garnison tant qu'il ne s'est pas relevé
  if (o.guardOf && !o.koCounted) { o.koCounted = true; o.guardOf.garrison = Math.max(0, o.guardOf.garrison - 1); }
  o.atk = null; o.block = null; o.draw = -1; o.target = null;
  if (o.bar) o.bar.sp.visible = false;
  o.loot = makeLoot(o);
  for (const u of units) if (u.target === o) u.target = null;
  floatText(o.pos, 'K.O.', '#ffd27a');
  sfx('ko', o.pos);
  burst({ x: o.pos.x, y: o.pos.y + 0.1, z: o.pos.z }, { n: 14, color: ['#c9b48a', '#a8916a', '#d8c8a0'], speed: 3, up: 1, life: 0.9, size: 0.14, grav: 1, grow: 2 });
  if (player && d2(o.pos, player.pos) < 6) impact(0.25, 0.1);
}
function npcWake(o) {
  o.down = 0;
  if (o.koCounted && o.guardOf) { o.koCounted = false; o.guardOf.garrison++; }
  o.hp = Math.round(o.maxHp * 0.25);
  // ce qu'on lui a pris ne revient pas
  if (o.loot) {
    for (const slot of ['weapon', 'bow', 'armor', 'helmet']) if (o.equip[slot] && o.loot.taken && o.loot.taken.includes(o.equip[slot])) o.equip[slot] = null;
    if (o.loot.coinsTaken) o.coins = 0;
    dressUnit(o);
  }
  o.loot = null;
  if (o.bar) { o.bar.sp.visible = true; drawBar(o); }
}

function downUnit(o) {
  if (o.down > 0) return;
  o.down = 25; o.hp = 0;
  o.atk = null; o.block = null; o.draw = -1; o.target = null; o.cmd = null;
  if (o.carrying) dropCarried(o);
  for (const u of units) if (u.target === o) u.target = null;
  floatText(o.pos, 'K.O.', '#ff6b6b');
  sfx('ko', o.pos);
  logMsg(`${o.name} est à terre !`, 'warn');
  if (o.jailed) return;
  // défaite : plus personne debout autour du combat
  const ref = o.pos;
  const upNear = team().filter(u => !(u.down > 0) && !u.jailed && d2(u.pos, ref) < 40);
  if (!upNear.length) { resolveDefeat(team().filter(u => u.down > 0 && d2(u.pos, ref) < 40), o.lastHitBy); return; }
  if (o === player) { takeControl(upNear[0]); logMsg(`Tu prends le contrôle de ${upNear[0].name}.`); }
}

// Changer de personnage contrôlé (comme dans Kenshi)
function takeControl(u) {
  if (!u || u === player || u.dead || !isPlayerSide(u)) return false;
  const old = player;
  if (old) {
    old.isPlayer = false;
    old.block = null; old.draw = -1; old.target = null; old.cmd = null; old.working = false;
    if (old.carrying) dropCarried(old);
    if (old.bar) old.bar.sp.visible = true;
    u.inv = old.inv; old.inv = [];
  }
  u.isPlayer = true;
  u.cmd = null; u.assignedNode = null; u.target = null;
  if (u.bar) u.bar.sp.visible = false;
  player = u;
  if (typeof cam !== 'undefined') { cam.yaw = u.yaw; cam.init = false; }
  state.harvest = null;
  return true;
}

// ---------- Flèches ----------
const arrows = [];
const arrowGeo = new T.BoxGeometry(0.03, 0.03, 0.8);
function fireArrow(u, from, dir, speed, dmg) {
  const m = new T.Mesh(arrowGeo, mat('#6b4a2b'));
  m.position.copy(from);
  scene.add(m);
  arrows.push({ m, pos: m.position, vel: dir.clone().multiplyScalar(speed), owner: u, dmg, life: 5, stuck: false });
  sfx('bow', from);
  trainSkill(u, 'arc', 0.4);
}
const GRAV = 4;
const _v = new T.Vector3();
function updateArrows(dt) {
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i];
    a.life -= dt;
    if (a.life <= 0) { scene.remove(a.m); arrows.splice(i, 1); continue; }
    if (a.stuck) continue;
    a.vel.y -= GRAV * dt;
    const prev = { x: a.pos.x, z: a.pos.z };
    a.pos.addScaledVector(a.vel, dt);
    const ground = heightAt(a.pos.x, a.pos.z);
    if (wallBetween(prev, a.pos) || (a.pos.y < ground + 4.6 && ringBetween(prev, a.pos))) {
      a.pos.x = prev.x; a.pos.z = prev.z;
      a.stuck = true; a.life = Math.min(a.life, 6);
      sfx('thunk', a.pos, 0.7);
      burst(a.pos, { n: 5, color: ['#b09070', '#8a7050'], speed: 2, up: 1, life: 0.4, size: 0.05 });
      continue;
    }
    a.m.lookAt(_v.copy(a.pos).add(a.vel));
    let hit = false;
    for (const o of units) {
      if (!alive(o) || !canHit(a.owner, o)) continue;
      if (!isPlayerSide(a.owner) && !hostile(a.owner, o)) continue;
      const h = o.animal ? 1.2 * o.species.size : 1.9 * (o.look.height || 1);
      const r = o.animal ? 0.6 * o.species.size : 0.45;
      if (Math.hypot(a.pos.x - o.pos.x, a.pos.z - o.pos.z) < r && a.pos.y > o.pos.y && a.pos.y < o.pos.y + h) {
        const head = !o.animal && a.pos.y > o.pos.y + h * 0.85;
        damage(o, a.owner, a.dmg * (head ? 1.6 : 1) * (1 + sk(a.owner, 'arc') / 100) * rand(0.9, 1.1), null, true);
        trainSkill(a.owner, 'arc', 1, o);
        if (head && a.owner.isPlayer) floatText(o.pos, 'Tête !', '#ffe066');
        hit = true;
        break;
      }
    }
    if (hit) { scene.remove(a.m); arrows.splice(i, 1); continue; }
    if (a.pos.y < heightAt(a.pos.x, a.pos.z)) { a.stuck = true; a.life = Math.min(a.life, 6); }
  }
}
function aimVelocity(from, to, speed) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const dist = Math.hypot(dx, dy, dz);
  const t = dist / speed;
  const v = new T.Vector3(dx / t, dy / t + 0.5 * GRAV * t, dz / t);
  const s = v.length();
  return { dir: v.divideScalar(s), speed: s };
}

// ---------- Déplacements ----------
// point de passage : porte de la ville, porte d'un bâtiment, ou coin pour contourner
function localOf(b, p) {
  const dx = p.x - b.c.x, dz = p.z - b.c.z, c = Math.cos(b.yaw), sn = Math.sin(b.yaw);
  return { x: dx * c - dz * sn, z: dx * sn + dz * c };
}
function routeVia(u, t) {
  const g = ringRoute(u.pos, t);
  return buildingRoute(u.pos, g || t) || g;
}
function ringRoute(p, t) {
  for (const s of state.settlements) {
    if (!hasRing(s) || Math.abs(p.x - s.x) > s.r + 80 || Math.abs(p.z - s.z) > s.r + 80) continue;
    if (!ringBetween(p, t)) continue;
    const dp = Math.hypot(p.x - s.x, p.z - s.z), dt = Math.hypot(t.x - s.x, t.z - s.z);
    const gin = gatePos(s, 3.5), gout = gatePos(s, -4);
    // dedans : rejoindre la porte puis sortir
    if (dp < s.r) return d2(p, gin) < 2.5 ? gout : gin;
    if (dt < s.r && d2(p, gout) < 2.5) return gin;
    // dehors : longer le mur vers la porte (pour entrer) ou vers la cible (pour passer de l'autre côté)
    const ap = Math.atan2(p.z - s.z, p.x - s.x);
    const aim = dt < s.r ? s.gate : Math.atan2(t.z - s.z, t.x - s.x);
    const diff = angleDiff(ap, aim);
    if (Math.abs(diff) > 0.4 || dt >= s.r) {
      const a = ap + Math.sign(diff) * Math.min(0.4, Math.abs(diff)), r = Math.max(dp, s.r + 4.5);
      return { x: s.x + Math.cos(a) * r, z: s.z + Math.sin(a) * r };
    }
    return gout;
  }
  return null;
}
// ligne « épaisse » : le passage doit laisser la place au corps
function fatWall(a, b, w = 0.55) {
  if (wallBetween(a, b)) return true;
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1;
  const ox = -dz / d * w, oz = dx / d * w;
  return wallBetween({ x: a.x + ox, z: a.z + oz }, { x: b.x + ox, z: b.z + oz }) || wallBetween({ x: a.x - ox, z: a.z - oz }, { x: b.x - ox, z: b.z - oz });
}
function buildingRoute(p, t) {
  const s = settlementAt(p, 3) || settlementAt(t, 3);
  if (!s || !s.buildings || !fatWall(p, t)) return null;
  const bu = s.buildings.find(b => d2(b.c, p) < 14 && insideBuilding(b, p));
  const bt = s.buildings.find(b => d2(b.c, t) < 14 && insideBuilding(b, t));
  if (bu && bu !== bt) { // sortir : s'aligner sur la porte puis passer
    const l = localOf(bu, p);
    return Math.abs(l.x) < 0.6 ? bu.W(0, bu.hd + 1.6) : bu.W(0, Math.min(l.z, bu.hd - 0.9));
  }
  const b = bt || s.buildings.find(b => d2(b.c, p) < 16 && insideBuilding({ ...b, hw: b.hw + 1.4, hd: b.hd + 1.4 }, p));
  if (!b) return null;
  const l = localOf(b, p);
  if (bt && l.z > b.hd && Math.abs(l.x) < 0.7) return b.W(0, b.hd - 1); // devant la porte : entrer
  // contourner par les coins jusqu'à la porte (entrer) ou jusqu'à la cible
  const ex = b.hw + 1.6, ez = b.hd + 1.6;
  const goal = bt ? b.W(0, b.hd + 1.6) : t;
  if (!fatWall(p, goal)) return goal;
  // collé au mur : d'abord s'en écarter pour longer le bâtiment sans frotter
  if (Math.abs(l.x) < ex - 0.3 && Math.abs(l.z) < ez - 0.3) {
    const gaps = [[ex - Math.abs(l.x), Math.sign(l.x) * ex, l.z], [ez - Math.abs(l.z), l.x, Math.sign(l.z) * ez]];
    const [, x, z] = gaps[0][0] < gaps[1][0] ? gaps[0] : gaps[1];
    return b.W(x, z);
  }
  const cands = [[-ex, -ez], [ex, -ez], [-ex, ez], [ex, ez]].map(([x, z]) => b.W(x, z));
  let best = null, bc = Infinity;
  for (const c of cands) {
    if (d2(p, c) < 1.5 || fatWall(p, c)) continue;
    const cost = d2(p, c) + d2(c, goal);
    if (cost < bc) { bc = cost; best = c; }
  }
  return best;
}
function steer(u, tx, tz, dt, speedMul = 1, stop = 0.3) {
  let via = false;
  if (!u.isPlayer) {
    // coincé contre un obstacle : petit détour sur le côté
    if (u.lastSteer && u.moving > 0) {
      const moved = Math.hypot(u.pos.x - u.lastSteer.x, u.pos.z - u.lastSteer.z);
      u.stuckT = moved < (u.lastStepLen || 0) * 0.3 ? (u.stuckT || 0) + dt : Math.max(0, (u.stuckT || 0) - dt);
    }
    u.lastSteer = { x: u.pos.x, z: u.pos.z };
    // aucun progrès vers la cible depuis 2 s : on tente un détour
    const dGoal = Math.hypot(tx - u.pos.x, tz - u.pos.z);
    const pr = u.prog;
    if (!pr || Math.hypot(pr.tx - tx, pr.tz - tz) > 3) u.prog = { tx, tz, best: dGoal, t: 0 };
    else if (dGoal < pr.best - 0.5) { pr.best = dGoal; pr.t = 0; }
    else if (dGoal > stop + 0.5 && (pr.t += dt) > 2) { pr.t = 0; pr.best = dGoal; u.stuckT = 1; u.wp = null; }
    if (u.stuckT > 0.5 && !(u.detour && u.detour.t > 0)) {
      const a = Math.atan2(tx - u.pos.x, tz - u.pos.z) + (u.detourSide = -(u.detourSide || 1)) * rand(1.2, 1.9);
      const len = rand(3, 6);
      u.detour = { x: u.pos.x + Math.sin(a) * len, z: u.pos.z + Math.cos(a) * len, t: 1.5 };
      u.stuckT = 0;
    }
    if (u.detour && u.detour.t > 0) {
      u.detour.t -= dt;
      if (d2(u.pos, u.detour) > 0.4) { tx = u.detour.x; tz = u.detour.z; stop = 0.2; via = true; }
      else u.detour.t = 0;
    } else if (!u.animal) {
      // on garde le point de passage choisi jusqu'à l'atteindre (évite d'hésiter entre deux chemins)
      let w = u.wp;
      if (w && (w.t <= 0 || d2(w, u.pos) < 0.45 || Math.hypot(w.tx - tx, w.tz - tz) > 3)) w = u.wp = null;
      if (!w) {
        const r = routeVia(u, { x: tx, z: tz });
        if (r) w = u.wp = { x: r.x, z: r.z, t: 3, tx, tz };
      }
      if (w) { w.t -= dt; tx = w.x; tz = w.z; stop = 0.2; via = true; }
    }
  }
  const dx = tx - u.pos.x, dz = tz - u.pos.z;
  const d = Math.hypot(dx, dz);
  if (d <= stop) { u.moving = 0; return !via; }
  u.yaw = turnToward(u.yaw, Math.atan2(dx, dz), dt * 8);
  const step = Math.min(d - stop + 0.01, speedOf(u) * speedMul * dt);
  u.lastStepLen = step;
  const nx = u.pos.x + dx / d * step, nz = u.pos.z + dz / d * step;
  const f = F(u.faction);
  // bêtes et bandits restent hors des villes, sauf les bandits en raid ou chez eux
  const raider = u.party && u.party.kind === 'army';
  if ((u.animal || (f && f.bandit && !raider && !u.guardOf)) && !settlementAt(u.pos, 6)) {
    const st = settlementAt({ x: nx, z: nz }, 6);
    if (st && (u.animal || st.faction !== u.faction)) { u.moving = 0; return false; }
  }
  u.pos.x = nx; u.pos.z = nz;
  u.moving = speedMul;
  return false;
}

function collide(u) {
  for (const o of obstaclesNear(u.pos.x, u.pos.z)) {
    const dx = u.pos.x - o.x, dz = u.pos.z - o.z;
    if (Math.abs(dx) > o.r + 1 || Math.abs(dz) > o.r + 1) continue;
    const d = Math.hypot(dx, dz);
    const min = o.r + 0.4;
    if (d < min && d > 0.001) { u.pos.x = o.x + dx / d * min; u.pos.z = o.z + dz / d * min; }
  }
  for (const s of state.settlements) {
    if (s.type === 'repaire' || s.type === 'base') continue;
    const dx = u.pos.x - s.x, dz = u.pos.z - s.z;
    const d = Math.hypot(dx, dz);
    const gap = s.type === 'ville' ? 0.15 : 0.22;
    if (Math.abs(d - s.r) < 1.1 && Math.abs(angleDiff(Math.atan2(dz, dx), s.gate)) > gap * 34 / s.r) {
      const nr = d < s.r ? s.r - 1.1 : s.r + 1.1;
      u.pos.x = s.x + dx / d * nr; u.pos.z = s.z + dz / d * nr;
    }
  }
  pushOutOfWalls(u);
  u.pos.x = clamp(u.pos.x, -HALF, HALF);
  u.pos.z = clamp(u.pos.z, -HALF, HALF);
}

function separate() {
  const live = units.filter(u => !u.dead && !(u.down > 0));
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      if (Math.abs(dx) > 0.8 || Math.abs(dz) > 0.8) continue;
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
  const f = F(u.faction);
  const avoidTowns = (f && f.bandit && !(u.party && u.party.kind === 'army') && !u.guardOf) || u.animal;
  for (const o of units) {
    // les civils hors des villes (ouvriers, porteurs, voyageurs) sont des proies pour les bandits et les ennemis
    if (!alive(o) || o === u || o.jailed || !hostile(u, o)) continue;
    if (o.civil && !u.animal && (isPlayerSide(u) || settlementAt(o.pos, 2))) continue;
    if (avoidTowns) { const st = settlementAt(o.pos, 2); if (st && st.type !== 'repaire' && st.faction !== u.faction) continue; }
    const d = d2(from, o.pos);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

// ---------- IA de combat ----------
function setMode(u, mode) {
  if (u.mode === mode) return;
  u.mode = mode;
  u.draw = -1;
  dressUnit(u);
}
function setSheathed(u, v) {
  if (u.sheathed === v) return;
  u.sheathed = v;
  if (v) { u.block = null; u.draw = -1; }
  dressUnit(u);
}

function fight(u, e, dt) {
  if (u.sheathed) setSheathed(u, false);
  u.idleT = 0;
  const d = d2(u.pos, e.pos);
  const bow = bowOf(u);
  const angle = Math.atan2(e.pos.x - u.pos.x, e.pos.z - u.pos.z);
  const ammo = isPlayerSide(u) ? Math.max(u.arrows, 0) : u.arrows;
  if (bow && ammo > 0 && d > 7 && d < bow.range * 0.85) {
    setMode(u, 'bow');
    u.moving = 0;
    u.yaw = turnToward(u.yaw, angle, dt * 8);
    if (u.draw < 0) u.draw = 0;
    u.draw += dt;
    if (u.draw >= bow.draw * 1.4) {
      const from = new T.Vector3(u.pos.x, u.pos.y + 1.5, u.pos.z);
      const to = new T.Vector3(e.pos.x + rand(-0.8, 0.8) * d / 20, e.pos.y + 1.0 + rand(-0.4, 0.4), e.pos.z + rand(-0.8, 0.8) * d / 20);
      const aim = aimVelocity(from, to, 42);
      fireArrow(u, from, aim.dir, aim.speed, bow.dmg + u.str * 0.3);
      u.arrows--;
      u.draw = 0;
    }
    return;
  }
  setMode(u, 'melee');
  const reach = weaponOf(u).reach;
  const run = u.animal ? 1 : 1.3;
  if (d > reach - 0.2) steer(u, e.pos.x, e.pos.z, dt, run, reach - 0.4);
  else {
    u.moving = 0;
    u.yaw = turnToward(u.yaw, angle, dt * 8);
    if (Math.abs(angleDiff(u.yaw, angle)) < 0.5) startAttack(u);
  }
}

function pickTarget(u, range, from) {
  const e = nearestHostile(u, range, from);
  if (e && (!u.target || d2(u.pos, e.pos) < d2(u.pos, u.target.pos) - 3)) u.target = e;
}

// ordres donnés par le joueur (vue tactique ou touches 1 à 5)
function runCommand(u, dt) {
  const c = u.cmd;
  if (c.type === 'move') {
    if (steer(u, c.x, c.z, dt, state.run ? 1.6 : 1, 0.5)) {
      if (c.loot && c.loot.loot && !lootEmpty(c.loot.loot) && u.isPlayer) { state.lootTarget = c.loot; openPanel('loot'); }
      u.cmd = u.isPlayer ? null : { type: 'hold', x: c.x, z: c.z };
    }
    return true;
  }
  if (c.type === 'attack') {
    if (!alive(c.target)) { u.cmd = null; return false; }
    u.target = c.target;
    if (!isPlayerSide(c.target) && !hostile(u, c.target) && !c.target.animal) playerAttacked(c.target.faction);
    fight(u, c.target, dt);
    return true;
  }
  if (c.type === 'hold') {
    const e = nearestHostile(u, 9, c);
    if (e) { fight(u, e, dt); return true; }
    steer(u, c.x, c.z, dt, 1, 0.5);
    return true;
  }
  return false;
}

function updatePlayerSideAI(u, dt, idx) {
  if (u.jailed) { u.moving = 0; return; }
  if (u.cmd && runCommand(u, dt)) return;
  if (u.isPlayer) return; // le personnage contrôlé ne bouge que sur ordre
  u.idleT = (u.idleT || 0) + dt;
  if (u.idleT > 6 && !u.sheathed && !u.target) setSheathed(u, true);
  if (u.target && (!alive(u.target) || !hostile(u, u.target) || d2(u.pos, u.target.pos) > 70)) u.target = null;
  u.retarget -= dt;
  if (u.retarget <= 0) {
    u.retarget = rand(0.4, 0.7);
    if (u.assignedNode != null) pickTarget(u, 15);
    else if (state.order === 'charge') pickTarget(u, 90);
    else if (state.order === 'follow') {
      const e = nearestHostile(u, 18);
      if (e && d2(e.pos, player.pos) < 28 && !u.target) u.target = e;
    } else if (state.order === 'close') {
      const e = nearestHostile(u, 6);
      if (e && !u.target) u.target = e;
    }
  }
  if (state.order === 'close' && u.target && d2(u.target.pos, player.pos) > 10) u.target = null;
  if (u.target) { u.heal = null; fight(u, u.target, dt); return; }
  setMode(u, 'melee');
  if (autoHeal(u, dt)) return;
  if (squadBuildTask(u, dt)) return;
  if (u.assignedNode != null && updateAssignedWorker(u, dt)) return;
  const row = Math.floor(idx / 3), col = (idx % 3) - 1;
  const spacing = state.order === 'close' ? 1.2 : 1.6;
  const back = (state.order === 'close' ? 1.6 : 2.5) + row * spacing, side = col * spacing, py = player.yaw;
  const tx = player.pos.x - Math.sin(py) * back - Math.cos(py) * side;
  const tz = player.pos.z - Math.cos(py) * back + Math.sin(py) * side;
  const far = Math.hypot(tx - u.pos.x, tz - u.pos.z);
  steer(u, tx, tz, dt, far > 5 || state.run ? 1.7 : 1, 0.5);
}

// soins automatiques : un membre de l'escouade relève les blessés quand le danger est passé
function autoHeal(u, dt) {
  if (u.jailed || u.carrying) return false;
  if (!u.heal) {
    u.healCheck = (u.healCheck || 0) - dt;
    if (u.healCheck > 0) return false;
    u.healCheck = 1;
    if (state.goods.kits <= 0 || nearestHostile(u, 16)) return false;
    const busy = o => team().some(m => m !== u && m.heal && m.heal.o === o);
    let o = team().find(m => m.down > 0 && !m.jailed && !m.carriedBy && d2(m.pos, u.pos) < 30 && !busy(m));
    if (!o) o = team().filter(m => !(m.down > 0) && !m.jailed && m.hp < m.maxHp * 0.5 && d2(m.pos, u.pos) < 30 && !busy(m)).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (!o) return false;
    u.heal = { o, t: 0 };
  }
  const h = u.heal, o = h.o;
  if (state.goods.kits <= 0 || o.dead || o.jailed || o.carriedBy || (!(o.down > 0) && o.hp >= o.maxHp * 0.9) || nearestHostile(u, 12)) { u.heal = null; u.working = false; return false; }
  if (o !== u && d2(o.pos, u.pos) > 1.4) { u.working = false; steer(u, o.pos.x, o.pos.z, dt, 1.4, 1.2); return true; }
  if (o !== u) u.yaw = turnToward(u.yaw, Math.atan2(o.pos.x - u.pos.x, o.pos.z - u.pos.z), dt * 8);
  u.moving = 0; u.working = true;
  h.t += dt;
  if (h.t < 2.6 - sk(u, 'soins') * 0.018) return true;
  state.goods.kits--;
  const amt = 40 + sk(u, 'soins') * 0.8;
  if (o.down > 0) { o.down = 0; o.hp = Math.round(Math.max(o.maxHp * 0.3, Math.min(o.maxHp, amt))); logMsg(`🩹 ${u.name} relève ${o === u ? 'lui-même' : o.name}.`); }
  else o.hp = Math.min(o.maxHp, o.hp + amt);
  drawBar(o);
  floatText(o.pos, '+ soins', '#8fdc7a');
  sfx('heal', o.pos);
  burst({ x: o.pos.x, y: o.pos.y + 1, z: o.pos.z }, { n: 10, color: ['#9fe08a', '#d8ffd0'], speed: 1, up: 2, life: 0.8, size: 0.06, grav: -1 });
  trainSkill(u, 'soins', 2);
  u.heal = null; u.working = false;
  return true;
}

function updateAnimal(u, dt) {
  const sp = u.species;
  if (u.flee > 0) {
    u.flee -= dt;
    const dx = u.pos.x - u.fleeFrom.x, dz = u.pos.z - u.fleeFrom.z, d = Math.hypot(dx, dz) || 1;
    steer(u, u.pos.x + dx / d * 10, u.pos.z + dz / d * 10, dt, 1.2, 0.1);
    return;
  }
  if (u.target && (!alive(u.target) || d2(u.target.pos, u.home) > 90)) { u.target = null; u.angryAt = null; }
  u.retarget -= dt;
  if (u.retarget <= 0) {
    u.retarget = rand(0.5, 1);
    if (sp.pred) {
      const night = typeof isNight === 'function' && isNight();
      pickTarget(u, night ? 32 : 22);
    } else {
      // le gibier fuit ce qui approche
      for (const o of units) {
        if (!alive(o) || o.species === sp || o.civil) continue;
        if ((isPlayerSide(o) || o.faction === 'predateur') && d2(o.pos, u.pos) < (o.faction === 'predateur' ? 18 : 12)) {
          if (sp.fights && isPlayerSide(o) && Math.random() < 0.3) { u.angryAt = o; u.target = o; }
          else { u.flee = 5; u.fleeFrom = { x: o.pos.x, z: o.pos.z }; }
          break;
        }
      }
    }
  }
  if (u.target) { fight(u, u.target, dt); return; }
  // errance autour du territoire
  if (!u.wander || d2(u.pos, u.wander) < 1.5) {
    u.pause = (u.pause || 0) - dt;
    u.moving = 0;
    if (u.pause > 0) return;
    u.pause = rand(2, 6);
    u.wander = { x: u.home.x + rand(-20, 20), z: u.home.z + rand(-20, 20) };
  }
  steer(u, u.wander.x, u.wander.z, dt, 0.3, 1);
}

function updateNPC(u, dt, idx) {
  if (u.civil) { updateCivil(u, dt); return; }
  if (u.animal) { updateAnimal(u, dt); return; }
  u.working = false;
  if (isPlayerSide(u) && !u.guardOf) { updatePlayerSideAI(u, dt, idx); return; }
  u.retarget -= dt;
  if (u.target && (!alive(u.target) || u.target.jailed || !hostile(u, u.target) || d2(u.pos, u.target.pos) > 70)) u.target = null;
  const fac = F(u.faction);
  if (fac && fac.bandit && u.target && !u.guardOf && !(u.party && u.party.kind === 'army')) {
    const st = settlementAt(u.target.pos, 2);
    if (st && st.type !== 'repaire' && st.faction !== u.faction) u.target = null;
  }
  if (u.retarget <= 0) {
    u.retarget = rand(0.4, 0.7);
    if (u.guardOf) pickTarget(u, 35, u.home);
    else pickTarget(u, u.archer ? 45 : (u.party && u.party.aggro ? 40 : 26));
  }
  if (u.guardOf && u.target && d2(u.target.pos, u.home) > 55) u.target = null;
  if (u.target) { fight(u, u.target, dt); return; }
  setMode(u, 'melee');
  if (u.guardOf) {
    if (steer(u, u.home.x, u.home.z, dt, 1, 0.4)) u.yaw = turnToward(u.yaw, u.home.yaw, dt * 4);
    return;
  }
  if (u.party) {
    const p = u.party;
    const leader = p.units.find(alive);
    if (u === leader) steer(u, p.dest.x, p.dest.z, dt, p.kind === 'army' ? 0.75 : 0.6, 2);
    else if (leader) {
      const slot = p.units.indexOf(u);
      const row = Math.floor(slot / 3) + 1, col = (slot % 3) - 1;
      const py = leader.yaw;
      const tx = leader.pos.x - Math.sin(py) * row * 1.8 - Math.cos(py) * col * 1.8;
      const tz = leader.pos.z - Math.cos(py) * row * 1.8 + Math.sin(py) * col * 1.8;
      const far = Math.hypot(tx - u.pos.x, tz - u.pos.z);
      steer(u, tx, tz, dt, far > 4 ? 1.2 : 0.65, 0.5);
    }
  }
}

// ---------- Animation ----------
const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
function animate(u, dt) {
  const c = u.c;
  if (c.skinned) { animateSkinned(u, dt); return; }
  c.root.rotation.y = u.yaw;
  const down = u.dead || u.down > 0 || (u.isPlayer && state.ko > 0);
  if (u.animal) {
    c.body.rotation.z = down ? Math.min(c.body.rotation.z + dt * 4, Math.PI / 2) : 0;
    if (down) return;
    u.walk += dt * (u.moving ? 8 + u.moving * 6 : 0);
    const sw = u.moving ? Math.sin(u.walk) * 0.6 : 0;
    c.armL.rotation.x = sw; c.legR.rotation.x = sw; c.armR.rotation.x = -sw; c.legL.rotation.x = -sw;
    const lunge = u.atk ? Math.sin(clamp(u.atk.t / u.atk.total, 0, 1) * Math.PI) : 0;
    c.body.position.z = lunge * 0.5;
    c.head.rotation.x = -lunge * 0.4;
    c.tail.rotation.y = Math.sin(performance.now() / 300 + u.id) * 0.3;
  } else {
    c.body.rotation.x = down ? Math.max(c.body.rotation.x - dt * 4, -Math.PI / 2) : 0;
    if (down) { c.body.rotation.y = 0; c.body.position.y = 0; return; }
    // roulade d'esquive
    if (u.dodge) {
      const p = clamp(u.dodge.t / u.dodge.dur, 0, 1);
      c.body.rotation.x = p * Math.PI * 2 * (u.dodge.back ? -1 : 1);
      c.body.position.y = Math.sin(p * Math.PI) * 0.35;
      c.legL.rotation.x = c.legR.rotation.x = -1.2 * Math.sin(p * Math.PI);
      c.armL.rotation.x = c.armR.rotation.x = -1.4 * Math.sin(p * Math.PI);
      return;
    }
    c.body.position.y = 0;
    // recul quand on encaisse, élan vers l'avant pendant un coup
    if (u.flinch > 0) { u.flinch -= dt; c.body.rotation.x = -Math.sin(u.flinch / 0.25 * Math.PI) * 0.35; }
    else if (u.atk) {
      const a = u.atk, p = a.t / a.windup;
      c.body.rotation.x = p < 1 ? -0.12 * p : 0.25 * Math.max(0, 1 - (a.t - a.windup) / (a.total - a.windup));
    }
    u.walk += dt * (u.moving ? 6 + u.moving * 4 : 0);
    const sw = u.moving ? Math.sin(u.walk) * 0.7 : 0;
    c.legL.rotation.x = sw; c.legR.rotation.x = -sw;
    let aL = -sw * 0.6, aLz = 0, aR = -0.5 + sw * 0.3, aRz = 0, twist = 0;
    if (u.mode === 'bow') {
      aL = -1.5; aLz = -0.1;
      if (u.draw >= 0) { aR = -1.5; aRz = 0.35; } else aR = -0.4;
    } else if (u.atk) {
      const a = u.atk, p = a.t < a.windup ? a.t / a.windup : 1 + (a.t - a.windup) / (a.total - a.windup);
      switch (a.dir) {
        case 'haut': aR = p < 1 ? lerp(-0.5, -2.8, p) : lerp(-2.8, -0.6, p - 1); aRz = -0.3; break;
        case 'estoc':
          if (isFists(u)) {
            const punch = p < 1 ? lerp(-0.9, -0.4, p) : lerp(-0.4, -1.65, Math.min(1, (p - 1) * 3)) + Math.max(0, (p - 1.5)) * 1.2;
            if (u.combo === 1) { aL = punch; aR = -1.0; twist = p < 1 ? lerp(0, 0.3, p) : lerp(0.3, -0.35, p - 1); }
            else { aR = punch; aL = -1.0; twist = p < 1 ? lerp(0, -0.3, p) : lerp(-0.3, 0.35, p - 1); }
          } else aR = p < 1 ? lerp(-0.5, 0.5, p) : lerp(0.5, -1.6, (p - 1) * 2);
          break;
        case 'gauche': aR = -1.5; twist = p < 1 ? lerp(0, 1.0, p) : lerp(1.0, -0.9, p - 1); break;
        case 'droite': aR = -1.5; aRz = 0.4; twist = p < 1 ? lerp(0, -1.0, p) : lerp(-1.0, 0.9, p - 1); break;
      }
    } else if (u.block) {
      switch (u.block.dir) {
        case 'haut': aR = -2.6; aRz = 0.9; break;
        case 'gauche': aR = -1.2; aRz = 0.6; twist = 0.5; break;
        case 'droite': aR = -1.2; aRz = -0.2; twist = -0.5; break;
        default: aR = -0.9; aRz = 0.9;
      }
      aL = -1.0;
    }
    if (u.working && !u.atk) {
      u.walk += dt * 3;
      aR = -1.2 - Math.sin(u.walk * 1.5) * 1.1; aL = -0.6 - Math.sin(u.walk * 1.5) * 0.4;
    }
    c.armL.rotation.x = aL; c.armL.rotation.z = aLz;
    c.armR.rotation.x = aR; c.armR.rotation.z = aRz;
    u.twist += (twist - u.twist) * Math.min(1, dt * 20);
    c.body.rotation.y = u.twist;
  }
  u.hurt -= dt;
  const flash = u.hurt > 0 ? 0.6 : 0;
  for (const m of c.hurtMats) m.emissive.setRGB(flash, 0, 0);
  // étiquette de nom à moins de 14 m
  if (player) {
    const near = d2(u.pos, player.pos) < 14 && !u.isPlayer && !u.dead;
    if (near && !u.label && (!u.civil || u.task)) makeLabel(u);
    if (u.label) u.label.visible = near;
  }
}

// ---------- Mise à jour des combattants ----------
function updateUnits(dt) {
  const sq = squad();
  for (const u of units) {
    if (u.dead) { u.deadTime += dt; continue; }
    if (u.down > 0) {
      if (u.carriedBy) continue;
      u.down -= dt;
      if (u.down <= 0) {
        if (isPlayerSide(u)) { u.hp = Math.round(u.maxHp * 0.25); drawBar(u); logMsg(`${u.name} se relève.`); }
        else npcWake(u);
      }
      continue;
    }
    u.atkCd -= dt;
    if (u.stagger > 0) u.stagger -= dt;
    if (!u.isPlayer && u.block) { u.block.t -= dt; if (u.block.t <= 0) u.block = null; }
    if (u.atk) {
      u.atk.t += dt;
      if (!u.atk.hit && u.atk.t >= u.atk.windup) { u.atk.hit = true; resolveHit(u); }
      if (u.atk && u.atk.t >= u.atk.total) u.atk = null;
    }
    if (!u.isPlayer || u.cmd) updateNPC(u, dt, sq.indexOf(u));
    u.pos.x += u.knock.x * dt; u.pos.z += u.knock.z * dt;
    u.knock.x *= 0.85; u.knock.z *= 0.85;
  }
  separate();
  for (const u of units) if (!u.dead && !u.carriedBy) { collide(u); u.pos.y = heightAt(u.pos.x, u.pos.z); }
  for (let i = units.length - 1; i >= 0; i--) {
    if (units[i].dead && units[i].deadTime > 120) removeUnit(units[i]);
  }
}
