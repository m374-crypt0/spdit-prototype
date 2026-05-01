import { SplitMix64, type SeedGenerator } from "./seedGenerators";

export type UniformRandomBitGenerator<State, Value> = {
  state: () => State,
  newValue: () => Value
}

export class Xoroshiro128Plus implements UniformRandomBitGenerator<[bigint, bigint], bigint> {
  constructor(seedGenerator?: SeedGenerator<bigint>) {
    const g = seedGenerator ?? new SplitMix64()

    this.state_ = [g.newSeed(), g.newSeed()]
  }

  state() {
    return this.state_.slice() as [bigint, bigint]
  }

  newValue() {
    let [s0, s1] = this.state_

    const result = (s0 + s1) & this.UINT64_MAX

    const t = s1 ^ s0

    s0 = this.rotl(s0, 55n) ^ t ^ ((t << 14n) & this.UINT64_MAX)
    s1 = this.rotl(t, 36n)

    this.state_ = [s0, s1]

    return result;
  }

  readonly UINT64_MAX: bigint = (1n << 64n) - 1n

  private rotl(x: bigint, k: bigint) {
    return ((x << k) | (x >> (64n - k))) & this.UINT64_MAX
  }

  private state_: [bigint, bigint]
}
