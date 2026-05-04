export class SPD {
  constructor(type: 'low' | 'high') {
    this.laneSize = type === 'low' ? 16 : 256
    this.size = this.laneSize ** 2
    this.buffer = new ArrayBuffer(this.size, { maxByteLength: this.size })
    this.bufferView = Buffer.from(this.buffer)

    this.bufferView
      .forEach((_, i) => this.bufferView.writeUint8(i % this.laneSize, i))
  }

  readonly [Symbol.iterator] = () => {
    const b = this.buffer
    const ls = this.laneSize

    function* getLanes() {
      for (let i = 0; i < ls; i++)
        yield Iterator.from(Buffer.from(b)).drop(i * ls).take(ls)
    }

    return getLanes()
  }

  readonly laneSize: number
  readonly size: number
  readonly bufferView: Buffer<ArrayBuffer>

  private buffer: ArrayBuffer
}
