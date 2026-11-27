# Denis Stepulenok — Engineering Portfolio & Data-Driven CV

Static engineering portfolio, interactive architecture showcase, technology notes, and automated ATS-friendly PDF resume generator for **Denis Stepulenok** (`Senior Software Engineer | Java, Distributed Systems & AI Engineering`).

- **Production site:** https://stden.github.io/CV/
- **Repository:** https://github.com/stden/CV

## Architecture & Design Decisions

1. **Zero-Framework Static Generation (`data/cv.json` -> HTML + SVG + PDF):**
   - Removed legacy Gulp 5, Sass, Bootstrap 3, jQuery 1.11.3, Font Awesome 4, and IE8/IE9 shims.
   - Single JSON source of truth (`data/cv.json`) drives the main portfolio (`index.html`), 6 targeted CV web pages (`cv/*.html`), 20 technology detail pages (`tech/*.html`), 4 architecture SVGs (`assets/images/projects/*.svg`), `sitemap.xml`, `robots.txt`, and 6 ATS-friendly A4 PDF resumes (`assets/pdf/*.pdf`).
2. **GitHub Pages `/CV/` Subpath Compatibility:**
   - All HTML/CSS asset and page references are strictly relative (`assets/...`, `../assets/...`, `tech/...`) with zero root-relative `/...` URLs.
   - Local preview and Playwright tests mount the repository at `http://127.0.0.1:4174/CV/` (`scripts/serve-subpath.js`) so subpath regressions fail immediately.
3. **Performance & Accessibility First:**
   - Self-hosted variable `Inter` font (`@fontsource-variable/inter` -> `assets/fonts/inter-latin-wght-normal.woff2`) eliminates external font/CDN blocking.
   - Semantic HTML5, accessible light/dark theme toggle (`[data-theme="dark"]`), keyboard-accessible interactive SVG architecture diagrams (`role="group"` + `role="button"` + component inspector), and full usability with JavaScript disabled.
4. **ATS-Friendly Single-Column PDF Resumes:**
   - Generated reproducibly via headless Chromium / Playwright (`scripts/build-pdfs.js`) with selectable text, clickable links, standard ATS headings, and zero skill-percentage bars.

## Project Structure

- `data/cv.json` — Single verified source of truth for profile, experience, case studies, GitHub repos, architecture diagrams, skills, technologies, and CV variants.
- `scripts/build-project-diagrams.js` — Generates standalone and inline interactive SVG diagrams.
- `scripts/build-tech-pages.js` — Generates the 20 `tech/*.html` pages.
- `scripts/build-site.js` — Generates `index.html`, `cv/index.html`, `cv/*.html`, `sitemap.xml`, `robots.txt`, and `og-preview.svg`.
- `scripts/build-pdfs.js` — Generates all 6 A4 PDF resumes in `assets/pdf/` and `assets/images/og-preview.png`.
- `scripts/check-build.js` — Static validator checking data rules, relative paths, missing assets, SEO/JSON-LD, `pdfinfo` page counts, and `pdftotext` extraction.
- `scripts/serve-subpath.js` — Local `/CV/` subpath HTTP server for preview and testing.
- `scripts/run-lighthouse.js` — Runs headless Lighthouse mobile and desktop audits against `/CV/`.
- `tests/e2e.spec.js` — Playwright E2E, 6-viewport responsiveness, JS-disabled, and `@axe-core/playwright` WCAG 2.1 AA suite.

## Commands

```bash
npm ci                    # Install dependencies
npm run build             # Build SVG diagrams, tech pages, and HTML site
npm run build:pdfs        # Generate all 6 ATS-friendly PDFs + og-preview.png
npm run build:all         # Run build + build:pdfs
npm test                  # Rebuild static site and run static + PDF validation
npm run test:e2e          # Run Playwright E2E + Axe accessibility tests
npm run audit:lighthouse  # Run Lighthouse mobile & desktop audits on /CV/
npm run preview           # Serve locally at http://127.0.0.1:4174/CV/
```

## Updating Content & Availability

Edit `data/cv.json`, then run `npm run build:all && npm test`:
- To show an open-to-work / relocation / work-authorisation banner in the hero section, update `profile.availability.showOpenToWork` to `true` and populate `statusText`, `relocation`, and `workAuthorisation`.

## Deployment

`.github/workflows/ci-pages.yml` builds, generates PDFs, runs `npm test` and `npm run test:e2e`, and stages a clean `_site/` bundle on every push/PR to `main`. Built output files remain committed so existing GitHub Pages branch publishing works immediately; switching **Settings -> Pages -> Source** to **GitHub Actions** enables automated `actions/deploy-pages@v4` deployment from validated CI artifacts.
