import { defineConfig } from 'vitest/config';

// GitHub Pages のサブパス配信でも動くよう相対パスにする
export default defineConfig({
  base: './',
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: { include: ['src/physics/**'] },
  },
});
