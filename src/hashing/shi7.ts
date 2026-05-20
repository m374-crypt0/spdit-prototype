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

  hash(buffer: Readonly<Buffer<ArrayBuffer>>) {
    const transcoder = new Transcoder({ highSPD: this.highSPD() })

    if (buffer.byteLength === 0)
      return this.hashEmptyMessage(transcoder)
    else if (buffer.byteLength < this.preHashSizeInBytes)
      return this.hashSmallMessage(buffer, transcoder)
    else
      return this.hashMessage(buffer, transcoder)
  }

  private getDistributionForPreHashShuffling(preHash: Readonly<Buffer<ArrayBuffer>>, transcoder: Transcoder) {
    const seed = this.decodePreHashToSeed(preHash, transcoder)
    return new UniformUint64(new Xoroshiro128Plus(new SplitMix64(seed)))
  }

  private hashEmptyMessage(transcoder: Transcoder) {
    if (this.emptyMessageHash !== undefined)
      return this.emptyMessageHash

    const preHash = this.decodeMessageToPreHash(this.highSPD().readonlyBufferView(), transcoder)

    // NOTE: shuffling twice to avoid collision with the actual hash of the
    // underlying SPD, specific case for empty message hashing
    return this.emptyMessageHash = this.shuffleThenDecodePreHash(preHash, transcoder, 2)
  }

  private hashSmallMessage(buffer: Readonly<Buffer<ArrayBuffer>>, transcoder: Transcoder) {
    const preHash = this.encodeMessageToPreHash(buffer, transcoder, new SplitMix64(this.seed_))

    return this.shuffleThenDecodePreHash(preHash, transcoder)
  }

  private hashMessage(buffer: Readonly<Buffer<ArrayBuffer>>, transcoder: Transcoder) {
    const preHash = this.decodeMessageToPreHash(buffer, transcoder)
    const oddness = buffer.byteLength & 1

    return this.shuffleThenDecodePreHash(preHash, transcoder, 1 + oddness)
  }

  private shuffleThenDecodePreHash(preHash: Buffer<ArrayBuffer>, transcoder: Transcoder, shuffleCount = 1) {
    const distribution = this.getDistributionForPreHashShuffling(preHash, transcoder)

    for (let i = 0; i < shuffleCount; i++)
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

    const bb = Buffer.from(new ArrayBuffer(this.preHashSizeInBytes))
    bb.set([...decodedExtraBytes, ...b.subarray(extraByteCount, b.byteLength)])

    return bb
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
    buffer: Readonly<Buffer<ArrayBuffer>>,
    transcoder: Transcoder,
    seedGenerator: SeedGenerator<bigint>): Readonly<Buffer<ArrayBuffer>> {
    const recursiveThreshold = Math.floor(this.preHashSizeInBytes / 3)

    if (buffer.byteLength < recursiveThreshold) {
      const newBuffer = Buffer.from(Buffer.from(buffer).buffer.transfer(buffer.byteLength * 3))
      const encoded = transcoder.encode(buffer, { seed: seedGenerator.newSeed() })
      newBuffer.set(buffer)
      newBuffer.set(encoded, buffer.byteLength)

      return this.encodeMessageToPreHash(newBuffer, transcoder, seedGenerator)
    }

    const missingByteCount = this.preHashSizeInBytes - buffer.byteLength
    const extraOddByte = missingByteCount & 1
    const newBuffer = Buffer.from(Buffer.from(buffer).buffer.transfer(buffer.byteLength + missingByteCount))

    const bufferByteCountToEncode = Math.floor(missingByteCount / 2)
    const encoded = transcoder.encode(buffer.subarray(0, bufferByteCountToEncode), { seed: seedGenerator.newSeed() })
    newBuffer.set(buffer)
    newBuffer.set(encoded, buffer.byteLength)

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
