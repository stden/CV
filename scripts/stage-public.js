const fs = require('node:fs');
const path = require('node:path');
const { ROOT_DIR, loadCvData } = require('./lib/utils');
const { publicFiles, validatePublicLinks } = require('./lib/public-artifact');
const { runConfidentialityCheck, ConfidentialityCheckError } = require('./check-confidentiality');

const buildDir = path.join(ROOT_DIR, '.build');
const artifactPath = path.join(ROOT_DIR, '_site');

function withValidatedPublicArtifact(data, use) {
    const files = publicFiles(data);
    fs.mkdirSync(buildDir, { recursive: true });
    const staging = fs.mkdtempSync(path.join(buildDir, 'public-'));
    const sourceRoot = fs.realpathSync(ROOT_DIR);
    try {
        for (const file of files) {
            const to = path.join(staging, file);
            fs.mkdirSync(path.dirname(to), { recursive: true });
            if (file === '.nojekyll') {
                fs.writeFileSync(to, '');
                continue;
            }
            const from = file === 'assets/fonts/INTER-LICENSE.txt'
                ? path.join(ROOT_DIR, 'node_modules', '@fontsource-variable', 'inter', 'LICENSE')
                : path.join(ROOT_DIR, file);
            const expectedSource = path.join(sourceRoot, path.relative(ROOT_DIR, from));
            if (!fs.lstatSync(from).isFile() || fs.realpathSync(from) !== expectedSource) {
                throw new Error('PUBLIC_ARTIFACT_INVALID_FILE');
            }
            fs.copyFileSync(from, to);
        }
        runConfidentialityCheck({ artifactRoot: staging, cvData: data });
        validatePublicLinks(staging, data.site.baseUrl, files);
        return use(staging, files);
    } finally {
        fs.rmSync(staging, { recursive: true, force: true });
    }
}

if (require.main === module) {
    try {
        withValidatedPublicArtifact(loadCvData(), (staging, files) => {
            // Replace only the generated publication directory after its replacement has passed checks.
            fs.rmSync(artifactPath, { recursive: true, force: true });
            fs.renameSync(staging, artifactPath);
            console.log(`Validated public artifact with ${files.length} allowlisted files.`);
        });
    } catch (error) {
        if (typeof ConfidentialityCheckError === 'function' && error instanceof ConfidentialityCheckError) {
            console.error(error.message);
        } else {
            console.error(/^(?:PUBLIC_[A-Z_]+)$/.test(error.message) ? error.message : 'PUBLIC_ARTIFACT_BUILD_FAILED');
        }
        process.exitCode = 1;
    }
}

module.exports = { withValidatedPublicArtifact, artifactPath };
