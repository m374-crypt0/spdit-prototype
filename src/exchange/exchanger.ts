import type { Initiator, Recipient } from "./peers";

export class Exchanger {
  constructor(options: ExchangerOptions) {
    if (options.recipient.identifier === options.initiator.identifier)
      throw new Error('invalid peers specified')

    this.state_ = 'not_started'
    this.initiator = options.initiator
    this.recipient = options.recipient
  }

  state() {
    return this.state_
  }

  initiate() {
    if (this.state_ !== 'not_started')
      throw new Error('invalid initiate call')

    const { seed, encodedEntropySource } = this.initiator.initiateExchange()

    this.state_ = 'initiated'
    this.seed = seed
    this.encodedEntropySource = encodedEntropySource
  }

  accept() {
    if (this.state_ !== 'initiated' || this.seed === undefined || this.encodedEntropySource === undefined)
      throw new Error('invalid accept call')

    const { encodedPayload } = this.recipient.acceptExchange(this.seed, this.encodedEntropySource)

    this.encodedPayload = encodedPayload
    this.state_ = 'accepted'
  }

  finalize() {
    if (this.encodedPayload === undefined || this.state_ !== 'accepted')
      throw new Error('invalid finalize call')

    const { encodedHighSPD } = this.initiator.finalizeExchange(this.encodedPayload)
    this.recipient.finalizeExchange(encodedHighSPD)

    this.state_ = 'finalized'
  }

  private state_: ExchangerState
  private initiator: Initiator
  private recipient: Recipient
  private seed?: bigint
  private encodedEntropySource?: Readonly<Buffer<ArrayBuffer>>
  private encodedPayload?: Readonly<Buffer<ArrayBuffer>>
}

type ExchangerOptions = {
  initiator: Initiator,
  recipient: Recipient
}

type ExchangerState =
  'not_started' | 'initiated' | 'accepted' | 'finalized'
