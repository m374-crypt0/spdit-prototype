export class SplitMix64 {
  constructor(state: bigint) {
    this.state_ = state & ((1n << 64n) - 1n)
  }

  state() { return this.state_ }

  private state_: bigint
}
