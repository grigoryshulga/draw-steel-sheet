import { useLocale, type Locale } from "../../i18n/locale";
import { useMemo } from "react";
import { Button, Panel } from "../../components/ui";
import { RuleText } from "../../components/RuleText";
import { ferocityDescription, ferocitySource } from "./ferocity-language";
import { growingFerocityState, type FerocityRow } from "../../lib/fury-ferocity";
import { useApp } from "../../state/AppContext";
import "./FuryFerocityTracker.css";

function thresholdStatus(row: FerocityRow, locale: Locale): { kind: string; text: string; label: string } {
  if (locale === "en") {
    if (!row.available) return { kind: "locked", text: `lvl ${row.level}`, label: `Available at level ${row.level}` };
    if (row.replacedBy) return { kind: "replaced", text: `↑ ${row.replacedBy}`, label: `Replaced by threshold ${row.replacedBy}` };
    if (row.retained) return { kind: "retained", text: "turn", label: "Retained until end of turn" };
    return row.active ? { kind: "active", text: "active", label: "Active" } : { kind: "pending", text: "—", label: "Not enough ferocity" };
  }
  if (!row.available) return { kind: "locked", text: `${row.level} ур.`, label: `Доступен с ${row.level}-го уровня` };
  if (row.replacedBy) return { kind: "replaced", text: `↑ ${row.replacedBy}`, label: `Заменён преимуществом порога ${row.replacedBy}` };
  if (row.retained) return { kind: "retained", text: "ход", label: "Сохраняется до конца хода" };
  return row.active
    ? { kind: "active", text: "есть", label: "Действует" }
    : { kind: "pending", text: "—", label: "Не хватает свирепости" };
}

/** Отдельная панель под ресурсами: действующие преимущества с учётом замен. */
export function FuryFerocityTracker() {
  const { t, locale } = useLocale();
  const { character, performGameAction, goTo, readOnly = false } = useApp();
  const state = useMemo(() => readOnly ? undefined : growingFerocityState(character), [character, readOnly]);
  if (!state) return null;
  const ruleText = (row: FerocityRow) => ferocityDescription(row, locale);
  const active = state.rows.filter((row) => row.active && !row.replacedBy);
  const next = state.rows.find((row) => row.available && !row.active);
  return (
    <Panel title={t("Растущая свирепость", "Growing Ferocity")} icon="spark" className="fury-ferocity" bodyClassName="fury-ferocity-body"
      actions={!state.missing && !character.runtime?.tableCombat && <Button size="sm" variant={state.turnActive ? "ghost" : "soft"}
          icon={state.turnActive ? "check" : "play"}
          aria-label={state.turnActive ? t("Завершить свой ход", "End your turn") : t("Начать свой ход", "Start your turn")}
          onClick={() => performGameAction({ kind: state.turnActive ? "fury-turn-end" : "fury-turn-start" })}>
          {state.turnActive ? t("Завершить ход", "End turn") : t("Начать ход", "Start turn")}
        </Button>}>
      {state.source && <p className="fury-ferocity-source">{ferocitySource(state.source, locale)}</p>}
      {state.missing ? <div className="fury-ferocity-missing">
        <p>{state.missing === "kit"
          ? t("Выберите комплект буревестника: Борен, Корвен, Раден или Вукен. От него зависят преимущества свирепости.", "Choose a Stormwight kit: Boren, Corven, Raden, or Vuken. It determines your ferocity benefits.")
          : t("Выберите первозданный аспект, чтобы видеть его преимущества свирепости.", "Choose a primordial aspect to see its ferocity benefits.")}</p>
        <Button size="sm" variant="soft" icon="book" onClick={() => goTo(state.missing === "kit" ? "inventory" : "development")}>
          {state.missing === "kit" ? t("Выбрать комплект", "Choose kit") : t("Выбрать аспект", "Choose aspect")}
        </Button>
      </div> : <>
        <ol className="fury-ferocity-thresholds" aria-label={t("Пороги свирепости", "Ferocity thresholds")}>
          {state.rows.map((row) => {
            const status = thresholdStatus(row, locale);
            return <li key={row.id} data-state={status.kind}
              aria-label={t(`${row.threshold} свирепости: ${status.label}`, `${row.threshold} ferocity: ${status.label}`)} title={`${status.label}. ${ruleText(row)}`}>
              <strong>{row.threshold}</strong><span>{status.text}</span>
            </li>;
          })}
        </ol>
        <p className={`fury-ferocity-turn${state.effective > state.current ? " is-retained" : ""}`} role="status">
          {state.turnActive
            ? t(`Максимум за ход: ${state.effective}. Достигнутые преимущества сохраняются до конца хода.`, `Turn maximum: ${state.effective}. Earned benefits last until the end of the turn.`)
            : character.runtime?.tableCombat
              ? t("Достигнутые преимущества сохраняются во время хода, начатого за столом.", "Earned benefits last during the turn started at the table.")
              : t("Преимущества зависят от текущей свирепости. В свой ход нажмите «Начать ход», чтобы сохранить их после траты ресурса.", "Benefits depend on current ferocity. Start your turn to retain them after spending the resource.")}
        </p>
        <div className="fury-ferocity-benefits" aria-live="polite">
          {active.length ? <ul className="fury-ferocity-active" aria-label={t("Действующие преимущества", "Active benefits")}>
            {active.map((row) => <li key={row.id} data-threshold={row.threshold} data-retained={row.retained || undefined}>
              <span className="fury-ferocity-bonus-threshold">{row.threshold}+</span>
              <RuleText text={ruleText(row)} sourceLocale={locale === "en" && ruleText(row) !== row.description ? "en" : undefined} />
            </li>)}
          </ul> : <p className="fury-ferocity-empty">{t("Пока нет действующих преимуществ.", "No active benefits yet.")}</p>}
        </div>
        {next && <section className="fury-ferocity-next" aria-label={t("Следующий порог", "Next threshold")}>
          <h4>{t(`При ${next.threshold} свирепости · ещё ${next.threshold - state.current}`, `At ${next.threshold} ferocity · ${next.threshold - state.current} remaining`)}</h4>
          <RuleText text={ruleText(next)} sourceLocale={locale === "en" && ruleText(next) !== next.description ? "en" : undefined} />
        </section>}
        {!character.automation?.enabled && <p className="fury-ferocity-manual">
          {t("Авторасчёт выключен: числовые бонусы добавляйте вручную.", "Automatic calculation is off: add numeric bonuses manually.")}
        </p>}
      </>}
    </Panel>
  );
}
