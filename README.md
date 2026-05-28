# spdit-prototype

## What is SPDIT

**SPDIT** (pronounced *speed-it*) stands for **S**tochastic **P**rivate
**D**imensional **I**nformation **T**ranscoding. It is a scheme for exchanging
information securely and privately by transcoding bytes through large,
secret, stochastically-generated lookup tables called *SPDs* — rather than by
applying the algebraic transformations that conventional cryptography relies on.

The goal of SPDIT is *at term* to provide *information-theoretically secured*
(ITS) primitives: primitives that remain secure even against an adversary with
unbounded computing resources and time. This puts it in a different category
than quantum-resistant cryptography efforts that still depend on hardness
assumptions.

> [!NOTE]
> The final goal is to tend to a system that is not susceptible to be broken by
> known quantum algorithms. It is not yet the case. However, this demonstration
> clearly paves the way to achieve this goal.

For the precise meaning of terms like *SPD*, *high SPD*, *low SPD*,
*transcoding*, *shi7*, *ITS*, see [`docs/glossary.md`](docs/glossary.md).

## This is a prototype

This repository is a **prototype**. Its purpose is to demonstrate that the
algorithms work and to act as a reference for a future, performant **modern
C++** implementation. TypeScript on `bun` was chosen for fast iteration and
readability, not for speed. Care has been taken to keep the prototype usable on
realistic inputs, but performance is explicitly not a goal here.

Expect API churn, expect rough edges, and expect implementation choices that
exist to make the algorithm legible rather than fast.

## This is not (conventional) cryptography

SPDIT is **not** a set of cryptographic primitives in the modern sense. It does
not rely on:

- algebraic hardness assumptions (factoring, discrete log, lattices, …)
- block-cipher / stream-cipher constructions
- algorithmic hash families (SHA, BLAKE, …)

Instead it relies on *entropy*: very large secret stochastic tables, dimensional
transcoding, and one-shot deterministic encodings. As a consequence, SPDIT aims
to be immune by construction to quantum algorithms such as Shor's and Grover's
that target conventional crypto primitives.

If you are looking for a drop-in replacement for TLS, AES, or SHA-256, this is
not it.

## Inspiration

This work is directly inspired by the ongoing research of **Julian Cassin**
(*CyborgUnicorn*), in particular his *ZOSCII* construction. SPDIT generalizes
and extends ideas from ZOSCII into a broader family of stochastic, dimensional,
information-theoretic schemes. Credit for the foundational insight belongs to
him; the experiments here are an independent exploration of the design space.

## What works today

- **Pseudo-random number stack** (`src/stochastic`): `SplitMix64` →
  `Xoroshiro128Plus` → `UniformUint64`, plus seeded in-place shuffle utilities.
- **SPD generation** (`src/transcoding`): both `low` and `high` SPDs, either
  from a seed (deterministic) or wrapping an existing buffer.
- **Transcoding** (`src/transcoding`): a `Transcoder` that performs
  `encode` / `decode` of arbitrary data via a high SPD, and
  `encodeHighSPD` / `decodeToHighSPD` for transmitting a high SPD across the
  wire via a low SPD. Both directions are pure lookups for performance.
- **shi7 hashing** (`src/hashing`): an experimental ITS hash function — *seeded
  stochastic hashing by information transcoding* — with configurable hash bit
  size (`64 | 128 | 256 | 512 | 1024`). Empty / small / mid / large message
  paths are all handled, including specific anti-collision provisions for
  odd-sized messages and decoded-message look-alikes. The test suite verifies
  collision resistance, second-pre-image diffusion, and bitwise diffusion means
  in `[0.45, 0.55]`.

## What is still very much research

SPDIT is far from complete. Several essential primitives still need to be
researched, designed, and validated before SPDIT can be considered a usable
information-exchange scheme:

- **Peer-to-peer SPD exchange** (`src/exchange`): currently only works in the
  degenerate case where both parties already share the same low SPD. The
  general case — two parties with different low SPDs agreeing on a fresh high
  SPD without leaking it — is **not yet solved**. The current `Initiator` /
  `Recipient` / `Exchanger` code implements the "common alphabet" trick
  described in `draft/how-to-start.md`, but the asymmetric-low-SPD scenario
  remains an open problem.
- **Fast message compression prior to encoding**: transcoded data inflates by
  the dimensional factor (×2 here). For SPDIT to be practical on real-world
  payloads, an ITS-friendly compression step that runs *before* encoding — and
  does not leak structure — needs to be designed and tested.
- **ITS signature schemes**: there is no signature primitive yet. Designing an
  authentication / non-repudiation scheme that stays within the ITS regime is
  an open research direction.
- **Higher dimensionality**: this prototype is fixed at dimensional factor 2.
  Generalizing the scheme should be feasible and would further increase
  security margins at the cost of larger SPDs and encoded payloads.
- **Stronger evaluation of shi7**: collision and diffusion checks pass on the
  current test corpus, but shi7 has not been evaluated against the full
  battery of attacks a real-world hash function must withstand.

If any of the above interests you, the design notes and open questions live in
[`draft/how-to-start.md`](draft/how-to-start.md).

## Requirements

- [bun](https://bun.sh) (the TypeScript runtime used here)

## Quick start

```sh
bun install
bun test --timeout 20000
```

See [`CLAUDE.md`](CLAUDE.md) for a deeper map of the codebase, common commands,
and conventions.

## License

See [`LICENSE`](LICENSE).
