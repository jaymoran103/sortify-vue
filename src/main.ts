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

registerImporter(csvImportAdapter)
registerExporter(csvExportAdapter)
registerImporter(jsonImportAdapter)
registerExporter(jsonExportAdapter)

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

