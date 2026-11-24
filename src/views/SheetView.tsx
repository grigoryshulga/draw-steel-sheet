import { useLocale } from "../i18n/locale";
import type { ComponentType, ReactNode } from "react";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Icon, type IconName } from "../components/Icons";
import { Button } from "../components/ui";
import { onSheetTabRequest } from "../lib/sheet-tabs";
import { useMediaQuery } from "../lib/hooks";
import { currentRuntime } from "../lib/runtime";
import { combatPhaseLabel } from "../lib/tables/combat";
import type { TableCombatLink } from "../types";
import { EN_TAB_LABELS, type HeroTab } from "../navigation";
import { useApp } from "../state/AppContext";
import { CharacteristicsPanel } from "./sheet/CharacteristicsPanel";
import { ConditionsPanel } from "./sheet/ConditionsPanel";
import { HeaderPanel } from "./sheet/HeaderPanel";
import { SkillsPanel } from "./sheet/SkillsPanel";
import { VitalsPanel } from "./sheet/VitalsPanel";
import { ResourcesPanel } from "./sheet/ResourcesPanel";
import { FuryFerocityTracker } from "./sheet/FuryFerocityTracker";
import { StormwightFormPanel } from "./sheet/StormwightFormPanel";
import "./SheetView.css";
import "./sheet/Workspace.css";
import "./sheet/SheetLayout.css";
import "./sheet/SheetFrame.css";
import "./SheetAtmosphere.css";

const SheetPerksPanel = lazy(() => import("./sheet/SheetPerksPanel").then(module => ({ default: module.SheetPerksPanel })));
const SheetFeaturesPanel = lazy(() => import("./sheet/SheetFeaturesPanel").then(module => ({ default: module.SheetFeaturesPanel })));
const ClassMechanicsPanel = lazy(() => import("./sheet/ClassMechanicsPanel").then(module => ({ default: module.ClassMechanicsPanel })));

const SheetAbilitiesPanel = lazy(() =>
  import("./sheet/SheetAbilitiesPanel").then(module => ({ default: module.SheetAbilitiesPanel })),
);

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
  | "resources"
  | "ferocity"
  | "stormwight-form"
  | "classMechanics";

const combatPhaseEnglish = { ready: "Waiting for turn", active: "Your turn", done: "Turn finished" };

const PANELS: Record<PanelId, ComponentType> = {
  characteristics: CharacteristicsPanel,
  conditions: ConditionsPanel,
  abilities: SheetAbilitiesPanel,
  features: SheetFeaturesPanel,
  perks: SheetPerksPanel,
  skills: SkillsPanel,
  vitals: VitalsPanel,
  resources: ResourcesPanel,
  ferocity: FuryFerocityTracker,
  "stormwight-form": StormwightFormPanel,
  classMechanics: ClassMechanicsPanel,
};

/** Порядок блоков в колонках; на узком экране их переупорядочивает CSS. */
const MAIN: PanelId[] = ["vitals", "characteristics", "perks", "features"];
const SIDE: PanelId[] = ["resources", "classMechanics", "ferocity", "stormwight-form", "conditions", "skills"];
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
            {(id === "abilities" || id === "classMechanics" || id === "features" || id === "perks") ? <Suspense fallback={null}><Component /></Suspense> : <Component />}
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

type SheetViewProps = { tab: HeroTab; tools?: ReactNode; onDevelopmentDirtyChange?: (dirty: boolean) => void };

function SheetWorkspace({ tab, tools, onDevelopmentDirtyChange }: SheetViewProps) {
  const { t } = useLocale();
  const { character, performGameAction, goTo } = useApp();
  const [developmentDirty, setDevelopmentDirty] = useState(false);
  const compact = useMediaQuery("(max-width: 700px)");
  const updateDevelopmentDirty = useCallback((dirty: boolean) => {
    setDevelopmentDirty(dirty);
    onDevelopmentDirtyChange?.(dirty);
  }, [onDevelopmentDirtyChange]);

  const switchTab = (next: HeroTab) => {
    if (next === tab) return;
    if (tab === "development" && developmentDirty) {
      const leave = window.confirm(
        t("В «Развитии» есть несохранённые выборы. Уйти без сохранения?", "You have unsaved advancement choices. Leave without saving?"),
      );
      if (!leave) return;
      // Черновик живёт внутри панели и исчезнет вместе с ней: снимаем метку,
      // иначе точка «есть несохранённые выборы» осталась бы на вкладке.
      updateDevelopmentDirty(false);
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
      const workspace = event.currentTarget;
      requestAnimationFrame(() => {
        if (!target.isConnected || document.activeElement !== target) return;
        const header = document.querySelector(".floating-header")?.getBoundingClientRect();
        const tabs = workspace.querySelector(".sheet-tablist")?.getBoundingClientRect();
        const modalBody = workspace.closest(".modal-body");
        const rect = target.getBoundingClientRect();
        const top = (modalBody?.getBoundingClientRect().top ?? header?.bottom ?? 0) + 12;
        const bottom = (tabs?.top ?? window.innerHeight) - 12;
        const delta = rect.top < top ? rect.top - top : rect.bottom > bottom ? rect.bottom - bottom : 0;
        if (delta) (modalBody ?? window).scrollBy({ top: delta, behavior: "instant" });
      });
    }}>
      <HeaderPanel compact={compact || tab !== "sheet"} />
      <section className="sheet-frame">
        <div className="sheet-frame-head">
          <nav className="sheet-tablist" aria-label={t("Разделы героя", "Hero sections")}>
            {SHEET_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`sheet-tab${tab === item.id ? " is-active" : ""}`}
                aria-current={tab === item.id ? "page" : undefined}
                onClick={() => switchTab(item.id)}
              >
                <Icon name={item.icon} size={15} aria-hidden="true" />
                {t(item.label, item.id === "sheet" ? "Sheet" : EN_TAB_LABELS[item.id])}
                {item.id === "development" && developmentDirty && (
                  <span
                    className="sheet-tab-dot"
                    aria-label={t("есть несохранённые выборы", "unsaved choices")}
                  />
                )}
              </button>
            ))}
          </nav>
          {tab === "sheet" && (
            <div className="sheet-frame-actions">
              {tools}
              {runtime.tableCombat ? (
                <span className="chip" role="status">
                  {t("Раунд", "Round")} {runtime.tableCombat.round} · {t(combatPhaseLabel[runtime.tableCombat.phase], combatPhaseEnglish[runtime.tableCombat.phase])}
                </span>
              ) : <>
              <Button
                size="sm"
                variant={combatActive ? "ghost" : "soft"}
                onClick={() =>
                  performGameAction({
                    kind: combatActive ? "combat-end" : "combat-start",
                  })
                }
              >
                {combatActive ? t("Конец битвы", "End combat") : t("Начало битвы", "Start combat")}
              </Button>
              {combatActive && character.className !== "Неистовый" && (
                <Button size="sm" variant="soft" onClick={() => performGameAction({ kind: runtime.turnActive ? "turn-end" : "turn-start" })}>
                  {runtime.turnActive ? t("Завершить ход", "End turn") : t("Начать свой ход", "Start my turn")}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => performGameAction({ kind: "round" })}
                title={t("Снять отметки триггеров раунда", "Reset this round’s triggers")}
                aria-label={t(`Новый раунд: сейчас ${runtime.round}`, `New round: currently ${runtime.round}`)}
              >
                {t("Новый раунд", "New round")} · {runtime.round}
              </Button>
              </>}
            </div>
          )}
        </div>

        <div
          className="sheet-frame-body"
          data-view={tab}
          aria-label={t(SHEET_TABS.find((item) => item.id === tab)!.label, tab === "sheet" ? "Sheet" : EN_TAB_LABELS[tab])}
        >
          {tab === "sheet" && (
            <div className="sheet-layout-host">
              <div className="sheet-layout">
                <div className="sheet-columns">
                  <Column className="sheet-col-main" ids={MAIN} />
                  <Column className="sheet-col-side" ids={SIDE} />
                </div>
                <Column className="sheet-col-full" ids={FULL_WIDTH} />
              </div>
            </div>
          )}
          {tab === "development" && (
            <div className="development-workspace">
              <HeroView embedded />
              <DevelopmentPanel onDirtyChange={updateDevelopmentDirty} />
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

export function SheetView(props: SheetViewProps) {
  const { character } = useApp();
  return <SheetWorkspace key={character.id} {...props} />;
}

/** The ordinary sheet panels and column layout, isolated from editing and persistence. */
export function SheetReadOnlyView({ sections, combat }: {
  sections: readonly string[];
  combat?: Pick<TableCombatLink, "round" | "phase">;
}) {
  const { character } = useApp();
  const { t } = useLocale();
  const heroShared = sections.includes("hero");
  const developmentShared = sections.includes("development");
  const filter = (ids: PanelId[]) => ids.filter((id) =>
    ["vitals", "resources", "conditions"].includes(id) ||
    (["characteristics", "abilities", "features"].includes(id) && heroShared) ||
    (["perks", "skills"].includes(id) && developmentShared),
  );
  return <div className="sheet-view sheet-workspace-view shared-sheet-preview" data-hero-shared={heroShared}>
    <div className="shared-sheet-identity">
      <span>{character.ancestry} · {character.className} · {t(`${character.level}-й уровень`, `Level ${character.level}`)}</span>
      {combat && <span className="chip" role="status">
        {t("Раунд", "Round")} {combat.round} · {t(combat.phase === "active" ? "Ходит" : combatPhaseLabel[combat.phase], combat.phase === "active" ? "Taking a turn" : combatPhaseEnglish[combat.phase])}
      </span>}
      <span className="chip">{t("Только просмотр", "Read only")}</span>
    </div>
    <div className="sheet-layout-host">
      <div className="sheet-layout">
        <div className="sheet-columns">
          <Column className="sheet-col-main" ids={filter(MAIN)} />
          <Column className="sheet-col-side" ids={filter(SIDE)} />
        </div>
        <Column className="sheet-col-full" ids={filter(FULL_WIDTH)} />
      </div>
    </div>
    {!heroShared && <p className="muted">{t("Игрок открыл только основные показатели. Остальные разделы листа скрыты.", "The player shared only basic stats. Other sections of this sheet are private.")}</p>}
  </div>;
}
