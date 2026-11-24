import { expect, it } from 'vitest';
import { builderFlow } from '../src/lib/builder-flow';
import { emptyBuilderDraft } from '../src/lib/character-builder';
import { englishFlowLabel, englishStages } from '../src/components/builder/language';

it('offers English navigation to the blank-sheet form without changing flow identities', () => {
  const flow = builderFlow(emptyBuilderDraft());
  const details = flow.find((item) => item.id === 'details');
  expect(details).toBeDefined();
  expect(englishStages[details!.stage]).toBe('Identity');
  expect(englishFlowLabel(details!)).toBe('Hero identity');
  expect(flow.find((item) => item.id === 'ancestry')?.label).toBe('Выберите происхождение');
});

it('keeps actionable validation details and does not rewrite unknown text', async () => {
  const { englishIssue } = await import('../src/components/builder/language');
  expect(englishIssue('Распределите 3 очка происхождения (выбрано 1).')).toBe('Spend 3 ancestry points (1 spent).');
  expect(englishIssue('Выбрано 1 из 3. Замените недопустимые и повторяющиеся навыки.')).toContain('Replace invalid or duplicate skills');
  expect(englishIssue('Выберите второй, отличный комплект.')).toBe('Choose a different second kit.');
  expect(englishIssue('Особый текст')).toBe('Особый текст');
});

it('reads all six English outcomes for every career while retaining its Russian storage value', async () => {
  const { careerIncident } = await import('../src/components/builder/choice-language');
  const { BUILDER_DATA } = await import('../src/lib/character-builder');
  for (const career of BUILDER_DATA.careers) {
    for (const [index, stored] of career.incidents.entries()) {
      const english = careerIncident(career, index, 'en');
      expect(english.title, career.name).not.toMatch(/[а-яё]/i);
      expect(english.text, career.name).not.toMatch(/[а-яё]/i);
      expect(english.text).not.toBe('');
      expect(career.incidents[index]).toBe(stored);
    }
  }
});
