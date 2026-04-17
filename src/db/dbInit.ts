import { ref } from 'vue'
import { db, dbBlockedFlag } from '@/db/index'

export type DbStatus = 'opening' | 'ready' | 'blocked' | 'error'

export const dbStatus = ref<DbStatus>('opening')

/**
 * Opens SortifyDB and resolves dbStatus.
 *
 * Must be awaited in main.ts before app.mount() so that Pinia stores never attempt to query an unopened database.
 * 
 * Error handling:
 * - Dexie.VersionError: the stored DB is newer than CURRENT_VERSION (a future deployment was used). The app cannot safely write, so we set status to 'error'.\
 * - blocked event: an older open connection is blocking the upgrade. Dexie will retry and fire 'ready' automatically once unblocked.
 * - other errors: set status to 'error', log details to console.
 * 
 */
export async function initDatabase(): Promise<void> {
  dbStatus.value = 'opening'

  // Mirror the blocked flag into dbStatus so the banner component only needs
  // to watch one source of truth.
  const stopWatchingBlocked = watchBlocked()

  try {
    await db.open()
    dbStatus.value = 'ready'
  } catch (err) {
    if (err instanceof Error && err.name === 'VersionError') {
      // Stored DB is newer than CURRENT_VERSION (a future deployment was used).
      // Delete and recreate — no migration support is required.
      console.warn('SortifyDB: stored version is newer than this build. Resetting database.')
      await db.delete()
      await db.open()
      dbStatus.value = 'ready'
    } else {
      console.error('SortifyDB: failed to open database.', err)
      dbStatus.value = 'error'
    }
  } finally {
    stopWatchingBlocked()
  }

  // If the DB opened successfully and a blocked flag was set transiently, clear it.
  if (dbStatus.value === 'ready') {
    dbBlockedFlag.value = false
  }
}

/**
 * Polls dbBlockedFlag and promotes dbStatus to 'blocked' while it is set.
 * Returns a cleanup function that removes the watcher.
 */
function watchBlocked(): () => void {
  let frame: number

  function check() {
    if (dbBlockedFlag.value && dbStatus.value === 'opening') {
      dbStatus.value = 'blocked'
    }
    frame = requestAnimationFrame(check)
  }

  frame = requestAnimationFrame(check)
  return () => cancelAnimationFrame(frame)
}
