# Denis Stepulenok — CV

Static engineering portfolio and CV, published at https://stden.github.io/CV/.

- `index.html`: the portfolio (overview, experience, projects, skills, architecture, education, contact).
- `cv/<version>/`: six targeted CVs, each with a PDF in `downloads/`.
- `projects/<id>/`: case studies for the three selected projects.
- `tech/*.html`: one page per technology listed in the skills.

Every page is generated from the JSON files in `content/`. Nothing is written by hand in HTML.

## Layout

| Path | Contents |
| --- | --- |
| `content/` | The source of truth: `cv.json` (profile, experience, projects, skills), `variants.json` (targeted CVs), `architecture.json` (diagrams and concepts), `github-projects.json` (selected public repositories), `site.json` (URL, date, optional availability), `technologies.json` (technology pages). |
| `scripts/` | Build code. `build.mjs` is the entry point; `lib/` holds validation, the page frame and the static server; `render/` holds one renderer per page type. |
| `assets/` | Hand-written CSS (`css/site.css`), the small progressive-enhancement script (`js/site.js`), fonts, images and SVG diagrams (generated). |
| `downloads/` | The six PDF resumes (generated). |
| `tests/` | Unit tests for the content, the built pages and the PDFs (`node:test`). |
| `e2e/` | Browser tests (Playwright): navigation, layout at six widths, theme, copy button, downloads, accessibility, console errors. |

## Requirements

- Node.js 22.12 or newer (CI uses 24; see `mise.toml`).
- Chromium for Playwright: `npx playwright install chromium`. The PDF build and the browser tests use it.
- `poppler-utils` (`pdfinfo`, `pdftotext`) for the PDF tests. CI installs it.

## Build and test

```bash
npm ci
npm run build          # validate content, write pages, diagrams, sitemap, robots.txt and PDFs
npm run build:html     # the same without the PDFs (faster)
npm run test:unit      # content validation, built pages, PDF checks
npm run test:e2e       # browser tests against the site served under /CV/
npm run serve          # http://127.0.0.1:4173/CV/
```

`npm run build` must run before the tests. The browser tests start the server themselves.

## Editing the CV

1. Change facts in `content/cv.json` only. Keep employment facts exactly as they are in the source CV.
2. Each skill has an `evidence` value: `professional` (used in a role), `personal` (used in a personal or public project) or `other` (listed, not yet backed by a role or project). Use `other` when in doubt. The site shows the evidence as a label, never as a percentage.
3. To change a targeted CV, edit `content/variants.json`: its focus tags, skill groups, projects and how many highlights it keeps. The facts stay the same across versions.
4. Run `npm run build`. Validation stops the build when a reference is wrong, a skill percentage appears, or a duplicate id exists.
5. Commit the regenerated HTML, SVG and PDF files together with the content change. The CI job checks that the committed HTML and SVG match a fresh build.

## Deployment

GitHub Pages publishes the `main` branch from the repository root (legacy source, no build step). That is why the generated files are committed. To publish a change:

1. Run `npm run build` and the tests.
2. Commit the content and the regenerated files.
3. Merge the pull request into `main`. Pages republishes within a few minutes.

Pages currently publishes `main` without waiting for the CI job. To make deployment depend on validation, switch Pages to the GitHub Actions source in the repository settings and add a deployment job. Until then the CI job is a required check only if branch protection makes it one.

## Accessibility and performance

- Keyboard navigation, visible focus, skip link, reduced-motion support, and text labels next to every colour-coded mark.
- The page works without JavaScript. The theme toggle and the copy button appear only when the script runs.
- Lighthouse results are recorded in the pull request, not in the repository. To measure again:

```bash
npm run serve &
npx --yes lighthouse@13.6.0 http://127.0.0.1:4173/CV/ --preset=desktop --chrome-flags="--headless=new --no-sandbox"
```

## Architecture decisions

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the reasoning behind the stack, the content model and the deployment model.

## Contact

Email, LinkedIn, GitHub and Telegram are listed on the site. The phone number from the original CV is not published.
