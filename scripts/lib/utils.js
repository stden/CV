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

function loadCvData() {
    const raw = fs.readFileSync(path.join(ROOT_DIR, 'data', 'cv.json'), 'utf8');
    const data = JSON.parse(raw);
    if (!data?.profile?.name || !Array.isArray(data.experience) || !Array.isArray(data.variants)) {
        throw new Error('Invalid data/cv.json structure');
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
