import { useMemo, useState } from "react";
import { Button, Panel } from "../../components/ui";
import { sheetFeatures } from "../../lib/sheet-features";
import { useApp } from "../../state/AppContext";
import { PassiveFeatureCard } from "./PassiveFeatureCard";
import "./SheetAbilitiesPanel.css";
import "./SheetFeaturesPanel.css";

/** Знаковые черты происхождения и пассивные особенности класса на листе героя. */
export function SheetFeaturesPanel() {
  const { character } = useApp();
  const features = useMemo(() => sheetFeatures(character), [character]);
  const [collapsed, setCollapsed] = useState(false);
  const [compact, setCompact] = useState(false);

  if (features.length === 0) return null;

  return (
    <Panel
      title={
        <button type="button" className="sheet-features-title-toggle"
          aria-expanded={!collapsed} onClick={() => setCollapsed((value) => !value)}>
          Особенности
        </button>
      }
      icon="spark"
      className={`sheet-features-panel${compact ? " is-compact" : ""}`}
      actions={
        <Button size="sm" variant="ghost" icon={compact ? "plus" : "minus"} iconOnly
          aria-label={compact ? "Развернуть карточки особенностей" : "Свернуть карточки особенностей до заголовков"}
          aria-expanded={!compact} onClick={() => setCompact((value) => !value)} />
      }
    >
      {!collapsed && (
        <div className="sheet-ability-grid">
          {features.map((item) => <PassiveFeatureCard key={item.id} item={item} />)}
        </div>
      )}
    </Panel>
  );
}
