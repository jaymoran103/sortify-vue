# Similarity Module — Decision Record

Checkpoint after Steps A and B of `0809-similarity-ideation-revised.md`. Supersedes the
in-conversation versions of these decisions, including two amendments and one retraction.

---

## Position (Step A)

**Sortify starts from what you're looking at, not from what you might want to do — you select
something, and the app tells you what it noticed about it.**

**Pattern 1 — no operation owns the selection.** *(amended; original wording was "every operation
is reachable only from a selection", which implied the app must prompt you)* Selection is a
persistent, app-wide cursor. Operations read it and never populate it. An **empty cursor means the
whole library**, so any operation is runnable cold with zero input.

**Pattern 2 — one verb set, everywhere.** Library rows, result rows, workspace contents and saved
sessions expose the same closing actions. A feature whose output can't reach the verb strip is cut.

**Pattern 3 — results are nouns, not dead-ends.** Every result is a selectable set that can feed the
next operation. Chaining is a consequence of uniformity, not a feature. Every ranked row shows its
own denominator ("39 of 46").

Two doors into every operation: an ambient finding that fills the cursor, or direct invocation via
the operations palette. Neither is privileged.

---

## Vocabulary

One vocabulary for UI and code. **Similarity** stays the module name; no category takes it.

| Term | Covers | Rejected alternatives |
|---|---|---|
| **Doubles** | redundant *entries* — one recording, several track IDs | "Versions" (sounds intentional), "Duplicates" (promises exactness; collides with the import-time name+URI flag) |
| **Overlap** | shared membership between playlists, or co-appearance between tracks | — (already the settled ROADMAP word) |
| ~~Traits~~ | *cut as a category — see below* | — |

`duplicates`, `dupes`, `copies` are **search aliases** in the palette, so the common word finds the
tools without the label over-promising.

---

## The collapse test

> A thing is a separate tool only if it asks a **different question** or returns a **different
> shape**. Same computation with a different scope, threshold, axis or toggle is a **control**.

Applied to the Step B lineup, this eliminated twelve of fourteen entries.

---

## What the module is

### Two operations

| Operation | Question | Result shape |
|---|---|---|
| **Doubles** | Is this the same thing? | groups of variants, one marked keep |
| **Overlap** | What travels together? | pairs, split shared vs. unique |

One question, one answer shape — enforced. Two shapes inside one category means it is two
categories, or the tool is in the wrong one.

### Controls (not tools)

- **Scope** — implicit, from the cursor. Selecting one playlist makes Overlap reference-based;
  selecting nothing scans the library.
- **Axis** — Overlap transposed. Playlists sharing tracks ↔ tracks sharing playlists (duos).
  Follows the cursor's subject type; playlists is the empty-cursor default.
- **Equivalence toggle** — applies Doubles' confirmed groups to Overlap's scoring.
- **Threshold**, **sort**, **review filter** (unconfirmed / confirmed / rejected).
- **Containment** is a *measure shown on every Overlap row*, not a control and not a tool. Full
  containment means "delete the smaller"; 0.7 Jaccard means "merge". One number cannot say which.

**Controls live on the result, never before it.** The scan runs on defaults immediately; adjusting
re-renders. A configuration panel filled in before seeing anything is a wizard with sliders. Only
controls that change the answer for most people get chrome; the rest are defaults or presets.

### Presets

A **preset is a named set of control values** on one of the two operations. Presets are what the
palette lists — questions people have, over two computations.

Examples: *Playlists that are nearly identical* · *Playlists fully contained in another* ·
*Tracks that always travel together* · *Doubled tracks I haven't reviewed*

**Guard:** a preset must be expressible purely as control values. If it needs new code it is not a
preset — it is a third operation, which is an architectural event.

### Verbs

Open in workspace · Save as session · Create playlist from ▾ · Analyze ▾

Set operations (union / intersection / complement) are **actions producing playlists** under
"Create playlist from", not computed columns and not tools.

### The "Noticed" rail

**The rail is the preset list, run ahead of time, showing only presets that returned something.**
The palette is presets *available*; the rail is presets that *currently have results*. Same list,
two states, one vocabulary.

- **Three scans back every preset**: Overlap playlist-axis, Overlap track-axis, Doubles fuzzy pass.
- **Ranked by actionability, not count** — two fully-contained playlists beat four hundred weak
  overlaps. Capped small; the rest reachable via the palette.
- **Never invents a finding that isn't a preset result.** No bespoke heuristics.
- **Freshness-gated** — a stale rail asserts things about a library that has changed. It shows its
  own staleness or suppresses itself.

---

## Moved to the library view (Phase 6)

Not similarity operations. They consume the same inverted index.

| Feature | Form |
|---|---|
| Artist dominance | sort column |
| Name patterns (`copy` · `#N` · `all`) | filter |
| Tracks ranked by playlist count / most variants | sort column |
| All playlists containing a track / artist / album | navigation |

---

## Cut

| Cut | Reason |
|---|---|
| **Traits as a category** | Two of four measures need absent data, one is undecidable-by-duration, and the survivor is a single sortable value. A category with one member is a column. |
| BPM range · duration profile | BPM absent on the primary import path; duration correlates with nothing actionable. |
| "Visualizers that display interesting results" | Names no output, so it cannot reach the verb strip; breaks one-question-one-shape by construction. |
| Queue / play results directly | Blocked on the deferred Web Playback SDK. |
| Library-wide search for a track / artist / album | Phase 6 library search. Building it here forks a feature. |
| Doubled playlists as a distinct tool | It is a containment reading of Overlap's results, not a separate question. |
| "Apply mappings library-wide" as a step | See retraction below. |

**Deferred, not cut:** genre concentration — works today for CSV importers, cheap if artist-level
genre lookup ever lands, but cannot anchor a category on data that is usually null.

### Data finding behind the Traits cut

`genre`, `bpm` and `energy` are optional on `Track` (`src/types/models.ts`) and are written **only by
`src/adapters/csvImport.ts`**. `src/adapters/spotifyImport.ts:38–44` maps trackID, title, artist,
album, spotifyURI and duration — nothing else. On the primary import path those fields are null.

---

## Amendments and retractions

1. **Amended** — Step A Pattern 1 rewritten from "reachable only from a selection" to "no operation
   owns the selection", so direct invocation is first-class and discovery is never mandatory.
2. **Amended** — doubled playlists moved out of Doubles, then dissolved entirely into Overlap's
   containment reading. Doubles is now track-subject only.
3. **Retracted** — "undo for apply-mappings" is no longer a requirement. There is no destructive
   apply: equivalence resolves at **read time** through `EquivalenceGroup` rows and the in-memory
   `Map<trackId, groupId>` via `useEquivalenceMap`. Confirming a group *is* the application;
   unconfirming reverses it. Rewriting a playlist to its preferred variants is a workspace/export
   verb on a selection, not a library-wide pass.

---

## Requirements created by these decisions

- **Containment as a first-class measure** alongside Jaccard on every Overlap row.
- **Index freshness surfaced in the cursor bar.** Everything reads the inverted index, built in a
  worker; Step A removed the wizard that would have hosted a progress step, so staleness has
  nowhere else to live. Escalated by the rail.
- **Every result row shows its own denominator**, making the one-sentence explainability rule
  enforceable.

---

## Plan shape

`A → B → C → D1 → D2` stands. The divergence was in the *inventory* assumption, not the method —
Step B was designed to cut, and C's containers were always specified to depend on what survived it.

**One insertion, in D1:** a control-surface question — where controls and presets render, how
presets are declared and stored, and how one result view serves both operations.

Step status: **A** answered and amended · **B** answered and revised · **C** next ·
**D1** +1 question · **D2** unchanged.

---

## Open — carried into Step C

1. **Rail panel.** Does the rail keep its own surface, or fold into the palette as result counts?
   Folding is cheaper but kills Door A, and Door A is Step A's answer to "where do I start".
   *Default: keep it, shrunk to the top few findings.*
2. **Operations Library (Step C idea 2).** Its premise changed — cataloguing **presets**, not
   operations. Palette + presets + rail may have answered it before C asks.
3. **Guided Processes (Step C idea 3).** Doubles is inherently sequential — find, review, confirm —
   which is the strongest natural case for a guided flow in the module.
4. **Tag System (Step C idea 1).** Untouched by the collapse. Still live.
