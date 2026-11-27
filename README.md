# Denis Stepulenok — Engineering Portfolio & Data-Driven CV

Static engineering portfolio, independent architecture showcase, technology notes, and automated ATS-friendly PDF resume generator for **Denis Stepulenok** (`Senior Software Engineer | Java, Distributed Systems & AI Engineering`).

- **Production site:** https://stden.github.io/CV/
- **Repository:** https://github.com/stden/CV

## Confidentiality & NDA Policy

- Employer experience is presented strictly at a high-level competency and responsibility level—no internal project names, proprietary architectures, internal endpoints, hostnames, IP addresses, metrics, or credentials are published.
- All architecture diagrams and case studies are strictly based on independent personal projects, public open-source libraries, or educational reference patterns, each explicitly labelled with its origin.
- Every HTML page, SVG diagram, image (`photo.jpg`), CSS/JS asset, and generated PDF is verified automatically by `npm run check:confidentiality` (`scripts/check-confidentiality.js`).
- To check against private employer terms without committing them publicly, place one term per line in `.confidential-denylist` (gitignored) or configure the `CONFIDENTIAL_DENYLIST` secret in GitHub Actions.

## Architecture & Design Decisions

1. **Zero-Framework Static Generation (`data/cv.json` -> HTML + SVG + PDF):**
   - Single JSON source of truth (`data/cv.json`) drives `index.html`, 6 targeted CV web pages (`cv/*.html`), 20 technology detail pages (`tech/*.html`), 4 independent/educational architecture SVGs (`assets/images/projects/*.svg`), `sitemap.xml`, `robots.txt`, and 6 ATS-friendly A4 PDF resumes (`assets/pdf/*.pdf`).
2. **GitHub Pages `/CV/` Subpath Compatibility:**
   - All HTML/CSS asset and page references use strictly relative paths (`assets/...`, `../assets/...`, `tech/...`).
   - Local preview and Playwright tests mount the site under `/CV/` on local port `4174` (`scripts/serve-subpath.js`).
3. **Performance & Accessibility:**
   - Self-hosted variable `Inter` font (`assets/fonts/inter-latin-wght-normal.woff2`), light/dark theme toggle, keyboard-accessible interactive SVG diagrams, and full usability without JavaScript.
4. **ATS-Friendly Single-Column PDF Resumes:**
   - Generated reproducibly via headless Chromium / Playwright (`scripts/build-pdfs.js`) with selectable text, clickable links, standard ATS headings, and zero skill-percentage bars.

## Commands

```bash
npm ci                     # Install dependencies
npm run build              # Build SVG diagrams, tech pages, and HTML site
npm run build:pdfs         # Generate all 6 ATS-friendly PDFs + og-preview.png
npm run build:all          # Run build + build:pdfs
npm run check:confidentiality  # Verify NDA, URL allowlist, secret/PII, and EXIF/SVG rules
npm test                   # Rebuild static site, run static + PDF + confidentiality checks
npm run test:e2e           # Run Playwright E2E + Axe accessibility tests
npm run audit:lighthouse   # Run Lighthouse mobile & desktop audits on /CV/
npm run preview            # Serve locally on port 4174 under /CV/
```
