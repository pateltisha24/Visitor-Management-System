import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// API calls go directly to VITE_API_URL (see src/api.js), so no dev proxy is
// needed. https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
});
