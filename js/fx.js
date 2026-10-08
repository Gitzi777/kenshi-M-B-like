// Terres Arides — sensations : sons synthétisés, particules, tremblement de caméra, pause à l'impact.
'use strict';

// ---------- Sons (Web Audio, aucun fichier) ----------
const sfxState = { ctx: null, master: null, noise: null, wind: null, windGain: null, windFilter: null, nextAmb: 3 };
function audioInit() {
  if (sfxState.ctx) { if (sfxState.ctx.state === 'suspended') sfxState.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  sfxState.ctx = ctx;
  const master = ctx.createGain();
  master.gain.value = settings.volume != null ? settings.volume : 0.7;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp); comp.connect(ctx.destination);
  sfxState.master = master;
  // bruit blanc réutilisable
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  sfxState.noise = buf;
  // pas de bruit de fond continu (le souffle grésillait) : seulement des sons ponctuels et doux
}
['keydown', 'mousedown', 'touchstart'].forEach(ev => window.addEventListener(ev, audioInit, { capture: true }));
function setVolume(v) { settings.volume = v; if (sfxState.master) sfxState.master.gain.value = v; }

// volume selon la distance au personnage
function spatial(pos) {
  if (!pos || !player) return 1;
  const d = Math.hypot(pos.x - player.pos.x, pos.z - player.pos.z);
  return d > 45 ? 0 : 1 / (1 + d * d * 0.012);
}
function env(g, t, a, peak, dec) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}
function noiseHit(t, vol, freq, q, dec, type = 'bandpass', sweep) {
  const { ctx } = sfxState;
  const s = ctx.createBufferSource(); s.buffer = sfxState.noise;
  s.playbackRate.value = rand(0.9, 1.1);
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dec);
  const g = ctx.createGain(); env(g, t, 0.004, vol, dec);
  s.connect(f); f.connect(g); g.connect(sfxState.master);
  s.start(t, Math.random() * 1.5); s.stop(t + dec + 0.05);
}
function tone(t, vol, f0, f1, dec, type = 'sine', a = 0.004) {
  const { ctx } = sfxState;
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dec);
  const g = ctx.createGain(); env(g, t, a, vol, dec);
  o.connect(g); g.connect(sfxState.master);
  o.start(t); o.stop(t + a + dec + 0.05);
}
const SFX = {
  swing: (t, v) => noiseHit(t, 0.35 * v, rand(900, 1300), 1.2, 0.16, 'bandpass', rand(2500, 3200)),
  heavy: (t, v) => noiseHit(t, 0.4 * v, 500, 1, 0.22, 'bandpass', 1500),
  hit: (t, v) => { tone(t, 0.7 * v, rand(140, 170), 55, 0.13, 'sine'); noiseHit(t, 0.5 * v, 1200, 0.8, 0.09, 'lowpass'); },
  punch: (t, v) => { tone(t, 0.8 * v, rand(110, 130), 45, 0.1, 'sine'); noiseHit(t, 0.35 * v, 700, 1, 0.05, 'lowpass'); },
  block: (t, v) => { tone(t, 0.25 * v, rand(1900, 2200), 1700, 0.35, 'triangle'); tone(t, 0.18 * v, 3100, 2900, 0.22, 'square'); noiseHit(t, 0.3 * v, 4000, 2, 0.05); },
  ko: (t, v) => { tone(t, 0.6 * v, 90, 40, 0.3, 'sine'); noiseHit(t + 0.05, 0.4 * v, 300, 0.7, 0.25, 'lowpass'); },
  death: (t, v) => { tone(t, 0.3 * v, 220, 110, 0.5, 'sawtooth', 0.03); noiseHit(t + 0.1, 0.4 * v, 250, 0.7, 0.35, 'lowpass'); },
  bow: (t, v) => { tone(t, 0.3 * v, 180, 120, 0.18, 'triangle'); noiseHit(t, 0.2 * v, 2500, 1.5, 0.12, 'bandpass', 900); },
  arrowHit: (t, v) => { noiseHit(t, 0.4 * v, 900, 1, 0.07, 'lowpass'); tone(t, 0.3 * v, 160, 70, 0.08); },
  thunk: (t, v) => { tone(t, 0.35 * v, 260, 120, 0.07, 'square'); noiseHit(t, 0.25 * v, 600, 1, 0.05, 'lowpass'); },
  dodge: (t, v) => { noiseHit(t, 0.3 * v, 500, 0.8, 0.28, 'bandpass', 1800); },
  step: (t, v) => noiseHit(t, 0.07 * v, rand(250, 400), 0.9, 0.06, 'lowpass'),
  coin: (t, v) => { tone(t, 0.18 * v, 1568, 1568, 0.12, 'square'); tone(t + 0.07, 0.18 * v, 2093, 2093, 0.25, 'square'); },
  click: (t, v) => tone(t, 0.12 * v, 900, 600, 0.04, 'triangle'),
  skill: (t, v) => { [523, 659, 784].forEach((f, i) => tone(t + i * 0.07, 0.14 * v, f, f, 0.3, 'triangle')); },
  growl: (t, v) => { tone(t, 0.35 * v, rand(70, 95), 55, 0.6, 'sawtooth', 0.08); noiseHit(t, 0.25 * v, 200, 2, 0.5, 'bandpass'); },
  heal: (t, v) => { tone(t, 0.12 * v, 440, 880, 0.35, 'sine', 0.05); },
  unlock: (t, v) => { tone(t, 0.25 * v, 1200, 1200, 0.05, 'square'); tone(t + 0.08, 0.25 * v, 800, 800, 0.08, 'square'); },
  fail: (t, v) => tone(t, 0.2 * v, 300, 150, 0.2, 'square'),
  bird: (t, v) => { const f = rand(2500, 4200); for (let i = 0; i < randInt(2, 4); i++) tone(t + i * 0.11, 0.05 * v, f, f * rand(0.7, 1.3), 0.08, 'sine', 0.01); },
  cricket: (t, v) => { for (let i = 0; i < 3; i++) tone(t + i * 0.07, 0.02 * v, 3200, 3150, 0.05, 'sine', 0.01); },
  murmur: (t, v) => { for (let i = 0; i < 2; i++) tone(t + i * rand(0.15, 0.25), 0.015 * v, rand(180, 260), rand(160, 240), 0.2, 'sine', 0.06); },
};
function sfx(name, pos, vol = 1) {
  const { ctx } = sfxState;
  if (!ctx || ctx.state !== 'running' || !SFX[name]) return;
  const v = vol * spatial(pos);
  if (v < 0.02) return;
  SFX[name](ctx.currentTime + 0.005, v);
}

// ambiance : oiseaux le jour, grillons la nuit, rumeur des villes (sons ponctuels, jamais de souffle continu)
function updateAmbience(dt) {
  const { ctx } = sfxState;
  if (!ctx || !player || settings.ambience === false) return;
  const bio = biomeAt(player.pos.x, player.pos.z);
  sfxState.nextAmb -= dt;
  if (sfxState.nextAmb > 0) return;
  sfxState.nextAmb = rand(4, 10);
  const town = settlementAt(player.pos, 10);
  if (town && town.type !== 'repaire' && !isNight()) { sfx('murmur', null, 1); return; }
  if (isNight()) sfx('cricket', null, bio === 'desert' ? 0.6 : 1);
  else if (bio === 'foret' || bio === 'steppe') sfx('bird', null, bio === 'foret' ? 1 : 0.5);
}

// ---------- Particules (un seul maillage instancié) ----------
const PMAX = 700;
const parts = [];
const partMesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: '#ffffff' }), PMAX);
partMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
partMesh.frustumCulled = false;
for (let i = 0; i < PMAX; i++) partMesh.setColorAt(i, new T.Color('#ffffff')); // crée les couleurs avant la 1re image
partMesh.count = 0;
scene.add(partMesh);
const _pm = new T.Matrix4(), _pq = new T.Quaternion(), _pe = new T.Euler(), _ps = new T.Vector3(), _pp = new T.Vector3(), _pc = new T.Color();
// burst(position, { n, color(s), speed, up, life, size, grav, spread })
function burst(pos, o = {}) {
  const n = o.n || 8;
  const colors = Array.isArray(o.color) ? o.color : [o.color || '#ffffff'];
  for (let i = 0; i < n; i++) {
    if (parts.length >= PMAX) parts.shift();
    const a = Math.random() * Math.PI * 2, sp = (o.speed || 3) * rand(0.4, 1);
    const dir = o.dir;
    let vx = Math.cos(a) * sp, vz = Math.sin(a) * sp;
    if (dir) { vx = vx * (o.spread || 0.5) + dir.x * sp; vz = vz * (o.spread || 0.5) + dir.z * sp; }
    parts.push({
      x: pos.x + rand(-0.1, 0.1), y: pos.y + (o.y || 0) + rand(-0.1, 0.1), z: pos.z + rand(-0.1, 0.1),
      vx, vy: (o.up != null ? o.up : 2) * rand(0.5, 1.2), vz,
      life: (o.life || 0.6) * rand(0.6, 1.2), age: 0, size: (o.size || 0.08) * rand(0.6, 1.3),
      grav: o.grav != null ? o.grav : 9, drag: o.drag || 1.5, rot: rand(0, 6), spin: rand(-8, 8),
      color: new T.Color(pick(colors)).convertSRGBToLinear(), grow: o.grow || 0,
    });
  }
}
function updateParticles(dt) {
  let k = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.age += dt;
    if (p.age >= p.life) { parts.splice(i, 1); continue; }
    p.vy -= p.grav * dt;
    const dr = Math.exp(-p.drag * dt);
    p.vx *= dr; p.vz *= dr;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const g = heightAt(p.x, p.z);
    if (p.y < g + 0.02) { p.y = g + 0.02; p.vy *= -0.25; p.vx *= 0.6; p.vz *= 0.6; p.spin *= 0.5; }
    p.rot += p.spin * dt;
    const f = 1 - p.age / p.life;
    const s = p.size * (p.grow ? 1 + p.grow * (1 - f) : Math.min(1, f * 2.5));
    _pe.set(p.rot, p.rot * 0.7, 0);
    _pm.compose(_pp.set(p.x, p.y, p.z), _pq.setFromEuler(_pe), _ps.set(s, s, s));
    partMesh.setMatrixAt(k, _pm);
    partMesh.setColorAt(k, _pc.copy(p.color));
    k++;
  }
  partMesh.count = k;
  partMesh.instanceMatrix.needsUpdate = true;
  if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;
}

// poussière ambiante qui flotte autour du joueur (feuilles en forêt, sable dans le désert)
let moteTimer = 0;
function updateMotes(dt) {
  if (!player || state.mode !== 'play') return;
  moteTimer -= dt;
  if (moteTimer > 0) return;
  const bio = biomeAt(player.pos.x, player.pos.z);
  const storm = state.storm > 0 && bio === 'desert';
  moteTimer = storm ? 0.02 : 0.25;
  const a = rand(0, Math.PI * 2), r = rand(3, 16);
  const x = player.pos.x + Math.cos(a) * r, z = player.pos.z + Math.sin(a) * r;
  const wind = { x: Math.cos(0.6), z: Math.sin(0.6) };
  const look = bio === 'foret' ? { color: ['#6f8a3a', '#a07a32', '#8a9a40'], size: 0.09, life: 4, grav: 0.4, up: -0.2 }
    : storm ? { color: ['#d2a66a', '#c08a50'], size: 0.06, life: 1.5, grav: 0, up: 0.2 }
      : { color: ['#e8d5a8', '#f2e6c4'], size: 0.035, life: 3.5, grav: -0.05, up: 0.1 };
  burst({ x, y: heightAt(x, z) + rand(0.5, 3), z }, { n: 1, ...look, speed: storm ? 9 : 1.2, dir: wind, spread: 0.3, drag: 0.1 });
}

// ---------- Impacts : tremblement et pause ----------
const fx = { shake: 0, hitstop: 0 };
function impact(strength, stop) {
  fx.shake = Math.min(0.6, fx.shake + strength);
  fx.hitstop = Math.max(fx.hitstop, stop || 0);
}
function applyShake(dt) {
  if (fx.shake <= 0.001) return;
  const s = fx.shake * fx.shake;
  const t = performance.now() / 1000;
  camera.position.x += Math.sin(t * 61) * s * 0.5;
  camera.position.y += Math.sin(t * 73 + 1) * s * 0.4;
  camera.position.z += Math.sin(t * 67 + 2) * s * 0.5;
  fx.shake = Math.max(0, fx.shake - dt * 1.8);
}
