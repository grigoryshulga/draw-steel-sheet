import { useLocale } from "../../i18n/locale";
import { useEffect, useState } from "react";
import { stormwightEnglishForm } from "./stormwightEnglish";
import { RuleText } from "../../components/RuleText";
import { Button, Chip, Field, Panel, Select, Toggle } from "../../components/ui";
import { currentRuntime } from "../../lib/runtime";
import { STORMWIGHT_HYBRID_STAMINA, stormwightFormState } from "../../lib/stormwight-forms";
import { useApp } from "../../state/AppContext";
import type { StormwightForm } from "../../types";
import "./StormwightFormPanel.css";

const FORMS: { id: StormwightForm; label: string; accessibleLabel: string }[] = [
  { id: "true", label: "Истинная", accessibleLabel: "Истинная форма" },
  { id: "animal", label: "Животное", accessibleLabel: "Форма животного" },
  { id: "hybrid", label: "Гибрид", accessibleLabel: "Форма гибрида" },
];

let englishPack: Promise<string> | undefined;

export function StormwightFormPanel() {
  const { t, locale } = useLocale();
  const { character, performGameAction, readOnly = false } = useApp();
  const [freeManeuver, setFreeManeuver] = useState(false);
  const [original, setOriginal] = useState<string>();
  const state = readOnly ? undefined : stormwightFormState(character);
  const needsEnglish = locale === "en" && Boolean(state?.description);
  useEffect(() => {
    if (!needsEnglish) return;
    let active = true;
    englishPack ??= import("../../rules/repository").then(({ loadRuleArticle }) => loadRuleArticle("0924")).then(result => result.entities["kit.stormwight"]?.originalDescription || "");
    void englishPack.then(text => { if (active) setOriginal(text); }, () => { englishPack = undefined; if (active) setOriginal(""); });
    return () => { active = false; };
  }, [needsEnglish]);
  if (!state) return null;
  const englishForm = locale === "en" && original !== undefined ? stormwightEnglishForm(original, state.kit.originalName || "", state.form) : undefined;
  const runtime = currentRuntime(character);
  const hybridBonusUsed = runtime.combatActive
    && runtime.triggers[STORMWIGHT_HYBRID_STAMINA]?.encounter === runtime.encounter;
  const changeForm = (form: StormwightForm, hybridSize?: "1S" | "1M") => {
    if (performGameAction({ kind: "stormwight-form", form, hybridSize, freeManeuver })) setFreeManeuver(false);
  };

  return <Panel title={t("Формы Буревестника", "Stormwight forms")} icon="spark" className="stormwight-form" bodyClassName="stormwight-form-body">
    <p className="stormwight-form-source">{locale === "en" ? state.kit.originalName || state.kit.name : state.kit.name} · {locale === "en" ? ({ "Борен": "Bear", "Корвен": "Crow", "Раден": "Rat", "Вукен": "Wolf" } as Record<string, string>)[state.kit.name] || state.kit.animalForm : state.kit.animalForm}</p>
    <div className="stormwight-form-options" role="group" aria-label={t("Форма Буревестника", "Stormwight form")}>
      {FORMS.map(({ id, label, accessibleLabel }) => <Button key={id} size="sm"
        variant={state.form === id ? "soft" : "ghost"}
        aria-pressed={state.form === id}
        aria-label={locale === "en" ? ({ true: "True form", animal: "Animal form", hybrid: "Hybrid form" } as const)[id] : accessibleLabel}
        disabled={state.form === id}
        onClick={() => changeForm(id)}>{locale === "en" ? ({ true: "True", animal: "Animal", hybrid: "Hybrid" } as const)[id] : label}</Button>)}
    </div>
    <div className="stormwight-form-cost">
      <span>{freeManeuver ? t("Свободный манёвр · 1 свирепости", "Free maneuver · 1 ferocity") : t("Манёвр · без затрат свирепости", "Maneuver · no ferocity cost")}</span>
      <Toggle checked={freeManeuver} onChange={setFreeManeuver} label={t("Превратиться свободным манёвром за 1 свирепость", "Transform as a free maneuver for 1 ferocity")} />
    </div>
    {state.form === "hybrid" && state.chooseHybridSize && <Field label={t("Размер гибрида", "Hybrid size")}>
      <Select value={state.hybridSize} aria-label={t("Размер гибрида", "Hybrid size")}
        onChange={(event) => changeForm("hybrid", event.target.value as "1S" | "1M")}>
        <option value="1S">{t("1S · Маленький", "1S · Small")}</option>
        <option value="1M">{t("1M · Средний", "1M · Medium")}</option>
      </Select>
    </Field>}
    {(state.flight || state.climb || state.ignoreDifficultTerrain) && <div className="stormwight-form-movement" aria-label={t("Передвижение в текущей форме", "Movement in current form")}>
      {state.flight && <Chip tone="accent">{t("Полёт", "Flight")}</Chip>}
      {state.climb && <Chip tone="accent">{t("Лазание на полной скорости", "Climb at full speed")}</Chip>}
      {state.ignoreDifficultTerrain && <Chip>{t("Игнорирование труднопроходимой местности", "Ignore difficult terrain")}</Chip>}
    </div>}
    <div className="stormwight-form-rules" aria-live="polite">
      {locale === "en" && state.description && original !== undefined && !englishForm && <p className="muted">English source unavailable; Russian text follows.</p>}
      {state.description ? locale === "en" && original === undefined ? <p role="status">Loading description…</p> : <RuleText text={englishForm || state.description} sourceLocale={englishForm ? "en" : undefined} />
        : <p>{t("Бонусы комплекта и преимущества аспекта действуют и в истинной форме.", "Kit bonuses and aspect benefits also apply in true form.")}</p>}
    </div>
    {state.hybridStamina && <p className="stormwight-form-hint" role="status">
      {hybridBonusUsed ? t("Бонус за первое превращение в гибрида в этой битве уже получен.", "The first hybrid transformation bonus has already been gained this encounter.")
        : t("Первое превращение в гибрида в битве даст 10 временной выносливости.", "The first hybrid transformation in an encounter grants 10 temporary stamina.")}
    </p>}
    {!character.automation?.enabled && <p className="stormwight-form-hint">
      {t("Авторасчёт выключен: числовые бонусы добавляйте вручную.", "Automatic calculation is off: add numerical bonuses manually.")}
    </p>}
  </Panel>;
}
