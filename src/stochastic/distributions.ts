import { Xoroshiro128Plus, type UniformRandomBitGenerator } from "./uniformRandomBitGenerators";

export type UniformUintDistribution<Uint> = {
  newUint: (range: [Uint, Uint]) => Uint
}

export class UniformUint64 implements UniformUintDistribution<bigint> {
  constructor(urbg?: UniformRandomBitGenerator<[bigint, bigint], bigint>) {
    this.urbg = urbg ?? new Xoroshiro128Plus
  }

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

  readonly UINT64_MAX: bigint = (1n << 64n) - 1n
  readonly UINT65: bigint = 1n << 64n

  private urbg: UniformRandomBitGenerator<[bigint, bigint], bigint>
}
