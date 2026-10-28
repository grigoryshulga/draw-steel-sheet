import type { FeatureMechanics } from "../types";

/** Базовые особенности Проводника первого уровня, кроме доменных записей. */
export const CONDUIT_BASE_MECHANICS: Record<string, FeatureMechanics> = {
  "conduit.feature.1.bozhestvo-i-domeny": {
    kinds: ["grant"],
    notes: "Выбор божества и портфолио зависит от мира кампании. Пара доменов хранится под conduit.domain, а особенность первого домена выбирает builder/level-up под conduit.domain.1; фиксированного списка вариантов в записи нет.",
  },
  "conduit.feature.1.osobennost-domena-1-go-urovnya": {
    kinds: ["grant"],
    notes: "При создании героя NewCharacterDialog предлагает выбрать домен для особенности 1-го уровня из двух, а character-builder сохраняет выбор в conduit.domain.1. Доступные особенности и навыки определяются выбранным доменом; отдельного списка options у этой базовой записи нет.",
  },
  "conduit.feature.1.istselyayushchaya-blagodat": {
    kinds: ["trigger", "resource"],
    trigger: { event: "use-ability", frequency: "turn", label: "Исцеляющая благодать", detail: "Один раз в ход: маневр, дальность 10; цель — вы или союзник — может потратить Восстановление. За каждое потраченное Благочестие выберите одно улучшение: дополнительная цель, завершить подходящий эффект, встать или потратить ещё одно Восстановление. Применение к другим персонажам не автоматизировано." },
    notes: "Каждое выбранное улучшение стоит ровно 1 Благочестие, как сказано в тексте способности.",
  },
  "conduit.feature.1.luch-gneva": {
    kinds: ["grant"],
    notes: "Луч Гнева можно использовать как свободный удар дальнего боя: Магия, Дальний, Удар; дальность 10, цель — одно существо или объект; бросок силы + Интуиция; урон по тиру 2/4/6 + Интуиция. Свободный удар использует урон и процедуру самой способности; бонус к урону свободного удара — отдельное поле freeStrikeDamage и не должен считаться повторно через rolledDamage. Тип урона можно выбрать святым согласно тексту способности. Тиры не являются полями листа.",
  },
  "conduit.feature.1.trigger-provodnika": {
    kinds: ["trigger"],
    trigger: { event: "passive", frequency: "always", label: "Триггер проводника", detail: "Выберите один триггер. Слово наставления: когда союзник в пределах 10 делает бросок силы для наносящей урон способности, дать преимущество; за 1 Благочестие — двойное преимущество. Слово Суда: когда один союзник должен был бы получить урон от способности, использующей бросок силы, бросок силы получает помеху против этой цели; за 1 Благочестие — двойную помеху против этой цели. Выбор момента и цели ручной; автоматическое вмешательство в бросок не реализовано." },
    notes: "При создании героя NewCharacterDialog показывает «Слово Наставления» и «Слово Суда» как способности, а character-builder требует выбрать ровно одно из них через abilityIds. По скелету Слово Суда срабатывает, когда цель должна была бы получить урон от способности, использующей бросок силы; в эффекте помеха этому броску применяется против цели. Не сужать условие до вражеской цели.",
  },
  "conduit.feature.1.molitva": {
    kinds: ["choice", "grant"],
    choice: { group: "conduit.prayer", options: [
      { id: "conduit.prayer.destruction", label: "Молитва о разрушении" },
      { id: "conduit.prayer.distance", label: "Молитва о дистанции" },
      { id: "conduit.prayer.soldier", label: "Молитва о мастерстве солдата" },
      { id: "conduit.prayer.speed", label: "Молитва о скорости" },
      { id: "conduit.prayer.steel", label: "Молитва о стали" },
    ] },
    notes: "Во время отдыха выбранную молитву можно заменить вместе с оберегом.",
  },
  "conduit.feature.1.molitva-o-razrushenii": { kinds: ["bonus"], effects: [{ kind: "field", field: "rolledDamage", value: 1, filter: { keywords: ["Магия"] } }], notes: "+1 к выброшенному урону способностей с ключевым словом Магия." },
  "conduit.feature.1.molitva-o-distantsii": { kinds: ["bonus"], effects: [{ kind: "field", field: "distance", value: 2, filter: { keywords: ["Магия", "Дальний"] } }], notes: "+2 к дальности дальнобойных магических способностей." },
  "conduit.feature.1.molitva-o-masterstve-soldata": {
    kinds: ["bonus", "proficiency"],
    effects: [
      { kind: "proficiency", armor: ["light"], weapons: ["light"], treasures: true },
      { kind: "field", field: "stamina", value: 0, perEchelon: 3, when: { equipment: { lightArmor: true }, noKit: true } },
      { kind: "field", field: "rolledDamage", value: 1, filter: { keywords: ["Оружие"] }, rolledOnly: false, when: { equipment: { lightWeapon: true }, noKit: true } },
    ],
    notes: "Владение лёгкой бронёй и оружием без комплекта, а также использование их сокровищ, выражается proficiency. Условное владение (только без комплекта) текущая модель proficiency не выражает — правило остаётся текстом. С комплектом молитву нельзя выбрать. Бонус урона способности с ключевым словом Оружие включает свободные удары, как в старой записи; rolledOnly:false сохраняет оба случая. Числовой бонус к свободному удару не добавляется отдельно, чтобы не удвоить урон.",
  },
  "conduit.feature.1.molitva-o-skorosti": { kinds: ["bonus"], effects: [{ kind: "field", field: "speed", value: 1 }, { kind: "field", field: "disengage", value: 1 }] },
  "conduit.feature.1.molitva-o-stali": { kinds: ["bonus"], effects: [{ kind: "field", field: "stamina", value: 0, perEchelon: 6 }, { kind: "field", field: "stability", value: 1 }] },
  "conduit.feature.1.obereg-provodnika": {
    kinds: ["choice", "grant"],
    choice: { group: "conduit.sanctuary", options: [
      { id: "conduit.sanctuary.bastion", label: "Оберег бастиона" },
      { id: "conduit.sanctuary.reaction", label: "Оберег реакции" },
      { id: "conduit.sanctuary.refuge", label: "Оберег святилища" },
      { id: "conduit.sanctuary.spirits", label: "Оберег духов" },
    ] },
    notes: "Выбранный оберег можно заменить вместе с молитвой во время отдыха.",
  },
  "conduit.feature.1.obereg-bastiona": { kinds: ["bonus"], effects: [{ kind: "field", field: "save", value: 1 }] },
  "conduit.feature.1.obereg-reaktsii": { kinds: ["trigger"], trigger: { event: "take-damage", frequency: "always", label: "Оберег реакции", detail: "Когда смежное существо наносит вам урон, после этого можно сместиться на расстояние до Интуиции клеток. Перемещение выбирается вручную." }, notes: "Событие take-damage шире условия книги и может сообщить о не смежном источнике, в том числе не существе; применять оберег только когда урон нанесло смежное существо. Это условие включает союзника." },
  "conduit.feature.1.obereg-svyatilishcha": { kinds: ["trigger"], trigger: { event: "take-damage", frequency: "always", label: "Оберег святилища", detail: "Когда другое существо наносит вам урон, оно не может нацелить на вас удар, пока вы не навредите ему или его союзнику либо до конца его следующего хода. Учёт временного запрета на цель не поддерживается." }, notes: "Событие take-damage шире условия книги и может сообщить о не смежном источнике, в том числе не существе; применять оберег только когда урон нанесло другое существо. Врагом источник не ограничен." },
  "conduit.feature.1.obereg-dukhov": { kinds: ["trigger"], trigger: { event: "take-damage", frequency: "always", label: "Оберег духов", detail: "Когда смежное существо наносит вам урон, оно получает урон порчей, равный Интуиции." }, notes: "Событие take-damage шире условия книги и может сообщить о не смежном источнике, в том числе не существе; применять оберег только когда урон нанесло смежное существо. Урон источнику вручную применяется; условие включает союзника." },
  "conduit.feature.1.znakovye-sposobnosti": { kinds: ["choice", "grant"], notes: "Выберите две из восьми способностей, перечисленных в скелете. При создании героя NewCharacterDialog записывает выбранные ID в abilityIds; character-builder проверяет количество по CLASS_SIGNATURE_COUNTS (для Проводника — 2). Отдельная группа options в mechanics не нужна." },
  "conduit.feature.1.geroicheskie-sposobnosti": { kinds: ["grant"], notes: "Контейнер раздела героических способностей; варианты сгруппированы в дочерних записях." },
  "conduit.feature.1.sposobnost-za-3-blagochestiya": { kinds: ["choice", "grant"], notes: "Выберите одну способность из каталога за 3 Благочестия. NewCharacterDialog показывает варианты из ABILITY_COMPENDIUM; character-builder сохраняет abilityIds и требует ровно один выбор с resourceCost 3. Это путь создания героя, отдельная группа options в mechanics не нужна." },
  "conduit.feature.1.sposobnost-za-5-blagochestiya": { kinds: ["choice", "grant"], notes: "Выберите одну способность из каталога за 5 Благочестия. NewCharacterDialog показывает варианты из ABILITY_COMPENDIUM; character-builder сохраняет abilityIds и требует ровно один выбор с resourceCost 5. Это путь создания героя, отдельная группа options в mechanics не нужна." },
};

/** Записи, которым текущая модель не даёт надёжного автоматического эффекта. */
export const CONDUIT_BASE_TEXT_ONLY: Record<string, string> = {
  "conduit.feature.1.sposobnosti-provodnika": "Контейнер раздела; его дочерние записи отдельно описывают способности и выборы.",
};
