import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// GitHub Pages のサブパス配信でも動くよう相対パスにする
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        graphs: resolve(import.meta.dirname, 'graphs.html'),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: { include: ['src/physics/**', 'src/playback/**', 'src/scene/ballPattern.ts'] },
  },
});
