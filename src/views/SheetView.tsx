import type { ComponentType } from "react";
import { lazy, useEffect, useState } from "react";
import { Icon, type IconName } from "../components/Icons";
import { Button } from "../components/ui";
import { onSheetTabRequest } from "../lib/sheet-tabs";
import { useMediaQuery } from "../lib/hooks";
import { currentRuntime } from "../lib/runtime";
import type { HeroTab } from "../navigation";
import { useApp } from "../state/AppContext";
import { CharacteristicsPanel } from "./sheet/CharacteristicsPanel";
import { ConditionsPanel } from "./sheet/ConditionsPanel";
import { HeaderPanel } from "./sheet/HeaderPanel";
import { SheetAbilitiesPanel } from "./sheet/SheetAbilitiesPanel";
import { SheetFeaturesPanel } from "./sheet/SheetFeaturesPanel";
import { SheetPerksPanel } from "./sheet/SheetPerksPanel";
import { SkillsPanel } from "./sheet/SkillsPanel";
import { VitalsPanel } from "./sheet/VitalsPanel";
import { ResourcesPanel } from "./sheet/ResourcesPanel";
import "./SheetView.css";
import "./sheet/Workspace.css";
import "./sheet/SheetLayout.css";
import "./sheet/SheetFrame.css";
import "./SheetAtmosphere.css";

const DevelopmentPanel = lazy(() =>
  import("./sheet/DevelopmentPanel").then((module) => ({ default: module.DevelopmentPanel })),
);
const HeroView = lazy(() =>
  import("./HeroView").then((module) => ({ default: module.HeroView })),
);
const CompanionsView = lazy(() =>
  import("./sheet/CompanionsView").then((module) => ({ default: module.CompanionsView })),
);
const InventoryView = lazy(() =>
  import("./InventoryView").then((module) => ({ default: module.InventoryView })),
);
const NotesView = lazy(() =>
  import("./NotesView").then((module) => ({ default: module.NotesView })),
);

type PanelId =
  | "characteristics"
  | "conditions"
  | "abilities"
  | "features"
  | "perks"
  | "skills"
  | "vitals"
  | "resources";

const PANELS: Record<PanelId, ComponentType> = {
  characteristics: CharacteristicsPanel,
  conditions: ConditionsPanel,
  abilities: SheetAbilitiesPanel,
  features: SheetFeaturesPanel,
  perks: SheetPerksPanel,
  skills: SkillsPanel,
  vitals: VitalsPanel,
  resources: ResourcesPanel,
};

/** Порядок блоков в колонках; на узком экране их переупорядочивает CSS. */
const UPPER_MAIN: PanelId[] = ["vitals", "characteristics"];
const UPPER_SIDE: PanelId[] = ["resources"];
const LOWER_MAIN: PanelId[] = ["perks", "features"];
const LOWER_SIDE: PanelId[] = ["conditions", "skills"];
const FULL_WIDTH: PanelId[] = ["abilities"];

const SHEET_TABS: { id: HeroTab; label: string; icon: IconName }[] = [
  { id: "sheet", label: "Лист", icon: "sheet" },
  { id: "development", label: "Развитие", icon: "arrow-up" },
  { id: "inventory", label: "Инвентарь", icon: "inventory" },
  { id: "notes", label: "Журнал", icon: "book" },
  { id: "companions", label: "Спутники", icon: "users" },
];

/** Блоки листа на телефоне: три раздела вместо длинной колонки. */
type SheetSectionId = "main" | "features" | "abilities";

const SHEET_SECTIONS: {
  id: SheetSectionId;
  label: string;
  icon: IconName;
  panels: PanelId[];
}[] = [
  {
    id: "main",
    label: "Основное",
    icon: "heart",
    panels: ["vitals", "resources", "conditions", "characteristics"],
  },
  {
    id: "features",
    label: "Особенности",
    icon: "spark",
    panels: ["perks", "features", "skills"],
  },
  {
    id: "abilities",
    label: "Способности",
    icon: "abilities",
    panels: ["abilities"],
  },
];

function Blocks({ ids }: { ids: PanelId[] }) {
  return (
    <>
      {ids.map((id) => {
        const Component = PANELS[id];
        return (
          <section key={id} className="sheet-block" data-panel={id}>
            <Component />
          </section>
        );
      })}
    </>
  );
}

function Column({ className, ids }: { className: string; ids: PanelId[] }) {
  return (
    <div className={`sheet-col ${className}`}>
      <Blocks ids={ids} />
    </div>
  );
}

/** Телефон: разделы листа переключаются вкладками, остальное скрыто. */
function CompactSheet() {
  const [section, setSection] = useState<SheetSectionId>("main");
  const active = SHEET_SECTIONS.find((item) => item.id === section) ?? SHEET_SECTIONS[0];

  return (
    <div className="sheet-layout sheet-layout-compact">
      <nav
        className="sheet-section-tabs"
        role="tablist"
        aria-label="Блоки листа"
      >
        {SHEET_SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className={`sheet-section-tab${active.id === item.id ? " is-active" : ""}`}
            aria-selected={active.id === item.id}
            onClick={() => setSection(item.id)}
          >
            <Icon name={item.icon} size={15} aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </nav>
      <div
        className="sheet-section-body"
        role="tabpanel"
        aria-label={active.label}
      >
        <Blocks ids={active.panels} />
      </div>
    </div>
  );
}

function SheetWorkspace({ tab }: { tab: HeroTab }) {
  const { character, performGameAction, goTo } = useApp();
  const [developmentDirty, setDevelopmentDirty] = useState(false);
  // Телефон получает разделы вместо длинной колонки; на десктопе остаются колонки.
  const compact = useMediaQuery("(max-width: 700px)");

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

  const runtime = currentRuntime(character);
  const combatActive = !!runtime.combatActive;

  return (
    <div className="sheet-view sheet-workspace-view">
      <HeaderPanel />
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
              variant={combatActive ? "ghost" : "soft"}
              onClick={() => performGameAction({ kind: combatActive ? "combat-end" : "combat-start" })}
            >
              {combatActive ? "Конец битвы" : "Начало битвы"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => performGameAction({ kind: "round" })}
              title="Снять отметки триггеров раунда"
              aria-label={`Новый раунд: сейчас ${runtime.round}`}
            >
              Новый раунд · {runtime.round}
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
              {compact ? (
                <CompactSheet />
              ) : (
                <div className="sheet-layout">
                  <div className="sheet-upper">
                    <Column className="sheet-col-main" ids={UPPER_MAIN} />
                    <Column className="sheet-col-side" ids={UPPER_SIDE} />
                  </div>
                  <div className="sheet-lower">
                    <Column className="sheet-col-main" ids={LOWER_MAIN} />
                    <Column className="sheet-col-side" ids={LOWER_SIDE} />
                  </div>
                  <Column className="sheet-col-full" ids={FULL_WIDTH} />
                </div>
              )}
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
