# Sortify

A Vue 3 single-page app for managing Spotify playlist libraries. No backend.
All data lives in IndexedDB.

Read these before writing code:

- `docs/conventions.md` — how to write code here
- `docs/architecture.md` — how the app is built, and why
- `docs/backlog.md` — what was set aside on purpose, and why

## Verify

```
pnpm run ci      lint + typecheck + test + build
pnpm test        vitest run, no e2e
pnpm test:e2e    playwright, not run in CI
```

Run `pnpm run ci` before calling work done. Not `pnpm ci` — pnpm has a built-in
`ci` that shadows the script and fails outright. A green CI does not mean e2e
passed; `ci.yml` runs `pnpm test`, which is vitest only.

## Rules

- Flag ambiguities. Do not decide architecture during implementation.
- No `any`. Prefer `unknown` with a type guard. `docs/conventions.md` carries
  the one standing exception.
- Do not add dependencies without approval.
- `.gitignore` carries `-*`, which swallows any dash-prefixed path with no
  error. Do not name files that way.
