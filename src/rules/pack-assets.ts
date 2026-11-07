import type { RulePack } from './schema';

// Direct entity lookups need group packs; ordinary article reading does not.
export const packLoaders = import.meta.glob<RulePack>(
  '../generated/rules/packs/*.json', { import: 'default' },
);
