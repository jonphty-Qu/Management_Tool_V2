import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { mailApi } from './server/mailPlugin'
import { jobApi } from './server/jobPlugin'
import { docsApi } from './server/docsPlugin'
import { backupApi } from './server/backupPlugin'
import { browserApi } from './server/browserPlugin'
import { inboxApi } from './server/inboxPlugin'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    mailApi(),
    jobApi(),
    docsApi(),
    backupApi(),
    browserApi(),
    inboxApi(),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    // Fester Port: localStorage hängt am Origin, ein Portwechsel würde die Daten "verlieren"
    port: 5180,
    strictPort: true,
    // Hochgeladene Unterlagen und das Log sind keine Quelltexte
    watch: { ignored: ['**/data/**', '**/scripts/server.log'] },
  },
})
