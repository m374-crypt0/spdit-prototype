import { Transcoder } from "src/transcoding"

export class Party {
  constructor(identifier: string, transcoder?: Transcoder) {
    this.identifier = identifier
    this.transcoder = transcoder ?? new Transcoder
  }

  readonly identifier: string
  readonly transcoder: Transcoder
}

export class Exchange {
  constructor(options: Options) {
    const { initiator, recipient } = options

    if (initiator.identifier === recipient.identifier)
      throw new Error('invalid exchange configuration, initialtor must be different from recipient')
  }

  state(): State {
    return 'not_started'
  }
}

type Options = {
  initiator: Party,
  recipient: Party
}

type State = 'not_started'
