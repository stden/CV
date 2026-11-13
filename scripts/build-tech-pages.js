const fs = require('node:fs');
const path = require('node:path');

const outputDirectory = path.resolve(__dirname, '..', 'tech');

const technologies = [
    {
        slug: 'java',
        title: 'Java',
        summary: 'Main language for back-end services, deployment tooling and test automation, from Java 6 to Java 25.',
        logo: true,
        flow: ['Source (.java)', 'javac', 'Bytecode (.class)', 'JVM', 'Machine code (JIT)'],
        official: 'https://openjdk.org/',
        capabilities: [
            'Language features from generics and lambdas (Java 8) to records, sealed classes and pattern matching (Java 17 and later)',
            'Virtual threads (Java 21) for high-concurrency server code',
            'Core libraries: collections, concurrency utilities, JDBC, Swing and JavaFX',
            'Diagnosing problems in the Java Memory Model, class loading and concurrency',
        ],
        usedIn: [
            'Kuehne+Nagel (2018 - now): Java deployment for iOPM, Java 6 to 25',
            'Software Development & Solutions (2013 - 2014): Java and JUnit on the Forward project',
            'Bonus Club "All in plus" (2012 - 2013): core library, services and billing software',
            'Oracle Russia (2014 - 2017): test development and bug fixing in tests and the JDK',
        ],
    },
    {
        slug: 'spring',
        title: 'Spring framework',
        summary: 'Application framework for Java: dependency injection, web MVC, transactions and data access.',
        logo: true,
        flow: ['HTTP request', 'Controller', 'Service', 'Repository', 'Database'],
        official: 'https://spring.io/projects/spring-framework',
        capabilities: [
            'Inversion of Control container and dependency injection',
            'Spring MVC for web applications and REST endpoints',
            'Declarative transaction management',
            'Data access through JDBC and JPA/Hibernate integration',
            'Test support with a context cache and mock environments',
        ],
        usedIn: [
            'Kuehne+Nagel (2018 - now): Spring framework for iOPM back-end services',
            'Software Development & Solutions (2013 - 2014): Spring, Play and GWT',
            'Bonus Club "All in plus" (2012 - 2013): Spring, Play and GWT',
            'Public experiments: Spring MVC with JPA 2',
        ],
    },
    {
        slug: 'spring-boot',
        title: 'Spring Boot',
        summary: 'Opinionated layer on top of Spring for standalone, production-ready back-end services.',
        logo: true,
        flow: ['Starter dependencies', 'Auto-configuration', 'Embedded server', 'Executable JAR', 'Docker / Kubernetes'],
        official: 'https://spring.io/projects/spring-boot',
        capabilities: [
            'Auto-configuration and starter dependencies',
            'Embedded servers such as Tomcat, packaged as an executable JAR',
            'Externalized configuration with profiles',
            'Actuator endpoints for health checks and metrics',
            'Fits containerized deployment with Docker and Kubernetes',
        ],
        usedIn: [
            'Kuehne+Nagel (2018 - now): Spring Boot back-end services for iOPM',
        ],
    },
    {
        slug: 'jpa',
        title: 'JPA',
        summary: 'Java standard for object-relational mapping: entities, relations and queries.',
        icon: 'fa-database',
        flow: ['Entity class', 'EntityManager', 'Persistence context', 'SQL', 'Database'],
        official: 'https://jakarta.ee/specifications/persistence/',
        capabilities: [
            'Mapping entities to tables with annotations, including one-to-many and many-to-many relations',
            'JPQL and Criteria queries',
            'Transactions and the EntityManager lifecycle',
            'Lazy and eager loading, and their trade-offs',
        ],
        usedIn: [
            'Kuehne+Nagel (2018 - now): JPA and SQL for iOPM',
            'Public experiments: JPA 2 with Hibernate and MySQL',
        ],
    },
    {
        slug: 'sql',
        title: 'SQL',
        summary: 'Relational query language used with Oracle and PostgreSQL.',
        icon: 'fa-database',
        flow: ['FROM and JOIN', 'WHERE', 'GROUP BY', 'HAVING', 'SELECT', 'ORDER BY'],
        capabilities: [
            'SELECT with joins, subqueries, aggregation and window functions',
            'Schema design with keys, constraints and indexes',
            'Transactions and isolation levels',
            'Reading execution plans to find slow queries',
        ],
        usedIn: [
            'Kuehne+Nagel (2018 - now): SQL against Oracle and PostgreSQL',
            'Research & Engineering Center of SPb ETU (2001 - 2005): SQL for data analysis',
            'OAO INRUSKOM (2005 - 2007) and i-Free (2005): MS SQL for railway signaling and game data',
        ],
    },
    {
        slug: 'oracle',
        title: 'Oracle Database',
        summary: 'Enterprise relational database used in the Kuehne+Nagel, Bonus Club and Software Development & Solutions projects.',
        icon: 'fa-database',
        flow: ['Client application', 'Listener', 'Server process', 'SGA (buffer cache)', 'Data files'],
        official: 'https://www.oracle.com/database/',
        capabilities: [
            'PL/SQL procedures and packages',
            'Query tuning with execution plans and indexes',
            'Constraints, sequences and transactions',
            'Access from Java through JDBC and JPA',
        ],
        usedIn: [
            'Kuehne+Nagel (2018 - now): Oracle and PostgreSQL for iOPM',
            'Bonus Club "All in plus" (2012 - 2013): Oracle DB for billing software',
            'Software Development & Solutions (2013 - 2014): MySQL and Oracle DB',
        ],
    },
    {
        slug: 'postgresql',
        title: 'PostgreSQL',
        summary: 'Open-source relational database used for application back ends.',
        logo: true,
        flow: ['Client query', 'Parser', 'Planner', 'Executor', 'Table storage (MVCC)'],
        official: 'https://www.postgresql.org',
        capabilities: [
            'Relational schemas with constraints, indexes and MVCC transactions',
            'JSON and array column types',
            'Extensions such as pgvector for embeddings and vector search',
            'Access from Java through JDBC and JPA, and from Python',
        ],
        usedIn: [
            'Kuehne+Nagel (2018 - now): PostgreSQL alongside Oracle for iOPM',
            'Public examples: PostgreSQL usage notes',
        ],
    },
    {
        slug: 'angular',
        title: 'Angular JS',
        summary: 'Front-end framework for single-page web applications, covering AngularJS (1.x) and Angular (2+).',
        logo: true,
        flow: ['Template', 'Component', 'Service', 'HTTP client', 'REST API'],
        official: 'https://angular.dev',
        capabilities: [
            'Component-based UI with templates and data binding',
            'Dependency injection',
            'Routing and forms',
            'HTTP client for REST calls',
            'Unit tests with Jasmine and Karma',
        ],
        usedIn: [
            'Kuehne+Nagel (2018 - now): front-end for iOPM',
        ],
    },
    {
        slug: 'react',
        title: 'React JS',
        summary: 'Component library for building user interfaces.',
        logo: true,
        flow: ['State change', 'Component render', 'Virtual DOM diff', 'DOM update'],
        official: 'https://react.dev',
        capabilities: [
            'Function components with hooks for state and side effects',
            'JSX templates',
            'Declarative rendering with efficient updates through the virtual DOM',
            'Component tests with Jest and React Testing Library',
        ],
        usedIn: [
            'Kuehne+Nagel (2018 - now): React front-end for iOPM',
        ],
    },
    {
        slug: 'maven',
        title: 'Maven',
        summary: 'Build and dependency management tool for Java projects.',
        logo: true,
        flow: ['validate', 'compile', 'test', 'package', 'install', 'deploy'],
        official: 'https://maven.apache.org',
        capabilities: [
            'Standard lifecycle: compile, test, package, install and deploy',
            'Dependency management through pom.xml, including transitive dependencies and scopes',
            'Multi-module projects and parent POMs',
            'Plugins such as Surefire for unit tests and Failsafe for integration tests',
        ],
        usedIn: [
            'Kuehne+Nagel (2018 - now): Maven builds for iOPM',
            'Public examples: Maven project samples and a GWT application',
        ],
    },
    {
        slug: 'hibernate',
        title: 'Hibernate',
        summary: 'ORM framework and JPA implementation for Java.',
        logo: true,
        flow: ['Entity', 'Session', 'JDBC', 'SQL', 'Database'],
        official: 'https://hibernate.org',
        capabilities: [
            'Entity mapping, relations and inheritance',
            'First-level and second-level caching',
            'Lazy loading and session management',
            'HQL and Criteria queries',
        ],
        usedIn: [
            'Kuehne+Nagel (2018 - now): Hibernate with Maven for iOPM',
            'Software Development & Solutions (2013 - 2014): Hibernate',
            'Bonus Club "All in plus" (2012 - 2013): Hibernate',
        ],
    },
    {
        slug: 'jenkins',
        title: 'Jenkins',
        summary: 'Open-source automation server for CI/CD pipelines.',
        logo: true,
        flow: ['Commit', 'Build', 'Test', 'Quality gate', 'Deploy'],
        official: 'https://www.jenkins.io',
        capabilities: [
            'Declarative pipelines in a Jenkinsfile (pipeline as code)',
            'Build agents and parallel stages',
            'Plugins for Git, Maven, Docker and Kubernetes',
            'Scheduled and triggered builds, artifact archiving and test reports',
        ],
        usedIn: [
            'Kuehne+Nagel (2018 - now): deployment automation for iOPM together with GitLab',
        ],
    },
    {
        slug: 'docker',
        title: 'Docker',
        summary: 'Containers for packaging and running services consistently across environments.',
        logo: true,
        flow: ['Dockerfile', 'Image', 'Registry', 'Container'],
        official: 'https://www.docker.com',
        capabilities: [
            'Images built from a Dockerfile',
            'Container runtime with process isolation',
            'Multi-container setups with Docker Compose',
            'Registries for storing and sharing images',
        ],
        usedIn: [
            'Kuehne+Nagel (2018 - now): Docker with Jenkins and Kubernetes',
            'Taxify (2017 - 2018): Docker for back-end services',
        ],
    },
    {
        slug: 'kubernetes',
        title: 'Kubernetes',
        summary: 'Orchestrator for running containers at scale.',
        logo: true,
        flow: ['Ingress', 'Service', 'Pods', 'Nodes'],
        official: 'https://kubernetes.io',
        capabilities: [
            'Deployments with rolling updates and rollbacks',
            'Services, ConfigMaps and Secrets',
            'Liveness and readiness probes',
            'Horizontal scaling of workloads',
        ],
        usedIn: [
            'Kuehne+Nagel (2018 - now): Kubernetes with Jenkins and Docker',
        ],
    },
    {
        slug: 'git',
        title: 'Git',
        summary: 'Distributed version control system.',
        logo: true,
        flow: ['Working directory', 'Staging area', 'Local repository', 'Remote repository'],
        official: 'https://git-scm.com',
        capabilities: [
            'Branching, merging and rebasing',
            'Pull requests and code review workflow',
            'History inspection with log, blame and bisect',
            'Recovering lost work with reflog',
        ],
        usedIn: [
            'Kuehne+Nagel (2018 - now): Git for version control',
            'Public repositories on GitHub, including experiments and examples',
        ],
    },
    {
        slug: 'gitlab',
        title: 'GitLab',
        summary: 'Git hosting with built-in CI/CD pipelines.',
        logo: true,
        flow: ['Merge request', 'Pipeline', 'Runner', 'Artifacts', 'Deploy'],
        official: 'https://about.gitlab.com',
        capabilities: [
            'Pipelines in .gitlab-ci.yml with stages, jobs and artifacts',
            'Merge requests with review and approvals',
            'Runners that execute jobs on shared or self-hosted machines',
            'Integrated container registry',
        ],
        usedIn: [
            'Kuehne+Nagel (2018 - now): automation with Jenkins',
        ],
    },
    {
        slug: 'python',
        title: 'Python',
        summary: 'Scripting language for automation, test infrastructure and data processing, Python 2 and 3.',
        logo: true,
        flow: ['Source (.py)', 'Bytecode (.pyc)', 'Interpreter', 'Output'],
        official: 'https://www.python.org',
        capabilities: [
            'Automation scripts for deployment and operations',
            'Management of distributed test infrastructure, including a lab of 60+ machines',
            'Data processing with the standard library',
            'Maintenance of Python 2.7 and Python 3 code',
        ],
        usedIn: [
            'Kuehne+Nagel (2018 - now): Python 2 and 3 scripts',
            'Oracle Russia (2014 - 2017): test infrastructure with Python, PowerShell and Puppet',
            'Software Development & Solutions (2013 - 2014): Python',
        ],
    },
    {
        slug: 'mockito',
        title: 'Mockito',
        summary: 'Mocking framework for Java unit tests.',
        icon: 'fa-flask',
        flow: ['Create mock', 'Stub: when(...).thenReturn', 'Run code under test', 'verify() calls'],
        official: 'https://site.mockito.org',
        capabilities: [
            'Stubbing return values and exceptions',
            'Verifying interactions and their order',
            'Argument matchers and captors',
            'Spies for partially mocked objects',
        ],
        usedIn: [
            'Kuehne+Nagel (2018 - now): Mockito unit tests',
            'Oracle Russia (2014 - 2017): Mockito in test development',
        ],
    },
    {
        slug: 'jmockit',
        title: 'JMockit',
        summary: 'Java testing toolkit that can mock static methods, constructors and final classes.',
        icon: 'fa-flask',
        flow: ['Mock static, final or constructor', 'Expectations block', 'Run code under test', 'Verifications block'],
        official: 'https://jmockit.github.io',
        capabilities: [
            'Mocking of static methods, constructors and final classes',
            'Expectation-based and verification-based tests',
            'Works with JUnit and TestNG',
            'Partial mocking of real objects',
        ],
        usedIn: [
            'Kuehne+Nagel (2018 - now): JMockit unit tests',
        ],
    },
    {
        slug: 'easymock',
        title: 'EasyMock',
        summary: 'Mock object library for Java with a record, replay and verify workflow.',
        icon: 'fa-flask',
        flow: ['createMock()', 'Record expectations', 'replay()', 'Run code under test', 'verify()'],
        official: 'https://easymock.org',
        capabilities: [
            'Record expected calls, replay them and verify',
            'Strict and nice mocks',
            'Argument matchers',
            'Works with JUnit',
        ],
        usedIn: [
            'Kuehne+Nagel (2018 - now): EasyMock unit tests',
        ],
    },
];

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderList(items) {
    return items.map((item) => `    <li>${escapeHtml(item)}</li>`).join('\n');
}

function renderOfficialLink(technology) {
    if (!technology.official) return '';
    return `  <p><a href="${technology.official}" target="_blank" rel="noopener">Official site</a></p>\n`;
}

function renderHeaderIcon(technology) {
    if (technology.logo) return `<img alt="" class="tech-logo" src="../assets/images/tech/${technology.slug}.svg">`;
    if (technology.icon) return `<i aria-hidden="true" class="fa ${technology.icon} tech-logo"></i>`;
    return '';
}

function renderPage(technology) {
    const title = escapeHtml(technology.title);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta content="IE=edge" http-equiv="X-UA-Compatible">
  <meta content="width=device-width, initial-scale=1.0" name="viewport">
  <title>${title} - Denis Stepulenok CV</title>
  <meta content="${escapeHtml(technology.summary)}" name="description">
  <link href="../favicon.ico" rel="shortcut icon">
  <link href="../assets/plugins/bootstrap/css/bootstrap.min.css" rel="stylesheet">
  <link href="../assets/plugins/font-awesome/css/font-awesome.css" rel="stylesheet">
  <link href="../assets/css/style.css" id="theme-style" rel="stylesheet">
</head>

<body>
<div class="container tech-page">
  <p><a href="../index.html">&larr; Back to CV</a></p>
  <div class="tech-header">${renderHeaderIcon(technology)}<h1>${title}</h1></div>
  <p class="lead">${escapeHtml(technology.summary)}</p>

  <h2>How it works</h2>
  <ol class="flow">
${renderList(technology.flow)}
  </ol>

  <h2>Capabilities</h2>
  <ul>
${renderList(technology.capabilities)}
  </ul>

  <h2>Where I used it</h2>
  <ul>
${renderList(technology.usedIn)}
  </ul>

${renderOfficialLink(technology)}</div>
</body>
</html>
`;
}

function main() {
    fs.mkdirSync(outputDirectory, { recursive: true });
    for (const technology of technologies) {
        fs.writeFileSync(path.join(outputDirectory, `${technology.slug}.html`), renderPage(technology));
    }
    console.log(`Wrote ${technologies.length} technology pages to ${outputDirectory}`);
}

main();
