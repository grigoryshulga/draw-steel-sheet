import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "../components/Icons";
import { Button } from "../components/ui";
import { onSheetTabRequest } from "../lib/sheet-tabs";
import type { HeroTab } from "../navigation";
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
import { HeroView } from "./HeroView";
import { CompanionsView } from "./sheet/CompanionsView";
import { InventoryView } from "./InventoryView";
import { NotesView } from "./NotesView";
import "./SheetView.css";
import "./sheet/Workspace.css";
import "./sheet/SheetLayout.css";
import "./sheet/SheetFrame.css";
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
const MAIN_COLUMN: PanelId[] = ["vitals", "characteristics", "abilities"];
const SIDE_COLUMN: PanelId[] = [
  "progress",
  "potency",
  "resources",
  "conditions",
  "skills",
  "perks",
];

const SHEET_TABS: { id: HeroTab; label: string; icon: IconName }[] = [
  { id: "sheet", label: "Лист", icon: "sheet" },
  { id: "development", label: "Развитие", icon: "arrow-up" },
  { id: "inventory", label: "Инвентарь", icon: "inventory" },
  { id: "notes", label: "Журнал", icon: "book" },
  { id: "companions", label: "Спутники", icon: "users" },
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

function SheetWorkspace({ tab }: { tab: HeroTab }) {
  const { character, patch, goTo } = useApp();
  const [developmentDirty, setDevelopmentDirty] = useState(false);

  const switchTab = (next: HeroTab) => {
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
    goTo(next);
  };

  useEffect(
    () => onSheetTabRequest((next) => switchTab(next)),
    [tab, developmentDirty],
  );

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
      <section className="sheet-frame">
        <div className="sheet-frame-head">
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
                <Icon name={item.icon} size={15} aria-hidden="true" />
                {item.label}
                {item.id === "development" && developmentDirty && (
                  <span
                    className="sheet-tab-dot"
                    aria-label="есть несохранённые выборы"
                  />
                )}
              </button>
            ))}
          </div>
          <div className="sheet-frame-actions">
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

        <div
          className="sheet-frame-body"
          data-view={tab}
          role="tabpanel"
          aria-label={SHEET_TABS.find((item) => item.id === tab)?.label}
        >
          {tab === "sheet" && (
            <div className="sheet-layout-host">
              <div className="sheet-layout">
                <Column className="sheet-col-main" ids={MAIN_COLUMN} />
                <Column className="sheet-col-side" ids={SIDE_COLUMN} />
              </div>
            </div>
          )}
          {tab === "development" && (
            <div className="development-workspace">
              <HeroView embedded />
              <DevelopmentPanel onDirtyChange={setDevelopmentDirty} />
            </div>
          )}
          {tab === "inventory" && <InventoryView />}
          {tab === "notes" && <NotesView />}
          {tab === "companions" && <CompanionsView />}
        </div>
      </section>
    </div>
  );
}

export function SheetView({ tab }: { tab: HeroTab }) {
  const { character } = useApp();
  return <SheetWorkspace key={character.id} tab={tab} />;
}
