import type { UniformRandomBitGenerator } from "./uniformRandomBitGenerators";

export class UniformUint64<State, Value> {
  constructor(urbg: UniformRandomBitGenerator<State, Value>) { }

  newUint64(range: [bigint, bigint]) {
    const [first, last] = range

    if ((last & this.UINT64_MAX) != last || (first & this.UINT64_MAX) != first)
      throw new Error('range overflow uint64')

    return 11n;
  }

  // TODO: refactor, common everywhere
  readonly UINT64_MAX: bigint = (1n << 64n) - 1n
}
