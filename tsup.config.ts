import { defineConfig } from 'tsup';

export default defineConfig({
    entry: { index: 'src/index.ts', check: 'scripts/check.ts' },
    format: ['esm'],
    target: 'node22',
    outDir: 'dist',
    clean: true,
    splitting: false,
    sourcemap: true,
    dts: false,
    banner: {
        js: '#!/usr/bin/env node',
    },
});
