const { getEngineMeta } = require('./engines');

const ACTIVE_ENGINE = process.env.ACTIVE_ENGINE || 'product';
const { title, load } = getEngineMeta(ACTIVE_ENGINE);
const engine = load();

module.exports = { ...engine, activeEngine: ACTIVE_ENGINE, activeEngineTitle: title };
