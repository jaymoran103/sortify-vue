<script setup lang="ts">
import { useContextMenu } from '@/composables/useContextMenu'
import type { WorkspacePlaylist } from '@/types/models'
import type { MenuEntry } from '@/types/ui'

const props = defineProps<{
  playlist: WorkspacePlaylist
  canMoveLeft: boolean
  canMoveRight: boolean
}>()

const emit = defineEmits<{
  rename: [playlistId: number | string]
  remove: [playlistId: number | string]
  duplicate: [playlistId: number | string]
  moveLeft: [playlistId: number | string]
  moveRight: [playlistId: number | string]
}>()

const ctx = useContextMenu()

// Show context menu with playlist actions
function showDropdown(event: MouseEvent): void {
  const id = props.playlist.id!

  const items: MenuEntry[] = [
    { label: 'Rename', action: () => emit('rename', id) },
    { label: 'Duplicate', action: () => emit('duplicate', id) },
  ]

  if (props.canMoveLeft) {
    items.push({ label: 'Move Left', action: () => emit('moveLeft', id) })
  }
  if (props.canMoveRight) {
    items.push({ label: 'Move Right', action: () => emit('moveRight', id) })
  }

  items.push({ divider: true })
  items.push({ label: 'Remove from Workspace', action: () => emit('remove', id) })

  ctx.show(event, items)
}
</script>

<template>
  <!-- Right-click anywhere on the header opens the context menu at the cursor position. -->
  <div class="playlist-col-header" @contextmenu.prevent="showDropdown">
    <!-- Playlist Title. FUTURE: Find solution for long playlist names in tight displays -->
    <span class="playlist-col-header__name" :title="playlist.name">
      {{ playlist.name }}
    </span>
    <!-- Ellipsis button: hidden by default, revealed on header hover. -->
    <!-- Also triggered by right-click anywhere on the header. -->
    <button
      class="playlist-col-header__menu-btn"
      aria-label="Playlist actions"
      @click.stop="showDropdown"
    >
      ⋮
    </button>
  </div>
</template>

<style scoped>
.playlist-col-header {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  width: 100%;
  overflow: hidden;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.1s;
}

.playlist-col-header:hover {
  background: var(--color-border-subtle);
}

.playlist-col-header__name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

/* Ellipsis button: hidden until the column header is hovered. */
/* Opacity-based so keyboard focus still works naturally. */
.playlist-col-header__menu-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--font-size-md);
  opacity: 0;
  transition: opacity 0.1s, color 0.1s;
}

.playlist-col-header:hover .playlist-col-header__menu-btn {
  opacity: 1;
}

.playlist-col-header__menu-btn:hover {
  color: var(--color-text);
}
</style>
