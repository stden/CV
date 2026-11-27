const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { ROOT_DIR } = require('./lib/utils');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.pdf': 'application/pdf',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
};

function startServer(port = Number(process.env.PORT) || 4174) {
    const server = http.createServer((req, res) => {
        const reqPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (reqPath === '/CV') {
            res.writeHead(301, { Location: '/CV/' });
            res.end();
            return;
        }
        if (!reqPath.startsWith('/CV/')) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found (site is mounted at /CV/)');
            return;
        }

        const relPath = reqPath.slice('/CV/'.length) || 'index.html';
        const candidate = path.resolve(ROOT_DIR, relPath);
        if (!candidate.startsWith(ROOT_DIR)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        let target = candidate;
        if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
            target = path.join(target, 'index.html');
        }
        if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
        }

        const ext = path.extname(target).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        fs.createReadStream(target).pipe(res);
    });

    return new Promise((resolve) => {
        server.listen(port, '127.0.0.1', () => {
            resolve(server);
        });
    });
}

if (require.main === module) {
    const portArgIndex = process.argv.indexOf('--port');
    const port = portArgIndex !== -1 ? Number(process.argv[portArgIndex + 1]) : 4174;
    startServer(port).then(() => {
        console.log(`Serving /CV/ at http://127.0.0.1:${port}/CV/`);
    });
}

module.exports = { startServer };
