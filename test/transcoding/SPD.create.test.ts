import { SPD } from "src/transcoding";

import { describe, expect, it } from "bun:test";
import { SplitMix64 } from "src/stochastic";

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
          .forEach(laneIterator => set.add(laneIterator.toArray().join('')))

        expect(set.size).toBe(spd.laneSize)
      })

    it.each(['low', 'high'])
      ('should have each lane with some missing or duplicated values', (spdType) => {
        const spd = new SPD(spdType)
        const maps: Array<Map<number, number>> = []

        Iterator.from(spd)
          .forEach(laneIterator => {
            const m = new Map<number, number>()
            laneIterator.forEach(k => m.set(k, (m.get(k) ?? 0) + 1))
            maps.push(m)
          })

        expect(maps.length).toBeGreaterThan(0)

        expect(spd.size).toBe(maps
          .map(m => m.values().toArray())
          .flat()
          .reduce((acc, v) => acc + v, 0))

        expect(maps.some(m => m.size < spd.laneSize)).toBeTrue()
      })

    it.each(['low', 'high'])
      ('should have each lane with some missing or duplicated values after buffer transposition', (spdType) => {
        const spd = new SPD(spdType)
        const spdBufferCopy = Buffer.from(spd.readonlyBufferView())

        transposeBuffer(spdBufferCopy, spd.laneSize)

        const maps = new Array(spd.laneSize).fill(null)
          .map((_, i) =>
            [...spdBufferCopy.subarray(spd.laneSize * i, spd.laneSize * (i + 1)).values()])
          .map(lane => {
            const m = new Map<number, number>
            lane.forEach(k => m.set(k, (m.get(k) ?? 0) + 1))
            return m
          })

        expect(maps.some(m => m.size < spd.laneSize)).toBeTrue()
      })

    it.each([16, 255, 3000, 60_000, 120_000])
      ('should not be possible to create an SPD instance with incorrect sized buffer', (size) => {
        const b = Buffer.from(new ArrayBuffer(size))

        expect(() => SPD.from(b)).toThrowError('invalid buffer size')
      })

    it.each([{ size: SPD.LOW_SPD_SIZE, laneSize: SPD.LOW_LANE_SIZE }, { size: SPD.HIGH_SPD_SIZE, laneSize: SPD.HIGH_LANE_SIZE }])
      ('should build a SPD instance of a correct type regarding the buffer size', (p) => {
        const b = Buffer.from(new ArrayBuffer(p.size))
        const spd = SPD.from(b)

        expect(spd.laneSize).toBe(p.laneSize)
      })
  })

  describe('deterministic SPD creation', () => {
    it.each(['low', 'high'])
      ('should create different SPD each time constructor is called without a seed', (type) => {
        const spd1 = new SPD(type)
        const spd2 = new SPD(type)

        expect(spd1.readonlyBufferView()).not.toEqual(spd2.readonlyBufferView())
      })

    it.each(['low', 'high'])
      ('should create the same SPD when constructed with the same seed', (type) => {
        const seed = new SplitMix64().state()

        const spd1 = new SPD(type, { kind: 'seed', seed })
        const spd2 = new SPD(type, { kind: 'seed', seed })

        expect(spd1.readonlyBufferView()).toEqual(spd2.readonlyBufferView())
      })
  })
})

// NOTE: exact same implementation as in SPD class
function transposeBuffer(buffer: Buffer<ArrayBuffer>, laneSize: number) {
  for (let i = 0; i < laneSize; i++) {
    for (let j = i; j < laneSize; j++) {
      if (buffer[i * laneSize + j] === buffer[j * laneSize + i])
        continue

      buffer[i * laneSize + j]! ^= buffer[j * laneSize + i]!
      buffer[j * laneSize + i]! ^= buffer[i * laneSize + j]!
      buffer[i * laneSize + j]! ^= buffer[j * laneSize + i]!
    }
  }
}
