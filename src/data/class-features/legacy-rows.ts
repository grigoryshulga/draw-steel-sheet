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
    "fury.feature.1.svirepost-v-boyu": {
      "parentId": "fury.feature.1.svirepost"
    },
    "fury.feature.1.svirepost-vne-boya": {
      "parentId": "fury.feature.1.svirepost"
    },
    "fury.aspect.1.forma-zverya": {
      "parentId": "fury.feature.1.osobennosti-aspekta-1-go-urovnya",
      "keyedBy": "aspect",
      "keyValue": "Буревестник"
    },
    "fury.aspect.1.komplekt": {
      "parentId": "fury.feature.1.osobennosti-aspekta-1-go-urovnya",
      "keyedBy": "aspect",
      "keyValue": "Берсерк, Разоритель"
    },
    "fury.aspect.1.pervozdannaya-khitrost": {
      "parentId": "fury.feature.1.osobennosti-aspekta-1-go-urovnya",
      "keyedBy": "aspect",
      "keyValue": "Разоритель"
    },
    "fury.aspect.1.pervozdannaya-sila": {
      "parentId": "fury.feature.1.osobennosti-aspekta-1-go-urovnya",
      "keyedBy": "aspect",
      "keyValue": "Берсерк"
    },
    "fury.aspect.1.bezzhalostnyy-okhotnik": {
      "parentId": "fury.feature.1.osobennosti-aspekta-1-go-urovnya",
      "keyedBy": "aspect",
      "keyValue": "Буревестник"
    },
    "fury.feature.1.znakovaya-sposobnost": {
      "parentId": "fury.feature.1.sposobnosti-neistovogo"
    },
    "fury.feature.1.geroicheskie-sposobnosti": {
      "parentId": "fury.feature.1.sposobnosti-neistovogo"
    },
    "fury.feature.1.sposobnost-za-3-svireposti": {
      "parentId": "fury.feature.1.geroicheskie-sposobnosti"
    },
    "fury.feature.1.sposobnost-za-5-svireposti": {
      "parentId": "fury.feature.1.geroicheskie-sposobnosti"
    },
    "null.feature.1.distsiplina-v-boyu": {
      "parentId": "null.feature.1.distsiplina"
    },
    "null.feature.1.distsiplina-vne-boya": {
      "parentId": "null.feature.1.distsiplina"
    },
    "null.feature.1.masterstvo-khronokinetika": {
      "parentId": "null.feature.1.masterstvo-distsipliny"
    },
    "null.feature.1.masterstvo-kriokinetika": {
      "parentId": "null.feature.1.masterstvo-distsipliny"
    },
    "null.feature.1.masterstvo-metakinetika": {
      "parentId": "null.feature.1.masterstvo-distsipliny"
    },
    "null.feature.1.augmentatsiya-plotnosti-density-augmentation": {
      "parentId": "null.feature.1.psionicheskaya-augmentatsiya"
    },
    "null.feature.1.augmentatsiya-sily-force-augmentation": {
      "parentId": "null.feature.1.psionicheskaya-augmentatsiya"
    },
    "null.feature.1.augmentatsiya-skorosti-speed-augmentation": {
      "parentId": "null.feature.1.psionicheskaya-augmentatsiya"
    },
    "null.feature.1.znakovye-sposobnosti": {
      "parentId": "null.feature.1.sposobnosti-nulya"
    },
    "null.feature.1.geroicheskie-sposobnosti": {
      "parentId": "null.feature.1.sposobnosti-nulya"
    },
    "null.feature.1.sposobnost-za-3-distsipliny": {
      "parentId": "null.feature.1.geroicheskie-sposobnosti"
    },
    "null.feature.1.sposobnost-za-5-distsipliny": {
      "parentId": "null.feature.1.geroicheskie-sposobnosti"
    },
    "conduit.feature.1.blagochestie-v-boyu": {
      "parentId": "conduit.feature.1.blagochestie"
    },
    "conduit.feature.1.blagochestie-vne-boya": {
      "parentId": "conduit.feature.1.blagochestie"
    },
    "conduit.feature.1.blagochestie-i-effekt-domena-sozidaniya": {
      "parentId": "conduit.feature.1.blagochestie-i-effekty-domena"
    },
    "conduit.feature.1.blagochestie-i-effekt-domena-smerti": {
      "parentId": "conduit.feature.1.blagochestie-i-effekty-domena"
    },
    "conduit.feature.1.blagochestie-i-effekt-domena-sudby": {
      "parentId": "conduit.feature.1.blagochestie-i-effekty-domena"
    },
    "conduit.feature.1.blagochestie-i-effekt-domena-znaniya": {
      "parentId": "conduit.feature.1.blagochestie-i-effekty-domena"
    },
    "conduit.feature.1.blagochestie-i-effekt-domena-zhizni": {
      "parentId": "conduit.feature.1.blagochestie-i-effekty-domena"
    },
    "conduit.feature.1.blagochestie-i-effekt-domena-lyubvi": {
      "parentId": "conduit.feature.1.blagochestie-i-effekty-domena"
    },
    "conduit.feature.1.blagochestie-i-effekt-domena-prirody": {
      "parentId": "conduit.feature.1.blagochestie-i-effekty-domena"
    },
    "conduit.feature.1.blagochestie-i-effekt-domena-zashchity": {
      "parentId": "conduit.feature.1.blagochestie-i-effekty-domena"
    },
    "conduit.feature.1.blagochestie-i-effekt-domena-buri": {
      "parentId": "conduit.feature.1.blagochestie-i-effekty-domena"
    },
    "conduit.feature.1.blagochestie-i-effekt-domena-solntsa": {
      "parentId": "conduit.feature.1.blagochestie-i-effekty-domena"
    },
    "conduit.feature.1.blagochestie-i-effekt-domena-khitrosti": {
      "parentId": "conduit.feature.1.blagochestie-i-effekty-domena"
    },
    "conduit.feature.1.blagochestie-i-effekt-domena-voyny": {
      "parentId": "conduit.feature.1.blagochestie-i-effekty-domena"
    },
    "conduit.domain.1.blagoslovenie-sostradaniya": {
      "parentId": "conduit.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Любовь"
    },
    "conduit.domain.1.blagoslovenie-ponimaniya": {
      "parentId": "conduit.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Знание"
    },
    "conduit.domain.1.blagoslovenie-udachnoy-pogody": {
      "parentId": "conduit.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Буря"
    },
    "conduit.domain.1.vernyy-drug": {
      "parentId": "conduit.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Природа"
    },
    "conduit.domain.1.mogilnaya-rech": {
      "parentId": "conduit.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Смерть"
    },
    "conduit.domain.1.ruki-tvortsa": {
      "parentId": "conduit.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Созидание"
    },
    "conduit.domain.1.vnutrenniy-svet": {
      "parentId": "conduit.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Солнце"
    },
    "conduit.domain.1.vdokhnovennyy-obman": {
      "parentId": "conduit.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Хитрость"
    },
    "conduit.domain.1.videniya-orakula": {
      "parentId": "conduit.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Судьба"
    },
    "conduit.domain.1.zashchitnyy-krug": {
      "parentId": "conduit.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Защита"
    },
    "conduit.domain.1.vosstanavlivayushchiy-ritual": {
      "parentId": "conduit.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Жизнь"
    },
    "conduit.domain.1.osvyashchennoe-oruzhie": {
      "parentId": "conduit.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Война"
    },
    "conduit.feature.1.molitva-o-razrushenii": {
      "parentId": "conduit.feature.1.molitva"
    },
    "conduit.feature.1.molitva-o-distantsii": {
      "parentId": "conduit.feature.1.molitva"
    },
    "conduit.feature.1.molitva-o-masterstve-soldata": {
      "parentId": "conduit.feature.1.molitva"
    },
    "conduit.feature.1.molitva-o-skorosti": {
      "parentId": "conduit.feature.1.molitva"
    },
    "conduit.feature.1.molitva-o-stali": {
      "parentId": "conduit.feature.1.molitva"
    },
    "conduit.feature.1.obereg-bastiona": {
      "parentId": "conduit.feature.1.obereg-provodnika"
    },
    "conduit.feature.1.obereg-reaktsii": {
      "parentId": "conduit.feature.1.obereg-provodnika"
    },
    "conduit.feature.1.obereg-svyatilishcha": {
      "parentId": "conduit.feature.1.obereg-provodnika"
    },
    "conduit.feature.1.obereg-dukhov": {
      "parentId": "conduit.feature.1.obereg-provodnika"
    },
    "conduit.feature.1.znakovye-sposobnosti": {
      "parentId": "conduit.feature.1.sposobnosti-provodnika"
    },
    "conduit.feature.1.geroicheskie-sposobnosti": {
      "parentId": "conduit.feature.1.sposobnosti-provodnika"
    },
    "conduit.feature.1.sposobnost-za-3-blagochestiya": {
      "parentId": "conduit.feature.1.geroicheskie-sposobnosti"
    },
    "conduit.feature.1.sposobnost-za-5-blagochestiya": {
      "parentId": "conduit.feature.1.geroicheskie-sposobnosti"
    },
    "tactician.feature.1.fokus-v-boyu": {
      "parentId": "tactician.feature.1.fokus"
    },
    "tactician.feature.1.fokus-vne-boya": {
      "parentId": "tactician.feature.1.fokus"
    },
    "tactician.doctrine.1.komandirskoe-prisutstvie": {
      "parentId": "tactician.feature.1.osobennost-doktriny-1-go-urovnya",
      "keyedBy": "doctrine",
      "keyValue": "Авангард"
    },
    "tactician.doctrine.1.sekretnye-operatsii": {
      "parentId": "tactician.feature.1.osobennost-doktriny-1-go-urovnya",
      "keyedBy": "doctrine",
      "keyValue": "Повстанец"
    },
    "tactician.doctrine.1.obrazovannyy-komandir": {
      "parentId": "tactician.feature.1.osobennost-doktriny-1-go-urovnya",
      "keyedBy": "doctrine",
      "keyValue": "Воевода"
    },
    "tactician.feature.1.znakovaya-sposobnost-komplekta": {
      "parentId": "tactician.feature.1.sposobnosti-taktika"
    },
    "tactician.feature.1.geroicheskie-sposobnosti": {
      "parentId": "tactician.feature.1.sposobnosti-taktika"
    },
    "tactician.feature.1.sposobnost-za-3-fokusa": {
      "parentId": "tactician.feature.1.sposobnosti-taktika"
    },
    "tactician.feature.1.sposobnost-za-5-fokusa": {
      "parentId": "tactician.feature.1.sposobnosti-taktika"
    },
    "talent.feature.1.yasnost-v-boyu": {
      "parentId": "talent.feature.1.yasnost-i-vozbuzhdennost"
    },
    "talent.feature.1.yasnost-vne-boya": {
      "parentId": "talent.feature.1.yasnost-i-vozbuzhdennost"
    },
    "talent.feature.1.boevaya-augmentatsiya": {
      "parentId": "talent.feature.1.psionicheskaya-augmentatsiya"
    },
    "talent.feature.1.augmentatsiya-plotnosti": {
      "parentId": "talent.feature.1.psionicheskaya-augmentatsiya"
    },
    "talent.feature.1.augmentatsiya-distantsii": {
      "parentId": "talent.feature.1.psionicheskaya-augmentatsiya"
    },
    "talent.feature.1.augmentatsiya-sily": {
      "parentId": "talent.feature.1.psionicheskaya-augmentatsiya"
    },
    "talent.feature.1.augmentatsiya-skorosti": {
      "parentId": "talent.feature.1.psionicheskaya-augmentatsiya"
    },
    "talent.feature.1.obereg-entropii": {
      "parentId": "talent.feature.1.obereg-talanta"
    },
    "talent.feature.1.ottalkivayushchiy-obereg": {
      "parentId": "talent.feature.1.obereg-talanta"
    },
    "talent.feature.1.stalnoy-obereg": {
      "parentId": "talent.feature.1.obereg-talanta"
    },
    "talent.feature.1.ischezayushchiy-obereg": {
      "parentId": "talent.feature.1.obereg-talanta"
    },
    "talent.tradition.1.uskorenie": {
      "parentId": "talent.feature.1.osobennosti-traditsii-1-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Хронопатия"
    },
    "talent.tradition.1.snova": {
      "parentId": "talent.feature.1.osobennosti-traditsii-1-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Хронопатия"
    },
    "talent.tradition.1.petlya-obratnoy-svyazi": {
      "parentId": "talent.feature.1.osobennosti-traditsii-1-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Телепатия"
    },
    "talent.tradition.1.malyy-telekinez": {
      "parentId": "talent.feature.1.osobennosti-traditsii-1-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Телекинез"
    },
    "talent.tradition.1.udalennaya-pomoshch": {
      "parentId": "talent.feature.1.osobennosti-traditsii-1-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Телепатия"
    },
    "talent.tradition.1.otrazhenie": {
      "parentId": "talent.feature.1.osobennosti-traditsii-1-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Телекинез"
    },
    "talent.feature.1.znakovye-sposobnosti": {
      "parentId": "talent.feature.1.sposobnosti-talanta"
    },
    "talent.feature.1.geroicheskie-sposobnosti": {
      "parentId": "talent.feature.1.sposobnosti-talanta"
    },
    "talent.feature.1.sposobnost-za-3-yasnosti": {
      "parentId": "talent.feature.1.geroicheskie-sposobnosti"
    },
    "talent.feature.1.sposobnost-za-5-yasnosti": {
      "parentId": "talent.feature.1.geroicheskie-sposobnosti"
    },
    "shadow.feature.1.prozrenie-v-boyu": {
      "parentId": "shadow.feature.1.prozrenie"
    },
    "shadow.feature.1.prozrenie-vne-boya": {
      "parentId": "shadow.feature.1.prozrenie"
    },
    "shadow.college.1.teleportatsiya-chernogo-pepla": {
      "parentId": "shadow.feature.1.osobennosti-kollegii-1-go-urovnya",
      "keyedBy": "college",
      "keyValue": "Черный Пепел"
    },
    "shadow.college.1.smazat-klinok": {
      "parentId": "shadow.feature.1.osobennosti-kollegii-1-go-urovnya",
      "keyedBy": "college",
      "keyValue": "Едкая Алхимия"
    },
    "shadow.college.1.ya-ne-ugroza": {
      "parentId": "shadow.feature.1.osobennosti-kollegii-1-go-urovnya",
      "keyedBy": "college",
      "keyValue": "Маска Арлекина"
    },
    "shadow.college.1.dymovaya-bomba": {
      "parentId": "shadow.feature.1.osobennosti-kollegii-1-go-urovnya",
      "keyedBy": "college",
      "keyValue": "Едкая Алхимия"
    },
    "shadow.feature.1.znakovaya-sposobnost": {
      "parentId": "shadow.feature.1.sposobnosti-teni"
    },
    "shadow.feature.1.geroicheskie-sposobnosti": {
      "parentId": "shadow.feature.1.sposobnosti-teni"
    },
    "shadow.feature.1.sposobnost-za-3-prozreniya": {
      "parentId": "shadow.feature.1.geroicheskie-sposobnosti"
    },
    "shadow.feature.1.sposobnost-za-5-prozreniya": {
      "parentId": "shadow.feature.1.sposobnosti-teni"
    },
    "troubadour.feature.1.drama-v-boyu": {
      "parentId": "troubadour.feature.1.drama"
    },
    "troubadour.feature.1.drama-vne-boya": {
      "parentId": "troubadour.feature.1.drama"
    },
    "troubadour.troupe.1.akrobatika": {
      "parentId": "troubadour.feature.1.osobennosti-amplua-1-go-urovnya",
      "keyedBy": "troupe",
      "keyValue": "Дуэлянт"
    },
    "troubadour.troupe.1.mizanstsena": {
      "parentId": "troubadour.feature.1.osobennosti-amplua-1-go-urovnya",
      "keyedBy": "troupe",
      "keyValue": "Автор"
    },
    "troubadour.troupe.1.dramaticheskiy-monolog": {
      "parentId": "troubadour.feature.1.osobennosti-amplua-1-go-urovnya",
      "keyedBy": "troupe",
      "keyValue": "Автор"
    },
    "troubadour.troupe.1.moshchnyy-akkord": {
      "parentId": "troubadour.feature.1.osobennosti-amplua-1-go-urovnya",
      "keyedBy": "troupe",
      "keyValue": "Виртуоз"
    },
    "troubadour.troupe.1.zvezdnaya-sila": {
      "parentId": "troubadour.feature.1.osobennosti-amplua-1-go-urovnya",
      "keyedBy": "troupe",
      "keyValue": "Дуэлянт"
    },
    "troubadour.troupe.1.vystupleniya-virtuoza": {
      "parentId": "troubadour.feature.1.osobennosti-amplua-1-go-urovnya",
      "keyedBy": "troupe",
      "keyValue": "Виртуоз"
    },
    "troubadour.feature.1.znakovaya-sposobnost": {
      "parentId": "troubadour.feature.1.sposobnosti-trubadura"
    },
    "troubadour.feature.1.geroicheskie-sposobnosti": {
      "parentId": "troubadour.feature.1.sposobnosti-trubadura"
    },
    "troubadour.feature.1.sposobnost-za-3-dramy": {
      "parentId": "troubadour.feature.1.geroicheskie-sposobnosti"
    },
    "troubadour.feature.1.sposobnost-za-5-dramy": {
      "parentId": "troubadour.feature.1.geroicheskie-sposobnosti"
    },
    "censor.feature.1.gnev-v-boyu": {
      "parentId": "censor.feature.1.gnev"
    },
    "censor.feature.1.gnev-vne-boya": {
      "parentId": "censor.feature.1.gnev"
    },
    "censor.feature.1.preimushchestvo-ordena-dlya-suda": {
      "parentId": "censor.feature.1.sud"
    },
    "censor.domain.1.blagoslovenie-sostradaniya": {
      "parentId": "censor.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Любовь"
    },
    "censor.domain.1.blagoslovenie-ponimaniya": {
      "parentId": "censor.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Знание"
    },
    "censor.domain.1.blagoslovenie-udachnoy-pogody": {
      "parentId": "censor.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Буря"
    },
    "censor.domain.1.vernyy-drug": {
      "parentId": "censor.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Природа"
    },
    "censor.domain.1.mogilnaya-rech": {
      "parentId": "censor.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Смерть"
    },
    "censor.domain.1.ruki-tvortsa": {
      "parentId": "censor.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Созидание"
    },
    "censor.domain.1.vnutrenniy-svet": {
      "parentId": "censor.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Солнце"
    },
    "censor.domain.1.vdokhnovennyy-obman": {
      "parentId": "censor.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Хитрость"
    },
    "censor.domain.1.videniya-orakula": {
      "parentId": "censor.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Судьба"
    },
    "censor.domain.1.zashchitnyy-krug": {
      "parentId": "censor.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Защита"
    },
    "censor.domain.1.vosstanavlivayushchiy-ritual": {
      "parentId": "censor.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Жизнь"
    },
    "censor.domain.1.osvyashchennoe-oruzhie": {
      "parentId": "censor.feature.1.osobennost-domena-1-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Война"
    },
    "censor.feature.1.znakovaya-sposobnost": {
      "parentId": "censor.feature.1.sposobnosti-tsenzora"
    },
    "censor.feature.1.geroicheskie-sposobnosti": {
      "parentId": "censor.feature.1.sposobnosti-tsenzora"
    },
    "censor.feature.1.sposobnost-za-3-gneva": {
      "parentId": "censor.feature.1.geroicheskie-sposobnosti"
    },
    "censor.feature.1.sposobnost-za-5-gneva": {
      "parentId": "censor.feature.1.geroicheskie-sposobnosti"
    },
    "elementalist.feature.1.zemlya-akolit-zemli": {
      "parentId": "elementalist.feature.1.elementalnaya-spetsializatsiya"
    },
    "elementalist.feature.1.ogon-akolit-ognya": {
      "parentId": "elementalist.feature.1.elementalnaya-spetsializatsiya"
    },
    "elementalist.feature.1.zelen-akolit-zeleni": {
      "parentId": "elementalist.feature.1.elementalnaya-spetsializatsiya"
    },
    "elementalist.feature.1.pustota-akolit-tayny": {
      "parentId": "elementalist.feature.1.elementalnaya-spetsializatsiya"
    },
    "elementalist.feature.1.essentsiya-v-boyu": {
      "parentId": "elementalist.feature.1.essentsiya"
    },
    "elementalist.feature.1.essentsiya-vne-boya": {
      "parentId": "elementalist.feature.1.essentsiya"
    },
    "elementalist.specialization.1.za-predelami-zreniya": {
      "parentId": "elementalist.feature.1.osobennost-spetsializatsii-1-go-urovnya",
      "keyedBy": "specialization",
      "keyValue": "Пустота"
    },
    "elementalist.specialization.1.imenno-dusha-slyshit": {
      "parentId": "elementalist.feature.1.osobennost-spetsializatsii-1-go-urovnya",
      "keyedBy": "specialization",
      "keyValue": "Зелень"
    },
    "elementalist.specialization.1.pobudit-zemlyu": {
      "parentId": "elementalist.feature.1.osobennost-spetsializatsii-1-go-urovnya",
      "keyedBy": "specialization",
      "keyValue": "Земля"
    },
    "elementalist.specialization.1.vozvrat-k-besformennosti": {
      "parentId": "elementalist.feature.1.osobennost-spetsializatsii-1-go-urovnya",
      "keyedBy": "specialization",
      "keyValue": "Огонь"
    },
    "elementalist.feature.1.zacharovanie-bitvy": {
      "parentId": "elementalist.feature.1.zacharovanie"
    },
    "elementalist.feature.1.zacharovanie-bystroty": {
      "parentId": "elementalist.feature.1.zacharovanie"
    },
    "elementalist.feature.1.zacharovanie-razrusheniya": {
      "parentId": "elementalist.feature.1.zacharovanie"
    },
    "elementalist.feature.1.zacharovanie-distantsii": {
      "parentId": "elementalist.feature.1.zacharovanie"
    },
    "elementalist.feature.1.zacharovanie-postoyanstva": {
      "parentId": "elementalist.feature.1.zacharovanie"
    },
    "elementalist.feature.1.obereg-voskhititelnykh-posledstviy": {
      "parentId": "elementalist.feature.1.obereg-elementalista"
    },
    "elementalist.feature.1.obereg-prevoskhodnoy-zashchity": {
      "parentId": "elementalist.feature.1.obereg-elementalista"
    },
    "elementalist.feature.1.obereg-privyazannosti-prirody": {
      "parentId": "elementalist.feature.1.obereg-elementalista"
    },
    "elementalist.feature.1.obereg-udivitelnoy-reaktivnosti": {
      "parentId": "elementalist.feature.1.obereg-elementalista"
    },
    "elementalist.feature.1.znakovye-sposobnosti": {
      "parentId": "elementalist.feature.1.sposobnosti-elementalista"
    },
    "elementalist.feature.1.geroicheskie-sposobnosti": {
      "parentId": "elementalist.feature.1.sposobnosti-elementalista"
    },
    "elementalist.feature.1.sposobnost-za-3-essentsii": {
      "parentId": "elementalist.feature.1.geroicheskie-sposobnosti"
    },
    "elementalist.feature.1.sposobnost-za-5-essentsii": {
      "parentId": "elementalist.feature.1.geroicheskie-sposobnosti"
    },
    "fury.feature.2.perk": {
      "featureId": "0802-f01"
    },
    "fury.feature.2.osobennost-aspekta-2-go-urovnya": {
      "featureId": "0802-f02"
    },
    "fury.aspect.2.neizbezhnyy-gnev": {
      "parentId": "fury.feature.2.osobennost-aspekta-2-go-urovnya",
      "keyedBy": "aspect",
      "keyValue": "Разоритель",
      "featureId": "0802-f02"
    },
    "fury.aspect.2.zub-i-kogot": {
      "parentId": "fury.feature.2.osobennost-aspekta-2-go-urovnya",
      "keyedBy": "aspect",
      "keyValue": "Буревестник",
      "featureId": "0802-f02"
    },
    "fury.aspect.2.nepreodolimaya-sila": {
      "parentId": "fury.feature.2.osobennost-aspekta-2-go-urovnya",
      "keyedBy": "aspect",
      "keyValue": "Берсерк",
      "featureId": "0802-f02"
    },
    "fury.feature.2.sposobnost-aspekta-2-go-urovnya": {
      "featureId": "0802-f03"
    },
    "fury.feature.2.sposobnost-berserka-2-go-urovnya": {
      "parentId": "fury.feature.2.sposobnost-aspekta-2-go-urovnya",
      "featureId": "0802-f03"
    },
    "fury.feature.2.sposobnost-razoritelya-2-go-urovnya": {
      "parentId": "fury.feature.2.sposobnost-aspekta-2-go-urovnya",
      "featureId": "0802-f03"
    },
    "fury.feature.2.sposobnost-burevestnika-2-go-urovnya": {
      "parentId": "fury.feature.2.sposobnost-aspekta-2-go-urovnya",
      "featureId": "0802-f03"
    },
    "fury.feature.3.osobennost-aspekta-3-go-urovnya": {
      "featureId": "0803-f01"
    },
    "fury.aspect.3.nedvizhimyy-obekt": {
      "parentId": "fury.feature.3.osobennost-aspekta-3-go-urovnya",
      "keyedBy": "aspect",
      "keyValue": "Берсерк",
      "featureId": "0803-f01"
    },
    "fury.aspect.3.rytsar-prirody": {
      "parentId": "fury.feature.3.osobennost-aspekta-3-go-urovnya",
      "keyedBy": "aspect",
      "keyValue": "Буревестник",
      "featureId": "0803-f01"
    },
    "fury.aspect.3.videt-skvoz-ikh-ulovki": {
      "parentId": "fury.feature.3.osobennost-aspekta-3-go-urovnya",
      "keyedBy": "aspect",
      "keyValue": "Разоритель",
      "featureId": "0803-f01"
    },
    "fury.feature.3.sposobnost-za-7-svireposti": {
      "featureId": "0803-f02"
    },
    "fury.feature.4.uvelichenie-kharakteristik": {
      "featureId": "0804-f01"
    },
    "fury.feature.4.uron-ot-svireposti": {
      "featureId": "0804-f02"
    },
    "fury.feature.4.uluchshenie-rastushchey-svireposti": {
      "featureId": "0804-f03"
    },
    "fury.feature.4.perk": {
      "featureId": "0804-f04"
    },
    "fury.feature.4.pervozdannaya-nastroyka": {
      "featureId": "0804-f05"
    },
    "fury.feature.4.pervozdannyy-udar": {
      "featureId": "0804-f06"
    },
    "fury.feature.4.navyk": {
      "featureId": "0804-f07"
    },
    "fury.feature.5.osobennost-aspekta-5-go-urovnya": {
      "featureId": "0805-f01"
    },
    "fury.aspect.5.prygun": {
      "parentId": "fury.feature.5.osobennost-aspekta-5-go-urovnya",
      "keyedBy": "aspect",
      "keyValue": "Берсерк",
      "featureId": "0805-f01"
    },
    "fury.aspect.5.rozhdennyy-shtormom": {
      "parentId": "fury.feature.5.osobennost-aspekta-5-go-urovnya",
      "keyedBy": "aspect",
      "keyValue": "Буревестник",
      "featureId": "0805-f01"
    },
    "fury.aspect.5.raskovannyy": {
      "parentId": "fury.feature.5.osobennost-aspekta-5-go-urovnya",
      "keyedBy": "aspect",
      "keyValue": "Разоритель",
      "featureId": "0805-f01"
    },
    "fury.feature.5.sposobnost-za-9-svireposti": {
      "featureId": "0805-f02"
    },
    "fury.feature.6.maroder-pervozdannogo-khaosa": {
      "featureId": "0806-f01"
    },
    "fury.feature.6.pervozdannyy-portal": {
      "featureId": "0806-f02"
    },
    "fury.feature.6.perk": {
      "featureId": "0806-f03"
    },
    "fury.feature.6.sposobnost-aspekta-6-go-urovnya": {
      "featureId": "0806-f04"
    },
    "fury.feature.6.sposobnosti-berserka-6-go-urovnya": {
      "parentId": "fury.feature.6.sposobnost-aspekta-6-go-urovnya",
      "featureId": "0806-f04"
    },
    "fury.feature.6.sposobnosti-razoritelya-6-go-urovnya": {
      "parentId": "fury.feature.6.sposobnost-aspekta-6-go-urovnya",
      "featureId": "0806-f04"
    },
    "fury.feature.6.sposobnosti-burevestnika-6-go-urovnya": {
      "parentId": "fury.feature.6.sposobnost-aspekta-6-go-urovnya",
      "featureId": "0806-f04"
    },
    "fury.feature.7.uvelichenie-kharakteristik": {
      "featureId": "0807-f01"
    },
    "fury.feature.7.elementalnaya-forma": {
      "featureId": "0807-f02"
    },
    "fury.feature.7.velikaya-svirepost": {
      "featureId": "0807-f03"
    },
    "fury.feature.7.uluchshenie-rastushchey-svireposti": {
      "featureId": "0807-f04"
    },
    "fury.feature.7.navyk": {
      "featureId": "0807-f05"
    },
    "fury.feature.8.perk": {
      "featureId": "0808-f01"
    },
    "fury.feature.8.osobennost-aspekta-8-go-urovnya": {
      "featureId": "0808-f02"
    },
    "fury.aspect.8.zverinets": {
      "parentId": "fury.feature.8.osobennost-aspekta-8-go-urovnya",
      "keyedBy": "aspect",
      "keyValue": "Буревестник",
      "featureId": "0808-f02"
    },
    "fury.aspect.8.na-shag-vperedi": {
      "parentId": "fury.feature.8.osobennost-aspekta-8-go-urovnya",
      "keyedBy": "aspect",
      "keyValue": "Разоритель",
      "featureId": "0808-f02"
    },
    "fury.aspect.8.silneyshiy": {
      "parentId": "fury.feature.8.osobennost-aspekta-8-go-urovnya",
      "keyedBy": "aspect",
      "keyValue": "Берсерк",
      "featureId": "0808-f02"
    },
    "fury.feature.8.sposobnost-za-11-svireposti": {
      "featureId": "0808-f03"
    },
    "fury.feature.9.predvestnik-pervozdannogo-khaosa": {
      "featureId": "0809-f01"
    },
    "fury.feature.9.sposobnost-aspekta-9-go-urovnya": {
      "featureId": "0809-f02"
    },
    "fury.feature.9.sposobnosti-berserka-9-go-urovnya": {
      "parentId": "fury.feature.9.sposobnost-aspekta-9-go-urovnya",
      "featureId": "0809-f02"
    },
    "fury.feature.9.sposobnosti-razoritelya-9-go-urovnya": {
      "parentId": "fury.feature.9.sposobnost-aspekta-9-go-urovnya",
      "featureId": "0809-f02"
    },
    "fury.feature.9.sposobnosti-burevestnika-9-go-urovnya": {
      "parentId": "fury.feature.9.sposobnost-aspekta-9-go-urovnya",
      "featureId": "0809-f02"
    },
    "fury.feature.10.voploshchenie-khaosa": {
      "featureId": "0810-f01"
    },
    "fury.feature.10.uvelichenie-kharakteristik": {
      "featureId": "0810-f02"
    },
    "fury.feature.10.uluchshenie-rastushchey-svireposti": {
      "featureId": "0810-f03"
    },
    "fury.feature.10.perk": {
      "featureId": "0810-f04"
    },
    "fury.feature.10.pervozdannaya-svirepost": {
      "featureId": "0810-f05"
    },
    "fury.feature.10.pervozdannaya-sila": {
      "featureId": "0810-f06"
    },
    "fury.feature.10.navyk": {
      "featureId": "0810-f07"
    },
    "null.feature.2.perk": {
      "featureId": "0812-f01"
    },
    "null.feature.2.osobennost-traditsii-2-go-urovnya": {
      "featureId": "0812-f02"
    },
    "null.tradition.2.entropiynaya-adaptivnost": {
      "parentId": "null.feature.2.osobennost-traditsii-2-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Криокинетик",
      "featureId": "0812-f02"
    },
    "null.tradition.2.inertsionnyy-stok": {
      "parentId": "null.feature.2.osobennost-traditsii-2-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Метакинетик",
      "featureId": "0812-f02"
    },
    "null.tradition.2.bystraya-obrabotka": {
      "parentId": "null.feature.2.osobennost-traditsii-2-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Хронокинетик",
      "featureId": "0812-f02"
    },
    "null.feature.2.sposobnost-traditsii-2-go-urovnya": {
      "featureId": "0812-f03"
    },
    "null.feature.2.sposobnost-khronokinetika-2-go-urovnya": {
      "parentId": "null.feature.2.sposobnost-traditsii-2-go-urovnya",
      "featureId": "0812-f03"
    },
    "null.feature.2.sposobnost-kriokinetika-2-go-urovnya": {
      "parentId": "null.feature.2.sposobnost-traditsii-2-go-urovnya",
      "featureId": "0812-f03"
    },
    "null.feature.2.sposobnost-metakinetika-2-go-urovnya": {
      "parentId": "null.feature.2.sposobnost-traditsii-2-go-urovnya",
      "featureId": "0812-f03"
    },
    "null.feature.3.psionicheskiy-pryzhok": {
      "featureId": "0813-f01"
    },
    "null.feature.3.perestroenie": {
      "featureId": "0813-f02"
    },
    "null.feature.3.sposobnost-za-7-distsipliny": {
      "featureId": "0813-f03"
    },
    "null.feature.4.uvelichenie-kharakteristik": {
      "featureId": "0814-f01"
    },
    "null.feature.4.uluchshenie-masterstva-distsipliny": {
      "featureId": "0814-f02"
    },
    "null.feature.4.uluchshennoe-pole-nulya": {
      "featureId": "0814-f03"
    },
    "null.feature.4.perk": {
      "featureId": "0814-f04"
    },
    "null.feature.4.regenerativnoe-pole": {
      "featureId": "0814-f05"
    },
    "null.feature.4.navyk": {
      "featureId": "0814-f06"
    },
    "null.feature.5.osobennost-traditsii-5-go-urovnya": {
      "featureId": "0815-f01"
    },
    "null.tradition.5.okhlazhdayushchaya-gotovnost": {
      "keyedBy": "tradition",
      "keyValue": "Криокинетик",
      "featureId": "0815-f02"
    },
    "null.tradition.5.inertsionnaya-tochka-opory": {
      "keyedBy": "tradition",
      "keyValue": "Метакинетик",
      "featureId": "0815-f03"
    },
    "null.tradition.5.mgnovennoe-deystvie": {
      "keyedBy": "tradition",
      "keyValue": "Хронокинетик",
      "featureId": "0815-f04"
    },
    "null.feature.5.sposobnost-za-9-distsipliny": {
      "featureId": "0815-f05"
    },
    "null.feature.6.elementalnoe-pogloshchenie": {
      "featureId": "0816-f01"
    },
    "null.feature.6.elementalnyy-bufer": {
      "featureId": "0816-f02"
    },
    "null.feature.6.perk": {
      "featureId": "0816-f03"
    },
    "null.feature.6.sposobnost-traditsii-6-go-urovnya": {
      "featureId": "0816-f04"
    },
    "null.feature.6.sposobnosti-khronokinetika-6-go-urovnya": {
      "parentId": "null.feature.6.sposobnost-traditsii-6-go-urovnya",
      "featureId": "0816-f04"
    },
    "null.feature.6.sposobnosti-kriokinetika-6-go-urovnya": {
      "parentId": "null.feature.6.sposobnost-traditsii-6-go-urovnya",
      "featureId": "0816-f04"
    },
    "null.feature.6.sposobnosti-metakinetika-6-go-urovnya": {
      "parentId": "null.feature.6.sposobnost-traditsii-6-go-urovnya",
      "featureId": "0816-f04"
    },
    "null.feature.7.uvelichenie-kharakteristik": {
      "featureId": "0817-f01"
    },
    "null.feature.7.uluchshenie-masterstva-distsipliny": {
      "featureId": "0817-f02"
    },
    "null.feature.7.psi-usilenie": {
      "featureId": "0817-f03"
    },
    "null.feature.7.dinamicheskaya-sila-1-distsipliny": {
      "parentId": "null.feature.7.psi-usilenie",
      "featureId": "0817-f03"
    },
    "null.feature.7.rasshirennaya-sila-3-distsipliny": {
      "parentId": "null.feature.7.psi-usilenie",
      "featureId": "0817-f03"
    },
    "null.feature.7.prodlennaya-sila-1-distsipliny": {
      "parentId": "null.feature.7.psi-usilenie",
      "featureId": "0817-f03"
    },
    "null.feature.7.uvelichennaya-sila-1-distsipliny": {
      "parentId": "null.feature.7.psi-usilenie",
      "featureId": "0817-f03"
    },
    "null.feature.7.potentsialnaya-sila-5-distsipliny": {
      "parentId": "null.feature.7.psi-usilenie",
      "featureId": "0817-f03"
    },
    "null.feature.7.razdelennaya-sila-5-distsipliny": {
      "parentId": "null.feature.7.psi-usilenie",
      "featureId": "0817-f03"
    },
    "null.feature.7.obostrennaya-sila-1-distsipliny": {
      "parentId": "null.feature.7.psi-usilenie",
      "featureId": "0817-f03"
    },
    "null.feature.7.uluchshennoe-telo": {
      "featureId": "0817-f04"
    },
    "null.feature.7.navyk": {
      "featureId": "0817-f05"
    },
    "null.feature.8.perk": {
      "featureId": "0818-f01"
    },
    "null.feature.8.osobennost-traditsii-8-go-urovnya": {
      "featureId": "0818-f02"
    },
    "null.tradition.8.inertsionnyy-gasitel": {
      "parentId": "null.feature.8.osobennost-traditsii-8-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Метакинетик",
      "featureId": "0818-f02"
    },
    "null.tradition.8.razdelennyy-impuls": {
      "parentId": "null.feature.8.osobennost-traditsii-8-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Хронокинетик",
      "featureId": "0818-f02"
    },
    "null.tradition.8.sinapticheskaya-sortirovka": {
      "parentId": "null.feature.8.osobennost-traditsii-8-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Криокинетик",
      "featureId": "0818-f02"
    },
    "null.feature.8.sposobnost-za-11-distsipliny": {
      "featureId": "0818-f03"
    },
    "null.feature.9.ya-i-est-oruzhie": {
      "featureId": "0819-f01"
    },
    "null.feature.9.sposobnost-traditsii-9-go-urovnya": {
      "featureId": "0819-f02"
    },
    "null.feature.9.sposobnosti-khronokinetika-9-go-urovnya": {
      "parentId": "null.feature.9.sposobnost-traditsii-9-go-urovnya",
      "featureId": "0819-f02"
    },
    "null.feature.9.sposobnosti-kriokinetika-9-go-urovnya": {
      "parentId": "null.feature.9.sposobnost-traditsii-9-go-urovnya",
      "featureId": "0819-f02"
    },
    "null.feature.9.sposobnosti-metakinetika-9-go-urovnya": {
      "parentId": "null.feature.9.sposobnost-traditsii-9-go-urovnya",
      "featureId": "0819-f02"
    },
    "null.feature.10.uvelichenie-kharakteristik": {
      "featureId": "0820-f01"
    },
    "null.feature.10.uluchshenie-masterstva-distsipliny": {
      "featureId": "0820-f02"
    },
    "null.feature.10.telo-manifolda": {
      "featureId": "0820-f03"
    },
    "null.feature.10.rezonans-manifolda": {
      "featureId": "0820-f04"
    },
    "null.feature.10.poryadok": {
      "featureId": "0820-f05"
    },
    "null.feature.10.perk": {
      "featureId": "0820-f06"
    },
    "null.feature.10.navyk": {
      "featureId": "0820-f07"
    },
    "conduit.feature.2.spiski-nebes-the-lists-of-heaven": {
      "featureId": "0832-f01"
    },
    "conduit.feature.2.perk": {
      "featureId": "0832-f02"
    },
    "conduit.feature.2.osobennost-domena-2-go-urovnya": {
      "featureId": "0832-f03"
    },
    "conduit.feature.2.sposobnost-domena-2-go-urovnya": {
      "featureId": "0832-f04"
    },
    "conduit.feature.3.maloe-chudo-minor-miracle": {
      "featureId": "0833-f01"
    },
    "conduit.feature.3.sposobnost-za-7-blagochestiya": {
      "featureId": "0833-f02"
    },
    "conduit.feature.4.blagoslovennye-domeny-blessed-domain": {
      "featureId": "0834-f01"
    },
    "conduit.feature.4.uvelichenie-kharakteristik": {
      "featureId": "0834-f02"
    },
    "conduit.feature.4.perk": {
      "featureId": "0834-f03"
    },
    "conduit.feature.4.navyk": {
      "featureId": "0834-f04"
    },
    "conduit.feature.4.osobennost-domena-4-go-urovnya": {
      "featureId": "0834-f05"
    },
    "conduit.domain.4.blagoslovenie-zhizni": {
      "parentId": "conduit.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Жизнь",
      "featureId": "0834-f05"
    },
    "conduit.domain.4.blagoslovenie-tayn": {
      "parentId": "conduit.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Хитрость",
      "featureId": "0834-f05"
    },
    "conduit.domain.4.nepronitsaemoe-prikosnovenie": {
      "parentId": "conduit.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Защита",
      "featureId": "0834-f05"
    },
    "conduit.domain.4.uluchshennye-ruki-tvortsa": {
      "parentId": "conduit.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Созидание",
      "featureId": "0834-f05"
    },
    "conduit.domain.4.uluchshennoe-osvyashchennoe-oruzhie": {
      "parentId": "conduit.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Война",
      "featureId": "0834-f05"
    },
    "conduit.domain.4.prizyv-serdtsa": {
      "parentId": "conduit.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Любовь",
      "featureId": "0834-f05"
    },
    "conduit.domain.4.svet-otkroveniya": {
      "parentId": "conduit.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Солнце",
      "featureId": "0834-f05"
    },
    "conduit.domain.4.preduprezhdenie-orakula": {
      "parentId": "conduit.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Судьба",
      "featureId": "0834-f05"
    },
    "conduit.domain.4.spiriticheskiy-seans": {
      "parentId": "conduit.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Смерть",
      "featureId": "0834-f05"
    },
    "conduit.domain.4.prozrenie-svyatogo": {
      "parentId": "conduit.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Знание",
      "featureId": "0834-f05"
    },
    "conduit.domain.4.postup-vetra": {
      "parentId": "conduit.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Буря",
      "featureId": "0834-f05"
    },
    "conduit.domain.4.lesnaya-doroga": {
      "parentId": "conduit.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Природа",
      "featureId": "0834-f05"
    },
    "conduit.feature.5.osobennost-domena-5-go-urovnya": {
      "featureId": "0835-f01"
    },
    "conduit.feature.5.sposobnost-za-9-blagochestiya": {
      "featureId": "0835-f02"
    },
    "conduit.feature.6.rastsvetayushchiy-svyatoy": {
      "featureId": "0836-f01"
    },
    "conduit.feature.6.perk": {
      "featureId": "0836-f02"
    },
    "conduit.feature.6.sposobnost-domena-6-go-urovnya": {
      "featureId": "0836-f03"
    },
    "conduit.feature.7.uvelichenie-kharakteristik": {
      "featureId": "0837-f01"
    },
    "conduit.feature.7.nagrada-veruyushchego-faithful-s-reward": {
      "featureId": "0837-f02"
    },
    "conduit.feature.7.navyk": {
      "featureId": "0837-f03"
    },
    "conduit.feature.7.osobennost-domena-7-go-urovnya": {
      "featureId": "0837-f04"
    },
    "conduit.domain.7.blagoslovenie-zheleza": {
      "parentId": "conduit.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Защита",
      "featureId": "0837-f04"
    },
    "conduit.domain.7.zavet-serdtsa": {
      "parentId": "conduit.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Любовь",
      "featureId": "0837-f04"
    },
    "conduit.domain.7.bozhestvennyy-intendant": {
      "parentId": "conduit.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Созидание",
      "featureId": "0837-f04"
    },
    "conduit.domain.7.istochnik-blagodati": {
      "parentId": "conduit.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Жизнь",
      "featureId": "0837-f04"
    },
    "conduit.domain.7.biblioteka-bogov": {
      "parentId": "conduit.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Знание",
      "featureId": "0837-f04"
    },
    "conduit.domain.7.svet-palyashchego-solntsa": {
      "parentId": "conduit.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Солнце",
      "featureId": "0837-f04"
    },
    "conduit.domain.7.dary-prirody": {
      "parentId": "conduit.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Природа",
      "featureId": "0837-f04"
    },
    "conduit.domain.7.gromom-porazhennyy": {
      "parentId": "conduit.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Буря",
      "featureId": "0837-f04"
    },
    "conduit.domain.7.troitsa-khitrosti": {
      "parentId": "conduit.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Хитрость",
      "featureId": "0837-f04"
    },
    "conduit.domain.7.slovo-otlozhennoy-smerti": {
      "parentId": "conduit.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Смерть",
      "featureId": "0837-f04"
    },
    "conduit.domain.7.slovo-otklonennoy-sudby": {
      "parentId": "conduit.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Судьба",
      "featureId": "0837-f04"
    },
    "conduit.domain.7.vashi-triumfy-pomnyat": {
      "parentId": "conduit.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Война",
      "featureId": "0837-f04"
    },
    "conduit.feature.8.perk": {
      "featureId": "0838-f01"
    },
    "conduit.feature.8.osobennost-domena-8-go-urovnya": {
      "featureId": "0838-f02"
    },
    "conduit.feature.8.sposobnost-za-11-blagochestiya": {
      "featureId": "0838-f03"
    },
    "conduit.feature.9.mech-very-faith-s-sword": {
      "featureId": "0839-f01"
    },
    "conduit.feature.9.posvyashchennyy-ordained": {
      "featureId": "0839-f02"
    },
    "conduit.feature.9.sposobnost-domena-9-go-urovnya": {
      "featureId": "0839-f03"
    },
    "conduit.feature.10.avatar": {
      "featureId": "0840-f01"
    },
    "conduit.feature.10.uvelichenie-kharakteristik": {
      "featureId": "0840-f02"
    },
    "conduit.feature.10.bozhestvennaya-sila": {
      "featureId": "0840-f03"
    },
    "conduit.feature.10.samyy-blagochestivyy": {
      "featureId": "0840-f04"
    },
    "conduit.feature.10.perk": {
      "featureId": "0840-f05"
    },
    "conduit.feature.10.navyk": {
      "featureId": "0840-f06"
    },
    "tactician.feature.2.perk": {
      "featureId": "0842-f01"
    },
    "tactician.feature.2.osobennost-doktriny-2-go-urovnya": {
      "featureId": "0842-f02"
    },
    "tactician.doctrine.2.sprovotsirovannyy": {
      "parentId": "tactician.feature.2.osobennost-doktriny-2-go-urovnya",
      "keyedBy": "doctrine",
      "keyValue": "Воевода",
      "featureId": "0842-f02"
    },
    "tactician.doctrine.2.taktika-proniknoveniya": {
      "parentId": "tactician.feature.2.osobennost-doktriny-2-go-urovnya",
      "keyedBy": "doctrine",
      "keyValue": "Повстанец",
      "featureId": "0842-f02"
    },
    "tactician.doctrine.2.prevoskhodstvo-v-blizhnem-boyu": {
      "parentId": "tactician.feature.2.osobennost-doktriny-2-go-urovnya",
      "keyedBy": "doctrine",
      "keyValue": "Авангард",
      "featureId": "0842-f02"
    },
    "tactician.feature.2.sposobnost-doktriny-2-go-urovnya": {
      "featureId": "0842-f03"
    },
    "tactician.feature.2.sposobnost-povstantsa-2-go-urovnya": {
      "parentId": "tactician.feature.2.sposobnost-doktriny-2-go-urovnya",
      "featureId": "0842-f03"
    },
    "tactician.feature.2.sposobnost-voevody-2-go-urovnya": {
      "parentId": "tactician.feature.2.sposobnost-doktriny-2-go-urovnya",
      "featureId": "0842-f03"
    },
    "tactician.feature.2.sposobnost-avangarda-2-go-urovnya": {
      "parentId": "tactician.feature.2.sposobnost-doktriny-2-go-urovnya",
      "featureId": "0842-f03"
    },
    "tactician.feature.3.vne-pozitsii": {
      "featureId": "0843-f01"
    },
    "tactician.feature.3.sposobnost-za-7-fokusa": {
      "featureId": "0843-f02"
    },
    "tactician.feature.4.uvelichenie-kharakteristik": {
      "featureId": "0844-f01"
    },
    "tactician.feature.4.fokus-na-ikh-slabosti": {
      "featureId": "0844-f02"
    },
    "tactician.feature.4.uluchshennyy-polevoy-arsenal": {
      "featureId": "0844-f03"
    },
    "tactician.feature.4.perk": {
      "featureId": "0844-f04"
    },
    "tactician.feature.4.navyk": {
      "featureId": "0844-f05"
    },
    "tactician.feature.5.osobennosti-doktriny-5-go-urovnya": {
      "featureId": "0845-f01"
    },
    "tactician.doctrine.5.zamysel": {
      "parentId": "tactician.feature.5.osobennosti-doktriny-5-go-urovnya",
      "keyedBy": "doctrine",
      "keyValue": "Воевода",
      "featureId": "0845-f01"
    },
    "tactician.doctrine.5.otvlechenie": {
      "parentId": "tactician.feature.5.osobennosti-doktriny-5-go-urovnya",
      "keyedBy": "doctrine",
      "keyValue": "Повстанец",
      "featureId": "0845-f01"
    },
    "tactician.doctrine.5.ya-eto-produmal": {
      "parentId": "tactician.feature.5.osobennosti-doktriny-5-go-urovnya",
      "keyedBy": "doctrine",
      "keyValue": "Воевода",
      "featureId": "0845-f01"
    },
    "tactician.doctrine.5.ne-ostavlyat-sledov": {
      "parentId": "tactician.feature.5.osobennosti-doktriny-5-go-urovnya",
      "keyedBy": "doctrine",
      "keyValue": "Повстанец",
      "featureId": "0845-f01"
    },
    "tactician.doctrine.5.stryakhnut": {
      "parentId": "tactician.feature.5.osobennosti-doktriny-5-go-urovnya",
      "keyedBy": "doctrine",
      "keyValue": "Авангард",
      "featureId": "0845-f01"
    },
    "tactician.doctrine.5.takticheskoe-nastuplenie": {
      "parentId": "tactician.feature.5.osobennosti-doktriny-5-go-urovnya",
      "keyedBy": "doctrine",
      "keyValue": "Авангард",
      "featureId": "0845-f01"
    },
    "tactician.feature.5.sposobnost-za-9-fokusa": {
      "featureId": "0845-f02"
    },
    "tactician.feature.6.master-oruzhiya": {
      "featureId": "0846-f01"
    },
    "tactician.feature.6.perk": {
      "featureId": "0846-f02"
    },
    "tactician.feature.6.sposobnost-doktriny-6-go-urovnya": {
      "featureId": "0846-f03"
    },
    "tactician.feature.6.sposobnosti-povstantsa-6-go-urovnya": {
      "parentId": "tactician.feature.6.sposobnost-doktriny-6-go-urovnya",
      "featureId": "0846-f03"
    },
    "tactician.feature.6.sposobnosti-voevody-6-go-urovnya": {
      "parentId": "tactician.feature.6.sposobnost-doktriny-6-go-urovnya",
      "featureId": "0846-f03"
    },
    "tactician.feature.6.sposobnosti-avangarda-6-go-urovnya": {
      "parentId": "tactician.feature.6.sposobnost-doktriny-6-go-urovnya",
      "featureId": "0846-f03"
    },
    "tactician.feature.7.uvelichenie-kharakteristik": {
      "featureId": "0847-f01"
    },
    "tactician.feature.7.povyshennyy-fokus": {
      "featureId": "0847-f02"
    },
    "tactician.feature.7.zakhvat-initsiativy": {
      "featureId": "0847-f03"
    },
    "tactician.feature.7.navyk": {
      "featureId": "0847-f04"
    },
    "tactician.feature.7.osobennost-doktriny-7-go-urovnya": {
      "featureId": "0847-f05"
    },
    "tactician.doctrine.7.asimmetrichnaya-voyna": {
      "parentId": "tactician.feature.7.osobennost-doktriny-7-go-urovnya",
      "keyedBy": "doctrine",
      "keyValue": "Повстанец",
      "featureId": "0847-f05"
    },
    "tactician.doctrine.7.grand-strategiya": {
      "parentId": "tactician.feature.7.osobennost-doktriny-7-go-urovnya",
      "keyedBy": "doctrine",
      "keyValue": "Воевода",
      "featureId": "0847-f05"
    },
    "tactician.doctrine.7.shok-i-trepet": {
      "parentId": "tactician.feature.7.osobennost-doktriny-7-go-urovnya",
      "keyedBy": "doctrine",
      "keyValue": "Авангард",
      "featureId": "0847-f05"
    },
    "tactician.feature.8.perk": {
      "featureId": "0848-f01"
    },
    "tactician.feature.8.osobennost-doktriny-8-go-urovnya": {
      "featureId": "0848-f02"
    },
    "tactician.doctrine.8.primanka-i-zasada": {
      "parentId": "tactician.feature.8.osobennost-doktriny-8-go-urovnya",
      "keyedBy": "doctrine",
      "keyValue": "Повстанец",
      "featureId": "0848-f02"
    },
    "tactician.doctrine.8.kleshchevoy-manevr": {
      "parentId": "tactician.feature.8.osobennost-doktriny-8-go-urovnya",
      "keyedBy": "doctrine",
      "keyValue": "Воевода",
      "featureId": "0848-f02"
    },
    "tactician.doctrine.8.videt-kak-vragi-begut-pered-toboy": {
      "parentId": "tactician.feature.8.osobennost-doktriny-8-go-urovnya",
      "keyedBy": "doctrine",
      "keyValue": "Авангард",
      "featureId": "0848-f02"
    },
    "tactician.feature.8.sposobnost-za-11-fokusa": {
      "featureId": "0848-f03"
    },
    "tactician.feature.9.grandmaster-oruzhiya": {
      "featureId": "0849-f01"
    },
    "tactician.feature.9.sposobnost-doktriny-9-go-urovnya": {
      "featureId": "0849-f02"
    },
    "tactician.feature.9.sposobnosti-povstantsa-9-go-urovnya": {
      "parentId": "tactician.feature.9.sposobnost-doktriny-9-go-urovnya",
      "featureId": "0849-f02"
    },
    "tactician.feature.9.sposobnosti-voevody-9-go-urovnya": {
      "parentId": "tactician.feature.9.sposobnost-doktriny-9-go-urovnya",
      "featureId": "0849-f02"
    },
    "tactician.feature.9.sposobnosti-avangarda-9-go-urovnya": {
      "parentId": "tactician.feature.9.sposobnost-doktriny-9-go-urovnya",
      "featureId": "0849-f02"
    },
    "tactician.feature.10.uvelichenie-kharakteristik": {
      "featureId": "0850-f01"
    },
    "tactician.feature.10.komandovanie": {
      "featureId": "0850-f02"
    },
    "tactician.feature.10.perk": {
      "featureId": "0850-f03"
    },
    "tactician.feature.10.navyk": {
      "featureId": "0850-f04"
    },
    "tactician.feature.10.istinnyy-fokus": {
      "featureId": "0850-f05"
    },
    "tactician.feature.10.master-voyny": {
      "featureId": "0850-f06"
    },
    "talent.feature.2.perk": {
      "featureId": "0852-f01"
    },
    "talent.feature.2.osobennost-traditsii-2-go-urovnya": {
      "featureId": "0852-f02"
    },
    "talent.tradition.2.oblegchenie-chasov": {
      "parentId": "talent.feature.2.osobennost-traditsii-2-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Хронопатия",
      "featureId": "0852-f02"
    },
    "talent.tradition.2.oblegchenie-razuma": {
      "parentId": "talent.feature.2.osobennost-traditsii-2-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Телепатия",
      "featureId": "0852-f02"
    },
    "talent.tradition.2.oblegchenie-padeniya": {
      "parentId": "talent.feature.2.osobennost-traditsii-2-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Телекинез",
      "featureId": "0852-f02"
    },
    "talent.feature.2.sposobnost-traditsii-2-go-urovnya": {
      "featureId": "0852-f03"
    },
    "talent.feature.2.sposobnosti-khronopatii-2-go-urovnya": {
      "parentId": "talent.feature.2.sposobnost-traditsii-2-go-urovnya",
      "featureId": "0852-f03"
    },
    "talent.feature.2.sposobnosti-telekineza-2-go-urovnya": {
      "parentId": "talent.feature.2.sposobnost-traditsii-2-go-urovnya",
      "featureId": "0852-f03"
    },
    "talent.feature.2.sposobnosti-telepatii-2-go-urovnya": {
      "parentId": "talent.feature.2.sposobnost-traditsii-2-go-urovnya",
      "featureId": "0852-f03"
    },
    "talent.feature.3.skanirovanie": {
      "featureId": "0853-f01"
    },
    "talent.feature.3.sposobnost-za-7-yasnosti": {
      "featureId": "0853-f02"
    },
    "talent.feature.4.uvelichenie-kharakteristik": {
      "featureId": "0854-f01"
    },
    "talent.feature.4.proektsiya-razuma": {
      "featureId": "0854-f02"
    },
    "talent.feature.4.vosstanovlenie-razuma": {
      "featureId": "0854-f03"
    },
    "talent.feature.4.perk": {
      "featureId": "0854-f04"
    },
    "talent.feature.4.navyk": {
      "featureId": "0854-f05"
    },
    "talent.feature.4.podveshivayushchee-pole": {
      "featureId": "0854-f06"
    },
    "talent.feature.5.osobennosti-traditsii-5-go-urovnya": {
      "featureId": "0855-f01"
    },
    "talent.tradition.5.prinuzhdenie": {
      "parentId": "talent.feature.5.osobennosti-traditsii-5-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Телепатия",
      "featureId": "0855-f01"
    },
    "talent.tradition.5.iskazhenie-vremeni": {
      "parentId": "talent.feature.5.osobennosti-traditsii-5-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Хронопатия",
      "featureId": "0855-f01"
    },
    "talent.tradition.5.kineticheskiy-usilitel": {
      "parentId": "talent.feature.5.osobennosti-traditsii-5-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Телекинез",
      "featureId": "0855-f01"
    },
    "talent.tradition.5.udalennoe-usilenie": {
      "parentId": "talent.feature.5.osobennosti-traditsii-5-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Телепатия",
      "featureId": "0855-f01"
    },
    "talent.tradition.5.skorost-mysli": {
      "parentId": "talent.feature.5.osobennosti-traditsii-5-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Хронопатия",
      "featureId": "0855-f01"
    },
    "talent.tradition.5.triangulyatsiya": {
      "parentId": "talent.feature.5.osobennosti-traditsii-5-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Телекинез",
      "featureId": "0855-f01"
    },
    "talent.feature.5.sposobnost-za-9-yasnosti": {
      "featureId": "0855-f02"
    },
    "talent.feature.6.perk": {
      "featureId": "0856-f01"
    },
    "talent.feature.6.psi-usilenie-psi-boost": {
      "featureId": "0856-f02"
    },
    "talent.feature.6.dinamicheskaya-sila-1-yasnosti": {
      "parentId": "talent.feature.6.psi-usilenie-psi-boost",
      "featureId": "0856-f02"
    },
    "talent.feature.6.rasshirennaya-sila-3-yasnosti": {
      "parentId": "talent.feature.6.psi-usilenie-psi-boost",
      "featureId": "0856-f02"
    },
    "talent.feature.6.prodlennaya-sila-1-yasnosti": {
      "parentId": "talent.feature.6.psi-usilenie-psi-boost",
      "featureId": "0856-f02"
    },
    "talent.feature.6.uvelichennaya-sila-1-yasnosti": {
      "parentId": "talent.feature.6.psi-usilenie-psi-boost",
      "featureId": "0856-f02"
    },
    "talent.feature.6.potentsialnaya-sila-5-yasnosti": {
      "parentId": "talent.feature.6.psi-usilenie-psi-boost",
      "featureId": "0856-f02"
    },
    "talent.feature.6.razdelennaya-sila-5-yasnosti": {
      "parentId": "talent.feature.6.psi-usilenie-psi-boost",
      "featureId": "0856-f02"
    },
    "talent.feature.6.obostrennaya-sila-1-yasnosti": {
      "parentId": "talent.feature.6.psi-usilenie-psi-boost",
      "featureId": "0856-f02"
    },
    "talent.feature.6.sposobnost-traditsii-6-go-urovnya": {
      "featureId": "0856-f03"
    },
    "talent.feature.6.sposobnosti-khronopatii-6-go-urovnya": {
      "parentId": "talent.feature.6.sposobnost-traditsii-6-go-urovnya",
      "featureId": "0856-f03"
    },
    "talent.feature.6.sposobnosti-telekineza-6-go-urovnya": {
      "parentId": "talent.feature.6.sposobnost-traditsii-6-go-urovnya",
      "featureId": "0856-f03"
    },
    "talent.feature.6.sposobnosti-telepatii-6-go-urovnya": {
      "parentId": "talent.feature.6.sposobnost-traditsii-6-go-urovnya",
      "featureId": "0856-f03"
    },
    "talent.feature.7.pamyat-predkov": {
      "featureId": "0857-f01"
    },
    "talent.feature.7.kaskadnaya-vozbuzhdennost": {
      "featureId": "0857-f02"
    },
    "talent.feature.7.uvelichenie-kharakteristik": {
      "featureId": "0857-f03"
    },
    "talent.feature.7.osoznannyy-razum": {
      "featureId": "0857-f04"
    },
    "talent.feature.7.navyk": {
      "featureId": "0857-f05"
    },
    "talent.feature.8.perk": {
      "featureId": "0858-f01"
    },
    "talent.feature.8.osobennosti-traditsii-8-go-urovnya": {
      "featureId": "0858-f02"
    },
    "talent.tradition.8.udvoenie-chasov": {
      "parentId": "talent.feature.8.osobennosti-traditsii-8-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Хронопатия",
      "featureId": "0858-f02"
    },
    "talent.tradition.8.pole-levitatsii": {
      "parentId": "talent.feature.8.osobennosti-traditsii-8-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Телекинез",
      "featureId": "0858-f02"
    },
    "talent.tradition.8.nizkaya-gravitatsiya": {
      "parentId": "talent.feature.8.osobennosti-traditsii-8-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Телекинез",
      "featureId": "0858-f02"
    },
    "talent.tradition.8.svyaz-razumov": {
      "parentId": "talent.feature.8.osobennosti-traditsii-8-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Телепатия",
      "featureId": "0858-f02"
    },
    "talent.tradition.8.stazisnyy-shchit": {
      "parentId": "talent.feature.8.osobennosti-traditsii-8-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Хронопатия",
      "featureId": "0858-f02"
    },
    "talent.tradition.8.bezgranichnaya-svyaz": {
      "parentId": "talent.feature.8.osobennosti-traditsii-8-go-urovnya",
      "keyedBy": "tradition",
      "keyValue": "Телепатия",
      "featureId": "0858-f02"
    },
    "talent.feature.8.sposobnost-za-11-yasnosti": {
      "featureId": "0858-f03"
    },
    "talent.feature.9.krepost-idealnoy-mysli": {
      "featureId": "0859-f01"
    },
    "talent.feature.9.sposobnost-traditsii-9-go-urovnya": {
      "featureId": "0859-f02"
    },
    "talent.feature.9.sposobnosti-khronopatii-9-go-urovnya": {
      "parentId": "talent.feature.9.sposobnost-traditsii-9-go-urovnya",
      "featureId": "0859-f02"
    },
    "talent.feature.9.sposobnosti-telekineza-9-go-urovnya": {
      "parentId": "talent.feature.9.sposobnost-traditsii-9-go-urovnya",
      "featureId": "0859-f02"
    },
    "talent.feature.9.sposobnosti-telepatii-9-go-urovnya": {
      "parentId": "talent.feature.9.sposobnost-traditsii-9-go-urovnya",
      "featureId": "0859-f02"
    },
    "talent.feature.10.uvelichenie-kharakteristik": {
      "featureId": "0860-f01"
    },
    "talent.feature.10.chistyy-razum": {
      "featureId": "0860-f02"
    },
    "talent.feature.10.omnisensorika": {
      "featureId": "0860-f03"
    },
    "talent.feature.10.perk": {
      "featureId": "0860-f04"
    },
    "talent.feature.10.psion": {
      "featureId": "0860-f05"
    },
    "talent.feature.10.navyk": {
      "featureId": "0860-f06"
    },
    "talent.feature.10.videnie": {
      "featureId": "0860-f07"
    },
    "shadow.feature.2.perk": {
      "featureId": "0862-f01"
    },
    "shadow.feature.2.osobennost-kollegii-2-go-urovnya": {
      "featureId": "0862-f02"
    },
    "shadow.college.2.goryashchiy-pepel": {
      "parentId": "shadow.feature.2.osobennost-kollegii-2-go-urovnya",
      "keyedBy": "college",
      "keyValue": "Черный Пепел",
      "featureId": "0862-f02"
    },
    "shadow.college.2.drug": {
      "parentId": "shadow.feature.2.osobennost-kollegii-2-go-urovnya",
      "keyedBy": "college",
      "keyValue": "Маска Арлекина",
      "featureId": "0862-f02"
    },
    "shadow.college.2.obuchennyy-ubiytsa": {
      "parentId": "shadow.feature.2.osobennost-kollegii-2-go-urovnya",
      "keyedBy": "college",
      "keyValue": "Едкая Алхимия",
      "featureId": "0862-f02"
    },
    "shadow.feature.2.sposobnost-kollegii-2-go-urovnya": {
      "featureId": "0862-f03"
    },
    "shadow.feature.2.sposobnost-chernogo-pepla-2-go-urovnya": {
      "parentId": "shadow.feature.2.sposobnost-kollegii-2-go-urovnya",
      "featureId": "0862-f03"
    },
    "shadow.feature.2.sposobnost-edkoy-alkhimii-2-go-urovnya": {
      "parentId": "shadow.feature.2.sposobnost-kollegii-2-go-urovnya",
      "featureId": "0862-f03"
    },
    "shadow.feature.2.sposobnost-maski-arlekina-2-go-urovnya": {
      "parentId": "shadow.feature.2.sposobnost-kollegii-2-go-urovnya",
      "featureId": "0862-f03"
    },
    "shadow.feature.3.vnimatelnoe-nablyudenie": {
      "featureId": "0863-f01"
    },
    "shadow.feature.3.sposobnost-za-7-prozreniya": {
      "featureId": "0863-f02"
    },
    "shadow.feature.4.uvelichenie-kharakteristik": {
      "featureId": "0864-f01"
    },
    "shadow.feature.4.potishe": {
      "featureId": "0864-f02"
    },
    "shadow.feature.4.nochnoy-dozor": {
      "featureId": "0864-f03"
    },
    "shadow.feature.4.perk": {
      "featureId": "0864-f04"
    },
    "shadow.feature.4.navyk": {
      "featureId": "0864-f05"
    },
    "shadow.feature.4.vsplesk-prozreniya": {
      "featureId": "0864-f06"
    },
    "shadow.feature.5.osobennost-kollegii-5-go-urovnya": {
      "featureId": "0865-f01"
    },
    "shadow.college.5.gambit-arlekina": {
      "parentId": "shadow.feature.5.osobennost-kollegii-5-go-urovnya",
      "keyedBy": "college",
      "keyValue": "Маска Арлекина",
      "featureId": "0865-f01"
    },
    "shadow.college.5.sled-pepla": {
      "parentId": "shadow.feature.5.osobennost-kollegii-5-go-urovnya",
      "keyedBy": "college",
      "keyValue": "Черный Пепел",
      "featureId": "0865-f01"
    },
    "shadow.college.5.nestabilnye-reagenty": {
      "parentId": "shadow.feature.5.osobennost-kollegii-5-go-urovnya",
      "keyedBy": "college",
      "keyValue": "Едкая Алхимия",
      "featureId": "0865-f01"
    },
    "shadow.feature.5.sposobnost-za-9-prozreniya": {
      "featureId": "0865-f02"
    },
    "shadow.feature.6.perk": {
      "featureId": "0866-f01"
    },
    "shadow.feature.6.tenevaya-forma": {
      "featureId": "0866-f02"
    },
    "shadow.feature.6.sposobnost-kollegii-6-go-urovnya": {
      "featureId": "0866-f03"
    },
    "shadow.feature.6.sposobnosti-chernogo-pepla-6-go-urovnya": {
      "parentId": "shadow.feature.6.sposobnost-kollegii-6-go-urovnya",
      "featureId": "0866-f03"
    },
    "shadow.feature.6.sposobnosti-edkoy-alkhimii-6-go-urovnya": {
      "parentId": "shadow.feature.6.sposobnost-kollegii-6-go-urovnya",
      "featureId": "0866-f03"
    },
    "shadow.feature.6.sposobnosti-maski-arlekina-6-go-urovnya": {
      "parentId": "shadow.feature.6.sposobnost-kollegii-6-go-urovnya",
      "featureId": "0866-f03"
    },
    "shadow.feature.7.uvelichenie-kharakteristik": {
      "featureId": "0867-f01"
    },
    "shadow.feature.7.ostroe-prozrenie": {
      "featureId": "0867-f02"
    },
    "shadow.feature.7.navyk": {
      "featureId": "0867-f03"
    },
    "shadow.feature.7.uluchshenie-vnimatelnogo-nablyudeniya": {
      "featureId": "0867-f04"
    },
    "shadow.feature.7.chrevoveshchatel": {
      "featureId": "0867-f05"
    },
    "shadow.feature.8.perk": {
      "featureId": "0868-f01"
    },
    "shadow.feature.8.osobennost-kollegii-8-go-urovnya": {
      "featureId": "0868-f02"
    },
    "shadow.college.8.pepelnyy-shag": {
      "parentId": "shadow.feature.8.osobennost-kollegii-8-go-urovnya",
      "keyedBy": "college",
      "keyValue": "Черный Пепел",
      "featureId": "0868-f02"
    },
    "shadow.college.8.parkur": {
      "parentId": "shadow.feature.8.osobennost-kollegii-8-go-urovnya",
      "keyedBy": "college",
      "keyValue": "Маска Арлекина",
      "featureId": "0868-f02"
    },
    "shadow.college.8.bomba-zamedlennogo-deystviya": {
      "parentId": "shadow.feature.8.osobennost-kollegii-8-go-urovnya",
      "keyedBy": "college",
      "keyValue": "Едкая Алхимия",
      "featureId": "0868-f02"
    },
    "shadow.feature.8.sposobnost-za-11-prozreniya": {
      "featureId": "0868-f03"
    },
    "shadow.feature.9.mrachnyy-otryad": {
      "featureId": "0869-f01"
    },
    "shadow.feature.9.sposobnost-kollegii-9-go-urovnya": {
      "featureId": "0869-f02"
    },
    "shadow.feature.9.sposobnosti-chernogo-pepla-9-go-urovnya": {
      "parentId": "shadow.feature.9.sposobnost-kollegii-9-go-urovnya",
      "featureId": "0869-f02"
    },
    "shadow.feature.9.sposobnosti-edkoy-alkhimii-9-go-urovnya": {
      "parentId": "shadow.feature.9.sposobnost-kollegii-9-go-urovnya",
      "featureId": "0869-f02"
    },
    "shadow.feature.9.sposobnosti-maski-arlekina-9-go-urovnya": {
      "parentId": "shadow.feature.9.sposobnost-kollegii-9-go-urovnya",
      "featureId": "0869-f02"
    },
    "shadow.feature.10.uvelichenie-kharakteristik": {
      "featureId": "0870-f01"
    },
    "shadow.feature.10.resurs-smerti": {
      "featureId": "0870-f02"
    },
    "shadow.feature.10.perk": {
      "featureId": "0870-f03"
    },
    "shadow.feature.10.navyk": {
      "featureId": "0870-f04"
    },
    "shadow.feature.10.uluchshenie-vnimatelnogo-nablyudeniya": {
      "featureId": "0870-f05"
    },
    "shadow.feature.10.uluchshennaya-tenevaya-forma": {
      "featureId": "0870-f06"
    },
    "shadow.feature.10.ulovka": {
      "featureId": "0870-f07"
    },
    "troubadour.feature.2.obrashchenie-k-muzam": {
      "featureId": "0872-f01"
    },
    "troubadour.feature.2.prizvanie": {
      "featureId": "0872-f02"
    },
    "troubadour.feature.2.pozvolte-predstavit-segodnyashnikh-akterov": {
      "parentId": "troubadour.feature.2.prizvanie",
      "featureId": "0872-f02"
    },
    "troubadour.feature.2.ofitsialnye-predstavleniya": {
      "parentId": "troubadour.feature.2.prizvanie",
      "featureId": "0872-f02"
    },
    "troubadour.feature.2.moya-reputatsiya-operezhaet-menya": {
      "parentId": "troubadour.feature.2.prizvanie",
      "featureId": "0872-f02"
    },
    "troubadour.feature.2.perk": {
      "featureId": "0872-f03"
    },
    "troubadour.feature.2.sposobnost-amplua-2-go-urovnya": {
      "featureId": "0872-f04"
    },
    "troubadour.feature.2.sposobnosti-avtora-2-go-urovnya": {
      "parentId": "troubadour.feature.2.sposobnost-amplua-2-go-urovnya",
      "featureId": "0872-f04"
    },
    "troubadour.feature.2.sposobnosti-duelyanta-2-go-urovnya": {
      "parentId": "troubadour.feature.2.sposobnost-amplua-2-go-urovnya",
      "featureId": "0872-f04"
    },
    "troubadour.feature.2.sposobnosti-virtuoza-2-go-urovnya": {
      "parentId": "troubadour.feature.2.sposobnost-amplua-2-go-urovnya",
      "featureId": "0872-f04"
    },
    "troubadour.feature.3.osobennost-amplua-3-go-urovnya": {
      "featureId": "0873-f01"
    },
    "troubadour.troupe.3.opponent": {
      "parentId": "troubadour.feature.3.osobennost-amplua-3-go-urovnya",
      "keyedBy": "troupe",
      "keyValue": "Дуэлянт",
      "featureId": "0873-f01"
    },
    "troubadour.troupe.3.propushchennaya-replika": {
      "parentId": "troubadour.feature.3.osobennost-amplua-3-go-urovnya",
      "keyedBy": "troupe",
      "keyValue": "Автор",
      "featureId": "0873-f01"
    },
    "troubadour.troupe.3.vtoroy-albom": {
      "parentId": "troubadour.feature.3.osobennost-amplua-3-go-urovnya",
      "keyedBy": "troupe",
      "keyValue": "Виртуоз",
      "featureId": "0873-f01"
    },
    "troubadour.feature.3.sposobnost-za-7-dramy": {
      "featureId": "0873-f02"
    },
    "troubadour.feature.4.uvelichenie-kharakteristik": {
      "featureId": "0874-f01"
    },
    "troubadour.feature.4.melodrama": {
      "featureId": "0874-f02"
    },
    "troubadour.feature.4.perk": {
      "featureId": "0874-f03"
    },
    "troubadour.feature.4.navyk": {
      "featureId": "0874-f04"
    },
    "troubadour.feature.4.dukh-vremeni": {
      "featureId": "0874-f05"
    },
    "troubadour.feature.4.predznamenovanie": {
      "parentId": "troubadour.feature.4.dukh-vremeni",
      "featureId": "0874-f05"
    },
    "troubadour.feature.4.slushayte-slushayte": {
      "parentId": "troubadour.feature.4.dukh-vremeni",
      "featureId": "0874-f05"
    },
    "troubadour.feature.4.svezhie-spletni": {
      "parentId": "troubadour.feature.4.dukh-vremeni",
      "featureId": "0874-f05"
    },
    "troubadour.feature.5.osobennost-amplua-5-go-urovnya": {
      "featureId": "0875-f01"
    },
    "troubadour.feature.5.osobennosti-avtora": {
      "parentId": "troubadour.feature.5.osobennost-amplua-5-go-urovnya",
      "featureId": "0875-f01"
    },
    "troubadour.feature.5.popravim-na-postprodakshene": {
      "parentId": "troubadour.feature.5.osobennosti-avtora",
      "featureId": "0875-f01"
    },
    "troubadour.feature.5.dubl-dva": {
      "parentId": "troubadour.feature.5.osobennosti-avtora",
      "featureId": "0875-f01"
    },
    "troubadour.feature.5.osobennosti-duelyanta": {
      "parentId": "troubadour.feature.5.osobennost-amplua-5-go-urovnya",
      "featureId": "0875-f01"
    },
    "troubadour.feature.5.slovesnaya-duel": {
      "parentId": "troubadour.feature.5.osobennosti-duelyanta",
      "featureId": "0875-f01"
    },
    "troubadour.feature.5.nas-ne-zatmit": {
      "parentId": "troubadour.feature.5.osobennosti-duelyanta",
      "featureId": "0875-f01"
    },
    "troubadour.feature.5.osobennosti-virtuoza": {
      "parentId": "troubadour.feature.5.osobennost-amplua-5-go-urovnya",
      "featureId": "0875-f01"
    },
    "troubadour.feature.5.podderzhivayushchaya-perepalka": {
      "parentId": "troubadour.feature.5.osobennosti-virtuoza",
      "featureId": "0875-f01"
    },
    "troubadour.feature.5.medli": {
      "parentId": "troubadour.feature.5.osobennosti-virtuoza",
      "featureId": "0875-f01"
    },
    "troubadour.feature.5.sposobnost-za-9-dramy": {
      "featureId": "0875-f02"
    },
    "troubadour.feature.6.perk": {
      "featureId": "0876-f01"
    },
    "troubadour.feature.6.v-luchakh-prozhektora": {
      "featureId": "0876-f02"
    },
    "troubadour.feature.6.sposobnost-amplua-6-go-urovnya": {
      "featureId": "0876-f03"
    },
    "troubadour.feature.6.sposobnosti-avtora-6-go-urovnya": {
      "parentId": "troubadour.feature.6.sposobnost-amplua-6-go-urovnya",
      "featureId": "0876-f03"
    },
    "troubadour.feature.6.sposobnosti-duelyanta-6-go-urovnya": {
      "parentId": "troubadour.feature.6.sposobnost-amplua-6-go-urovnya",
      "featureId": "0876-f03"
    },
    "troubadour.feature.6.sposobnosti-virtuoza-6-go-urovnya": {
      "parentId": "troubadour.feature.6.sposobnost-amplua-6-go-urovnya",
      "featureId": "0876-f03"
    },
    "troubadour.feature.7.uvelichenie-kharakteristik": {
      "featureId": "0877-f01"
    },
    "troubadour.feature.7.ravnyy-billing": {
      "featureId": "0877-f02"
    },
    "troubadour.feature.7.muza-muzy": {
      "featureId": "0877-f03"
    },
    "troubadour.feature.7.navyk": {
      "featureId": "0877-f04"
    },
    "troubadour.feature.8.perk": {
      "featureId": "0878-f01"
    },
    "troubadour.feature.8.osobennost-amplua-8-go-urovnya": {
      "featureId": "0878-f02"
    },
    "troubadour.troupe.8.lyubimtsy-publiki": {
      "parentId": "troubadour.feature.8.osobennost-amplua-8-go-urovnya",
      "keyedBy": "troupe",
      "keyValue": "Виртуоз",
      "featureId": "0878-f02"
    },
    "troubadour.troupe.8.vyrezannaya-stsena": {
      "parentId": "troubadour.feature.8.osobennost-amplua-8-go-urovnya",
      "keyedBy": "troupe",
      "keyValue": "Автор",
      "featureId": "0878-f02"
    },
    "troubadour.troupe.8.shedevr": {
      "parentId": "troubadour.feature.8.osobennost-amplua-8-go-urovnya",
      "keyedBy": "troupe",
      "keyValue": "Дуэлянт",
      "featureId": "0878-f02"
    },
    "troubadour.feature.8.sposobnost-za-11-dramy": {
      "featureId": "0878-f03"
    },
    "troubadour.feature.9.rev-tolpy": {
      "featureId": "0879-f01"
    },
    "troubadour.feature.9.sposobnost-amplua-9-go-urovnya": {
      "featureId": "0879-f02"
    },
    "troubadour.feature.9.sposobnosti-avtora-9-go-urovnya": {
      "parentId": "troubadour.feature.9.sposobnost-amplua-9-go-urovnya",
      "featureId": "0879-f02"
    },
    "troubadour.feature.9.sposobnosti-duelyanta-9-go-urovnya": {
      "parentId": "troubadour.feature.9.sposobnost-amplua-9-go-urovnya",
      "featureId": "0879-f02"
    },
    "troubadour.feature.9.sposobnosti-virtuoza-9-go-urovnya": {
      "parentId": "troubadour.feature.9.sposobnost-amplua-9-go-urovnya",
      "featureId": "0879-f02"
    },
    "troubadour.feature.10.aplodismenty": {
      "featureId": "0880-f01"
    },
    "troubadour.feature.10.uvelichenie-kharakteristik": {
      "featureId": "0880-f02"
    },
    "troubadour.feature.10.dramaturgiya": {
      "featureId": "0880-f03"
    },
    "troubadour.feature.10.velichayshiy-vsekh-vremen": {
      "featureId": "0880-f04"
    },
    "troubadour.feature.10.perk": {
      "featureId": "0880-f05"
    },
    "troubadour.feature.10.navyk": {
      "featureId": "0880-f06"
    },
    "censor.feature.2.perk": {
      "featureId": "0882-f01"
    },
    "censor.feature.2.osobennosti-ordena-2-go-urovnya": {
      "featureId": "0882-f02"
    },
    "censor.order.2.eto-bylo-predskazano": {
      "parentId": "censor.feature.2.osobennosti-ordena-2-go-urovnya",
      "keyedBy": "order",
      "keyValue": "Оракул",
      "featureId": "0882-f02"
    },
    "censor.order.2.sudya-kharakterov": {
      "parentId": "censor.feature.2.osobennosti-ordena-2-go-urovnya",
      "keyedBy": "order",
      "keyValue": "Оракул",
      "featureId": "0882-f02"
    },
    "censor.order.2.vesti-za-soboy": {
      "parentId": "censor.feature.2.osobennosti-ordena-2-go-urovnya",
      "keyedBy": "order",
      "keyValue": "Идеал",
      "featureId": "0882-f02"
    },
    "censor.order.2.bditelnost-svyatogo": {
      "parentId": "censor.feature.2.osobennosti-ordena-2-go-urovnya",
      "keyedBy": "order",
      "keyValue": "Экзорцист",
      "featureId": "0882-f02"
    },
    "censor.order.2.chuvstvo-istiny": {
      "parentId": "censor.feature.2.osobennosti-ordena-2-go-urovnya",
      "keyedBy": "order",
      "keyValue": "Экзорцист",
      "featureId": "0882-f02"
    },
    "censor.order.2.nepokolebimyy-simvol": {
      "parentId": "censor.feature.2.osobennosti-ordena-2-go-urovnya",
      "keyedBy": "order",
      "keyValue": "Идеал",
      "featureId": "0882-f02"
    },
    "censor.feature.2.sposobnost-ordena-2-go-urovnya": {
      "featureId": "0882-f03"
    },
    "censor.feature.2.sposobnosti-ekzortsista-2-go-urovnya": {
      "parentId": "censor.feature.2.sposobnost-ordena-2-go-urovnya",
      "featureId": "0882-f03"
    },
    "censor.feature.2.sposobnosti-orakula-2-go-urovnya": {
      "parentId": "censor.feature.2.sposobnost-ordena-2-go-urovnya",
      "featureId": "0882-f03"
    },
    "censor.feature.2.sposobnosti-ideala-2-go-urovnya": {
      "parentId": "censor.feature.2.sposobnost-ordena-2-go-urovnya",
      "featureId": "0882-f03"
    },
    "censor.feature.3.uzrite-moi-dela-i-otchaytes": {
      "featureId": "0883-f01"
    },
    "censor.feature.3.sposobnost-za-7-gneva": {
      "featureId": "0883-f02"
    },
    "censor.feature.4.uvelichenie-kharakteristik": {
      "featureId": "0884-f01"
    },
    "censor.feature.4.perk": {
      "featureId": "0884-f02"
    },
    "censor.feature.4.navyk": {
      "featureId": "0884-f03"
    },
    "censor.feature.4.gnev-za-predelami-gneva": {
      "featureId": "0884-f04"
    },
    "censor.feature.4.osobennost-domena-4-go-urovnya": {
      "featureId": "0884-f05"
    },
    "censor.domain.4.blagoslovenie-zhizni": {
      "parentId": "censor.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Жизнь",
      "featureId": "0884-f05"
    },
    "censor.domain.4.blagoslovenie-tayn": {
      "parentId": "censor.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Хитрость",
      "featureId": "0884-f05"
    },
    "censor.domain.4.nepronitsaemoe-prikosnovenie": {
      "parentId": "censor.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Защита",
      "featureId": "0884-f05"
    },
    "censor.domain.4.uluchshennye-ruki-tvortsa": {
      "parentId": "censor.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Созидание",
      "featureId": "0884-f05"
    },
    "censor.domain.4.uluchshennoe-osvyashchennoe-oruzhie": {
      "parentId": "censor.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Война",
      "featureId": "0884-f05"
    },
    "censor.domain.4.prizyv-serdtsa": {
      "parentId": "censor.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Любовь",
      "featureId": "0884-f05"
    },
    "censor.domain.4.svet-otkroveniya": {
      "parentId": "censor.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Солнце",
      "featureId": "0884-f05"
    },
    "censor.domain.4.preduprezhdenie-orakula": {
      "parentId": "censor.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Судьба",
      "featureId": "0884-f05"
    },
    "censor.domain.4.spiriticheskiy-seans": {
      "parentId": "censor.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Смерть",
      "featureId": "0884-f05"
    },
    "censor.domain.4.prozrenie-svyatogo": {
      "parentId": "censor.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Знание",
      "featureId": "0884-f05"
    },
    "censor.domain.4.postup-vetra": {
      "parentId": "censor.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Буря",
      "featureId": "0884-f05"
    },
    "censor.domain.4.lesnaya-doroga": {
      "parentId": "censor.feature.4.osobennost-domena-4-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Природа",
      "featureId": "0884-f05"
    },
    "censor.feature.5.osobennost-ordena-5-go-urovnya": {
      "featureId": "0885-f01"
    },
    "censor.order.5.zlo-raskryto": {
      "parentId": "censor.feature.5.osobennost-ordena-5-go-urovnya",
      "keyedBy": "order",
      "keyValue": "Экзорцист",
      "featureId": "0885-f01"
    },
    "censor.order.5.prorochestvo": {
      "parentId": "censor.feature.5.osobennost-ordena-5-go-urovnya",
      "keyedBy": "order",
      "keyValue": "Оракул",
      "featureId": "0885-f01"
    },
    "censor.order.5.stoy-tverdo": {
      "parentId": "censor.feature.5.osobennost-ordena-5-go-urovnya",
      "keyedBy": "order",
      "keyValue": "Идеал",
      "featureId": "0885-f01"
    },
    "censor.feature.5.sposobnost-za-9-gneva": {
      "featureId": "0885-f02"
    },
    "censor.feature.6.orudie-gneva": {
      "featureId": "0886-f01"
    },
    "censor.feature.6.perk": {
      "featureId": "0886-f02"
    },
    "censor.feature.6.sposobnost-ordena-6-go-urovnya": {
      "featureId": "0886-f03"
    },
    "censor.feature.6.sposobnosti-ekzortsista-6-go-urovnya": {
      "parentId": "censor.feature.6.sposobnost-ordena-6-go-urovnya",
      "featureId": "0886-f03"
    },
    "censor.feature.6.sposobnosti-orakula-6-go-urovnya": {
      "parentId": "censor.feature.6.sposobnost-ordena-6-go-urovnya",
      "featureId": "0886-f03"
    },
    "censor.feature.6.sposobnosti-ideala-6-go-urovnya": {
      "parentId": "censor.feature.6.sposobnost-ordena-6-go-urovnya",
      "featureId": "0886-f03"
    },
    "censor.feature.7.uvelichenie-kharakteristik": {
      "featureId": "0887-f01"
    },
    "censor.feature.7.sosredotochennyy-gnev": {
      "featureId": "0887-f02"
    },
    "censor.feature.7.navyk": {
      "featureId": "0887-f03"
    },
    "censor.feature.7.osobennost-domena-7-go-urovnya": {
      "featureId": "0887-f04"
    },
    "censor.domain.7.blagoslovenie-zheleza": {
      "parentId": "censor.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Защита",
      "featureId": "0887-f04"
    },
    "censor.domain.7.zavet-serdtsa": {
      "parentId": "censor.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Любовь",
      "featureId": "0887-f04"
    },
    "censor.domain.7.bozhestvennyy-intendant": {
      "parentId": "censor.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Созидание",
      "featureId": "0887-f04"
    },
    "censor.domain.7.istochnik-blagodati": {
      "parentId": "censor.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Жизнь",
      "featureId": "0887-f04"
    },
    "censor.domain.7.biblioteka-bogov": {
      "parentId": "censor.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Знание",
      "featureId": "0887-f04"
    },
    "censor.domain.7.svet-palyashchego-solntsa": {
      "parentId": "censor.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Солнце",
      "featureId": "0887-f04"
    },
    "censor.domain.7.dary-prirody": {
      "parentId": "censor.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Природа",
      "featureId": "0887-f04"
    },
    "censor.domain.7.verkhom-na-molnii": {
      "parentId": "censor.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Буря",
      "featureId": "0887-f04"
    },
    "censor.domain.7.troitsa-khitrosti": {
      "parentId": "censor.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Хитрость",
      "featureId": "0887-f04"
    },
    "censor.domain.7.slovo-otlozhennoy-smerti": {
      "parentId": "censor.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Смерть",
      "featureId": "0887-f04"
    },
    "censor.domain.7.slovo-otklonennoy-sudby": {
      "parentId": "censor.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Судьба",
      "featureId": "0887-f04"
    },
    "censor.domain.7.vashi-triumfy-pomnyat": {
      "parentId": "censor.feature.7.osobennost-domena-7-go-urovnya",
      "keyedBy": "domain",
      "keyValue": "Война",
      "featureId": "0887-f04"
    },
    "censor.feature.8.perk": {
      "featureId": "0888-f01"
    },
    "censor.feature.8.osobennost-ordena-8-go-urovnya": {
      "featureId": "0888-f02"
    },
    "censor.order.8.demonolog": {
      "parentId": "censor.feature.8.osobennost-ordena-8-go-urovnya",
      "keyedBy": "order",
      "keyValue": "Экзорцист",
      "featureId": "0888-f02"
    },
    "censor.order.8.ikh-proshloe-raskryto": {
      "parentId": "censor.feature.8.osobennost-ordena-8-go-urovnya",
      "keyedBy": "order",
      "keyValue": "Оракул",
      "featureId": "0888-f02"
    },
    "censor.order.8.klyatva": {
      "parentId": "censor.feature.8.osobennost-ordena-8-go-urovnya",
      "keyedBy": "order",
      "keyValue": "Идеал",
      "featureId": "0888-f02"
    },
    "censor.feature.8.sposobnost-za-11-gneva": {
      "featureId": "0888-f03"
    },
    "censor.feature.9.uluchshennoe-orudie-gneva": {
      "featureId": "0889-f01"
    },
    "censor.feature.9.sposobnost-ordena-9-go-urovnya": {
      "featureId": "0889-f02"
    },
    "censor.feature.9.sposobnosti-ekzortsista-9-go-urovnya": {
      "parentId": "censor.feature.9.sposobnost-ordena-9-go-urovnya",
      "featureId": "0889-f02"
    },
    "censor.feature.9.sposobnosti-orakula-9-go-urovnya": {
      "parentId": "censor.feature.9.sposobnost-ordena-9-go-urovnya",
      "featureId": "0889-f02"
    },
    "censor.feature.9.sposobnosti-ideala-9-go-urovnya": {
      "parentId": "censor.feature.9.sposobnost-ordena-9-go-urovnya",
      "featureId": "0889-f02"
    },
    "censor.feature.10.uvelichenie-kharakteristik": {
      "featureId": "0890-f01"
    },
    "censor.feature.10.perk": {
      "featureId": "0890-f02"
    },
    "censor.feature.10.navyk": {
      "featureId": "0890-f03"
    },
    "censor.feature.10.khramovnik": {
      "featureId": "0890-f04"
    },
    "censor.feature.10.dobrodetel": {
      "featureId": "0890-f05"
    },
    "censor.feature.10.gnev-bogov": {
      "featureId": "0890-f06"
    },
    "elementalist.feature.2.perk": {
      "featureId": "0892-f01"
    },
    "elementalist.feature.2.osobennost-spetsializatsii-2-go-urovnya": {
      "featureId": "0892-f02"
    },
    "elementalist.specialization.2.uchenik-zemli": {
      "parentId": "elementalist.feature.2.osobennost-spetsializatsii-2-go-urovnya",
      "keyedBy": "specialization",
      "keyValue": "Земля",
      "featureId": "0892-f02"
    },
    "elementalist.specialization.2.uchenik-ognya": {
      "parentId": "elementalist.feature.2.osobennost-spetsializatsii-2-go-urovnya",
      "keyedBy": "specialization",
      "keyValue": "Огонь",
      "featureId": "0892-f02"
    },
    "elementalist.specialization.2.uchenik-zeleni": {
      "parentId": "elementalist.feature.2.osobennost-spetsializatsii-2-go-urovnya",
      "keyedBy": "specialization",
      "keyValue": "Зелень",
      "featureId": "0892-f02"
    },
    "elementalist.specialization.2.mezhdu-nami-net-prostranstva": {
      "parentId": "elementalist.feature.2.osobennost-spetsializatsii-2-go-urovnya",
      "keyedBy": "specialization",
      "keyValue": "Пустота",
      "featureId": "0892-f02"
    },
    "elementalist.feature.2.novaya-sposobnost-za-5-essentsii": {
      "featureId": "0892-f03"
    },
    "elementalist.feature.3.osobennost-spetsializatsii-3-go-urovnya": {
      "featureId": "0893-f01"
    },
    "elementalist.specialization.3.razgovor-s-ognem": {
      "parentId": "elementalist.feature.3.osobennost-spetsializatsii-3-go-urovnya",
      "keyedBy": "specialization",
      "keyValue": "Огонь",
      "featureId": "0893-f01"
    },
    "elementalist.specialization.3.rasstoyanie-eto-lish-pamyat": {
      "parentId": "elementalist.feature.3.osobennost-spetsializatsii-3-go-urovnya",
      "keyedBy": "specialization",
      "keyValue": "Пустота",
      "featureId": "0893-f01"
    },
    "elementalist.specialization.3.zemlya-prinimaet-menya": {
      "parentId": "elementalist.feature.3.osobennost-spetsializatsii-3-go-urovnya",
      "keyedBy": "specialization",
      "keyValue": "Земля",
      "featureId": "0893-f01"
    },
    "elementalist.specialization.3.vspomni-rost-solntse-i-dozhd": {
      "parentId": "elementalist.feature.3.osobennost-spetsializatsii-3-go-urovnya",
      "keyedBy": "specialization",
      "keyValue": "Зелень",
      "featureId": "0893-f01"
    },
    "elementalist.feature.3.sposobnost-za-7-essentsii": {
      "featureId": "0893-f02"
    },
    "elementalist.feature.4.uvelichenie-kharakteristik": {
      "featureId": "0894-f01"
    },
    "elementalist.feature.4.istochnik-essentsii": {
      "featureId": "0894-f02"
    },
    "elementalist.feature.4.mantiya-essentsii": {
      "featureId": "0894-f03"
    },
    "elementalist.specialization.4.goryashchie-zemli": {
      "parentId": "elementalist.feature.4.mantiya-essentsii",
      "keyedBy": "specialization",
      "keyValue": "Огонь",
      "featureId": "0894-f03"
    },
    "elementalist.specialization.4.tsvetushchaya-klumba": {
      "parentId": "elementalist.feature.4.mantiya-essentsii",
      "keyedBy": "specialization",
      "keyValue": "Зелень",
      "featureId": "0894-f03"
    },
    "elementalist.specialization.4.sotryasayushchayasya-zemlya": {
      "parentId": "elementalist.feature.4.mantiya-essentsii",
      "keyedBy": "specialization",
      "keyValue": "Земля",
      "featureId": "0894-f03"
    },
    "elementalist.specialization.4.sokryvayushchaya-postel": {
      "parentId": "elementalist.feature.4.mantiya-essentsii",
      "keyedBy": "specialization",
      "keyValue": "Пустота",
      "featureId": "0894-f03"
    },
    "elementalist.feature.4.perk": {
      "featureId": "0894-f04"
    },
    "elementalist.feature.4.navyk": {
      "featureId": "0894-f05"
    },
    "elementalist.feature.5.osobennost-spetsializatsii-5-go-urovnya": {
      "featureId": "0895-f01"
    },
    "elementalist.specialization.5.shkura-desyatikratnykh-shchitov": {
      "parentId": "elementalist.feature.5.osobennost-spetsializatsii-5-go-urovnya",
      "keyedBy": "specialization",
      "keyValue": "Зелень",
      "featureId": "0895-f01"
    },
    "elementalist.specialization.5.gora-ne-sdvinetsya": {
      "parentId": "elementalist.feature.5.osobennost-spetsializatsii-5-go-urovnya",
      "keyedBy": "specialization",
      "keyValue": "Земля",
      "featureId": "0895-f01"
    },
    "elementalist.specialization.5.probit-zavesu-materii": {
      "parentId": "elementalist.feature.5.osobennost-spetsializatsii-5-go-urovnya",
      "keyedBy": "specialization",
      "keyValue": "Пустота",
      "featureId": "0895-f01"
    },
    "elementalist.specialization.5.tleyushchiy-shag": {
      "parentId": "elementalist.feature.5.osobennost-spetsializatsii-5-go-urovnya",
      "keyedBy": "specialization",
      "keyValue": "Огонь",
      "featureId": "0895-f01"
    },
    "elementalist.feature.5.sposobnost-za-9-essentsii": {
      "featureId": "0895-f02"
    },
    "elementalist.feature.6.perk": {
      "featureId": "0896-f01"
    },
    "elementalist.feature.6.virding": {
      "featureId": "0896-f02"
    },
    "elementalist.feature.6.novaya-sposobnost-za-9-essentsii": {
      "featureId": "0896-f03"
    },
    "elementalist.feature.7.uvelichenie-kharakteristik": {
      "featureId": "0897-f01"
    },
    "elementalist.feature.7.mantiya-kvintessentsii": {
      "featureId": "0897-f02"
    },
    "elementalist.feature.7.burlyashchaya-essentsiya": {
      "featureId": "0897-f03"
    },
    "elementalist.feature.7.navyk": {
      "featureId": "0897-f04"
    },
    "elementalist.feature.8.perk": {
      "featureId": "0898-f01"
    },
    "elementalist.feature.8.osobennost-spetsializatsii-8-go-urovnya": {
      "featureId": "0898-f02"
    },
    "elementalist.specialization.8.zvezda-chernoy-dyry": {
      "parentId": "elementalist.feature.8.osobennost-spetsializatsii-8-go-urovnya",
      "keyedBy": "specialization",
      "keyValue": "Пустота",
      "featureId": "0898-f02"
    },
    "elementalist.specialization.8.khimericheskoe-proyavlenie": {
      "parentId": "elementalist.feature.8.osobennost-spetsializatsii-8-go-urovnya",
      "keyedBy": "specialization",
      "keyValue": "Зелень",
      "featureId": "0898-f02"
    },
    "elementalist.specialization.8.pervozdannoe-plamya": {
      "parentId": "elementalist.feature.8.osobennost-spetsializatsii-8-go-urovnya",
      "keyedBy": "specialization",
      "keyValue": "Огонь",
      "featureId": "0898-f02"
    },
    "elementalist.specialization.8.prizyv-istochnika-zemli": {
      "parentId": "elementalist.feature.8.osobennost-spetsializatsii-8-go-urovnya",
      "keyedBy": "specialization",
      "keyValue": "Земля",
      "featureId": "0898-f02"
    },
    "elementalist.feature.8.sposobnost-za-11-essentsii": {
      "featureId": "0898-f03"
    },
    "elementalist.feature.9.velikiy-virding": {
      "featureId": "0899-9-f01"
    },
    "elementalist.feature.9.novaya-sposobnost-za-11-essentsii": {
      "featureId": "0899-9-f02"
    },
    "elementalist.feature.10.veyanie": {
      "featureId": "0899-10-f01"
    },
    "elementalist.feature.10.uvelichenie-kharakteristik": {
      "featureId": "0899-10-f02"
    },
    "elementalist.feature.10.sushchnostnoe-bytie": {
      "featureId": "0899-10-f03"
    },
    "elementalist.feature.10.edinyy": {
      "featureId": "0899-10-f04"
    },
    "elementalist.specialization.10.master-zemli": {
      "parentId": "elementalist.feature.10.edinyy",
      "keyedBy": "specialization",
      "keyValue": "Земля",
      "featureId": "0899-10-f04"
    },
    "elementalist.specialization.10.master-ognya": {
      "parentId": "elementalist.feature.10.edinyy",
      "keyedBy": "specialization",
      "keyValue": "Огонь",
      "featureId": "0899-10-f04"
    },
    "elementalist.specialization.10.master-zeleni": {
      "parentId": "elementalist.feature.10.edinyy",
      "keyedBy": "specialization",
      "keyValue": "Зелень",
      "featureId": "0899-10-f04"
    },
    "elementalist.specialization.10.master-pustoty": {
      "parentId": "elementalist.feature.10.edinyy",
      "keyedBy": "specialization",
      "keyValue": "Пустота",
      "featureId": "0899-10-f04"
    },
    "elementalist.feature.10.perk": {
      "featureId": "0899-10-f05"
    },
    "elementalist.feature.10.navyk": {
      "featureId": "0899-10-f06"
    }
  }
) as const satisfies Record<string, ClassFeatureStructure>;

export const CLASS_FEATURE_STRUCTURE: Record<string, ClassFeatureStructure> =
  STRUCTURE;

export const CLASS_FEATURE_SYNTHETIC_ROWS: GeneratedClassFeature[] = [
  {
    id: "fury.feature.1.rastushchaya-svirepost-berserka-2",
    className: "Неистовый",
    level: 1,
    name: "Растущая свирепость Берсерка: 2",
    parentId: "fury.feature.1.rastushchaya-svirepost",
    keyValue: "2",
    articleId: "0801",
    description: "Всякий раз, когда вы используете маневр Отталкивания, расстояние принудительного движения получает бонус, равный показателю вашей Мощи.",
  },
  {
    id: "fury.feature.1.rastushchaya-svirepost-berserka-4",
    className: "Неистовый",
    level: 1,
    name: "Растущая свирепость Берсерка: 4",
    parentId: "fury.feature.1.rastushchaya-svirepost",
    keyValue: "4",
    articleId: "0801",
    description: "В первый раз, когда вы совершаете толчок существа в свой ход, вы получаете 1 всплеск.",
  },
  {
    id: "fury.feature.1.rastushchaya-svirepost-berserka-6",
    className: "Неистовый",
    level: 1,
    name: "Растущая свирепость Берсерка: 6",
    parentId: "fury.feature.1.rastushchaya-svirepost",
    keyValue: "6",
    articleId: "0801",
    description: "Вы получаете преимущество на тесты Мощи и маневр Отталкивания.",
  },
  {
    id: "fury.feature.4.rastushchaya-svirepost-berserka-8-4-y-uroven",
    className: "Неистовый",
    level: 4,
    name: "Растущая свирепость Берсерка: 8 (4-й уровень)",
    parentId: "fury.feature.1.rastushchaya-svirepost",
    keyValue: "8 (4-й уровень)",
    articleId: "0801",
    description: "В первый раз, когда вы совершаете толчок существа в свой ход, вы получаете 2 всплеска.",
  },
  {
    id: "fury.feature.7.rastushchaya-svirepost-berserka-10-7-y-uroven",
    className: "Неистовый",
    level: 7,
    name: "Растущая свирепость Берсерка: 10 (7-й уровень)",
    parentId: "fury.feature.1.rastushchaya-svirepost",
    keyValue: "10 (7-й уровень)",
    articleId: "0801",
    description: "Вы получаете двойное преимущество на тесты Мощи и маневр Отталкивания.",
  },
  {
    id: "fury.feature.10.rastushchaya-svirepost-berserka-12-10-y-uroven",
    className: "Неистовый",
    level: 10,
    name: "Растущая свирепость Берсерка: 12 (10-й уровень)",
    parentId: "fury.feature.1.rastushchaya-svirepost",
    keyValue: "12 (10-й уровень)",
    articleId: "0801",
    description: "Всякий раз, когда вы используете героическую способность, вы получаете 10 очков временной выносливости. Дополнительно, всякий раз, когда вы делаете бросок силы, который накладывает принудительное движение на цель, расстояние принудительного движения получает бонус, равный показателю вашей Мощи.",
  },
  {
    id: "fury.feature.1.rastushchaya-svirepost-razoritelya-2",
    className: "Неистовый",
    level: 1,
    name: "Растущая свирепость Разорителя: 2",
    parentId: "fury.feature.1.rastushchaya-svirepost",
    keyValue: "2",
    articleId: "0801",
    description: "Всякий раз, когда вы используете маневр Отталкивания, расстояние принудительного движения получает бонус, равный показателю вашей Ловкости.",
  },
  {
    id: "fury.feature.1.rastushchaya-svirepost-razoritelya-4",
    className: "Неистовый",
    level: 1,
    name: "Растущая свирепость Разорителя: 4",
    parentId: "fury.feature.1.rastushchaya-svirepost",
    keyValue: "4",
    articleId: "0801",
    description: "В первый раз, когда вы совершаете швыряние существа в свой ход, вы получаете 1 всплеск.",
  },
  {
    id: "fury.feature.1.rastushchaya-svirepost-razoritelya-6",
    className: "Неистовый",
    level: 1,
    name: "Растущая свирепость Разорителя: 6",
    parentId: "fury.feature.1.rastushchaya-svirepost",
    keyValue: "6",
    articleId: "0801",
    description: "Вы получаете преимущество на тесты Ловкости и маневр Отталкивания.",
  },
  {
    id: "fury.feature.4.rastushchaya-svirepost-razoritelya-8-4-y-uroven",
    className: "Неистовый",
    level: 4,
    name: "Растущая свирепость Разорителя: 8 (4-й уровень)",
    parentId: "fury.feature.1.rastushchaya-svirepost",
    keyValue: "8 (4-й уровень)",
    articleId: "0801",
    description: "В первый раз, когда вы совершаете швыряние существа в свой ход, вы получаете 2 всплеска.",
  },
  {
    id: "fury.feature.7.rastushchaya-svirepost-razoritelya-10-7-y-uroven",
    className: "Неистовый",
    level: 7,
    name: "Растущая свирепость Разорителя: 10 (7-й уровень)",
    parentId: "fury.feature.1.rastushchaya-svirepost",
    keyValue: "10 (7-й уровень)",
    articleId: "0801",
    description: "Вы получаете двойное преимущество на тесты Ловкости и маневр Отталкивания.",
  },
  {
    id: "fury.feature.10.rastushchaya-svirepost-razoritelya-12-10-y-uroven",
    className: "Неистовый",
    level: 10,
    name: "Растущая свирепость Разорителя: 12 (10-й уровень)",
    parentId: "fury.feature.1.rastushchaya-svirepost",
    keyValue: "12 (10-й уровень)",
    articleId: "0801",
    description: "Всякий раз, когда вы используете героическую способность, вы получаете 10 очков временной выносливости. Дополнительно, всякий раз, когда вы делаете бросок силы, который накладывает принудительное движение на цель, расстояние принудительного движения получает бонус, равный показателю вашей Ловкости.",
  },
  {
    id: "fury.aspect.1.linii-sily",
    className: "Неистовый",
    level: 1,
    name: "Линии силы",
    parentId: "fury.feature.1.trigger-aspekta",
    keyedBy: "aspect",
    keyValue: "Берсерк",
    articleId: "0801",
    description: "*Вы перенаправляете энергию движения.*\n\n| **Магия, Ближний** | **Триггер** |\n| ---------------- | --------------------------: |\n| **📏 Ближний 1** | **🎯 На себя или одно существо** |\n\n**Триггер:** Цель должна подвергнуться принудительному движению.\n\n**Эффект:** Вы можете выбрать новую цель того же размера или меньше в пределах расстояния, которая подвергнется принудительному движению вместо первоначальной. Вы становитесь источником принудительного движения, определяете место назначения новой цели и можете совершить толчок цели вместо использования первоначального типа принудительного движения. Дополнительно, расстояние принудительного движения получает бонус, равный показателю вашей Мощи.\n\n**Потратить 1 свирепости:** Вместо этого расстояние принудительного движения получает бонус, равный двукратному показателю вашей Мощи.",
  },
  {
    id: "fury.aspect.1.nezemnye-refleksy",
    className: "Неистовый",
    level: 1,
    name: "Неземные рефлексы",
    parentId: "fury.feature.1.trigger-aspekta",
    keyedBy: "aspect",
    keyValue: "Разоритель",
    articleId: "0801",
    description: "*Вы неуловимы, как колибри.*\n\n| **-** | **Триггер** |\n| ----------- | ------------: |\n| **📏 На себя** | **🎯 На себя** |\n\n**Триггер:** Вы получаете урон.\n\n**Эффект:** Вы получаете половину урона от срабатывающего эффекта и можете сместиться на количество клеток вплоть до показателя вашей Ловкости.\n\n**Потратить 1 свирепости:** Если урон имеет какие-либо эффекты потенциала, связанные с ним, потенциал уменьшается на 1 для вас.",
  },
  {
    id: "fury.aspect.1.yarostnoe-izmenenie",
    className: "Неистовый",
    level: 1,
    name: "Яростное изменение",
    parentId: "fury.feature.1.trigger-aspekta",
    keyedBy: "aspect",
    keyValue: "Буревестник",
    articleId: "0801",
    description: "*В гневе вы возвращаетесь в более звериную форму.*\n\n| **-** | **Триггер** |\n| ----------- | ------------: |\n| **📏 На себя** | **🎯 На себя** |\n\n**Триггер:** Вы теряете выносливость и не находитесь при смерти.\n\n**Эффект:** Вы получаете очки временной выносливости, равные показателю вашей Мощи, и можете войти в форму животного или форму гибрида.\n\n**Потратить 1 свирепости:** Если вы не находитесь при смерти, вы можете потратить Восстановление.",
  },
  {
    id: "null.feature.1.masterstvo-khronokinetika-2",
    className: "Нуль",
    level: 1,
    name: "Мастерство хронокинетика: 2",
    parentId: "null.feature.1.masterstvo-khronokinetika",
    keyValue: "2",
    articleId: "0811",
    description: "Всякий раз, когда вы используете маневр Отталкивания, вы можете использовать Действие отхода как свободный триггер либо до, либо после маневра.",
  },
  {
    id: "null.feature.1.masterstvo-khronokinetika-4",
    className: "Нуль",
    level: 1,
    name: "Мастерство хронокинетика: 4",
    parentId: "null.feature.1.masterstvo-khronokinetika",
    keyValue: "4",
    articleId: "0811",
    description: "В первый раз за ход, когда вы добровольно перемещаетесь на 1 или более клеток как часть способности, вы получаете 1 всплеск.",
  },
  {
    id: "null.feature.1.masterstvo-khronokinetika-6",
    className: "Нуль",
    level: 1,
    name: "Мастерство хронокинетика: 6",
    parentId: "null.feature.1.masterstvo-khronokinetika",
    keyValue: "6",
    articleId: "0811",
    description: "Вы получаете преимущество на маневры Захвата и Отталкивания.",
  },
  {
    id: "null.feature.4.masterstvo-khronokinetika-8-4-y-uroven",
    className: "Нуль",
    level: 4,
    name: "Мастерство хронокинетика: 8 (4-й уровень)",
    parentId: "null.feature.1.masterstvo-khronokinetika",
    keyValue: "8 (4-й уровень)",
    articleId: "0811",
    description: "В первый раз за ход, когда вы добровольно перемещаетесь на 1 или более клеток как часть способности, вы получаете 2 всплеска.",
  },
  {
    id: "null.feature.7.masterstvo-khronokinetika-10-7-y-uroven",
    className: "Нуль",
    level: 7,
    name: "Мастерство хронокинетика: 10 (7-й уровень)",
    parentId: "null.feature.1.masterstvo-khronokinetika",
    keyValue: "10 (7-й уровень)",
    articleId: "0811",
    description: "Вы получаете двойное преимущество на маневры Захвата и Отталкивания.",
  },
  {
    id: "null.feature.10.masterstvo-khronokinetika-12-10-y-uroven",
    className: "Нуль",
    level: 10,
    name: "Мастерство хронокинетика: 12 (10-й уровень)",
    parentId: "null.feature.1.masterstvo-khronokinetika",
    keyValue: "12 (10-й уровень)",
    articleId: "0811",
    description: "Всякий раз, когда вы подвергаете цель принудительному движению, расстояние принудительного движения получает бонус, равный показателю вашей Интуиции. Дополнительно, всякий раз, когда вы используете героическую способность, вы получаете 10 очков временной выносливости.",
  },
  {
    id: "null.feature.1.masterstvo-kriokinetika-2",
    className: "Нуль",
    level: 1,
    name: "Мастерство криокинетика: 2",
    parentId: "null.feature.1.masterstvo-kriokinetika",
    keyValue: "2",
    articleId: "0811",
    description: "Всякий раз, когда вы используете маневр Отталкивания, вы можете нацелиться на одно дополнительное существо. Дополнительно, всякий раз, когда вы наносите нетиповой урон псионической способностью, вы можете изменить его на урон холодом.",
  },
  {
    id: "null.feature.1.masterstvo-kriokinetika-4",
    className: "Нуль",
    level: 1,
    name: "Мастерство криокинетика: 4",
    parentId: "null.feature.1.masterstvo-kriokinetika",
    keyValue: "4",
    articleId: "0811",
    description: "В первый раз за ход, когда вы делаете существо схваченным или враг перемещается на 1 или более клеток в области вашей способности Поле нуля, вы получаете 1 всплеск.",
  },
  {
    id: "null.feature.1.masterstvo-kriokinetika-6",
    className: "Нуль",
    level: 1,
    name: "Мастерство криокинетика: 6",
    parentId: "null.feature.1.masterstvo-kriokinetika",
    keyValue: "6",
    articleId: "0811",
    description: "Вы получаете преимущество на маневры Захвата и Отталкивания.",
  },
  {
    id: "null.feature.4.masterstvo-kriokinetika-8-4-y-uroven",
    className: "Нуль",
    level: 4,
    name: "Мастерство криокинетика: 8 (4-й уровень)",
    parentId: "null.feature.1.masterstvo-kriokinetika",
    keyValue: "8 (4-й уровень)",
    articleId: "0811",
    description: "В первый раз за ход, когда вы делаете существо схваченным или враг перемещается на 1 или более клеток в области вашей способности Поле нуля, вы получаете 2 всплеска.",
  },
  {
    id: "null.feature.7.masterstvo-kriokinetika-10-7-y-uroven",
    className: "Нуль",
    level: 7,
    name: "Мастерство криокинетика: 10 (7-й уровень)",
    parentId: "null.feature.1.masterstvo-kriokinetika",
    keyValue: "10 (7-й уровень)",
    articleId: "0811",
    description: "Вы получаете двойное преимущество на маневры Захвата и Отталкивания.",
  },
  {
    id: "null.feature.10.masterstvo-kriokinetika-12-10-y-uroven",
    className: "Нуль",
    level: 10,
    name: "Мастерство криокинетика: 12 (10-й уровень)",
    parentId: "null.feature.1.masterstvo-kriokinetika",
    keyValue: "12 (10-й уровень)",
    articleId: "0811",
    description: "Всякий раз, когда вы подвергаете цель принудительному движению, расстояние принудительного движения получает бонус, равный показателю вашей Интуиции. Дополнительно, всякий раз, когда вы используете героическую способность, вы получаете 10 очков временной выносливости.",
  },
  {
    id: "null.feature.1.masterstvo-metakinetika-2",
    className: "Нуль",
    level: 1,
    name: "Мастерство метакинетика: 2",
    parentId: "null.feature.1.masterstvo-metakinetika",
    keyValue: "2",
    articleId: "0811",
    description: "Всякий раз, когда вы используете маневр Отталкивания, расстояние принудительного движения получает бонус, равный показателю вашей Интуиции.",
  },
  {
    id: "null.feature.1.masterstvo-metakinetika-4",
    className: "Нуль",
    level: 1,
    name: "Мастерство метакинетика: 4",
    parentId: "null.feature.1.masterstvo-metakinetika",
    keyValue: "4",
    articleId: "0811",
    description: "В первый раз в раунде боя, когда вы получаете урон или подвергаетесь принудительному движению, вы получаете 1 всплеск, даже если вы сопротивляетесь эффекту.",
  },
  {
    id: "null.feature.1.masterstvo-metakinetika-6",
    className: "Нуль",
    level: 1,
    name: "Мастерство метакинетика: 6",
    parentId: "null.feature.1.masterstvo-metakinetika",
    keyValue: "6",
    articleId: "0811",
    description: "Вы получаете преимущество на маневры Захвата и Отталкивания.",
  },
  {
    id: "null.feature.4.masterstvo-metakinetika-8-4-y-uroven",
    className: "Нуль",
    level: 4,
    name: "Мастерство метакинетика: 8 (4-й уровень)",
    parentId: "null.feature.1.masterstvo-metakinetika",
    keyValue: "8 (4-й уровень)",
    articleId: "0811",
    description: "В первый раз в раунде боя, когда вы получаете урон или подвергаетесь принудительному движению, вы получаете 2 всплеска, даже если вы сопротивляетесь эффекту.",
  },
  {
    id: "null.feature.7.masterstvo-metakinetika-10-7-y-uroven",
    className: "Нуль",
    level: 7,
    name: "Мастерство метакинетика: 10 (7-й уровень)",
    parentId: "null.feature.1.masterstvo-metakinetika",
    keyValue: "10 (7-й уровень)",
    articleId: "0811",
    description: "Вы получаете двойное преимущество на маневры Захвата и Отталкивания.",
  },
  {
    id: "null.feature.10.masterstvo-metakinetika-12-10-y-uroven",
    className: "Нуль",
    level: 10,
    name: "Мастерство метакинетика: 12 (10-й уровень)",
    parentId: "null.feature.1.masterstvo-metakinetika",
    keyValue: "12 (10-й уровень)",
    articleId: "0811",
    description: "Всякий раз, когда вы подвергаете цель принудительному движению, расстояние принудительного движения получает бонус, равный показателю вашей Интуиции. Дополнительно, всякий раз, когда вы используете героическую способность, вы получаете 10 очков временной выносливости.",
  },
  {
    id: "tactician.doctrine.1.prodvinutaya-taktika",
    className: "Тактик",
    level: 1,
    name: "Продвинутая тактика",
    parentId: "tactician.feature.1.trigger-doktriny",
    keyedBy: "doctrine",
    keyValue: "Повстанец",
    articleId: "0841",
    description: "*Ваше лидерство помогает союзнику.*\n\n| **Дальний** | **Триггер** |\n| ---------------- | --------------: |\n| **📏 Дальний 10** | **🎯 Один союзник** |\n\n**Триггер:** Цель наносит урон другому существу.\n\n**Эффект:** Цель получает 2 всплеска, которые она может использовать на вызвавший триггер урон.\n\n**Потратить 1 Фокуса:** Если урон имеет какой-либо эффект потенциала, связанный с ним, потенциал увеличивается на 1.",
  },
  {
    id: "tactician.doctrine.1.prikrytie",
    className: "Тактик",
    level: 1,
    name: "Прикрытие",
    parentId: "tactician.feature.1.trigger-doktriny",
    keyedBy: "doctrine",
    keyValue: "Воевода",
    articleId: "0841",
    description: "*Под вашим руководством союзник ждет подходящего момента для удара.*\n\n| **Дальний** | **Триггер** |\n| ---------------- | ------------------: |\n| **📏 Дальний 10** | **🎯 Одно существо** |\n\n**Триггер:** Цель перемещается.\n\n**Эффект:** В любое время во время движения цели, один союзник может нанести по ней свободный удар.\n\n**Потратить 1 Фокуса:** Если цель имеет Р < СРЕДНИЙ, она замедлена (КсХ).",
  },
  {
    id: "tactician.doctrine.1.parirovanie",
    className: "Тактик",
    level: 1,
    name: "Парирование",
    parentId: "tactician.feature.1.trigger-doktriny",
    keyedBy: "doctrine",
    keyValue: "Авангард",
    articleId: "0841",
    description: "*Ваши быстрые рефлексы лишают врага той точности, к которой он стремится.*\n\n| **Ближний, Оружие** | **Триггер** |\n| ----------------- | ----------------------: |\n| **📏 Ближний 2** | **🎯 На себя или один союзник** |\n\n**Триггер:** Существо наносит урон цели.\n\n**Эффект:** Вы можете сместиться на 1 клетку. Если цель — это вы, или если вы заканчиваете это смещение смежно с целью, цель получает половину урона. Если урон имеет какой-либо эффект потенциала, связанный с ним, потенциал уменьшается на 1.\n\n**Потратить 1 Фокуса:** Расстояние этой способности становится Ближний 1 + ваш показатель Разума, и вы можете сместиться вплоть до числа клеток, равного вашему показателю Разума, вместо 1 клетки.",
  },
  {
    id: "shadow.college.1.vo-vsey-etoy-nerazberikhe",
    className: "Тень",
    level: 1,
    name: "Во всей этой неразберихе",
    parentId: "shadow.feature.1.trigger-kollegii",
    keyedBy: "college",
    keyValue: "Черный Пепел",
    articleId: "0861",
    description: "*Вы исчезаете в облаке черного дыма, чтобы избежать опасности.*\n\n| **Магия** | **Триггер** |\n| ----------- | ------------: |\n| **📏 На себя** | **🎯 На себя** |\n\n**Триггер:** Вы получаете урон.\n\n**Эффект:** Вы получаете половину урона, затем можете телепортироваться вплоть до 4 клеток после того, как вызвавший триггер эффект разрешится.\n\n**Потратить 1+ Прозрения:** Вы телепортируетесь на 1 дополнительную клетку за каждое потраченное прозрение.",
  },
  {
    id: "shadow.college.1.zashchitnyy-perekat",
    className: "Тень",
    level: 1,
    name: "Защитный перекат",
    parentId: "shadow.feature.1.trigger-kollegii",
    keyedBy: "college",
    keyValue: "Едкая Алхимия",
    articleId: "0861",
    description: "*Когда враг атакует, вы перекатываетесь вместе с ударом, чтобы уменьшить урон.*\n\n| **-** | **Триггер** |\n| ----------- | ------------: |\n| **📏 На себя** | **🎯 На себя** |\n\n**Триггер:** Другое существо наносит вам урон.\n\n**Эффект:** Вы получаете половину вызвавшего триггер урона, затем можете сместиться вплоть до 2 клеток после того, как вызвавший триггер эффект разрешится. Если вы заканчиваете это смещение с покровом или укрытием, вы можете использовать маневр Скрытности, даже если за вами наблюдают.\n\n**Потратить 1 Прозрения:** Потенциал любых эффектов, связанных с уроном, уменьшается на 1 для вас.",
  },
  {
    id: "shadow.college.1.umnyy-tryuk",
    className: "Тень",
    level: 1,
    name: "Умный трюк",
    parentId: "shadow.feature.1.trigger-kollegii",
    keyedBy: "college",
    keyValue: "Маска Арлекина",
    articleId: "0861",
    description: "*Вы сеете мгновение замешательства в бою, приближаяя ваших врагов к погибели.*\n\n| **Магия** | **Триггер** |\n| ----------- | ------------: |\n| **📏 На себя** | **🎯 На себя** |\n\n**Триггер:** Враг нацеливается на вас ударом.\n\n**Эффект:** Выберите врага в пределах расстояния вызвавшего триггер удара, включая врага, который нацелился на вас. Удар вместо этого нацеливается на этого врага.",
  },
  {
    id: "troubadour.troupe.1.oko-za-oko",
    className: "Трубадур",
    level: 1,
    name: "Око за око",
    parentId: "troubadour.feature.1.trigger-amplua",
    keyedBy: "troupe",
    keyValue: "Автор",
    articleId: "0871",
    description: "*В любви и на войне все средства хороши.*\n\n| **Дальний** |       **Триггер** |\n| ---------------- | ------------------: |\n| **📏 Дальний 10** | **🎯 Одно существо** |\n\n**Триггер:** Цель делает бросок способности, который имеет преимущество, двойное преимущество, помеху или двойную помеху.\n\n**Эффект:** Преимущество на вызвавший триггер бросок становится помехой, или двойное преимущество становится преимуществом. Помеха становится преимуществом, или двойная помеха становится помехой.\n\n**Потратить 3 Драмы:** Преимущество на вызвавший триггер бросок становится двойной помехой, или двойное преимущество нивелируется. Помеха становится двойным преимуществом, или двойная помеха нивелируется.",
  },
  {
    id: "troubadour.troupe.1.ripost",
    className: "Трубадур",
    level: 1,
    name: "Рипост",
    parentId: "troubadour.feature.1.trigger-amplua",
    keyedBy: "troupe",
    keyValue: "Дуэлянт",
    articleId: "0871",
    description: "*\"Я бы прихватил вкусняшек, если бы знал, что буду драться с псом.\"*\n\n| **Ближний** |           **Триггер** |\n| -------------- | ----------------------: |\n| **📏 Ближний 1** | **🎯 На себя или один союзник** |\n\n**Триггер:** Цель получает урон от удара ближнего боя.\n\n**Эффект:** Цель делает свободный удар против существа, нанесшего вызвавший триггер удар.",
  },
  {
    id: "troubadour.troupe.1.garmonizatsiya",
    className: "Трубадур",
    level: 1,
    name: "Гармонизация",
    parentId: "troubadour.feature.1.trigger-amplua",
    keyedBy: "troupe",
    keyValue: "Виртуоз",
    articleId: "0871",
    description: "*Добавьте хору немного энергии.*\n\n| **Дальний** |   **Триггер** |\n| --------------- | --------------: |\n| **📏 Дальний 5** | **🎯 Один союзник** |\n\n**Триггер:** Цель использует способность, которая нацелена только на одного врага и стоит 3 или меньше ее героического ресурса.\n\n**Эффект:** Цель может выбрать одну дополнительную цель для вызвавшей триггер способности. Любой урон, нанесенный дополнительной цели, является уроном звуком.\n\n**Потратить 1+ Драмы:** Вы можете применить эту способность, когда цель использует способность, стоимость которой составляет 3 + каждая дополнительно потраченная драма героического ресурса.",
  },
  {
    id: "elementalist.specialization.1.kozha-kak-steny-zamka",
    className: "Элементалист",
    level: 1,
    name: "Кожа как стены замка",
    parentId: "elementalist.feature.1.trigger-spetsializatsii",
    keyedBy: "specialization",
    keyValue: "Земля",
    articleId: "0891",
    description: "*Вы покрываете себя или союзника защитным камнем.*\n\n| **Земля, Магия, Дальний** |           **Триггер** |\n| ------------------------ | ----------------------: |\n| **📏 Дальний 10** | **🎯 На себя или один союзник** |\n\n**Триггер:** Цель получает урон.\n\n**Эффект:** Цель получает половину урона.\n\n**Потратить 1 Эссенцию:** Если с уроном связан какой-либо эффект потенциала, его потенциал уменьшается на 1 для цели.",
  },
  {
    id: "elementalist.specialization.1.vzryvnaya-pomoshch",
    className: "Элементалист",
    level: 1,
    name: "Взрывная помощь",
    parentId: "elementalist.feature.1.trigger-spetsializatsii",
    keyedBy: "specialization",
    keyValue: "Огонь",
    articleId: "0891",
    description: "*Вы добавляете немного магии в агрессию союзника в самый подходящий момент.*\n\n| **Огонь, Магия, Дальний** |           **Триггер** |\n| ----------------------- | ----------------------: |\n| **📏 Дальний 10** | **🎯 На себя или один союзник** |\n\n**Триггер:** Цель принудительно перемещает существо или объект.\n\n**Эффект:** Расстояние принудительного движения получает бонус, равный показателю вашего Разума.\n\n**Потратить 1 Эссенцию:** Расстояние принудительного движения получает бонус, равный двойному показателю вашего Разума.",
  },
  {
    id: "elementalist.specialization.1.vospominanie-o-dykhanii-rassveta",
    className: "Элементалист",
    level: 1,
    name: "Воспоминание о дыхании рассвета",
    parentId: "elementalist.feature.1.trigger-spetsializatsii",
    keyedBy: "specialization",
    keyValue: "Зелень",
    articleId: "0891",
    description: "*Направляемая вами сила дает возможность вернуться в бой.*\n\n| **Зелень, Магия, Дальний** |           **Триггер** |\n| ------------------------ | ----------------------: |\n| **📏 Дальний 10** | **🎯 На себя или один союзник** |\n\n**Триггер:** Цель начинает свой ход или получает урон.\n\n**Эффект:** Цель может потратить Восстановление.\n\n**Потратить 1+ Эссенции:** Цель может потратить дополнительное Восстановление за каждую потраченную эссенцию.",
  },
  {
    id: "elementalist.specialization.1.nezametnoe-peremeshchenie",
    className: "Элементалист",
    level: 1,
    name: "Незаметное перемещение",
    parentId: "elementalist.feature.1.trigger-spetsializatsii",
    keyedBy: "specialization",
    keyValue: "Пустота",
    articleId: "0891",
    description: "*Вы призываете пустоту, чтобы поглотить и выплюнуть союзника.*\n\n| **Магия, Дальний, Пустота** |           **Триггер** |\n| ----------------------- | ----------------------: |\n| **📏 Дальний 10** | **🎯 На себя или один союзник** |\n\n**Триггер:** Цель начинает свой ход, перемещается или подвергается принудительному движению.\n\n**Эффект:** Вы телепортируете цель на количество клеток вплоть до показателя вашего Разума. Если цель перемещается, чтобы активировать эту способность, вы можете телепортировать ее в любой момент во время перемещения.\n\n**Потратить 1 Эссенцию:** Вы телепортируете цель на количество клеток вплоть до двойного показателя вашего Разума.",
  },
  {
    id: "conduit.domain.2.statuya-sily",
    className: "Проводник",
    level: 2,
    name: "Статуя силы",
    parentId: "conduit.feature.2.sposobnost-domena-2-go-urovnya",
    keyedBy: "domain",
    keyValue: "Созидание",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Мраморная статуя вашего божества восстает из земли.*\n\n| **Магия, Дальний** |   **Маневр** |\n| ----------------- | -------------: |\n| **📏 Дальний 10** | **🎯 Особая** |\n\n**Эффект:** Статуя размера 2 вырастает из земли на свободной клетке в пределах расстояния и остается до конца встречи. Находясь в пределах 3 клеток от статуи, вы получаете 1 всплеск в начале каждого вашего хода. Каждый союзник в пределах 3 клеток от статуи получает такое же преимущество. Статуя уничтожается, если она получает 20 или более урона. Она имеет иммунитет ко всему яду и психическому урону.",
  },
  {
    id: "conduit.domain.2.zhatva",
    className: "Проводник",
    level: 2,
    name: "Жатва",
    parentId: "conduit.feature.2.sposobnost-domena-2-go-urovnya",
    keyedBy: "domain",
    keyValue: "Смерть",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Боги вознаграждают тех, кто сокрушает их врагов.*\n\n| **Магия, Дальний** |     **Маневр** |\n| ----------------- | ---------------: |\n| **📏 Дальний 10** | **🎯 Каждый союзник** |\n\n**Эффект:** До начала вашего следующего хода, каждый раз, когда цель убивает врага, она восстанавливает Выносливость, равную 5 + показатель вашей Интуиции.",
  },
  {
    id: "conduit.domain.2.blagoslovenie-roka-i-sudby",
    className: "Проводник",
    level: 2,
    name: "Благословение рока и судьбы",
    parentId: "conduit.feature.2.sposobnost-domena-2-go-urovnya",
    keyedBy: "domain",
    keyValue: "Судьба",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Ваши враги терпят свой рок; ваши союзники принимают свою судьбу!*\n\n| **Магия, Дальний** |        **Основное действие** |\n| ----------------- | ---------------------: |\n| **📏 Дальний 10** | **🎯 Три существа** |\n\n**Эффект:** Вы можете выбрать себя вместо одного существа для этой способности. Выберите один из следующих эффектов, который длится до конца встречи или пока вы не окажетесь при смерти:\n\n- Всякий раз, когда цель делает бросок силы, она может бросить три кубика и выбрать, какие два результата использовать.\n- Всякий раз, когда цель делает бросок силы, она должна бросить три кубика и использовать два самых низких результата.",
  },
  {
    id: "conduit.domain.2.bogi-povelevayut-vam-povinovatsya",
    className: "Проводник",
    level: 2,
    name: "Боги повелевают вам повиноваться",
    parentId: "conduit.feature.2.sposobnost-domena-2-go-urovnya",
    keyedBy: "domain",
    keyValue: "Знание",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Вы говорите голосом своего святого, командуя врагами.*\n\n| **Магия, Дальний, Удар** |     **Основное действие** |\n| ------------------------- | ------------------: |\n| **📏 Дальний 10** | **🎯 Одно существо** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 4 + И святого урона; П < СЛАБЫЙ, перед получением урона цель совершает свободный удар по выбранной вами цели\n- **12-16:** 7 + И святого урона; П < СРЕДНИЙ, перед получением урона цель использует способность по вашему выбору, и вы выбираете любые цели для этой способности\n- **17+:** 11 + И святого урона; П < СИЛЬНЫЙ, перед получением урона цель смещается вплоть до своей скорости в выбранное вами место, использует способность по вашему выбору, и вы выбираете любые цели для этой способности",
  },
  {
    id: "conduit.domain.2.istochnik-blagodati",
    className: "Проводник",
    level: 2,
    name: "Источник благодати",
    parentId: "conduit.feature.2.sposobnost-domena-2-go-urovnya",
    keyedBy: "domain",
    keyValue: "Жизнь",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Святой свет исходит от вашего тела, исцеляя союзников.*\n\n| **Область, Магия** |              **Основное действие** |\n| --------------- | ---------------------------: |\n| **📏 Аура 3** | **🎯 Каждый союзник в области** |\n\n**Эффект:** До конца встречи или пока вы не окажетесь при смерти, всякий раз, когда цель начинает свой ход в области, она может потратить Восстановление.",
  },
  {
    id: "conduit.domain.2.nashi-serdtsa-vasha-sila",
    className: "Проводник",
    level: 2,
    name: "Наши сердца — ваша сила",
    parentId: "conduit.feature.2.sposobnost-domena-2-go-urovnya",
    keyedBy: "domain",
    keyValue: "Любовь",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Союзник черпает силу от своих друзей.*\n\n| **Магия, Дальний** |             **Маневр** |\n| ----------------- | -----------------------: |\n| **📏 Дальний 10** | **🎯 На себя и один союзник** |\n\n**Эффект:** До конца встречи или пока цель не окажется при смерти, в начале каждого своего хода цель получает бонус к скорости и бонус к выброшенному урону, равный количеству союзников в пределах 10 клеток от нее. Этот бонус длится до начала ее следующего хода.",
  },
  {
    id: "conduit.domain.2.priroda-sudit-tebya",
    className: "Проводник",
    level: 2,
    name: "Природа судит тебя",
    parentId: "conduit.feature.2.sposobnost-domena-2-go-urovnya",
    keyedBy: "domain",
    keyValue: "Природа",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Мистические колючие лозы появляются по вашему приказу и сковывают врагов.*\n\n| **Область, Магия, Дальний** |               **Основное действие** |\n| ----------------------- | ----------------------------: |\n| **📏 Куб 3 в пределах 10** | **🎯 Каждый враг в области** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 2 урона; Л < СЛАБЫЙ, опутанность (до прох.)\n- **12-16:** 3 урона; Л < СРЕДНИЙ, опутанность (до прох.)\n- **17+:** 7 урона; Л < СИЛЬНЫЙ, опутанность (до прох.)",
  },
  {
    id: "conduit.domain.2.svyashchennye-uzy",
    className: "Проводник",
    level: 2,
    name: "Священные узы",
    parentId: "conduit.feature.2.sposobnost-domena-2-go-urovnya",
    keyedBy: "domain",
    keyValue: "Защита",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Вы создаете божественную связь между двумя существами.*\n\n| **Магия, Дальний** |             **Маневр** |\n| ----------------- | -----------------------: |\n| **📏 Дальний 10** | **🎯 На себя и один союзник** |\n\n**Эффект:** До конца встречи, всякий раз, когда одна из целей получает урон, другая цель может использовать свободный триггер, чтобы получить этот урон вместо нее. Первоначальная цель страдает от любых эффектов, связанных с уроном. Дополнительно, всякий раз, когда одна из целей тратит Восстановление, другая цель может использовать свободный триггер, чтобы потратить Восстановление.",
  },
  {
    id: "conduit.domain.2.burya-svyatogo",
    className: "Проводник",
    level: 2,
    name: "Буря святого",
    parentId: "conduit.feature.2.sposobnost-domena-2-go-urovnya",
    keyedBy: "domain",
    keyValue: "Буря",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Появляется бушующий шторм, поражая врагов молнией и разбрасывая их ветром.*\n\n| **Область, Магия, Дальний** |               **Основное действие** |\n| ----------------------- | ----------------------------: |\n| **📏 Куб 3 в пределах 10** | **🎯 Каждый враг в области** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 2 урона молнией; вертикальное швыряние 1\n- **12-16:** 5 урона молнией; вертикальное швыряние 2\n- **17+:** 7 урона молнией; вертикальное швыряние 3",
  },
  {
    id: "conduit.domain.2.utrenniy-svet",
    className: "Проводник",
    level: 2,
    name: "Утренний свет",
    parentId: "conduit.feature.2.sposobnost-domena-2-go-urovnya",
    keyedBy: "domain",
    keyValue: "Солнце",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Свет сияет по вашей команде, обжигая врагов и благословляя союзников.*\n\n| **Область, Магия** |               **Основное действие** |\n| --------------- | ----------------------------: |\n| **📏 Взрыв 3** | **🎯 Каждый враг в области** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 4 урона огнем\n- **12-16:** 6 урона огнем\n- **17+:** 10 урона огнем\n\n**Эффект:** Каждый союзник в области наносит урон огнем, равный показателю вашей Интуиции, своим следующим ударом, сделанным до конца своего следующего хода.",
  },
  {
    id: "conduit.domain.2.bozhestvennaya-komediya",
    className: "Проводник",
    level: 2,
    name: "Божественная комедия",
    parentId: "conduit.feature.2.sposobnost-domena-2-go-urovnya",
    keyedBy: "domain",
    keyValue: "Хитрость",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Вы и ваши союзники меняетесь местами, чтобы сбить с толку врагов.*\n\n| **Область, Магия** |                          **Маневр** |\n| --------------- | ------------------------------------: |\n| **📏 Взрыв 5** | **🎯 На себя и каждый союзник в области** |\n\n**Эффект:** Каждая цель может выбрать другое существо в области, а затем поменяться с ним местами. Выбранное ею существо должно помещаться в оставленном ею пространстве, и наоборот.",
  },
  {
    id: "conduit.domain.2.blagoslovenie-prozreniya",
    className: "Проводник",
    level: 2,
    name: "Благословение прозрения",
    parentId: "conduit.feature.2.sposobnost-domena-2-go-urovnya",
    keyedBy: "domain",
    keyValue: "Война",
    articleId: "0832",
    featureId: "0832-f04",
    description: "*Боги даруют прозрение, открывая, куда лучше всего бить врагов.*\n\n| **Магия, Дальний** |              **Маневр** |\n| ----------------- | ------------------------: |\n| **📏 Дальний 10** | **🎯 На себя и каждый союзник** |\n\n**Эффект:** До конца встречи или пока вы не окажетесь при смерти, каждая цель получает 1 всплеск в конце каждого вашего хода.",
  },
  {
    id: "conduit.domain.6.mashina-bogov",
    className: "Проводник",
    level: 6,
    name: "Машина Богов",
    parentId: "conduit.feature.6.sposobnost-domena-6-go-urovnya",
    keyedBy: "domain",
    keyValue: "Созидание",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*Вы призываете жужжащий танк, сделанный из лезвий и металла.*\n\n| **Магия, Дальний** | **Основное действие** |\n| ----------------- | --------------- |\n| **📏 Дальний 10** | **🎯 Особая** |\n\n**Эффект:** Вы призываете катящуюся машину размера 2, которая появляется на свободной клетке в пределах расстояния. Машина имеет Выносливость 50 и иммунитет ко всему яду и психическому урону. Она исчезает в конце встречи, если ее Выносливость падает до 0, или если вы находитесь при смерти. Когда машина появляется впервые, сделайте следующий бросок силы один раз, нацеливая его на каждого врага, смежного с ней.\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 3 урона\n- **12-16:** 5 урона\n- **17+:** 8 урона\n\nОдин раз на каждом последующем ходу вы можете использовать свободный маневр, чтобы переместить машину на количество клеток вплоть до вашей Интуиции, а затем повторить бросок силы.",
  },
  {
    id: "conduit.domain.6.aura-dush",
    className: "Проводник",
    level: 6,
    name: "Аура душ",
    parentId: "conduit.feature.6.sposobnost-domena-6-go-urovnya",
    keyedBy: "domain",
    keyValue: "Смерть",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*Вихрь душ умерших летает вокруг вас по вашей команде.*\n\n| **Область, Магия** |                     **Маневр** |\n| --------------- | -------------------------------: |\n| **📏 Аура 4** | **🎯 Каждое существо в области** |\n\n**Эффект:** До конца встречи или пока вы не окажетесь при смерти, в конце каждого вашего хода вы можете совершить швыряние каждого существа в области вплоть до числа клеток, равного показателю вашей Интуиции. Это принудительное движение игнорирует устойчивость для ваших союзников.",
  },
  {
    id: "conduit.domain.6.tvoya-istoriya-zakanchivaetsya-zdes",
    className: "Проводник",
    level: 6,
    name: "Твоя история заканчивается здесь",
    parentId: "conduit.feature.6.sposobnost-domena-6-go-urovnya",
    keyedBy: "domain",
    keyValue: "Судьба",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*Вы искривляете судьбу врага, желая ему смерти.*\n\n| **Магия, Дальний, Удар** |     **Основное действие** |\n| ------------------------- | ------------------: |\n| **📏 Дальний 10** | **🎯 Одно существо** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 9 + И урона порчей; Р < СЛАБЫЙ, ослабление (до прох.)\n- **12-16:** 14 + И урона порчей; Р < СРЕДНИЙ, ослабление (до прох.)\n- **17+:** 19 + И урона порчей; Р < СИЛЬНЫЙ, ослабление (до прох.)\n\n**Эффект:** Если этот урон убивает цель, вы и каждый союзник в пределах расстояния можете потратить Восстановление.",
  },
  {
    id: "conduit.domain.6.prizyv-razrusheniya",
    className: "Проводник",
    level: 6,
    name: "Призыв разрушения",
    parentId: "conduit.feature.6.sposobnost-domena-6-go-urovnya",
    keyedBy: "domain",
    keyValue: "Знание",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*Вы произносите тайное слово разрушения, известное лишь божествам.*\n\n| **Область, Магия** |               **Основное действие** |\n| --------------- | ----------------------------: |\n| **📏 Взрыв 4** | **🎯 Каждый враг в области** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 3 урона звуком; толчок 3\n- **12-16:** 6 урона звуком; толчок 5\n- **17+:** 9 урона звуком; толчок 7\n\n**Особое:** Вы можете выбрать, чтобы эта способность наносила урон и толкала объекты, а также наносила урон строениям.",
  },
  {
    id: "conduit.domain.6.vosstanavlivayushchaya-blagodat",
    className: "Проводник",
    level: 6,
    name: "Восстанавливающая благодать",
    parentId: "conduit.feature.6.sposobnost-domena-6-go-urovnya",
    keyedBy: "domain",
    keyValue: "Жизнь",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*Жестом вы восстанавливаете свое здоровье и здоровье ваших союзников.*\n\n| **Область, Магия** |                       **Основное действие** |\n| --------------- | ------------------------------------: |\n| **📏 Взрыв 4** | **🎯 На себя и каждый союзник в области** |\n\n**Эффект:** Каждая цель может потратить любое количество Восстановлений. Дополнительно, каждая цель может завершить один эффект на себе, который заканчивается спасброском или который заканчивается в конце ее хода, или она может встать, если лежит.",
  },
  {
    id: "conduit.domain.6.voskhvalennyy-bogom",
    className: "Проводник",
    level: 6,
    name: "Восхваленный Богом",
    parentId: "conduit.feature.6.sposobnost-domena-6-go-urovnya",
    keyedBy: "domain",
    keyValue: "Любовь",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*Вы умоляете богов дать вашим союзникам то, что им нужно для победы в этот день, и боги отвечают.*\n\n| **Магия, Дальний** |      **Маневр** |\n| ----------------- | ----------------: |\n| **📏 Дальний 10** | **🎯 Два союзника** |\n\n**Эффект:** Каждая цель получает 3 своего Героического Ресурса.",
  },
  {
    id: "conduit.domain.6.natisk-dukhov",
    className: "Проводник",
    level: 6,
    name: "Натиск духов",
    parentId: "conduit.feature.6.sposobnost-domena-6-go-urovnya",
    keyedBy: "domain",
    keyValue: "Природа",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*Духи животных проносятся по полю боя, топча ваших врагов.*\n\n| **Область, Магия, Дальний** |               **Основное действие** |\n| --------------------------- | ----------------------------: |\n| **📏 Линия 10 x 2 в пределах 5** | **🎯 Каждый враг в области** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 5 урона; М < СЛАБЫЙ, лежачий и не может встать (до прох.)\n- **12-16:** 8 урона; М < СРЕДНИЙ, лежачий и не может встать (до прох.)\n- **17+:** 11 урона; М < СИЛЬНЫЙ, лежачий и не может встать (до прох.)",
  },
  {
    id: "conduit.domain.6.kirasa-bogov",
    className: "Проводник",
    level: 6,
    name: "Кираса Богов",
    parentId: "conduit.feature.6.sposobnost-domena-6-go-urovnya",
    keyedBy: "domain",
    keyValue: "Защита",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*Ваши союзники покрываются духовной броней.*\n\n| **Область, Магия, Дальний** |           **Маневр** |\n| ----------------------- | ---------------------: |\n| **📏 Дальний 10** | **🎯 Три существа** |\n\n**Эффект:** Вы можете выбрать себя вместо одного существа для этой способности. Каждая цель имеет иммунитет к урону 5 до начала вашего следующего хода.",
  },
  {
    id: "conduit.domain.6.povelitel-molniy",
    className: "Проводник",
    level: 6,
    name: "Повелитель молний",
    parentId: "conduit.feature.6.sposobnost-domena-6-go-urovnya",
    keyedBy: "domain",
    keyValue: "Буря",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*Молнии вырываются из вашего тела в разных направлениях.*\n\n| **Область, Магия** |               **Основное действие** |\n| ---------------------------------- | ----------------------------: |\n| **📏 Три линии 10 x 1 в пределах 1** | **🎯 Каждый враг в области** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 6 урона молнией; толчок 1\n- **12-16:** 9 урона молнией; толчок 2\n- **17+:** 13 урона молнией; толчок 3\n\n**Эффект:** Цели подвергаются принудительному движению по одной, начиная с ближайшей к вам цели, и могут быть оттолкнуты в других целей в той же линии.",
  },
  {
    id: "conduit.domain.6.blagoslovenie-poludennogo-solntsa",
    className: "Проводник",
    level: 6,
    name: "Благословение полуденного солнца",
    parentId: "conduit.feature.6.sposobnost-domena-6-go-urovnya",
    keyedBy: "domain",
    keyValue: "Солнце",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*Ваше тело излучает тепло, которое поджаривает врагов и вдохновляет союзников.*\n\n| **Область, Магия** |                              **Маневр** |\n| --------------- | ----------------------------------------: |\n| **📏 Аура 4** | **🎯 На себя и каждое существо в области** |\n\n**Эффект:** До конца встречи или пока вы не окажетесь при смерти, каждый враг в области получает помеху на броски силы, а вы и каждый союзник в области получаете 1 всплеск в конце каждого вашего хода.",
  },
  {
    id: "conduit.domain.6.prizyv-tayny",
    className: "Проводник",
    level: 6,
    name: "Призыв тайны",
    parentId: "conduit.feature.6.sposobnost-domena-6-go-urovnya",
    keyedBy: "domain",
    keyValue: "Хитрость",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*\"А теперь вы нас видите...\"*\n\n| **Область, Магия** |                          **Маневр** |\n| --------------- | ------------------------------------: |\n| **📏 Взрыв 4** | **🎯 На себя и каждый союзник в области** |\n\n**Эффект:** Каждая цель невидима до начала вашего следующего хода.",
  },
  {
    id: "conduit.domain.6.klinok-nebes",
    className: "Проводник",
    level: 6,
    name: "Клинок небес",
    parentId: "conduit.feature.6.sposobnost-domena-6-go-urovnya",
    keyedBy: "domain",
    keyValue: "Война",
    articleId: "0836",
    featureId: "0836-f03",
    description: "*С небес спускается огромный двуручный меч, угрожая пригвоздить вашего врага.*\n\n| **Магия, Дальний, Удар** |     **Основное действие** |\n| ------------------------- | ------------------: |\n| **📏 Дальний 5** | **🎯 Одно существо** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 8 + И урона; Л < СЛАБЫЙ, лежачий и опутанность (до прох.)\n- **12-16:** 12 + И урона; Л < СРЕДНИЙ, лежачий и опутанность (до прох.)\n- **17+:** 16 + И урона; Л < СИЛЬНЫЙ, лежачий и опутанность (до прох.)",
  },
  {
    id: "conduit.domain.9.bozhestvennyy-drakon",
    className: "Проводник",
    level: 9,
    name: "Божественный дракон",
    parentId: "conduit.feature.9.sposobnost-domena-9-go-urovnya",
    keyedBy: "domain",
    keyValue: "Созидание",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Одной лишь божественной волей вы создаете могущественного союзника.*\n\n| **Магия, Дальний** | **Основное действие** |\n| ----------------- | --------------: |\n| **📏 Дальний 10** |  **🎯 Особая** |\n\n**Эффект:** Вы призываете дракона размера 4, который появляется на свободной клетке в пределах расстояния. Дракон имеет скорость 6 и может летать, устойчивость 4, Выносливость 100, иммунитет ко всему урону огнем и использует ваши характеристики. Дракон исчезает в конце встречи, если его Выносливость падает до 0, или если вы находитесь при смерти.\n\nНа последующих ходах вы можете использовать основное действие, чтобы приказать дракону дохнуть магическим огнем в кубе 3 в пределах 1 клетки от него. Сделайте следующий бросок силы, нацеливая его на каждого врага в области.\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 5 урона огнем\n- **12-16:** 9 урона огнем\n- **17+:** 12 урона огнем\n\nДополнительно, вы можете использовать маневр, чтобы переместить дракона вплоть до его скорости, или сделать удар оружием ближнего боя его когтем по смежному существу или объекту. Дракон также может сделать этот удар как свободный удар.\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 3 + И урона\n- **12-16:** 5 + И урона\n- **17+:** 8 + И урона",
  },
  {
    id: "conduit.domain.9.slovo-okonchatelnogo-iskupleniya",
    className: "Проводник",
    level: 9,
    name: "Слово окончательного искупления",
    parentId: "conduit.feature.9.sposobnost-domena-9-go-urovnya",
    keyedBy: "domain",
    keyValue: "Смерть",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Твоя смерть послужит нашей победе.*\n\n| **Магия, Дальний** |  **Свободный триггер** |\n| ----------------- | ------------------: |\n| **📏 Дальний 10** | **🎯 Одно существо** |\n\n**Триггер:** Цель умирает.\n\n**Эффект:** Прежде чем цель умрет, вы можете посмотреть ее блок статов и заставить ее использовать одну способность, которая является основным действием или маневром. Если способность стоит Героического Ресурса или Раздора, существо может использовать ее без каких-либо затрат. Для цели использования этой способности ваши союзники и враги являются союзниками и врагами цели, и вы решаете, на кого нацелена способность.",
  },
  {
    id: "conduit.domain.9.iskrivlenie-sudby",
    className: "Проводник",
    level: 9,
    name: "Искривление судьбы",
    parentId: "conduit.feature.9.sposobnost-domena-9-go-urovnya",
    keyedBy: "domain",
    keyValue: "Судьба",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Боги знают, что вы должны победить, и они благословляют вашу судьбу.*\n\n| **Магия, Дальний** |         **Основное действие** |\n| ----------------- | ----------------------: |\n| **📏 Дальний 10** | **🎯 На себя или один союзник** |\n\n**Эффект:** До конца встречи или пока вы не окажетесь при смерти, каждый бросок силы цели улучшает свой результат на один тир.",
  },
  {
    id: "conduit.domain.9.slovo-oslableniya",
    className: "Проводник",
    level: 9,
    name: "Слово ослабления",
    parentId: "conduit.feature.9.sposobnost-domena-9-go-urovnya",
    keyedBy: "domain",
    keyValue: "Знание",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Вы произносите божественное слово, которое делает врага хрупким.*\n\n| **Магия, Дальний, Удар** |               **Основное действие** |\n| ------------------------- | ----------------------------: |\n| **📏 Дальний 10** | **🎯 Одно существо или объект** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 10 + И урона порчей; Л < СЛАБЫЙ, ослабление (до прох.)\n- **12-16:** 15 + И урона порчей; Л < СРЕДНИЙ, ослабление (до прох.)\n- **17+:** 21 + И урона порчей; Л < СИЛЬНЫЙ, ослабление (до прох.)\n\n**Эффект:** Будучи ослабленной таким образом, цель имеет уязвимость к урону 10.",
  },
  {
    id: "conduit.domain.9.siyanie-blagodati",
    className: "Проводник",
    level: 9,
    name: "Сияние благодати",
    parentId: "conduit.feature.9.sposobnost-domena-9-go-urovnya",
    keyedBy: "domain",
    keyValue: "Жизнь",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Интенсивный свет излучается из вашего тела, исцеляя ваших союзников.*\n\n| **Магия, Дальний** |    **Основное действие** |\n| ----------------- | -----------------: |\n| **📏 Дальний 10** | **🎯 Четыре союзника** |\n\n**Эффект:** Вы можете выбрать себя вместо одного союзника для этой способности. Каждая цель может потратить любое количество Восстановлений, может завершить любые эффекты на себе, которые заканчиваются спасброском или которые заканчиваются в конце ее хода, и может встать, если лежит.",
  },
  {
    id: "conduit.domain.9.zhivost-serdtsa",
    className: "Проводник",
    level: 9,
    name: "Живость сердца",
    parentId: "conduit.feature.9.sposobnost-domena-9-go-urovnya",
    keyedBy: "domain",
    keyValue: "Любовь",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Вы произносите вдохновляющие слова другу и побуждаете его на невероятные подвиги.*\n\n| **Магия, Дальний** |    **Маневр** |\n| ----------------- | --------------: |\n| **📏 Дальний 10** | **🎯 Один союзник** |\n\n**Эффект:** Цель получает дополнительное основное действие, которое она может использовать в свой следующий ход, и получает 3 очка своего Героического Ресурса.",
  },
  {
    id: "conduit.domain.9.shipastaya-kletka",
    className: "Проводник",
    level: 9,
    name: "Шипастая клетка",
    parentId: "conduit.feature.9.sposobnost-domena-9-go-urovnya",
    keyedBy: "domain",
    keyValue: "Природа",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Лозы вырываются из-под земли и сковывают вашего врага, медленно смыкаясь вокруг него.*\n\n| **Магия, Дальний, Удар** |     **Основное действие** |\n| ------------------------- | ------------------: |\n| **📏 Дальний 10** | **🎯 Одно существо** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 10 + И урона; Л < СЛАБЫЙ, опутанность (до прох.)\n- **12-16:** 15 + И урона; Л < СРЕДНИЙ, опутанность (до прох.)\n- **17+:** 21 + И урона; Л < СИЛЬНЫЙ, опутанность (до прох.)\n\n**Эффект:** Находясь в состоянии опутанности таким образом, цель получает 10 урона в начале каждого вашего хода.",
  },
  {
    id: "conduit.domain.9.blagoslovenie-kreposti",
    className: "Проводник",
    level: 9,
    name: "Благословение крепости",
    parentId: "conduit.feature.9.sposobnost-domena-9-go-urovnya",
    keyedBy: "domain",
    keyValue: "Защита",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Магический круг расходится от вас, не позволяя врагам подойти близко.*\n\n| **Область, Магия** | **Маневр** |\n| ---------------------- | -----------: |\n| **📏 На себя; смотрите ниже** |  **🎯 На себя** |\n\n**Эффект:** До конца встречи или пока вы не окажетесь при смерти, ни один враг не может приблизиться на расстояние 5 клеток от вас, перемещаясь или подвергаясь принудительному движению со стороны любого врага. Цели могут быть принудительно перемещены ближе к вам вами или вашими союзниками, или могут оказаться ближе из-за вашего перемещения.",
  },
  {
    id: "conduit.domain.9.bozhestvennyy-shtorm",
    className: "Проводник",
    level: 9,
    name: "Божественный шторм",
    parentId: "conduit.feature.9.sposobnost-domena-9-go-urovnya",
    keyedBy: "domain",
    keyValue: "Буря",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Вы призываете божественный шторм, который остается под вашим контролем.*\n\n| **Область, Магия, Дальний** |               **Основное действие** |\n| ----------------------- | ----------------------------: |\n| **📏 Куб 5 в пределах 5** | **🎯 Каждый враг в области** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 2 урона молнией, 2 урона звуком\n- **12-16:** 3 урона молнией, 3 урона звуком\n- **17+:** 5 урона молнией, 5 урона звуком\n\n**Эффект:** Бушующий шторм заполняет область до конца встречи или пока вы не окажетесь при смерти. В начале каждого вашего хода вы можете перемещать шторм на расстояние вплоть до 5 клеток (действие не требуется). На последующих ходах, пока шторм активен, вы можете использовать маневр, чтобы сделать его бросок силы.",
  },
  {
    id: "conduit.domain.9.solnechnaya-vspyshka",
    className: "Проводник",
    level: 9,
    name: "Солнечная вспышка",
    parentId: "conduit.feature.9.sposobnost-domena-9-go-urovnya",
    keyedBy: "domain",
    keyValue: "Солнце",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Вы призываете сферу огня, которая сжигает ваших врагов дотла.*\n\n| **Область, Магия, Дальний** |               **Основное действие** |\n| ----------------------- | ----------------------------: |\n| **📏 Куб 5 в пределах 10** | **🎯 Каждый враг в области** |\n\n**Бросок силы + Интуиция:**\n\n- **≤11:** 9 урона огнем\n- **12-16:** 14 урона огнем\n- **17+:** 19 урона огнем",
  },
  {
    id: "conduit.domain.9.nastupaet-noch",
    className: "Проводник",
    level: 9,
    name: "Наступает ночь",
    parentId: "conduit.feature.9.sposobnost-domena-9-go-urovnya",
    keyedBy: "domain",
    keyValue: "Хитрость",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Вы призываете тьму, которая мешает только вашим врагам.*\n\n| **Область, Магия, Дальний** | **Основное действие** |\n| ----------------------- | --------------: |\n| **📏 Куб 5 в пределах 10** |  **🎯 Особая** |\n\n**Эффект:** До конца встречи или пока вы не окажетесь при смерти, область заполняется магической тьмой, через которую не могут видеть ваши враги, но вы и ваши союзники можете.",
  },
  {
    id: "conduit.domain.9.pravednaya-falanga",
    className: "Проводник",
    level: 9,
    name: "Праведная фаланга",
    parentId: "conduit.feature.9.sposobnost-domena-9-go-urovnya",
    keyedBy: "domain",
    keyValue: "Война",
    articleId: "0839",
    featureId: "0839-f03",
    description: "*Стена из вращающихся мечей и ножей появляется там, где вы пожелаете.*\n\n| **Область, Магия, Дальний** | **Основное действие** |\n| ------------------------ | --------------: |\n| **📏 Стена 15 в пределах 10** |  **🎯 Особая** |\n\n**Эффект:** Стена остается до конца встречи или пока вы не окажетесь при смерти, и может быть размещена на занятых клетках. Существа могут входить и проходить сквозь стену. Каждый враг, который входит в область в первый раз за раунд боя или начинает там свой ход, получает 15 урона.",
  },
];
