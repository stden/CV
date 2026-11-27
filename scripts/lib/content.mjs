import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const defaultContentDir = join(repoRoot, 'content');

const FILES = {
  cv: 'cv.json',
  variants: 'variants.json',
  architecture: 'architecture.json',
  github: 'github-projects.json',
  site: 'site.json',
  technologies: 'technologies.json'
};

export function loadContent(contentDir = defaultContentDir) {
  const content = {};
  for (const [key, file] of Object.entries(FILES)) {
    content[key] = JSON.parse(readFileSync(join(contentDir, file), 'utf8'));
  }
  return content;
}
