const fs = require('node:fs');
const path = require('node:path');
const { expect, test } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

// Browser tests for the language switcher, the remembered preference and the
// translated pages. The site is served under /CV/ as on GitHub Pages.
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'docs', 'screenshots');
const VIEWPORTS = [375, 390, 768, 1024, 1440, 1920];
const LANGS = [
    { code: 'en', path: '/CV/', pdf: 'Denis-Stepulenok-CV-EN.pdf', htmlLang: 'en' },
    { code: 'et', path: '/CV/et/', pdf: 'Denis-Stepulenok-CV-ET.pdf', htmlLang: 'et' },
    { code: 'de', path: '/CV/de/', pdf: 'Denis-Stepulenok-CV-DE.pdf', htmlLang: 'de' },
    { code: 'ru', path: '/CV/ru/', pdf: 'Denis-Stepulenok-CV-RU.pdf', htmlLang: 'ru' },
];

async function noSidewaysScroll(page) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'page must not scroll sideways').toBeLessThanOrEqual(0);
}

function switcher(page) {
    return page.locator('.header-actions .lang-switcher');
}

test.describe('language switcher on desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('the switcher shows the four languages and marks the current one', async ({ page }) => {
        await page.goto('/CV/');
        const links = switcher(page).locator('a');
        await expect(links).toHaveCount(4);
        await expect(switcher(page).locator('a[aria-current="true"]')).toHaveText(/EN/);
        await expect(switcher(page).locator('a[hreflang="et"]')).toHaveText(/ET/);
        await expect(switcher(page).locator('a[hreflang="de"]')).toHaveText(/DE/);
        await expect(switcher(page).locator('a[hreflang="ru"]')).toHaveText(/RU/);
    });

    test('switching language opens the equivalent page in that language', async ({ page }) => {
        await page.goto('/CV/experience/index.html');
        await switcher(page).locator('a[hreflang="et"]').click();
        await expect(page).toHaveURL(/\/CV\/et\/experience\/index\.html$/);
        await expect(page.locator('html')).toHaveAttribute('lang', 'et');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kogemus');

        await switcher(page).locator('a[hreflang="ru"]').click();
        await expect(page).toHaveURL(/\/CV\/ru\/experience\/index\.html$/);
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    });

    test('a page without a translation switches to the locale homepage', async ({ page }) => {
        await page.goto('/CV/architecture/index.html');
        await switcher(page).locator('a[hreflang="de"]').click();
        await expect(page).toHaveURL(/\/CV\/de\/(index\.html)?$/);
        await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    });

    test('the switcher is reachable with the keyboard', async ({ page }) => {
        await page.goto('/CV/');
        const etLink = switcher(page).locator('a[hreflang="et"]');
        await etLink.focus();
        await expect(etLink).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/\/CV\/et\/(index\.html)?$/);
    });

    test('the Download CV button offers the resume of the page language', async ({ page, request }) => {
        for (const lang of LANGS) {
            await page.goto(lang.path);
            const href = await page.locator('.header-cv-btn').getAttribute('href');
            expect(href, `${lang.code} download link`).toContain(lang.pdf);
            const response = await request.get(new URL(href, page.url()).toString());
            expect(response.status(), `${lang.code} PDF status`).toBe(200);
            expect(response.headers()['content-type'], `${lang.code} PDF type`).toContain('application/pdf');
        }
    });
});

test.describe('language switcher on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('the switcher moves into the menu drawer and still switches language', async ({ page }) => {
        await page.goto('/CV/');
        await expect(switcher(page)).toBeHidden();
        await page.locator('#nav-toggle').click();
        const drawer = page.locator('#mobile-drawer .lang-switcher');
        await expect(drawer).toBeVisible();
        await drawer.locator('a[hreflang="ru"]').click();
        await expect(page).toHaveURL(/\/CV\/ru\/(index\.html)?$/);
    });
});

test.describe('remembered language preference', () => {
    test('the chosen language is remembered and offered, never forced', async ({ page }) => {
        await page.goto('/CV/');
        await switcher(page).locator('a[hreflang="de"]').click();
        await expect(page).toHaveURL(/\/CV\/de\/(index\.html)?$/);

        // A new visit to the English homepage: no redirect, but the hint offers German.
        await page.goto('/CV/');
        await expect(page).toHaveURL(/\/CV\/$/);
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        const hint = page.locator('[data-lang-hint]');
        await expect(hint).toBeVisible();
        await expect(hint.locator('a')).toHaveAttribute('href', /\/CV\/de\/(index\.html)?$/);
    });

    test('without a stored choice there is no hint', async ({ page }) => {
        await page.goto('/CV/');
        await expect(page.locator('[data-lang-hint]')).toBeHidden();
    });
});

test.describe('each language homepage', () => {
    for (const lang of LANGS) {
        test(`${lang.code} homepage: language, metadata, no errors, no sideways scrolling`, async ({ page, baseURL }) => {
            const issues = [];
            page.on('pageerror', (error) => issues.push(error.message));
            page.on('console', (message) => {
                if (message.type() === 'error') issues.push(message.text());
            });
            await page.goto(lang.path);
            await expect(page.locator('html')).toHaveAttribute('lang', lang.htmlLang);
            await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/CV${lang.code === 'en' ? '' : '/' + lang.code}/$`));
            const alternates = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((links) => links.map((link) => link.getAttribute('hreflang')));
            expect(alternates.sort()).toEqual(['de', 'en', 'et', 'ru', 'x-default']);
            expect(issues).toEqual([]);
            for (const width of VIEWPORTS) {
                await page.setViewportSize({ width, height: 900 });
                await noSidewaysScroll(page);
            }
        });

        test(`${lang.code} homepage passes the accessibility check (serious and critical)`, async ({ page }) => {
            await page.setViewportSize({ width: 1440, height: 900 });
            await page.goto(lang.path);
            const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
            const blocking = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact));
            expect(blocking.map((violation) => violation.id)).toEqual([]);
        });
    }
});

test.describe('screenshots for review in every language', () => {
    test('desktop and mobile homepage captures', async ({ page }) => {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
        for (const lang of LANGS) {
            for (const [label, width] of [['desktop', 1440], ['mobile', 390]]) {
                await page.setViewportSize({ width, height: 900 });
                await page.goto(lang.path);
                await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${lang.code}-home-${label}.png`), fullPage: true });
            }
        }
    });
});
