import { Exchange, Party } from "src/SPD";

import { describe, expect, it } from "bun:test";
import { Transcoder } from "src/transcoding";

describe('SPD test suite', () => {
  describe('exchange', () => {
    it('should throw at initializing an exchange between an intiator and himself', () => {
      const initiator = new Party('alice')
      const recipient = new Party('bob')

      expect(() => new Exchange({ initiator, recipient: initiator }))
        .toThrowError('invalid exchange configuration, initialtor must be different from recipient')

      expect(() => new Exchange({ initiator, recipient })).not.toThrow()
    })

    it('should report the state of an exchange as not_started when instantiated', () => {
      const initiator = new Party('alice')
      const recipient = new Party('bob')
      const exchange = new Exchange({ initiator, recipient })

      expect(exchange.state()).toBe('not_started')
    })
  })

  describe('Parties', () => {
    it('should construct a party with an optional transcoder and always have a default transcoder in any case', () => {
      const alice = new Party('alice', new Transcoder)
      const bob = new Party('bob')

      expect(alice).toHaveProperty('transcoder')
      expect(bob).toHaveProperty('transcoder')
    })
  })
})

