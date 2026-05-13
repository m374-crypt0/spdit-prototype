import { Shi7 } from "src/hashing";

import { describe, expect, it } from "bun:test";
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

    it('should be possible to access an underlying high SPD on demand when instantiated', () => {
      const shi7 = new Shi7

      expect(shi7.spd().laneSize).toBe(SPD.HIGH_LANE_SIZE)
    })
  })

  describe('empty message hashing', () => { })
})
