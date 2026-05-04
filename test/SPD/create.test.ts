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

    it('should, for a low SPD, having 16 lanes containing values in [0, 15]', () => {
      const spd = new SPD('low')

      const areValuesInRange = Iterator.from(spd)
        .flatMap(laneIterator =>
          laneIterator.map(v => v >= 0 && v <= 15))
        .reduce((acc, cur) => acc && cur, true)

      const areAllValuesNotZero = Iterator.from(spd)
        .map(laneIterator =>
          laneIterator.reduce((acc, cur) => acc + cur, 0))
        .reduce((acc, cur) => acc + cur, 0) > 0

      expect(areValuesInRange).toBeTrue()
      expect(areAllValuesNotZero).toBeTrue()
    })
  })
})

