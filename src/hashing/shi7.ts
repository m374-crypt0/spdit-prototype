import { shuffleBuffer, SplitMix64, UniformUint64, Xoroshiro128Plus, type SeedGenerator } from "src/stochastic"
import { SPD, Transcoder } from "src/transcoding"

export class Shi7 {
  constructor(options?: Options) {
    this.seed_ = options?.seed !== undefined
      ? new SplitMix64(options.seed).state()
      : new SplitMix64().state()

    this.hashBitSize_ = options?.hashBitSize ?? 256
    this.preHashSizeInBytes = this.hashBitSize_ / 8 * 2
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

  hash(message: Readonly<Buffer<ArrayBuffer>>) {
    const transcoder = new Transcoder({ highSPD: this.highSPD() })

    if (message.byteLength === 0)
      return this.hashEmptyMessage(transcoder)
    else if (message.byteLength < this.preHashSizeInBytes)
      return this.hashSmallMessage(message, transcoder)
    else
      return this.hashMessage(message, transcoder)
  }

  private getDistributionForPreHashShuffling(preHash: Readonly<Buffer<ArrayBuffer>>, transcoder: Transcoder, seedDiscardCount: number = 0) {
    const seed = this.decodePreHashToSeed(preHash, transcoder)
    const seedGenerator = new SplitMix64(seed)

    while (seedDiscardCount-- > 0)
      seedGenerator.newSeed()

    return new UniformUint64(new Xoroshiro128Plus(seedGenerator))
  }

  private hashEmptyMessage(transcoder: Transcoder) {
    if (this.emptyMessageHash !== undefined)
      return this.emptyMessageHash

    const preHash = this.decodeMessageToPreHash(this.highSPD().readonlyBufferView(), transcoder)

    // NOTE: discarding one seed changes the behavior of shuffling, avoiding
    // collision when hashing empty message and the underlying shi7 instance
    // high SPD
    return this.emptyMessageHash = this.shuffleThenDecodePreHash(preHash, transcoder, 1)
  }

  private hashSmallMessage(message: Readonly<Buffer<ArrayBuffer>>, transcoder: Transcoder) {
    const preHash = this.encodeMessageToPreHash(message, transcoder, new SplitMix64(this.seed_))

    return this.shuffleThenDecodePreHash(preHash, transcoder)
  }

  private hashMessage(message: Readonly<Buffer<ArrayBuffer>>, transcoder: Transcoder) {
    const preHash = this.decodeMessageToPreHash(message, transcoder)
    const oddness = message.byteLength & 1

    return this.shuffleThenDecodePreHash(preHash, transcoder, oddness)
  }

  private shuffleThenDecodePreHash(preHash: Buffer<ArrayBuffer>, transcoder: Transcoder, seedDiscardCount: number = 0) {
    const distribution = this.getDistributionForPreHashShuffling(preHash, transcoder, seedDiscardCount)

    shuffleBuffer(preHash, distribution)

    return this.decodeShuffledPreHashToHash(preHash, transcoder)
  }

  private decodeMessageToPreHash(message: Readonly<Buffer<ArrayBuffer>>, transcoder: Transcoder) {
    let b = message

    while (b.byteLength > this.preHashSizeInBytes) {
      const oddness = b.byteLength & 1
      b = transcoder.decode(b.subarray(0, b.byteLength - oddness))
    }

    const extraByteCount = b.byteLength - this.preHashSizeInBytes
    const decodedExtraBytes = transcoder.decode(b.subarray(0, extraByteCount))

    const preHash = Buffer.from(new ArrayBuffer(this.preHashSizeInBytes))
    preHash.set([...decodedExtraBytes, ...b.subarray(extraByteCount, b.byteLength)])

    return preHash
  }

  private decodePreHashToSeed(preHash: Readonly<Buffer<ArrayBuffer>>, transcoder: Transcoder) {
    const seedBuffer = this.decodeUntilSizeInBits(preHash, transcoder, 64)

    return BigInt(`0x${seedBuffer.toHex()}`)
  }

  private decodeShuffledPreHashToHash(preHash: Readonly<Buffer<ArrayBuffer>>, transcoder: Transcoder) {
    let b = preHash

    if (b.byteLength & 1)
      b = b.subarray(0, b.byteLength - 1)

    const hashBuffer = transcoder.decode(b)

    return BigInt(`0x${hashBuffer.toHex()}`)
  }

  private decodeUntilSizeInBits(buffer: Readonly<Buffer<ArrayBuffer>>, transcoder: Transcoder, sizeInBits: number) {
    const sizeInBytes = sizeInBits / 8

    let b: Buffer<ArrayBuffer> = buffer

    while (b.byteLength > sizeInBytes)
      b = transcoder.decode(b)

    return b
  }

  private encodeMessageToPreHash(
    message: Readonly<Buffer<ArrayBuffer>>,
    transcoder: Transcoder,
    seedGenerator: SeedGenerator<bigint>): Readonly<Buffer<ArrayBuffer>> {
    const recursiveThreshold = Math.floor(this.preHashSizeInBytes / 3)

    if (message.byteLength < recursiveThreshold) {
      const newBuffer = Buffer.from(Buffer.from(message).buffer.transfer(message.byteLength * 3))
      const encoded = transcoder.encode(message, { seed: seedGenerator.newSeed() })
      newBuffer.set(message)
      newBuffer.set(encoded, message.byteLength)

      return this.encodeMessageToPreHash(newBuffer, transcoder, seedGenerator)
    }

    const missingByteCount = this.preHashSizeInBytes - message.byteLength
    const extraOddByte = missingByteCount & 1
    const newBuffer = Buffer.from(Buffer.from(message).buffer.transfer(message.byteLength + missingByteCount))

    const bufferByteCountToEncode = Math.floor(missingByteCount / 2)
    const encoded = transcoder.encode(message.subarray(0, bufferByteCountToEncode), { seed: seedGenerator.newSeed() })
    newBuffer.set(message)
    newBuffer.set(encoded, message.byteLength)

    if (extraOddByte > 0) {
      const d = new UniformUint64(new Xoroshiro128Plus(seedGenerator))
      const random = Number(d.newUint([0n, 255n]))
      newBuffer[newBuffer.byteLength - 1] = random
    }

    return newBuffer
  }

  private seed_: bigint
  private hashBitSize_: HashBitSize
  private highSPD_?: SPD
  private emptyMessageHash?: bigint
  private preHashSizeInBytes: number
}

type HashBitSize = 64 | 128 | 256 | 512 | 1024

type Options = {
  seed?: bigint,
  hashBitSize?: HashBitSize
}
