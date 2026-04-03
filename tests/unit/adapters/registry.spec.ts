import { describe, it, expect, afterEach } from 'vitest'
import {
  registerImporter,
  getImporter,
  registerExporter,
  getExporter,
  getImporterKeys,
  clearRegistry,
} from '@/adapters/registry'
import type { ImportAdapter, ExportAdapter } from '@/types/adapters'

function makeImporter(key: string): ImportAdapter<void> {
  return {
    key,
    label: key,
    import: async () => ({ tracksImported: 0, playlistsImported: 0, errors: [] }),
  }
}

function makeExporter(key: string): ExportAdapter<void> {
  return {
    key,
    label: key,
    export: async () => ({ playlistsExported: 0, errors: [] }),
  }
}

describe('registry', () => {
  afterEach(() => clearRegistry())

  it('registerImporter makes adapter retrievable by key', () => {
    const adapter = makeImporter('test')
    registerImporter(adapter)
    expect(getImporter('test')).toBe(adapter)
  })

  it('getImporter returns undefined for unregistered key', () => {
    expect(getImporter('missing')).toBeUndefined()
  })

  it('registerExporter makes adapter retrievable by key', () => {
    const adapter = makeExporter('test')
    registerExporter(adapter)
    expect(getExporter('test')).toBe(adapter)
  })

  it('getImporterKeys returns all registered keys', () => {
    registerImporter(makeImporter('csv'))
    expect(getImporterKeys()).toEqual(['csv'])
  })

  it('clearRegistry removes all registrations', () => {
    registerImporter(makeImporter('csv'))
    clearRegistry()
    expect(getImporter('csv')).toBeUndefined()
    expect(getImporterKeys()).toEqual([])
  })
})
