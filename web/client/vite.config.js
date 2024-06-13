import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';

// Load environment variables from .env files
dotenv.config();

export default defineConfig({
  plugins: [
    react(),
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.NODE_ENV === 'production'
          ? process.env.VITE_API_URL_PRODUCTION
          : process.env.VITE_API_URL_DEVELOPMENT,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
