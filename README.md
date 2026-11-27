# Denis Stepulenok — Engineering portfolio

[Live portfolio](https://stden.github.io/CV/) · [Content review](CONTENT_REVIEW.md)

The site presents Denis Stepulenok’s Java backend, distributed systems and integration experience. It includes engineering case studies, technology reference pages, a general CV and targeted CVs for Java backend, distributed systems, fintech integrations, AI/MCP and Wise.

## Run locally

Use Node.js 22 or later. Install Poppler (`poppler-utils` on Debian/Ubuntu) for PDF validation.

```sh
npm ci
npx playwright install chromium
npm run build
npm test
npm run test:e2e
npm run preview
```

Open [the local GitHub Pages preview](http://127.0.0.1:4173/CV/). On a Linux CI runner, install Chromium system dependencies with `npx playwright install --with-deps chromium`. To iterate on HTML and CSS without regenerating the PDFs, use `npm run build:html` and then `npm run pdf` when the pages are ready.

## Update content

- [`data/cv.json`](data/cv.json) holds the professional history, public contact details, case studies, education and links. Optional availability, relocation and work-authorisation fields are off by default.
- [`data/skills.json`](data/skills.json) is the shared skills DSL. Each entry has a stable ID, a group, evidence references and an optional technology page. The portfolio and the CV versions read this source without using proficiency percentages.
- [`data/variants.json`](data/variants.json) controls how each CV prioritises the shared skills and projects. Employment dates and employers come from the same CV source.
- [`CONTENT_REVIEW.md`](CONTENT_REVIEW.md) records claims and details that need confirmation before publication.

For each skill, keep the ID stable and cite the strongest available evidence. An `experience` or `project` reference uses the corresponding ID in `data/cv.json`. A `repository` or `cv` reference uses a public HTTPS URL. The optional `techPage` points to an existing technology page.

```json
{
  "id": "java",
  "name": "Java",
  "group": "core",
  "evidence": [{ "type": "experience", "ref": "oracle" }],
  "techPage": "tech/java.html"
}
```

### What GitHub supports

GitHub renders Markdown in repositories and profile READMEs and lets a profile pin up to six repositories or gists. Repository language statistics come from Linguist’s analysis of files. They describe the repositories and do not measure a person’s proficiency. [Profile README documentation](https://docs.github.com/en/account-and-profile/how-tos/profile-customization/managing-your-profile-readme) · [Pinned items](https://docs.github.com/en/account-and-profile/how-tos/profile-customization/pinning-items-to-your-profile) · [Repository languages documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-repository-languages)

The skills DSL is project data. Jekyll can read JSON, YAML, CSV and TSV from `_data`. This repository uses a Node.js build so the same data can produce the site and printable CVs. Use `npm run skills:markdown` to export a GitHub-compatible Markdown view. [Jekyll data files](https://jekyllrb.com/docs/datafiles/) · [Custom GitHub Pages builds](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)

## How the build works

The Node.js build renders static HTML to `dist/`, copies the local stylesheet, optional interaction script and font, and generates technology pages, SVG diagrams and a sitemap. The portfolio and CV text are readable with JavaScript disabled. Playwright prints the CV pages as selectable-text A4 PDFs. The PDF layout uses a separate stylesheet for predictable typography and page breaks.

`npm test` checks static links, skills evidence references, generated metadata and PDF text extraction. The Playwright suite checks the website under `/CV/` at desktop and mobile widths, including navigation, themes, contact actions, downloads and accessibility.

## Publish to GitHub Pages

Open a pull request and inspect the `portfolio-preview` artifact from a passing **Portfolio** workflow. The artifact contains the same `dist/` directory used for deployment. The workflow publishes approved changes on `main` after validation when Pages uses **GitHub Actions** as its source.

The existing site uses **Deploy from a branch**. For the one-time migration, a repository maintainer selects **Settings → Pages → Build and deployment → GitHub Actions** before the portfolio PR is merged. The next successful run on `main` publishes to the existing [`/CV/` URL](https://stden.github.io/CV/). The workflow leaves repository settings and Pages permissions to the maintainer. [Publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
