import { SplitMix64, UniformUint64, Xoroshiro128Plus, type SeedGenerator, type UniformRandomBitGenerator } from "src/stochastic";

import { describe, expect, it } from "bun:test";

describe('distributions test suite', () => {
  describe('uniform uint64', () => {
    it('should be possible to instantiate this distribution with any urbg and query a random value in a range', () => {
      const seedGenerator: SeedGenerator<bigint> = new SplitMix64(42n)
      const urbg: UniformRandomBitGenerator<[bigint, bigint], bigint> = new Xoroshiro128Plus(seedGenerator)
      const distribution = new UniformUint64(urbg)

      const value = distribution.newUint64([10n, 20n])

      expect(value >= 10n && value <= 20n).toBeTrue()
    })

    it('should fail to query a value bigger than biggest unsigned int 64 bits sized', () => {
      const seedGenerator: SeedGenerator<bigint> = new SplitMix64(42n)
      const urbg: UniformRandomBitGenerator<[bigint, bigint], bigint> = new Xoroshiro128Plus(seedGenerator)
      const distribution = new UniformUint64(urbg)

      expect(() => { distribution.newUint64([1n << 62n, 1n << 70n]) }).toThrowError("range overflow uint64")
      expect(() => { distribution.newUint64([1n << 68n, 1n << 56n]) }).toThrowError("range overflow uint64")
    })

    it('should produce a uniform distribution over a given range (chi-square goodness-of-fit)', () => {
      const seedGenerator: SeedGenerator<bigint> = new SplitMix64(42n)
      const urbg: UniformRandomBitGenerator<[bigint, bigint], bigint> = new Xoroshiro128Plus(seedGenerator)
      const distribution = new UniformUint64(urbg)

      const bins = 100
      const samples = 100_000
      const range: [bigint, bigint] = [0n, BigInt(bins - 1)]

      const occurences = new Array(bins).fill(0)

      Array
        .from({ length: samples }, () => distribution.newUint64(range))
        .forEach(value => occurences[Number(value)]!++)

      const expected = samples / bins
      const chiSquare = occurences
        .reduce((sum, o) => sum + (o - expected) ** 2 / expected, 0)

      // df = bins - 1 = 99, alpha = 0.01 => critical value = 135.807
      expect(chiSquare).toBeLessThan(135.807)
    })
  })
})
