/**
 * Связь домена Цензора со способностью, которую выдаёт его доменная особенность.
 *
 * Источники: каноническая проекция `generated/consumers/features.json` (у
 * записи домена прямо сказано «У вас есть следующая способность»), карточка из
 * `generated/consumers/abilities.json` и `level-up.json` (`grantedAbilities` у
 * Цензора пуст, связи нет — восстанавливаем её здесь по тексту).
 *
 * У Цензора один домен, поэтому способность не выбирается: она приходит вместе
 * с особенностью своего уровня.
 */
export interface CensorDomainAbility {
  level: 1 | 4 | 7;
  domain: string;
  abilityId: string;
  /** Запись скелета, из текста которой взята связь. */
  featureId: string;
}

export const censorDomainAbilities: readonly CensorDomainAbility[] = [
  // 1-й уровень: эти карточки выдаёт уже билдер (DOMAIN_GRANTED_ABILITIES по
  // имени), запись нужна для сверки полноты и для теста.
  {
    level: 1,
    domain: "Созидание",
    abilityId: "cenzor-ruki-tvorca-3425397e10",
    featureId: "censor.domain.1.ruki-tvortsa",
  },
  {
    level: 1,
    domain: "Смерть",
    abilityId: "cenzor-mogilnaya-rech-9278e7b3ff",
    featureId: "censor.domain.1.mogilnaya-rech",
  },
  {
    level: 1,
    domain: "Природа",
    abilityId: "cenzor-vernyy-drug-225ee009e1",
    featureId: "censor.domain.1.vernyy-drug",
  },
  // 4-й и 7-й уровни: способность выдаёт повышение уровня.
  {
    level: 4,
    domain: "Хитрость",
    abilityId: "cenzor-blagoslovenie-tayn-495d24a291",
    featureId: "censor.domain.4.blagoslovenie-tayn",
  },
  {
    level: 7,
    domain: "Любовь",
    abilityId: "cenzor-vedomyy-k-tebe-b7901eb438",
    featureId: "censor.domain.7.zavet-serdtsa",
  },
  {
    level: 7,
    domain: "Хитрость",
    abilityId: "cenzor-troica-hitrosti-2ecc3107cb",
    featureId: "censor.domain.7.troitsa-khitrosti",
  },
];
