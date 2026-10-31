import { canUseKit } from "../../../data/creation-rules";
import { KIT_COMPENDIUM, kitBonusLabel } from "../../../data/kits";
import { BuilderOptionCard } from "../../BuilderOptionCard";
import { Field, Select } from "../../ui";
import { useBuilderStep } from "../BuilderStepContext";
import { selectedFirst } from "../selectedFirst";

export function KitStep() {
  const { draft, patch } = useBuilderStep();

  return (
    <>
      {canUseKit(draft.className, draft.subclass) ? (
        <>
          <p className="builder-intro">
            Комплект даёт снаряжение, бонусы и знаковую способность. Они
            попадут в лист автоматически.
          </p>
          <a className="builder-step-link" href="#/codex/0901" target="_blank" rel="noreferrer">
            Комплекты в Кодексе ↗
          </a>
          {draft.className === "Тактик" && (
            <Field label="Второй комплект · Полевой арсенал">
              <Select
                value={draft.secondaryKit}
                onChange={(e) =>
                  patch({ secondaryKit: e.target.value })
                }
              >
                <option value="">Выберите второй комплект</option>
                {KIT_COMPENDIUM.filter((k) => k.name !== draft.kit).map(
                  (k) => (
                    <option key={k.id}>{k.name}</option>
                  ),
                )}
              </Select>
            </Field>
          )}
          <div className="builder-option-grid builder-pinned-options">
            {selectedFirst(KIT_COMPENDIUM, (k) => k.name === draft.kit).map((k) => (
              <BuilderOptionCard
                key={k.id}
                kind="kit"
                name={k.name}
                selected={draft.kit === k.name}
                disabled={k.name === draft.secondaryKit}
                onSelect={() => patch({ kit: k.name })}
              >
                <div className="builder-option-kit">
                  <p>{k.equipment}</p>
                  <p>
                    {k.bonuses
                      .map((b) => `${kitBonusLabel(b.label)} ${b.value}`)
                      .join(" · ")}
                  </p>
                  <p>Знаковая: {k.signatureAbility}</p>
                </div>
              </BuilderOptionCard>
            ))}
          </div>
          {draft.secondaryKit &&
            (["meleeDamageKit", "rangedDamageKit"] as const).map(
              (key, i) => (
                <Field
                  key={key}
                  label={`Бонус к урону ${i === 0 ? "ближнего" : "дальнего"} боя — от одного комплекта`}
                >
                  <Select
                    value={draft[key] || draft.kit}
                    onChange={(e) => patch({ [key]: e.target.value })}
                  >
                    {[draft.kit, draft.secondaryKit]
                      .filter(Boolean)
                      .map((name) => (
                        <option key={name}>{name}</option>
                      ))}
                  </Select>
                </Field>
              ),
            )}
        </>
      ) : (
        <p className="builder-intro">
          Этот класс не предоставляет комплект на 1-м уровне. Его
          собственные особенности снаряжения описаны в разделе класса.
        </p>
      )}
    </>
  );
}
