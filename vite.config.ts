// ========================================
// ./vite.config.ts
// ========================================

import {defineConfig} from 'vitest/config';
import dts from 'vite-plugin-dts';
import {visualizer} from 'rollup-plugin-visualizer';
import path from 'path';

const is_test_mode = process.env.NODE_ENV === 'test' || !!process.env.VITEST;
const is_build_mode = process.argv.includes('build');

// 子路径入口配置
const subpathEntries = {
  Maybe: 'src/Maybe/__export__.ts',
  Result: 'src/Result/__export__.ts',
  Resource: 'src/Resource/__export-resource__.ts',
  TxScope: 'src/Resource/__export-TxScope__.ts',
  Reader: 'src/Reader/__export-reader__.ts',
  ReaderT: 'src/Reader/__export-readerT__.ts',
  Lazy: 'src/Other/lazy.ts',
  FetchQ: 'src/Other/FetchQ.ts',
  Fit: 'src/Fit/__export__.ts',
  VirtualTime: 'src/MockClock/__export__.ts',
  Concurrent: 'src/Concurrent/__export__.ts',
  Reactive: 'src/Reactive/__export__.ts',
  Utils: 'src/Utils/__export__.ts',
  Arr: 'src/Utils/Array/__export__.ts',
  Str: 'src/Utils/String.ts',
  Sets: 'src/Utils/Set.ts',
  Maps: 'src/Utils/Map.ts',
  TypeTool: 'src/Utils/type-tool.ts',
};

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'threads',

    reporters: process.env.VITEST_REPORTER
      ? [process.env.VITEST_REPORTER]
      : 'default',

    isolate: false,
    cache: {
      dir: './node_modules/.vitest/cache',
    },

    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html-spa'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.spec.ts', 'src/index.ts'],
      skipFull: true,
    },
    disableConsoleIntercept: true,
    silent: true,

    deps: {
      optimizer: {
        web: {enabled: true},
      },
      web: {
        transformCss: false,
        transformAssets: false,
      },
    },
  },

  resolve: {
    alias: {
      src: path.resolve(__dirname, './src'),
    },
  },

  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        ...subpathEntries,
      },
      name: 'modern-ts',
    },
    minify: 'esbuild',
    emptyOutDir: true,
    sourcemap: true,
    ssr: true,
    rollupOptions: {
      external: [
        'async_hooks',
        'os',
        'fs',
        'path',
        'crypto',
        'stream',
        'events',
        'util',
      ],
      output: [
        {
          format: 'es',
          entryFileNames: (chunkInfo) => {
            const name = chunkInfo.name;
            if (name === 'index') {
              return '[name].mjs';
            }
            return `subpath/${name}.mjs`;
          },
          chunkFileNames: 'chunks/[name]-[hash].mjs',
        },
        {
          format: 'cjs',
          entryFileNames: (chunkInfo) => {
            const name = chunkInfo.name;
            if (name === 'index') {
              return '[name].cjs';
            }
            return `subpath/${name}.cjs`;
          },
          chunkFileNames: 'chunks/[name]-[hash].cjs',
        },
      ],
    },
  },

  plugins: [
    !is_test_mode &&
      dts({
        tsconfigPath: './tsconfig.build.json',
        entryRoot: 'src',
        outDir: 'dist/types',
        insertTypesEntry: true,
        include: ['src/**/*.ts'],
      }),
    is_build_mode &&
      visualizer({
        open: false,
        filename: 'stats.html',
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),
});
