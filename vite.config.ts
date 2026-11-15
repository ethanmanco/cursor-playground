/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { demoGif } from './tools/demo-gif-plugin';
import { snippets } from './tools/snippets-plugin';

// Relative base so the build works on a GitHub Pages project site
// (ethanmanco.github.io/cursor-playground) without hard-coding the repo name.
export default defineConfig({
  base: './',
  plugins: [snippets(), demoGif()],
  test: {
    environment: 'node',
  },
});
