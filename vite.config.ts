import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Vercelの環境変数をクライアントサイドの 'process.env.API_KEY' にマッピングします
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  }
})