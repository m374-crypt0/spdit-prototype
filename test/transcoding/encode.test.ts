import { Transcoder } from "src/transcoding";

import { describe, expect, it } from "bun:test";
import { SPD } from "src/SPD";

describe('encoding test suite', () => {
  describe('High SPD encoding', () => {
    it('should fail if encodeHighSPD is used with a low type SPD', () => {
      const spd = new SPD('low')
      const xCoder = new Transcoder

      expect(() => xCoder.encodeHighSPD(spd)).toThrowError('only high SPD can be encoded')
    })

    it('should encode a high SPD giving a buffer that is different and 2 time bigger than the spd itself', () => {
      const spd = new SPD('high')
      const xCoder = new Transcoder

      const b = xCoder.encodeHighSPD(spd)

      expect(b.byteLength).toBe(2 * spd.size)
    })
  })
})

