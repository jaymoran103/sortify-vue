# Sortify Vue 3 — Project Instructions

## Project

Sortify is a browser-based Spotify playlist manager. Vue 3 SPA with TypeScript, Pinia, Dexie (IndexedDB), and Vue Router. No backend. All data is local.

## Stack

Vue 3 (Composition API, `<script setup>`), TypeScript strict, Vite, Pinia, Dexie.js, Vue Router 4, @tanstack/vue-virtual, Vitest, Playwright.

---

## Repository layout

**`sortify-vue/` is the only git repository.** Remote: `github.com/jaymoran103/sortify-vue`.

The `docs/` tree lives one level up, **outside version control** — including `ARCHITECTURE.md`, `ROADMAP.md`, and all task specs. It is not reachable from a clone. A migration bringing curated docs into the repo is planned; until then, when a task references `ARCHITECTURE.md` or a spec, the path is relative to `../docs/`.

```
sortify-new/
├── docs/                      <- NOT in git
│   ├── ARCHITECTURE.md        structural reference
│   ├── ROADMAP.md             phases, deferred features, decisions log
│   ├── tasks/, 0430-tasks/    task specs
│   └── superpowers/specs/     design specs
└── sortify-vue/               <- the git repo
    ├── CLAUDE.md              this file
    ├── src/, tests/
    └── .github/workflows/ci.yml
```

## Verification

```
pnpm ci          lint + typecheck + test + build   <- run before declaring work done
pnpm test        vitest run (unit + component)     <- does NOT include e2e
pnpm test:e2e    playwright                        <- not run in CI
pnpm typecheck   vue-tsc --build
pnpm lint
```

`pnpm ci` is the one-command verification loop. Note that CI runs `pnpm test`, so the Playwright suite never executes there — a green CI does not mean e2e passed.

---

## Conventions

- **Components**: `<script setup lang="ts">` — no Options API, no `defineComponent()` wrapper
- **Stores**: Pinia with setup syntax (`defineStore('name', () => { ... })`)
- **Reactivity**: `ref()`, `computed()`, `watch()` — no `reactive()` for top-level store state
- **Naming**: PascalCase components, camelCase composables/utils, kebab-case file names for non-components
- **Composables**: Prefixed `use`, return plain objects (not arrays), colocated with types
- **Props**: Use `defineProps<T>()` with interface, not runtime validation
- **Emits**: Use `defineEmits<T>()` with typed signatures
- **CSS**: Scoped `<style scoped>`, reference `variables.css` tokens via custom properties, no Tailwind
- **Imports**: Use `@/` alias for `src/`, group: vue → libraries → local types → local modules
- **Exports**: Named exports only, no default exports (except Vue components and route definitions)

## File Organization

- Types in `src/types/`, one file per domain (`models.ts`, `adapters.ts`, `ui.ts`)
- Stores in `src/stores/`, one per domain
- Composables in `src/composables/`, one per concern
- Components in `src/components/<module>/`, module = dashboard | workspace | library | similarity | common | modals
- Adapters in `src/adapters/`, one per import/export format
- Tests mirror `src/` under `tests/unit/` and `tests/components/`

---

## Key Patterns

- **Data flow**: Dexie (source of truth) → `liveQuery` → Pinia stores (reactive reads) → components. Writes go through store actions → Dexie.
- **`useLiveQuery`** calls `triggerRef()` after every write, so propagation works even when the Observable fires outside Vue's scheduler (IDB event handlers).
- **ScrollableList**: Dumb virtual-scroll container with slots. Filter/sort/selection handled by composables at the view level, not inside the list. This principle generalizes — presentational components should not reconstruct state their parent already owns.
- **Adapters**: Typed classes registered in `adapters/registry.ts`. Store actions call adapters, adapters write to Dexie, stores react via liveQuery.
- **Modals**: One `BaseModal` in `App.vue` driven by the ui store. Specialized modals are components passed to `useModal().open()`, which resolves with the modal's confirm payload.

## Workspace invariants

The workspace is the most intricate part of the codebase. These are easy to break and expensive to debug.

- **Buffer pattern.** `loadSession` clones playlists from the library into memory. All edits are in-memory. `save()` explicitly flushes to IDB. Dirty playlists are tracked in `modifiedIds`.
- **Dual representation.** `WorkspacePlaylist` carries both `trackIDs: string[]` (ordered) and `trackIdSet: Set<string>` (lookup). **Every mutation must update both, plus `modifiedIds`.** See `addTrackToAll` in `src/stores/workspace.ts` for the canonical shape.
- **`stableOrder` governs the visible track list**, not playlist membership. It is first-seen arrival order, established on load and changed only when the track set changes. Membership toggles must never reorder or hide rows.
- **`WorkspaceSession` persists only `playlistIds`.** The track set is derived on load from playlist contents, so a track present in the workspace but in no playlist exists only in the in-memory buffer and will not survive a reload.
- **Checkbox matrix is not row selection.** Per-playlist membership checkboxes are data mutation (store-driven). Row multi-select is separate, via `useListSelection`, for batch actions.
- **Workspace-created playlists** use string `pending-N` IDs until saved; library playlists use numeric IDB keys. `PlaylistId = number | string` for this reason.

---

## Documentation

- Method-level comments for all non-trivial functions, giving a simple overview of method purpose, inputs, outputs, and side effects. Stores use `/** */` JSDoc blocks for this.
- In-line comments for any complex logic or non-obvious decisions.
- Section dividers within large files follow the existing style in `WorkspaceView.vue`. Avoid emoji; box-drawing characters used for dividers and arrows in prose are established practice.
- When refactoring commented code, update comments instead of deleting them.

## Project documentation model

Three layers, no overlap:

| Layer | File | Owns |
|---|---|---|
| Style | `CLAUDE.md` (this file) | Coding conventions, patterns, invariants |
| Structure | `../docs/ARCHITECTURE.md` | Current codebase state |
| Work | `../docs/tasks/<name>.md` | What to build next |
| Deferred | `../docs/BACKLOG.md` | Known limitations and consciously set-aside work |

Task specs are temporary — archived or deleted after review. `ROADMAP.md` tracks phases, deferred features, and the design decisions log.

---

## Testing

- Unit tests for all store actions, composables, adapters, and utils
- Component tests for non-trivial rendering logic
- Extend the spec that already exists for a file rather than creating a parallel one

## Commits

Conventional commits with a parenthesized scope:

    feat(workspace): show track count in playlist column header
    refactor(composables): useListSort accepts reactive options
    fix(spotify): re-read token inside retry loop
    docs(roadmap): record W1-F deferral

Scope names the area touched — `workspace`, `dashboard`, `spotify`, `stores`, `composables`, `modals`, `adapters`, `ci`. Omit it only when a change genuinely spans the project.

- **Keep the subject line brief and to the point.** One line where one line does the job.
- **When one line will not cover it**, follow the subject with readable bullets naming the specific changes — not a restatement of the subject.
- **Avoid mega-commits.** Do not cram large amounts of functionality change into a single SHA; split by concern.
- **A commit that is incomplete on its own is fine.** PR management means an intermediate commit that breaks something ships together with the successor that resolves it. Do not merge commits together just to keep every SHA independently green.

## Do Not

- Use Options API or `defineComponent()`
- Use `any` type — prefer `unknown` with type guards
- Add dependencies without explicit approval in the feature spec
- **Make architectural decisions during implementation — flag ambiguities instead**
- Skip tests for store actions or adapter logic
