import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// GitHub Pages serves project sites under /<repo>/; local/dev keeps "/".
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [react()],
  // Pre-bundle the icon set so dev doesn't crawl thousands of modules.
  optimizeDeps: { include: ['@tabler/icons-react'] },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
