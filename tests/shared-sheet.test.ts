import { describe, expect, it } from 'vitest';
import { abilityFromTemplate, BASIC_ABILITIES } from '../src/data/templates';
import { evaluateAbilityDamage } from '../src/lib/rules';
import { createCharacter } from '../src/lib/defaults';
import { sharedSheetCharacter } from '../src/lib/tables/shared-sheet';
import { projectHero } from '../server/tables-store.mjs';
import type { SharedHero } from '../src/lib/tables/types';

describe('read-only shared sheet model', () => {
  it('uses published values without recovering closed hero and inventory data', () => {
    const source = createCharacter({ name: 'Эйрин', className: 'Элементалист', level: 5 });
    source.career = 'Скрытая карьера';
    source.inventory = [{ id: 'secret', name: 'Тайный предмет', category: 'gear', qty: 1, notes: '', equipped: false }];
    source.notes.secrets = 'Секрет';
    const shared = projectHero(source, { sections: [], notes: [] }) as SharedHero;
    const result = sharedSheetCharacter(shared);
    expect(result.name).toBe(source.name);
    expect(result.stamina).toEqual(source.stamina);
    expect(result.heroicResource).toEqual(source.heroicResource);
    expect(result.career).toBe('');
    expect(result.inventory).toEqual([]);
    expect(result.abilities).toEqual([]);
    expect(result.notes.secrets).toBe('');
  });
  it('keeps authorized fields detached from the incoming projection', () => {
    const source = createCharacter({ name: 'Бран' });
    source.characteristics.might = 3;
    source.notes.story = 'Открытая история';
    const shared = projectHero(source, { sections: ['hero'], notes: ['story'] }) as SharedHero;
    const before = structuredClone(shared);
    const result = sharedSheetCharacter(shared);
    expect(result.characteristics.might).toBe(3);
    expect(result.notes.story).toBe('Открытая история');
    result.characteristics.might = -1;
    result.stamina.current = 999;
    expect(shared).toEqual(before);
  });
  it('shares the manual damage modifier only with the hero section and uses it in ability totals', () => {
    const source = createCharacter();
    source.damageModifier = -2;
    const ability = { ...abilityFromTemplate(BASIC_ABILITIES[0]), tiers: [
      { damage: '5', effect: '' }, { damage: '7', effect: '' }, { damage: '9', effect: '' },
    ] };
    source.abilities = [ability];
    source.favoriteAbilityIds = [ability.id];
    const shared = sharedSheetCharacter(projectHero(source, { sections: ['hero'], notes: [] }) as SharedHero);
    expect(shared.damageModifier).toBe(-2);
    expect(shared.favoriteAbilityIds).toBeUndefined();
    expect(evaluateAbilityDamage(shared.abilities[0], 1, shared).values).toEqual([3]);
    const closed = projectHero(source, { sections: ['development'], notes: [] }) as SharedHero;
    expect(JSON.stringify(closed)).not.toContain('damageModifier');
    expect(sharedSheetCharacter(closed).damageModifier).toBeUndefined();
  });
  it('rejects unrelated fields inside section records', () => {
    const source = createCharacter({ name: 'Бран' });
    const shared = projectHero(source, { sections: ['hero'], notes: [] }) as SharedHero;
    shared.sections.hero = { career: 'Маг', inventory: [{ name: 'Подмена' }], id: 'wrong', name: 'wrong' };
    const result = sharedSheetCharacter(shared);
    expect(result).toMatchObject({ id: shared.id, name: shared.name, career: 'Маг', inventory: [] });
  });
});
