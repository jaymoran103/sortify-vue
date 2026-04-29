import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import './styles/variables.css'
import './styles/reset.css'
import './styles/utilities.css'

import { registerImporter, registerExporter } from '@/adapters/registry'
import { csvImportAdapter } from '@/adapters/csvImport'
import { csvExportAdapter } from '@/adapters/csvExport'
import { jsonImportAdapter } from '@/adapters/jsonImport'
import { jsonExportAdapter } from '@/adapters/jsonExport'
import { spotifyImportAdapter } from '@/adapters/spotifyImport'
import { spotifyExportAdapter } from '@/adapters/spotifyExport'
import { initDatabase } from '@/db/dbInit'

registerImporter(csvImportAdapter)
registerExporter(csvExportAdapter)
registerImporter(jsonImportAdapter)
registerExporter(jsonExportAdapter)
registerImporter(spotifyImportAdapter)
registerExporter(spotifyExportAdapter)

// Open SortifyDB before mounting so stores never query an unopened database.
await initDatabase()

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

// After mount: check if this is a Spotify PKCE callback.
// The redirect lands on the base URL with ?code= in the search portion
// After handling (success or failure), navigate to the dashboard so the user isn't left on the about/home page.
if (new URLSearchParams(window.location.search).has('code')) {
  import('@/composables/useSpotifyAuth').then(({ handleSpotifyCallback }) => {
    handleSpotifyCallback()
      .catch((err: unknown) => {
        console.error('Spotify callback failed:', err)
      })
      .finally(() => {
        void router.push({ name: 'dashboard' })
      })
  })
}

