# Content Review Checklist

The portfolio and targeted CV variants strictly use verified facts from the existing CV repository and public GitHub repositories. Please review and confirm the following items before publishing or sending applications:

## 1. Quantifiable Impact & Scale (Currently Omitted to Avoid Fabrication)
Can you provide verified numbers for any of these areas?
- **Kuehne+Nagel (2018 – Present):**
  - Approximate daily/monthly volume of XML messages transformed or documents served by the link gateway.
  - Production availability/SLA or incident/latency improvements achieved.
  - Any measurable CI/CD build/deploy time reductions or infrastructure cost savings.
  - Team size, mentoring responsibilities, or technical leadership/architecture ownership scope.
- **Taxify / Bolt (2017 – 2018):**
  - Approximate request rate or service scale for the high-load Node.js microservices you worked on.
- **Oracle (2014 – 2017):**
  - Confirmed `60+ computers` in the distributed lab from the original CV. Any additional verified figures (e.g., suite stabilization improvements or defect count) you want included?

## 2. Experience Categorisation & Skill Context
- **Apache Kafka, AWS, Terraform, Quarkus, Prometheus/Grafana:** These appeared in the `Skills & Proficiency` section of the original CV, but were not explicitly tied to a specific employer role in the Employment text.
  - Currently they are tagged as **Additional professional** (or **Personal / independent** for Qdrant, Rust, MCP, RAG).
  - Please confirm which ones were used in production at Kuehne+Nagel or Taxify (Bolt) vs personal/study projects so we can update `data/cv.json` accordingly.
- **English Proficiency:** Kept at **Intermediate** as listed in the original CV. Please confirm if your current level (e.g., B2 / Upper-Intermediate / C1) should be updated.

## 3. Career Timeline & Links
- **2007 – 2012 Gap:** The original CV lists OAO INRUSKOM (Nov 2005 – Feb 2007) followed by Bonus Club "All in plus" (Sep 2012 – Aug 2013). Left untouched with no fabricated filler. Should anything (e.g., education/freelance/unrelated work) be noted here, or keep as-is?
- **Legacy Broken / Repurposed Links Removed:**
  - Removed `http://www.vsevpluse.ru` (dead domain).
  - Removed `http://www.inruscom.com` (domain now points to an unrelated special-vehicles site).
  - Removed `whatsapp.html` / phone `+79117117850` (was commented out in `index.html`, leaked via `whatsapp.html`).
  - Omitted personal Facebook link from the main contact panel (still available if you explicitly want it restored).

## 4. Configurable Recruiter Settings (`data/cv.json`)
In `data/cv.json` under `profile.availability`:
- `showOpenToWork` is set to `false` by default (hidden).
- `relocation` and `workAuthorisation` are empty strings by default.
Update these fields when you want to surface work-authorisation or relocation details publicly.

## 5. GitHub Pages Deployment Note
GitHub Pages on `stden/CV` is currently configured for legacy branch publishing (`main` / `/`). Built assets (`index.html`, `cv/`, `tech/`, `assets/`) are committed so branch publishing continues working seamlessly. Once merged, you can optionally switch **Settings -> Pages -> Build and deployment -> Source** to **GitHub Actions** to let `.github/workflows/ci-pages.yml` deploy directly from the validated `_site/` artifact.
