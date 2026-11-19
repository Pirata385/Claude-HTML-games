// state.js — the save: money, day, creatures, eggs, inventory, upgrades, and the rules that move
// it forward (feeding, training, nesting, sleeping). No DOM; scenes only call into this.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, clamp, hashStr } = RB.core;
  const GN = RB.genome;

  const BIRD_NAMES = [
    'Pepper', 'Biscuit', 'Farofa', 'Pimenta', 'Trovao', 'Pipoca', 'Fuba', 'Quindim', 'Pacoca', 'Cuscuz', 'Jilo', 'Faisca', 'Brasa', 'Ticao', 'Banze', 'Fuzue', 'Muvuca',
    'Xodo', 'Caju', 'Dende', 'Mandioca', 'Rapadura', 'Canjica', 'Tapioca', 'Moqueca', 'Sabia', 'Zangado', 'Relampago', 'Ventania', 'Capitao', 'Baronesa', 'Duque',
    'Marques', 'Comadre', 'Valente', 'Mimoso', 'Furacao', 'Chuvisco', 'Garoa', 'Poeira', 'Carvao', 'Ferrugem', 'Canela', 'Cravo', 'Mostarda', 'Pequi', 'Jabuti',
    'Tucupi', 'Feijao', 'Torresmo', 'Bolacha', 'Cocada', 'Brigadeiro', 'Goiabada', 'Catuaba', 'Bambu', 'Graveto', 'Pedrita', 'Pamonha', 'Curau', 'Mungunza', 'Acaraje',
    'Vatapa', 'Baiao', 'Xaxado', 'Forro', 'Frevo', 'Samba', 'Chorinho', 'Maracatu', 'Pirulito', 'Chiclete', 'Pacoquinha', 'Jujuba', 'Bombom', 'Sonho', 'Pastel',
    'Coxinha', 'Esfiha', 'Empada', 'Pudim', 'Mingau', 'Angu', 'Polenta', 'Pinhao', 'Jabuticaba', 'Pitanga', 'Acerola', 'Cupuacu', 'Graviola', 'Manga', 'Maracuja',
    'Guarana', 'Carambola', 'Tamarindo', 'Abacaxi', 'Melancia', 'Azeitona', 'Batuta', 'Bigode', 'Careca', 'Cabecao', 'Tampinha', 'Tico', 'Teco', 'Bidu', 'Toto',
    'Fumaca', 'Neblina', 'Granizo', 'Trovoada', 'Tempestade', 'Raio', 'Cometa', 'Foguete', 'Turbo', 'Corisco', 'Lampiao', 'Sargento', 'Almirante', 'Doutor', 'Professor',
    'Princesa', 'Rainha', 'Imperador', 'Sultao', 'Pirata', 'Bandido', 'Cangaceiro', 'Vaqueiro', 'Boiadeiro', 'Sanfona', 'Pandeiro', 'Cuica', 'Tamborim', 'Berimbau',
    'Viola', 'Gaita', 'Apito', 'Biruta', 'Pipa', 'Peteca', 'Piao', 'Ioio', 'Bolinha', 'Pingo', 'Floco', 'Algodao', 'Pluma', 'Penacho', 'Topete', 'Esporao', 'Bicudo',
    'Tinoco', 'Mane', 'Juvenal', 'Tonico', 'Genoveva', 'Clotilde', 'Gertrudes', 'Filomena', 'Esmeralda', 'Perola', 'Rubi', 'Safira', 'Topazio', 'Jade', 'Opala', 'Ambar',
    'Cobre', 'Bronze', 'Prata', 'Diamante', 'Nugget', 'Waffles', 'Pancake', 'Muffin', 'Noodle', 'Pickles', 'Dumpling', 'Peanut', 'Pretzel', 'Sprout', 'Turnip', 'Radish',
    'Clover', 'Thistle', 'Bramble', 'Rusty', 'Sparky', 'Ziggy', 'Rocket', 'Thunder', 'Blizzard', 'Gizmo', 'Gumbo', 'Tater', 'Chickpea', 'Meringue', 'Custard', 'Truffle',
    'Paprika', 'Saffron', 'Nutmeg', 'Ginger', 'Juniper', 'Basil', 'Sage', 'Admiral', 'Duchess', 'Baron', 'Marmalade', 'Crumpet', 'Toffee', 'Sprinkles', 'Dynamo',
    'Tornado', 'Pistachio'];

  // opts: { sandbox: everything unlocked from the start (every upgrade and tool, the lab powered,
  //   no debt, the open sea) }
  function create(seed, opts) {
    const S = {
      v: 1, seed: seed >>> 0, rs: (seed ^ 0x51ab) >>> 0, day: 1, time: 6, money: 150, debt: 15000, heat: 0, heatPeople: 0, heatDays: 0, nextId: 1,
      birds: [], eggs: [], roost: [], released: [], markers: {}, visited: {}, isles: [], netted: {}, unlocked: {}, fame: [],
      inv: { net: 3, shovel: 10, grain: 8 }, equip: {}, up: { cage: 0, engine: 0, tires: 0, coop: 0, nest: 0, incubator: 0, dummy: 0, boat: 0 },
      feeder: 0, pos: null, dug: {}, marksDug: {}, wildGone: null, npc: {}, league: {}, bets: {},
      lab: { power: false, fuses: 0, atlas: {}, vials: [], fossils: {}, seq: {} },
      codex: { species: {}, ach: {} }, bfc: { stamps: 0, sold: 0 },
      stats: { fights: 0, wins: 0, caught: 0, dug: 0, bred: 0, sold: 0, earned: 0, kidnapped: 0 },
      goal: 0, won: false,
    };
    S._rng = new Rng(S.rs);
    const r = S._rng;
    addBird(S, RB.species.make('chicken', r, { sex: 'M', sport: 0 }), { name: 'Capitao', bond: 0.5, origin: 'start' });
    addBird(S, RB.species.make('chicken', r, { sex: 'F', sport: 0 }), { name: 'Farofa', bond: 0.5, origin: 'start' });
    S.codex.species.chicken = true;
    if (opts && opts.sandbox) {
      S.sandbox = true; S.debt = 0; S.money = 5000;
      for (const id of Object.keys(RB.items.UPGRADES)) S.up[id] = RB.items.UPGRADES[id].prices.length;
      for (const id of ['detector', 'launcher', 'lantern', 'silvernet', 'goldshovel']) S.equip[id] = true;
      S.lab.power = true; S.inv.net = 10; S.inv.bignet = 5; S.inv.seed = 5;
    }
    return S;
  }
  // The open sea: unlocked by beating the Grand Ring and paying off the debt (or from the start in
  // a sandbox game). Reaching it takes the speedboat kit.
  const openSea = (S) => !!S.sandbox || (!!S.won && S.debt <= 0);
  const hasBoat = (S) => !!(S.up && S.up.boat);

  function freeName(S, r) {
    const used = new Set(S.birds.concat(S.roost || []).map((b) => b.name));
    for (let i = 0; i < 30; i++) { const n = r.pick(BIRD_NAMES); if (!used.has(n)) return n; }
    return r.pick(BIRD_NAMES) + ' ' + (2 + r.int(0, 97));
  }

  // o: { name, age, bond, origin, at, person (npc id), clothes, mom, dad (species labels of the parents) }
  // A new creature, not yet anywhere (addBird puts it in your flock).
  function makeBird(S, genome, o) {
    o = o || {};
    const c = { id: S.nextId++, name: o.name || freeName(S, S._rng), g: genome, age: 0, bond: o.bond === undefined ? 0.1 : o.bond, at: o.at || 'home', origin: o.origin || 'wild',
      train: { muscle: 0, lungs: 0, reflex: 0, courage: 0 }, cond: 1, hp: 1, rest: 0, tired: false, fed: false, hungry: 0, bouts: 0, trained: false, wins: 0, losses: 0,
      hat: null, gear: null, buff: null, love: false, person: o.person || null, clothes: o.clothes || null, mom: o.mom || null, dad: o.dad || null, momKey: o.momKey || null, dadKey: o.dadKey || null, inj: 0 };
    c.age = o.age === undefined ? pheno(c).growDays + 1 : o.age;
    c._P = null;
    return c;
  }
  function addBird(S, genome, o) { const c = makeBird(S, genome, o); S.birds.push(c); return c; }

  // The tonic of eternal vigor (c.eternal): 1 in a normal game, the bird never dies (unless it goes to
  // BFC) and can breed for ever, but still retires from the ring and the sideshow; 2 in a sandbox
  // game, no limits at all: it never retires and its body never grows old.
  // The age its body shows: a sandbox eternal stays in its prime however old it gets.
  function bodyAge(c) {
    if (c.eternal !== 2) return c.age;
    const prime = Math.floor(Math.round(GN.traitValue(c.g, 'lifespan')) * 0.8);
    return Math.min(c.age, prime);
  }
  // Phenotype of a creature, cached until something that shapes it changes.
  function pheno(c) {
    const age = bodyAge(c), key = age + '|' + c.train.muscle + c.train.lungs + c.train.reflex + c.train.courage + '|' + c.cond;
    if (!c._P || c._Pk !== key) { c._P = RB.pheno.express(c.g, { age, train: c.train, cond: c.cond }); c._Pk = key; }
    return c._P;
  }
  const dirty = (c) => { c._P = null; };

  // What kind it is, as a key: a species id, 'human', or for a cross 'dadKey*momKey'. Young of two
  // parents of the same kind are of that kind; young of two different kinds are a new, mixed kind
  // that its own young carry on.
  function kindKey(c) {
    if (c.person) return 'human';
    if (c.momKey && c.dadKey) return c.momKey === c.dadKey ? c.momKey : c.dadKey + '*' + c.momKey;
    return pheno(c).species.id;
  }
  const isCross = (c) => !!(c.momKey && c.dadKey && c.momKey !== c.dadKey);
  // A sex-neutral name for a kind, used to name crosses after both parents.
  function label(c) {
    if (c.person) return c.kindName || 'Person';
    if (isCross(c)) return RB.species.blendNames(c.dad, c.mom);
    const id = c.momKey && RB.species.SPECIES[c.momKey] ? c.momKey : c.momKey ? null : pheno(c).species.id;
    return id ? RB.species.generic(id) : c.mom;
  }
  // What to call its kind on its card: crosses are named after their parents' kinds.
  function kind(c) {
    if (c.person) return c.kindName || 'Person'; // a person, or the Coronel's sort of person: a rooster-man
    if (isCross(c)) return RB.species.blendNames(c.dad, c.mom);
    if (c.momKey && RB.species.SPECIES[c.momKey]) return RB.species.nameOf(RB.species.SPECIES[c.momKey], c.g.sex);
    if (c.momKey) return c.mom;
    return pheno(c).species.name;
  }
  const isAdult = (c) => pheno(c).grow >= 1;
  // Past its lifespan a bird does not die: it retires. A retired bird no longer fights, nests,
  // trains or goes to the sideshow; Sunset Roost will look after it, or BFC will take it.
  // A sandbox bird with eternal vigor never retires.
  const isRetired = (c) => !c.person && c.eternal !== 2 && c.age >= pheno(c).lifespan;
  // Can still raise young: not retired, or kept going by eternal vigor.
  const canBreed = (c) => !isRetired(c) || !!c.eternal;

  const byId = (S, id) => S.birds.find((b) => b.id === id) || null;
  const at = (S, where) => S.birds.filter((b) => b.at === where);
  const atHome = (S) => S.birds.filter((b) => b.at !== 'cage');
  const cageCap = () => Infinity; // the truck has no limit
  const coopCap = (S) => RB.items.COOP[S.up.coop];
  const nestCount = (S) => 1 + S.up.nest;
  // In a sandbox game every useful item and every cosmetic is endless: tools, feed, gear, hats and
  // lab supplies (not relics, which are only worth selling, and not bundles like the grain sack).
  const ENDLESS_KINDS = ['tool', 'feed', 'gear', 'hat', 'face', 'neck', 'back', 'feet', 'tail', 'lab'];
  const endless = (S, item) => { const it = RB.items.ITEMS[item]; return !!S.sandbox && !!it && ENDLESS_KINDS.includes(it.kind) && !it.gives; };
  const count = (S, item) => (endless(S, item) ? Infinity : S.inv[item] || 0);
  // the items you have, as ids: what is in the bag, and in a sandbox every endless one
  function owned(S) {
    const ids = Object.keys(S.inv).filter((id) => RB.items.ITEMS[id] && count(S, id) > 0);
    if (S.sandbox) for (const id of Object.keys(RB.items.ITEMS)) if (endless(S, id) && !ids.includes(id)) ids.push(id);
    return ids;
  }
  const fmtCount = (n) => (n === Infinity ? '∞' : String(n));
  function give(S, item, n) { if (endless(S, item)) return; S.inv[item] = (S.inv[item] || 0) + (n === undefined ? 1 : n); }
  function take(S, item, n) { n = n === undefined ? 1 : n; if (endless(S, item)) return true; if (count(S, item) < n) return false; S.inv[item] -= n; if (S.inv[item] <= 0) delete S.inv[item]; return true; }
  // ---- what a creature wears: a hat, something on the face, the neck, the back, the feet and the
  // tail (all for show), and one piece of fighting kit. c.hat and c.gear as before; the rest in c.acc.
  const slotOf = (id) => (RB.items.ITEMS[id] || {}).kind;
  function wornIn(c, slot) { return slot === 'hat' ? c.hat || null : slot === 'gear' ? c.gear || null : (c.acc && c.acc[slot]) || null; }
  function setSlot(c, slot, id) {
    if (slot === 'hat') c.hat = id || null; else if (slot === 'gear') c.gear = id || null;
    else { c.acc = c.acc || {}; if (id) c.acc[slot] = id; else delete c.acc[slot]; }
  }
  // Put something on (whatever was in that place goes back in the bag). Returns '' or why not.
  function wear(S, c, id) {
    const slot = slotOf(id);
    if (!RB.items.SLOTS.includes(slot)) return 'That is not something to wear.';
    if (!take(S, id)) return 'You have none left.';
    const old = wornIn(c, slot);
    if (old) give(S, old);
    setSlot(c, slot, id);
    return '';
  }
  function unwear(S, c, slot) { const old = wornIn(c, slot); if (old) { give(S, old); setSlot(c, slot, null); } return old; }
  const outfit = (c) => RB.items.SLOTS.map((sl) => wornIn(c, sl)).filter(Boolean);
  // Pieces won through feats: hand over any earned and not yet given. Returns the item ids given.
  function grantUnlocks(S) {
    S.unlocked = S.unlocked || {};
    const got = [];
    for (const ach of Object.keys(RB.items.UNLOCKS)) {
      if (!S.codex.ach[ach] || S.unlocked[ach]) continue;
      S.unlocked[ach] = true; give(S, RB.items.UNLOCKS[ach]); got.push(RB.items.UNLOCKS[ach]);
    }
    return got;
  }
  // ---- habits: about half the birds settle into a quirk of their own once they are grown (the rest
  // just get on with being birds). Fixed for each bird; purely how it behaves in the yard.
  const QUIRKS = { circles: 'walks in circles', chaser: 'chases the others about', starer: 'stares at things for ages', singer: 'sings at odd hours', grudge: 'has it in for one bird' };
  const QUIRK_IDS = Object.keys(QUIRKS);
  function quirkOf(S, c) {
    if (!c || c.person || c.visitor || !isAdult(c)) return null;
    if (c.quirk !== undefined) return c.quirk;
    const h = hashStr(S.seed + ':q:' + c.id);
    return h % 100 < 48 ? QUIRK_IDS[Math.floor(h / 100) % QUIRK_IDS.length] : null;
  }
  // The one bird a grudge-bearer picks on, of those around it: always the same one while it is there.
  function grudgeTarget(c, list) {
    const others = list.filter((o) => o !== c && !o.person && !o.visitor);
    if (!others.length) return null;
    const k = (o) => hashStr(c.id + '>' + o.id);
    return others.reduce((best, o) => (k(o) < k(best) ? o : best));
  }

  // ---- arena champions: an arena you have won is held by the bird that won it. When that bird
  // retires, or leaves you (sold, sent to BFC, set free, traded, or dead of old age on an island),
  // the title stands empty; a day later a new champion claims it, and you can fight them for it.
  function championAt(S, id) {
    for (const c of S.birds) if (c.id === id) return c;
    for (const c of S.roost || []) if (c.id === id) return c;
    for (const isle of S.isles || []) for (const c of isle.birds) if (c.id === id) return c;
    return null;
  }
  function championsNight(S, lines) {
    for (const id of Object.keys(S.league || {})) {
      const lg = S.league[id], A = RB.economy.ARENA[id];
      if (!A || !lg.boss) continue;
      if (lg.champ === undefined) { // won before champions were kept: the bird wearing the title, if any
        const holder = everyone(S).map((e) => e[0]).find((c) => (c.titles || []).includes('Champion of ' + A.name));
        if (!holder) continue;
        lg.champ = holder.id; lg.champName = holder.name;
      }
      if (lg.vacant === undefined) {
        const c = championAt(S, lg.champ);
        if (c && !isRetired(c) && c.at !== 'roost') continue;
        lg.vacant = c ? S.day : S.day - 1; // retired this morning, or gone during the day
        lines.push((c ? c.name + ' has retired' : (lg.champName || 'Your champion') + ' is no longer yours') + ': nobody holds the title at ' + A.name + ' now.' + (c ? ' Someone will claim it tomorrow.' : ''));
      }
      if (S.day >= lg.vacant + 1) {
        lg.boss = false; lg.ever = true; lg.gen = (lg.gen || 0) + 1;
        delete lg.champ; delete lg.vacant;
        const b = RB.economy.bossOf(S, A);
        lines.push(A.name + ' has a new champion: ' + b.trainer + ' and ' + b.bird + '. Beat them there to take the title back.');
      }
    }
  }

  // ---- the Hall of Fame: the birds that mattered. Notes are kept on each bird as things happen
  // (note, title); fameCheck looks over the flock and keeps a snapshot of every bird that has earned a
  // place (champions, record holders, curious stories, retired fighters), so they stay in the Hall
  // after they are gone: sold, set free, sent to BFC, or long retired.
  const NOTE_MAX = 8, FAME_MAX = 60;
  function note(S, c, text) { if (!c || c.person || c.visitor) return; c.log = (c.log || []).concat([{ d: S.day, t: text }]).slice(-NOTE_MAX); }
  function title(c, t) { if (!c || c.person || c.visitor) return; c.titles = c.titles || []; if (!c.titles.includes(t)) c.titles.push(t); }
  const fameOf = (S, id) => (S.fame || []).find((e) => e.id === id) || null;
  // A bird of the Hall leaves you: say how, so the Hall remembers.
  function fameLeave(S, c, why) { const e = fameOf(S, c.id); if (e) { e.status = why + ' on day ' + S.day; e.gone = true; } }
  function snapshot(S, c, where) {
    const P = pheno(c);
    return { id: c.id, name: c.name, kind: kind(c), sex: c.g.sex, g: GN.serialize(c.g), age: c.age, kg: +P.weightKg.toFixed(2), wins: c.wins, losses: c.losses,
      speed: P.rate.speed, power: P.rate.power, tough: P.rate.tough, score: Math.round(statScore(P)), great: outstanding(P), shows: c.shows || 0, showWins: c.showWins || 0,
      origin: c.origin, mom: c.mom, dad: c.dad, gen: c.gen || 0, taken: c.taken || 0, retired: isRetired(c), quirk: quirkOf(S, c),
      hat: c.hat || null, acc: c.acc ? Object.assign({}, c.acc) : null, odd: P.odd.slice(), log: (c.log || []).slice(), status: where, gone: false, day: S.day };
  }
  // Every bird you have now, and where it is.
  function everyone(S) {
    const out = [];
    for (const c of S.birds) if (!c.person) out.push([c, c.at === 'cage' ? 'In the truck' : c.at.startsWith('nest') ? 'Nesting at home' : c.at === 'crate' ? 'Waiting for the BFC van' : 'In your yard']);
    for (const c of S.roost || []) out.push([c, 'Retired at Sunset Roost']);
    for (const isle of S.isles || []) for (const c of isle.birds) if (!c.person) out.push([c, 'Living on ' + isle.name]);
    return out;
  }
  const RECORDS = [['wins', 'Record: most wins', 5], ['showWins', 'Record: most sideshow wins', 3], ['kg', 'Record: heaviest', 8], ['age', 'Record: oldest', 12], ['speed', 'Record: fastest', 60]];
  // A bird's all-round fighting numbers, 0..100.
  const STAT_KEYS = ['power', 'speed', 'tough', 'stamina', 'guts', 'wits', 'fury'];
  const statScore = (P) => STAT_KEYS.reduce((sum, k) => sum + P.rate[k], 0) / STAT_KEYS.length;
  // What is ordinary for a kind: the spread of those numbers over forty of its wild members.
  const NORMS = new Map();
  function kindNorm(id) {
    let n = NORMS.get(id);
    if (!n) {
      const r = new Rng(hashStr('norm:' + id)), v = [];
      for (let i = 0; i < 40; i++) v.push(statScore(RB.pheno.express(RB.species.make(id, r, { sport: 0 }))));
      const mean = v.reduce((a, b) => a + b, 0) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) * (b - mean), 0) / v.length);
      n = { mean, sd }; NORMS.set(id, n);
    }
    return n;
  }
  // Outstanding numbers: about one in twenty of its kind, and never a weakling.
  function outstanding(P) {
    const id = P.species && P.species.id;
    if (!id || !RB.species.SPECIES[id] || P.person) return false;
    const n = kindNorm(id);
    return statScore(P) >= Math.max(45, n.mean + 1.7 * Math.max(2, n.sd));
  }
  // Born on one of your islands and never taken off it: that bird lives its life out there, not here.
  const islandOnly = (e) => e.gen > 0 && !e.taken;
  // Caught by you: out in the wild, or taken off one of your islands.
  const caught = (e) => e.origin === 'wild' || (e.gen > 0 && !!e.taken);
  // Only birds you put to use earn a place: fought in the ring, went to the sideshow, or were caught
  // with outstanding numbers. An island-born bird counts only once you have taken it home, and then
  // like any other.
  const fameEligible = (e) => !islandOnly(e) && (e.wins + e.losses > 0 || (e.shows || 0) > 0 || (caught(e) && !!e.great));
  // The Hall's tabs, and which a title belongs to. The Retired tab holds the retired birds that stood
  // out: a title of any tab but Stories.
  const FAME_TABS = [['all', 'All'], ['champions', 'Champions'], ['fighters', 'Fighters'], ['records', 'Records'], ['sideshow', 'Sideshow'], ['talents', 'Talents'], ['retired', 'Retired'], ['stories', 'Stories']];
  const fameTabOf = (title) => (/^Champion of/.test(title) ? 'champions' : /^(Veteran|Ring legend)/.test(title) ? 'fighters' : /^Record:/.test(title) ? 'records' :
    /^Sideshow/.test(title) ? 'sideshow' : / talent$/.test(title) ? 'talents' : /^Retired /.test(title) ? 'retired' : 'stories');
  const standout = (e) => e.titles.some((t) => fameTabOf(t) !== 'stories');
  const fameIn = (e, tab) => tab === 'all' || (tab === 'retired' ? !!e.retired && standout(e) : e.titles.some((t) => fameTabOf(t) === tab));
  const OLD_TITLES = /^(Island dynasty|Retired at Sunset Roost)/; // places no longer given
  function fameCheck(S) {
    S.fame = S.fame || [];
    const here = everyone(S), snaps = new Map();
    for (const [c, where] of here) {
      if (c.person) continue;
      const snap = snapshot(S, c, where);
      if (!fameEligible(snap)) { const old = fameOf(S, c.id); if (old) S.fame.splice(S.fame.indexOf(old), 1); continue; }
      const P = pheno(c), t = (c.titles || []).filter((x) => !OLD_TITLES.test(x));
      if (c.wins >= 25) t.push('Ring legend (25+ wins)'); else if (c.wins >= 10) t.push('Veteran (10+ wins)');
      if ((c.showWins || 0) >= 10) t.push('Sideshow legend (10+ wins)'); else if ((c.showWins || 0) >= 3) t.push('Sideshow star (3+ wins)');
      if (snap.great && caught(snap)) t.push(c.origin === 'wild' ? 'Wild talent' : 'Island talent');
      if (snap.retired) { // grew old in your care, after making a name
        if (t.some((x) => /^Champion of/.test(x))) t.push('Retired champion');
        else if (c.wins >= 3) t.push('Retired fighter');
        if ((c.showWins || 0) >= 3) t.push('Retired sideshow star');
      }
      if (P.twoHeads) t.push('Two heads'); if (P.odd.length >= 3) t.push('A walking mutation');
      if (c.origin === 'born' && isCross(c)) t.push('Child of two very different kinds');
      snap.titles = [...new Set(t)];
      snaps.set(c.id, snap);
      const e = fameOf(S, c.id);
      if (e) { const since = e.since; Object.assign(e, snap); e.since = since; } else if (snap.titles.length) { snap.since = S.day; S.fame.push(snap); }
    }
    // entries kept from before: drop any that would not get in today, and titles no longer given
    for (const e of S.fame.slice()) {
      if (snaps.has(e.id)) continue;
      if (!fameEligible(e)) { S.fame.splice(S.fame.indexOf(e), 1); continue; }
      e.titles = e.titles.filter((x) => !OLD_TITLES.test(x));
      if (!e.gone) { e.gone = true; e.status = 'No longer with you (last seen on day ' + e.day + ')'; }
    }
    // records, among every bird the Hall has held and every bird you have now
    for (const e of S.fame) e.titles = e.titles.filter((x) => !x.startsWith('Record:'));
    const pool = S.fame.concat([...snaps.values()].filter((sn) => !fameOf(S, sn.id)));
    for (const [key, name, min] of RECORDS) {
      let best = null;
      for (const e of pool) if (e[key] >= min && (!best || e[key] > best[key])) best = e;
      if (!best) continue;
      let e = fameOf(S, best.id);
      if (!e) { e = best; e.since = S.day; S.fame.push(e); }
      e.titles.push(name);
    }
    // a full Hall lets the least remembered of those long gone fade out
    while (S.fame.length > FAME_MAX) {
      const gone = S.fame.filter((e) => e.gone).sort((a, b) => a.titles.length - b.titles.length || a.wins - b.wins)[0];
      if (!gone) break;
      S.fame.splice(S.fame.indexOf(gone), 1);
    }
    return S.fame;
  }
  // How a Hall entry ranks: champions first, then by titles and wins.
  const fameRank = (e) => e.titles.filter((x) => x.startsWith('Champion')).length * 100 + e.titles.length * 10 + e.wins;
  // A short life story, from what the Hall kept.
  function fameBio(e) {
    const it = e.sex === 'F' ? 'She' : 'He', bits = [];
    const parents = e.mom && e.dad ? ' to a ' + e.dad.toLowerCase() + ' and a ' + e.mom.toLowerCase() : '';
    bits.push(e.origin === 'start' ? 'One of the two chickens Aunt Dalva left you.' : e.origin === 'born' ? (e.gen ? 'Born on one of your islands, generation ' + e.gen + parents + (e.taken > 0 ? ', and brought home on day ' + e.taken : '') + '.' : 'Hatched in your coop' + parents + '.') :
      e.origin === 'wild' ? 'Caught out in the wild.' : e.origin === 'bought' ? 'Bought from a neighbour.' : 'Came to you by a road of its own.');
    if (e.wins || e.losses) bits.push(it + ' fought ' + (e.wins + e.losses) + ' bout' + (e.wins + e.losses === 1 ? '' : 's') + ': ' + e.wins + ' won, ' + e.losses + ' lost.');
    else bits.push(it + ' never fought in the ring.');
    if (e.shows) bits.push(it + ' entered ' + e.shows + ' sideshow contest' + (e.shows === 1 ? '' : 's') + ' and won ' + (e.showWins || 0) + '.');
    if (caught(e) && e.great) bits.push((e.origin === 'wild' ? 'Caught' : 'Taken off the island') + ' with numbers few of its kind ever have: ' + e.score + ' all round.');
    for (const l of e.log || []) bits.push('Day ' + l.d + ': ' + l.t + '.');
    if (e.odd && e.odd.length) bits.push('Notable for: ' + e.odd.join(', ') + '.');
    if (e.quirk) bits.push(it + ' ' + QUIRKS[e.quirk] + '.');
    bits.push(e.status + '.');
    return bits.join(' ');
  }

  // Fast travel to an island: once you have landed on it, or any island at all in a sandbox game.
  const canSail = (S, is) => !!S.sandbox || !!(S.visited && S.visited[is.id]);
  function removeBird(S, c) { const i = S.birds.indexOf(c); if (i >= 0) S.birds.splice(i, 1); }
  // a creature as plain data for the save, and back
  function serBird(c) { const b = {}; for (const k of Object.keys(c)) if (k[0] !== '_') b[k] = c[k]; b.g = GN.serialize(c.g); return b; }
  function deBird(b) { const c = JSON.parse(JSON.stringify(b)); c.g = GN.deserialize(b.g); c._P = null; return c; }

  // Move a creature: 'home', 'cage', 'crate' (BFC pick-up box) or 'nestN'. Returns '' or why not.
  function move(S, c, to) {
    if (c.at === to) return '';
    if (to === 'cage') { /* the truck takes everyone */ }
    else if (to === 'home') { if (c.at === 'cage' && atHome(S).length >= coopCap(S)) return 'The coop is full.'; }
    else if (to.startsWith('nest')) {
      if (!canBreed(c)) return c.name + ' is retired: no more nesting.';
      if (!isAdult(c)) return c.name + ' is too young to nest.';
      const there = at(S, to);
      if (there.length >= 2) return 'That nest is full.';
      if (there.length === 1 && there[0].g.sex === c.g.sex) return 'A nest needs a male and a female.';
    }
    c.at = to;
    return '';
  }

  // Hand-feed an item. Returns a short message, or null if nothing happened.
  // Eating anything is a full day's meal: one grain is enough for any creature.
  function eat(c) { c.fed = true; c.hungry = 0; }
  function feed(S, c, item) {
    if (item === 'grain' && c.fed) return c.name + ' is full already.';
    if (item === 'vigor' && c.person) return 'People will not touch it. It smells of feathers.';
    if (item === 'vigor' && c.eternal) return c.name + ' already has eternal vigor.';
    if (!take(S, item)) return null;
    const P = pheno(c), r = S._rng;
    eat(c);
    if (item === 'grain') { c.bond = Math.min(1, c.bond + 0.02); return c.name + ' pecks it up and is full.'; }
    if (item === 'worm') { c.bond = Math.min(1, c.bond + 0.08); return c.name + ' loves worms.'; }
    if (item === 'chili') { c.buff = 'chili'; return c.name + ' is fired up for the next bout.'; }
    if (item === 'tonic') { const was = c.tired || c.rest > 0; c.tired = false; c.rest = 0; return was ? c.name + ' is full of beans again and can fight today.' : c.name + ' was not tired, but enjoys it.'; }
    if (item === 'gromash') { if (P.grow < 1) { c.age++; dirty(c); return c.name + ' shoots up overnight. Well, right now.'; } return c.name + ' enjoys it, but is done growing.'; }
    if (item === 'loveseed') { c.love = true; return c.name + ' is feeling romantic.'; }
    if (item === 'mushroom') { GN.mutate(c.g, r, 4); dirty(c); return c.name + ' feels... different.'; }
    if (item === 'isotope') { GN.mutate(c.g, r, 14); if (r.chance(0.3)) GN.sport(c.g, r, 1); dirty(c); return c.name + ' hums faintly.'; }
    if (item === 'elixir') { c.age = Math.max(P.growDays, c.age - 3); dirty(c); return c.name + ' looks younger.'; }
    if (item === 'vigor') {
      const was = isRetired(c);
      c.eternal = S.sandbox ? 2 : 1; dirty(c);
      note(S, c, 'drank the tonic of eternal vigor'); title(c, 'Eternal vigor');
      if (S.sandbox) return c.name + ' will never grow old or die: it can fight, show and breed for ever.' + (was ? ' Back in its prime!' : '');
      return c.name + ' will never die, and can raise young for ever.' + (was ? ' It can nest again, though its fighting days are over.' : ' Once it retires it still cannot fight or go to the sideshow.');
    }
    return null;
  }

  const TRAIN = ['muscle', 'reflex', 'lungs', 'courage'];
  function train(S, c, stat) {
    if (isRetired(c)) return c.name + ' is retired: no more training.';
    if (c.trained) return c.name + ' has trained enough for today.';
    if (!isAdult(c)) return c.name + ' is too young to train.';
    if (c.train[stat] >= 0.15) return c.name + ' cannot improve that any further.';
    c.trained = true;
    c.train[stat] = Math.min(0.15, +(c.train[stat] + trainStep(c)).toFixed(3));
    c.bond = Math.min(1, c.bond + 0.03);
    return '';
  }

  // Chance that a pair in a nest lays tonight. Any two creatures can have young together; very
  // different ones (a hummingbird and an ostrich, a hen and a person) just manage a little less often.
  function layChance(mom, dad) {
    const dist = GN.distance(mom.g, dad.g), fert = (pheno(mom).t.fertility + pheno(dad).t.fertility) / 2;
    return clamp(fert * (1.15 - 0.8 * dist) * (mom.love || dad.love ? 1.5 : 1), 0.45, 0.97);
  }

  // Night falls. Returns { lines: [...] } describing what happened.
  function sleep(S) {
    const r = S._rng, lines = [];
    // the BFC van empties the pick-up box (unless nobody is running BFC: the Coronel netted, nobody in his place)
    const bfcShut = !!(RB.npc && RB.npc.vacancy(S, { id: 'k_bfc' }));
    if (bfcShut && at(S, 'crate').length) lines.push('The BFC van did not come: nobody is running BFC. The pick-up box waits.');
    for (const c of bfcShut ? [] : at(S, 'crate')) {
      const price = RB.economy.bfcPrice(S, c, true);
      S.money += price; S.stats.earned += price; S.bfc.sold++; S.bfc.stamps++; S.stats.sold++;
      if (c.person) soldPerson(S, c); else fameLeave(S, c, 'Went off in the BFC van');
      removeBird(S, c);
      lines.push('The BFC van collected ' + c.name + '. $' + price + '.');
    }
    if (S.bfc.stamps >= 10) { S.bfc.stamps -= 10; give(S, 'bucket'); lines.push('Your BFC card is full: a free bucket hat!'); }
    // feeding
    for (const c of S.birds.slice()) {
      if (!c.fed && S.feeder >= 1) { S.feeder--; eat(c); }
      if (c.fed) { c.hungry = 0; if (c.cond < 1) { c.cond = Math.min(1, c.cond + 0.25); dirty(c); } }
      else {
        c.hungry++; c.cond = Math.max(0.4, c.cond - 0.2); dirty(c);
        if (c.hungry >= 3 && !c.person) { removeBird(S, c); lines.push(c.name + ' went hungry three nights and ran off.'); }
        else lines.push(c.name + ' went to sleep hungry.');
      }
    }
    // nests
    for (let n = 0; n < nestCount(S); n++) {
      const pair = at(S, 'nest' + n);
      if (pair.length !== 2 || pair[0].g.sex === pair[1].g.sex || !pair.every(canBreed)) continue;
      const mom = pair[0].g.sex === 'F' ? pair[0] : pair[1], dad = mom === pair[0] ? pair[1] : pair[0];
      if (S.eggs.filter((e) => e.nest === n).length >= 2) { lines.push('Nest ' + (n + 1) + ' has no room for another egg.'); continue; }
      const p = layChance(mom, dad);
      mom.love = false; dad.love = false;
      if (r.chance(p)) {
        const g = GN.breed(mom.g, dad.g, r);
        const Pm = pheno(mom), Pd = pheno(dad);
        S.eggs.push({ id: S.nextId++, g, nest: n, hatch: S.day + 1 + (S.up.incubator ? 1 : 2), mom: label(mom), dad: label(dad), momKey: kindKey(mom), dadKey: kindKey(dad), col: Pm.css.belly, spot: Pd.css.body });
        lines.push(mom.name + ' laid an egg.');
      } else lines.push(mom.name + ' and ' + dad.name + ' did not manage an egg' + (p < 0.4 ? ' (they are very different animals).' : '.'));
    }
    S.day++; S.time = 6;
    // eggs hatch
    for (const e of S.eggs.slice()) {
      if (S.day < e.hatch) continue;
      if (atHome(S).length >= coopCap(S)) { lines.push('An egg is ready to hatch, but the coop is full.'); continue; }
      S.eggs.splice(S.eggs.indexOf(e), 1);
      const chick = addBird(S, e.g, { age: 0, bond: 0.35, origin: 'born', mom: e.mom, dad: e.dad, momKey: e.momKey, dadKey: e.dadKey });
      chick.hatched = S.day;
      if (e.fossil) { note(S, chick, 'hatched from an egg rebuilt from fossil fragments'); title(chick, 'Back from extinction'); }
      S.stats.bred++;
      lines.push('An egg hatched: ' + chick.name + ', a ' + kind(chick).toLowerCase() + ' chick.');
    }
    // a day older
    for (const c of S.birds.slice()) {
      c.fed = false; c.bouts = 0; c.trained = false; c.tired = false;
      if (c.rest > 0) c.rest--;
      // wounds do not heal on their own: that is the vet's job
      if (c.person) continue;
      if (c.hatched === S.day) continue; // hatched this morning: not a day old yet
      if (isRetired(c)) continue; // retired birds stop counting the days
      const was = pheno(c).stage;
      c.age++; dirty(c);
      const P = pheno(c);
      if (c.age >= P.lifespan) {
        if (c.at.startsWith('nest')) c.at = 'home';
        lines.push(c.name + ' is too old for the ring now and has retired. Sunset Roost will take them in, or BFC will.');
        note(S, c, 'retired after ' + c.age + ' days, with ' + c.wins + ' win' + (c.wins === 1 ? '' : 's'));
      }
      else if (was !== 'adult' && P.stage === 'adult') lines.push(c.name + ' is all grown up.');
      else if (was !== 'elder' && P.stage === 'elder') lines.push(c.name + ' is getting old.');
    }
    // Dona Nina feeds the residents of Sunset Roost and tends their wounds
    for (const c of S.roost || []) { c.fed = true; c.hungry = 0; c.tired = false; c.rest = 0; c.bouts = 0; c.love = false; if (c.hp < 1) c.hp = Math.min(1, c.hp + 0.25); if (c.cond < 1) { c.cond = Math.min(1, c.cond + 0.25); dirty(c); } }
    // your islands: the colonies there live their own lives
    for (const isle of S.isles || []) { const ln = colonyNight(S, isle, r); if (ln) lines.push(ln); }
    wildNight(S, lines); // the birds you set free grow old out there too
    championsNight(S, lines);
    // the heat dies down: back to nothing after one night for each person netted (three at most)
    if (S.heat > 0) {
      const n = Math.max(1, S.heatDays || 1);
      S.heat = n <= 1 ? 0 : Math.round(S.heat * (n - 1) / n);
      S.heatDays = n - 1;
    }
    if (S.heat <= 0) { S.heat = 0; S.heatPeople = 0; S.heatDays = 0; }
    // ordinary holes fill back in overnight (treasure marks stay dug)
    for (const k of Object.keys(S.dug)) if (S.dug[k] < S.day) delete S.dug[k];
    // a house left empty gets a new owner after three nights
    for (const id of Object.keys(S.npc)) {
      const st = RB.npc.info(S, id);
      if (st.soldOff && !st.sub && S.day - st.soldDay >= 3) {
        st.soldOff = false; st.gone = false; st.gen = (st.gen || 0) + 1; st.rel = 0; st.n = 0; st.sold = {}; st.credit = 0;
        lines.push(id === 'sheriff' ? 'A new sheriff has come to town.' : 'Someone new has moved into an empty house.');
      }
    }
    fameCheck(S);
    S.rs = r.s;
    return { lines };
  }

  // A netted person who went to BFC: gone for good, and their house stands empty for a while.
  function soldPerson(S, c) {
    const st = RB.npc.info(S, c.person);
    st.gone = true; st.soldOff = true; st.soldDay = S.day;
  }

  // ---- the heat: netting a person makes you wanted. The heat clears in one night per person netted
  // since it was last at zero, and never takes more than HEAT_DAYS nights.
  const HEAT_DAYS = 3;
  function caughtPerson(S, add) {
    S.heat = clamp(S.heat + add, 0, 100);
    S.heatPeople = (S.heatPeople || 0) + 1;
    S.heatDays = Math.min(HEAT_DAYS, S.heatPeople);
  }

  // ---- training: what a session would add, so the dummy can say so before you choose
  const trainStep = (c) => 0.02 * (c.gear === 'anklets' ? 1.5 : 1);
  // { gain (to the training bonus, 0 when maxed), from, to, rates: [[rate, +n], ...] }
  function trainPreview(c, stat) {
    const from = c.train[stat], to = Math.min(0.15, +(from + trainStep(c)).toFixed(3));
    const opts = { age: bodyAge(c), cond: c.cond };
    const A = RB.pheno.express(c.g, Object.assign({ train: c.train }, opts));
    const B = RB.pheno.express(c.g, Object.assign({ train: Object.assign({}, c.train, { [stat]: to }) }, opts));
    // which numbers this kind of training moves at all (some steps are too small to show yet)
    const Z = RB.pheno.express(c.g, Object.assign({ train: Object.assign({}, c.train, { [stat]: 0.15 }) }, opts));
    const Y = RB.pheno.express(c.g, Object.assign({ train: Object.assign({}, c.train, { [stat]: 0 }) }, opts));
    const rates = [], affects = [];
    for (const k of Object.keys(A.rate)) {
      if (B.rate[k] !== A.rate[k]) rates.push([k, B.rate[k] - A.rate[k]]);
      if (Z.rate[k] !== Y.rate[k]) affects.push(k);
    }
    return { gain: +(to - from).toFixed(3), from, to, rates, affects };
  }

  // ---- boss prizes: beating the first boss earns the silver net, the second the golden shovel
  const BOSS_PRIZES = { backyard: 'silvernet', county: 'goldshovel' };
  // Hand over any prize earned and not yet given (also catches up saves from before the prizes).
  // Returns the item ids given.
  function bossPrizes(S) {
    const got = [];
    for (const arena of Object.keys(BOSS_PRIZES)) {
      const id = BOSS_PRIZES[arena];
      if (S.league[arena] && S.league[arena].boss && !S.equip[id]) { S.equip[id] = true; got.push(id); }
    }
    return got;
  }
  // Nets: the silver net is never used up. Shovels: the golden shovel digs GOLD_DIGS holes a day,
  // then ordinary shovels take over.
  const GOLD_DIGS = 10;
  const goldLeft = (S) => (S.equip.goldshovel ? GOLD_DIGS - (S.goldDug && S.goldDug.day === S.day ? S.goldDug.n : 0) : 0);
  const digsLeft = (S) => goldLeft(S) + count(S, 'shovel');
  // Use one dig. Returns 'gold', 'shovel', or '' when there is nothing to dig with.
  function useDig(S) {
    if (goldLeft(S) > 0) { if (!S.goldDug || S.goldDug.day !== S.day) S.goldDug = { day: S.day, n: 0 }; S.goldDug.n++; return 'gold'; }
    return take(S, 'shovel') ? 'shovel' : '';
  }
  // Throw a net: the silver net stands in for plain ones and is never used up. Returns '' if none.
  function useNet(S, id) {
    if (id === 'net' && S.equip.silvernet) return 'silvernet';
    return take(S, id) ? id : '';
  }

  // ---- birds set free: their genes go back into the wild
  // Each one is remembered where it was let go (the most recent RELEASED_MAX); from the next day
  // on, a few wild animals born near there carry some of its genes (see world.population).
  const RELEASED_MAX = 30;
  // The bird itself goes on living out there under its own name, near where it was let go: net it
  // again and it is the same bird (name, age, record, training, hat). Returns the record, or null.
  function setFree(S, c, x, y) {
    removeBird(S, c);
    if (c.person) return null;
    S.released = S.released || [];
    fameLeave(S, c, 'Set free');
    const bird = serBird(c); delete bird.g; delete bird.at;
    const rec = { g: GN.serialize(c.g), x: Math.round(x), y: Math.round(y), day: S.day, name: c.name, key: kindKey(c), label: label(c), bird };
    S.released.push(rec);
    // only so many are remembered: the dead go first, then the longest gone
    while (S.released.length > RELEASED_MAX) { const d = S.released.findIndex((e) => e.dead); S.released.splice(d >= 0 ? d : 0, 1); }
    return rec;
  }
  // How old a freed bird is today: it goes on counting the days out there.
  const wildAge = (S, rec) => (rec.bird ? rec.bird.age || 0 : 0) + Math.max(0, S.day - rec.day);
  const wildLife = (rec) => Math.round(GN.traitValue(recGenome(rec), 'lifespan'));
  // Still out there: alive, and remembered (birds freed before they kept their names have no age to count).
  const wildAlive = (rec) => !rec.dead;
  // Each night: a freed bird past its last day dies of old age out in the wild. Its genes stay in the
  // wild around there for a while (its young carry them), but the bird itself is gone.
  function wildNight(S, lines) {
    for (const rec of S.released || []) {
      if (rec.dead || !rec.bird || rec.bird.eternal) continue; // eternal vigor: it lives on out there for ever
      if (wildAge(S, rec) <= wildLife(rec)) continue;
      rec.dead = S.day;
      const fe = fameOf(S, rec.bird.id);
      if (fe) fe.status = 'Set free on day ' + rec.day + ', and died of old age in the wild on day ' + S.day;
      lines.push(rec.name + ', whom you set free on day ' + rec.day + ', died of old age out in the wild.');
    }
  }
  // Net a bird you once set free: it comes back as it was, a little older and a little less sure of you.
  function recapture(S, rec) {
    const i = (S.released || []).indexOf(rec);
    if (i >= 0) S.released.splice(i, 1);
    if (!rec.bird) return addBird(S, GN.deserialize(rec.g), { at: 'cage', name: rec.name, bond: 0.1, origin: 'wild' }); // freed before birds kept their names
    const c = JSON.parse(JSON.stringify(rec.bird));
    c.g = GN.deserialize(rec.g); c._P = null;
    if (c.eternal === 2) c.age += Math.max(0, S.day - rec.day); // never retires: the days just add up
    else if (c.age < pheno(c).lifespan) c.age = Math.min(pheno(c).lifespan, c.age + Math.max(0, S.day - rec.day));
    Object.assign(c, { at: 'cage', fed: false, hungry: 0, tired: false, rest: 0, bouts: 0, love: false, bond: Math.max(0, (c.bond || 0) - 0.15) });
    note(S, c, 'came back to you after ' + Math.max(0, S.day - rec.day) + ' days in the wild'); title(c, 'Came back from the wild');
    const fe = fameOf(S, c.id); if (fe) fe.gone = false;
    c._P = null;
    S.birds.push(c);
    return c;
  }
  // The released genes the wild draws on today: only those let go before today, decoded.
  const gened = new Map();
  function recGenome(e) {
    let g = gened.get(e.g);
    if (!g) { g = GN.deserialize(e.g); gened.set(e.g, g); }
    return g;
  }
  function genePool(S) {
    return (S.released || []).filter((e) => e.day < S.day).map((e) => Object.assign({}, e, { g: recGenome(e) }));
  }

  // ---- breeding islands: an island of your own out at sea, claimed (an empty one) or raised from
  // the water, where the birds you leave live on their own. Every night the pairs there may raise
  // young, the old ones pass away in time, and generation follows generation. Odd mushrooms and
  // isotopes left there make the place radioactive: young born while it is hot come out mutated
  // and deformed. The radiation fades slowly.
  const CLAIM_COST = 500, RAISE_COST = 2500, RAISE_R = 1300, CLEAN_COST = 300, ISLE_EXTRA = 6;
  const ISLE_ODD = ['teeth', 'arms', 'twoHeads', 'glow', 'tailBone', 'gigas', 'nana', 'cyclops', 'legsExtra', 'earTuft', 'fluff', 'bare'];
  const DOSE = { mushroom: 0.08, isotope: 0.3 };
  const isleOf = (S, id) => (S.isles || []).find((i) => i.id === id) || null;
  // how many birds an island can feed: more on a bigger island
  const isleCap = (isle) => clamp(Math.round(isle.R * isle.R / 90000), 8, 40) + ISLE_EXTRA;
  function newIsle(S, o) { const isle = Object.assign({ birds: [], rad: 0, gen: 0, since: S.day, born: 0, died: 0, odd: 0 }, o); S.isles.push(isle); S.visited[isle.id] = 1; return isle; }
  // Claim an island nobody lives on. is: an island from RB.sea. Returns the isle, or why not.
  function claimIsle(S, is) {
    if (isleOf(S, is.id)) return 'It is yours already.';
    if (is.made || is.sites.length) return 'People live there: only an empty island can be claimed.';
    if (S.money < CLAIM_COST) return 'Claiming it costs $' + CLAIM_COST + '.';
    S.money -= CLAIM_COST;
    return newIsle(S, { id: is.id, name: is.name, made: false, x: is.x, y: is.y, R: is.R, land: is.main });
  }
  // Raise a new island centred on (x, y) in open water. land: what it is made of (a biome id).
  function raiseIsle(S, world, x, y, land) {
    if (S.money < RAISE_COST) return 'Raising an island costs $' + RAISE_COST + '.';
    const why = RB.sea.raiseSpot(world, x, y, RAISE_R);
    if (why) return why;
    S.money -= RAISE_COST;
    const id = 'u' + S.nextId++, seed = (S.seed ^ hashStr(id)) >>> 0;
    return newIsle(S, { id, name: RB.sea.word(new Rng(seed)) + ' Isle', made: true, x: Math.round(x), y: Math.round(y), R: RAISE_R, land, seed });
  }
  // Leave a creature on the island (a bird, or a person you netted: they live there just the same),
  // or take one back into the truck. Return '' or why not.
  function toIsle(S, isle, c) {
    if (isle.birds.length >= isleCap(isle)) return 'The island is full.';
    removeBird(S, c);
    c.at = 'isle'; c.isle = isle.id; c.gen = c.gen || 0; c.fed = true; c.hungry = 0; c.love = false;
    isle.birds.push(c);
    return '';
  }
  function fromIsle(S, isle, c) {
    const i = isle.birds.indexOf(c);
    if (i < 0) return '';
    isle.birds.splice(i, 1);
    c.at = 'cage'; delete c.isle;
    if (c.gen > 0 && !c.taken) c.taken = S.day; // born out there: from now on it is one you caught
    S.birds.push(c);
    return '';
  }
  // Leave an odd mushroom or an isotope there: the place gets radioactive.
  function dose(S, isle, item) {
    if (!DOSE[item]) return 'That does nothing out there.';
    if (!take(S, item)) return 'You have no ' + RB.items.ITEMS[item].name.toLowerCase() + '.';
    isle.rad = Math.min(1, +(isle.rad + DOSE[item]).toFixed(3));
    return '';
  }
  function cleanIsle(S, isle) {
    if (S.money < CLEAN_COST) return 'A clean-up costs $' + CLEAN_COST + '.';
    S.money -= CLEAN_COST; isle.rad = 0;
    return '';
  }
  // What radiation does to a young bird's genes: the hotter, the stranger.
  function mutateYoung(g, rad, r) {
    if (rad <= 0) return;
    GN.mutate(g, r, Math.round(rad * 14));
    if (r.chance(rad * 0.6)) GN.sport(g, r, r.int(1, 3));
    if (r.chance(rad * 0.45)) {
      const id = r.pick(ISLE_ODD);
      for (const sw of id === 'twoHeads' ? ['twoHeadsA', 'twoHeadsB'] : [id]) for (const gi of GN.TRAITS[sw].genes) GN.setGeneBases(g, gi, [3, 3, 3, 3], 'both');
    }
  }
  // One night on an island. Returns a line for the morning report, or null.
  function colonyNight(S, isle, r) {
    let born = 0, died = 0, odd = 0;
    for (const c of isle.birds.slice()) {
      if (c.hatched === S.day) continue;
      c.age++; dirty(c);
      if (!c.eternal && c.age >= pheno(c).lifespan + 2) { isle.birds.splice(isle.birds.indexOf(c), 1); died++; if (c.person) soldPerson(S, c); else fameLeave(S, c, 'Passed away of old age on ' + isle.name); } // out here the old pass away
    }
    const adults = isle.birds.filter((c) => isAdult(c) && (c.age < pheno(c).lifespan || c.eternal));
    const males = r.shuffle(adults.filter((c) => c.g.sex === 'M')), females = r.shuffle(adults.filter((c) => c.g.sex === 'F'));
    for (let i = 0; i < Math.min(males.length, females.length) && isle.birds.length < isleCap(isle); i++) {
      const mom = females[i], dad = males[i];
      if (!r.chance(layChance(mom, dad) * 0.7)) continue;
      const g = GN.breed(mom.g, dad.g, r, { mutRate: 0.003 + isle.rad * 0.02 });
      mutateYoung(g, isle.rad, r);
      const chick = makeBird(S, g, { age: 0, bond: 0.05, origin: 'born', at: 'isle', mom: label(mom), dad: label(dad), momKey: kindKey(mom), dadKey: kindKey(dad) });
      chick.isle = isle.id; chick.hatched = S.day; chick.fed = true; chick.gen = Math.max(mom.gen || 0, dad.gen || 0) + 1;
      isle.birds.push(chick); isle.gen = Math.max(isle.gen, chick.gen); born++;
      if (pheno(chick).odd.length) odd++;
    }
    isle.rad = Math.max(0, +(isle.rad - 0.02).toFixed(3));
    isle.born = (isle.born || 0) + born; isle.died = (isle.died || 0) + died; isle.odd = (isle.odd || 0) + odd;
    if (!born && !died) return null;
    return isle.name + ': ' + (born ? born + ' chick' + (born > 1 ? 's' : '') + ' hatched (generation ' + isle.gen + ')' : 'no chicks') + (died ? ', ' + died + ' old bird' + (died > 1 ? 's' : '') + ' passed away' : '') + '.' + (odd ? ' ' + odd + ' of the young came out strange.' : '');
  }

  // Camp at one of your islands for n nights in a row: each counts as a night at home (the coop
  // ages, eggs hatch, the colonies breed), and the birds at home and in the truck are fed from the
  // grain in your bag each night. Returns { lines, fromBag, short } (short: nights grain ran out).
  const STAY_MAX = 30;
  function stay(S, n) {
    n = clamp(Math.round(n), 1, STAY_MAX);
    const before = (S.isles || []).map((i) => ({ i, n: i.birds.length, born: i.born || 0, died: i.died || 0, odd: i.odd || 0 }));
    const names = new Set((S.isles || []).map((i) => i.name + ':'));
    const days = [];
    let fromBag = 0, short = 0;
    for (let d = 0; d < n; d++) {
      const need = S.birds.filter((c) => !c.fed).length - S.feeder;
      if (need > 0) { const k = Math.min(need, count(S, 'grain')); if (k) { take(S, 'grain', k); S.feeder += k; fromBag += k; } if (k < need) short++; }
      for (const l of sleep(S).lines) if (![...names].some((nm) => l.startsWith(nm))) days.push('Day ' + S.day + ': ' + l);
    }
    const lines = [];
    for (const b of before) {
      const i = b.i, born = (i.born || 0) - b.born, died = (i.died || 0) - b.died, odd = (i.odd || 0) - b.odd;
      lines.push(i.name + ': ' + (born ? born + ' hatched' : 'nobody hatched') + (died ? ', ' + died + ' passed away' : '') + (odd ? ', ' + odd + ' came out strange' : '') + '. Now ' + i.birds.length + ' living there' + (i.gen ? ', generation ' + i.gen : '') + '.');
    }
    if (fromBag) lines.push('Your birds ate ' + fromBag + ' grain from your bag.');
    if (short) lines.push('The grain ran out on ' + short + ' night' + (short > 1 ? 's' : '') + '.');
    return { lines: lines.concat(days), fromBag, short };
  }

  // ---- people in charge. Anyone minding a place can be netted, indoors too: their place stays
  // shut while they are away, or you can put someone else in charge, a person you netted or even a
  // bird, which wakes up sentient and carries on the trade. (st.sub holds whoever you put there.)
  // Net whoever minds a place, given the person from world.npcs. Returns the creature now in the truck.
  function netKeeper(S, base) {
    const st = RB.npc.info(S, base.id);
    if (st.sub) { // whoever you put in charge comes back just as they were
      const c = deBird(st.sub); st.sub = null;
      delete c.keeps; c.at = 'cage'; c.fed = false; S.birds.push(c);
      if (c.person) S.stats.kidnapped++;
      return c;
    }
    const cur = RB.npc.current(S, base);
    st.gone = true;
    S.stats.kidnapped++; S.netted = S.netted || {}; S.netted[base.id] = 1;
    const c = addBird(S, GN.clone(cur.g), { at: 'cage', name: cur.name, person: base.id, clothes: cur.clothes ? Object.assign({}, cur.clothes) : null, bond: 0, origin: 'wild' });
    if (cur.kindName) c.kindName = cur.kindName;
    return c;
  }
  // Put a creature from the truck in charge of a place whose person is away (or gone for good).
  // Their own person put back simply goes home. Returns '' or why not.
  function installKeeper(S, base, c) {
    const st = RB.npc.info(S, base.id);
    if (st.sub) return 'Someone already runs this place.';
    if (!st.gone && !st.soldOff) return base.name + ' still runs this place.';
    removeBird(S, c);
    if (c.person === base.id && !st.soldOff) { st.gone = false; return ''; }
    c.at = 'keeper'; c.keeps = base.id; c.fed = true; c.hungry = 0; c.love = false; c.tired = false;
    if (!c.person) { note(S, c, 'took over ' + base.name + '\'s place, woke up sentient and started talking'); title(c, 'A bird that ran a business'); }
    fameLeave(S, c, 'Running ' + base.name + '\'s old place');
    st.sub = serBird(c); st.subDay = S.day;
    st.rel = 10; st.n = 0; st.sold = {}; st.credit = 0;
    return '';
  }
  // A netted person let go: they go home and take their place back; whoever you had put in charge
  // there comes back to the truck (returned). Does not take them out of the flock: the caller does.
  function releasePerson(S, c, relLoss) {
    const st = RB.npc.info(S, c.person);
    st.gone = false; st.rel = Math.max(-100, st.rel - (relLoss || 0));
    if (!st.sub) return null;
    const back = deBird(st.sub); st.sub = null;
    delete back.keeps; back.at = 'cage'; S.birds.push(back);
    return back;
  }
  // The people of the mainland (not the islands out at sea), and whether you have netted them all.
  const mainlanders = (world) => world.npcs.filter((n) => { const s = world.site[n.site]; return s && !s.island; });
  const nettedCount = (S, world) => mainlanders(world).filter((n) => S.netted && S.netted[n.id]).length;
  const nettedAll = (S, world) => { const m = mainlanders(world); return m.length > 0 && nettedCount(S, world) === m.length; };

  // ---- Sunset Roost: a home for retired birds, looked after by Dona Nina
  // Check a retired bird in (it leaves your flock and lives at the roost). Returns '' or why not.
  function checkIn(S, c) {
    if (c.person) return 'Dona Nina looks after birds, not people.';
    if (!isRetired(c)) return c.name + ' is not retired yet.';
    removeBird(S, c);
    c.at = 'roost'; c.since = S.day; c.fed = true; c.hungry = 0; c.love = false; c.tired = false; c.rest = 0;
    note(S, c, 'moved into Sunset Roost');
    S.roost.push(c);
    return '';
  }
  // Take a resident back: it rides home in the truck.
  function checkOut(S, c) {
    const i = S.roost.indexOf(c);
    if (i < 0) return '';
    S.roost.splice(i, 1);
    c.at = 'cage'; delete c.since;
    S.birds.push(c);
    return '';
  }

  // ---- saving
  function serialize(S) {
    const o = {};
    for (const k of Object.keys(S)) if (k[0] !== '_') o[k] = S[k];
    o.rs = S._rng.s;
    o.birds = S.birds.map(serBird);
    o.roost = S.roost.map(serBird);
    o.isles = (S.isles || []).map((i) => Object.assign({}, i, { birds: i.birds.map(serBird) }));
    o.eggs = S.eggs.map((e) => Object.assign({}, e, { g: GN.serialize(e.g) }));
    o.lab = Object.assign({}, S.lab);
    return JSON.parse(JSON.stringify(o));
  }
  function deserialize(o) {
    const S = JSON.parse(JSON.stringify(o));
    S._rng = new Rng(S.rs);
    for (const c of S.birds) { c.g = GN.deserialize(c.g); c._P = null; }
    S.roost = S.roost || []; // saves from before Sunset Roost opened
    S.released = S.released || [];
    S.up.boat = S.up.boat || 0;
    S.markers = S.markers || {}; S.visited = S.visited || {}; // the map's markers, and islands landed on
    S.isles = S.isles || []; // breeding islands
    // everyone ever netted (for the mainland sweep); older saves rebuild it from what they know
    if (!S.netted) {
      S.netted = {};
      for (const id of Object.keys(S.npc || {})) { const st = S.npc[id]; if (st && (st.gone || st.soldOff || st.gen)) S.netted[id] = 1; }
    }
    for (const isle of S.isles) for (const c of isle.birds) { c.g = GN.deserialize(c.g); c._P = null; }
    for (const c of S.birds.concat(...S.isles.map((i) => i.birds))) if (c.person) S.netted[c.person] = 1;
    bossPrizes(S); // saves from before the boss prizes
    S.fame = S.fame || []; // the Hall of Fame
    // island-born birds you already took home, before the save marked them; and the Hall's older entries
    for (const c of S.birds.concat(S.roost)) if (c.gen > 0 && !c.taken) c.taken = S.day;
    for (const e of S.fame) {
      if (e.gen > 0 && e.taken === undefined) e.taken = /^(Living on|Passed away of old age on)/.test(e.status || '') ? 0 : e.day || 1;
      if (e.retired === undefined) e.retired = (e.titles || []).some((t) => /^Retired/.test(t)) || /^Retired/.test(e.status || '');
    }
    grantUnlocks(S); // feats won before their prizes existed
    for (const c of S.roost) { c.g = GN.deserialize(c.g); c._P = null; }
    for (const e of S.eggs) e.g = GN.deserialize(e.g);
    return S;
  }

  RB.state = { create, addBird, removeBird, pheno, bodyAge, canBreed, dirty, kind, isAdult, isRetired, checkIn, checkOut, BOSS_PRIZES, bossPrizes, GOLD_DIGS, goldLeft, digsLeft, useDig, useNet,
    RELEASED_MAX, setFree, recapture, genePool, HEAT_DAYS, caughtPerson, trainPreview, openSea, hasBoat, makeBird,
    wildAge, wildLife, wildAlive, wildNight, note, title, fameOf, fameLeave, fameCheck, fameRank, fameBio, RECORDS, statScore, outstanding, fameEligible, caught, FAME_TABS, fameTabOf, fameIn, QUIRKS, quirkOf, grudgeTarget, slotOf, wornIn, wear, unwear, outfit, grantUnlocks, ENDLESS_KINDS, endless, owned, fmtCount, canSail, serBird, deBird, STAY_MAX, stay, netKeeper, installKeeper, releasePerson, mainlanders, nettedCount, nettedAll, ISLE_EXTRA,
    CLAIM_COST, RAISE_COST, RAISE_R, CLEAN_COST, DOSE, isleOf, isleCap, claimIsle, raiseIsle, toIsle, fromIsle, dose, cleanIsle, colonyNight, byId, at, atHome, cageCap, coopCap, nestCount, count, give, take, move, feed, train, TRAIN,
    layChance, sleep, serialize, deserialize, freeName, BIRD_NAMES, eat, soldPerson, kindKey, isCross, label };
})();
