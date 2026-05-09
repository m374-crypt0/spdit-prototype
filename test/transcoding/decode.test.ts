import { Transcoder } from "src/transcoding";
import { SPD } from "src/SPD";

import { describe, expect, it } from "bun:test";

describe('decoding test suite', () => {
  describe('high SPD decoding', () => {
    it('should fail if decodeHighSPD is used with a wrong sized buffer', () => {
      const b = Buffer.alloc(32 * 1024)
      const xCoder = new Transcoder

      expect(() => xCoder.decodeToHighSPD(b))
        .toThrowError('invalid buffer, likely not an encoded high SPD')
    })

    it('should output well sized decoded content', () => {
      const xCoder = new Transcoder

      const b = Buffer.from(new ArrayBuffer(SPD.HIGH_SPD_SIZE * SPD.DIMENSIONAL_FACTOR))
      const decoded = xCoder.decodeToHighSPD(b)

      expect(decoded.readonlyBufferView().byteLength).toEqual(SPD.HIGH_SPD_SIZE)
    })
  })

  describe('arbitrary data decoding', () => {
    it('should decode to empty data with empty encoded data', () => {
      const xCoder = new Transcoder
      const encodedData = Buffer.from(new ArrayBuffer(0))

      const decoded = xCoder.decode(encodedData)

      expect(decoded).toEqual(encodedData)
    })

    it('should fail to decode data whose size is not divisible by dimensional factor', () => {
      const xCoder = new Transcoder
      const encodedData = Buffer.from('123')

      expect(() => xCoder.decode(encodedData))
        .toThrowError('invalid encoded data')
    })

    it('should output well sized decoded data according to the dimensional factor', () => {
      const xCoder = new Transcoder
      const encodedData = Buffer.from('1234')

      const decoded = xCoder.decode(encodedData)

      expect(decoded.byteLength).toBe(encodedData.byteLength / SPD.DIMENSIONAL_FACTOR)
    })
  })
})
