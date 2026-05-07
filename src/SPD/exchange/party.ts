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

  initiateExchange() { }

  readonly identifier: string
  readonly transcoder: Transcoder
}

type InitiateExchangeData = {
  seed: bigint,
  encodedEntropySource: Readonly<Buffer<ArrayBuffer>>
}
