/* Item registry. icon: up to 3 ASCII characters (inventory/hotbar). */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const R = {};
  const add = (id, name, icon, cat, price, o) => { R[id] = Object.assign({ id, name, icon, cat, price, stack: 99 }, o || {}); };

  // tools (never stack; extra.lvl = 0 basic, 1 copper, 2 iron, 3 gold)
  for (const [id, name, icon] of [['hoe', 'Hoe', 'L-'], ['can', 'Watering Can', 'U~'], ['axe', 'Axe', 'P-'], ['pickaxe', 'Pickaxe', 'T-'], ['scythe', 'Scythe', '?-'], ['rod', 'Fishing Rod', '/~'], ['sword', 'Rusty Sword', '-|-'], ['eraser', 'Eraser', '[_]']]) add(id, name, icon, 'tool', 0, { stack: 1 });
  add('drawn', 'Drawing', '{~}', 'drawn', 0, { stack: 1 });
  add('word', 'Word Card', '[w]', 'word', 40, { stack: 1 });

  // crops and their seeds: [id, name, icon, seasons, days, regrow, seedPrice, sellPrice]
  const CROPS = [
    ['parsnip', 'Parsnip', 'v', [0], 4, 0, 20, 35], ['potato', 'Potato', 'o', [0], 6, 0, 50, 80], ['cauliflower', 'Cauliflower', '@', [0], 11, 0, 80, 175], ['strawberry', 'Strawberry', '*', [0], 8, 4, 100, 120],
    ['tomato', 'Tomato', 'O', [1], 11, 4, 50, 60], ['melon', 'Melon', '()', [1], 12, 0, 80, 250], ['corn', 'Corn', '}', [1, 2], 14, 4, 150, 50], ['blueberry', 'Blueberry', ':', [1], 13, 4, 80, 50],
    ['pumpkin', 'Pumpkin', '(O)', [2], 13, 0, 100, 320], ['eggplant', 'Eggplant', 'D', [2], 5, 5, 20, 60], ['cranberry', 'Cranberry', '..', [2], 7, 5, 240, 75], ['yam', 'Yam', 'J', [2], 10, 0, 60, 160],
    ['kale', 'Kale', 'w', [3], 6, 0, 70, 110], ['snowpea', 'Snow Pea', '=o', [3], 7, 3, 60, 40], ['frostlettuce', 'Frost Lettuce', '%', [3], 5, 0, 40, 75], ['wintersquash', 'Winter Squash', '(_)', [3], 12, 0, 90, 260],
  ];
  PA.CROP_TABLE = CROPS;
  for (const c of CROPS) {
    add(c[0], c[1], c[2], 'crop', c[7], { energy: Math.round(c[7] * 0.35), edible: true });
    add(c[0] + '_seeds', c[1] + ' Seeds', '.' + c[2][0], 'seed', Math.round(c[6] / 2), { crop: c[0], buy: c[6], seasons: c[3] });
  }

  // forage
  for (const [id, name, icon, price, seasons] of [
    ['leek', 'Wild Leek', 'Y', 60, [0]], ['dandelion', 'Dandelion', '*', 40, [0]], ['horseradish', 'Horseradish', 'Y,', 50, [0]],
    ['grape', 'Wild Grape', '8', 80, [1]], ['spiceberry', 'Spice Berry', '`*', 80, [1]], ['sweetpea', 'Sweet Pea', 'f', 50, [1]],
    ['hazelnut', 'Hazelnut', 'o.', 90, [2]], ['blackberry', 'Blackberry', '::', 20, [2]], ['mushroom', 'Common Mushroom', 'T', 40, [2]],
    ['frostberry', 'Frostberry', '*.', 100, [3]], ['snowyam', 'Snow Yam', 'J.', 100, [3]], ['holly', 'Holly', '&', 80, [3]],
    ['inkcap', 'Inkcap Mushroom', 'T!', 70, [0, 1, 2, 3]],
  ]) add(id, name, icon, 'forage', price, { seasons, energy: Math.round(price * 0.3), edible: id !== 'holly' && id !== 'inkcap' });

  // fish
  for (const [id, name, icon, price] of [
    ['minnow', 'Minnow', '><', 30], ['perch', 'Perch', '<>', 55], ['sardine', 'Sardine', '>-', 40], ['catfish', 'Catfish', '=<', 200], ['trout', 'Rainbow Trout', '><>', 65], ['carp', 'Carp', '<o>', 30],
    ['pike', 'Pike', '>->', 100], ['eel', 'Eel', '~~>', 85], ['bream', 'Bream', '<)', 45], ['sunfish', 'Sunfish', '(*>', 30], ['inkfish', 'Inkfish', '<@', 160], ['koi', 'Paper Koi', '<%>', 300],
  ]) add(id, name, icon, 'fish', price, { energy: 15, edible: true });

  // materials, ores, bars
  for (const [id, name, icon, price] of [
    ['wood', 'Wood', '=', 2], ['stone', 'Stone', 'o', 2], ['fiber', 'Fiber', '~', 1], ['sap', 'Sap', 'i', 2], ['clay', 'Clay', '%', 20], ['hardwood', 'Hardwood', '#', 15],
    ['charcoal', 'Charcoal', '#.', 15], ['graphite', 'Graphite', 'G', 25], ['ink', 'Ink Bottle', 'i!', 40], ['quartz', 'Quartz', '<>', 25], ['inkstone', 'Inkstone', '&', 60],
    ['copper_ore', 'Copper Ore', 'c', 5], ['iron_ore', 'Iron Ore', 'i', 10], ['gold_ore', 'Gold Ore', '$', 25],
    ['copper_bar', 'Copper Bar', '=c', 60], ['iron_bar', 'Iron Bar', '=i', 120], ['gold_bar', 'Gold Bar', '=$', 250],
    ['hay', 'Hay', 'W', 25], ['fertilizer', 'Fertilizer', '.:', 10], ['bait', 'Bait', 'o~', 1], ['torn_page', 'Torn Page', '[?]', 0],
  ]) add(id, name, icon, 'material', price);

  // animal products and artisan goods
  for (const [id, name, icon, price, energy] of [
    ['egg', 'Egg', '0', 50, 25], ['milk', 'Milk', 'U', 125, 40], ['goat_milk', 'Goat Milk', 'U.', 225, 45], ['wool', 'Wool', '@', 340, 0],
    ['mayo', 'Mayonnaise', '[0]', 190, 50], ['cheese', 'Cheese', '<|', 230, 60], ['cloth', 'Cloth', '[#]', 470, 0],
    ['jam', 'Jam', '[j]', 0, 60], ['pickles', 'Pickles', '[p]', 0, 50], ['juice', 'Juice', '[~]', 0, 60],
  ]) add(id, name, icon, 'artisan', price, { energy, edible: energy > 0 });

  // cooked food (cafe)
  for (const [id, name, icon, price, energy] of [
    ['bread', 'Bread', '(_)', 60, 50], ['salad', 'Salad', '\\_/', 110, 80], ['soup', 'Soup', 'U~', 160, 110], ['coffee', 'Coffee', 'c[', 150, 3], ['pie', 'Pie', '(=)', 260, 160], ['omelet', 'Omelet', '(o)', 125, 100],
  ]) add(id, name, icon, 'food', price, { energy, edible: true, speed: id === 'coffee' });

  // placeables (machines and furniture)
  for (const [id, name, icon, price] of [
    ['chest', 'Chest', '[=]', 50], ['kiln', 'Charcoal Kiln', '/^\\', 100], ['inkpress', 'Ink Press', '[i]', 200], ['jar', 'Preserves Jar', '[J]', 150], ['furnace', 'Furnace', '|^|', 120],
    ['sprinkler', 'Sprinkler', '-*-', 120], ['scarecrow', 'Scarecrow', '-O-', 60], ['lantern_post', 'Lantern Post', 'i^', 60],
  ]) add(id, name, icon, 'placeable', price, { stack: 99 });

  PA.Items = {
    get: (id) => R[id] || null,
    all: () => Object.values(R),
    byCat: (cat) => Object.values(R).filter((i) => i.cat === cat),
    sellPrice(id, extra) { const it = R[id]; if (!it) return 0; if (it.cat === 'artisan' && !it.price && extra && extra.from) return Math.round((R[extra.from] ? R[extra.from].price : 20) * 2.2); return it.price; },
    label(slot) { if (!slot) return ''; const it = R[slot.id]; if (!it) return '?'; if (slot.id === 'word' && slot.extra) return 'Word: ' + slot.extra.word; if (slot.id === 'drawn' && slot.extra) return 'Drawn ' + slot.extra.name; const lv = slot.extra && slot.extra.lvl ? ['', 'Copper ', 'Iron ', 'Gold '][slot.extra.lvl] : ''; return lv + it.name; },
    icon(slot) { if (!slot) return ''; if (slot.id === 'drawn' && slot.extra && slot.extra.icon) return slot.extra.icon; return R[slot.id] ? R[slot.id].icon : '?'; },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = PA.Items;
})(typeof window !== 'undefined' ? window : globalThis);
