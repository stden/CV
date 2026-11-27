const { readFile } = require('node:fs/promises');
const { expect, test } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');

const HOME = '/CV/';
const CANONICAL = 'https://stden.github.io/CV/';
const SECTIONS = ['overview', 'experience', 'projects', 'skills', 'architecture', 'education', 'contact'];
const VARIANTS = ['java-backend', 'distributed-systems', 'fintech-integrations', 'ai-mcp', 'full', 'wise'];
const DIAGRAMS = ['document-link-gateway', 'xml-transformation-pipeline', 'messenger-archive-search', 'distributed-background-processing'];
const STANDARDS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

function captureBrowserIssues(page, baseURL) {
    const origin = new URL(baseURL).origin;
    const issues = [];
    page.on('pageerror', (error) => issues.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error') issues.push(message.text());
    });
    page.on('response', (response) => {
        if (response.url().startsWith(`${origin}/`) && response.status() >= 400) {
            issues.push(`${response.status()} ${response.url()}`);
        }
    });
    page.on('requestfailed', (request) => {
        if (request.url().startsWith(`${origin}/`)) {
            issues.push(`${request.failure().errorText} ${request.url()}`);
        }
    });
    return issues;
}

for (const width of [375, 390, 768, 1024, 1440, 1920]) {
    test(`the homepage fits at ${width}px with its assets loaded`, async ({ page, baseURL }, testInfo) => {
        const issues = captureBrowserIssues(page, baseURL);
        await page.setViewportSize({ width, height: width < 768 ? 844 : 960 });
        expect((await page.goto(HOME)).ok()).toBe(true);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Denis Stepulenok');
        const overview = page.locator('#overview');
        await expect(overview).toContainText('Senior Software Engineer');
        await expect(overview).toContainText('Tallinn, Estonia');
        await expect(overview).toContainText('Kuehne+Nagel');
        await expect(overview).toContainText('Oracle');
        await expect(overview).toContainText('Bolt');
        await expect(overview).not.toContainText(/open to work/i);
        await expect(overview.getByRole('link', { name: /Download CV/i })).toBeVisible();
        await page.evaluate(async () => {
            await document.fonts.ready;
            await Promise.all(Array.from(document.images, async (image) => {
                image.loading = 'eager';
                await image.decode();
            }));
        });
        const layout = await page.evaluate(() => ({
            contentWidth: document.documentElement.scrollWidth,
            viewportWidth: document.documentElement.clientWidth,
        }));
        expect(layout.contentWidth).toBeLessThanOrEqual(layout.viewportWidth);

        if (width === 390 || width === 1440) {
            await page.screenshot({
                path: testInfo.outputPath(`portfolio-${width}.png`),
                fullPage: true,
                animations: 'disabled',
            });
        }
        expect(issues).toEqual([]);
    });
}

test('navigation reaches each portfolio section', async ({ page }) => {
    await page.goto(HOME);
    const navigation = page.getByRole('navigation', { name: /primary navigation/i });
    for (const section of SECTIONS) {
        await expect(page.locator(`#${section}`)).toBeVisible();
        const link = navigation.locator(`a[href="#${section}"]`);
        await expect(link).toBeVisible();
        await link.click();
        await expect(page).toHaveURL(new RegExp(`/CV/#${section}$`));
    }
});

test('the compact menu works by keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(HOME);
    const menu = page.locator('#mobile-menu');
    const summary = menu.locator('summary');
    await summary.focus();
    await expect(summary).toBeFocused();
    await summary.press('Enter');
    await expect(menu).toHaveAttribute('open', '');
    const contact = menu.getByRole('link', { name: 'Contact', exact: true });
    await contact.focus();
    await contact.press('Enter');
    await expect(page).toHaveURL(/\/CV\/#contact$/);
});

test('the theme preference survives reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(HOME);
    const toggle = page.getByRole('button', { name: /dark theme/i });
    const bodyBackground = () => page.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    const lightBackground = await bodyBackground();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(bodyBackground).not.toBe(lightBackground);
    await page.reload();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});

test('contact links and email copying use the published address', async ({ context, page }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(HOME);
    const contact = page.locator('#contact');
    const email = contact.getByRole('link', { name: /send email/i });
    await expect(email).toHaveAttribute('href', 'mailto:super.denis@gmail.com');
    await expect(contact.getByRole('link', { name: /LinkedIn/i })).toHaveAttribute('href', /^https:\/\/(?:www|ee)\.linkedin\.com\/in\/denis-stepulenok(?:-2149b514)?\/?$/);
    await expect(contact.getByRole('link', { name: /GitHub/i })).toHaveAttribute('href', 'https://github.com/stden');
    await contact.getByRole('button', { name: /copy email/i }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('super.denis@gmail.com');
});

test('the main CV download produces a PDF file', async ({ page }) => {
    await page.goto(HOME);
    const downloadReady = page.waitForEvent('download');
    await page.locator('#overview').getByRole('link', { name: /Download CV/i }).click();
    const download = await downloadReady;
    expect(download.suggestedFilename()).toBe('Denis-Stepulenok-Full-CV.pdf');
    const buffer = await readFile(await download.path());
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
});

test('all six CV variants have distinct canonical pages and PDF assets', async ({ page, request }) => {
    await page.goto(HOME);
    const filenames = new Set();
    for (const variant of VARIANTS) {
        const route = `${HOME}cv/${variant}/`;
        await expect(page.locator(`a[href="cv/${variant}/"]`).first()).toBeAttached();
        expect((await request.get(route)).ok()).toBe(true);
    }
    for (const variant of VARIANTS) {
        const route = `${HOME}cv/${variant}/`;
        await page.goto(route);
        await expect(page.getByRole('main')).toContainText('Kuehne+Nagel');
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${CANONICAL}cv/${variant}/`);
        const download = page.getByRole('link', { name: /download/i }).filter({ hasNotText: /portfolio/i }).first();
        const href = await download.getAttribute('href');
        const pdf = new URL(href, page.url());
        expect(pdf.pathname).toMatch(/^\/CV\/downloads\/Denis-Stepulenok-.+\.pdf$/);
        filenames.add(pdf.pathname);
        const response = await request.get(pdf.toString());
        expect(response.ok()).toBe(true);
        expect((await response.body()).subarray(0, 5).toString('ascii')).toBe('%PDF-');
    }
    expect(filenames.size).toBe(VARIANTS.length);
});

test('the architecture diagrams and original technology pages load under /CV/', async ({ page, request }) => {
    await page.goto(HOME);
    const details = page.locator('#architecture details').first();
    const firstComponent = details.locator('summary');
    await firstComponent.focus();
    await firstComponent.press('Enter');
    await expect(details).toHaveAttribute('open', '');
    await expect(details.locator('p')).toBeVisible();
    for (const diagram of DIAGRAMS) {
        const response = await request.get(`${HOME}assets/images/projects/${diagram}.svg`);
        expect(response.ok()).toBe(true);
        expect(await response.text()).toMatch(/<svg[\s\S]*<title/);
    }
    const techLinks = await page.locator('a[href^="tech/"]').evaluateAll((links) =>
        [...new Set(links.map((link) => link.href))]);
    expect(techLinks.length).toBeGreaterThanOrEqual(20);
    await Promise.all(techLinks.map(async (link) => {
        expect(new URL(link).pathname).toMatch(/^\/CV\/tech\/.+\.html$/);
        const response = await request.get(link);
        expect(response.ok(), link).toBe(true);
        expect(await response.text()).toMatch(/<h1\b/);
    }));
});

test('meta tags, structured data and discovery files describe the canonical public site', async ({ page, request }) => {
    await page.goto(HOME);
    await expect(page).toHaveTitle(/Denis Stepulenok.*(Java|Software Engineer)/i);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Java/i);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', CANONICAL);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', CANONICAL);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https:\/\/stden\.github\.io\/CV\//);
    const schema = (await page.locator('script[type="application/ld+json"]').allTextContents()).join('\n');
    expect(schema).toMatch(/"@type"\s*:\s*"Person"/);
    expect(schema).toMatch(/"@type"\s*:\s*"ProfilePage"/);
    const robots = await request.get(`${HOME}robots.txt`);
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain(`${CANONICAL}sitemap.xml`);
    const sitemap = await request.get(`${HOME}sitemap.xml`);
    expect(sitemap.ok()).toBe(true);
    expect(await sitemap.text()).toContain(`${CANONICAL}cv/wise/`);
});

test('content, architecture disclosure and a download link work without JavaScript', async ({ browser, baseURL }) => {
    const page = await browser.newPage({ javaScriptEnabled: false, baseURL });
    try {
        await page.goto(HOME);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Denis Stepulenok');
        await expect(page.locator('#experience')).toContainText('Oracle');
        await expect(page.locator('#overview').getByRole('link', { name: /Download CV/i })).toBeVisible();
        const component = page.locator('#architecture details').first();
        await component.locator('summary').click();
        await expect(component).toHaveAttribute('open', '');
        await expect(page.locator('#contact a[href^="mailto:"]').first()).toBeVisible();
    } finally {
        await page.close();
    }
});

for (const theme of ['light', 'dark']) {
    test(`the ${theme} homepage passes automated WCAG checks`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme });
        await page.goto(HOME);
        const results = await new AxeBuilder({ page }).withTags(STANDARDS).analyze();
        expect(results.violations).toEqual([]);
    });
}
