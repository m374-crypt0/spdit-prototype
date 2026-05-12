import { SplitMix64, UniformUint64 } from "src/stochastic"
import { Transcoder } from "src/transcoding"
import { SPD } from "../transcoding/SPD"
import { Terminal } from "bun"

abstract class Peer {
  constructor(identifier: string, transcoder?: Transcoder) {
    this.identifier = identifier
    this.transcoder_ = transcoder ?? new Transcoder
  }

  transcoder(): Readonly<Transcoder> {
    return this.transcoder_
  }

  protected decodeNewSeed(encodedSeed: Readonly<Buffer<ArrayBuffer>>): bigint {
    // NOTE: this algorithm is very similar (if not almost identical) to decode
    // a high SPD using a low SPD but more relaxed on error cases
    // The duplication is intentional
    const lowSpd = this.transcoder_.lowSPD().readonlyBufferView()
    const seedBuffer = Buffer.from(new ArrayBuffer(encodedSeed.byteLength / 2))

    seedBuffer.forEach((_, index) => {
      const i = index * SPD.DIMENSIONAL_FACTOR

      const lowAddress = encodedSeed[i]!
      const highAddress = encodedSeed[i + 1]!

      const lowNibble = lowSpd[lowAddress]!
      const highNibble = lowSpd[highAddress]!
      const byte = (highNibble << 4) | lowNibble

      seedBuffer[index] = byte
    })

    return BigInt(`0x${seedBuffer.toHex()}`)
  }

  readonly identifier: string

  protected transcoder_: Transcoder
}

export class Initiator extends Peer {
  constructor(identifier: string, transcoder?: Transcoder) {
    super(identifier, transcoder)
  }

  initiateExchange(): InitiateExchangeData {
    if (this.seed)
      throw new Error('invalid initiateExchange call')

    const seed = new SplitMix64().state()
    const encodedEntropySource = this.transcoder_.encodeHighSPD(new SPD('high'), { seed })

    this.seed = seed
    this.encodedEntropySource = encodedEntropySource

    return {
      seed,
      encodedEntropySource
    }
  }

  finalizeExchange(encodedPayload: Readonly<Buffer<ArrayBuffer>>): FinalizeExchangeResult {
    if (!this.seed || !this.encodedEntropySource)
      throw new Error('invalid finalizeExchange call')

    if (encodedPayload.byteLength !== SPD.HIGH_SPD_SIZE * SPD.DIMENSIONAL_FACTOR)
      throw new Error('cannot finalize the exchange, invalid encoded payload size')

    const commonAlphabet = this.computeCommonAlphabet(encodedPayload)
    const { seed, encodedSeed } = this.computeNewSeed(commonAlphabet)
    const lowSPD = new SPD('low', { kind: 'seed', seed })

    this.transcoder_ = new Transcoder({ lowSPD })

    const highSPD = this.transcoder_.highSPD()
    const encodedHighSPD = this.transcoder_.encodeHighSPD(highSPD)

    // NOTE: discard one-time use low SPD
    // - crucially important for security as it has been deterministically
    //   created
    this.transcoder_ = new Transcoder({ highSPD })

    return { encodedSeed, encodedHighSPD }
  }

  private computeCommonAlphabet(encodedPayload: Readonly<Buffer<ArrayBuffer>>): CommonAlphabet {
    // NOTE: Similar to a partial decoding low SPD
    const commonAlphabet = new Map<Nibble, Set<Address>>

    const lowSPDBuffer = this.transcoder_.lowSPD().readonlyBufferView()

    for (let i = 0; i < encodedPayload.byteLength; ++i) {
      const payloadAddress = encodedPayload[i]!
      const entropyAddress = this.encodedEntropySource![i]!

      // NOTE: payload and entropy have been encoded using the same seed
      // therefore, same address at the same position means same nibble in
      // the low SPD of the initiator and the recipient
      if (payloadAddress === entropyAddress) {
        const nibble = lowSPDBuffer[payloadAddress]!

        if (commonAlphabet.has(nibble))
          commonAlphabet.get(nibble)?.add(entropyAddress)
        else
          commonAlphabet.set(nibble, new Set<Address>([entropyAddress]))
      }

      // NOTE: Ensures the address set is big-enough to scramble the seed value
      // through encoding. Two cases here:
      // - initiator and recipient low SPD are the same (discouraged and un-useful for exchange scenario)
      //   - the common alphabet is likely to be complete soon with few addresses
      //   - forcing a minimum match count mitigates this effect
      // - initiator and recipient do not share the same low SPD (nominal case):
      //   - forcing match count is unnecessary as a very large portion (if not
      //     all) the encoded payload must be read
      if (commonAlphabet.size === SPD.LOW_LANE_SIZE)
        break
    }

    return commonAlphabet
  }

  computeNewSeed(commonAlphabet: CommonAlphabet): SeedResult {
    // compute a new seed
    // - using all addresses from the common alphabet
    // - select randomly 16 addresses -> 16 nibbles -> 8 bytes -> 64 bits
    // - multiple encoding is not possible due to restricted alphabet

    // NOTE: flattens all addresses for random selection later on
    const addresses = commonAlphabet.values()
      .reduce((acc, set) =>
        [...acc, ...set.values().toArray()], new Array<number>)

    // NOTE: byte size of a seed produced by the stochastic component
    const seedSize = 8

    // NOTE: select enough address representing an encoded seed in the common
    // alphabet
    const d = new UniformUint64
    const encodedSeed = Buffer.from(
      Array.from({ length: seedSize * SPD.DIMENSIONAL_FACTOR }, () =>
        addresses[Number(d.newUint([0n, BigInt(addresses.length - 1)]))]!))

    return {
      seed: this.decodeNewSeed(encodedSeed),
      encodedSeed
    }
  }

  private seed?: bigint
  private encodedEntropySource?: Buffer<ArrayBuffer>
}

export class Recipient extends Peer {
  constructor(identifier: string, transcoder?: Transcoder) {
    super(identifier, transcoder)
  }

  acceptExchange(seed: bigint, encodedEntropySource: Readonly<Buffer<ArrayBuffer>>): InitiateExchangeResult {
    const payload = this.transcoder_.decodeToHighSPD(encodedEntropySource)
    const encodedPayload = this.transcoder_.encodeHighSPD(payload, { seed })

    return { encodedPayload }
  }

  finalizeExchange(data: FinalizeExchangeResult) {
    const { encodedSeed, encodedHighSPD } = data
    const seed = this.decodeNewSeed(encodedSeed)
    const lowSPD = new SPD('low', { kind: 'seed', seed })

    this.transcoder_ = new Transcoder({ lowSPD })

    const highSPD = this.transcoder_.decodeToHighSPD(encodedHighSPD)

    this.transcoder_ = new Transcoder({ highSPD })
  }
}

type InitiateExchangeData = {
  seed: bigint,
  encodedEntropySource: Readonly<Buffer<ArrayBuffer>>
}

type InitiateExchangeResult = {
  encodedPayload: Readonly<Buffer<ArrayBuffer>>
}

type FinalizeExchangeResult = {
  encodedSeed: Readonly<Buffer<ArrayBuffer>>,
  encodedHighSPD: Readonly<Buffer<ArrayBuffer>>
}

type Address = number
type Nibble = number
type CommonAlphabet = Map<Nibble, Set<Address>>

type SeedResult = {
  seed: bigint,
  encodedSeed: Readonly<Buffer<ArrayBuffer>>
}
