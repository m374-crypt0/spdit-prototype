import type { UniformUintDistribution } from "./distributions"

export function shuffleArray<T>(array: ArrayLike<T>, distribution: UniformUintDistribution<bigint>) {
  const a = Array.from(array)
  const length = a.length

  Array
    .from({ length }, () => Number(distribution.newUint([0n, BigInt(length - 1)])))
    .forEach((v, i) => {
      const tmp = a[i]!
      a[i] = a[v]!
      a[v] = tmp
    })

  return a
}

export function shuffleBuffer(buffer: Buffer<ArrayBufferLike>, distribution: UniformUintDistribution<bigint>) {
  const b = Buffer.from(buffer)
  const length = b.byteLength

  Array
    .from({ length }, () => Number(distribution.newUint([0n, BigInt(length - 1)])))
    .forEach((v, i) => {
      const tmp = b[i]!
      b[i] = b[v]!
      b[v] = tmp
    })

  return b
}
