import { test, expect, type Page } from '@playwright/test'

/**
 * End-to-end coverage for the containment map.
 *
 * The seeded library mirrors the shape the real export produces: a year playlist that wholly
 * contains several months, one of which wholly contains a smaller list. That three-level chain is
 * what makes the map concentric rather than a flat ring.
 */

const DB_NAME = 'SortifyDB'

const JAN = ['t1', 't2', 't3']
const FEB = ['t4', 't5']
const AUG = ['t6', 't7', 't8']
const HIGH = ['t6'] // inside August, therefore inside the year too
const YEAR = [...JAN, ...FEB, ...AUG, 't9', 't10']

const TRACKS = [...new Set([...YEAR])].map((id) => ({
  trackID: id,
  title: `Track ${id}`,
  artist: 'Artist',
  album: 'Album',
  source: 'csv',
}))

const PLAYLISTS = [
  { id: 1, name: 'Year_2018', trackIDs: YEAR },
  { id: 2, name: 'January', trackIDs: JAN },
  { id: 3, name: 'February', trackIDs: FEB },
  { id: 4, name: 'August', trackIDs: AUG },
  { id: 5, name: 'High_Shit', trackIDs: HIGH },
  { id: 6, name: 'Unrelated', trackIDs: ['z1', 'z2'] },
]

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
    {
      dbName: DB_NAME,
      tracks: [...TRACKS, { trackID: 'z1', title: 'Z1', artist: 'A', album: 'B', source: 'csv' }],
      playlists: PLAYLISTS,
    },
  )
}

async function gotoRoute(page: Page, hash: string, ready: string): Promise<void> {
  await page.goto(hash)
  await page.reload()
  await page.locator(ready).waitFor({ state: 'visible' })
}

/** Opens similarity on the containment preset, which is the only one offering a map. */
async function openContainment(page: Page): Promise<void> {
  await gotoRoute(page, '#/similarity', '.cursor-bar')
  await page.locator('.operation-palette__item', { hasText: 'fully contained' }).click()
  await expect(page.locator('.result-control-bar__view')).toBeVisible({ timeout: 15_000 })
}

test.describe('containment map', () => {
  test.beforeEach(async ({ page }) => {
    await seedLibrary(page)
  })

  test('offers the map only for the containment preset', async ({ page }) => {
    await gotoRoute(page, '#/similarity', '.cursor-bar')
    await expect(page.locator('.result-control-bar__view')).toHaveCount(0)

    await openContainment(page)
    await expect(page.locator('.result-control-bar__view')).toBeVisible()
  })

  test('draws a circle for every playlist in the cluster', async ({ page }) => {
    await openContainment(page)
    await page.locator('.result-control-bar__view-map').click()

    const circles = page.locator('.containment-map__circle')
    // Year, January, February, August, High_Shit. Unrelated is in no cluster.
    await expect(circles).toHaveCount(5, { timeout: 15_000 })
    await expect(page.locator('.containment-map__svg')).toBeVisible()
  })

  test('nests each child strictly inside its container', async ({ page }) => {
    await openContainment(page)
    await page.locator('.result-control-bar__view-map').click()
    await expect(page.locator('.containment-map__circle')).toHaveCount(5, { timeout: 15_000 })

    const geometry = await page.evaluate(() => {
      const byName = new Map<string, { cx: number; cy: number; r: number }>()
      for (const node of document.querySelectorAll('.containment-map__node')) {
        const circle = node.querySelector('circle')!
        const name = circle.querySelector('title')!.textContent!.split(' — ')[0]!
        byName.set(name, {
          cx: Number(circle.getAttribute('cx')),
          cy: Number(circle.getAttribute('cy')),
          r: Number(circle.getAttribute('r')),
        })
      }
      return Object.fromEntries(byName)
    })

    const inside = (inner: string, outer: string) => {
      const a = geometry[inner]!
      const b = geometry[outer]!
      expect(Math.hypot(a.cx - b.cx, a.cy - b.cy) + a.r).toBeLessThanOrEqual(b.r + 0.5)
    }

    inside('August', 'Year_2018')
    inside('January', 'Year_2018')
    inside('High_Shit', 'August') // the three-level chain
  })

  test('sizes circles by track count', async ({ page }) => {
    await openContainment(page)
    await page.locator('.result-control-bar__view-map').click()
    await expect(page.locator('.containment-map__circle')).toHaveCount(5, { timeout: 15_000 })

    const radii = await page.evaluate(() => {
      const out: Record<string, number> = {}
      for (const circle of document.querySelectorAll('.containment-map__circle')) {
        const name = circle.querySelector('title')!.textContent!.split(' — ')[0]!
        out[name] = Number(circle.getAttribute('r'))
      }
      return out
    })
    expect(radii['Year_2018']!).toBeGreaterThan(radii['August']!)
    expect(radii['August']!).toBeGreaterThan(radii['High_Shit']!)
  })

  test('states coverage numerically rather than leaving it to the eye', async ({ page }) => {
    await openContainment(page)
    await page.locator('.result-control-bar__view-map').click()
    // January 3 + February 2 + August 3 = 8 of the year's 10 tracks.
    await expect(page.locator('.containment-map__coverage')).toContainText('8 of 10 tracks', {
      timeout: 15_000,
    })
  })

  test('clicking a circle points the cursor at that playlist', async ({ page }) => {
    await openContainment(page)
    await page.locator('.result-control-bar__view-map').click()
    await expect(page.locator('.containment-map__circle')).toHaveCount(5, { timeout: 15_000 })

    // The innermost circle: outer ones are painted underneath their children, so a click aimed
    // at a container's centre lands on whatever is nested there instead.
    await page
      .locator('.containment-map__node')
      .filter({ has: page.locator('title', { hasText: 'High_Shit' }) })
      .click()
    await expect(page.locator('.cursor-bar')).toContainText('1 playlist')
  })

  test('returns to the table when the preset stops reading containment', async ({ page }) => {
    await openContainment(page)
    await page.locator('.result-control-bar__view-map').click()
    await expect(page.locator('.containment-map__svg')).toBeVisible({ timeout: 15_000 })

    await page.locator('.operation-palette__item', { hasText: 'that overlap' }).click()
    await expect(page.locator('.containment-map__svg')).toHaveCount(0)
    await expect(page.locator('.result-table')).toBeVisible()
  })
})
