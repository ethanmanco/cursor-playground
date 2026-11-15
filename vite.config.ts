import { defineConfig } from 'vite';

// Relative base so the build works on a GitHub Pages project site
// (ethanmanco.github.io/cursor-playground) without hard-coding the repo name.
export default defineConfig({
  base: './',
});
