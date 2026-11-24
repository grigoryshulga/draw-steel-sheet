import { developmentMessage } from "../../i18n/development-messages";
import { useLocale } from "../../i18n/locale";
import { useMemo } from "react";
import { Icon } from "../../components/Icons";
import { Button } from "../../components/ui";
import { getLevelUpPlan } from "../../lib/level-up";
import { openSheetTab } from "../../lib/sheet-tabs";
import { useApp } from "../../state/AppContext";

/** Validate the complete plan only when the hero has reached the XP threshold. */
export function LevelUpShortcut() {
  const { t, locale } = useLocale();
  const { character } = useApp();
  const plan = useMemo(() => getLevelUpPlan(character), [character]);
  return (
    <span className="progress-level-up-wrap" title={!plan.available ? developmentMessage(plan.reason ?? "", locale) : undefined}>
      <Button variant="soft" className="progress-level-up-trigger" disabled={!plan.available}
        title={t("Повысить уровень — вкладка «Развитие»", "Level up — Advancement tab")} aria-label={t("Повысить уровень", "Level up")}
        onClick={() => openSheetTab("development")}>
        <Icon name="arrow-up" size={20} />
      </Button>
    </span>
  );
}
