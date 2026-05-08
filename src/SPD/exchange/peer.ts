import { SplitMix64 } from "src/stochastic"
import { Transcoder } from "src/transcoding"
import { SPD } from "../create"

export class Peer {
  constructor(identifier: string, transcoder?: Transcoder) {
    this.identifier = identifier
    this.transcoder = transcoder ?? new Transcoder
  }

  generateInitiateExchangeData(): InitiateExchangeData {
    const seed = new SplitMix64().state()

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

  reconstructLowSPD() { }

  generateFinalizeExchangeData() { }

  readonly identifier: string
  readonly transcoder: Transcoder
}

type InitiateExchangeData = {
  seed: bigint,
  encodedEntropySource: Readonly<Buffer<ArrayBuffer>>
}

type InitiateExchangeResult = {
  encodedPayload: Readonly<Buffer<ArrayBuffer>>
}
