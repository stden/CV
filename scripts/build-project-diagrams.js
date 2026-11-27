const fs = require('node:fs');
const path = require('node:path');
const { ROOT_DIR, escapeXml, escapeHtml, loadCvData } = require('./lib/utils');

const OUTPUT_DIR = path.join(ROOT_DIR, 'assets', 'images', 'projects');
const WIDTH = 420;
const BOX_X = 20;
const BOX_WIDTH = 380;
const BOX_HEIGHT = 64;
const GAP = 26;
const MARGIN = 20;

function renderStandaloneSvg(diagram) {
    const count = diagram.nodes.length;
    const height = 2 * MARGIN + count * BOX_HEIGHT + (count - 1) * GAP;
    const markerId = `arrow-${diagram.slug}`;

    const steps = diagram.nodes.map((node, index) => {
        const top = MARGIN + index * (BOX_HEIGHT + GAP);
        const bottom = top + BOX_HEIGHT;
        const arrow = index < count - 1
            ? `  <line class="link" x1="${WIDTH / 2}" y1="${bottom}" x2="${WIDTH / 2}" y2="${bottom + GAP - 2}"/>\n`
            : '';
        return `  <rect class="box" x="${BOX_X}" y="${top}" width="${BOX_WIDTH}" height="${BOX_HEIGHT}" rx="8"/>
  <text class="title" x="38" y="${top + 27}">${index + 1}. ${escapeXml(node.title)}</text>
  <text class="detail" x="38" y="${top + 48}">${escapeXml(node.detail)}</text>
${arrow}`;
    }).join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${height}" width="${WIDTH}" height="${height}" role="img">
  <title>${escapeXml(diagram.title)} (${escapeXml(diagram.originLabel)})</title>
  <desc>${escapeXml(diagram.label)}</desc>
  <defs>
    <marker id="${markerId}" markerWidth="10" markerHeight="10" refX="5" refY="9" orient="auto">
      <path d="M0,0 L5,9 L10,0" fill="#0f766e"/>
    </marker>
  </defs>
  <style>
    .box { fill: #f8fafc; stroke: #0f766e; stroke-width: 1.75; }
    .title { fill: #0f172a; font: 700 14.5px Inter, system-ui, -apple-system, sans-serif; }
    .detail { fill: #475569; font: 400 12.5px Inter, system-ui, -apple-system, sans-serif; }
    .link { stroke: #0f766e; stroke-width: 1.75; marker-end: url(#${markerId}); }
  </style>
${steps}</svg>
`;
}

function renderInteractiveSvg(diagram) {
    const count = diagram.nodes.length;
    const height = 2 * MARGIN + count * BOX_HEIGHT + (count - 1) * GAP;
    const markerId = `inline-arrow-${diagram.slug}`;

    const steps = diagram.nodes.map((node, index) => {
        const top = MARGIN + index * (BOX_HEIGHT + GAP);
        const bottom = top + BOX_HEIGHT;
        const arrow = index < count - 1
            ? `  <line x1="${WIDTH / 2}" y1="${bottom}" x2="${WIDTH / 2}" y2="${bottom + GAP - 2}" stroke="var(--accent)" stroke-width="1.75" marker-end="url(#${markerId})"/>\n`
            : '';
        const pressed = index === 0 ? 'true' : 'false';
        return `  <g class="arch-node" role="button" tabindex="0" aria-pressed="${pressed}" data-node-id="${escapeHtml(node.id)}">
    <rect x="${BOX_X}" y="${top}" width="${BOX_WIDTH}" height="${BOX_HEIGHT}" rx="8"/>
    <text class="node-title" x="38" y="${top + 27}">${index + 1}. ${escapeHtml(node.title)}</text>
    <text class="node-detail" x="38" y="${top + 48}">${escapeHtml(node.detail)}</text>
  </g>
${arrow}`;
    }).join('');

    return `<svg viewBox="0 0 ${WIDTH} ${height}" role="group" aria-label="${escapeHtml(diagram.label)}">
  <defs>
    <marker id="${markerId}" markerWidth="10" markerHeight="10" refX="5" refY="9" orient="auto">
      <path d="M0,0 L5,9 L10,0" fill="var(--accent)"/>
    </marker>
  </defs>
${steps}</svg>`;
}

function main() {
    const data = loadCvData();
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    for (const diagram of data.architectureDiagrams) {
        fs.writeFileSync(
            path.join(OUTPUT_DIR, `${diagram.slug}.svg`),
            renderStandaloneSvg(diagram)
        );
    }
    console.log(`Generated ${data.architectureDiagrams.length} architecture SVG diagrams in ${OUTPUT_DIR}`);
}

if (require.main === module) {
    main();
}

module.exports = {
    renderStandaloneSvg,
    renderInteractiveSvg,
};
