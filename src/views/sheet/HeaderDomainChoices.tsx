import { useLocale } from "../../i18n/locale";
import { useRef, useState } from "react";
import { identityLabel } from "../../rules/consumer-identity-labels";
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
  const { locale, t } = useLocale();
  const label = (value: string) => identityLabel(value, locale, "Проводник");
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
      ? label(domainChoice?.optionLabels?.[domainSelected] ?? domainSelected)
      : t("не выбран", "not selected");
    return (
      <div className="sheet-domain-chip-wrap" ref={wrapRef}>
        <button
          type="button"
          ref={triggerRef}
          className="sheet-domain-chip"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t(`Домен: ${currentLabel}`, `Domain: ${currentLabel}`)}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sheet-domain-chip-label">{t("Домен", "Domain")}</span>
          <span className="sheet-domain-chip-value">{currentLabel}</span>
          <Icon name="chevron-down" size={12} />
        </button>
        {open && (
          <div
            className="popover sheet-domain-popover"
            role="menu"
            aria-label={t("Домен цензора", "Censor domain")}
            ref={menuRef}
            onKeyDown={onMenuKeyDown}
          >
            <div className="menu-label">{t("Домен цензора", "Censor domain")}</div>
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
                  <span>{label(domainChoice?.optionLabels?.[option] ?? option)}</span>
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
                  <span>{t("Не выбран", "Not selected")}</span>
                </button>
              </>
            )}
            {state?.warning && (
              <p className="sheet-domain-warning">{locale === "en" ? state.warning.replace(/^Сохранено: (.*)\. Это значение не входит в список доступных вариантов; выберите один из них\.$/, "Saved: $1. This value is not an available option; choose one of the available options.") : state.warning}</p>
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
      ? `${label(current[0])} · ${label(current[1])}`
      : label(current[0] || current[1]) || t("не выбраны", "not selected");

  return (
    <div className="sheet-domain-chip-wrap" ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        className="sheet-domain-chip"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t(`Домены: ${domainLabel}`, `Domains: ${domainLabel}`)}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="sheet-domain-chip-label">{t("Домены", "Domains")}</span>
        <span className="sheet-domain-chip-value">{domainLabel}</span>
        <Icon name="chevron-down" size={12} />
      </button>
      {open && (
        <div
          className="popover sheet-domain-popover is-form"
          role="dialog"
          aria-label={t("Домены Проводника", "Conduit domains")}
          ref={menuRef}
          onKeyDown={onMenuKeyDown}
        >
          <div className="menu-label">{t("Домены Проводника", "Conduit domains")}</div>
          {([0, 1] as const).map((index) => (
            <label className="sheet-domain-field" key={index}>
              <span className="eyebrow">
                {index === 0 ? t("Первый домен", "First domain") : t("Второй домен", "Second domain")}
              </span>
              <Select
                value={current[index]}
                aria-label={
                  index === 0
                    ? t("Первый домен Проводника", "First Conduit domain")
                    : t("Второй домен Проводника", "Second Conduit domain")
                }
                onChange={(event) => change(index, event.target.value)}
              >
                <option value="">{t("Выберите домен", "Choose a domain")}</option>
                {conduit.domains.map((domain) => (
                  <option key={domain} value={domain}>
                    {label(domain)}
                  </option>
                ))}
              </Select>
            </label>
          ))}
          {conduit.message && (
            <p className="sheet-domain-warning">{locale === "en" ? t("", `To restore feature choices, select two different domains in the hero header.${(character.automation?.classFeatureSelections?.["conduit.domain"] || character.subclass)?.trim() ? ` The saved value “${character.automation?.classFeatureSelections?.["conduit.domain"] || character.subclass}” remains unchanged, but does not specify two different known domains.` : " No domain pair was saved."} The abilities list does not confirm skill training.`) : conduit.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
