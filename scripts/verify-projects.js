const fs = require('node:fs/promises');
const path = require('node:path');
const { ROOT_DIR, loadCvData } = require('./lib/utils');
const { sanitizeSnapshot, verifyRepository } = require('./lib/project-verification');

async function main() {
    const { githubProjects } = loadCvData();
    const verifiedAt = new Date().toISOString().slice(0, 10);
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const request = (url) => fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(8000) });
    const checks = await Promise.all(githubProjects.map(async (project) => [project.name, await verifyRepository(project, verifiedAt, request)]));
    const verified = checks.filter(([, info]) => info);
    const snapshot = sanitizeSnapshot(Object.fromEntries(verified), githubProjects);
    const directory = path.join(ROOT_DIR, '.build');
    const snapshotPath = path.join(directory, 'github-project-verification.json');
    const temporaryPath = snapshotPath + '.' + process.pid + '.tmp';
    await fs.mkdir(directory, { recursive: true });
    try {
        await fs.writeFile(temporaryPath, JSON.stringify(snapshot, null, 2) + '\n');
        await fs.rename(temporaryPath, snapshotPath);
    } finally {
        await fs.rm(temporaryPath, { force: true });
    }
    console.log(`Repository metadata verified for ${verified.length}/${checks.length} projects.`);
    const sourceCount = Object.values(snapshot).reduce((total, { sources }) => total + (sources?.length ?? 0), 0);
    console.log(`Verified ${sourceCount} commit-pinned source, documentation and test references.`);
}

main().catch(() => {
    console.error('PROJECT_VERIFICATION_FAILED');
    process.exitCode = 1;
});
