import { shuffleArray } from "src/stochastic"

export class SPD {
  constructor(type: 'low' | 'high') {
    this.laneSize = type === 'low' ? 16 : 256
    this.size = this.laneSize ** 2
    this.buffer = new ArrayBuffer(this.size, { maxByteLength: this.size })
    this.bufferView = Buffer.from(this.buffer)

    this.generateLanes()
    this.rotateBuffer()
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

  private generateLanes() {
    Iterator.from(this)
      .forEach((_, laneIndex) => this.bufferView.set(
        shuffleArray(Array.from({ length: this.laneSize }, (_, i) => i)),
        this.laneSize * laneIndex))
  }

  private rotateBuffer() {
    for (let i = 0; i < this.laneSize; i++) {
      for (let j = i; j < this.laneSize; j++) {
        this.bufferView[i * this.laneSize + j]! ^= this.bufferView[j * this.laneSize + i]!
        this.bufferView[j * this.laneSize + i]! ^= this.bufferView[i * this.laneSize + j]!
        this.bufferView[i * this.laneSize + j]! ^= this.bufferView[j * this.laneSize + i]!
      }
    }
  }
}
