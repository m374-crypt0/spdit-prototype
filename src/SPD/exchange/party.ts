import { Transcoder } from "src/transcoding"

export class Party {
  constructor(identifier: string, transcoder?: Transcoder) {
    this.identifier = identifier
    this.transcoder = transcoder ?? new Transcoder
  }

  initiateExchangeWith(recipient: Party) { }

  readonly identifier: string
  readonly transcoder: Transcoder
}

