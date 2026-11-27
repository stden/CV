const { createReadStream } = require('node:fs');
const { stat } = require('node:fs/promises');
const { createServer } = require('node:http');
const path = require('node:path');

const dist = path.resolve(__dirname, '..', 'dist');
const base = '/CV/';
const portIndex = process.argv.indexOf('--port');
const port = portIndex === -1 ? 4173 : Number(process.argv[portIndex + 1]);
const types = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
    '.jpg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon',
    '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.xml': 'application/xml',
    '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
};

function redirect(response, location) {
    response.writeHead(308, { Location: location }).end();
}

createServer(async (request, response) => {
    try {
        const url = new URL(request.url, 'http://localhost');
        if (url.pathname === '/' || url.pathname === '/CV') {
            redirect(response, base + url.search);
            return;
        }
        const requestPath = decodeURIComponent(url.pathname);
        if (!requestPath.startsWith(base)) throw new Error('Outside preview base');
        let file = path.resolve(dist, requestPath.slice(base.length));
        if (file !== dist && !file.startsWith(dist + path.sep)) throw new Error('Outside preview root');
        let info = await stat(file);
        if (info.isDirectory()) {
            if (!url.pathname.endsWith('/')) {
                redirect(response, url.pathname + '/' + url.search);
                return;
            }
            file = path.join(file, 'index.html');
            info = await stat(file);
        }
        if (!info.isFile()) throw new Error('Missing file');
        response.writeHead(200, {
            'Content-Type': types[path.extname(file)] ?? 'application/octet-stream',
            'Content-Length': info.size,
        });
        if (request.method === 'HEAD') response.end();
        else createReadStream(file).on('error', () => response.destroy()).pipe(response);
    } catch {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    }
}).listen(port, '127.0.0.1', () => console.log(`Preview at http://127.0.0.1:${port}${base}`));
