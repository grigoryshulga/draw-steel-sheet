import { useLocale } from "../../i18n/locale";
import type { CharacterStatBreakdown } from "../../lib/character-calculations";
import { HelpTooltip } from "../../components/HelpTooltip";
import "./StatBreakdown.css";

interface StatBreakdownProps {
  label: string;
  breakdown: CharacterStatBreakdown;
}

export function StatBreakdown({ label, breakdown }: StatBreakdownProps) {
  const { t, locale } = useLocale();
  return (
    <HelpTooltip label={t(`Расчёт ${label}`, `Calculation: ${label}`)} className="stat-breakdown">
      <div className="stat-breakdown-equation" lang={locale}>
        <span>{t("База", "Base")} {breakdown.base}</span>
        {breakdown.contributions.map((item, index) => (
          <span key={`${item.sourceId}-${index}`}>
            {item.sourceName} {item.value >= 0 ? "+" : ""}{item.value}
          </span>
        ))}
        <span>
          {t("Ручная поправка", "Manual adjustment")} {breakdown.adjustment >= 0 ? "+" : ""}
          {breakdown.adjustment}
        </span>
        <strong>{t("Итого", "Total")} {breakdown.total}</strong>
      </div>
    </HelpTooltip>
  );
}
