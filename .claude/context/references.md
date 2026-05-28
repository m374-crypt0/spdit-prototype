# References

External pointers and in-repo artifacts worth knowing about. Mentioned by
the author in prior sessions or surfaced by past analysis.

## Foundational influences

- **Julian Cassin (CyborgUnicorn) and ZOSCII.** Named by the author as the
  foundational inspiration for SPDIT. Worth knowing about for any
  conversation about design history or the project's intellectual lineage.
  The author asked that this credit be visible in the README.

## In-repo artifacts to (re-)read

- **`docs/cryptanalysis-shi7.md`** — the durable artifact of a long
  cryptanalysis session. Threat model, findings (C1/C2 critical, H1/H3
  high, M1/M3 medium), recommended fixes. Read before touching anything in
  `src/hashing` or `src/stochastic`. H1 in particular (the 64-bit seed
  ceiling) is the biggest unaddressed structural finding.
- **`docs/glossary.md`** — domain vocabulary (SPD, transcoding, shi7, ITS,
  high vs low SPD, etc.). "Transcoding" here is *not* the media-conversion
  meaning. Re-read whenever a term feels unclear.
- **`draft/how-to-start.md`** — background, design rationale, and ongoing
  task tracking. Has the original "Fourth task" description of the
  exchange protocol and the warning about deterministic seeded encoding.

## Algorithms used (with sources)

- **Lemire's bounded-uint64 algorithm.** Implementation in
  `src/stochastic/distributions.ts` (rejection-sampling variant). Reference
  it when reasoning about modulo bias or proposing changes to the bounded
  uniform path.
- **Mike Bostock — "naïve shuffle is biased".** Cited in cryptanalysis
  finding H3 against `shuffleStorage`. Useful framing if shuffle
  correctness comes up again.
- **xoshiro256\*\* / xoroshiro128+.** The current PRNG stack uses
  xoroshiro128+; xoshiro256** is the candidate widening (see
  [project-state.md](project-state.md) §biggest open design question).

## Test batteries explicitly **not** run

The Shi7 cryptanalysis stopped short of these — listed as recommended next
steps in `docs/cryptanalysis-shi7.md` §2. If the author later asks for
"deeper" PRNG / hash analysis, these are the artillery:

- **NIST SP 800-22** — statistical test suite for RNGs.
- **dieharder** — battery of randomness tests.
- **PractRand** — modern PRNG quality battery, finds weaknesses NIST misses.
- **TestU01 BigCrush** — the heaviest of the standard batteries.
