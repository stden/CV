const fs = require('node:fs/promises');
const path = require('node:path');
const { ROOT_DIR, loadCvData } = require('./lib/utils');
const { verifyRepository } = require('./lib/project-verification');

async function main() {
    const { githubProjects } = loadCvData();
    const verifiedAt = new Date().toISOString().slice(0, 10);
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const request = (url) => fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(8000) });
    const checks = await Promise.all(githubProjects.map(async (project) => [project.name, await verifyRepository(project, verifiedAt, request)]));
    const verified = checks.filter(([, info]) => info);
    const directory = path.join(ROOT_DIR, '.build');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'github-project-verification.json'), JSON.stringify(Object.fromEntries(verified), null, 2) + '\n');
    console.log(`Repository metadata verified for ${verified.length}/${checks.length} projects.`);
}

main().catch(() => {
    console.error('PROJECT_VERIFICATION_FAILED');
    process.exitCode = 1;
});
