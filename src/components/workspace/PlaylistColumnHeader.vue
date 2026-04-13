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
  } else {
  }

  
  items.push({ divider: true })
  items.push({ label: 'Remove from Workspace', action: () => emit('remove', id) })
  ctx.show(event, items)
}
</script>

<template>
  <div class="playlist-col-header">
    <!-- Playlist Title. FUTURE: Find solution for long playlist names in tight displays -->
    <span class="playlist-col-header__name" :title="playlist.name">
      {{ playlist.name }}
    </span>
    <!-- Context menu button. NOTE: currently using vertical elipsis, switch to dropdown caret for consistency? -->
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
}

.playlist-col-header__name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.playlist-col-header__menu-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--font-size-md);
}

.playlist-col-header__menu-btn:hover {
  color: var(--color-text);
}
</style>
