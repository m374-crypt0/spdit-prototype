import { SplitMix64 } from "src/stochastic"
import { Transcoder } from "src/transcoding"
import { SPD } from "../transcoding/SPD"

abstract class Peer {
  constructor(identifier: string, transcoder?: Transcoder) {
    this.identifier = identifier
    this.transcoder_ = transcoder ?? new Transcoder
  }

  transcoder(): Readonly<Transcoder> {
    return this.transcoder_
  }

  readonly identifier: string

  protected transcoder_: Transcoder
}

export class Initiator extends Peer {
  constructor(identifier: string, transcoder?: Transcoder) {
    super(identifier, transcoder)
  }

  generateInitiateExchangeData(): InitiateExchangeData {
    if (this.seed)
      throw new Error('invalid generateInitiateExchangeData call')

    const seed = new SplitMix64().state()
    const encodedEntropySource = this.transcoder_.encodeHighSPD(new SPD('high'), { seed })

    this.seed = seed
    this.encodedEntropySource = encodedEntropySource

    return {
      seed,
      encodedEntropySource
    }
  }

  reconstructLowSPD(encodedPayload: Readonly<Buffer<ArrayBuffer>>) {
    if (!this.seed || !this.encodedEntropySource)
      throw new Error('cannot reconstruct low SPD before exchange initiate data generation')

    if (encodedPayload.byteLength !== SPD.HIGH_SPD_SIZE * SPD.DIMENSIONAL_FACTOR)
      throw new Error('cannot reconstruct low SPD, invalid encoded payload size')

    // NOTE: specific case where initiator and recipient share the same low SPD
    if (encodedPayload.compare(this.encodedEntropySource) === 0)
      this.transcoder_ = new Transcoder({
        lowSPD: this.transcoder_.lowSPD(),
        highSPD: this.transcoder_.highSPD()
      })
  }

  generateFinalizeExchangeData(): FinalizeExchangeResult {
    const highSPD = new SPD('high')
    const encodedHighSPD = this.transcoder_.encodeHighSPD(highSPD)

    this.transcoder_ = new Transcoder({
      highSPD,
      lowSPD: this.transcoder_.lowSPD()
    })

    return { encodedHighSPD }
  }

  private seed?: bigint
  private encodedEntropySource?: Buffer<ArrayBuffer>
}

export class Recipient extends Peer {
  constructor(identifier: string, transcoder?: Transcoder) {
    super(identifier, transcoder)
  }

  generateEncodedPayload(seed: bigint, encodedEntropySource: Readonly<Buffer<ArrayBuffer>>): InitiateExchangeResult {
    const payload = this.transcoder_.decodeToHighSPD(encodedEntropySource)
    const encodedPayload = this.transcoder_.encodeHighSPD(payload, { seed })

    return { encodedPayload }
  }

  acceptEncodedHighSPD(encodedHighSPD: Readonly<Buffer<ArrayBuffer>>) {
    this.transcoder_ = new Transcoder({
      highSPD: this.transcoder_.decodeToHighSPD(encodedHighSPD),
      lowSPD: this.transcoder_.lowSPD()
    })
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
  encodedHighSPD: Readonly<Buffer<ArrayBuffer>>
}

