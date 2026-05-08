import { resolve } from "bun"
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

  initiate() {
    if (this.state_ !== 'not_started')
      throw new Error('invalid initiate call')

    this.state_ = 'initiating'

    return new Promise<void>(resolve => {
      // NOTE: Forces to wait the next turn of the event loop to simulate an
      // eventual settle of this promise
      setImmediate(() => {
        const { encodedEntropySource, seed } = this.initiator.computeInitiateExchangeData()
        this.recipient.initiateExchange(seed, encodedEntropySource)
        this.state_ = 'initiated'
        resolve()
      })
    })
  }

  compute() {
    if (this.state_ !== 'initiated')
      throw new Error('invalid compute call')

    this.state_ = 'computing'

    return new Promise<void>(resolve => {
      // NOTE: Forces to wait the next turn of the event loop to simulate an
      // eventual settle of this promise
      setImmediate(() => {
        this.initiator.computeLowSPDFromEncodedPayload()
        this.state_ = 'ready'

        resolve()
      })
    })
  }

  finalize() {
    if (this.state_ !== 'ready')
      throw new Error('invalid finalize call')

    this.state_ = 'finalizing'

    return new Promise<void>(resolve => {
      setImmediate(() => {
        this.recipient.finalizeExchange()
        this.state_ = 'finalized'

        resolve()
      })
    })
  }

  private state_: State
  private initiator: Party
  private recipient: Party
}

type Options = {
  initiator: Party,
  recipient: Party
}

type State = 'not_started' | 'initiating' | 'initiated' | 'computing' | 'ready' | 'finalizing' | 'finalized'
