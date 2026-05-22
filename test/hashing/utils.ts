import { UniformUint64 } from "src/stochastic";

export function bitwiseDiffusion(a: bigint, b: bigint) {
  const [_, max] = a < b ? [a, b] : [b, a]
  let bitCount = 0; for (let x = max; x > 0n; x >>= 1n, bitCount++);
  let distance = 0; for (let xor = a ^ b; xor > 0n; xor &= xor - 1n, distance++);

  return distance / bitCount
}

export function generateRandomUniqueMessages(options: GenerateRandomMessagesOptions) {
  const { minSize, maxSize } = { minSize: BigInt(options.minSize), maxSize: BigInt(options.maxSize) }
  const messageSet = new Set<string>
  const d = new UniformUint64

  for (let i = 0; i < options.maxCount; i++) {
    const length = Number(d.newUint([minSize, maxSize]))
    const a = Array.from({ length }, () => Number(d.newUint([0n, 255n])))
    const s = a.reduce((acc, cur) => `${acc}${String.fromCharCode(cur)}`, '')
    messageSet.add(s)
  }

  const messages = new Array<Readonly<Buffer<ArrayBuffer>>>
  messageSet.values().forEach(m => messages.push(Buffer.from(m)))

  return messages
}

type GenerateRandomMessagesOptions = {
  minSize: number,
  maxSize: number,
  maxCount: number
}
