import type { ComponentType, ReactNode } from "react";
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
  import("./sheet/DevelopmentPanel").then((module) => ({
    default: module.DevelopmentPanel,
  })),
);
const HeroView = lazy(() =>
  import("./HeroView").then((module) => ({ default: module.HeroView })),
);
const CompanionsView = lazy(() =>
  import("./sheet/CompanionsView").then((module) => ({
    default: module.CompanionsView,
  })),
);
const InventoryView = lazy(() =>
  import("./InventoryView").then((module) => ({
    default: module.InventoryView,
  })),
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

function Blocks({ ids }: { ids: PanelId[] }) {
  return (
    <>
      {ids.map((id) => {
        const Component = PANELS[id];
        return (
          <section
            key={id}
            id={`sheet-${id}`}
            tabIndex={-1}
            className="sheet-block"
            data-panel={id}
          >
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

function SheetWorkspace({ tab, tools }: { tab: HeroTab; tools?: ReactNode }) {
  const { character, performGameAction, goTo } = useApp();
  const [developmentDirty, setDevelopmentDirty] = useState(false);
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
    <div className="sheet-view sheet-workspace-view" onFocusCapture={(event) => {
      if (!compact || !event.currentTarget.contains(event.target) || event.target.closest(".sheet-tablist")) return;
      const target = event.target;
      requestAnimationFrame(() => {
        if (!target.isConnected || document.activeElement !== target) return;
        const header = document.querySelector(".floating-header")?.getBoundingClientRect();
        const tabs = document.querySelector(".sheet-tablist")?.getBoundingClientRect();
        const rect = target.getBoundingClientRect();
        const top = (header?.bottom ?? 0) + 12;
        const bottom = (tabs?.top ?? window.innerHeight) - 12;
        const delta = rect.top < top ? rect.top - top : rect.bottom > bottom ? rect.bottom - bottom : 0;
        if (delta) window.scrollBy({ top: delta, behavior: "instant" });
      });
    }}>
      <HeaderPanel compact={compact || tab !== "sheet"} />
      <section className="sheet-frame">
        <div className="sheet-frame-head">
          <nav className="sheet-tablist" aria-label="Разделы героя">
            {SHEET_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`sheet-tab${tab === item.id ? " is-active" : ""}`}
                aria-current={tab === item.id ? "page" : undefined}
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
          </nav>
          {tab === "sheet" && (
            <div className="sheet-frame-actions">
              {tools}
              <Button
                size="sm"
                variant={combatActive ? "ghost" : "soft"}
                onClick={() =>
                  performGameAction({
                    kind: combatActive ? "combat-end" : "combat-start",
                  })
                }
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
          )}
        </div>

        <div
          className="sheet-frame-body"
          data-view={tab}
          aria-label={SHEET_TABS.find((item) => item.id === tab)?.label}
        >
          {tab === "sheet" && (
            <div className="sheet-layout-host">
              <div className="sheet-layout">
                <div className="sheet-upper">
                  <Column className="sheet-col-main" ids={UPPER_MAIN} />
                  <Column className="sheet-col-side" ids={UPPER_SIDE} />
                </div>
                <Column className="sheet-col-full" ids={FULL_WIDTH} />
                <div className="sheet-lower">
                  <Column className="sheet-col-main" ids={LOWER_MAIN} />
                  <Column className="sheet-col-side" ids={LOWER_SIDE} />
                </div>
              </div>
            </div>
          )}
          {tab === "development" && (
            <div className="development-workspace">
              <section className="hero-profile-disclosure">
                <h3>Паспорт героя, навыки и языки</h3>
                <p className="muted small">
                  Изменения паспорта сохраняются сразу. Выборы уровней
                  применяются отдельно кнопкой в разделе развития.
                </p>
                <HeroView embedded />
              </section>
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

export function SheetView({ tab, tools }: { tab: HeroTab; tools?: ReactNode }) {
  const { character } = useApp();
  return <SheetWorkspace key={character.id} tab={tab} tools={tools} />;
}

/** The ordinary sheet panels and column layout, isolated from editing and persistence. */
export function SheetReadOnlyView({ sections }: { sections: readonly string[] }) {
  const { character } = useApp();
  const heroShared = sections.includes("hero");
  const developmentShared = sections.includes("development");
  const filter = (ids: PanelId[]) => ids.filter((id) =>
    ["vitals", "resources", "conditions"].includes(id) ||
    (["characteristics", "abilities", "features"].includes(id) && heroShared) ||
    (["perks", "skills"].includes(id) && developmentShared),
  );
  return <div className="sheet-view sheet-workspace-view shared-sheet-preview" data-hero-shared={heroShared}>
    <div className="shared-sheet-identity"><span>{character.ancestry} · {character.className} · {character.level}-й уровень</span><span className="chip">Только просмотр</span></div>
    <fieldset disabled className="shared-sheet-readonly" onClickCapture={(event) => { if (!(event.target as HTMLElement).closest("a")) event.stopPropagation(); }} onKeyDownCapture={(event) => { if ((event.key === "Enter" || event.key === " ") && !(event.target as HTMLElement).closest("a")) event.stopPropagation(); }}>
      <div className="sheet-layout-host"><div className="sheet-layout">
        <div className="sheet-upper">
          <Column className="sheet-col-main" ids={filter(UPPER_MAIN)} />
          <Column className="sheet-col-side" ids={filter(UPPER_SIDE)} />
        </div>
        <Column className="sheet-col-full" ids={filter(FULL_WIDTH)} />
        <div className="sheet-lower">
          <Column className="sheet-col-main" ids={filter(LOWER_MAIN)} />
          <Column className="sheet-col-side" ids={filter(LOWER_SIDE)} />
        </div>
      </div></div>
    </fieldset>
    {!heroShared && <p className="muted">Игрок открыл только основные показатели. Остальные разделы листа скрыты.</p>}
  </div>;
}
