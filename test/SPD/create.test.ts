import { SPD } from "src/SPD";

import { describe, expect, it } from "bun:test";

describe('SPD test suite', () => {
  describe('creation', () => {
    it.each(['low', 'high'])
      ('should create a valid SPD objects with iterable lanes', spdType => {
        const spd = new SPD(spdType)

        expect(spd.size).toBe(spd.laneSize ** 2)
        expect(Iterator.from(spd).toArray().length).toBe(spd.laneSize)
      })
  })
})

