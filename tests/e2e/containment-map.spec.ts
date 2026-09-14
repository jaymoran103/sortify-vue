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

const TRACKS = [...new Set(YEAR)].map((id) => ({
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

  test('never overlaps two labels, including down a concentric chain', async ({ page }) => {
    await openContainment(page)
    await page.locator('.result-control-bar__view-map').click()
    await expect(page.locator('.containment-map__circle')).toHaveCount(5, { timeout: 15_000 })

    // getBBox is real SVG layout, so this measures what is actually drawn rather than intent.
    const boxes = await page.evaluate(() =>
      [...document.querySelectorAll('.containment-map__label')].map((label) => {
        const box = (label as SVGGraphicsElement).getBBox()
        return { text: label.textContent!.trim(), x: box.x, y: box.y, w: box.width, h: box.height }
      }),
    )

    expect(boxes.length).toBeGreaterThan(1)
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]!
        const b = boxes[j]!
        const overlaps =
          a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
        expect(overlaps, `"${a.text}" overlaps "${b.text}"`).toBe(false)
      }
    }
  })

  test('labels a container on its rim and a leaf in its middle', async ({ page }) => {
    await openContainment(page)
    await page.locator('.result-control-bar__view-map').click()
    await expect(page.locator('.containment-map__circle')).toHaveCount(5, { timeout: 15_000 })

    const { placement, titled } = await page.evaluate(() => {
      const out: Record<string, { labelY: number; cy: number; r: number }> = {}
      const names: string[] = []
      for (const node of document.querySelectorAll('.containment-map__node')) {
        const circle = node.querySelector('circle')!
        const name = circle.querySelector('title')!.textContent!.split(' — ')[0]!
        names.push(name)
        const label = node.querySelector('.containment-map__label')
        if (!label) continue
        out[name] = {
          labelY: Number(label.getAttribute('y')),
          cy: Number(circle.getAttribute('cy')),
          r: Number(circle.getAttribute('r')),
        }
      }
      return { placement: out, titled: names }
    })

    // Year contains things, so its label sits on the rim, clear of its children.
    const year = placement['Year_2018']!
    expect(year.labelY).toBeLessThan(year.cy - year.r * 0.7)

    // Every other labelled container does the same.
    for (const [name, c] of Object.entries(placement)) {
      if (name === 'Year_2018' || name === 'January' || name === 'February') continue
      if (c.labelY < c.cy - 1) expect(c.labelY).toBeLessThan(c.cy - c.r * 0.7)
    }

    // January contains nothing, so it keeps its middle.
    const january = placement['January']!
    expect(Math.abs(january.labelY - january.cy)).toBeLessThan(10)

    // August contains High_Shit, but its rim ring is too narrow to hold legible text, so it
    // carries no drawn label and falls back to its hover title. Suppressing beats spilling.
    expect(placement['August']).toBeUndefined()
    expect(titled).toContain('August')
  })

  test('shows a legend and a scale key drawn to scale', async ({ page }) => {
    await openContainment(page)
    await page.locator('.result-control-bar__view-map').click()

    const legend = page.locator('.containment-map__legend')
    await expect(legend).toBeVisible({ timeout: 15_000 })
    await expect(legend).toContainText('every track is in the outer playlist')
    await expect(page.locator('.containment-map__scale-note')).toContainText(
      'one scale across the whole map',
    )
    await expect(page.locator('.containment-map__key-circle').first()).toBeVisible()
    await expect(page.locator('.containment-map__key')).toContainText('tracks')
  })

  test('renders the key at the same pixel scale as the map, not just the same units', async ({
    page,
  }) => {
    await openContainment(page)
    await page.locator('.result-control-bar__view-map').click()
    await expect(page.locator('.containment-map__circle')).toHaveCount(5, { timeout: 15_000 })

    // Both SVGs are laid out by the browser, so this compares drawn pixels rather than viewBox
    // numbers: a key that is honest in user units but shrunk by CSS would fail here.
    const measured = await page.evaluate(() => {
      const width = (selector: string) =>
        document.querySelector(selector)!.getBoundingClientRect().width
      const keyCircle = document.querySelector('.containment-map__key-circle')!
      const keyValue = Number(
        document.querySelector('.containment-map__key-label')!.textContent!.replace(/\D/g, ''),
      )
      // January is a leaf, so its radius is purely its track count: containers can be widened to
      // fit their contents and would not test the scale.
      const january = [...document.querySelectorAll('.containment-map__circle')].find((c) =>
        c.querySelector('title')!.textContent!.startsWith('January '),
      )!
      return {
        mapPxPerUnit: width('.containment-map__svg') / 480,
        keyPxPerUnit: width('.containment-map__key') / 480,
        radiusRatio: Number(january.getAttribute('r')) / Number(keyCircle.getAttribute('r')),
        expectedRatio: Math.sqrt(3 / keyValue),
      }
    })

    // Same pixels per user unit in both SVGs, so a viewBox-honest key is also a drawn-honest one.
    expect(measured.keyPxPerUnit).toBeCloseTo(measured.mapPxPerUnit, 3)
    expect(measured.radiusRatio).toBeCloseTo(measured.expectedRatio, 4)
  })

  test('sizes two equally large playlists alike, however deep they sit', async ({ page }) => {
    await openContainment(page)
    await page.locator('.result-control-bar__view-map').click()
    await expect(page.locator('.containment-map__circle')).toHaveCount(5, { timeout: 15_000 })

    // January and August both hold 3 tracks, but January is a leaf under the year and August is a
    // container one level further in. Under the old per-parent rescaling they drew differently.
    const radii = await page.evaluate(() => {
      const out: Record<string, number> = {}
      for (const circle of document.querySelectorAll('.containment-map__circle')) {
        const name = circle.querySelector('title')!.textContent!.split(' — ')[0]!
        out[name] = Number(circle.getAttribute('r'))
      }
      return out
    })
    expect(radii['January']!).toBeCloseTo(radii['August']!, 4)
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

/**
 * The dense case, which is where labels actually collided: a year containing twelve months, one of
 * which contains a smaller list. This mirrors the '18_ cluster in the real export.
 */
test.describe('containment map, densely packed', () => {
  const MONTHS = Array.from({ length: 12 }, (_, i) => ({
    id: 100 + i,
    name: `Month_${String(i + 1).padStart(2, '0')}_2018`,
    trackIDs: Array.from({ length: 8 }, (_, t) => `m${i}t${t}`),
  }))
  const YEAR_TRACKS = MONTHS.flatMap((m) => m.trackIDs)
  const DENSE_PLAYLISTS = [
    { id: 1, name: 'Year_2018_Everything', trackIDs: [...YEAR_TRACKS, 'extra1', 'extra2'] },
    ...MONTHS,
    { id: 200, name: 'Best_Of_March', trackIDs: [MONTHS[2]!.trackIDs[0]!] },
  ]
  const DENSE_TRACKS = [...new Set([...YEAR_TRACKS, 'extra1', 'extra2'])].map((id) => ({
    trackID: id,
    title: `Track ${id}`,
    artist: 'Artist',
    album: 'Album',
    source: 'csv',
  }))

  test.beforeEach(async ({ page }) => {
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
      { dbName: DB_NAME, tracks: DENSE_TRACKS, playlists: DENSE_PLAYLISTS },
    )
  })

  test('keeps every label clear of every other with a dozen siblings', async ({ page }) => {
    await openContainment(page)
    await page.locator('.result-control-bar__view-map').click()
    // Year + 12 months + Best_Of_March.
    await expect(page.locator('.containment-map__circle')).toHaveCount(14, { timeout: 15_000 })

    const boxes = await page.evaluate(() =>
      [...document.querySelectorAll('.containment-map__label')].map((label) => {
        const box = (label as SVGGraphicsElement).getBBox()
        return { text: label.textContent!.trim(), x: box.x, y: box.y, w: box.width, h: box.height }
      }),
    )

    expect(boxes.length).toBeGreaterThan(4)
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]!
        const b = boxes[j]!
        const overlaps = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
        expect(overlaps, `"${a.text}" overlaps "${b.text}"`).toBe(false)
      }
    }
  })

  test('keeps every label inside the circle it belongs to', async ({ page }) => {
    await openContainment(page)
    await page.locator('.result-control-bar__view-map').click()
    await expect(page.locator('.containment-map__circle')).toHaveCount(14, { timeout: 15_000 })

    const escapes = await page.evaluate(() => {
      const bad: string[] = []
      for (const node of document.querySelectorAll('.containment-map__node')) {
        const circle = node.querySelector('circle')!
        const label = node.querySelector('.containment-map__label')
        if (!label) continue
        const box = (label as SVGGraphicsElement).getBBox()
        const cx = Number(circle.getAttribute('cx'))
        const cy = Number(circle.getAttribute('cy'))
        const r = Number(circle.getAttribute('r'))
        // Every corner of the text box must sit within the circle. The report carries how far
        // out the worst corner fell, which is what tells a budget bug from a placement one.
        const worst = Math.max(
          ...[
            [box.x, box.y],
            [box.x + box.width, box.y],
            [box.x, box.y + box.height],
            [box.x + box.width, box.y + box.height],
          ].map(([x, y]) => Math.hypot(x! - cx, y! - cy)),
        )
        if (worst > r + 1) {
          bad.push(`${label.textContent!.trim()} out by ${(worst - r).toFixed(1)} of r=${r.toFixed(1)}, box ${box.width.toFixed(1)}x${box.height.toFixed(1)}`)
        }
      }
      return bad
    })

    expect(escapes).toEqual([])
  })
})
