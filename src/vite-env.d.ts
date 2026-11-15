/// <reference types="vite/client" />

declare module 'virtual:snippets' {
  /** Minified standalone code per effect id. Expects settings in a variable named CPV. */
  const snippets: Record<string, string>;
  export default snippets;
}
