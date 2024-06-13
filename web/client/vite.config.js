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
<<<<<<< HEAD
        target: import.meta.env.NODE_ENV === 'production' ? 'https://server-zeta-beige.vercel.app/' : 'http://localhost:5000',
=======
        target: import.meta.env.NODE_ENV === 'production' ? 'https://server-zeta-beige.vercel.app/'' : 'http://localhost:5000',
>>>>>>> 5cd1c918dba2397d365cec319fa41b5cbbf74e0e
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