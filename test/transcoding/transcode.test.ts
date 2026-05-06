import { Transcoder } from "src/transcoding";

import { describe, expect, it } from "bun:test";
import { SPD } from "src/SPD";

describe('transcoding test suite', () => {
  describe('Cross transcoder decoding', () => {
    it('should fail to decode and encoded high SPD with an unrelated transcoder', () => {
      const xCoder1 = new Transcoder
      const xCoder2 = new Transcoder
      const spd = new SPD('high')

      const encodedSPD = xCoder1.encodeHighSPD(spd)
      const validDecodedSPD = xCoder1.decodeToHighSPD(encodedSPD)
      const invalidDecodedSPD = xCoder2.decodeToHighSPD(encodedSPD)

      expect(validDecodedSPD.readonlyBufferView()).toEqual(spd.readonlyBufferView())
      expect(invalidDecodedSPD.readonlyBufferView()).not.toEqual(spd.readonlyBufferView())
    })

    it('should succeed to decode and encoded high SPD with different transcoders sharing the same low SPD', () => {
      const lowSPD = new SPD('low')
      const xCoder1 = new Transcoder({ lowSPD })
      const xCoder2 = new Transcoder({ lowSPD })
      const spd = new SPD('high')

      const encodedSPD = xCoder1.encodeHighSPD(spd)
      const validDecodedSPD = xCoder1.decodeToHighSPD(encodedSPD)
      const stillValidDecodedSPD = xCoder2.decodeToHighSPD(encodedSPD)

      expect(validDecodedSPD.readonlyBufferView()).toEqual(spd.readonlyBufferView())
      expect(stillValidDecodedSPD.readonlyBufferView()).toEqual(spd.readonlyBufferView())
    })
  })
})

