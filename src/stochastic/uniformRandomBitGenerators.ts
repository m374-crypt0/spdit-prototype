import type { SeedGenerator } from "./seedGenerators";

export class Xoroshiro128Plus {
  constructor(seedGenerator: SeedGenerator<bigint>) {
    this.state_ = [seedGenerator.newSeed(), seedGenerator.newSeed()]
  }

  state() {
    return this.state_.slice()
  }

  private state_: [bigint, bigint]
}
