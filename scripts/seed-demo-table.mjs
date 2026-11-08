import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { projectHero, validateScene } from '../server/tables-store.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEMO_TABLE_ID = 'demo-old-road';

/** Adds one reproducible fixture; existing tables and edited demo data are kept. */
export async function seedDemoTable(dataDir = path.join(root, 'demo-data')) {
  const file = path.join(dataDir, 'tables.json');
  let state;
  try { state = JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    state = { version: 1, tables: {}, templates: {}, operations: {} };
  }
  if (state.version !== 1 || !state.tables || !state.templates || !state.operations)
    throw new Error('Некорректный формат хранилища столов');
  if (Object.hasOwn(state.tables, DEMO_TABLE_ID)) return { created: false, id: DEMO_TABLE_ID };

  const updatedAt = new Date().toISOString();
  const visibility = { sections: ['hero', 'development', 'inventory'], notes: [] };
  const players = [
    ['demo-anna', 'Анна', 'demo-elementalist'],
    ['demo-boris', 'Борис', 'demo-nul'],
    ['demo-daria', 'Дарья', 'demo-provodnik'],
    ['demo-mikhail', 'Михаил', 'demo-ten'],
  ];
  const members = [{ userId: 'local', name: 'Демо-ведущий', hero: null }];
  const heroOwners = {};
  const heroVisibility = {};
  for (const [userId, name, heroId] of players) {
    const document = JSON.parse(await fs.readFile(path.join(root, 'demo-data', 'characters', `${heroId}.json`), 'utf8'));
    // Only these table snapshots change; source character sheets remain untouched.
    document.name = document.name.replace(/^Демо:\s*/, '');
    document.stamina.current = Math.max(1, document.stamina.max - (members.length === 2 ? 18 : 0));
    document.heroicResource.current = members.length;
    const hero = projectHero(document, visibility);
    members.push({ userId, name, hero });
    heroOwners[hero.id] = userId;
    heroVisibility[hero.id] = structuredClone(visibility);
  }
  members.push({ userId: 'demo-elena', name: 'Елена', hero: null });

  const baseScene = (id, name, kind, status, objective) => validateScene({
    id, name, kind, status, objective, published: true,
    description: '', directorNotes: '', round: 1, initiative: 'heroes', malice: 0,
    combatants: [], counters: [],
  });
  state.tables[DEMO_TABLE_ID] = {
    id: DEMO_TABLE_ID, name: 'Демо: Огни старого тракта', ownerId: 'local',
    archived: false, revision: 1, updatedAt, inviteCode: randomUUID(), members,
    scenes: [
      baseScene('demo-bridge', 'Засада у каменного моста', 'encounter', 'prepared', 'Провести караван через мост.'),
      baseScene('demo-watch', 'Разговор с дозорными', 'negotiation', 'prepared', 'Получить разрешение на проход в город.'),
      baseScene('demo-forest', 'Через затопленный лес', 'montage', 'finished', 'Найти безопасный путь до тракта.'),
    ],
    materials: [
      { id: 'demo-letter', title: 'Письмо караванщика', text: 'Караван ждёт у старого моста. После дождей дорога через лес затоплена, а на тракте появились незнакомые дозорные.', public: true },
      { id: 'demo-secret', title: 'Мотивы дозорного', text: 'Начальник дозора ищет пропавшего брата. Помощь в поисках убедит его пропустить караван.', public: false },
    ],
    events: [
      { id: 'demo-arrival', at: updatedAt, actor: 'local', text: 'Герои добрались до тракта и договорились сопровождать караван.', public: true, kind: 'message' },
      { id: 'demo-rumour', at: updatedAt, actor: 'demo-anna', text: 'В трактире рассказали о сигнальных огнях у каменного моста.', public: true, kind: 'message' },
    ],
    offers: [], trades: [], visibility: heroVisibility, heroOwners,
  };
  await fs.mkdir(dataDir, { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
    await fs.rename(temporary, file);
  } finally { await fs.rm(temporary, { force: true }); }
  return { created: true, id: DEMO_TABLE_ID };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await seedDemoTable();
  console.log(result.created ? 'Демо-стол создан: Огни старого тракта' : 'Демо-стол уже существует; изменения сохранены');
}
