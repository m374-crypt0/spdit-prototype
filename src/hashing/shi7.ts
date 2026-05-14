import { SplitMix64 } from "src/stochastic"
import { SPD, Transcoder } from "src/transcoding"

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

  // FIXME: tell don't ask violation (see in test)
  spd(): Readonly<SPD> {
    this.spd_ = this.spd_ ?? new SPD('high', { kind: 'seed', seed: this.seed_ })

    return this.spd_
  }

  maxHashValue() {
    return (1n << BigInt(this.hashBitSize())) - 1n
  }

  hash(message: Readonly<Buffer<ArrayBuffer>>) {
    if (message.byteLength === 0)
      return BigInt(`0x${this.emptyHash()?.toHex()}`)

    return 0n
  }

  private emptyHash(message?: Buffer<ArrayBuffer>): Readonly<Buffer<ArrayBuffer>> {
    const t = new Transcoder({ highSPD: this.spd() })

    message = message ?? this.spd().readonlyBufferView()

    if (message.byteLength === this.hashBitSize() / 8)
      return message

    return this.emptyHash(t.decode(message))
  }

  private seed_: bigint
  private hashBitSize_: number
  private spd_?: SPD
}

type Options = {
  seed?: bigint
  hashBitSize?: number
}
