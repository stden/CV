const { expect, test } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const BASE = '/CV/';
const CANONICAL = 'https://stden.github.io';
const LOCALES = {
    en: {
        title: 'Senior Software Engineer — Java & Distributed Systems',
        location: 'Tallinn, Estonia',
        proficiency: ['Russian: Native', 'English: Intermediate'],
    },
    et: {
        title: 'Vanemtarkvarainsener — Java ja hajussüsteemid',
        location: 'Tallinn, Eesti',
        proficiency: ['Vene keel: Emakeel', 'Inglise keel: Kesktase'],
    },
    de: {
        title: 'Senior Software Engineer – Java und verteilte Systeme',
        location: 'Tallinn, Estland',
        proficiency: ['Russisch: Muttersprache', 'Englisch: Mittelstufe'],
    },
    ru: {
        title: 'Старший инженер-программист — Java и распределённые системы',
        location: 'Таллин, Эстония',
        proficiency: ['Русский: Родной', 'Английский: Средний уровень'],
    },
};
const ROUTES = [
    'experience/', 'skills/', 'projects/', 'architecture/', 'contact/',
    'cv/index.html', 'cv/general.html', 'tech/java.html',
];

function localizedPath(locale, route = '') {
    return locale === 'en' ? `${BASE}${route}` : `${BASE}${locale}/${route}`;
}

function languageLink(page, locale) {
    return page.locator(`nav.language-menu a[data-locale="${locale}"]`);
}

async function expectLanguageNavigation(page, locale, route = '') {
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('link[rel="canonical"]'))
        .toHaveAttribute('href', CANONICAL + localizedPath(locale, route));
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]'))
        .toHaveAttribute('href', CANONICAL + BASE);
    await expect(page.locator('nav.language-menu a[aria-current="page"]'))
        .toHaveAttribute('data-locale', locale);
    for (const target of Object.keys(LOCALES)) {
        const link = languageLink(page, target);
        const expected = localizedPath(target, route);
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute('lang', target);
        await expect(link).toHaveAttribute('hreflang', target);
        await expect(link).toHaveJSProperty('pathname', expected);
        await expect(page.locator(`link[rel="alternate"][hreflang="${target}"]`))
            .toHaveAttribute('href', CANONICAL + expected);
    }
}

for (const [locale, facts] of Object.entries(LOCALES)) {
    test(`${locale}: mobile homepage, accessibility and CV download`, async ({ page, request }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const response = await page.goto(localizedPath(locale));
        expect(response?.status()).toBe(200);
        await expectLanguageNavigation(page, locale);

        const hero = page.locator('#overview');
        await expect(hero).toContainText(facts.title);
        await expect(hero).toContainText(facts.location);
        const overflow = await page.evaluate(async () => {
            await document.fonts.ready;
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        expect(overflow).toBe(false);

        const accessibility = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();
        expect(accessibility.violations).toEqual([]);

        const link = hero.locator('a[download]');
        const filename = `Denis-Stepulenok-CV-${locale.toUpperCase()}.pdf`;
        const pdfPath = `${BASE}assets/pdf/${filename}`;
        await expect(link).toHaveJSProperty('pathname', pdfPath);
        const pdf = await request.get(pdfPath);
        expect(pdf.status()).toBe(200);
        expect((await pdf.body()).subarray(0, 5).toString('ascii')).toBe('%PDF-');
        const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
        expect(download.suggestedFilename()).toBe(filename);
        expect(await download.failure()).toBeNull();
    });

    test(`${locale}: detail routes have matching translations and preserve CV facts`, async ({ page }) => {
        for (const route of ROUTES) {
            const response = await page.goto(localizedPath(locale, route));
            expect(response?.status(), route).toBe(200);
            await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
            await expectLanguageNavigation(page, locale, route);
        }
        await page.goto(localizedPath(locale, 'experience/'));
        const experience = page.locator('#experience');
        for (const [id, name, years] of [
            ['kuehne-nagel', 'Kuehne+Nagel', ['2018']],
            ['taxify-bolt', 'Taxify (now Bolt)', ['2017', '2018']],
            ['oracle', 'Oracle', ['2014', '2017']],
        ]) {
            const role = experience.locator(`article#role-${id}`);
            await expect(role.locator('.role-company')).toContainText(name);
            for (const year of years) await expect(role.locator('.role-period')).toContainText(year);
        }
        await expect(page.locator('#education article .bullet-list > li')).toHaveText(facts.proficiency);
    });
}

test('explicit selection stores a language and keeps it on internal routes', async ({ page }) => {
    await page.goto(BASE);
    expect(await page.evaluate(() => localStorage.getItem('cv-language'))).toBeNull();

    await languageLink(page, 'de').click();
    await expect(page).toHaveURL(/\/CV\/de\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    expect(await page.evaluate(() => localStorage.getItem('cv-language'))).toBe('de');

    await page.locator('#experience a[href="experience/"]').click();
    await expect(page).toHaveURL(/\/CV\/de\/experience\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    expect(await page.evaluate(() => localStorage.getItem('cv-language'))).toBe('de');

    await languageLink(page, 'ru').click();
    await expect(page).toHaveURL(/\/CV\/ru\/experience\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    expect(await page.evaluate(() => localStorage.getItem('cv-language'))).toBe('ru');
    await page.goto(BASE);
    await expect(page).toHaveURL(/\/CV\/ru\/$/);
    await languageLink(page, 'en').click();
    await expect(page).toHaveURL(/\/CV\/$/);
    expect(await page.evaluate(() => localStorage.getItem('cv-language'))).toBe('en');
});

test('language and content navigation work at mobile width without JavaScript', async ({ browser, baseURL }) => {
    const context = await browser.newContext({
        baseURL,
        javaScriptEnabled: false,
        viewport: { width: 390, height: 844 },
    });
    try {
        const page = await context.newPage();
        await page.goto(localizedPath('et', 'projects/'));
        await languageLink(page, 'ru').click();
        await expect(page).toHaveURL(/\/CV\/ru\/projects\/$/);
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Независимые инженерные проекты');

        await languageLink(page, 'en').click();
        await expect(page).toHaveURL(/\/CV\/projects\/$/);
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Independent engineering projects');
    } finally {
        await context.close();
    }
});

test('a new visitor gets English regardless of browser language', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, locale: 'de-DE' });
    try {
        const page = await context.newPage();
        await page.goto(BASE);
        await expect(page).toHaveURL(/\/CV\/$/);
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        expect(await page.evaluate(() => localStorage.getItem('cv-language'))).toBeNull();
    } finally {
        await context.close();
    }
});

test('Inter renders Latin Extended and Cyrillic glyphs using the expected subsets', async ({ page }) => {
    await page.goto(localizedPath('et'));
    const latinExtended = await page.evaluate(async () => {
        const fonts = await document.fonts.load('400 16px Inter', 'ŠŽšž');
        return fonts.some((font) => font.status === 'loaded' && /u\+0*100-0*2ba/i.test(font.unicodeRange));
    });
    expect(latinExtended).toBe(true);

    await page.goto(localizedPath('ru'));
    const cyrillic = await page.evaluate(async () => {
        const fonts = await document.fonts.load('400 16px Inter', 'Ёжик');
        return fonts.some((font) => font.status === 'loaded' && /u\+0*400-0*45f/i.test(font.unicodeRange));
    });
    expect(cyrillic).toBe(true);
});
