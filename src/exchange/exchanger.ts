import type { Initiator, Recipient } from "./peers";

export class Exchanger {
  constructor(options: ExchangerOptions) {
    if (options.recipient.identifier === options.initiator.identifier)
      throw new Error('invalid peers specified')
  }

  state() {
    return 'not_started'
  }
}

type ExchangerOptions = {
  initiator: Initiator,
  recipient: Recipient
}
