const fs = require('node:fs');
const path = require('node:path');
const { ROOT_DIR, loadCvData } = require('./lib/utils');

const OUTPUT_PATH = path.join(ROOT_DIR, 'data', 'repo-metadata.json');

function githubHeaders() {
    const headers = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'stden-cv-repo-sync',
    };
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

function parseRepoPath(repoUrl) {
    const parsed = new URL(repoUrl);
    if (parsed.hostname !== 'github.com') {
        throw new Error(`Unsupported repository host: ${parsed.hostname}`);
    }
    const parts = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/');
    if (parts.length < 2) throw new Error(`Invalid repository URL: ${repoUrl}`);
    return `${parts[0]}/${parts[1]}`;
}

async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const res = await fetch(url, { headers: githubHeaders(), signal: controller.signal });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

function formatCiStatus(runsData) {
    const runs = runsData?.workflow_runs;
    if (!Array.isArray(runs) || runs.length === 0) return 'No CI workflow';
    const latest = runs[0];
    const name = latest.name || 'CI';
    if (latest.status !== 'completed') return `${name} (${latest.status})`;
    if (latest.conclusion === 'success') return `${name} passing`;
    return `${name} (${latest.conclusion || 'completed'})`;
}

async function syncRepoMetadata() {
    const data = loadCvData();
    const today = new Date().toISOString().slice(0, 10);
    const repos = {};

    for (const project of data.githubProjects) {
        const slug = parseRepoPath(project.url);
        const repoInfo = await fetchJson(`https://api.github.com/repos/${slug}`);
        const runsInfo = repoInfo ? await fetchJson(`https://api.github.com/repos/${slug}/actions/runs?per_page=1`) : null;

        if (!repoInfo) {
            repos[project.name] = {
                verified: false,
                ciStatus: 'Not verified',
                pushedAt: project.latestActivity || '',
                lastVerified: 'Not verified',
            };
            continue;
        }

        repos[project.name] = {
            verified: true,
            ciStatus: formatCiStatus(runsInfo),
            pushedAt: repoInfo.pushed_at ? repoInfo.pushed_at.slice(0, 10) : (project.latestActivity || ''),
            lastVerified: today,
        };
    }

    const payload = {
        generatedAt: today,
        repos,
    };
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n');
    console.log(`Synced metadata for ${Object.keys(repos).length} repositories to ${OUTPUT_PATH}`);
    return payload;
}

if (require.main === module) {
    syncRepoMetadata().catch((err) => {
        console.error(err.message);
        process.exitCode = 1;
    });
}

module.exports = { syncRepoMetadata, formatCiStatus };
