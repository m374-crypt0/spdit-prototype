import { Transcoder } from "src/transcoding"

export class Party {
  constructor(identifier: string, transcoder?: Transcoder) {
    this.identifier = identifier
    this.transcoder = transcoder ?? new Transcoder
  }

  async initiateExchangeWith(recipient: Party) { }

  readonly identifier: string
  readonly transcoder: Transcoder
}

