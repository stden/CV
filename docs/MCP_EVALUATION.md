# Optional Model Context Protocol (MCP) Integration Evaluation

> Recommendation: **Keep the portfolio 100% static on GitHub Pages** (`candidate.json`, `skills-evidence.json`, `role-alignment.json`, `resume.md`, `resume.txt`, `llms.txt`, HTML, and PDFs). Do **not** deploy a hosted server or paid infrastructure.

## 1. Candidate Tool Surface Considered

If an MCP interface were exposed for external recruitment or research agents, its read-only surface would map directly to six deterministic read operations over the existing allowlisted public artifacts:

| Proposed MCP Tool | Backing Static Artifact | Added Value Over Static Fetch? |
| --- | --- | --- |
| `get_professional_summary` | `/CV/candidate.json` (`identity`, `meta`) + `/CV/llms.txt` | Minimal; a single HTTP GET to `candidate.json` or `llms.txt` already returns the full schema. |
| `get_public_resume` (`format`: `md` \| `txt`) | `/CV/resume.md` / `/CV/resume.txt` | None; direct HTTP GET returns plain Markdown or plain text with zero protocol overhead. |
| `list_skills` (`category`, `verificationStatus`) | `/CV/skills-evidence.json` | Marginal convenience filtering; total dataset is ~48 skills (< 25 KB JSON), trivially filtered client-side. |
| `get_skill_evidence` (`skillId`) | `/CV/skills-evidence.json` | Marginal; `skills[]` already embeds `context`, `supportingUrls`, `evidenceType`, `verificationStatus`, and `limitations` per item. |
| `list_public_projects` | `/CV/candidate.json` (`publicProjects`) | Minimal; 6 verified repositories fit in < 3 KB JSON. |
| `get_role_alignment` (`roleId`) | `/CV/role-alignment.json` | Marginal; all 6 role alignment entries fit in < 10 KB JSON. |

## 2. Architecture Options Evaluated

1. **Static HTTP + Machine-Readable Files on GitHub Pages (Selected):**
   - Cost: \$0 (existing GitHub Pages workflow).
   - Crawler & agent compatibility: 100% — works with search crawlers, HTTP fetchers, browser agents, CLI tools (`curl`), and LLM retrieval pipelines without proprietary client configuration.
   - Security / confidentiality surface: Validated pre-deployment by `scripts/check-confidentiality.js`, `scripts/stage-public.js`, and explicit workflow dispatch approval.
   - Failure modes: None beyond GitHub Pages availability.
2. **Remote Hosted Streamable-HTTP MCP Server (Rejected):**
   - Requires third-party serverless or container runtime (Cloudflare Workers / Fly / VPS) outside `stden/CV` static Pages.
   - Adds DNS/TLS/observability/rate-limiting maintenance and abuse surface for data that changes infrequently and is under 100 KB total.
   - Not used by standard search engines or ATS crawlers.
3. **Optional Zero-Cost Local `stdio` MCP Wrapper (Deferred / Optional):**
   - A lightweight Node `stdio` script reading staged `_site/candidate.json`, `skills-evidence.json`, `role-alignment.json`, `resume.md`, and `resume.txt` could wrap the six read-only tools if an IDE user explicitly wants local MCP tool calls instead of reading URLs/files directly.
   - Defer until an actual client integration requires it; keep `stden/CV` runtime dependency-free in production.

## 3. Decision

- Do **not** add an MCP runtime dependency, server endpoint, or paid hosting in this iteration.
- Treat `/CV/candidate.json`, `/CV/skills-evidence.json`, `/CV/role-alignment.json`, `/CV/resume.md`, `/CV/resume.txt`, and `/CV/llms.txt` as the canonical machine-readable API.
- If a future integration genuinely needs MCP, implement a thin read-only `stdio` adapter exclusively on top of those allowlisted JSON/Markdown files so the confidentiality gate remains the single source of enforcement.
