import { describe, expect, it } from "bun:test";
import { Shi7 } from "src/hashing";
import { SplitMix64 } from "src/stochastic";

describe('hashing test suite', () => {
  describe('hashing function instantiation', () => {
    it('should be possible to instantiate a random hash function different each time', () => {
      const f1 = new Shi7, f2 = new Shi7

      expect(f1.seed()).not.toBe(f2.seed())
    })

    it('should give the same seed if instantiated so', () => {
      const g = new SplitMix64
      const f1 = new Shi7(g.state()),
        f2 = new Shi7(g.state())

      expect(f1.seed()).toBe(f2.seed())
    })
  })
})
