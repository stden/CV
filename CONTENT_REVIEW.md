# Content & Confidentiality Review Checklist

Before merging or deploying updates to the public website, please review and approve the sanitised content below:

## 1. Employer & Technology Disclosure Approval
- **Employment summaries:** All employer entries (Kuehne+Nagel, Taxify/Bolt, Oracle, and earlier roles) have been rewritten to describe general engineering competencies and responsibilities only, without internal system names, architecture details, metrics, or proprietary implementations.
  - Please confirm whether the listed employer names, dates, locations, and high-level technology names (`Java`, `Spring Boot`, `RabbitMQ`, `PostgreSQL`, `Oracle Database`, `Docker`, `Kubernetes`, `Jenkins`, `GitLab`, `Node.js`, `TypeScript`, `Redis`) are approved for public display.
- **Additional technologies:** Items such as `Apache Kafka`, `AWS`, `Terraform`, and `Prometheus / Grafana` are categorised as **Additional professional** rather than claimed as core production deployments at a specific employer. Please confirm if any should be removed or recategorised.

## 2. Independent Projects & Architecture Diagrams
- All case studies and architecture diagrams on the public website and in all 6 PDF resumes are strictly based on:
  - Independent personal projects (`Messenger Archive & Semantic Search`)
  - Open-source public repositories (`EntityLocker`, `FunnyFileManager`, `RustShot`)
  - Generic educational reference patterns (`Transactional Outbox & Idempotent Event Consumer`, `Resilient Asynchronous Job Queue & Backpressure`)
- Confirm that none of your personal/open-source repositories contain employer-derived material before linking them.

## 3. Private Confidentiality Denylist (Optional Local / CI Check)
To avoid storing any confidential identifiers in the public repository:
- Create an untracked `.confidential-denylist` file locally (gitignored) with one sensitive term per line and run `npm run check:confidentiality`.
- Optionally add a `CONFIDENTIAL_DENYLIST` repository secret in GitHub Actions so CI checks every PR and push against private employer terms without exposing them in code or logs.

## 4. Profile Details & Publication Sign-off
- **English proficiency:** Kept as `Intermediate` from the original CV. Confirm if an updated level should be shown.
- **Timeline:** Preserved factual dates as previously published.
- **Optional recruiter settings (`data/cv.json` → `profile.availability`):** `showOpenToWork` is `false` by default; `relocation` and `workAuthorisation` are empty.
- **Git history notice:** Previous commits on `main` still contain earlier public CV content. Do not rewrite history without explicit authorisation; let us know if you want a repository-history scrub procedure prepared separately.
