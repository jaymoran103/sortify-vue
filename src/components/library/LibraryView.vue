<script setup lang="ts">
/**
 * Library View (PROTOTYPE)
 *
 * A browsing surface where folder structure reads at a glance and every item is one click
 * away. The root is a short stack of titled rows, one per top-level folder and then Uncategorized.
 * Rows scroll sideways or wrap as a grid, by one page-wide toggle, and each collapses to its header.
 * Clicking a folder drills into it; the drilled folder is a place, held in the route query.
 *
 * Playlist cards select rather than open. Several selected playlists open together as one
 * Workspace session, which is the standard way to start one (PRD D-003).
 *
 * Membership is canon-plus-borrow: one home per playlist, shown borrowed elsewhere. The rules
 * live in utils/folderOverlap.ts; this view only renders what they return.
 *
 * Everything the user can do here runs through a modal that already existed: PromptModal for
 * names, ConfirmModal for destructive answers, PlaylistSelectModal for membership.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlaylistStore } from '@/stores/playlists'
import { useFolderStore } from '@/stores/folders'
import { useSessionStore } from '@/stores/sessions'
import { useModal } from '@/composables/useModal'
import { useContextMenu } from '@/composables/useContextMenu'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useListFilter } from '@/composables/useListFilter'
import { useListSort } from '@/composables/useListSort'
import { useDebounce } from '@/composables/useDebounce'
import {
  childFolders,
  collectFolderOverlaps,
  folderMembers,
  folderPath,
  homeOf,
  uncategorizedPlaylistIds,
} from '@/utils/folderOverlap'
import { openSpotifyURI } from '@/utils/spotifyLinks'
import AppTopBar from '@/components/common/AppTopBar.vue'
import ControlBar from '@/components/common/ControlBar.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import SelectDropdown from '@/components/common/SelectDropdown.vue'
import ConfirmModal from '@/components/modals/ConfirmModal.vue'
import PromptModal from '@/components/modals/PromptModal.vue'
import PlaylistSelectModal from '@/components/dashboard/PlaylistSelectModal.vue'
import FolderRow from './FolderRow.vue'
import LibraryTile from './LibraryTile.vue'
import type { Folder, Playlist } from '@/types/models'
import type { FolderMember, FolderOverlap, MenuEntry, SortOption } from '@/types/ui'

const route = useRoute()
const router = useRouter()
const playlistStore = usePlaylistStore()
const folderStore = useFolderStore()
const sessionStore = useSessionStore()
const modal = useModal()
const ctx = useContextMenu()

const snapshot = computed(() => folderStore.snapshot)

const playlistsById = computed(
  () => new Map((playlistStore.playlists ?? []).filter((p) => p.id !== undefined).map((p) => [p.id!, p])),
)

// ── Search and sort ──────────────────────────────────────────────────────────
// The same chain the workspace runs: source -> useListFilter -> useListSort. The library is
// cut into rows afterwards, so both apply inside every row at once rather than per row.
const allPlaylists = computed((): Playlist[] => playlistStore.playlists ?? [])

const sortOptions: SortOption<Playlist>[] = [
  { key: 'name', label: 'Name', compareFn: (a, b) => a.name.localeCompare(b.name) },
  { key: 'track-count', label: 'Track Count', compareFn: (a, b) => b.trackIDs.length - a.trackIDs.length },
  { key: 'last-modified', label: 'Last Modified', compareFn: (a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0) },
]

const { query, filtered } = useListFilter<Playlist>(allPlaylists, (p, q) =>
  p.name.toLowerCase().includes(q.toLowerCase()),
)
const { currentSort, sorted } = useListSort<Playlist>(filtered, sortOptions)

// playlistId -> position in the filtered, sorted list. Absent means filtered out.
const rank = computed(() => new Map(sorted.value.map((p, i) => [p.id!, i])))

// "Searching" is read from the result, not from `query`: the query ref updates at once while
// useListFilter debounces, and the rows must agree with what the filter actually applied.
const isFiltering = computed(() => filtered.value.length < allPlaylists.value.length)

// Folder cards match on their own name, on the same debounce as the playlist filter.
const debouncedQuery = useDebounce(query, 200)
function folderMatches(folder: Folder): boolean {
  const q = debouncedQuery.value.trim().toLowerCase()
  return !q || folder.name.toLowerCase().includes(q)
}

// ── Navigation ───────────────────────────────────────────────────────────────
// Drill-in is a place, so it lives in the URL: back, reload and a shared link all hold. Row
// collapse and the borrowed filter are a transient glance, so they are local refs; in the URL
// the back button would start undoing chevron clicks.
const openFolder = computed<Folder | null>(() => {
  const id = route.query.folder
  return typeof id === 'string' ? (folderStore.getFolder(id) ?? null) : null
})

const breadcrumb = computed<Folder[]>(() =>
  openFolder.value ? folderPath(snapshot.value, openFolder.value.id) : [],
)

function navigate(folderId: string | null): void {
  void router.push({ name: 'library', query: folderId ? { folder: folderId } : {} })
}

const collapsed = ref<Set<string>>(new Set())
const borrowedOnly = ref<Set<string>>(new Set())

watch(
  () => openFolder.value?.id ?? null,
  () => {
    collapsed.value = new Set()
    borrowedOnly.value = new Set()
  },
)

// How every row lays out its cards: a sideways strip, or a wrapping grid. A per-viewer
// preference, so it is remembered in localStorage and survives a failed read as 'strip'.
type RowLayout = 'strip' | 'grid'
const LAYOUT_KEY = 'sortify.library.layout'
function loadLayout(): RowLayout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'grid' ? 'grid' : 'strip'
  } catch {
    return 'strip'
  }
}
const layout = ref<RowLayout>(loadLayout())
watch(layout, (value) => {
  try {
    localStorage.setItem(LAYOUT_KEY, value)
  } catch {
    // Private mode or quota: the choice still holds for this visit.
  }
})
const layoutOptions: Array<{ key: RowLayout; label: string }> = [
  { key: 'strip', label: 'Rows' },
  { key: 'grid', label: 'Grid' },
]

function toggleIn(set: typeof collapsed, key: string): void {
  const next = new Set(set.value)
  if (!next.delete(key)) next.add(key)
  set.value = next
}

// Named wrappers, because the template unwraps refs and would hand toggleIn a bare Set.
const toggleCollapsed = (key: string): void => toggleIn(collapsed, key)
const toggleBorrowedOnly = (key: string): void => toggleIn(borrowedOnly, key)

// ── Rows ─────────────────────────────────────────────────────────────────────
interface LibraryRow {
  key: string
  title: string
  /** The folder this row shows, or null for Uncategorized. */
  folder: Folder | null
  /** Subfolder cards, shown ahead of playlists. */
  subfolders: Folder[]
  members: FolderMember[]
  overlap: FolderOverlap | null
  /** Header drills into the folder. False for the drilled folder's own row and for Uncategorized. */
  openable: boolean
}

const overlapsByFolder = computed(
  () => new Map(collectFolderOverlaps(snapshot.value).map((o) => [o.folderId, o])),
)

function folderRow(folder: Folder, key = folder.id, openable = true): LibraryRow {
  return {
    key,
    title: folder.name,
    folder,
    subfolders: childFolders(snapshot.value, folder.id),
    members: folderMembers(snapshot.value, folder.id),
    overlap: overlapsByFolder.value.get(folder.id) ?? null,
    openable,
  }
}

const rows = computed<LibraryRow[]>(() => {
  const folder = openFolder.value
  if (folder) {
    // The folder's own playlists first, then one row per subfolder. Its subfolders already
    // have rows, so the own row does not repeat them as cards.
    const own = { ...folderRow(folder, `own-${folder.id}`, false), subfolders: [] }
    return [own, ...childFolders(snapshot.value, folder.id).map((f) => folderRow(f))]
  }

  const top = childFolders(snapshot.value, null).map((f) => folderRow(f))
  const uncategorized: FolderMember[] = uncategorizedPlaylistIds(snapshot.value).map((playlistId) => ({
    playlistId,
    borrowed: false,
    canonicalFolderId: null,
    canonicalFolderName: null,
  }))
  const uncategorizedRow: LibraryRow = {
    key: 'uncategorized',
    title: 'Uncategorized',
    folder: null,
    subfolders: [],
    members: uncategorized,
    overlap: null,
    openable: false,
  }
  return uncategorized.length > 0 ? [...top, uncategorizedRow] : top
})

/**
 * A row's members after search and sort, before the borrowed-only filter. Home members stay
 * ahead of borrowed ones; within each tier the chosen sort decides the order.
 */
function searchedMembers(row: LibraryRow): FolderMember[] {
  const order = rank.value
  const byRank = (a: FolderMember, b: FolderMember): number =>
    order.get(a.playlistId)! - order.get(b.playlistId)!
  const kept = row.members.filter((m) => order.has(m.playlistId))
  return [...kept.filter((m) => !m.borrowed).sort(byRank), ...kept.filter((m) => m.borrowed).sort(byRank)]
}

function visibleMembers(row: LibraryRow): FolderMember[] {
  const members = searchedMembers(row)
  return borrowedOnly.value.has(row.key) ? members.filter((m) => m.borrowed) : members
}

function visibleSubfolders(row: LibraryRow): Folder[] {
  return borrowedOnly.value.has(row.key) ? [] : row.subfolders.filter(folderMatches)
}

function isRowEmpty(row: LibraryRow): boolean {
  return row.subfolders.length === 0 && row.members.length === 0
}

// While searching, a row with nothing matching drops out rather than showing an empty strip.
const shownRows = computed(() =>
  isFiltering.value || debouncedQuery.value.trim()
    ? rows.value.filter((row) => searchedMembers(row).length > 0 || row.subfolders.some(folderMatches))
    : rows.value,
)

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function folderSubtitle(folder: Folder): string {
  const playlists = folderMembers(snapshot.value, folder.id).length
  const children = childFolders(snapshot.value, folder.id).length
  return children > 0 ? `${plural(children, 'folder')} · ${plural(playlists, 'playlist')}` : plural(playlists, 'playlist')
}

function playlistSubtitle(playlist: Playlist): string {
  return plural(playlist.trackIDs.length, 'track')
}

const hasPlaylists = computed(() => playlistsById.value.size > 0)
const hasFolders = computed(() => folderStore.folders.length > 0)

// ── Selection ────────────────────────────────────────────────────────────────
// Kept across drill-in, so a session can be assembled from several folders. Ids of playlists
// deleted elsewhere drop out of the live view rather than being pruned on write.
const selected = ref<Set<number>>(new Set())
const selectedIds = computed(() => [...selected.value].filter((id) => playlistsById.value.has(id)))

function toggleSelected(playlistId: number): void {
  const next = new Set(selected.value)
  if (!next.delete(playlistId)) next.add(playlistId)
  selected.value = next
}

function selectAll(ids: number[]): void {
  selected.value = new Set([...selected.value, ...ids])
}

function clearSelection(): void {
  selected.value = new Set()
}

const selectionSummary = computed(() => {
  const names = selectedIds.value.map((id) => playlistsById.value.get(id)!.name)
  const shown = names.slice(0, 3).join(', ')
  return names.length > 3 ? `${shown} and ${names.length - 3} more` : shown
})

useKeyboardShortcuts({
  escape: () => clearSelection(),
})

// ── Actions ──────────────────────────────────────────────────────────────────
async function openInWorkspace(ids: number[]): Promise<void> {
  if (ids.length === 0) return
  const sessionId = await sessionStore.createSession(ids)
  clearSelection()
  void router.push({ name: 'workspace', query: { session: String(sessionId) } })
}

/** Creates a folder at the current level: top level at the root, a subfolder when drilled in. */
async function createFolder(parentId: string | null = openFolder.value?.id ?? null): Promise<void> {
  const name = await modal.open<string>(PromptModal, {
    title: parentId ? 'New Subfolder' : 'New Folder',
    label: 'Folder name',
    placeholder: 'e.g. Road trip',
    confirmLabel: 'Create',
  })
  if (name) folderStore.createFolder(name, parentId)
}

async function editHomes(folder: Folder): Promise<void> {
  const current = folderMembers(snapshot.value, folder.id).filter((m) => !m.borrowed)
  const ids = await modal.open<number[]>(PlaylistSelectModal, {
    title: `Playlists that live in "${folder.name}"`,
    confirmLabel: 'Save',
    preselectedIds: current.map((m) => m.playlistId),
  })
  if (ids !== null) folderStore.setFolderHomes(folder.id, ids)
}

async function editBorrows(folder: Folder): Promise<void> {
  const current = folderMembers(snapshot.value, folder.id).filter((m) => m.borrowed)
  const ids = await modal.open<number[]>(PlaylistSelectModal, {
    title: `Playlists borrowed into "${folder.name}"`,
    confirmLabel: 'Save',
    preselectedIds: current.map((m) => m.playlistId),
  })
  if (ids !== null) folderStore.setFolderBorrows(folder.id, ids)
}

async function renameFolder(folder: Folder): Promise<void> {
  const name = await modal.open<string>(PromptModal, {
    title: 'Rename Folder',
    label: 'Folder name',
    initialValue: folder.name,
    confirmLabel: 'Rename',
  })
  if (name) folderStore.renameFolder(folder.id, name)
}

async function deleteFolder(folder: Folder): Promise<void> {
  const homes = folderMembers(snapshot.value, folder.id).filter((m) => !m.borrowed).length
  const children = childFolders(snapshot.value, folder.id).length
  const parts = [`${plural(homes, 'playlist')} that live here become uncategorized.`]
  if (children > 0) parts.push(`${plural(children, 'subfolder')} move up a level.`)
  const confirmed = await modal.open<true>(ConfirmModal, {
    title: 'Delete Folder',
    message: `Delete "${folder.name}"? ${parts.join(' ')} Nothing leaves the library.`,
    confirmLabel: 'Delete folder',
    danger: true,
  })
  if (!confirmed) return
  // Leaving the folder first keeps the view from rendering a place that no longer exists.
  if (openFolder.value && breadcrumb.value.some((f) => f.id === folder.id)) navigate(folder.parentId)
  folderStore.deleteFolder(folder.id)
}

/**
 * Takes a playlist out of its home, behind a confirmation. This is the destructive reading of
 * "remove": the playlist becomes uncategorized, and there is no undo. Borrows elsewhere stay.
 */
async function uncategorizePlaylist(playlist: Playlist, folder: Folder): Promise<void> {
  const borrowedIn = folderStore.folders.filter((f) => f.borrowedPlaylistIds.includes(playlist.id!)).length
  const stays = borrowedIn > 0 ? ` It stays borrowed in ${plural(borrowedIn, 'folder')}.` : ''
  const confirmed = await modal.open<true>(ConfirmModal, {
    title: 'Move Out of Folder',
    message: `"${playlist.name}" will leave "${folder.name}" and become uncategorized.${stays}`,
    confirmLabel: 'Move out',
    danger: true,
  })
  if (confirmed) folderStore.setCanonicalHome(playlist.id!, null)
}

// ── Cards ────────────────────────────────────────────────────────────────────
function onPlaylistClick(playlistId: number): void {
  toggleSelected(playlistId)
}

function pathLabel(folder: Folder): string {
  return folderPath(snapshot.value, folder.id).map((f) => f.name).join(' / ')
}

/**
 * Assemble the menu for one playlist card, as seen from the row showing it.
 *
 * `rowFolder` is the folder whose row the card sits in, or null for Uncategorized. The removal
 * entry is labelled from the member itself so the two meanings of "remove" never collide:
 * dropping a borrow is quiet, taking a playlist out of its home confirms.
 */
function playlistMenu(member: FolderMember, rowFolder: Folder | null): MenuEntry[] {
  const playlist = playlistsById.value.get(member.playlistId)
  if (!playlist) return []
  const id = playlist.id!
  const home = homeOf(snapshot.value, id)
  const isPartOfSelection = selected.value.has(id) && selectedIds.value.length > 1

  const items: MenuEntry[] = [
    isPartOfSelection
      ? {
          label: `Open ${selectedIds.value.length} selected in Workspace`,
          action: () => void openInWorkspace(selectedIds.value),
        }
      : { label: 'Open in Workspace', action: () => void openInWorkspace([id]) },
  ]
  // Only for playlists that came from Spotify and carry a URI, as in the Workspace column menu.
  if (playlist.playlistURI) {
    const uri = playlist.playlistURI
    items.push({ label: 'Open in Spotify', action: () => openSpotifyURI(uri) })
  }
  items.push({ label: selected.value.has(id) ? 'Deselect' : 'Select', action: () => toggleSelected(id) })

  const moves = folderStore.folders
    .filter((f) => f.id !== home?.id)
    .map((f): MenuEntry => ({ label: `Move to "${pathLabel(f)}"`, action: () => folderStore.setCanonicalHome(id, f.id) }))
  if (moves.length > 0) items.push({ divider: true }, ...moves)

  const borrows = folderStore.folders
    .filter((f) => f.id !== home?.id && !f.borrowedPlaylistIds.includes(id))
    .map((f): MenuEntry => ({ label: `Borrow into "${pathLabel(f)}"`, action: () => folderStore.addBorrow(f.id, id) }))
  if (borrows.length > 0) items.push({ divider: true }, ...borrows)

  if (rowFolder) {
    items.push({ divider: true })
    if (member.borrowed) {
      items.push({
        label: `Make "${rowFolder.name}" its home`,
        action: () => folderStore.setCanonicalHome(id, rowFolder.id),
      })
      items.push({
        label: `Remove from "${rowFolder.name}" (stays in "${member.canonicalFolderName ?? 'Uncategorized'}")`,
        action: () => folderStore.removeBorrow(rowFolder.id, id),
      })
    } else {
      items.push({ label: `Move out of "${rowFolder.name}"…`, action: () => void uncategorizePlaylist(playlist, rowFolder) })
    }
  }
  return items
}

function folderMenu(folder: Folder): MenuEntry[] {
  const memberIds = folderMembers(snapshot.value, folder.id).map((m) => m.playlistId)
  // "Open" is dropped for the folder already on screen, where it would do nothing.
  const open: MenuEntry[] = openFolder.value?.id === folder.id ? [] : [{ label: 'Open', action: () => navigate(folder.id) }]
  return [
    ...open,
    {
      label: 'Open all in Workspace',
      action: () => void openInWorkspace(memberIds),
      disabled: memberIds.length === 0,
    },
    { label: 'Select all', action: () => selectAll(memberIds), disabled: memberIds.length === 0 },
    { divider: true },
    { label: 'Playlists that live here…', action: () => void editHomes(folder) },
    { label: 'Borrow playlists…', action: () => void editBorrows(folder) },
    { label: 'New subfolder…', action: () => void createFolder(folder.id) },
    { label: 'Rename…', action: () => void renameFolder(folder) },
    { divider: true },
    { label: 'Delete folder…', action: () => void deleteFolder(folder) },
  ]
}

function showPlaylistMenu(member: FolderMember, rowFolder: Folder | null, event: MouseEvent): void {
  ctx.show(event, playlistMenu(member, rowFolder))
}

function showFolderMenu(folder: Folder, event: MouseEvent): void {
  ctx.show(event, folderMenu(folder))
}

const totals = computed(() => `${plural(playlistsById.value.size, 'playlist')} · ${plural(folderStore.folders.length, 'folder')}`)
</script>

<template>
  <div class="library">
    <AppTopBar />

    <!-- Page heading: breadcrumb as title, then this page's own actions. -->
    <div class="library__heading">
      <h1 class="library__title">
        <template v-if="openFolder">
          <button class="library__crumb" @click="navigate(null)">Library</button>
          <template v-for="(crumb, i) in breadcrumb" :key="crumb.id">
            <span class="library__crumb-sep">/</span>
            <button v-if="i < breadcrumb.length - 1" class="library__crumb" @click="navigate(crumb.id)">
              {{ crumb.name }}
            </button>
            <span v-else>{{ crumb.name }}</span>
          </template>
        </template>
        <span v-else>Library</span>
      </h1>
      <span class="library__meta text-muted text-sm">{{ totals }}</span>
      <span class="library__spacer" />
      <button
        v-if="openFolder"
        class="btn btn--ghost"
        @click="showFolderMenu(openFolder, $event)"
      >
        Folder actions ⋯
      </button>
      <button v-if="hasPlaylists" class="btn btn--secondary" @click="createFolder()">
        + {{ openFolder ? 'New Subfolder' : 'New Folder' }}
      </button>
    </div>

    <!-- Search and sort, the same controls the workspace uses. -->
    <ControlBar v-if="hasPlaylists" class="library__controls">
      <SearchBar v-model="query" placeholder="Search playlists…" />
      <SelectDropdown v-model="currentSort" :options="sortOptions" title="Order within each row" />
      <span class="text-muted text-sm">
        {{ filtered.length }}{{ isFiltering ? ` of ${allPlaylists.length}` : '' }} playlists
      </span>

      <template #actions>
        <div class="library__layout" role="group" aria-label="Row layout">
          <button
            v-for="option in layoutOptions"
            :key="option.key"
            class="library__layout-btn"
            :class="{ 'library__layout-btn--active': layout === option.key }"
            :aria-pressed="layout === option.key"
            @click="layout = option.key"
          >
            {{ option.label }}
          </button>
        </div>
      </template>
    </ControlBar>

    <div class="library__body">
      <!-- No playlists at all: nothing to group yet. -->
      <div v-if="!hasPlaylists" class="library__empty">
        <p>Your library is empty.</p>
        <button class="btn btn--primary" @click="router.push({ name: 'dashboard' })">
          Import from the Dashboard
        </button>
      </div>

      <template v-else>
        <!-- Playlists but no folders: the normal first run. Uncategorized still shows below. -->
        <div v-if="!openFolder && !hasFolders" class="library__hint">
          <p class="text-muted">
            Folders group playlists into rows. A playlist lives in one folder and can be borrowed
            into others. Start with + New Folder above.
          </p>
        </div>

        <FolderRow
          v-for="row in shownRows"
          :key="row.key"
          :title="row.openable || !row.folder ? row.title : 'In this folder'"
          :canonical-count="searchedMembers(row).filter((m) => !m.borrowed).length"
          :borrowed-count="searchedMembers(row).filter((m) => m.borrowed).length"
          :folder-count="visibleSubfolders(row).length"
          :collapsed="collapsed.has(row.key)"
          :layout="layout"
          :borrowed-only="borrowedOnly.has(row.key)"
          :openable="row.openable"
          :has-menu="row.openable && !!row.folder"
          :overlap-message="row.overlap?.message ?? ''"
          :empty="isRowEmpty(row)"
          @toggle="toggleCollapsed(row.key)"
          @drill="row.folder && navigate(row.folder.id)"
          @filter-borrowed="toggleBorrowedOnly(row.key)"
          @menu="row.folder && showFolderMenu(row.folder, $event)"
        >
          <LibraryTile
            v-for="sub in visibleSubfolders(row)"
            :key="`f-${sub.id}`"
            kind="folder"
            :title="sub.name"
            :subtitle="folderSubtitle(sub)"
            @open="navigate(sub.id)"
            @menu="showFolderMenu(sub, $event)"
          />
          <LibraryTile
            v-for="member in visibleMembers(row)"
            :key="`p-${member.playlistId}`"
            kind="playlist"
            :title="playlistsById.get(member.playlistId)!.name"
            :subtitle="playlistSubtitle(playlistsById.get(member.playlistId)!)"
            :image-url="playlistsById.get(member.playlistId)!.imageUrl"
            :borrowed-from="member.borrowed ? (member.canonicalFolderName ?? 'Uncategorized') : null"
            :selected="selected.has(member.playlistId)"
            @open="onPlaylistClick(member.playlistId)"
            @menu="showPlaylistMenu(member, row.folder, $event)"
          />

          <template #empty>
            <span class="text-muted text-sm">Nothing here yet.</span>
            <button v-if="row.folder" class="btn btn--secondary btn--sm" @click="editHomes(row.folder)">
              Add playlists
            </button>
          </template>
        </FolderRow>

        <p v-if="shownRows.length === 0 && query" class="library__no-match text-muted">
          No playlists or folders match "{{ query }}".
        </p>
      </template>
    </div>

    <!-- Selection bar: the way several playlists become one Workspace session. -->
    <div v-if="selectedIds.length > 0" class="library__selection">
      <span class="library__selection-count">{{ selectedIds.length }} selected</span>
      <span class="library__selection-names text-muted text-sm">{{ selectionSummary }}</span>
      <span class="library__spacer" />
      <button class="btn btn--ghost btn--sm" @click="clearSelection">Clear</button>
      <button class="btn btn--primary" @click="openInWorkspace(selectedIds)">
        Open in Workspace
      </button>
    </div>
  </div>
</template>

<style scoped>
.library {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.library__body {
  flex: 1;
  overflow-y: auto;
  padding: 0 var(--space-5) var(--space-5);
}

.library__heading {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-5) var(--space-4);
}

/* Matches the workspace control bar: full width, ruled below, fixed above the scroll area. */
.library__controls {
  flex-shrink: 0;
  border-top: 1px solid var(--color-border-subtle);
  border-bottom: 1px solid var(--color-border-subtle);
}

/* The control bar already rules off the top of the list. */
.library__body > :first-child {
  border-top: none;
}

.library__no-match {
  padding: var(--space-6) 0;
}

.library__title {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  margin: 0;
}

.library__crumb {
  padding: 0;
  font: inherit;
  color: var(--color-text-muted);
}

.library__crumb:hover {
  color: var(--color-text);
}

.library__crumb-sep {
  color: var(--color-text-muted);
}

.library__spacer {
  flex: 1;
}

.library__layout {
  display: flex;
  align-self: center;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

/* Same segmented toggle as the dashboard library card's Playlists / Tracks switch. */
.library__layout-btn {
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  transition: background var(--duration-fast) var(--ease-default), color var(--duration-fast) var(--ease-default);
}

.library__layout-btn + .library__layout-btn {
  border-left: 1px solid var(--color-border-subtle);
}

.library__layout-btn--active {
  background: var(--color-accent);
  color: var(--color-text-on-accent);
}

.library__hint,
.library__empty {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) 0;
  border-top: 1px solid var(--color-border);
}

.library__hint p,
.library__empty p {
  margin: 0;
}

.library__selection {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border-subtle);
  flex-shrink: 0;
}

.library__selection-count {
  font-weight: var(--font-weight-semibold);
}

.library__selection-names {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
