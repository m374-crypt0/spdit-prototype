import { shuffleBuffer, SplitMix64, UniformUint64, Xoroshiro128Plus } from "src/stochastic"
import { SPD, Transcoder } from "src/transcoding"

export class Shi7 {
  constructor(options?: Options) {
    this.seed_ = options?.seed ?? new SplitMix64().state()


    this.hashBitSize_ = options?.hashBitSize ?? 256
  }

  hashBitSize() {
    return this.hashBitSize_
  }

  seed() {
    return this.seed_
  }

  highSPD(): Readonly<SPD> {
    return this.highSPD_ = this.highSPD_ ?? new SPD('high', { kind: 'seed', seed: this.seed_ })
  }

  hash(buffer: Readonly<Buffer<ArrayBuffer>>) {
    const isMessageEmpty = buffer.byteLength === 0

    const message = isMessageEmpty ? this.highSPD().readonlyBufferView() : buffer

    const transcoder = new Transcoder({ highSPD: this.highSPD() })

    const preHash = this.encodeUntilSizeInBits(message, transcoder, this.hashBitSize_ * SPD.DIMENSIONAL_FACTOR)
    const seedAsBuffer = this.encodeUntilSizeInBits(preHash, transcoder, 64)
    const seed = BigInt(`0x${seedAsBuffer.toHex()}`)

    const d = new UniformUint64(new Xoroshiro128Plus(new SplitMix64(seed)))
    shuffleBuffer(preHash, d)

    if (isMessageEmpty)
      shuffleBuffer(preHash, d)

    const hashAsBuffer = transcoder.decode(preHash)

    return BigInt(`0x${hashAsBuffer.toHex()}`)
  }

  private encodeUntilSizeInBits(buffer: Readonly<Buffer<ArrayBuffer>>, transcoder: Transcoder, sizeInBits: number) {
    const sizeInBytes = sizeInBits / 8

    let b: Buffer<ArrayBuffer> = buffer

    while (b.byteLength > sizeInBytes)
      b = transcoder.decode(b)

    return b
  }

  private seed_: bigint
  private hashBitSize_: HashBitSize
  private highSPD_?: SPD
}

type HashBitSize = 64 | 128 | 256 | 512 | 1024

type Options = {
  seed?: bigint,
  hashBitSize?: HashBitSize
}
