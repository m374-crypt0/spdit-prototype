import { Peer, SPD } from "src/SPD";
import { Transcoder } from "src/transcoding";

import { describe, expect, it } from "bun:test";

describe('SPD test suite', () => {
  describe('exchange test suite', () => {
    describe('peer test suite', () => {
      it('should construct a peer with an optional transcoder and always have a default transcoder in any case', () => {
        const alice = new Peer('alice', new Transcoder)
        const bob = new Peer('bob')

        expect(alice.transcoder).not.toBeUndefined()
        expect(bob.transcoder).not.toBeUndefined()
      })

      it('should produce well formed exchange data', () => {
        const initiator = new Peer('initiator')

        const { seed, encodedEntropySource } = initiator.generateInitiateExchangeData()

        expect(seed & ((1n << 64n) - 1n)).toBe(seed)
        expect(encodedEntropySource.byteLength).toBe(1 << 16)
      })

      it('should produce well formed encoded payload', () => {
        const initiator = new Peer('initiator')
        const recipient = new Peer('recipient')

        const { seed, encodedEntropySource } = initiator.generateInitiateExchangeData()
        const { encodedPayload } = recipient.generateEncodedPayload(seed, encodedEntropySource)

        expect(encodedPayload.byteLength).toBe(SPD.DIMENSIONAL_FACTOR * SPD.HIGH_SPD_SIZE)
      })
    })
  })
})

