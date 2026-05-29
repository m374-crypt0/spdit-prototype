# M2 — Narrow-pipe decode-tree collision

> **Status: VERIFIED (2026-05-29).** Promoted from *static / mitigated* to
> *verified* by the probe suite `test/hashing/probes.test.ts` and the
> standalone demonstration `draft/m2-probe-check.ts`. A same-length full
> 256-bit hash collision is reproducibly found in **~10–25 hash evaluations**
> against the current `src/hashing/shi7.ts`. The structural cause is unchanged
> from the original finding; only its empirical confirmation is new.
>
> **Severity: reassessed Medium → High** (see [§7](#7-severity-reassessment)).
> The "Medium / mitigated" label predates the verification and reflected the
> wide-pipe *outer* construction added in `db81a40`. That mitigation does not
> touch the collision described here.

This is the dedicated write-up for finding **M2** from
[`docs/cryptanalysis-shi7.md`](./cryptanalysis-shi7.md). It supersedes the M2
status framing in that document; the original static analysis text there is
preserved for traceability.

---

## 1. TL;DR

`Shi7` reduces a message to the hash width through `decodeMessageUntilSizeInBytes`
— a chain of `2 bytes → 1 byte` `decode` calls with **no cross-position
interaction inside a layer**. Each byte of the pre-shuffle intermediate buffer
is therefore the root of an **independent subtree** fed by a fixed,
*seed-independent* window of input bytes.

Consequence: pick the input window that feeds **one** output byte, hold every
other byte of the message fixed, and vary only that window. Exactly one output
byte changes, so a full hash collision reduces to a **birthday on a single byte
(256 values)** — about `2⁴` trials, pigeonhole-guaranteed under `257`, versus
the `~2¹²⁸` a 256-bit hash should require. Same length is automatic (you replace
bytes in place), so the entire downstream seed-burn / shuffle chain is identical
for both messages and the intermediate-buffer collision propagates to an
identical final hash.

This breaks **collision resistance** and **second-preimage resistance** for any
message on the big-message path. It does **not** by itself give first preimages.

---

## 2. The structural property

`decode` (high SPD lookup) maps 2 bytes to 1 byte. `decodeMessageUntilSizeInBytes`
applies it in rounds until the buffer reaches the hash width. With `decode`
applied pairwise and no mixing between positions, after `k` rounds output byte
`i` depends on exactly input bytes `[2ᵏ·i, 2ᵏ·(i+1))` and on nothing else.

Crucially, **the tree topology is a function of message length only** — it does
**not** depend on the seed. An attacker who knows the algorithm knows precisely
which input window feeds which output byte for any given length, without knowing
the seed or the SPD.

### Worked example (the test's configuration)

`hashBitSize = 256` (hash width = 32 bytes), message length **127 bytes**:

```
[domain byte ‖ 127-byte message]  = 128 bytes
        │  decode round 1  (128 → 64)
        ▼
       64 bytes
        │  decode round 2  (64 → 32)
        ▼
       32 bytes   ← hashSizedBuffer (final step is a no-op, extraBytes = 0)
```

Two rounds ⇒ output byte `i` ← input bytes `[4i, 4i+4)`. Output byte **1** ←
input bytes `[4, 8)` = message bytes `[3, 7)`. The probe verifies this
empirically (per-subtree independence: perturbing message bytes `[3,7)` changes
intermediate byte `1` and no other).

### Minimal vulnerable size

The decode loop is not even required. For a message of length **33 bytes** at
`hashBitSize=256` (the smallest big-path message above the 32-byte hash width),
`decodeMessageUntilSizeInBytes` runs only its final step with `extraBytes = 2`,
producing `hashSizedBuffer[1] = decode(message[1], message[2])` — two freely
variable message bytes through a single `2→1` `decode`. Varying `message[1..3)`
collides output byte 1 in ~15–25 trials (verified for several seeds). So the
vulnerability surfaces at **message length ≥ hashWidth + 1** (≥ 33 bytes at
256-bit); the 127-byte case in the test is simply a clean, unambiguous
deep-tree representative.

---

## 3. The attack family

Let `w` be the number of input bytes that feed a chosen output position through
at least one `decode` (so that position is `256`-to-1, not injective). All costs
are in hash evaluations; the ideal for a 256-bit hash is `~2¹²⁸`.

| Variant | What the attacker controls | Cost |
|---|---|---|
| **Free collision**, 1 output byte | both messages; vary one isolated window | `~2⁴` (birthday on 256; ≤ 257 by pigeonhole) |
| **Free collision**, `d` output bytes | both messages; vary `d` isolated windows | `~2^{4d}` |
| **Second preimage** | target message fixed; match its bytes at the affected positions | `~2⁸` per affected output byte |

The free-collision, single-byte case is what the probe demonstrates. The
multi-byte and second-preimage variants follow from the same per-subtree
independence: differences confined to `d` independent subtrees only have to be
reconciled at those `d` output bytes; every other output byte already matches.

**What is *not* broken.** M2 is a collision / second-preimage break. It does
**not** yield a first preimage (given only a target digest with no exploitable
structure), nor does it recover the seed. The wide-pipe outer construction and
the encode/shuffle stages still stand in the way of those.

---

## 4. Empirical verification

### 4.1 The probe suite — `test/hashing/probes.test.ts`

Run: `bun test test/hashing/probes.test.ts`. The suite has two parts:

1. **Negative control** — proves the *original* suggested experiment is
   vacuous. At `hashBitSize=256` a 32-byte message never enters the decode loop;
   its intermediate buffer is `[decode(domain, msg[0]), msg[1..31]]`, which is
   **injective** (byte 0 injective in `msg[0]`, the tail passed through
   verbatim). So "count distinct intermediate buffers ≈ input count" is
   guaranteed regardless of security — a pass proves nothing.
2. **The depth-≥2 structured attack** — for five fixed seeds it (a) asserts
   per-subtree independence (the window feeds exactly one output byte), then
   (b) runs the black-box birthday search on the **final hash** and asserts a
   same-length, distinct-message, full-hash collision is found in `≤ 257`
   trials, with the two messages differing only inside the isolated window.

The attack half uses only black-box `hash()` calls — no seed knowledge, no
intermediate-buffer hook.

### 4.2 Standalone demonstration — `draft/m2-probe-check.ts`

Run: `bun run draft/m2-probe-check.ts`. Reproducible output (seed `0xC0FFEE`,
127-byte messages):

```
varying msg[3..7] changes intermediate byte positions: [ 1 ]
COLLISION after 10 trials (birthday-on-256 expected ~20-40)
msg A bytes[3..7]: [ 14, 6, 39, 0 ]
msg B bytes[3..7]: [ 63, 155, 158, 0 ]
same length      : true (127 bytes)
messages equal?  : false
hash A           : dc9c44e6a7a501b085cbd363b4fb22983e4d70f60529739b053b44216bc8e29d
hash B           : dc9c44e6a7a501b085cbd363b4fb22983e4d70f60529739b053b44216bc8e29d
FULL HASH COLLISION: true
```

Two distinct 127-byte messages, identical 256-bit digest, found in 10 hash
evaluations.

### 4.3 The `recordIntermediateBuffer` hook

The attack itself does not need it, but the probe uses
`Shi7`'s `recordIntermediateBuffer` option (`shi7.ts`) to *observe*
`hashSizedBuffer` and assert per-subtree independence. It is a pure
observability callback fired at the end of `decodeMessageUntilSizeInBytes`; it
does not alter hashing. Keep it test-only.

---

## 5. Why the originally-suggested experiment misled

`cryptanalysis-shi7.md` §4.7 (line 622) suggested: *"generate ~10⁶ random
32-byte messages, count distinct intermediate buffers; if much lower than the
input count, the narrow pipe is biting."* Running exactly that returns
`1,000,000 → 1,000,000, no collapse`, which is easy to misread as "M2 is fine."

It is not evidence of anything. As §4.1 shows, the 32-byte intermediate map is
**injective**, so the count can never collapse — the experiment tests an
identity-like map and confirms it is injective. It exercises the *shallowest*
possible big-path case (depth 0), never the per-subtree independence that M2 is
about, and it samples *randomly* and *globally* where the real attack is
*structured* and *local*. A clean result there is fully consistent with M2 being
wide open — which it is.

This is the cautionary core of the finding: **the naive negative result and the
true positive coexist.** Read the negative result as "the wrong experiment," not
"the property holds."

---

## 6. Plausible risk scenario

The classic place a collision break bites is **"hash-then-sign" / signed-manifest
forgery** (the Flame-MD5 and SHAttered family). It is realistic for `Shi7`
because any use as a *verifiable* hash requires a **shared, hence public, seed**
(otherwise no second party can reproduce the digest) — and a public seed lets
the attacker compute everything offline.

**Setup.** A vendor distributes artifacts (a software update, a container image,
a package). Each artifact is hashed with `Shi7` (shared seed) and the **digest**
— not the whole file — is signed or listed in a signed manifest / trusted index.
Verifiers recompute `Shi7(artifact)` and trust it if the digest matches.

**Attack.**

1. Build two same-length artifacts, byte-identical except a small "don't-care"
   region (a comment/padding field, or a few selector bytes feeding an
   `if (selector == X) run_benign() else run_malicious()` gadget where both
   payloads live in the shared, identical part of the file).
2. Choose that region to overlap a handful of independent decode subtrees, and
   tune those bytes (offline, public seed) until both files yield the **same**
   digest — thousands to millions of evaluations (`~2^{4d}`), seconds to
   minutes, versus the `~2¹²⁸` that should be required.
3. Submit the **benign** artifact for review/signing. It is clean, gets signed;
   its digest is now trusted.
4. Ship the **malicious** artifact. The verifier recomputes `Shi7`, gets the
   identical trusted digest, the signature/manifest check passes → the
   backdoored artifact installs under the benign one's trust.

Same length is automatic with M2. Unlike classic collision attacks, ~99% of both
files stays fixed and meaningful — only a tiny isolated region differs — so
crafting a *meaningful* collision is easy, not just a "two random blobs"
collision.

**Variants (same root cause).**

- **Content-addressed store / dedup cache** — insert benign content at address
  `H`; later malicious content colliding to `H` is served from cache or silently
  dedup-merged → cache poisoning / integrity bypass.
- **Commit-reveal / fair exchange** — if `Shi7` is the commitment, the binding
  property is gone: open a commitment to a different value than intended
  (auctions, coin-flips, escrow).
- **Merkle / append-only audit log** — two different histories share a root; an
  "append-only" log can be silently rewritten.

**Caveat that bounds the risk.** If the seed is kept **secret** (used as a keyed
MAC, never as a public hash), the offline attack disappears — but it degrades
only to needing a **hashing oracle** (submit candidates, watch for matching
outputs); a chosen-message collision oracle still finds collisions in the same
`~2⁴–2^{4d}` queries. Seed secrecy raises the bar to "needs query access," not
"secure." And the attack engages for any big-path message (≥ `hashWidth + 1`
bytes), which is essentially every real artifact.

---

## 7. Severity reassessment

Original rating: **Medium**. Recommended rating: **High** (arguably Critical if
`Shi7` is ever exposed where collision resistance is relied upon).

The Medium label is understandable in context — it was assigned while M2 was
considered *mitigated* by the wide-pipe outer construction (`db81a40`), and the
project frames `Shi7` as an experimental ITS primitive where diffusion *means*
were the headline metric. But:

- A practical **collision** at `~2⁴` and **second preimage** at `~2⁸` against a
  256-bit hash is, by the standard yardstick for a hash function, a **total
  break** of two of its three core properties.
- The `db81a40` mitigation is orthogonal: it widens the *outer* construction so
  an internal-state collision is no easier than an output collision *in general*
  — but M2 produces the internal-state collision *before* the pipe, for free, so
  the wide pipe never engages.
- The break is cheap, structural (every seed), and yields *meaningful*
  collisions, not just random ones.

It is **not** Critical in the same sense as C1/C2 (which were unconditional,
key-independent breaks of the advertised width / seed entropy) only insofar as
M2 requires the message to be on the big path and, for the fully-offline form, a
public seed. Given those are the normal conditions for using a hash, High is the
honest floor.

---

## 8. Fix options

None are implemented. All three change the decode-tree topology and ripple
through `Transcoder.decode` and the seed-discipline accounting; each must be
re-checked against the diffusion-mean tests in `test/hashing/`.

1. **Interleave a mixing step between decode rounds.** A small ARX or
   sponge-style absorption pass touching every byte of the intermediate buffer
   between consecutive `decode`s destroys per-subtree independence. Standard way
   modern hashes defeat narrow-pipe attacks; costs speed.
2. **Make each decode round seed-dependent.** `decode` is currently a pure SPD
   lookup with no seed input. If each round drew a fresh seed from
   `seedGenerator` to permute the buffer (or to select among multiple SPD
   lanes), each output position would depend on the global seed-chain state —
   which differs the instant any earlier byte differs — instead of only its
   local subtree.
3. **Use the wide-pipe property *throughout*, not only after.** The decode tree
   (the narrow-pipe phase) runs *before* any mixing. Restructuring so the decode
   tree itself operates on a wider intermediate state (e.g. retain both halves
   of each `decode` and mix them before discarding) shifts the construction from
   "narrow-pipe then wide-pipe" to "wide-pipe throughout".

**Recommendation.** Option 1 or 2 is the minimal change that actually closes M2;
option 2 composes naturally with the existing `seedGenerator` discipline. This
is v2 / C++-port work, not a one-line patch. Until then, M2 stays **open and
verified**, and `Shi7` must not be used anywhere collision or second-preimage
resistance is relied upon.

---

## 9. References

- Finding origin and full report: [`docs/cryptanalysis-shi7.md`](./cryptanalysis-shi7.md) §3 (M2), §4.7.
- Verification suite: `test/hashing/probes.test.ts`.
- Standalone demonstration: `draft/m2-probe-check.ts`.
- Implementation: `src/hashing/shi7.ts` — `decodeMessageUntilSizeInBytes`,
  `hashBiggerThanHashMessage`, and the `recordIntermediateBuffer` hook.
- Glossary: [`docs/glossary.md`](./glossary.md) (SPD, transcoding, decode).
