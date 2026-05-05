/**
 * A generic type for a seed generator
 */
export type SeedGenerator<T> = {
  /**
   * get the state of this seed generator instance
   * @returns the state of this seed generator
   */
  state: () => T

  /**
   * Produces a new seed from the internal state of the seed generator
   * @returns a new seed
   */
  newSeed: () => T
}

/**
 * An implementation of the SplitMix64 seed generator. Produces 64 bits sized
 * seeds to be used within an uniform random bits generator.
 * @implements SeedGenerator<bigint>
 */
export class SplitMix64 implements SeedGenerator<bigint> {
  /**
   * Constructs a new instance of the seed generator using an optional user
   * provided state.
   * @param [state=undefined] If provided, use this state as initial state of
   * the seed generator. If not provided, create a state from the Math.random
   * built-in fitting into a 64 bits sized unsigned integer
   */
  constructor(state?: bigint) {
    const s = state ?? BigInt(Math.random().toFixed(20).slice(2))
    this.state_ = s & this.UINT64_MAX
  }

  /**
   * Gets the current state of this seed generator
   * @returns the current state of the seed generator
   */
  state() { return this.state_ }

  /**
   * Creates a new seed from the seed generator state then, update the seed
   * generator state for subsequent seed generation
   * @returns A new 64 bits sized seed
   */
  newSeed() {
    let z = this.state_ += 0x9E3779B97F4A7C15n
    z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & this.UINT64_MAX
    z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & this.UINT64_MAX
    z = (z ^ (z >> 31n)) & this.UINT64_MAX

    return z
  }

  private readonly UINT64_MAX: bigint = (1n << 64n) - 1n
  private state_: bigint
}
