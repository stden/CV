const { catalogue } = require('../src/cv-data');

console.log('# Skills');
for (const group of catalogue.groups) {
    console.log(`\n## ${group.title}\n\n${group.scope}\n`);
    for (const skill of catalogue.skills.filter(({ group: id }) => id === group.id)) {
        const label = skill.techPage ? `[${skill.name}](https://stden.github.io/CV/${skill.techPage})` : skill.name;
        console.log(`- ${label}`);
    }
}
