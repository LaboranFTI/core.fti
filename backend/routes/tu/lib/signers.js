import { pool } from './db-infrastructure.js';
import { getTuSettingsPayload } from './letter-number.js';
import { getRecommendationSigner, getDeanSigner } from './university.js';
import { normalizeResearchDefaults, normalizeResearchAdvisors } from './domain-research.js';

const buildResearchSignerList = async (row) => {
  const deanSigner = await getRecommendationSigner();
  const settingsPayload = await getTuSettingsPayload();
  const advisors = normalizeResearchAdvisors(row.advisors, normalizeResearchDefaults(settingsPayload));

  return [
    deanSigner,
    ...advisors.map((advisor) => ({ name: advisor.name, title: advisor.title }))
  ];
};





export {
  buildResearchSignerList
};
