import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui";
import { onSheetTabRequest, type SheetTab } from "../lib/sheet-tabs";
import { useApp } from "../state/AppContext";
import { CharacteristicsPanel } from "./sheet/CharacteristicsPanel";
import { ConditionsPanel } from "./sheet/ConditionsPanel";
import { DevelopmentPanel } from "./sheet/DevelopmentPanel";
import { HeaderPanel } from "./sheet/HeaderPanel";
import { SheetAbilitiesPanel } from "./sheet/SheetAbilitiesPanel";
import { SheetPerksPanel } from "./sheet/SheetPerksPanel";
import { PotencyPanel } from "./sheet/PotencyPanel";
import { ProgressPanel } from "./sheet/ProgressPanel";
import { SkillsPanel } from "./sheet/SkillsPanel";
import { VitalsPanel } from "./sheet/VitalsPanel";
import { ResourcesPanel } from "./sheet/ResourcesPanel";
import { SheetQuickActions } from "./sheet/SheetQuickActions";
import { GameHistory } from "./sheet/GameHistory";
import "./SheetView.css";
import "./sheet/Workspace.css";
import "./sheet/SheetLayout.css";
import "./SheetAtmosphere.css";

type PanelId =
  | "characteristics"
  | "conditions"
  | "abilities"
  | "perks"
  | "potency"
  | "progress"
  | "skills"
  | "vitals"
  | "resources";

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

/** Порядок блоков в колонках; на узком экране их переупорядочивает CSS. */
const MAIN_COLUMN: PanelId[] = ["characteristics", "vitals", "abilities"];
const SIDE_COLUMN: PanelId[] = [
  "progress",
  "potency",
  "resources",
  "conditions",
  "skills",
  "perks",
];

const SHEET_TABS: { id: SheetTab; label: string }[] = [
  { id: "sheet", label: "Лист" },
  { id: "development", label: "Развитие" },
];

function Column({ className, ids }: { className: string; ids: PanelId[] }) {
  return (
    <div className={`sheet-col ${className}`}>
      {ids.map((id) => {
        const Component = PANELS[id];
        return (
          <section key={id} className="sheet-block" data-panel={id}>
            <Component />
          </section>
        );
      })}
    </div>
  );
}

function SheetWorkspace() {
  const { character, patch } = useApp();
  const [tab, setTab] = useState<SheetTab>("sheet");
  const [developmentDirty, setDevelopmentDirty] = useState(false);

  useEffect(() => onSheetTabRequest(setTab), []);

  const switchTab = (next: SheetTab) => {
    if (next === tab) return;
    if (tab === "development" && developmentDirty) {
      const leave = window.confirm(
        "В «Развитии» есть несохранённые выборы. Уйти без сохранения?",
      );
      if (!leave) return;
      // Черновик живёт внутри панели и исчезнет вместе с ней: снимаем метку,
      // иначе точка «есть несохранённые выборы» осталась бы на вкладке.
      setDevelopmentDirty(false);
    }
    setTab(next);
  };

  const toggleAutomation = () =>
    patch({
      automation: {
        ...(character.automation ?? {
          adjustments: {},
          ancestryTraits: [],
        }),
        enabled: !character.automation?.enabled,
      },
    });
  return (
    <div className="sheet-view sheet-workspace-view">
      <HeaderPanel />
      <SheetQuickActions />
      <div className="sheet-toolbar sheet-toolbar-tabs">
        <div className="sheet-tablist" role="tablist" aria-label="Разделы героя">
          {SHEET_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              className={`sheet-tab${tab === item.id ? " is-active" : ""}`}
              aria-selected={tab === item.id}
              onClick={() => switchTab(item.id)}
            >
              {item.label}
              {item.id === "development" && developmentDirty && (
                <span className="sheet-tab-dot" aria-label="есть несохранённые выборы" />
              )}
            </button>
          ))}
        </div>
        <div className="sheet-toolbar-actions">
          <a href="#/codex/0301">Правила создания героя ↗</a>
          <Button
            size="sm"
            variant={character.automation?.enabled ? "soft" : "ghost"}
            aria-pressed={!!character.automation?.enabled}
            onClick={toggleAutomation}
            title="Пересчитывать класс, уровень, комплекты, числовые черты класса и бонусы спасброска. При включённом авторасчёте ручные изменения сохраняются как поправки."
          >
            {character.automation?.enabled
              ? "Авторасчёт включён"
              : "Включить авторасчёт"}
          </Button>
        </div>
      </div>
      <GameHistory />
      {tab === "sheet" ? (
        <div className="sheet-layout-host">
          <div className="sheet-layout">
            <Column className="sheet-col-main" ids={MAIN_COLUMN} />
            <Column className="sheet-col-side" ids={SIDE_COLUMN} />
          </div>
        </div>
      ) : (
        <section className="dev-tab" role="tabpanel" aria-label="Развитие">
          <DevelopmentPanel onDirtyChange={setDevelopmentDirty} />
        </section>
      )}
    </div>
  );
}
export function SheetView() {
  const { character } = useApp();
  return <SheetWorkspace key={character.id} />;
}
