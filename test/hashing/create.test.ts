import { Shi7 } from "src/hashing";
import { SplitMix64, } from "src/stochastic";
import { SPD, Transcoder } from "src/transcoding";
import { bitwiseDiffusion, generateRandomUniqueMessages } from "./utils";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

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
      const hasher = new Shi7({ hashBitSize: 64 })

      expect(hasher.hashBitSize()).toBe(64)
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

  describe.each([64, 128, 256, 512, 1024])
    ('hashing empty message', hashBitSize => {
      const empty = Buffer.from(new ArrayBuffer(0))

      it.each(generateSeeds(10))
        ('should give the same value for the same Shi7 instance', seed => {
          const hasher1 = new Shi7({ hashBitSize, seed })
          const hasher2 = new Shi7({ hashBitSize, seed })

          expect(hasher1).not.toBe(hasher2)
          expect(hasher1.hash(empty)).toBe(hasher2.hash(empty))
        })

      describe('collision resistance', () => {
        let hashes: Set<bigint>

        beforeAll(() => hashes = new Set<bigint>)

        it.each(generateSeeds(10))
          ('should not collide hash values between different Shi7 instances', seed => {
            hashes.add(new Shi7({ seed, hashBitSize }).hash(empty))
          })

        afterAll(() => expect(hashes.size).toBe(10))
      })

      describe('diffusion properties', () => {
        let hashes: Array<bigint>

        beforeAll(() => hashes = new Array<bigint>)

        it.each(generateSeeds(10))
          ('should give pretty different hashes for seeds differing by one bit', seed => {
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

        it.each(generateSeeds(10))
          ('should differ largely for an empty message hash and the underlying SPD hash', seed => {
            const hasher = new Shi7({ seed, hashBitSize })

            const emptyHash = hasher.hash(empty)
            const spdHash = hasher.hash(hasher.transcoder().highSPD().readonlyBufferView())
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

  describe.each([64, 128, 256, 512, 1024])
    ('hashing small messages in regard of hash bit size', hashBitSize => {
      it.each(generateSeeds(10))
        ('should have the same hash for the same message', seed => {
          const shi7 = new Shi7({ hashBitSize, seed })
          const message = Buffer.from('hello SPDIT!')

          const hash = shi7.hash(message)

          expect(hash).toBe(new Shi7({ seed, hashBitSize }).hash(Buffer.from('hello SPDIT!')))
        })

      describe('collision resistance', () => {
        it.each(generateSeeds(10))
          ('should give as many hashes as there are hash function calls', seed => {
            const shi7 = new Shi7({ hashBitSize, seed })
            const messages = generateRandomUniqueMessages({ minSize: 1, maxSize: hashBitSize / 8 - 1, maxCount: 100 })
            const hashes = new Set<bigint>

            messages.forEach(m => hashes.add(shi7.hash(m)))

            expect(hashes.size).toBe(messages.length)
          })
      })

      describe('pre-image attacks resistance', () => { })

      describe('diffusion properties', () => {
        let hashes: Array<bigint>

        beforeAll(() => hashes = new Array<bigint>)

        it.each(generateSeeds(10))
          ('should give pretty different hashes for seeds differing by one bit', seed => {
            const shi7 = new Shi7({ hashBitSize, seed })
            const messages = generateRandomUniqueMessages({ minSize: 1, maxSize: hashBitSize / 8 - 1, maxCount: 100 })

            messages.forEach(m => hashes.push(shi7.hash(m)))
          })

        afterAll(() => {
          const diffusionResults = new Array<number>

          for (let i = 0; i < hashes.length; i += 2)
            diffusionResults.push(bitwiseDiffusion(hashes[i]!, hashes[i + 1] ?? 0n))

          const diffusionMean = diffusionResults
            .reduce((acc, cur) => acc + cur, 0) / diffusionResults.length

          expect(diffusionMean).toBeWithin(0.45, 0.56)
        })
      })
    })

  describe.each([64, 128, 256, 512, 1024])
    ('hashing big messages in regard of hash bit size', hashBitSize => {
      it.each(generateSeeds(10))
        ('should have the same hash for the same message', seed => {
          const shi7 = new Shi7({ hashBitSize, seed })
          const message = generateRandomUniqueMessages({ minSize: 1_000_000, maxSize: 2_000_000, maxCount: 1 })[0]!

          const hash = shi7.hash(message)

          expect(hash).toBe(new Shi7({ seed, hashBitSize }).hash(message))
        })

      describe('collision resistance', () => {
        it.each(generateSeeds(10))
          ('should not create collision between odd size message and a ressembling even sized message', seed => {
            const shi7 = new Shi7({ hashBitSize, seed })
            const oddSizedMessage = Buffer.from(Array.from({ length: hashBitSize / 8 * SPD.DIMENSIONAL_FACTOR + 1 }, () => 42))
            const evenSizedMessage = Buffer.from(Array.from({ length: hashBitSize / 8 * SPD.DIMENSIONAL_FACTOR }, () => 42))

            expect(shi7.hash(oddSizedMessage)).not.toBe(shi7.hash(evenSizedMessage))
          })

        it('should not create collision between a message and the same message but decoded', () => {
          const shi7 = new Shi7({ hashBitSize: 64 })

          const message = Buffer.from(Array.from({ length: 64 / 8 * 2 * SPD.DIMENSIONAL_FACTOR }, () => 42))
          const decodedMessage = new Transcoder({ highSPD: shi7.transcoder().highSPD() }).decode(message)

          expect(shi7.hash(message)).not.toBe(shi7.hash(decodedMessage))
        })
      })

      describe('pre-image attacks resistance', () => { })
      describe('diffusion properties', () => { })
    })
})

function generateSeeds(count: number) {
  return Array.from({ length: count }, () => new SplitMix64().newSeed())
}
