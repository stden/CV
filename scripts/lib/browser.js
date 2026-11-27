const fs = require('node:fs');
const { chromium } = require('playwright');

function resolveChromeExecutable() {
    if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
        return process.env.CHROME_PATH;
    }
    const defaultPath = chromium.executablePath();
    if (defaultPath && fs.existsSync(defaultPath)) {
        return defaultPath;
    }
    for (const candidate of ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return undefined;
}

async function launchChromium() {
    const executablePath = resolveChromeExecutable();
    return chromium.launch({
        ...(executablePath ? { executablePath } : {}),
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
}

module.exports = {
    resolveChromeExecutable,
    launchChromium,
};
