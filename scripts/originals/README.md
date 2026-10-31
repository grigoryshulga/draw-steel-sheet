# Английские оригиналы компендиума

Каждая сущность компендиума хранит русское название и описание вместе с
английским оригиналом:

```json
{
  "id": "feature.ability.fury.level-1.hit-and-run",
  "name": "Бей и Беги",
  "originalId": "mcdm.heroes.v1/feature.ability.fury.level-1/hit-and-run",
  "originalName": "Hit and Run",
  "originalDescription": "*Staying in constant motion helps you slip out of reach…*",
  "legacyId": "neistovyy-bey-i-begi-d49f37111e"
}
```

`id` — канонический английский scc-id. `legacyId` остаётся только у записей,
которые уже успели сохраниться в листах героев; по нему `src/data/originals.ts`
находит новую запись. Поля `originalName` и `originalDescription` могут быть
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
- `scripts/build-originals.mjs` — применяет карты к `src/data/*.generated.json`,
  обновляет `src/data/legacy-ids.generated.json` и справочники состояний,
  навыков и Кодекса.

## Обновление

```bash
npm run data:originals   # только пересобрать оригиналы
npm run data             # полная пересборка данных, включая оригиналы
```

`npm run data` требует соседний checkout `drawsteel-ru`; `data:originals`
работает по уже сгенерированным JSON и закоммиченной выгрузке.

Если в SteelCompendium появились новые сущности, обновите `reference/` и
добавьте пары в соответствующую карту. Скрипт печатает предупреждения о
записях, для которых не нашлось английского оригинала.

## Домашние материалы

«Таурус» и «Ящер» — происхождения кампании «Последний Миф», их нет в
английском компендиуме. Для них используются английские синтетические id
(`ancestry.tauros.*`, `ancestry.lizardfolk.*`) и английские названия, а
`originalDescription` остаётся пустым.
