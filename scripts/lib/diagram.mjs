// Draws the architecture diagrams as SVG. The same numbers are used for the
// picture and for the height attribute of the <img> on the page, so they live here.

const WIDTH = 400;
const BOX_X = 20;
const BOX_WIDTH = 360;
const BOX_HEIGHT = 62;
const GAP = 28;
const MARGIN = 20;

export function svgHeight(stepCount) {
  return 2 * MARGIN + stepCount * BOX_HEIGHT + (stepCount - 1) * GAP;
}

function escapeXml(text) {
  return String(text)
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

export function renderDiagramSvg(diagram) {
  const count = diagram.components.length;
  const steps = diagram.components.map((step, index) => renderStep(step, index, count)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${svgHeight(count)}" role="img">
  <title>${escapeXml(diagram.label)}</title>
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="9" orient="auto">
      <path d="M0,0 L5,9 L10,0" fill="#2f5d8a"/>
    </marker>
  </defs>
  <style>
    .box { fill: #ffffff; stroke: #2f5d8a; stroke-width: 1.5; }
    .title { fill: #1f3f5f; font: 700 15px Inter, Arial, sans-serif; }
    .detail { fill: #4a5566; font: 400 12.5px Inter, Arial, sans-serif; }
    .link { stroke: #2f5d8a; stroke-width: 1.5; marker-end: url(#arrow); }
  </style>
${steps}</svg>
`;
}
