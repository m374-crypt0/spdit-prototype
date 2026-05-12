import { Transcoder, SPD } from "src/transcoding";

import { describe, expect, it } from "bun:test";

describe('transcoding test suite', () => {
  describe('Transcoder instantiation', () => {
    it('should not be able to instantiate with 2 instances of SPD of same type', () => {
      const spdLow = new SPD('low')
      const spdHigh = new SPD('high')

      expect(() => new Transcoder({ highSPD: spdLow, lowSPD: spdLow }))
        .toThrowError('invalid high SPD specified')

      expect(() => new Transcoder({ highSPD: spdHigh, lowSPD: spdHigh }))
        .toThrowError('invalid low SPD specified')
    })

    it('should be able to instantiate with 1 or 2 instances of SPD (high or low)', () => {
      const lowSPD = new SPD('low')
      const highSPD = new SPD('high')

      expect(() => new Transcoder({ highSPD, lowSPD })).not.toThrow()
      expect(() => new Transcoder({ highSPD })).not.toThrow()
      expect(() => new Transcoder({ lowSPD })).not.toThrow()
    })
  })
})

