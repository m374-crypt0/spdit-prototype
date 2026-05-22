# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project purpose

Prototype of **SPDIT** (Stochastic Private Dimensional Information Transcoding)
a scheme for *information-theoretically secured* data exchange that does
**not** rely on cryptographic primitives. The goal is to demonstrate working
algorithms that could later be reimplemented in a performant language (C++);
performance is explicitly a non-goal here though care has been taken not to
render this prototype unusable.

Background, design rationale, and ongoing task tracking lives in
`draft/how-to-start.md`. Domain vocabulary (SPD, high/low SPD, transcoding,
shi7, ITS, etc.) is defined in `docs/glossary.md` — read it before assuming
what a term means; e.g. *transcoding* here is **not** the usual
media-conversion meaning.

## Toolchain

- Runtime: **bun** (current toolchain: 1.3.x). There is no separate build step
  `tsconfig.json` has `noEmit: true`; bun executes `.ts` directly.
- TypeScript is strict (`strict`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`, `verbatimModuleSyntax`). Code uses ESNext features
  including iterator helpers (`Iterator.from(...)`).
- Path aliases: `src/*` and `test/*` (see `tsconfig.json`). Import with
  `src/hashing`, `src/transcoding`, etc. — not relative paths.

## Common commands

- Install deps: `bun install`
- Run all tests: `bun test --timeout 20000` for intensive hashing test suites
- Run a single test file: `bun test test/hashing/create.test.ts`
- Filter by test name pattern: `bun test --test-name-pattern "diffusion"`
- Typecheck (no emit): `bunx tsc --noEmit`

Tests use `bun:test` (`describe`, `it`, `it.each`, `expect`, `beforeAll`,
`afterAll`). The hashing suite contains large statistical/diffusion tests that
allocate millions of bytes — expect multi-second runs.

## Architecture

Four layered modules under `src/`. Each has an `index.ts` barrel that defines
the public surface — prefer importing from the barrel (`src/transcoding`)
rather than reaching into internal files.

### `src/stochastic` — pseudo-randomness primitives

Composable PRNG stack, modeled loosely on the C++ `<random>` design:

- `SplitMix64` (`seedGenerators.ts`) — seed generator producing 64-bit `bigint`
  seeds. If no seed is provided, derives one from `Math.random()`.
- `Xoroshiro128Plus` (`uniformRandomBitGenerators.ts`) — uniform random bit
  generator, initialized from a `SeedGenerator<bigint>`.
- `UniformUint64DistributionEngine` (re-exported as `UniformUint64`) — uniform
  unsigned-integer distribution over a `[min, max]` bigint range, built on a
  `UniformRandomBitGenerator`.
- `shuffleBuffer` / `shuffleArray` — in-place Fisher-Yates-ish shuffle driven
  by a distribution engine.

Typical chain: `new UniformUint64(new Xoroshiro128Plus(new SplitMix64(seed)))`.
This stack is reused throughout the codebase whenever determinism-from-seed is
needed; do not introduce a different RNG.

### `src/transcoding` — SPD tables and the Transcoder

- `SPD` (`spd.ts`) — a Stochastic Private Dimensional transcoding table. Two types:
  - `'low'`: lane size 16, total 256 bytes — used to transcode `'high'` SPDs (nibble-level).
  - `'high'`: lane size 256, total 64 KiB — used to transcode arbitrary byte data.
  - `DIMENSIONAL_FACTOR = 2`: encoding turns N bytes into 2N; decoding does the
    inverse. Many size calculations across the codebase derive from this — if
    you ever generalize the dimensional factor, expect to touch every module.
  - Constructed either with an existing buffer (`kind: 'buffer'`) or generated
    from a seed (`kind: 'seed'`). Seed-generated SPDs are deterministic;
    `draft/how-to-start.md` warns this is dangerous outside of specific use cases
    (seeded hashing, one-shot exchange).
- `Transcoder` (`transcoder.ts`) — holds a low SPD and/or high SPD lazily; exposes:
  - `encode` / `decode` for arbitrary data via the high SPD.
  - `encodeHighSPD` / `decodeToHighSPD` for transmitting high SPDs across the
    wire via the low SPD.
  - Encoding internally builds a reverse-lookup `Map<byte, address[]>` (the
    "encoding SPD"). This map is lazily cached per Transcoder instance so a
    freshly-constructed Transcoder pays the cost on first encode. **Encoding
    takes ~3× the storage of decoding by design** (see `draft/how-to-start.md`
    "Second task").
  - `EncodeOptions.seed` enables **deterministic encoding**. Per the design
    notes: reusing a seed with the same SPD more than once is a security
    catastrophe. Treat seeded `encode()` as one-shot.

### `src/hashing` — shi7

`Shi7` is an experimental ITS hashing function (`seeded stochastic hashing by
information transcoding`). Key invariants:

- `hashBitSize` is one of `64 | 128 | 256 | 512 | 1024` (default 256).
- The hasher's `seed` is the SplitMix64 *state* derived from the user-supplied
  seed, **not** the raw user input — equality checks in tests use `new
  SplitMix64(seed).state()`.
- `hash(message)` dispatches into four code paths by size (empty / ≤ seed size
  / between seed and hash size / ≥ hash size). The empty-message hash is computed
  once and cached on the instance.
- Odd-sized messages and "decoded message vs original message" collisions are
  handled explicitly by burning extra seeds at specific points in
  `decodeMessageUntilSizeInBytes`. The `// NOTE:` comments there document *why* —
  do not delete those `seedGenerator.newSeed()` calls thinking they're dead code;
  removing them reintroduces collisions the test suite explicitly checks for.
- Test invariants (in `test/hashing/`): bitwise diffusion mean must fall within
  `[0.45, 0.55]` across many seeds — when modifying the algorithm, expect to run
  the full hashing suite and look at the diffusion means, not just pass/fail.

### `src/exchange` — high-SPD peer exchange protocol

> [!WARNING]
> Very early, experimental and not working yet apart for specific case where
> both the initiator and the recipient share the same low SPD for encoded high
> SPD transfer. Implements the multi-step protocol described in
> `draft/how-to-start.md` "Fourth task":

- `Initiator` and `Recipient` (`peers.ts`) extend an abstract `Peer`. Each owns
  a `Transcoder` that lazily creates its own low SPD.
- `Exchanger` (`exchanger.ts`) drives the state machine: `not_started →
  initiated → accepted → finalized` via `initiate()`, `accept()`, `finalize()`.
  Calling out-of-order throws.
- The protocol aims to use a "common alphabet" trick: by comparing the initiator's
  encoded entropy source byte-by-byte with the recipient's encoded payload (both
  encoded with the **same seed** against their respective low SPDs), positions
  where addresses match identify nibbles the two parties share. That subset is
  large enough to one-shot encode a seed, but small enough to keep the rest of
  the SPDs secret. Read `draft/how-to-start.md` "Note on the common alphabet"
  before touching `computeCommonAlphabet` / `computeNewSeed`.
  > [!WARNING]
  > Due to the nature of primitives used in this exchange (ITS) it can't work
  > if recipient and initiator do not share the same low SPD, thus, this scheme
  > is not yet usable, need more researches
- After `finalize()`, **both peers discard the one-time low SPD** and keep only
  the shared high SPD. The `this.transcoder_ = new Transcoder({ highSPD })`
  reassignment in `peers.ts` is intentional discarding, not a refactor
  opportunity.

## Conventions worth knowing

- The codebase prefers `Buffer<ArrayBuffer>` (Node-style Buffer over a real
  ArrayBuffer) at API boundaries. Many functions take `Readonly<Buffer<ArrayBuffer>>`.
- `bigint` is used everywhere for 64-bit values (seeds, hashes, RNG outputs).
  Hashes are returned as `bigint`; tests convert via `0x${buffer.toHex()}`.
- Doc comments (`/** ... */`) on public class members are used to document
  invariants and security caveats — keep them in sync if you change behavior.
  Inline `// NOTE:` comments mark security-sensitive code; treat them as
  load-bearing.
- Commit message style (see `git log`): conventional-commits-ish, scoped by
  module — `feat(hashing): ...`, `test(hashing): ...`, `refactor(transcoding):
  ...`.
