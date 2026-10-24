import type { CharacterStatBreakdown } from "../../lib/character-calculations";
import { HelpTooltip } from "../../components/HelpTooltip";
import "./StatBreakdown.css";

interface StatBreakdownProps {
  label: string;
  breakdown: CharacterStatBreakdown;
}

export function StatBreakdown({ label, breakdown }: StatBreakdownProps) {
  return (
    <HelpTooltip label={`Расчёт ${label}`} className="stat-breakdown">
      <div className="stat-breakdown-equation" lang="ru">
        <span>База {breakdown.base}</span>
        {breakdown.contributions.map((item, index) => (
          <span key={`${item.sourceId}-${index}`}>
            {item.sourceName} {item.value >= 0 ? "+" : ""}{item.value}
          </span>
        ))}
        <span>
          Ручная поправка {breakdown.adjustment >= 0 ? "+" : ""}
          {breakdown.adjustment}
        </span>
        <strong>Итого {breakdown.total}</strong>
      </div>
    </HelpTooltip>
  );
}
