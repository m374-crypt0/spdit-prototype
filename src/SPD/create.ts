export class SPD {
  constructor(type: 'low' | 'high') {
    this.buffer = new ArrayBuffer()
  }

  [Symbol.iterator] = () => Iterator.from(Buffer.from(this.buffer))

  private buffer: ArrayBuffer
}
