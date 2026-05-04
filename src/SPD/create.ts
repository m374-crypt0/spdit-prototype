export class SPD {
  constructor(type: 'low' | 'high') {
    this.buffer = new ArrayBuffer()
  }

  [Symbol.iterator] = () => this.buffer

  private buffer: ArrayBuffer
}
