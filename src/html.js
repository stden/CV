const siteUrl = 'https://stden.github.io/CV/';
const socialPreview = new URL('assets/social-preview.jpg', siteUrl).href;

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
}

module.exports = { escapeHtml, siteUrl, socialPreview };
