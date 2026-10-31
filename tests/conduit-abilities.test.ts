import { describe, expect, it } from 'vitest';
import { GENERATED_CLASS_FEATURES as classFeatures } from '../src/data/class-features/skeleton';
import levelUp from '../src/data/level-up.generated.json';
import { ABILITY_COMPENDIUM as abilities } from '../src/data/compendium';
import { conduitAbilities } from '../src/data/class-features/conduit-abilities';

const documentedExceptions: Record<string, { tableName: string; cardName: string }> = {
 '2:Знание': {
  tableName: 'Боги повелевают вам повиноваться',
  cardName: 'Боги Требуют Послушания',
 },
};

function tableEntries(description: string, level: number): Map<string, string> {
 const heading = `Таблица способностей домена ${level}-го уровня проводника`;
 const lines = description.split('\n');
 const headingIndex = lines.findIndex(line => line.includes(heading));
 const firstRow = lines.findIndex((line, index) => index > headingIndex && line.trim().startsWith('|'));
 const tableLines = lines.slice(firstRow).slice(0, lines.slice(firstRow).findIndex(line => !line.trim().startsWith('|')));
 const rows = [...tableLines.join('\n').matchAll(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm)];
 return new Map(rows
  .map(([, domain, name]) => [domain.trim(), name.trim()] as const)
  .filter(([domain]) => domain !== 'Домен' && !/^[-:]+$/.test(domain)));
}

describe('conduit domain ability mapping', () => {
 it('matches every domain, feature, and ability to the level table and source records', () => {
  expect(conduitAbilities).toHaveLength(36);
  expect(new Set(conduitAbilities.map(x => `${x.level}:${x.domain}`)).size).toBe(36);

  for (const level of [2, 6, 9] as const) {
   const entries = conduitAbilities.filter(x => x.level === level);
   expect(entries, `level ${level}: expected 12 domain mappings`).toHaveLength(12);

   const levelFeature = levelUp.find(x => x.className === 'Проводник' && x.level === level)
    ?.features.find(x => x.name.startsWith('Способность домена'));
   expect(levelFeature, `level ${level}: domain feature missing from level-up table`).toBeDefined();
   const skeletonFeature = classFeatures.find(x => x.className === 'Проводник' && x.level === level && x.name === levelFeature!.name);
   expect(skeletonFeature, `level ${level}: domain feature missing from source skeleton`).toBeDefined();
   const table = tableEntries(levelFeature!.description, level);
   expect(table.size, `level ${level}: domain table should have 12 distinct rows`).toBe(12);

   for (const entry of entries) {
    const label = `${entry.level}:${entry.domain}`;
    const tableName = table.get(entry.domain);
    expect(tableName, `${label}: domain must be an exact row in the primary table`).toBeDefined();

    const feature = classFeatures.find(x => x.id === entry.featureId);
    expect(feature, `${label}: feature ${entry.featureId} missing`).toBeDefined();
    expect(feature!.className, `${label}: feature class`).toBe('Проводник');
    expect(feature!.level, `${label}: feature level`).toBe(level);
    expect(feature!.parentId, `${label}: feature must belong to the domain ability feature`).toBe(skeletonFeature!.id);
    expect(feature!.featureId, `${label}: source level-up feature id`).toBe(levelFeature!.id);
    expect(feature!.keyedBy, `${label}: feature selection key`).toBe('domain');
    expect(feature!.keyValue, `${label}: feature domain`).toBe(entry.domain);
    expect(feature!.name, `${label}: skeleton name must match the primary table`).toBe(tableName);

    const card = abilities.find(x => x.id === entry.abilityId);
    expect(card, `${label}: ability ${entry.abilityId} missing`).toBeDefined();
    expect(card!.className, `${label}: card class`).toBe('Проводник');
    expect(card!.level, `${label}: card level`).toBe(level);

    const exception = documentedExceptions[label];
    if (exception) {
     // The level table/skeleton and card use different titles. Verify each against its
     // primary text: the table title is explicit, and the card flavor matches the
     // skeleton's source description. No title equivalence is inferred.
     expect(tableName, `${label}: documented table title`).toBe(exception.tableName);
     expect(card!.name, `${label}: documented card title`).toBe(exception.cardName);
     const flavor = feature!.description.match(/^\*([^\n]+)\*/)?.[1];
     expect(flavor, `${label}: skeleton source flavor missing`).toBeDefined();
     expect(card!.flavor, `${label}: card flavor must match the source skeleton`).toBe(flavor);
    } else {
     expect(card!.name.toLocaleLowerCase('ru-RU'), `${label}: card title must match the table/skeleton title`)
      .toBe(tableName!.toLocaleLowerCase('ru-RU'));
    }
   }
  }
 });
});
