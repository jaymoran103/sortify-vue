# Architecture

How Sortify is built, and why. Code style is in `conventions.md`.

This file holds contracts and reasoning. It does not mirror the file tree or
copy type definitions — `src/types/` is the source for those, and a copy here
would be wrong the moment a field changes.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Vue 3, Composition API, `<script setup>` |
| Language | TypeScript, strict |
| Build | Vite |
| Routing | Vue Router, hash mode |
| State | Pinia, setup syntax |
| Persistence | Dexie over IndexedDB |
| Virtual scroll | `@tanstack/vue-virtual` |
| Testing | Vitest, Vue Test Utils, Playwright |
| Hosting | GitHub Pages |

Hash routing is not a preference. GitHub Pages serves no rewrite rule, so a
history-mode deep link 404s.

## Where things live

```
src/
├── adapters/     one file per import or export format, plus registry.ts
├── components/   by module: about, common, dashboard, library,
│                 modals, similarity, workspace
├── composables/  one concern each, prefixed use
├── db/           the Dexie subclass and its schema
├── router/       hash routes, lazily loaded
├── spotify/      auth, api, pkce, pendingIntent, config, types
├── stores/       one per domain
├── styles/       variables, reset, utilities
├── types/        models, adapters, ui
└── utils/        download, spotifyLinks, workspaceIssues
```

`tests/` mirrors `src/`.

## Data flow

Dexie is the single source of truth. Nothing else holds persisted state.

```
component ──action──▶ store ──write──▶ Dexie
                        ▲                │
                        └──liveQuery─────┘
```

Reads are reactive. A store subscribes through `useLiveQuery`, so a write
anywhere updates every reader with no cache to invalidate.

**`useLiveQuery` calls `triggerRef` after each write.** Dexie's Observable
fires from an IndexedDB event handler, outside Vue's scheduler, so assigning to
the ref does not mark downstream computeds dirty. Without the explicit trigger,
a view mounted later reads a stale value — the bug was stale playlist counts on
the dashboard after saving in the workspace.

## Schema

Dexie version 5. Three tables.

```
tracks             trackID, source
playlists          ++id, name
workspaceSessions  ++id, lastOpened
```

A track variant with a different identifier is a separate row. Reconciling them
is the similarity module's job, not the schema's. Duplicate tracks inside one
playlist are neither managed nor reduced.

Version increments are monotonic and migrations are explicit. Opening an
existing database at a lower version throws `VersionError`, which is a version
management bug and never a reason to reset user data.

## The workspace

The most intricate part of the codebase, and the easiest to break.

**Buffer pattern.** `loadSession` clones playlists from the library into
memory. Every edit is in memory. `save()` flushes to IndexedDB in one
transaction, so `liveQuery` fires once rather than once per playlist, which is
what stops counts flickering in dependent views.

**Dual representation.** A `WorkspacePlaylist` carries both `trackIDs`
(ordered) and `trackIdSet` (O(1) lookup). Every mutation updates both, plus
`modifiedIds`. Miss one and the two disagree silently.

**`stableOrder` governs what is displayed**, not playlist membership. It is
first-seen arrival order, set on load and extended when a playlist is added.
Toggling membership never reorders or hides a row. A track leaves the view only
through `removeTrackFromWorkspace`.

**A checkbox is not a selection.** Per-playlist membership checkboxes mutate
data through the store. Row multi-select is separate, via `useListSelection`,
and exists for batch actions.

**Workspace-created playlists use string `pending-N` ids** until saved, which
is why `PlaylistId` is `number | string`. After `save()` every id in memory is
numeric.

**Unassigned tracks do not survive a reload.** `WorkspaceSession` persists only
`playlistIds`, so the track set is rebuilt from playlist contents on load. A
track added but never assigned lives only in the buffer. The leave guard warns
about it; the real fix needs a schema bump, and is in `backlog.md`.

## Components

**One modal at a time.** A single `BaseModal` sits in `App.vue`, driven by the
ui store. Specialised modals are components passed to `useModal().open()`,
which resolves with the confirm payload. The context menu works the same way.

**`ScrollableList` is deliberately dumb.** It is a virtual-scroll container
with slots and no filtering, sorting or selection inside it. Composables
compose that behaviour at the view level.

The general form of both: **a presentational component does not reconstruct
state its parent already owns.** Column-menu construction lives in
`WorkspaceView`, not `PlaylistColumnHeader`, because the menu depends on the
filtered track count, the active sort and Spotify URIs — none of which the
header has, and all of which the parent has already resolved.

## Adapters

One per format, registered in `adapters/registry.ts` behind a typed interface.
A store action calls an adapter, the adapter writes to Dexie, stores react
through `liveQuery`. Adding a source means adding an adapter and nothing else.

## Spotify

Five files: `config`, `pkce`, `auth`, `api`, `types`. Each exports a singleton.

**Token storage is split on purpose.** The PKCE code verifier goes to
`localStorage` because it must survive a full-page redirect. The access token,
its expiry and the CSRF nonce go to `sessionStorage`, which scopes them to the
tab and gives the session an explicit lifetime.

**Pending intent.** OAuth navigates away and destroys all Vue state, so the
action that triggered login is saved to `localStorage` before the redirect and
consumed on return, which restores both the route and the interrupted action.

**Rate limiting.** `_request` re-reads the access token inside its retry loop,
so a token that expires during a `Retry-After` sleep is never reused. On 429 it
currently aborts rather than retrying, and the partial result is kept.

## Activity

One store tracks the active I/O operation and its issues, with two display
layers: a progress indicator in the dashboard's IO card, and a grouped error
summary in the modal's done step. Errors carry a free-string category, so a
Spotify 429 surfaces as a rate-limit message rather than a generic failure.

## CSS

Design tokens in `styles/variables.css`, two levels: a raw palette, then
semantic aliases. Scoped styles everywhere, so no global class collisions.
Utilities in `styles/utilities.css`. Desktop-first, mobile passable.
