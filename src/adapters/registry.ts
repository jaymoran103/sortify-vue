import type { ImportAdapter, ExportAdapter } from '@/types/adapters'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const importers = new Map<string, ImportAdapter<any>>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const exporters = new Map<string, ExportAdapter<any>>()

export function registerImporter<T>(adapter: ImportAdapter<T>): void {
  importers.set(adapter.key, adapter)
}

export function registerExporter<T>(adapter: ExportAdapter<T>): void {
  exporters.set(adapter.key, adapter)
}

export function getImporter<T = unknown>(key: string): ImportAdapter<T> | undefined {
  return importers.get(key) as ImportAdapter<T> | undefined
}

export function getExporter<T = unknown>(key: string): ExportAdapter<T> | undefined {
  return exporters.get(key) as ExportAdapter<T> | undefined
}

export function getImporterKeys(): string[] {
  return [...importers.keys()]
}

export function getExporterKeys(): string[] {
  return [...exporters.keys()]
}

export function clearRegistry(): void {
  importers.clear()
  exporters.clear()
}

