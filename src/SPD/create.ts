export class SPD {
  constructor(type: 'low' | 'high') {
    this.laneSize = type === 'low' ? 16 : 256
    this.size = this.laneSize ** 2
    this.buffer = new ArrayBuffer(this.size)
  }

  readonly [Symbol.iterator] = () => {
    const b = this.buffer
    const ls = this.laneSize

    function* getLane() {
      for (let i = 0; i < ls; i++)
        yield Iterator.from(Buffer.from(b)).drop(i * ls).take(ls)
    }

    return getLane()
  }

  readonly laneSize: number
  readonly size: number

  private buffer: ArrayBuffer
}
