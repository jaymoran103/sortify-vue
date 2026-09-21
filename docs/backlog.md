# Backlog

Known limitations, deferred work and accepted trade-offs, captured so they get
picked up deliberately rather than rediscovered.

An entry here is a decision, not an oversight. Each carries a size, where it
came from, why it was accepted, and what the real fix costs.

A bug nobody has decided about is an issue, not an entry. Planned work is the
roadmap's, not this file's.

---

## Defects

### Vanilla bundle format does not import
**Size:** S

Bundles exported by the vanilla predecessor use `tracks` as an object map keyed
by trackID; `jsonImport.ts` expects an array. Vanilla also writes `timeAdded`
as an ISO string where Vue uses a unix timestamp.

A cross-repo defect rather than a polish gap. The fix updates the vanilla
exporter to the canonical format and makes its importer backward compatible
with bundles already in the wild.

---

## Accepted limitations

### Unassigned tracks do not survive a reload
**Size:** M, needs a schema bump

`WorkspaceSession` persists only `playlistIds`, so `loadSession` rebuilds the
track set from playlist contents. A track added to the workspace but never
assigned to a playlist exists only in the in-memory buffer.

Mitigated by a leave-guard warning, not eliminated. The full fix is an
`extraTrackIds` field plus a Dexie migration.

### Clipboard failures are silent
**Size:** S

`copyToClipboard` logs to the console on rejection. A user who has denied
clipboard permission gets no feedback and assumes the copy worked. Accepted
because there is no toast primitive and adding one was out of scope. Natural to
fix alongside any notification work.

### The Spotify web-player fallback infers rather than observes
**Size:** S

`openSpotifyURI` decides whether the desktop app handled a URI by checking
whether its own 1400 ms timer fired on schedule. That works only because a
backgrounded tab has its timers throttled past the threshold. Throttling rules
differ across browsers and may not apply to a tab still visible on a second
monitor, so a spurious web-player tab alongside the desktop app is possible.

Ported as-is, deliberately. The direct fix is a `document.hidden` check inside
the timeout instead of the elapsed-time comparison — roughly five lines and two
tests. Worth doing if the double-open is ever seen in practice.

---

## Tooling

### The e2e suite never runs in CI
**Size:** XS

`pnpm test` is `vitest run`, and `ci.yml` calls it. Playwright is never
invoked, so a green badge implies coverage that did not execute. Either add a
`test:e2e` step with a browser cache, or remove the harness. Either beats the
ambiguity, which actively misleads anyone reading CI status.
