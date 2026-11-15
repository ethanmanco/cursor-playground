import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Dev server only: accepts a POST of GIF bytes at /__save-demo-gif and writes
 * docs/demo.gif. Used to re-record the README demo from the running page.
 */
export function demoGif(): Plugin {
  return {
    name: 'cursor-playground-demo-gif',
    apply: 'serve',
    configureServer(server) {
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
