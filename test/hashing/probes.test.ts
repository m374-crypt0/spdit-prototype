import { describe, expect, it } from "bun:test";
import { Shi7, type SupportedHashBitSize } from "src/hashing";

/**
 * M2 — narrow-pipe decode-tree collision (cryptanalysis finding M2).
 *
 * `decodeMessageUntilSizeInBytes` reduces a message to the hash width through a
 * chain of 2→1 byte `decode` calls with NO cross-position interaction inside a
 * layer. For a message whose decode tree has depth ≥ 2, every byte of the
 * pre-shuffle intermediate buffer is the root of an INDEPENDENT subtree fed by a
 * fixed, seed-independent input window. Varying only that window perturbs exactly
 * one output byte, so a full same-length hash collision reduces to a birthday on a
 * single byte (256 values) — ~2⁴ trials, guaranteed under 257 by pigeonhole, vs
 * the ~2¹²⁸ a 256-bit hash should require.
 *
 * This suite verifies M2 (it does not test a fix — none exists yet). See
 * `docs/cryptanalysis-shi7-m2.md` for the full write-up and risk scenarios.
 */

const captureIntermediate = (seed: bigint, hashBitSize: SupportedHashBitSize = 256) => {
  let last: Readonly<Buffer<ArrayBuffer>> | undefined
  const shi7 = new Shi7({ seed, hashBitSize, recordIntermediateBuffer: b => { last = b } })

  return { shi7, intermediate: () => last! }
}

const changedBytePositions = (a: Readonly<Buffer<ArrayBuffer>>, b: Readonly<Buffer<ArrayBuffer>>) => {
  const positions: number[] = []
  for (let i = 0; i < a.byteLength; i++)
    if (a[i] !== b[i]) positions.push(i)

  return positions
}

describe('M2 — narrow-pipe decode-tree collision', () => {
  // The attack is structural, not a property of one key — it must hold for every
  // seed. A handful of fixed seeds keeps the suite deterministic and non-flaky.
  const SEEDS = [0xC0FFEEn, 0x1234n, 0xDEADBEEFn, 0n, 0xA5A5A5A5A5A5A5A5n]

  describe('the naive count-distinct probe is vacuous at depth 0 (negative control)', () => {
    // hashBitSize=256 → a 32-byte message never enters the decode loop (33 < 32·2):
    // the intermediate buffer is [decode(domain, msg[0]), msg[1..31]] — byte 0 is
    // injective in msg[0] and bytes 1..31 are the input verbatim. The map is
    // injective, so "count distinct intermediate buffers ≈ input count" holds
    // regardless of any security property. The experiment originally suggested for
    // M2 (cryptanalysis-shi7.md §4.7 / line 622) can therefore ONLY ever report
    // "no collapse" — a pass here is NOT evidence the narrow pipe is safe.

    it('the 32-byte intermediate map is injective (the probe can never collapse)', () => {
      const { shi7, intermediate } = captureIntermediate(0xC0FFEEn)
      const distinct = new Set<string>()
      const count = 10_000

      for (let i = 0; i < count; i++) {
        const m = Buffer.alloc(32)
        m[1] = i & 0xff; m[2] = (i >> 8) & 0xff; m[3] = (i >> 16) & 0xff
        shi7.hash(m)
        distinct.add(intermediate().toHex())
      }

      expect(distinct.size).toBe(count)
    })

    it('a 32-byte message never enters the decode loop (tail passes through verbatim)', () => {
      const { shi7, intermediate } = captureIntermediate(0xC0FFEEn)
      const m = Buffer.alloc(32)
      for (let i = 0; i < 32; i++) m[i] = (i * 9 + 1) & 0xff

      shi7.hash(m)

      // intermediate bytes 1..31 are message bytes 1..31, untouched
      expect(intermediate().subarray(1).toHex()).toBe(m.subarray(1).toHex())
    })
  })

  describe('the depth-≥2 structured attack (the live M2 vulnerability)', () => {
    // hashBitSize=256, 127-byte message: + 1 domain byte → 128 bytes → two full
    // decode rounds (128→64→32), a depth-2 tree (the final step is a no-op). Output
    // byte i then depends only on input bytes [4i, 4i+4); output byte 1 ← message
    // bytes [3, 7).
    const HASH_BIT_SIZE = 256
    const MESSAGE_SIZE = 127
    const WINDOW_START = 3       // message byte indices feeding intermediate output byte 1
    const WINDOW_END = 7         // exclusive
    const TARGET_OUTPUT_BYTE = 1
    // Pigeonhole: ≤ 257 distinct window values force a collision on a 256-valued
    // output byte. Budget sits well above that yet astronomically below 2¹²⁸.
    const SEARCH_BUDGET = 4096

    const baseMessage = () => Buffer.alloc(MESSAGE_SIZE, 0x42)

    for (const seed of SEEDS) {
      const label = `0x${seed.toString(16)}`

      it(`per-subtree independence: window [${WINDOW_START},${WINDOW_END}) feeds only output byte ${TARGET_OUTPUT_BYTE} (seed=${label})`, () => {
        const { shi7, intermediate } = captureIntermediate(seed, HASH_BIT_SIZE)
        shi7.hash(baseMessage())
        const base = Buffer.from(intermediate())

        const touched = new Set<number>()
        for (const delta of [0x01, 0x7f, 0xaa, 0xff]) {
          const m = baseMessage()
          for (let k = WINDOW_START; k < WINDOW_END; k++) m[k] = m[k]! ^ delta
          shi7.hash(m)
          changedBytePositions(base, intermediate()).forEach(p => touched.add(p))
        }

        // varying the window changes output byte 1 — and nothing else
        expect([...touched].sort((x, y) => x - y)).toEqual([TARGET_OUTPUT_BYTE])
      })

      it(`yields a same-length full-hash collision far below the birthday bound (seed=${label})`, () => {
        const { shi7 } = captureIntermediate(seed, HASH_BIT_SIZE)
        const base = baseMessage()
        const seen = new Map<string, Buffer<ArrayBuffer>>()
        let collision: [Buffer<ArrayBuffer>, Buffer<ArrayBuffer>] | undefined
        let trials = 0

        // Black-box attack: vary ONLY the isolated window, watch the FINAL hash.
        // No seed/SPD knowledge and no intermediate-buffer hook are used here.
        for (let i = 0; i < SEARCH_BUDGET && !collision; i++) {
          trials++
          const m = Buffer.from(base)
          m[3] = (i * 7) & 0xff
          m[4] = (i * 131) & 0xff
          m[5] = (i * 17 + 5) & 0xff
          m[6] = (i >> 8) & 0xff

          const digest = shi7.hash(m).toString(16)
          const previous = seen.get(digest)
          if (previous && !previous.equals(m)) collision = [previous, Buffer.from(m)]
          else seen.set(digest, Buffer.from(m))
        }

        expect(collision).toBeDefined()
        const [a, b] = collision!

        expect(a.equals(b)).toBe(false)                 // two distinct messages...
        expect(a.byteLength).toBe(b.byteLength)         // ...of the same length...
        expect(shi7.hash(a)).toBe(shi7.hash(b))         // ...with the same hash
        // ...differing only inside the isolated window
        expect(changedBytePositions(a, b).every(p => p >= WINDOW_START && p < WINDOW_END)).toBe(true)
        // catastrophically cheap: pigeonhole guarantees ≤ 257, vs the ~2¹²⁸ bound a
        // 256-bit hash should require (the search typically finds it in ~20 trials)
        expect(trials).toBeLessThanOrEqual(257)
      })
    }
  })
})
