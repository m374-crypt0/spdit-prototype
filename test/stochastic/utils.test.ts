import { shuffleArray, shuffleBuffer, SplitMix64, UniformUint64, Xoroshiro128Plus } from "src/stochastic";

import { describe, expect, it } from "bun:test";

describe('utils test suite', () => {
  describe('shuffle sequence', () => {
    it('should shuffle deterministically using a specific stochastic distribution', () => {
      const orderedArray = Array.from({ length: 16 }, (_, i) => i)
      const orderedBuffer = Buffer.from(orderedArray)

      let array = Array.from(orderedArray)
      let buffer = Buffer.from(orderedBuffer)

      expect(array.reduce((acc, cur) => acc + cur, 0)).toBe(120)
      expect(buffer.reduce((acc, cur) => acc + cur, 0)).toBe(120)

      shuffleArray(array, new UniformUint64(new Xoroshiro128Plus(new SplitMix64(42n))))
      shuffleBuffer(buffer, new UniformUint64(new Xoroshiro128Plus(new SplitMix64(42n))))

      expect(orderedArray).not.toEqual(array)
      expect(orderedBuffer).not.toEqual(buffer)
      expect(array.reduce((acc, cur) => acc + cur, 0)).toBe(120)
      expect(array.reduce((acc, cur) => acc + cur, 0)).toBe(120)

      const shuffledArray = Array.from(array)
      const shuffledBuffer = Buffer.from(buffer)
      array = Array.from(orderedArray)
      buffer = Buffer.from(orderedBuffer)

      shuffleArray(array, new UniformUint64(new Xoroshiro128Plus(new SplitMix64(42n))))
      shuffleBuffer(buffer, new UniformUint64(new Xoroshiro128Plus(new SplitMix64(42n))))

      expect(array).toEqual(shuffledArray)
      expect(buffer).toEqual(shuffledBuffer)

      expect(new Set(array).size).toBe(16)
      expect(new Set(buffer).size).toBe(16)
    })

    it('should non deterministically shuffle', () => {
      const orderedArray = Array.from({ length: 16 }, (_, i) => i)
      let array = Array.from(orderedArray)

      expect(orderedArray.reduce((acc, cur) => acc + cur, 0)).toBe(120)

      shuffleArray(array)

      expect(array).not.toEqual(orderedArray)
      expect(array.reduce((acc, cur) => acc + cur, 0)).toBe(120)

      const shuffledArray = Array.from(array)
      array = Array.from(orderedArray)

      shuffleArray(orderedArray)

      expect(shuffledArray).not.toEqual(array)
      expect(array.reduce((acc, cur) => acc + cur, 0)).toBe(120)
    })
  })
})

