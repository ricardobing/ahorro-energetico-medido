import { defineConfig } from 'vitest/config';

/** Se corre después de `npm run build`: mide el JavaScript inicial comprimido. */
export default defineConfig({
  test: {
    name: 'bundle',
    root: import.meta.dirname,
    include: ['test/bundle-size.test.ts'],
    environment: 'node',
  },
});
