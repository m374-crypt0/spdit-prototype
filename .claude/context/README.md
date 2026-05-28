# `.claude/context/` — durable session context for SPDIT

This directory carries context that isn't otherwise visible from the code, git
history, or `CLAUDE.md` — distilled from prior Claude Code conversations with
the project author. It is checked into the repo so it survives machine
changes and is available to any contributor using Claude (or any other AI
assistant) on this codebase.

It is **not** a changelog or design doc. It is a memory aid for an assistant
joining mid-stream.

## When to read what

| If you're about to… | Read |
|---|---|
| Have any non-trivial conversation about this repo | [user-profile.md](user-profile.md), [working-preferences.md](working-preferences.md) |
| Touch `src/hashing` or anything Shi7-related | [design-decisions.md](design-decisions.md) **and** `docs/cryptanalysis-shi7.md` |
| Touch `src/stochastic` (PRNG / distributions) | [design-decisions.md](design-decisions.md) §uint64, §seeding |
| Propose architectural changes | [project-state.md](project-state.md) — to know what's research-incomplete vs. settled |
| Look something up "from the literature" | [references.md](references.md) |

## File list

- **[user-profile.md](user-profile.md)** — who the author is, how they work, what they know.
- **[working-preferences.md](working-preferences.md)** — corrections and confirmations from past sessions. Rules to follow.
- **[project-state.md](project-state.md)** — what stage things are in, what's been ruled out, what's open.
- **[references.md](references.md)** — external pointers (papers, tools, in-repo artifacts worth re-reading).
- **[design-decisions.md](design-decisions.md)** — non-obvious technical decisions and their *why*.

## Maintenance

- Update a file when its content changes — e.g. a preference is updated, a
  project decision lands, a reference becomes stale.
- If something here conflicts with the current code or `CLAUDE.md`, the code
  and `CLAUDE.md` win — and *this file is stale*. Fix or delete it.
- Don't duplicate `CLAUDE.md`. That file is the source of truth for module
  layout, conventions, and command incantations. This directory is for the
  *human and historical* context around the project.
- Don't write into this directory from inside a feature branch unless you're
  sure the context is durable. Ephemeral notes belong in the conversation,
  not here.

## Origin

These files were generated on 2026-05-28 from a scan of Claude Code session
transcripts under `~/.claude/projects/<this-repo>/`. The scan was performed by
a subagent; the synthesis was authored from its report. Treat any specific
claim with healthy skepticism — verify against the current code before acting
on it, especially when a file path or symbol is named.
