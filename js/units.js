// Terres Arides — personnages, animaux, équipement, combat, flèches, IA.
'use strict';

// ---------- Modèle 3D d'un humain ----------
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
    const p = box(w, h, w, m);
    p.position.y = -h / 2;
    pivot.add(p);
    body.add(pivot);
    return pivot;
  };
  const legL = limb(-0.14, 0.9, 0.19, 0.9, mPants);
  const legR = limb(0.14, 0.9, 0.19, 0.9, mPants);
  const torso = box(0.52, 0.66, 0.3, mBody);
  torso.position.y = 1.24;
  body.add(torso);
  const tabard = box(0.36, 0.7, 0.02, own('#ffffff'));
  tabard.position.set(0, 1.2, 0.16);
  tabard.visible = false;
  body.add(tabard);
  const head = box(0.3, 0.32, 0.3, mSkin);
  head.position.y = 1.76;
  body.add(head);
  const headSlot = new T.Group();
  headSlot.position.y = 1.76;
  body.add(headSlot);
  const armL = limb(-0.34, 1.52, 0.14, 0.62, mBody);
  const armR = limb(0.34, 1.52, 0.14, 0.62, mBody);
  const weaponSlot = new T.Group();
  weaponSlot.position.y = -0.6;
  armR.add(weaponSlot);
  const bowSlot = new T.Group();
  bowSlot.position.y = -0.6;
  armL.add(bowSlot);
  const backSlot = new T.Group();
  backSlot.position.set(0, 1.2, -0.2);
  body.add(backSlot);
  const hipSlot = new T.Group();
  hipSlot.position.set(0.3, 0.98, 0.02);
  hipSlot.rotation.x = Math.PI * 0.62;
  body.add(hipSlot);
  return { root, body, legL, legR, armL, armR, torso, tabard, headSlot, weaponSlot, bowSlot, backSlot, hipSlot, mBody, mSkin, mPants, hurtMats: [mBody, mSkin] };
}

// ---------- Modèle 3D d'un animal (quadrupède) ----------
function makeAnimalModel(sp) {
  const root = new T.Group();
  const body = new T.Group();
  body.scale.setScalar(sp.size);
  root.add(body);
  const m = new T.MeshStandardMaterial({ color: sp.color, flatShading: true, roughness: 0.95 });
  const dark = new T.MeshStandardMaterial({ color: '#1a1410', flatShading: true });
  const box = (w, h, d, mm, x, y, z) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), mm); b.position.set(x, y, z); b.castShadow = true; return b; };
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
    pivot.add(box(0.11, legH, 0.11, m, 0, -legH / 2, 0));
    body.add(pivot);
    return pivot;
  };
  const armL = leg(-0.18, 0.38), armR = leg(0.18, 0.38), legL = leg(-0.18, -0.38), legR = leg(0.18, -0.38);
  const dummy = () => new T.Group();
  return { root, body, legL, legR, armL, armR, torso, head: headG, tail, tabard: { visible: false, material: { color: new T.Color() } },
    headSlot: dummy(), weaponSlot: dummy(), bowSlot: dummy(), backSlot: dummy(), hipSlot: dummy(), mBody: m, mSkin: m, hurtMats: [m] };
}

function clearGroup(g) { while (g.children.length) g.remove(g.children[0]); }
function part(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color));
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
    case 'blade': g.add(part(0.05, 0.05, L, it.color, 0, 0, L / 2 + 0.1), part(0.25, 0.05, 0.05, '#5a4630', 0, 0, 0.08)); break;
    case 'staff': g.add(part(0.06, 0.06, L, it.color, 0, 0, L / 2 - 0.4)); break;
    case 'mace': g.add(part(0.05, 0.05, L, '#5a4630', 0, 0, L / 2), part(0.17, 0.17, 0.22, it.color, 0, 0, L)); break;
    case 'axe': g.add(part(0.05, 0.05, L, '#5a4630', 0, 0, L / 2), part(0.04, 0.32, 0.26, it.color, 0, 0.12, L - 0.1)); break;
    case 'spear': {
      g.add(part(0.05, 0.05, L, '#6e5538', 0, 0, L / 2 - 0.5));
      const tip = new T.Mesh(new T.ConeGeometry(0.06, 0.3, 4), mat(it.color));
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
    case 'band': g.add(part(0.32, 0.08, 0.32, facColor || '#a01e1e', 0, 0.08, 0)); break;
    case 'hood': g.add(part(0.36, 0.3, 0.36, facColor || '#6b5536', 0, 0.06, -0.03), part(0.42, 0.5, 0.06, facColor || '#6b5536', 0, -0.35, -0.2)); break;
    case 'turban': g.add(part(0.36, 0.16, 0.36, facColor || '#ece2cc', 0, 0.14, 0), part(0.2, 0.08, 0.2, facColor || '#ece2cc', 0, 0.25, 0)); break;
    case 'cap': g.add(part(0.34, 0.14, 0.34, it.color, 0, 0.13, 0)); break;
    case 'helm': g.add(part(0.36, 0.2, 0.36, it.color, 0, 0.1, 0), part(0.04, 0.16, 0.04, it.color, 0, -0.04, 0.17)); break;
    case 'greathelm': g.add(part(0.38, 0.4, 0.38, it.color, 0, 0.02, 0), part(0.26, 0.04, 0.02, '#111', 0, 0.04, 0.19)); break;
  }
  return g;
}

// Habille un personnage selon son équipement et sa faction
function dressUnit(u) {
  if (u.animal) return;
  const c = u.c;
  const fac = u.faction === 'player' ? (state.allegiance ? F(state.allegiance) : null) : F(u.faction);
  const armor = IT(u.equip.armor);
  c.mBody.color.set(armor && armor.color ? armor.color : u.look.body);
  const showTabard = fac && fac.outfit && fac.outfit.tabard && (u.faction !== 'player' || u.isPlayer || u.sworn);
  c.tabard.visible = !!showTabard;
  if (showTabard) {
    const torso = '#' + c.mBody.color.getHexString();
    c.tabard.material.color.set(fac.colors[0].toLowerCase() === torso ? fac.colors[1] : fac.colors[0]);
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
    if (u.equip.weapon) (u.sheathed ? c.hipSlot : c.weaponSlot).add(buildWeapon(u.equip.weapon));
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
const squad = () => units.filter(u => u.faction === 'player' && !u.isPlayer && !u.dead);
const team = () => units.filter(u => u.faction === 'player' && !u.dead);
const displayName = u => u.title ? `${u.title} ${u.name}` : u.name;

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
  const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), depthTest: false, transparent: true, sizeAttenuation: false }));
  sp.scale.set(0.16, 0.025, 1);
  sp.position.y = u.animal ? 1.6 * u.species.size : 2.55 * (u.look.height || 1);
  sp.renderOrder = 11;
  u.c.root.add(sp);
  u.label = sp;
}
function refreshLabel(u) { if (u.label) { u.c.root.remove(u.label); u.label = null; } }

function makeUnit(o) {
  const look = o.look || {};
  const c = o.species ? makeAnimalModel(o.species) : makeCharacter(look);
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
    skills: { forge: 0, couture: 0, bois: 0, recolte: 0, crochetage: 0, ...(o.skills || {}) },
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
const weaponOf = u => u.natural || IT(u.equip.weapon) || FIST;
const bowOf = u => IT(u.equip.bow) || null;
const armorOf = u => (IT(u.equip.armor) ? IT(u.equip.armor).armor : 0) + (IT(u.equip.helmet) ? IT(u.equip.helmet).armor : 0);
function speedOf(u) {
  let s = u.speedBase + (IT(u.equip.armor) && IT(u.equip.armor).speed || 0);
  if (isPlayerSide(u) && typeof overloaded === 'function' && overloaded()) s *= 0.6;
  if (isPlayerSide(u) && state.storm > 0 && biomeAt(u.pos.x, u.pos.z) === 'desert') s *= 0.8;
  return s;
}
const cooldownOf = u => weaponOf(u).cd * (1 - u.agi * 0.03);
const damageOf = u => Math.round(weaponOf(u).dmg + u.str);

// ---------- Relations ----------
function playerHostileTo(fid) {
  const f = F(fid);
  if (!f || fid === 'player') return false;
  if (f.bandit) return true;
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
// ton camp peut frapper tout le monde sauf lui-même
const canHit = (u, o) => o !== u && (isPlayerSide(u) ? !isPlayerSide(o) : hostile(u, o));

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
  u.atk = { t: 0, dir: dir || pick(Object.keys(DIRS)), windup, total: windup + 0.35, hit: false };
  u.atkCd = cooldownOf(u) + windup;
  const reach = weaponOf(u).reach;
  for (const o of units) {
    if (o === u || o.isPlayer || o.animal || !alive(o) || !canHit(u, o) || o.atk || o.mode === 'bow') continue;
    if (d2(u.pos, o.pos) > reach + 1.5 || facing(o, u) < 0.3) continue;
    if (Math.random() < o.blockChance) {
      const others = Object.keys(DIRS).filter(d => d !== u.atk.dir);
      o.block = { dir: Math.random() < o.blockSkill ? u.atk.dir : pick(others), t: windup + 0.6 };
    }
  }
  return true;
}

function resolveHit(u) {
  const w = weaponOf(u);
  let hits = 0;
  for (const o of units) {
    if (!alive(o) || !canHit(u, o)) continue;
    if (d2(u.pos, o.pos) > w.reach + 0.3 || facing(u, o) < 0.35) continue;
    if (!isPlayerSide(u) && !hostile(u, o)) continue;
    if (u.cmd && u.cmd.type === 'attack' && u.cmd.target !== o && !hostile(u, o)) continue;
    damage(o, u, damageOf(u) * rand(0.85, 1.15), u.atk.dir, false);
    if (++hits >= (u.isPlayer ? 2 : 1)) break;
  }
  if (!hits && u.isPlayer) floatText(u.pos, '~', '#ccc');
}

function damage(o, by, amount, dir, ranged) {
  if (!alive(o)) return;
  let blocked = false;
  if (!ranged && o.block && facing(o, by) > 0.3) {
    if (o.block.dir === dir || (o.isPlayer && !settings.directional) || (isPlayerSide(o) && !o.isPlayer)) {
      blocked = true;
      amount *= 0.08;
      floatText(o.pos, 'paré !', '#9fc3ff');
      by.stagger = 0.5;
      by.atkCd += 0.3;
    } else if (o.isPlayer) floatText(o.pos, 'mauvaise parade', '#ffb0a0');
  }
  amount *= Math.max(0.3, 1 - armorOf(o) * 0.055);
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
  if (isPlayerSide(by)) gainXp(by, 2);
  if (o.hp <= 0) kill(o, by);
}

function gainXp(u, n) {
  u.xp += n;
  const need = u.level * 40;
  if (u.xp < need) return;
  u.xp -= need;
  u.level++;
  u.maxHp += 10; u.hp = Math.min(u.maxHp, u.hp + 30); u.str += 1;
  floatText(u.pos, 'Niveau ' + u.level + ' !', '#7ad7ff');
  logMsg(`${u.name} passe niveau ${u.level}.`);
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
  // ton escouade n'est jamais tuée : elle tombe K.O. comme dans Kenshi
  if (isPlayerSide(o)) { downUnit(o); return; }
  // les humains tombent souvent K.O. au lieu de mourir (on peut les fouiller, les porter, les livrer)
  if (!o.animal && !o.civil && o.rank !== 'ruler' && !o.down && !o.noKO && Math.random() < 0.5) { npcDown(o); return; }
  o.dead = true;
  o.atk = null; o.block = null; o.draw = -1;
  if (o.bar) o.bar.sp.visible = false;
  if (o.label) o.label.visible = false;
  o.loot = makeLoot(o);
  if (o.guardOf) o.guardOf.garrison = Math.max(0, o.guardOf.garrison - 1);
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

function npcDown(o) {
  o.down = rand(40, 70); o.hp = 0;
  o.atk = null; o.block = null; o.draw = -1; o.target = null;
  if (o.bar) o.bar.sp.visible = false;
  o.loot = makeLoot(o);
  for (const u of units) if (u.target === o) u.target = null;
  floatText(o.pos, 'K.O.', '#ffd27a');
}
function npcWake(o) {
  o.down = 0;
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
    a.pos.addScaledVector(a.vel, dt);
    a.m.lookAt(_v.copy(a.pos).add(a.vel));
    let hit = false;
    for (const o of units) {
      if (!alive(o) || !canHit(a.owner, o)) continue;
      if (!isPlayerSide(a.owner) && !hostile(a.owner, o)) continue;
      const h = o.animal ? 1.2 * o.species.size : 1.9 * (o.look.height || 1);
      const r = o.animal ? 0.6 * o.species.size : 0.45;
      if (Math.hypot(a.pos.x - o.pos.x, a.pos.z - o.pos.z) < r && a.pos.y > o.pos.y && a.pos.y < o.pos.y + h) {
        const head = !o.animal && a.pos.y > o.pos.y + h * 0.85;
        damage(o, a.owner, a.dmg * (head ? 1.6 : 1) * rand(0.9, 1.1), null, true);
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
function steer(u, tx, tz, dt, speedMul = 1, stop = 0.3) {
  const dx = tx - u.pos.x, dz = tz - u.pos.z;
  const d = Math.hypot(dx, dz);
  if (d <= stop) { u.moving = 0; return true; }
  u.yaw = turnToward(u.yaw, Math.atan2(dx, dz), dt * 8);
  const step = Math.min(d - stop + 0.01, speedOf(u) * speedMul * dt);
  const nx = u.pos.x + dx / d * step, nz = u.pos.z + dz / d * step;
  const f = F(u.faction);
  if (((f && f.bandit) || u.animal) && nearSettlement(nx, nz, 6) && !settlementAt(u.pos, 6)) { u.moving = 0; return false; }
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
    if (s.type === 'repaire') continue;
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
  const avoidTowns = (f && f.bandit) || u.animal;
  for (const o of units) {
    if (!alive(o) || o === u || (o.civil && !u.animal) || o.jailed || !hostile(u, o)) continue;
    if (avoidTowns && settlementAt(o.pos, 2) && settlementAt(o.pos, 2).type !== 'repaire') continue;
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
  if (u.target) { fight(u, u.target, dt); return; }
  setMode(u, 'melee');
  if (u.assignedNode != null && updateAssignedWorker(u, dt)) return;
  const row = Math.floor(idx / 3), col = (idx % 3) - 1;
  const spacing = state.order === 'close' ? 1.2 : 1.6;
  const back = (state.order === 'close' ? 1.6 : 2.5) + row * spacing, side = col * spacing, py = player.yaw;
  const tx = player.pos.x - Math.sin(py) * back - Math.cos(py) * side;
  const tz = player.pos.z - Math.cos(py) * back + Math.sin(py) * side;
  const far = Math.hypot(tx - u.pos.x, tz - u.pos.z);
  steer(u, tx, tz, dt, far > 5 || state.run ? 1.7 : 1, 0.5);
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
  if (isPlayerSide(u)) { updatePlayerSideAI(u, dt, idx); return; }
  u.retarget -= dt;
  if (u.target && (!alive(u.target) || u.target.jailed || !hostile(u, u.target) || d2(u.pos, u.target.pos) > 70)) u.target = null;
  const fac = F(u.faction);
  if (fac && fac.bandit && u.target && settlementAt(u.target.pos, 2) && settlementAt(u.target.pos, 2).type !== 'repaire') u.target = null;
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
    if (down) { c.body.rotation.y = 0; return; }
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
        case 'estoc': aR = p < 1 ? lerp(-0.5, 0.5, p) : lerp(0.5, -1.6, (p - 1) * 2); break;
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
