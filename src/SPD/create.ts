export class SPD {
  constructor() {
    this.buffer = new ArrayBuffer()
  }

  [Symbol.iterator] = () => this.buffer

  private buffer: ArrayBuffer
}
