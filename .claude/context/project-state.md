# Project state

What stage things are in, what's been ruled out, what's open. Read this
before proposing architectural changes.

This file is the most time-sensitive in the directory — re-check against
current code and recent commits before acting on it.

## What this project is

SPDIT — Stochastic Private Dimensional Information Transcoding. A prototype
of a data exchange scheme that aims to be **information-theoretically
secured without cryptographic primitives**. The author has explicitly walked
back stronger claims (full ITS, quantum-resistance) after the Shi7
cryptanalysis showed that a 64-bit seed cannot deliver either property.

The README framing the author asked for, in past session: prototype, C++
port coming, inspired by Julian Cassin / ZOSCII, **not** conventional
cryptography, incomplete in specific places (see below).

## Settled stage

The following are not currently open for discussion unless the author
reopens them:

- **TypeScript prototype with `bun` runtime.** No build step, no
  alternative runtime, no rewrite to a different language *before* the C++
  port.
- **`Peer` is the name for the abstract exchange participant.** Chosen over
  Party / Principal / Participant / Counterpart / Agent / Node / Member /
  Entity / Holder / Exchanger. Don't propose renaming.
- **Distribution test is chi-square goodness-of-fit, not "1M unique
  values".** The old test checked a statistically impossible property
  (birthday paradox guarantees duplicates). Don't revert it.
- **Default seeds use `node:crypto.randomBytes`, not `Math.random()`.**
  Closed by cryptanalysis finding C2.

## Research-incomplete (flagged but not solved)

These are explicitly known to be unfinished. Treat them as open problems,
not bugs:

- **P2P high-SPD exchange (`src/exchange`)** — currently only works in the
  degenerate case where initiator and recipient already share the same low
  SPD. The whole point was to *not* require that. Open research problem;
  warned about in `CLAUDE.md` and in `peers.ts` comments.
- **Fast pre-encoding compression.** SPD encoding doubles message size
  (`DIMENSIONAL_FACTOR = 2`). A compression pass before encoding is wanted
  but the primitive doesn't exist yet.
- **ITS signature schemes.** Mentioned in the README framing as a desired
  primitive; no design or implementation exists.

## Biggest open design question

**Whether to widen the seed beyond 64 bits before the C++ port.**

Cryptanalysis finding H1 makes this concrete: a 64-bit seed cannot be
information-theoretically secure (an unbounded adversary enumerates 2^64),
and cannot give 128-bit post-Grover security (which requires a 256-bit
secret). The recommended fixes are either:

1. Replace `Xoroshiro128Plus` / `SplitMix64` with `xoshiro256**` so the
   internal PRNG state is 256 bits.
2. Or treat the high SPD itself as the key (64 KiB of entropy), and stop
   trying to derive everything from a 64-bit user seed.

Both options have ripples through `src/stochastic`, `src/hashing`, and
`src/exchange`. This is *the* call to make before the C++ port begins.

## Recent commit narrative (as of 2026-05-28)

Reading `git log --oneline` is more current than this list, but for
orientation: the last cluster of commits (through `f35507a`) was driven by
the Shi7 cryptanalysis. Findings addressed: C1, C2, H3, M1, M3 (M3
required several iterations — `75a93ef`, `25b059f`, `d1c6d9a`, `270b416`).
The doc-only commit `f35507a docs: do not overclaim ITS and quntum
resistance anymore` was the H1-driven retraction.

H1 itself (the 64-bit seed ceiling) is **not** structurally fixed — only the
overclaims were walked back. Cryptanalysis findings H2, M2, M4, and the
"missing tests" gap are also outstanding; the doc's §7 lists a recommended
priority order. Note that the cryptanalysis itself was an AI static review,
not a human cryptanalyst's audit (the doc says so explicitly in its closing
note) — its findings are useful hypotheses, not proofs.
