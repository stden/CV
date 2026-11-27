const { defineConfig } = require('@playwright/test');

const origin = 'http://127.0.0.1:4173';

module.exports = defineConfig({
    testDir: 'tests',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    workers: process.env.CI ? 2 : 3,
    reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: origin,
        browserName: 'chromium',
        trace: 'retain-on-failure',
    },
    webServer: {
        command: 'node scripts/serve.js --port 4173',
        url: `${origin}/CV/`,
        reuseExistingServer: !process.env.CI,
    },
});
