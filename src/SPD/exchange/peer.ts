import { SplitMix64 } from "src/stochastic"
import { Transcoder } from "src/transcoding"
import { SPD } from "../create"

export class Peer {
  constructor(identifier: string, transcoder?: Transcoder) {
    this.identifier = identifier
    this.transcoder = transcoder ?? new Transcoder
  }

  generateInitiateExchangeData(): InitiateExchangeData {
    if (this.seed)
      throw new Error('invalid generateInitiateExchangeData call')

    const seed = new SplitMix64().state()
    this.seed = seed

    return {
      seed,
      encodedEntropySource: this.transcoder.encodeHighSPD(new SPD('high'), { seed })
    }
  }

  generateEncodedPayload(seed: bigint, encodedEntropySource: Readonly<Buffer<ArrayBuffer>>): InitiateExchangeResult {
    const payload = this.transcoder.decodeToHighSPD(encodedEntropySource)
    const encodedPayload = this.transcoder.encodeHighSPD(payload, { seed })

    return { encodedPayload }
  }

  reconstructLowSPD(encodedPayload: Readonly<Buffer<ArrayBuffer>>) {
    if (!this.seed)
      throw new Error('cannot reconstruct low SPD before exchange initiate data generation')

    if (encodedPayload.byteLength !== SPD.HIGH_SPD_SIZE * SPD.DIMENSIONAL_FACTOR)
      throw new Error('cannot reconstruct low SPD, invalid encoded payload size')
  }

  generateFinalizeExchangeData(): Readonly<Buffer<ArrayBuffer>> {
    return Buffer.from(new ArrayBuffer(SPD.DIMENSIONAL_FACTOR * SPD.HIGH_SPD_SIZE))
  }

  readonly identifier: string
  readonly transcoder: Transcoder

  private seed?: bigint
}

type InitiateExchangeData = {
  seed: bigint,
  encodedEntropySource: Readonly<Buffer<ArrayBuffer>>
}

type InitiateExchangeResult = {
  encodedPayload: Readonly<Buffer<ArrayBuffer>>
}
