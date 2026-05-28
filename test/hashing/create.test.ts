import { Shi7, type SupportedHashBitSize } from "src/hashing";
import { SplitMix64, } from "src/stochastic";
import { SPD, Transcoder } from "src/transcoding";

import { bigintToBuffer, bitwiseDiffusion, generateRandomUniqueMessages, generateSeeds } from "./utils";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

describe('hashing test suite', () => {
  const supportedHashBitSizes: SupportedHashBitSize[] = [128, 256, 512, 1024]

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

  describe.each(supportedHashBitSizes)
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
        describe(`random unrelated seeds`, () => {
          let diffusionResults: Array<number>

          beforeAll(() => diffusionResults = new Array<number>)

          it.each(generateSeeds(10))
            ('ensure diffusionMean is between 0.45 and 0.55', seed => {
              const firstHash = new Shi7({ hashBitSize, seed }).hash(empty)
              const secondHash = new Shi7({ hashBitSize, seed: new SplitMix64().newSeed() }).hash(empty)

              diffusionResults.push(bitwiseDiffusion(firstHash, secondHash))
            })

          afterAll(() => {
            const diffusionMean = diffusionResults
              .reduce((acc, cur) => acc + cur, 0) / diffusionResults.length

            expect(diffusionMean).toBeWithin(0.45, 0.551)
          })
        })

        describe(`slightly differing seeds`, () => {
          let diffusionResults: Array<number>

          beforeAll(() => diffusionResults = new Array<number>)

          it.each(generateSeeds(10))
            ('ensure diffusionMean is between 0.45 and 0.55', seed => {
              const firstHash = new Shi7({ hashBitSize, seed }).hash(empty)
              const secondHash = new Shi7({ hashBitSize, seed: seed - 1n }).hash(empty)

              diffusionResults.push(bitwiseDiffusion(firstHash, secondHash))
            })

          afterAll(() => {
            const diffusionMean = diffusionResults
              .reduce((acc, cur) => acc + cur, 0) / diffusionResults.length

            expect(diffusionMean).toBeWithin(0.45, 0.551)
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

            expect(diffusionMean).toBeWithin(0.45, 0.551)
          })
        })
      })
    })

  describe.each(supportedHashBitSizes)
    ('hashing small messages in regard of hash bit size', hashBitSize => {
      it.each(generateSeeds(10))
        ('should give different hashes for the same message hashed with different seeds', seed => {
          const shi7_1 = new Shi7({ hashBitSize, seed })
          const shi7_2 = new Shi7({ hashBitSize, seed: shi7_1.seed() + 1n })
          const message = Buffer.from('hello SPDIT!')

          expect(shi7_1.hash(message)).not.toBe(shi7_2.hash(message))
        })

      it.each(generateSeeds(10))
        ('should have the same hash for the same message', seed => {
          const shi7 = new Shi7({ hashBitSize, seed })
          const message = Buffer.from('hello SPDIT!')

          const hash = shi7.hash(message)

          expect(hash).toBe(new Shi7({ seed, hashBitSize }).hash(Buffer.from('hello SPDIT!')))
        })

      it('should have different hash for different messages', () => {
        const hashes = new Set<bigint>
        const messages = generateRandomUniqueMessages({ maxCount: 1_000, minSize: 1, maxSize: hashBitSize / 8 - 1 })
        const shi7 = new Shi7({ hashBitSize })

        messages.forEach(m => hashes.add(shi7.hash(m)))

        expect(hashes.size).toBe(messages.length)
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

        it.each(generateSeeds(10))
          ('should not create collision between odd size message and a ressembling even sized message', seed => {
            const shi7 = new Shi7({ hashBitSize, seed })
            const oddSizedMessage = Buffer.from(Array.from({ length: hashBitSize / 8 * SPD.DIMENSIONAL_FACTOR + 1 }, () => 42))
            const evenSizedMessage = Buffer.from(Array.from({ length: hashBitSize / 8 * SPD.DIMENSIONAL_FACTOR }, () => 42))

            expect(shi7.hash(oddSizedMessage)).not.toBe(shi7.hash(evenSizedMessage))
          })
      })

      describe('diffusion properties', () => {
        describe('unrelated pre-images', () => {
          it('ensure diffusionMean is between 0.45 and 0.55', () => {
            const diffusionResults = new Array<number>

            const shi7 = new Shi7({ hashBitSize })

            for (let i = 0; i < 1_000; i++) {
              const firstPreImage = generateRandomUniqueMessages({ minSize: 1, maxSize: hashBitSize / 8 - 1, maxCount: 1 })[0]!
              const secondPreImage = generateRandomUniqueMessages({ minSize: 1, maxSize: hashBitSize / 8 - 1, maxCount: 1 })[0]!

              const firstPreImageHash = shi7.hash(firstPreImage)
              const secondPreImageHash = shi7.hash(secondPreImage)

              diffusionResults.push(bitwiseDiffusion(firstPreImageHash, secondPreImageHash))
            }

            const diffusionMean = diffusionResults
              .reduce((acc, cur) => acc + cur, 0) / diffusionResults.length

            expect(diffusionMean).toBeWithin(0.45, 0.551)
          })
        })

        describe('slightly differing pre-images', () => {
          it('ensure diffusionMean is between 0.45 and 0.55', () => {
            const diffusionResults = new Array<number>
            const shi7 = new Shi7({ hashBitSize })

            for (let i = 0; i < 1_000; i++) {
              const firstPreImage = generateRandomUniqueMessages({ minSize: 1, maxSize: hashBitSize / 8 - 1, maxCount: 1 })[0]!
              const secondPreImage = Buffer.from(firstPreImage)
              secondPreImage[secondPreImage.byteLength - 1] = (secondPreImage[secondPreImage.byteLength - 1]! + 1) % 255

              const firstPreImageHash = shi7.hash(firstPreImage)
              const secondPreImageHash = shi7.hash(secondPreImage)

              diffusionResults.push(bitwiseDiffusion(firstPreImageHash, secondPreImageHash))
            }

            const diffusionMean = diffusionResults
              .reduce((acc, cur) => acc + cur, 0) / diffusionResults.length

            expect(diffusionMean).toBeWithin(0.45, 0.551)
          })
        })

        describe('diffusion for second pre-images', () => {
          const maxCount = 1_000
          const messages = generateRandomUniqueMessages({ minSize: 1, maxSize: hashBitSize / 8 - 1, maxCount })

          it('ensure diffusionMean is between 0.45 and 0.55', () => {
            const preImagesDiffusions = new Array<number>
            const shi7 = new Shi7({ hashBitSize })

            messages.forEach(m => {
              const firstPreImageHash = shi7.hash(m)
              const b = bigintToBuffer(firstPreImageHash, hashBitSize)
              const secondPreImageHash = shi7.hash(b)

              preImagesDiffusions.push(bitwiseDiffusion(firstPreImageHash, secondPreImageHash))
            })

            const diffusionMean = preImagesDiffusions
              .reduce((acc, cur) => acc + cur, 0) / preImagesDiffusions.length

            expect(diffusionMean).toBeWithin(0.45, 0.551)
          })
        })
      })
    })

  describe('hashing big messages in regard of hash bit size', () => {
    let bigMessages: Array<Buffer<ArrayBuffer>>

    beforeAll(() => {
      console.log(`>> generating big messages...`)

      bigMessages = [
        ...generateRandomUniqueMessages({ minSize: 1_000_000, maxSize: 2_000_000, maxCount: 10 }),
        ...generateRandomUniqueMessages({ minSize: 1_000, maxSize: 2_000, maxCount: 1_000 })
      ]

      const totalSize = bigMessages
        .reduce((acc, cur) => acc + cur.byteLength, 0)

      console.log(`>> ${totalSize} bytes of big messages are generated!`)
    })

    describe.each(supportedHashBitSizes)
      ('for each hashBitSize', hashBitSize => {
        it.each(generateSeeds(10))
          ('should give different hashes for the same message hashed with different seeds', () => {
            const shi7_1 = new Shi7({ hashBitSize })
            const shi7_2 = new Shi7({ hashBitSize, seed: shi7_1.seed() + 1n })
            const message = bigMessages[0]!

            expect(shi7_1.hash(message)).not.toBe(shi7_2.hash(message))
          })

        it('should have the same hash for the same message', () => {
          const shi7_1 = new Shi7({ hashBitSize })
          const shi7_2 = new Shi7({ hashBitSize, seed: shi7_1.seed() })

          expect(shi7_1).not.toBe(shi7_2)

          bigMessages.forEach(m =>
            expect(shi7_1.hash(m)).toBe(shi7_2.hash(m)))
        })

        it('should have different hash for different messages', () => {
          const hashes = new Set<bigint>
          const shi7 = new Shi7({ hashBitSize })

          bigMessages.forEach(m => hashes.add(shi7.hash(m)))

          expect(hashes.size).toBe(bigMessages.length)
        })

        describe('collision resistance', () => {
          it('should give as many hashes as there are hash function calls', () => {
            const shi7 = new Shi7({ hashBitSize })
            const hashes = new Set<bigint>

            bigMessages.forEach(m => hashes.add(shi7.hash(m)))

            expect(hashes.size).toBe(bigMessages.length)
          })

          it.each(generateSeeds(10))
            ('should not create collision between odd size message and a ressembling even sized message', seed => {
              const shi7 = new Shi7({ hashBitSize, seed })
              const oddSizedMessage = Buffer.from(Array.from({ length: 1_000_001 }, () => 42))
              const evenSizedMessage = Buffer.from(Array.from({ length: 1_000_000 }, () => 42))

              expect(shi7.hash(oddSizedMessage)).not.toBe(shi7.hash(evenSizedMessage))
            })

          it.each(generateSeeds(10))
            ('should not create collision between a message and the same message but decoded', () => {
              const shi7 = new Shi7({ hashBitSize })

              const message = Buffer.from(Array.from({ length: 1_000_000 }, () => 42))
              const decodedMessage = new Transcoder({ highSPD: shi7.transcoder().highSPD() }).decode(message)

              expect(shi7.hash(message)).not.toBe(shi7.hash(decodedMessage))
            })
        })
      })

    describe.each(supportedHashBitSizes)
      ('diffusion properties', hashBitSize => {
        describe('unrelated pre-images', () => {
          it('ensure diffusionMean is between 0.45 and 0.55', () => {
            const diffusionResults = new Array<number>

            const shi7 = new Shi7({ hashBitSize })

            for (let i = 0; i < bigMessages.length; i += 2) {
              const firstPreImage = bigMessages[i]!
              const secondPreImage = bigMessages[i + 1]!

              const firstPreImageHash = shi7.hash(firstPreImage)
              const secondPreImageHash = shi7.hash(secondPreImage)

              diffusionResults.push(bitwiseDiffusion(firstPreImageHash, secondPreImageHash))
            }

            const diffusionMean = diffusionResults
              .reduce((acc, cur) => acc + cur, 0) / diffusionResults.length

            expect(diffusionMean).toBeWithin(0.45, 0.551)
          })
        })

        describe('slightly differing pre-images', () => {
          it('ensure diffusionMean is between 0.45 and 0.55', () => {
            const diffusionResults = new Array<number>
            const shi7 = new Shi7({ hashBitSize })

            bigMessages.forEach(m => {
              const firstPreImage = m
              const secondPreImage = Buffer.from(firstPreImage)
              secondPreImage[secondPreImage.byteLength - 1] = (secondPreImage[secondPreImage.byteLength - 1]! + 1) % 255

              const firstPreImageHash = shi7.hash(firstPreImage)
              const secondPreImageHash = shi7.hash(secondPreImage)

              diffusionResults.push(bitwiseDiffusion(firstPreImageHash, secondPreImageHash))
            })

            const diffusionMean = diffusionResults
              .reduce((acc, cur) => acc + cur, 0) / diffusionResults.length

            expect(diffusionMean).toBeWithin(0.45, 0.551)
          })
        })

        describe('diffusion for second pre-images', () => {
          it('ensure diffusionMean is between 0.45 and 0.55', () => {
            const preImagesDiffusions = new Array<number>
            const shi7 = new Shi7({ hashBitSize })

            bigMessages.forEach(m => {
              const firstPreImageHash = shi7.hash(m)
              const b = bigintToBuffer(firstPreImageHash, hashBitSize)
              const secondPreImageHash = shi7.hash(b)

              preImagesDiffusions.push(bitwiseDiffusion(firstPreImageHash, secondPreImageHash))
            })

            const diffusionMean = preImagesDiffusions
              .reduce((acc, cur) => acc + cur, 0) / preImagesDiffusions.length

            expect(diffusionMean).toBeWithin(0.45, 0.551)
          })
        })
      })
  })
})

