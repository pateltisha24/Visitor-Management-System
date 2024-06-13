// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';

// export default defineConfig({
//   plugins: [
//     react(),
//   ],
//   // Define environment variables
//   define: {
//     'process.env': process.env
//   },
//   // Modify the base URL for different environments
//   server: {
//     proxy: {
//       '/api': {

//         target: import.meta.env.NODE_ENV === 'production' ? 'https://server-zeta-beige.vercel.app/' : 'http://localhost:5000',

//         changeOrigin: true,
        
//       },
//     },
//   },
//   resolve: {
//     alias: {
//       '@': '/src',
//     },
//   },
// });
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  plugins: [
    react(),
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    // Add other environment variables as needed
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.NODE_ENV === 'production'
          ? 'https://server-zeta-beige.vercel.app/'
          : 'http://localhost:5000',
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
