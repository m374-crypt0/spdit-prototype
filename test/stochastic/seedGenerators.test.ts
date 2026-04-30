import { SplitMix64 } from "src/stochastic";

import { describe, expect, it } from "bun:test";

describe('seed generators test suite', () => {
  describe('splitmix64', () => {
    it('should be instantiable with any bigint as state, converting it to unsigned int 64 bits sized at maximum', () => {
      const seedGenerator = new SplitMix64(42n)
      expect(seedGenerator.state()).toBe(42n)

      const seedGenerator2 = new SplitMix64(43n)
      expect(seedGenerator2.state()).toBe(43n)

      const seedGenerator3 = new SplitMix64((1n << 64n) + 123n)
      expect(seedGenerator3.state()).toBe(123n)
    })
  })
})
