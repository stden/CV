# Host-Level `robots.txt` Approval & Cross-Profile Consistency Checklist

> Status: **Awaiting repository owner approval**
> Target repository: `stden/stden.github.io` (separate GitHub Pages user-site repository; NOT modified by the `stden/CV` Pull Request)

## 1. Live Audit Findings (2026-11-27)

| URL | HTTP Status | Observed Content / Behaviour | Impact |
| --- | --- | --- | --- |
| `https://stden.github.io/robots.txt` | **404 Not Found** | Standard GitHub Pages 404 page; `stden/stden.github.io` (`main`) has no `robots.txt` | Crawlers check host root `robots.txt` for site-wide allow rules and sitemap discovery |
| `https://stden.github.io/CV/robots.txt` | **200 OK** | `User-agent: *` / `Allow: /` / `Sitemap: https://stden.github.io/CV/sitemap.xml` | Valid under `/CV/`, but per RFC 9309 a `/CV/robots.txt` does **not** control host-level crawling or replace `/robots.txt` |
| `https://stden.github.io/CV/` | **200 OK** | Static HTML with full content available without JavaScript | Crawlers receive complete semantic content immediately |
| `https://stden.github.io/CV/sitemap.xml` | **200 OK** | XML sitemap with `xhtml:link` `hreflang` annotations (`en`, `et`, `de`, `ru`, `x-default`) | Properly indexed once discovered |

## 2. Proposed `robots.txt` for `stden/stden.github.io`

Create `robots.txt` at the root of `stden/stden.github.io` (`main`) with the following exact contents:

```text
User-agent: *
Allow: /

Sitemap: https://stden.github.io/CV/sitemap.xml
```

### Owner Action (after PR review and merge)

1. Verify whether `stden/stden.github.io` has any unrelated private or temporary subpaths that should remain disallowed (none observed on public `main`: `README.md`, `index.html`, `js`, `mise.toml`, `styles.css`, `x.cmd`).
2. Commit `robots.txt` to `stden/stden.github.io` via a Pull Request or direct approved commit on `main`.
3. Verify after deployment:
   ```bash
   curl -fsSL https://stden.github.io/robots.txt
   ```
   Expected response: HTTP `200 OK` containing `Allow: /` and `Sitemap: https://stden.github.io/CV/sitemap.xml`.

## 3. Public Identity Consistency Verification (CV · GitHub · LinkedIn)

| Attribute | Canonical Value (`stden.github.io/CV/`) | GitHub (`github.com/stden`) | LinkedIn (`linkedin.com/in/denis-stepulenok-2149b514/`) | Owner Verification |
| --- | --- | --- | --- | --- |
| Name | Denis Stepulenok | Confirm match (`Denis Stepulenok`) | Confirm match (`Denis Stepulenok`) | [ ] Confirmed |
| Headline / Title | `Senior Software Engineer — Java & Distributed Systems` | Confirm bio aligns | Confirm headline aligns | [ ] Confirmed |
| Location | `Tallinn, Estonia` | Confirm location aligns | Confirm location aligns | [ ] Confirmed |
| Primary Language | English (`en` canonical; `et`, `de`, `ru` localised) | English | English primary | [ ] Confirmed |
| Kuehne+Nagel | `Senior Java Developer`, May 2018 – Present, Tallinn | N/A | Confirm exact dates & title match | [ ] Confirmed |
| Taxify (now Bolt) | `Senior Backend Developer`, May 2017 – May 2018, Tallinn | N/A | Confirm exact dates & title match | [ ] Confirmed |
| Oracle (Oracle Russia & CIS) | `SQE / Java Developer`, January 2014 – May 2017, Saint Petersburg | N/A | Confirm exact dates & title match | [ ] Confirmed |
| Software Development & Solutions | `Senior Java Developer`, August 2013 – January 2014, Saint Petersburg | N/A | Confirm exact dates & title match | [ ] Confirmed |
| Bonus Club | `C/C++ / Java / Android Developer`, September 2012 – August 2013, Saint Petersburg | N/A | Confirm exact dates & title match | [ ] Confirmed |
| Earlier Roles (2001–2007) | OAO INRUSKOM (Nov 2005 – Feb 2007), i-Free (Mar 2005 – Oct 2005), SPb ETU Intern (Sep 2001 – Mar 2005) | N/A | Confirm whether identical or intentionally summarised | [ ] Confirmed |
| Education | Saint-Petersburg Electrotechnical University "LETI", Specialist in Computer Science (1999 – 2005) | N/A | Confirm match | [ ] Confirmed |
