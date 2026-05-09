import { Transcoder } from "src/transcoding";

import { describe, expect, it, xit } from "bun:test";
import { SPD } from "src/SPD";

describe('transcoding test suite', () => {
  describe('high SPD transcoding', () => {
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

  describe('arbitrary data transcoding', () => {
    it('should fail to decode data with 2 unrelated transcoders', () => {
      const xCoder1 = new Transcoder
      const xCoder2 = new Transcoder
      const data = Buffer.from('super secret data')

      const encodedData = xCoder1.encode(data)
      const decodedData = xCoder2.decode(encodedData)

      expect(encodedData).not.toEqual(data)
      expect(decodedData).not.toEqual(data)
    })

    it('should succeeds in decoding data with related transcoders sharing the same high SPD', () => {
      const highSPD = new SPD('high')
      const xCoder1 = new Transcoder({ highSPD })
      const xCoder2 = new Transcoder({ highSPD })
      const data = Buffer.from('super secret data')

      const encodedData = xCoder1.encode(data)
      const decodedData = xCoder2.decode(encodedData)

      expect(encodedData).not.toEqual(data)
      expect(decodedData).toEqual(data)
    })
  })
})

