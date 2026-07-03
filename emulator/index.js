class Memory {
  constructor() {
    this.MAX_SIZE = 16 * 1024;
    this.buffer = new Int8Array(this.MAX_SIZE);
  }
}
