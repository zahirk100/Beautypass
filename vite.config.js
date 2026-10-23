import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// /member, /onboarding and /beheer are built from src/. The campaign site (index.html, styles, assets)
// is copied unchanged by scripts/copy-site.mjs. JSX uses the classic runtime with React on window,
// exactly like the original Babel-in-the-browser prototypes.
export default defineConfig({
  publicDir: false,
  esbuild: { jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment' },
  build: {
    outDir: 'dist',
    assetsDir: '_app',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        member: resolve(import.meta.dirname, 'member/index.html'),
        beheer: resolve(import.meta.dirname, 'beheer/index.html'),
      },
    },
  },
});
