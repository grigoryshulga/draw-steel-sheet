import {
  grantedClassAbilities,
  selectableClassAbilities,
} from "../../../lib/character-builder";
import { CLASS_SIGNATURE_COUNTS } from "../../../data/creation-rules";
import type { CompendiumAbility } from "../../../types";
import { AbilityCard } from "../../AbilityCard";
import { useBuilderStep } from "../BuilderStepContext";

export function AbilitiesStep() {
  const { draft, patch, hero, openAbility } = useBuilderStep();
  const grantedAbilities = grantedClassAbilities(draft);
  const classAbilities = selectableClassAbilities(draft);
  const signatureCount = CLASS_SIGNATURE_COUNTS[draft.className] ?? 0;
  const abilityGroups: {
    label: string;
    entries: CompendiumAbility[];
    count: number | null;
  }[] = [
    {
      label: "Знаковые",
      entries: classAbilities.filter((a) => a.kind === "signature"),
      count: signatureCount,
    },
    {
      label: "За 3 ресурса",
      entries: classAbilities.filter((a) => a.resourceCost === 3),
      count: 1,
    },
    {
      label: "За 5 ресурса",
      entries: classAbilities.filter((a) => a.resourceCost === 5),
      count: 1,
    },
    {
      label: "Другие и триггеры",
      entries: classAbilities.filter(
        (a) => a.kind !== "signature" && ![3, 5].includes(a.resourceCost),
      ),
      count: null,
    },
  ];

  return (
    <>
      <p className="builder-intro">
        Свободные удары, способности комплектов и обязательные
        способности класса уже добавлены. Выберите остальные
        способности.
      </p>
      {grantedAbilities.length > 0 && (
        <section className="builder-granted">
          <div className="builder-section-head">
            <h3>Уже добавлены</h3>
            <span className="muted small">От класса и подкласса</span>
          </div>
          <div className="builder-ability-grid">
            {grantedAbilities.map((a) => (
              <AbilityCard
                key={a.id}
                ability={a}
                character={hero}
                onOpen={() => openAbility(a)}
              />
            ))}
          </div>
        </section>
      )}
      {abilityGroups
        .filter((g) => g.entries.length > 0)
        .map((group) => (
          <section className="builder-section" key={group.label}>
            <div className="builder-section-head">
              <h3>{group.label}</h3>
              <span className="muted small">
                {group.count === null
                  ? "По особенностям класса и подкласса"
                  : `Выберите ${group.count}`}
              </span>
            </div>
            <div className="builder-ability-grid">
              {group.entries.map((a) => {
                const chosen = draft.abilityIds.includes(a.id);
                const full =
                  group.count !== null &&
                  group.entries.filter((a) =>
                    draft.abilityIds.includes(a.id),
                  ).length >= group.count;
                return (
                  <AbilityCard
                    key={a.id}
                    ability={a}
                    character={hero}
                    selected={chosen}
                    className={!chosen && full ? "is-disabled" : ""}
                    onSelect={() => {
                      if (!chosen && full) return;
                      patch({
                        abilityIds: chosen
                          ? draft.abilityIds.filter((id) => id !== a.id)
                          : [...draft.abilityIds, a.id],
                      });
                    }}
                    onOpen={() => openAbility(a)}
                  />
                );
              })}
            </div>
          </section>
        ))}
    </>
  );
}
