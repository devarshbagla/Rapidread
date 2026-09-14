import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Pre-bundle the icon set so dev doesn't crawl thousands of modules.
  optimizeDeps: { include: ['@tabler/icons-react'] },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
