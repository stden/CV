# Denis Stepulenok — Engineering Portfolio & Recruitment Platform

Static engineering portfolio, independent architecture showcase, technology notes, automated ATS-friendly PDF resume generator, and private vacancy application toolkit for **Denis Stepulenok** (`Senior Software Engineer — Java & Distributed Systems`).

- **Production site:** https://stden.github.io/CV/
- **Repository:** https://github.com/stden/CV

## Confidentiality & NDA Policy

- Employer experience is presented strictly at a high-level competency and responsibility level—no internal project names, proprietary architectures, internal endpoints, hostnames, IP addresses, unpublished metrics, or credentials are published.
- All case studies and architecture diagrams originate exclusively from independent personal projects, public open-source libraries (`stden/EntityLocker`), or independent educational reference patterns explicitly labelled as unrelated to any employer system.
- `npm run check:confidentiality` (`scripts/check-confidentiality.js`) scans every public HTML, SVG, JSON, JS, CSS, Markdown, text, XML, image, and PDF file (including PDF metadata and embedded links) with sanitised error reporting that never echoes sensitive values.
- Private vacancy outputs (`applications/`, `vacancies/`) and `.confidential-denylist` are gitignored and blocked from staged `_site/` deployment artifacts via `--site-dir _site`.

## Architecture & Design Decisions

1. **Zero-Framework Static Generation (`data/cv.json` -> HTML + SVG + PDF):**
   - Single JSON source of truth (`data/cv.json`) plus build-time GitHub metadata (`data/repo-metadata.json`) drives `index.html`, the general CV (`cv/general.html`) and six targeted CV web pages (`cv/*.html`), 20 technology detail pages (`tech/*.html`), 4 architecture SVGs (`assets/images/projects/*.svg`), `sitemap.xml`, `robots.txt`, and 7 ATS-friendly A4 PDF resumes (`assets/pdf/*.pdf`).
   - The general **Senior Software Engineer — Java & Distributed Systems** CV (`Denis-Stepulenok-Senior-Software-Engineer.pdf`) is the primary download.
2. **Evidence-Based 4-Tier Skills Model:**
   - Skills are organised strictly by practical depth and evidence: **Primary professional**, **Additional professional**, **Independent projects**, and **Familiarity** (no fabricated percentages).
3. **GitHub Pages `/CV/` Subpath Compatibility:**
   - All HTML/CSS asset and page references use strictly relative paths (`assets/...`, `../assets/...`, `tech/...`).
   - Local preview and Playwright tests mount the site under `/CV/` on local port `4174` (`scripts/serve-subpath.js`).
4. **Performance & Accessibility:**
   - Self-hosted variable `Inter` font (`assets/fonts/inter-latin-wght-normal.woff2`), light/dark theme toggle, keyboard-accessible interactive SVG diagrams, progressive disclosure via native `<details>`, and full usability without JavaScript.
5. **ATS-Friendly Single-Column PDF Resumes:**
   - Generated reproducibly via headless Chromium / Playwright (`scripts/build-pdfs.js`) with selectable text, embedded fonts, clickable links, and standard ATS headings.

## Project Structure

- `data/cv.json` — Verified source of truth for profile, experience, case studies, repositories, architecture diagrams, 4-tier skills, technologies, and CV variants.
- `data/repo-metadata.json` — Build-time verified repository activity and CI status (`npm run sync:repos`).
- `scripts/build-project-diagrams.js` — Generates standalone and inline interactive SVG diagrams.
- `scripts/build-tech-pages.js` — Generates the 20 `tech/*.html` pages.
- `scripts/build-site.js` — Generates `index.html`, `cv/index.html`, `cv/*.html`, `sitemap.xml`, `robots.txt`, and `og-preview.svg`.
- `scripts/build-pdfs.js` — Generates the 7 public A4 PDFs in `assets/pdf/` and `assets/images/og-preview.png`.
- `scripts/sync-repo-metadata.js` — Refreshes verified GitHub repository metadata at build time (no client-side GitHub API calls).
- `scripts/build-job-cv.js` — Local-only private application package generator (`npm run cv:job`).
- `scripts/check-build.js` — Static validator checking data rules, relative paths, SEO/JSON-LD, `pdfinfo` metadata/page counts, `pdffonts` embedding, and `pdftotext` extraction.
- `scripts/check-confidentiality.js` — Automated NDA, URL allowlist, secret/PII, filename, PDF metadata/link, EXIF/PNG/SVG metadata, and `--site-dir` bundle verifier.
- `tests/e2e.spec.js` — Playwright E2E, 6-viewport responsiveness, JS-disabled, and `@axe-core/playwright` WCAG 2.1 AA suite.
- `tests/job-cv.unit.js` & `tests/confidentiality.unit.js` — Unit tests for vacancy matching, factual immutability, and sanitised confidentiality rules.

## Commands

```bash
npm ci                         # Install dependencies
npm run sync:repos             # Refresh verified GitHub CI/activity metadata
npm run build                  # Build SVG diagrams, tech pages, and HTML site
npm run build:pdfs             # Generate public A4 PDFs and og-preview.png
npm run build:all              # Run build + build:pdfs
npm test                       # Rebuild site, validate HTML/PDF/confidentiality, and run unit tests
npm run check:confidentiality  # Verify NDA, URL allowlist, secret/PII, and metadata rules
npm run test:e2e               # Run Playwright E2E + Axe accessibility tests
npm run audit:lighthouse       # Run Lighthouse mobile & desktop audits on /CV/
npm run preview                # Serve locally on port 4174 under /CV/
```

## Private Vacancy Application Workflow (`npm run cv:job`)

Generate a complete, private 7-file application package under gitignored `applications/<slug>-*/` from a local JSON file, Markdown/text description, or HTTPS URL:

```bash
npm run cv:job -- ./vacancies/example-java-backend.json
npm run cv:job -- ./vacancies/example-java-backend.md
npm run cv:job -- --url https://www.linkedin.com/jobs/view/1234
```

Example vacancy JSON:

```json
{
  "company": "Example Tech",
  "jobTitle": "Senior Java Backend Engineer",
  "url": "https://www.linkedin.com/jobs/view/1234",
  "location": "Tallinn, Estonia",
  "languageRequirements": "English B2+/C1",
  "requiredTechnologies": ["Java", "Spring Boot", "PostgreSQL", "RabbitMQ"],
  "preferredTechnologies": ["Apache Kafka", "Kubernetes"],
  "requiredCompetencies": ["Distributed systems and idempotency"],
  "description": "Senior Java Backend Engineer building Spring Boot and PostgreSQL integration services."
}
```

Each generated folder under `applications/` contains:
- `resume.pdf` & `resume.html` (`noindex, nofollow`, reordered verified skills/bullets only; never fabricates skills or alters dates/titles/languages)
- `cover-letter.md`
- `vacancy.json`
- `match-report.md` (5-category evidence breakdown: Strong, Partial, Familiarity, Missing, Requires confirmation — no speculative match scores)
- `interview-preparation.md` (technical topics, exercises, STAR outlines with NDA generic-framing reminders, and manager questions)
- `questions-for-recruiter.md`

## Deployment & Approval

`.github/workflows/ci-pages.yml` pins all third-party actions to commit SHAs, builds and validates all artifacts, stages an allowlisted `_site/` directory, runs `node scripts/check-confidentiality.js --site-dir _site`, and runs Playwright + Axe accessibility checks. See `CONTENT_REVIEW.md` for deployment-source gating recommendations and items requiring sign-off before publication.
