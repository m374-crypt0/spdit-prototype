import { SplitMix64 } from "src/stochastic"
import { Transcoder } from "src/transcoding"
import { SPD } from "../create"

export class Party {
  constructor(identifier: string, transcoder?: Transcoder) {
    this.identifier = identifier
    this.transcoder = transcoder ?? new Transcoder
  }

  computeInitiateExchangeData(): InitiateExchangeData {
    return {
      seed: new SplitMix64().state(),
      encodedEntropySource: new SPD('high').readonlyBufferView()
    }
  }

  initiateExchange(seed: bigint, encodedEntropySource: Readonly<Buffer<ArrayBuffer>>): InitiateExchangeResult {
    return { encodedPayload: Buffer.from(new ArrayBuffer(2 * 1 << 16)) }
  }

  computeLowSPDFromEncodedPayload() { }

  finalizeExchange() { }

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
