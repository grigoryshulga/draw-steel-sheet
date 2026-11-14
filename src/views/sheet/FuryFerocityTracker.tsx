import { useMemo } from "react";
import { Button, Panel } from "../../components/ui";
import { RuleText } from "../../components/RuleText";
import { growingFerocityState, type FerocityRow } from "../../lib/fury-ferocity";
import { useApp } from "../../state/AppContext";
import "./FuryFerocityTracker.css";

function thresholdStatus(row: FerocityRow): { kind: string; text: string; label: string } {
  if (!row.available) return { kind: "locked", text: `${row.level} ур.`, label: `Доступен с ${row.level}-го уровня` };
  if (row.replacedBy) return { kind: "replaced", text: `↑ ${row.replacedBy}`, label: `Заменён преимуществом порога ${row.replacedBy}` };
  if (row.retained) return { kind: "retained", text: "ход", label: "Сохраняется до конца хода" };
  return row.active
    ? { kind: "active", text: "есть", label: "Действует" }
    : { kind: "pending", text: "—", label: "Не хватает свирепости" };
}

/** Отдельная панель под ресурсами: действующие преимущества с учётом замен. */
export function FuryFerocityTracker() {
  const { character, performGameAction, goTo, readOnly = false } = useApp();
  const state = useMemo(() => readOnly ? undefined : growingFerocityState(character), [character, readOnly]);
  if (!state) return null;
  const active = state.rows.filter((row) => row.active && !row.replacedBy);
  const next = state.rows.find((row) => row.available && !row.active);
  return (
    <Panel title="Растущая свирепость" icon="spark" className="fury-ferocity" bodyClassName="fury-ferocity-body"
      actions={!state.missing && <Button size="sm" variant={state.turnActive ? "ghost" : "soft"}
          icon={state.turnActive ? "check" : "play"}
          aria-label={state.turnActive ? "Завершить свой ход" : "Начать свой ход"}
          onClick={() => performGameAction({ kind: state.turnActive ? "fury-turn-end" : "fury-turn-start" })}>
          {state.turnActive ? "Завершить ход" : "Начать ход"}
        </Button>}>
      {state.source && <p className="fury-ferocity-source">{state.source}</p>}
      {state.missing ? <div className="fury-ferocity-missing">
        <p>{state.missing === "kit"
          ? "Выберите комплект буревестника: Борен, Корвен, Раден или Вукен. От него зависят преимущества свирепости."
          : "Выберите первозданный аспект, чтобы видеть его преимущества свирепости."}</p>
        <Button size="sm" variant="soft" icon="book" onClick={() => goTo(state.missing === "kit" ? "inventory" : "development")}>
          {state.missing === "kit" ? "Выбрать комплект" : "Выбрать аспект"}
        </Button>
      </div> : <>
        <ol className="fury-ferocity-thresholds" aria-label="Пороги свирепости">
          {state.rows.map((row) => {
            const status = thresholdStatus(row);
            return <li key={row.id} data-state={status.kind}
              aria-label={`${row.threshold} свирепости: ${status.label}`} title={`${status.label}. ${row.description}`}>
              <strong>{row.threshold}</strong><span>{status.text}</span>
            </li>;
          })}
        </ol>
        <p className={`fury-ferocity-turn${state.effective > state.current ? " is-retained" : ""}`} role="status">
          {state.turnActive
            ? `Максимум за ход: ${state.effective}. Достигнутые преимущества сохраняются до конца хода.`
            : "Преимущества зависят от текущей свирепости. В свой ход нажмите «Начать ход», чтобы сохранить их после траты ресурса."}
        </p>
        <div className="fury-ferocity-benefits" aria-live="polite">
          {active.length ? <ul className="fury-ferocity-active" aria-label="Действующие преимущества">
            {active.map((row) => <li key={row.id} data-threshold={row.threshold} data-retained={row.retained || undefined}>
              <span className="fury-ferocity-bonus-threshold">{row.threshold}+</span>
              <RuleText text={row.description} />
            </li>)}
          </ul> : <p className="fury-ferocity-empty">Пока нет действующих преимуществ.</p>}
        </div>
        {next && <section className="fury-ferocity-next" aria-label="Следующий порог">
          <h4>При {next.threshold} свирепости · ещё {next.threshold - state.current}</h4>
          <RuleText text={next.description} />
        </section>}
        {!character.automation?.enabled && <p className="fury-ferocity-manual">
          Авторасчёт выключен: числовые бонусы добавляйте вручную.
        </p>}
      </>}
    </Panel>
  );
}
