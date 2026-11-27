const fs = require('node:fs');
const { loadCvData } = require('./lib/utils');
const { localeCodes, loadLocales, localizedPath, localizedPdfName } = require('./lib/i18n');
const { publicFiles } = require('./lib/public-artifact');
const { compare, PROMPTS, readCorpus } = require('./lib/public-cv-evaluation');
const { facts } = require('./lib/public-cv-evaluation-rubric');

const USAGE = 'node scripts/evaluate-public-cv.js --baseline PATH --improved PATH [--answers FILE]\nnode scripts/evaluate-public-cv.js --prompts';
const ANSWER_LIMIT = 1024 * 1024;
const ANSWER_ERROR = 'PUBLIC_EVAL_ANSWERS_INVALID';
const ARGUMENT_ERROR = 'PUBLIC_EVAL_ARGUMENTS_INVALID';

function parseArguments(args) {
    const options = {};
    for (let index = 0; index < args.length; index += 2) {
        const name = args[index];
        const value = args[index + 1];
        if (!['--baseline', '--improved', '--answers'].includes(name) || options[name] || !value || value.startsWith('--')) {
            throw new Error(ARGUMENT_ERROR);
        }
        options[name] = value;
    }
    if (!options['--baseline'] || !options['--improved']) throw new Error(ARGUMENT_ERROR);
    return options;
}

function readAnswers(file) {
    if (!file) return undefined;
    try {
        const stat = fs.statSync(file);
        if (!stat.isFile() || stat.size > ANSWER_LIMIT) throw new Error(ANSWER_ERROR);
        const response = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (response === null) throw new Error(ANSWER_ERROR);
        return response;
    } catch {
        throw new Error(ANSWER_ERROR);
    }
}

function localeProbes(data, dictionaries) {
    return Object.fromEntries(localeCodes.map((code) => {
        const dictionary = dictionaries[code];
        return [code, {
            html: ['index.html', 'experience/index.html'].map((file) => localizedPath(code, file)),
            pdf: `assets/pdf/${localizedPdfName(code)}`,
            markers: [data.profile.name, dictionary['profile.location'], data.experience[0].company, dictionary['cv.general.roleTitle']],
            languageLevel: [dictionary['language.english.name'], dictionary['language.english.level']],
        }];
    }));
}

function run(args) {
    if (args.length === 1 && args[0] === '--help') return USAGE;
    if (args.length === 1 && args[0] === '--prompts') return {
        prompts: Object.fromEntries(PROMPTS.map(({ id, prompt }) => [id, prompt])),
        responseFormat: {
            description: 'Enter English answers as arrays of atomic claims, one array for each prompt in each snapshot. Quote local source passages verbatim. Empty arrays are accepted.',
            claim: { value: 'Concise English factual statement', citations: [{ source: 'Public artifact path or canonical same-site URL', quote: 'Exact public-source passage' }] },
            snapshots: Object.fromEntries(['baseline', 'improved'].map((snapshot) => [snapshot, Object.fromEntries(PROMPTS.map(({ id }) => [id, []]))])),
        },
        optionalLocalRubricIds: Object.keys(facts),
    };
    const options = parseArguments(args);
    const data = loadCvData();
    const settings = {
        baseUrl: data.site.baseUrl,
        allowed: publicFiles(data),
        excluded: ['robots.txt', 'assets/fonts/INTER-LICENSE.txt'],
        localeProbes: localeProbes(data, loadLocales(data)),
    };
    const answers = readAnswers(options['--answers']);
    return compare(readCorpus(options['--baseline'], settings), readCorpus(options['--improved'], settings), answers);
}

try {
    const result = run(process.argv.slice(2));
    process.stdout.write(`${typeof result === 'string' ? result : JSON.stringify(result, null, 2)}\n`);
} catch (error) {
    const code = /^PUBLIC_EVAL_[A-Z_]+$/.test(error.message) ? error.message : 'PUBLIC_EVAL_FAILED';
    console.error(code);
    if (code === ARGUMENT_ERROR) console.error(USAGE);
    process.exitCode = 1;
}
