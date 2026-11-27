const fs = require('node:fs');
const path = require('node:path');
const { escapeHtml: e } = require('../src/html');

const width = 416;
const boxHeight = 78;
const gap = 24;
const margin = 12;

function wrap(text, length) {
    const lines = [''];
    for (const word of text.split(' ')) {
        const last = lines.length - 1;
        const next = lines[last] ? `${lines[last]} ${word}` : word;
        if (next.length > length && lines[last]) lines.push(word);
        else lines[last] = next;
    }
    return lines;
}

function renderDiagram({ id, diagram }) {
    const steps = diagram.steps.map((step) => ({ ...step, lines: wrap(step.detail, 52) }));
    let top = margin;
    const nodes = steps.map((step, index) => {
        const height = Math.max(boxHeight, 42 + 18 * step.lines.length);
        const next = index + 1 < steps.length;
        const arrow = next ? `<path d="M208 ${top + height}v${gap - 5}m-4-4 4 4 4-4" class="arrow"/>` : '';
        const node = `<g>
  <rect x="${margin}" y="${top}" width="${width - margin * 2}" height="${height}" rx="7" class="node"/>
  <circle cx="34" cy="${top + 24}" r="13" class="badge"/>
  <text x="34" y="${top + 29}" class="number">${index + 1}</text>
  <text x="56" y="${top + 29}" class="label">${e(step.title)}</text>
  <text x="26" y="${top + 52}" class="detail">${step.lines.map((line, i) => `<tspan x="26" dy="${i ? 18 : 0}">${e(line)}</tspan>`).join('')}</text>
  ${arrow}
</g>`;
        top += height + (next ? gap : margin);
        return node;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${top}" viewBox="0 0 ${width} ${top}" role="img" aria-labelledby="${id}-title ${id}-description">
<title id="${id}-title">${e(diagram.label)}</title>
<desc id="${id}-description">${e(steps.map((step) => `${step.title}. ${step.detail}`).join(' '))}</desc>
<style>
  .node { fill: #f7f9f8; stroke: #9aaba6; }
  .badge { fill: #0d5c4d; }
  .number { fill: #fff; text-anchor: middle; font: 700 13px system-ui, sans-serif; }
  .label { fill: #172f2a; font: 700 16px system-ui, sans-serif; }
  .detail { fill: #344843; font: 400 13px system-ui, sans-serif; }
  .arrow { fill: none; stroke: #0d5c4d; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
</style>
${nodes.join('\n')}
</svg>
`;
}

function writeProjectDiagrams(directory, projects) {
    fs.mkdirSync(directory, { recursive: true });
    for (const project of projects) {
        fs.writeFileSync(path.join(directory, `${project.id}.svg`), renderDiagram(project));
    }
    console.log(`Generated ${projects.length} architecture diagrams.`);
}

if (require.main === module) {
    const { cv } = require('../src/cv-data');
    writeProjectDiagrams(path.resolve(__dirname, '../dist/assets/images/projects'), [...cv.projects, cv.backgroundProcessing]);
}

module.exports = { writeProjectDiagrams };
