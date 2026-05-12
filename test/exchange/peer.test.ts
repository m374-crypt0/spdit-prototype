import { Initiator, Recipient } from "src/exchange"
import { Transcoder, SPD } from "src/transcoding"

import { describe, expect, it } from "bun:test"

describe('exchange test suite', () => {
  describe('peer test suite', () => {
    describe('initiator', () => {
      it('should produce well formed initiate exchange data', () => {
        const initiator = new Initiator('initiator')

        const { seed, encodedEntropySource } = initiator.initiateExchange()

        const highSPD = initiator.transcoder().decodeToHighSPD(encodedEntropySource)
        const encodedHighSPD = initiator.transcoder().encodeHighSPD(highSPD, { seed })

        expect(seed & ((1n << 64n) - 1n)).toBe(seed)
        expect(encodedHighSPD).toEqual(encodedEntropySource)
      })

      it('is not possible to generate initiate exchange data twice', () => {
        const initiator = new Initiator('initiator')

        initiator.initiateExchange()

        expect(() => initiator.initiateExchange())
          .toThrowError('invalid initiateExchange call')
      })

      it('cannot finalize the exchange without accepted exchange data', () => {
        const initiator = new Initiator('initiator')

        expect(() => initiator.finalizeExchange(Buffer.from('')))
          .toThrowError('invalid finalizeExchange call')
      })

      it('cannot finalize the eschange if the passed encoded payload is wrong', () => {
        const initiator = new Initiator('initiator')
        initiator.initiateExchange()

        expect(() => initiator.finalizeExchange(Buffer.from('')))
          .toThrowError('cannot finalize the exchange, invalid encoded payload size')
      })

      it('should finalize the exchange and provide an encoded high SPD', () => {
        // NOTE: sharing lowSPD ensure the algorithm is correct. Real world use
        // case will show initiator and recipient with very different low SPD
        const lowSPD = new SPD('low')
        const initiator = new Initiator('initiator', new Transcoder({ lowSPD }))
        const recipient = new Recipient('recipient', new Transcoder({ lowSPD }))
        const { seed, encodedEntropySource } = initiator.initiateExchange()
        const { encodedPayload } = recipient.acceptExchange(seed, encodedEntropySource)

        const { encodedHighSPD } = initiator.finalizeExchange(encodedPayload)

        expect(encodedHighSPD.byteLength).toBe(SPD.HIGH_SPD_SIZE * SPD.DIMENSIONAL_FACTOR)
      })
    })

    describe('recipient', () => {
      it('should generate well formed encoded payload from the initiate exchange data', () => {
        // NOTE: sharing lowSPD ensure the algorithm is correct. Real world use
        // case will show initiator and recipient with very different low SPD
        const lowSPD = new SPD('low')
        const initiator = new Initiator('initiator', new Transcoder({ lowSPD }))
        const recipient = new Recipient('recipient', new Transcoder({ lowSPD }))

        const { seed, encodedEntropySource } = initiator.initiateExchange()
        const { encodedPayload } = recipient.acceptExchange(seed, encodedEntropySource)

        expect(encodedPayload).toEqual(encodedEntropySource)
      })
    })
  })
})
