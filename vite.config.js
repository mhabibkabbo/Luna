import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), cesium({ devMinifyCesium: true })],
  optimizeDeps: {
    esbuildOptions: {
      sourcemap: false,
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
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
          if (id.includes('node_modules/ol') || id.includes('node_modules/proj4') || id.includes('node_modules/geotiff')) {
            return 'vendor-openlayers';
          }
          if (id.includes('node_modules/three')) {
            return 'vendor-three';
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3') || id.includes('node_modules/victory')) {
            return 'vendor-charts';
          }
          if (id.includes('node_modules/astronomy-engine')) {
            return 'vendor-astronomy';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/lucide-react')) {
            return 'vendor-react-core';
          }
          if (id.includes('src/data/horizons.json')) {
            return 'data-horizons';
          }
          if (id.includes('src/data/earthLaunchSites.js') || id.includes('src/data/earthCommunicationSites.js')) {
            return 'data-earth-sites';
          }
        },
      },
    },
  },
});
