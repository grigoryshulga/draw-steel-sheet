# Draw Steel kit and career art research

Research date: 2026-10-23. Scope: locate original MCDM illustrations for every kit and career currently listed in this repository, verify provenance, and record style references for a later original-art generation pass. No artwork was generated or edited during this research.

## Coverage summary

| Category | Catalog size | Verified official original files found | Still needs original art |
|---|---:|---:|---:|
| Kits | 22 | 0 | 22 |
| Careers | 18 | 0 | 18 |
| **Total** | **40** | **0** | **40** |

No files were copied into `assets/art-originals/kits/` or `assets/art-originals/careers/`: the reviewed public sources did not expose an individually attributable official kit or career illustration suitable for these assets. Those directories are present and empty. This avoids mislabeling third-party or unrelated official art as a matching original.

## Catalog checked

The kit names come from `src/data/kits.generated.json`:

- Беглый Огонь
- Боевой Разум
- Буревестник
- Вихрь
- Воин-Жрец
- Гвизармьер
- Гора
- Дуэлист
- Заклинатель Клинков
- Кулачный Боец
- Мастер Боевых Искусств
- Меч и Щит
- Мистический Лучник
- Налетчик
- Пантера
- Парное Оружие
- Плащ и Кинжал
- Посох и Роба
- Рейнджер
- Ретиарий
- Сияющие Доспехи
- Снайпер

The career names come from `src/data/builder.generated.json` (`careers`) and agree with `CAREERS` in `src/data/classes.ts`:

- Агент
- Аристократ
- Гладиатор
- Исследователь
- Исполнитель
- Лесничий
- Моряк
- Мудрец
- Нищий
- Политик
- Послушник
- Преступник
- Работник
- Ремесленник
- Солдат
- Страж
- Ученик Мага
- Фермер

The same builder catalog contains 10 class entries, which are relevant as potential visual anchors but are not the requested career art:

- Неистовый
- Нуль
- Призыватель
- Проводник
- Тактик
- Талант
- Тень
- Трубадур
- Цензор
- Элементалист

## Sources and provenance

### MCDM primary sources

- [Draw Steel Resources](https://www.mcdmproductions.com/draw-steel-resources) is MCDM’s official resource hub. It links character sheets, rule references, the art description guide, and pregenerated character PDFs, but does not provide a downloadable kit-art or career-art collection. The pregens are class-focused examples, not a one-to-one art catalog for the 40 requested entries.
- [Draw Steel Art Description Guide (official PDF)](https://files.mcdmproductions.com/DrawSteel/DrawSteelArtDescriptionGuide.pdf) says Draw Steel art is generally contemporary fantasy unless otherwise noted, while sometimes referencing art history, genre, or medium; the specific allusions are noted where possible. It also describes a consistent approach to depicting characters: appearance, clothing/armor, items, stance/action, and surroundings. This is reliable guidance for visual description, but it does not itself provide an art pack or grant reuse rights.
- [Draw Steel Creator License](https://mcdm.gg/ds-license) explicitly says creators may not copy or reproduce art from the covered books without written permission, while original illustrations may be inspired by visual designs. The covered rules/text license should not be treated as permission to redistribute MCDM art. For this research, an original image is retained only if its MCDM provenance and reuse status can be established; none met that bar.

### Public third-party repository checked

- [Forge Steel README](https://github.com/andyaiken/forgesteel/blob/main/readme.md) identifies Forge Steel as a hero builder/Director toolkit designed and built by Andy Aiken, calls it an independent product, and states that it is not affiliated with MCDM. Its statement that the library contains official game content describes its game data; it does not establish that every bundled image is MCDM-owned or licensed for reuse.
- Repository inspected: [andyaiken/forgesteel](https://github.com/andyaiken/forgesteel), commit [`18e6b189fe097ed7c4d7f705e8ca285eab444e4b`](https://github.com/andyaiken/forgesteel/tree/18e6b189fe097ed7c4d7f705e8ca285eab444e4b). Its checked-in `public/assets/clocktower/` images are named for classes, ancestries, and setting/NPC subjects (for example [`fury/good.png`](https://github.com/andyaiken/forgesteel/blob/18e6b189fe097ed7c4d7f705e8ca285eab444e4b/public/assets/clocktower/fury/good.png), [`tactician/good.png`](https://github.com/andyaiken/forgesteel/blob/18e6b189fe097ed7c4d7f705e8ca285eab444e4b/public/assets/clocktower/tactician/good.png), and [`troubadour/good.png`](https://github.com/andyaiken/forgesteel/blob/18e6b189fe097ed7c4d7f705e8ca285eab444e4b/public/assets/clocktower/troubadour/good.png)). The repository’s `src/data/careers/` contains data modules for careers, but no career illustration set; `src/data/kits/` likewise contains kit data modules, not matching kit-art files. The clocktower PNGs are not kit/career matches and their image-by-image artist/license provenance is not demonstrated by the repo README. They were not copied into this project.

## Findings by category

- **Kits: 0/22 original matches.** No MCDM-hosted individual images or Forge Steel images keyed to these kit names were found. Forge Steel’s kit source files are game data, not visual source files. All 22 listed kits therefore need generated original illustrations for a complete catalog.
- **Careers: 0/18 original matches.** MCDM’s official resources surfaced no individual career-art collection. Forge Steel has career rule/data modules but no career image files. All 18 listed careers need generated original illustrations for a complete catalog.
- **Classes: 10 entries available as concepts, not original art matches.** Forge Steel contains class-named images for several core classes, but these are third-party bundled assets with unverified image provenance and cannot stand in as verified official source files. The official MCDM pregen PDFs may be used as further visual research references if their pages are reviewed, but are not included as kit/career originals here.

## Visual reference notes for a unified original set

Use the MCDM art guide as the defensible style-level reference: contemporary fantasy is the default, with occasional clearly intentional historical-art, genre, or medium references. Translate each kit/career into a readable character-focused scene with a distinct silhouette, purposeful gear/clothing, a strong action or stance, and a setting detail that supports the role. Keep material and surface descriptions concrete (fabric, leather, metal, weather, light) and compose the focal figure so the role remains legible at small card-thumbnail size. Vary age, body type, skin tone, gender presentation, and ancestry across the full set rather than repeating a single stock hero. These are art-direction recommendations inferred from the official guide and the project’s roster, not claims that every MCDM image follows one rigid rendering recipe. The guide does not mandate a specific palette, brushwork, line weight, or crop, so lock those as a consistent product-level generation specification before producing the catalog.

## Plan for complete generation after research

1. Build a 40-row art brief keyed to stable ASCII slugs, one row per kit/career. Ground kit props in each kit’s equipment and combat identity; ground career props and environments in the career description/benefit data. Avoid copying recognizable compositions or characters from MCDM art.
2. Set shared output rules: PNG, common canvas/aspect ratio, consistent full or three-quarter figure crop, subject scale, background treatment, lighting/palette range, and safe padding for UI cropping. Include a distinct silhouette and one primary visual cue for each entry.
3. Generate one small pilot batch (for example 3 kits + 3 careers), review for style cohesion, role readability, diversity, and thumbnail legibility, then tune the shared prompt/spec before scaling.
4. Generate remaining entries in controlled batches, retaining prompt/seed and a manifest that maps each slug to source data and final PNG. Keep all generated images original and clearly distinguish them from any separately licensed source art.
5. Check the complete 40-file manifest against the catalogs and inspect the rendered thumbnails before wiring images into the app. This validation belongs to the later art implementation phase; no code or raster changes were made in this research phase.

## Limits

This is a public-source survey, not a claim that no art exists in the paid rulebooks, private backer materials, or MCDM’s internal archives. The findings mean no matching originals were publicly surfaced and provenance-verified through the reviewed sources. Do not treat the existence of an image in a fan-made or independent project as proof of permission to redistribute it.
