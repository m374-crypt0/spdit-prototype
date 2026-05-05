import { SplitMix64, type SeedGenerator } from "./seedGenerators";

/**
 * The generic type for uniform random bits generator
 * @template State the type of the state of the uniform random bits generator
 * @template Value the value type of uniform random bits generator output
 */
export type UniformRandomBitGenerator<State, Value> = {
  state: () => State,
  newValue: () => Value
}

/**
 * The implementation of the Xoroshiro128+ uniform random bits generator.
 * Has two 64 bits sized unsigned integer as state and produces 64 bits sized unsigned integers
 * @implements UniformRandomBitGenerator
 */
export class Xoroshiro128Plus implements UniformRandomBitGenerator<[bigint, bigint], bigint> {
  /**
   * Constructs a new instance of Xoroshiro128Plus using an optional user
   * provided seed generator instance
   * @param [seedGenerator=undefined] if provided used it to initialize the
   * initial state of this uniform random bits generator. If not provided, a
   * default SplitMix64 seed generator is used
   */
  constructor(seedGenerator?: SeedGenerator<bigint>) {
    const g = seedGenerator ?? new SplitMix64()

    this.state_ = [g.newSeed(), g.newSeed()]
  }

  /**
   * returns a copy of this uniform random bits generator state
   * @returns a copy of the two 64 bits sized unsigned integer values
   */
  state() {
    return this.state_.slice() as [bigint, bigint]
  }

  /**
   * Produces a new 64 bits sized unsigned integer computed from the state
   * then, update the state
   * @returns a new random value fitting in a 64 bits sized unsigned integer
   */
  newValue() {
    let [s0, s1] = this.state_

    const result = (s0 + s1) & this.UINT64_MAX

    const t = s1 ^ s0

    s0 = this.rotl(s0, 55n) ^ t ^ ((t << 14n) & this.UINT64_MAX)
    s1 = this.rotl(t, 36n)

    this.state_ = [s0, s1]

    return result;
  }

  /**
   * The maximum value for a generated value
   */
  readonly UINT64_MAX = (1n << 64n) - 1n

  private rotl(x: bigint, k: bigint) {
    return ((x << k) | (x >> (64n - k))) & this.UINT64_MAX
  }

  private state_: [bigint, bigint]
}
