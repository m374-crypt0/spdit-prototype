export type SeedGenerator<T> = {
  state: () => T
  newSeed: () => T
}

export class SplitMix64 implements SeedGenerator<bigint> {
  constructor(state?: bigint) {
    const s = state ?? BigInt(Math.random().toFixed(20).slice(2))
    this.state_ = s & this.UINT64_MAX
  }

  state() { return this.state_ }
  newSeed() {
    let z = this.state_ += 0x9E3779B97F4A7C15n
    z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & this.UINT64_MAX
    z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & this.UINT64_MAX
    z = (z ^ (z >> 31n)) & this.UINT64_MAX

    return z
  }

  readonly UINT64_MAX: bigint = (1n << 64n) - 1n

  private state_: bigint
}
