import { UniformUint64DistributionEngine, type UniformUintDistributionEngine } from "./distributionEngines"

/**
 * Utility representing a random access writeable storage.
 * Kind of ArrayLike, but mutable
 */
export type RandomAccessStorage<T = unknown> = {
  [key: number]: T
}

/**
 * Shuffles an array in place, modifying the array passed in argument using an
 * optional random unsigned integer distribution engine
 * @param array the array to shuffle in place
 * @param [distribution=new UniformUintDistribution<bigint>] if specified, this
 * algorithm will use this engine to shuffle the array, otherwise create its
 * own using a pseudo-random seed
 */
export const shuffleArray = <T>(array: Array<T>, distribution?: UniformUintDistributionEngine<bigint>) =>
  shuffleStorage(array.length, array, distribution)

/**
 * Shuffles a buffer in place, modifying the buffer passed in argument using an
 * optional random unsigned integer distribution engine
 * @param buffer the array to shuffle in place
 * @param [distribution=new UniformUintDistribution<bigint>] if specified, this
 * algorithm will use this engine to shuffle the buffer, otherwise create its
 * own using a pseudo-random seed
 */
export const shuffleBuffer = (buffer: Buffer<ArrayBufferLike>, distribution?: UniformUintDistributionEngine<bigint>) =>
  shuffleStorage(buffer.byteLength, buffer, distribution)

function shuffleStorage(length: number, storage: RandomAccessStorage, distribution?: UniformUintDistributionEngine<bigint>) {
  Array
    .from({ length }, () =>
      Number((distribution ?? new UniformUint64DistributionEngine).newUint([0n, BigInt(length - 1)])))
    .forEach((v, i) => {
      const tmp = storage[i]!
      storage[i] = storage[v]!
      storage[v] = tmp
    })
}
