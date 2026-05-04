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

    it.each(['low', 'high'])
      ('should, for a SPD, having lanes containing values in according to its type', (spdType) => {
        const spd = new SPD(spdType)

        const areValuesInRange = Iterator.from(spd)
          .flatMap(laneIterator =>
            laneIterator.map(v => v >= 0 && v <= spd.laneSize - 1))
          .reduce((acc, cur) => acc && cur, true)

        const areAllValuesNotZero = Iterator.from(spd)
          .map(laneIterator =>
            laneIterator.reduce((acc, cur) => acc + cur, 0))
          .reduce((acc, cur) => acc + cur, 0) > 0

        expect(areValuesInRange).toBeTrue()
        expect(areAllValuesNotZero).toBeTrue()
      })

    it.each(['low', 'high'])
      ('should have each lane shuffled into a SPD', (spdType) => {
        const spd = new SPD(spdType)
        const set = new Set<string>

        Iterator.from(spd)
          .forEach(laneIterator => set.add(laneIterator.toArray().join()))

        expect(set.size).toBe(spd.laneSize)
      })
  })
})

