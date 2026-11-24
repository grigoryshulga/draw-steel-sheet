import { useLocale } from "../../i18n/locale";
import { useState } from "react";
import { Button, NumberInput } from "../../components/ui";
import { characterStatBreakdown } from "../../lib/character-calculations";
import { previewGameAction } from "../../lib/game-actions";
import type { GameAction } from "../../lib/game-actions";
import { useApp } from "../../state/AppContext";
import { StatBreakdown } from "./StatBreakdown";
import "./HealthControls.css";

type AmountKind = "damage" | "heal" | "temporary";

/** Мгновенное управление здоровьем: число, одна кнопка — и готово. Отмена — в истории. */
export function HealthControls({ onDone }: { onDone?: () => void }) {
  const { t, locale } = useLocale();
  const { character, derived, performGameAction } = useApp();
  const [draft, setDraft] = useState("");
  const amount = draft === "" ? 0 : Number(draft);
  const { recoveries } = character;

  const run = (action: GameAction) => {
    if (!performGameAction(action)) return;
    setDraft("");
    onDone?.();
  };
  const apply = (kind: AmountKind) => run({ kind, amount });
  const can = (kind: AmountKind) =>
    previewGameAction(character, { kind, amount }, locale).ok;

  const hint = (() => {
    if (!draft) return null;
    const preview = previewGameAction(character, {
      kind: "damage",
      amount,
    }, locale);
    const s = character.stamina;
    if (!preview.ok) return preview.reason;
    const next = preview.next.stamina;
    return t(`Урон: ${s.current} → ${next.current}${next.temp !== s.temp ? `, врем. ${s.temp} → ${next.temp}` : ""}`, `Damage: ${s.current} → ${next.current}${next.temp !== s.temp ? `, temp. ${s.temp} → ${next.temp}` : ""}`);
  })();

  return (
    <div className="health-controls">
      <div className="health-amount-row">
        <input
          className="input health-amount numeric"
          inputMode="numeric"
          placeholder="0"
          aria-label={t("Количество", "Amount")}
          value={draft}
          onChange={(event) =>
            setDraft(event.target.value.replace(/\D/g, "").slice(0, 4))
          }
          onKeyDown={(event) => {
            if (event.key === "Enter" && can("damage")) apply("damage");
          }}
        />
        <Button
          variant="danger"
          icon="sword"
          disabled={!can("damage")}
          onClick={() => apply("damage")}
        >
          {t("Урон", "Damage")}
        </Button>
        <Button
          variant="soft"
          icon="heart"
          disabled={!can("heal")}
          onClick={() => apply("heal")}
        >
          {t("Лечение", "Heal")}
        </Button>
        <Button
          variant="soft"
          disabled={!can("temporary")}
          onClick={() => apply("temporary")}
          title={t("Временная выносливость не складывается — берётся большее значение", "Temporary stamina does not stack; use the higher value")}
        >
          {t("Врем.", "Temporary")}
        </Button>
        <Button
          variant="soft"
          icon="heart"
          disabled={
            recoveries.current <= 0 ||
            character.stamina.current >= character.stamina.max
          }
          onClick={() => run({ kind: "recovery" })}
          title={t("Потратить восстановление", "Spend a recovery")}
        >
          {t("Передышка", "Catch Breath")} +{derived.recoveryValue}
        </Button>
        {!character.runtime?.tableCombat && <Button
          variant="ghost"
          icon="sun"
          className="health-rest"
          onClick={() => run({ kind: "rest" })}
          title={t("Полный отдых: выносливость и восстановления до максимума, ресурс и всплески — в 0", "Respite: restore stamina and recoveries, reset resources and surges to 0")}
        >
          {t("Отдых", "Respite")}
        </Button>}
      </div>
      {hint && (
        <p className="health-hint small muted" aria-live="polite">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Восстановления: тот же вид, что у здоровья, но мельче. */
export function RecoveriesReadout() {
  const { t } = useLocale();
  const { character, patch, performGameAction, readOnly } = useApp();
  const { recoveries } = character;
  return (
    <div className="vitals-current health-recoveries-readout">
      <span className="eyebrow">{t("Восстановления", "Recoveries")}</span>
      {readOnly ? (
        <span className="numeric">{recoveries.current}/{recoveries.max}</span>
      ) : (
        <>
          <input
            className="vital-big vital-current-input is-small numeric"
            inputMode="numeric"
            aria-label={t("Текущие восстановления", "Current recoveries")}
            key={recoveries.current}
            defaultValue={recoveries.current}
            onFocus={(event) => event.currentTarget.select()}
            onBlur={(event) => {
              const next = Number(event.currentTarget.value);
              const valid =
                event.currentTarget.value.trim() !== "" &&
                Number.isInteger(next) &&
                next >= 0 &&
                next <= recoveries.max;
              if (
                !valid ||
                next === recoveries.current ||
                !performGameAction({
                  kind: "resource",
                  resource: "recoveries",
                  value: next,
                })
              )
                event.currentTarget.value = String(recoveries.current);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                event.currentTarget.value = String(recoveries.current);
                event.currentTarget.blur();
              }
            }}
          />
          <span className="vital-max-edit">
            <span className="vital-max-slash numeric">/</span>
            <NumberInput
              value={recoveries.max}
              min={0}
              max={99}
              label={t("Максимум восстановлений", "Maximum recoveries")}
              className="vital-max-input"
              showButtons={false}
              onChange={(max) =>
                patch({
                  recoveries: {
                    ...recoveries,
                    max,
                    current: Math.min(recoveries.current, max),
                  },
                })
              }
            />
          </span>
        </>
      )}
      {character.automation?.enabled && (
        <StatBreakdown
          label={t("восстановлений", "recoveries")}
          breakdown={characterStatBreakdown(character, "recoveries")}
        />
      )}
    </div>
  );
}
