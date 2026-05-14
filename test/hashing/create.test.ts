import { Shi7 } from "src/hashing";

import { describe, expect, it, xit } from "bun:test";
import { SPD } from "src/transcoding";

describe('hashing test suite', () => {
  describe('hashing function instantiation', () => {
    it('should be possible to instantiate a random hash function different each time', () => {
      const f1 = new Shi7, f2 = new Shi7

      expect(f1.seed()).not.toBe(f2.seed())
    })

    it('should give the same seed if instantiated so', () => {
      const f1 = new Shi7({ seed: 42n }),
        f2 = new Shi7({ seed: 42n })

      expect(f1.seed()).toBe(f2.seed())
    })

    it('should default the hash size to 256 bits by default', () => {
      expect(new Shi7().hashBitSize()).toBe(256)
    })

    it('should throw if specifying hash bit size under 64 bits or above 1024 bits', () => {
      expect(() => new Shi7({ hashBitSize: 63 })).toThrowError('invalid hash bit size')
      expect(() => new Shi7({ hashBitSize: 1025 })).toThrowError('invalid hash bit size')
    })

    it('should throw if specified hash bit size is not a power of 2', () => {
      expect(() => new Shi7({ hashBitSize: 65 })).toThrowError('invalid hash bit size')
      expect(() => new Shi7({ hashBitSize: 1023 })).toThrowError('invalid hash bit size')
    })

    it.each([64, 128, 256, 512, 1024])
      ('should accept any hash bit size that is a power of 2 between 64 and 1024 included', (hashBitSize) => {
        expect(() => new Shi7({ hashBitSize })).not.toThrowError('invalid hash bit size')
      })

    it('should report the hash size if asked for', () => {
      expect(new Shi7({ hashBitSize: 64 }).hashBitSize()).toBe(64)
    })

    // FIXME: tell don't ask violation
    it('should be possible to access an underlying high SPD on demand when instantiated', () => {
      const shi7 = new Shi7

      expect(shi7.spd().laneSize).toBe(SPD.HIGH_LANE_SIZE)
    })
  })

  describe('empty message hashing', () => {
    // TODO: fuzzing here, before mathematical proof
    it.each([
      { seed: 42n, hashBitSize: 64 },
      { seed: 1337n, hashBitSize: 256 }
    ])
      ('should give a well sized value for empty message hash, always the same given a seed', ({ seed, hashBitSize }) => {
        const emptyMessage = Buffer.from(new ArrayBuffer(0))

        const hasher = new Shi7({ seed, hashBitSize })
        const expectedHash = hasher.hash(emptyMessage)

        const unrelatedHasher = new Shi7
        const unrelatedHash = unrelatedHasher.hash(emptyMessage)

        expect(expectedHash).toBeLessThanOrEqual(hasher.maxHashValue())
        expect(hasher.hash(emptyMessage)).toBe(expectedHash)

        expect(unrelatedHash).toBeLessThanOrEqual(unrelatedHasher.maxHashValue())
        expect(unrelatedHasher.hash(emptyMessage)).toBe(unrelatedHash)

        expect(unrelatedHash).not.toBe(expectedHash)
      })
  })

  describe('special cases', () => {
    describe('pre-image attacks resistance', () => {
      it('should not match hash of empty message and underlying SPD', () => {
        const hasher = new Shi7
        const emptyMessage = Buffer.from(new ArrayBuffer(0))

        expect(hasher.hash(emptyMessage)).not.toBe(hasher.hash(hasher.spd().readonlyBufferView()))
      })

      it.each([
        { hashBitSize: 64 },
        { hashBitSize: 128 },
        { hashBitSize: 256 },
        { hashBitSize: 512 },
        { hashBitSize: 1_024 },
      ])
        ('should give valid hash value for message of hashBitSize size', ({ hashBitSize }) => {
          const hasher = new Shi7({ hashBitSize })
          const message = Buffer.from(Array.from({ length: hashBitSize / 8 }, (_, i) => i))
          const messageAsBigInt = BigInt(`0x${message.toHex()}`)

          const hash = hasher.hash(message)

          expect(messageAsBigInt).not.toBe(hash)
        })
    })

    describe('avalanche effect', () => {
      it('should have good diffusion properties', () => { })
    })
  })

  describe('power of 2 and bigger than hashBitSize message', () => {
    // TODO: fuzzing here, before mathematical proof
    it.each([
      { seed: 42n, hashBitSize: 64 },
      { seed: 1337n, hashBitSize: 256 }
    ])
      ('should give a well sized value for message hash, always the same given a seed', ({ seed, hashBitSize }) => {
        const message = Buffer.from(Array.from({ length: hashBitSize / 8 * 2 }, () => 0))

        const hasher = new Shi7({ seed, hashBitSize })
        const expectedHash = hasher.hash(message)

        const unrelatedHasher = new Shi7
        const unrelatedHash = unrelatedHasher.hash(message)

        expect(expectedHash).toBeLessThanOrEqual(hasher.maxHashValue())
        expect(hasher.hash(message)).toBe(expectedHash)

        expect(unrelatedHash).toBeLessThanOrEqual(unrelatedHasher.maxHashValue())
        expect(unrelatedHasher.hash(message)).toBe(unrelatedHash)

        expect(unrelatedHash).not.toBe(expectedHash)
      })
  })
})

function reportHammingDistanceBetween(a: bigint, b: bigint) {
  const [_, max] = a < b ? [a, b] : [b, a]
  let bitCount = 0; for (let x = max; x > 0n; x >>= 1n, bitCount++);
  let distance = 0; for (let xor = a ^ b; xor > 0n; xor &= xor - 1n, distance++);

  return distance / bitCount
}
