import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './lib/content.mjs';
import { renderDiagramSvg } from './lib/diagram.mjs';

// Writes one SVG per architecture diagram, from content/architecture.json.
export function buildDiagrams(architecture, outputRoot = repoRoot) {
  const directory = join(outputRoot, 'assets/images/projects');
  mkdirSync(directory, { recursive: true });
  return architecture.diagrams.map((diagram) => {
    const relativePath = `assets/images/projects/${diagram.id}.svg`;
    writeFileSync(join(outputRoot, relativePath), renderDiagramSvg(diagram));
    return relativePath;
  });
}
