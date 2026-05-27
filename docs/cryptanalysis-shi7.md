# Cryptanalysis of Shi7

Independent structural review of `src/hashing/shi7.ts` and its dependencies
(`src/transcoding`, `src/stochastic`), against the design intent stated in
`draft/how-to-start.md` and `docs/glossary.md`.

> [!IMPORTANT]
> This is a static review by another reader, not a proof. Findings flagged as
> *static* should be considered hypotheses to reproduce; findings flagged as
> *verified* were spot-checked by running probe scripts against the current
> implementation. None of this constitutes a positive security claim — the
> absence of a finding does not mean the construction is safe.
> [!NOTE]
> Probe scripts used to generate this report have been removed because of their
> temporary meaning. To ensure a finding is *verifier*, one must create a probe
> script to assess the fix regarding this finding.

## 0. Threat model assumed

Inferred from `draft/how-to-start.md` and `docs/glossary.md`:

- Shi7 is a **keyed hash** (a MAC, really): the `seed` may be secret or not and
  produces the high SPD via a deterministic derivation chain (`SplitMix64` →
  `Xoroshiro128+` → SPD generation).
- The high SPD is the actual cryptographic state; the seed is only its
  compressed representation.
- Stated goal: information-theoretically secured (ITS), quantum-immune,
  collision/pre-image/diffusion guarantees comparable to a conventional hash.
- Stated non-goal: memory-hardness. Performance matters.

This review takes the design at its word and asks: *given the stated threat
model, what attacks does the construction admit?*

## 1. Executive summary

| ID  | Severity   | Issue                                                                   |
|-----|------------|-------------------------------------------------------------------------|
| C1  | Critical   | Small-message hashes are exactly **half the advertised hashBitSize**    |
| C2  | Critical   | Default seed has ≤52 bits of entropy from an insecure PRNG              |
| H1  | High       | Seed/key space is 64 bits — defeats both ITS and post-Grover claims     |
| H2  | High       | `preSeed` and `preHash` buffers alias for hashBitSize ≤ 128 small msgs  |
| H3  | High       | `shuffleStorage` is the *naive* shuffle, not Fisher-Yates — biased      |
| M1  | Medium     | SPD `overwriteFewValuesInAllLanes` destroys uniform distribution and admits a rare runtime crash |
| M2  | Medium     | Decode is a 2→1 byte tree → narrow-pipe diffusion before the final shuffle |
| M3  | Medium     | No domain separation between the four dispatch paths                    |
| M4  | Medium     | "decoded-message vs message" collision avoidance is a structural patch, not an invariant |
| L1  | Low        | Empty-message hash can be `-1n` (all-zero `hashBuffer`)                 |
| L2  | Low        | `hashMessageSizedBetweenSeedAndHash` is unreachable when hashBitSize=64 |
| L3  | Low        | Empty-message hash depends only on the high SPD, not on the SplitMix64 seedGenerator chain |

The two Critical items are both reproducible with one-shot probes (see §3).
The High items are structural and would need redesign to address. The Medium
items concern the *quality* of diffusion and the surface for principled
analysis. The Low items are mostly cosmetic.

## 2. Methodology and scope

What I did:

- Read `Shi7`, `Transcoder`, `SPD`, the `stochastic/*` PRNG stack, and the
  test suite (`test/hashing/*`).
- Traced each of the four hash dispatch paths (empty / small / mid / big) on
  paper for hashBitSize ∈ {64, 128, 256, 512, 1024}.
- Ran two small probe scripts to confirm the most structural findings.
- Cross-referenced the implementation against the design notes in
  `draft/how-to-start.md`.

What I did **not** do:

- Run a statistical battery (NIST SP 800-22, dieharder, PractRand,
  TestU01 BigCrush) against the output stream.
- Attempt key recovery numerically.
- Attempt differential cryptanalysis (e.g., choose related-key pairs and
  measure output bias) — only the byte-flip diffusion mean was inspected,
  which is what the test suite already covers.
- Formalize a security game (collision-resistance, PRF-ness) and reduce shi7
  to it.

These would all be valuable next steps.

## 3. Detailed findings

### C1 — Small-message output is half the advertised `hashBitSize` *(verified)*

**Where:** `src/hashing/shi7.ts` `encodePreSeedToPreHash` (around line 117).

**What happens.** For the small-message path (`hashSmallerThanSeedMessage`),
`preHash` is grown only until `preHash.byteLength >= hashBitSize/8`. The final
step of `hashMessage` is `decode(preHash)`, which **halves** the buffer size
(2 input bytes → 1 output byte). Therefore the returned `hashBuffer` is
`hashBitSize/16` bytes, i.e. `hashBitSize/2` bits.

Compare to the other two paths, where `preHash` is explicitly grown to
`hashBitSize/8 * DIMENSIONAL_FACTOR` bytes before the final decode — so the
final hash is `hashBitSize/8` bytes as intended.

**Verified empirically** (against the current code, 200 random seeds, 8-byte
message input):

```
hashBitSize=64    max observed = 64 bits  / 8 bytes   (expected 64  bits / 8 bytes)   OK
hashBitSize=128   max observed = 64 bits  / 8 bytes   (expected 128 bits / 16 bytes)  HALF
hashBitSize=256   max observed = 128 bits / 16 bytes  (expected 256 bits / 32 bytes)  HALF
hashBitSize=512   max observed = 256 bits / 32 bytes  (expected 512 bits / 64 bytes)  HALF
hashBitSize=1024  max observed = 512 bits / 64 bytes  (expected 1024 bits / 128 bytes) HALF
```

**Impact.** Collision resistance for small messages (1–8 bytes) is at most
`2^(hashBitSize/4)` (birthday bound), not `2^(hashBitSize/2)` as advertised.
For hashBitSize=256, that's 2^64 collision work instead of 2^128 — a 2^64×
overstatement.

**Why the existing test suite misses it.** The collision tests use
`generateRandomUniqueMessages({ maxCount: 100 })`; at 100 samples even a
64-bit space has effectively zero collision probability. The diffusion tests
compute `bitwiseDiffusion(a, b)` with `bitCount(max(a, b))` as the
denominator — so the diffusion ratio normalizes against the actual hash
width, hiding the fact that two "256-bit" hashes are really 128-bit.

**Fix.** In `encodePreSeedToPreHash`, change the target to
`hashBitSize / 8 * SPD.DIMENSIONAL_FACTOR`, matching the other paths.

```ts
// in encodePreSeedToPreHash
while (preHash.byteLength < this.hashBitSize() / Shi7.BYTE_BITS * SPD.DIMENSIONAL_FACTOR)
  preHash = this.transcoder().encode(preHash, { seed: seedGenerator.newSeed() })
```

After this fix the tests will still pass; you'll just be getting the security
you thought you had.

---

### C2 — Default seed has ≤52 bits of entropy from a non-cryptographic PRNG *(verified)*

**Where:** `src/stochastic/seedGenerators.ts` `SplitMix64` constructor:

```ts
const s = state ?? BigInt(Math.random().toFixed(20).slice(2))
this.state_ = s & this.UINT64_MAX
```

**What happens.** `Math.random()` returns a 64-bit-precision IEEE-754
`double` whose mantissa is **52 bits**. There are at most 2^52 ≈ 4.5×10^15
distinct outputs. The `toFixed(20).slice(2)` formatting expands that to 20
decimal digits, but **digits past ~16 are decimal-conversion noise from the
double's binary representation, not entropy from the source**. Masking to
`UINT64_MAX` does not synthesize new entropy.

Additionally, V8's `Math.random()` (which bun shares) is **not a CSPRNG**.
It is `xorshift128+`. Its 128-bit state can be recovered from a few
observations of the output — there is published tooling for this. So in any
context where an adversary sees one shi7 hash (or any other
`Math.random()`-derived value) from the same process, the default seed
becomes observable.

**Impact.**

- 2^52 distinct default seeds → 2^52 distinct high SPDs → keyspace is
  enumerable on commodity hardware in days, on a small cluster in hours.
- Recovery of the V8 PRNG state from any observed output reduces this to
  trivial.
- This is a **silent** flaw: callers who write `new Shi7()` reasonably
  expect the seed to be "random."

**Fix.** Use `crypto.getRandomValues` (Web Crypto API, available in bun) or
`crypto.randomBytes` (Node compat) to generate 8 (better: 32) bytes of
CSPRNG output, then interpret as `bigint`:

```ts
import { randomBytes } from 'node:crypto'

const buf = randomBytes(8)
const s = state ?? (new DataView(buf.buffer).getBigUint64(0) & UINT64_MAX)
```

This change is mechanical, ~3 lines.

---

### H1 — 64-bit seed/key space defeats both ITS and post-Grover claims *(static)*

**Where:** the seed is a `bigint`, masked to 64 bits everywhere
(`SplitMix64`, `Xoroshiro128+`, the SPD constructor, `Transcoder` encoding
options). The entire high SPD is a deterministic function of this 64-bit
value.

**What this means.** The "information-theoretically secured" framing in
`docs/glossary.md` defines ITS as security against adversaries with
unbounded computational resources. A construction whose entire keyed
behavior is a deterministic function of a 64-bit value cannot be ITS in
this sense: an unbounded adversary just enumerates 2^64 seeds, computes the
corresponding SPD, and confirms which one matches the observed outputs.
Done.

The framing in the README ("immune to Grover's algorithm") also requires
care. Grover gives a quadratic speedup on unstructured search. To resist
Grover at the **128-bit classical security level**, the secret must have at
least **256 bits** of entropy. A 64-bit seed under Grover takes 2^32
operations — milliseconds on a future fault-tolerant quantum computer.

Note that this is a stronger statement than C2: even if the *defaulting*
were fixed to a CSPRNG, the seed *itself* is still 64 bits wide because
the downstream PRNGs are 64-bit. So the keyspace ceiling is structural.

**Impact.** The two security claims most prominent in the glossary and
README cannot both hold under the current construction. You can have:

- a 64-bit-keyed prototype that is fast and small, *or*
- an ITS / post-Quantum-secure construction, but it needs a wider key and
  a different PRNG stack (or no PRNG stack at all, in the strictly-ITS
  case).

You cannot have both with this architecture.

**Fix (sketch).** Widen the seed type and the SplitMix64/Xoroshiro stack
to operate over a state ≥ 256 bits — e.g. use `xoshiro256**` (256-bit
state). Or, for ITS, treat the high SPD itself as the key (64 KiB of true
randomness, never derived from a seed) and remove the seed-as-key abstraction.

This is the **single biggest design question** for the C++ port, in my view.

---

### H2 — `preSeed` and `preHash` buffer aliasing for small messages, hashBitSize ≤ 128 *(static, with verified-adjacent evidence from C1)*

**Where:** `hashSmallerThanSeedMessage` calls
`encodePreSeedToPreHash(preSeed, ...)`. For hashBitSize ∈ {64, 128} the
`while` loop in `encodePreSeedToPreHash` never executes (because `preSeed`
is already 16 bytes ≥ `hashBitSize/8`), so `preHash` is **the same buffer
reference** as `preSeed`.

`hashMessage` then:

1. `shuffleBuffer(preSeed, …)` — mutates the buffer in place.
2. `decode(preSeed)` → `seedBuffer`.
3. Derive `preHashSeedGenerator` from `seedBuffer`.
4. `shuffleBuffer(preHash, …)` — mutates the **same** buffer again.
5. `decode(preHash)` → final hash.

So the final hash is essentially `decode(shuffle2(shuffle1(preSeed)))`,
where `shuffle2`'s entropy source is derived from
`decode(shuffle1(preSeed))`. The "two independent halves of the hash"
mental model breaks: there is only one buffer, shuffled twice, with the
second shuffle's parameters causally dependent on the first.

**Impact.** Beyond C1 (the output size halving):

- Strong correlations between the `seedBuffer` extraction and the final
  hash. They are different byte permutations of the *same multiset of
  bytes*. The multiset has at most 16 byte values; the two hashes
  (`seedBuffer` and the final hash) are partial readings of it through
  different SPD lookups.
- An attacker who learns `seedBuffer` (e.g. via a side channel, or
  because it is exposed by some higher-level protocol) constrains the
  final hash significantly.

**Fix.** This is automatically resolved if C1 is fixed (because then
`preHash` is grown to 2× the hash size and is necessarily a fresh buffer).
Alternatively, guarantee a `preHash !== preSeed` invariant explicitly.

---

### H3 — `shuffleStorage` is the *naive shuffle*, not Fisher-Yates *(static)*

**Where:** `src/stochastic/utils.ts`:

```ts
Array
  .from({ length }, () =>
    Number((distribution ?? new UniformUint64DistributionEngine).newUint([0n, BigInt(length - 1)])))
  .forEach((v, i) => {
    const tmp = storage[i]!
    storage[i] = storage[v]!
    storage[v] = tmp
  })
```

**What's wrong.** A correct Fisher-Yates shuffle draws the i-th swap
target from `[i, length - 1]`, not from `[0, length - 1]`. The code above
is the canonical *naive shuffle*: for length `L`, it enumerates `L^L`
possible execution paths and produces only `L!` permutations. Since
`L^L / L!` is not an integer for `L ≥ 3`, the induced distribution over
permutations is **provably non-uniform**.

For `L = 3`: 27 paths over 6 permutations. Some permutations appear 5
times among 27 paths, others 4. The identity gets ~14.8% weight, the
"all-rotate" gets ~18.5%. (See Mike Bostock's well-known visualization of
this bug.)

For `L = 16` (the preSeed shuffle) the bias is small but measurable. For
larger `L` it remains structurally present — and for *adversarial*
analysis the question isn't "is the bias visible to chi-squared" but "can
the bias be exploited differentially?"

**Impact.** The shuffle is the only diffusion primitive in shi7 that
moves bytes across the decode-tree subtrees (see M2). If the shuffle is
biased, some output-byte positions are more likely to receive certain
input bytes than others — which is exactly the kind of structure
differential cryptanalysis exploits.

**Fix.** Use Fisher-Yates:

```ts
function shuffleStorage(length, storage, distribution) {
  const d = distribution ?? new UniformUint64DistributionEngine
  for (let i = length - 1; i > 0; i--) {
    const j = Number(d.newUint([0n, BigInt(i)]))
    const tmp = storage[i]; storage[i] = storage[j]; storage[j] = tmp
  }
}
```

The change is also one-shot and small.

---

### M1 — `overwriteFewValuesInAllLanes` destroys uniform value distribution; can crash *(static)*

**Where:** `src/transcoding/spd.ts`:

```ts
private overwriteFewValuesInAllLanes(d: UniformUint64) {
  Iterator.from(this).forEach((_, i) => {
    // ...
    Array.from({ length: Number(d.newUint([BigInt(this.laneSize / 2), BigInt(this.laneSize)])) }, () =>
      Number(d.newUint([0n, BigInt(this.laneSize - 1)])))
      .forEach((v, j) => {
        while ((lane[j] === lane[v]) || (j === v))
          v = (v + 1) % this.laneSize
        lane[j] = lane[v]!
      })
  })
}
```

**What happens.** After `shuffleLanes`, each lane is a permutation of
`0..laneSize-1`. This step then performs between `laneSize/2` and
`laneSize` overwrites of the form `lane[j] = lane[v]`, sequentially over
`j = 0, 1, 2, …`. Each overwrite **deletes** the value originally at
`lane[j]` and **duplicates** the value at `lane[v]`. The lane is no
longer a permutation — some byte values become more common than others,
some may disappear from the lane entirely.

For the high SPD (laneSize=256), this happens 256 times across 256
lanes. The map used during encoding,
`Map<byte, address[]>`, is built from the resulting buffer:

```ts
highSPD.readonlyBufferView().forEach((byte, i) =>
  map.set(byte, [...map.get(byte) ?? [], i]))
```

If a byte value `b` happens to be missing from the entire high SPD
(possible but rare), then `map.get(b)` returns `undefined`, and the
later non-null assertion `map.get(byte)!` will produce `undefined`, and
the call to `d.newUint([0n, BigInt(addresses.length - 1)])` becomes
`d.newUint([0n, -1n])` — which the distribution engine will reject as
`range overflow uint64` (because `max - min + 1n = 0n`), or worse,
produce undefined behavior.

I haven't worked out a tight probability estimate, but at 256 lanes × up
to 256 overwrites per lane it isn't astronomical. This is a latent
"crash some-fraction of the time" bug.

**Distributional impact (the real cryptographic concern).** Even when no
byte is wholly absent, the high SPD has byte values appearing **with
varying multiplicity**. The number of `encode` choices per byte value
varies. An attacker who observes many encoded outputs can statistically
learn the per-byte multiplicity distribution and gain information about
the SPD.

> The design notes (in `draft/how-to-start.md`) describe "double shuffle
> effort: both horizontal and vertical" as a *security* requirement. The
> current implementation does the horizontal shuffle and a transpose,
> then introduces deliberate non-uniformity. That last step seems to be
> in tension with the stated goal: a stochastic *transcoding* table is
> stronger when *every nibble/byte appears equally often*.

**Fix options.**

- Drop `overwriteFewValuesInAllLanes` entirely. The transpose +
  horizontal shuffle on a permutation is already strongly mixed.
- Or, if intentional non-uniformity is wanted as a feature, document it
  formally (what property does it provide?) and ensure no value can be
  globally absent.

---

### M2 — Decoding is a 2→1 byte tree → narrow-pipe before the final shuffle *(static)*

**Where:** `decodeMessageUntilSizeInBytes` performs a chain of `decode`
calls. Each `decode` step is `2 bytes → 1 byte` via the high SPD lookup.

**What this implies structurally.** Let `M` be a message of size
`n = 2^k · h` where `h = hashBitSize/8`. After `k` decoding rounds, byte
`i` of the result depends on exactly bytes `[2^k · i, 2^k · (i+1))` of
`M` — and on nothing else. The decode tree has **no cross-position
interaction** within a layer. Each output byte at level `k` is a
`(2^k)`-byte → `1`-byte function with at most `2^8 = 256` distinct
outputs.

By birthday, you can find **2^4 = 16** different 2-byte inputs that all
decode to the same byte. By extension, finding 2^k-byte chunks that
decode-chain to the same byte at level k is easy: ~16 random samples.

This means: if you can choose two messages that differ only inside a
single decode-tree subtree, and the differences happen to map to the
same final byte at the level-k root of that subtree, you have a
**partial internal-state collision** going into the final shuffle and
decode. The final shuffle scrambles which positions go where, but each
output byte still depends on only 2 input bytes after shuffling.

The shi7 test suite verifies bit-flip diffusion *means* are ~0.5, which
demonstrates the construction is not catastrophically broken on average,
but **mean diffusion is the weakest possible diffusion measurement**.
Cryptographic constructions are evaluated on *worst-case* diffusion
across all input differentials, not the average.

**Impact.** Internal-state collisions are likely findable in the
big-message path at far below the birthday bound on the final output.
Whether they propagate to full hash collisions depends on the shuffle's
quality (see H3 — it is biased) and on second-pre-image effects, which
the test suite measures but does not bound formally.

**Suggested experiment.** Generate ~10^6 random 32-byte messages with
hashBitSize=256; after the first decode round, count how many distinct
intermediate buffers exist among them. If the count is much lower than
the input count, the narrow pipe is biting.

A real fix would interleave the decode tree with a mixing step that
introduces cross-position interaction (e.g. a small ARX or sponge-style
absorption between decodes). At the cost of speed.

---

### M3 — No domain separation between dispatch paths *(static)*

**Where:** `Shi7.hash` dispatches to four different code paths
(`hashEmptyMessage`, `hashSmallerThanSeedMessage`,
`hashMessageSizedBetweenSeedAndHash`, `hashBiggerThanHashMessage`) by
message size alone. None of them tags the output with which path was
taken.

**Impact.** Without domain separation, cross-path collisions become a
target: find `M1 ≤ 8 bytes` and `M2 ≥ 32 bytes` that happen to flow
through their respective paths and produce the same final
`decode(shuffle(...))`. Whether such collisions exist is unclear — they
would need to navigate the very different internal structures of the
two paths — but a principled construction does not leave this open.

In particular, the empty-message path (`hashEmptyMessage`) is suspicious:
the `- 1n` patch on the output was added because the author noticed the
collision with "the explicit hash value of the underlying high SPD" (see
the design notes). The `- 1n` is a single-target fix; nothing protects
against other coincidental collisions between empty and non-empty paths.

**Fix.** Prepend a domain tag (e.g. a single byte: 0x00 for empty, 0x01
for small, 0x02 for mid, 0x03 for big) to the buffer before the final
decode. This is a one-line fix per path and eliminates an entire class
of attack.

---

### M4 — "decoded(M) vs M" collision avoidance is a structural patch, not an invariant *(static)*

**Where:** `decodeMessageUntilSizeInBytes`:

```ts
// NOTE: discarding a seed in a message decode step reduce the
// collision risk between hashing a message M and M' with M` = decoded(M)
seedGenerator.newSeed()
```

**What's going on.** The design notes openly acknowledge that without
intervention, `hash(M) = hash(decoded(M))` — because both eventually
reach the same `hashSizedBuffer`. The intervention is: burn an extra
seed from `seedGenerator` per decode iteration, so that the seeds
consumed by downstream `encode` and `shuffle` operations differ between
the two cases.

**Why this is a fragile defense.**

- The seed-burning difference for `M` vs `decoded(M)` is **exactly one
  call to `newSeed()`**. The downstream `Xoroshiro128+` chained off
  `seedGenerator` then differs by one initial 64-bit value. This *should*
  cause the shuffle and encoding to diverge dramatically, but it has not
  been formally argued, only spot-checked by the test suite's collision
  test.
- It is sensitive to refactoring: anyone tidying up the decode loop and
  removing what looks like a dead `seedGenerator.newSeed()` call
  reintroduces the collision.
- The same defense doesn't work as obviously for **higher iterations**:
  `hash(M) = hash(decoded^k(M))` for varying `k` differ by `k`
  newSeed calls, but the *pattern* of difference is regular — an
  adversary could try to find `(M1, M2)` pairs whose seed-state
  difference cancels out at a downstream step.

**Fix.** This is the same fix as M3 — domain-separate the path inputs
explicitly (e.g. prepend a counter equal to the number of decode rounds
performed). A construction that *cannot* take the same internal value
for distinct messages is stronger than one that *happens not to*.

---

### L1 — Empty-message hash can be `-1n` *(static)*

**Where:** `hashEmptyMessage`:

```ts
return this.emptyMessageHash = BigInt(`0x${hashBuffer.toHex()}`) - 1n
```

If `hashBuffer` is all-zero bytes (probability `2^-hashBitSize`, so
unobservable in practice), the returned hash is `-1n`. Non-empty
messages produce non-negative bigints. Functionally this means hashes
are typed `bigint` but can be negative.

Two observations rather than a real attack:

1. The `- 1n` was introduced to ensure `hash(empty) ≠ hash(highSPD_buffer)`
   per the design notes. But the equality it actually breaks is between
   `BigInt(decode_chain(highSPD).toHex())` and that same expression
   computed through a different code path. It does not preclude *any
   other* coincidental collision between paths (see M3). It is a
   narrow patch.
2. Some consumers may use `hash` as an unsigned identifier (Map keys,
   serializers). A negative value is at minimum surprising.

**Fix.** Drop the `- 1n` and address the underlying concern via domain
separation (M3). Alternatively, mask: `... & ((1n << BigInt(hashBitSize)) - 1n)`.

---

### L2 — `hashMessageSizedBetweenSeedAndHash` unreachable for hashBitSize=64 *(static)*

For hashBitSize=64, `hashBitSize/8 = 8 = SEED_SIZE`. The condition
`message.byteLength <= 8` catches messages of length 8, and
`message.byteLength >= 8` catches messages of length 9+. The middle
range is empty.

Not a security issue, but it is dead code at hashBitSize=64. A defensive
implementer might use `<` rather than `<=` in
`isMessageSmallerOrEqualToSeedSize` to fix the asymmetry — but that
would shift 8-byte messages from the small path to the mid path, which
introduces its own questions.

The cleanest fix is to disallow hashBitSize=64 (it's already only 64
bits of security, well below modern minimums) — or rethink the
size-threshold dispatch entirely.

---

### L3 — Empty-message hash depends only on the high SPD, never on the SplitMix64 chain *(static)*

`hashEmptyMessage` calls `decodeUnderlyingHighSPDToHash`, which uses
`simpleChainDecodeMessageUntilSizeInBytes` — that helper does **not**
take a `seedGenerator` and does not consume seeds. So the empty-message
hash is a pure function of the high SPD bytes.

Since the high SPD is itself a pure function of the seed, this is not
a direct security flaw — the empty hash still depends on the seed
*indirectly*. But it means the empty path is structurally simpler than
the others, and is the easiest target for SPD recovery: an attacker
who knows `hash(empty)` learns `decode_chain(highSPD)` exactly (minus
the `- 1n` patch). That is a tiny window into the SPD, but it's a
window the other paths do not offer.

Combine with C1 (small-message hash is half-width) and M3 (no domain
separation) and the empty path becomes an attractive analytic target.

## 4. Test suite gaps

The existing suite is, as you say, exhaustive for what it tests. Where it
fails to test:

1. **Output bit-width assertion.** No test asserts
   `hash < (1n << BigInt(hashBitSize))` or, more usefully, asserts that
   the hash *actually uses* its full output width by, e.g., observing the
   distribution of `bitLength(hash)` over many seeds and messages. This
   gap is what allowed C1 to live.
2. **Cross-path collisions.** No test asks whether
   `hash(M_small) === hash(M_mid)` or `hash(empty) === hash(M_anything)`.
3. **Cross-`hashBitSize` collisions** are likely irrelevant (different
   hashers), but cross-*size* collisions for the *same* `hashBitSize` are
   not.
4. **Statistical batteries.** Bitwise diffusion mean is one weak test.
   The suite would benefit from:
   - chi-squared on output bytes for fixed input families;
   - the standard NIST SP 800-22 / dieharder / PractRand pipelines applied
     to the concatenated output stream;
   - frequency-of-each-bit test (per-bit avalanche, not aggregate).
5. **Worst-case diffusion**, not just mean. The "bitwise diffusion mean
   in [0.45, 0.55]" tests pass for any construction with a 50% mean,
   even one with bimodal diffusion (0% on half inputs, 100% on the other
   half). Replace the mean check with a **variance** check, or with a
   stricter percentile check (e.g. "no input pair has
   `bitwiseDiffusion < 0.3`").
6. **Key-recovery scenario.** No test simulates an attacker who knows
   `(message, hash)` pairs and asks how many seeds are consistent.
   For a real keyed-hash you want this to be 1 with high probability
   given a handful of pairs.
7. **Differential trails.** No test generates input pairs that maximize
   the chance of canceling differences (e.g. pairs that differ only in
   one decode-tree subtree) and measures the diffusion specifically on
   that family.
8. **Edge-size messages.** Behavior at the exact boundaries between
   dispatch paths (8 bytes, hashBitSize/8 bytes, hashBitSize/8 + 1
   bytes) is implicit; explicit tests would have caught L2 and may
   uncover off-by-ones.
9. **SPD value-presence test.** A test that asserts every byte 0–255
   appears at least once in every freshly-generated high SPD would
   surface the M1 crash risk.

## 5. Comparison to known constructions

You may find these useful as reference points; they are not
recommendations to copy verbatim.

- **Universal hashing (Carter-Wegman, GMAC's GHASH).** These are the
  cleanest examples of "ITS-ish" keyed hashing. They give explicit
  ε-almost-universal collision bounds *independent* of computational
  power, but only against an adversary who commits to messages
  *before* seeing the key. They are not collision-resistant against an
  adversary who chooses messages after seeing the key.
- **Sponge constructions (Keccak/SHA-3).** Provide both collision and
  pre-image guarantees by absorbing message into a large internal
  state, with permutation-based mixing between absorptions. shi7's
  decode-tree is roughly analogous to absorption, but lacks the
  inter-absorption permutation step. Adding one (between decode
  rounds) would address M2.
- **Wide-pipe vs narrow-pipe.** The decode operation in shi7 is
  textbook narrow-pipe: the intermediate buffer halves at each step.
  Modern hashes deliberately use wide-pipe (intermediate state ≥ 2×
  output) to prevent the kind of mid-state collision attacks discussed
  in M2.
- **Joux multi-collisions.** Any iterated hash whose iteration step has
  small output entropy admits Joux-style multi-collisions
  (`2^(k/2)` work to find `2^k`-fold collisions). The decode loop in
  shi7 is exactly this structure. If you build any larger MAC/AEAD
  primitive on top of shi7, Joux attacks are a credible concern.

If the long-term goal is to have a cryptanalytically defensible hash,
my honest suggestion is to **separate the question of "what should the
ITS primitive be?" from "how do we build a hash?"** — and then build the
hash by composing a known-good construction (e.g. Sponge) over the SPD
permutation rather than baking the construction itself.

## 6. Things I did not check

For honesty's sake, here is what this review **did not** cover:

- The `Transcoder`/`SPD` exchange protocol (`src/exchange/*`). It has
  its own structural concerns (the README admits asymmetric-low-SPD
  exchange is unsolved).
- Timing side channels. The encode/decode loops are simple lookups but
  the shuffle calls and the `while (lane[j] === lane[v])` loop in
  `overwriteFewValuesInAllLanes` are data-dependent. Probably not an
  issue for a hash, but worth noting for any future MAC use.
- Memory safety / aliasing across `ArrayBuffer.transfer()` calls in
  `encodeMessageUntilSizeInByte`. The use of `.buffer.transfer()`
  detaches the underlying ArrayBuffer; the code currently works because
  `Buffer.from(buffer)` copies, but this is non-obvious and fragile.
- Bun/V8 version sensitivity. `Iterator.from(...)` and
  `ArrayBuffer.prototype.transfer` are recent additions. Behavior on
  other runtimes is unverified.

## 7. Recommended priority order

If I had to rank fixes by value-per-effort:

1. **Fix C1** (small-message output width). 1-line change, removes a
   2^64× security overstatement.
2. **Fix C2** (default seed via CSPRNG). 3-line change, removes a
   trivial seed-guessing path.
3. **Fix H3** (Fisher-Yates shuffle). ~8-line change, removes a
   biased primitive used everywhere in the construction.
4. **Add domain separation** (M3) and drop the `- 1n` empty patch (L1).
   ~5 lines, eliminates an entire family of cross-path attacks.
5. **Decide on H1** (seed width). The biggest architectural call. If
   shi7 stays at 64 bits, drop the ITS/quantum-immune claims from the
   README. If the claims stay, widen the key.
6. **Reconsider M1** (SPD value uniformity). Either drop
   `overwriteFewValuesInAllLanes` or document its purpose formally.
7. **Reconsider M2** (decode tree topology). Probably can't be fixed
   without giving up the fast lookup-only design — but at least
   measure how bad it actually is in practice (see §4.7 suggested
   experiment).
8. **Add the missing tests** in §4 to the suite as guardrails for the
   C++ port.

Items 1–4 are mechanical and would land in an afternoon. Items 5–8 are
the substance of a v2 design.

---

*Author's note: I am a language model performing static review, not a
trained cryptographer. Take this document as a useful next-pair-of-eyes
pass; have a real cryptanalyst look before claiming security. In
particular, formal arguments — the kind that would back up an ITS or
quantum-resistance claim — are out of scope here.*
