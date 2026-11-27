const statuses = {
    success: 'Passing',
    failure: 'Failing',
    timed_out: 'Failing',
    cancelled: 'Cancelled',
};
const ciEvents = new Set(['push', 'workflow_dispatch', 'schedule']);
const date = /^\d{4}-\d{2}-\d{2}$/;
const objectId = /^[a-f0-9]{40}$/;
const filePath = /^[A-Za-z0-9_][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_][A-Za-z0-9_.-]*)*$/;

function isObjectId(value) {
    return typeof value === 'string' && value.length === 40 && objectId.test(value);
}

function isFilePath(value) {
    return typeof value === 'string' && value === value.trim() && filePath.test(value);
}

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

function repositoryObject(url, name) {
    const prefix = `https://github.com/${name}/`;
    if (typeof url !== 'string' || !url.startsWith(prefix)) return null;
    const [type, ref, ...parts] = url.slice(prefix.length).split('/');
    const path = parts.join('/');
    if (!['blob', 'tree'].includes(type) || !ref || ref !== ref.trim() ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(ref) || !isFilePath(path)) return null;
    return { type, ref, path };
}

function approvedSourcePaths(project, name) {
    if (!name.startsWith('stden/')) return [];
    return [
        { kind: 'source', type: 'blob', path: project.sourcePath },
        { kind: 'documentation', ...repositoryObject(project.docsUrl, name) },
        { kind: 'test', ...repositoryObject(project.testsUrl, name) },
    ].filter(({ kind, type, path }) => isFilePath(path) && (kind === 'test' || type === 'blob'));
}

async function getJson(request, endpoint) {
    try {
        const response = await request('https://api.github.com' + endpoint);
        return response.ok ? await response.json() : null;
    } catch {
        return null;
    }
}

async function verifySources(project, name, defaultBranch, request) {
    const candidates = approvedSourcePaths(project, name);
    if (!candidates.length) return [];

    const branch = await getJson(request, `/repos/${name}/branches/${encodeURIComponent(defaultBranch)}`);
    const commit = branch?.commit?.sha;
    const treeId = branch?.commit?.commit?.tree?.sha;
    if (branch?.name !== defaultBranch || !isObjectId(commit) || !isObjectId(treeId)) return [];

    const tree = await getJson(request, `/repos/${name}/git/trees/${treeId}?recursive=1`);
    if (tree?.sha !== treeId || tree.truncated !== false || !Array.isArray(tree.tree)) return [];
    const entries = new Map(tree.tree.map((entry) => [entry?.path, entry]));
    return candidates.flatMap(({ kind, type, ref, path }) => {
        if (ref !== undefined && ref !== defaultBranch && ref !== commit) return [];
        const entry = entries.get(path);
        const modes = type === 'blob' ? ['100644', '100755'] : ['040000'];
        if (entry?.type !== type || !modes.includes(entry.mode) || !isObjectId(entry.sha)) return [];
        return [{ kind, url: `https://github.com/${name}/${type}/${commit}/${path}` }];
    });
}

async function verifyCi(project, name, info, request) {
    if (!/^[A-Za-z0-9_.-]+\.ya?ml$/.test(project.ciWorkflow ?? '')) return {};
    const query = new URLSearchParams({ branch: info.default_branch, status: 'completed', per_page: '10' });
    const runs = await getJson(request, `/repos/${name}/actions/workflows/${project.ciWorkflow}/runs?${query}`);
    const completed = Array.isArray(runs?.workflow_runs)
        ? runs.workflow_runs.find((item) => item?.status === 'completed' && item.head_branch === info.default_branch && ciEvents.has(item.event))
        : undefined;
    const ciUrl = ciRunUrl(completed?.html_url, info.full_name);
    if (ciUrl && Object.hasOwn(statuses, completed.conclusion)) {
        return { ciStatus: statuses[completed.conclusion], ciUrl };
    }
    return {};
}

async function verifyRepository(project, verifiedAt, request) {
    const name = repoName(project.url);
    if (!name) return null;
    const info = await getJson(request, '/repos/' + name);
    if (info?.private !== false || (info.visibility && info.visibility !== 'public') || typeof info.full_name !== 'string' ||
        info.full_name.toLowerCase() !== name.toLowerCase() || typeof info.default_branch !== 'string' ||
        !info.default_branch) return null;

    const [ci, sources] = await Promise.all([
        verifyCi(project, name, info, request),
        verifySources(project, name, info.default_branch, request),
    ]);
    const result = { ciStatus: 'Not verified', verifiedAt, ...ci };
    const activity = typeof info.pushed_at === 'string' ? info.pushed_at.slice(0, 10) : '';
    if (date.test(activity)) result.latestActivity = activity;
    if (sources.length) result.sources = sources;
    return result;
}

function sanitizeSources(items, project, name) {
    if (!Array.isArray(items)) return [];
    return approvedSourcePaths(project, name).flatMap(({ kind, type, path, ref }) => {
        const found = items.find((item) => {
            if (item?.kind !== kind) return false;
            const target = repositoryObject(item.url, name);
            return target?.type === type && target.path === path && isObjectId(target.ref) &&
                (!isObjectId(ref) || target.ref === ref);
        });
        return found ? [{ kind, url: found.url }] : [];
    });
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
        const sources = sanitizeSources(item.sources, project, name);
        if (sources.length) safe.sources = sources;
        return [[project.name, safe]];
    }));
}

module.exports = { verifyRepository, sanitizeSnapshot };
