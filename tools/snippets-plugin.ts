import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import type { Plugin } from 'vite';

const VIRTUAL = 'virtual:snippets';
const RESOLVED = '\0' + VIRTUAL;

/**
 * Builds a standalone, minified script for every effect in src/effects, so
 * "Copy code" always matches the effect you see on the page. The result is a
 * virtual module: `{ [effectId]: code }`. Each script expects the settings in
 * a variable named CPV, which the page wraps around it when copying.
 *
 * Convention: src/effects/<id>.ts exports one effect whose id is <id>.
 */
export function snippets(): Plugin {
  const root = process.cwd();
  const effectsDir = resolve(root, 'src/effects');
  const runtime = resolve(root, 'src/snippet/runtime.ts').replace(/\\/g, '/');

  return {
    name: 'cursor-playground-snippets',
    resolveId(id) {
      if (id === VIRTUAL) return RESOLVED;
    },
    async load(id) {
      if (id !== RESOLVED) return;
      const files = readdirSync(effectsDir).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
      const out: Record<string, string> = {};
      for (const file of files) {
        const path = resolve(effectsDir, file).replace(/\\/g, '/');
        this.addWatchFile(path);
        const entry = `
          import * as mod from ${JSON.stringify(path)};
          import { runSnippet } from ${JSON.stringify(runtime)};
          const fx = Object.values(mod).find((v) => v && typeof v === 'object' && 'setup' in v);
          runSnippet(fx, CPV);
        `;
        const result = await build({
          stdin: { contents: entry, resolveDir: root, loader: 'ts' },
          bundle: true,
          minify: true,
          format: 'iife',
          target: 'es2020',
          legalComments: 'none',
          write: false,
        });
        out[file.replace(/\.ts$/, '')] = result.outputFiles[0].text.trim();
      }
      this.addWatchFile(runtime);
      return `export default ${JSON.stringify(out)};`;
    },
  };
}
