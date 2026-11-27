const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeXml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function loadRepoMetadata() {
    const metaPath = path.join(ROOT_DIR, 'data', 'repo-metadata.json');
    if (!fs.existsSync(metaPath)) return null;
    try {
        return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
        return null;
    }
}

function loadCvData() {
    const raw = fs.readFileSync(path.join(ROOT_DIR, 'data', 'cv.json'), 'utf8');
    const data = JSON.parse(raw);
    if (!data?.profile?.name || !Array.isArray(data.experience) || !Array.isArray(data.variants)) {
        throw new Error('Invalid data/cv.json structure');
    }
    const repoMeta = loadRepoMetadata();
    if (Array.isArray(data.githubProjects)) {
        data.githubProjects = data.githubProjects.map((project) => {
            const meta = repoMeta?.repos?.[project.name];
            if (!meta) {
                return {
                    ...project,
                    ciStatus: 'Not verified',
                    lastVerified: 'Not verified',
                };
            }
            return {
                ...project,
                ciStatus: meta.verified ? meta.ciStatus : 'Not verified',
                latestActivity: meta.pushedAt || project.latestActivity,
                lastVerified: meta.verified ? meta.lastVerified : 'Not verified',
            };
        });
    }
    return data;
}

function relPrefix(depth) {
    return depth <= 0 ? '' : '../'.repeat(depth);
}

module.exports = {
    ROOT_DIR,
    escapeHtml,
    escapeXml,
    loadCvData,
    relPrefix,
};
