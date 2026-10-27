import type { ComponentType } from "react";
import { Button, Panel } from "../components/ui";
import { useApp } from "../state/AppContext";
import { CharacteristicsPanel } from "./sheet/CharacteristicsPanel";
import { ConditionsPanel } from "./sheet/ConditionsPanel";
import { HeaderPanel } from "./sheet/HeaderPanel";
import { SheetAbilitiesPanel } from "./sheet/SheetAbilitiesPanel";
import { ClassFeatureMechanicsPanel, RoundEncounterControls } from "./sheet/ClassFeaturesPanel";
import { classFeatureChoicesForSheet, classFeatureGroupsForSheet } from "../lib/class-feature-view";
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
  | "features"
  | "perks"
  | "potency"
  | "progress"
  | "skills"
  | "vitals"
  | "resources";
function SheetClassFeaturesPanel() {
  const { character } = useApp();
  if (!classFeatureGroupsForSheet(character).length && !classFeatureChoicesForSheet(character).length) return null;
  return (
    <Panel title="Особенности класса" icon="spark" dense actions={<RoundEncounterControls />}>
      <ClassFeatureMechanicsPanel />
    </Panel>
  );
}

const PANELS: Record<PanelId, ComponentType> = {
  characteristics: CharacteristicsPanel,
  conditions: ConditionsPanel,
  abilities: SheetAbilitiesPanel,
  features: SheetClassFeaturesPanel,
  perks: SheetPerksPanel,
  potency: PotencyPanel,
  progress: ProgressPanel,
  skills: SkillsPanel,
  vitals: VitalsPanel,
  resources: ResourcesPanel,
};

/** Порядок блоков в колонках; на узком экране их переупорядочивает CSS. */
const MAIN_COLUMN: PanelId[] = [
  "characteristics",
  "vitals",
  "abilities",
  "features",
];
const SIDE_COLUMN: PanelId[] = [
  "progress",
  "potency",
  "resources",
  "conditions",
  "skills",
  "perks",
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
      <div className="sheet-toolbar">
        <a href="#/codex/0301">Правила создания героя ↗</a>
        <div>
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
      <div className="sheet-layout-host">
        <div className="sheet-layout">
          <Column className="sheet-col-main" ids={MAIN_COLUMN} />
          <Column className="sheet-col-side" ids={SIDE_COLUMN} />
        </div>
      </div>
    </div>
  );
}
export function SheetView() {
  const { character } = useApp();
  return <SheetWorkspace key={character.id} />;
}
