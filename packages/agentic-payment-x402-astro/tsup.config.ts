import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    middleware: 'src/middleware.ts',
    endpoints: 'src/endpoints.ts',
    'components/index': 'src/components/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  treeshake: true,
  external: ['astro', 'astro/config', 'astro/middleware'],
});
