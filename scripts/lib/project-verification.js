const statuses = {
    success: 'Passing',
    failure: 'Failing',
    timed_out: 'Failing',
    cancelled: 'Cancelled',
};
const ciEvents = new Set(['push', 'workflow_dispatch', 'schedule']);
const date = /^\d{4}-\d{2}-\d{2}$/;

function repoName(url) {
    if (!URL.canParse(url)) return null;
    const address = new URL(url);
    if (address.origin !== 'https://github.com' || address.username || address.password) return null;
    const name = address.pathname.replace(/^\/|\/$/g, '');
    return /^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(name) ? name : null;
}

function ciRunUrl(url, name) {
    if (typeof url !== 'string') return undefined;
    const prefix = 'https://github.com/' + name + '/actions/runs/';
    return url.startsWith(prefix) && /^\d+$/.test(url.slice(prefix.length)) ? url : undefined;
}

async function getJson(request, endpoint) {
    try {
        const response = await request('https://api.github.com' + endpoint);
        return response.ok ? await response.json() : null;
    } catch {
        return null;
    }
}

async function verifyRepository(project, verifiedAt, request) {
    const name = repoName(project.url);
    if (!name) return null;
    const info = await getJson(request, '/repos/' + name);
    if (info?.private !== false || info.full_name?.toLowerCase() !== name.toLowerCase() || !info.default_branch) return null;
    const result = { ciStatus: 'Not verified', verifiedAt };
    const activity = typeof info.pushed_at === 'string' ? info.pushed_at.slice(0, 10) : '';
    if (date.test(activity)) result.latestActivity = activity;
    if (!/^[A-Za-z0-9_.-]+\.ya?ml$/.test(project.ciWorkflow ?? '')) return result;

    const query = new URLSearchParams({ branch: info.default_branch, status: 'completed', per_page: '10' });
    const runs = await getJson(request, `/repos/${name}/actions/workflows/${project.ciWorkflow}/runs?${query}`);
    const completed = Array.isArray(runs?.workflow_runs)
        ? runs.workflow_runs.find((item) => item.status === 'completed' && item.head_branch === info.default_branch && ciEvents.has(item.event))
        : undefined;
    const ciUrl = ciRunUrl(completed?.html_url, info.full_name);
    if (ciUrl && Object.hasOwn(statuses, completed.conclusion)) {
        result.ciStatus = statuses[completed.conclusion];
        result.ciUrl = ciUrl;
    }
    return result;
}

function sanitizeSnapshot(snapshot, projects) {
    return Object.fromEntries(projects.flatMap((project) => {
        const item = snapshot?.[project.name];
        const name = repoName(project.url);
        if (!name || !date.test(item?.verifiedAt ?? '')) return [];
        const safe = { verifiedAt: item.verifiedAt, ciStatus: 'Not verified' };
        if (date.test(item.latestActivity ?? '')) safe.latestActivity = item.latestActivity;
        const url = ciRunUrl(item.ciUrl, name);
        if (url && Object.values(statuses).includes(item.ciStatus)) {
            safe.ciStatus = item.ciStatus;
            safe.ciUrl = url;
        }
        return [[project.name, safe]];
    }));
}

module.exports = { verifyRepository, sanitizeSnapshot };
