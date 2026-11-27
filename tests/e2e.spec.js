const fs = require('node:fs');
const path = require('node:path');
const { expect, test } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const HOME = '/CV/';
const CANONICAL = 'https://stden.github.io/CV/';
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'test-results', 'screenshots');
const VIEWPORTS = [375, 390, 768, 1024, 1440, 1920];
const SECTIONS = ['overview', 'experience', 'skills', 'projects', 'contact'];
const DETAIL_ROUTES = ['experience', 'skills', 'projects', 'architecture'];
const COMPATIBLE_ANCHORS = ['architecture', 'education', 'expertise-heading', 'arch-tab-ref-event-driven-outbox'];
const GENERAL_PDF = 'Denis-Stepulenok-CV-EN.pdf';
const LEGACY_GENERAL_PDF = 'Denis-Stepulenok-Senior-Software-Engineer.pdf';
const VARIANTS = [
    { slug: 'general', pdf: GENERAL_PDF },
    { slug: 'senior-java', pdf: 'Denis-Stepulenok-Senior-Java-Engineer.pdf' },
    { slug: 'distributed-systems', pdf: 'Denis-Stepulenok-Distributed-Systems-Engineer.pdf' },
    { slug: 'fintech-integrations', pdf: 'Denis-Stepulenok-Fintech-Engineer.pdf' },
    { slug: 'wise', pdf: 'Denis-Stepulenok-Wise-Senior-Java-Engineer.pdf' },
    { slug: 'ai-mcp', pdf: 'Denis-Stepulenok-AI-Engineer.pdf' },
    { slug: 'full', pdf: 'Denis-Stepulenok-Full-CV.pdf' },
];
const TECH_SLUGS = [
    'java', 'spring', 'spring-boot', 'jpa', 'sql', 'oracle', 'postgresql',
    'angular', 'react', 'maven', 'hibernate', 'jenkins', 'docker',
    'kubernetes', 'git', 'gitlab', 'python', 'mockito', 'jmockit', 'easymock',
];

function attachIssueTracker(page, baseURL) {
    const origin = new URL(baseURL).origin;
    const issues = [];
    page.on('pageerror', (err) => issues.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
        if (msg.type() === 'error') issues.push(`console.error: ${msg.text()}`);
    });
    page.on('response', (res) => {
        if (res.url().startsWith(`${origin}/`) && res.status() >= 400) {
            issues.push(`HTTP ${res.status()}: ${res.url()}`);
        }
    });
    page.on('requestfailed', (req) => {
        if (req.url().startsWith(`${origin}/`)) {
            issues.push(`requestfailed: ${req.failure()?.errorText} ${req.url()}`);
        }
    });
    return issues;
}

for (const width of VIEWPORTS) {
    test(`homepage renders without overflow or errors at ${width}px`, async ({ page, baseURL }) => {
        const issues = attachIssueTracker(page, baseURL);
        await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
        const res = await page.goto(HOME);
        expect(res?.ok()).toBe(true);

        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Denis Stepulenok');
        const overview = page.locator('#overview');
        await expect(overview).toContainText('Senior Software Engineer — Java & Distributed Systems');
        await expect(overview).toContainText('Tallinn, Estonia');
        const download = overview.getByRole('link', { name: /Download CV/i });
        await expect(download).toBeVisible();
        await expect(download).toHaveAttribute('href', `assets/pdf/${GENERAL_PDF}`);
        await expect(page.locator('#contact a[download]'))
            .toHaveAttribute('href', `assets/pdf/${GENERAL_PDF}`);

        await page.evaluate(async () => {
            await document.fonts.ready;
            await Promise.all(
                Array.from(document.images).map(async (img) => {
                    img.loading = 'eager';
                    if (!img.complete) {
                        await new Promise((resolve) => {
                            img.addEventListener('load', resolve, { once: true });
                            img.addEventListener('error', resolve, { once: true });
                        });
                    }
                })
            );
        });

        const metrics = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            brokenImages: Array.from(document.images).filter((i) => !i.complete || i.naturalWidth === 0).length,
        }));
        expect(metrics.brokenImages).toBe(0);
        expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
        expect(issues).toEqual([]);

        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
        if (width === 1440) {
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop-light.png'), fullPage: false });
        } else if (width === 390) {
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile-light.png'), fullPage: false });
        }
    });
}

test('homepage navigation, mobile menu, theme switcher, and contact actions work', async ({ page, baseURL, request }) => {
    const issues = attachIssueTracker(page, baseURL);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(HOME);

    for (const id of [...SECTIONS, ...COMPATIBLE_ANCHORS]) {
        await expect(page.locator(`#${id}`)).toBeAttached();
    }
    await page.locator('nav').getByRole('link', { name: 'Experience', exact: true }).click();
    await expect(page).toHaveURL(/#experience$/);
    await page.locator('#experience').getByRole('link', { name: /Full employment timeline/ }).click();
    await expect(page).toHaveURL(/\/CV\/experience\/$/);
    await page.goto(HOME);

    // Theme switching + persistence + dark screenshot
    const themeBtn = page.locator('#theme-toggle');
    await themeBtn.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop-dark.png'), fullPage: false });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await themeBtn.click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');

    // Copy email action + contact links
    await page.getByRole('button', { name: 'Copy Email Address' }).click();
    await expect(page.locator('#copy-email-status')).toContainText('super.denis@gmail.com');
    await expect(page.locator('#contact a[href="mailto:super.denis@gmail.com"]')).toBeVisible();
    await expect(page.locator('#contact a[href*="linkedin.com"]')).toBeVisible();
    await expect(page.locator('#contact a[href="https://github.com/stden"]')).toBeVisible();

    // Mobile drawer at 375px
    await page.setViewportSize({ width: 375, height: 812 });
    const navToggle = page.locator('#nav-toggle');
    await navToggle.click();
    await expect(page.locator('#mobile-drawer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-drawer')).toBeHidden();

    // Verify PDF download endpoint from hero
    const heroPdfHref = await page.locator('#overview a[download]').getAttribute('href');
    const pdfUrl = new URL(heroPdfHref, page.url());
    const pdfRes = await request.get(pdfUrl.toString());
    expect(pdfRes.ok()).toBe(true);
    expect((await pdfRes.body()).subarray(0, 5).toString('ascii')).toBe('%PDF-');
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#overview a[download]').click(),
    ]);
    expect(download.suggestedFilename()).toBe(GENERAL_PDF);
    expect(await download.failure()).toBeNull();

    expect(issues).toEqual([]);
});

test('homepage stays within the recruiter content and download limits', async ({ page }) => {
    await page.goto(HOME);
    const sections = await page.locator('main > section').evaluateAll((items) => items.map((item) => item.id));
    expect(sections).toEqual(SECTIONS);

    const content = await page.locator('main').innerText();
    const words = content.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu);
    expect(words.length).toBeGreaterThanOrEqual(650);
    expect(words.length).toBeLessThanOrEqual(800);

    const roles = page.locator('#experience article');
    await expect(roles).toHaveCount(3);
    for (const employer of ['Kuehne+Nagel', 'Bolt', 'Oracle']) {
        await expect(roles.filter({ hasText: employer })).toHaveCount(1);
    }
    const skills = await page.locator('#skills .recruiter-skill-list > li').count();
    expect(skills).toBeGreaterThanOrEqual(12);
    expect(skills).toBeLessThanOrEqual(15);
    await expect(page.locator('#projects article')).toHaveCount(4);
    await expect(page.locator('main img[src$=".svg"]')).toHaveCount(0);
    const pdfs = await page.locator('a[href$=".pdf"]').evaluateAll((items) => items.map((item) => item.getAttribute('href')));
    expect([...new Set(pdfs)]).toEqual([`assets/pdf/${GENERAL_PDF}`]);
    await expect(page.locator('#overview a.btn-primary[download]')).toHaveCount(1);
    await expect(page.locator('#overview')).toContainText('Spring Boot');
    await expect(page.locator('#overview')).toContainText('PostgreSQL');
    await expect(page.locator('#overview a[href*="linkedin.com"]')).toBeVisible();
    await expect(page.locator('#overview a[href="https://github.com/stden"]')).toBeVisible();
});

test('earlier roles, evidence tiers, and engineering disclosures remain usable', async ({ page }) => {
    await page.goto(`${HOME}experience/`);
    const firstCompact = page.locator('details.compact-role').first();
    await firstCompact.locator('summary').click();
    await expect(firstCompact).toHaveAttribute('open', '');

    await page.goto(`${HOME}skills/`);
    await expect(page.locator('.level-bar-inner')).toHaveCount(0);
    const personalFilter = page.getByRole('button', { name: 'Independent', exact: true });
    await personalFilter.click();
    await expect(personalFilter).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.skill-items li[data-tier="core"]:not([hidden])')).toHaveCount(0);
    const core = page.getByRole('button', { name: 'Core', exact: true });
    await core.click();
    await expect(core).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.skill-items li[data-tier="core"]:not([hidden])').filter({ hasText: 'Apache Kafka' })).toBeVisible();
    const familiarity = page.getByRole('button', { name: 'Familiarity', exact: true });
    await familiarity.click();
    await expect(familiarity).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.skill-items li[data-tier="familiarity"]:not([hidden])').filter({ hasText: 'Terraform' })).toBeVisible();
    await page.getByRole('button', { name: 'All', exact: true }).click();

    await page.goto(`${HOME}projects/`);
    const caseDetails = page.locator('#case-entity-concurrency-locking details');
    await expect(caseDetails).not.toHaveAttribute('open', '');
    await caseDetails.getByText('Engineering details').click();
    await expect(caseDetails).toHaveAttribute('open', '');
    await expect(caseDetails).toContainText('Registry retirement needs additional stress testing');
});

test('detail pages and project images load on mobile under /CV/', async ({ page, baseURL, request }) => {
    const issues = attachIssueTracker(page, baseURL);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of DETAIL_ROUTES) {
        const redirect = await request.get(`${HOME}${route}`, { maxRedirects: 0 });
        expect(redirect.status()).toBe(301);
        expect(redirect.headers().location).toBe(`${HOME}${route}/`);
        const response = await page.goto(`${HOME}${route}/`);
        expect(response?.ok(), route).toBe(true);
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${CANONICAL}${route}/`);
        const graph = JSON.parse(await page.locator('head script[type="application/ld+json"]').textContent())['@graph'];
        expect(graph.map((entry) => entry['@type'])).toEqual(expect.arrayContaining(['CollectionPage', 'BreadcrumbList']));
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(overflow, route).toBe(false);
        if (route === 'projects') {
            const previews = page.locator('img[src$="-preview.webp"]');
            await expect(previews).toHaveCount(2);
            for (const preview of await previews.all()) {
                await preview.scrollIntoViewIfNeeded();
                await expect.poll(() => preview.evaluate((image) => image.naturalWidth)).toBe(640);
                const asset = await request.get(new URL(await preview.getAttribute('src'), page.url()).href);
                expect(asset.headers()['content-type']).toBe('image/webp');
            }
        }
    }
    expect(issues).toEqual([]);
});

test('interactive architecture tabs and component inspector update cleanly', async ({ page, baseURL }) => {
    const issues = attachIssueTracker(page, baseURL);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${HOME}architecture/#arch-panel-ref-event-driven-outbox`);

    const archSection = page.locator('#architecture');
    await archSection.scrollIntoViewIfNeeded();

    const secondTab = page.getByRole('tab', { name: 'Outbox & Idempotent Events' });
    await expect(secondTab).toHaveAttribute('aria-selected', 'true');
    await expect(secondTab).toHaveAttribute('tabindex', '0');
    await secondTab.focus();
    await page.keyboard.press('Home');
    const firstTab = page.getByRole('tab').first();
    await expect(firstTab).toBeFocused();
    await expect(firstTab).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowRight');
    const nextTab = page.getByRole('tab').nth(1);
    await expect(nextTab).toBeFocused();
    await expect(nextTab).toHaveAttribute('aria-selected', 'true');
    await secondTab.click();
    await expect(secondTab).toHaveAttribute('aria-selected', 'true');

    const activePanel = page.locator('#arch-panel-ref-event-driven-outbox');
    await expect(activePanel).toBeVisible();
    await expect(activePanel).toContainText('Independent educational example');
    const secondNodeBtn = activePanel.locator('.arch-component-btn[data-node-id="db-outbox"]');
    await secondNodeBtn.click();
    await expect(activePanel.locator('[data-field="title"]')).toHaveText('Relational DB + Outbox Table');
    await expect(activePanel.locator('[data-field="concepts"]')).toContainText('Eventual consistency');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop-architecture.png'), fullPage: false });
    expect(issues).toEqual([]);
});

test('all seven CV variants, PDFs, and 20 technology pages load under /CV/', async ({ page, baseURL, request }) => {
    const issues = attachIssueTracker(page, baseURL);
    await page.setViewportSize({ width: 1440, height: 900 });

    const cvIndexRes = await page.goto(`${HOME}cv/index.html`);
    expect(cvIndexRes?.ok()).toBe(true);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('CV Versions');
    await expect(page.locator('.header-cv-btn')).toHaveAttribute('href', `../assets/pdf/${GENERAL_PDF}`);

    const legacyPdf = await request.get(`${HOME}assets/pdf/${LEGACY_GENERAL_PDF}`);
    expect(legacyPdf.ok()).toBe(true);
    expect((await legacyPdf.body()).subarray(0, 5).toString('ascii')).toBe('%PDF-');

    for (const variant of VARIANTS) {
        const res = await page.goto(`${HOME}cv/${variant.slug}.html`);
        expect(res?.ok(), variant.slug).toBe(true);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${CANONICAL}cv/${variant.slug}.html`);
        const pdfLink = page.locator(`a[href*="${variant.pdf}"]`).first();
        await expect(pdfLink).toBeVisible();

        const pdfUrl = new URL(await pdfLink.getAttribute('href'), page.url());
        const pdfRes = await request.get(pdfUrl.toString());
        expect(pdfRes.ok()).toBe(true);
        expect((await pdfRes.body()).subarray(0, 5).toString('ascii')).toBe('%PDF-');

        if (variant.slug === 'wise') {
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'cv-wise.png'), fullPage: false });
        }
    }

    for (const slug of TECH_SLUGS) {
        const res = await request.get(`${HOME}tech/${slug}.html`);
        expect(res.ok(), slug).toBe(true);
        expect(await res.text()).toMatch(/<h1\b/);
    }

    expect(issues).toEqual([]);
});

test('public preview refuses private application and repository sources', async ({ request }) => {
    for (const candidate of ['applications/example/resume.pdf', '.private/confidential-denylist.txt', 'data/cv.json', 'scripts/build-job-cv.js']) {
        const response = await request.get(`/CV/${candidate}`);
        expect(response.status()).toBe(404);
    }
});

test('SEO metadata, JSON-LD, sitemap, and robots.txt are valid', async ({ page, request }) => {
    await page.goto(HOME);
    await expect(page).toHaveTitle(/Denis Stepulenok/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', CANONICAL);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${CANONICAL}assets/images/og-preview.png`);

    const ldText = await page.locator('script[type="application/ld+json"]').textContent();
    const ld = JSON.parse(ldText);
    expect(ld['@graph'].map((n) => n['@type'])).toEqual(expect.arrayContaining(['Person', 'ProfilePage']));

    const robots = await request.get(`${HOME}robots.txt`);
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain(`${CANONICAL}sitemap.xml`);

    const sitemap = await request.get(`${HOME}sitemap.xml`);
    expect(sitemap.ok()).toBe(true);
    const sitemapContent = await sitemap.text();
    expect(sitemapContent).toContain(`${CANONICAL}cv/wise.html`);
    for (const route of DETAIL_ROUTES) {
        expect(sitemapContent).toContain(`<loc>${CANONICAL}${route}/</loc>`);
    }
});

test('content and downloads remain usable with JavaScript disabled', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    try {
        await page.goto(HOME);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Denis Stepulenok');
        await expect(page.locator('#experience')).toContainText('Kuehne+Nagel');
        await expect(page.locator('#overview a[download]')).toBeVisible();
        await page.goto(`${HOME}experience/`);
        const details = page.locator('details.compact-role').first();
        await details.locator('summary').click();
        await expect(details).toHaveAttribute('open', '');
        await page.goto(`${HOME}architecture/`);
        await page.getByText('Open static diagrams', { exact: true }).click();
        const staticDiagrams = page.locator('#static-diagrams a[href$=".svg"]');
        await expect(staticDiagrams).toHaveCount(4);
        await expect(staticDiagrams.first()).toBeVisible();
    } finally {
        await context.close();
    }
});

for (const theme of ['light', 'dark']) {
    test(`WCAG 2.1 AA accessibility check passes in ${theme} mode`, async ({ page }) => {
        await page.goto(HOME);
        if (theme === 'dark') {
            await page.locator('#theme-toggle').click();
            await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        }
        for (const route of ['', ...DETAIL_ROUTES.map((name) => name + '/')]) {
            if (route) await page.goto(HOME + route);
            const results = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                .analyze();
            expect(results.violations, route || 'homepage').toEqual([]);
        }
    });
}
