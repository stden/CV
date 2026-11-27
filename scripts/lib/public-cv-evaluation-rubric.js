const facts = {
    'java-backend': { skill: true, match: [/\bjava\b/i, /\b(?:back[ -]?end|spring boot|services?)\b/i] },
    'distributed-systems': { skill: true, match: [/\bdistributed (?:systems?|environments?)\b/i] },
    'spring-boot': { skill: true, match: [/\bspring boot\b/i] },
    'jvm-concurrency': { skill: true, match: [/\b(?:jvm|jdk|java)\b/i, /\b(?:concurrency|concurrent|synchroni[sz]ation)\b/i] },
    'oracle-jdk': { match: [/\boracle\b/i, /\bjdk\b/i, /\b(?:test\w*|defects?|regressions?|concurrency)\b/i] },
    'taxify-bolt': { match: [/\b(?:taxify|bolt)\b/i, /\b(?:node\.js|typescript|high[- ]load)\b/i] },
    'kafka-employment': { skill: true, match: [/\b(?:apache )?kafka\b/i, /(?:kuehne\s*\+\s*nagel|professional|employment|enterprise)\b/i] },
    'kafka-independent': { skill: true, match: [/\b(?:independent(?:ly)?|educational|demo(?:nstration)?|reproducible example|synthetic)\b[^.!?]{0,125}\bkafka\b|\bkafka\b[^.!?]{0,125}\b(?:independent(?:ly)?|educational|demo(?:nstration)?|reproducible example|synthetic)\b/i] },
    'kafka-verification-limit': {
        match: [/\bkafka\b/i, /\b(?:(?:self|candidate)[- ]reported|(?:without|no) (?:independent |public )?(?:employer (?:verification|attestation)|verification|attestation)|employer (?:verification|attestation) is unavailable|(?:is |was )not independently (?:verified|confirmed)|(?:no|without) independent (?:verification|attestation))\b/i],
        contradicts: [/\bkafka\b.{0,100}\b(?:is|was|has been) independently (?:verified|confirmed|attested)\b/i],
    },
    'entity-locker-scope': {
        match: [/\b(?:entity[ -]?locker|keyed lock(?:ing)?)\b/i, /\b(?:jvm[- ]local|single[- ](?:jvm|process)|within (?:a|one) (?:jvm|process)|in[- ]process)\b/i],
        contradicts: [/\b(?:entity[ -]?locker|keyed lock(?:ing)?)\b.{0,60}\b(?:provides?|implements?|guarantees?|supports?|is a)\b.{0,60}\b(?:cross[- ]process|distributed)\b/i],
    },
    'keyed-lock-lifecycle': { match: [/\b(?:keyed lock(?:ing|s)?|entity[ -]?locker|lock registry|per[- ]key lifecycle)\b/i, /\b(?:reclaim\w*|retir\w*|remov\w*|lifecycle)\b/i, /\b(?:check\w*|test\w*|invariant|race|risk|safe\w*|requires?|verify|verification)\b/i] },
    'reliability': { skill: true, match: [/\b(?:idempoten\w*|safe reprocess\w*|bounded retr\w*|retry policies|replay safety)\b/i] },
    'distributed-limitations': { match: [/\b(?:cluster|multi[- ]region|on[- ]call|production scale|failure recovery ownership|consistency requirements?)\b/i, /\b(?:confirm\w*|not established|not documented|out of scope|limitations?|no evidence)\b/i] },
    'english-intermediate': {
        match: [/\benglish\b.{0,50}\bintermediate\b/i],
        contradicts: [/\benglish\b.{0,30}\b(?:fluent|native|c[12]|advanced)\b/i, /\b(?:fluent|native|advanced)\s+english\b/i],
    },
    'tallinn': { match: [/\btallinn\b/i, /\bestonia\b/i] },
};

const repositories = {
    'repo-entity-locker': 'EntityLocker',
    'repo-jpa2': 'JPA2',
    'repo-rustshot': 'RustShot',
    'repo-funny-file-manager': 'FunnyFileManager',
    'repo-sonarqube-checker': 'SonarQubeChecker',
    'repo-pythorust-tg': 'pythorust_tg',
};
for (const [id, name] of Object.entries(repositories)) {
    facts[id] = {
        match: [new RegExp(`\\b${name}\\b`, 'i')],
        sourceMatch: [/\bgithub\.com\/stden\//i, new RegExp(`\\bgithub\\.com/stden/${name}\\b`, 'i')],
    };
}

const PROMPTS = [
    { id: 'specialisation', prompt: "Identify the candidate's primary engineering specialisation.", facts: ['java-backend', 'distributed-systems'] },
    { id: 'java-fit', prompt: 'Assess suitability for a Senior Java Backend Engineer vacancy.', facts: ['java-backend', 'spring-boot', 'kafka-employment', 'oracle-jdk'] },
    { id: 'jvm', prompt: 'Identify evidence of JVM concurrency expertise.', facts: ['jvm-concurrency', 'oracle-jdk', 'entity-locker-scope', 'keyed-lock-lifecycle'] },
    { id: 'kafka', prompt: 'Distinguish professional Kafka experience from independent experimentation.', facts: ['kafka-employment', 'kafka-independent', 'kafka-verification-limit'] },
    { id: 'distributed', prompt: 'Evaluate relevant strengths and missing requirements for a distributed systems role.', facts: ['distributed-systems', 'kafka-employment', 'reliability', 'distributed-limitations'] },
    { id: 'repositories', prompt: 'Identify public repositories supporting the assessment.', facts: Object.keys(repositories) },
    { id: 'ambiguous', prompt: 'Identify unsupported or ambiguous claims.', facts: ['kafka-verification-limit', 'entity-locker-scope', 'keyed-lock-lifecycle', 'distributed-limitations'] },
    { id: 'summary', prompt: 'Produce a neutral hiring-manager summary with source references.', facts: ['java-backend', 'distributed-systems', 'kafka-employment', 'oracle-jdk', 'taxify-bolt', 'tallinn'] },
];

module.exports = { facts, PROMPTS };
