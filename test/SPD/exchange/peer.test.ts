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

      it('should produce well formed initiate exchange data', () => {
        const initiator = new Peer('initiator')

        const { seed, encodedEntropySource } = initiator.generateInitiateExchangeData()

        const highSPD = initiator.transcoder.decodeToHighSPD(encodedEntropySource)
        const encodedHighSPD = initiator.transcoder.encodeHighSPD(highSPD, { seed })

        expect(seed & ((1n << 64n) - 1n)).toBe(seed)
        expect(encodedHighSPD).toEqual(encodedEntropySource)
      })

      it('is not possible to generate initiate exchange data twice', () => {
        const initiator = new Peer('initiator')

        initiator.generateInitiateExchangeData()

        expect(() => initiator.generateInitiateExchangeData())
          .toThrowError('invalid generateInitiateExchangeData call')
      })

      it('should generate well formed encoded payload from the initiate exchange data', () => {
        // NOTE: sharing lowSPD ensure the algorithm is correct. Real world use
        // case will show initiator and recipient with very different low SPD
        const lowSPD = new SPD('low')
        const initiator = new Peer('initiator', new Transcoder({ lowSPD }))
        const recipient = new Peer('recipient', new Transcoder({ lowSPD }))

        const { seed, encodedEntropySource } = initiator.generateInitiateExchangeData()
        const { encodedPayload } = recipient.generateEncodedPayload(seed, encodedEntropySource)

        expect(encodedPayload).toEqual(encodedEntropySource)
      })

      it('cannot rebuild low SPD if exchange has not been initiated', () => {
        const initiator = new Peer('initiator')

        expect(() => initiator.reconstructLowSPD())
          .toThrowError('cannot reconstruct low SPD, missing seed or encoded payload data')

        initiator.generateInitiateExchangeData()

        expect(() => initiator.reconstructLowSPD())
          .toThrowError('cannot reconstruct low SPD, missing seed or encoded payload data')
      })
    })
  })
})

