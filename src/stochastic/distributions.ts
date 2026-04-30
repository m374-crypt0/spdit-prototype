import type { UniformRandomBitGenerator } from "./uniformRandomBitGenerators";

export class UniformUint64<State, Value extends number | bigint> {
  constructor(urbg: UniformRandomBitGenerator<State, Value>) {
    this.urbg = urbg
  }

  newUint64(range: [bigint, bigint]) {
    const [min, max] = [
      range[0] < range[1] ? range[0] : range[1],
      range[1] > range[0] ? range[1] : range[0]]

    if ((max & this.UINT64_MAX) != max || (min & this.UINT64_MAX) != min)
      throw new Error('range overflow uint64')

    const r = max - min + 1n

    while (true) {
      const x = this.urbg.newValue()
      const m = BigInt(x) * r
      const low = m & this.UINT64_MAX // 65 bits
      const threshold = (this.UINT65 - r) % r

      if (low >= threshold)
        return min + (m >> 64n)
    }
  }

  // TODO: refactor, common everywhere
  readonly UINT64_MAX: bigint = (1n << 64n) - 1n
  readonly UINT65: bigint = 1n << 64n

  private urbg: UniformRandomBitGenerator<State, Value>
}
