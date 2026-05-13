import { SplitMix64 } from "src/stochastic"

export class Shi7 {
  constructor(options?: Options) {
    if (options?.hashBitSize) {
      const hbs = options.hashBitSize

      if (hbs < 64 || hbs > 1024 || ((hbs & (hbs - 1)) !== 0))
        throw new Error('invalid hash bit size')
    }

    this.seed_ = new SplitMix64(options?.seed).state()
    this.hashBitSize_ = options?.hashBitSize ?? 256
  }

  seed() {
    return this.seed_
  }

  hashBitSize() {
    return this.hashBitSize_
  }

  private seed_?: bigint
  private hashBitSize_?: number
}

type Options = {
  seed?: bigint
  hashBitSize?: number
}
