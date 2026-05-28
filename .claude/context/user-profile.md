# User profile

Distilled from prior sessions. Use this to calibrate tone and depth — not as
a substitute for paying attention to what the user is actually saying in the
current conversation.

## Role and orientation

- **Solo developer working in research / prototype mode.** This codebase is
  explicitly a prototype; performance is a stated non-goal. The author writes
  TypeScript here because it's legible, not because it's the destination.
- **The C++ port is the real artifact.** Multiple design choices in this repo
  exist to make a future C++ reimplementation faithful — most visibly the
  `UINT64_SIZE = 2n**64n` constant that mirrors C++ unsigned-wrap semantics.
  When you propose changes, it's worth framing them in terms of how they map
  to a C++ port.
- **Engaged with cryptography but doesn't position themselves as a
  formally-trained cryptographer.** Comfortable reasoning about statistics
  and PRNG internals; explicitly asked for a "much more versed in the
  discipline" review of Shi7 in a past session (which produced
  `docs/cryptanalysis-shi7.md`). Treat them as a serious engineer
  engaging with cryptography — neither a novice nor a credentialed
  cryptographer. The self-assessment is modesty, not autobiography; don't
  over-explain basics, but do flag when a topic genuinely needs deeper
  domain expertise.

## How they engage with feedback

- **Acts on structural feedback quickly.** When the Shi7 cryptanalysis
  surfaced Critical/High/Medium findings, every one was addressed in the
  commit cluster that followed (`f6b9102` … `270b416`). Walked back
  ITS/quantum-resistance overclaims in docs after the analysis. They take
  hard feedback well; don't soften it to be polite.
- **Pushes back when something doesn't match their mental model.** Earlier
  conversations show them stopping and asking for explanation when a
  suggestion conflicted with their (C-style) intuition — and the *right*
  response was to explain, not to retreat. Stand by correct suggestions; just
  make sure you can defend them.

## What to do with this

- Default to explaining the *why* behind a suggestion, especially when it
  touches PRNG details, hashing, or anything that will eventually be C++.
- Don't over-explain basic TypeScript or general programming concepts.
- Frame trade-offs concretely. The author thinks in terms of "what does this
  look like in C++" and "what is an attacker able to do with this".
- When discussing crypto, be explicit about threat models and what is /
  isn't claimed. The author has been burned once by overclaiming and is now
  conservative — be conservative with them.
