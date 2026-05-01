import { describe, expect, it } from "bun:test";
import { shuffleArray, shuffleBuffer, SplitMix64, UniformUint64, Xoroshiro128Plus } from "src/stochastic";

describe('utils test suite', () => {
  describe('shuffle sequence', () => {
    it('should shuffle deterministically using a specific stochastic distribution', () => {
      const oldArray = Array.from({ length: 16 }, (_, i) => i)
      Object.freeze(oldArray)

      const oldBuffer = Buffer.from(oldArray)

      expect(oldArray.reduce((acc, cur) => acc + cur, 0)).toBe(120)
      expect(oldBuffer.reduce((acc, cur) => acc + cur, 0)).toBe(120)

      const newArray = shuffleArray(oldArray, new UniformUint64(new Xoroshiro128Plus(new SplitMix64(42n))))
      const newBuffer = shuffleBuffer(oldBuffer, new UniformUint64(new Xoroshiro128Plus(new SplitMix64(42n))))

      const newArray2 = shuffleArray(oldArray, new UniformUint64(new Xoroshiro128Plus(new SplitMix64(42n))))
      const newBuffer2 = shuffleBuffer(oldBuffer, new UniformUint64(new Xoroshiro128Plus(new SplitMix64(42n))))

      expect(oldBuffer.equals(Buffer.from(oldArray))).toBeTrue()

      expect(newArray).not.toEqual(oldArray)
      expect(newBuffer.equals(oldBuffer)).toBeFalse()

      expect(newArray.reduce((acc, cur) => acc + cur, 0)).toBe(120)
      expect(newBuffer.reduce((acc, cur) => acc + cur, 0)).toBe(120)

      expect(new Set(newArray).size).toBe(16)
      expect(new Set(newBuffer).size).toBe(16)

      expect(newArray).toEqual(newArray2)
      expect(newBuffer).toEqual(newBuffer2)
    })
  })
})

