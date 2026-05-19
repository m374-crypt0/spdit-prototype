import { shuffleBuffer, SplitMix64, UniformUint64, Xoroshiro128Plus } from "src/stochastic"
import { SPD, Transcoder } from "src/transcoding"
import type { Bundle } from "typescript"

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
    // NOTE: empty message hashing give a special constant value (bound to the
    // underlying high SPD) computed once in this Shi7 instance lifetime
    const isMessageEmpty = buffer.byteLength === 0

    if (isMessageEmpty && this.emptyMessageHash !== undefined)
      return this.emptyMessageHash

    const message = isMessageEmpty ? this.highSPD().readonlyBufferView() : buffer

    const transcoder = new Transcoder({ highSPD: this.highSPD() })

    const preHash = this.decodeMessageToPreHash(message, transcoder)
    const seed = this.decodePreHashToSeed(preHash, transcoder)
    const distribution = new UniformUint64(new Xoroshiro128Plus(new SplitMix64(seed)))

    shuffleBuffer(preHash, distribution)

    // NOTE: avoid collision with the actual hash of the underlying SPD,
    // specific case for empty message hashing
    if (isMessageEmpty)
      shuffleBuffer(preHash, distribution)

    return this.emptyMessageHash = this.decodeShuffledPreHashToHash(preHash, transcoder)
  }

  private decodeMessageToPreHash(message: Readonly<Buffer<ArrayBuffer>>, transcoder: Transcoder) {
    return this.decodeUntilSizeInBits(message, transcoder, this.hashBitSize_ * SPD.DIMENSIONAL_FACTOR)
  }

  private decodePreHashToSeed(preHash: Readonly<Buffer<ArrayBuffer>>, transcoder: Transcoder) {
    const seedBuffer = this.decodeUntilSizeInBits(preHash, transcoder, 64)

    return BigInt(`0x${seedBuffer.toHex()}`)
  }

  private decodeShuffledPreHashToHash(preHash: Readonly<Buffer<ArrayBuffer>>, transcoder: Transcoder) {
    const hashBuffer = transcoder.decode(preHash)

    return BigInt(`0x${hashBuffer.toHex()}`)
  }

  private decodeUntilSizeInBits(buffer: Readonly<Buffer<ArrayBuffer>>, transcoder: Transcoder, sizeInBits: number) {
    const sizeInBytes = sizeInBits / 8

    let b: Buffer<ArrayBuffer> = buffer

    while (b.byteLength > sizeInBytes)
      b = transcoder.decode(b)

    return b
  }

  private seed_: bigint
  private hashBitSize_: HashBitSize
  private highSPD_?: SPD
  private emptyMessageHash?: bigint
}

type HashBitSize = 64 | 128 | 256 | 512 | 1024

type Options = {
  seed?: bigint,
  hashBitSize?: HashBitSize
}
