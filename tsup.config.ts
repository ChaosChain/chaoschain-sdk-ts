import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'session/index': 'src/session/index.ts',
    'gateway/index': 'src/gateway/index.ts',
    'providers/storage/index': 'src/providers/storage/index.ts',
    'providers/compute/index': 'src/providers/compute/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.js',
    };
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: ['@pinata/sdk', '@irys/sdk', 'ipfs-http-client'],
});
