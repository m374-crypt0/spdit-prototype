import type { Party } from "./"

export class Exchanger {
  constructor(options: Options) {
    const { initiator, recipient } = options

    if (initiator.identifier === recipient.identifier)
      throw new Error('invalid exchange configuration, initiator must be different from recipient')

    this.initiator = initiator
    this.recipient = recipient

    this.state_ = 'not_started'
  }

  state(): State {
    return this.state_
  }

  async initiate() {
    if (this.state_ !== 'not_started')
      throw new Error('invalid initiate call')

    this.initiator.computeInitiateExchangeData()
    this.recipient.initiateExchange()


    this.state_ = 'initiating'
  }

  private state_: State
  private initiator: Party
  private recipient: Party
}

type Options = {
  initiator: Party,
  recipient: Party
}

type State = 'not_started' | 'initiating'
