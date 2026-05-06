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
  })
})

