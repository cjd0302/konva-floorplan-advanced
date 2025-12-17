import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// export default defineConfig({
//   plugins: [react()],
//   server: {
//     port: 5174,
//     strictPort: true,
//     host: '0.0.0.0'
//   }
// })
export default defineConfig({
  base: '/konva-floorplan-advanced/', // repo 이름
  plugins: [react()]
})
