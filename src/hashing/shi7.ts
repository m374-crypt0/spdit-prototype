import { shuffleBuffer, SplitMix64, UniformUint64, Xoroshiro128Plus, type SeedGenerator } from "src/stochastic"
import { SPD, Transcoder } from "src/transcoding"

export class Shi7 {
  constructor(options?: Options) {
    this.seed_ = options?.seed !== undefined
      ? new SplitMix64(options.seed).state()
      : new SplitMix64().state()

    this.hashBitSize_ = options?.hashBitSize ?? 256
    this.domainPreludes = this.initializeDomainPreludes()
  }

  hashBitSize() {
    return this.hashBitSize_
  }

  seed() {
    return this.seed_
  }

  transcoder(): Readonly<Transcoder> {
    return this.transcoder_ = this.transcoder_ ?? new Transcoder({ highSPD: this.highSPD() })
  }

  hash(message: Readonly<Buffer<ArrayBuffer>>) {
    if (message.byteLength === 0)
      return this.hashEmptyMessage()

    if (this.isMessageSmallerOrEqualToSeedSize(message))
      return this.hashSmallerThanSeedMessage(message)

    if (this.isMessageBiggerThanHashSize(message))
      return this.hashBiggerThanHashMessage(message)

    return this.hashMessageSizedBetweenSeedAndHash(message)
  }

  initializeDomainPreludes(): DomainPreludes {
    const d = new UniformUint64(new Xoroshiro128Plus(new SplitMix64(this.seed_)))
    const randomByte = () => Number(d.newUint([0n, 255n]))
    const uniqueBytes = new Set<number>

    while (uniqueBytes.size < 3) {
      uniqueBytes.clear()
      uniqueBytes.add(randomByte())
      uniqueBytes.add(randomByte())
      uniqueBytes.add(randomByte())
    }

    return {
      small: uniqueBytes.values().toArray()[0]!,
      medium: uniqueBytes.values().toArray()[1]!,
      big: uniqueBytes.values().toArray()[2]!
    }
  }

  private highSPD(): Readonly<SPD> {
    return this.highSPD_ = this.highSPD_ ?? new SPD('high', { kind: 'seed', seed: this.seed_ })
  }

  private hashEmptyMessage() {
    if (this.emptyMessageHash !== undefined)
      return this.emptyMessageHash

    const message = this.highSPD().readonlyBufferView()
    const sizeInBytes = this.hashBitSize() / Shi7.BYTE_BITS
    const seedGenerator = new SplitMix64(this.seed_)
    const hashBuffer = this.decodeMessageUntilSizeInBytes(message, sizeInBytes, seedGenerator)

    return this.emptyMessageHash = BigInt(`0x${hashBuffer.toHex()}`)
  }

  private hashSmallerThanSeedMessage(message: Readonly<Buffer<ArrayBuffer>>) {
    const seedGenerator = new SplitMix64(this.seed_)
    const preSeedSize = Shi7.SEED_SIZE * SPD.DIMENSIONAL_FACTOR
    const preSeed = this.encodeMessageUntilSizeInByte(message, seedGenerator, preSeedSize)
    const preHash = this.encodePreSeedToPreHash(preSeed, seedGenerator)

    return this.hashMessage(preSeed, preHash, seedGenerator)
  }

  private hashBiggerThanHashMessage(message: Readonly<Buffer<ArrayBuffer>>) {
    const seedGenerator = new SplitMix64(this.seed_)
    const hashSizedBuffer = this.decodeMessageUntilSizeInBytes(message, this.hashBitSize() / Shi7.BYTE_BITS, seedGenerator)
    const seedSizedBuffer = this.simpleChainDecodeMessageUntilSizeInBytes(hashSizedBuffer, Shi7.SEED_SIZE)
    const preHash = this.transcoder().encode(hashSizedBuffer, { seed: seedGenerator.newSeed() })
    const preSeed = this.transcoder().encode(seedSizedBuffer, { seed: seedGenerator.newSeed() })

    return this.hashMessage(preSeed, preHash, seedGenerator)
  }

  private hashMessageSizedBetweenSeedAndHash(message: Readonly<Buffer<ArrayBuffer>>) {
    const seedGenerator = new SplitMix64(this.seed_)
    const seedSizedBuffer = this.decodeMessageUntilSizeInBytes(message, Shi7.SEED_SIZE, seedGenerator)
    const preHashSize = this.hashBitSize() / Shi7.BYTE_BITS * SPD.DIMENSIONAL_FACTOR
    const preHash = this.encodeMessageUntilSizeInByte(message, seedGenerator, preHashSize)
    const preSeed = this.transcoder().encode(seedSizedBuffer, { seed: seedGenerator.newSeed() })

    return this.hashMessage(preSeed, preHash, seedGenerator)
  }

  private hashMessage(preSeed: Buffer<ArrayBuffer>, preHash: Buffer<ArrayBuffer>, seedGenerator: SeedGenerator<bigint>) {
    shuffleBuffer(preSeed, new UniformUint64(new Xoroshiro128Plus(seedGenerator)))

    const seedBuffer = this.transcoder().decode(preSeed)
    const preHashSeedGenerator = new SplitMix64(BigInt(`0x${seedBuffer.toHex()}`))

    shuffleBuffer(preHash, new UniformUint64(new Xoroshiro128Plus(preHashSeedGenerator)))

    const hashBuffer = this.transcoder().decode(preHash)

    return BigInt(`0x${hashBuffer.toHex()}`)
  }

  private isMessageSmallerOrEqualToSeedSize(message: Readonly<Buffer<ArrayBuffer>>) {
    return message.byteLength <= Shi7.SEED_SIZE
  }

  private isMessageBiggerThanHashSize(message: Readonly<Buffer<ArrayBuffer>>) {
    return message.byteLength >= this.hashBitSize() / Shi7.BYTE_BITS
  }

  private simpleChainDecodeMessageUntilSizeInBytes(message: Readonly<Buffer<ArrayBuffer>>, sizeInBytes: number) {
    let sizedBuffer = message

    while (sizedBuffer.byteLength > sizeInBytes)
      sizedBuffer = this.transcoder().decode(sizedBuffer)

    return sizedBuffer
  }

  private encodePreSeedToPreHash(preSeed: Readonly<Buffer<ArrayBuffer>>, seedGenerator: SeedGenerator<bigint>) {
    let preHash = preSeed

    while (preHash.byteLength < this.hashBitSize() / Shi7.BYTE_BITS * SPD.DIMENSIONAL_FACTOR)
      preHash = this.transcoder().encode(preHash, { seed: seedGenerator.newSeed() })

    return preHash
  }

  private decodeMessageUntilSizeInBytes(message: Readonly<Buffer<ArrayBuffer>>, sizeInBytes: number, seedGenerator: SeedGenerator<bigint>) {
    let b = message

    // NOTE: discarding a seed here when the message M is odd-sized reduces the
    // collision risk between a message M` where M` is a subset of M
    // with M` = M - x, x being an arbitrary byte and M and M` are very similar
    if (message.byteLength & 1)
      seedGenerator.newSeed()

    while (b.byteLength >= sizeInBytes * SPD.DIMENSIONAL_FACTOR) {
      const oddness = b.byteLength & 1
      b = Buffer.from([
        ...this.transcoder().decode(b.subarray(0, b.byteLength - oddness)),
        ...(oddness ? [b[b.byteLength - 1]!] : [])])

      // NOTE: discarding a seed in a message decode step reduce the
      // collision risk between hashing a message M and M' with M` = decoded(M)
      seedGenerator.newSeed()
    }

    const extraBytes = b.byteLength - sizeInBytes
    const seedSizedBuffer = Buffer.from([
      ...this.transcoder().decode(b.subarray(0, extraBytes * SPD.DIMENSIONAL_FACTOR)),
      ...b.subarray(extraBytes * SPD.DIMENSIONAL_FACTOR)])

    return seedSizedBuffer
  }

  private encodeMessageUntilSizeInByte(message: Readonly<Buffer<ArrayBuffer>>,
    seedGenerator: SeedGenerator<bigint>, sizeInBytes: number): Readonly<Buffer<ArrayBuffer>> {
    const ratio = SPD.DIMENSIONAL_FACTOR + 1
    const recursiveThreshold = Math.floor(sizeInBytes / ratio)

    if (message.byteLength < recursiveThreshold) {
      const newBuffer = Buffer.from(Buffer.from(message).buffer.transfer(message.byteLength * ratio))
      const encoded = this.transcoder().encode(message, { seed: seedGenerator.newSeed() })
      newBuffer.set(message)
      newBuffer.set(encoded, message.byteLength)

      return this.encodeMessageUntilSizeInByte(newBuffer, seedGenerator, sizeInBytes)
    }

    const missingByteCount = sizeInBytes - message.byteLength
    const extraOddByte = missingByteCount & 1
    const newBuffer = Buffer.from(Buffer.from(message).buffer.transfer(message.byteLength + missingByteCount))

    const bufferByteCountToEncode = Math.floor(missingByteCount / SPD.DIMENSIONAL_FACTOR)
    const encoded = this.transcoder().encode(message.subarray(0, bufferByteCountToEncode), { seed: seedGenerator.newSeed() })
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
  private transcoder_?: Transcoder
  private domainPreludes: DomainPreludes

  private static SEED_SIZE = 8 as const
  private static BYTE_BITS = 8 as const
}

type HashBitSize = 64 | 128 | 256 | 512 | 1024

type Options = {
  seed?: bigint,
  hashBitSize?: HashBitSize
}

type DomainPreludes = {
  small: number,
  medium: number,
  big: number
}
