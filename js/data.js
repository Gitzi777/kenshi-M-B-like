// Terres Arides — données du jeu : réglages, marchandises, biomes, ressources, objets, générateurs.
'use strict';

const T = THREE;

// ---------- Réglages ----------
const WORLD = 1200;              // le monde va de -600 à +600 (mètres)
const HALF = WORLD / 2;
const DAY_LENGTH = 240;          // secondes réelles par jour
const BASE_CARRY = 30;
const CARRY_PER_MEMBER = 20;
const MAX_SQUAD = 8;
const SPAWN_DIST = 120;          // un groupe apparaît en 3D à moins de 120 m
const DESPAWN_DIST = 170;
const SAVE_KEY = 'terres-arides-save-v2';
const SETTINGS_KEY = 'terres-arides-settings';

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
const rpick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
function angleDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
function turnToward(cur, target, maxStep) { const d = angleDiff(cur, target); return cur + clamp(d, -maxStep, maxStep); }
let _uid = 1;
const uid = () => _uid++;
const theF = (f, cap = false) => {
  const a = f.art || 'la';
  const s = (a === "l'" ? "l'" : a + ' ') + f.name;
  return cap ? s[0].toUpperCase() + s.slice(1) : s;
};
const vb = (f, sing, plur) => (f.art === 'les' ? plur : sing);
const toF = f => ({ la: 'à la ', "l'": "à l'", le: 'au ', les: 'aux ' }[f.art || 'la']) + f.name;
const deN = name => (/^[aeiouyéèêâîôûhAEIOUYÉÈÊÂÎÔÛH]/.test(name) ? "d'" : 'de ') + name;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Bruit de valeur lissé (pour le relief et les biomes)
function makeNoise(seed) {
  const rng = mulberry32(seed);
  const p = new Uint8Array(512), v = new Float32Array(256);
  for (let i = 0; i < 256; i++) { p[i] = i; v[i] = rng(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 256; i++) p[i + 256] = p[i];
  const n2 = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
    const a = v[p[p[X] + Y]], b = v[p[p[X + 1] + Y]], c = v[p[p[X] + Y + 1]], d = v[p[p[X + 1] + Y + 1]];
    const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  };
  return (x, y, oct = 4) => {
    let s = 0, amp = 1, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += n2(x * f + i * 17.3, y * f - i * 9.1) * amp; n += amp; amp *= 0.5; f *= 2; }
    return s / n;
  };
}

// ---------- Marchandises ----------
const GOODS = {
  food:   { name: 'Céréales', icon: '🌾', base: 8,  w: 1 },
  wood:   { name: 'Bois',     icon: '🪵', base: 7,  w: 2 },
  iron:   { name: 'Fer',      icon: '⛏️', base: 26, w: 2 },
  cloth:  { name: 'Coton',    icon: '🧵', base: 16, w: 1 },
  spices: { name: 'Épices',   icon: '🌶️', base: 40, w: 1 },
  salt:   { name: 'Sel',      icon: '🧂', base: 14, w: 1 },
  arrows: { name: 'Flèches',  icon: '🏹', base: 1,  w: 0 },
};
const TRADE_GOODS = ['food', 'wood', 'iron', 'cloth', 'spices', 'salt'];
// consommation par jour pour 100 habitants
const CONSUMPTION = { food: 10, wood: 4, iron: 1.5, cloth: 3, spices: 1, salt: 2 };

// ---------- Biomes ----------
const BIOMES = {
  desert:   { name: 'Désert',         color: [0.76, 0.62, 0.40] },
  steppe:   { name: 'Steppe',         color: [0.58, 0.57, 0.33] },
  foret:    { name: 'Forêt',          color: [0.30, 0.43, 0.20] },
  montagne: { name: 'Montagnes',      color: [0.50, 0.45, 0.41] },
  sel:      { name: 'Marais salants', color: [0.80, 0.79, 0.75] },
};

// ---------- Ressources exploitables ----------
const RESOURCES = {
  ferme:  { name: 'Champs de céréales',   good: 'food',   biomes: ['steppe', 'foret'], rate: 14, crop: '#d8b84a' },
  bois:   { name: 'Camp de bûcherons',    good: 'wood',   biomes: ['foret'],           rate: 10 },
  fer:    { name: 'Gisement de fer',      good: 'iron',   biomes: ['montagne'],        rate: 6 },
  coton:  { name: 'Plantation de coton',  good: 'cloth',  biomes: ['steppe'],          rate: 8,  crop: '#f2efe6' },
  epices: { name: "Plantation d'épices",  good: 'spices', biomes: ['desert'],          rate: 4,  crop: '#b8452e' },
  sel:    { name: 'Salines',              good: 'salt',   biomes: ['sel'],             rate: 9 },
};

// ---------- Objets ----------
const FIST = { name: 'Poings', dmg: 4, cd: 0.75, reach: 1.7 };
const ITEMS = {
  baton:     { name: 'Bâton',             slot: 'weapon', dmg: 6,  cd: 0.9,  reach: 2.2, price: 15,  w: 2, mat: 'wood', model: 'staff', len: 1.4, color: '#6e5538' },
  dague:     { name: 'Dague',             slot: 'weapon', dmg: 8,  cd: 0.7,  reach: 1.8, price: 40,  w: 1, mat: 'iron', model: 'blade', len: 0.4, color: '#c9ccd1' },
  machette:  { name: 'Machette rouillée', slot: 'weapon', dmg: 10, cd: 0.95, reach: 2.0, price: 45,  w: 2, mat: 'iron', model: 'blade', len: 0.7, color: '#8f6f55' },
  sabre:     { name: 'Sabre',             slot: 'weapon', dmg: 14, cd: 0.95, reach: 2.3, price: 140, w: 2, mat: 'iron', model: 'blade', len: 0.9, color: '#d8dadf' },
  epee:      { name: 'Épée longue',       slot: 'weapon', dmg: 17, cd: 1.1,  reach: 2.5, price: 240, w: 3, mat: 'iron', model: 'blade', len: 1.1, color: '#e2e4e8' },
  masse:     { name: "Masse d'armes",     slot: 'weapon', dmg: 20, cd: 1.3,  reach: 2.1, price: 200, w: 4, mat: 'iron', model: 'mace',  len: 0.7, color: '#5c5c5c' },
  hache:     { name: 'Hache de guerre',   slot: 'weapon', dmg: 23, cd: 1.4,  reach: 2.3, price: 300, w: 4, mat: 'iron', model: 'axe',   len: 0.9, color: '#6a6a6a' },
  lance:     { name: 'Lance',             slot: 'weapon', dmg: 15, cd: 1.1,  reach: 3.0, price: 160, w: 3, mat: 'wood', model: 'spear', len: 1.9, color: '#bdbdbd' },
  cimeterre: { name: 'Cimeterre',         slot: 'weapon', dmg: 19, cd: 1.0,  reach: 2.4, price: 380, w: 3, mat: 'iron', model: 'blade', len: 1.0, color: '#e8c547' },

  arc_court: { name: 'Arc court', slot: 'bow', dmg: 12, range: 45, draw: 0.7, price: 90,  w: 1, mat: 'wood' },
  arc_long:  { name: 'Arc long',  slot: 'bow', dmg: 18, range: 70, draw: 1.0, price: 220, w: 2, mat: 'wood' },

  haillons: { name: 'Haillons',          slot: 'armor', armor: 0, price: 2,   w: 1,  mat: 'cloth', color: '#8a7a60' },
  tunique:  { name: 'Tunique',           slot: 'armor', armor: 1, price: 20,  w: 1,  mat: 'cloth', color: null },
  robe:     { name: 'Robe épaisse',      slot: 'armor', armor: 2, price: 90,  w: 2,  mat: 'cloth', color: '#efe6d0' },
  cuir:     { name: 'Armure de cuir',    slot: 'armor', armor: 3, price: 110, w: 4,  mat: 'cloth', color: '#6b4a2b' },
  mailles:  { name: 'Cotte de mailles',  slot: 'armor', armor: 6, price: 320, w: 8,  mat: 'iron', color: '#8c9196', speed: -0.2 },
  plaques:  { name: 'Armure de plaques', slot: 'armor', armor: 9, price: 650, w: 12, mat: 'iron', color: '#b9bec4', speed: -0.5 },

  bandana:     { name: 'Bandana',        slot: 'helmet', armor: 0, price: 5,   w: 0, mat: 'cloth', model: 'band' },
  capuche:     { name: 'Capuche',        slot: 'helmet', armor: 1, price: 15,  w: 0, mat: 'cloth', model: 'hood' },
  turban:      { name: 'Turban',         slot: 'helmet', armor: 1, price: 20,  w: 0, mat: 'cloth', model: 'turban' },
  casque_cuir: { name: 'Casque de cuir', slot: 'helmet', armor: 2, price: 60,  w: 1, mat: 'cloth', model: 'cap',  color: '#6b4a2b' },
  casque_fer:  { name: 'Casque de fer',  slot: 'helmet', armor: 4, price: 180, w: 2, mat: 'iron', model: 'helm', color: '#8c9196' },
  heaume:      { name: 'Heaume',         slot: 'helmet', armor: 5, price: 300, w: 3, mat: 'iron', model: 'greathelm', color: '#b9bec4' },
};
const SLOT_NAMES = { weapon: 'Arme', bow: 'Arc', armor: 'Armure', helmet: 'Tête' };
function itemStats(id) {
  const it = ITEMS[id];
  if (!it) return '';
  if (it.slot === 'weapon') return `⚔ ${it.dmg} · allonge ${it.reach} m`;
  if (it.slot === 'bow') return `🏹 ${it.dmg} · portée ${it.range} m`;
  return `🛡 ${it.armor}${it.speed ? ' · lent' : ''}`;
}

// ---------- Troupes ----------
const TROOP_POWER = { recrue: 1, veteran: 2, archer: 1.2, pillard: 0.7, chef: 1.8 };
const TROOP_BASE = {
  recrue:  { hp: 70,  str: 2, label: 'Recrue' },
  veteran: { hp: 110, str: 5, label: 'Vétéran' },
  archer:  { hp: 65,  str: 2, label: 'Archer' },
  pillard: { hp: 55,  str: 1, label: 'Pillard' },
  chef:    { hp: 130, str: 5, label: 'Chef' },
};

// Styles militaires : équipement des troupes et ce que vendent les armuriers
const CULTURES = {
  lourd: {
    camp: false, tabard: true, hat: null,
    troops: {
      recrue:  { weapon: ['masse', 'machette'], armor: 'cuir', helmet: 'casque_cuir' },
      veteran: { weapon: ['hache', 'masse', 'epee'], armor: 'plaques', helmet: 'heaume' },
      archer:  { weapon: ['dague'], bow: 'arc_court', armor: 'cuir', helmet: 'casque_cuir' },
    },
    shop: ['machette', 'masse', 'hache', 'epee', 'cuir', 'mailles', 'plaques', 'casque_cuir', 'casque_fer', 'heaume'],
  },
  marchand: {
    camp: false, tabard: true,
    troops: {
      recrue:  { weapon: ['sabre', 'dague'], armor: 'tunique', helmet: 'turban' },
      veteran: { weapon: ['sabre', 'epee', 'lance'], armor: 'mailles', helmet: 'casque_fer' },
      archer:  { weapon: ['dague'], bow: 'arc_court', armor: 'cuir', helmet: 'turban' },
    },
    shop: ['dague', 'sabre', 'epee', 'lance', 'arc_court', 'tunique', 'cuir', 'mailles', 'turban', 'casque_cuir', 'casque_fer'],
  },
  fanatique: {
    camp: false, tabard: true,
    troops: {
      recrue:  { weapon: ['lance', 'sabre'], armor: 'robe', helmet: 'turban' },
      veteran: { weapon: ['cimeterre', 'epee'], armor: 'mailles', helmet: 'casque_fer' },
      archer:  { weapon: ['dague'], bow: 'arc_long', armor: 'robe', helmet: 'turban' },
    },
    shop: ['lance', 'sabre', 'cimeterre', 'arc_long', 'robe', 'mailles', 'turban', 'casque_fer'],
  },
  nomade: {
    camp: true, tabard: false,
    troops: {
      recrue:  { weapon: ['lance', 'dague'], armor: 'tunique', helmet: 'capuche' },
      veteran: { weapon: ['sabre'], bow: 'arc_long', armor: 'cuir', helmet: 'capuche' },
      archer:  { weapon: ['dague'], bow: 'arc_court', armor: 'tunique', helmet: 'capuche' },
    },
    shop: ['dague', 'lance', 'sabre', 'arc_court', 'arc_long', 'tunique', 'cuir', 'capuche'],
  },
  guerrier: {
    camp: false, tabard: true,
    troops: {
      recrue:  { weapon: ['sabre', 'machette', 'lance'], armor: 'tunique', helmet: 'capuche' },
      veteran: { weapon: ['epee', 'hache', 'masse'], armor: 'mailles', helmet: 'casque_fer' },
      archer:  { weapon: ['dague'], bow: 'arc_court', armor: 'cuir', helmet: 'casque_cuir' },
    },
    shop: ['machette', 'sabre', 'epee', 'lance', 'arc_court', 'tunique', 'cuir', 'mailles', 'capuche', 'casque_cuir', 'casque_fer'],
  },
  brigand: {
    camp: true, tabard: false,
    troops: {
      pillard: { weapon: ['machette', 'baton', 'dague'], armor: 'haillons', helmet: 'bandana' },
      archer:  { weapon: ['dague'], bow: 'arc_court', armor: 'haillons', helmet: 'bandana' },
      chef:    { weapon: ['hache', 'sabre'], armor: 'cuir', helmet: 'casque_cuir' },
    },
    shop: [],
  },
};

// Types de gouvernement : nom de la faction et style militaire préféré
const GOVERNMENTS = [
  { t: 'Royaume',       art: 'le',  cultures: ['lourd', 'guerrier'] },
  { t: 'Ligue',         art: 'la',  cultures: ['marchand'] },
  { t: 'Clans',         art: 'les', cultures: ['lourd', 'guerrier'] },
  { t: 'Califat',       art: 'le',  cultures: ['fanatique'] },
  { t: 'République',    art: 'la',  cultures: ['marchand', 'guerrier'] },
  { t: 'Horde',         art: 'la',  cultures: ['nomade'] },
  { t: 'Principauté',   art: 'la',  cultures: ['lourd', 'marchand'] },
  { t: 'Compagnie',     art: 'la',  cultures: ['marchand', 'guerrier'] },
  { t: 'Théocratie',    art: 'la',  cultures: ['fanatique'] },
  { t: 'Tribus',        art: 'les', cultures: ['nomade'] },
  { t: 'Confédération', art: 'la',  cultures: ['guerrier', 'marchand'] },
];
const OF_ART = { le: 'du', la: 'de la', les: 'des', "l'": "de l'" };

// Générateur de noms
const SYL_START = ['Ka', 'Ra', 'Vel', 'Mor', 'Zan', 'Ul', 'Tor', 'Is', 'An', 'Bar', 'Ash', 'Kel', 'Dra', 'Sil', 'Vor', 'Na',
  'Ri', 'Thal', 'Gor', 'Em', 'Ys', 'Ok', 'Lun', 'Sa', 'Har', 'Bel', 'Qa', 'Ir', 'Ost', 'Fen', 'Jor', 'Mal', 'Sha', 'Tir'];
const SYL_MID = ['ra', 'ka', 'du', 'me', 'li', 'zo', 'ta', 'ri', 'na', 'bo', 'se', 'ga', 'ul', 'en', 'ar', 'is', 'o', 'a'];
const SYL_END = ['dun', 'mor', 'mek', 'is', 'ar', 'an', 'oth', 'ir', 'ash', 'el', 'um', 'ad', 'ek', 'ia', 'or', 'en', 'ath', 'ul', 'esh', 'ine'];
function genName(rng = Math.random) {
  let s = rpick(rng, SYL_START);
  if (rng() < 0.45) s += rpick(rng, SYL_MID);
  return s + rpick(rng, SYL_END);
}
const LEADER_TITLE = ['Seigneur', 'Dame', 'Capitaine', 'Prophète', 'Baron', 'Reine', 'Chef de guerre', 'Gouverneur', 'Khan', 'Doge'];
const FLAG_PATTERNS = ['plain', 'bicolor-h', 'bicolor-v', 'diagonal', 'cross', 'border'];
const FLAG_EMBLEMS = ['coin', 'hammer', 'sun', 'crescent', 'skull', 'star', 'tower', 'eye', 'swords', 'triangle'];

// Création du personnage
const ORIGINS = [
  { id: 'vagabond', name: 'Vagabond', desc: '150 💰, une machette, un peu de nourriture.', money: 150,
    goods: { food: 4 }, equip: { weapon: 'machette', armor: 'tunique', helmet: 'capuche' }, bonus: {} },
  { id: 'marchand', name: 'Marchand', desc: '400 💰 et du coton à revendre, mais -1 Force.', money: 400,
    goods: { food: 4, cloth: 6 }, equip: { weapon: 'dague', armor: 'tunique', helmet: 'turban' }, bonus: { F: -1 } },
  { id: 'deserteur', name: 'Déserteur', desc: '+1 Force, +1 Endurance. Sabre et cuir, mais 40 💰.', money: 40,
    goods: { food: 3 }, equip: { weapon: 'sabre', armor: 'cuir', helmet: 'casque_cuir' }, bonus: { F: 1, E: 1 } },
  { id: 'chasseur', name: 'Chasseur', desc: 'Un arc court et 30 flèches. +1 Agilité. 80 💰.', money: 80,
    goods: { food: 3, arrows: 30 }, equip: { weapon: 'dague', bow: 'arc_court', armor: 'tunique', helmet: 'capuche' }, bonus: { A: 1 } },
  { id: 'esclave', name: 'Esclave évadé', desc: '+2 Agilité. Des haillons, pas une pièce.', money: 0,
    goods: { food: 1 }, equip: { armor: 'haillons' }, bonus: { A: 2 } },
];
const BODY_COLORS = ['#7a5a3a', '#3d5a7a', '#7a2e2e', '#4a6b3a', '#c9b48a', '#3a3a3a'];
const SKIN_COLORS = ['#f1c9a5', '#d9a47a', '#a8714a', '#6e4428', '#3f2615'];
const STATS = [
  { key: 'F', name: 'Force', hint: 'dégâts' },
  { key: 'A', name: 'Agilité', hint: 'vitesse, frappes, arc' },
  { key: 'E', name: 'Endurance', hint: 'points de vie' },
];
const NAMES = ['Kael', 'Mira', 'Ruk', 'Sanna', 'Torv', 'Ylva', 'Bren', 'Oska', 'Hal', 'Zia',
  'Dorn', 'Lisk', 'Vetch', 'Ama', 'Grell', 'Nox', 'Pell', 'Rhea', 'Sorn', 'Tam', 'Idris', 'Kova', 'Safi', 'Jurek'];
const DIRS = { haut: '↑', gauche: '←', droite: '→', estoc: '↓' };
