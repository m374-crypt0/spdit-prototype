import { Shi7 } from "src/hashing";

import { describe, expect, it } from "bun:test";

describe('hashing test suite', () => {
  describe('shi7 instantiation', () => {
    it('should default instantiate shi7 with 256 hash bit size and random seed', () => {
      const hasher = new Shi7

      expect(hasher.hashBitSize()).toBe(256)
      expect(hasher.seed()).toBeDefined()
    })

    it('should be instantiated with a default hash bit size and a specified seed', () => {
      const hasher = new Shi7({ seed: 0n })

      expect(hasher.hashBitSize()).toBe(256)
      expect(hasher.seed()).toBe(0n)
    })

    it('should be instantiated with a specific hash bit size and a random seed', () => {
      const hasher = new Shi7({ hashBitSize: 64 })

      expect(hasher.hashBitSize()).toBe(64)
      expect(hasher.seed()).toBeDefined()
    })

    it('should expose a readonly high SPD at instantiation, whose content depends on seed', () => {
      const hasher1 = new Shi7({ seed: 42n })
      const hasher2 = new Shi7({ seed: 43n })
      const hasher3 = new Shi7({ seed: 42n })

      expect(hasher1.highSPD().readonlyBufferView()).not.toEqual(hasher2.highSPD().readonlyBufferView())
      expect(hasher1.highSPD().readonlyBufferView()).toEqual(hasher3.highSPD().readonlyBufferView())
    })
  })

  describe('hashing empty message', () => {
    describe('collision resistance', () => { })
    describe('pre-image attacks resistance', () => { })
    describe('diffusion properties', () => { })
  })
  describe('hashing small messages in regard of hash bit size', () => {
    describe('collision resistance', () => { })
    describe('pre-image attacks resistance', () => { })
    describe('diffusion properties', () => { })
  })
  describe('hashing big messages in regard of hash bit size', () => {
    describe('collision resistance', () => { })
    describe('pre-image attacks resistance', () => { })
    describe('diffusion properties', () => { })
  })
})

