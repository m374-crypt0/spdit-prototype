import { type SeedGenerator, SplitMix64 } from "src/stochastic/seedGenerators";

import { describe, expect, it } from "bun:test";
import { Xoroshiro128Plus } from "src/stochastic";

describe('uniform random bit generators test suite', () => {
  describe('xoroshiro128+', () => {
    it('should be possible to instantiate this URBG with any seed generator and access its state', () => {
      const seedGenerator: SeedGenerator<bigint> = new SplitMix64(42n)
      const urbg = new Xoroshiro128Plus(seedGenerator)

      expect(urbg.state()).not.toEqual([0n, 0n])
    })

    it('should generate 1 000 000 different uint64 values when called 1 000 000 times', () => {
      const seedGenerator = new SplitMix64(42n)
      const urbg = new Xoroshiro128Plus(seedGenerator)

      const values = new Map<bigint, number>
      Array
        .from({ length: 1000_000 }, () => urbg.newValue())
        .forEach(value =>
          values.set(value, (values.get(value) ?? 0) + 1))

      const areAllValuesUint64 = [...values.keys()].filter(value => value > urbg.UINT64_MAX).length === 0
      expect(areAllValuesUint64).toBeTrue()

      const areAllValuesUnique = [...values.values()].filter(count => count > 1).length === 0
      expect(areAllValuesUnique).toBeTrue()
    })

    it('values are deterministically generated regarding an identical seed generator', () => {
      const seedGenerator = new SplitMix64(42n)
      const urbg = new Xoroshiro128Plus(seedGenerator)

      const values = new Map<bigint, number>
      Array
        .from({ length: 100_000 }, () => urbg.newValue())
        .forEach(value =>
          values.set(value, (values.get(value) ?? 0) + 1))

      const seedGenerator2 = new SplitMix64(42n)
      const urbg2 = new Xoroshiro128Plus(seedGenerator2)
      Array
        .from({ length: 100_000 }, () => urbg2.newValue())
        .forEach(value =>
          values.set(value, (values.get(value) ?? 0) + 1))

      const areAllValuesUnique = [...values.values()].filter(count => count > 1).length === 0
      expect(areAllValuesUnique).toBeFalse()
    })

    it('should be possible to rely on a default random engine for non-determistic value generation', () => {
      const urbg1 = new Xoroshiro128Plus()
      const urbg2 = new Xoroshiro128Plus()

      const values = new Map<bigint, number>

      Array
        .from({ length: 100_000 }, () => urbg1.newValue())
        .forEach(value =>
          values.set(value, (values.get(value) ?? 0) + 1))

      Array
        .from({ length: 100_000 }, () => urbg2.newValue())
        .forEach(value =>
          values.set(value, (values.get(value) ?? 0) + 1))

      const areAllValuesUnique = [...values.values()].filter(count => count > 1).length === 0
      expect(areAllValuesUnique).toBeTrue()
    })
  })
})
