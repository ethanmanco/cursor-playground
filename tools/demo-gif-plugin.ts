import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Dev server only: accepts a POST of GIF bytes at /__save-demo-gif (written
 * to docs/demo.gif) or PNG bytes at /__save-og-image (written to
 * public/og.png, the link preview image). Used to re-record them from the
 * running page.
 */
export function demoGif(): Plugin {
  return {
    name: 'cursor-playground-demo-gif',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-og-image', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const body = Buffer.concat(chunks);
          const png = body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
          if (!png || body.length > 5 * 1024 * 1024) {
            res.statusCode = 400;
            res.end('not a png');
            return;
          }
          const dir = resolve(process.cwd(), 'public');
          mkdirSync(dir, { recursive: true });
          writeFileSync(resolve(dir, 'og.png'), body);
          res.end(`saved ${body.length} bytes`);
        });
      });
      server.middlewares.use('/__save-demo-gif', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const body = Buffer.concat(chunks);
          // GIF files start with "GIF8". Refuse anything else.
          if (body.subarray(0, 4).toString('ascii') !== 'GIF8' || body.length > 8 * 1024 * 1024) {
            res.statusCode = 400;
            res.end('not a gif');
            return;
          }
          const dir = resolve(process.cwd(), 'docs');
          mkdirSync(dir, { recursive: true });
          writeFileSync(resolve(dir, 'demo.gif'), body);
          res.end(`saved ${body.length} bytes`);
        });
      });
    },
  };
}
