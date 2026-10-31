# Английские оригиналы компендиума

Каждая сущность компендиума хранит русское название и описание вместе с
английским оригиналом:

```json
{
  "id": "feature.ability.fury.level-1.hit-and-run",
  "name": "Бей и Беги",
  "originalId": "mcdm.heroes.v1/feature.ability.fury.level-1/hit-and-run",
  "originalName": "Hit and Run",
  "originalDescription": "*Staying in constant motion helps you slip out of reach…*"
}
```

`id` — канонический английский scc-id. Старые id сохранены только в
`src/generated/legacy-ids.json` для чтения уже сохранённых листов героев; в
канонических сущностях и проекциях поля `legacyId` больше нет. Поля `originalName` и `originalDescription` могут быть
пустыми у домашних материалов, которых нет в английском компендиуме.

## Источник

Выгрузка из [SteelCompendium/data-unified](https://github.com/SteelCompendium/data-unified)
(книга Heroes, формат `en/unified/json` и `en/books/heroes/md-linked`).
Данные используются как справочник оригинальных названий и текста; русские
названия и описания остаются основными для интерфейса.

## Файлы

- `reference/*.json` — компактная выгрузка английских сущностей. Описания
  очищены от scc-ссылок, чтобы их можно было показывать в приложении.
- `maps/*.json` — сопоставление русских записей с `scc`:
  - `fury.json`, `null.json`, … — способности и классовые особенности;
  - `ancestry-features.json`, `kits.json`, `perks.json`, `ancestries.json`,
    `cultures.json`, `careers.json`, `classes.json`, `complications.json`,
    `conditions.json`, `skills.json` — остальные семейства;
  - `catalog.json` — проекты, сокровища и титулы из глав 16/18/19;
  - `subclasses.json` — английские названия подклассов;
  - `unmapped-*.json` — английские id и названия для структурных заголовков,
    контейнеров и домашних материалов без отдельного `scc`;
  - `codex-*.json` — статьи Кодекса → разделы английской книги.
- `scripts/content/lib/originals.mjs` — применяет карты к проекциям
  `src/generated/consumers/*.json` и пакетам `src/generated/rules/packs/*.json`
  внутри `content:build`.

## Обновление

```bash
npm run content:build    # канонические правила + проекции с оригиналами
npm run content:check    # проверка, что проекции совпадают с каноном
```

`npm run data` остаётся командой миграции старых снапшотов и требует
соседний checkout `drawsteel-ru`.

Если в SteelCompendium появились новые сущности, обновите `reference/` и
добавьте пары в соответствующую карту. Скрипт печатает предупреждения о
записях, для которых не нашлось английского оригинала.

## Домашние материалы

«Таурус» и «Ящер» — происхождения кампании «Последний Миф», их нет в
английском компендиуме. Для них используются английские синтетические id
(`ancestry.tauros.*`, `ancestry.lizardfolk.*`) и английские названия, а
`originalDescription` остаётся пустым.
