// Terres Arides — données du jeu : réglages, objets, factions, lore.
'use strict';

const T = THREE;

// ---------- Réglages ----------
const WORLD = 1200;              // le monde va de -600 à +600 (mètres)
const HALF = WORLD / 2;
const DAY_LENGTH = 240;          // secondes réelles par jour
const BASE_CARRY = 30;           // poids transportable par toi
const CARRY_PER_MEMBER = 20;     // poids en plus par compagnon
const MAX_SQUAD = 8;             // toi compris
const SPAWN_DIST = 120;          // un groupe apparaît en 3D à moins de 120 m
const DESPAWN_DIST = 170;        // et redevient « carte » au-delà de 170 m
const SAVE_KEY = 'terres-arides-save-v1';

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
let _uid = 1;
const uid = () => _uid++;
// articles pour des phrases correctes : « les Clans de Fer déclarent… »
const theF = (f, cap = false) => {
  const a = f.art || 'la';
  const s = (a === "l'" ? "l'" : a + ' ') + f.name;
  return cap ? s[0].toUpperCase() + s.slice(1) : s;
};
const vb = (f, sing, plur) => (f.art === 'les' ? plur : sing);
const toF = f => ({ la: 'à la ', "l'": "à l'", le: 'au ', les: 'aux ' }[f.art || 'la']) + f.name;
const deN = name => (/^[aeiouyéèêâîôûhAEIOUYÉÈÊÂÎÔÛH]/.test(name) ? "d'" : 'de ') + name;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Marchandises ----------
const GOODS = {
  food:   { name: 'Nourriture', icon: '🍖', base: 8,  w: 1 },
  cloth:  { name: 'Tissu',      icon: '🧵', base: 16, w: 1 },
  iron:   { name: 'Fer',        icon: '⛏️', base: 26, w: 2 },
  spices: { name: 'Épices',     icon: '🌶️', base: 42, w: 1 },
  arrows: { name: 'Flèches',    icon: '🏹', base: 1,  w: 0 },
};

// ---------- Objets (armes, arcs, armures, casques) ----------
const FIST = { name: 'Poings', dmg: 4, cd: 0.75, reach: 1.7 };
const ITEMS = {
  baton:     { name: 'Bâton',            slot: 'weapon', dmg: 6,  cd: 0.9,  reach: 2.2, price: 15,  w: 2, model: 'staff', len: 1.4, color: '#6e5538' },
  dague:     { name: 'Dague',            slot: 'weapon', dmg: 8,  cd: 0.7,  reach: 1.8, price: 40,  w: 1, model: 'blade', len: 0.4, color: '#c9ccd1' },
  machette:  { name: 'Machette rouillée', slot: 'weapon', dmg: 10, cd: 0.95, reach: 2.0, price: 45,  w: 2, model: 'blade', len: 0.7, color: '#8f6f55' },
  sabre:     { name: 'Sabre',            slot: 'weapon', dmg: 14, cd: 0.95, reach: 2.3, price: 140, w: 2, model: 'blade', len: 0.9, color: '#d8dadf' },
  epee:      { name: 'Épée longue',      slot: 'weapon', dmg: 17, cd: 1.1,  reach: 2.5, price: 240, w: 3, model: 'blade', len: 1.1, color: '#e2e4e8' },
  masse:     { name: "Masse d'armes",    slot: 'weapon', dmg: 20, cd: 1.3,  reach: 2.1, price: 200, w: 4, model: 'mace',  len: 0.7, color: '#5c5c5c' },
  hache:     { name: 'Hache de guerre',  slot: 'weapon', dmg: 23, cd: 1.4,  reach: 2.3, price: 300, w: 4, model: 'axe',   len: 0.9, color: '#6a6a6a' },
  lance:     { name: 'Lance',            slot: 'weapon', dmg: 15, cd: 1.1,  reach: 3.0, price: 160, w: 3, model: 'spear', len: 1.9, color: '#bdbdbd' },
  cimeterre: { name: 'Cimeterre solaire', slot: 'weapon', dmg: 19, cd: 1.0, reach: 2.4, price: 380, w: 3, model: 'blade', len: 1.0, color: '#e8c547' },

  arc_court: { name: 'Arc court', slot: 'bow', dmg: 12, range: 45, draw: 0.7, price: 90,  w: 1 },
  arc_long:  { name: 'Arc long',  slot: 'bow', dmg: 18, range: 70, draw: 1.0, price: 220, w: 2 },

  haillons:  { name: 'Haillons',          slot: 'armor', armor: 0, price: 2,   w: 1,  color: '#8a7a60' },
  tunique:   { name: 'Tunique',           slot: 'armor', armor: 1, price: 20,  w: 1,  color: null },
  robe:      { name: 'Robe sacrée',       slot: 'armor', armor: 2, price: 90,  w: 2,  color: '#efe6d0' },
  cuir:      { name: 'Armure de cuir',    slot: 'armor', armor: 3, price: 110, w: 4,  color: '#6b4a2b' },
  mailles:   { name: 'Cotte de mailles',  slot: 'armor', armor: 6, price: 320, w: 8,  color: '#8c9196', speed: -0.2 },
  plaques:   { name: 'Armure de plaques', slot: 'armor', armor: 9, price: 650, w: 12, color: '#b9bec4', speed: -0.5 },

  bandana:     { name: 'Bandana',        slot: 'helmet', armor: 0, price: 5,   w: 0, model: 'band' },
  capuche:     { name: 'Capuche',        slot: 'helmet', armor: 1, price: 15,  w: 0, model: 'hood' },
  turban:      { name: 'Turban',         slot: 'helmet', armor: 1, price: 20,  w: 0, model: 'turban' },
  casque_cuir: { name: 'Casque de cuir', slot: 'helmet', armor: 2, price: 60,  w: 1, model: 'cap',  color: '#6b4a2b' },
  casque_fer:  { name: 'Casque de fer',  slot: 'helmet', armor: 4, price: 180, w: 2, model: 'helm', color: '#8c9196' },
  heaume:      { name: 'Heaume',         slot: 'helmet', armor: 5, price: 300, w: 3, model: 'greathelm', color: '#b9bec4' },
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

// ---------- Lore ----------
const WORLD_LORE = [
  "Il y a soixante ans, l'Empire de Valmor s'est effondré quand ses grands puits se sont taris. " +
  "Ses cités de marbre sont devenues des ruines que le sable avale un peu plus chaque année.",
  "Sur les décombres, les survivants se sont regroupés. Les marchands de Port-Sable tiennent les routes du sel. " +
  "Les forgerons des Clans de Fer creusent la montagne noire. Les prêtres d'Ashara prient un soleil qui les brûle. " +
  "Les Nomades du Vent ne reconnaissent aucun mur.",
  "Dans les dunes, les Chiens des Dunes pillent tout ce qui bouge. Les alliances se font et se défont, " +
  "des seigneurs se proclament rois, des villes changent de bannière en une nuit.",
  "Toi, tu n'es personne. Pour l'instant.",
];

// Factions de départ. colors = [principale, secondaire, emblème]. map = couleur sur la carte.
const FACTION_DEFS = [
  {
    id: 'ligue', art: 'la', of: "de la Ligue", name: 'Ligue Marchande', map: '#3f7fd8',
    colors: ['#2f5d9e', '#e0b43a', '#f4ecd8'], flag: { pattern: 'bicolor-h', emblem: 'coin' },
    leader: 'Doge Aurelio Venn', motto: '« Tout a un prix. »',
    lore: "Une alliance de familles marchandes née des cendres de Valmor. La Ligue contrôle les routes du sel " +
      "et paie des mercenaires pour garder ses caravanes. Elle préfère acheter la paix plutôt que la gagner.",
    outfit: { body: '#2f5d9e', pants: '#2a2a33', tabard: true },
    troops: {
      recrue:  { weapon: ['sabre', 'dague'], armor: 'tunique', helmet: 'turban' },
      veteran: { weapon: ['sabre', 'epee', 'lance'], armor: 'mailles', helmet: 'casque_fer' },
      archer:  { weapon: ['dague'], bow: 'arc_court', armor: 'cuir', helmet: 'turban' },
    },
    shop: ['dague', 'sabre', 'epee', 'lance', 'arc_court', 'tunique', 'cuir', 'mailles', 'turban', 'casque_cuir', 'casque_fer'],
  },
  {
    id: 'clans', art: 'les', of: "des Clans de Fer", name: 'Clans de Fer', map: '#c0392b',
    colors: ['#2b2b2b', '#b3261e', '#d9d9d9'], flag: { pattern: 'bicolor-v', emblem: 'hammer' },
    leader: 'Grand-Forgeron Brakka', motto: '« Le fer ne ment pas. »',
    lore: "Mineurs et forgerons de la montagne noire. Les Clans fabriquent les meilleures armures du désert " +
      "et méprisent les prêtres d'Ashara, qui ont jadis brûlé leurs forges sacrées.",
    outfit: { body: '#3a3a3a', pants: '#241c18', tabard: true },
    troops: {
      recrue:  { weapon: ['masse', 'machette'], armor: 'cuir', helmet: 'casque_cuir' },
      veteran: { weapon: ['hache', 'masse'], armor: 'plaques', helmet: 'heaume' },
      archer:  { weapon: ['dague'], bow: 'arc_court', armor: 'cuir', helmet: 'casque_cuir' },
    },
    shop: ['machette', 'masse', 'hache', 'epee', 'cuir', 'mailles', 'plaques', 'casque_cuir', 'casque_fer', 'heaume'],
  },
  {
    id: 'concile', art: 'le', of: "du Concile", name: "Saint Concile d'Ashara", map: '#e8c547',
    colors: ['#efe6d0', '#d1a12c', '#7a5a1a'], flag: { pattern: 'border', emblem: 'sun' },
    leader: 'Haute Prêtresse Selune', motto: '« Le soleil voit tout. »',
    lore: "Une théocratie qui vénère le soleil comme juge suprême. Le Concile croit que la sécheresse " +
      "punit les pécheurs et veut convertir le désert entier, par la prière ou par l'épée.",
    outfit: { body: '#efe6d0', pants: '#cbb98f', tabard: true },
    troops: {
      recrue:  { weapon: ['lance', 'sabre'], armor: 'robe', helmet: 'turban' },
      veteran: { weapon: ['cimeterre', 'epee'], armor: 'mailles', helmet: 'casque_fer' },
      archer:  { weapon: ['dague'], bow: 'arc_long', armor: 'robe', helmet: 'turban' },
    },
    shop: ['lance', 'sabre', 'cimeterre', 'arc_long', 'robe', 'mailles', 'turban', 'casque_fer'],
  },
  {
    id: 'nomades', art: 'les', of: "des Nomades", name: 'Nomades du Vent', map: '#3f8f5a',
    colors: ['#a8743a', '#3f6b4a', '#e8d7b0'], flag: { pattern: 'diagonal', emblem: 'crescent' },
    leader: 'Khan Oruk le Borgne', motto: '« Le vent ne s\'arrête jamais. »',
    lore: "Des tribus libres qui suivent les puits au fil des saisons. Archers redoutables, " +
      "les Nomades commercent avec qui les respecte et disparaissent dans les dunes quand on les menace.",
    outfit: { body: '#a8743a', pants: '#5a4630', tabard: false },
    troops: {
      recrue:  { weapon: ['lance', 'dague'], armor: 'tunique', helmet: 'capuche' },
      veteran: { weapon: ['sabre'], bow: 'arc_long', armor: 'cuir', helmet: 'capuche' },
      archer:  { weapon: ['dague'], bow: 'arc_court', armor: 'tunique', helmet: 'capuche' },
    },
    shop: ['dague', 'lance', 'sabre', 'arc_court', 'arc_long', 'tunique', 'cuir', 'capuche'],
  },
  {
    id: 'bandits', art: 'les', of: "des Chiens des Dunes", name: 'Chiens des Dunes', map: '#1d1d1d', bandit: true,
    colors: ['#1f1a17', '#a01e1e', '#e0d0b0'], flag: { pattern: 'plain', emblem: 'skull' },
    leader: 'Mère Hyène', motto: '« Ce qui est à toi est à nous. »',
    lore: "Déserteurs, esclaves évadés et assassins. Les Chiens n'ont ni ville ni loi : ils pillent les caravanes " +
      "et attaquent les voyageurs isolés. On dit que Mère Hyène les dirige depuis les ruines de Valmor.",
    outfit: { body: '#5a3a2a', pants: '#2d2419', tabard: false },
    troops: {
      pillard: { weapon: ['machette', 'baton', 'dague'], armor: 'haillons', helmet: 'bandana' },
      archer:  { weapon: ['dague'], bow: 'arc_court', armor: 'haillons', helmet: 'bandana' },
      chef:    { weapon: ['hache', 'sabre'], armor: 'cuir', helmet: 'casque_cuir' },
    },
    shop: [],
  },
];

// Relations de départ entre factions (le reste est en paix ; les Chiens sont en guerre avec tous)
const START_WARS = [['clans', 'concile'], ['concile', 'nomades']];

// Villes et camps. produces = marchandise bon marché, demands = marchandise chère.
const SETTLEMENT_DEFS = [
  { name: 'Port-Sable',     x: -330, z: -300, faction: 'ligue',   type: 'ville', produces: 'food',   demands: 'spices', capital: true },
  { name: 'Sel-Amer',       x: -40,  z: -440, faction: 'ligue',   type: 'ville', produces: 'cloth',  demands: 'iron' },
  { name: 'Forge-Noire',    x: 360,  z: -330, faction: 'clans',   type: 'ville', produces: 'iron',   demands: 'food', capital: true },
  { name: 'Kharn',          x: 440,  z: 30,   faction: 'clans',   type: 'ville', produces: 'iron',   demands: 'cloth' },
  { name: 'Oasis-Rouge',    x: 320,  z: 380,  faction: 'concile', type: 'ville', produces: 'spices', demands: 'cloth', capital: true },
  { name: 'Hautemur',       x: -40,  z: 330,  faction: 'concile', type: 'ville', produces: 'cloth',  demands: 'iron' },
  { name: 'Camp des Vents', x: -430, z: 140,  faction: 'nomades', type: 'camp',  produces: 'spices', demands: 'iron', capital: true },
  { name: 'Puits-de-Lune',  x: -350, z: 450,  faction: 'nomades', type: 'camp',  produces: 'food',   demands: 'spices' },
];

// Ruines de l'Empire (décor + lore)
const RUINS = [
  { name: 'Ruines de Valmor', x: 40,   z: -40 },
  { name: 'Aqueduc brisé',    x: -220, z: -20 },
  { name: 'Tour des Veilleurs', x: 200, z: 160 },
];

// Générateurs pour les nouvelles factions et villes
const NEW_FACTION_PREFIX = { 'Fraternité': 'de la', 'Compagnie': 'de la', 'Horde': 'de la', 'Ordre': "de l'",
  'Maison': 'de la', 'Confrérie': 'de la', 'Légion': 'de la', 'Royaume': 'du' };
const NEW_FACTION_SUFFIX = ['des Cendres', 'des Sables Rouges', 'des Lames Brisées', "de l'Aube", 'du Serpent',
  'des Puits', 'des Oubliés', 'du Croissant Noir', 'de la Dernière Source', 'des Fils de Valmor', 'du Scorpion', 'de la Rose de Sel'];
const LEADER_FIRST = ['Varek', 'Ilsa', 'Moro', 'Kesh', 'Ardan', 'Nuala', 'Taddeo', 'Zahra', 'Gorm', 'Ysolde', 'Rakim', 'Lior'];
const LEADER_TITLE = ['Seigneur', 'Dame', 'Capitaine', 'Prophète', 'Baron', 'Reine', 'Chef de guerre', 'Gouverneur'];
const NEW_PLACE_NAMES = ['Roc-Fendu', 'Dune-Grise', 'Puits-Mort', 'Fort-Cendre', 'Ksar-Ilim', 'Halte-Rouge',
  'Tour-du-Guet', 'Bastion-Sec', 'Nid-de-Vautour', 'Mirage'];
const FLAG_PATTERNS = ['plain', 'bicolor-h', 'bicolor-v', 'diagonal', 'cross', 'border'];
const FLAG_EMBLEMS = ['coin', 'hammer', 'sun', 'crescent', 'skull', 'star', 'tower', 'eye', 'swords', 'triangle'];
const FACTION_PALETTE = [
  ['#5b2a6e', '#d9a441', '#f2e6d0', '#9b59b6'],
  ['#1e6b6b', '#e0e0d0', '#1a1a1a', '#1abc9c'],
  ['#8c3b1a', '#f0c27a', '#2a1a10', '#e67e22'],
  ['#3b4d1f', '#c9b458', '#f5f0dc', '#8bc34a'],
  ['#6b1f3a', '#e8e0d0', '#c9a227', '#e91e63'],
  ['#2a3550', '#9fc3ff', '#f0f0f0', '#5c7cfa'],
  ['#4a4a4a', '#e8862a', '#111111', '#ff9800'],
];
const GENERIC_TROOPS = {
  recrue:  { weapon: ['sabre', 'machette', 'lance'], armor: 'tunique', helmet: 'capuche' },
  veteran: { weapon: ['epee', 'hache', 'masse'], armor: 'mailles', helmet: 'casque_fer' },
  archer:  { weapon: ['dague'], bow: 'arc_court', armor: 'cuir', helmet: 'casque_cuir' },
};

// Création du personnage
const ORIGINS = [
  { id: 'vagabond', name: 'Vagabond', desc: 'Rien à perdre. 150 💰, une machette, un peu de nourriture.', money: 150,
    goods: { food: 4 }, equip: { weapon: 'machette', armor: 'tunique', helmet: 'capuche' }, bonus: {} },
  { id: 'marchand', name: 'Marchand ruiné', desc: '400 💰 et du tissu à revendre, mais -1 Force.', money: 400,
    goods: { food: 4, cloth: 6 }, equip: { weapon: 'dague', armor: 'tunique', helmet: 'turban' }, bonus: { F: -1 } },
  { id: 'deserteur', name: 'Déserteur', desc: '+1 Force, +1 Endurance. Sabre et cuir, mais 40 💰.', money: 40,
    goods: { food: 3 }, equip: { weapon: 'sabre', armor: 'cuir', helmet: 'casque_cuir' }, bonus: { F: 1, E: 1 } },
  { id: 'chasseur', name: 'Chasseur des dunes', desc: 'Un arc court et 30 flèches. +1 Agilité. 80 💰.', money: 80,
    goods: { food: 3, arrows: 30 }, equip: { weapon: 'dague', bow: 'arc_court', armor: 'tunique', helmet: 'capuche' }, bonus: { A: 1 } },
  { id: 'esclave', name: 'Esclave évadé', desc: '+2 Agilité. Des haillons, pas une pièce. Bonne chance.', money: 0,
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
