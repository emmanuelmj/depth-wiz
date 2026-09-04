import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Forward API requests and static/uploaded assets to FastAPI backend
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/data': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/static': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  }
});

