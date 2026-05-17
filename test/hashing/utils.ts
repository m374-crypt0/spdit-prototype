export function bitwiseDiffusion(a: bigint, b: bigint) {
  const [_, max] = a < b ? [a, b] : [b, a]
  let bitCount = 0; for (let x = max; x > 0n; x >>= 1n, bitCount++);
  let distance = 0; for (let xor = a ^ b; xor > 0n; xor &= xor - 1n, distance++);

  return distance / bitCount
}
