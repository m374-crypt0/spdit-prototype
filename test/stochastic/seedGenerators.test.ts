import { SplitMix64 } from "src/stochastic";

import { describe, expect, it } from "bun:test";

describe('seed generators test suite', () => {
  describe('splitmix64', () => {
    it
      .each([
        { input: 42n, expectedState: 42n },
        { input: 43n, expectedState: 43n },
        { input: (1n << 64n) + 123n, expectedState: 123n }
      ])
      ('should be instantiable with any bigint as state, converting it to unsigned int 64 bits sized at maximum', (p) => {
        const seedGenerator = new SplitMix64(p.input)
        expect(seedGenerator.state()).toBe(p.expectedState)
      })

    it('should generate 1 000 000 different seeds when called 1 000 000 times', () => {
      const seedGenerator = new SplitMix64(42n)

      const seeds = new Map<bigint, number>
      Array
        .from({ length: 1000_000 }, () => seedGenerator.newSeed())
        .forEach(seed =>
          seeds.set(seed, (seeds.get(seed) ?? 0) + 1))

      const areAllSeedsUnique = [...seeds.values()].filter(count => count > 1).length === 0
      expect(areAllSeedsUnique).toBeTrue()
    })

    it('seeds are deterministically generated regarding an initial state value', () => {
      const seedGenerator = new SplitMix64(42n)

      const seeds = new Map<bigint, number>
      Array
        .from({ length: 100_000 }, () => seedGenerator.newSeed())
        .forEach(seed =>
          seeds.set(seed, (seeds.get(seed) ?? 0) + 1))

      const seedGenerator2 = new SplitMix64(42n)
      Array
        .from({ length: 100_000 }, () => seedGenerator2.newSeed())
        .forEach(seed =>
          seeds.set(seed, (seeds.get(seed) ?? 0) + 1))

      const areAllSeedsUnique = [...seeds.values()].filter(count => count > 1).length === 0
      expect(areAllSeedsUnique).toBeFalse()
    })

    it('should be possible to rely on a default random engine for non-determistic seed generation', () => {
      const seedGenerator1 = new SplitMix64()
      const seedGenerator2 = new SplitMix64()
      const seeds = new Map<bigint, number>

      Array
        .from({ length: 100_000 }, () => seedGenerator1.newSeed())
        .forEach(seed =>
          seeds.set(seed, (seeds.get(seed) ?? 0) + 1))

      Array
        .from({ length: 100_000 }, () => seedGenerator2.newSeed())
        .forEach(seed =>
          seeds.set(seed, (seeds.get(seed) ?? 0) + 1))

      const areAllSeedsUnique = [...seeds.values()].filter(count => count > 1).length === 0
      expect(areAllSeedsUnique).toBeTrue()
    })
  })
})
