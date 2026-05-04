import { SPD } from "src/SPD";

import { describe, expect, it } from "bun:test";

describe('SPD test suite', () => {
  describe('creation', () => {
    it('should create a valid SPD with iterable properties', () => {
      const spd = new SPD()

      expect(spd[Symbol.iterator]).not.toBeUndefined()
    })
  })
})

