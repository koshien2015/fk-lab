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
    // 逆算のテストは 1 件で数百回シミュレーションする。CI のマシンは手元の 4〜5 倍遅いので、余裕を持たせる。
    testTimeout: 30_000,
    coverage: {
      // 計算の部分（DOM や WebGL を使わないもの）を対象にする
      include: [
        'src/physics/**',
        'src/match/**',
        'src/solver/**',
        'src/analysis/**',
        'src/playback/**',
        'src/fx/**',
        'src/field/**',
        'src/app/flight.ts',
        'src/app/setup.ts',
        'src/app/legends.ts',
        'src/scene/ballPattern.ts',
      ],
      exclude: ['src/physics/presets.ts', 'src/physics/types.ts'],
    },
  },
});
