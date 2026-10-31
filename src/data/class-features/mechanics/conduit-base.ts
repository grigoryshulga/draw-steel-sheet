import type { FeatureMechanics } from "../types";

/** Базовые особенности Проводника первого уровня, кроме доменных записей. */
export const CONDUIT_BASE_MECHANICS: Record<string, FeatureMechanics> = {
  "feature.conduit.level-1.deity-and-domains": {
    kinds: ["grant"],
    notes: "Выбор божества и портфолио зависит от мира кампании. Пара доменов хранится в листе; особенность первого домена выбирается при создании героя или повышении уровня. Фиксированного списка вариантов в записи нет.",
  },
  "feature.conduit.level-1.1st-level-domain-feature": {
    kinds: ["grant"],
    notes: "При создании героя предлагается выбрать один из двух доменов для особенности 1-го уровня; выбранный домен сохраняется в листе. Доступные особенности и навыки определяются этим доменом.",
  },
  "feature.conduit.level-1.healing-grace": {
    kinds: ["trigger", "resource"],
    trigger: { event: "use-ability", frequency: "turn", label: "Исцеляющая благодать", detail: "Один раз в ход: маневр, дальность 10; цель — вы или союзник — может потратить Восстановление. За каждое потраченное Благочестие выберите одно улучшение: дополнительная цель, завершить подходящий эффект, встать или потратить ещё одно Восстановление. Применение к другим персонажам не автоматизировано." },
    notes: "Каждое выбранное улучшение стоит ровно 1 Благочестие, как сказано в тексте способности.",
  },
  "feature.conduit.level-1.ray-of-wrath": {
    kinds: ["grant"],
    notes: "Луч Гнева можно использовать как свободный удар дальнего боя: Магия, Дальний, Удар; дальность 10, цель — одно существо или объект; бросок силы + Интуиция; урон по тиру 2/4/6 + Интуиция. Свободный удар использует урон и процедуру самой способности; отдельный бонус к урону свободного удара не должен считаться повторно как бонус к выброшенному урону. Тип урона можно выбрать святым согласно тексту способности. Тиры не являются полями листа.",
  },
  "feature.conduit.level-1.triggered-action": {
    kinds: ["trigger"],
    trigger: { event: "passive", frequency: "always", label: "Триггер проводника", detail: "Выберите один триггер. Слово наставления: когда союзник в пределах 10 делает бросок силы для наносящей урон способности, дать преимущество; за 1 Благочестие — двойное преимущество. Слово Суда: когда один союзник должен был бы получить урон от способности, использующей бросок силы, бросок силы получает помеху против этой цели; за 1 Благочестие — двойную помеху против этой цели. Выбор момента и цели ручной; автоматическое вмешательство в бросок не реализовано." },
    notes: "При создании героя показываются «Слово Наставления» и «Слово Суда»; выбрать нужно ровно одно. По скелету Слово Суда срабатывает, когда цель должна была бы получить урон от способности, использующей бросок силы; в эффекте помеха этому броску применяется против цели. Не сужать условие до вражеской цели.",
  },
  "feature.conduit.level-1.prayer": {
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
  "feature.conduit.level-1.prayer-of-destruction": { kinds: ["bonus"], effects: [{ kind: "field", field: "rolledDamage", value: 1, filter: { keywords: ["Магия"] } }], notes: "+1 к выброшенному урону способностей с ключевым словом Магия." },
  "feature.conduit.level-1.prayer-of-distance": { kinds: ["bonus"], effects: [{ kind: "field", field: "distance", value: 2, filter: { keywords: ["Магия", "Дальний"] } }], notes: "+2 к дальности дальнобойных магических способностей." },
  "feature.conduit.level-1.prayer-of-soldiers-skill": {
    kinds: ["bonus", "proficiency"],
    effects: [
      { kind: "proficiency", armor: ["light"], weapons: ["light"], treasures: true },
      { kind: "field", field: "stamina", value: 0, perEchelon: 3, when: { equipment: { lightArmor: true }, noKit: true } },
      { kind: "field", field: "rolledDamage", value: 1, filter: { keywords: ["Оружие"] }, rolledOnly: false, when: { equipment: { lightWeapon: true }, noKit: true } },
    ],
    notes: "Герой может носить лёгкую броню и владеть лёгким оружием без комплекта и использовать их сокровища. Условное владение (только без комплекта) остаётся текстом правила. С комплектом молитву нельзя выбрать. Бонус урона способности с ключевым словом Оружие включает свободные удары; отдельный бонус к свободному удару не добавляется, чтобы не удвоить урон.",
  },
  "feature.conduit.level-1.prayer-of-speed": { kinds: ["bonus"], effects: [{ kind: "field", field: "speed", value: 1 }, { kind: "field", field: "disengage", value: 1 }] },
  "feature.conduit.level-1.prayer-of-steel": { kinds: ["bonus"], effects: [{ kind: "field", field: "stamina", value: 0, perEchelon: 6 }, { kind: "field", field: "stability", value: 1 }] },
  "feature.conduit.level-1.conduit-ward": {
    kinds: ["choice", "grant"],
    choice: { group: "conduit.sanctuary", options: [
      { id: "conduit.sanctuary.bastion", label: "Оберег бастиона" },
      { id: "conduit.sanctuary.reaction", label: "Оберег реакции" },
      { id: "conduit.sanctuary.refuge", label: "Оберег святилища" },
      { id: "conduit.sanctuary.spirits", label: "Оберег духов" },
    ] },
    notes: "Выбранный оберег можно заменить вместе с молитвой во время отдыха.",
  },
  "feature.conduit.level-1.bastion-ward": { kinds: ["bonus"], effects: [{ kind: "field", field: "save", value: 1 }] },
  "feature.conduit.level-1.quickness-ward": { kinds: ["trigger"], trigger: { event: "take-damage", frequency: "always", label: "Оберег реакции", detail: "Когда смежное существо наносит вам урон, после этого можно сместиться на расстояние до Интуиции клеток. Перемещение выбирается вручную." }, notes: "Напоминание о получении урона шире условия книги и может сработать на не смежный источник, в том числе не существо; применять оберег только когда урон нанесло смежное существо. Это условие включает союзника." },
  "feature.conduit.level-1.sanctuary-ward": { kinds: ["trigger"], trigger: { event: "take-damage", frequency: "always", label: "Оберег святилища", detail: "Когда другое существо наносит вам урон, оно не может нацелить на вас удар, пока вы не навредите ему или его союзнику либо до конца его следующего хода. Учёт временного запрета на цель не поддерживается." }, notes: "Напоминание о получении урона шире условия книги и может сработать на не смежный источник, в том числе не существо; применять оберег только когда урон нанесло другое существо. Врагом источник не ограничен." },
  "feature.conduit.level-1.spirit-ward": { kinds: ["trigger"], trigger: { event: "take-damage", frequency: "always", label: "Оберег духов", detail: "Когда смежное существо наносит вам урон, оно получает урон порчей, равный Интуиции." }, notes: "Напоминание о получении урона шире условия книги и может сработать на не смежный источник, в том числе не существо; применять оберег только когда урон нанесло смежное существо. Урон источнику вручную применяется; условие включает союзника." },
  "feature.conduit.level-1.signature-abilities": { kinds: ["choice", "grant"], notes: "Выберите две из восьми способностей, перечисленных в скелете. При создании героя приложение записывает выбранные способности и проверяет, что их ровно две; отдельный список вариантов в механике не нужен." },
  "feature.conduit.level-1.heroic-abilities": { kinds: ["grant"], notes: "Контейнер раздела героических способностей; варианты сгруппированы в дочерних записях." },
  "feature.conduit.level-1.3-piety-ability": { kinds: ["choice", "grant"], notes: "Выберите одну способность из каталога за 3 Благочестия. При создании героя показываются варианты из справочника способностей; нужно выбрать ровно одну способность стоимостью 3." },
  "feature.conduit.level-1.5-piety-ability": { kinds: ["choice", "grant"], notes: "Выберите одну способность из каталога за 5 Благочестия. При создании героя показываются варианты из справочника способностей; нужно выбрать ровно одну способность стоимостью 5." },
};

/** Записи, которым текущая модель не даёт надёжного автоматического эффекта. */
export const CONDUIT_BASE_TEXT_ONLY: Record<string, string> = {
  "feature.conduit.level-1.conduit-abilities": "Контейнер раздела; его дочерние записи отдельно описывают способности и выборы.",
};
