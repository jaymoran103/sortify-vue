# Conventions

How to write code in this repo. Read before your first change.
The shape of the app is in `architecture.md`; this file does not repeat it.

## Components

- `<script setup lang="ts">`. No Options API, no `defineComponent()` wrapper.
- `defineProps<T>()` and `defineEmits<T>()` with an interface. No runtime
  validation.
- `<style scoped>`, referencing custom properties from `styles/variables.css`.
  No Tailwind, no CSS modules.
- PascalCase filenames. One component per file.

## Stores

- Pinia setup syntax: `defineStore('name', () => { ... })`.
- `ref()`, `computed()` and `watch()`. Never `reactive()` for top-level state.
- One store per domain, in `src/stores/`.
- Writes go through store actions to Dexie. Reads come back through
  `liveQuery`. Never write to Dexie from a component.

## Reactivity

Three rules, each from a bug that cost a day. The long version is in the
workspace records under `learnings/vue-reactivity.md`.

- **Follow any ref write from outside Vue's scheduler with `triggerRef(ref)`.**
  IndexedDB callbacks, WebSocket handlers, native events not proxied by Vue.
  `nextTick` does not work; it schedules a flush rather than marking
  dependencies dirty.
- **Wrap a component object in `markRaw` before it enters a ref.** Do it at the
  write site, not at each call site.
- **A helper called from a template must not mutate reactive state.** Keep
  render helpers pure. Record side effects in the fetch or the event handler.

Two more worth holding:

- Prefer `shallowRef` for large collections that are replaced rather than
  edited in place.
- Clean up subscriptions in `onBeforeUnmount`.

## Composables

- Prefixed `use`, one concern per file, in `src/composables/`.
- Return a plain object, never an array.
- Options that callers may change at runtime accept `MaybeRefOrGetter`.

## Files

| Kind | Where | Naming |
| --- | --- | --- |
| Types | `src/types/` | one file per domain |
| Stores | `src/stores/` | one per domain |
| Composables | `src/composables/` | one per concern |
| Components | `src/components/<module>/` | PascalCase |
| Adapters | `src/adapters/` | one per import or export format |
| Tests | `tests/unit/`, `tests/components/` | mirror `src/` |

## Imports and exports

- `@/` alias for `src/`.
- Named exports only. The exceptions are Vue components and route definitions.

## Types

- No `any`. Use `unknown` plus a type guard. The one standing exception is a
  generic parameter in a heterogeneous registry, as in `src/adapters/registry.ts`,
  where the map holds adapters of differing shapes.
- Shared domain types live in `src/types/`, not beside the code that uses them.
  A module owning an external surface may keep its own `types.ts`, as
  `src/spotify/` does for the Spotify API shapes.

## Comments

- A method-level comment on anything non-trivial: purpose, inputs, outputs,
  side effects. Stores use `/** */` blocks.
- Inline comments for complex logic or a non-obvious decision. Explain why, not
  what.
- No emoji.
- Refactoring commented code means updating the comment, not deleting it.

## Tests

- Unit tests for every store action, composable, adapter and util.
- Component tests where rendering logic is non-trivial.
- Extend the spec a file already has rather than starting a parallel one.
- Store tests get a fresh Pinia per test: `setActivePinia(createPinia())`.
- Name the behaviour: `it('returns an empty array when no tracks match')`.

## Commits

Conventional commits with a parenthesized scope:

```
feat(workspace): show track count in playlist column header
fix(spotify): re-read token inside retry loop
refactor(composables): useListSort accepts reactive options
```

Scopes: `workspace`, `dashboard`, `library`, `similarity`, `spotify`, `stores`,
`composables`, `modals`, `adapters`, `ci`, `docs`. Omit only when a change
genuinely spans the project.

- One line where one line does the job.
- When it does not, follow the subject with bullets naming the specific
  changes, not a restatement of the subject.
- Split by concern. Avoid mega-commits.
- A commit that is incomplete alone is fine. It ships with its successor.
