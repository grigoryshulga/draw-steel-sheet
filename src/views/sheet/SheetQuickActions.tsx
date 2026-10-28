import { useLayoutEffect, useState } from "react";
import { Modal } from "../../components/ui";
import { CONDITIONS } from "../../data/conditions";
import { heroicResourceName } from "../../data/classes";
import { currentRuntime } from "../../lib/runtime";
import { useApp } from "../../state/AppContext";
import { ConditionsPanel } from "./ConditionsPanel";
import { HealthDialog } from "./HealthDialog";
import { ResourcesPanel } from "./ResourcesPanel";
import "./SheetQuickActions.css";

type QuickPanel = "resources" | "conditions" | null;

/** Compact mobile entry points to the character's frequently used combat data. */
export function SheetQuickActions() {
  const { character, performGameAction } = useApp();
  const [healthOpen, setHealthOpen] = useState(false);
  const [panel, setPanel] = useState<QuickPanel>(null);
  const [topbarHeight, setTopbarHeight] = useState(74);
  useLayoutEffect(() => {
    const header = document.querySelector(".floating-header");
    if (!header) return;
    const measure = () =>
      setTopbarHeight(header.getBoundingClientRect().bottom + 6);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  const activeConditions = CONDITIONS.filter(
    ({ key }) => character.conditions[key]?.active,
  );
  const resourceName = heroicResourceName(character.className);
  const runtime = currentRuntime(character);

  return (
    <>
      <nav
        className="sheet-quick-actions"
        aria-label="Быстрый доступ к листу"
        style={{ top: topbarHeight }}
      >
        <button
          type="button"
          className="sheet-quick-action"
          onClick={() => setHealthOpen(true)}
          aria-label={`Здоровье: ${character.stamina.current} из ${character.stamina.max}${character.stamina.temp > 0 ? `, временная ${character.stamina.temp}` : ""}`}
        >
          <span className="sheet-quick-label">Здоровье</span>
          <strong className="numeric">
            {character.stamina.current}/{character.stamina.max}
          </strong>
          {character.stamina.temp > 0 && (
            <span className="sheet-quick-detail">
              +{character.stamina.temp} врем.
            </span>
          )}
        </button>
        <button
          type="button"
          className="sheet-quick-action"
          onClick={() => setPanel("resources")}
          aria-label={`${resourceName}: ${character.heroicResource.current}`}
        >
          <span className="sheet-quick-label">{resourceName}</span>
          <strong className="numeric">
            {character.heroicResource.current}
          </strong>
        </button>
        <button
          type="button"
          className="sheet-quick-action sheet-quick-conditions"
          onClick={() => setPanel("conditions")}
          aria-label={`Активные состояния: ${activeConditions.length}${activeConditions.length ? `: ${activeConditions.map(({ label }) => label).join(", ")}` : ""}`}
        >
          <span className="sheet-quick-label">Состояния</span>
          <strong>{activeConditions.length || "—"}</strong>
          {activeConditions.length > 0 && (
            <span className="sheet-quick-detail">
              {activeConditions.map(({ label }) => label).join(", ")}
            </span>
          )}
        </button>
        <button
          type="button"
          className="sheet-quick-action is-turn"
          onClick={() => performGameAction({ kind: "round" })}
          aria-label={`Новый раунд: сейчас ${runtime.round}, будут сняты отметки триггеров раунда`}
          title="Новый раунд: снять отметки триггеров раунда"
        >
          <span className="sheet-quick-label">Новый раунд</span>
          <strong className="numeric">{runtime.round}</strong>
        </button>
        <button
          type="button"
          className="sheet-quick-action is-turn"
          onClick={() => performGameAction({ kind: "encounter" })}
          aria-label={`Новая схватка: сейчас ${runtime.encounter}, все отметки триггеров будут сняты`}
          title="Новая схватка: снять все отметки триггеров"
        >
          <span className="sheet-quick-label">Новая схватка</span>
          <strong className="numeric">{runtime.encounter}</strong>
        </button>
      </nav>

      {healthOpen && <HealthDialog onClose={() => setHealthOpen(false)} />}
      <Modal
        open={panel === "resources"}
        onClose={() => setPanel(null)}
        title="Ресурсы героя"
        className="sheet-quick-modal"
      >
        <ResourcesPanel />
      </Modal>
      <Modal
        open={panel === "conditions"}
        onClose={() => setPanel(null)}
        title="Состояния"
        className="sheet-quick-modal"
      >
        <ConditionsPanel />
      </Modal>
    </>
  );
}
