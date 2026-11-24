import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../src/i18n/locale';
import { ItemEffectsEditor } from '../src/components/ItemEffectsEditor';
import { ItemAbilitiesEditor } from '../src/components/ItemAbilitiesEditor';
import { FeatureEquipmentFields } from '../src/components/FeatureEquipmentFields';
import { MarkdownEditor } from '../src/components/MarkdownEditor';

afterEach(() => vi.unstubAllGlobals());
it('renders English equipment and editor controls while keeping model values', () => {
  vi.stubGlobal('window', { location: { search: '?lang=en' }, localStorage: { getItem: () => null } });
  const render = (child: React.ReactElement) => renderToStaticMarkup(createElement(LocaleProvider, null, child));
  const effects = render(createElement(ItemEffectsEditor, { effects: [{ field: 'speed', value: 2 }], onChange: () => {} }));
  expect(effects).toContain('Bonus statistic 1');
  expect(effects).toContain('value="speed"');
  expect(effects).toContain('Speed');
  expect(render(createElement(FeatureEquipmentFields, { hasKit: true, onChange: () => {} }))).toContain('A kit is selected');
  expect(render(createElement(ItemAbilitiesEditor, { onChange: () => {} }))).toContain('Link an ability');
  expect(render(createElement(MarkdownEditor, { value: 'My own text', onChange: () => {}, 'aria-label': 'Notes' }))).toContain('My own text');
});
