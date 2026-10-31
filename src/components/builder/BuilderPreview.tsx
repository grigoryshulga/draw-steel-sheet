import type { Ability, Character, DerivedStats } from "../../types";
import { CHARACTERISTICS } from "../../lib/rules";
import { Button } from "../ui";

export function BuilderPreview({
  hero,
  derived,
  seedAbilities,
  busy,
  onReset,
}: {
  hero: Character;
  derived: DerivedStats;
  seedAbilities: Ability[];
  busy: boolean;
  onReset: () => void;
}) {
  return (
    <aside
      className="builder-preview"
      aria-label="Предварительный лист героя"
    >
      <span className="eyebrow">Ваш герой</span>
      <h2>{hero.name}</h2>
      <p>
        {[hero.ancestry, hero.className].filter(Boolean).join(" · ") ||
          "История начинается здесь"}
      </p>
      <div className="builder-preview-stats">
        {CHARACTERISTICS.map((c) => (
          <div key={c.key}>
            <span>{c.short}</span>
            <strong>
              {hero.characteristics[c.key] > 0 ? "+" : ""}
              {hero.characteristics[c.key]}
            </strong>
          </div>
        ))}
      </div>
      <dl>
        <div>
          <dt>Выносливость</dt>
          <dd>{hero.stamina.max}</dd>
        </div>
        <div>
          <dt>Восстановления</dt>
          <dd>
            {hero.recoveries.max} × {derived.recoveryValue}
          </dd>
        </div>
        <div>
          <dt>Скорость</dt>
          <dd>{hero.speed}</dd>
        </div>
        <div>
          <dt>Устойчивость</dt>
          <dd>{hero.stability}</dd>
        </div>
        <div>
          <dt>Ресурс</dt>
          <dd>{hero.heroicResource.name}</dd>
        </div>
      </dl>
      {hero.career && (
        <div>
          <span className="eyebrow">Карьера</span>
          <p>{hero.career}</p>
        </div>
      )}
      {hero.kit && (
        <div>
          <span className="eyebrow">Комплекты</span>
          <p>{[hero.kit, hero.secondaryKit].filter(Boolean).join(", ")}</p>
        </div>
      )}
      {hero.skills.length > 0 && (
        <div>
          <span className="eyebrow">Навыки · {hero.skills.length}</span>
          <p className="small">{hero.skills.join(", ")}</p>
        </div>
      )}
      <div>
        <span className="eyebrow">
          Способности · {hero.abilities.length}
        </span>
        <p className="small">
          {hero.abilities
            .filter((a) => !seedAbilities.some((b) => b.id === a.id))
            .map((a) => a.name)
            .join(", ") || "Свободные удары и базовые действия"}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        disabled={busy}
      >
        Начать заново
      </Button>
    </aside>
  );
}
