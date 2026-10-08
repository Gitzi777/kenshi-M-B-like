// Terres Arides — modèles 3D et animations (personnages KayKit, nature Quaternius, tous en licence CC0).
'use strict';

const ASSETS = { ready: false, chars: {}, clips: {}, nature: {}, weapons: {} };
const CHAR_FILES = ['knight', 'barbarian', 'rogue', 'rogue_hooded', 'mage'];
const MODEL_SCALE = 0.78;

// charge tous les fichiers ; en cas d'échec (ouverture locale du fichier), le jeu garde ses modèles simples
function loadAssets(onProgress, onDone) {
  if (!THREE.GLTFLoader || location.protocol === 'file:') { onDone(false); return; }
  const loader = new THREE.GLTFLoader();
  const files = [...CHAR_FILES, 'weapons', 'nature', 'village'];
  let done = 0;
  Promise.all(files.map(f => new Promise((res, rej) => loader.load('assets/' + f + '.glb', g => { onProgress(++done / files.length); res([f, g]); }, undefined, rej))))
    .then(list => {
      for (const [f, g] of list) {
        if (CHAR_FILES.includes(f)) ASSETS.chars[f] = g.scene;
        if (f === 'knight') for (const c of g.animations) ASSETS.clips[c.name] = c;
        if (f === 'weapons') for (const n of g.scene.children) ASSETS.weapons[n.name] = n;
        if (f === 'nature') for (const n of g.scene.children) ASSETS.nature[n.name] = n;
        if (f === 'village') { ASSETS.village = {}; for (const n of g.scene.children) ASSETS.village[n.name] = n; }
      }
      for (const f of CHAR_FILES) { mergeSkinnedParts(ASSETS.chars[f]); addTintMasks(ASSETS.chars[f]); ASSETS.chars[f].traverse(o => { if (o.isMesh) { o.material = toonFrom(o.material); o.castShadow = true; } }); }
      for (const k in ASSETS.weapons) ASSETS.weapons[k].traverse(o => { if (o.isMesh) { o.material = toonFrom(o.material); o.castShadow = true; } });
      ASSETS.ready = true;
      onDone(true);
    })
    .catch(err => { console.warn('Modèles 3D indisponibles :', err); onDone(false); });
}

// fusionne bras, jambes, tête et corps en un seul maillage animé (moins d'appels de dessin)
// quelle part de chaque morceau prend la couleur de la tenue (habits oui, visage non)
const tintMaskOf = name => 1; // la peau et les métaux sont exclus dans le shader (couleur)
function addTintMasks(root) {
  root.traverse(o => {
    if (!o.isMesh || o.geometry.attributes.tintMask) return;
    const m = /Hat|Cape|Helmet/.test(o.name) ? 1 : PART(o.name) === 'body' ? tintMaskOf(o.name) : 0;
    o.geometry.setAttribute('tintMask', new T.Float32BufferAttribute(new Float32Array(o.geometry.attributes.position.count).fill(m), 1));
  });
}
// teinte par unité : uniform propre au matériau cloné
function addTint(mat, color) {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  mat.userData.tint = { value: color.clone() };
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uTint = mat.userData.tint;
    sh.vertexShader = 'attribute float tintMask;\nvarying float vTintMask;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vTintMask = tintMask;');
    sh.fragmentShader = 'uniform vec3 uTint;\nvarying float vTintMask;\n' + sh.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\n { vec3 c = diffuseColor.rgb; float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)); float sat = (mx - mn) / max(mx, 0.001);' +
      ' float skin = step(c.b * 1.25, c.g) * step(c.g * 1.12, c.r) * step(0.08, mx); float k = vTintMask * smoothstep(0.18, 0.4, sat) * (1.0 - skin) * 0.75;' +
      ' float lum = dot(c, vec3(0.3, 0.55, 0.15)); diffuseColor.rgb = mix(c, uTint * (0.25 + lum * 2.2), k); }');
  };
  mat.customProgramCacheKey = () => prevKey + '|tint';
  return mat;
}
function mergeSkinnedParts(root) {
  const parts = [];
  root.traverse(o => { if (o.isSkinnedMesh && PART(o.name) === 'body') parts.push(o); });
  if (parts.length < 2) return;
  const first = parts[0];
  const sameBones = p => p.skeleton.bones.length === first.skeleton.bones.length && p.skeleton.bones.every((b, i) => b === first.skeleton.bones[i]);
  if (!parts.every(p => sameBones(p) && p.material === first.material && p.bindMatrix.equals(first.bindMatrix))) { console.warn('fusion impossible', root.name); return; }
  const names = Object.keys(first.geometry.attributes);
  if (!parts.every(p => names.every(n => p.geometry.attributes[n]) && p.geometry.index)) return;
  const attrs = {}, idx = [], mask = [];
  let offset = 0;
  for (const n of names) attrs[n] = [];
  for (const p of parts) {
    const g = p.geometry;
    const mk = tintMaskOf(p.name);
    for (let i = 0; i < g.attributes.position.count; i++) mask.push(mk);
    for (const n of names) { const a = g.attributes[n]; const get = [a.getX, a.getY, a.getZ, a.getW]; for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) attrs[n].push(get[k].call(a, i)); }
    for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + offset);
    offset += g.attributes.position.count;
  }
  const geo = new T.BufferGeometry();
  for (const n of names) {
    const a = first.geometry.attributes[n];
    const Arr = a.array.constructor;
    geo.setAttribute(n, new T.BufferAttribute(new Arr(attrs[n]), a.itemSize, a.normalized));
  }
  geo.setIndex(idx);
  geo.setAttribute('tintMask', new T.Float32BufferAttribute(mask, 1));
  first.geometry = geo;
  first.name = first.name.replace(/_(ArmLeft|ArmRight|LegLeft|LegRight|Head|Head_Hooded)$/, '') + '_Body';
  for (const p of parts.slice(1)) p.parent.remove(p);
}

// ---------- Personnages animés ----------
// silhouette choisie selon la culture, le métier ou l'origine
const CULTURE_MODEL = { lourd: ['knight', 'knight', 'barbarian'], guerrier: ['barbarian', 'knight'], marchand: ['rogue', 'mage', 'rogue_hooded'],
  fanatique: ['mage', 'rogue_hooded'], nomade: ['rogue_hooded', 'rogue', 'barbarian'], cannibale: ['barbarian'], brigand: ['rogue_hooded', 'rogue', 'barbarian'] };
const PART = name => /Hat|Helmet/.test(name) ? 'hat' : /Cape/.test(name) ? 'cape' : /Body|Arm|Leg|Head/.test(name) ? 'body' : 'prop';

function makeSkinnedCharacter(look) {
  const key = look.model && ASSETS.chars[look.model] ? look.model : 'rogue';
  const model = THREE.SkeletonUtils.clone(ASSETS.chars[key]);
  const root = new T.Group();
  const body = new T.Group();
  body.scale.setScalar(MODEL_SCALE * (look.height || 1));
  root.add(body);
  body.add(model);
  const tint = look.tint ? lin(look.tint) : null;
  const mats = [];
  const unitMats = {};
  const parts = { hat: [], cape: [], prop: [], body: [] };
  let bones = {};
  model.traverse(o => {
    if (o.name && !o.isMesh) bones[o.name] = o;
    if (!o.isMesh) return;
    const p = PART(o.name);
    parts[p].push(o);
    if (p === 'prop') { o.visible = false; return; }
    // matériau propre à chaque unité : flash quand on est touché, teinte de faction sur les habits
    // un seul matériau par unité, partagé par ses morceaux
    const kind = o.isSkinnedMesh ? 'skin' : 'rigid';
    if (!unitMats[kind]) {
      const um = o.material.clone(); um.userData = {}; um.skinning = o.isSkinnedMesh;
      addRim(um); if (tint) addTint(um, tint);
      unitMats[kind] = um; mats.push(um);
    }
    o.material = unitMats[kind];
    o.castShadow = true;
    o.frustumCulled = false;
  });
  const handR = bones.handslotr || bones.handr, handL = bones.handslotl || bones.handl; // (les points sont retirés des noms au chargement)
  const weaponSlot = new T.Group(), bowSlot = new T.Group(), backSlot = new T.Group(), hipSlot = new T.Group(), headSlot = new T.Group();
  if (handR) handR.add(weaponSlot);
  if (handL) handL.add(bowSlot);
  if (bones.chest) { bones.chest.add(backSlot); backSlot.position.set(0, 0.4, -0.45); }
  if (bones.hips) { bones.hips.add(hipSlot); hipSlot.position.set(0.45, 0.1, 0.1); hipSlot.rotation.set(Math.PI * 0.85, 0, 0.2); }
  const mixer = new T.AnimationMixer(model);
  return {
    skinned: true, model, key, root, body, mixer, actions: {}, cur: null, once: null, parts, bones,
    weaponSlot, bowSlot, backSlot, hipSlot, headSlot, tabard: { visible: false, material: { color: new T.Color() } },
    mBody: mats[0] || new T.MeshToonMaterial(), mSkin: mats[0] || new T.MeshToonMaterial(), hurtMats: mats,
    legL: new T.Group(), legR: new T.Group(), armL: new T.Group(), armR: new T.Group(), torso: new T.Group(),
  };
}
function actionOf(c, name) {
  if (!c.actions[name]) {
    const clip = ASSETS.clips[name];
    if (!clip) return null;
    c.actions[name] = c.mixer.clipAction(clip);
  }
  return c.actions[name];
}
// joue une animation en boucle avec un fondu
function playLoop(c, name, timeScale = 1, fade = 0.2) {
  const a = actionOf(c, name);
  if (!a) return;
  a.timeScale = timeScale;
  if (c.cur === name) return;
  const prev = c.cur && c.actions[c.cur];
  a.reset().setLoop(T.LoopRepeat, Infinity).play();
  a.enabled = true; a.setEffectiveWeight(1);
  if (prev) prev.crossFadeTo(a, fade, false);
  c.cur = name;
}
// joue une animation une fois (attaque, coup reçu, esquive), en l'ajustant à la durée voulue
function playOnce(c, name, duration, fade = 0.08, hold = false) {
  const a = actionOf(c, name);
  if (!a) return;
  const prev = c.cur && c.actions[c.cur];
  a.reset().setLoop(T.LoopOnce, 1);
  a.clampWhenFinished = true;
  if (duration) a.setDuration(duration); else a.timeScale = 1;
  a.play();
  if (prev && prev !== a) prev.crossFadeTo(a, fade, false);
  c.cur = name;
  c.once = { name, t: 0, dur: duration || a.getClip().duration, hold };
}

const ATTACK_CLIP = {
  one: { haut: '1H_Melee_Attack_Chop', droite: '1H_Melee_Attack_Slice_Horizontal', gauche: '1H_Melee_Attack_Slice_Diagonal', estoc: '1H_Melee_Attack_Stab' },
  two: { haut: '2H_Melee_Attack_Chop', droite: '2H_Melee_Attack_Slice', gauche: '2H_Melee_Attack_Slice', estoc: '2H_Melee_Attack_Stab' },
};
const isTwoHanded = u => { const w = IT(u.equip.weapon); return !!(w && !u.fists && (w.model === 'staff' || w.model === 'spear' || w.w >= 4)); };

// choisit l'animation selon ce que fait l'unité ; appelé à chaque image
function animateSkinned(u, dt) {
  const c = u.c;
  c.root.rotation.y = u.yaw;
  // les unités lointaines s'animent moins souvent
  const far = player ? d2(u.pos, player.pos) : 0;
  c.acc = (c.acc || 0) + dt;
  if (far > 90 && c.acc < 0.2) return;
  if (far > 45 && c.acc < 0.066) return;
  const step = c.acc; c.acc = 0;
  const down = u.dead || u.down > 0 || (u.isPlayer && state.ko > 0);
  // nouvel évènement : début d'attaque, coup reçu, esquive
  if (down) {
    if (!c.wasDown) { playOnce(c, u.dead ? 'Death_B' : 'Death_A', null, 0.12, true); c.wasDown = true; }
  } else {
    if (c.wasDown) { playOnce(c, 'Lie_StandUp', 1.2, 0.15); c.wasDown = false; }
    if (u.dodge && c.lastDodge !== u.dodge) { c.lastDodge = u.dodge; playOnce(c, u.dodge.back ? 'Dodge_Backward' : 'Dodge_Forward', u.dodge.dur + 0.05, 0.05); }
    else if (u.atk && c.lastAtk !== u.atk) {
      c.lastAtk = u.atk;
      let clip;
      if (u.animal) clip = null;
      else if (isFists(u)) clip = u.combo === 1 ? 'Unarmed_Melee_Attack_Punch_B' : 'Unarmed_Melee_Attack_Punch_A';
      else clip = ATTACK_CLIP[isTwoHanded(u) ? 'two' : 'one'][u.atk.dir] || '1H_Melee_Attack_Chop';
      // la frappe de l'animation tombe vers 45 % : on cale ce moment sur l'impact du jeu
      if (clip) playOnce(c, clip, u.atk.windup / 0.45, 0.06);
    } else if (u.flinch > 0.2 && c.lastHurt !== u.hurtId) {
      c.lastHurt = u.hurtId;
      if (!u.atk) playOnce(c, u.block ? 'Block_Hit' : (Math.random() < 0.5 ? 'Hit_A' : 'Hit_B'), 0.45, 0.05);
    }
  }
  if (c.once) {
    c.once.t += step;
    if (c.once.t < c.once.dur || c.once.hold && down) { c.mixer.update(step); finishFlash(u, step); return; }
    c.once = null; c.cur = null;
  }
  // états continus
  const sp = u.vx != null && u.isPlayer ? Math.hypot(u.vx, u.vz) : u.moving * speedOf(u);
  if (u.carriedBy) playLoop(c, 'Death_A_Pose', 1);
  else if (u.mode === 'bow' && u.draw >= 0) playLoop(c, '2H_Ranged_Aiming', 1, 0.15);
  else if (u.block) playLoop(c, 'Blocking', 1, 0.1);
  else if (u.working) playLoop(c, 'Interact', 1, 0.25);
  else if (u.jailed && !sp) playLoop(c, 'Sit_Floor_Idle', 1, 0.4);
  else if (sp > 6.2) playLoop(c, 'Running_A', clamp(sp / 7, 0.8, 1.4), 0.2);
  else if (sp > 0.35) playLoop(c, u.backward ? 'Walking_Backwards' : 'Walking_A', clamp(sp / 3.2, 0.6, 1.6), 0.22);
  else playLoop(c, u.sheathed || isFists(u) ? 'Unarmed_Idle' : isTwoHanded(u) ? '2H_Melee_Idle' : 'Idle', 1, 0.3);
  c.mixer.update(step);
  finishFlash(u, step);
}
function finishFlash(u, dt) {
  u.hurt -= dt;
  const f = u.hurt > 0 ? 0.55 : 0;
  for (const m of u.c.hurtMats) m.emissive.setRGB(f, f * 0.15, f * 0.1);
  if (player) {
    const near = d2(u.pos, player.pos) < 14 && !u.isPlayer && !u.dead;
    if (near && !u.label && (!u.civil || u.task)) makeLabel(u);
    if (u.label) u.label.visible = near;
  }
}

// équipement visible : armes KayKit dans la main, chapeaux et capes selon l'armure
const WEAPON_MODEL = { blade: 'sword_1handed', staff: 'staff', mace: 'axe_1handed', axe: 'axe_1handed', spear: 'staff' };
function dressSkinned(u) {
  const c = u.c;
  for (const g of [c.weaponSlot, c.bowSlot, c.backSlot, c.hipSlot]) while (g.children.length) g.remove(g.children[0]);
  const w = IT(u.equip.weapon);
  if (w && !u.fists) {
    const name = w.len && w.len < 0.5 ? 'dagger' : isTwoHanded(u) && w.model === 'blade' ? 'sword_2handed' : isTwoHanded(u) && w.model === 'axe' ? 'axe_2handed' : WEAPON_MODEL[w.model];
    const src = ASSETS.weapons[name];
    if (src) (u.sheathed || u.mode === 'bow' ? c.hipSlot : c.weaponSlot).add(src.clone());
  }
  if (u.equip.bow) {
    const b = buildBow();
    b.scale.setScalar(1.4);
    if (u.mode === 'bow' && !u.sheathed) { b.rotation.set(0, Math.PI / 2, Math.PI / 2); c.bowSlot.add(b); }
    else { b.rotation.z = 0.6; c.backSlot.add(b); }
  }
  const armor = IT(u.equip.armor), helm = IT(u.equip.helmet);
  for (const h of c.parts.hat) h.visible = !!helm || c.key === 'mage' || c.key === 'rogue_hooded';
  for (const k of c.parts.cape) k.visible = !!armor && armor.armor >= 2 || c.key === 'mage';
  // le bouclier des soldats lourds
  const shield = c.parts.prop.find(o => /Shield/.test(o.name) && !/Spike|Badge|Rectangle/.test(o.name));
  if (shield) shield.visible = !!armor && armor.armor >= 4 && !u.fists && u.mode !== 'bow' && !isTwoHanded(u);
  if (u.carry) { const box = part(0.55, 0.5, 0.4, '#8a6a40', 0, 0, 0); c.backSlot.add(box); }
  if (u.banner && F(u.faction)) {
    const fp = makeFlagPole(F(u.faction), 3.2);
    fp.g.scale.setScalar(0.8);
    fp.g.position.set(0.2, -1, -0.1);
    c.backSlot.add(fp.g);
  }
}

// ---------- Rendu « cel shading » doux (inspiré des grands jeux d'aventure) ----------
const TOON_GRADIENT = (() => {
  const d = new Uint8Array([60, 60, 60, 255, 135, 135, 135, 255, 205, 205, 205, 255, 255, 255, 255, 255]);
  const t = new T.DataTexture(d, 4, 1, T.RGBAFormat);
  t.minFilter = t.magFilter = T.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();
// lumière de contour : les silhouettes s'illuminent face au ciel
const RIM = { color: { value: new T.Color(1, 0.95, 0.85) }, strength: { value: 0.22 } };
function addRim(mat) {
  if (mat.userData.rim) return mat;
  mat.userData.rim = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.rimColor = RIM.color; sh.uniforms.rimStrength = RIM.strength;
    sh.fragmentShader = 'uniform vec3 rimColor; uniform float rimStrength;\n' + sh.fragmentShader.replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
      'float rimF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);\n outgoingLight += rimColor * rimF * rimStrength * diffuseColor.rgb * 1.6;\n gl_FragColor = vec4( outgoingLight, diffuseColor.a );');
  };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  mat.customProgramCacheKey = () => key + '|rim';
  return mat;
}
const TOON_KEYS = ['color', 'map', 'vertexColors', 'side', 'transparent', 'opacity', 'alphaTest', 'emissive', 'emissiveMap', 'normalMap', 'depthWrite', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'skinning', 'fog'];
function toonMat(o = {}) {
  const p = { gradientMap: TOON_GRADIENT };
  for (const k of TOON_KEYS) if (o[k] !== undefined) p[k] = o[k];
  return addRim(new T.MeshToonMaterial(p));
}
function toonFrom(m) {
  if (!m || m.isMeshToonMaterial) return m;
  const t = toonMat({ color: m.color, map: m.map, vertexColors: m.vertexColors, side: m.side, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, skinning: m.skinning });
  t.name = m.name;
  if (t.map) t.map.anisotropy = ANISO;
  return t;
}

// ---------- Végétation détaillée près du joueur (modèles Quaternius instanciés) ----------
// chaque modèle est découpé en ses maillages ; un InstancedMesh par maillage
const NATURE_SETS = {
  feuillu: ['CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'CommonTree_4', 'CommonTree_5'],
  pin: ['Pine_1', 'Pine_2', 'Pine_3', 'Pine_4', 'Pine_5'],
  tordu: ['TwistedTree_1', 'TwistedTree_3'],
  mort: ['DeadTree_1', 'DeadTree_2', 'DeadTree_3'],
  rocher: ['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3'],
  buisson: ['Bush_Common', 'Bush_Common_Flowers'],
  plante: ['Fern_1', 'Plant_1_Big', 'Plant_7_Big', 'Flower_3_Group', 'Flower_4_Group', 'Grass_Wispy_Tall', 'Mushroom_Common', 'Clover_1'],
};
const NEAR = { R: 75, MAX: 140, list: [], meshes: {}, cx: 1e9, cz: 1e9 };
function natureParts(name) {
  const root = ASSETS.nature[name];
  if (!root) return [];
  root.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(root.matrixWorld).invert();
  const out = [];
  root.traverse(o => {
    if (!o.isMesh) return;
    const m = new T.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const leafy = /Leaf|Leaves|Grass|Flower|Petal|Clover/.test(o.material.name || '');
    let mat = toonFrom(o.material);
    if (leafy) { mat.alphaTest = Math.max(0.4, mat.alphaTest || 0); mat.side = T.DoubleSide; mat = addWind(mat, /Grass|Flower|Clover/.test(o.material.name) ? 0.25 : 0.012, 0.8); }
    out.push({ geo: o.geometry, mat, local: m, leafy });
  });
  return out;
}
function buildNearNature() {
  if (!ASSETS.ready) return;
  for (const name of Object.values(NATURE_SETS).flat()) {
    const parts = natureParts(name);
    NEAR.meshes[name] = parts.map(p => {
      const im = new T.InstancedMesh(p.geo, p.mat, NEAR.MAX);
      im.castShadow = !/Grass|Clover|Flower|Fern|Plant|Mushroom/.test(name);
      im.receiveShadow = true;
      im.count = 0;
      im.frustumCulled = false;
      scene.add(im);
      return { im, local: p.local };
    });
  }
}
// liste des emplacements : remplie par le décor du monde (arbres, rochers…)
function addNearSpot(kind, d) { NEAR.list.push({ kind, ...d, model: NATURE_SETS[kind][Math.floor((d.seed || Math.random()) * NATURE_SETS[kind].length)] }); }
const _nm = new T.Matrix4(), _nq = new T.Quaternion(), _ne = new T.Euler(), _ns = new T.Vector3(), _np = new T.Vector3();
function updateNearNature(focus, force) {
  if (!ASSETS.ready || !focus) return;
  if (!force && Math.hypot(focus.x - NEAR.cx, focus.z - NEAR.cz) < 12) return;
  NEAR.cx = focus.x; NEAR.cz = focus.z;
  const counts = {};
  for (const k in NEAR.meshes) counts[k] = 0;
  for (const s of NEAR.list) {
    s.near = Math.abs(s.x - focus.x) < NEAR.R && Math.abs(s.z - focus.z) < NEAR.R && Math.hypot(s.x - focus.x, s.z - focus.z) < NEAR.R;
    if (!s.near) continue;
    const parts = NEAR.meshes[s.model];
    if (!parts || counts[s.model] >= NEAR.MAX) { s.near = false; continue; }
    _nm.compose(_np.set(s.x, s.y, s.z), _nq.setFromEuler(_ne.set(0, s.ry || 0, 0)), _ns.set(s.s, s.s * (s.sy || 1), s.s));
    for (const p of parts) p.im.setMatrixAt(counts[s.model], new T.Matrix4().multiplyMatrices(_nm, p.local));
    counts[s.model]++;
  }
  for (const k in NEAR.meshes) for (const p of NEAR.meshes[k]) { p.im.count = counts[k]; p.im.instanceMatrix.needsUpdate = true; }
  // les versions simplifiées lointaines sont cachées là où les modèles détaillés sont affichés
  if (typeof hideFarDecorNear === 'function') hideFarDecorNear(focus, NEAR.R);
}

// ---------- Maisons médiévales (kit modulaire Quaternius) ----------
// fusionne des pièces par matériau : une maison = quelques maillages seulement
function mergeByMaterial(items) {
  const groups = new Map();
  for (const it of items) {
    if (!groups.has(it.mat)) groups.set(it.mat, []);
    groups.get(it.mat).push(it);
  }
  const out = [];
  for (const [m, list] of groups) {
    const pos = [], nor = [], uv = [];
    for (const it of list) {
      const g = (it.geo.index ? it.geo.toNonIndexed() : it.geo.clone()).applyMatrix4(it.matrix);
      const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      for (let i = 0; i < P.count; i++) {
        pos.push(P.getX(i), P.getY(i), P.getZ(i));
        if (N) nor.push(N.getX(i), N.getY(i), N.getZ(i));
        uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0);
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    if (nor.length === pos.length) geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); else geo.computeVertexNormals();
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    const mesh = new T.Mesh(geo, m);
    mesh.castShadow = true; mesh.receiveShadow = true;
    out.push(mesh);
  }
  return out;
}
const VMAT = new Map();
function villageParts(name) {
  const root = ASSETS.village && ASSETS.village[name];
  if (!root) return [];
  root.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(root.matrixWorld).invert();
  const out = [];
  root.traverse(o => {
    if (!o.isMesh) return;
    if (!VMAT.has(o.material)) {
      const t = toonFrom(o.material);
      if (/Vine|Glass/.test(o.material.name)) { t.side = T.DoubleSide; t.alphaTest = 0.4; }
      VMAT.set(o.material, t);
    }
    out.push({ geo: o.geometry, mat: VMAT.get(o.material), local: new T.Matrix4().multiplyMatrices(inv, o.matrixWorld) });
  });
  return out;
}
// place une pièce : position, rotation (y) et échelle dans le repère de la maison
function placePart(items, name, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) {
  const m = new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)), new T.Vector3(sx, sy, sz));
  for (const p of villageParts(name)) items.push({ geo: p.geo, mat: p.mat, matrix: new T.Matrix4().multiplyMatrices(m, p.local) });
}
const ROOFS = [[4, 4], [6, 6], [6, 8], [8, 8], [8, 12]];
// construit murs et toit d'une maison de w × d mètres, h de haut, porte au milieu de la façade (+z)
function buildHouseModel(w, d, h, rng, style) {
  const wallKind = style || (rng() < 0.6 ? 'Plaster' : rng() < 0.6 ? 'UnevenBrick' : 'Plaster');
  const n = Math.max(3, Math.round(w / 2) | 1), m = Math.max(2, Math.round(d / 2));
  const sx = w / (n * 2), sz = d / (m * 2), sy = h / 3.12;
  const hw = w / 2, hd = d / 2;
  const walls = [], roof = [];
  const straight = () => wallKind === 'Plaster' && rng() < 0.3 ? 'Wall_Plaster_WoodGrid' : `Wall_${wallKind}_Straight`;
  const windowW = `Wall_${wallKind}_Window_Wide_Round`;
  // façade avec la porte au centre
  for (let i = 0; i < n; i++) {
    const x = -hw + (i + 0.5) * 2 * sx;
    const name = i === (n - 1) / 2 ? `Wall_${wallKind}_Door_Round` : (i % 2 ? windowW : straight());
    placePart(walls, name, x, 0, hd + 0.11, 0, sx, sy, 1);
  }
  for (let i = 0; i < n; i++) placePart(walls, i % 2 && rng() < 0.6 ? windowW : straight(), -hw + (i + 0.5) * 2 * sx, 0, -hd - 0.11, Math.PI, sx, sy, 1);
  for (let i = 0; i < m; i++) {
    const z = -hd + (i + 0.5) * 2 * sz;
    placePart(walls, i % 2 ? windowW : straight(), -hw - 0.11, 0, z, -Math.PI / 2, sz, sy, 1);
    placePart(walls, i % 2 === 0 && m > 2 ? windowW : straight(), hw + 0.11, 0, z, Math.PI / 2, sz, sy, 1);
  }
  for (const [cx, cz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) placePart(walls, 'Corner_Exterior_Wood', cx, 0, cz, 0, 1.4, sy, 1.4);
  // toit de tuiles et pignons
  let best = ROOFS[0], bs = 1e9;
  for (const r of ROOFS) { const sc = Math.abs(r[0] - w) + Math.abs(r[1] - d); if (sc < bs) { bs = sc; best = r; } }
  const rx = w / best[0], rz = d / best[1];
  placePart(roof, `Roof_RoundTiles_${best[0]}x${best[1]}`, 0, h, 0, 0, rx, Math.min(1.2, (rx + rz) / 2), rz);
  placePart(roof, `Roof_Front_Brick${best[0]}`, 0, h, hd - 0.05, 0, rx, Math.min(1.2, (rx + rz) / 2), 1);
  placePart(roof, `Roof_Front_Brick${best[0]}`, 0, h, -hd + 0.05, Math.PI, rx, Math.min(1.2, (rx + rz) / 2), 1);
  if (rng() < 0.5) placePart(roof, 'Prop_Chimney', hw * 0.5, h + 0.5, -hd * 0.3, 0, 0.8, 0.8, 0.8);
  // un peu de lierre sur certaines façades
  if (rng() < 0.35) placePart(walls, 'Prop_Vine1', -hw + 1.2, h * 0.75, hd + 0.2, 0, 1, sy, 1);
  return { walls: mergeByMaterial(walls), roof: mergeByMaterial(roof) };
}
// objets de décor posés en ville (caisses, charrettes, barrières)
function villageProp(name, s = 1) {
  const items = [];
  placePart(items, name, 0, 0, 0, 0, s, s, s);
  const g = new T.Group();
  for (const m of mergeByMaterial(items)) g.add(m);
  return g;
}
