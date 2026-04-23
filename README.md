# Sortify


A Vue 3 single-page application for managing Spotify playlist libraries — import, organize, edit, and export playlists locally with full Spotify PKCE integration. [Live on GitHub Pages](https://jaymoran103.github.io/sortify-vue/#/). 

For the original implementation with Vanilla JS and IndexedDB, see the [Vanilla Repo](https://github.com/jaymoran103/sortify-feb), hosted [here](https://jaymoran103.github.io/sortify-feb/)

## Features

- **Dashboard** — import/export playlists via CSV, JSON, or Spotify OAuth
- **Workspace** — load a session, edit track membership across playlists in a virtualized table, and save changes back to the local library
- **Local persistence** — all data lives in IndexedDB via Dexie; no backend, no login required beyond Spotify
- **Save Buffer** – workspace changes arent applied to your local version until you save them. 
- **Spotify integration** — PKCE OAuth flow with a typed API client and token lifecycle management
- **IO Adapters** — swappable import/export adapters ensure a consistent process with progress updates for transparency, regardless of operation scale or type.
---

## Architecture

| Layer | Choice |
|---|---|
| Framework | Vue 3 · TypeScript strict · Vite |
| State | Pinia (setup stores) |
| Persistence | Dexie.js (IndexedDB, liveQuery) |
| Routing | Vue Router hash mode |
| Virtual scroll | @tanstack/vue-virtual |
| Testing | Vitest + Playwright |

The app is organized around three concerns that don't bleed into each other: 
- `Stores` own data and write to Dexie,
- `Composables` own reusable UI logic (filtering, sorting, selection, modals), 
- `Components` compose both without owning either. The workspace uses a buffer pattern — playlists are cloned into memory on session load, edits stay local, and a save action flushes to IDB.

<!-- See ARCHITECTURE.md for the full reference. -->
---
## Project Outline
Upcoming feature additions include: 

From Vanilla Implementation:
- Refined reporting for I/O warnings
- Similarity Engine
- Advanced workspace features

New:
- Dedicated route for similarity visualization and configruation
- Dedicated library page
- Shell-based layout promoting the library as the primary view.
- Integration of playback SDK for song access while editing.
