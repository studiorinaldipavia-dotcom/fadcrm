import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'

  return {
    base: '/',
    build: {
      target: 'esnext',
      sourcemap: isDev ? 'inline' : false,
      // Usiamo 'terser' o 'boolean' per evitare la richiesta esplicita del pacchetto esbuild
      minify: !isDev,
      cssMinify: !isDev,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'react-vendor'
            }
          },
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        // Uso di import.meta.dirname per compatibilità con le nuove versioni di Vite
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: Number.parseInt(process.env.PORT || '8443', 10),
      strictPort: true,
    },
    preview: {
      host: '0.0.0.0',
      port: Number.parseInt(process.env.PORT || '8443', 10),
    },
  }
})