const assert = require('node:assert/strict');
const test = require('node:test');
const { sanitizeSnapshot, verifyRepository } = require('../scripts/lib/project-verification');

const repo = {
    name: 'Fictional project',
    url: 'https://github.com/example-owner/example-project',
    ciWorkflow: 'ci.yml',
};
function response(data) {
    return { ok: true, json: async () => data };
}
test('CI metadata verifies a completed run for the configured public repository and branch', async () => {
    const requests = [];
    const result = await verifyRepository(repo, '2026-11-27', async (url) => {
        requests.push(url);
        if (requests.length === 1) return response({
            private: false, full_name: 'example-owner/example-project', default_branch: 'main', pushed_at: '2026-11-26T15:00:00Z',
        });
        return response({ workflow_runs: [
            { status: 'completed', conclusion: 'success', head_branch: 'main', event: 'push', html_url: 'https://github.com/example-owner/example-project/actions/runs/12345' },
        ] });
    });
    assert.match(requests[1], /\/actions\/workflows\/ci\.yml\/runs\?branch=main/);
    assert.deepEqual(result, {
        ciStatus: 'Passing', latestActivity: '2026-11-26', verifiedAt: '2026-11-27',
        ciUrl: 'https://github.com/example-owner/example-project/actions/runs/12345',
    });
});

test('missing and unsafe metadata produces no unverified success or foreign CI URL', async () => {
    let calls = 0;
    const result = await verifyRepository(repo, '2026-11-27', async () => {
        calls += 1;
        if (calls === 1) return response({
            private: false, full_name: 'example-owner/example-project', default_branch: 'main',
        });
        return response({ workflow_runs: [
            { status: 'completed', conclusion: 'success', head_branch: 'main', event: 'pull_request', html_url: 'https://github.com/other/repo/actions/runs/8' },
        ] });
    });
    assert.equal(result.ciStatus, 'Not verified');
    assert.equal(result.ciUrl, undefined);
    assert.equal(await verifyRepository({ ...repo, url: 'https://example.invalid/project' }, '2026-11-27', () => { throw new Error('should not fetch'); }), null);
});

const repositoryUrl = 'https://github.com/stden/example-project';
const repositoryPath = '/repos/stden/example-project';
const commitSha = 'a'.repeat(40);
const treeSha = 'b'.repeat(40);
const verifiedDate = '2026-11-27';
const projectWithSources = {
    name: 'Example',
    url: repositoryUrl,
    sourcePath: 'src/module.rs',
    docsUrl: repositoryUrl + '/blob/main/README.md',
    testsUrl: repositoryUrl + '/tree/main/tests',
};
const verifiedSources = [
    { kind: 'source', url: repositoryUrl + '/blob/' + commitSha + '/src/module.rs' },
    { kind: 'documentation', url: repositoryUrl + '/blob/' + commitSha + '/README.md' },
    { kind: 'test', url: repositoryUrl + '/tree/' + commitSha + '/tests' },
];
const treeEntries = [
    { path: 'src/module.rs', mode: '100644', type: 'blob', sha: 'c'.repeat(40) },
    { path: 'README.md', mode: '100644', type: 'blob', sha: 'd'.repeat(40) },
    { path: 'tests', mode: '040000', type: 'tree', sha: 'e'.repeat(40) },
];

function githubRequest(responses) {
    return async (url) => {
        const endpoint = url.replace(/^https:\/\/api\.github\.com/, '');
        if (!Object.hasOwn(responses, endpoint)) return { ok: false };
        return response(responses[endpoint]);
    };
}

function repositoryResponses(tree, extra = {}) {
    return {
        [repositoryPath]: { full_name: 'stden/example-project', private: false, default_branch: 'main' },
        [repositoryPath + '/branches/main']: {
            name: 'main',
            commit: { sha: commitSha, commit: { tree: { sha: treeSha } } },
        },
        [repositoryPath + '/git/trees/' + treeSha + '?recursive=1']: { sha: treeSha, truncated: false, tree },
        ...extra,
    };
}

test('Git tree metadata pins approved source, documentation, and tests to the same reviewed commit', async () => {
    const result = await verifyRepository(projectWithSources, verifiedDate, githubRequest(repositoryResponses(treeEntries)));
    assert.deepEqual(result, { ciStatus: 'Not verified', verifiedAt: verifiedDate, sources: verifiedSources });
});

test('source verification omits symlinks and paths declared for a different branch', async () => {
    const project = { ...projectWithSources, docsUrl: repositoryUrl + '/blob/unreviewed/README.md' };
    const tree = [{ ...treeEntries[0], mode: '120000' }, ...treeEntries.slice(1)];
    const result = await verifyRepository(project, verifiedDate, githubRequest(repositoryResponses(tree)));
    assert.deepEqual(result.sources, [verifiedSources[2]]);
});

test('unavailable source metadata cannot claim verification or erase a successful CI run', async () => {
    const project = { ...projectWithSources, ciWorkflow: 'ci.yml' };
    const endpoint = repositoryPath + '/actions/workflows/ci.yml/runs?branch=main&status=completed&per_page=10';
    const responses = repositoryResponses([], {
        [endpoint]: { workflow_runs: [
            { status: 'completed', conclusion: 'success', head_branch: 'main', event: 'push', html_url: repositoryUrl + '/actions/runs/7' },
        ] },
    });
    delete responses[repositoryPath + '/git/trees/' + treeSha + '?recursive=1'];
    const result = await verifyRepository(project, verifiedDate, githubRequest(responses));
    assert.deepEqual(result, { ciStatus: 'Passing', verifiedAt: verifiedDate, ciUrl: repositoryUrl + '/actions/runs/7' });
});

test('snapshot parsing preserves only commit-pinned evidence for the approved repo, path and kind', () => {
    const snapshot = {
        Example: {
            verifiedAt: verifiedDate,
            sources: [
                { kind: 'source', url: repositoryUrl + '/blob/main/src/module.rs' },
                { kind: 'source', url: verifiedSources[0].url.replace('example-project', 'different-project') },
                { kind: 'source', url: verifiedSources[0].url.replace('/module.rs', '/unapproved.rs') },
                { kind: 'source', url: verifiedSources[0].url + '?unexpected=true' },
                { kind: 'test', url: verifiedSources[1].url },
                { ...verifiedSources[0], unreviewedContents: 'unapproved text' },
                verifiedSources[0],
                verifiedSources[1],
            ],
        },
    };
    assert.deepEqual(sanitizeSnapshot(snapshot, [projectWithSources]), {
        Example: { verifiedAt: verifiedDate, ciStatus: 'Not verified', sources: verifiedSources.slice(0, 2) },
    });
});
