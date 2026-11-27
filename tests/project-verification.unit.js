const assert = require('node:assert/strict');
const test = require('node:test');
const { verifyRepository } = require('../scripts/lib/project-verification');

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
