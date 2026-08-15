import { test, expect, type Page } from '@playwright/test'

/**
 * End-to-end coverage for doubles detection and review.
 *
 * The seeded library holds three variants of one recording spread across playlists, plus an
 * unrelated track. That is the shape review has to handle: a group worth confirming, and a track
 * that must never join it.
 */

const DB_NAME = 'SortifyDB'

const TRACKS = [
  { trackID: 'respect-studio', title: 'Respect', artist: 'Aretha Franklin', album: 'I Never Loved a Man', source: 'csv', duration: '145000' },
  { trackID: 'respect-live', title: 'Respect - Live', artist: 'Aretha Franklin', album: 'Aretha in Paris', source: 'csv', duration: '151000' },
  { trackID: 'respect-remaster', title: 'Respect - 2005 Remaster', artist: 'Aretha Franklin', album: 'Queen of Soul', source: 'csv', duration: '145200' },
  { trackID: 'superstition', title: 'Superstition', artist: 'Stevie Wonder', album: 'Talking Book', source: 'csv', duration: '245000' },
]

const PLAYLISTS = [
  { id: 1, name: 'Soul Classics', trackIDs: ['respect-studio', 'superstition'] },
  { id: 2, name: 'Live Sets', trackIDs: ['respect-live'] },
  { id: 3, name: 'Remasters', trackIDs: ['respect-remaster'] },
]

/**
 * Seeds IndexedDB directly. Opens without a version because Dexie multiplies its declared version
 * by ten, so requesting 6 would throw VersionError against the stored version 60.
 */
async function seedLibrary(page: Page): Promise<void> {
  await page.goto('#/dashboard')
  await page.reload()
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

/** Navigates to a hash route with a real document load, avoiding the same-document race. */
async function gotoRoute(page: Page, hash: string, ready: string): Promise<void> {
  await page.goto(hash)
  await page.reload()
  await page.locator(ready).waitFor({ state: 'visible' })
}

/** Opens similarity and selects the unreviewed-doubles preset. */
async function openDoubles(page: Page): Promise<void> {
  await gotoRoute(page, '#/similarity', '.cursor-bar')
  await page.locator('.operation-palette__item', { hasText: 'not reviewed' }).click()
  await expect(page.locator('.result-table__row').nth(1)).toBeVisible({ timeout: 15_000 })
}

test.describe('doubles', () => {
  test.beforeEach(async ({ page }) => {
    await seedLibrary(page)
  })

  test('detects the three variants as one group and leaves the unrelated track alone', async ({
    page,
  }) => {
    await openDoubles(page)

    const rows = page.locator('.result-table__row:not(.result-table__head)')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('Respect')
    await expect(rows.first()).toContainText('3')
    await expect(page.locator('.result-table')).not.toContainText('Superstition')
  })

  test('every row carries its own denominator', async ({ page }) => {
    await openDoubles(page)
    await expect(page.locator('.result-table__denominator').first()).toHaveText(
      /^\d+ variants across \d+ playlists$/,
    )
  })

  test('opens the review panel with a row per variant', async ({ page }) => {
    await openDoubles(page)
    await page.locator('.result-table__row').nth(1).click()

    const panel = page.locator('.doubles-panel')
    await expect(panel).toBeVisible()
    await expect(panel).toContainText('Doubles:')
    await expect(panel).not.toContainText('Equivalent')
    await expect(panel.locator('.doubles-panel__row:not(.doubles-panel__row--head)')).toHaveCount(3)
  })

  test('builds matrix columns only from playlists holding a variant', async ({ page }) => {
    await openDoubles(page)
    await page.locator('.result-table__row').nth(1).click()

    const headers = page.locator('.doubles-panel__row--head .doubles-panel__cell--playlist')
    await expect(headers).toHaveCount(3)
    await expect(headers.first()).toContainText('Soul Classics')
  })

  test('choosing a variant to keep persists across a reload', async ({ page }) => {
    await openDoubles(page)
    await page.locator('.result-table__row').nth(1).click()

    // Wait for real titles: the panel falls back to raw track IDs until the track store's
    // liveQuery has emitted, and a click landing before that would target the wrong row.
    await expect(page.locator('.doubles-panel')).toContainText('Remaster', { timeout: 10_000 })

    // The default keep is whichever track ID sorts first, so pick a different one deliberately.
    await page
      .locator('.doubles-panel__row', { hasText: 'Remaster' })
      .locator('.doubles-panel__prefer')
      .click()

    await expect(page.locator('.doubles-panel__row--preferred')).toContainText('Remaster', {
      timeout: 10_000,
    })

    await openDoubles(page)
    await page.locator('.result-table__row').nth(1).click()
    await expect(page.locator('.doubles-panel__row--preferred')).toContainText('Remaster', {
      timeout: 10_000,
    })
  })

  test('confirming a group persists and moves it out of the unreviewed list', async ({ page }) => {
    await openDoubles(page)
    await page.locator('.result-table__row').nth(1).click()
    await page.locator('.doubles-panel__confirm').click()

    await expect(page.locator('.result-table')).toContainText('Nothing', { timeout: 15_000 })

    await gotoRoute(page, '#/similarity', '.cursor-bar')
    await page.locator('.operation-palette__item', { hasText: 'confirmed' }).click()
    await expect(page.locator('.result-table__row').nth(1)).toBeVisible({ timeout: 15_000 })
  })

  test('a rejected group never comes back on a rescan', async ({ page }) => {
    await openDoubles(page)
    await page.locator('.result-table__row').nth(1).click()
    await page.locator('.doubles-panel__reject').click()
    await expect(page.locator('.result-table')).toContainText('Nothing', { timeout: 15_000 })

    // A fresh visit re-runs detection from scratch; the rejection must survive it.
    await gotoRoute(page, '#/similarity', '.cursor-bar')
    await page.locator('.operation-palette__item', { hasText: 'not reviewed' }).click()
    await expect(page.locator('.result-table')).toContainText('Nothing', { timeout: 15_000 })
  })

  test('confirming doubles raises the shared count Overlap reports', async ({ page }) => {
    // Before: the three variants are distinct IDs, so no two playlists share anything.
    await gotoRoute(page, '#/similarity', '.cursor-bar')
    await expect(page.locator('.result-table')).toContainText('Nothing', { timeout: 15_000 })

    await openDoubles(page)
    await page.locator('.result-table__row').nth(1).click()
    await page.locator('.doubles-panel__confirm').click()
    await expect(page.locator('.result-table')).toContainText('Nothing', { timeout: 15_000 })

    // After: with the fold applied, the three playlists all hold the same recording.
    await gotoRoute(page, '#/similarity', '.cursor-bar')
    await expect(page.locator('.result-table__row').nth(1)).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.result-table')).toContainText('Soul Classics')
  })

  test('the equivalence toggle appears only once something is confirmed', async ({ page }) => {
    await gotoRoute(page, '#/similarity', '.cursor-bar')
    await expect(page.locator('.result-control-bar__equivalence')).toHaveCount(0)

    await openDoubles(page)
    await page.locator('.result-table__row').nth(1).click()
    await page.locator('.doubles-panel__confirm').click()

    await gotoRoute(page, '#/similarity', '.cursor-bar')
    await expect(page.locator('.result-control-bar__equivalence')).toBeVisible({ timeout: 15_000 })
  })

  test('turning the toggle off returns Overlap to raw track IDs', async ({ page }) => {
    await openDoubles(page)
    await page.locator('.result-table__row').nth(1).click()
    await page.locator('.doubles-panel__confirm').click()

    await gotoRoute(page, '#/similarity', '.cursor-bar')
    await expect(page.locator('.result-table__row').nth(1)).toBeVisible({ timeout: 15_000 })

    await page.locator('.result-control-bar__equivalence-input').uncheck()
    await expect(page.locator('.result-table')).toContainText('Nothing', { timeout: 15_000 })
  })

  test('the rail surfaces unreviewed doubles and applies the preset when chosen', async ({
    page,
  }) => {
    // Detect first, so there is something unreviewed for the rail to notice.
    await openDoubles(page)
    await gotoRoute(page, '#/similarity', '.cursor-bar')

    const rail = page.locator('.noticed-rail')
    await expect(rail).toBeVisible({ timeout: 15_000 })
    await expect(rail).toContainText('Doubled tracks unreviewed')

    await rail.locator('.noticed-rail__item', { hasText: 'Doubled' }).click()
    await expect(
      page.locator('.operation-palette__item--active', { hasText: 'not reviewed' }),
    ).toBeVisible()
  })

  test('the review filter switches which groups are listed', async ({ page }) => {
    await openDoubles(page)
    await page.locator('.result-table__row').nth(1).click()
    await page.locator('.doubles-panel__confirm').click()
    await expect(page.locator('.result-table')).toContainText('Nothing', { timeout: 15_000 })

    await page.locator('.result-control-bar__review-filter select').selectOption('confirmed')
    await expect(page.locator('.result-table__row').nth(1)).toBeVisible({ timeout: 15_000 })
  })
})
