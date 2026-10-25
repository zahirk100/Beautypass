// Copies the static campaign site (everything that is not part of the app build) into dist/.
import { cpSync, readdirSync, statSync } from 'node:fs';

const SKIP = new Set(['dist', 'node_modules', 'src', 'scripts', 'member', 'beheer', 'onboarding', 'api',
  'supabase', 'tests', 'docs', 'package.json', 'package-lock.json', 'vite.config.js', 'eslint.config.js', 'vercel.json']);

for (const name of readdirSync('.')) {
  if (name.startsWith('.') || SKIP.has(name)) continue;
  cpSync(name, `dist/${name}`, { recursive: statSync(name).isDirectory() });
}
console.log('campaign site copied to dist/');
