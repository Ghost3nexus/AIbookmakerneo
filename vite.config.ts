import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // This securely injects the API key from Vercel's environment variables
    // into the client-side code during the build process.
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  }
});
