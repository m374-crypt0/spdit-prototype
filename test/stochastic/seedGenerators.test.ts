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
  })
})
