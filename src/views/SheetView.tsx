import { useEffect, useState, type ComponentType } from "react";
import { Button, Select } from "../components/ui";
import { useApp } from "../state/AppContext";
import {
  defaultSheetLayout,
  defaultPanelWidth,
  GRID_STEP,
  normalizeSheetLayout,
  PANEL_DEFINITIONS,
  updatePanelPlacement,
  type PanelId,
  type SheetPanel,
} from "../lib/sheet-layout";
import { useSheetCanvas } from "./sheet/useSheetCanvas";
import { CharacteristicsPanel } from "./sheet/CharacteristicsPanel";
import { ConditionsPanel } from "./sheet/ConditionsPanel";
import { HeaderPanel } from "./sheet/HeaderPanel";
import { SheetAbilitiesPanel } from "./sheet/SheetAbilitiesPanel";
import { SheetPerksPanel } from "./sheet/SheetPerksPanel";
import { PotencyPanel } from "./sheet/PotencyPanel";
import { ProgressPanel } from "./sheet/ProgressPanel";
import { SkillsPanel } from "./sheet/SkillsPanel";
import { VitalsPanel } from "./sheet/VitalsPanel";
import { ResourcesPanel } from "./sheet/ResourcesPanel";
import "./SheetView.css";
import "./sheet/Workspace.css";

const PANELS: Record<PanelId, ComponentType> = {
  characteristics: CharacteristicsPanel,
  conditions: ConditionsPanel,
  abilities: SheetAbilitiesPanel,
  perks: SheetPerksPanel,
  potency: PotencyPanel,
  progress: ProgressPanel,
  skills: SkillsPanel,
  vitals: VitalsPanel,
  resources: ResourcesPanel,
};
function readLayout(id: string): SheetPanel[] {
  try {
    return normalizeSheetLayout(
      JSON.parse(localStorage.getItem(`ds-layout-${id}`) || "null"),
    );
  } catch {
    return defaultSheetLayout();
  }
}

function SheetWorkspace() {
  const { character, patch } = useApp();
  const [layout, setLayout] = useState(() => readLayout(character.id));
  const [editing, setEditing] = useState(false);
  const canvas = useSheetCanvas(layout, setLayout, editing);
  useEffect(() => {
    if (canvas.active) return;
    try {
      localStorage.setItem(`ds-layout-${character.id}`, JSON.stringify(layout));
    } catch {
      /* in-memory layout still works */
    }
  }, [layout, canvas.active, character.id]);
  const changePanel = (id: PanelId, changes: Partial<SheetPanel>) =>
    setLayout((previous) =>
      previous.map((p) => (p.id === id ? { ...p, ...changes } : p)),
    );
  const toggleAutomation = () =>
    patch({
      automation: {
        enabled: !character.automation?.enabled,
        adjustments: character.automation?.adjustments ?? {},
        ancestryTraits: character.automation?.ancestryTraits ?? [],
        meleeDamageKit: character.automation?.meleeDamageKit,
        rangedDamageKit: character.automation?.rangedDamageKit,
      },
    });
  const displayed = canvas.stacked
    ? [...layout].sort((a, b) =>
        a.placement && b.placement
          ? a.placement.y - b.placement.y || a.placement.x - b.placement.x
          : 0,
      )
    : layout;
  return (
    <div
      className={`sheet-view sheet-workspace-view ${editing ? "is-customizing" : ""} ${canvas.active ? "is-adjusting" : ""}`}
    >
      <HeaderPanel />
      <div className="sheet-toolbar">
        <a href="#/codex/0301">Правила создания героя ↗</a>
        <div>
          <Button
            size="sm"
            variant={character.automation?.enabled ? "soft" : "ghost"}
            aria-pressed={!!character.automation?.enabled}
            onClick={toggleAutomation}
            title="Пересчитывать класс, уровень, комплекты и числовые черты. Ручные изменения сохраняются как поправки."
          >
            {character.automation?.enabled
              ? "Авторасчёт включён"
              : "Включить авторасчёт"}
          </Button>
          <Button
            size="sm"
            variant={editing ? "primary" : "ghost"}
            icon="settings"
            aria-pressed={editing}
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Готово" : "Настроить лист"}
          </Button>
        </div>
      </div>
      {editing && (
        <div className="workspace-settings">
          <p className="muted small" id="workspace-grid-help">
            Сетка {GRID_STEP} px. Перетаскивайте блоки за заголовок, меняйте
            ширину за правый край, высоту за нижний, оба размера за угол.
            Стрелки — шаг {GRID_STEP} px, Shift + стрелки — 100 px. Esc отменяет
            перетаскивание. Кнопка ↕ возвращает высоту по содержимому.
          </p>
          <div className="workspace-visibility">
            {layout.map((panel) => (
              <label key={panel.id}>
                <input
                  type="checkbox"
                  checked={!panel.hidden}
                  onChange={() =>
                    changePanel(panel.id, { hidden: !panel.hidden })
                  }
                />
                {PANEL_DEFINITIONS.find((p) => p.id === panel.id)?.label}
              </label>
            ))}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setLayout(defaultSheetLayout())}
          >
            Сбросить раскладку
          </Button>
        </div>
      )}
      <div className="sheet-canvas-viewport" ref={canvas.viewportRef}>
        <div
          className={`sheet-workspace ${canvas.stacked ? "is-stacked" : ""}`}
          style={
            canvas.stacked
              ? undefined
              : {
                  width: Math.max(canvas.availableWidth, canvas.size.width),
                  height: Math.max(
                    editing ? 600 : 0,
                    canvas.size.height + (editing ? 200 : 0),
                  ),
                }
          }
        >
          {displayed.map((panel, index) => {
            if (panel.hidden) return null;
            const Component = PANELS[panel.id];
            const label = PANEL_DEFINITIONS.find(
              (p) => p.id === panel.id,
            )!.label;
            return (
              <div
                key={panel.id}
                className={`workspace-panel ${panel.collapsed ? "is-collapsed" : ""} ${panel.placement?.height !== undefined && !panel.collapsed && !canvas.stacked ? "has-fixed-height" : ""} ${canvas.active === panel.id ? "is-dragging" : ""}`}
                data-panel={panel.id}
                style={canvas.styleFor(panel, index)}
              >
                {(editing || panel.collapsed) && (
                  <div className="workspace-panel-bar">
                    {editing ? (
                      <button
                        type="button"
                        className="workspace-drag-handle"
                        aria-label={`Переместить: ${label}`}
                        aria-describedby="workspace-grid-help"
                        {...canvas.handleProps(panel.id, "move")}
                      >
                        <span aria-hidden="true">⠿</span>
                        <strong>{label}</strong>
                      </button>
                    ) : (
                      <strong>{label}</strong>
                    )}
                    <div className="workspace-panel-actions">
                      {editing && (
                        <>
                          <Select
                            aria-label={`Ширина: ${label}`}
                            value="custom"
                            onChange={(event) => {
                              const width = event.target
                                .value as SheetPanel["width"];
                              setLayout((previous) =>
                                updatePanelPlacement(previous, panel.id, {
                                  width: defaultPanelWidth(
                                    { ...panel, width },
                                    canvas.availableWidth,
                                  ),
                                }).map((p) =>
                                  p.id === panel.id ? { ...p, width } : p,
                                ),
                              );
                            }}
                          >
                            <option value="custom" disabled>
                              {panel.placement?.width ??
                                defaultPanelWidth(
                                  panel,
                                  canvas.availableWidth,
                                )}{" "}
                              px
                            </option>
                            <option value="narrow">⅓ поля</option>
                            <option value="wide">⅔ поля</option>
                            <option value="full">Всё поле</option>
                          </Select>
                          {panel.placement?.height !== undefined && (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Высота по содержимому: ${label}`}
                              title="Высота по содержимому"
                              onClick={() =>
                                setLayout((previous) =>
                                  updatePanelPlacement(previous, panel.id, {
                                    height: undefined,
                                  }),
                                )
                              }
                            >
                              ↕
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Скрыть: ${label}`}
                            onClick={() =>
                              changePanel(panel.id, { hidden: true })
                            }
                          >
                            ×
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`${panel.collapsed ? "Развернуть" : "Свернуть"}: ${label}`}
                        onClick={() =>
                          changePanel(panel.id, { collapsed: !panel.collapsed })
                        }
                      >
                        {panel.collapsed ? "+" : "−"}
                      </Button>
                    </div>
                  </div>
                )}
                <div className="workspace-panel-scroll">
                  <div
                    className="workspace-panel-content"
                    ref={(element) => {
                      if (element)
                        canvas.contentRefs.current.set(panel.id, element);
                      else canvas.contentRefs.current.delete(panel.id);
                    }}
                  >
                    {panel.collapsed ? (
                      <div className="workspace-collapsed-space" />
                    ) : (
                      <Component />
                    )}
                  </div>
                </div>
                {editing && (
                  <>
                    <output
                      className="workspace-panel-position"
                      aria-label={`Положение: ${label}`}
                    >
                      x {panel.placement?.x ?? 0} · y {panel.placement?.y ?? 0}
                    </output>
                    <button
                      type="button"
                      className="workspace-resize-handle resize-width"
                      aria-label={`Изменить ширину: ${label}`}
                      aria-describedby="workspace-grid-help"
                      {...canvas.handleProps(panel.id, "resize-width")}
                    >
                      <span aria-hidden="true">↔</span>
                    </button>
                    {!panel.collapsed && (
                      <>
                        <button
                          type="button"
                          className="workspace-resize-handle resize-height"
                          aria-label={`Изменить высоту: ${label}`}
                          aria-describedby="workspace-grid-help"
                          {...canvas.handleProps(panel.id, "resize-height")}
                        >
                          <span aria-hidden="true">↕</span>
                        </button>
                        <button
                          type="button"
                          className="workspace-resize-handle resize-both"
                          aria-label={`Изменить ширину и высоту: ${label}`}
                          aria-describedby="workspace-grid-help"
                          {...canvas.handleProps(panel.id, "resize-both")}
                        >
                          <span aria-hidden="true">↘</span>
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {layout.every((p) => p.hidden) && (
        <p className="muted">
          Все панели скрыты. Откройте «Настроить лист», чтобы вернуть их.
        </p>
      )}
    </div>
  );
}
export function SheetView() {
  const { character } = useApp();
  return <SheetWorkspace key={character.id} />;
}
