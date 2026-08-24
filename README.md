# Sortify

# Sortify

A browser-based playlist manager for music libraries. Import from Spotify or CSV/JSON, rearrange tracks across a multi-playlist grid, then save back to Spotify or as local files.

[Try it here](https://jaymoran103.github.io/sortify-vue/#/) — no signup, no install, nothing leaves your browser.

## Features

- **Dashboard** — import and export playlists from Spotify, or as CSV or JSON files.
- **Workspace** — displays playlists and track membership in a grid; move songs between playlists, add from your library, and create new ones as you go.
- **Save buffer** — edits live in memory until you explicitly save, so nothing changes underneath you.
- **Local persistence** — everything lives in IndexedDB. No backend, no account, no tracking.

## Spotify access

Spotify integration works fully, but the app is still in Spotify's development mode — accounts must be added explictly to connect. Contact [jaymorandev@gmail.com](mailto:jaymorandev@gmail.com) to join the list today!

In the meantime, the CSV and JSON import paths work for anyone. Try [exportify](https://exportify.net) as an alternate way to quickly download your library data for use here.

## Stack

| Layer          | Service                          |
| -------------- | -------------------------------- |
| Framework      | Vue 3 · TypeScript strict · Vite |
| State          | Pinia (setup stores)             |
| Persistence    | Dexie.js (IndexedDB, liveQuery)  |
| Routing        | Vue Router, hash mode            |
| Virtual scroll | @tanstack/vue-virtual            |
| Testing        | Vitest + Playwright              |

Three concerns that don't bleed into each other:

- **stores** own data and write to Dexie
- **composables** own reusable UI logic (filtering, sorting, selection, modals)
- **components** compose both without owning either. The workspace uses a buffer pattern — playlists are cloned into memory on session load, edits stay local, and saving flushes to IndexedDB.

## Upcoming

The scaffolded `/library` and `/similarity` routes are in development and not yet implemented on main. Planned work:

- **Similarity Module (in development)** - detect and visualize overlap and near-duplicates across playlists. Reconciles track duplicates and redundant playlists across your library, quickly and confidently.
- **Library page** dedicated library page, with a shell-based layout making it the primary view.
- **Advanced workspace features** - apply set manipulations and call similarity/consolidation tools from the workspace.
- **Playback SDK integration** - listen to your library while sorting it.

The original vanilla JS implementation lives in a [separate repo](https://github.com/jaymoran103/sortify-feb), hosted [here](https://jaymoran103.github.io/sortify-feb/).

---

MIT © Jay Moran
