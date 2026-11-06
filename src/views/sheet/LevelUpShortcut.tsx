import { useMemo } from "react";
import { Icon } from "../../components/Icons";
import { Button } from "../../components/ui";
import { getLevelUpPlan } from "../../lib/level-up";
import { openSheetTab } from "../../lib/sheet-tabs";
import { useApp } from "../../state/AppContext";

/** Validate the complete plan only when the hero has reached the XP threshold. */
export function LevelUpShortcut() {
  const { character } = useApp();
  const plan = useMemo(() => getLevelUpPlan(character), [character]);
  return (
    <span className="progress-level-up-wrap" title={!plan.available ? plan.reason : undefined}>
      <Button variant="soft" className="progress-level-up-trigger" disabled={!plan.available}
        title="Повысить уровень — вкладка «Развитие»" aria-label="Повысить уровень"
        onClick={() => openSheetTab("development")}>
        <Icon name="arrow-up" size={20} />
      </Button>
    </span>
  );
}
