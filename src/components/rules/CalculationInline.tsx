import type { CalculationBreakdown, CalculationTerm } from "../../lib/calculation-breakdown";
import { Toggle } from "../ui";
import "./CalculationInline.css";

function termLabel(term: CalculationTerm, language: "ru" | "en"): string {
  if (language === "en") {
    if (term.kind === "base") return "base";
    if (term.label === "Кубики урона") return "";
    return term.englishLabel ?? term.label;
  }
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
export function CalculationInline({ calculations, base, language = "ru" }: {
  calculations: CalculationBreakdown[];
  base?: string;
  language?: "ru" | "en";
}) {
  if (!calculations.length) return null;
  return (
    <span className="calculation-inline">
      {calculations.map((calculation, index) => (
        <span
          className="calculation-inline-line"
          key={`${calculation.label}-${index}`}
          title={[(language === "en" ? calculation.englishFormula : calculation.formula) && `${language === "en" ? "Original formula" : "Исходная формула"}: ${language === "en" ? calculation.englishFormula : calculation.formula}`, language === "en" ? calculation.englishNote : calculation.note].filter(Boolean).join(". ") || undefined}
        >
          {calculations.length > 1 && <span className="calculation-inline-label">{language === "en" ? calculation.englishLabel ?? calculation.label : calculation.label}: </span>}
          {base && <span>{base} </span>}
          {calculation.terms.map((term, termIndex) => (
            <span className="calculation-inline-term" key={`${term.label}-${termIndex}`} title={language === "en" ? term.englishLabel ?? term.label : term.label}>
              <strong>{termValue(term.value, Boolean(base) || termIndex > 0)}</strong>
              {termLabel(term, language) && <> <span>({termLabel(term, language)})</span></>}{" "}
            </span>
          ))}
          <span className="calculation-inline-total">= {calculation.total}</span>
        </span>
      ))}
    </span>
  );
}

export function CalculationToggle({ checked, onChange, language = "ru" }: {
  checked: boolean;
  language?: "ru" | "en";
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="calculation-toggle">
      <Toggle checked={checked} onChange={onChange} label={language === "en" ? "Show calculation" : "Показать расчёт"} />
      <span>{language === "en" ? "Show calculation" : "Показать расчёт"}</span>
    </label>
  );
}
