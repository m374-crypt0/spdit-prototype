import { Shi7 } from "src/hashing";
import { SplitMix64, UniformUint64 } from "src/stochastic";
import { bitwiseDiffusion } from "./utils";

import { afterAll, beforeAll, describe, expect, it, xdescribe } from "bun:test";

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

    it.each(shi7OptionsSample(10))
      ('should give the same value for the same Shi7 instance', ({ hashBitSize, seed }) => {
        const hasher1 = new Shi7({ hashBitSize, seed })
        const hasher2 = new Shi7({ hashBitSize: hasher1.hashBitSize(), seed: hasher1.seed() })

        expect(hasher1.hash(empty)).toBe(hasher2.hash(empty))
      })

    describe('collision resistance', () => {
      let hashes: Set<bigint>

      beforeAll(() => hashes = new Set<bigint>)

      it.each(shi7OptionsSample(10))
        ('should not collide hash values between different Shi7 instances', ({ seed, hashBitSize }) => {
          hashes.add(new Shi7({ seed, hashBitSize }).hash(empty))
        })

      afterAll(() => expect(hashes.size).toBe(50))
    })

    describe('diffusion properties', () => {
      let hashes: Array<bigint>

      beforeAll(() => hashes = new Array<bigint>)

      it.each(shi7OptionsSample(10))
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

      it.each(shi7OptionsSample(10))
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
    it.each(shi7OptionsSample(10))
      ('should have the same hash for the same message', ({ hashBitSize, seed }) => {
        const shi7 = new Shi7({ hashBitSize, seed })
        const message = Buffer.from('hello SPDIT!')

        const hash = shi7.hash(message)

        expect(hash).toBe(new Shi7({ seed, hashBitSize }).hash(Buffer.from('hello SPDIT!')))
      })

    describe('collision resistance', () => {
      it.each(shi7OptionsSample(1))
        ('should give as many hashes as there are hash function calls', ({ hashBitSize, seed }) => {
          const shi7 = new Shi7({ hashBitSize, seed })
          const messages = generateRandomUniqueMessages({ minSize: 1, maxSize: hashBitSize / 8 - 1, maxCount: 100 })
          const hashes = new Set<bigint>

          messages.forEach(m => hashes.add(shi7.hash(m)))

          expect(hashes.size).toBe(messages.length)
        })
    })

    // NOTE: due to the nature of SPDIT, there is no information conveyed by
    // transcoding thus, no pre-image information can be obtaineed from the
    // hash
    describe('pre-image attacks resistance', () => { })

    describe('diffusion properties', () => {
      let hashes: Array<bigint>

      beforeAll(() => hashes = new Array<bigint>)

      it.each(shi7OptionsSample(1))
        ('should give pretty different hashes for seeds differing by one bit', ({ seed, hashBitSize }) => {
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

  describe('hashing big messages in regard of hash bit size', () => {
    it.each(shi7OptionsSample(1))
      ('should have the same hash for the same message', ({ hashBitSize, seed }) => {
        const shi7 = new Shi7({ hashBitSize, seed })
        const message = generateRandomUniqueMessages({ minSize: 1_000_000, maxSize: 2_000_000, maxCount: 1 })[0]!

        const hash = shi7.hash(message)

        expect(hash).toBe(new Shi7({ seed, hashBitSize }).hash(message))
      })

    describe('collision resistance', () => {
      it('should not create collision between odd size message and a ressembling even sized message', () => {
        const shi7 = new Shi7({ hashBitSize: 64 })
        const oddSizedMessage = Buffer.from(Array.from({ length: 19 }, () => 97))
        const evenSizedMessage = Buffer.from(Array.from({ length: 18 }, () => 97))

        expect(shi7.hash(oddSizedMessage)).not.toBe(shi7.hash(evenSizedMessage))
      })
    })

    describe('pre-image attacks resistance', () => { })
    describe('diffusion properties', () => { })
  })
})

function shi7OptionsSample(count: number) {
  return ([64, 128, 256, 512, 1024] as const)
    .map(hashBitSize =>
      Array.from({ length: count }, () => new SplitMix64().newSeed())
        .map(seed => ({ seed, hashBitSize }))
    )
    .flat()
}

function generateRandomUniqueMessages(options: GenerateRandomMessagesOptions) {
  const { minSize, maxSize } = { minSize: BigInt(options.minSize), maxSize: BigInt(options.maxSize) }
  const messageSet = new Set<string>
  const d = new UniformUint64

  for (let i = 0; i < options.maxCount; i++) {
    const length = Number(d.newUint([minSize, maxSize]))
    const a = Array.from({ length }, () => Number(d.newUint([0n, 255n])))
    const s = a.reduce((acc, cur) => `${acc}${String.fromCharCode(cur)}`, '')
    messageSet.add(s)
  }

  const messages = new Array<Readonly<Buffer<ArrayBuffer>>>
  messageSet.values().forEach(m => messages.push(Buffer.from(m)))

  return messages
}

type GenerateRandomMessagesOptions = {
  minSize: number,
  maxSize: number,
  maxCount: number
}
