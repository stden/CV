# Content review

Questions that need the owner's answer before the CV is published as final. The site
is built on the verified facts in the original CV; each item below is a place where the
rebuild made a choice, or where the source is silent.

## Facts and gaps

1. **Employment gap, February 2007 – September 2012.** The source CV lists no role
   between OAO INRUSKOM (ends February 2007) and Bonus Club (starts September 2012).
   The site does not fill it. Should a note be added, or is the gap fine as it is?
2. **Work location.** The source CV writes "Kuehne+Nagel @ Tallinn.ee" and
   "Taxify @ Tallinn.ee". The site shows "Tallinn, Estonia" for both. Confirm the locations.
3. **Taxify (now Bolt).** The site says the Taxify role was "before it was rebranded as Bolt".
   This is the requested positioning; confirm the wording.
4. **Titles and roles.** "Senior Software Engineer" is the requested headline. The three
   roles keep the titles from the source CV ("Senior Java Developer", "Senior Backend
   Developer", "SQE / Java Developer").
5. **Earlier roles.** The 2001–2005 "Software Engineer intern" entry is kept as in the
   source, with its dates. Confirm it should stay on the public site.
6. **Languages.** "English (Intermediate)" is kept from the source CV. Confirm the
   level; it is shown in every PDF.
7. **Education and interests.** Kept as in the source CV.
8. **Phone number.** The source CV has the phone number commented out. The WhatsApp page
   (`whatsapp.html`) still links to the number, as before. Decide whether that page stays
   public, or should be removed.
9. **Facebook.** Kept as a secondary contact link, as in the original site.

## Claims that go beyond the source CV

10. **Apache Kafka.** The source CV lists Kafka at 80% in the skills, with no role or
    project that uses it. The site marks it `other` ("Other skill") and the PDF lists it
    on the "Other skills" line. Confirm whether Kafka was used professionally. If it was,
    the evidence changes to `professional` and the Wise and Distributed Systems CVs can
    name the project.
11. **Summary wording.** The summary is the one you supplied. Parts of it are only partly
    backed by the source CV: "event-driven architecture" (supported by the RabbitMQ
    routing work), "production infrastructure" (Docker, Kubernetes, Jenkins and GitLab),
    and "production deployments" in the Wise CV. Confirm each one.
12. **"Fintech & Integrations" CV.** No payments, AML, compliance or financial-product
    experience appears in the source CV, so that CV describes integration and secure
    document delivery only. Confirm that the title is acceptable with that content.
13. **Wise CV.** The file is named `Denis-Stepulenok-Wise-Engineer.pdf` and the page
    `cv/wise/` names Wise in its title. Confirm the naming, and whether the page should
    be public.
14. **Skill evidence classes.** Each skill is classed as `professional`, `personal` or
    `other` by reading the source CV and the public repositories. The mapping is my
    judgement. Review `content/cv.json`, in particular the items marked `personal`
    (Svelte, Rust, Claude Code, Gemini, Prometheus, Linux) and `other`.
15. **Spring "public experiments".** The Spring technology page keeps the line "Public
    experiments: Spring MVC with JPA 2" from the original site. It is not in the source
    CV. Keep it, or remove it?

## Metrics and results

16. **No measured results.** The source CV has no throughput, user, document or cost
    figures. Every case study says so. If verified figures exist, give them, and the
    "Results" section can show them.
17. **Team size.** "60+ computers" in the Oracle role is kept from the source CV. Confirm
    that it describes the lab infrastructure the role maintained.

## Confidentiality

18. **Generalised diagrams.** The earlier diagrams contained state names, timer intervals
    and queue behaviour for the Kuehne+Nagel systems. These were replaced with generic
    descriptions. Confirm nothing confidential remains in the component descriptions in
    `content/architecture.json`.
19. **"iOPM".** The product name appears in the source CV and is used on the site.
    Confirm it may be published.

## Public GitHub projects

20. **Snapshot data.** Language, last commit and CI status were read from GitHub on
    2026-11-27 and are stored in `content/github-projects.json`. They are not refreshed
    automatically.
21. **EntityLocker activity.** The last commit date (13 November 2026) matches the date
    on which many old repositories were re-created, so it may not reflect real work.
    Confirm, or drop the date.
22. **Selection.** Five repositories were chosen. `wordstat-analyzer` (a specification
    with no code) and `anygen` (a fork of another author's methodology) were left out.

## Deployment

23. **Gating.** GitHub Pages publishes `main` without waiting for the CI job. To make
    deployment depend on validation, switch the Pages source to GitHub Actions. This
    setting was not changed.
24. **Pages publication.** The site replaces the previous content at
    https://stden.github.io/CV/ when this branch is merged into `main`.
