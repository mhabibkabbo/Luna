import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

// Prevent Vite from exiting when stdin closes in non-interactive container environments
process.env.CI = 'true';

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|avif|gif)$/i;

function syncMainDirectoryPhotos() {
  const rootDir = process.cwd();
  const publicDir = path.join(rootDir, 'public');
  try {
    if (!fs.existsSync(publicDir)) return;
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && IMAGE_EXT_RE.test(entry.name)) {
        const srcPath = path.join(rootDir, entry.name);
        const destPath = path.join(publicDir, entry.name);
        if (!fs.existsSync(destPath)) {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }
  } catch {
    // Ignore filesystem sync errors in restricted environments
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'sync-main-directory-photos',
      buildStart() {
        syncMainDirectoryPhotos();
      },
      configureServer() {
        syncMainDirectoryPhotos();
      },
    },
    {
      name: 'fast-dev-cesium-and-deps',
      apply: 'serve',
      enforce: 'pre',
      resolveId(id) {
        if (id === 'cesium' || id === '/cesium/index.js') {
          return { id: '/cesium/index.js', external: true };
        }
        return null;
      },
      load(id) {
        if (id === '/cesium/index.js') {
          return 'export default {};';
        }
        return null;
      },
      transform(code, id) {
        if (id.includes('/node_modules/.vite/deps/')) {
          return { code, map: { mappings: '' } };
        }
        return null;
      },
    },
    react(),
    cesium({ devMinifyCesium: true }),
  ],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['cesium'],
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'lucide-react',
      'd3',
      'leaflet',
      'proj4',
      'proj4leaflet',
      'three',
      'three/addons/controls/OrbitControls.js',
      'astronomy-engine',
      'jspdf',
      'jspdf-autotable',
    ],
    esbuildOptions: {
      sourcemap: false,
      define: {
        CESIUM_BASE_URL: '"/cesium/"',
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');
          if (normalizedId.includes('node_modules/cesium')) {
            return 'cesium';
          }
          if (normalizedId.includes('node_modules/three')) {
            return 'three-orbit';
          }
          if (normalizedId.includes('node_modules/leaflet') || normalizedId.includes('node_modules/proj4')) {
            return 'leaflet-geo';
          }
          if (normalizedId.includes('node_modules/d3')) {
            return 'viz';
          }
          if (normalizedId.includes('node_modules/astronomy-engine')) {
            return 'astronomy';
          }
          if (
            normalizedId.includes('node_modules/jspdf') ||
            normalizedId.includes('node_modules/html2canvas')
          ) {
            return 'pdf-export';
          }
          if (normalizedId.endsWith('/src/data/horizons.json')) {
            return 'lunar-horizons';
          }
        },
      },
    },
  },
});
