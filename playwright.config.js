const { defineConfig } = require('@playwright/test');
const { resolveChromeExecutable } = require('./scripts/lib/browser');

const port = Number(process.env.CV_PREVIEW_PORT ?? 4174);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid CV_PREVIEW_PORT');
const origin = `http://127.0.0.1:${port}`;
const executablePath = resolveChromeExecutable();

module.exports = defineConfig({
    testDir: 'tests',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    workers: process.env.CI ? 2 : 3,
    reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: origin,
        browserName: 'chromium',
        ...(executablePath ? { launchOptions: { executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] } } : {}),
        trace: 'retain-on-failure',
    },
    webServer: {
        command: `node scripts/serve-subpath.js --port ${port}`,
        url: `${origin}/CV/`,
        reuseExistingServer: false,
    },
});
