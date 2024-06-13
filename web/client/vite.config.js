import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
  ],
  // Define environment variables
  define: {
    'process.env': process.env
  },
  // Modify the base URL for different environments
  server: {
    proxy: {
      '/api': {
        target: import.meta.env.NODE_ENV === 'production' ? 'https://server-zeta-beige.vercel.app/'' : 'http://localhost:5000',
        changeOrigin: true,
        
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
