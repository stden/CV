import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';

// Serves a directory under a base path, the way GitHub Pages serves /CV/.
// Used by the PDF build, the browser tests and `npm run serve`.

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf'
};

function resolveFile(root, relativePath) {
  const candidate = normalize(join(root, relativePath));
  if (candidate !== root && !candidate.startsWith(root + sep)) return null;
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  const index = join(candidate, 'index.html');
  return existsSync(index) && statSync(index).isFile() ? index : null;
}

function send(response, status, file) {
  response.writeHead(status, { 'Content-Type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
}

export function startStaticServer(root, { basePath = '/', port = 0, host = '127.0.0.1' } = {}) {
  const prefix = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const notFound = join(root, '404.html');
  const server = createServer((request, response) => {
    const { pathname } = new URL(request.url, 'http://localhost');
    if (!pathname.startsWith(prefix)) {
      response.writeHead(404);
      response.end();
      return;
    }
    const file = resolveFile(root, decodeURIComponent(pathname.slice(prefix.length)));
    if (file) {
      send(response, 200, file);
      return;
    }
    if (existsSync(notFound)) send(response, 404, notFound);
    else {
      response.writeHead(404);
      response.end();
    }
  });
  return new Promise((resolve) => {
    server.listen(port, host, () => resolve(server));
  });
}
