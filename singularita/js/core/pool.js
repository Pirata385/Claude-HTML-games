// Object pool: get() reuses released objects, so hot loops don't allocate.
export class Pool {
  constructor(create, reset) {
    this.create = create;
    this.reset = reset;
    this.free = [];
  }
  get() { return this.free.length ? this.free.pop() : this.create(); }
  release(obj) {
    if (this.reset) this.reset(obj);
    this.free.push(obj);
  }
}
