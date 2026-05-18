import { Shi7 } from "src/hashing";
import { SplitMix64 } from "src/stochastic";
import { bitwiseDiffusion } from "./utils";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

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
    const empty = Buffer.from(new ArrayBuffer(0))

    it('should give the same value for the same Shi7 instance', () => {
      const hasher1 = new Shi7
      const hasher2 = new Shi7({ hashBitSize: hasher1.hashBitSize(), seed: hasher1.seed() })

      expect(hasher1.hash(empty)).toBe(hasher2.hash(empty))
    })

    describe('collision resistance', () => {
      let hashes: Set<bigint>

      beforeAll(() => hashes = new Set<bigint>)

      it.each(([64, 128, 256, 512, 1024] as const)
        .map(hashBitSize =>
          Array.from({ length: 10 }, () => new SplitMix64().newSeed())
            .map(seed => ({ seed, hashBitSize }))
        )
        .flat())
        ('should not collide hash values between different Shi7 instances', ({ seed, hashBitSize }) => {
          hashes.add(new Shi7({ seed, hashBitSize }).hash(empty))
        })

      afterAll(() => expect(hashes.size).toBe(50))
    })

    describe('diffusion properties', () => {
      let hashes: Array<bigint>

      beforeAll(() => hashes = [])

      it.each(([64, 128, 256, 512, 1024] as const)
        .map(hashBitSize =>
          Array.from({ length: 10 }, () => new SplitMix64().newSeed())
            .map(seed => ({ seed, hashBitSize }))
        )
        .flat())
        ('should give pretty different hashes for seeds differing by one bit', ({ seed, hashBitSize }) => {
          hashes.push(new Shi7({ seed, hashBitSize }).hash(empty))
        })

      afterAll(() => {
        const diffusionResults = new Array<number>

        for (let i = 0; i < hashes.length; i += 2)
          diffusionResults.push(bitwiseDiffusion(hashes[i]!, hashes[i + 1]!))

        const diffusionMean = diffusionResults
          .reduce((acc, cur) => acc + cur, 0) / diffusionResults.length

        expect(diffusionMean).toBeWithin(0.45, 0.56)
      })
    })

    describe('pre-image attacks resistance', () => {
      let diffusionResults: Array<number>

      beforeAll(() => diffusionResults = [])

      // TODO: extract a test util to generate Shi7 options
      it.each(([64, 128, 256, 512, 1024] as const)
        .map(hashBitSize =>
          Array.from({ length: 10 }, () => new SplitMix64().newSeed())
            .map(seed => ({ seed, hashBitSize }))
        )
        .flat())
        ('should differ largely for an empty message hash and the underlying SPD hash', ({ seed, hashBitSize }) => {
          const hasher = new Shi7({ seed, hashBitSize })

          const emptyHash = hasher.hash(empty)
          const spdHash = hasher.hash(hasher.highSPD().readonlyBufferView())
          diffusionResults.push(bitwiseDiffusion(emptyHash, spdHash))

          expect(emptyHash).not.toBe(spdHash)
        })

      afterAll(() => {
        const diffusionMean = diffusionResults
          .reduce((acc, cur) => acc + cur, 0) / diffusionResults.length

        expect(diffusionMean).toBeWithin(0.45, 0.56)
      })
    })
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

