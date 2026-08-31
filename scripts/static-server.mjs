import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, isAbsolute, relative, resolve } from 'node:path';

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
};

export function startStaticServer({ root, port }) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const parts = pathname.split('/').filter(Boolean);
      if (parts.includes('..')) {
        res.writeHead(403).end('Forbidden');
        return;
      }

      const filePath = resolve(root, ...parts);
      const rel = relative(root, filePath);
      if (rel.startsWith('..') || isAbsolute(rel)) {
        res.writeHead(403).end('Forbidden');
        return;
      }

      const info = await stat(filePath);
      if (!info.isFile()) throw new Error('Not a file');

      res.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': contentTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
      });
      if (req.method === 'HEAD') res.end();
      else createReadStream(filePath).pipe(res);
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  });

  return new Promise((resolveStart, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolveStart(server);
    });
  });
}

export function stopStaticServer(server) {
  server.closeAllConnections?.();
  return new Promise((resolveStop, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolveStop();
    });
  });
}
