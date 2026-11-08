import { createElement } from 'react';
import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createScene } from '../src/lib/tables/scenes';
import { SceneTracker } from '../src/views/tables/SceneTracker';

it('renders only revealed public information to players without controls or stamina', () => {
  const scene = createScene('encounter', 'Сцена');
  scene.directorNotes = 'секрет';
  scene.counters = [{ id: 'a', name: 'Открытый', value: 2, public: true }, { id: 'b', name: 'Тайный', value: 7, public: false }];
  scene.combatants = [{ id: 'a', name: 'Враг', group: '', organization: '', faction: 'enemy', revealed: true, turn: 'ready', reactionUsed: false, conditions: [{ id: 'c', name: 'Тайное состояние', public: false, ends: '' }], health: 'hurt', stamina: 31, maxStamina: 45, notes: 'тайна' }, { id: 'b', name: 'Скрытый', group: '', organization: '', faction: 'enemy', revealed: false, turn: 'ready', reactionUsed: false, conditions: [], health: 'healthy' }];
  const html = renderToStaticMarkup(createElement(SceneTracker, { scene, director: false, onChange: vi.fn() }));
  expect(html).toContain('Ранен');
  expect(html).toContain('Открытый');
  for (const value of ['31', '45', 'секрет', 'тайна', 'Тайный', 'Скрытый', 'Тайное состояние', '<button', '<input']) expect(html).not.toContain(value);
});
