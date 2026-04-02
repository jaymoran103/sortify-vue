// Contracts for import/export adapters

// Progresss callback: will be used to update progress for display during lengthy I/O operations
export interface ProgressCallback {
  (done: number, total: number, label?: string): void
}

// Rate limit callback: will be used to signal when an API rate limit has been hit and how long to wait before retrying
export interface RateLimitCallback {
  (waitSeconds: number): void
}

// Adapter interfaces: define the structure for import and export adapters.
// Each adapter needs a unique key, a user-friendly label, and the main i/o function that accepts options and progress/rate limit callbacks. 

export interface ImportAdapter<TOptions = void> {
  key: string
  label: string
  import(options: TOptions, onProgress?: ProgressCallback): Promise<ImportResult>
}

export interface ExportAdapter<TOptions = void> {
  key: string
  label: string
  export(options: TOptions, onProgress?: ProgressCallback): Promise<ExportResult>
}

// Result types for I/O operations

export interface ImportResult {
  tracksImported: number
  playlistsImported: number
  errors: string[]
}

export interface ExportResult {
  playlistsExported: number
  errors: string[]
}