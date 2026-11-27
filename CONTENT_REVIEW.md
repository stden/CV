# Content & Confidentiality Review Checklist

Before merging or deploying updates to the public website, please review and approve the sanitised items below.

## 1. NDA & Confidentiality Audit Report (Sanitised)
- **Public surface checked:** `index.html`, `cv/*.html`, `tech/*.html`, `assets/images/*.svg`, `assets/images/*.{jpg,png}`, `assets/css/*`, `assets/js/*`, `assets/pdf/*.pdf`, `data/cv.json`, `data/repo-metadata.json`, `README.md`, `sitemap.xml`, and `robots.txt`.
- **Checks enforced automatically (`npm run check:confidentiality`):**
  - Zero private IPs, internal hostnames, credentials, connection strings, phone numbers, or ticket-like identifiers.
  - Strict URL hostname allowlist (`stden.github.io`, `github.com`, `www.linkedin.com`, `t.me`, official employer/tech domains) across HTML, JSON, Markdown, SVG, and embedded PDF `/URI` links; unapproved hosts are reported with redacted messages.
  - Zero JPEG EXIF/APP/comment markers and clean PNG metadata chunks.
  - Zero `<metadata>` or comment blocks in SVGs.
  - Case study & architecture diagram provenance verified (`personal`, `open-source`, or `educational-example` explicitly labelled as unrelated to any employer system).
  - Private `applications/` and `vacancies/` directories are gitignored, rejected if tracked in Git, and blocked from staged `_site/` deployment bundles via `--site-dir`.

## 2. Deployment Gate & Git History Findings
- **GitHub Pages source setting (`legacy` branch publishing):**
  - Currently GitHub Pages is configured to publish directly from `main` (`build_type: legacy`). Branch-based publishing can deploy commits pushed directly to `main` without waiting for `.github/workflows/ci-pages.yml` validation.
  - **Recommendation (do not change without authorisation):** Switch GitHub repository **Settings -> Pages -> Source** to **GitHub Actions** and enable branch protection on `main` requiring the `validate` workflow status check before merge.
- **Git history status:**
  - `main` was previously compressed to a clean baseline history (currently 2 commits on `main`, no earlier unredacted CV commits in the active branch graph). Note that GitHub may still cache historical Pull Request views/refs server-side; do not rewrite Git history or change repository visibility without explicit authorisation.

## 3. Factual Claims Requiring Confirmation
Please confirm or update each item before public merge:
1. **Employer summaries & high-level technologies:** Confirm that listing Kuehne+Nagel, Taxify (now Bolt), Oracle, dates, locations, and high-level stacks (`Java`, `Spring Boot`, `RabbitMQ`, `PostgreSQL`, `Oracle Database`, `Docker`, `Node.js`, `TypeScript`, `Redis`) at a generic competency level complies with all employer agreements.
2. **Skill depth confirmations (`Familiarity` vs `Additional` vs `Primary`):**
   - `Apache Kafka`: currently categorised as **Familiarity** (`Explored; production depth requires confirmation`). Confirm whether verified professional usage supports upgrading it.
   - `Kubernetes / Helm`: currently categorised as **Additional professional** (team-level container deployment). Confirm practical depth (writing manifests/Helm charts vs using existing cluster deployments).
   - `AWS`, `Terraform`, `Prometheus / Grafana`, `Go (Gin, gRPC)`: currently categorised as **Familiarity**. Confirm if any have deeper verified production evidence.
3. **English proficiency level:** `data/cv.json` preserves `Intermediate` from the original CV. Confirm whether your current working level (e.g. `B2` / `Upper-Intermediate` or `C1`) should be updated.
4. **Optional verified measurable achievements (`verifiedAchievements` in `data/cv.json`):** Currently empty `[]` on all roles to avoid fabricating metrics. If you have explicit, NDA-safe, non-confidential outcome statements (e.g., build/test efficiency or operational automation improvements), add them to `experience[].verifiedAchievements`.
5. **Public `cv/wise.html` vs generic backend CV:** Currently `cv/wise.html` and `Denis-Stepulenok-Wise-Senior-Java-Engineer.pdf` remain preserved at their existing URLs so no links break, updated with NDA-safe wording and zero implied fintech domain experience. Confirm whether you want to keep `cv/wise.html` or redirect/replace it with a generic backend CV in a follow-up PR.
6. **Optional recruiter availability flags (`profile.availability`):** `showOpenToWork` is `false` by default; `relocation` and `workAuthorisation` are empty. Confirm before enabling.
7. **Public repository confidentiality:** Confirm that linked repositories (`EntityLocker`, `JPA2`, `FunnyFileManager`, `RustShot`, `SonarQubeChecker`, `pythorust_tg`) contain no employer-derived material.

## 4. Private Confidentiality Denylist (Optional Local / CI Check)
- Place one private employer/internal term per line in `.confidential-denylist` (gitignored) and run `npm run check:confidentiality`.
- Optionally store a comma- or newline-separated list in the `CONFIDENTIAL_DENYLIST` GitHub Actions repository secret; CI logs never print matched terms.
