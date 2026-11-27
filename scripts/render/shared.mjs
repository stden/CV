import { escapeHtml } from '../lib/html.mjs';

export const EVIDENCE_LABELS = {
  professional: 'Professional experience',
  personal: 'Personal project',
  other: 'Other skill'
};

// Groups in the order the variant asks for. Unknown ids are rejected by validation.
export function skillGroupsFor(cv, variant) {
  return variant.skillGroups.map((id) => cv.skillGroups.find((group) => group.id === id));
}

export function projectsFor(cv, variant) {
  return variant.projects.map((id) => cv.projects.find((project) => project.id === id));
}

// Keeps the highlights that best match the variant's focus, then shows them in
// their original order so the narrative still reads top to bottom.
export function highlightsFor(job, variant) {
  const focus = new Set(variant.focus);
  const score = (highlight) => highlight.tags.filter((tag) => focus.has(tag)).length;
  const indexed = job.highlights.map((highlight, index) => ({ highlight, index, score: score(highlight) }));
  const kept = variant.maxHighlights
    ? [...indexed].sort((a, b) => b.score - a.score || a.index - b.index).slice(0, variant.maxHighlights)
    : indexed;
  return kept.sort((a, b) => a.index - b.index).map((item) => item.highlight);
}

// Skills with no evidence in a job or project go on one "Other skills" line, so the
// PDF never presents them as proven experience.
export function splitSkills(groups) {
  const proven = groups
    .map((group) => ({ title: group.title, names: group.skills.filter((skill) => skill.evidence !== 'other').map((skill) => skill.name) }))
    .filter((group) => group.names.length);
  const other = groups.flatMap((group) => group.skills.filter((skill) => skill.evidence === 'other').map((skill) => skill.name));
  return { proven, other };
}

// The evidence is shown as a border style and as text, never by colour alone.
export function skillChips(group) {
  return group.skills
    .map((skill) => {
      const label = EVIDENCE_LABELS[skill.evidence];
      return `<li class="chip chip--${skill.evidence}">${escapeHtml(skill.name)}<span class="visually-hidden"> (${label})</span></li>`;
    })
    .join('\n          ');
}

export function evidenceLegend() {
  const items = Object.entries(EVIDENCE_LABELS)
    .map(([key, label]) => `<li><span class="chip chip--${key}">${label}</span></li>`)
    .join('\n          ');
  return `<ul class="legend" aria-label="Evidence key">
          ${items}
        </ul>`;
}

export function contactActions(cv) {
  const { email, github, linkedin, telegram } = cv.contact;
  return `<a class="button button--ghost" href="mailto:${email}">Send email</a>
        <button type="button" class="button button--ghost js-only" data-copy-email="${email}">Copy email address</button>
        <span class="visually-hidden" role="status" data-copy-status></span>
        <a class="button button--ghost" href="${linkedin}" rel="me noopener">LinkedIn</a>
        <a class="button button--ghost" href="${github}" rel="me noopener">GitHub</a>
        <a class="button button--ghost" href="${telegram}" rel="noopener">Telegram</a>`;
}
