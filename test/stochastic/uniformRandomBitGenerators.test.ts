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
  })
})

// TODO: default URBG instantiation
