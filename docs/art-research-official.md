# Draw Steel: официальные арты классов и происхождений

Проверено: 2026-10-23. Цель — найти открытые оригиналы MCDM для классов и 14 происхождений, зафиксировать происхождение файлов и подготовить найденные изображения для последующей обработки. Этот отчёт не является разрешением на использование изображения: Creator License отдельно регулирует текст и книжный арт.

## Выводы

- Найдены официальные источники для **9 из 10 классов**: девять PNG в разделе Meet the Iconic Heroes of Draw Steel на [пресс-странице MCDM](https://www.mcdmproductions.com/press). Оригиналы скачаны в `assets/art-originals/classes/`.
- Найдены официальные источники для **12 из 14 происхождений проекта**: витражные портреты и иллюстрация рейдеров времени в общедоступных превью [Draw Steel Heroes в магазине MCDM](https://shop.mcdmproductions.com/products/draw-steel-heroes-pdf). Оригинальные развороты 5200×3513 скачаны в `assets/art-originals/ancestries/`.
- Призыватель не представлен среди девяти пресс-иллюстраций. Таурус и Ящер — собственные происхождения кампании «Последний Миф» по тексту перевода. Для этих трёх позиций созданы оригинальные иллюстрации в согласованном направлении.
- [VerisimLLC/draw-steel-data](https://github.com/VerisimLLC/draw-steel-data) дополнительно подтверждает ancestry portrait records для 12 базовых происхождений. Бинарные файлы из этого репозитория не получались: его `imageId` — внутренний идентификатор Codex, а не прямой URL.

## Официальные PNG и подтверждение классов

Связь двух названных героев с классами подтверждается кампанией MCDM [Draw Steel, Roll Power, DICE!](https://www.backerkit.com/c/projects/mcdm-productions/draw-steel-roll-power-dice): там перечислены Khorva — Fury Dice Box и Gwillyth — Shadow Dice Box. Для остальных соответствие следует из названий файлов в секции MCDM “Meet the Iconic Heroes of Draw Steel”. Картинки не дают подтверждённого соответствия происхождению, поэтому происхождения героев здесь не угадываются.

| Класс проекта | Герой / файл | Оригинальный PNG |
|---|---|---|
| Неистовый / Fury | Khorva (`ds_khorva.png`) | https://images.squarespace-cdn.com/content/v1/59b345e82994caee6bd4c397/1732570008283-ZHPDXM2N3Q0CIYTSXABX/ds_khorva.png |
| Цензор / Censor | `ds_censor.png` | https://images.squarespace-cdn.com/content/v1/59b345e82994caee6bd4c397/1732570008598-LMIFJJ2JF3ZWCOZC5IAV/ds_censor.png |
| Тактик / Tactician | `ds_tactician.png` | https://images.squarespace-cdn.com/content/v1/59b345e82994caee6bd4c397/1732570010974-X6V4C7MH7Y3YV10T7TX0/ds_tactician.png |
| Тень / Shadow | Gwillyth (`ds_gwillyth.png`) | https://images.squarespace-cdn.com/content/v1/59b345e82994caee6bd4c397/1732570011251-40PQYUX6OWSL6KZZQVRE/ds_gwillyth.png |
| Элементалист / Elementalist | `ds_elementalist.png` | https://images.squarespace-cdn.com/content/v1/59b345e82994caee6bd4c397/1732570012925-QQRE6Q2CDYH6DQHMA4O3/ds_elementalist.png |
| Проводник / Conduit | `ds_conduit.png` | https://images.squarespace-cdn.com/content/v1/59b345e82994caee6bd4c397/1739553955049-K939HEYAR5GI0MCLTL6B/ds_conduit.png |
| Нуль / Null | `ds_null.png` | https://images.squarespace-cdn.com/content/v1/59b345e82994caee6bd4c397/1739553956100-28VYAGSQ200OE944MNQE/ds_null.png |
| Талант / Talent | `ds_talent.png` | https://images.squarespace-cdn.com/content/v1/59b345e82994caee6bd4c397/1739553957607-KZ6FMZCWZNW0B9GVSIIQ/ds_talent.png |
| Трубадур / Troubadour | `ds_troubadour.png` | https://images.squarespace-cdn.com/content/v1/59b345e82994caee6bd4c397/1739553958918-3J0W36E469V5JM0K05TM/ds_troubadour.png |

Покрытие классов — 9/10 официальными press PNG. Для Призывателя / Summoner на этой press-странице отдельного героя нет; для проекта создан отдельный оригинальный арт. Остальные имена в `src/data/classes.ts` совпадают с покрытыми девятью классами.

## Происхождения и записи Codex

В YAML расы `portraitid` указывает на запись из `images/`. Поиск выполнялся в публичном репозитории `VerisimLLC/draw-steel-data`; ссылка в столбце ведёт к конкретному официальному YAML в ветке `main`. Записи подтверждают портрет и его ancestry, но не предоставляют скачиваемый URL или имя художника. Значения `imageId` — внутренние идентификаторы; они не включены в ссылки как будто это URLs.

| Происхождение проекта | English | Codex portrait record / imageId | Открытый оригинал |
|---|---|---|---|
| Дьявол | Devil | [devil.yaml](https://github.com/VerisimLLC/draw-steel-data/blob/main/objectTables/races/devil.yaml) → `35995efc-298b-4806-88df-4fb90b59ed18`; [image YAML](https://github.com/VerisimLLC/draw-steel-data/blob/main/images/35995efc-298b-4806-88df-4fb90b59ed18.yaml), `NM0nmKTKgAbPYwGqUy7oHA==` | [Портрет в превью MCDM](https://shop.mcdmproductions.com/cdn/shop/files/Ancestries.png?v=1773947402) |
| Драконий Рыцарь | Dragon Knight | [dragon-knight.yaml](https://github.com/VerisimLLC/draw-steel-data/blob/main/objectTables/races/dragon-knight.yaml) → `e00ca1a3-a9d6-4f8c-a5ea-6c632b5b7e91`; [image YAML](https://github.com/VerisimLLC/draw-steel-data/blob/main/images/e00ca1a3-a9d6-4f8c-a5ea-6c632b5b7e91.yaml), `7rXrYT8SbMBj8g7rXeEoHQ==` | [Портрет в превью MCDM](https://shop.mcdmproductions.com/cdn/shop/files/Ancestries.png?v=1773947402) |
| Дварф | Dwarf | [dwarf.yaml](https://github.com/VerisimLLC/draw-steel-data/blob/main/objectTables/races/dwarf.yaml) → `26af3473-5f10-4fb1-96b6-0519b9071fd7`; [image YAML](https://github.com/VerisimLLC/draw-steel-data/blob/main/images/26af3473-5f10-4fb1-96b6-0519b9071fd7.yaml), `Ob6uonpzP5dH53MjNTl4Qg==` | [Портрет в превью MCDM](https://shop.mcdmproductions.com/cdn/shop/files/Ancestries.png?v=1773947402) |
| Лесной Эльф | Wode Elf | [elf-wode.yaml](https://github.com/VerisimLLC/draw-steel-data/blob/main/objectTables/races/elf-wode.yaml) → `9089e2ec-6a9c-44ad-827f-41b527ccd47c`; [image YAML](https://github.com/VerisimLLC/draw-steel-data/blob/main/images/9089e2ec-6a9c-44ad-827f-41b527ccd47c.yaml), `jvaTOJ85W838sYDWFcbfjA==` | [Портрет в превью MCDM](https://shop.mcdmproductions.com/cdn/shop/files/Ancestries.png?v=1773947402) |
| Высший Эльф | High Elf | [elf-high.yaml](https://github.com/VerisimLLC/draw-steel-data/blob/main/objectTables/races/elf-high.yaml) → `25b140f8-85b4-4e34-b609-4a1a3b284844`; [image YAML](https://github.com/VerisimLLC/draw-steel-data/blob/main/images/25b140f8-85b4-4e34-b609-4a1a3b284844.yaml), `y2kktTuTqA7Xxzv9CJW0Lw==` | [Портрет в превью MCDM](https://shop.mcdmproductions.com/cdn/shop/files/Ancestries.png?v=1773947402) |
| Хакаан | Hakaan | [hakaan.yaml](https://github.com/VerisimLLC/draw-steel-data/blob/main/objectTables/races/hakaan.yaml) → `df684a74-8198-48f6-9d16-ca138cd91740`; [image YAML](https://github.com/VerisimLLC/draw-steel-data/blob/main/images/df684a74-8198-48f6-9d16-ca138cd91740.yaml), `eUY/9iPw/Kua50K0OJHUUA==` | [Портрет в превью MCDM](https://shop.mcdmproductions.com/cdn/shop/files/Ancestries.png?v=1773947402) |
| Человек | Human | [human.yaml](https://github.com/VerisimLLC/draw-steel-data/blob/main/objectTables/races/human.yaml) → `79130d15-cff3-43de-b278-f1472e9f65cc`; [image YAML](https://github.com/VerisimLLC/draw-steel-data/blob/main/images/79130d15-cff3-43de-b278-f1472e9f65cc.yaml), `JNrYvzi+2TUihPQFr4WIMA==` | [Портрет в превью MCDM](https://shop.mcdmproductions.com/cdn/shop/files/Ancestries.png?v=1773947402) |
| Меманек | Memonek | [memonek.yaml](https://github.com/VerisimLLC/draw-steel-data/blob/main/objectTables/races/memonek.yaml) → `813282dd-577e-4071-9014-8ff7ebe05bfa`; [image YAML](https://github.com/VerisimLLC/draw-steel-data/blob/main/images/813282dd-577e-4071-9014-8ff7ebe05bfa.yaml), `JtUT+bWIH+BfoNgRjaG/bw==` | [Портрет в превью MCDM](https://shop.mcdmproductions.com/cdn/shop/files/Ancestries.png?v=1773947402) |
| Орк | Orc | [orc.yaml](https://github.com/VerisimLLC/draw-steel-data/blob/main/objectTables/races/orc.yaml) → `00a4c8df-b7f5-4cc0-834e-335d589cf399`; [image YAML](https://github.com/VerisimLLC/draw-steel-data/blob/main/images/00a4c8df-b7f5-4cc0-834e-335d589cf399.yaml), `x8v9Lpm2zEOXykYl3xynlA==` | [Портрет в превью MCDM](https://shop.mcdmproductions.com/cdn/shop/files/Ancestries.png?v=1773947402) |
| Полдер | Polder | [polder.yaml](https://github.com/VerisimLLC/draw-steel-data/blob/main/objectTables/races/polder.yaml) → `300e4a77-9fef-4f9d-a0e5-7214a27df81e`; [image YAML](https://github.com/VerisimLLC/draw-steel-data/blob/main/images/300e4a77-9fef-4f9d-a0e5-7214a27df81e.yaml), `2b1tylIqo1Dq60NIYN7z/A==` | [Портрет в превью MCDM](https://shop.mcdmproductions.com/cdn/shop/files/Ancestries.png?v=1773947402) |
| Ревенант | Revenant | [revenant.yaml](https://github.com/VerisimLLC/draw-steel-data/blob/main/objectTables/races/revenant.yaml) → `a99e385f-b67c-461d-a9c4-bc37b63617a7`; [image YAML](https://github.com/VerisimLLC/draw-steel-data/blob/main/images/a99e385f-b67c-461d-a9c4-bc37b63617a7.yaml), `QIS79mXh4iLRX7wv5Rn3oQ==` | [Портрет в превью MCDM](https://shop.mcdmproductions.com/cdn/shop/files/Ancestries.png?v=1773947402) |
| Рейдер Времени | Time Raider | [time-raider.yaml](https://github.com/VerisimLLC/draw-steel-data/blob/main/objectTables/races/time-raider.yaml) → `7d802723-8c2a-41e0-9e8b-5b4556cb6866`; [image YAML](https://github.com/VerisimLLC/draw-steel-data/blob/main/images/7d802723-8c2a-41e0-9e8b-5b4556cb6866.yaml), `3E7701wN87HxaenFfz2mTQ==` | [Портрет в превью MCDM](https://shop.mcdmproductions.com/cdn/shop/files/Ancestries.png?v=1773947402) |
| Таурус | Taurus | В публичном YAML-экспорте portrait record не обнаружен | Не найден |
| Ящер | Saurian | В публичном YAML-экспорте portrait record не обнаружен | Не найден |

Дополнительные image records с тегами `ancestry` и ancestry-названиями также есть, но они не привязаны полем `portraitid` к перечисленным 14 расам; из-за этого их нельзя уверенно назначить конкретному происхождению без визуальной проверки/дополнительного первичного подтверждения. В основном наборе Codex поля `artist` и `description` у перечисленных records пусты.

## Лицензия и допустимый вывод

[Draw Steel Creator License](https://www.mcdmproductions.com/draw-steel-creator-license), редакция с датой последнего изменения 9 июня 2026 года:

* Лицензия позволяет публиковать основанные на Draw Steel работы и объявлять совместимость без отдельного разрешения MCDM, если соблюдены условия.
* Она прямо запрещает копировать или воспроизводить любой арт из книг без явного письменного разрешения MCDM. В FAQ также говорится, что можно делиться сырым текстом перечисленных продуктов, но нельзя делиться скриншотами страниц или артом. Для запроса разрешения указан `creatorlicense@mcdmproductions.com`.
* Creator License разрешает использовать визуальные дизайны как вдохновение для создания собственных оригинальных иллюстраций. Это условие не является лицензией на копирование исходных иллюстраций.
* Лицензия перечисляет охваченные публикации и отдельно указывает, что Patreon, Arcadia, прежние и будущие продукты, не входящие в перечисленный список, ею не покрываются.

Это фиксация смысла опубликованных условий, не юридический вывод о применимости лицензии к конкретному фан-проекту или к press PNG. Press-страница официально публикует изображения, но Creator License сама по себе не говорит, что press PNG разрешено повторно использовать; у каждого файла необходимо сохранять точную ссылку и атрибуцию источника, а условия использования именно этих PNG в отчёте не заявляются.

## Результат по файлам

- Официальные классы: девять неизменённых пресс-оригиналов и девять обработанных прозрачных PNG в `public/art/classes/`; отдельно сгенерирован Призыватель.
- Официальные базовые происхождения: два неизменённых превью-разворота; прозрачные адаптации 12 происхождений в `public/art/ancestries/`. Для рейдеров времени взята пара персонажей из отдельной иллюстрации, для остальных — подписанные витражные портреты.
- Таурус и Ящер: два оригинальных PNG с `origin: generated`.
- Обработка изображений выполнена встроенным ImageGen; это адаптации официальной основы с AI, а не побитовые вырезки. Источники, сведения о происхождении и промпты/описания операций записаны в `docs/art/*-manifest.json`, а кредиты доступны в интерфейсе. Подробности интеграции: [docs/art/README.md](art/README.md).

## Подтверждение источников в официальном магазине

Найдены общедоступные иллюстрированные превью в [официальном магазине MCDM](https://shop.mcdmproductions.com/products/draw-steel-heroes-pdf). [Product JSON](https://shop.mcdmproductions.com/products/draw-steel-heroes-pdf.json) подтверждает эти файлы как изображения продукта.

- [Ancestries.png](https://shop.mcdmproductions.com/cdn/shop/files/Ancestries.png?v=1773947402): 5200×3513, разворот с 12 подписанными витражными портретами. Порядок слева направо, сверху вниз: Human, Devil, Polder, Time Raider; Orc, Wode Elf, High Elf, Dragon Knight; Memonek, Dwarf, Hakaan, Revenant. Сохранён без изменений в `assets/art-originals/ancestries/ancestries-spread.png`. Это подтверждённый официальный источник артов всех 12 базовых происхождений.
- [time_raiders.png](https://shop.mcdmproductions.com/cdn/shop/files/time_raiders.png?v=1773947402): 5200×3513, разворот с иллюстрацией двух рейдеров времени слева. Сохранён в `assets/art-originals/ancestries/time-raiders.png`.
- Таурус и Ящер — собственные происхождения кампании «Последний Миф» по тексту перевода, а не недостающие официальные базовые происхождения MCDM. Для них нужны оригинальные изображения.

Итог подтверждённых источников: 9/10 классов и 12/14 происхождений проекта. Картинки магазина опубликованы как превью; это запись происхождения файлов, а не отдельное разрешение на их перепубликацию.
