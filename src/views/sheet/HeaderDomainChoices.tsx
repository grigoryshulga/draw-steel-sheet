import { useState } from "react";
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
import { useApp } from "../../state/AppContext";

/**
 * Выбор домена в шапке героя. У Цензора это один домен, у Проводника — пара.
 * Остальные выборы класса остаются в панели особенностей.
 */
export function HeaderDomainChoices() {
  const { character, update } = useApp();
  const [draft, setDraft] = useState<[string, string]>(["", ""]);

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
    return (
      <div className="sheet-header-domains">
        <label className="sheet-domain-choice">
          <span className="eyebrow">Домен</span>
          <Select
            value={domainSelected}
            aria-label="Домен цензора"
            onChange={(event) =>
              update((current) =>
                withClassFeatureSelection(
                  current,
                  "censor.domain",
                  event.target.value,
                ),
              )
            }
          >
            <option value="">Не выбран</option>
            {domainOptions.map((option) => (
              <option key={option} value={option}>
                {domainChoice?.optionLabels?.[option] ?? option}
              </option>
            ))}
          </Select>
          {state?.warning && (
            <span className="sheet-domain-warning">{state.warning}</span>
          )}
        </label>
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

  return (
    <div className="sheet-header-domains">
      {([0, 1] as const).map((index) => (
        <label className="sheet-domain-choice" key={index}>
          <span className="eyebrow">
            {index === 0 ? "Первый домен" : "Второй домен"}
          </span>
          <Select
            value={current[index]}
            aria-label={
              index === 0 ? "Первый домен Проводника" : "Второй домен Проводника"
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
        <span className="sheet-domain-warning">{conduit.message}</span>
      )}
    </div>
  );
}
