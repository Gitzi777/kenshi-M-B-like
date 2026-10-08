// Terres Arides — parler aux PNJ : nouvelles, directions, travail (quêtes), recrutement, menaces, pots-de-vin.
'use strict';

// ---------- Qui peut-on aborder ? ----------
function talkTargetNear() {
  if (!player) return null;
  let best = null, bd = 2.6;
  for (const u of units) {
    if (u === player || !alive(u) || u.animal || isPlayerSide(u) || u.jailed || u.hidden) continue;
    const d = d2(u.pos, player.pos);
    if (d > bd) continue;
    // un ennemi en train de se battre ne discute pas
    if (hostile(player, u) && u.target && F(u.faction) && F(u.faction).behavior !== 'racket') continue;
    bd = d; best = u;
  }
  return best;
}
const BLURB = {
  habitant: ['Les temps sont durs, voyageur.', 'Encore une journée de poussière…', 'Tu n\'es pas d\'ici, toi.'],
  ouvrier: ['Le travail ne manque pas, la paie si.', 'Mes mains sont pleines de cals.', 'On trime du matin au soir.'],
  marchand: ['Bienvenue ! Tu cherches quelque chose ?', 'Mes prix sont les meilleurs de la région.', 'Approche, approche !'],
  artisan: ['Je travaille, mais je peux t\'écouter.', 'Belle lame que tu portes là.', 'Le métal, c\'est toute ma vie.'],
  soldat: ['Circule, voyageur.', 'Pas de grabuge en ville.', 'Je t\'ai à l\'œil.'],
  mercenaire: ['Tu cherches une lame à louer ?', 'Je me bats pour qui me paie.', 'Mon épée est à vendre.'],
  bandit: ['Qu\'est-ce que tu veux, toi ?', 'Tu as l\'air d\'avoir des poches pleines.', 'Avance pas trop.'],
  voyageur: ['Je suis sur la route depuis des jours.', 'Les routes ne sont plus sûres.', 'Tu viens d\'où, toi ?'],
};
function personFor(u) {
  return personOf(u) || u.tmpPerson || (u.tmpPerson = { name: u.name, job: u.civil ? (u.task && u.task.type === 'stall' ? 'marchand' : u.task && u.task.type === 'work' ? 'ouvrier' : 'habitant') : F(u.faction) && F(u.faction).bandit ? 'bandit' : 'soldat',
    courage: Math.random(), greed: Math.random(), wealth: randInt(5, 60), fame: 0, kills: 0, skills: u.skills, alive: true });
}
const moodOf = fid => {
  if (!F(fid)) return { txt: 'neutre', cls: '' };
  if (playerHostileTo(fid)) return { txt: 'hostile', cls: 'bad' };
  const r = state.rep[fid] || 0;
  return r >= 30 ? { txt: 'amical', cls: 'good' } : r <= -10 ? { txt: 'méfiant', cls: 'warn' } : { txt: 'neutre', cls: '' };
};
const dirName = (dx, dz) => ['à l\'est', 'au sud-est', 'au sud', 'au sud-ouest', 'à l\'ouest', 'au nord-ouest', 'au nord', 'au nord-est'][((Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) % 8) + 8) % 8];
const distTxt = d => d < 120 ? 'tout près' : d < 350 ? `à ${Math.round(d / 50) * 50} m` : `à une bonne journée de marche (${Math.round(d / 100) * 100} m)`;

// tâche en cours donnée par cette personne (retrouvée même après un chargement)
const questOf = u => (state.quests || []).find(q => !q.done && (q.giverId === u.id || (q.giverPid && q.giverPid === u.pid) || q.giver === u.name));

// ---------- Ouvrir une conversation ----------
function openTalk(u) {
  const p = personFor(u);
  u.yaw = Math.atan2(player.pos.x - u.pos.x, player.pos.z - u.pos.z);
  state.talk = { u, p, lines: [{ who: 'npc', text: greeting(u, p) }], done: {} };
  openPanel('talk');
}
function greeting(u, p) {
  const f = F(u.faction);
  if (f && isFugitiveFor(player, u.faction)) return 'Toi ! On te recherche. Donne-moi une bonne raison de ne pas appeler la garde.';
  if (f && playerHostileTo(u.faction)) return f.behavior === 'racket' ? 'La route se paie, l\'ami. Tu connais le tarif.' : 'Tu as du cran de venir me parler.';
  const q = questOf(u);
  if (q) return q.type === 'deliver' ? `Alors, tu as mes ${q.qty} ${GOODS[q.good].name.toLowerCase()} ?` : 'Alors, c\'est fait ?';
  if (p.fame >= 15) return `On m'appelle ${personName(p)}. Tu as sûrement entendu parler de moi.`;
  return pick(BLURB[p.job] || BLURB.habitant);
}

// ---------- Choix possibles ----------
function talkOptions() {
  const { u, p, done } = state.talk;
  const f = F(u.faction);
  const hostileNow = f && playerHostileTo(u.faction);
  const opts = [];
  const keeperOf = u.civil && u.task && u.task.type === 'stall' && state.currentTown ? state.currentTown.services.find(v => v.keeper === u.name) : null;
  if (keeperOf && !hostileNow) opts.push(['trade', `Voyons ce que tu vends`]);
  if (f && f.behavior === 'racket' && hostileNow) opts.push(['toll', 'Payer le passage']);
  if (!done.news) opts.push(['news', 'Quelles nouvelles ?']);
  if (!done.places) opts.push(['places', 'Des endroits à connaître dans le coin ?']);
  const q = questOf(u);
  if (q) opts.push(['turnin', q.type === 'deliver' ? `Te donner les ${GOODS[q.good].name.toLowerCase()}` : 'C\'est fait, je viens chercher ma récompense']);
  else if (!done.work && !hostileNow) opts.push(['work', 'Tu aurais du travail pour moi ?']);
  if (['mercenaire', 'habitant', 'ouvrier', 'voyageur'].includes(p.job) && !p.shop && !hostileNow) opts.push(['recruit', 'Rejoins-moi']);
  if (f && (isFugitiveFor(player, u.faction) || (hostileNow && !f.bandit && (state.rep[u.faction] || 0) > -80))) opts.push(['bribe', `Arranger les choses (${bribeCost(u)} 💰)`]);
  if (!hostileNow && !done.threat) opts.push(['threat', 'Menacer']);
  opts.push(['bye', 'Au revoir']);
  return opts;
}
const bribeCost = u => isFugitiveFor(player, u.faction) ? 120 : Math.round(80 + Math.max(0, -(state.rep[u.faction] || 0)) * 3);

function talkSay(who, text) { state.talk.lines.push({ who, text }); if (state.talk.lines.length > 8) state.talk.lines.shift(); }
function talkChoose(key) {
  const T_ = state.talk;
  if (!T_) return;
  const { u, p } = T_;
  const opt = talkOptions().find(o => o[0] === key);
  if (opt) talkSay('me', opt[1]);
  sfx('click', null, 0.5);
  switch (key) {
    case 'bye': closePanel(); state.talk = null; return;
    case 'trade': {
      const s = state.currentTown, v = s && s.services.find(v => v.keeper === u.name);
      closePanel(); state.talk = null;
      if (s && v) openBuilding(s, v);
      return;
    }
    case 'toll': closePanel(); state.talk = null; if (u.party) { state.toll = { party: u.party, fid: u.faction, lead: u }; openPanel('toll'); } return;
    case 'news': T_.done.news = true; talkSay('npc', rumorFor(u, p)); break;
    case 'places': T_.done.places = true; talkSay('npc', placesFor(u)); break;
    case 'work': T_.done.work = true; talkSay('npc', offerQuest(u, p)); break;
    case 'accept': acceptQuest(); break;
    case 'turnin': talkSay('npc', turnInQuest(u)); break;
    case 'recruit': talkSay('npc', recruitTalk(u, p)); break;
    case 'bribe': talkSay('npc', bribeTalk(u)); break;
    case 'threat': T_.done.threat = true; talkSay('npc', threatTalk(u, p)); break;
  }
  if (state.panel === 'talk') renderTalk();
}

// ---------- Réponses ----------
function rumorFor(u, p) {
  const r = Math.random();
  const famous = notables(6).filter(m => m !== p);
  if (r < 0.4 && famous.length) {
    const m = pick(famous);
    const q = state.parties.find(x => x.id === m.party);
    const where = q ? `${dirName(q.x - player.pos.x, q.z - player.pos.z)}, ${distTxt(d2(q, player.pos))}` : m.loc ? `du côté de ${m.loc}` : 'on ne sait où';
    return `On parle beaucoup de ${personName(m)}, ${rankLabel(m).toLowerCase()}${F(m.faction) ? ' ' + F(m.faction).of : ''}. ${m.kills ? m.kills + ' victimes, paraît-il' : 'Quelqu\'un de redouté'}. On l'a vu ${where}.`;
  }
  if (r < 0.65) {
    const band = state.parties.filter(q => F(q.faction) && F(q.faction).bandit && d2(q, player.pos) < 600).sort((a, b) => d2(a, player.pos) - d2(b, player.pos))[0];
    if (band) return `Méfie-toi : une bande de ${band.troops.length} ${F(band.faction).name.toLowerCase()} rôde ${dirName(band.x - player.pos.x, band.z - player.pos.z)}, ${distTxt(d2(band, player.pos))}.`;
  }
  if (r < 0.85 && state.currentTown && state.currentTown.stock) {
    const s = state.currentTown;
    const g = TRADE_GOODS.slice().sort((a, b) => marketPrice(s, b) / GOODS[b].base - marketPrice(s, a) / GOODS[a].base)[0];
    return `Ici, ${GOODS[g].name.toLowerCase()} se vend cher en ce moment (${marketPrice(s, g)} 💰). Si tu en as, c'est le moment.`;
  }
  const c = state.chronicle.slice(-6);
  return c.length ? `Tu as entendu ? ${pick(c).text}` : 'Rien de neuf sous le soleil.';
}
function placesFor(u) {
  const here = player.pos;
  const towns = state.settlements.filter(s => s !== state.currentTown && s.type !== 'repaire').sort((a, b) => d2(a, here) - d2(b, here));
  const parts = [];
  if (towns[0]) parts.push(`${towns[0].name} est ${dirName(towns[0].x - here.x, towns[0].z - here.z)}, ${distTxt(d2(towns[0], here))}`);
  const lair = state.settlements.filter(s => s.type === 'repaire').sort((a, b) => d2(a, here) - d2(b, here))[0];
  if (lair && d2(lair, here) < 700) parts.push(`le repaire ${F(lair.faction).of} se cache ${dirName(lair.x - here.x, lair.z - here.z)}, évite-le`);
  const node = state.nodes.filter(n => !n.owner).sort((a, b) => d2(a, here) - d2(b, here))[0];
  if (node) parts.push(`une exploitation sans maître (${RESOURCES[node.type].name.toLowerCase()}) t'attend ${dirName(node.x - here.x, node.z - here.z)}`);
  return parts.length ? parts.join(' ; ') + '.' : 'Je ne connais pas grand-chose au-delà des murs.';
}

// ---------- Quêtes ----------
function offerQuest(u, p) {
  if (!state.quests) state.quests = [];
  if (state.quests.filter(q => !q.done).length >= 5) return 'Tu as déjà bien assez à faire, reviens plus tard.';
  const f = F(u.faction);
  let q = null;
  if (p.job === 'soldat' || p.job === 'mercenaire') {
    const band = state.parties.filter(x => F(x.faction) && F(x.faction).bandit && x.kind === 'bandits' && d2(x, u.pos) < 700).sort((a, b) => d2(a, u.pos) - d2(b, u.pos))[0];
    if (band) {
      partyMembers(band);
      const lead = personById(band.members[0]);
      q = { type: 'bounty', partyId: band.id, target: lead ? personName(lead) : 'leur chef', reward: 120 + band.troops.length * 40 + (lead ? Math.round(lead.fame * 10) : 0),
        text: `Une bande menée par ${lead ? personName(lead) : 'un brigand'} rôde ${dirName(band.x - u.pos.x, band.z - u.pos.z)}. Disperse-la.` };
    }
  }
  if (!q && (p.job === 'marchand' || p.job === 'artisan') && state.currentTown) {
    const s = state.currentTown;
    const g = pick(TRADE_GOODS.filter(g => g !== 'food'));
    const qty = randInt(5, 12);
    q = { type: 'deliver', good: g, qty, reward: Math.round(marketPrice(s, g) * qty * 1.5), text: `Apporte-moi ${qty} ${GOODS[g].name.toLowerCase()} et je te paierai bien.` };
  }
  if (!q) {
    q = { type: 'hunt', count: 0, need: randInt(2, 4), reward: randInt(70, 140), x: u.pos.x, z: u.pos.z,
      text: 'Les bêtes sauvages attaquent nos gens. Tue quelques prédateurs dans les environs.' };
    q.text = `Les bêtes sauvages attaquent nos gens. Tue ${q.need} prédateurs dans les environs.`;
  }
  Object.assign(q, { id: uid(), giverId: u.id, giver: u.name, giverPid: u.pid || null, faction: u.faction, town: state.currentTown ? state.currentTown.name : null, done: false });
  state.talk.offer = q;
  return `${q.text} Récompense : ${q.reward} 💰.`;
}
function acceptQuest() {
  const q = state.talk.offer;
  if (!q) return;
  state.quests.push(q);
  state.talk.offer = null;
  talkSay('npc', 'Marché conclu. Reviens me voir quand ce sera fait.');
  logMsg(`📜 Nouvelle tâche : ${q.text}`, 'news');
}
function turnInQuest(u) {
  const q = questOf(u);
  if (!q) return '…';
  if (q.type === 'deliver') {
    if ((state.goods[q.good] || 0) < q.qty) return `Il m'en faut ${q.qty}, tu n'en as que ${Math.floor(state.goods[q.good] || 0)}.`;
    state.goods[q.good] -= q.qty;
    if (state.currentTown) state.currentTown.stock[q.good] += q.qty;
  } else if (!q.ready) return q.type === 'bounty' ? `${q.target} court toujours. Reviens quand ce sera réglé.` : `Il en reste ${q.need - q.count} à abattre.`;
  q.done = true;
  state.money += q.reward;
  if (F(q.faction) && !F(q.faction).bandit) state.rep[q.faction] = Math.min(100, (state.rep[q.faction] || 0) + 6);
  logMsg(`📜 Tâche accomplie : +${q.reward} 💰.`, 'news');
  sfx('coin');
  return pick(['Beau travail. Voilà ton dû.', 'Tu tiens parole, c\'est rare.', 'Je me souviendrai de toi.']);
}
// suivi des quêtes (appelé quand une unité tombe)
function questOnKill(o, by) {
  if (!state.quests || !by || !isPlayerSide(by)) return;
  for (const q of state.quests) {
    if (q.done || q.ready) continue;
    if (q.type === 'bounty' && o.party && o.party.id === q.partyId) q.hit = true;
    if (q.type === 'hunt' && o.animal && o.species.pred && Math.hypot(o.pos.x - q.x, o.pos.z - q.z) < 400 && ++q.count >= q.need) { q.ready = true; logMsg(`📜 Chasse terminée : retourne voir ${q.giver}.`, 'news'); }
  }
}
function questTick() {
  if (!state.quests) return;
  for (const q of state.quests) {
    if (q.done || q.ready || q.type !== 'bounty') continue;
    const band = state.parties.find(x => x.id === q.partyId);
    if (!band || (band.mat && !band.units.some(alive))) {
      if (q.hit) { q.ready = true; logMsg(`📜 La bande de ${q.target} est dispersée : retourne voir ${q.giver}.`, 'news'); }
      else { q.done = true; q.failed = true; logMsg(`📜 Quelqu'un d'autre s'est occupé de ${q.target}.`); }
    }
  }
}

// ---------- Recruter, soudoyer, menacer ----------
function recruitTalk(u, p) {
  if (squad().length + 1 >= MAX_SQUAD) return 'Ta bande est déjà bien remplie.';
  const price = Math.round((p.job === 'mercenaire' ? 1 : 0.6) * (typeof mercPrice === 'function' && p.skills ? mercPrice(p) : 120));
  const willing = p.job === 'mercenaire' || (p.courage > 0.45 && (state.rep[u.faction] || 0) > -10) || (p.wealth < 15 && Math.random() < 0.6);
  if (!willing) return pick(['Moi ? Je ne suis pas fait pour l\'aventure.', 'Non merci, j\'ai une famille ici.', 'Je tiens à ma peau.']);
  if (state.money < price) return `Pour ${price} 💰, je te suis. Mais tu n'as pas de quoi payer.`;
  state.money -= price;
  const pos = { x: u.pos.x, z: u.pos.z };
  if (u.civil) removeUnit(u); else { u.dead = true; removeUnit(u); }
  const m = personOf(u) || newPerson({ name: u.name, job: 'compagnon', skills: u.skills });
  m.job = 'compagnon'; m.loc = null; m.faction = 'player'; m.party = null;
  const nu = makeUnit({ faction: 'player', x: pos.x, z: pos.z, name: m.name, maxHp: 75, str: 2 + Math.floor(sk(m, 'force') / 15), speed: 4.7, arrows: 10,
    equip: u.equip && u.equip.weapon ? { ...u.equip } : { weapon: 'machette', armor: 'tunique' },
    look: { ...(u.look || {}), tint: player.look.body } });
  bindUnit(nu, m);
  nu.title = '';
  nu.bar.color = '#6fcf5a'; drawBar(nu); dressUnit(nu);
  closePanel(); state.talk = null;
  logMsg(`${nu.name} rejoint ton escouade ! (${price} 💰)`);
  return 'Allons-y.';
}
function bribeTalk(u) {
  const c = bribeCost(u);
  if (state.money < c) return 'Reviens avec de quoi me convaincre.';
  state.money -= c;
  if (player.fugitive && player.fugitive.f === u.faction) { for (const m of team()) m.fugitive = null; }
  state.rep[u.faction] = Math.max(state.rep[u.faction] || 0, -5);
  state.tollAngry && (state.tollAngry[u.faction] = false);
  logMsg(`💰 Tu achètes la paix avec ${theF(F(u.faction))}.`);
  return 'Bon… on n\'a rien vu. Ne recommence pas.';
}
function threatTalk(u, p) {
  const might = sk(player, 'attaque') + sk(player, 'force') * 0.5 + squad().length * 12 + (IT(player.equip.weapon) ? IT(player.equip.weapon).dmg : 0);
  const chance = clamp(0.25 + might / 150 - p.courage * 0.45 - (p.job === 'soldat' || p.job === 'bandit' ? 0.3 : 0), 0.05, 0.9);
  if (Math.random() < chance) {
    const coins = Math.min(80, Math.round((p.wealth || 20) * 0.4) + 5);
    state.money += coins;
    if (p.wealth != null) p.wealth = Math.max(0, p.wealth - coins);
    if (F(u.faction) && !F(u.faction).bandit) state.rep[u.faction] = (state.rep[u.faction] || 0) - 4;
    logMsg(`Tu extorques ${coins} 💰 à ${u.name}.`, 'warn');
    return pick([`D'accord, d'accord ! Prends ça et laisse-moi tranquille (${coins} 💰).`, `Pitié… voilà tout ce que j'ai (${coins} 💰).`]);
  }
  // échec : la personne se défend ou appelle la garde
  closePanel(); state.talk = null;
  if (u.civil) {
    u.flee = 6; u.fleeFrom = { x: player.pos.x, z: player.pos.z };
    for (const d of units) if (d.faction === u.faction && !d.civil && alive(d) && d2(d.pos, u.pos) < 35) { d.angryAt = player; d.target = player; }
    logMsg(`${u.name} appelle la garde !`, 'warn');
  } else { u.angryAt = player; u.target = player; logMsg(`${u.name} dégaine !`, 'warn'); }
  return 'Garde !';
}

// ---------- Affichage ----------
function renderTalk() {
  const T_ = state.talk;
  if (!T_) { closePanel(); return; }
  const { u, p } = T_;
  const f = F(u.faction);
  const mood = moodOf(u.faction);
  const title = p.job === 'soldat' || p.job === 'bandit' ? rankLabel(p) : JOBS[p.job] || '';
  const opts = T_.offer ? [['accept', 'J\'accepte'], ['bye', 'Non merci']] : talkOptions();
  $('talkpanel').innerHTML = `
    <div class="phead">${f ? flagImg(f, 26) : ''}<div><h3>${esc(personName(p))}</h3><small>${esc(title)}${f ? ' · ' + esc(f.name) : ''} · <span class="${mood.cls}">${mood.txt}</span>${p.fame >= 4 ? ` · prestige ${Math.floor(p.fame)}` : ''}</small></div>
      <button class="x" data-close>✕</button></div>
    <div class="pbody">
      <div class="dialog">${T_.lines.map(l => `<p class="${l.who}">${l.who === 'me' ? '<b>Toi :</b> ' : ''}${esc(l.text)}</p>`).join('')}</div>
      <div class="dopts">${opts.map(([k, t], i) => `<button data-talk="${k}"><b>${i + 1}.</b> ${esc(t)}</button>`).join('')}</div>
    </div>`;
}
document.getElementById('talkpanel').addEventListener('click', e => {
  if (e.target.closest('[data-close]')) { closePanel(); state.talk = null; return; }
  const b = e.target.closest('[data-talk]');
  if (b) talkChoose(b.dataset.talk);
});
window.addEventListener('keydown', e => {
  if (state.panel !== 'talk' || !/^Digit[1-9]$/.test(e.code)) return;
  const T_ = state.talk;
  const opts = T_ && (T_.offer ? [['accept'], ['bye']] : talkOptions());
  const o = opts && opts[Number(e.code.slice(5)) - 1];
  if (o) { e.stopImmediatePropagation(); talkChoose(o[0]); }
}, true);

// ---------- Journal des tâches (J) ----------
function renderJournal() {
  const qs = (state.quests || []).slice().reverse();
  const line = q => `<div class="item"><span><b>${q.done ? (q.failed ? '✗' : '✓') : q.ready ? '★' : '•'} ${esc(q.text)}</b>
    <small>Donnée par ${esc(q.giver)}${q.town ? ' à ' + esc(q.town) : ''} · ${q.reward} 💰${q.type === 'hunt' && !q.done ? ` · ${q.count}/${q.need}` : ''}${q.ready && !q.done ? ' · retourne voir ' + esc(q.giver) : ''}</small></span></div>`;
  $('journal').innerHTML = `<div class="phead"><h3>Journal</h3><button class="x" data-close>✕</button></div>
    <div class="pbody"><h4>En cours</h4><div class="items">${qs.filter(q => !q.done).map(line).join('') || '<small>Aucune tâche. Parle aux habitants (E) pour trouver du travail.</small>'}</div>
    <h4>Terminées</h4><div class="items">${qs.filter(q => q.done).slice(0, 10).map(line).join('') || '<small>—</small>'}</div></div>`;
}
document.getElementById('journal').addEventListener('click', e => { if (e.target.closest('[data-close]')) closePanel(); });
