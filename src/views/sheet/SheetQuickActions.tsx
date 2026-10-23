import { useLayoutEffect, useState } from "react";
import { Modal } from "../../components/ui";
import { CONDITIONS } from "../../data/conditions";
import { heroicResourceName } from "../../data/classes";
import { useApp } from "../../state/AppContext";
import { ConditionsPanel } from "./ConditionsPanel";
import { HealthDialog } from "./HealthDialog";
import { ResourcesPanel } from "./ResourcesPanel";
import { GameHistory } from "./GameHistory";
import "./SheetQuickActions.css";

type QuickPanel = "resources" | "conditions" | "history" | null;

/** Compact mobile entry points to the character's frequently used combat data. */
export function SheetQuickActions() {
  const { character, gameHistory } = useApp();
  const [healthOpen, setHealthOpen] = useState(false);
  const [panel, setPanel] = useState<QuickPanel>(null);
  const [topbarHeight, setTopbarHeight] = useState(73);
  useLayoutEffect(() => {
    const topbar = document.querySelector(".topbar");
    const rail = document.querySelector(".rail");
    if (!topbar) return;
    const measure = () =>
      setTopbarHeight(
        topbar.getBoundingClientRect().height +
          (rail?.getBoundingClientRect().height ?? 0),
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(topbar);
    return () => observer.disconnect();
  }, []);
  const activeConditions = CONDITIONS.filter(
    ({ key }) => character.conditions[key]?.active,
  );
  const resourceName = heroicResourceName(character.className);

  return (
    <>
      <nav
        className="sheet-quick-actions"
        aria-label="Быстрый доступ к листу"
        style={{ top: topbarHeight + 1 }}
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
          className="sheet-quick-action"
          onClick={() => setPanel("history")}
          aria-label="История и отмена действий"
        >
          <span className="sheet-quick-label">История</span>
          <strong className="numeric">
            {gameHistory.filter((entry) => !entry.undone).length || "—"}
          </strong>
          <span className="sheet-quick-detail">Отмена</span>
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
      <Modal
        open={panel === "history"}
        onClose={() => setPanel(null)}
        title="История и отмена"
        className="sheet-quick-modal"
      >
        {gameHistory.length ? (
          <GameHistory />
        ) : (
          <p className="muted">
            Здесь появятся действия с ресурсами, здоровьем и способностями.
            Последнее действие можно отменить.
          </p>
        )}
      </Modal>
    </>
  );
}
