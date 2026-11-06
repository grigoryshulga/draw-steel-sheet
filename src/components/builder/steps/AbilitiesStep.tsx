import { grantedClassAbilities } from "../../../lib/character-builder";
import { builderAbilityGroups } from "../../../lib/builder-flow";
import { AbilityCard } from "../../AbilityCard";
import { useBuilderStep } from "../BuilderStepContext";

export function AbilitiesStep({ part }: { part: string }) {
  const { draft, patch, hero, openAbility } = useBuilderStep();
  const grantedAbilities = grantedClassAbilities(draft);
  const abilityGroups = builderAbilityGroups(draft);

  return (
    <>
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
        .filter((g) => !part || g.id === part)
        .map((group) => (
          <section className="builder-section" key={group.label}>
            <div className="builder-section-head">
              <h3>{group.label}</h3>
              <span className="muted small">
                {group.count === null
                  ? "По особенностям класса и подкласса"
                  : `Выбрано ${group.entries.filter((a) => draft.abilityIds.includes(a.id)).length} из ${group.count}`}
              </span>
            </div>
            <div className="builder-ability-grid">
              {group.entries.map((a) => {
                const chosen = draft.abilityIds.includes(a.id);
                const full =
                  group.count !== null &&
                  group.entries.filter((a) => draft.abilityIds.includes(a.id))
                    .length >= group.count;
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
