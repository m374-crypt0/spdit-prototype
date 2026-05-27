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

// NOTE: Regarding the H3 finding in cryptanalysis, using the Fisher-Yates
// shuffle instead of the naive one to ensure uniform shuffle
function shuffleStorage(length: number, storage: RandomAccessStorage, distribution?: UniformUintDistributionEngine<bigint>) {
  const d = distribution ?? new UniformUint64DistributionEngine
  for (let i = length - 1; i > 0; i--) {
    const j = Number(d.newUint([0n, BigInt(i)]))
    const tmp = storage[i]; storage[i] = storage[j]; storage[j] = tmp
  }
}
