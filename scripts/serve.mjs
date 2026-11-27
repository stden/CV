// Serves the repository the way GitHub Pages serves it, under /CV/.
// Usage: node scripts/serve.mjs [port]   (default 4173)
import { repoRoot } from './lib/content.mjs';
import { startStaticServer } from './lib/static-server.mjs';

const port = Number(process.argv[2] ?? 4173);
await startStaticServer(repoRoot, { basePath: '/CV/', port });
console.log(`Serving the CV at http://127.0.0.1:${port}/CV/`);
