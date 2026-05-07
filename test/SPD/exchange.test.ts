import { Exchange, Party } from "src/SPD";

import { describe, expect, it } from "bun:test";
import { Transcoder } from "src/transcoding";

describe('SPD test suite', () => {
  describe('exchange', () => {
    it('should throw at initializing an exchange between an intiator and himself', () => {
      const initiator = new Party('alice')
      const recipient = new Party('alice')

      expect(() => new Exchange({ initiator, recipient }))
        .toThrowError('invalid exchange configuration, initialtor must be different from recipient')
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

