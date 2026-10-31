/**
 * Связь домена Цензора со способностью, которую выдаёт его доменная особенность.
 *
 * Источники: `class-features.generated.json` (у записи домена прямо сказано
 * «У вас есть следующая способность»), `abilities.generated.json` (карточка) и
 * `level-up.generated.json` (`grantedAbilities` у Цензора пуст, связи нет —
 * восстанавливаем её здесь по тексту).
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
    abilityId: "feature.ability.censor.level-1.hands-of-the-maker",
    featureId: "feature.censor.level-1.hands-of-the-maker",
  },
  {
    level: 1,
    domain: "Смерть",
    abilityId: "feature.ability.censor.level-1.grave-speech",
    featureId: "feature.censor.level-1.grave-speech",
  },
  {
    level: 1,
    domain: "Природа",
    abilityId: "feature.ability.censor.level-1.faithful-friend",
    featureId: "feature.censor.level-1.faithful-friend",
  },
  // 4-й и 7-й уровни: способность выдаёт повышение уровня.
  {
    level: 4,
    domain: "Хитрость",
    abilityId: "feature.ability.censor.level-4.blessing-of-secrets",
    featureId: "feature.censor.level-4.blessing-of-secrets",
  },
  {
    level: 7,
    domain: "Любовь",
    abilityId: "feature.ability.censor.level-7.guided-to-your-side",
    featureId: "feature.censor.level-7.covenant-of-the-heart",
  },
  {
    level: 7,
    domain: "Хитрость",
    abilityId: "feature.ability.censor.level-7.trinity-of-trickery",
    featureId: "feature.censor.level-7.trinity-of-trickery",
  },
];
