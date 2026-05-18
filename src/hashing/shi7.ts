import { SplitMix64 } from "src/stochastic"
import { SPD } from "src/transcoding"

export class Shi7 {
  constructor(options?: Options) {
    this.seed_ = options?.seed ?? new SplitMix64().state()


    this.hashBitSize_ = options?.hashBitSize ?? 256
  }

  hashBitSize() {
    return this.hashBitSize_
  }

  seed() {
    return this.seed_
  }

  highSPD(): Readonly<SPD> {
    return this.highSPD_ = this.highSPD_ ?? new SPD('high', { kind: 'seed', seed: this.seed_ })
  }

  private seed_: bigint
  private hashBitSize_: number
  private highSPD_?: SPD
}

type Options = {
  seed?: bigint,
  hashBitSize?: 64 | 128 | 256 | 512 | 1024
}
