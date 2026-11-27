const cv = require('../data/cv.json');
const catalogue = require('../data/skills.json');
const variants = require('../data/variants.json');

const skills = catalogue.groups.map((group) => {
    const entries = catalogue.skills.filter((skill) => skill.group === group.id);
    return { ...group, items: entries.map((skill) => skill.name), entries };
});

module.exports = { cv: { ...cv, skills }, catalogue, variants };
