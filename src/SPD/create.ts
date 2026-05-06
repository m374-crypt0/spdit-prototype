import { shuffleBuffer, UniformUint64 } from "src/stochastic"

/**
 * Stochastic Private Dimensional transcoding table
 * Core of SPDIT, relying on entropy instead of algorithms
 */
export class SPD {

  /**
   * Construct a new instance of SPD of a specified type
   * @param type either 'low' or 'high'. A 'low' type SPD is designed for
   * 'high' type SPD transcoding purposes. A 'high' type SPD is designed to
   * transcode any data
   */
  constructor(type: 'low' | 'high') {
    this.laneSize = type === 'low' ? 16 : 256
    this.size = this.laneSize ** 2
    this.buffer = new ArrayBuffer(this.size, { maxByteLength: this.size })

    this.generateLanes()
    this.shuffleLanes()
    this.transposeBuffer()
    this.shuffleLanes()
    this.overwriteFewValuesInAllLanes()
  }

  /**
   * Iterates through all lanes of this SPD instance
   */
  readonly [Symbol.iterator] = () =>
    (function* (b: ArrayBuffer, ls: number) {
      for (let i = 0; i < ls; i++)
        yield Iterator.from(Buffer.from(b)).drop(i * ls).take(ls)
    })(this.buffer, this.laneSize)

  /**
   * Get a view on the underlying storage for this SPD instance.
   * Allows reading to the underlying buffer
   * @returns a readonly buffer view on underlying buffer storage
   */
  readonlyBufferView(): Readonly<Buffer<ArrayBuffer>> {
    return this.bufferView()
  }

  /**
   * The size of each lane of this SPD instance. Depends of SPD type: 'low'
   * type has a lane size of 16 and 'high' type has a lane size of 256
   */
  readonly laneSize: number

  /**
   * The size of this SPD instance storage. Depends on its type. 'low' type SPD
   * is 256 bytes* 'high' type SPD is 64kb.
   *
   * *'low' type SPD size is trivially compressible to 128 bytes
   */
  readonly size: number

  private buffer: ArrayBuffer

  private bufferView() {
    return Buffer.from(this.buffer)
  }

  private generateLanes() {
    Iterator.from(this)
      .forEach((_, laneIndex) =>
        this.bufferView().set(Array.from({ length: this.laneSize },
          (_, i) => i), this.laneSize * laneIndex)
      )
  }

  private transposeBuffer() {
    const bufferView = this.bufferView()

    for (let i = 0; i < this.laneSize; i++) {
      for (let j = i; j < this.laneSize; j++) {
        if (bufferView[i * this.laneSize + j] === bufferView[j * this.laneSize + i])
          continue

        bufferView[i * this.laneSize + j]! ^= bufferView[j * this.laneSize + i]!
        bufferView[j * this.laneSize + i]! ^= bufferView[i * this.laneSize + j]!
        bufferView[i * this.laneSize + j]! ^= bufferView[j * this.laneSize + i]!
      }
    }
  }

  private shuffleLanes() {
    Iterator.from(this)
      .forEach((_, i) =>
        shuffleBuffer(this.bufferView().subarray(this.laneSize * i, this.laneSize * (i + 1))))
  }

  private overwriteFewValuesInAllLanes() {
    const d = new UniformUint64

    Iterator.from(this)
      .forEach((_, i) => {
        let laneBitSize = 0
        for (let laneSizeMax = this.laneSize - 1; laneSizeMax > 0; laneSizeMax >>= 1, laneBitSize++);

        const lane = this.bufferView().subarray(this.laneSize * i, this.laneSize * (i + 1))

        Array.from({ length: Number(d.newUint([BigInt(this.laneSize / 2), BigInt(this.laneSize)])) }, () =>
          Number(d.newUint([0n, BigInt(this.laneSize - 1)])))
          .forEach((v, j) => {
            while ((lane[j] === lane[v]) || (j === v))
              v = (v + 1) % this.laneSize
            lane[j] = lane[v]!
          })
      })

  }
}
