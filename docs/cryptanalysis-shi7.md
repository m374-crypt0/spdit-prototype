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
> **Exception — M2 is now a permanent verification probe.** Because M2 is
> verified *and unfixed*, its probe is retained as a regression-style guard in
> the suite (`test/hashing/probes.test.ts`) plus a standalone demonstration
> (`draft/m2-probe-check.ts`). It currently asserts the collision *exists*; once
> a structural fix lands it should be inverted to assert the collision is gone.
> See [`docs/cryptanalysis-shi7-m2.md`](./cryptanalysis-shi7-m2.md).

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

| ID  | Severity   | Issue                                                                   | Status (2026-05-28)                                     |
|-----|------------|-------------------------------------------------------------------------|---------------------------------------------------------|
| C1  | Critical   | Small-message hashes are exactly **half the advertised hashBitSize**    | **Fixed** (`f6b9102`)                                   |
| C2  | Critical   | Default seed has ≤52 bits of entropy from an insecure PRNG              | **Fixed** (`318e426`)                                   |
| H1  | High       | Seed/key space is 64 bits — defeats both ITS and post-Grover claims     | **Open** (structural); marketing claims withdrawn (`f35507a`) |
| H2  | High       | `preSeed` and `preHash` buffers alias for hashBitSize ≤ 128 small msgs  | **Fixed** (`f6b9102` for ≥128; `db81a40` removed the residual 64-bit case) |
| H3  | High       | `shuffleStorage` is the *naive* shuffle, not Fisher-Yates — biased      | **Fixed** (`d033a50`)                                   |
| M1  | Medium     | SPD `overwriteFewValuesInAllLanes` destroys uniform distribution and admits a rare runtime crash | **Fixed by removal** (`edefb7a`)         |
| M2  | Medium → **High** | Decode is a 2→1 byte tree → narrow-pipe diffusion before the final shuffle | **Verified — open** (2026-05-29); same-length full-hash collision found in ~2⁴ hashes. The `db81a40` wide-pipe mitigation does not engage. Dedicated write-up: [cryptanalysis-shi7-m2.md](./cryptanalysis-shi7-m2.md) |
| M3  | Medium     | No domain separation between the four dispatch paths                    | **Fixed** (`75a93ef` → `270b416`); stronger than recommended (keyed tags) |
| M4  | Medium     | "decoded-message vs message" collision avoidance is a structural patch, not an invariant | **Strengthened by M3 fix**; seed-burn patches retained |
| L1  | Low        | Empty-message hash can be `-1n` (all-zero `hashBuffer`)                 | **Fixed** (during M3 work)                              |
| L2  | Low        | `hashMessageSizedBetweenSeedAndHash` is unreachable when hashBitSize=64 | **Fixed** (`db81a40` — 64 removed from `SupportedHashBitSize`) |
| L3  | Low        | Empty-message hash depends only on the high SPD, not on the SplitMix64 seedGenerator chain | **Fixed** (during M3 work)                |

The two Critical items are both reproducible with one-shot probes (see §3).
The High items are structural and would need redesign to address. The Medium
items concern the *quality* of diffusion and the surface for principled
analysis. The Low items are mostly cosmetic.

**Update (2026-05-28).** Of the 12 findings, 10 are fixed in the codebase
(L2 and the residual H2 case closed by `db81a40`, removing `64` from the
supported hash bit sizes), 1 is mitigated (M2 — wide-pipe construction now
guaranteed at every supported hash size, though the decode-tree topology
itself is unchanged), 1 is meaningfully strengthened (M4). H1 is open
structurally but had its security claims withdrawn from the README.
Per-finding status notes are inline in §3 below; the priority order in §7
has been updated; a fix-commit summary is in §8.

**Update (2026-05-29).** **M2 is now verified, not merely static.** A probe
suite (`test/hashing/probes.test.ts`) and a standalone demonstration
(`draft/m2-probe-check.ts`) reproducibly find a **same-length full 256-bit
hash collision in ~10–25 hash evaluations** against the current code. The
`db81a40` "mitigation" (wide-pipe *outer* construction) does not engage,
because M2 produces the internal-state collision *before* the pipe. M2's
severity is reassessed **Medium → High** and it remains **open** (no
structural fix landed). Full analysis, the concrete colliding messages, a
plausible risk scenario, and why the originally-suggested §4.7 experiment was
misleading are in the dedicated write-up
[`docs/cryptanalysis-shi7-m2.md`](./cryptanalysis-shi7-m2.md).

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

### C1 — Small-message output is half the advertised `hashBitSize` *(verified — **fixed** in commit `f6b9102`)*

> **Status (2026-05-28).** Fixed in commit `f6b9102 fix(hashing): C1 findings
> in automated cryptanalysis`. The recommended one-line change was applied:
> `encodePreSeedToPreHash` (now at `src/hashing/shi7.ts:142`) grows `preHash`
> to `hashBitSize/8 * SPD.DIMENSIONAL_FACTOR` bytes before the final decode,
> so the returned `hashBuffer` is `hashBitSize/8` bytes as intended. Reproduce
> by re-running the empirical probe described below — all rows should now
> read `OK`.

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

### C2 — Default seed has ≤52 bits of entropy from a non-cryptographic PRNG *(verified — **fixed** in commit `318e426`)*

> **Status (2026-05-28).** Fixed in commit `318e426 fix(hashing): C2
> findings`. The `SplitMix64` constructor (`src/stochastic/seedGenerators.ts:33`)
> now sources its default state from `randomBytes(8)` (Node's CSPRNG via
> `node:crypto`) and interprets it via `new DataView(b.buffer).getBigUint64(0)`.

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

### H1 — 64-bit seed/key space defeats both ITS and post-Grover claims *(static — **open**; documentation claims withdrawn)*

> **Status (2026-05-28).** Structurally unchanged — the seed is still 64 bits
> wide throughout. The conservative half of the response landed: commit
> `f35507a docs: do not overclaim ITS and quntum resistance anymore`
> withdrew the ITS and quantum-resistance claims from the README. The
> architectural decision — widen the PRNG stack (e.g. `xoshiro256**`) or
> treat the high SPD itself as the key — remains open and is the biggest
> design call before the C++ port. Tracked as such in
> `.claude/context/project-state.md`.

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

### H2 — `preSeed` and `preHash` buffer aliasing for small messages, hashBitSize ≤ 128 *(static — **fixed**; ≥128 case via `f6b9102`, residual 64-bit case via `db81a40`)*

> **Status (2026-05-28).** Fully resolved. For hashBitSize ∈ {128, 256, 512,
> 1024} the C1 fix (`f6b9102`) grows `preHash` to
> `hashBitSize/8 * DIMENSIONAL_FACTOR` bytes via at least one call to
> `transcoder().encode(...)`, which returns a fresh buffer — so
> `preHash !== preSeed` after the first iteration. The residual case at
> hashBitSize=64 was closed by `db81a40 fix(hashing): cryptanalysis issues
> addressed` which removed `64` from the supported hash bit sizes
> altogether (the type was renamed `HashBitSize` → `SupportedHashBitSize`
> at `src/hashing/shi7.ts:222` and now reads `128 | 256 | 512 | 1024`). The
> same change closes L2 below.

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

### H3 — `shuffleStorage` is the *naive shuffle*, not Fisher-Yates *(static — **fixed** in commit `d033a50`)*

> **Status (2026-05-28).** Fixed in commit `d033a50 fix(hashing): H3 finding`.
> `shuffleStorage` (`src/stochastic/utils.ts:35`) is now proper Fisher-Yates:
> `for (let i = length - 1; i > 0; i--)` with `d.newUint([0n, BigInt(i)])`.
> A `// NOTE: Regarding the H3 finding in cryptanalysis…` comment at line 33
> cites the finding by ID so a future refactor doesn't accidentally regress.

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

### M1 — `overwriteFewValuesInAllLanes` destroys uniform value distribution; can crash *(static — **fixed by removal** in commit `edefb7a`)*

> **Status (2026-05-28).** Fixed in commit `edefb7a fix(hashing): addressing
> M1` ("removing the non-uniformity step that could cause in rare cases
> crashes. Mixing is already strong but should nonetheless be assessed").
> `overwriteFewValuesInAllLanes` was deleted entirely.
> `SPD.initializeBuffer` (`src/transcoding/spd.ts:105`) is now
> `generateLanes → shuffleLanes → transposeBuffer → shuffleLanes` — the
> deleted non-uniformity step has been replaced with a second uniform
> `shuffleLanes` pass after the transpose. This is **stronger** than the
> "drop the function" option recommended below: where the recommendation
> would have left a single horizontal shuffle, the implemented design
> performs a horizontal shuffle on each side of the transpose, providing
> additional cross-lane mixing. The commit message's note "should
> nonetheless be assessed" is accurate — the construction is sounder but
> hasn't been empirically validated against the diffusion measurements
> the original test suite expected.

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

### M2 — Decoding is a 2→1 byte tree → narrow-pipe before the final shuffle *(**verified** 2026-05-29 — open; severity Medium → High)*

> **Status (2026-05-29). VERIFIED — OPEN.** The collision sketched in the
> 2026-05-28 block below has been reproduced against the current code:
> `test/hashing/probes.test.ts` and `draft/m2-probe-check.ts` find a
> same-length full 256-bit hash collision in ~10–25 hash evaluations, for
> every tested seed. The decode tree's per-subtree independence is asserted
> directly (varying one input window changes exactly one output byte). The
> `db81a40` wide-pipe mitigation does **not** engage — the internal-state
> collision is produced *before* the pipe. Severity reassessed **Medium →
> High**. No structural fix has landed. **The full, current treatment lives in
> [`docs/cryptanalysis-shi7-m2.md`](./cryptanalysis-shi7-m2.md)**; the
> 2026-05-28 block and the original analysis below are retained for
> traceability and are superseded by it.

> **Status (2026-05-28).** Partially addressed by commit `db81a40
> fix(hashing): cryptanalysis issues addressed`. The fix removes `64`
> from the supported hash bit sizes (now
> `SupportedHashBitSize = 128 | 256 | 512 | 1024`), which guarantees
> `hashBitSize/8 > SEED_SIZE = 8` at every supported size. The downstream
> effects:
>
> - In `hashSmallerThanSeedMessage`, the `encodePreSeedToPreHash` loop
>   now always runs at least once, producing a `preHash` buffer of size
>   `hashBitSize/8 * 2 ≥ 32` bytes — strictly larger than the
>   `preSeed` (16 bytes). The state going into the final
>   `shuffleBuffer` + `decode` is now wider than the output (wide-pipe
>   construction).
> - In `hashBiggerThanHashMessage`, the chain `decodeMessageUntilSizeInBytes
>   → simpleChainDecodeMessageUntilSizeInBytes` now performs at least one
>   real decode round between `hashSize` and `SEED_SIZE` (it would have
>   been a no-op at `hashBitSize=64`), adding mixing depth.
> - In `hashMessageSizedBetweenSeedAndHash`, the same wide-pipe property
>   holds for `preHash`.
>
> What is **not** fixed: the structural narrow-pipe topology of
> `decodeMessageUntilSizeInBytes` itself. The decode is still
> `2 bytes → 1 byte` per round with no cross-position interaction within
> a layer — byte `i` of the level-`k` decode tree still depends on at
> most bytes `[2^k · i, 2^k · (i+1))` of the input and on nothing else.
> The wide-pipe outer construction raises the cost of an internal-state
> collision attack (intermediate state is now ≥ 2× output size at every
> supported `hashBitSize`), but the decode tree's per-subtree
> independence — the structural property the original finding called
> out — is unchanged. Commit message acknowledges this: "I have
> nonetheless to assess if this approach is sound".
>
> **Why the three changes in `db81a40` (and the surrounding fix cluster)
> don't close M2 for same-length, same-path collisions.** It is tempting
> to read (a) keyed domain separation by size (M3), (b) per-round and
> per-oddness `seedGenerator.newSeed()` calls, and (c) `hashBitSize/8 >
> SEED_SIZE` together as a full defense. Each addresses a *different*
> attack vector:
>
> 1. **Domain separation by size** prevents cross-path collisions. Two
>    messages flowing through the *same* dispatch path receive the same
>    seed-derived prelude byte (e.g. `domainPreludes.big`), so this
>    defense does not engage for same-length messages.
> 2. **Seed burning per decode round and per oddness** prevents
>    cross-length collisions and the `M = decoded(M')` family (M4). Two
>    messages of *identical* `byteLength` have identical odd-checks and
>    identical iteration counts in `decodeMessageUntilSizeInBytes` — so
>    the `seedGenerator` state after the decode is the same for both.
>    The defense does not engage for same-length collisions.
> 3. **`hashBitSize/8 > SEED_SIZE`** guarantees a wide-pipe outer
>    construction (`preHash` is 2× output, the final shuffle operates on
>    that wider state). But two messages that already collide at
>    `hashSizedBuffer` enter the wide-pipe with the same value → same
>    `seedSizedBuffer` (deterministic chain-decode) → same
>    `seedGenerator` state at the post-decode `encode(...)` calls → same
>    `preHash` and `preSeed` → same final hash. Wide-pipe does not
>    repair a collision that occurred before the pipe.
>
> **Concrete same-length attack sketch (big-message path).** Take a
> 1024-byte message at `hashBitSize=256`. Tracing
> `decodeMessageUntilSizeInBytes(prelude ‖ M, 32, sg)`: the prelude makes
> the input 1025 bytes (odd), so 5 decode iterations carry the trailing
> odd byte forward, terminating with a 33-byte buffer. The final step
> `[decode(b[0..2]), ...b[2..33]]` produces a 32-byte
> `hashSizedBuffer` where:
>
> - `hashSizedBuffer[0] = decode(b[0], b[1])` — depends on the first 63
>   bytes of the (prefixed) message (deeper subtree because two top-level
>   bytes are decoded together).
> - `hashSizedBuffer[i]` for `i ∈ [1, 31]` — depends on a *single*
>   32-byte subtree of the original message, disjoint from the other
>   output positions. Specifically, `hashSizedBuffer[i]` reflects roughly
>   bytes `[63 + 32·(i−1), 63 + 32·i)` of `M` (modulo the odd-carry
>   bookkeeping).
>
> The attacker picks one non-zero output position, e.g. `i = 1`, and
> varies `M[63..95]` while keeping every other byte of `M` fixed. After
> the M1 fix the SPD lanes are permutations, so `decode(a, ·)` is
> injective at fixed `a` — but `decode(·, ·)` viewed as a single
> `{0,1}^16 → {0,1}^8` function is still 256-to-1 on average across all
> input pairs. Composed through the depth-5 subtree, the function
> `M[63..95] → hashSizedBuffer[1]` has codomain `{0,1}^8`. By birthday
> on 256 values, **~16 random trials of the 32-byte segment** find a
> pair `(M_seg, M'_seg)` that produces the same `hashSizedBuffer[1]`.
> Because every other input byte is identical, every other output byte
> of `hashSizedBuffer` is also identical → full `hashSizedBuffer`
> collision → identical `seedSizedBuffer`, identical
> `seedGenerator` state, identical `preHash`/`preSeed` → identical
> final 256-bit hash. **Total cost ≈ 2⁴, vs. the ~2¹²⁸ birthday bound
> on the output.**
>
> The attack generalizes: for any message length that produces a decode
> tree of depth ≥ 2, each non-leftmost output byte position is the
> root of an independent subtree, and the same birthday-on-256 argument
> applies. The leftmost output position (position 0) is structurally
> stronger because it depends on a wider subtree, but the attacker is
> free to target any other position.
>
> **Suggested empirical confirmation** (the §4.7 experiment, made
> concrete for M2): run ~32 random 32-byte values for `M[63..95]` against
> a fixed surrounding 1024-byte message at `hashBitSize=256`, hashing
> each. With probability ≈ 1, two of them collide on `hashSizedBuffer[1]`
> — and therefore on the full hash. If the probe is run and the
> collision is empirically observed, that promotes M2's status from
> *static* to *verified*.
>
> **✅ Done (2026-05-29) — M2 is now VERIFIED.** The structured attack was
> implemented (`test/hashing/probes.test.ts`, `draft/m2-probe-check.ts`),
> using a 127-byte depth-2 message rather than the 1024-byte depth-5 sketch
> above — the principle is identical and the smaller tree keeps the test fast.
> A same-length full 256-bit hash collision is found in ~10–25 hash
> evaluations for every tested seed. See
> [`docs/cryptanalysis-shi7-m2.md`](./cryptanalysis-shi7-m2.md).
>
> **Possible structural fixes for the C++ port** (sketch — none have
> been designed in detail):
>
> - **Interleave a mixing step between decode rounds.** A small ARX or
>   sponge-style absorption pass that touches every byte of the
>   intermediate buffer between consecutive decodes would destroy the
>   per-subtree independence. Costs speed; matches how modern hashes
>   defeat narrow-pipe attacks.
> - **Make each decode round seed-dependent.** Currently `decode` is a
>   pure SPD lookup with no seed input. If each round used a fresh seed
>   from `seedGenerator` to permute the buffer (or to choose between
>   multiple SPD lanes), the per-position function would no longer be a
>   pure function of the local subtree — it would depend on the global
>   seed-chain state, which differs the moment any earlier byte differs.
> - **Use the wide-pipe property earlier.** The current outer
>   construction is wide-pipe but the *narrow-pipe* phase (the decode
>   tree) happens *before* any mixing. Restructuring so that the
>   decode tree itself runs on a wider intermediate state (e.g. retain
>   both halves of each decode and mix them before discarding) would
>   shift the construction from "narrow-pipe then wide-pipe" to
>   "wide-pipe throughout".
>
> All three options have ripples through `Transcoder.decode` and the
> seed-discipline accounting, and need to be assessed against the
> diffusion-mean tests in `test/hashing/`. Tracked as open work.

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

> [!CAUTION]
> **This particular experiment is vacuous — do not read its result as
> safety.** At `hashBitSize=256` a 32-byte message never enters the decode
> loop; its intermediate buffer is `[decode(domain, msg[0]), msg[1..31]]`,
> which is *injective*, so the distinct count always equals the input count
> (it was confirmed at `1,000,000 → 1,000,000`). The experiment exercises the
> shallowest possible big-path case, never the per-subtree independence M2 is
> about. The correct probe — the depth-≥2 structured attack — lives in
> `test/hashing/probes.test.ts` and *does* find collisions. See
> [`docs/cryptanalysis-shi7-m2.md`](./cryptanalysis-shi7-m2.md) §5.

A real fix would interleave the decode tree with a mixing step that
introduces cross-position interaction (e.g. a small ARX or sponge-style
absorption between decodes). At the cost of speed.

---

### M3 — No domain separation between dispatch paths *(static — **fixed** in commits `75a93ef` → `270b416`; stronger than recommended)*

> **Status (2026-05-28).** Fixed across a four-commit sequence: `75a93ef
> fix(hashing): M3 domain separation`, `25b059f`, `d1c6d9a`, and `270b416
> fix(hashing): M3 finalized`. The implementation is **stronger than the
> static byte tags (0x00/0x01/0x02/0x03) recommended below**:
> `Shi7.initializeDomainPreludes` (`src/hashing/shi7.ts:39-58`) derives
> **four unique random bytes from the seed itself** (via the
> `SplitMix64 → Xoroshiro128+ → UniformUint64` chain), and
> `prefixDomainByteToMessage` (`shi7.ts:121`) prepends the path-specific
> byte before each path runs. Because the tags are derived from the
> (potentially secret) seed, this is a *keyed* domain separation —
> an adversary who doesn't know the seed doesn't know the tags, so they
> cannot construct cross-path collisions by tag manipulation. The
> generation loop rejects until all four tags are distinct, ensuring no
> accidental tag overlap between paths. Side effect: L1 and L3 were
> resolved during this work (see below).

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

### M4 — "decoded(M) vs M" collision avoidance is a structural patch, not an invariant *(static — **strengthened by M3 fix**; seed-burn patches retained)*

> **Status (2026-05-28).** No direct M4 commit, but the M3 keyed-tag domain
> separation substantially weakens M4's premise: messages flowing through
> the four paths now carry distinct seed-derived prelude bytes, so
> `hash(M)` and `hash(decoded(M))` enter the construction with different
> domain context as well as different post-prelude content. The
> `seedGenerator.newSeed()` calls flagged in this finding remain in place
> (`src/hashing/shi7.ts:158` and `src/hashing/shi7.ts:168`) — they are
> no longer the *only* defense, but they remain part of the construction
> and the `// NOTE:` comments documenting them are still load-bearing. Do
> not remove them in refactoring.

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

### L1 — Empty-message hash can be `-1n` *(static — **fixed** in commit `25b059f`)*

> **Status (2026-05-28).** Fixed in commit `25b059f fix(hashing): M3
> addressing` — the commit message explicitly notes "Removed the magic
> subtraction". `hashEmptyMessage` at `src/hashing/shi7.ts:73` now returns
> `BigInt(\`0x${hashBuffer.toHex()}\`)` directly, which is always
> non-negative. The collision concern that originally motivated the `- 1n`
> patch is now addressed by the M3 keyed domain separation: the empty
> path prepends a unique seed-derived byte before processing, so the
> empty-message hash can no longer coincide with
> `BigInt(decode_chain(highSPD).toHex())` by construction.

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

### L2 — `hashMessageSizedBetweenSeedAndHash` unreachable for hashBitSize=64 *(static — **fixed** in commit `db81a40`)*

> **Status (2026-05-28).** Fixed in commit `db81a40 fix(hashing):
> cryptanalysis issues addressed`. The `HashBitSize` type union was
> renamed to `SupportedHashBitSize` (`src/hashing/shi7.ts:222`) and now
> reads `128 | 256 | 512 | 1024` — `64` is no longer accepted. With
> `SEED_SIZE = 8` (i.e. seed size in bytes) and every supported
> `hashBitSize/8 ≥ 16`, the "between seed and hash" range
> `(SEED_SIZE, hashBitSize/8)` is always non-empty, so
> `hashMessageSizedBetweenSeedAndHash` is reachable at every supported
> hash size. The same change also closes the H2 residual case above.
> The author's commit message notes that smaller hashes could be
> reintroduced later via "a new step having its own domain for hash
> reduction", but that approach is flagged as not yet assessed for
> soundness.

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

### L3 — Empty-message hash depends only on the high SPD, never on the SplitMix64 chain *(static — **fixed** in commit `25b059f`)*

> **Status (2026-05-28).** Fixed in commit `25b059f fix(hashing): M3
> addressing` — the commit message notes "made the hashing of empty value
> similar to big message hashing with key differences to distinct hash of
> empty value of the hash of underlying high SPD".
> `hashEmptyMessage` (`src/hashing/shi7.ts:64-74`) now constructs its own
> `seedGenerator = new SplitMix64(this.seed_)` and passes it to
> `decodeMessageUntilSizeInBytes`, which consumes `newSeed()` per decode
> round (and additionally for odd-sized inputs). The empty hash now
> depends on the SplitMix64 chain in the same way the other paths do.
> The structure described below — `simpleChainDecodeMessageUntilSizeInBytes`
> with no seed generator — was replaced as part of this commit.

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

The original priority order, annotated with status:

1. ~~**Fix C1** (small-message output width). 1-line change, removes a
   2^64× security overstatement.~~ — **Done** (`f6b9102`).
2. ~~**Fix C2** (default seed via CSPRNG). 3-line change, removes a
   trivial seed-guessing path.~~ — **Done** (`318e426`).
3. ~~**Fix H3** (Fisher-Yates shuffle). ~8-line change, removes a
   biased primitive used everywhere in the construction.~~ —
   **Done** (`d033a50`).
4. ~~**Add domain separation** (M3) and drop the `- 1n` empty patch (L1).
   ~5 lines, eliminates an entire family of cross-path attacks.~~ —
   **Done** (`75a93ef` → `270b416`), with a *stronger* construction
   than originally recommended: keyed (seed-derived) domain tags
   rather than fixed `0x00..0x03` bytes. L1 and L3 closed as side
   effects.
5. **Decide on H1** (seed width). The biggest architectural call. —
   **Open**. The conservative half was done: ITS/quantum-immune claims
   were withdrawn from the README in `f35507a`. The structural choice
   (widen the PRNG stack, e.g. `xoshiro256**`, or treat the high SPD as
   the key) is either deferred to the C++ port or for further researches in
  this prototype
6. ~~**Reconsider M1** (SPD value uniformity). Either drop
   `overwriteFewValuesInAllLanes` or document its purpose formally.~~
   — **Done by removal** (`edefb7a`). The non-uniformity step was
   deleted; SPD init now does a second `shuffleLanes` after the
   transpose. Stronger than the "just drop it" option.
7. **Reconsider M2** (decode tree topology). Probably can't be fixed
   without giving up the fast lookup-only design — but at least
   measure how bad it actually is in practice (see §4.7 suggested
   experiment). — **Verified, open** (2026-05-29). The experiment was
   run — but the §4.7 form (count distinct intermediate buffers over
   random 32-byte messages) is *vacuous*: that map is injective, so it
   can only ever report "no collapse." The correct probe
   (`test/hashing/probes.test.ts`) exercises the depth-≥2 structured
   attack and finds a same-length full-hash collision in ~10–25 hashes.
   The `db81a40` wide-pipe mitigation does not engage. A structural fix
   (interleave a mixing step into the decode tree, or make each round
   seed-dependent) is still owed and remains v2 / C++-port work. See
   [`docs/cryptanalysis-shi7-m2.md`](./cryptanalysis-shi7-m2.md).
8. **Add the missing tests** in §4 to the suite as guardrails for the
   C++ port. — **Open**. The §4 gaps remain.

Items 1–4, 6, and (mitigation half of) 7 have landed. Item 5 and the
structural half of 7 are the substance of a v2 design and remain open;
item 8 is also open. The L2 and residual-H2 cleanup (removing `64`
from the `HashBitSize` union — now `SupportedHashBitSize`) landed in
`db81a40` as a side effect of the M2 mitigation.

## 8. Update log

A summary of the fix cluster that addressed this report (oldest to
newest):

| Commit     | Finding(s) addressed                  | Notes                                                                                                              |
|------------|---------------------------------------|--------------------------------------------------------------------------------------------------------------------|
| `f6b9102`  | C1                                    | Mechanical fix as recommended.                                                                                     |
| `318e426`  | C2                                    | Mechanical fix as recommended. JSDoc in `seedGenerators.ts:30` still says "Math.random" — cosmetic followup.       |
| `d033a50`  | H3                                    | Mechanical fix; `// NOTE: Regarding the H3 finding…` comment added in `utils.ts:33` for regression-resistance.     |
| `edefb7a`  | M1                                    | Fixed by deletion; second `shuffleLanes` after the transpose replaces the removed step as compensating mixing.     |
| `70eeeb8`  | (refactor) precursor to M3            | Introduced `initializeDomainMagicBytes` / `domainMagicBytes` — the infrastructure for keyed domain separation. Empty-path still used `- 1n` after this commit. |
| `75a93ef`  | M3 (initial)                          | First pass at domain separation using the magic-bytes infrastructure.                                              |
| `25b059f`  | M3 (iteration), **L1**, **L3**        | Commit message: "Removed the magic subtraction" (L1) and "made the hashing of empty value similar to big message hashing" (L3). Both Lows closed here. |
| `d1c6d9a`  | M3 (iteration)                        | Subsequent refinement of domain separation.                                                                        |
| `270b416`  | M3 (finalized)                        | Final domain-separation design: `initializeDomainPreludes` produces 4 unique seed-derived tags. Side effect: H2 (≥128-bit) and M4 substantially strengthened. |
| `f35507a`  | H1 (documentation only)               | Withdrew ITS / quantum-immune marketing claims from the README. Structural H1 fix deferred.                        |
| `db81a40`  | **L2**, **H2 (residual)**, **M2** (mitigation) | Removed `64` from supported hash bit sizes (`HashBitSize` → `SupportedHashBitSize = 128 \| 256 \| 512 \| 1024`). Closes L2 and the residual H2 buffer-aliasing case at hashBitSize=64. Mitigates M2 by guaranteeing `hashBitSize/8 > SEED_SIZE` at every supported size, making the outer construction wide-pipe; the decode-tree topology itself is unchanged. |

**Open findings as of 2026-05-29:**

- **H1** — structural; the 64-bit seed-width decision is the biggest
  call before the C++ port.
- **M2 (verified, open; severity Medium → High)** — the decode tree is
  still `2→1` byte with no cross-position interaction within a layer. As
  of 2026-05-29 this is no longer hypothetical: a same-length full-hash
  collision is reproducibly found in ~10–25 hashes
  (`test/hashing/probes.test.ts`, `draft/m2-probe-check.ts`). The
  wide-pipe outer construction does not engage. A full fix (interleaving
  a mixing step inside the decode tree, or making each decode round
  seed-dependent) requires architectural change and is deferred to v2 /
  the C++ port. Dedicated write-up:
  [`docs/cryptanalysis-shi7-m2.md`](./cryptanalysis-shi7-m2.md).
- **§4 test gaps** — particularly: output bit-width assertion,
  cross-path collision tests, statistical batteries (NIST / dieharder /
  PractRand), worst-case (not mean) diffusion, key-recovery
  consistency tests, edge-size boundary tests, SPD value-presence
  test.

---

*Author's note: I am a language model performing static review, not a
trained cryptographer. Take this document as a useful next-pair-of-eyes
pass; have a real cryptanalyst look before claiming security. In
particular, formal arguments — the kind that would back up an ITS or
quantum-resistance claim — are out of scope here.*

*Update note (2026-05-28): the status annotations and §8 update log
were added after the original report, by another language-model pass
that cross-checked each finding against the current codebase and the
intervening commit cluster. A subsequent pass on the same date
incorporated commit `db81a40`, which removed `64` from the supported
hash bit sizes and thereby closed L2 and the residual H2 case while
mitigating M2 (the outer construction is now wide-pipe at every
supported size, though the decode tree itself is unchanged). The
original analysis text is preserved in §3 for traceability; only the
per-finding headings and the indented status blocks at the top of each
section are additions. Verify before acting on any specific claim —
particularly the M2 "mitigated" framing (the structural narrow-pipe
property of the decode tree itself is unchanged; the mitigation is the
guarantee of a wide-pipe outer construction) and the M4 "strengthened"
framing (no direct M4 commit; the strengthening comes indirectly from
the M3 keyed-tag construction).*

*Update note (2026-05-29): M2 was promoted from static/mitigated to
**verified** and reassessed **Medium → High**. The "mitigated" framing
above is now known to be misleading — the wide-pipe outer construction
does not prevent the collision, which forms before the pipe. A probe
suite (`test/hashing/probes.test.ts`) and a standalone demonstration
(`draft/m2-probe-check.ts`) reproduce a same-length full-hash collision in
~10–25 hash evaluations. The current, authoritative treatment of M2 is the
dedicated file [`docs/cryptanalysis-shi7-m2.md`](./cryptanalysis-shi7-m2.md);
the M2 text in §1, §3, §7, and §8 here has been annotated to point to it but
the original wording is otherwise preserved.*
