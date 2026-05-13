import { SplitMix64 } from "src/stochastic"

export class Shi7 {
  constructor(seed?: bigint) {
    this.seed_ = seed ?? new SplitMix64().state()
  }

  seed() {
    return this.seed_
  }

  private seed_?: bigint
}
