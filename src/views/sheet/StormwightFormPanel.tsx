import { useState } from "react";
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

export function StormwightFormPanel() {
  const { character, performGameAction, readOnly = false } = useApp();
  const [freeManeuver, setFreeManeuver] = useState(false);
  const state = readOnly ? undefined : stormwightFormState(character);
  if (!state) return null;
  const runtime = currentRuntime(character);
  const hybridBonusUsed = runtime.combatActive
    && runtime.triggers[STORMWIGHT_HYBRID_STAMINA]?.encounter === runtime.encounter;
  const changeForm = (form: StormwightForm, hybridSize?: "1S" | "1M") => {
    if (performGameAction({ kind: "stormwight-form", form, hybridSize, freeManeuver })) setFreeManeuver(false);
  };

  return <Panel title="Формы Буревестника" icon="spark" className="stormwight-form" bodyClassName="stormwight-form-body">
    <p className="stormwight-form-source">{state.kit.name} · {state.kit.animalForm}</p>
    <div className="stormwight-form-options" role="group" aria-label="Форма Буревестника">
      {FORMS.map(({ id, label, accessibleLabel }) => <Button key={id} size="sm"
        variant={state.form === id ? "soft" : "ghost"}
        aria-pressed={state.form === id}
        aria-label={accessibleLabel}
        disabled={state.form === id}
        onClick={() => changeForm(id)}>{label}</Button>)}
    </div>
    <div className="stormwight-form-cost">
      <span>{freeManeuver ? "Свободный манёвр · 1 свирепости" : "Манёвр · без затрат свирепости"}</span>
      <Toggle checked={freeManeuver} onChange={setFreeManeuver} label="Превратиться свободным манёвром за 1 свирепость" />
    </div>
    {state.form === "hybrid" && state.chooseHybridSize && <Field label="Размер гибрида">
      <Select value={state.hybridSize} aria-label="Размер гибрида"
        onChange={(event) => changeForm("hybrid", event.target.value as "1S" | "1M")}>
        <option value="1S">1S · Маленький</option>
        <option value="1M">1M · Средний</option>
      </Select>
    </Field>}
    {(state.flight || state.climb || state.ignoreDifficultTerrain) && <div className="stormwight-form-movement" aria-label="Передвижение в текущей форме">
      {state.flight && <Chip tone="accent">Полёт</Chip>}
      {state.climb && <Chip tone="accent">Лазание на полной скорости</Chip>}
      {state.ignoreDifficultTerrain && <Chip>Игнорирование труднопроходимой местности</Chip>}
    </div>}
    <div className="stormwight-form-rules" aria-live="polite">
      {state.description ? <RuleText text={state.description} />
        : <p>Бонусы комплекта и преимущества аспекта действуют и в истинной форме.</p>}
    </div>
    {state.hybridStamina && <p className="stormwight-form-hint" role="status">
      {hybridBonusUsed ? "Бонус за первое превращение в гибрида в этой битве уже получен."
        : "Первое превращение в гибрида в битве даст 10 временной выносливости."}
    </p>}
    {!character.automation?.enabled && <p className="stormwight-form-hint">
      Авторасчёт выключен: числовые бонусы добавляйте вручную.
    </p>}
  </Panel>;
}
