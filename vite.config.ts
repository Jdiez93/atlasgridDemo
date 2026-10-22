import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'three-core': ['three'],
          'three-react': ['@react-three/fiber', '@react-three/drei'],
          interface: ['react', 'react-dom', 'framer-motion', 'lucide-react'],
        },
      },
    },
  },
});
