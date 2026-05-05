import { Xoroshiro128Plus, type UniformRandomBitGenerator } from "./uniformRandomBitGenerators";

/**
 * The generic interface for a random unsigned integer distribution engine
 */
export type UniformUintDistributionEngine<Uint> = {
  newUint: (range: [Uint, Uint]) => Uint
}

/**
 * An unsigned integer distribution engine producing unsigned integer of 64
 * bits sized.
 * @implements UniformUintDistributionEngine<bigint>
 */
export class UniformUint64DistributionEngine implements UniformUintDistributionEngine<bigint> {
  /**
   * Construct an instance relying on an optional uniform random bits generator
   * @param [urbg=new Xoroshiro128Plus] an optional instance of an uniform
   * random bits generator. If not specified, a default (with a pseudo-random
   * seed) instance of Xoroshiro128Plus is used.
   */
  constructor(urbg?: UniformRandomBitGenerator<[bigint, bigint], bigint>) {
    this.urbg = urbg ?? new Xoroshiro128Plus
  }

  /**
   * Produces a new random unsigned integer in range (inclusive)
   * @param range the inclusive range to generate an unsigned integer within.
   * The range member cannot overflow the maximum value of a 64 bits sized
   * unsigned integer
   * @returns a new random unsigned integer of 64 bits sized within range
   */
  newUint(range: [bigint, bigint]) {
    const [min, max] = [
      range[0] < range[1] ? range[0] : range[1],
      range[1] > range[0] ? range[1] : range[0]]

    if ((max & this.UINT64_MAX) != max || (min & this.UINT64_MAX) != min)
      throw new Error('range overflow uint64')

    const r = max - min + 1n

    while (true) {
      const x = this.urbg.newValue()
      const m = BigInt(x) * r
      const low = m & this.UINT64_MAX // 65 bits at least
      const threshold = (this.UINT65 - r) % r

      if (low >= threshold)
        return min + (m >> 64n)
    }
  }

  private readonly UINT64_MAX: bigint = (1n << 64n) - 1n
  private readonly UINT65: bigint = 1n << 64n
  private urbg: UniformRandomBitGenerator<[bigint, bigint], bigint>
}
