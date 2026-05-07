import { Transcoder } from "src/transcoding"

export class Party {
  constructor(identifier: string, transcoder?: Transcoder) {
    this.identifier = identifier
    this.transcoder = transcoder ?? new Transcoder
  }

  computeInitiateExchangeData() { }
  initiateExchange() { }

  readonly identifier: string
  readonly transcoder: Transcoder
}

