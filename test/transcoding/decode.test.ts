import { Transcoder } from "src/transcoding";

import { describe, expect, it, xit } from "bun:test";
import { SPD } from "src/SPD";

describe('decoding test suite', () => {
  describe('High SPD decoding', () => {
    it('should fail if decodeHighSPD is used with a wrong sized buffer', () => {
      const b = Buffer.alloc(32 * 1024)
      const xCoder = new Transcoder

      expect(() => xCoder.decodeToHighSPD(b))
        .toThrowError('invalid buffer, likely not an encoded high SPD')
    })

    it('should succeed in decoded a previously encoded high SPD', () => {
      const spd = new SPD('high')
      const xCoder = new Transcoder

      const b = xCoder.encodeHighSPD(spd)
      const decodedSPD = xCoder.decodeToHighSPD(b)

      expect(decodedSPD.readonlyBufferView()).toEqual(spd.readonlyBufferView())
    })
  })
})
