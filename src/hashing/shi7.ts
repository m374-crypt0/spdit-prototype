import { SplitMix64 } from "src/stochastic"
import { SPD, Transcoder } from "src/transcoding"

export class Shi7 {
  constructor(options?: Options) {
    if (options?.hashBitSize !== undefined) {
      const hbs = options.hashBitSize

      if (hbs < 64 || hbs > 1024 || ((hbs & (hbs - 1)) !== 0))
        throw new Error('invalid hash bit size')

      this.hashBitSize_ = hbs
    }

    this.seed_ = options?.seed ?? new SplitMix64().state()
  }

  seed() {
    return this.seed_
  }

  hashBitSize() {
    return this.hashBitSize_
  }

  // FIXME: tell don't ask violation (see in test)
  spd(): Readonly<SPD> {
    this.spd_ = this.spd_ ?? new SPD('high', { kind: 'seed', seed: this.seed_ })

    return this.spd_
  }

  maxHashValue() {
    return (1n << BigInt(this.hashBitSize())) - 1n
  }

  hash(message: Readonly<Buffer<ArrayBuffer>>): bigint {
    if (message.byteLength === 0)
      // NOTE: pre-image attack resistance by subtracting 1n
      return BigInt.asUintN(this.hashBitSize(), this.hash(this.spd().readonlyBufferView()) - 1n)

    const t = new Transcoder({ highSPD: this.spd() })

    if (message.byteLength <= this.hashBitSize() / 8) {
      // NOTE: pre-image attack resistance by subtracting 1n
      return BigInt(`0x${message.toHex()}`) - 1n
    }

    return this.hash(t.decode(message))
  }

  private seed_: bigint
  private hashBitSize_: number = 256
  private spd_?: SPD
}

type Options = {
  seed?: bigint
  hashBitSize?: number
}
