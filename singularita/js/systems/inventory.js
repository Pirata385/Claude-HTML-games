// Inventory: unlimited stacks for materials and consumables, plus a list of item instances.
export const newInventory = () => ({ stacks: {}, items: [], nextUid: 1 });

export const count = (inv, id) => inv.stacks[id] || 0;
export function addStack(inv, id, n) { inv.stacks[id] = count(inv, id) + n; return inv.stacks[id]; }
export function takeStack(inv, id, n) {
  if (count(inv, id) < n) return false;
  inv.stacks[id] -= n;
  if (inv.stacks[id] === 0) delete inv.stacks[id];
  return true;
}
export function addItem(inv, id) {
  const uid = inv.nextUid++;
  inv.items.push({ uid, id });
  return uid;
}
export const findItem = (inv, uid) => inv.items.find((i) => i.uid === uid);
export function removeItem(inv, uid) {
  const i = inv.items.findIndex((x) => x.uid === uid);
  if (i >= 0) inv.items.splice(i, 1);
  return i >= 0;
}
export const ownsItem = (inv, id) => inv.items.some((i) => i.id === id);
