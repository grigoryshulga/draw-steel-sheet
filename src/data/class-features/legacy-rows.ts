import type { FeatureKeyGroup, GeneratedClassFeature } from "./types";

/**
 * Рукописная структура классовых особенностей, которой нет в канонической
 * проекции `features.json`.
 *
 * Канонические сущности `feature` хранят заголовок, класс, уровень и текст, но
 * не хранят вложенность и группу выбора: `parentId` собирал прежний разбор
 * таблиц, `keyedBy`/`keyValue` — строки доменов, доктрин и порогов,
 * `featureId` связывал запись с повышением уровня. Лист опирается на них при
 * активации, группировке и выборе подкласса, поэтому структура перенесена сюда
 * один раз при миграции и остаётся стабильной.
 *
 * `CLASS_FEATURE_SYNTHETIC_ROWS` — 82 строки таблиц (пороги свирепости, домены
 * Проводника, доктрины Тактика, коллегии Тени, амплуа Трубадура и
 * специализации Элементалиста). В каноне их тексты живут внутри Markdown
 * родительских особенностей, отдельными сущностями они не стали; механики
 * (`mechanics/*`) и панель листа адресуются к ним по прежним ID.
 *
 * Если `features.json` начнёт отдавать `parentId`/`keyedBy`/`keyValue` и
 * отдельные строки таблиц, этот модуль можно удалить без правок потребителей.
 */
export interface ClassFeatureStructure {
  parentId?: string;
  keyedBy?: FeatureKeyGroup;
  keyValue?: string;
  featureId?: string;
}

const STRUCTURE = (
  {
    "feature.fury.level-1.ferocity-in-combat": {
      "parentId": "feature.fury.level-1.ferocity"
    },
    "feature.fury.level-1.ferocity-outside-of-combat": {
      "parentId": "feature.fury.level-1.ferocity"
    },
    "feature.fury.level-1.beast-shape": {
      "parentId": "feature.fury.level-1.1st-level-aspect-features",
      "keyedBy": "aspect",
      "keyValue": "Буревестник"
    },
    "feature.fury.level-1.kit": {
      "parentId": "feature.fury.level-1.1st-level-aspect-features",
      "keyedBy": "aspect",
      "keyValue": "Берсерк, Разоритель"
    },
    "feature.fury.level-1.primordial-cunning": {
      "parentId": "feature.fury.level-1.1st-level-aspect-features",
      "keyedBy": "aspect",
      "keyValue": "Разоритель"
    },
    "feature.fury.level-1.primordial-strength": {
      "parentId": "feature.fury.level-1.1st-level-aspect-features",
      "keyedBy": "aspect",
      "keyValue": "Берсерк"
    },
    "feature.fury.level-1.relentless-hunter": {
      "parentId": "feature.fury.level-1.1st-level-aspect-features",
      "keyedBy": "aspect",
      "keyValue": "Буревестник"
    },
    "feature.fury.level-1.signature-ability": {
      "parentId": "feature.fury.level-1.fury-abilities"
    },
    "feature.fury.level-1.heroic-abilities": {
      "parentId": "feature.fury.level-1.fury-abilities"
    },
    "feature.fury.level-1.3-ferocity-ability": {
      "parentId": "feature.fury.level-1.heroic-abilities"
    },
    "feature.fury.level-1.5-ferocity-ability": {
      "parentId": "feature.fury.level-1.heroic-abilities"
    },
    "feature.null.level-1.discipline-in-combat": {
      "parentId": "feature.null.level-1.discipline"
    },
    "feature.null.level-1.discipline-outside-of-combat": {
      "parentId": "feature.null.level-1.discipline"
    },
    "feature.null.level-1.chronokinetic-mastery": {
      "parentId": "feature.null.level-1.discipline-mastery"
    },
    "feature.null.level-1.cryokinetic-mastery": {
      "parentId": "feature.null.level-1.discipline-mastery"
    },
    "feature.null.level-1.metakinetic-mastery": {
      "parentId": "feature.null.level-1.discipline-mastery"
    },
    "feature.null.level-1.density-augmentation": {
      "parentId": "feature.null.level-1.psionic-augmentation"
    },
    "feature.null.level-1.force-augmentation": {
      "parentId": "feature.null.level-1.psionic-augmentation"
    },
    "feature.null.level-1.speed-augmentation": {
      "parentId": "feature.null.level-1.psionic-augmentation"
    },
    "feature.null.level-1.signature-abilities": {
      "parentId": "feature.null.level-1.null-abilities"
    },
    "feature.null.level-1.heroic-abilities": {
      "parentId": "feature.null.level-1.null-abilities"
    },
    "feature.null.level-1.3-discipline-ability": {
      "parentId": "feature.null.level-1.heroic-abilities"
    },
    "feature.null.level-1.5-discipline-ability": {
      "parentId": "feature.null.level-1.heroic-abilities"
    },
    "feature.conduit.level-1.piety-in-combat": {
      "parentId": "feature.conduit.level-1.piety"
    },
    "feature.conduit.level-1.piety-outside-of-combat": {
      "parentId": "feature.conduit.level-1.piety"
    },
    "feature.conduit.level-1.domain-piety-and-effects.creation": {
      "parentId": "feature.conduit.level-1.domain-piety-and-effects"
    },
    "feature.conduit.level-1.domain-piety-and-effects.death": {
      "parentId": "feature.conduit.level-1.domain-piety-and-effects"
    },
    "feature.conduit.level-1.domain-piety-and-effects.fate": {
      "parentId": "feature.conduit.level-1.domain-piety-and-effects"
    },
    "feature.conduit.level-1.domain-piety-and-effects.knowledge": {
      "parentId": "feature.conduit.level-1.domain-piety-and-effects"
    },
    "feature.conduit.level-1.domain-piety-and-effects.life": {
      "parentId": "feature.conduit.level-1.domain-piety-and-effects"
    },
    "feature.conduit.level-1.domain-piety-and-effects.love": {
      "parentId": "feature.conduit.level-1.domain-piety-and-effects"
    },
    "feature.conduit.level-1.domain-piety-and-effects.nature": {
      "parentId": "feature.conduit.level-1.domain-piety-and-effects"
    },
    "feature.conduit.level-1.domain-piety-and-effects.protection": {
      "parentId": "feature.conduit.level-1.domain-piety-and-effects"
    },
    "feature.conduit.level-1.domain-piety-and-effects.storm": {
      "parentId": "feature.conduit.level-1.domain-piety-and-effects"
    },
    "feature.conduit.level-1.domain-piety-and-effects.sun": {
      "parentId": "feature.conduit.level-1.domain-piety-and-effects"
    },
    "feature.conduit.level-1.domain-piety-and-effects.trickery": {
      "parentId": "feature.conduit.level-1.domain-piety-and-effects"
    },
    "feature.conduit.level-1.domain-piety-and-effects.war": {
      "parentId": "feature.conduit.level-1.domain-piety-and-effects"
    },
    "feature.conduit.level-1.blessing-of-compassion": {
      "parentId": "feature.conduit.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Любовь"
    },
    "feature.conduit.level-1.blessing-of-comprehension": {
      "parentId": "feature.conduit.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Знание"
    },
    "feature.conduit.level-1.blessing-of-fortunate-weather": {
      "parentId": "feature.conduit.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Буря"
    },
    "feature.conduit.level-1.faithful-friend": {
      "parentId": "feature.conduit.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Природа"
    },
    "feature.conduit.level-1.grave-speech": {
      "parentId": "feature.conduit.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Смерть"
    },
    "feature.conduit.level-1.hands-of-the-maker": {
      "parentId": "feature.conduit.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Созидание"
    },
    "feature.conduit.level-1.inner-light": {
      "parentId": "feature.conduit.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Солнце"
    },
    "feature.conduit.level-1.inspired-deception": {
      "parentId": "feature.conduit.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Хитрость"
    },
    "feature.conduit.level-1.oracular-visions": {
      "parentId": "feature.conduit.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Судьба"
    },
    "feature.conduit.level-1.protective-circle": {
      "parentId": "feature.conduit.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Защита"
    },
    "feature.conduit.level-1.revitalizing-ritual": {
      "parentId": "feature.conduit.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Жизнь"
    },
    "feature.conduit.level-1.sanctified-weapon": {
      "parentId": "feature.conduit.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Война"
    },
    "feature.conduit.level-1.prayer-of-destruction": {
      "parentId": "feature.conduit.level-1.prayer"
    },
    "feature.conduit.level-1.prayer-of-distance": {
      "parentId": "feature.conduit.level-1.prayer"
    },
    "feature.conduit.level-1.prayer-of-soldiers-skill": {
      "parentId": "feature.conduit.level-1.prayer"
    },
    "feature.conduit.level-1.prayer-of-speed": {
      "parentId": "feature.conduit.level-1.prayer"
    },
    "feature.conduit.level-1.prayer-of-steel": {
      "parentId": "feature.conduit.level-1.prayer"
    },
    "feature.conduit.level-1.bastion-ward": {
      "parentId": "feature.conduit.level-1.conduit-ward"
    },
    "feature.conduit.level-1.quickness-ward": {
      "parentId": "feature.conduit.level-1.conduit-ward"
    },
    "feature.conduit.level-1.sanctuary-ward": {
      "parentId": "feature.conduit.level-1.conduit-ward"
    },
    "feature.conduit.level-1.spirit-ward": {
      "parentId": "feature.conduit.level-1.conduit-ward"
    },
    "feature.conduit.level-1.signature-abilities": {
      "parentId": "feature.conduit.level-1.conduit-abilities"
    },
    "feature.conduit.level-1.heroic-abilities": {
      "parentId": "feature.conduit.level-1.conduit-abilities"
    },
    "feature.conduit.level-1.3-piety-ability": {
      "parentId": "feature.conduit.level-1.heroic-abilities"
    },
    "feature.conduit.level-1.5-piety-ability": {
      "parentId": "feature.conduit.level-1.heroic-abilities"
    },
    "feature.tactician.level-1.focus-in-combat": {
      "parentId": "feature.tactician.level-1.focus"
    },
    "feature.tactician.level-1.focus-outside-of-combat": {
      "parentId": "feature.tactician.level-1.focus"
    },
    "feature.tactician.level-1.commanding-presence": {
      "parentId": "feature.tactician.level-1.1st-level-doctrine-feature",
      "keyedBy": "doctrine",
      "keyValue": "Авангард"
    },
    "feature.tactician.level-1.covert-operations": {
      "parentId": "feature.tactician.level-1.1st-level-doctrine-feature",
      "keyedBy": "doctrine",
      "keyValue": "Повстанец"
    },
    "feature.tactician.level-1.studied-commander": {
      "parentId": "feature.tactician.level-1.1st-level-doctrine-feature",
      "keyedBy": "doctrine",
      "keyValue": "Воевода"
    },
    "feature.tactician.level-1.kit-signature-ability": {
      "parentId": "feature.tactician.level-1.tactician-abilities"
    },
    "feature.tactician.level-1.heroic-abilities": {
      "parentId": "feature.tactician.level-1.tactician-abilities"
    },
    "feature.tactician.level-1.3-focus-ability": {
      "parentId": "feature.tactician.level-1.tactician-abilities"
    },
    "feature.tactician.level-1.5-focus-ability": {
      "parentId": "feature.tactician.level-1.tactician-abilities"
    },
    "feature.talent.level-1.clarity-in-combat": {
      "parentId": "feature.talent.level-1.clarity-and-strain"
    },
    "feature.talent.level-1.clarity-outside-of-combat": {
      "parentId": "feature.talent.level-1.clarity-and-strain"
    },
    "feature.talent.level-1.battle-augmentation": {
      "parentId": "feature.talent.level-1.psionic-augmentation"
    },
    "feature.talent.level-1.density-augmentation": {
      "parentId": "feature.talent.level-1.psionic-augmentation"
    },
    "feature.talent.level-1.distance-augmentation": {
      "parentId": "feature.talent.level-1.psionic-augmentation"
    },
    "feature.talent.level-1.force-augmentation": {
      "parentId": "feature.talent.level-1.psionic-augmentation"
    },
    "feature.talent.level-1.speed-augmentation": {
      "parentId": "feature.talent.level-1.psionic-augmentation"
    },
    "feature.talent.level-1.entropy-ward": {
      "parentId": "feature.talent.level-1.talent-ward"
    },
    "feature.talent.level-1.repulsive-ward": {
      "parentId": "feature.talent.level-1.talent-ward"
    },
    "feature.talent.level-1.steel-ward": {
      "parentId": "feature.talent.level-1.talent-ward"
    },
    "feature.talent.level-1.vanishing-ward": {
      "parentId": "feature.talent.level-1.talent-ward"
    },
    "feature.talent.level-1.accelerate": {
      "parentId": "feature.talent.level-1.1st-level-tradition-features",
      "keyedBy": "tradition",
      "keyValue": "Хронопатия"
    },
    "feature.talent.level-1.again": {
      "parentId": "feature.talent.level-1.1st-level-tradition-features",
      "keyedBy": "tradition",
      "keyValue": "Хронопатия"
    },
    "feature.talent.level-1.feedback-loop": {
      "parentId": "feature.talent.level-1.1st-level-tradition-features",
      "keyedBy": "tradition",
      "keyValue": "Телепатия"
    },
    "feature.talent.level-1.minor-telekinesis": {
      "parentId": "feature.talent.level-1.1st-level-tradition-features",
      "keyedBy": "tradition",
      "keyValue": "Телекинез"
    },
    "feature.talent.level-1.remote-assistance": {
      "parentId": "feature.talent.level-1.1st-level-tradition-features",
      "keyedBy": "tradition",
      "keyValue": "Телепатия"
    },
    "feature.talent.level-1.repel": {
      "parentId": "feature.talent.level-1.1st-level-tradition-features",
      "keyedBy": "tradition",
      "keyValue": "Телекинез"
    },
    "feature.talent.level-1.signature-abilities": {
      "parentId": "feature.talent.level-1.talent-abilities"
    },
    "feature.talent.level-1.heroic-abilities": {
      "parentId": "feature.talent.level-1.talent-abilities"
    },
    "feature.talent.level-1.3-clarity-ability": {
      "parentId": "feature.talent.level-1.heroic-abilities"
    },
    "feature.talent.level-1.5-clarity-ability": {
      "parentId": "feature.talent.level-1.heroic-abilities"
    },
    "feature.shadow.level-1.insight-in-combat": {
      "parentId": "feature.shadow.level-1.insight"
    },
    "feature.shadow.level-1.insight-outside-of-combat": {
      "parentId": "feature.shadow.level-1.insight"
    },
    "feature.shadow.level-1.black-ash-teleport": {
      "parentId": "feature.shadow.level-1.1st-level-college-features",
      "keyedBy": "college",
      "keyValue": "Черный Пепел"
    },
    "feature.shadow.level-1.coat-the-blade": {
      "parentId": "feature.shadow.level-1.1st-level-college-features",
      "keyedBy": "college",
      "keyValue": "Едкая Алхимия"
    },
    "feature.shadow.level-1.im-no-threat": {
      "parentId": "feature.shadow.level-1.1st-level-college-features",
      "keyedBy": "college",
      "keyValue": "Маска Арлекина"
    },
    "feature.shadow.level-1.smoke-bomb": {
      "parentId": "feature.shadow.level-1.1st-level-college-features",
      "keyedBy": "college",
      "keyValue": "Едкая Алхимия"
    },
    "feature.shadow.level-1.signature-ability": {
      "parentId": "feature.shadow.level-1.shadow-abilities"
    },
    "feature.shadow.level-1.heroic-abilities": {
      "parentId": "feature.shadow.level-1.shadow-abilities"
    },
    "feature.shadow.level-1.3-insight-ability": {
      "parentId": "feature.shadow.level-1.heroic-abilities"
    },
    "feature.shadow.level-1.5-insight-ability": {
      "parentId": "feature.shadow.level-1.shadow-abilities"
    },
    "feature.troubadour.level-1.drama-in-combat": {
      "parentId": "feature.troubadour.level-1.drama"
    },
    "feature.troubadour.level-1.drama-outside-of-combat": {
      "parentId": "feature.troubadour.level-1.drama"
    },
    "feature.troubadour.level-1.acrobatics": {
      "parentId": "feature.troubadour.level-1.1st-level-class-act-features",
      "keyedBy": "troupe",
      "keyValue": "Дуэлянт"
    },
    "feature.troubadour.level-1.blocking": {
      "parentId": "feature.troubadour.level-1.1st-level-class-act-features",
      "keyedBy": "troupe",
      "keyValue": "Автор"
    },
    "feature.troubadour.level-1.dramatic-monologue": {
      "parentId": "feature.troubadour.level-1.1st-level-class-act-features",
      "keyedBy": "troupe",
      "keyValue": "Автор"
    },
    "feature.troubadour.level-1.power-chord": {
      "parentId": "feature.troubadour.level-1.1st-level-class-act-features",
      "keyedBy": "troupe",
      "keyValue": "Виртуоз"
    },
    "feature.troubadour.level-1.star-power": {
      "parentId": "feature.troubadour.level-1.1st-level-class-act-features",
      "keyedBy": "troupe",
      "keyValue": "Дуэлянт"
    },
    "feature.troubadour.level-1.virtuoso-performances": {
      "parentId": "feature.troubadour.level-1.1st-level-class-act-features",
      "keyedBy": "troupe",
      "keyValue": "Виртуоз"
    },
    "feature.troubadour.level-1.signature-ability": {
      "parentId": "feature.troubadour.level-1.troubadour-abilities"
    },
    "feature.troubadour.level-1.heroic-abilities": {
      "parentId": "feature.troubadour.level-1.troubadour-abilities"
    },
    "feature.troubadour.level-1.3-drama-ability": {
      "parentId": "feature.troubadour.level-1.heroic-abilities"
    },
    "feature.troubadour.level-1.5-drama-ability": {
      "parentId": "feature.troubadour.level-1.heroic-abilities"
    },
    "feature.censor.level-1.wrath-in-combat": {
      "parentId": "feature.censor.level-1.wrath"
    },
    "feature.censor.level-1.wrath-outside-of-combat": {
      "parentId": "feature.censor.level-1.wrath"
    },
    "feature.censor.level-1.judgment-order-benefit": {
      "parentId": "feature.censor.level-1.judgment"
    },
    "feature.censor.level-1.blessing-of-compassion": {
      "parentId": "feature.censor.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Любовь"
    },
    "feature.censor.level-1.blessing-of-comprehension": {
      "parentId": "feature.censor.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Знание"
    },
    "feature.censor.level-1.blessing-of-fortunate-weather": {
      "parentId": "feature.censor.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Буря"
    },
    "feature.censor.level-1.faithful-friend": {
      "parentId": "feature.censor.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Природа"
    },
    "feature.censor.level-1.grave-speech": {
      "parentId": "feature.censor.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Смерть"
    },
    "feature.censor.level-1.hands-of-the-maker": {
      "parentId": "feature.censor.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Созидание"
    },
    "feature.censor.level-1.inner-light": {
      "parentId": "feature.censor.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Солнце"
    },
    "feature.censor.level-1.inspired-deception": {
      "parentId": "feature.censor.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Хитрость"
    },
    "feature.censor.level-1.oracular-visions": {
      "parentId": "feature.censor.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Судьба"
    },
    "feature.censor.level-1.protective-circle": {
      "parentId": "feature.censor.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Защита"
    },
    "feature.censor.level-1.revitalizing-ritual": {
      "parentId": "feature.censor.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Жизнь"
    },
    "feature.censor.level-1.sanctified-weapon": {
      "parentId": "feature.censor.level-1.1st-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Война"
    },
    "feature.censor.level-1.signature-ability": {
      "parentId": "feature.censor.level-1.censor-abilities"
    },
    "feature.censor.level-1.heroic-abilities": {
      "parentId": "feature.censor.level-1.censor-abilities"
    },
    "feature.censor.level-1.3-wrath-ability": {
      "parentId": "feature.censor.level-1.heroic-abilities"
    },
    "feature.censor.level-1.5-wrath-ability": {
      "parentId": "feature.censor.level-1.heroic-abilities"
    },
    "feature.elementalist.level-1.earth-acolyte-of-earth": {
      "parentId": "feature.elementalist.level-1.elemental-specialization"
    },
    "feature.elementalist.level-1.fire-acolyte-of-fire": {
      "parentId": "feature.elementalist.level-1.elemental-specialization"
    },
    "feature.elementalist.level-1.green-acolyte-of-the-green": {
      "parentId": "feature.elementalist.level-1.elemental-specialization"
    },
    "feature.elementalist.level-1.void-acolyte-of-the-mystery": {
      "parentId": "feature.elementalist.level-1.elemental-specialization"
    },
    "feature.elementalist.level-1.essence-in-combat": {
      "parentId": "feature.elementalist.level-1.essence"
    },
    "feature.elementalist.level-1.essence-outside-of-combat": {
      "parentId": "feature.elementalist.level-1.essence"
    },
    "feature.elementalist.level-1.a-beyonding-of-vision": {
      "parentId": "feature.elementalist.level-1.1st-level-specialization-feature",
      "keyedBy": "specialization",
      "keyValue": "Пустота"
    },
    "feature.elementalist.level-1.it-is-the-soul-which-hears": {
      "parentId": "feature.elementalist.level-1.1st-level-specialization-feature",
      "keyedBy": "specialization",
      "keyValue": "Зелень"
    },
    "feature.elementalist.level-1.motivate-earth": {
      "parentId": "feature.elementalist.level-1.1st-level-specialization-feature",
      "keyedBy": "specialization",
      "keyValue": "Земля"
    },
    "feature.elementalist.level-1.return-to-formlessness": {
      "parentId": "feature.elementalist.level-1.1st-level-specialization-feature",
      "keyedBy": "specialization",
      "keyValue": "Огонь"
    },
    "feature.elementalist.level-1.enchantment-of-battle": {
      "parentId": "feature.elementalist.level-1.enchantment"
    },
    "feature.elementalist.level-1.enchantment-of-celerity": {
      "parentId": "feature.elementalist.level-1.enchantment"
    },
    "feature.elementalist.level-1.enchantment-of-destruction": {
      "parentId": "feature.elementalist.level-1.enchantment"
    },
    "feature.elementalist.level-1.enchantment-of-distance": {
      "parentId": "feature.elementalist.level-1.enchantment"
    },
    "feature.elementalist.level-1.enchantment-of-permanence": {
      "parentId": "feature.elementalist.level-1.enchantment"
    },
    "feature.elementalist.level-1.ward-of-delightful-consequences": {
      "parentId": "feature.elementalist.level-1.elementalist-ward"
    },
    "feature.elementalist.level-1.ward-of-excellent-protection": {
      "parentId": "feature.elementalist.level-1.elementalist-ward"
    },
    "feature.elementalist.level-1.ward-of-natures-affection": {
      "parentId": "feature.elementalist.level-1.elementalist-ward"
    },
    "feature.elementalist.level-1.ward-of-surprising-reactivity": {
      "parentId": "feature.elementalist.level-1.elementalist-ward"
    },
    "feature.elementalist.level-1.signature-abilities": {
      "parentId": "feature.elementalist.level-1.elementalist-abilities"
    },
    "feature.elementalist.level-1.heroic-abilities": {
      "parentId": "feature.elementalist.level-1.elementalist-abilities"
    },
    "feature.elementalist.level-1.3-essence-ability": {
      "parentId": "feature.elementalist.level-1.heroic-abilities"
    },
    "feature.elementalist.level-1.5-essence-ability": {
      "parentId": "feature.elementalist.level-1.heroic-abilities"
    },
    "feature.fury.level-2.perk": {
      "featureId": "0802-f01"
    },
    "feature.fury.level-2.2nd-level-aspect-feature": {
      "featureId": "0802-f02"
    },
    "feature.fury.level-2.inescapable-wrath": {
      "parentId": "feature.fury.level-2.2nd-level-aspect-feature",
      "keyedBy": "aspect",
      "keyValue": "Разоритель",
      "featureId": "0802-f02"
    },
    "feature.fury.level-2.tooth-and-claw": {
      "parentId": "feature.fury.level-2.2nd-level-aspect-feature",
      "keyedBy": "aspect",
      "keyValue": "Буревестник",
      "featureId": "0802-f02"
    },
    "feature.fury.level-2.unstoppable-force": {
      "parentId": "feature.fury.level-2.2nd-level-aspect-feature",
      "keyedBy": "aspect",
      "keyValue": "Берсерк",
      "featureId": "0802-f02"
    },
    "feature.fury.level-2.2nd-level-aspect-ability": {
      "featureId": "0802-f03"
    },
    "feature.fury.level-2.berserker-ability": {
      "parentId": "feature.fury.level-2.2nd-level-aspect-ability",
      "featureId": "0802-f03"
    },
    "feature.fury.level-2.reaver-ability": {
      "parentId": "feature.fury.level-2.2nd-level-aspect-ability",
      "featureId": "0802-f03"
    },
    "feature.fury.level-2.stormwight-ability": {
      "parentId": "feature.fury.level-2.2nd-level-aspect-ability",
      "featureId": "0802-f03"
    },
    "feature.fury.level-3.3rd-level-aspect-feature": {
      "featureId": "0803-f01"
    },
    "feature.fury.level-3.immovable-object": {
      "parentId": "feature.fury.level-3.3rd-level-aspect-feature",
      "keyedBy": "aspect",
      "keyValue": "Берсерк",
      "featureId": "0803-f01"
    },
    "feature.fury.level-3.natures-knight": {
      "parentId": "feature.fury.level-3.3rd-level-aspect-feature",
      "keyedBy": "aspect",
      "keyValue": "Буревестник",
      "featureId": "0803-f01"
    },
    "feature.fury.level-3.see-through-their-tricks": {
      "parentId": "feature.fury.level-3.3rd-level-aspect-feature",
      "keyedBy": "aspect",
      "keyValue": "Разоритель",
      "featureId": "0803-f01"
    },
    "feature.fury.level-3.7-ferocity-ability": {
      "featureId": "0803-f02"
    },
    "feature.fury.level-4.characteristic-increase": {
      "featureId": "0804-f01"
    },
    "feature.fury.level-4.damaging-ferocity": {
      "featureId": "0804-f02"
    },
    "feature.fury.level-4.growing-ferocity-improvement": {
      "featureId": "0804-f03"
    },
    "feature.fury.level-4.perk": {
      "featureId": "0804-f04"
    },
    "feature.fury.level-4.primordial-attunement": {
      "featureId": "0804-f05"
    },
    "feature.fury.level-4.primordial-strike": {
      "featureId": "0804-f06"
    },
    "feature.fury.level-4.skill": {
      "featureId": "0804-f07"
    },
    "feature.fury.level-5.5th-level-aspect-feature": {
      "featureId": "0805-f01"
    },
    "feature.fury.level-5.bounder": {
      "parentId": "feature.fury.level-5.5th-level-aspect-feature",
      "keyedBy": "aspect",
      "keyValue": "Берсерк",
      "featureId": "0805-f01"
    },
    "feature.fury.level-5.stormborn": {
      "parentId": "feature.fury.level-5.5th-level-aspect-feature",
      "keyedBy": "aspect",
      "keyValue": "Буревестник",
      "featureId": "0805-f01"
    },
    "feature.fury.level-5.unfettered": {
      "parentId": "feature.fury.level-5.5th-level-aspect-feature",
      "keyedBy": "aspect",
      "keyValue": "Разоритель",
      "featureId": "0805-f01"
    },
    "feature.fury.level-5.9-ferocity-ability": {
      "featureId": "0805-f02"
    },
    "feature.fury.level-6.marauder-of-the-primordial-chaos": {
      "featureId": "0806-f01"
    },
    "feature.fury.level-6.primordial-portal": {
      "featureId": "0806-f02"
    },
    "feature.fury.level-6.perk": {
      "featureId": "0806-f03"
    },
    "feature.fury.level-6.6th-level-aspect-ability": {
      "featureId": "0806-f04"
    },
    "feature.fury.level-6.berserker-abilities": {
      "parentId": "feature.fury.level-6.6th-level-aspect-ability",
      "featureId": "0806-f04"
    },
    "feature.fury.level-6.reaver-abilities": {
      "parentId": "feature.fury.level-6.6th-level-aspect-ability",
      "featureId": "0806-f04"
    },
    "feature.fury.level-6.stormwight-abilities": {
      "parentId": "feature.fury.level-6.6th-level-aspect-ability",
      "featureId": "0806-f04"
    },
    "feature.fury.level-7.characteristic-increase": {
      "featureId": "0807-f01"
    },
    "feature.fury.level-7.elemental-form": {
      "featureId": "0807-f02"
    },
    "feature.fury.level-7.greater-ferocity": {
      "featureId": "0807-f03"
    },
    "feature.fury.level-7.growing-ferocity-improvement": {
      "featureId": "0807-f04"
    },
    "feature.fury.level-7.skill": {
      "featureId": "0807-f05"
    },
    "feature.fury.level-8.perk": {
      "featureId": "0808-f01"
    },
    "feature.fury.level-8.8th-level-aspect-feature": {
      "featureId": "0808-f02"
    },
    "feature.fury.level-8.menagerie": {
      "parentId": "feature.fury.level-8.8th-level-aspect-feature",
      "keyedBy": "aspect",
      "keyValue": "Буревестник",
      "featureId": "0808-f02"
    },
    "feature.fury.level-8.a-step-ahead": {
      "parentId": "feature.fury.level-8.8th-level-aspect-feature",
      "keyedBy": "aspect",
      "keyValue": "Разоритель",
      "featureId": "0808-f02"
    },
    "feature.fury.level-8.strongest-there-is": {
      "parentId": "feature.fury.level-8.8th-level-aspect-feature",
      "keyedBy": "aspect",
      "keyValue": "Берсерк",
      "featureId": "0808-f02"
    },
    "feature.fury.level-8.11-ferocity-ability": {
      "featureId": "0808-f03"
    },
    "feature.fury.level-9.harbinger-of-the-primordial-chaos": {
      "featureId": "0809-f01"
    },
    "feature.fury.level-9.9th-level-aspect-ability": {
      "featureId": "0809-f02"
    },
    "feature.fury.level-9.berserker-abilities": {
      "parentId": "feature.fury.level-9.9th-level-aspect-ability",
      "featureId": "0809-f02"
    },
    "feature.fury.level-9.reaver-abilities": {
      "parentId": "feature.fury.level-9.9th-level-aspect-ability",
      "featureId": "0809-f02"
    },
    "feature.fury.level-9.stormwight-abilities": {
      "parentId": "feature.fury.level-9.9th-level-aspect-ability",
      "featureId": "0809-f02"
    },
    "feature.fury.level-10.chaos-incarnate": {
      "featureId": "0810-f01"
    },
    "feature.fury.level-10.characteristic-increase": {
      "featureId": "0810-f02"
    },
    "feature.fury.level-10.growing-ferocity-improvement": {
      "featureId": "0810-f03"
    },
    "feature.fury.level-10.perk": {
      "featureId": "0810-f04"
    },
    "feature.fury.level-10.primordial-ferocity": {
      "featureId": "0810-f05"
    },
    "feature.fury.level-10.primordial-power": {
      "featureId": "0810-f06"
    },
    "feature.fury.level-10.skill": {
      "featureId": "0810-f07"
    },
    "feature.null.level-2.perk": {
      "featureId": "0812-f01"
    },
    "feature.null.level-2.2nd-level-tradition-feature": {
      "featureId": "0812-f02"
    },
    "feature.null.level-2.entropic-adaptability": {
      "parentId": "feature.null.level-2.2nd-level-tradition-feature",
      "keyedBy": "tradition",
      "keyValue": "Криокинетик",
      "featureId": "0812-f02"
    },
    "feature.null.level-2.inertial-sink": {
      "parentId": "feature.null.level-2.2nd-level-tradition-feature",
      "keyedBy": "tradition",
      "keyValue": "Метакинетик",
      "featureId": "0812-f02"
    },
    "feature.null.level-2.rapid-processing": {
      "parentId": "feature.null.level-2.2nd-level-tradition-feature",
      "keyedBy": "tradition",
      "keyValue": "Хронокинетик",
      "featureId": "0812-f02"
    },
    "feature.null.level-2.2nd-level-tradition-ability": {
      "featureId": "0812-f03"
    },
    "feature.null.level-2.chronokinetic-ability": {
      "parentId": "feature.null.level-2.2nd-level-tradition-ability",
      "featureId": "0812-f03"
    },
    "feature.null.level-2.cryokinetic-ability": {
      "parentId": "feature.null.level-2.2nd-level-tradition-ability",
      "featureId": "0812-f03"
    },
    "feature.null.level-2.metakinetic-ability": {
      "parentId": "feature.null.level-2.2nd-level-tradition-ability",
      "featureId": "0812-f03"
    },
    "feature.null.level-3.psionic-leap": {
      "featureId": "0813-f01"
    },
    "feature.null.level-3.reorder": {
      "featureId": "0813-f02"
    },
    "feature.null.level-3.7-discipline-ability": {
      "featureId": "0813-f03"
    },
    "feature.null.level-4.characteristic-increase": {
      "featureId": "0814-f01"
    },
    "feature.null.level-4.discipline-mastery-improvement": {
      "featureId": "0814-f02"
    },
    "feature.null.level-4.enhanced-null-field": {
      "featureId": "0814-f03"
    },
    "feature.null.level-4.perk": {
      "featureId": "0814-f04"
    },
    "feature.null.level-4.regenerative-field": {
      "featureId": "0814-f05"
    },
    "feature.null.level-4.skill": {
      "featureId": "0814-f06"
    },
    "feature.null.level-5.5th-level-tradition-feature": {
      "featureId": "0815-f01"
    },
    "feature.null.level-5.chilling-readiness": {
      "keyedBy": "tradition",
      "keyValue": "Криокинетик",
      "featureId": "0815-f02"
    },
    "feature.null.level-5.inertial-fulcrum": {
      "keyedBy": "tradition",
      "keyValue": "Метакинетик",
      "featureId": "0815-f03"
    },
    "feature.null.level-5.instant-action": {
      "keyedBy": "tradition",
      "keyValue": "Хронокинетик",
      "featureId": "0815-f04"
    },
    "feature.null.level-5.9-discipline-ability": {
      "featureId": "0815-f05"
    },
    "feature.null.level-6.elemental-absorption": {
      "featureId": "0816-f01"
    },
    "feature.null.level-6.elemental-buffer": {
      "featureId": "0816-f02"
    },
    "feature.null.level-6.perk": {
      "featureId": "0816-f03"
    },
    "feature.null.level-6.6th-level-tradition-ability": {
      "featureId": "0816-f04"
    },
    "feature.null.level-6.chronokinetic-abilities": {
      "parentId": "feature.null.level-6.6th-level-tradition-ability",
      "featureId": "0816-f04"
    },
    "feature.null.level-6.cryokinetic-abilities": {
      "parentId": "feature.null.level-6.6th-level-tradition-ability",
      "featureId": "0816-f04"
    },
    "feature.null.level-6.metakinetic-abilities": {
      "parentId": "feature.null.level-6.6th-level-tradition-ability",
      "featureId": "0816-f04"
    },
    "feature.null.level-7.characteristic-increase": {
      "featureId": "0817-f01"
    },
    "feature.null.level-7.discipline-mastery-improvement": {
      "featureId": "0817-f02"
    },
    "feature.null.level-7.psi-boost": {
      "featureId": "0817-f03"
    },
    "feature.null.level-7.dynamic-power": {
      "parentId": "feature.null.level-7.psi-boost",
      "featureId": "0817-f03"
    },
    "feature.null.level-7.expanded-power": {
      "parentId": "feature.null.level-7.psi-boost",
      "featureId": "0817-f03"
    },
    "feature.null.level-7.extended-power": {
      "parentId": "feature.null.level-7.psi-boost",
      "featureId": "0817-f03"
    },
    "feature.null.level-7.heightened-power": {
      "parentId": "feature.null.level-7.psi-boost",
      "featureId": "0817-f03"
    },
    "feature.null.level-7.magnified-power": {
      "parentId": "feature.null.level-7.psi-boost",
      "featureId": "0817-f03"
    },
    "feature.null.level-7.shared-power": {
      "parentId": "feature.null.level-7.psi-boost",
      "featureId": "0817-f03"
    },
    "feature.null.level-7.sharpened-power": {
      "parentId": "feature.null.level-7.psi-boost",
      "featureId": "0817-f03"
    },
    "feature.null.level-7.improved-body": {
      "featureId": "0817-f04"
    },
    "feature.null.level-7.skill": {
      "featureId": "0817-f05"
    },
    "feature.null.level-8.perk": {
      "featureId": "0818-f01"
    },
    "feature.null.level-8.8th-level-tradition-feature": {
      "featureId": "0818-f02"
    },
    "feature.null.level-8.inertial-dampener": {
      "parentId": "feature.null.level-8.8th-level-tradition-feature",
      "keyedBy": "tradition",
      "keyValue": "Метакинетик",
      "featureId": "0818-f02"
    },
    "feature.null.level-8.shared-momentum": {
      "parentId": "feature.null.level-8.8th-level-tradition-feature",
      "keyedBy": "tradition",
      "keyValue": "Хронокинетик",
      "featureId": "0818-f02"
    },
    "feature.null.level-8.synaptic-triage": {
      "parentId": "feature.null.level-8.8th-level-tradition-feature",
      "keyedBy": "tradition",
      "keyValue": "Криокинетик",
      "featureId": "0818-f02"
    },
    "feature.null.level-8.11-discipline-ability": {
      "featureId": "0818-f03"
    },
    "feature.null.level-9.i-am-the-weapon": {
      "featureId": "0819-f01"
    },
    "feature.null.level-9.9th-level-tradition-ability": {
      "featureId": "0819-f02"
    },
    "feature.null.level-9.chronokinetic-abilities": {
      "parentId": "feature.null.level-9.9th-level-tradition-ability",
      "featureId": "0819-f02"
    },
    "feature.null.level-9.cryokinetic-abilities": {
      "parentId": "feature.null.level-9.9th-level-tradition-ability",
      "featureId": "0819-f02"
    },
    "feature.null.level-9.metakinetic-abilities": {
      "parentId": "feature.null.level-9.9th-level-tradition-ability",
      "featureId": "0819-f02"
    },
    "feature.null.level-10.characteristic-increase": {
      "featureId": "0820-f01"
    },
    "feature.null.level-10.discipline-mastery-improvement": {
      "featureId": "0820-f02"
    },
    "feature.null.level-10.manifold-body": {
      "featureId": "0820-f03"
    },
    "feature.null.level-10.manifold-resonance": {
      "featureId": "0820-f04"
    },
    "feature.null.level-10.order": {
      "featureId": "0820-f05"
    },
    "feature.null.level-10.perk": {
      "featureId": "0820-f06"
    },
    "feature.null.level-10.skill": {
      "featureId": "0820-f07"
    },
    "feature.conduit.level-2.the-lists-of-heaven": {
      "featureId": "0832-f01"
    },
    "feature.conduit.level-2.perk": {
      "featureId": "0832-f02"
    },
    "feature.conduit.level-2.2nd-level-domain-feature": {
      "featureId": "0832-f03"
    },
    "feature.conduit.level-2.2nd-level-domain-ability": {
      "featureId": "0832-f04"
    },
    "feature.conduit.level-3.minor-miracle": {
      "featureId": "0833-f01"
    },
    "feature.conduit.level-3.7-piety-ability": {
      "featureId": "0833-f02"
    },
    "feature.conduit.level-4.blessed-domain": {
      "featureId": "0834-f01"
    },
    "feature.conduit.level-4.characteristic-increase": {
      "featureId": "0834-f02"
    },
    "feature.conduit.level-4.perk": {
      "featureId": "0834-f03"
    },
    "feature.conduit.level-4.skill": {
      "featureId": "0834-f04"
    },
    "feature.conduit.level-4.4th-level-domain-feature": {
      "featureId": "0834-f05"
    },
    "feature.conduit.level-4.4th-level-domain-feature.life": {
      "parentId": "feature.conduit.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Жизнь",
      "featureId": "0834-f05"
    },
    "feature.ability.conduit.level-4.blessing-of-secrets": {
      "parentId": "feature.conduit.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Хитрость",
      "featureId": "0834-f05"
    },
    "feature.conduit.level-4.4th-level-domain-feature.protection": {
      "parentId": "feature.conduit.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Защита",
      "featureId": "0834-f05"
    },
    "feature.conduit.level-4.4th-level-domain-feature.creation": {
      "parentId": "feature.conduit.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Созидание",
      "featureId": "0834-f05"
    },
    "feature.conduit.level-4.4th-level-domain-feature.war": {
      "parentId": "feature.conduit.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Война",
      "featureId": "0834-f05"
    },
    "feature.conduit.level-4.4th-level-domain-feature.love": {
      "parentId": "feature.conduit.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Любовь",
      "featureId": "0834-f05"
    },
    "feature.conduit.level-4.4th-level-domain-feature.sun": {
      "parentId": "feature.conduit.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Солнце",
      "featureId": "0834-f05"
    },
    "feature.conduit.level-4.4th-level-domain-feature.fate": {
      "parentId": "feature.conduit.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Судьба",
      "featureId": "0834-f05"
    },
    "feature.conduit.level-4.4th-level-domain-feature.death": {
      "parentId": "feature.conduit.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Смерть",
      "featureId": "0834-f05"
    },
    "feature.conduit.level-4.4th-level-domain-feature.knowledge": {
      "parentId": "feature.conduit.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Знание",
      "featureId": "0834-f05"
    },
    "feature.conduit.level-4.4th-level-domain-feature.storm": {
      "parentId": "feature.conduit.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Буря",
      "featureId": "0834-f05"
    },
    "feature.conduit.level-4.4th-level-domain-feature.nature": {
      "parentId": "feature.conduit.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Природа",
      "featureId": "0834-f05"
    },
    "feature.conduit.level-5.5th-level-domain-feature": {
      "featureId": "0835-f01"
    },
    "feature.conduit.level-5.9-piety-ability": {
      "featureId": "0835-f02"
    },
    "feature.conduit.level-6.burgeoning-saint": {
      "featureId": "0836-f01"
    },
    "feature.conduit.level-6.perk": {
      "featureId": "0836-f02"
    },
    "feature.conduit.level-6.6th-level-domain-ability": {
      "featureId": "0836-f03"
    },
    "feature.conduit.level-7.characteristic-increase": {
      "featureId": "0837-f01"
    },
    "feature.conduit.level-7.faithfuls-reward": {
      "featureId": "0837-f02"
    },
    "feature.conduit.level-7.skill": {
      "featureId": "0837-f03"
    },
    "feature.conduit.level-7.7th-level-domain-feature": {
      "featureId": "0837-f04"
    },
    "feature.conduit.level-7.blessing-of-iron": {
      "parentId": "feature.conduit.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Защита",
      "featureId": "0837-f04"
    },
    "feature.conduit.level-7.covenant-of-the-heart": {
      "parentId": "feature.conduit.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Любовь",
      "featureId": "0837-f04"
    },
    "feature.conduit.level-7.divine-quartermaster": {
      "parentId": "feature.conduit.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Созидание",
      "featureId": "0837-f04"
    },
    "feature.conduit.level-7.font-of-grace": {
      "parentId": "feature.conduit.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Жизнь",
      "featureId": "0837-f04"
    },
    "feature.conduit.level-7.gods-library": {
      "parentId": "feature.conduit.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Знание",
      "featureId": "0837-f04"
    },
    "feature.conduit.level-7.light-of-the-burning-sun": {
      "parentId": "feature.conduit.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Солнце",
      "featureId": "0837-f04"
    },
    "feature.conduit.level-7.natures-bounty": {
      "parentId": "feature.conduit.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Природа",
      "featureId": "0837-f04"
    },
    "feature.conduit.level-7.thunderstruck": {
      "parentId": "feature.conduit.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Буря",
      "featureId": "0837-f04"
    },
    "feature.conduit.level-7.trinity-of-trickery": {
      "parentId": "feature.conduit.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Хитрость",
      "featureId": "0837-f04"
    },
    "feature.conduit.level-7.word-of-death-deferred": {
      "parentId": "feature.conduit.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Смерть",
      "featureId": "0837-f04"
    },
    "feature.conduit.level-7.word-of-fate-denied": {
      "parentId": "feature.conduit.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Судьба",
      "featureId": "0837-f04"
    },
    "feature.conduit.level-7.your-triumphs-are-remembered": {
      "parentId": "feature.conduit.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Война",
      "featureId": "0837-f04"
    },
    "feature.conduit.level-8.perk": {
      "featureId": "0838-f01"
    },
    "feature.conduit.level-8.8th-level-domain-feature": {
      "featureId": "0838-f02"
    },
    "feature.conduit.level-8.11-piety-ability": {
      "featureId": "0838-f03"
    },
    "feature.conduit.level-9.faiths-sword": {
      "featureId": "0839-f01"
    },
    "feature.conduit.level-9.ordained": {
      "featureId": "0839-f02"
    },
    "feature.conduit.level-9.9th-level-domain-ability": {
      "featureId": "0839-f03"
    },
    "feature.conduit.level-10.avatar": {
      "featureId": "0840-f01"
    },
    "feature.conduit.level-10.characteristic-increase": {
      "featureId": "0840-f02"
    },
    "feature.conduit.level-10.divine-power": {
      "featureId": "0840-f03"
    },
    "feature.conduit.level-10.most-pious": {
      "featureId": "0840-f04"
    },
    "feature.conduit.level-10.perk": {
      "featureId": "0840-f05"
    },
    "feature.conduit.level-10.skill": {
      "featureId": "0840-f06"
    },
    "feature.tactician.level-2.perk": {
      "featureId": "0842-f01"
    },
    "feature.tactician.level-2.2nd-level-doctrine-feature": {
      "featureId": "0842-f02"
    },
    "feature.tactician.level-2.goaded": {
      "parentId": "feature.tactician.level-2.2nd-level-doctrine-feature",
      "keyedBy": "doctrine",
      "keyValue": "Воевода",
      "featureId": "0842-f02"
    },
    "feature.tactician.level-2.infiltration-tactics": {
      "parentId": "feature.tactician.level-2.2nd-level-doctrine-feature",
      "keyedBy": "doctrine",
      "keyValue": "Повстанец",
      "featureId": "0842-f02"
    },
    "feature.tactician.level-2.melee-superiority": {
      "parentId": "feature.tactician.level-2.2nd-level-doctrine-feature",
      "keyedBy": "doctrine",
      "keyValue": "Авангард",
      "featureId": "0842-f02"
    },
    "feature.tactician.level-2.2nd-level-doctrine-ability": {
      "featureId": "0842-f03"
    },
    "feature.tactician.level-2.insurgent-ability": {
      "parentId": "feature.tactician.level-2.2nd-level-doctrine-ability",
      "featureId": "0842-f03"
    },
    "feature.tactician.level-2.mastermind-ability": {
      "parentId": "feature.tactician.level-2.2nd-level-doctrine-ability",
      "featureId": "0842-f03"
    },
    "feature.tactician.level-2.vanguard-ability": {
      "parentId": "feature.tactician.level-2.2nd-level-doctrine-ability",
      "featureId": "0842-f03"
    },
    "feature.tactician.level-3.out-of-position": {
      "featureId": "0843-f01"
    },
    "feature.tactician.level-3.7-focus-ability": {
      "featureId": "0843-f02"
    },
    "feature.tactician.level-4.characteristic-increase": {
      "featureId": "0844-f01"
    },
    "feature.tactician.level-4.focus-on-their-weaknesses": {
      "featureId": "0844-f02"
    },
    "feature.tactician.level-4.improved-field-arsenal": {
      "featureId": "0844-f03"
    },
    "feature.tactician.level-4.perk": {
      "featureId": "0844-f04"
    },
    "feature.tactician.level-4.skill": {
      "featureId": "0844-f05"
    },
    "feature.tactician.level-5.5th-level-doctrine-features": {
      "featureId": "0845-f01"
    },
    "feature.tactician.level-5.anticipation": {
      "parentId": "feature.tactician.level-5.5th-level-doctrine-features",
      "keyedBy": "doctrine",
      "keyValue": "Воевода",
      "featureId": "0845-f01"
    },
    "feature.tactician.level-5.distracted": {
      "parentId": "feature.tactician.level-5.5th-level-doctrine-features",
      "keyedBy": "doctrine",
      "keyValue": "Повстанец",
      "featureId": "0845-f01"
    },
    "feature.tactician.level-5.i-predicted-that": {
      "parentId": "feature.tactician.level-5.5th-level-doctrine-features",
      "keyedBy": "doctrine",
      "keyValue": "Воевода",
      "featureId": "0845-f01"
    },
    "feature.tactician.level-5.leave-no-trace": {
      "parentId": "feature.tactician.level-5.5th-level-doctrine-features",
      "keyedBy": "doctrine",
      "keyValue": "Повстанец",
      "featureId": "0845-f01"
    },
    "feature.tactician.level-5.shake-it-off": {
      "parentId": "feature.tactician.level-5.5th-level-doctrine-features",
      "keyedBy": "doctrine",
      "keyValue": "Авангард",
      "featureId": "0845-f01"
    },
    "feature.tactician.level-5.tactical-offensive": {
      "parentId": "feature.tactician.level-5.5th-level-doctrine-features",
      "keyedBy": "doctrine",
      "keyValue": "Авангард",
      "featureId": "0845-f01"
    },
    "feature.tactician.level-5.9-focus-ability": {
      "featureId": "0845-f02"
    },
    "feature.tactician.level-6.master-of-arms": {
      "featureId": "0846-f01"
    },
    "feature.tactician.level-6.perk": {
      "featureId": "0846-f02"
    },
    "feature.tactician.level-6.6th-level-doctrine-ability": {
      "featureId": "0846-f03"
    },
    "feature.tactician.level-6.insurgent-abilities": {
      "parentId": "feature.tactician.level-6.6th-level-doctrine-ability",
      "featureId": "0846-f03"
    },
    "feature.tactician.level-6.mastermind-abilities": {
      "parentId": "feature.tactician.level-6.6th-level-doctrine-ability",
      "featureId": "0846-f03"
    },
    "feature.tactician.level-6.vanguard-abilities": {
      "parentId": "feature.tactician.level-6.6th-level-doctrine-ability",
      "featureId": "0846-f03"
    },
    "feature.tactician.level-7.characteristic-increase": {
      "featureId": "0847-f01"
    },
    "feature.tactician.level-7.heightened-focus": {
      "featureId": "0847-f02"
    },
    "feature.tactician.level-7.seize-the-initiative": {
      "featureId": "0847-f03"
    },
    "feature.tactician.level-7.skill": {
      "featureId": "0847-f04"
    },
    "feature.tactician.level-7.7th-level-doctrine-feature": {
      "featureId": "0847-f05"
    },
    "feature.tactician.level-7.asymmetric-warfare": {
      "parentId": "feature.tactician.level-7.7th-level-doctrine-feature",
      "keyedBy": "doctrine",
      "keyValue": "Повстанец",
      "featureId": "0847-f05"
    },
    "feature.tactician.level-7.grand-strategy": {
      "parentId": "feature.tactician.level-7.7th-level-doctrine-feature",
      "keyedBy": "doctrine",
      "keyValue": "Воевода",
      "featureId": "0847-f05"
    },
    "feature.tactician.level-7.shock-and-awe": {
      "parentId": "feature.tactician.level-7.7th-level-doctrine-feature",
      "keyedBy": "doctrine",
      "keyValue": "Авангард",
      "featureId": "0847-f05"
    },
    "feature.tactician.level-8.perk": {
      "featureId": "0848-f01"
    },
    "feature.tactician.level-8.8th-level-doctrine-feature": {
      "featureId": "0848-f02"
    },
    "feature.tactician.level-8.bait-and-ambush": {
      "parentId": "feature.tactician.level-8.8th-level-doctrine-feature",
      "keyedBy": "doctrine",
      "keyValue": "Повстанец",
      "featureId": "0848-f02"
    },
    "feature.tactician.level-8.pincer-movement": {
      "parentId": "feature.tactician.level-8.8th-level-doctrine-feature",
      "keyedBy": "doctrine",
      "keyValue": "Воевода",
      "featureId": "0848-f02"
    },
    "feature.tactician.level-8.see-your-enemies-driven-before-you": {
      "parentId": "feature.tactician.level-8.8th-level-doctrine-feature",
      "keyedBy": "doctrine",
      "keyValue": "Авангард",
      "featureId": "0848-f02"
    },
    "feature.tactician.level-8.11-focus-ability": {
      "featureId": "0848-f03"
    },
    "feature.tactician.level-9.grandmaster-of-arms": {
      "featureId": "0849-f01"
    },
    "feature.tactician.level-9.9th-level-doctrine-ability": {
      "featureId": "0849-f02"
    },
    "feature.tactician.level-9.insurgent-abilities": {
      "parentId": "feature.tactician.level-9.9th-level-doctrine-ability",
      "featureId": "0849-f02"
    },
    "feature.tactician.level-9.mastermind-abilities": {
      "parentId": "feature.tactician.level-9.9th-level-doctrine-ability",
      "featureId": "0849-f02"
    },
    "feature.tactician.level-9.vanguard-abilities": {
      "parentId": "feature.tactician.level-9.9th-level-doctrine-ability",
      "featureId": "0849-f02"
    },
    "feature.tactician.level-10.characteristic-increase": {
      "featureId": "0850-f01"
    },
    "feature.tactician.level-10.command": {
      "featureId": "0850-f02"
    },
    "feature.tactician.level-10.perk": {
      "featureId": "0850-f03"
    },
    "feature.tactician.level-10.skill": {
      "featureId": "0850-f04"
    },
    "feature.tactician.level-10.true-focus": {
      "featureId": "0850-f05"
    },
    "feature.tactician.level-10.warmaster": {
      "featureId": "0850-f06"
    },
    "feature.talent.level-2.perk": {
      "featureId": "0852-f01"
    },
    "feature.talent.level-2.2nd-level-tradition-feature": {
      "featureId": "0852-f02"
    },
    "feature.talent.level-2.ease-the-hours": {
      "parentId": "feature.talent.level-2.2nd-level-tradition-feature",
      "keyedBy": "tradition",
      "keyValue": "Хронопатия",
      "featureId": "0852-f02"
    },
    "feature.talent.level-2.ease-the-mind": {
      "parentId": "feature.talent.level-2.2nd-level-tradition-feature",
      "keyedBy": "tradition",
      "keyValue": "Телепатия",
      "featureId": "0852-f02"
    },
    "feature.talent.level-2.ease-their-fall": {
      "parentId": "feature.talent.level-2.2nd-level-tradition-feature",
      "keyedBy": "tradition",
      "keyValue": "Телекинез",
      "featureId": "0852-f02"
    },
    "feature.talent.level-2.2nd-level-tradition-ability": {
      "featureId": "0852-f03"
    },
    "feature.talent.level-2.chronopathy-ability": {
      "parentId": "feature.talent.level-2.2nd-level-tradition-ability",
      "featureId": "0852-f03"
    },
    "feature.talent.level-2.telekinesis-ability": {
      "parentId": "feature.talent.level-2.2nd-level-tradition-ability",
      "featureId": "0852-f03"
    },
    "feature.talent.level-2.telepathy-ability": {
      "parentId": "feature.talent.level-2.2nd-level-tradition-ability",
      "featureId": "0852-f03"
    },
    "feature.talent.level-3.scan": {
      "featureId": "0853-f01"
    },
    "feature.talent.level-3.7-clarity-ability": {
      "featureId": "0853-f02"
    },
    "feature.talent.level-4.characteristic-increase": {
      "featureId": "0854-f01"
    },
    "feature.talent.level-4.mind-projection": {
      "featureId": "0854-f02"
    },
    "feature.talent.level-4.mind-recovery": {
      "featureId": "0854-f03"
    },
    "feature.talent.level-4.perk": {
      "featureId": "0854-f04"
    },
    "feature.talent.level-4.skill": {
      "featureId": "0854-f05"
    },
    "feature.talent.level-4.suspensor-field": {
      "featureId": "0854-f06"
    },
    "feature.talent.level-5.5th-level-tradition-features": {
      "featureId": "0855-f01"
    },
    "feature.talent.level-5.compulsion": {
      "parentId": "feature.talent.level-5.5th-level-tradition-features",
      "keyedBy": "tradition",
      "keyValue": "Телепатия",
      "featureId": "0855-f01"
    },
    "feature.talent.level-5.distortion-temporal": {
      "parentId": "feature.talent.level-5.5th-level-tradition-features",
      "keyedBy": "tradition",
      "keyValue": "Хронопатия",
      "featureId": "0855-f01"
    },
    "feature.talent.level-5.kinetic-amplifier": {
      "parentId": "feature.talent.level-5.5th-level-tradition-features",
      "keyedBy": "tradition",
      "keyValue": "Телекинез",
      "featureId": "0855-f01"
    },
    "feature.talent.level-5.remote-amplification": {
      "parentId": "feature.talent.level-5.5th-level-tradition-features",
      "keyedBy": "tradition",
      "keyValue": "Телепатия",
      "featureId": "0855-f01"
    },
    "feature.talent.level-5.speed-of-thought": {
      "parentId": "feature.talent.level-5.5th-level-tradition-features",
      "keyedBy": "tradition",
      "keyValue": "Хронопатия",
      "featureId": "0855-f01"
    },
    "feature.talent.level-5.triangulate": {
      "parentId": "feature.talent.level-5.5th-level-tradition-features",
      "keyedBy": "tradition",
      "keyValue": "Телекинез",
      "featureId": "0855-f01"
    },
    "feature.talent.level-5.9-clarity-ability": {
      "featureId": "0855-f02"
    },
    "feature.talent.level-6.perk": {
      "featureId": "0856-f01"
    },
    "feature.talent.level-6.psi-boost": {
      "featureId": "0856-f02"
    },
    "feature.talent.level-6.dynamic-power": {
      "parentId": "feature.talent.level-6.psi-boost",
      "featureId": "0856-f02"
    },
    "feature.talent.level-6.expanded-power": {
      "parentId": "feature.talent.level-6.psi-boost",
      "featureId": "0856-f02"
    },
    "feature.talent.level-6.extended-power": {
      "parentId": "feature.talent.level-6.psi-boost",
      "featureId": "0856-f02"
    },
    "feature.talent.level-6.heightened-power": {
      "parentId": "feature.talent.level-6.psi-boost",
      "featureId": "0856-f02"
    },
    "feature.talent.level-6.magnified-power": {
      "parentId": "feature.talent.level-6.psi-boost",
      "featureId": "0856-f02"
    },
    "feature.talent.level-6.shared-power": {
      "parentId": "feature.talent.level-6.psi-boost",
      "featureId": "0856-f02"
    },
    "feature.talent.level-6.sharpened-power": {
      "parentId": "feature.talent.level-6.psi-boost",
      "featureId": "0856-f02"
    },
    "feature.talent.level-6.6th-level-tradition-ability": {
      "featureId": "0856-f03"
    },
    "feature.talent.level-6.chronopathy-abilities": {
      "parentId": "feature.talent.level-6.6th-level-tradition-ability",
      "featureId": "0856-f03"
    },
    "feature.talent.level-6.telekinesis-abilities": {
      "parentId": "feature.talent.level-6.6th-level-tradition-ability",
      "featureId": "0856-f03"
    },
    "feature.talent.level-6.telepathy-abilities": {
      "parentId": "feature.talent.level-6.6th-level-tradition-ability",
      "featureId": "0856-f03"
    },
    "feature.talent.level-7.ancestral-memory": {
      "featureId": "0857-f01"
    },
    "feature.talent.level-7.cascading-strain": {
      "featureId": "0857-f02"
    },
    "feature.talent.level-7.characteristic-increase": {
      "featureId": "0857-f03"
    },
    "feature.talent.level-7.lucid-mind": {
      "featureId": "0857-f04"
    },
    "feature.talent.level-7.skill": {
      "featureId": "0857-f05"
    },
    "feature.talent.level-8.perk": {
      "featureId": "0858-f01"
    },
    "feature.talent.level-8.8th-level-tradition-features": {
      "featureId": "0858-f02"
    },
    "feature.talent.level-8.doubling-the-hours": {
      "parentId": "feature.talent.level-8.8th-level-tradition-features",
      "keyedBy": "tradition",
      "keyValue": "Хронопатия",
      "featureId": "0858-f02"
    },
    "feature.talent.level-8.levitation-field": {
      "parentId": "feature.talent.level-8.8th-level-tradition-features",
      "keyedBy": "tradition",
      "keyValue": "Телекинез",
      "featureId": "0858-f02"
    },
    "feature.talent.level-8.low-gravity": {
      "parentId": "feature.talent.level-8.8th-level-tradition-features",
      "keyedBy": "tradition",
      "keyValue": "Телекинез",
      "featureId": "0858-f02"
    },
    "feature.talent.level-8.mindlink": {
      "parentId": "feature.talent.level-8.8th-level-tradition-features",
      "keyedBy": "tradition",
      "keyValue": "Телепатия",
      "featureId": "0858-f02"
    },
    "feature.talent.level-8.stasis-shield": {
      "parentId": "feature.talent.level-8.8th-level-tradition-features",
      "keyedBy": "tradition",
      "keyValue": "Хронопатия",
      "featureId": "0858-f02"
    },
    "feature.talent.level-8.universal-connection": {
      "parentId": "feature.talent.level-8.8th-level-tradition-features",
      "keyedBy": "tradition",
      "keyValue": "Телепатия",
      "featureId": "0858-f02"
    },
    "feature.talent.level-8.11-clarity-ability": {
      "featureId": "0858-f03"
    },
    "feature.talent.level-9.fortress-of-perfect-thought": {
      "featureId": "0859-f01"
    },
    "feature.talent.level-9.9th-level-tradition-ability": {
      "featureId": "0859-f02"
    },
    "feature.talent.level-9.chronopathy-abilities": {
      "parentId": "feature.talent.level-9.9th-level-tradition-ability",
      "featureId": "0859-f02"
    },
    "feature.talent.level-9.telekinesis-abilities": {
      "parentId": "feature.talent.level-9.9th-level-tradition-ability",
      "featureId": "0859-f02"
    },
    "feature.talent.level-9.telepathy-abilities": {
      "parentId": "feature.talent.level-9.9th-level-tradition-ability",
      "featureId": "0859-f02"
    },
    "feature.talent.level-10.characteristic-increase": {
      "featureId": "0860-f01"
    },
    "feature.talent.level-10.clear-mind": {
      "featureId": "0860-f02"
    },
    "feature.talent.level-10.omnisensory": {
      "featureId": "0860-f03"
    },
    "feature.talent.level-10.perk": {
      "featureId": "0860-f04"
    },
    "feature.talent.level-10.psion": {
      "featureId": "0860-f05"
    },
    "feature.talent.level-10.skill": {
      "featureId": "0860-f06"
    },
    "feature.talent.level-10.vision": {
      "featureId": "0860-f07"
    },
    "feature.shadow.level-2.perk": {
      "featureId": "0862-f01"
    },
    "feature.shadow.level-2.2nd-level-college-feature": {
      "featureId": "0862-f02"
    },
    "feature.shadow.level-2.burning-ash": {
      "parentId": "feature.shadow.level-2.2nd-level-college-feature",
      "keyedBy": "college",
      "keyValue": "Черный Пепел",
      "featureId": "0862-f02"
    },
    "feature.shadow.level-2.friend": {
      "parentId": "feature.shadow.level-2.2nd-level-college-feature",
      "keyedBy": "college",
      "keyValue": "Маска Арлекина",
      "featureId": "0862-f02"
    },
    "feature.shadow.level-2.trained-assassin": {
      "parentId": "feature.shadow.level-2.2nd-level-college-feature",
      "keyedBy": "college",
      "keyValue": "Едкая Алхимия",
      "featureId": "0862-f02"
    },
    "feature.shadow.level-2.2nd-level-college-ability": {
      "featureId": "0862-f03"
    },
    "feature.shadow.level-2.black-ash-ability": {
      "parentId": "feature.shadow.level-2.2nd-level-college-ability",
      "featureId": "0862-f03"
    },
    "feature.shadow.level-2.caustic-alchemy-ability": {
      "parentId": "feature.shadow.level-2.2nd-level-college-ability",
      "featureId": "0862-f03"
    },
    "feature.shadow.level-2.harlequin-mask-ability": {
      "parentId": "feature.shadow.level-2.2nd-level-college-ability",
      "featureId": "0862-f03"
    },
    "feature.shadow.level-3.careful-observation": {
      "featureId": "0863-f01"
    },
    "feature.shadow.level-3.7-insight-ability": {
      "featureId": "0863-f02"
    },
    "feature.shadow.level-4.characteristic-increase": {
      "featureId": "0864-f01"
    },
    "feature.shadow.level-4.keep-it-down": {
      "featureId": "0864-f02"
    },
    "feature.shadow.level-4.night-watch": {
      "featureId": "0864-f03"
    },
    "feature.shadow.level-4.perk": {
      "featureId": "0864-f04"
    },
    "feature.shadow.level-4.skill": {
      "featureId": "0864-f05"
    },
    "feature.shadow.level-4.surge-of-insight": {
      "featureId": "0864-f06"
    },
    "feature.shadow.level-5.5th-level-college-feature": {
      "featureId": "0865-f01"
    },
    "feature.shadow.level-5.harlequin-gambit": {
      "parentId": "feature.shadow.level-5.5th-level-college-feature",
      "keyedBy": "college",
      "keyValue": "Маска Арлекина",
      "featureId": "0865-f01"
    },
    "feature.shadow.level-5.trail-of-cinders": {
      "parentId": "feature.shadow.level-5.5th-level-college-feature",
      "keyedBy": "college",
      "keyValue": "Черный Пепел",
      "featureId": "0865-f01"
    },
    "feature.shadow.level-5.volatile-reagents": {
      "parentId": "feature.shadow.level-5.5th-level-college-feature",
      "keyedBy": "college",
      "keyValue": "Едкая Алхимия",
      "featureId": "0865-f01"
    },
    "feature.shadow.level-5.9-insight-ability": {
      "featureId": "0865-f02"
    },
    "feature.shadow.level-6.perk": {
      "featureId": "0866-f01"
    },
    "feature.shadow.level-6.umbral-form": {
      "featureId": "0866-f02"
    },
    "feature.shadow.level-6.6th-level-college-ability": {
      "featureId": "0866-f03"
    },
    "feature.shadow.level-6.black-ash-abilities": {
      "parentId": "feature.shadow.level-6.6th-level-college-ability",
      "featureId": "0866-f03"
    },
    "feature.shadow.level-6.caustic-alchemy-abilities": {
      "parentId": "feature.shadow.level-6.6th-level-college-ability",
      "featureId": "0866-f03"
    },
    "feature.shadow.level-6.harlequin-mask-abilities": {
      "parentId": "feature.shadow.level-6.6th-level-college-ability",
      "featureId": "0866-f03"
    },
    "feature.shadow.level-7.characteristic-increase": {
      "featureId": "0867-f01"
    },
    "feature.shadow.level-7.keen-insight": {
      "featureId": "0867-f02"
    },
    "feature.shadow.level-7.skill": {
      "featureId": "0867-f03"
    },
    "feature.shadow.level-7.careful-observation-improvement": {
      "featureId": "0867-f04"
    },
    "feature.shadow.level-7.ventriloquist": {
      "featureId": "0867-f05"
    },
    "feature.shadow.level-8.perk": {
      "featureId": "0868-f01"
    },
    "feature.shadow.level-8.8th-level-college-feature": {
      "featureId": "0868-f02"
    },
    "feature.shadow.level-8.cinder-step": {
      "parentId": "feature.shadow.level-8.8th-level-college-feature",
      "keyedBy": "college",
      "keyValue": "Черный Пепел",
      "featureId": "0868-f02"
    },
    "feature.shadow.level-8.parkour": {
      "parentId": "feature.shadow.level-8.8th-level-college-feature",
      "keyedBy": "college",
      "keyValue": "Маска Арлекина",
      "featureId": "0868-f02"
    },
    "feature.shadow.level-8.time-bomb": {
      "parentId": "feature.shadow.level-8.8th-level-college-feature",
      "keyedBy": "college",
      "keyValue": "Едкая Алхимия",
      "featureId": "0868-f02"
    },
    "feature.shadow.level-8.11-insight-ability": {
      "featureId": "0868-f03"
    },
    "feature.shadow.level-9.gloom-squad": {
      "featureId": "0869-f01"
    },
    "feature.shadow.level-9.9th-level-college-ability": {
      "featureId": "0869-f02"
    },
    "feature.shadow.level-9.black-ash-abilities": {
      "parentId": "feature.shadow.level-9.9th-level-college-ability",
      "featureId": "0869-f02"
    },
    "feature.shadow.level-9.caustic-alchemy-abilities": {
      "parentId": "feature.shadow.level-9.9th-level-college-ability",
      "featureId": "0869-f02"
    },
    "feature.shadow.level-9.harlequin-mask-abilities": {
      "parentId": "feature.shadow.level-9.9th-level-college-ability",
      "featureId": "0869-f02"
    },
    "feature.shadow.level-10.characteristic-increase": {
      "featureId": "0870-f01"
    },
    "feature.shadow.level-10.death-pool": {
      "featureId": "0870-f02"
    },
    "feature.shadow.level-10.perk": {
      "featureId": "0870-f03"
    },
    "feature.shadow.level-10.skill": {
      "featureId": "0870-f04"
    },
    "feature.shadow.level-10.careful-observation-improvement": {
      "featureId": "0870-f05"
    },
    "feature.shadow.level-10.improved-umbral-form": {
      "featureId": "0870-f06"
    },
    "feature.shadow.level-10.subterfuge": {
      "featureId": "0870-f07"
    },
    "feature.troubadour.level-2.appeal-to-the-muses": {
      "featureId": "0872-f01"
    },
    "feature.troubadour.level-2.invocation": {
      "featureId": "0872-f02"
    },
    "feature.troubadour.level-2.allow-me-to-introduce-tonights-players": {
      "parentId": "feature.troubadour.level-2.invocation",
      "featureId": "0872-f02"
    },
    "feature.troubadour.level-2.formal-introductions": {
      "parentId": "feature.troubadour.level-2.invocation",
      "featureId": "0872-f02"
    },
    "feature.troubadour.level-2.my-reputation-precedes-me": {
      "parentId": "feature.troubadour.level-2.invocation",
      "featureId": "0872-f02"
    },
    "feature.troubadour.level-2.perk": {
      "featureId": "0872-f03"
    },
    "feature.troubadour.level-2.2nd-level-class-act-ability": {
      "featureId": "0872-f04"
    },
    "feature.troubadour.level-2.auteur-ability": {
      "parentId": "feature.troubadour.level-2.2nd-level-class-act-ability",
      "featureId": "0872-f04"
    },
    "feature.troubadour.level-2.duelist-ability": {
      "parentId": "feature.troubadour.level-2.2nd-level-class-act-ability",
      "featureId": "0872-f04"
    },
    "feature.troubadour.level-2.virtuoso-ability": {
      "parentId": "feature.troubadour.level-2.2nd-level-class-act-ability",
      "featureId": "0872-f04"
    },
    "feature.troubadour.level-3.3rd-level-class-act-feature": {
      "featureId": "0873-f01"
    },
    "feature.troubadour.level-3.foil": {
      "parentId": "feature.troubadour.level-3.3rd-level-class-act-feature",
      "keyedBy": "troupe",
      "keyValue": "Дуэлянт",
      "featureId": "0873-f01"
    },
    "feature.troubadour.level-3.missed-cue": {
      "parentId": "feature.troubadour.level-3.3rd-level-class-act-feature",
      "keyedBy": "troupe",
      "keyValue": "Автор",
      "featureId": "0873-f01"
    },
    "feature.troubadour.level-3.second-album": {
      "parentId": "feature.troubadour.level-3.3rd-level-class-act-feature",
      "keyedBy": "troupe",
      "keyValue": "Виртуоз",
      "featureId": "0873-f01"
    },
    "feature.troubadour.level-3.7-drama-ability": {
      "featureId": "0873-f02"
    },
    "feature.troubadour.level-4.characteristic-increase": {
      "featureId": "0874-f01"
    },
    "feature.troubadour.level-4.melodrama": {
      "featureId": "0874-f02"
    },
    "feature.troubadour.level-4.perk": {
      "featureId": "0874-f03"
    },
    "feature.troubadour.level-4.skill": {
      "featureId": "0874-f04"
    },
    "feature.troubadour.level-4.zeitgeist": {
      "featureId": "0874-f05"
    },
    "feature.troubadour.level-4.foreshadowing": {
      "parentId": "feature.troubadour.level-4.zeitgeist",
      "featureId": "0874-f05"
    },
    "feature.troubadour.level-4.hear-ye-hear-ye": {
      "parentId": "feature.troubadour.level-4.zeitgeist",
      "featureId": "0874-f05"
    },
    "feature.troubadour.level-4.latest-goss": {
      "parentId": "feature.troubadour.level-4.zeitgeist",
      "featureId": "0874-f05"
    },
    "feature.troubadour.level-5.5th-level-class-act-feature": {
      "featureId": "0875-f01"
    },
    "feature.troubadour.level-5.auteur-features": {
      "parentId": "feature.troubadour.level-5.5th-level-class-act-feature",
      "featureId": "0875-f01"
    },
    "feature.troubadour.level-5.fix-it-in-post": {
      "parentId": "feature.troubadour.level-5.auteur-features",
      "featureId": "0875-f01"
    },
    "feature.ability.troubadour.level-5.take-two": {
      "parentId": "feature.troubadour.level-5.auteur-features",
      "featureId": "0875-f01"
    },
    "feature.troubadour.level-5.duelist-features": {
      "parentId": "feature.troubadour.level-5.5th-level-class-act-feature",
      "featureId": "0875-f01"
    },
    "feature.troubadour.level-5.verbal-duel": {
      "parentId": "feature.troubadour.level-5.duelist-features",
      "featureId": "0875-f01"
    },
    "feature.ability.troubadour.level-5.we-cant-be-upstaged": {
      "parentId": "feature.troubadour.level-5.duelist-features",
      "featureId": "0875-f01"
    },
    "feature.troubadour.level-5.virtuoso-features": {
      "parentId": "feature.troubadour.level-5.5th-level-class-act-feature",
      "featureId": "0875-f01"
    },
    "feature.troubadour.level-5.bolstering-banter": {
      "parentId": "feature.troubadour.level-5.virtuoso-features",
      "featureId": "0875-f01"
    },
    "feature.troubadour.level-5.medley": {
      "parentId": "feature.troubadour.level-5.virtuoso-features",
      "featureId": "0875-f01"
    },
    "feature.troubadour.level-5.9-drama-ability": {
      "featureId": "0875-f02"
    },
    "feature.troubadour.level-6.perk": {
      "featureId": "0876-f01"
    },
    "feature.troubadour.level-6.spotlight": {
      "featureId": "0876-f02"
    },
    "feature.troubadour.level-6.6th-level-class-act-ability": {
      "featureId": "0876-f03"
    },
    "feature.troubadour.level-6.auteur-abilities": {
      "parentId": "feature.troubadour.level-6.6th-level-class-act-ability",
      "featureId": "0876-f03"
    },
    "feature.troubadour.level-6.duelist-abilities": {
      "parentId": "feature.troubadour.level-6.6th-level-class-act-ability",
      "featureId": "0876-f03"
    },
    "feature.troubadour.level-6.virtuoso-abilities": {
      "parentId": "feature.troubadour.level-6.6th-level-class-act-ability",
      "featureId": "0876-f03"
    },
    "feature.troubadour.level-7.characteristic-increase": {
      "featureId": "0877-f01"
    },
    "feature.troubadour.level-7.equal-billing": {
      "featureId": "0877-f02"
    },
    "feature.troubadour.level-7.a-muses-muse": {
      "featureId": "0877-f03"
    },
    "feature.troubadour.level-7.skill": {
      "featureId": "0877-f04"
    },
    "feature.troubadour.level-8.perk": {
      "featureId": "0878-f01"
    },
    "feature.troubadour.level-8.8th-level-class-act-feature": {
      "featureId": "0878-f02"
    },
    "feature.troubadour.level-8.crowd-favorites": {
      "parentId": "feature.troubadour.level-8.8th-level-class-act-feature",
      "keyedBy": "troupe",
      "keyValue": "Виртуоз",
      "featureId": "0878-f02"
    },
    "feature.troubadour.level-8.deleted-scene": {
      "parentId": "feature.troubadour.level-8.8th-level-class-act-feature",
      "keyedBy": "troupe",
      "keyValue": "Автор",
      "featureId": "0878-f02"
    },
    "feature.troubadour.level-8.masterwork": {
      "parentId": "feature.troubadour.level-8.8th-level-class-act-feature",
      "keyedBy": "troupe",
      "keyValue": "Дуэлянт",
      "featureId": "0878-f02"
    },
    "feature.troubadour.level-8.11-drama-ability": {
      "featureId": "0878-f03"
    },
    "feature.troubadour.level-9.roar-of-the-crowd": {
      "featureId": "0879-f01"
    },
    "feature.troubadour.level-9.9th-level-class-act-ability": {
      "featureId": "0879-f02"
    },
    "feature.troubadour.level-9.auteur-abilities": {
      "parentId": "feature.troubadour.level-9.9th-level-class-act-ability",
      "featureId": "0879-f02"
    },
    "feature.troubadour.level-9.duelist-abilities": {
      "parentId": "feature.troubadour.level-9.9th-level-class-act-ability",
      "featureId": "0879-f02"
    },
    "feature.troubadour.level-9.virtuoso-abilities": {
      "parentId": "feature.troubadour.level-9.9th-level-class-act-ability",
      "featureId": "0879-f02"
    },
    "feature.troubadour.level-10.applause": {
      "featureId": "0880-f01"
    },
    "feature.troubadour.level-10.characteristic-increase": {
      "featureId": "0880-f02"
    },
    "feature.troubadour.level-10.dramaturgy": {
      "featureId": "0880-f03"
    },
    "feature.troubadour.level-10.greatest-of-all-time": {
      "featureId": "0880-f04"
    },
    "feature.troubadour.level-10.perk": {
      "featureId": "0880-f05"
    },
    "feature.troubadour.level-10.skill": {
      "featureId": "0880-f06"
    },
    "feature.censor.level-2.perk": {
      "featureId": "0882-f01"
    },
    "feature.censor.level-2.2nd-level-order-features": {
      "featureId": "0882-f02"
    },
    "feature.censor.level-2.it-was-foretold": {
      "parentId": "feature.censor.level-2.2nd-level-order-features",
      "keyedBy": "order",
      "keyValue": "Оракул",
      "featureId": "0882-f02"
    },
    "feature.censor.level-2.judge-of-character": {
      "parentId": "feature.censor.level-2.2nd-level-order-features",
      "keyedBy": "order",
      "keyValue": "Оракул",
      "featureId": "0882-f02"
    },
    "feature.censor.level-2.lead-by-example": {
      "parentId": "feature.censor.level-2.2nd-level-order-features",
      "keyedBy": "order",
      "keyValue": "Идеал",
      "featureId": "0882-f02"
    },
    "feature.censor.level-2.saints-vigilance": {
      "parentId": "feature.censor.level-2.2nd-level-order-features",
      "keyedBy": "order",
      "keyValue": "Экзорцист",
      "featureId": "0882-f02"
    },
    "feature.censor.level-2.a-sense-for-truth": {
      "parentId": "feature.censor.level-2.2nd-level-order-features",
      "keyedBy": "order",
      "keyValue": "Экзорцист",
      "featureId": "0882-f02"
    },
    "feature.censor.level-2.stalwart-icon": {
      "parentId": "feature.censor.level-2.2nd-level-order-features",
      "keyedBy": "order",
      "keyValue": "Идеал",
      "featureId": "0882-f02"
    },
    "feature.censor.level-2.2nd-level-order-ability": {
      "featureId": "0882-f03"
    },
    "feature.censor.level-2.exorcist-ability": {
      "parentId": "feature.censor.level-2.2nd-level-order-ability",
      "featureId": "0882-f03"
    },
    "feature.censor.level-2.oracle-ability": {
      "parentId": "feature.censor.level-2.2nd-level-order-ability",
      "featureId": "0882-f03"
    },
    "feature.censor.level-2.paragon-ability": {
      "parentId": "feature.censor.level-2.2nd-level-order-ability",
      "featureId": "0882-f03"
    },
    "feature.censor.level-3.look-on-my-work-and-despair": {
      "featureId": "0883-f01"
    },
    "feature.censor.level-3.7-wrath-ability": {
      "featureId": "0883-f02"
    },
    "feature.censor.level-4.characteristic-increase": {
      "featureId": "0884-f01"
    },
    "feature.censor.level-4.perk": {
      "featureId": "0884-f02"
    },
    "feature.censor.level-4.skill": {
      "featureId": "0884-f03"
    },
    "feature.censor.level-4.wrath-beyond-wrath": {
      "featureId": "0884-f04"
    },
    "feature.censor.level-4.4th-level-domain-feature": {
      "featureId": "0884-f05"
    },
    "feature.censor.level-4.blessing-of-life": {
      "parentId": "feature.censor.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Жизнь",
      "featureId": "0884-f05"
    },
    "feature.censor.level-4.blessing-of-secrets": {
      "parentId": "feature.censor.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Хитрость",
      "featureId": "0884-f05"
    },
    "feature.censor.level-4.impervious-touch": {
      "parentId": "feature.censor.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Защита",
      "featureId": "0884-f05"
    },
    "feature.censor.level-4.improved-hands-of-the-maker": {
      "parentId": "feature.censor.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Созидание",
      "featureId": "0884-f05"
    },
    "feature.censor.level-4.improved-sanctified-weapon": {
      "parentId": "feature.censor.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Война",
      "featureId": "0884-f05"
    },
    "feature.censor.level-4.invocation-of-the-heart": {
      "parentId": "feature.censor.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Любовь",
      "featureId": "0884-f05"
    },
    "feature.censor.level-4.light-of-revelation": {
      "parentId": "feature.censor.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Солнце",
      "featureId": "0884-f05"
    },
    "feature.censor.level-4.oracular-warning": {
      "parentId": "feature.censor.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Судьба",
      "featureId": "0884-f05"
    },
    "feature.censor.level-4.seance": {
      "parentId": "feature.censor.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Смерть",
      "featureId": "0884-f05"
    },
    "feature.censor.level-4.saints-epiphany": {
      "parentId": "feature.censor.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Знание",
      "featureId": "0884-f05"
    },
    "feature.censor.level-4.windwalk": {
      "parentId": "feature.censor.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Буря",
      "featureId": "0884-f05"
    },
    "feature.censor.level-4.wode-road": {
      "parentId": "feature.censor.level-4.4th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Природа",
      "featureId": "0884-f05"
    },
    "feature.censor.level-5.5th-level-order-feature": {
      "featureId": "0885-f01"
    },
    "feature.censor.level-5.evil-revealed": {
      "parentId": "feature.censor.level-5.5th-level-order-feature",
      "keyedBy": "order",
      "keyValue": "Экзорцист",
      "featureId": "0885-f01"
    },
    "feature.censor.level-5.prophecy": {
      "parentId": "feature.censor.level-5.5th-level-order-feature",
      "keyedBy": "order",
      "keyValue": "Оракул",
      "featureId": "0885-f01"
    },
    "feature.censor.level-5.stand-fast": {
      "parentId": "feature.censor.level-5.5th-level-order-feature",
      "keyedBy": "order",
      "keyValue": "Идеал",
      "featureId": "0885-f01"
    },
    "feature.censor.level-5.9-wrath-ability": {
      "featureId": "0885-f02"
    },
    "feature.censor.level-6.implement-of-wrath": {
      "featureId": "0886-f01"
    },
    "feature.censor.level-6.perk": {
      "featureId": "0886-f02"
    },
    "feature.censor.level-6.6th-level-order-ability": {
      "featureId": "0886-f03"
    },
    "feature.censor.level-6.exorcist-abilities": {
      "parentId": "feature.censor.level-6.6th-level-order-ability",
      "featureId": "0886-f03"
    },
    "feature.censor.level-6.oracle-abilities": {
      "parentId": "feature.censor.level-6.6th-level-order-ability",
      "featureId": "0886-f03"
    },
    "feature.censor.level-6.paragon-abilities": {
      "parentId": "feature.censor.level-6.6th-level-order-ability",
      "featureId": "0886-f03"
    },
    "feature.censor.level-7.characteristic-increase": {
      "featureId": "0887-f01"
    },
    "feature.censor.level-7.focused-wrath": {
      "featureId": "0887-f02"
    },
    "feature.censor.level-7.skill": {
      "featureId": "0887-f03"
    },
    "feature.censor.level-7.7th-level-domain-feature": {
      "featureId": "0887-f04"
    },
    "feature.censor.level-7.blessing-of-iron": {
      "parentId": "feature.censor.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Защита",
      "featureId": "0887-f04"
    },
    "feature.censor.level-7.covenant-of-the-heart": {
      "parentId": "feature.censor.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Любовь",
      "featureId": "0887-f04"
    },
    "feature.censor.level-7.divine-quartermaster": {
      "parentId": "feature.censor.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Созидание",
      "featureId": "0887-f04"
    },
    "feature.censor.level-7.font-of-grace": {
      "parentId": "feature.censor.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Жизнь",
      "featureId": "0887-f04"
    },
    "feature.censor.level-7.gods-library": {
      "parentId": "feature.censor.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Знание",
      "featureId": "0887-f04"
    },
    "feature.censor.level-7.light-of-the-burning-sun": {
      "parentId": "feature.censor.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Солнце",
      "featureId": "0887-f04"
    },
    "feature.censor.level-7.natures-bounty": {
      "parentId": "feature.censor.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Природа",
      "featureId": "0887-f04"
    },
    "feature.censor.level-7.ride-the-lightning": {
      "parentId": "feature.censor.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Буря",
      "featureId": "0887-f04"
    },
    "feature.censor.level-7.trinity-of-trickery": {
      "parentId": "feature.censor.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Хитрость",
      "featureId": "0887-f04"
    },
    "feature.censor.level-7.word-of-death-deferred": {
      "parentId": "feature.censor.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Смерть",
      "featureId": "0887-f04"
    },
    "feature.censor.level-7.word-of-fate-denied": {
      "parentId": "feature.censor.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Судьба",
      "featureId": "0887-f04"
    },
    "feature.censor.level-7.your-triumphs-are-remembered": {
      "parentId": "feature.censor.level-7.7th-level-domain-feature",
      "keyedBy": "domain",
      "keyValue": "Война",
      "featureId": "0887-f04"
    },
    "feature.censor.level-8.perk": {
      "featureId": "0888-f01"
    },
    "feature.censor.level-8.8th-level-order-feature": {
      "featureId": "0888-f02"
    },
    "feature.censor.level-8.demonologist": {
      "parentId": "feature.censor.level-8.8th-level-order-feature",
      "keyedBy": "order",
      "keyValue": "Экзорцист",
      "featureId": "0888-f02"
    },
    "feature.censor.level-8.their-past-revealed": {
      "parentId": "feature.censor.level-8.8th-level-order-feature",
      "keyedBy": "order",
      "keyValue": "Оракул",
      "featureId": "0888-f02"
    },
    "feature.censor.level-8.vow": {
      "parentId": "feature.censor.level-8.8th-level-order-feature",
      "keyedBy": "order",
      "keyValue": "Идеал",
      "featureId": "0888-f02"
    },
    "feature.censor.level-8.11-wrath-ability": {
      "featureId": "0888-f03"
    },
    "feature.censor.level-9.improved-implement-of-wrath": {
      "featureId": "0889-f01"
    },
    "feature.censor.level-9.9th-level-order-ability": {
      "featureId": "0889-f02"
    },
    "feature.censor.level-9.exorcist-abilities": {
      "parentId": "feature.censor.level-9.9th-level-order-ability",
      "featureId": "0889-f02"
    },
    "feature.censor.level-9.oracle-abilities": {
      "parentId": "feature.censor.level-9.9th-level-order-ability",
      "featureId": "0889-f02"
    },
    "feature.censor.level-9.paragon-abilities": {
      "parentId": "feature.censor.level-9.9th-level-order-ability",
      "featureId": "0889-f02"
    },
    "feature.censor.level-10.characteristic-increase": {
      "featureId": "0890-f01"
    },
    "feature.censor.level-10.perk": {
      "featureId": "0890-f02"
    },
    "feature.censor.level-10.skill": {
      "featureId": "0890-f03"
    },
    "feature.censor.level-10.templar": {
      "featureId": "0890-f04"
    },
    "feature.censor.level-10.virtue": {
      "featureId": "0890-f05"
    },
    "feature.censor.level-10.wrath-of-the-gods": {
      "featureId": "0890-f06"
    },
    "feature.elementalist.level-2.perk": {
      "featureId": "0892-f01"
    },
    "feature.elementalist.level-2.2nd-level-specialization-feature": {
      "featureId": "0892-f02"
    },
    "feature.elementalist.level-2.disciple-of-earth": {
      "parentId": "feature.elementalist.level-2.2nd-level-specialization-feature",
      "keyedBy": "specialization",
      "keyValue": "Земля",
      "featureId": "0892-f02"
    },
    "feature.elementalist.level-2.disciple-of-fire": {
      "parentId": "feature.elementalist.level-2.2nd-level-specialization-feature",
      "keyedBy": "specialization",
      "keyValue": "Огонь",
      "featureId": "0892-f02"
    },
    "feature.elementalist.level-2.disciple-of-the-green": {
      "parentId": "feature.elementalist.level-2.2nd-level-specialization-feature",
      "keyedBy": "specialization",
      "keyValue": "Зелень",
      "featureId": "0892-f02"
    },
    "feature.elementalist.level-2.there-is-no-space-between": {
      "parentId": "feature.elementalist.level-2.2nd-level-specialization-feature",
      "keyedBy": "specialization",
      "keyValue": "Пустота",
      "featureId": "0892-f02"
    },
    "feature.elementalist.level-2.new-5-essence-ability": {
      "featureId": "0892-f03"
    },
    "feature.elementalist.level-3.3rd-level-specialization-feature": {
      "featureId": "0893-f01"
    },
    "feature.elementalist.level-3.a-conversation-with-fire": {
      "parentId": "feature.elementalist.level-3.3rd-level-specialization-feature",
      "keyedBy": "specialization",
      "keyValue": "Огонь",
      "featureId": "0893-f01"
    },
    "feature.elementalist.level-3.distance-is-only-memory": {
      "parentId": "feature.elementalist.level-3.3rd-level-specialization-feature",
      "keyedBy": "specialization",
      "keyValue": "Пустота",
      "featureId": "0893-f01"
    },
    "feature.elementalist.level-3.earth-accepts-me": {
      "parentId": "feature.elementalist.level-3.3rd-level-specialization-feature",
      "keyedBy": "specialization",
      "keyValue": "Земля",
      "featureId": "0893-f01"
    },
    "feature.elementalist.level-3.remember-growth-and-sun-and-rain": {
      "parentId": "feature.elementalist.level-3.3rd-level-specialization-feature",
      "keyedBy": "specialization",
      "keyValue": "Зелень",
      "featureId": "0893-f01"
    },
    "feature.elementalist.level-3.7-essence-ability": {
      "featureId": "0893-f02"
    },
    "feature.elementalist.level-4.characteristic-increase": {
      "featureId": "0894-f01"
    },
    "feature.elementalist.level-4.font-of-essence": {
      "featureId": "0894-f02"
    },
    "feature.elementalist.level-4.mantle-of-essence": {
      "featureId": "0894-f03"
    },
    "feature.elementalist.level-4.burning-grounds": {
      "parentId": "feature.elementalist.level-4.mantle-of-essence",
      "keyedBy": "specialization",
      "keyValue": "Огонь",
      "featureId": "0894-f03"
    },
    "feature.elementalist.level-4.flowering-bed": {
      "parentId": "feature.elementalist.level-4.mantle-of-essence",
      "keyedBy": "specialization",
      "keyValue": "Зелень",
      "featureId": "0894-f03"
    },
    "feature.elementalist.level-4.quaking-earth": {
      "parentId": "feature.elementalist.level-4.mantle-of-essence",
      "keyedBy": "specialization",
      "keyValue": "Земля",
      "featureId": "0894-f03"
    },
    "feature.elementalist.level-4.veiling-bed": {
      "parentId": "feature.elementalist.level-4.mantle-of-essence",
      "keyedBy": "specialization",
      "keyValue": "Пустота",
      "featureId": "0894-f03"
    },
    "feature.elementalist.level-4.perk": {
      "featureId": "0894-f04"
    },
    "feature.elementalist.level-4.skill": {
      "featureId": "0894-f05"
    },
    "feature.elementalist.level-5.5th-level-specialization-feature": {
      "featureId": "0895-f01"
    },
    "feature.elementalist.level-5.hide-of-tenfold-shields": {
      "parentId": "feature.elementalist.level-5.5th-level-specialization-feature",
      "keyedBy": "specialization",
      "keyValue": "Зелень",
      "featureId": "0895-f01"
    },
    "feature.elementalist.level-5.the-mountain-does-not-move": {
      "parentId": "feature.elementalist.level-5.5th-level-specialization-feature",
      "keyedBy": "specialization",
      "keyValue": "Земля",
      "featureId": "0895-f01"
    },
    "feature.elementalist.level-5.pierce-the-veil-of-substance": {
      "parentId": "feature.elementalist.level-5.5th-level-specialization-feature",
      "keyedBy": "specialization",
      "keyValue": "Пустота",
      "featureId": "0895-f01"
    },
    "feature.elementalist.level-5.smoldering-step": {
      "parentId": "feature.elementalist.level-5.5th-level-specialization-feature",
      "keyedBy": "specialization",
      "keyValue": "Огонь",
      "featureId": "0895-f01"
    },
    "feature.elementalist.level-5.9-essence-ability": {
      "featureId": "0895-f02"
    },
    "feature.elementalist.level-6.perk": {
      "featureId": "0896-f01"
    },
    "feature.elementalist.level-6.wyrding": {
      "featureId": "0896-f02"
    },
    "feature.elementalist.level-6.new-9-essence-ability": {
      "featureId": "0896-f03"
    },
    "feature.elementalist.level-7.characteristic-increase": {
      "featureId": "0897-f01"
    },
    "feature.elementalist.level-7.mantle-of-quintessence": {
      "featureId": "0897-f02"
    },
    "feature.elementalist.level-7.surging-essence": {
      "featureId": "0897-f03"
    },
    "feature.elementalist.level-7.skill": {
      "featureId": "0897-f04"
    },
    "feature.elementalist.level-8.perk": {
      "featureId": "0898-f01"
    },
    "feature.elementalist.level-8.8th-level-specialization-feature": {
      "featureId": "0898-f02"
    },
    "feature.elementalist.level-8.black-hole-star": {
      "parentId": "feature.elementalist.level-8.8th-level-specialization-feature",
      "keyedBy": "specialization",
      "keyValue": "Пустота",
      "featureId": "0898-f02"
    },
    "feature.elementalist.level-8.chimeric-manifestation": {
      "parentId": "feature.elementalist.level-8.8th-level-specialization-feature",
      "keyedBy": "specialization",
      "keyValue": "Зелень",
      "featureId": "0898-f02"
    },
    "feature.elementalist.level-8.the-flame-primordial": {
      "parentId": "feature.elementalist.level-8.8th-level-specialization-feature",
      "keyedBy": "specialization",
      "keyValue": "Огонь",
      "featureId": "0898-f02"
    },
    "feature.elementalist.level-8.summon-source-of-earth": {
      "parentId": "feature.elementalist.level-8.8th-level-specialization-feature",
      "keyedBy": "specialization",
      "keyValue": "Земля",
      "featureId": "0898-f02"
    },
    "feature.elementalist.level-8.11-essence-ability": {
      "featureId": "0898-f03"
    },
    "feature.elementalist.level-9.grand-wyrding": {
      "featureId": "0899-9-f01"
    },
    "feature.elementalist.level-9.new-11-essence-ability": {
      "featureId": "0899-9-f02"
    },
    "feature.elementalist.level-10.breath": {
      "featureId": "0899-10-f01"
    },
    "feature.elementalist.level-10.characteristic-increase": {
      "featureId": "0899-10-f02"
    },
    "feature.elementalist.level-10.essential-being": {
      "featureId": "0899-10-f03"
    },
    "feature.elementalist.level-10.one": {
      "featureId": "0899-10-f04"
    },
    "feature.elementalist.level-10.master-of-earth": {
      "parentId": "feature.elementalist.level-10.one",
      "keyedBy": "specialization",
      "keyValue": "Земля",
      "featureId": "0899-10-f04"
    },
    "feature.elementalist.level-10.master-of-fire": {
      "parentId": "feature.elementalist.level-10.one",
      "keyedBy": "specialization",
      "keyValue": "Огонь",
      "featureId": "0899-10-f04"
    },
    "feature.elementalist.level-10.master-of-green": {
      "parentId": "feature.elementalist.level-10.one",
      "keyedBy": "specialization",
      "keyValue": "Зелень",
      "featureId": "0899-10-f04"
    },
    "feature.elementalist.level-10.master-of-void": {
      "parentId": "feature.elementalist.level-10.one",
      "keyedBy": "specialization",
      "keyValue": "Пустота",
      "featureId": "0899-10-f04"
    },
    "feature.elementalist.level-10.perk": {
      "featureId": "0899-10-f05"
    },
    "feature.elementalist.level-10.skill": {
      "featureId": "0899-10-f06"
    }
  }
) as const satisfies Record<string, ClassFeatureStructure>;

export const CLASS_FEATURE_STRUCTURE: Record<string, ClassFeatureStructure> =
  STRUCTURE;

export const CLASS_FEATURE_SYNTHETIC_ROWS: GeneratedClassFeature[] = [
  {
    id: "feature.fury.level-1.growing-ferocity-berserker-2",
    className: "Неистовый",
    level: 1,
    name: "Растущая свирепость Берсерка: 2",
    parentId: "feature.fury.level-1.growing-ferocity",
    keyValue: "2",
    articleId: "0801",
    description: "Всякий раз, когда вы используете маневр Отталкивания, расстояние принудительного движения получает бонус, равный показателю вашей Мощи.",
  },
  {
    id: "feature.fury.level-1.growing-ferocity-berserker-4",
    className: "Неистовый",
    level: 1,
    name: "Растущая свирепость Берсерка: 4",
    parentId: "feature.fury.level-1.growing-ferocity",
    keyValue: "4",
    articleId: "0801",
    description: "В первый раз, когда вы совершаете толчок существа в свой ход, вы получаете 1 всплеск.",
  },
  {
    id: "feature.fury.level-1.growing-ferocity-berserker-6",
    className: "Неистовый",
    level: 1,
    name: "Растущая свирепость Берсерка: 6",
    parentId: "feature.fury.level-1.growing-ferocity",
    keyValue: "6",
    articleId: "0801",
    description: "Вы получаете преимущество на тесты Мощи и маневр Отталкивания.",
  },
  {
    id: "feature.fury.level-4.growing-ferocity-berserker-8",
    className: "Неистовый",
    level: 4,
    name: "Растущая свирепость Берсерка: 8 (4-й уровень)",
    parentId: "feature.fury.level-1.growing-ferocity",
    keyValue: "8 (4-й уровень)",
    articleId: "0801",
    description: "В первый раз, когда вы совершаете толчок существа в свой ход, вы получаете 2 всплеска.",
  },
  {
    id: "feature.fury.level-7.growing-ferocity-berserker-10",
    className: "Неистовый",
    level: 7,
    name: "Растущая свирепость Берсерка: 10 (7-й уровень)",
    parentId: "feature.fury.level-1.growing-ferocity",
    keyValue: "10 (7-й уровень)",
    articleId: "0801",
    description: "Вы получаете двойное преимущество на тесты Мощи и маневр Отталкивания.",
  },
  {
    id: "feature.fury.level-10.growing-ferocity-berserker-12",
    className: "Неистовый",
    level: 10,
    name: "Растущая свирепость Берсерка: 12 (10-й уровень)",
    parentId: "feature.fury.level-1.growing-ferocity",
    keyValue: "12 (10-й уровень)",
    articleId: "0801",
    description: "Всякий раз, когда вы используете героическую способность, вы получаете 10 очков временной выносливости. Дополнительно, всякий раз, когда вы делаете бросок силы, который накладывает принудительное движение на цель, расстояние принудительного движения получает бонус, равный показателю вашей Мощи.",
  },
  {
    id: "feature.fury.level-1.growing-ferocity-reaver-2",
    className: "Неистовый",
    level: 1,
    name: "Растущая свирепость Разорителя: 2",
    parentId: "feature.fury.level-1.growing-ferocity",
    keyValue: "2",
    articleId: "0801",
    description: "Всякий раз, когда вы используете маневр Отталкивания, расстояние принудительного движения получает бонус, равный показателю вашей Ловкости.",
  },
  {
    id: "feature.fury.level-1.growing-ferocity-reaver-4",
    className: "Неистовый",
    level: 1,
    name: "Растущая свирепость Разорителя: 4",
    parentId: "feature.fury.level-1.growing-ferocity",
    keyValue: "4",
    articleId: "0801",
    description: "В первый раз, когда вы совершаете швыряние существа в свой ход, вы получаете 1 всплеск.",
  },
  {
    id: "feature.fury.level-1.growing-ferocity-reaver-6",
    className: "Неистовый",
    level: 1,
    name: "Растущая свирепость Разорителя: 6",
    parentId: "feature.fury.level-1.growing-ferocity",
    keyValue: "6",
    articleId: "0801",
    description: "Вы получаете преимущество на тесты Ловкости и маневр Отталкивания.",
  },
  {
    id: "feature.fury.level-4.growing-ferocity-reaver-8",
    className: "Неистовый",
    level: 4,
    name: "Растущая свирепость Разорителя: 8 (4-й уровень)",
    parentId: "feature.fury.level-1.growing-ferocity",
    keyValue: "8 (4-й уровень)",
    articleId: "0801",
    description: "В первый раз, когда вы совершаете швыряние существа в свой ход, вы получаете 2 всплеска.",
  },
  {
    id: "feature.fury.level-7.growing-ferocity-reaver-10",
    className: "Неистовый",
    level: 7,
    name: "Растущая свирепость Разорителя: 10 (7-й уровень)",
    parentId: "feature.fury.level-1.growing-ferocity",
    keyValue: "10 (7-й уровень)",
    articleId: "0801",
    description: "Вы получаете двойное преимущество на тесты Ловкости и маневр Отталкивания.",
  },
  {
    id: "feature.fury.level-10.growing-ferocity-reaver-12",
    className: "Неистовый",
    level: 10,
    name: "Растущая свирепость Разорителя: 12 (10-й уровень)",
    parentId: "feature.fury.level-1.growing-ferocity",
    keyValue: "12 (10-й уровень)",
    articleId: "0801",
    description: "Всякий раз, когда вы используете героическую способность, вы получаете 10 очков временной выносливости. Дополнительно, всякий раз, когда вы делаете бросок силы, который накладывает принудительное движение на цель, расстояние принудительного движения получает бонус, равный показателю вашей Ловкости.",
  },
  {
    id: "feature.ability.fury.level-1.lines-of-force",
    className: "Неистовый",
    level: 1,
    name: "Линии силы",
    parentId: "feature.fury.level-1.aspect-triggered-action",
    keyedBy: "aspect",
    keyValue: "Берсерк",
    articleId: "0801",
    description: "*Вы перенаправляете энергию движения.*\n\n| **Магия, Ближний** | **Триггер** |\n| ---------------- | --------------------------: |\n| **📏 Ближний 1** | **🎯 На себя или одно существо** |\n\n**Триггер:** Цель должна подвергнуться принудительному движению.\n\n**Эффект:** Вы можете выбрать новую цель того же размера или меньше в пределах расстояния, которая подвергнется принудительному движению вместо первоначальной. Вы становитесь источником принудительного движения, определяете место назначения новой цели и можете совершить толчок цели вместо использования первоначального типа принудительного движения. Дополнительно, расстояние принудительного движения получает бонус, равный показателю вашей Мощи.\n\n**Потратить 1 свирепости:** Вместо этого расстояние принудительного движения получает бонус, равный двукратному показателю вашей Мощи.",
  },
  {
    id: "feature.ability.fury.level-1.unearthly-reflexes",
    className: "Неистовый",
    level: 1,
    name: "Неземные рефлексы",
    parentId: "feature.fury.level-1.aspect-triggered-action",
    keyedBy: "aspect",
    keyValue: "Разоритель",
    articleId: "0801",
    description: "*Вы неуловимы, как колибри.*\n\n| **-** | **Триггер** |\n| ----------- | ------------: |\n| **📏 На себя** | **🎯 На себя** |\n\n**Триггер:** Вы получаете урон.\n\n**Эффект:** Вы получаете половину урона от срабатывающего эффекта и можете сместиться на количество клеток вплоть до показателя вашей Ловкости.\n\n**Потратить 1 свирепости:** Если урон имеет какие-либо эффекты потенциала, связанные с ним, потенциал уменьшается на 1 для вас.",
  },
  {
    id: "feature.ability.fury.level-1.furious-change",
    className: "Неистовый",
    level: 1,
    name: "Яростное изменение",
    parentId: "feature.fury.level-1.aspect-triggered-action",
    keyedBy: "aspect",
    keyValue: "Буревестник",
    articleId: "0801",
    description: "*В гневе вы возвращаетесь в более звериную форму.*\n\n| **-** | **Триггер** |\n| ----------- | ------------: |\n| **📏 На себя** | **🎯 На себя** |\n\n**Триггер:** Вы теряете выносливость и не находитесь при смерти.\n\n**Эффект:** Вы получаете очки временной выносливости, равные показателю вашей Мощи, и можете войти в форму животного или форму гибрида.\n\n**Потратить 1 свирепости:** Если вы не находитесь при смерти, вы можете потратить Восстановление.",
  },
  {
    id: "feature.null.level-1.chronokinetic-mastery-2",
    className: "Нуль",
    level: 1,
    name: "Мастерство хронокинетика: 2",
    parentId: "feature.null.level-1.chronokinetic-mastery",
    keyValue: "2",
    articleId: "0811",
    description: "Всякий раз, когда вы используете маневр Отталкивания, вы можете использовать Действие отхода как свободный триггер либо до, либо после маневра.",
  },
  {
    id: "feature.null.level-1.chronokinetic-mastery-4",
    className: "Нуль",
    level: 1,
    name: "Мастерство хронокинетика: 4",
    parentId: "feature.null.level-1.chronokinetic-mastery",
    keyValue: "4",
    articleId: "0811",
    description: "В первый раз за ход, когда вы добровольно перемещаетесь на 1 или более клеток как часть способности, вы получаете 1 всплеск.",
  },
  {
    id: "feature.null.level-1.chronokinetic-mastery-6",
    className: "Нуль",
    level: 1,
    name: "Мастерство хронокинетика: 6",
    parentId: "feature.null.level-1.chronokinetic-mastery",
    keyValue: "6",
    articleId: "0811",
    description: "Вы получаете преимущество на маневры Захвата и Отталкивания.",
  },
  {
    id: "feature.null.level-4.chronokinetic-mastery-8",
    className: "Нуль",
    level: 4,
    name: "Мастерство хронокинетика: 8 (4-й уровень)",
    parentId: "feature.null.level-1.chronokinetic-mastery",
    keyValue: "8 (4-й уровень)",
    articleId: "0811",
    description: "В первый раз за ход, когда вы добровольно перемещаетесь на 1 или более клеток как часть способности, вы получаете 2 всплеска.",
  },
  {
    id: "feature.null.level-7.chronokinetic-mastery-10",
    className: "Нуль",
    level: 7,
    name: "Мастерство хронокинетика: 10 (7-й уровень)",
    parentId: "feature.null.level-1.chronokinetic-mastery",
    keyValue: "10 (7-й уровень)",
    articleId: "0811",
    description: "Вы получаете двойное преимущество на маневры Захвата и Отталкивания.",
  },
  {
    id: "feature.null.level-10.chronokinetic-mastery-12",
    className: "Нуль",
    level: 10,
    name: "Мастерство хронокинетика: 12 (10-й уровень)",
    parentId: "feature.null.level-1.chronokinetic-mastery",
    keyValue: "12 (10-й уровень)",
    articleId: "0811",
    description: "Всякий раз, когда вы подвергаете цель принудительному движению, расстояние принудительного движения получает бонус, равный показателю вашей Интуиции. Дополнительно, всякий раз, когда вы используете героическую способность, вы получаете 10 очков временной выносливости.",
  },
  {
    id: "feature.null.level-1.cryokinetic-mastery-2",
    className: "Нуль",
    level: 1,
    name: "Мастерство криокинетика: 2",
    parentId: "feature.null.level-1.cryokinetic-mastery",
    keyValue: "2",
    articleId: "0811",
    description: "Всякий раз, когда вы используете маневр Отталкивания, вы можете нацелиться на одно дополнительное существо. Дополнительно, всякий раз, когда вы наносите нетиповой урон псионической способностью, вы можете изменить его на урон холодом.",
  },
  {
    id: "feature.null.level-1.cryokinetic-mastery-4",
    className: "Нуль",
    level: 1,
    name: "Мастерство криокинетика: 4",
    parentId: "feature.null.level-1.cryokinetic-mastery",
    keyValue: "4",
    articleId: "0811",
    description: "В первый раз за ход, когда вы делаете существо схваченным или враг перемещается на 1 или более клеток в области вашей способности Поле нуля, вы получаете 1 всплеск.",
  },
  {
    id: "feature.null.level-1.cryokinetic-mastery-6",
    className: "Нуль",
    level: 1,
    name: "Мастерство криокинетика: 6",
    parentId: "feature.null.level-1.cryokinetic-mastery",
    keyValue: "6",
    articleId: "0811",
    description: "Вы получаете преимущество на маневры Захвата и Отталкивания.",
  },
  {
    id: "feature.null.level-4.cryokinetic-mastery-8",
    className: "Нуль",
    level: 4,
    name: "Мастерство криокинетика: 8 (4-й уровень)",
    parentId: "feature.null.level-1.cryokinetic-mastery",
    keyValue: "8 (4-й уровень)",
    articleId: "0811",
    description: "В первый раз за ход, когда вы делаете существо схваченным или враг перемещается на 1 или более клеток в области вашей способности Поле нуля, вы получаете 2 всплеска.",
  },
  {
    id: "feature.null.level-7.cryokinetic-mastery-10",
    className: "Нуль",
    level: 7,
    name: "Мастерство криокинетика: 10 (7-й уровень)",
    parentId: "feature.null.level-1.cryokinetic-mastery",
    keyValue: "10 (7-й уровень)",
    articleId: "0811",
    description: "Вы получаете двойное преимущество на маневры Захвата и Отталкивания.",
  },
  {
    id: "feature.null.level-10.cryokinetic-mastery-12",
    className: "Нуль",
    level: 10,
    name: "Мастерство криокинетика: 12 (10-й уровень)",
    parentId: "feature.null.level-1.cryokinetic-mastery",
    keyValue: "12 (10-й уровень)",
    articleId: "0811",
    description: "Всякий раз, когда вы подвергаете цель принудительному движению, расстояние принудительного движения получает бонус, равный показателю вашей Интуиции. Дополнительно, всякий раз, когда вы используете героическую способность, вы получаете 10 очков временной выносливости.",
  },
  {
    id: "feature.null.level-1.metakinetic-mastery-2",
    className: "Нуль",
    level: 1,
    name: "Мастерство метакинетика: 2",
    parentId: "feature.null.level-1.metakinetic-mastery",
    keyValue: "2",
    articleId: "0811",
    description: "Всякий раз, когда вы используете маневр Отталкивания, расстояние принудительного движения получает бонус, равный показателю вашей Интуиции.",
  },
  {
    id: "feature.null.level-1.metakinetic-mastery-4",
    className: "Нуль",
    level: 1,
    name: "Мастерство метакинетика: 4",
    parentId: "feature.null.level-1.metakinetic-mastery",
    keyValue: "4",
    articleId: "0811",
    description: "В первый раз в раунде боя, когда вы получаете урон или подвергаетесь принудительному движению, вы получаете 1 всплеск, даже если вы сопротивляетесь эффекту.",
  },
  {
    id: "feature.null.level-1.metakinetic-mastery-6",
    className: "Нуль",
    level: 1,
    name: "Мастерство метакинетика: 6",
    parentId: "feature.null.level-1.metakinetic-mastery",
    keyValue: "6",
    articleId: "0811",
    description: "Вы получаете преимущество на маневры Захвата и Отталкивания.",
  },
  {
    id: "feature.null.level-4.metakinetic-mastery-8",
    className: "Нуль",
    level: 4,
    name: "Мастерство метакинетика: 8 (4-й уровень)",
    parentId: "feature.null.level-1.metakinetic-mastery",
    keyValue: "8 (4-й уровень)",
    articleId: "0811",
    description: "В первый раз в раунде боя, когда вы получаете урон или подвергаетесь принудительному движению, вы получаете 2 всплеска, даже если вы сопротивляетесь эффекту.",
  },
  {
    id: "feature.null.level-7.metakinetic-mastery-10",
    className: "Нуль",
    level: 7,
    name: "Мастерство метакинетика: 10 (7-й уровень)",
    parentId: "feature.null.level-1.metakinetic-mastery",
    keyValue: "10 (7-й уровень)",
    articleId: "0811",
    description: "Вы получаете двойное преимущество на маневры Захвата и Отталкивания.",
  },
  {
    id: "feature.null.level-10.metakinetic-mastery-12",
    className: "Нуль",
    level: 10,
    name: "Мастерство метакинетика: 12 (10-й уровень)",
    parentId: "feature.null.level-1.metakinetic-mastery",
    keyValue: "12 (10-й уровень)",
    articleId: "0811",
    description: "Всякий раз, когда вы подвергаете цель принудительному движению, расстояние принудительного движения получает бонус, равный показателю вашей Интуиции. Дополнительно, всякий раз, когда вы используете героическую способность, вы получаете 10 очков временной выносливости.",
  },
  {
    id: "feature.ability.tactician.level-1.advanced-tactics",
    className: "Тактик",
    level: 1,
    name: "Продвинутая тактика",
    parentId: "feature.tactician.level-1.doctrine-triggered-action",
    keyedBy: "doctrine",
    keyValue: "Повстанец",
    articleId: "0841",
    description: "*Ваше лидерство помогает союзнику.*\n\n| **Дальний** | **Триггер** |\n| ---------------- | --------------: |\n| **📏 Дальний 10** | **🎯 Один союзник** |\n\n**Триггер:** Цель наносит урон другому существу.\n\n**Эффект:** Цель получает 2 всплеска, которые она может использовать на вызвавший триггер урон.\n\n**Потратить 1 Фокуса:** Если урон имеет какой-либо эффект потенциала, связанный с ним, потенциал увеличивается на 1.",
  },
  {
    id: "feature.ability.tactician.level-1.overwatch",
    className: "Тактик",
    level: 1,
    name: "Прикрытие",
    parentId: "feature.tactician.level-1.doctrine-triggered-action",
    keyedBy: "doctrine",
    keyValue: "Воевода",
    articleId: "0841",
    description: "*Под вашим руководством союзник ждет подходящего момента для удара.*\n\n| **Дальний** | **Триггер** |\n| ---------------- | ------------------: |\n| **📏 Дальний 10** | **🎯 Одно существо** |\n\n**Триггер:** Цель перемещается.\n\n**Эффект:** В любое время во время движения цели, один союзник может нанести по ней свободный удар.\n\n**Потратить 1 Фокуса:** Если цель имеет Р < СРЕДНИЙ, она замедлена (КсХ).",
  },
  {
    id: "feature.ability.tactician.level-1.parry",
    className: "Тактик",
    level: 1,
    name: "Парирование",
    parentId: "feature.tactician.level-1.doctrine-triggered-action",
    keyedBy: "doctrine",
    keyValue: "Авангард",
    articleId: "0841",
    description: "*Ваши быстрые рефлексы лишают врага той точности, к которой он стремится.*\n\n| **Ближний, Оружие** | **Триггер** |\n| ----------------- | ----------------------: |\n| **📏 Ближний 2** | **🎯 На себя или один союзник** |\n\n**Триггер:** Существо наносит урон цели.\n\n**Эффект:** Вы можете сместиться на 1 клетку. Если цель — это вы, или если вы заканчиваете это смещение смежно с целью, цель получает половину урона. Если урон имеет какой-либо эффект потенциала, связанный с ним, потенциал уменьшается на 1.\n\n**Потратить 1 Фокуса:** Расстояние этой способности становится Ближний 1 + ваш показатель Разума, и вы можете сместиться вплоть до числа клеток, равного вашему показателю Разума, вместо 1 клетки.",
  },
  {
    id: "feature.ability.shadow.level-1.in-all-this-confusion",
    className: "Тень",
    level: 1,
    name: "Во всей этой неразберихе",
    parentId: "feature.shadow.level-1.college-triggered-action",
    keyedBy: "college",
    keyValue: "Черный Пепел",
    articleId: "0861",
    description: "*Вы исчезаете в облаке черного дыма, чтобы избежать опасности.*\n\n| **Магия** | **Триггер** |\n| ----------- | ------------: |\n| **📏 На себя** | **🎯 На себя** |\n\n**Триггер:** Вы получаете урон.\n\n**Эффект:** Вы получаете половину урона, затем можете телепортироваться вплоть до 4 клеток после того, как вызвавший триггер эффект разрешится.\n\n**Потратить 1+ Прозрения:** Вы телепортируетесь на 1 дополнительную клетку за каждое потраченное прозрение.",
  },
  {
    id: "feature.ability.shadow.level-1.defensive-roll",
    className: "Тень",
    level: 1,
    name: "Защитный перекат",
    parentId: "feature.shadow.level-1.college-triggered-action",
    keyedBy: "college",
    keyValue: "Едкая Алхимия",
    articleId: "0861",
    description: "*Когда враг атакует, вы перекатываетесь вместе с ударом, чтобы уменьшить урон.*\n\n| **-** | **Триггер** |\n| ----------- | ------------: |\n| **📏 На себя** | **🎯 На себя** |\n\n**Триггер:** Другое существо наносит вам урон.\n\n**Эффект:** Вы получаете половину вызвавшего триггер урона, затем можете сместиться вплоть до 2 клеток после того, как вызвавший триггер эффект разрешится. Если вы заканчиваете это смещение с покровом или укрытием, вы можете использовать маневр Скрытности, даже если за вами наблюдают.\n\n**Потратить 1 Прозрения:** Потенциал любых эффектов, связанных с уроном, уменьшается на 1 для вас.",
  },
  {
    id: "feature.ability.shadow.level-1.clever-trick",
    className: "Тень",
    level: 1,
    name: "Умный трюк",
    parentId: "feature.shadow.level-1.college-triggered-action",
    keyedBy: "college",
    keyValue: "Маска Арлекина",
    articleId: "0861",
    description: "*Вы сеете мгновение замешательства в бою, приближаяя ваших врагов к погибели.*\n\n| **Магия** | **Триггер** |\n| ----------- | ------------: |\n| **📏 На себя** | **🎯 На себя** |\n\n**Триггер:** Враг нацеливается на вас ударом.\n\n**Эффект:** Выберите врага в пределах расстояния вызвавшего триггер удара, включая врага, который нацелился на вас. Удар вместо этого нацеливается на этого врага.",
  },
  {
    id: "feature.ability.troubadour.level-1.turnabout-is-fair-play",
    className: "Трубадур",
    level: 1,
    name: "Око за око",
    parentId: "feature.troubadour.level-1.class-act-triggered-action",
    keyedBy: "troupe",
    keyValue: "Автор",
    articleId: "0871",
    description: "*В любви и на войне все средства хороши.*\n\n| **Дальний** |       **Триггер** |\n| ---------------- | ------------------: |\n| **📏 Дальний 10** | **🎯 Одно существо** |\n\n**Триггер:** Цель делает бросок способности, который имеет преимущество, двойное преимущество, помеху или двойную помеху.\n\n**Эффект:** Преимущество на вызвавший триггер бросок становится помехой, или двойное преимущество становится преимуществом. Помеха становится преимуществом, или двойная помеха становится помехой.\n\n**Потратить 3 Драмы:** Преимущество на вызвавший триггер бросок становится двойной помехой, или двойное преимущество нивелируется. Помеха становится двойным преимуществом, или двойная помеха нивелируется.",
  },
  {
    id: "feature.ability.troubadour.level-1.riposte",
    className: "Трубадур",
    level: 1,
    name: "Рипост",
    parentId: "feature.troubadour.level-1.class-act-triggered-action",
    keyedBy: "troupe",
    keyValue: "Дуэлянт",
    articleId: "0871",
    description: "*\"Я бы прихватил вкусняшек, если бы знал, что буду драться с псом.\"*\n\n| **Ближний** |           **Триггер** |\n| -------------- | ----------------------: |\n| **📏 Ближний 1** | **🎯 На себя или один союзник** |\n\n**Триггер:** Цель получает урон от удара ближнего боя.\n\n**Эффект:** Цель делает свободный удар против существа, нанесшего вызвавший триггер удар.",
  },
  {
    id: "feature.ability.troubadour.level-1.harmonize",
    className: "Трубадур",
    level: 1,
    name: "Гармонизация",
    parentId: "feature.troubadour.level-1.class-act-triggered-action",
    keyedBy: "troupe",
    keyValue: "Виртуоз",
    articleId: "0871",
    description: "*Добавьте хору немного энергии.*\n\n| **Дальний** |   **Триггер** |\n| --------------- | --------------: |\n| **📏 Дальний 5** | **🎯 Один союзник** |\n\n**Триггер:** Цель использует способность, которая нацелена только на одного врага и стоит 3 или меньше ее героического ресурса.\n\n**Эффект:** Цель может выбрать одну дополнительную цель для вызвавшей триггер способности. Любой урон, нанесенный дополнительной цели, является уроном звуком.\n\n**Потратить 1+ Драмы:** Вы можете применить эту способность, когда цель использует способность, стоимость которой составляет 3 + каждая дополнительно потраченная драма героического ресурса.",
  },
  {
    id: "feature.ability.elementalist.level-1.skin-like-castle-walls",
    className: "Элементалист",
    level: 1,
    name: "Кожа как стены замка",
    parentId: "feature.elementalist.level-1.specialization-triggered-action",
    keyedBy: "specialization",
    keyValue: "Земля",
    articleId: "0891",
    description: "*Вы покрываете себя или союзника защитным камнем.*\n\n| **Земля, Магия, Дальний** |           **Триггер** |\n| ------------------------ | ----------------------: |\n| **📏 Дальний 10** | **🎯 На себя или один союзник** |\n\n**Триггер:** Цель получает урон.\n\n**Эффект:** Цель получает половину урона.\n\n**Потратить 1 Эссенцию:** Если с уроном связан какой-либо эффект потенциала, его потенциал уменьшается на 1 для цели.",
  },
  {
    id: "feature.ability.elementalist.level-1.explosive-assistance",
    className: "Элементалист",
    level: 1,
    name: "Взрывная помощь",
    parentId: "feature.elementalist.level-1.specialization-triggered-action",
    keyedBy: "specialization",
    keyValue: "Огонь",
    articleId: "0891",
    description: "*Вы добавляете немного магии в агрессию союзника в самый подходящий момент.*\n\n| **Огонь, Магия, Дальний** |           **Триггер** |\n| ----------------------- | ----------------------: |\n| **📏 Дальний 10** | **🎯 На себя или один союзник** |\n\n**Триггер:** Цель принудительно перемещает существо или объект.\n\n**Эффект:** Расстояние принудительного движения получает бонус, равный показателю вашего Разума.\n\n**Потратить 1 Эссенцию:** Расстояние принудительного движения получает бонус, равный двойному показателю вашего Разума.",
  },
  {
    id: "feature.ability.elementalist.level-1.breath-of-dawn-remembered",
    className: "Элементалист",
    level: 1,
    name: "Воспоминание о дыхании рассвета",
    parentId: "feature.elementalist.level-1.specialization-triggered-action",
    keyedBy: "specialization",
    keyValue: "Зелень",
    articleId: "0891",
    description: "*Направляемая вами сила дает возможность вернуться в бой.*\n\n| **Зелень, Магия, Дальний** |           **Триггер** |\n| ------------------------ | ----------------------: |\n| **📏 Дальний 10** | **🎯 На себя или один союзник** |\n\n**Триггер:** Цель начинает свой ход или получает урон.\n\n**Эффект:** Цель может потратить Восстановление.\n\n**Потратить 1+ Эссенции:** Цель может потратить дополнительное Восстановление за каждую потраченную эссенцию.",
  },
  {
    id: "feature.ability.elementalist.level-1.subtle-relocation",
    className: "Элементалист",
    level: 1,
    name: "Незаметное перемещение",
    parentId: "feature.elementalist.level-1.specialization-triggered-action",
    keyedBy: "specialization",
    keyValue: "Пустота",
    articleId: "0891",
    description: "*Вы призываете пустоту, чтобы поглотить и выплюнуть союзника.*\n\n| **Магия, Дальний, Пустота** |           **Триггер** |\n| ----------------------- | ----------------------: |\n| **📏 Дальний 10** | **🎯 На себя или один союзник** |\n\n**Триггер:** Цель начинает свой ход, перемещается или подвергается принудительному движению.\n\n**Эффект:** Вы телепортируете цель на количество клеток вплоть до показателя вашего Разума. Если цель перемещается, чтобы активировать эту способность, вы можете телепортировать ее в любой момент во время перемещения.\n\n**Потратить 1 Эссенцию:** Вы телепортируете цель на количество клеток вплоть до двойного показателя вашего Разума.",
  },
  {
    id: "feature.ability.conduit.level-2.statue-of-power",
    className: "Проводник",
    level: 2,
    name: "Статуя силы",
    parentId: "feature.conduit.level-2.2nd-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Созидание",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Мраморная статуя вашего божества восстает из земли.*\n\n| **Магия, Дальний** |   **Маневр** |\n| ----------------- | -------------: |\n| **📏 Дальний 10** | **🎯 Особая** |\n\n**Эффект:** Статуя размера 2 вырастает из земли на свободной клетке в пределах расстояния и остается до конца встречи. Находясь в пределах 3 клеток от статуи, вы получаете 1 всплеск в начале каждого вашего хода. Каждый союзник в пределах 3 клеток от статуи получает такое же преимущество. Статуя уничтожается, если она получает 20 или более урона. Она имеет иммунитет ко всему яду и психическому урону.",
  },
  {
    id: "feature.ability.conduit.level-2.reap",
    className: "Проводник",
    level: 2,
    name: "Жатва",
    parentId: "feature.conduit.level-2.2nd-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Смерть",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Боги вознаграждают тех, кто сокрушает их врагов.*\n\n| **Магия, Дальний** |     **Маневр** |\n| ----------------- | ---------------: |\n| **📏 Дальний 10** | **🎯 Каждый союзник** |\n\n**Эффект:** До начала вашего следующего хода, каждый раз, когда цель убивает врага, она восстанавливает Выносливость, равную 5 + показатель вашей Интуиции.",
  },
  {
    id: "feature.ability.conduit.level-2.blessing-of-fate-and-destiny",
    className: "Проводник",
    level: 2,
    name: "Благословение рока и судьбы",
    parentId: "feature.conduit.level-2.2nd-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Судьба",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Ваши враги терпят свой рок; ваши союзники принимают свою судьбу!*\n\n| **Магия, Дальний** |        **Основное действие** |\n| ----------------- | ---------------------: |\n| **📏 Дальний 10** | **🎯 Три существа** |\n\n**Эффект:** Вы можете выбрать себя вместо одного существа для этой способности. Выберите один из следующих эффектов, который длится до конца встречи или пока вы не окажетесь при смерти:\n\n- Всякий раз, когда цель делает бросок силы, она может бросить три кубика и выбрать, какие два результата использовать.\n- Всякий раз, когда цель делает бросок силы, она должна бросить три кубика и использовать два самых низких результата.",
  },
  {
    id: "feature.ability.conduit.level-2.the-gods-command-you-obey",
    className: "Проводник",
    level: 2,
    name: "Боги повелевают вам повиноваться",
    parentId: "feature.conduit.level-2.2nd-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Знание",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Вы говорите голосом своего святого, командуя врагами.*\n\n| **Магия, Дальний, Удар** |     **Основное действие** |\n| ------------------------- | ------------------: |\n| **📏 Дальний 10** | **🎯 Одно существо** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 4 + И святого урона; П < СЛАБЫЙ, перед получением урона цель совершает свободный удар по выбранной вами цели\n- **12-16:** 7 + И святого урона; П < СРЕДНИЙ, перед получением урона цель использует способность по вашему выбору, и вы выбираете любые цели для этой способности\n- **17+:** 11 + И святого урона; П < СИЛЬНЫЙ, перед получением урона цель смещается вплоть до своей скорости в выбранное вами место, использует способность по вашему выбору, и вы выбираете любые цели для этой способности",
  },
  {
    id: "feature.ability.conduit.level-2.wellspring-of-grace",
    className: "Проводник",
    level: 2,
    name: "Источник благодати",
    parentId: "feature.conduit.level-2.2nd-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Жизнь",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Святой свет исходит от вашего тела, исцеляя союзников.*\n\n| **Область, Магия** |              **Основное действие** |\n| --------------- | ---------------------------: |\n| **📏 Аура 3** | **🎯 Каждый союзник в области** |\n\n**Эффект:** До конца встречи или пока вы не окажетесь при смерти, всякий раз, когда цель начинает свой ход в области, она может потратить Восстановление.",
  },
  {
    id: "feature.ability.conduit.level-2.our-hearts-your-strength",
    className: "Проводник",
    level: 2,
    name: "Наши сердца — ваша сила",
    parentId: "feature.conduit.level-2.2nd-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Любовь",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Союзник черпает силу от своих друзей.*\n\n| **Магия, Дальний** |             **Маневр** |\n| ----------------- | -----------------------: |\n| **📏 Дальний 10** | **🎯 На себя и один союзник** |\n\n**Эффект:** До конца встречи или пока цель не окажется при смерти, в начале каждого своего хода цель получает бонус к скорости и бонус к выброшенному урону, равный количеству союзников в пределах 10 клеток от нее. Этот бонус длится до начала ее следующего хода.",
  },
  {
    id: "feature.ability.conduit.level-2.nature-judges-thee",
    className: "Проводник",
    level: 2,
    name: "Природа судит тебя",
    parentId: "feature.conduit.level-2.2nd-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Природа",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Мистические колючие лозы появляются по вашему приказу и сковывают врагов.*\n\n| **Область, Магия, Дальний** |               **Основное действие** |\n| ----------------------- | ----------------------------: |\n| **📏 Куб 3 в пределах 10** | **🎯 Каждый враг в области** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 2 урона; Л < СЛАБЫЙ, опутанность (до прох.)\n- **12-16:** 3 урона; Л < СРЕДНИЙ, опутанность (до прох.)\n- **17+:** 7 урона; Л < СИЛЬНЫЙ, опутанность (до прох.)",
  },
  {
    id: "feature.ability.conduit.level-2.sacred-bond",
    className: "Проводник",
    level: 2,
    name: "Священные узы",
    parentId: "feature.conduit.level-2.2nd-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Защита",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Вы создаете божественную связь между двумя существами.*\n\n| **Магия, Дальний** |             **Маневр** |\n| ----------------- | -----------------------: |\n| **📏 Дальний 10** | **🎯 На себя и один союзник** |\n\n**Эффект:** До конца встречи, всякий раз, когда одна из целей получает урон, другая цель может использовать свободный триггер, чтобы получить этот урон вместо нее. Первоначальная цель страдает от любых эффектов, связанных с уроном. Дополнительно, всякий раз, когда одна из целей тратит Восстановление, другая цель может использовать свободный триггер, чтобы потратить Восстановление.",
  },
  {
    id: "feature.ability.conduit.level-2.saints-tempest",
    className: "Проводник",
    level: 2,
    name: "Буря святого",
    parentId: "feature.conduit.level-2.2nd-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Буря",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Появляется бушующий шторм, поражая врагов молнией и разбрасывая их ветром.*\n\n| **Область, Магия, Дальний** |               **Основное действие** |\n| ----------------------- | ----------------------------: |\n| **📏 Куб 3 в пределах 10** | **🎯 Каждый враг в области** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 2 урона молнией; вертикальное швыряние 1\n- **12-16:** 5 урона молнией; вертикальное швыряние 2\n- **17+:** 7 урона молнией; вертикальное швыряние 3",
  },
  {
    id: "feature.ability.conduit.level-2.morning-light",
    className: "Проводник",
    level: 2,
    name: "Утренний свет",
    parentId: "feature.conduit.level-2.2nd-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Солнце",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Свет сияет по вашей команде, обжигая врагов и благословляя союзников.*\n\n| **Область, Магия** |               **Основное действие** |\n| --------------- | ----------------------------: |\n| **📏 Взрыв 3** | **🎯 Каждый враг в области** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 4 урона огнем\n- **12-16:** 6 урона огнем\n- **17+:** 10 урона огнем\n\n**Эффект:** Каждый союзник в области наносит урон огнем, равный показателю вашей Интуиции, своим следующим ударом, сделанным до конца своего следующего хода.",
  },
  {
    id: "feature.ability.conduit.level-2.divine-comedy",
    className: "Проводник",
    level: 2,
    name: "Божественная комедия",
    parentId: "feature.conduit.level-2.2nd-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Хитрость",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Вы и ваши союзники меняетесь местами, чтобы сбить с толку врагов.*\n\n| **Область, Магия** |                          **Маневр** |\n| --------------- | ------------------------------------: |\n| **📏 Взрыв 5** | **🎯 На себя и каждый союзник в области** |\n\n**Эффект:** Каждая цель может выбрать другое существо в области, а затем поменяться с ним местами. Выбранное ею существо должно помещаться в оставленном ею пространстве, и наоборот.",
  },
  {
    id: "feature.ability.conduit.level-2.blessing-of-insight",
    className: "Проводник",
    level: 2,
    name: "Благословение прозрения",
    parentId: "feature.conduit.level-2.2nd-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Война",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Боги даруют прозрение, открывая, куда лучше всего бить врагов.*\n\n| **Магия, Дальний** |              **Маневр** |\n| ----------------- | ------------------------: |\n| **📏 Дальний 10** | **🎯 На себя и каждый союзник** |\n\n**Эффект:** До конца встречи или пока вы не окажетесь при смерти, каждая цель получает 1 всплеск в конце каждого вашего хода.",
  },
  {
    id: "feature.ability.conduit.level-6.gods-machine",
    className: "Проводник",
    level: 6,
    name: "Машина Богов",
    parentId: "feature.conduit.level-6.6th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Созидание",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*Вы призываете жужжащий танк, сделанный из лезвий и металла.*\n\n| **Магия, Дальний** | **Основное действие** |\n| ----------------- | --------------- |\n| **📏 Дальний 10** | **🎯 Особая** |\n\n**Эффект:** Вы призываете катящуюся машину размера 2, которая появляется на свободной клетке в пределах расстояния. Машина имеет Выносливость 50 и иммунитет ко всему яду и психическому урону. Она исчезает в конце встречи, если ее Выносливость падает до 0, или если вы находитесь при смерти. Когда машина появляется впервые, сделайте следующий бросок силы один раз, нацеливая его на каждого врага, смежного с ней.\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 3 урона\n- **12-16:** 5 урона\n- **17+:** 8 урона\n\nОдин раз на каждом последующем ходу вы можете использовать свободный маневр, чтобы переместить машину на количество клеток вплоть до вашей Интуиции, а затем повторить бросок силы.",
  },
  {
    id: "feature.ability.conduit.level-6.aura-of-souls",
    className: "Проводник",
    level: 6,
    name: "Аура душ",
    parentId: "feature.conduit.level-6.6th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Смерть",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*Вихрь душ умерших летает вокруг вас по вашей команде.*\n\n| **Область, Магия** |                     **Маневр** |\n| --------------- | -------------------------------: |\n| **📏 Аура 4** | **🎯 Каждое существо в области** |\n\n**Эффект:** До конца встречи или пока вы не окажетесь при смерти, в конце каждого вашего хода вы можете совершить швыряние каждого существа в области вплоть до числа клеток, равного показателю вашей Интуиции. Это принудительное движение игнорирует устойчивость для ваших союзников.",
  },
  {
    id: "feature.ability.conduit.level-6.your-story-ends-here",
    className: "Проводник",
    level: 6,
    name: "Твоя история заканчивается здесь",
    parentId: "feature.conduit.level-6.6th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Судьба",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*Вы искривляете судьбу врага, желая ему смерти.*\n\n| **Магия, Дальний, Удар** |     **Основное действие** |\n| ------------------------- | ------------------: |\n| **📏 Дальний 10** | **🎯 Одно существо** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 9 + И урона порчей; Р < СЛАБЫЙ, ослабление (до прох.)\n- **12-16:** 14 + И урона порчей; Р < СРЕДНИЙ, ослабление (до прох.)\n- **17+:** 19 + И урона порчей; Р < СИЛЬНЫЙ, ослабление (до прох.)\n\n**Эффект:** Если этот урон убивает цель, вы и каждый союзник в пределах расстояния можете потратить Восстановление.",
  },
  {
    id: "feature.ability.conduit.level-6.invocation-of-undoing",
    className: "Проводник",
    level: 6,
    name: "Призыв разрушения",
    parentId: "feature.conduit.level-6.6th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Знание",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*Вы произносите тайное слово разрушения, известное лишь божествам.*\n\n| **Область, Магия** |               **Основное действие** |\n| --------------- | ----------------------------: |\n| **📏 Взрыв 4** | **🎯 Каждый враг в области** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 3 урона звуком; толчок 3\n- **12-16:** 6 урона звуком; толчок 5\n- **17+:** 9 урона звуком; толчок 7\n\n**Особое:** Вы можете выбрать, чтобы эта способность наносила урон и толкала объекты, а также наносила урон строениям.",
  },
  {
    id: "feature.ability.conduit.level-6.revitalizing-grace",
    className: "Проводник",
    level: 6,
    name: "Восстанавливающая благодать",
    parentId: "feature.conduit.level-6.6th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Жизнь",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*Жестом вы восстанавливаете свое здоровье и здоровье ваших союзников.*\n\n| **Область, Магия** |                       **Основное действие** |\n| --------------- | ------------------------------------: |\n| **📏 Взрыв 4** | **🎯 На себя и каждый союзник в области** |\n\n**Эффект:** Каждая цель может потратить любое количество Восстановлений. Дополнительно, каждая цель может завершить один эффект на себе, который заканчивается спасброском или который заканчивается в конце ее хода, или она может встать, если лежит.",
  },
  {
    id: "feature.ability.conduit.level-6.lauded-by-god",
    className: "Проводник",
    level: 6,
    name: "Восхваленный Богом",
    parentId: "feature.conduit.level-6.6th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Любовь",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*Вы умоляете богов дать вашим союзникам то, что им нужно для победы в этот день, и боги отвечают.*\n\n| **Магия, Дальний** |      **Маневр** |\n| ----------------- | ----------------: |\n| **📏 Дальний 10** | **🎯 Два союзника** |\n\n**Эффект:** Каждая цель получает 3 своего Героического Ресурса.",
  },
  {
    id: "feature.ability.conduit.level-6.spirit-stampede",
    className: "Проводник",
    level: 6,
    name: "Натиск духов",
    parentId: "feature.conduit.level-6.6th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Природа",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*Духи животных проносятся по полю боя, топча ваших врагов.*\n\n| **Область, Магия, Дальний** |               **Основное действие** |\n| --------------------------- | ----------------------------: |\n| **📏 Линия 10 x 2 в пределах 5** | **🎯 Каждый враг в области** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 5 урона; М < СЛАБЫЙ, лежачий и не может встать (до прох.)\n- **12-16:** 8 урона; М < СРЕДНИЙ, лежачий и не может встать (до прох.)\n- **17+:** 11 урона; М < СИЛЬНЫЙ, лежачий и не может встать (до прох.)",
  },
  {
    id: "feature.ability.conduit.level-6.cuirass-of-the-gods",
    className: "Проводник",
    level: 6,
    name: "Кираса Богов",
    parentId: "feature.conduit.level-6.6th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Защита",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*Ваши союзники покрываются духовной броней.*\n\n| **Область, Магия, Дальний** |           **Маневр** |\n| ----------------------- | ---------------------: |\n| **📏 Дальний 10** | **🎯 Три существа** |\n\n**Эффект:** Вы можете выбрать себя вместо одного существа для этой способности. Каждая цель имеет иммунитет к урону 5 до начала вашего следующего хода.",
  },
  {
    id: "feature.ability.conduit.level-6.lightning-lord",
    className: "Проводник",
    level: 6,
    name: "Повелитель молний",
    parentId: "feature.conduit.level-6.6th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Буря",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*Молнии вырываются из вашего тела в разных направлениях.*\n\n| **Область, Магия** |               **Основное действие** |\n| ---------------------------------- | ----------------------------: |\n| **📏 Три линии 10 x 1 в пределах 1** | **🎯 Каждый враг в области** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 6 урона молнией; толчок 1\n- **12-16:** 9 урона молнией; толчок 2\n- **17+:** 13 урона молнией; толчок 3\n\n**Эффект:** Цели подвергаются принудительному движению по одной, начиная с ближайшей к вам цели, и могут быть оттолкнуты в других целей в той же линии.",
  },
  {
    id: "feature.ability.conduit.level-6.blessing-of-the-midday-sun",
    className: "Проводник",
    level: 6,
    name: "Благословение полуденного солнца",
    parentId: "feature.conduit.level-6.6th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Солнце",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*Ваше тело излучает тепло, которое поджаривает врагов и вдохновляет союзников.*\n\n| **Область, Магия** |                              **Маневр** |\n| --------------- | ----------------------------------------: |\n| **📏 Аура 4** | **🎯 На себя и каждое существо в области** |\n\n**Эффект:** До конца встречи или пока вы не окажетесь при смерти, каждый враг в области получает помеху на броски силы, а вы и каждый союзник в области получаете 1 всплеск в конце каждого вашего хода.",
  },
  {
    id: "feature.ability.conduit.level-6.invocation-of-mystery",
    className: "Проводник",
    level: 6,
    name: "Призыв тайны",
    parentId: "feature.conduit.level-6.6th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Хитрость",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*\"А теперь вы нас видите...\"*\n\n| **Область, Магия** |                          **Маневр** |\n| --------------- | ------------------------------------: |\n| **📏 Взрыв 4** | **🎯 На себя и каждый союзник в области** |\n\n**Эффект:** Каждая цель невидима до начала вашего следующего хода.",
  },
  {
    id: "feature.ability.conduit.level-6.blade-of-the-heavens",
    className: "Проводник",
    level: 6,
    name: "Клинок небес",
    parentId: "feature.conduit.level-6.6th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Война",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*С небес спускается огромный двуручный меч, угрожая пригвоздить вашего врага.*\n\n| **Магия, Дальний, Удар** |     **Основное действие** |\n| ------------------------- | ------------------: |\n| **📏 Дальний 5** | **🎯 Одно существо** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 8 + И урона; Л < СЛАБЫЙ, лежачий и опутанность (до прох.)\n- **12-16:** 12 + И урона; Л < СРЕДНИЙ, лежачий и опутанность (до прох.)\n- **17+:** 16 + И урона; Л < СИЛЬНЫЙ, лежачий и опутанность (до прох.)",
  },
  {
    id: "feature.ability.conduit.level-9.divine-dragon",
    className: "Проводник",
    level: 9,
    name: "Божественный дракон",
    parentId: "feature.conduit.level-9.9th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Созидание",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Одной лишь божественной волей вы создаете могущественного союзника.*\n\n| **Магия, Дальний** | **Основное действие** |\n| ----------------- | --------------: |\n| **📏 Дальний 10** |  **🎯 Особая** |\n\n**Эффект:** Вы призываете дракона размера 4, который появляется на свободной клетке в пределах расстояния. Дракон имеет скорость 6 и может летать, устойчивость 4, Выносливость 100, иммунитет ко всему урону огнем и использует ваши характеристики. Дракон исчезает в конце встречи, если его Выносливость падает до 0, или если вы находитесь при смерти.\n\nНа последующих ходах вы можете использовать основное действие, чтобы приказать дракону дохнуть магическим огнем в кубе 3 в пределах 1 клетки от него. Сделайте следующий бросок силы, нацеливая его на каждого врага в области.\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 5 урона огнем\n- **12-16:** 9 урона огнем\n- **17+:** 12 урона огнем\n\nДополнительно, вы можете использовать маневр, чтобы переместить дракона вплоть до его скорости, или сделать удар оружием ближнего боя его когтем по смежному существу или объекту. Дракон также может сделать этот удар как свободный удар.\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 3 + И урона\n- **12-16:** 5 + И урона\n- **17+:** 8 + И урона",
  },
  {
    id: "feature.ability.conduit.level-9.word-of-final-redemption",
    className: "Проводник",
    level: 9,
    name: "Слово окончательного искупления",
    parentId: "feature.conduit.level-9.9th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Смерть",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Твоя смерть послужит нашей победе.*\n\n| **Магия, Дальний** |  **Свободный триггер** |\n| ----------------- | ------------------: |\n| **📏 Дальний 10** | **🎯 Одно существо** |\n\n**Триггер:** Цель умирает.\n\n**Эффект:** Прежде чем цель умрет, вы можете посмотреть ее блок статов и заставить ее использовать одну способность, которая является основным действием или маневром. Если способность стоит Героического Ресурса или Раздора, существо может использовать ее без каких-либо затрат. Для цели использования этой способности ваши союзники и враги являются союзниками и врагами цели, и вы решаете, на кого нацелена способность.",
  },
  {
    id: "feature.ability.conduit.level-9.bend-fate",
    className: "Проводник",
    level: 9,
    name: "Искривление судьбы",
    parentId: "feature.conduit.level-9.9th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Судьба",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Боги знают, что вы должны победить, и они благословляют вашу судьбу.*\n\n| **Магия, Дальний** |         **Основное действие** |\n| ----------------- | ----------------------: |\n| **📏 Дальний 10** | **🎯 На себя или один союзник** |\n\n**Эффект:** До конца встречи или пока вы не окажетесь при смерти, каждый бросок силы цели улучшает свой результат на один тир.",
  },
  {
    id: "feature.ability.conduit.level-9.word-of-weakening",
    className: "Проводник",
    level: 9,
    name: "Слово ослабления",
    parentId: "feature.conduit.level-9.9th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Знание",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Вы произносите божественное слово, которое делает врага хрупким.*\n\n| **Магия, Дальний, Удар** |               **Основное действие** |\n| ------------------------- | ----------------------------: |\n| **📏 Дальний 10** | **🎯 Одно существо или объект** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 10 + И урона порчей; Л < СЛАБЫЙ, ослабление (до прох.)\n- **12-16:** 15 + И урона порчей; Л < СРЕДНИЙ, ослабление (до прох.)\n- **17+:** 21 + И урона порчей; Л < СИЛЬНЫЙ, ослабление (до прох.)\n\n**Эффект:** Будучи ослабленной таким образом, цель имеет уязвимость к урону 10.",
  },
  {
    id: "feature.ability.conduit.level-9.radiance-of-grace",
    className: "Проводник",
    level: 9,
    name: "Сияние благодати",
    parentId: "feature.conduit.level-9.9th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Жизнь",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Интенсивный свет излучается из вашего тела, исцеляя ваших союзников.*\n\n| **Магия, Дальний** |    **Основное действие** |\n| ----------------- | -----------------: |\n| **📏 Дальний 10** | **🎯 Четыре союзника** |\n\n**Эффект:** Вы можете выбрать себя вместо одного союзника для этой способности. Каждая цель может потратить любое количество Восстановлений, может завершить любые эффекты на себе, которые заканчиваются спасброском или которые заканчиваются в конце ее хода, и может встать, если лежит.",
  },
  {
    id: "feature.ability.conduit.level-9.alacrity-of-the-heart",
    className: "Проводник",
    level: 9,
    name: "Живость сердца",
    parentId: "feature.conduit.level-9.9th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Любовь",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Вы произносите вдохновляющие слова другу и побуждаете его на невероятные подвиги.*\n\n| **Магия, Дальний** |    **Маневр** |\n| ----------------- | --------------: |\n| **📏 Дальний 10** | **🎯 Один союзник** |\n\n**Эффект:** Цель получает дополнительное основное действие, которое она может использовать в свой следующий ход, и получает 3 очка своего Героического Ресурса.",
  },
  {
    id: "feature.ability.conduit.level-9.thorn-cage",
    className: "Проводник",
    level: 9,
    name: "Шипастая клетка",
    parentId: "feature.conduit.level-9.9th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Природа",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Лозы вырываются из-под земли и сковывают вашего врага, медленно смыкаясь вокруг него.*\n\n| **Магия, Дальний, Удар** |     **Основное действие** |\n| ------------------------- | ------------------: |\n| **📏 Дальний 10** | **🎯 Одно существо** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 10 + И урона; Л < СЛАБЫЙ, опутанность (до прох.)\n- **12-16:** 15 + И урона; Л < СРЕДНИЙ, опутанность (до прох.)\n- **17+:** 21 + И урона; Л < СИЛЬНЫЙ, опутанность (до прох.)\n\n**Эффект:** Находясь в состоянии опутанности таким образом, цель получает 10 урона в начале каждого вашего хода.",
  },
  {
    id: "feature.ability.conduit.level-9.blessing-of-the-fortress",
    className: "Проводник",
    level: 9,
    name: "Благословение крепости",
    parentId: "feature.conduit.level-9.9th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Защита",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Магический круг расходится от вас, не позволяя врагам подойти близко.*\n\n| **Область, Магия** | **Маневр** |\n| ---------------------- | -----------: |\n| **📏 На себя; смотрите ниже** |  **🎯 На себя** |\n\n**Эффект:** До конца встречи или пока вы не окажетесь при смерти, ни один враг не может приблизиться на расстояние 5 клеток от вас, перемещаясь или подвергаясь принудительному движению со стороны любого врага. Цели могут быть принудительно перемещены ближе к вам вами или вашими союзниками, или могут оказаться ближе из-за вашего перемещения.",
  },
  {
    id: "feature.ability.conduit.level-9.godstorm",
    className: "Проводник",
    level: 9,
    name: "Божественный шторм",
    parentId: "feature.conduit.level-9.9th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Буря",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Вы призываете божественный шторм, который остается под вашим контролем.*\n\n| **Область, Магия, Дальний** |               **Основное действие** |\n| ----------------------- | ----------------------------: |\n| **📏 Куб 5 в пределах 5** | **🎯 Каждый враг в области** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 2 урона молнией, 2 урона звуком\n- **12-16:** 3 урона молнией, 3 урона звуком\n- **17+:** 5 урона молнией, 5 урона звуком\n\n**Эффект:** Бушующий шторм заполняет область до конца встречи или пока вы не окажетесь при смерти. В начале каждого вашего хода вы можете перемещать шторм на расстояние вплоть до 5 клеток (действие не требуется). На последующих ходах, пока шторм активен, вы можете использовать маневр, чтобы сделать его бросок силы.",
  },
  {
    id: "feature.ability.conduit.level-9.solar-flare",
    className: "Проводник",
    level: 9,
    name: "Солнечная вспышка",
    parentId: "feature.conduit.level-9.9th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Солнце",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Вы призываете сферу огня, которая сжигает ваших врагов дотла.*\n\n| **Область, Магия, Дальний** |               **Основное действие** |\n| ----------------------- | ----------------------------: |\n| **📏 Куб 5 в пределах 10** | **🎯 Каждый враг в области** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 9 урона огнем\n- **12-16:** 14 урона огнем\n- **17+:** 19 урона огнем",
  },
  {
    id: "feature.ability.conduit.level-9.night-falls",
    className: "Проводник",
    level: 9,
    name: "Наступает ночь",
    parentId: "feature.conduit.level-9.9th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Хитрость",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Вы призываете тьму, которая мешает только вашим врагам.*\n\n| **Область, Магия, Дальний** | **Основное действие** |\n| ----------------------- | --------------: |\n| **📏 Куб 5 в пределах 10** |  **🎯 Особая** |\n\n**Эффект:** До конца встречи или пока вы не окажетесь при смерти, область заполняется магической тьмой, через которую не могут видеть ваши враги, но вы и ваши союзники можете.",
  },
  {
    id: "feature.ability.conduit.level-9.righteous-phalanx",
    className: "Проводник",
    level: 9,
    name: "Праведная фаланга",
    parentId: "feature.conduit.level-9.9th-level-domain-ability",
    keyedBy: "domain",
    keyValue: "Война",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Стена из вращающихся мечей и ножей появляется там, где вы пожелаете.*\n\n| **Область, Магия, Дальний** | **Основное действие** |\n| ------------------------ | --------------: |\n| **📏 Стена 15 в пределах 10** |  **🎯 Особая** |\n\n**Эффект:** Стена остается до конца встречи или пока вы не окажетесь при смерти, и может быть размещена на занятых клетках. Существа могут входить и проходить сквозь стену. Каждый враг, который входит в область в первый раз за раунд боя или начинает там свой ход, получает 15 урона.",
  },
];
