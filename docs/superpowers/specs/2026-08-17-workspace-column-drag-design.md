# Workspace column drag — design

Repositioning a playlist column by dragging its header. The last unbuilt item from PR #7's
"Resolve Later" list: *"Could playlist headers now be repositioned by dragging L/R?"*

Move Left / Move Right already exist in the column menu and stay — they remain the keyboard-
and screen-reader-reachable path, and dragging is an affordance on top of them, not a
replacement.

## Depends on

| Branch | Why it must land first |
|---|---|
| `feat/workspace-column-slack` | Fixes every playlist column at 140px. Hop detection becomes arithmetic on the pointer delta; against the old `minmax(100px, 200px)` it would mean measuring the DOM on every `pointermove`. |
| `fix/column-order-session-state` | `movePlaylist` no longer dirties playlists, and `persistPlaylistOrder()` exists. A drag hops many times and writes once — impossible while each hop marked two playlists modified. |

This branch is stacked on `fix/column-order-session-state`.

## Decisions already taken

| Decision | Choice | Reason |
|---|---|---|
| Drag model | Live adjacent swap — call `movePlaylist(id, ±1)` as the cursor crosses each neighbour's midpoint | Reuses a store action with menu tests already behind it. Columns move under the cursor, which is the clearest feedback of the options considered. |
| Drag surface | The whole header, with a 4px threshold | The column carries a name, a count and a ⋮ in 140px; a grip handle is the one thing there is no room for. |
| Persistence | One `persistPlaylistOrder()` on release | Column order is session state, written when the interaction settles. |
| Edge auto-scroll | Out of scope for v1 | Columns only overflow past roughly eight playlists once the widths are fixed. |
| Cancel | Escape rewinds to the starting index | Live swapping has already moved things; cancelling has to undo them. |

## Architecture

Three parts, each testable alone.

### `useColumnDrag` — new composable

Owns all pointer state and the hop arithmetic. Knows nothing about playlists or the store;
it is handed a pitch and some callbacks.

```ts
useColumnDrag(options: {
  columnWidth: number                       // px pitch of one playlist column
  indexOf: (id: PlaylistId) => number       // current index, read at drag start
  columnCount: () => number                 // for clamping
  onHop: (id: PlaylistId, direction: -1 | 1) => void
  onSettle: () => void
}): {
  start: (playlistId: PlaylistId, event: PointerEvent) => void
  draggingId: Readonly<Ref<PlaylistId | null>>   // non-null only past the threshold
}
```

### `PlaylistColumnHeader` — unchanged in kind

Stays presentational per design decision D1. Gains one emit:

```ts
dragStart: [playlistId: PlaylistId, event: PointerEvent]
```

Fired on `pointerdown`. The ⋮ button keeps `@click.stop`, so it never starts a drag.
`cursor: grab` on the header is the only new affordance; `.playlist-col-header--dragging`
gets `cursor: grabbing` and a subtle background while it is the one moving.

### `WorkspaceView` — wiring only

Holds the composable, supplies the callbacks, and binds `@drag-start`. `onHop` calls
`workspaceStore.movePlaylist`; `onSettle` calls `workspaceStore.persistPlaylistOrder()` —
the same pair `handleMoveColumn` already uses for a menu move.

## Hop arithmetic

Everything derives from the pointer's horizontal offset from where the drag began. No DOM
measurement, which is what keeps it testable under jsdom.

```
offset       = event.clientX − startX
desiredHops  = clamp(Math.round(offset / columnWidth), −startIndex, columnCount − 1 − startIndex)
while (appliedHops < desiredHops) { onHop(id, +1); appliedHops++ }
while (appliedHops > desiredHops) { onHop(id, −1); appliedHops-- }
```

`Math.round` is what puts the switch at the midpoint. Clamping to the array bounds matters
for more than safety: without it `appliedHops` drifts past the end while the pointer keeps
travelling, and dragging back does nothing until the drift is paid off.

## Lifecycle

| Event | Behaviour |
|---|---|
| `pointerdown` | Record `startX`, `startIndex`, `appliedHops = 0`. Capture the pointer where supported. Nothing visible yet. |
| `pointermove`, `abs(offset) < 4` | Ignored. Below the threshold this is still a click. |
| `pointermove`, past threshold | Set `draggingId`, then apply hops as above. |
| `pointerup`, never dragged | Nothing. The click proceeds and the menu opens as before. |
| `pointerup`, dragged | `onSettle()`, clear state, and swallow the trailing `click` (one-shot capture-phase listener) so releasing a drag does not open the menu. |
| `Escape` while dragging | Rewind `appliedHops` to 0 through `onHop`, clear state, no `onSettle`. |
| `pointercancel` | Same as Escape. |

## Testing

**`tests/unit/composables/useColumnDrag.spec.ts`** — synthetic pointer events with explicit
`clientX` values, callbacks as spies:

- no hop below 4px; first hop at the midpoint, not before
- hops right and left, and back again, with `onHop` called once per hop
- clamped at both array boundaries, and still responsive when dragged back
- `onSettle` fires once on release, and not at all on Escape or `pointercancel`
- Escape rewinds exactly the hops that were applied

**`tests/components/workspace/WorkspaceView.spec.ts`**:

- `pointerdown` on a header starts a drag; a drag across one column calls `movePlaylist`
  then `persistPlaylistOrder` once
- a plain click still opens the column menu
- a click following a completed drag does not

**`tests/components/workspace/PlaylistColumnHeader.spec.ts`**: `pointerdown` emits
`dragStart` with the playlist id; the ⋮ button does not.

## Notes and risks

- **`setPointerCapture` is absent in jsdom.** Called through an optional guard so tests do
  not need to stub it.
- **`PLAYLIST_COLUMN_WIDTH` becomes a number.** Branch 3 introduced it as `'140px'`; this
  branch changes it to `140` and the template interpolates the unit, so the pitch the grid
  uses and the pitch the drag assumes are one value.
- **Live swapping means a cancelled drag is a rewind, not a no-op.** If the rewind and the
  store ever disagree the column ends up somewhere the user did not put it, which is why
  `appliedHops` is the single source for how far back to walk.
- **Not covered:** edge auto-scroll, touch-specific gesture conflicts with horizontal
  scrolling, and any drop-position preview beyond the columns themselves moving.
