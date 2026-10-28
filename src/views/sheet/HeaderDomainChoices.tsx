import { useRef, useState } from "react";
import { Icon } from "../../components/Icons";
import { Select } from "../../components/ui";
import {
  classFeatureChoicesForSheet,
  featureSheetChoiceState,
  conduitLegacyDomainChoicesForSheet,
  setConduitDomainPair,
  withClassFeatureSelection,
} from "../../lib/class-feature-view";
import { FEATURE_MECHANICS } from "../../data/class-features/mechanics";
import { selectedGroupValue } from "../../lib/feature-conditions";
import { useOutsideClick } from "../../lib/hooks";
import { useMenuKeyboard } from "../../lib/useMenuKeyboard";
import { useApp } from "../../state/AppContext";

/**
 * Выбор домена в шапке героя. У Цензора это один домен, у Проводника — пара.
 * В строке идентичности остаётся компактный чип, а варианты открываются
 * в поп-апе: шапка не растягивается на отдельный блок с полем.
 */
export function HeaderDomainChoices() {
  const { character, update } = useApp();
  const [draft, setDraft] = useState<[string, string]>(["", ""]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useOutsideClick(wrapRef, () => setOpen(false), open);
  const onMenuKeyDown = useMenuKeyboard({
    open,
    setOpen,
    menuRef,
    triggerRef,
  });

  const domainChoice = classFeatureChoicesForSheet(character).find(
    (choice) => choice.group === "censor.domain",
  );
  const conduit = conduitLegacyDomainChoicesForSheet(character);
  // Выбранный домен `classFeatureChoicesForSheet` уже не предлагает повторно,
  // поэтому шапка берёт варианты из механики и всегда показывает выбор.
  const domainMechanics = Object.values(FEATURE_MECHANICS).find(
    (mechanics) => mechanics.choice?.group === "censor.domain",
  )?.choice;
  const domainOptions =
    domainChoice?.options ??
    domainMechanics?.options.map((option) => option.label) ??
    [];
  const domainSelected =
    (domainChoice
      ? featureSheetChoiceState(domainChoice).selectedOption
      : selectedGroupValue(character, "censor.domain")) ?? "";

  if (character.className === "Цензор" && domainOptions.length > 0) {
    const state = domainChoice ? featureSheetChoiceState(domainChoice) : null;
    const currentLabel = domainSelected
      ? (domainChoice?.optionLabels?.[domainSelected] ?? domainSelected)
      : "не выбран";
    return (
      <div className="sheet-domain-chip-wrap" ref={wrapRef}>
        <button
          type="button"
          ref={triggerRef}
          className="sheet-domain-chip"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Домен: ${currentLabel}`}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sheet-domain-chip-label">Домен</span>
          <span className="sheet-domain-chip-value">{currentLabel}</span>
          <Icon name="chevron-down" size={12} />
        </button>
        {open && (
          <div
            className="popover sheet-domain-popover"
            role="menu"
            aria-label="Домен цензора"
            ref={menuRef}
            onKeyDown={onMenuKeyDown}
          >
            <div className="menu-label">Домен цензора</div>
            {domainOptions.map((option) => {
              const active = option === domainSelected;
              return (
                <button
                  key={option}
                  type="button"
                  role="menuitem"
                  className={`menu-item${active ? " is-active" : ""}`}
                  onClick={() => {
                    update((current) =>
                      withClassFeatureSelection(
                        current,
                        "censor.domain",
                        option,
                      ),
                    );
                    setOpen(false);
                  }}
                >
                  <span>{domainChoice?.optionLabels?.[option] ?? option}</span>
                  {active && <Icon name="check" size={14} />}
                </button>
              );
            })}
            {domainSelected && (
              <>
                <div className="menu-sep" />
                <button
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  onClick={() => {
                    update((current) =>
                      withClassFeatureSelection(current, "censor.domain", ""),
                    );
                    setOpen(false);
                  }}
                >
                  <span>Не выбран</span>
                </button>
              </>
            )}
            {state?.warning && (
              <p className="sheet-domain-warning">{state.warning}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (character.className !== "Проводник") return null;

  const current: [string, string] =
    conduit.selectedDomains.length === 2
      ? [conduit.selectedDomains[0], conduit.selectedDomains[1]]
      : draft;

  const change = (index: 0 | 1, value: string) => {
    const next: [string, string] = [...current];
    next[index] = value;
    setDraft(next);
    if (next[0] && next[1] && next[0] !== next[1]) {
      update((characterState) => setConduitDomainPair(characterState, next));
    }
  };

  const domainLabel =
    current[0] && current[1]
      ? `${current[0]} · ${current[1]}`
      : current[0] || current[1] || "не выбраны";

  return (
    <div className="sheet-domain-chip-wrap" ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        className="sheet-domain-chip"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Домены: ${domainLabel}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="sheet-domain-chip-label">Домены</span>
        <span className="sheet-domain-chip-value">{domainLabel}</span>
        <Icon name="chevron-down" size={12} />
      </button>
      {open && (
        <div
          className="popover sheet-domain-popover is-form"
          role="dialog"
          aria-label="Домены Проводника"
          ref={menuRef}
          onKeyDown={onMenuKeyDown}
        >
          <div className="menu-label">Домены Проводника</div>
          {([0, 1] as const).map((index) => (
            <label className="sheet-domain-field" key={index}>
              <span className="eyebrow">
                {index === 0 ? "Первый домен" : "Второй домен"}
              </span>
              <Select
                value={current[index]}
                aria-label={
                  index === 0
                    ? "Первый домен Проводника"
                    : "Второй домен Проводника"
                }
                onChange={(event) => change(index, event.target.value)}
              >
                <option value="">Выберите домен</option>
                {conduit.domains.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
                  </option>
                ))}
              </Select>
            </label>
          ))}
          {conduit.message && (
            <p className="sheet-domain-warning">{conduit.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
