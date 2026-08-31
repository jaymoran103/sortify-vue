import { test, expect, type Page } from '@playwright/test'

/**
 * End-to-end coverage for the similarity module.
 *
 * Seeds IndexedDB directly rather than driving the import UI, so these tests exercise the
 * similarity module itself rather than re-testing import. The seeded library contains one exact
 * duplicate pair and one containment pair, which are the two readings the Overlap result has to
 * tell apart.
 */

const DB_NAME = 'SortifyDB'

interface SeedPlaylist {
  id: number
  name: string
  trackIDs: string[]
}

const TRACKS = Array.from({ length: 12 }, (_, i) => ({
  trackID: `t${i}`,
  title: `Track ${i}`,
  artist: i < 6 ? 'Artist A' : 'Artist B',
  album: 'Album',
  source: 'csv',
}))

const PLAYLISTS: SeedPlaylist[] = [
  { id: 1, name: 'Blues Rock', trackIDs: ['t0', 't1', 't2', 't3', 't4', 't5'] },
  // Exact duplicate of Blues Rock: overlap and containment both 100%.
  { id: 2, name: 'Blues Rock copy', trackIDs: ['t0', 't1', 't2', 't3', 't4', 't5'] },
  // Fully inside Blues Rock but smaller: containment 100%, overlap well below it.
  { id: 3, name: 'Best Riffs', trackIDs: ['t0', 't1'] },
  { id: 4, name: 'Unrelated', trackIDs: ['t9', 't10', 't11'] },
]

/**
 * Writes tracks and playlists straight into IndexedDB, then reloads so the stores pick them up.
 *
 * Opens without a version number on purpose. Dexie multiplies its declared version by ten in the
 * underlying IndexedDB, so `db.version(5)` in src/db/index.ts is IndexedDB version 50; requesting
 * 5 here would throw VersionError. Opening version-agnostically also keeps this helper working
 * across future schema bumps.
 */
async function seedLibrary(page: Page): Promise<void> {
  // The dashboard, not the site root: '/' is the About page until the shell layout lands.
  await page.goto('#/dashboard')
  await page.reload()
  // Let the app open the database and create its object stores before writing into them.
  await page.locator('.library-card').waitFor({ state: 'visible' })

  await page.evaluate(
    async ({ dbName, tracks, playlists }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(['tracks', 'playlists'], 'readwrite')
          for (const track of tracks) tx.objectStore('tracks').put(track)
          for (const playlist of playlists) tx.objectStore('playlists').put(playlist)
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      })
    },
    { dbName: DB_NAME, tracks: TRACKS, playlists: PLAYLISTS },
  )
}

/**
 * Navigates to a hash route and forces a full document load.
 *
 * A bare page.goto() to a URL that differs only in its hash is a same-document navigation, which
 * can land before the router has initialised and then never render the target route. Reloading
 * afterwards guarantees a fresh mount, and also makes Dexie re-read the seeded rows, since raw
 * IndexedDB writes bypass Dexie's change tracking and never reach liveQuery.
 */
async function gotoRoute(page: Page, hash: string, ready: string): Promise<void> {
  await page.goto(hash)
  await page.reload()
  await page.locator(ready).waitFor({ state: 'visible' })
}

test.describe('similarity module', () => {
  test.beforeEach(async ({ page }) => {
    await seedLibrary(page)
  })

  test('scans the library on arrival with no configuration step', async ({ page }) => {
    await gotoRoute(page, '#/similarity', '.cursor-bar')

    const table = page.locator('.result-table')
    await expect(table).toBeVisible()

    // Rows appear without the user touching a control.
    const rows = page.locator('.result-table__row').filter({ hasNot: page.locator('.result-table__head') })
    await expect(rows.first()).toBeVisible({ timeout: 15_000 })

    // The duplicate pair is the top result and reads as fully overlapping.
    await expect(page.locator('.result-table')).toContainText('Blues Rock copy')
    await expect(page.locator('.result-table')).toContainText('100%')
  })

  test('carries the same page header as the workspace view', async ({ page }) => {
    await gotoRoute(page, '#/similarity', '.cursor-bar')

    const header = page.locator('.similarity-view__header')
    await expect(header).toBeVisible()
    await expect(header.locator('.similarity-view__title')).toHaveText('Similarity')
    await expect(header.locator('.similarity-view__meta')).toContainText('playlists')

    // The view fills the viewport rather than collapsing to content height, as workspace does.
    const viewport = page.viewportSize()
    const box = await page.locator('.similarity-view').boundingBox()
    expect(box!.height).toBeGreaterThan((viewport!.height ?? 0) * 0.9)
  })

  test('the header returns to the dashboard', async ({ page }) => {
    await gotoRoute(page, '#/similarity', '.cursor-bar')
    await page
      .locator('.similarity-view__header button', { hasText: 'Back to Dashboard' })
      .click()
    await expect(page).toHaveURL(/#\/dashboard/)
    await expect(page.locator('.library-card')).toBeVisible()
  })

  test('shows the index as ready and reports the library size', async ({ page }) => {
    await gotoRoute(page, '#/similarity', '.cursor-bar')
    await expect(page.locator('.cursor-bar')).toContainText('Whole library')
    // Nine, not twelve: the index counts tracks referenced by a playlist, so t6 to t8 sit in the
    // tracks table but never enter it. Asserting the exact number also catches a zero-track index,
    // which a substring match on "unique tracks" would happily accept.
    await expect(page.locator('.cursor-bar')).toContainText('9 unique tracks', { timeout: 15_000 })
  })

  test('every row carries its own denominator', async ({ page }) => {
    await gotoRoute(page, '#/similarity', '.cursor-bar')
    const denominators = page.locator('.result-table__denominator')
    await expect(denominators.first()).toBeVisible({ timeout: 15_000 })
    const count = await denominators.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i += 1) {
      await expect(denominators.nth(i)).toHaveText(/^\d+ of \d+$/)
    }
  })

  test('separates containment from overlap on the same result', async ({ page }) => {
    await gotoRoute(page, '#/similarity', '.cursor-bar')
    await expect(page.locator('.result-table__row').nth(1)).toBeVisible({ timeout: 15_000 })

    // Best Riffs is entirely inside Blues Rock but only a third of its size, so the two measures
    // must disagree. A single number could not say "delete the smaller" versus "merge".
    const riffsRow = page.locator('.result-table__row', { hasText: 'Best Riffs' }).first()
    await expect(riffsRow).toContainText('100%')
    await expect(riffsRow).toContainText('33%')
  })

  test('switching a preset re-runs the scan', async ({ page }) => {
    await gotoRoute(page, '#/similarity', '.cursor-bar')
    await expect(page.locator('.result-table__row').nth(1)).toBeVisible({ timeout: 15_000 })

    await page.locator('.operation-palette__item', { hasText: 'nearly identical' }).click()
    await expect(
      page.locator('.operation-palette__item--active', { hasText: 'nearly identical' }),
    ).toBeVisible()

    // At a 0.7 Jaccard the duplicate pair survives and the containment-only pair does not.
    await expect(page.locator('.result-table')).toContainText('Blues Rock copy')
    await expect(page.locator('.result-table')).not.toContainText('Best Riffs')
  })

  test('switching to the track axis returns track pairs', async ({ page }) => {
    await gotoRoute(page, '#/similarity', '.cursor-bar')
    await expect(page.locator('.result-table__row').nth(1)).toBeVisible({ timeout: 15_000 })

    await page.locator('.result-control-bar__axis-track').click()
    await expect(page.locator('.result-table__head')).toContainText('Together', { timeout: 15_000 })
  })

  test('selecting a row enables the verb strip and opens a workspace session', async ({ page }) => {
    await gotoRoute(page, '#/similarity', '.cursor-bar')
    const firstRow = page.locator('.result-table__row').nth(1)
    await expect(firstRow).toBeVisible({ timeout: 15_000 })

    await expect(page.locator('.result-verb-strip__open')).toBeDisabled()
    await firstRow.click()
    await expect(page.locator('.result-verb-strip')).toContainText('1 selected')
    await expect(page.locator('.result-verb-strip__open')).toBeEnabled()

    await page.locator('.result-verb-strip__open').click()
    await expect(page).toHaveURL(/\/workspace\?session=/)
  })

  test('selecting in the library and pressing Analyze fills the cursor', async ({ page }) => {
    await gotoRoute(page, '#/dashboard', '.library-card')
    const row = page.locator('.library-card__row', { hasText: 'Blues Rock' }).first()
    await expect(row).toBeVisible()
    await row.click()

    const analyze = page.locator('.library-card__analyze-btn')
    await expect(analyze).toBeEnabled()
    await analyze.click()

    await expect(page).toHaveURL(/#\/similarity/)
    // Reference-based scope: the cursor bar names the selection rather than the whole library.
    await expect(page.locator('.cursor-bar')).toContainText('1 playlist')
  })
})
