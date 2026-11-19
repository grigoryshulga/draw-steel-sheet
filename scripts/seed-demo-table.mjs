import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { createTablesStore, DEMO_PLAYER_ID, DEMO_TABLE_ID, projectHero, validateScene } from '../server/tables-store.mjs';
import { emptyBoard, validBoardWebp } from '../server/table-board.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export { DEMO_TABLE_ID };

async function installBackground(dataDir, name) {
  const bytes = await fs.readFile(path.join(root, 'demo-data', 'backgrounds', `${name}.webp`));
  if (!validBoardWebp(bytes)) throw new Error(`Некорректный фон: ${name}`);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const id = [hash.slice(0, 8), hash.slice(8, 12), hash.slice(12, 16), hash.slice(16, 20), hash.slice(20, 32)].join('-');
  const directory = path.join(dataDir, 'table-images', DEMO_TABLE_ID);
  const temporary = path.join(directory, `${randomUUID()}.tmp`);
  await fs.mkdir(directory, { recursive: true });
  try {
    await fs.writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
    await fs.link(temporary, path.join(directory, id)).catch(error => {
      if (error.code !== 'EEXIST') throw error;
    });
  } finally {
    await fs.rm(temporary, { force: true });
  }
  return id;
}

function goblin(id, kind, name, organization, stamina, encounterValue, count = 1) {
  return {
    id, sourceId: `monsters.monster.goblin.statblock.goblin-${kind}`, name, organization, group: 'Засада',
    faction: 'enemy', revealed: true, turn: 'ready', reactionUsed: false, conditions: [], health: 'healthy',
    stamina, maxStamina: stamina, temporaryStamina: 0, count, encounterValue,
  };
}

async function demoScenes(dataDir) {
  const [camp, bridge, gate, forest] = await Promise.all(
    ['old-road-camp', 'stone-bridge', 'guard-post', 'flooded-forest'].map(name => installBackground(dataDir, name)),
  );
  const scene = ({ background, ...details }) => ({
    ...validateScene({
      status: 'prepared', published: false, description: '', directorNotes: '',
      round: 1, initiative: 'heroes', malice: 0, combatants: [], counters: [], ...details,
    }),
    layout: { tableId: DEMO_TABLE_ID, background, grid: emptyBoard().grid, materials: [] },
  });
  const counter = (id, name, value, max) => ({ id, name, value, max, public: true });
  return {
    camp,
    scenes: [
      scene({
        id: 'demo-bridge', name: 'Засада гоблинов у каменного моста', kind: 'encounter', background: bridge,
        objective: 'Провести караван через мост.',
        combatants: [
          goblin('goblin-monarch', 'monarch', 'Гоблин-монарх', 'Лидер', 80, 12),
          goblin('goblin-warrior', 'warrior', 'Гоблин-воин', 'Орда', 15, 3),
          goblin('goblin-cursespitter', 'cursespitter', 'Гоблин-проклинатель', 'Орда', 10, 3),
          goblin('goblin-snipers', 'sniper', 'Гоблины-снайперы', 'Миньон', 12, 0.75, 4),
        ],
      }),
      scene({
        id: 'demo-watch', name: 'Разговор с дозорными', kind: 'negotiation', background: gate,
        objective: 'Получить разрешение на проход в город.',
        counters: [counter('interest', 'Интерес', 1, 5), counter('patience', 'Терпение', 3, 5)],
        challenge: {
          kind: 'negotiation', npc: 'Начальница дозора', impression: 5, initialInterest: 1, initialPatience: 3,
          traits: [
            { id: 'watch-protection', name: 'Защита', kind: 'motivation', revealed: true },
            { id: 'watch-justice', name: 'Справедливость', kind: 'motivation', revealed: false },
            { id: 'watch-greed', name: 'Жадность', kind: 'pitfall', revealed: false },
          ],
          offers: ['Дозор закрывает ворота.', 'Пропуска нет.', 'Предлагает ночлег вне стен.',
            'Пускает, если герои помогут дозору.', 'Выдаёт пропуск.', 'Выдаёт пропуск и даёт проводника.'],
        },
      }),
      scene({
        id: 'demo-forest', name: 'Через затопленный лес', kind: 'montage', background: forest,
        objective: 'Найти безопасный путь до тракта.',
        counters: [counter('successes', 'Успехи', 0, 6), counter('failures', 'Провалы', 0, 3)],
        challenge: {
          kind: 'montage', difficulty: 'hard', rounds: 2,
          obstacles: 'Переправиться через разлив. Найти тропу под водой. Вывести караван на сухой берег.',
          outcomes: {
            success: 'Караван выходит к тракту до темноты.',
            partial: 'Караван добирается до тракта, потеряв часть припасов.',
            failure: 'Ночью отряд вынужден разбить лагерь среди затопленных деревьев.',
          },
        },
      }),
    ],
  };
}

function installScenes(table, { camp, scenes }) {
  const board = table.board ??= emptyBoard();
  if (board.sceneId) {
    board.mainLayout ??= { grid: emptyBoard().grid, materials: [] };
    board.mainLayout.background = camp;
  } else {
    board.background = camp;
  }
  for (const preset of scenes) {
    const current = table.scenes.find(scene => scene.id === preset.id);
    if (!current) {
      table.scenes.push(preset);
      continue;
    }
    const onBoard = board.sceneId === current.id;
    const blank = !current.layout && !current.combatants.length && !current.counters.length &&
      current.round === 1 && !current.description && !current.directorNotes && !onBoard;
    if (blank) {
      current.status = 'prepared';
      current.published = false;
    }
    if (current.name === 'Засада у каменного моста' && preset.id === 'demo-bridge') current.name = preset.name;
    current.layout = { ...preset.layout, ...current.layout, background: current.layout?.background ?? preset.layout.background };
    if (!current.combatants.length) current.combatants = preset.combatants;
    if (!current.counters.length) current.counters = preset.counters;
    if (preset.challenge) current.challenge ??= preset.challenge;
    if (onBoard && !board.background) board.background = current.layout.background;
  }
}

/** Adds one reproducible fixture; existing tables and edited demo data are kept. */
export async function seedDemoTable(dataDir = path.join(root, 'demo-data'), { refreshScenes = false } = {}) {
  const file = path.join(dataDir, 'tables.json');
  let state;
  try { state = JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    state = { version: 1, tables: {}, templates: {}, operations: {} };
  }
  if (state.version !== 1 || !state.tables || !state.templates || !state.operations)
    throw new Error('Некорректный формат хранилища столов');
  const existing = Object.hasOwn(state.tables, DEMO_TABLE_ID);
  if (existing && !refreshScenes) return { created: false, id: DEMO_TABLE_ID };

  let updated = false;
  if (!existing) state.tables[DEMO_TABLE_ID] = await createDemoTable();
  const table = state.tables[DEMO_TABLE_ID];
  const before = JSON.stringify(table);
  installScenes(table, await demoScenes(dataDir));
  if (existing) {
    updated = before !== JSON.stringify(table);
    if (!updated) return { created: false, updated, id: DEMO_TABLE_ID };
    table.revision++;
    table.updatedAt = new Date().toISOString();
  }
  await fs.mkdir(dataDir, { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(state), { flag: 'wx', mode: 0o600 });
    await fs.rename(temporary, file);
  } finally { await fs.rm(temporary, { force: true }); }
  return { created: !existing, updated, id: DEMO_TABLE_ID };
}

async function createDemoTable() {
  const updatedAt = new Date().toISOString();
  const visibility = { sections: ['hero', 'development', 'inventory'], notes: [] };
  const players = [
    ['demo-anna', 'Анна', 'demo-elementalist'],
    [DEMO_PLAYER_ID, 'Борис', 'demo-nul'],
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

  return {
    id: DEMO_TABLE_ID, name: 'Демо: Огни старого тракта', ownerId: 'local',
    archived: false, revision: 1, updatedAt, inviteCode: randomUUID(), members,
    scenes: [],
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
}

export async function seedDemoPlayer(dataDir) {
  if (!dataDir) throw new Error('Для демо игрока укажите отдельный DS_DATA_DIR');
  await seedDemoTable(dataDir);
  const store = createTablesStore({ dataDir });
  let table = await store.read(DEMO_TABLE_ID);
  const { hero } = table.members.find(member => member.userId === DEMO_PLAYER_ID);
  const filename = `${hero.id}.json`;
  const document = JSON.parse(await fs.readFile(path.join(root, 'demo-data', 'characters', filename), 'utf8'));
  document.name = hero.name;
  document.stamina = { ...document.stamina, ...hero.stamina };
  document.heroicResource = { ...document.heroicResource, ...hero.resources.heroicResource };
  const characters = path.join(dataDir, 'characters');
  await fs.mkdir(characters, { recursive: true });
  await fs.writeFile(path.join(characters, filename), JSON.stringify(document), { flag: 'wx', mode: 0o600 })
    .catch(error => { if (error.code !== 'EEXIST') throw error; });

  if (!table.combat && !table.board.sceneId) {
    const sceneId = 'demo-bridge';
    const apply = (type, payload) => store.command(DEMO_TABLE_ID, {
      type, operationId: randomUUID(), expectedRevision: table.revision, payload,
    });
    table = await apply('board-start-scene', { sceneId });
    await apply('combat-start', { sceneId, initiative: 'heroes' });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--player')) {
    await seedDemoPlayer(process.env.DS_DATA_DIR);
    console.log('Демо-стол игрока готов: Борис');
  } else {
    const result = await seedDemoTable(process.env.DS_DATA_DIR, { refreshScenes: process.argv.includes('--refresh-scenes') });
    console.log(result.created ? 'Демо-стол создан: Огни старого тракта'
      : result.updated ? 'Заготовки демо-стола обновлены' : 'Демо-стол уже готов');
  }
}
