import { grantedClassAbilities } from "../../../lib/character-builder";
import { builderAbilityGroups } from "../../../lib/builder-flow";
import { AbilityCard } from "../../AbilityCard";
import { Button } from "../../ui";
import { useBuilderStep } from "../BuilderStepContext";

export function AbilitiesStep({ part }: { part: string }) {
  const { draft, patch, hero, openAbility, go } = useBuilderStep();
  const grantedAbilities = grantedClassAbilities(draft);
  const abilityGroups = builderAbilityGroups(draft);

  if (!draft.className) {
    return <section className="builder-section"><h3>Сначала выберите класс</h3><p className="muted">От класса зависят доступные способности и их количество.</p><Button onClick={() => go("class")}>Выбрать класс</Button></section>;
  }

  return (
    <>
      {abilityGroups
        .filter((g) => !part || g.id === part)
        .map((group) => (
          <section className="builder-section" key={group.label} aria-label={group.label}>
            <div className="builder-section-head">
              {!part && <h3>{group.label}</h3>}
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

      {grantedAbilities.length > 0 && (
        <section className="builder-granted">
          <h3>Уже получено от класса и подкласса: {grantedAbilities.length}</h3>
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
    </>
  );
}
