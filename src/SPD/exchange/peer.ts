import { SplitMix64 } from "src/stochastic"
import { Transcoder } from "src/transcoding"
import { SPD } from "../create"

export class Peer {
  constructor(identifier: string, transcoder?: Transcoder) {
    this.identifier = identifier
    this.transcoder_ = transcoder ?? new Transcoder
  }

  transcoder(): Readonly<Transcoder> {
    return this.transcoder_
  }

  generateInitiateExchangeData(): InitiateExchangeData {
    if (this.seed)
      throw new Error('invalid generateInitiateExchangeData call')

    const seed = new SplitMix64().state()
    this.seed = seed

    return {
      seed,
      encodedEntropySource: this.transcoder_.encodeHighSPD(new SPD('high'), { seed })
    }
  }

  generateEncodedPayload(seed: bigint, encodedEntropySource: Readonly<Buffer<ArrayBuffer>>): InitiateExchangeResult {
    const payload = this.transcoder_.decodeToHighSPD(encodedEntropySource)
    const encodedPayload = this.transcoder_.encodeHighSPD(payload, { seed })

    return { encodedPayload }
  }

  reconstructLowSPD(encodedPayload: Readonly<Buffer<ArrayBuffer>>) {
    if (!this.seed)
      throw new Error('cannot reconstruct low SPD before exchange initiate data generation')

    if (encodedPayload.byteLength !== SPD.HIGH_SPD_SIZE * SPD.DIMENSIONAL_FACTOR)
      throw new Error('cannot reconstruct low SPD, invalid encoded payload size')
  }

  generateFinalizeExchangeData(): FinalizeExchangeResult {
    return { encodedHighSPD: Buffer.from(new ArrayBuffer(SPD.DIMENSIONAL_FACTOR * SPD.HIGH_SPD_SIZE)) }
  }

  acceptEncodedHighSPD(encodedHighSPD: Readonly<Buffer<ArrayBuffer>>) { }

  readonly identifier: string

  private transcoder_: Transcoder
  private seed?: bigint
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
