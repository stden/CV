const fs = require('node:fs');
const path = require('node:path');
const dns = require('node:dns');
const https = require('node:https');
const net = require('node:net');

const maxBytes = 512 * 1024;
const retrievalError = 'Could not retrieve a usable public vacancy. Save the job description as a local text, Markdown or JSON file and run the command again.';
const listFields = ['requiredTechnologies', 'preferredTechnologies', 'roleTechnologies', 'requiredCompetencies', 'languageRequirements'];
const nonPublic = new net.BlockList();
for (const [network, mask] of [
    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
    ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
    ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
    ['224.0.0.0', 4], ['240.0.0.0', 4],
]) nonPublic.addSubnet(network, mask, 'ipv4');
for (const [network, mask] of [['2001:db8::', 32], ['2002::', 16]]) nonPublic.addSubnet(network, mask, 'ipv6');
const globalIpv6 = new net.BlockList();
globalIpv6.addSubnet('2000::', 3, 'ipv6');

class VacancyError extends Error {}

function httpsUrl(value) {
    if (typeof value !== 'string' || !URL.canParse(value)) return null;
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
}

function publicAddress(address) {
    const family = net.isIP(address);
    if (family === 4) return !nonPublic.check(address, 'ipv4');
    return family === 6 && globalIpv6.check(address, 'ipv6') && !nonPublic.check(address, 'ipv6');
}

function lookupPublic(hostname, options, accept) {
    dns.lookup(hostname, { all: true }, (error, addresses) => {
        if (error || !addresses.length || addresses.some(({ address }) => !publicAddress(address))) {
            return accept(new VacancyError(retrievalError));
        }
        if (options.all) return accept(null, addresses);
        return accept(null, addresses[0].address, addresses[0].family);
    });
}

function text(value, label, limit = 1500) {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value !== 'string' || value.length > limit) {
        throw new VacancyError(`The ${label} field must be text within the supported length.`);
    }
    return value.trim();
}

function list(value, label) {
    if (value === undefined || value === null || value === '') return [];
    const items = typeof value === 'string' ? value.split(/\r?\n/) : value;
    if (!Array.isArray(items) || items.length > 100) throw new VacancyError(`The ${label} field must contain a list of requirements.`);
    return [...new Set(items.map((item) => text(item, label).replace(/^[-*]\s+/, '')).filter(Boolean))];
}

function normaliseSalary(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'string') return text(value, 'salary range');
    if (typeof value !== 'object' || Array.isArray(value)) throw new VacancyError('Use text or an object for the salary range.');
    const output = {};
    for (const key of ['min', 'max']) {
        if (value[key] === undefined) continue;
        if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) {
            throw new VacancyError('Use numeric salary range boundaries.');
        }
        output[key] = value[key];
    }
    for (const key of ['currency', 'period']) {
        const item = text(value[key], 'salary range');
        if (item) output[key] = item;
    }
    return Object.keys(output).length ? output : null;
}

function normaliseVacancy(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new VacancyError('Use a JSON object for the vacancy.');
    const source = text(input.source || input.url || input.vacancyUrl, 'vacancy URL');
    if (source && !httpsUrl(source)) throw new VacancyError('The vacancy source must be an HTTPS URL.');
    const slug = text(input.slug, 'slug', 100);
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new VacancyError('Use a short slug with lowercase letters, digits and hyphens.');
    }
    const vacancy = {
        company: text(input.company, 'company', 200),
        title: text(input.title ?? input.jobTitle, 'title', 200),
        source,
        description: text(input.description ?? input.jobDescription, 'job description', maxBytes),
        requiredTechnologies: list(input.requiredTechnologies, 'required technologies'),
        preferredTechnologies: list(input.preferredTechnologies, 'preferred technologies'),
        roleTechnologies: list(input.roleTechnologies, 'role technologies'),
        requiredCompetencies: list(input.requiredCompetencies, 'required competencies'),
        location: text(input.location, 'location'),
        languageRequirements: list(input.languageRequirements, 'language requirements'),
        employmentType: text(input.employmentType, 'employment type'),
        applicationDeadline: text(input.applicationDeadline ?? input.deadline, 'application deadline'),
        salaryRange: normaliseSalary(input.salaryRange ?? input.salary),
    };
    const profile = text(input.profile, 'CV profile', 100);
    if (profile) vacancy.profile = profile;
    if (slug) vacancy.slug = slug;
    if (input.skills !== undefined) vacancy.skills = list(input.skills, 'selected skills');
    if (input.projects !== undefined) vacancy.projects = list(input.projects, 'selected projects');
    return vacancy;
}

const headings = new Map([
    ['required technologies', 'requiredTechnologies'],
    ['technology stack', 'roleTechnologies'],
    ['role technologies', 'roleTechnologies'],
    ['preferred technologies', 'preferredTechnologies'],
    ['nice to have', 'preferredTechnologies'],
    ['required competencies', 'requiredCompetencies'],
    ['requirements', 'requiredCompetencies'],
    ['qualifications', 'requiredCompetencies'],
    ['technical skills', 'requiredCompetencies'],
    ['what are we looking for', 'requiredCompetencies'],
    ['what we are looking for', 'requiredCompetencies'],
    ['what you will bring', 'requiredCompetencies'],
    ['what does it take', 'requiredCompetencies'],
    ['language requirements', 'languageRequirements'],
    ['languages', 'languageRequirements'],
]);
const sectionEnds = new Set(['additional information', 'about us', 'benefits', 'job description', 'about the team', 'what we offer', 'what we can offer', 'responsibilities']);
const textFields = new Map([
    ['company', 'company'], ['title', 'title'], ['job title', 'title'], ['role', 'title'], ['location', 'location'],
    ['vacancy url', 'source'], ['url', 'source'], ['source', 'source'], ['employment type', 'employmentType'],
    ['application deadline', 'applicationDeadline'], ['deadline', 'applicationDeadline'],
    ['salary range', 'salaryRange'], ['salary', 'salaryRange'],
]);

function parseText(source) {
    const fields = Object.fromEntries(listFields.map((key) => [key, []]));
    let section = '';
    for (const line of source.trim().split(/\r?\n/)) {
        const plain = line.trim().replaceAll('**', '').replaceAll('__', '');
        if (!plain) continue;
        const [, prefix, value] = plain.match(/^([^:]+):\s+(.+)$/) || [];
        const metadata = prefix && textFields.get(prefix.trim().toLowerCase());
        const inlineSection = prefix && headings.get(prefix.trim().toLowerCase());
        const heading = plain.replace(/^#{1,6}\s+/, '').replace(/[?:]$/, '').trim().toLowerCase();
        if (metadata && !section) {
            fields[metadata] = value;
        } else if (inlineSection) {
            fields[inlineSection].push(value);
        } else if (headings.has(heading)) {
            section = headings.get(heading);
        } else if (sectionEnds.has(heading)) {
            section = '';
        } else if (/^#\s+/.test(plain) && !fields.title) {
            fields.title = plain.replace(/^#\s+/, '');
            section = '';
        } else if (/^#{1,6}\s+/.test(plain)) {
            section = '';
        } else if (section) {
            const item = plain.replace(/^(?:[-*•]|\d+\.)\s+/, '');
            if (!/^no prior .*\b(?:needed|required)\b/i.test(item)) fields[section].push(item);
        }
    }
    return { ...fields, description: source.trim() };
}

function decodeEntities(html) {
    const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—' };
    return html.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (original, value) => {
        if (value.startsWith('#')) {
            const code = /^#x/i.test(value) ? parseInt(value.slice(2), 16) : Number(value.slice(1));
            return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : original;
        }
        return entities[value.toLowerCase()] ?? original;
    });
}

function markupText(html) {
    return decodeEntities(html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
        .replace(/<h[1-6]\b[^>]*>/gi, '\n## ')
        .replace(/<p\b[^>]*>\s*<(strong|b)>\s*([^<]+)\s*<\/\1>\s*<\/p>/gi, '\n## $2\n')
        .replace(/<li\b[^>]*>/gi, '\n- ')
        .replace(/<\/(?:h[1-6]|p|li|div|ul|ol)>|<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/[\t ]+/g, ' ')
        .replace(/\n\s*\n/g, '\n'));
}

function findPosting(data) {
    if (Array.isArray(data)) return data.map(findPosting).find(Boolean);
    if (!data || typeof data !== 'object') return undefined;
    const types = Array.isArray(data['@type']) ? data['@type'] : [data['@type']];
    return types.includes('JobPosting') ? data : findPosting(data['@graph']);
}

function readPosting(html) {
    for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
            const posting = findPosting(JSON.parse(match[1]));
            if (posting) return posting;
        } catch {
            // Ignore malformed embedded metadata and check the next entry.
        }
    }
    return undefined;
}

function fromPosting(posting, source) {
    const fields = parseText(markupText(text(posting.description, 'job description', maxBytes)));
    const locations = [posting.jobLocation].flat().map((location) => {
        const address = location?.address;
        return [address?.addressLocality, address?.addressRegion, address?.addressCountry]
            .filter((value) => typeof value === 'string' && value).join(', ');
    }).filter(Boolean);
    const salary = posting.baseSalary;
    const qualifications = typeof posting.qualifications === 'string'
        ? markupText(posting.qualifications).split(/\r?\n/) : [];
    const skills = [posting.skills].flat().filter((item) => typeof item === 'string');
    return normaliseVacancy({
        ...fields,
        source,
        title: posting.title,
        company: posting.hiringOrganization?.name,
        location: locations.join(' / '),
        roleTechnologies: [...fields.roleTechnologies, ...skills],
        requiredCompetencies: [...fields.requiredCompetencies, ...qualifications],
        employmentType: [posting.employmentType].flat().filter((value) => typeof value === 'string').join(', '),
        applicationDeadline: posting.validThrough && new Date(posting.validThrough).getUTCFullYear() < 2100 ? posting.validThrough : undefined,
        salaryRange: salary && { min: salary.value?.minValue, max: salary.value?.maxValue, currency: salary.currency, period: salary.value?.unitText },
    });
}

function parseJobPosting(raw, contentType, source = '') {
    if (contentType.includes('json') || raw.trimStart()[0] === '{') {
        let input;
        try {
            input = JSON.parse(raw);
        } catch {
            throw new VacancyError('The vacancy JSON could not be parsed. Check the file format.');
        }
        const posting = findPosting(input);
        if (posting) return fromPosting(posting, source);
        return normaliseVacancy({ ...input, ...(source && { source }) });
    }
    if (contentType.includes('html')) {
        const posting = readPosting(raw);
        if (!posting?.description) throw new VacancyError(retrievalError);
        return fromPosting(posting, source);
    }
    if (source && !contentType.startsWith('text/plain') && !contentType.startsWith('text/markdown')) {
        throw new VacancyError(retrievalError);
    }
    return normaliseVacancy({ ...parseText(raw), ...(source && { source }) });
}

async function readBounded(stream) {
    let size = 0;
    const parts = [];
    for await (const part of stream) {
        size += part.length;
        if (size > maxBytes) throw new VacancyError('The vacancy description exceeds the supported size.');
        parts.push(part);
    }
    return Buffer.concat(parts).toString('utf8').replace(/^\uFEFF/, '');
}

async function fetchPosting(source) {
    const signal = AbortSignal.timeout(12_000);
    let url = httpsUrl(source);
    for (let attempt = 0; attempt < 4; attempt++) {
        const host = url?.hostname.replace(/^\[|\]$/g, '');
        if (!url || (net.isIP(host) && !publicAddress(host))) throw new VacancyError(retrievalError);
        const response = await new Promise((resolve, reject) => {
            const request = https.get(url, {
                lookup: lookupPublic,
                signal,
                headers: { accept: 'text/html, application/ld+json, application/json, text/plain, text/markdown' },
            }, resolve);
            request.on('error', reject);
        });
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            response.destroy();
            url = httpsUrl(new URL(response.headers.location, url).href);
            continue;
        }
        if (response.statusCode !== 200) {
            response.destroy();
            throw new VacancyError(retrievalError);
        }
        return parseJobPosting(await readBounded(response), response.headers['content-type'] || '', url.href);
    }
    throw new VacancyError(retrievalError);
}

async function importVacancy(input) {
    if (typeof input !== 'string' || !input) throw new VacancyError('Usage: npm run cv:job -- <vacancy.json|vacancy.md|vacancy.txt|HTTPS URL>');
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) {
        try {
            return await fetchPosting(input);
        } catch {
            throw new VacancyError(retrievalError);
        }
    }
    const types = { '.json': 'application/json', '.md': 'text/markdown', '.markdown': 'text/markdown' };
    let raw;
    try {
        const stat = await fs.promises.stat(input);
        if (!stat.isFile()) throw new VacancyError('The vacancy must be provided as a regular file.');
        if (stat.size > maxBytes) throw new VacancyError('The vacancy description exceeds the supported size.');
        raw = await readBounded(fs.createReadStream(input));
    } catch (error) {
        if (error instanceof VacancyError) throw error;
        throw new VacancyError('Could not read the vacancy file. Check that it exists and is readable.');
    }
    const posting = parseJobPosting(raw, types[path.extname(input).toLowerCase()] || 'text/plain');
    if (!posting.description && !posting.title && !posting.profile) {
        throw new VacancyError('The vacancy file does not contain a job title or description.');
    }
    return posting;
}

module.exports = { VacancyError, normaliseVacancy, parseJobPosting, importVacancy };
