const fs = require('node:fs');
const path = require('node:path');

const outputDirectory = path.resolve(__dirname, '..', 'assets', 'images', 'projects');
const WIDTH = 400;
const BOX_X = 20;
const BOX_WIDTH = 360;
const BOX_HEIGHT = 62;
const GAP = 28;
const MARGIN = 20;

const diagrams = [
    {
        slug: 'document-link-gateway',
        label: 'Document link flow: application, PostgreSQL, downloader, file store and gateway',
        steps: [
            { title: 'Business application', detail: 'POST a link request as JSON' },
            { title: 'Link generator API', detail: 'AES-GCM link with expiry and original URL' },
            { title: 'PostgreSQL', detail: 'Link table with ACTIVE, BLOCKED and EXPIRED states' },
            { title: 'Document downloader', detail: 'Fetches the remote file, then moves it into place' },
            { title: 'Local file store', detail: 'Files grouped by application and file name' },
            { title: 'Link gateway', detail: 'Decrypts the link and streams the document' },
            { title: 'Schedulers', detail: 'Housekeeping every 15 s, cleanup every 60 s' },
        ],
    },
    {
        slug: 'xml-transformation-pipeline',
        label: 'XML transformation pipeline: RabbitMQ queues, router, XSLT transformer and error path',
        steps: [
            { title: 'Upstream systems', detail: 'XML requests over AMQP' },
            { title: 'RabbitMQ request queue', detail: 'Each message goes to a bounded worker pool' },
            { title: 'Router', detail: 'Checks the out-queue and routes the message' },
            { title: 'XSLT transformer', detail: 'Cached stylesheets, Java extensions from plugin jars' },
            { title: 'Out-queues', detail: 'Messages delivered to destination queues' },
            { title: 'Error path', detail: 'Failures are emailed and the message is requeued' },
        ],
    },
    {
        slug: 'messenger-archive-search',
        label: 'Messenger archive: sync, transcription, Qdrant index and MCP search',
        steps: [
            { title: 'Messenger account', detail: 'History fetched over the MTProto API' },
            { title: 'Sync service (Rust)', detail: 'Flood-wait backoff and bounded retries' },
            { title: 'PostgreSQL', detail: 'Messages, chats and transcription queue' },
            { title: 'Transcription worker (Python)', detail: 'Claims rows with SKIP LOCKED, runs Whisper' },
            { title: 'Indexer (Rust)', detail: 'Batched local embeddings, checkpoint after upsert' },
            { title: 'Qdrant', detail: 'Vector collection with deterministic UUIDv5 point IDs' },
            { title: 'MCP server', detail: 'stdio and HTTP access for LLM agents' },
        ],
    },
];

// TODO: escapeHtml in build-tech-pages.js does the same job; extract a shared module
// when a third script needs it (Rule of Three).
function escapeXml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderStep(step, index, count) {
    const top = MARGIN + index * (BOX_HEIGHT + GAP);
    const bottom = top + BOX_HEIGHT;
    const arrow = index < count - 1
        ? `  <line class="link" x1="${WIDTH / 2}" y1="${bottom}" x2="${WIDTH / 2}" y2="${bottom + GAP}"/>\n`
        : '';
    return `  <rect class="box" x="${BOX_X}" y="${top}" width="${BOX_WIDTH}" height="${BOX_HEIGHT}" rx="6"/>
  <text class="title" x="36" y="${top + 26}">${index + 1}. ${escapeXml(step.title)}</text>
  <text class="detail" x="36" y="${top + 48}">${escapeXml(step.detail)}</text>
${arrow}`;
}

function renderDiagram(diagram) {
    const count = diagram.steps.length;
    const height = 2 * MARGIN + count * BOX_HEIGHT + (count - 1) * GAP;
    const steps = diagram.steps.map((step, index) => renderStep(step, index, count)).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${height}" role="img">
  <title>${escapeXml(diagram.label)}</title>
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="9" orient="auto">
      <path d="M0,0 L5,9 L10,0" fill="#35776d"/>
    </marker>
  </defs>
  <style>
    .box { fill: #fff; stroke: #35776d; stroke-width: 1.5; }
    .title { fill: #35776d; font: 700 15px Roboto, Arial, sans-serif; }
    .detail { fill: #545e6c; font: 400 12.5px Roboto, Arial, sans-serif; }
    .link { stroke: #35776d; stroke-width: 1.5; marker-end: url(#arrow); }
  </style>
${steps}</svg>
`;
}

function main() {
    fs.mkdirSync(outputDirectory, { recursive: true });
    for (const diagram of diagrams) {
        fs.writeFileSync(path.join(outputDirectory, `${diagram.slug}.svg`), renderDiagram(diagram));
    }
    console.log(`Wrote ${diagrams.length} project diagrams to ${outputDirectory}`);
}

main();
