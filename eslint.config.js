import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import globals from 'globals';

// The screens share components through window (see src/shared/globals.js). Collect every name a
// file exports with Object.assign(window, {…}) so no-undef catches names that are never exported.
const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
const shared = {};
for (const f of files('src').filter((f) => /\.(js|jsx)$/.test(f))) {
  for (const m of readFileSync(f, 'utf8').matchAll(/Object\.assign\(window,\s*\{([^}]*)\}/g)) {
    for (const n of m[1].split(',').map((x) => x.trim()).filter(Boolean)) shared[n] = 'readonly';
  }
}

export default [
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022, sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...shared, BP: 'readonly', React: 'readonly', ReactDOM: 'readonly' },
    },
    rules: { 'no-undef': 'error' },
  },
];
