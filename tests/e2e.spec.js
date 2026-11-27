const fs = require('node:fs');
const path = require('node:path');
const { expect, test } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const HOME = '/CV/';
const CANONICAL = 'https://stden.github.io/CV/';
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'docs', 'screenshots');
const VIEWPORTS = [375, 390, 768, 1024, 1440, 1920];
const SECTIONS = ['overview', 'experience', 'projects', 'skills', 'architecture', 'education', 'contact'];
const GENERAL_PDF = 'Denis-Stepulenok-Senior-Software-Engineer.pdf';
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
        await expect(overview).toContainText('Senior Software Engineer | Java, Distributed Systems & AI Engineering');
        await expect(overview).toContainText('Tallinn, Estonia');
        await expect(overview).toContainText('Kuehne+Nagel');
        await expect(overview).toContainText('Oracle');
        await expect(overview).toContainText('Bolt');
        const download = overview.getByRole('link', { name: /Download CV/i });
        await expect(download).toBeVisible();
        await expect(download).toHaveAttribute('href', `assets/pdf/${GENERAL_PDF}`);
        await expect(page.locator('.header-cv-btn')).toHaveAttribute('href', `assets/pdf/${GENERAL_PDF}`);
        await expect(page.locator('#contact').getByRole('link', { name: 'Download General CV', exact: true }))
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

test('navigation, mobile menu, earlier roles disclosure, skills filter, theme switcher, and contact actions work', async ({ page, baseURL, request }) => {
    const issues = attachIssueTracker(page, baseURL);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(HOME);

    for (const id of SECTIONS) {
        await expect(page.locator(`#${id}`)).toBeAttached();
    }

    // Earlier experience expandable <details>
    const firstCompact = page.locator('details.compact-role').first();
    await firstCompact.locator('summary').click();
    await expect(firstCompact).toHaveAttribute('open', '');

    // Skill tier filter and zero percentage bars
    await expect(page.locator('.level-bar-inner')).toHaveCount(0);
    const personalFilter = page.getByRole('button', { name: 'Personal', exact: true });
    await personalFilter.click();
    await expect(personalFilter).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.skill-items li[data-tier="core"]:not([hidden])')).toHaveCount(0);
    await page.getByRole('button', { name: 'All', exact: true }).click();

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

    expect(issues).toEqual([]);
});

test('interactive architecture tabs and component inspector update cleanly', async ({ page, baseURL }) => {
    const issues = attachIssueTracker(page, baseURL);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(HOME);

    const archSection = page.locator('#architecture');
    await archSection.scrollIntoViewIfNeeded();

    const secondTab = page.getByRole('tab', { name: 'Secure Document Delivery' });
    await secondTab.click();
    await expect(secondTab).toHaveAttribute('aria-selected', 'true');

    const activePanel = page.locator('#arch-panel-document-link-gateway');
    await expect(activePanel).toBeVisible();
    const secondNodeBtn = activePanel.locator('.arch-component-btn[data-node-id="link-api"]');
    await secondNodeBtn.click();
    await expect(activePanel.locator('[data-field="title"]')).toHaveText('Link Generator API');
    await expect(activePanel.locator('[data-field="concepts"]')).toContainText('Security');

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
    expect(await sitemap.text()).toContain(`${CANONICAL}cv/wise.html`);
});

test('content and downloads remain usable with JavaScript disabled', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    try {
        await page.goto(HOME);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Denis Stepulenok');
        await expect(page.locator('#experience')).toContainText('Kuehne+Nagel');
        await expect(page.locator('#overview a[download]')).toBeVisible();
        const details = page.locator('details.compact-role').first();
        await details.locator('summary').click();
        await expect(details).toHaveAttribute('open', '');
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
        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();
        expect(results.violations).toEqual([]);
    });
}
