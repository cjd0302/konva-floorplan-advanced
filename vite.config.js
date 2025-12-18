import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',                 // ✅ GitHub Pages/서브경로에서도 깨지지 않음
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'], // ✅ 훅 꼬임 방지
  },
  server: {
    host: true,               // ✅ 같은 Wi-Fi에서 IP 접속 가능
    port: 5173,
    strictPort: true,
  },
})