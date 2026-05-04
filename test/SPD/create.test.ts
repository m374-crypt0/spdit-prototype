import { SPD } from "src/SPD";

import { describe, expect, it } from "bun:test";

describe('SPD test suite', () => {
  describe('creation', () => {
    it('should create a valid low SPD with iterable properties', () => {
      const lowSPD = new SPD('low')
      const highSPD = new SPD('high')

      expect(lowSPD[Symbol.iterator]).not.toBeUndefined()
      expect(highSPD[Symbol.iterator]).not.toBeUndefined()
    })
  })
})

