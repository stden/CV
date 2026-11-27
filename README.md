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
   - Single JSON source of truth (`data/cv.json`) drives `index.html`, the general CV and six targeted CV web pages (`cv/*.html`), 20 technology detail pages (`tech/*.html`), 4 independent/educational architecture SVGs (`assets/images/projects/*.svg`), `sitemap.xml`, `robots.txt`, and 7 ATS-friendly A4 PDF resumes (`assets/pdf/*.pdf`). The general Senior Software Engineer CV is the primary download.
2. **GitHub Pages `/CV/` Subpath Compatibility:**
   - All HTML/CSS asset and page references use strictly relative paths (`assets/...`, `../assets/...`, `tech/...`).
   - Local preview and Playwright tests mount the site under `/CV/` on local port `4174` (`scripts/serve-subpath.js`).
3. **Performance & Accessibility:**
   - Self-hosted variable `Inter` font (`assets/fonts/inter-latin-wght-normal.woff2`), light/dark theme toggle, keyboard-accessible interactive SVG diagrams, and full usability without JavaScript.
4. **ATS-Friendly Single-Column PDF Resumes:**
   - Generated reproducibly via headless Chromium / Playwright (`scripts/build-pdfs.js`) with selectable text, clickable links, standard ATS headings, and zero skill-percentage bars.

## Project Structure

- `data/cv.json` — Single verified source of truth for profile, experience, case studies, GitHub repos, architecture diagrams, skills, technologies, and CV variants.
- `scripts/build-project-diagrams.js` — Generates standalone and inline interactive SVG diagrams.
- `scripts/build-tech-pages.js` — Generates the 20 `tech/*.html` pages.
- `scripts/build-site.js` — Generates `index.html`, `cv/index.html`, `cv/*.html`, `sitemap.xml`, `robots.txt`, and `og-preview.svg`.
- `scripts/build-pdfs.js` — Generates the public A4 PDFs in `assets/pdf/` and `assets/images/og-preview.png`.
- `scripts/build-job-cv.js` — Generates private vacancy-specific HTML and PDF CVs under `applications/`.
- `scripts/check-build.js` — Static validator checking data rules, relative paths, missing assets, SEO/JSON-LD, `pdfinfo` page counts, and `pdftotext` extraction.
- `scripts/check-confidentiality.js` — Automated NDA, URL allowlist, secret/PII, and EXIF/SVG metadata verifier.
- `scripts/serve-subpath.js` — Local `/CV/` subpath HTTP server for preview and testing.
- `scripts/run-lighthouse.js` — Runs headless Lighthouse mobile and desktop audits against `/CV/`.
- `tests/e2e.spec.js` — Playwright E2E, 6-viewport responsiveness, JS-disabled, and `@axe-core/playwright` WCAG 2.1 AA suite.

## Commands

```bash
npm ci                         # Install dependencies
npm run build                  # Build SVG diagrams, tech pages, and HTML site
npm run build:pdfs             # Generate the public PDFs and og-preview.png
npm run build:all              # Run build + build:pdfs
npm run check:confidentiality  # Verify NDA, URL allowlist, secret/PII, and EXIF/SVG rules
npm test                       # Rebuild static site, run static + PDF + confidentiality checks and unit tests
npm run test:e2e               # Run Playwright E2E + Axe accessibility tests
npm run audit:lighthouse       # Run Lighthouse mobile & desktop audits on /CV/
npm run preview                # Serve locally on port 4174 under /CV/
```

## Updating Content & Availability

Edit `data/cv.json`, then run `npm run build:all && npm test`:
- To show an open-to-work / relocation / work-authorisation banner in the hero section, update `profile.availability.showOpenToWork` to `true` and populate `statusText`, `relocation`, and `workAuthorisation`.

## Build a private CV for a vacancy

Create a local JSON selection with the vacancy URL, a short factual summary, an existing profile slug, and relevant skill names and project IDs from `data/cv.json`. The renderer keeps the sourced timeline and reuses the existing PDF format.

```json
{
  "slug": "example-java-backend-1234",
  "source": "https://www.linkedin.com/jobs/view/1234",
  "profile": "senior-java",
  "summary": "Java backend engineer with Spring Boot and asynchronous messaging experience.",
  "skills": ["Java (6–25)", "Spring Boot", "PostgreSQL", "RabbitMQ"],
  "projects": ["entity-concurrency-locking", "messenger-archive-search"]
}
```

Run `npm run cv:job -- /path/to/vacancy.json`. The PDF, self-contained HTML and selection file are written to a new local folder under `applications/`. Git ignores this directory and the Pages workflow packages the public site assets.

## Deployment

`.github/workflows/ci-pages.yml` builds, generates PDFs, runs `npm test`, `npm run check:confidentiality`, and `npm run test:e2e`, and stages a clean `_site/` bundle on every push/PR to `main`. Built output files remain committed so existing GitHub Pages branch publishing works immediately; switching **Settings -> Pages -> Source** to **GitHub Actions** enables automated `actions/deploy-pages@v4` deployment from validated CI artifacts.

## Languages

The site is available in English (default), Estonian, German and Russian. The English pages keep their URLs; the other languages live in `/et/`, `/de/` and `/ru/`.

- **Source of facts.** `data/cv.json` is the only source of verified facts. Dates, employers, technology names, links and contact details are never translated.
- **Translations.** `data/locales/<code>.json` holds the human-readable text, keyed by stable identifiers: UI strings, role summaries and responsibilities by role id, skill groups and names, repository descriptions, case studies, and the variant labels.
- **Validation.** `npm run build` stops with a list of every missing or mismatched key (for example, a responsibility added to `cv.json` without its translation). Nothing falls back silently to English.
- **Translated pages.** Homepage, experience, projects, skills and the CV index. Architecture, the targeted CV pages and the technology pages are English only; their language switch leads to the locale homepage.
- **Resumes.** `assets/pdf/Denis-Stepulenok-CV-<EN|ET|DE|RU>.pdf`, generated from the same data and print stylesheet as the web page. Cyrillic and Latin Extended letters use the Inter subsets in `assets/fonts/`.
- **Language switch.** A link list in the header (and in the menu on phones). It works without JavaScript. A chosen language is remembered in `localStorage`; a later visit to another language shows a link to it, and never redirects.
- **SEO.** Each translated page has `lang`, its own canonical URL, `hreflang` links for all four languages and `x-default` pointing to the English page. The sitemap lists the same alternates.

To add a language: add its entry to `LOCALES` in `scripts/lib/i18n.js`, add `data/locales/<code>.json` with every key, then `npm run build`. The validator lists anything still missing.
