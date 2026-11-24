import { localizeGameMessage } from "../../i18n/game-messages";
import { builderAbilityName, useBuilderNames } from "./choice-language";
import { useLocale } from "../../i18n/locale";
import type { Ability, Character, DerivedStats } from "../../types";
import { CHARACTERISTICS } from "../../lib/rules";
import { Button } from "../ui";

export function BuilderPreview({
  hero,
  draftName,
  derived,
  seedAbilities,
  busy,
  onReset,
}: {
  hero: Character;
  draftName: string;
  derived: DerivedStats;
  seedAbilities: Ability[];
  busy: boolean;
  onReset: () => void;
}) {
  const { t, locale } = useLocale();
  const label = useBuilderNames(locale, hero.className);
  return (
    <aside className="builder-preview" aria-label={t("Предварительный лист героя", "Hero preview")}>
      <h2>{draftName.trim() || t("Новый герой", "New hero")}</h2>
      <p>{[hero.ancestry, hero.className].map(label).filter(Boolean).join(" · ")}</p>
      <div className="builder-preview-stats">
        {CHARACTERISTICS.map((c) => (
          <div key={c.key}>
            <span>{locale === "en" ? c.key[0].toUpperCase() : c.short}</span>
            <strong>
              {hero.characteristics[c.key] > 0 ? "+" : ""}
              {hero.characteristics[c.key]}
            </strong>
          </div>
        ))}
      </div>
      <dl>
        <div>
          <dt>{t("Выносливость", "Stamina")}</dt>
          <dd>{hero.stamina.max}</dd>
        </div>
        <div>
          <dt>{t("Восстановления", "Recoveries")}</dt>
          <dd>
            {hero.recoveries.max} × {derived.recoveryValue}
          </dd>
        </div>
        <div>
          <dt>{t("Скорость", "Speed")}</dt>
          <dd>{hero.speed}</dd>
        </div>
        <div>
          <dt>{t("Устойчивость", "Stability")}</dt>
          <dd>{hero.stability}</dd>
        </div>
        <div>
          <dt>{t("Ресурс", "Resource")}</dt>
          <dd>{localizeGameMessage(hero.heroicResource.name, locale)}</dd>
        </div>
      </dl>
      {hero.career && (
        <div>
          <span className="eyebrow">{t("Карьера", "Career")}</span>
          <p>{label(hero.career)}</p>
        </div>
      )}
      {hero.kit && (
        <div>
          <span className="eyebrow">{t("Комплекты", "Kits")}</span>
          <p>{[hero.kit, hero.secondaryKit].map(label).filter(Boolean).join(", ")}</p>
        </div>
      )}
      {hero.skills.length > 0 && (
        <div>
          <span className="eyebrow">{t("Навыки", "Skills")} · {hero.skills.length}</span>
          <p className="small">{hero.skills.map(label).join(", ")}</p>
        </div>
      )}
      <div>
        <span className="eyebrow">{t("Способности", "Abilities")} · {hero.abilities.length}</span>
        <p className="small">
          {hero.abilities
            .filter((a) => !seedAbilities.some((b) => b.id === a.id))
            .map((a) => builderAbilityName(a, locale))
            .join(", ") || t("Свободные удары и базовые действия", "Free strikes and basic actions")}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={onReset} disabled={busy}>
        {t("Начать заново", "Start over")}
      </Button>
    </aside>
  );
}
