import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent } from '../scripts/lib/content.mjs';

const content = loadContent();
const EMAIL = content.cv.contact.email;
const WIDTHS = [375, 390, 768, 1024, 1440, 1920];
const SCREENSHOTS = join('test-results', 'screenshots');
const PAGES = ['./', 'cv/full/', 'cv/senior-java-backend/', 'projects/messenger-archive-search/', 'tech/java.html'];

// Lazy images (the architecture diagrams) load only near the viewport. For a
// full-page capture, switch them to eager loading and wait until they are complete.
async function loadLazyImages(page) {
  await page.evaluate(() => {
    for (const image of document.querySelectorAll('img[loading="lazy"]')) image.loading = 'eager';
  });
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
}

async function noHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page must not scroll sideways').toBeLessThanOrEqual(0);
}

test.describe('home page', () => {
  test('shows the name, professional title, location and the primary actions', async ({ page }) => {
    await page.goto('./');
    await expect(page).toHaveTitle(/Denis Stepulenok/);
    await expect(page.getByRole('heading', { level: 1, name: 'Denis Stepulenok' })).toBeVisible();
    await expect(page.getByText('Senior Software Engineer | Java, Distributed Systems & AI Engineering')).toBeVisible();
    await expect(page.getByText('Tallinn, Estonia').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download CV (PDF)' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Contact' }).first()).toBeVisible();
  });

  test('navigation reaches all seven sections', async ({ page }) => {
    await page.goto('./');
    const nav = page.getByRole('navigation', { name: 'Sections' });
    for (const label of ['Overview', 'Experience', 'Projects', 'Skills', 'Architecture', 'Education', 'Contact']) {
      await nav.getByRole('link', { name: label }).click();
      const id = label.toLowerCase();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(page.locator(`#${id}`)).toBeInViewport();
    }
  });

  test('the Kuehne+Nagel role is first and marked as current', async ({ page }) => {
    await page.goto('./');
    const first = page.locator('.timeline__item').first();
    await expect(first.getByRole('heading', { level: 3 })).toContainText('Senior Java Developer');
    await expect(first).toContainText('Current role');
    await expect(page.locator('.timeline__item').nth(1)).toContainText('Taxify (now Bolt)');
  });

  test('earlier experience is collapsed and expands on demand', async ({ page }) => {
    await page.goto('./');
    const earlier = page.locator('details.earlier');
    await expect(earlier).not.toHaveAttribute('open', '');
    await earlier.locator('summary').click();
    await expect(earlier).toHaveAttribute('open', '');
    await expect(earlier).toContainText('Research & Engineering Center');
  });

  test('architecture components open to show their responsibilities', async ({ page }) => {
    await page.goto('./');
    const component = page.locator('details.component').first();
    await expect(component).not.toHaveAttribute('open', '');
    await component.locator('summary').click();
    await expect(component).toHaveAttribute('open', '');
    await expect(component).toContainText('Producers of XML requests');
  });

  test('no open-to-work banner and no skill percentages by default', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.availability')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(/\d\s?%/);
  });
});

test.describe('theme and copy controls', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('the theme toggle switches the theme and remembers it', async ({ page }) => {
    await page.goto('./');
    const toggle = page.locator('[data-theme-toggle]');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('copy email puts the address on the clipboard and announces it', async ({ page }) => {
    await page.goto('./#contact');
    await page.getByRole('button', { name: 'Copy email address' }).click();
    await expect(page.locator('[data-copy-status]')).toHaveText('Email address copied.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(EMAIL);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the content is complete and the JavaScript-only controls are hidden', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1, name: 'Denis Stepulenok' })).toBeVisible();
    await expect(page.locator('.timeline__item')).toHaveCount(3);
    await expect(page.locator('[data-theme-toggle]')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Copy email address' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Send email' })).toBeVisible();
  });
});

test.describe('downloads', () => {
  test('every PDF link on the home page returns a real PDF', async ({ page, request }) => {
    await page.goto('./');
    const links = await page.locator('a[download]').evaluateAll((anchors) => anchors.map((anchor) => anchor.href));
    expect(links.length).toBeGreaterThanOrEqual(7);
    for (const href of links) {
      const response = await request.get(href);
      expect(response.status(), href).toBe(200);
      expect(response.headers()['content-type'], href).toContain('application/pdf');
      expect((await response.body()).subarray(0, 4).toString(), href).toBe('%PDF');
    }
  });

  test('each targeted CV page offers its own PDF', async ({ page }) => {
    for (const variant of content.variants) {
      await page.goto(`cv/${variant.slug}/`);
      await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveAttribute('href', `../../downloads/${variant.pdf}`);
    }
  });
});

test.describe('layout across viewport widths', () => {
  for (const width of WIDTHS) {
    test(`no sideways scrolling at ${width}px on the home page and a CV page`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('./');
      await noHorizontalOverflow(page);
      await page.goto('cv/senior-java-backend/');
      await noHorizontalOverflow(page);
    });
  }

  test('screenshots for review at desktop and mobile widths, in both themes', async ({ page }) => {
    mkdirSync(SCREENSHOTS, { recursive: true });
    for (const [width, label] of [[1440, 'desktop'], [390, 'mobile']]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ['light', 'dark']) {
        await page.goto('./');
        await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
        await loadLazyImages(page);
        await page.screenshot({ path: join(SCREENSHOTS, `home-${label}-${theme}.png`), fullPage: true });
      }
    }
  });
});

test.describe('pages are clean', () => {
  for (const path of PAGES) {
    test(`${path} has no console errors or failed requests`, async ({ page }) => {
      const problems = [];
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(`console: ${message.text()}`);
      });
      page.on('pageerror', (error) => problems.push(`exception: ${error.message}`));
      page.on('requestfailed', (request) => problems.push(`failed request: ${request.url()}`));
      await page.goto(path);
      expect(problems).toEqual([]);
    });

    test(`${path} has no serious or critical accessibility violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const serious = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact));
      expect(serious.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
    });
  }
});

test.describe('keyboard and motion', () => {
  test('the skip link is the first focus stop', async ({ page }) => {
    await page.goto('./');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  });

  test.describe('with reduced motion requested', () => {
    test.use({ reducedMotion: 'reduce' });
    test('smooth scrolling is switched off', async ({ page }) => {
      await page.goto('./');
      const behaviour = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
      expect(behaviour).toBe('auto');
    });
  });
});

test.describe('site structure under /CV/', () => {
  test('a link from the home page to a case study keeps the /CV/ prefix', async ({ page }) => {
    await page.goto('./');
    await page.locator('a[href="projects/xml-transformation-pipeline/"]').first().click();
    await expect(page).toHaveURL(/\/CV\/projects\/xml-transformation-pipeline\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('XML Transformation Pipeline');
  });

  test('every technology page has its heading and a way back to the skills', async ({ page }) => {
    for (const technology of content.technologies) {
      await page.goto(`tech/${technology.slug}.html`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(technology.title);
      await expect(page.getByRole('link', { name: /Back to skills/ })).toBeVisible();
    }
  });
});
