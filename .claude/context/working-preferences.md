# Working preferences

Concrete rules from past sessions. Each entry has the rule, the *why*, and
when it applies. If you find yourself about to violate one of these, stop
and reconsider — these were learned, not invented.

## Don't unilaterally delete research artifacts — ask first

**Rule.** When you've produced intermediate scripts, probe files, scratch
tests, or exploratory artifacts during a session, don't `rm` them on your
own initiative as part of "cleanup". Surface the candidates and let the
author say whether to keep or delete.

**Why.** In a prior cryptanalysis session, the assistant tried to delete a
`.shi7-probe.ts` file as part of wrap-up and the author interrupted the
tool call. The author *does* delete probes when they've served their
purpose — `docs/cryptanalysis-shi7.md` itself notes "Probe scripts used
to generate this report have been removed because of their temporary
meaning" — but the decision is theirs, not the assistant's.

**When it applies.** Any session where exploratory code, probe scripts,
ad-hoc experiments, or scratch test files were produced. Default behavior
is to leave them in place and offer to clean up; never delete without
explicit consent.

## Frame TypeScript choices in terms of the C++ port

**Rule.** When suggesting changes to numeric handling, integer sizes, modular
arithmetic, or any low-level mechanics, articulate how the choice maps to
C++. Prefer designs that translate 1:1 over designs that rely on
TypeScript-specific behavior.

**Why.** The author has stated this prototype will be ported. When a past
proposed fix worked in TypeScript but didn't have a clean C++ analogue, the
author pushed back until a structurally equivalent option was found —
introducing `UINT64_SIZE = 2n**64n` as an explicit modulus so the BigInt
code mirrors C++ unsigned wrap.

**When it applies.** `src/stochastic` (PRNGs, distributions, seeding), any
new low-level numeric code, anywhere the BigInt arithmetic is non-obvious.

## Brainstorming: list options, don't argue for one

**Rule.** When the user asks for naming suggestions or option exploration,
give a tight list and stop. Don't add commentary or push a favorite unless
asked.

**Why.** In the `Party → Peer` renaming session, the author wanted a list
they could scan and pick from. Extra commentary was friction.

**When it applies.** Any "what should I call this", "give me options for",
"how would you name X" style request.

## Don't reintroduce non-CSPRNG seeds

**Rule.** Never reach for `Math.random()` in seeding paths. Use
`node:crypto.randomBytes` (or equivalent C++ CSPRNG when porting).

**Why.** A prior default seed used `Math.random().toFixed(20)` and was
flagged in cryptanalysis finding C2 — V8's `Math.random()` is xorshift128+
with at most 52 bits of meaningful entropy, which silently capped the
effective seed space. Replaced in commit `318e426`.

**When it applies.** Anywhere a seed is being defaulted or generated without
explicit user input — `src/stochastic`, hashing seed derivation, anywhere
`new SplitMix64()` is called without an argument.

## Take cryptanalysis findings seriously, even when they're inconvenient

**Rule.** When you find a structural issue (state-space limits, missing
domain separation, biased shuffles, distinguishers), surface it directly
with severity. Don't soften.

**Why.** The author asked for a "thorough cryptanalysis ... another point of
view much more versed in the discipline" and acted on every finding,
including ones that required walking back marketing claims (ITS,
quantum-resistance). Honest hard feedback is what they want.

**When it applies.** Any review of `src/hashing`, `src/stochastic`,
`src/transcoding`, or `src/exchange`. Anything touching seed material,
domain separation, or claims of security properties.
