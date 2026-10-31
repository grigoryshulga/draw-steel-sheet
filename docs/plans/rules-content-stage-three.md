# Этап 3: полный перевод потребителей на канонические данные

Контекст: этапы 1–2 построили каноническое дерево `content/rules` (296 статей,
1632 сущности), ленивый поиск и проекции `abilities.json` / `library.json`
(`scripts/content/build-consumer-data.mjs`). Осталось перевести всех runtime-потребителей
на канонические проекции, чтобы `src/data/*.generated.json` остались только
снапшотами паритета для тестов.

## Цель этапа

Ни один модуль `src/**` не читает `src/data/*.generated.json` на этапе выполнения.
Все данные конструктора, листа и Кодекса приходят из проекций
`src/generated/consumers/**` и `src/generated/rules/manifest.json`, собираемых из
канонического дерева. Идентичность записей (ID из сохранений игроков) сохранена.

## Разведанные факты

- `builder.generated.json`: `ancestries` 14, `cultures` {environment 5, organization 2, upbringing 6},
  `careers` 18, `classes` 10 (Неистовый, Нуль, Призыватель, Проводник, Тактик,
  Талант, Тень, Трубадур, Цензор, Элементалист), `complications` 100.
- Канонические сущности `feature` — 860: 97 особенностей происхождений (каталоги
  `ancestry-*`) + 763 классовых. **Класс Призыватель (группа 0821) в сущностях
  отсутствует** — в legacy 845 классовых особенностей, разрыв ~82 записи.
- Сущности `kit` — 21, legacy наборов 22: комплект 0924 «Буревестник» отложен
  (чередует прозу и блоки способностей). На этом этапе включаем и его.
- Сущностей-видов `class`, `career`, `culture`, `complication` ещё нет.
- Статьи хранят текст в `blocks` (`{type:"markdown", text}` и ссылки на сущности);
  карьера 0601 содержит выгоды и таблицу d6 инцидентов; известность/богатство —
  в обзорной таблице главы 06.
- `src/lib/codex.ts` читает `codex-index.generated.json` (248 КБ в бандле);
  навигации хватает манифеста `src/generated/rules/manifest.json`.
  `scripts/build-art-manifest.mjs` тоже читает codex-index.
- Runtime-потребители legacy: `src/data/kits.ts`, `src/data/perks.ts`,
  `src/data/ancestry-features/*` (+ `mechanics/*`), `src/data/class-features/*`
  (вкл. `censor-abilities.ts`, `conduit-abilities.ts`, `mechanics/fury.ts`,
  `mechanics/talent-early.ts`), `src/data/level-up-rules.ts`,
  `src/lib/character-builder.ts`, `src/lib/codex.ts`.

## Правила для всех агентов

- Работаем в общем чекауте, БЕЗ коммитов, дочерних агентов и `git push`.
- Игровой текст на русском. Новые технические имена (файлы, каталоги, ID
  сущностей) — без транслита; существующие исторические ID/пути не переименовывать.
- `src/data/*.generated.json` — только чтение для паритета/идентичности,
  источником контента они быть не могут. Источник — только `content/rules/**`.
- Идентичность: проекции выдают legacy-ID из `entity.legacyIds` и порядок из
  `scripts/content/lib/consumer-identity.json` (пополнять через `--update-identity`).
- Механика (числа, таблицы) в `mechanics/*` остаётся рукописной; меняется только
  поставщик скелетных данных.
- После своих правок: `npm run content:build && npx tsc --noEmit && npx vitest run <свои тесты>`.
  Полный `npm run check` гоняет интегратор.

## Волны и владение

### Волна 1 (параллельно)

**D1 — сущности** (`scripts/content/migrate-entities.mjs`, `content/rules/**`,
`tests/rules-content-entities.test.ts`, `content/rules/migration-report.json`):
- новые виды сущностей: `class` (10), `career` (18), `complication` (100),
  `culture` (13: 5+2+6) — парсинг из статей глав 03/05/06/08/11;
- особенности Призывателя (группа статей 0821) — видом `feature`, ID без транслита,
  legacyIds из legacy-скелета;
- комплект 0924 «Буревестник» — сущность `kit` с полным markdown;
- миграция идемпотентна: повторный полный импорт воспроизводит то же дерево.

**D2 — проекции, часть 1** (`scripts/content/build-consumer-data.mjs`,
`scripts/content/lib/consumer-identity.json`, `src/generated/consumers/**`,
`src/rules/consumer-data.ts`, `tests/rules-consumers.test.ts`):
- новые проекции из канона: `kits.json`, `perks.json`, `features.json`
  (особенности происхождений и классов: id/level/className|ancestryName/name/
  articleId/description), `level-up.json` (LevelUpRule-структуры из статей 08xx);
- паритет с legacy-снапшотами по полям и ID (кроме случаев, где legacy содержит
  синтетические строки — зафиксировать расхождения в тесте явно).

**D3 — Кодекс на манифесте** (`src/lib/codex.ts`, `scripts/build-art-manifest.mjs`,
`src/lib/art.ts` если нужно, затрагиваемые тесты):
- `codexLink`/навигация читают манифест; `RuleArticle.markdown` уходит из
  навигационного индекса; `build-art-manifest.mjs` читает манифест;
- из бандла уходит `codex-index.generated.json`.

### Волна 2 (после волны 1)

**D4 — builder-проекция** (те же файлы, что D2): `builder.json` —
ancestries/cultures/careers/classes/complications из сущностей D1.

**D5 — потребители данных** (`src/data/kits.ts`, `src/data/perks.ts`,
`src/data/ancestry-features/**`, `src/data/class-features/**`,
`src/data/level-up-rules.ts`, их тесты): чтение проекций D2 вместо legacy-JSON,
публичные контракты модулей неизменны.

### Волна 3

**D6 — конструктор** (`src/lib/character-builder.ts`, `src/data/classes.ts` если
затронется, тесты конструктора): `BUILDER_DATA` читает проекцию D4.

**Интегратор (родитель):** guard импортов в `scripts/check-architecture.mjs`
(запрет `src/data/*.generated.json` вне тестов), освежение миграционного отчёта,
`docs/ARCHITECTURE.md` + README, полный `npm run check`, `git diff --check`.

## Ревью

После волны 2 — независимое ревью diff (GLM-5.3, thinking max): корректность
парсинга, идентичность ID, регрессии контрактов. После интеграции — финальное
ревью всей задачи целиком (GLM-5.3, thinking max).

## Критерии готовности этапа

1. `grep -rn "data/.*\.generated\.json" src/` — только типы/комментарии без импортов
   (либо ноль), runtime-импортов нет.
2. `npm run check` зелёный: guard архитектуры, свежесть генерации, тесты, tsc, build.
3. Сохранения игроков совместимы: ID наборов/перков/особенностей/способностей
   совпадают с legacy (паритет-тесты).
4. `git diff --check` чист; изменения не закоммичены.
5. Отчёт миграции не содержит runtime-потребителей; отложенные случаи
   документированы.
