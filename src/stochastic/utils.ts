import { UniformUint64, type UniformUintDistribution } from "./distributions"

export function shuffleArray<T>(array: Array<T>, distribution?: UniformUintDistribution<bigint>) {
  const length = array.length
  const d = distribution ?? new UniformUint64

  Array
    .from({ length }, () => Number(d.newUint([0n, BigInt(length - 1)])))
    .forEach((v, i) => {
      const tmp = array[i]!
      array[i] = array[v]!
      array[v] = tmp
    })
}

export function shuffleBuffer(buffer: Buffer<ArrayBufferLike>, distribution?: UniformUintDistribution<bigint>) {
  const length = buffer.byteLength
  const d = distribution ?? new UniformUint64

  Array
    .from({ length }, () => Number(d.newUint([0n, BigInt(length - 1)])))
    .forEach((v, i) => {
      const tmp = buffer[i]!
      buffer[i] = buffer[v]!
      buffer[v] = tmp
    })
}
