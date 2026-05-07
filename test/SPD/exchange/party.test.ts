import { Party } from "src/SPD";
import { Transcoder } from "src/transcoding";

import { describe, expect, it } from "bun:test";

describe('SPD test suite', () => {
  describe('exchange test suite', () => {
    describe('party test suite', () => {
      it('should construct a party with an optional transcoder and always have a default transcoder in any case', () => {
        const alice = new Party('alice', new Transcoder)
        const bob = new Party('bob')

        expect(alice.transcoder).not.toBeUndefined()
        expect(bob.transcoder).not.toBeUndefined()
      })

      it('should produce well formed exchange data', () => {
        const initiator = new Party('initiator')

        const { seed, encodedEntropySource } = initiator.computeInitiateExchangeData()

        expect(seed & ((1n << 64n) - 1n)).toBe(seed)
        expect(encodedEntropySource.byteLength).toBe(1 << 16)
      })
    })
  })
})

