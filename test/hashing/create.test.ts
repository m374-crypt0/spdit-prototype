import { Shi7 } from "src/hashing";
import { SplitMix64, } from "src/stochastic";

import { describe, expect, it } from "bun:test";

describe('hashing test suite', () => {
  describe('shi7 instantiation', () => {
    it('should default instantiate shi7 with 256 hash bit size and random seed', () => {
      const hasher = new Shi7

      expect(hasher.hashBitSize()).toBe(256)
      expect(hasher.seed()).toBeDefined()
    })

    it('should be instantiated with a default hash bit size and a specified seed', () => {
      const hasher = new Shi7({ seed: 42n })

      expect(hasher.hashBitSize()).toBe(256)
      expect(hasher.seed()).toBe(new SplitMix64(42n).state())
    })

    it('should be instantiated with a specific hash bit size and a random seed', () => {
      const hasher = new Shi7({ hashBitSize: 128 })

      expect(hasher.hashBitSize()).toBe(128)
      expect(hasher.seed()).toBeDefined()
    })

    it('should expose a readonly transcoder, whose underlying high SPD content depends on seed', () => {
      const hasher1 = new Shi7({ seed: 42n })
      const hasher2 = new Shi7({ seed: 43n })
      const hasher3 = new Shi7({ seed: 42n })

      expect(hasher1.transcoder().highSPD().readonlyBufferView()).not.toEqual(hasher2.transcoder().highSPD().readonlyBufferView())
      expect(hasher1.transcoder().highSPD().readonlyBufferView()).toEqual(hasher3.transcoder().highSPD().readonlyBufferView())
    })
  })
})
