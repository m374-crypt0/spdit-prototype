import { shuffleArray, shuffleBuffer } from "src/stochastic"

export class SPD {
  constructor(type: 'low' | 'high') {
    this.laneSize = type === 'low' ? 16 : 256
    this.size = this.laneSize ** 2
    this.buffer = new ArrayBuffer(this.size, { maxByteLength: this.size })
    this.bufferView = Buffer.from(this.buffer)

    this.generateLanes()
    this.rotateBuffer()
    this.shuffleLanes()
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
      .forEach((_, laneIndex) => {
        const a = Array.from({ length: this.laneSize }, (_, i) => i)
        shuffleArray(a)
        this.bufferView.set(a, this.laneSize * laneIndex)
      })
  }

  private rotateBuffer() {
    for (let i = 0; i < this.laneSize; i++) {
      for (let j = i; j < this.laneSize; j++) {
        if (this.bufferView[i * this.laneSize + j] === this.bufferView[j * this.laneSize + i])
          continue

        this.bufferView[i * this.laneSize + j]! ^= this.bufferView[j * this.laneSize + i]!
        this.bufferView[j * this.laneSize + i]! ^= this.bufferView[i * this.laneSize + j]!
        this.bufferView[i * this.laneSize + j]! ^= this.bufferView[j * this.laneSize + i]!
      }
    }
  }

  private shuffleLanes() {
    Iterator.from(this)
      .forEach((_, i) =>
        shuffleBuffer(this.bufferView.subarray(this.laneSize * i, this.laneSize * (i + 1))))
  }
}
