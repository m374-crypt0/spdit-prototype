import { Transcoder } from "src/transcoding"
import { SPD } from "./create"

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

    this.state_ = 'not_started'
  }

  state(): State {
    return this.state_
  }

  initiate(seed: bigint, entropy: SPD) {
    if (entropy.laneSize === SPD.LOW_LANE_SIZE)
      throw new Error('insufficient entropy, only \'high\' type SPD are supported')

    if (this.state_ !== 'not_started')
      throw new Error('invalid initiate call, exchange has already been initiated')

    this.state_ = 'initiating'
  }

  private state_: State
}

type Options = {
  initiator: Party,
  recipient: Party
}

type State = 'not_started' | 'initiating'
