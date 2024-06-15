<<<<<<< HEAD
// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';
// import dotenv from 'dotenv';

// // Load environment variables from .env files
// dotenv.config();

// export default defineConfig({
//   plugins: [
//     react(),
//   ],
//   define: {
//     'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
//   },
//   server: {
//     proxy: {
//       '/api': {
//         target: process.env.NODE_ENV === 'production'
//           ? import.meta.env.VITE_API_URL_PRODUCTION
//           : import.meta.env.VITE_API_URL_DEVELOPMENT,
//         changeOrigin: true,
//         rewrite: (path) => path.replace(/^\/api/, ''),
//       },
//     },
//   },
//   resolve: {
//     alias: {
//       '@': '/src',
//     },
//   },
// });

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

=======
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

>>>>>>> 32518e78e799ab27e3a0492f89f9a86a655535ec
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server:{
    proxy:{
      '^/api': {
<<<<<<< HEAD
        target: 'http://localhost:5000',
        // 'https://server-zeta-beige.vercel.app' ,
=======
        target: 'https://server-zeta-beige.vercel.app/',
        secure : true,
>>>>>>> 32518e78e799ab27e3a0492f89f9a86a655535ec
        changeOrigin: true,
      },
    }
  }
})
