# CV content review

The portfolio uses the [previous public CV](https://github.com/stden/CV/blob/3d0c08c7dea873a29eb6f1ba994c40edd6fa7435/index.html) as the primary source for employment, dates, responsibilities, projects, education and language levels. Its [published project diagrams](https://github.com/stden/CV/blob/3d0c08c7dea873a29eb6f1ba994c40edd6fa7435/scripts/build-project-diagrams.js) inform the new diagrams at the level of component responsibilities.

## Items for Denis to confirm

- **Production outcomes.** Which measurable changes in reliability, latency, cost or deployment effort can be published? For each, confirm the baseline, comparison period and public wording.
- **Scale.** Which document counts, request or message throughput, availability figures or user counts can be shared publicly? The existing CV documents the Oracle lab of 60+ computers. Figures for other systems need a source and clearance.
- **Ownership and collaboration.** Which services or release processes did you own? Which decisions, cross-team responsibilities, mentoring or leadership can be described with concrete evidence?
- **Enterprise stack.** Can Apache Kafka be attributed to a specific professional system? The previous CV lists Kafka as a skill. The documented enterprise transformation pipeline uses RabbitMQ.
- **Skills scope.** Which listed skills should be tied to public project evidence or earlier employers? In particular, confirm the hands-on projects for Terraform, Prometheus and Grafana, Go and related frameworks, and the scope of generative AI work.
- **Professional and independent projects.** Confirm whether any AI, automation or infrastructure projects were delivered for a client or employer and can be attributed publicly. The messenger archive is labelled independent.
- **Language proficiency.** Confirm that English should remain “Intermediate”. If a different public description is appropriate, provide the level or supporting assessment.
- **Employment chronology.** The timeline reproduces the published dates through February 2007 and resumes in September 2012. Confirm whether any public employment or education entries are missing from that interval or whether other dates should be corrected.
- **Public contact details.** The LinkedIn action uses the currently indexed profile. Confirm whether Telegram remains a preferred recruiter contact. [Denis Stepulenok on LinkedIn](https://ee.linkedin.com/in/denis-stepulenok)
- **Optional availability.** Confirm whether availability, relocation preferences or work authorisation should be visible on the public portfolio. Those fields are opt-in.

## Evidence and confidentiality

- Employer case studies describe functional behaviour, component responsibilities and relevant design choices at the published level. Internal hostnames, endpoints, credentials, customer information, private repository links, operational identifiers and scheduler intervals are outside the public case studies.
- Projects use documented functional behaviour. Throughput, reliability, cost savings and performance claims require verifiable evidence. Targeted CVs reorder the same facts and do not assert fintech, payment-processing, AML or compliance experience.
- The [public skill inventory](data/skills.json) distinguishes work experience and case-study references, public repositories, and skills listed on the previous CV. A listed skill records self-reported experience. Each targeted CV should give priority to skills with evidence appropriate to that role.
- The selected public repositories were checked on 27 November 2026. Activity dates describe the latest GitHub push reported at that time. Workflow URLs expose live CI status, which can change independently of a repository push.

| Public project | Evidence |
| --- | --- |
| SonarQube Checker | [Repository and Python implementation](https://github.com/stden/SonarQubeChecker), [Rust documentation](https://github.com/stden/SonarQubeChecker/blob/main/README_RUST.md), [verified CI run](https://github.com/stden/SonarQubeChecker/actions/runs/44781449306) |
| docker-gems | [Repository and usage guide](https://github.com/stden/docker-gems), [published images](https://hub.docker.com/u/stden), [verified image workflow run](https://github.com/stden/docker-gems/actions/runs/40185929500) |
| Bitrix24 MCP Server | [Repository and documentation](https://github.com/stden/bitrix24-mcp-server) |
| RustShot | [Repository and platform support](https://github.com/stden/RustShot), [verified CI run](https://github.com/stden/RustShot/actions/runs/45880377478) |

The employer name “Taxify (now Bolt)” retains the name at the time of employment and adds the current name. [Bolt’s announcement](https://bolt.eu/en/blog/rebranding/)
