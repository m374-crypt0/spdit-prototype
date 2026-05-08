import type { Peer } from "./"

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
        const { encodedEntropySource, seed } = this.initiator.generateInitiateExchangeData()
        const { encodedPayload } = this.recipient.generateEncodedPayload(seed, encodedEntropySource)

        this.encodedPayload = encodedPayload
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
        this.initiator.reconstructLowSPD(this.encodedPayload!)
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
        const { encodedHighSPD } = this.initiator.generateFinalizeExchangeData()
        this.recipient.acceptEncodedHighSPD(encodedHighSPD)
        this.encodedHighSPD = encodedHighSPD
        this.state_ = 'finalized'

        resolve()
      })
    })
  }

  hello() {
    throw new Error('invalid hello call')
  }

  private state_: State
  private initiator: Peer
  private recipient: Peer
  private encodedPayload?: Readonly<Buffer<ArrayBuffer>>
  private encodedHighSPD?: Readonly<Buffer<ArrayBuffer>>
}

type Options = {
  initiator: Peer,
  recipient: Peer
}

type State = 'not_started' | 'initiating' | 'initiated' | 'computing' | 'ready' | 'finalizing' | 'finalized'
