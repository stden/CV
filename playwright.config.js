const { defineConfig } = require('@playwright/test');
const { resolveChromeExecutable } = require('./scripts/lib/browser');

const origin = 'http://127.0.0.1:4174';
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
        command: 'node scripts/serve-subpath.js --port 4174',
        url: `${origin}/CV/`,
        reuseExistingServer: !process.env.CI,
    },
});
