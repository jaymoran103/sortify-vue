# Sortify — Agent Instructions

Browser-based Spotify playlist manager. Vue 3 SPA, TypeScript strict, Pinia, Dexie (IndexedDB),
Vue Router. No backend; all data is local.

`.github/-copilot-instructions.md` covers the same ground more briefly and is auto-loaded by
Copilot. Where the two disagree, this file wins — it is written from the codebase rather than
summarising intent.

Curated docs (`ARCHITECTURE.md`, `ROADMAP.md`, `BACKLOG.md`, `LEARNINGS.md`, specs) live at
`../docs/`, **outside this repository**, until a scheduled migration.

---

## Verification

```
pnpm run ci      # lint -> typecheck -> test -> build. Run before every commit.
pnpm test <path> # single spec file
pnpm test:e2e    # Playwright, Chromium, against the production build
```

**Always `pnpm run ci`, never `pnpm ci`.** pnpm 10.33 has a built-in `ci` command that shadows the
package script and fails outright with `ERR_PNPM_CI_NOT_IMPLEMENTED`.

`pnpm test` is `vitest run` only — the Playwright suite is not wired into CI.

**`pnpm run ci` is currently red for a reason unrelated to any code you write**: `eslint.config.ts`
fails `vue-tsc` because of an upstream type bug in `@vue/eslint-config-typescript@14.7.0`. See
`BACKLOG.md` for the diagnosis and the two rejected workarounds. Until it is fixed, verify with the
equivalent scoped loop, which still covers everything you touch:

```
pnpm lint
pnpm exec vue-tsc --build tsconfig.app.json      # all of src/
pnpm exec vue-tsc --build tsconfig.vitest.json   # all of tests/
pnpm test
pnpm build-only                                  # not `pnpm build`, which re-runs type-check
```

Do not "fix" `eslint.config.ts` casually — two plausible annotations were tried and both failed,
and the union's member types are not exported.

---

## Conventions

These are observed patterns, with the file to copy from named. Match the neighbours; when a
convention below and an adjacent file disagree, follow the adjacent file and say so.

### Structure

- Components `<script setup lang="ts">`. No Options API, no `defineComponent()`.
- Stores are Pinia setup syntax: `defineStore('name', () => { ... })`, returning a flat object of
  refs, computeds and functions. `ref()` / `computed()` / `watch()` — never `reactive()` for
  top-level store state.
- Composables prefixed `use`, returning a plain object (never a tuple), with an explicit return
  type annotation on the function signature — see `useListSelection.ts`.
- `defineProps<T>()` / `defineEmits<T>()` with types. Never runtime validation.
- Named exports only, Vue components and route definitions excepted.
- No `any`. `unknown` plus a type guard.
- `@/` alias for `src/`. Import order: vue → libraries → local types → local modules.
- Types in `src/types/` by domain. Domain logic that is not a component gets its own top-level
  directory — `src/spotify/`, `src/adapters/`, `src/similarity/`.
- Components in `src/components/<module>/`, module = `dashboard` | `workspace` | `library` |
  `similarity` | `about` | `common` | `modals`.

### Comments

- `/** ... */` on every exported function and every store action: purpose, inputs, outputs, side
  effects. One line where one line covers it (`stores/playlists.ts`).
- A header block comment on each store and each `db` table description explaining what the thing is
  for, not what it does.
- Inline `//` comments on non-obvious logic, and on decisions a reader would otherwise question.
  The comment explaining *why* `triggerRef` is called in `useLiveQuery.ts` is the model.
- `// FUTURE:` for a deliberate deferral, `// TODO:` for a gap. Both are used to record a judgement
  that was made, not a reminder to someone else — write the reasoning, not just the intent.
- Commented-out code is kept only when a comment says why it is there
  (`LibraryCard.vue` album-search case). Otherwise delete it.
- When refactoring commented code, update the comment. Do not drop it.
- Plain ASCII in all comments and docs — no emoji, no unicode punctuation. UI glyphs in templates
  (`✎`, `⋯`, `✓`) are markup, not documentation, and are fine.
- Section dividers in longer `<script setup>` blocks, padded to roughly 80 columns:
  ```
  // ── Search ───────────────────────────────────────────────────────────────────
  ```
  and in `<style>` blocks: `/* ── View toggle ── */`

### CSS

- `<style scoped>` on every component. No Tailwind, no CSS modules.
- BEM-ish naming, block = the component's own kebab-case name:
  `library-card__row`, `library-card__toggle-btn--active`.
- The root element carries the block name as its class.
- **Every** colour, space, radius, font size, duration and easing comes from a `variables.css`
  token. A literal hex or px value in a component is a bug unless it is a one-off geometry
  (`min-width: 18px`).
- Shared module styles live in a sibling CSS file imported at the top of the scoped block:
  `@import './card.css';`
- Utility classes from `utilities.css` (`text-muted`, `text-sm`, `btn btn--secondary`, `truncate`)
  are preferred over redefining the same rules locally.
- Colour mixing uses `color-mix(in srgb, var(--color-accent) 12%, transparent)` rather than a new
  token, for one-off tints.

### Data flow

- Dexie is the single source of truth. `useLiveQuery` bridges it to Vue refs; stores expose those
  refs; components read them. All writes go through store actions.
- Any ref written from outside Vue's scheduler must be followed by `triggerRef(ref)`. See
  `LEARNINGS.md` 2026-04-13-04.
- A store's live-query ref can be `undefined` before its first result. Read it as
  `store.playlists ?? []` at every call site.
- Batch multi-row writes in one `db.transaction` so `liveQuery` fires once, not once per row
  (`batchUpdatePlaylists`).
- Any Vue component object stored in a `ref` must be `markRaw`-wrapped at the write site. See
  `LEARNINGS.md` 2026-04-13-02.
- Render helpers must be pure. Never mutate reactive state from a function called during template
  rendering. See `LEARNINGS.md` 2026-04-19.
- **Anything crossing a serialization boundary must be rebuilt as plain data first** — Web Workers,
  `postMessage`, `structuredClone`, `IndexedDB`. Vue reactive proxies cannot be cloned, and a
  mocked worker will not catch it. Spreading a reactive object yields a plain object; passing
  `.value` does not. Assert it with `structuredClone`, not with a mock. See `LEARNINGS.md`
  2026-08-15-01.
- **A `useLiveQuery` store has three states but its ref shows two.** It seeds with `[]`, so "not
  yet loaded" is indistinguishable from "empty". Any consumer that behaves differently on empty
  must treat the empty case as "wait and retry". See `LEARNINGS.md` 2026-08-15-02.
- **Dexie multiplies its declared version by ten.** `db.version(5)` is IndexedDB version 50. Open
  without a version number when attaching to a Dexie-owned database directly.

### Components

- `ScrollableList` is dumb: virtual scroll plus slots. Filtering, sorting and selection compose at
  the **view** level via `useListFilter` / `useListSort` / `useListSelection`.
- Menu construction belongs to the view that owns the state, not the presentational child that
  displays the trigger. `WorkspaceView.buildColumnMenu()` is the model.
- Modals are a singleton: one `BaseModal` in `App.vue`, driven by the `ui` store, opened with
  `useModal().open(Component, props)` which resolves a promise.
- Empty states are contextual, not generic — a filtered-to-nothing list and an empty library say
  different things (`LibraryCard.vue`).
- Destructive actions confirm through `ConfirmModal` with `danger: true` and a confirm label that
  names the count.

### Testing

- Unit tests for every store action, composable, adapter and util.
- Component tests for non-trivial rendering logic.
- Tests mirror `src/` under `tests/unit/` and `tests/components/`; `tests/e2e/` is Playwright.
- Keep algorithms in pure modules so tests never need a worker, a DOM, or a live database.
- **Stub `ScrollableList` in component tests.** It virtualises against a real layout, which jsdom
  does not provide, so it renders zero rows unstubbed and every row assertion passes vacuously.
  `tests/components/dashboard/LibraryCard.spec.ts` has the canonical stub.
- **Mock a Pinia store with `reactive()`, not a bag of refs.** A real store unwraps refs on property
  access; `{ playlists: ref([]) }` makes `store.playlists` a `Ref` and every read in the code under
  test breaks.
- Reach for an e2e test when the behaviour only exists in a browser — worker boundaries, IndexedDB
  hydration, routing. Two shipped bugs in the similarity module were invisible to 678 unit tests
  and caught immediately by eight e2e tests.

### Commits

Conventional commits. Subject line brief and lower-case after the type; bullets only when one line
will not cover it.

```
feat(similarity): add inverted index worker

- build trackID -> playlistIDs map off the playlist store
- retain the index between scans so threshold changes do not rebuild
- exclude playlists over 250 tracks from the track axis, reported in the header
```

Scopes seen in history: `workspace`, `similarity`, `dashboard`, `spotify`. Types: `feat`, `fix`,
`refactor`, `docs`, `test`, `chore`.

---

## Do not

- Make architectural decisions during implementation. Flag the ambiguity and stop.
- Add a dependency without explicit approval in the feature spec. Runtime deps are currently five
  packages and bundle size is a real cost.
- Skip tests for store actions or adapter logic.
- Commit a speculative error path that fires on the happy path. A `// TODO need this check?`
  comment is the tell. See `LEARNINGS.md` 2026-04-13-03.
- Lower the Dexie version number. `SortifyDB.CURRENT_VERSION` increments monotonically for every
  schema change, including non-breaking ones, so older open tabs get the `versionchange` flow.

---

## Module invariants

Easy to break, expensive to debug.

**Workspace** (`src/stores/workspace.ts`)

- Every playlist mutation updates `trackIDs` (ordered array), `trackIdSet` (lookup Set) **and**
  `modifiedIds` together.
- `stableOrder` governs the visible track list, not membership. Toggling membership must never
  reorder or hide a row.
- `WorkspaceSession` persists only `playlistIds`. Anything else is in-memory and lost on reload.
- `PlaylistId = number | string` — library playlists carry numeric IDB keys, workspace-created ones
  carry `pending-N` strings until `save()` resolves them.

**Similarity** (`src/similarity/`, `src/stores/`)

- All algorithms live in pure modules. `similarity.worker.ts` is a message shim and holds no logic.
- An empty cursor means the whole library. No operation ever prompts for a selection.
- Every result row carries its own denominator. A row that cannot explain itself in one sentence
  does not ship.
- A preset is a named set of control values and nothing else. If it needs new code it is a new
  operation, which is an architectural event.
- No silent caps. Any exclusion a scan makes is named in the result.
