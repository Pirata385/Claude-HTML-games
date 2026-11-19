// items.js — the catalogue of things you can own: tools, feed, gear, hats, lab supplies and loot.
// No DOM. kind: tool (counted), equip (owned once), feed, gear, hat, lab, loot.
(function () {
  'use strict';
  const RB = globalThis.RB;

  const ITEMS = {
    net: { name: 'Net', kind: 'tool', price: 30, desc: 'Throw it to catch a creature. A catch uses it up.' },
    bignet: { name: 'Heavy net', kind: 'tool', price: 90, desc: 'Holds big, strong creatures that tear a plain net.' },
    shovel: { name: 'Shovel', kind: 'tool', price: 50, uses: 10, desc: 'Good for 10 holes.' },
    seed: { name: 'Seed bag', kind: 'tool', price: 12, desc: 'Scatter to lure birds in close.' },
    detector: { name: 'Metal detector', kind: 'equip', price: 450, desc: 'A silent meter that fills up near buried metal.' },
    launcher: { name: 'Net launcher', kind: 'equip', price: 700, desc: 'Nets fly much further.' },
    lantern: { name: 'Lantern', kind: 'equip', price: 150, desc: 'See further at night.' },
    silvernet: { name: 'Silver net', kind: 'equip', price: 0, prize: true, desc: 'Old Bira\'s prize. Holds just like a plain net, and it never runs out.' },
    goldshovel: { name: 'Golden shovel', kind: 'equip', price: 0, prize: true, desc: 'Dona Zefa\'s prize. Digs ten holes a day, every day, and never wears out.' },

    grain: { name: 'Grain', kind: 'feed', price: 4, desc: 'Plain feed. Fill the feeder or hand it out.' },
    // bought as a sack, it goes into your store as 100 grains
    grainsack: { name: 'Sack of grain', kind: 'feed', price: 350, gives: 'grain', uses: 100, desc: '100 grains in one go: a bit cheaper than loose grain.' },
    worm: { name: 'Worms', kind: 'feed', price: 6, desc: 'A treat. Feeds a bird and it trusts you more.' },
    chili: { name: 'Chili', kind: 'feed', price: 25, desc: 'Next bout: much more aggressive.' },
    tonic: { name: 'Tonic', kind: 'feed', price: 60, desc: 'Restores vigour: a worn-out bird can fight again today. Does not heal wounds.' },
    gromash: { name: 'Gro-Mash', kind: 'feed', price: 45, desc: 'A growing bird ages one day at once.' },
    loveseed: { name: 'Love seeds', kind: 'feed', price: 70, desc: 'Next nesting is much more likely to give an egg.' },
    mushroom: { name: 'Odd mushroom', kind: 'feed', price: 40, desc: 'Scrambles a few genes. Who knows.' },
    isotope: { name: 'Glowing isotope', kind: 'feed', price: 300, desc: 'Scrambles a lot of genes.' },
    elixir: { name: 'Youth elixir', kind: 'feed', price: 1800, desc: 'Takes three days off a bird\'s age.' },
    vigor: { name: 'Tonic of eternal vigor', kind: 'feed', price: 9000, desc: 'Never dies, breeds for ever; no fights once retired. Sandbox: no limits.' },

    spurs: { name: 'Steel spurs', kind: 'gear', price: 350, desc: 'Kicks hit a fifth harder.' },
    helmet: { name: 'Tin helmet', kind: 'gear', price: 300, desc: 'Blows to the head hurt a quarter less.' },
    scarf: { name: 'Lucky scarf', kind: 'gear', price: 200, desc: 'Starts every bout in high spirits.' },
    anklets: { name: 'Training weights', kind: 'gear', price: 250, desc: 'Training works half again as well.' },
    beakcap: { name: 'Steel beak tip', kind: 'gear', price: 320, desc: 'Pecks hit a little harder (+15%).' },
    mail: { name: 'Chain-mail vest', kind: 'gear', price: 380, desc: 'Blows to the body hurt a little less (-15%).' },
    wingwax: { name: 'Wing wax', kind: 'gear', price: 220, desc: 'Wing buffets hit a fifth harder.' },
    horseshoe: { name: 'Lucky horseshoe', kind: 'gear', price: 260, desc: 'Blows that land on the head hit a little harder (+15%).' },
    springs: { name: 'Spring boots', kind: 'gear', price: 280, desc: 'Harder to knock off its feet (-20% stagger).' },
    flask: { name: 'Pocket tonic', kind: 'gear', price: 240, desc: 'Gets its wind back a fifth faster in a bout.' },

    tophat: { name: 'Top hat', kind: 'hat', price: 120, desc: 'Distinguished.' },
    cowboy: { name: 'Cowboy hat', kind: 'hat', price: 90, desc: 'Yee-haw.' },
    party: { name: 'Party hat', kind: 'hat', price: 40, desc: 'Every day is somebody\'s birthday.' },
    bandana: { name: 'Bandana', kind: 'hat', price: 60, desc: 'Means business.' },
    crown: { name: 'Crown', kind: 'hat', price: 900, desc: 'For champions and pretenders.' },
    bucket: { name: 'BFC bucket', kind: 'hat', price: 0, desc: 'A loyalty reward. Worn upside down, with pride.' },
    sombrero: { name: 'Sombrero', kind: 'hat', price: 110, desc: 'Shade for the whole flock.' },
    viking: { name: 'Viking helmet', kind: 'hat', price: 160, desc: 'Horns sold separately. Just kidding, they are included.' },
    propeller: { name: 'Propeller cap', kind: 'hat', price: 75, desc: 'Does not help it fly. It has tried.' },
    flowers: { name: 'Flower crown', kind: 'hat', price: 85, desc: 'Fresh every morning, somehow.' },
    wizard: { name: 'Wizard hat', kind: 'hat', price: 140, desc: 'Stars and a moon. Spells not included.' },
    pirate: { name: 'Pirate hat', kind: 'hat', price: 130, desc: 'Arr.' },
    cone: { name: 'Traffic cone', kind: 'hat', price: 30, desc: 'Found it. Wears it.' },
    fez: { name: 'Fez', kind: 'hat', price: 70, desc: 'With a tassel that never stops swinging.' },
    chef: { name: 'Chef hat', kind: 'hat', price: 0, ach: 'recipe', desc: 'For sending eleven birds to BFC. Questionable taste.' },
    halo: { name: 'Halo', kind: 'hat', price: 0, ach: 'roost', desc: 'For retiring a bird to Sunset Roost.' },
    laurel: { name: 'Laurel wreath', kind: 'hat', price: 0, ach: 'win10', desc: 'For ten wins in the ring.' },
    bonnet: { name: 'Baby bonnet', kind: 'hat', price: 0, ach: 'hatch', desc: 'For your first chick.' },

    shades: { name: 'Sunglasses', kind: 'face', price: 60, desc: 'Too cool for the coop.' },
    monocle: { name: 'Monocle', kind: 'face', price: 90, desc: 'Indeed.' },
    specs: { name: 'Round glasses', kind: 'face', price: 55, desc: 'Reads the bet slips very carefully.' },
    hearts: { name: 'Heart glasses', kind: 'face', price: 65, desc: 'Sees the world through them.' },
    patch: { name: 'Eye patch', kind: 'face', price: 35, desc: 'Lost the eye in a bet. Or did it?' },
    tache: { name: 'Fake moustache', kind: 'face', price: 40, desc: 'Nobody will recognise it.' },
    nose: { name: 'Clown nose', kind: 'face', price: 25, desc: 'Honk.' },
    goggles: { name: 'Lab goggles', kind: 'face', price: 0, ach: 'inject', desc: 'For injecting your first gene.' },
    mask: { name: 'Burglar mask', kind: 'face', price: 0, ach: 'sweep', desc: 'For netting everyone on the mainland.' },

    bowtie: { name: 'Bow tie', kind: 'neck', price: 45, desc: 'Ready for the gala.' },
    necktie: { name: 'Necktie', kind: 'neck', price: 50, desc: 'Means business. Has a meeting at three.' },
    pearls: { name: 'Pearl necklace', kind: 'neck', price: 220, desc: 'Real pearls. Probably.' },
    cowbell: { name: 'Cowbell', kind: 'neck', price: 35, desc: 'More cowbell.' },
    ruff: { name: 'Ruff collar', kind: 'neck', price: 95, desc: 'Fit for a painting.' },
    goldchain: { name: 'Gold chain', kind: 'neck', price: 0, ach: 'rich', desc: 'For holding $5000 at once.' },
    medal: { name: 'Champion\'s medal', kind: 'neck', price: 0, ach: 'champ', desc: 'For beating Madame Plume at the Grand Ring.' },
    bones: { name: 'Bone necklace', kind: 'neck', price: 0, ach: 'fossil', desc: 'For rebuilding an extinct bird.' },
    binoculars: { name: 'Binoculars', kind: 'neck', price: 0, ach: 'twitcher', desc: 'For meeting fifteen kinds of bird.' },

    cape: { name: 'Hero cape', kind: 'back', price: 150, desc: 'Flaps dramatically, even indoors.' },
    backpack: { name: 'Tiny backpack', kind: 'back', price: 80, desc: 'Snacks for the road.' },
    saddle: { name: 'Tiny saddle', kind: 'back', price: 120, desc: 'For a very small rider.' },
    jetpack: { name: 'Toy jetpack', kind: 'back', price: 260, desc: 'Makes a whooshing noise. That is all it does.' },
    shell: { name: 'Turtle shell', kind: 'back', price: 140, desc: 'A home on its back.' },
    angel: { name: 'Angel wings', kind: 'back', price: 0, ach: 'free', desc: 'For paying off the whole debt.' },

    sneakers: { name: 'Sneakers', kind: 'feet', price: 90, desc: 'Laced up and ready to run.' },
    rainboots: { name: 'Rain boots', kind: 'feet', price: 70, desc: 'For the wetlands.' },
    socks: { name: 'Striped socks', kind: 'feet', price: 30, desc: 'Odd ones, of course.' },
    skates: { name: 'Roller skates', kind: 'feet', price: 180, desc: 'Wheee.' },
    slippers: { name: 'Bunny slippers', kind: 'feet', price: 60, desc: 'Cosy. Very, very cosy.' },

    ribbon: { name: 'Tail ribbon', kind: 'tail', price: 25, desc: 'A big bow on the tail.' },
    flag: { name: 'Tiny flag', kind: 'tail', price: 40, desc: 'So everyone knows where it is.' },
    sparkler: { name: 'Sparkler', kind: 'tail', price: 55, desc: 'Fizzes all day.' },
    pompom: { name: 'Pom-pom', kind: 'tail', price: 35, desc: 'A fluffy ball on the behind. Bounces.' },
    streamers: { name: 'Party streamers', kind: 'tail', price: 45, desc: 'Every step is a parade.' },

    beaker: { name: 'Empty beaker', kind: 'lab', price: 40, desc: 'Holds one extracted gene.' },
    enzyme: { name: 'Cas enzyme', kind: 'lab', price: 90, desc: 'One CRISPR edit.' },
    fuse: { name: 'Fuse', kind: 'lab', price: 250, desc: 'The lab generator needs three.' },

    cap: { name: 'Bottle cap', kind: 'loot', price: 2, desc: 'Someone collects these.' },
    boot: { name: 'Old boot', kind: 'loot', price: 1, desc: 'Just the one.' },
    shard: { name: 'Pottery shard', kind: 'loot', price: 30, desc: 'Old. Somebody will pay for it.' },
    oldspur: { name: 'Antique spur', kind: 'loot', price: 150, desc: 'From a champion long gone.' },
    idol: { name: 'Gold idol', kind: 'loot', price: 400, desc: 'A small golden rooster.' },
  };
  for (const id of Object.keys(ITEMS)) ITEMS[id].id = id;

  // What each shop sells. Coop and vehicle upgrades are handled by their own shops.
  const STOCK = {
    tools: ['net', 'bignet', 'shovel', 'seed', 'lantern', 'detector', 'launcher', 'fuse'],
    feed: ['grain', 'grainsack', 'worm', 'chili', 'tonic', 'gromash', 'loveseed'],
    hatter: ['party', 'bandana', 'cowboy', 'tophat', 'crown', 'sombrero', 'viking', 'propeller', 'flowers', 'wizard', 'pirate', 'fez', 'cone',
      'shades', 'monocle', 'specs', 'hearts', 'patch', 'tache', 'nose', 'bowtie', 'necktie', 'pearls', 'cowbell', 'ruff',
      'cape', 'backpack', 'saddle', 'shell', 'sneakers', 'rainboots', 'socks', 'slippers', 'ribbon', 'flag', 'sparkler', 'pompom', 'streamers',
      'scarf', 'anklets', 'helmet', 'spurs', 'beakcap', 'mail', 'wingwax'],
    market: ['mushroom', 'isotope', 'elixir', 'vigor', 'fuse', 'bignet', 'horseshoe', 'springs', 'flask', 'jetpack', 'skates'],
  };
  // Upgrades: [id, name, levels as prices, description]
  const UPGRADES = {
    engine: { name: 'Tuned engine', prices: [400, 1300], at: 'garage', desc: 'Drive faster.' },
    tires: { name: 'Mud tyres', prices: [600], at: 'garage', desc: 'No slowing in swamp or sand.' },
    coop: { name: 'Coop extension', prices: [250, 800, 2200], at: 'feed', desc: 'Room for more birds.' },
    nest: { name: 'Nest box', prices: [300, 900], at: 'feed', desc: 'One more breeding pair.' },
    incubator: { name: 'Incubator', prices: [500], at: 'feed', desc: 'Eggs hatch a day sooner.' },
    dummy: { name: 'Training dummy', prices: [280], at: 'feed', desc: 'Train a bird once a day.' },
    // only for sale once the open sea is unlocked (the Grand Ring won and the debt paid)
    boat: { name: 'Speedboat kit', prices: [6000], at: 'garage', open: true, desc: 'The truck turns into a speedboat as soon as it drives into water. The open sea is yours.' },
  };
  // the truck carries as many creatures as you can catch
  const CAGE = [Infinity, Infinity, Infinity, Infinity], COOP = [6, 10, 16, 24];

  // Fossil sets for the lab's fossil bench: four fragments rebuild one.
  const FOSSILS = { dodo: 'Dodo', terror: 'Terror bird', moa: 'Moa', archaeo: 'Archaeopteryx', raptor: 'Raptor', elephant: 'Elephant bird', trex: 'Tyrannosaurus', haast: 'Haast\'s eagle', auk: 'Great auk', pelagornis: 'Pelagornis', gastornis: 'Gastornis', gallimimus: 'Gallimimus', pteranodon: 'Pteranodon' };

  // What can be worn, and where. One of each per bird; 'gear' is the fighting kit (one piece).
  const SLOTS = ['hat', 'face', 'neck', 'back', 'feet', 'tail', 'gear'];
  const SLOT_NAMES = { hat: 'Head', face: 'Face', neck: 'Neck', back: 'Back', feet: 'Feet', tail: 'Tail', gear: 'Fighting kit' };
  // Pieces only won through a feat: achievement id -> item
  const UNLOCKS = {};
  for (const id of Object.keys(ITEMS)) if (ITEMS[id].ach) UNLOCKS[ITEMS[id].ach] = id;
  RB.items = { SLOTS, SLOT_NAMES, UNLOCKS, ITEMS, STOCK, UPGRADES, CAGE, COOP, FOSSILS, sellPrice: (id) => Math.max(1, Math.floor(ITEMS[id].price * 0.5)) };
})();
