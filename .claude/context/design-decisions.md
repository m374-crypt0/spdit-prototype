# Design decisions and rationale

Non-obvious technical decisions discussed in past sessions, with their *why*.
The fix is in the code; this file exists so a future assistant doesn't
re-litigate or accidentally undo decisions whose justification isn't
self-evident.

When a decision here conflicts with what's in the code, trust the code —
and update or remove this entry.

## Numeric model

### `UINT65` and `UINT64_MAX` are intentionally separate constants

In `src/stochastic/distributionEngines.ts`: `UINT64_MAX = (1n << 64n) - 1n`
and `UINT65 = 1n << 64n`. They differ by 1; that difference is
load-bearing.

**Why both exist.** The Lemire bounded-uniform algorithm needs the
expression `(-r) % r`, which on a C++ `uint64_t` evaluates to
`(2^64 - r) % r` via unsigned wrap. BigInt has no unsigned wrap, so the
TypeScript code spells this out as `(this.UINT65 - r) % r` (see line 47).
`UINT64_MAX` is the bitmask used to truncate intermediate results to 64
bits (`& UINT64_MAX`, equivalent to a `uint64_t` cast). Each constant
maps to a distinct C++ operation; merging them would obscure the port
mapping.

**When this matters.** Anywhere in `src/stochastic` that performs modular
arithmetic on 64-bit quantities, especially the Lemire bounded-uniform
implementation. Treat the constants as load-bearing and named for the C++
port, not for TypeScript ergonomics.

Note: similar `UINT64_MAX` constants are also declared privately in
`seedGenerators.ts` and `uniformRandomBitGenerators.ts` — same value,
same intent.

## Seeding

### Default seeds must come from a CSPRNG

`node:crypto.randomBytes` is used for default seed generation. **Not**
`Math.random()`.

**Why.** A previous implementation used `Math.random().toFixed(20)` — V8's
`Math.random()` is xorshift128+ with at most 52 bits of meaningful entropy
and is not a CSPRNG. The 64-bit seed space was silently capped. Flagged as
cryptanalysis finding C2, fixed in commit `318e426`.

**When this matters.** Anywhere a `SplitMix64` is constructed without an
argument, or wherever new seed material is needed. Carries over to the C++
port — use the platform CSPRNG, not `rand()`.

### The 64-bit seed is a known structural ceiling

A 64-bit seed cannot deliver ITS (an unbounded adversary enumerates 2^64
seeds in finite time) and cannot give 128-bit post-Grover security (which
requires 256-bit secret material). This is cryptanalysis finding H1.

**Status.** Not fixed structurally — only the marketing claims were walked
back (commit `f35507a`). Two candidate fixes are on the table:

1. Replace the PRNG stack with `xoshiro256**` (256-bit internal state).
2. Treat the high SPD itself as the secret (64 KiB), and stop deriving
   security from a small seed.

Either path will ripple through `src/stochastic`, `src/hashing`, and
`src/exchange`. **This is the biggest open call before the C++ port.**

## Hashing (Shi7)

### Domain separation between dispatch paths is load-bearing

`hash(message)` dispatches into four code paths by message size (empty /
≤ seed size / between seed and hash size / ≥ hash size). Earlier versions
lacked domain separation between these paths, flagged as cryptanalysis
finding M3.

**Status.** Addressed across multiple iterations: `75a93ef`, `25b059f`,
`d1c6d9a`, `270b416`. The multi-iteration history suggests the right
domain-separation scheme was non-trivial to land. Don't simplify or
collapse these separators thinking they're cosmetic.

### The extra `seedGenerator.newSeed()` calls in `decodeMessageUntilSizeInBytes` are deliberate

These calls exist to prevent specific collisions: odd-sized messages and
"decoded vs original message" collisions. The `// NOTE:` comments at those
sites document why.

**When this matters.** If you're refactoring `decodeMessageUntilSizeInBytes`
and see what looks like a redundant seed burn, *stop*. The test suite has
explicit cases that fail if those calls are removed. Treat them and their
`// NOTE:` comments as load-bearing.

## Transcoding

### The non-uniformity step in SPD generation was deliberately removed

Earlier versions of `src/transcoding/spd.ts` had an additional step after
`shuffleLanes` that broke lane uniformity. Cryptanalysis finding M1
flagged that this step leaked per-byte multiplicity to an attacker and
admitted a rare runtime crash when a byte went globally absent (causing
`d.newUint([0n, -1n])`).

**Status.** Removed in commit `edefb7a` ("removing the non-uniformity
step that could cause in rare cases crashes"). The commit deleted ~20
lines from `spd.ts` and 14 from its tests — current SPD generation is
just two passes of `shuffleLanes`. If you propose reintroducing any
post-shuffle perturbation, re-read M1 in `docs/cryptanalysis-shi7.md`
first; the simpler design was chosen on purpose.

## Statistics testing

### The distribution test is chi-square, not "1M unique values"

An earlier version of the test asserted that 1M draws from the uniform
distribution produced 1M unique values. By the birthday paradox, the
expected number of duplicates is non-zero and was hitting ~47k — the test
was checking a statistically impossible property.

**Status.** Replaced with chi-square goodness-of-fit. **Do not revert.** If
this looks like a regression in test coverage, it isn't — the old test was
checking the wrong invariant.

## Naming

### `Peer` was the chosen name for exchange participants

Picked over Party, Principal, Participant, Counterpart, Agent, Node,
Member, Entity, Holder, Exchanger. No deep rationale — just author
preference after seeing the list.

**When this matters.** Don't propose renaming. Use `Peer`, `Initiator`,
`Recipient` consistently throughout `src/exchange`.
