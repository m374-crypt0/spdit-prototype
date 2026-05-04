import { SPD } from "src/SPD";

import { describe, expect, it } from "bun:test";

describe('SPD test suite', () => {
  describe('creation', () => {
    it.each(['low', 'high'])
      ('should create a valid low SPD with iterable properties', spdType => {
        const spd = new SPD(spdType)

        expect(Iterator.from(spd)).not.toBeUndefined()
      })
  })
})

