
// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';

// export default defineConfig({
//   plugins: [react()],
//   resolve: {
//     alias: {
//       '@': '/src',
//     },
//   },
// });
// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';
// import vue from '@vitejs/plugin-vue';

// export default defineConfig({
//   plugins: [
//     react(),
//     vue(),
//   ],
//   resolve: {
//     alias: {
//       '@': '/src',
//     },
//   },
//   server: {
//     proxy: {
//       '/api': {
//         target: 'http://localhost:5000',
//         changeOrigin: true,
//         rewrite: (path) => path.replace(/^\/api/, ''),
//       },
//     },
//   },
// });
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
        target: 'https://client-kzytrjlsv-nishas-projects-db23472b.vercel.app',
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
