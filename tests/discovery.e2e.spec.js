const { expect, test } = require('@playwright/test');

const HOME = '/CV/';
const CANONICAL = 'https://stden.github.io/CV/';

test('public profile formats are linked and resolvable under the Pages subpath', async ({ request }) => {
    const paths = {
        'llms.txt': 'text/plain', 'resume.md': 'text/markdown', 'resume.txt': 'text/plain',
        'candidate.json': 'application/json', 'skills-evidence.json': 'application/json', 'role-alignment.json': 'application/json',
    };
    for (const [name, format] of Object.entries(paths)) {
        const response = await request.get(HOME + name, { headers: { 'User-Agent': 'Googlebot' } });
        expect(response.status(), name).toBe(200);
        expect(response.headers()['content-type']).toContain(format);
        const contents = await response.text();
        expect(contents).toContain(CANONICAL);
        if (name.endsWith('.json')) {
            const profile = JSON.parse(contents);
            expect(profile.canonicalProfileUrl).toBe(CANONICAL);
            expect(profile.schemaVersion).toBe('1.0.0');
        }
    }
});

test('document metadata and independent engineering evidence are usable without JavaScript', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
    try {
        const page = await context.newPage();
        await page.goto(HOME);
        await expect(page.locator('main > section')).toHaveCount(5);
        await expect(page.locator('head link[rel="alternate"][type="text/markdown"]'))
            .toHaveAttribute('href', CANONICAL + 'resume.md');
        await expect(page.locator('head link[rel="describedby"][href$="candidate.json"]')).toHaveCount(1);

        await page.locator('footer a[href$="#public-cv-formats"]').click();
        await page.locator('#public-cv-formats summary').click();
        await expect(page.locator('#public-cv-formats a')).toHaveCount(6);
        await expect(page.locator('#public-cv-formats a').first()).toBeVisible();

        await page.locator('footer a[href$="role-alignment/"]').click();
        await expect(page.locator('main article')).toHaveCount(6);
        await expect(page.locator('header [data-locale="de"]')).toHaveJSProperty('pathname', HOME + 'de/');

        await page.locator('footer a[href$="articles/"]').click();
        await expect(page.locator('main article')).toHaveCount(2);
        await page.locator('main article a').first().click();
        const ld = JSON.parse(await page.locator('head script[type="application/ld+json"]').textContent());
        expect(ld['@graph']).toEqual(expect.arrayContaining([expect.objectContaining({
            '@type': 'Article', datePublished: '2026-11-27', inLanguage: 'en',
        })]));
    } finally {
        await context.close();
    }
});
