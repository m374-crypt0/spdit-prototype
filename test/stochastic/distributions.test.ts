import { describe, expect, it } from "bun:test";
import { UniformUint64 } from "src/stochastic";
import { SplitMix64, type SeedGenerator } from "src/stochastic/seedGenerators";
import { Xoroshiro128Plus, type UniformRandomBitGenerator } from "src/stochastic/uniformRandomBitGenerators";

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
  })
})
