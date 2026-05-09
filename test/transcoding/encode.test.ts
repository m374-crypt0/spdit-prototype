import { Transcoder } from "src/transcoding";

import { describe, expect, it } from "bun:test";
import { SPD } from "src/SPD";
import { SplitMix64 } from "src/stochastic";

describe('encoding test suite', () => {
  describe('high SPD encoding', () => {
    it('should fail if encodeHighSPD is used with a low type SPD', () => {
      const spd = new SPD('low')
      const xCoder = new Transcoder

      expect(() => xCoder.encodeHighSPD(spd)).toThrowError('only high SPD can be encoded')
    })

    it('should encode a high SPD giving a well sized buffer according the dimensional factor', () => {
      const spd = new SPD('high')
      const xCoder = new Transcoder

      const b = xCoder.encodeHighSPD(spd)

      expect(b.byteLength).toBe(SPD.DIMENSIONAL_FACTOR * spd.size)
    })

    it('should output different encoded high SPD each time for unseeded encoding', () => {
      const spd = new SPD('high')
      const xCoder = new Transcoder

      const b1 = xCoder.encodeHighSPD(spd)
      const b2 = xCoder.encodeHighSPD(spd)

      expect(b1).not.toEqual(b2)
    })

    it('should output the same encoding content each time for seeded encoding', () => {
      const spd = new SPD('high')
      const xCoder = new Transcoder
      const seed = new SplitMix64().state()

      const b1 = xCoder.encodeHighSPD(spd, { seed })
      const b2 = xCoder.encodeHighSPD(spd, { seed })

      expect(b1).toEqual(b2)
    })
  })

  describe('arbitrary data encoding', () => {
    it('should encode empty data to empty output', () => {
      const xCoder = new Transcoder
      const data = Buffer.from(new ArrayBuffer(0))

      expect(xCoder.encode(data)).toEqual(data)
    })

    it('should encode non empty data to well sized buffer according to dimensional factor', () => {
      const xCoder = new Transcoder
      const data = Buffer.from('data')

      const encoded = xCoder.encode(data)

      expect(encoded.byteLength).toBe(data.byteLength * SPD.DIMENSIONAL_FACTOR)
    })
  })
})

