// Terres Arides — dangers : animaux sauvages, nuit, tempêtes de sable.
'use strict';

const isNight = () => {
  const phase = state.dayTimer / DAY_LENGTH;
  return 0.55 + 0.6 * Math.sin(phase * Math.PI * 2 + 0.3) < 0.35;
};

// Les animaux n'existent qu'autour de toi : ils apparaissent hors de vue et disparaissent loin derrière.
let wildTimer = 0;
function updateWildlife(dt) {
  wildTimer -= dt;
  if (wildTimer > 0 || !player) return;
  wildTimer = 3;
  const animals = units.filter(u => u.animal);
  for (const a of animals) if (d2(a.pos, player.pos) > 230) removeUnit(a);
  const near = animals.filter(a => !a.dead && d2(a.pos, player.pos) <= 230).length;
  const wanted = isNight() ? 14 : 9;
  if (near >= wanted || animals.length > 30) return;
  for (let t = 0; t < 10; t++) {
    const ang = rand(0, Math.PI * 2), r = rand(95, 160);
    const x = clamp(player.pos.x + Math.cos(ang) * r, -HALF + 10, HALF - 10), z = clamp(player.pos.z + Math.sin(ang) * r, -HALF + 10, HALF - 10);
    if (nearSettlement(x, z, 40) || nodeAt({ x, z }, 25)) continue;
    const b = biomeAt(x, z);
    const options = Object.keys(SPECIES).filter(k => SPECIES[k].biomes.includes(b));
    if (!options.length) continue;
    // la nuit, les prédateurs sont plus nombreux
    const preds = options.filter(k => SPECIES[k].pred), prey = options.filter(k => !SPECIES[k].pred);
    const usePred = preds.length && (!prey.length || Math.random() < (isNight() ? 0.65 : 0.35));
    const key = pick(usePred ? preds : prey);
    const [mn, mx] = SPECIES[key].pack;
    const n = randInt(mn, mx);
    for (let i = 0; i < n; i++) {
      const a = makeAnimal(key, x + rand(-5, 5), z + rand(-5, 5));
      a.home = { x, z };
    }
    break;
  }
}

// Tempêtes de sable dans le désert : on y voit mal, on avance moins vite et on s'abîme.
function updateStorm(dt) {
  if (state.storm > 0) {
    state.storm -= dt;
    if (state.storm <= 0) logMsg('La tempête de sable se calme.');
    if (player && biomeAt(player.pos.x, player.pos.z) === 'desert') {
      for (const u of team()) {
        if (!alive(u) || settlementAt(u.pos)) continue;
        u.stormTick = (u.stormTick || 0) + dt;
        if (u.stormTick > 3) { u.stormTick = 0; u.hp -= 2; drawBar(u); if (u.hp <= 0) kill(u, null); }
      }
    }
  } else {
    state.stormTimer = (state.stormTimer == null ? 300 : state.stormTimer) - dt;
    if (state.stormTimer <= 0) {
      state.stormTimer = rand(360, 700);
      state.storm = rand(60, 110);
      const inDesert = player && biomeAt(player.pos.x, player.pos.z) === 'desert';
      logMsg(inDesert ? '🌪 Une tempête de sable se lève ! Abrite-toi en ville.' : '🌪 Une tempête de sable balaie les déserts.', 'warn');
    }
  }
}
