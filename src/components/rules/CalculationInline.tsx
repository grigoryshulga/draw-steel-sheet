import type { CalculationBreakdown, CalculationTerm } from "../../lib/calculation-breakdown";
import { Toggle } from "../ui";
import "./CalculationInline.css";

function termLabel(term: CalculationTerm): string {
  if (term.kind === "base") return "база";
  if (term.label === "Кубики урона") return "";
  if (term.label === "Общий модификатор урона") return "общий модификатор";
  if (term.label === "Бонус способности") return "способность";
  return term.label;
}

function termValue(value: number | string, signed: boolean): string {
  if (typeof value === "number") {
    return value < 0 ? `− ${Math.abs(value)}` : `${signed ? "+ " : ""}${value}`;
  }
  return /^[−-]/.test(value) ? value.replace(/^[−-]\s*/, "− ") : `${signed ? "+ " : ""}${value}`;
}

/** Formulas stay beside their totals and share the evaluator's named terms. */
export function CalculationInline({ calculations, base }: {
  calculations: CalculationBreakdown[];
  base?: string;
}) {
  if (!calculations.length) return null;
  return (
    <span className="calculation-inline">
      {calculations.map((calculation, index) => (
        <span
          className="calculation-inline-line"
          key={`${calculation.label}-${index}`}
          title={[calculation.formula && `Исходная формула: ${calculation.formula}`, calculation.note].filter(Boolean).join(". ") || undefined}
        >
          {calculations.length > 1 && <span className="calculation-inline-label">{calculation.label}: </span>}
          {base && <span>{base} </span>}
          {calculation.terms.map((term, termIndex) => (
            <span className="calculation-inline-term" key={`${term.label}-${termIndex}`} title={term.label}>
              <strong>{termValue(term.value, Boolean(base) || termIndex > 0)}</strong>
              {termLabel(term) && <> <span>({termLabel(term)})</span></>}{" "}
            </span>
          ))}
          <span className="calculation-inline-total">= {calculation.total}</span>
        </span>
      ))}
    </span>
  );
}

export function CalculationToggle({ checked, onChange }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="calculation-toggle">
      <Toggle checked={checked} onChange={onChange} label="Показать расчёт" />
      <span>Показать расчёт</span>
    </label>
  );
}
