import { NumberInput, Panel, Stepper } from "../../components/ui";
import { heroicResourceName } from "../../data/classes";
import { surgeDamageTotal } from "../../lib/rules";
import { useApp } from "../../state/AppContext";

/** Ресурсы боя, независимые от здоровья и восстановлений. */
export function ResourcesPanel() {
  const { character, patch } = useApp();
  const resourceName = heroicResourceName(character.className);
  return (
    <Panel title="Ресурсы героя" icon="spark" className="resources-panel">
      <div className="hero-resources-grid">
        <div className="vital-block">
          <span className="resource-title">{resourceName}</span>
          <div className="vital-block-row">
            <Stepper
              value={character.heroicResource.current}
              min={0}
              max={character.heroicResource.max}
              label={`${resourceName}: текущее значение`}
              className="sheet-large-counter"
              onChange={(current) =>
                patch({
                  heroicResource: { ...character.heroicResource, current },
                })
              }
            />
            <span className="small muted max-edit">
              макс
              <NumberInput
                value={character.heroicResource.max}
                min={0}
                max={99}
                label="Максимум героического ресурса"
                className="tiny-num"
                onChange={(value) =>
                  patch({
                    heroicResource: { ...character.heroicResource, max: value },
                  })
                }
              />
            </span>
          </div>
        </div>

        <div className="vital-block">
          <div className="between">
            <span className="resource-title">Всплески</span>
            {character.surges > 0 && (
              <span className="chip chip-static chip-accent">
                +{surgeDamageTotal(character, character.surges)} урона
              </span>
            )}
          </div>
          <Stepper
            value={character.surges}
            min={0}
            max={99}
            label="Всплески"
            className="sheet-large-counter"
            onChange={(surges) => patch({ surges })}
          />
        </div>

        <div className="vital-block">
          <div className="between">
            <span className="resource-title">Жетоны героя</span>
            <span className="small muted mono">{character.heroTokens}/5</span>
          </div>
          <div className="tokens-row">
            <div className="pips" role="group" aria-label="Жетоны героя">
              {[0, 1, 2, 3, 4].map((index) => {
                const on = index < character.heroTokens;
                return (
                  <button
                    key={index}
                    type="button"
                    className={`pip${on ? " is-on" : ""}`}
                    aria-pressed={on}
                    aria-label={`Жетон героя ${index + 1}: ${on ? "потратить" : "получить"}`}
                    title={on ? "Убрать жетон" : "Добавить жетон"}
                    onClick={() =>
                      patch({ heroTokens: on ? index : index + 1 })
                    }
                  >
                    <span className="pip-dot" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
