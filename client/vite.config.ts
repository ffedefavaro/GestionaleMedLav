import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react-vendor';
            }
            if (id.includes('jspdf') || id.includes('pdfjs-dist')) {
              return 'pdf-vendor';
            }
            if (id.includes('sql.js')) {
              return 'sql-vendor';
            }
          }
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['sql.js'],
  },
})
