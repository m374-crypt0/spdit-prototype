import { Exchange, Party, SPD } from "src/SPD";

import { describe, expect, it, xit } from "bun:test";
import { Transcoder } from "src/transcoding";

describe('SPD test suite', () => {
  describe('exchange instantiation', () => {
    it('should throw at initializing an exchange between an intiator and himself', () => {
      const initiator = new Party('alice')
      const recipient = new Party('bob')

      expect(() => new Exchange({ initiator, recipient: initiator }))
        .toThrowError('invalid exchange configuration, initialtor must be different from recipient')

      expect(() => new Exchange({ initiator, recipient })).not.toThrow()
    })

    describe('exchange flow', () => {
      const initiator = new Party('alice')
      const recipient = new Party('bob')

      it('should report the state of an exchange as not_started when instantiated', () => {
        const exchange = new Exchange({ initiator, recipient })

        expect(exchange.state()).toBe('not_started')
      })

      it('should refuse to transition to initiating with wrong entropy source', () => {
        const seed = 42n
        const entropy = new SPD('low')
        const exchange = new Exchange({ initiator, recipient })

        expect(() => exchange.initiate(seed, entropy))
          .toThrowError('insufficient entropy, only \'high\' type SPD are supported')
      })

      it('should transition from not_started to initiating', () => {
        const seed = 42n
        const entropy = new SPD('high')
        const exchange = new Exchange({ initiator, recipient })

        exchange.initiate(seed, entropy)

        expect(exchange.state()).toBe('initiating')
      })

      it('should throw if initiate is called while state is already initiating', () => {
        const seed = 42n
        const entropy = new SPD('high')
        const exchange = new Exchange({ initiator, recipient })

        exchange.initiate(seed, entropy)

        expect(() => exchange.initiate(seed + 1n, entropy))
          .toThrowError('invalid initiate call, exchange has already been initiated')
      })
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

