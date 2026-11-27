# Denis Stepulenok — Engineering portfolio and CV

Senior Software Engineer — Java & Distributed Systems. The static portfolio, seven public CVs, and independent architecture examples share one factual source. 🌐 [Published site](https://stden.github.io/CV/)

## 🛠️ Build and preview

Install Node.js 20.19 or later, Chromium for Playwright, and Poppler (`poppler-utils` on Debian and Ubuntu).

```sh
npm ci
npx playwright install chromium
npm run verify:projects
npm run build:all
npm test
npm run stage:public
CV_PUBLIC_ROOT=_site npm run test:e2e
CV_PUBLIC_ROOT=_site npm run preview
```

The preview mounts the verified artifact at [http://127.0.0.1:4174/CV/](http://127.0.0.1:4174/CV/). Set `CV_PREVIEW_PORT` for browser tests if port 4174 is occupied. The optional project verification command writes a local snapshot into ignored `.build/`. Pages use that snapshot during generation and show “Not verified” for unavailable CI evidence. HTML and SVG are reproducible for a fixed data and verification snapshot. PDF layout and text are tested across builds. Chromium adds generation timestamps to PDFs.

## 📄 Portfolio pages

The homepage highlights experience, core skills, selected work and contact details. A dedicated contact page is also available at `/contact/`. Full employment history is in `/experience/`, the technology catalogue in `/skills/`, independent project details in `/projects/`, and engineering diagrams in `/architecture/`. All seven CV versions remain available at `/cv/`.

## 🌍 Website languages

English uses the original paths under `/CV/`. Estonian, German and Russian live at `/CV/et/`, `/CV/de/` and `/CV/ru/`. The header links to equivalent pages and works with JavaScript disabled. An explicit choice is remembered for the next visit to the unqualified home URL. New visitors start in English regardless of their browser settings.

Edit verified facts in `data/cv.json`. Keep the corresponding messages in `data/locales/{en,et,de,ru}.json` aligned. Entries use shared role, project, diagram and technology identifiers. The generator validates required keys and interpolation placeholders before writing pages. Month labels change by locale while the dates stay fixed. Translation of the site has no bearing on the recorded language proficiency.

General resumes are available as `Denis-Stepulenok-CV-EN.pdf`, `Denis-Stepulenok-CV-ET.pdf`, `Denis-Stepulenok-CV-DE.pdf` and `Denis-Stepulenok-CV-RU.pdf`. Existing English PDF URLs and specialised variants are supported. The site and PDF templates use embedded Inter subsets for Latin, Latin Extended and Cyrillic. The publication gate scans all locale routes, static diagrams and PDF downloads. Include approved spellings and language variants in your private denylist where applicable.

## 🔎 Search and recruiting formats

The English portfolio is the canonical professional profile. The static build publishes these formats under `/CV/`.

| Format | Content |
| --- | --- |
| `resume.md`, `resume.txt` | Resume text, employment timeline and public source links |
| `candidate.json` | Public identity, recorded employment, languages and projects |
| `skills-evidence.json` | Stable skill identifiers, experience categories and source verification |
| `role-alignment.json`, `role-alignment/` | Six role profiles with supporting competencies and requirements to confirm |
| `llms.txt` | Optional index of public formats and sources |
| `articles/` | Independent technical notes with reproducible examples |

The explicit `publicProfile` selection in `data/cv.json` governs exports. Employment dates use month precision and retain the original date labels. Update `contentRevisionDate` when the published professional content changes. `npm run verify:projects` verifies the approved source, documentation and test paths at their public commits and records available CI results. Employment is identified as candidate-reported. Confirm the publication scope of employer claims separately. [Content review checklist](CONTENT_REVIEW.md)

The host-level crawl policy belongs at `https://stden.github.io/robots.txt` in the separate host repository. The project’s sitemap is under `/CV/`. The `llms.txt` index is an optional format for consumers that support it. Search visibility depends on crawlability and useful, indexable content. [Google guidance on AI search](https://developers.google.com/search/docs/appearance/ai-features)

### Local evaluation

Compare two confidentiality-checked public artifact directories. The tool uses `pdftotext` when PDFs are present.

```sh
node scripts/evaluate-public-cv.js --baseline /path/to/baseline/_site --improved /path/to/improved/_site
node scripts/evaluate-public-cv.js --prompts
```

The offline control counts discoverable facts and verifies local citations. To evaluate model outputs, use the same model settings and prompts against both reviewed public snapshots and score the saved responses with `--answers /path/to/local-answers.json`. The tool itself runs locally. Keep response records and reports outside staging, and review unsupported or unclassified claims and external citations manually.

These files support candidate, resume, skill, evidence, project and role lookup. An MCP server would add value for a specific integration that requires a tool interface or query filtering. The static portfolio requires no server or paid infrastructure.

## 🗃️ Edit and review factual content

Update [`data/cv.json`](data/cv.json) and regenerated public files together. Skills distinguish primary professional experience, additional professional experience, independent engineering and familiarity. Employer sections use publishable descriptions of responsibilities. A metric or achievement requires verified evidence and explicit publication approval. Review unfamiliar facts through [`CONTENT_REVIEW.md`](CONTENT_REVIEW.md).

Every architecture example and case study carries declared independent personal, public open-source, or independent educational provenance. Keep the profile's availability, relocation and work-authorisation fields disabled unless approved. The general Senior Software Engineer CV is the main download. The comprehensive CV and existing variant URLs remain available.

## 🛡️ Confidentiality gate

🔍 `npm run stage:public` copies the explicit manifest to an isolated directory, checks its actual files and links, and replaces `_site/` after validation. The manifest includes public HTML, CSS, JavaScript, diagrams, fonts, images, sitemaps, public resume and evidence formats, and all public PDF versions. The scanner checks provenance, file paths, text, image metadata, and PDF text, metadata, embedded links and active content. Diagnostics report category codes and counts.

🔒 Keep private terms one per line in `.private/confidential-denylist.txt`. An alternate local file can be selected with `CONFIDENTIAL_DENYLIST_FILE` or `--denylist`. Trusted main-branch workflow runs can use the `CONFIDENTIAL_DENYLIST` secret. Keep the list out of repository files and public artifacts. To recheck an existing staged bundle, run `npm run check:confidentiality -- --artifact-root _site`.

Automated checks complement the publication review. Review the meaning of every employer reference, the evidence for public claims and the exact staged output before approving publication.

## 📝 Prepare a private application

Run `npm run cv:job -- ./vacancies/example.json` with a local JSON, Markdown, text file or a permitted public HTTPS vacancy URL. Structured JSON can record the employer, title, source, description, required and preferred technologies, competencies, location, languages, employment type, deadlines and salary information supplied by the posting. The [fictional fixture](tests/fixtures/vacancy-example.json) shows the format.

The command compares the posting with verified evidence, reorders relevant experience and writes seven files in a new ignored `applications/` folder. These include `resume.pdf`, `resume.html`, the cover letter, normalized vacancy, match report, interview preparation and recruiter questions. Linked job descriptions are treated as data. Use a saved local description if retrieval is unavailable. Review the cover letter and items marked for confirmation before sending an application.

## ✅ Release approval

**Pages currently uses branch publishing.** GitHub can serve files from `main` independently of the workflow, so keep publication changes in the PR until the source can be migrated with the owner's approval. The workflow does not change repository settings. [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

With Pages set to **GitHub Actions**, a maintainer reviews the exact staged content and runs **Validate and approve public portfolio** on `main` with its full commit SHA in `approved_commit`. CI stages the committed generated site and PDFs from that SHA and validates the exact bundle used by the deploy job. PR validation also rebuilds from source and checks its output. The deploy job uses the `github-pages` environment. Configure required environment reviewers where available. A normal push or PR runs validation. [Deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
