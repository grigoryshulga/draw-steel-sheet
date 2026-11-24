import { useLocale } from "../../../i18n/locale";
import { localizeGameMessage } from "../../../lib/game-actions";
import { useState } from "react";
import { CardDetailModal } from "../../../components/CardDetailModal";
import {
  Button,
  Field,
  Panel,
  Select,
  TextInput,
} from "../../../components/ui";
import { useApp } from "../../../state/AppContext";
import { AbilityPeek, MechanicDetails, useMechanicAbilityName } from "./MechanicDetails";
import {
  elementalistBaseTurnGain,
  elementalistPersistentAbilities,
  elementalistStartTurnGain,
  elementalistSustainCost,
  hasMedley,
  normalizeElementalistState,
  normalizeTroubadourState,
  persistentCost,
  previewRoutinesMagic,
  routineUnavailableReason,
  troubadourRoutines,
  type RoutinesMagicAction,
} from "../../../lib/class-mechanics/routines-magic";

export function TroubadourPanel() {
  const { t, locale } = useLocale();
  const abilityName = useMechanicAbilityName();
  const { character, performGameAction } = useApp();
  const state = normalizeTroubadourState(character.classMechanics?.troubadour);
  const routines = troubadourRoutines(character);
  const medley = hasMedley(character);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState("");
  const [secondSelection, setSecond] = useState<string>();
  const second = medley ? secondSelection ?? state.activeRoutineIds?.[1] ?? "" : "";
  const chosen =
    routines.find((a) => a.id === selected) ??
    routines.find((a) => a.id === state.activeRoutineId) ??
    routines[0];
  const activeIds = medley ? state.activeRoutineIds : state.activeRoutineIds?.slice(0, 1);
  const active = routines.filter((a) => activeIds?.includes(a.id));
  const action: RoutinesMagicAction = {
    kind: "troubadour-select",
    abilityId: chosen?.id ?? "",
    secondAbilityId: second || undefined,
  };
  const preview = previewRoutinesMagic(character, action);
  const send = (action: RoutinesMagicAction) =>
    performGameAction({ kind: "class-mechanic", action });
  const unavailable = routineUnavailableReason(character);
  return (
    <Panel
      title={t("Выступление", "Routine")}
      className="class-mechanics-panel"
      bodyClassName="class-mechanics-stack"
      actions={
        <MechanicDetails title={t("Правила выступления", "Routine rules")}>
          <p>
            {t("В начале каждого раунда выберите выступление или продолжайте текущее. Без действия; до конца встречи или потери возможности выступать.", "At the start of each round, choose a routine or continue the current one. This costs no action and lasts until the encounter ends or you cannot perform.")}
          </p>
          {medley && <p>{t("«Медли» позволяет вести два выступления одновременно.", "Medley allows two routines at once.")}</p>}
          <label>
            <input
              type="checkbox"
              checked={state.incapacitated ?? false}
              onChange={(e) =>
                send({
                  kind: "troubadour-incapacitated",
                  value: e.target.checked,
                })
              }
            />{" "}
            {t("Герой мёртв или застигнут врасплох", "Hero is dead or surprised")}
          </label>
        </MechanicDetails>
      }
    >
      {active.length ? (
        active.map((ability) => (
          <div className="class-mechanics-item" key={ability.id}>
            <AbilityPeek ability={ability} character={character} />
            <small>{locale === "en" ? ability.distance.replace(/^Аура(?=\s|$)/i, "Aura") : ability.distance}</small>
          </div>
        ))
      ) : (
        <p className="class-mechanics-note">{t("Нет активного выступления", "No active routine")}</p>
      )}
      {unavailable && <p className="class-mechanics-warning">{localizeGameMessage(unavailable, locale)}</p>}
      <div className="class-mechanics-row">
        <span className="class-mechanics-note">{t("Смена в начале раунда", "Change at start of round")}</span>
        <Button
          size="sm"
          onClick={() => {
            setSelected(state.activeRoutineId ?? "");
            setSecond(state.activeRoutineIds?.[1] ?? "");
            setEditing(true);
          }}
        >
          {active.length ? t("Сменить", "Change") : t("Выбрать", "Choose")}
        </Button>
        {active.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => send({ kind: "troubadour-stop" })}
          >
            {t("Прекратить", "End")}
          </Button>
        )}
      </div>
      {editing && (
        <CardDetailModal
          open
          title={t("Выбрать выступление", "Choose routine")}
          onClose={() => setEditing(false)}
          footer={
            <Button
              disabled={!preview.ok}
              onClick={() => {
                if (send(action)) setEditing(false);
              }}
            >
              {t("Начать выступление", "Start routine")}
            </Button>
          }
        >
          <div className="class-mechanics-stack">
            {routines.length ? (
              <>
                <Field label={t("Выступление героя", "Hero routine")}>
                  <Select
                    value={chosen?.id ?? ""}
                    onChange={(e) => {
                      setSelected(e.target.value);
                      if (second === e.target.value) setSecond("");
                    }}
                  >
                    {routines.map((a) => (
                      <option key={a.id} value={a.id}>
                        {abilityName(a)}
                      </option>
                    ))}
                  </Select>
                </Field>
                {chosen && (
                  <AbilityPeek ability={chosen} character={character} />
                )}
                {medley && (
                  <Field label={t("Второе выступление · Медли", "Second routine · Medley")}>
                    <Select
                      value={second}
                      onChange={(e) => setSecond(e.target.value)}
                    >
                      <option value="">{t("Без второго выступления", "No second routine")}</option>
                      {routines
                        .filter((a) => a.id !== chosen?.id)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {abilityName(a)}
                          </option>
                        ))}
                    </Select>
                  </Field>
                )}
                {routines
                  .filter((a) => a.id === second)
                  .map((a) => (
                    <AbilityPeek key={a.id} ability={a} character={character} />
                  ))}
              </>
            ) : (
              <p>
                {t("У героя нет способностей с ключевым словом «Выступление». Добавьте полученные выступления в способности героя.", "The hero has no abilities with the Routine keyword. Add learned routines to the hero’s abilities.")}
              </p>
            )}
            {!preview.ok && (
              <p className="class-mechanics-note">{localizeGameMessage(preview.reason, locale)}</p>
            )}
          </div>
        </CardDetailModal>
      )}
    </Panel>
  );
}

export function ElementalistPanel() {
  const { t, locale } = useLocale();
  const abilityName = useMechanicAbilityName();
  const { character, performGameAction } = useApp();
  const state = normalizeElementalistState(
    character.classMechanics?.elementalist,
  );
  const abilities = elementalistPersistentAbilities(character);
  const [editing, setEditing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [selected, setSelected] = useState("");
  const [target, setTarget] = useState("");
  const [damage, setDamage] = useState("");
  const chosen = abilities.find((a) => a.id === selected) ?? abilities[0];
  const send = (action: RoutinesMagicAction) =>
    performGameAction({ kind: "class-mechanic", action });
  const action: RoutinesMagicAction = {
    kind: "elementalist-sustain",
    abilityId: chosen?.id ?? "",
    target,
  };
  const preview = previewRoutinesMagic(character, action);
  const threshold = 5 * Math.max(0, character.characteristics.reason);
  return (
    <Panel
      title={t("Поддержание магии", "Persistent magic")}
      className="class-mechanics-panel"
      bodyClassName="class-mechanics-stack"
      actions={
        <MechanicDetails title={t("Поддержание магии", "Persistent magic")}>
          <p>
            {t("Отмечайте уже применённые способности. Поддержание уменьшает эссенцию в начале вашего хода; первоначальная стоимость оплачивается при применении способности.", "Mark abilities already used. Maintenance reduces essence at the start of your turn; the initial cost is paid when using the ability.")}
          </p>
          <p>
            {t(`Урон за один ход ≥ ${threshold} (5 × Разум) прекращает все поддержания. В конце встречи они также прекращаются.`, `Damage of ${threshold} or more in one turn (5 × Reason) ends all persistent effects. They also end at the end of the encounter.`)}
          </p>
          <p>
            {t("Один удар через панель здоровья проверяется автоматически. Несколько попаданий за один ход существа можно проверить по их сумме отдельно.", "A single hit entered through health controls is checked automatically. Check the combined damage of multiple hits in one creature’s turn separately.")}
          </p>
          <p>
            {t(`Вне боя поддержание длится число раундов, равное Победам (${character.victories}); длительность ведётся вручную.`, `Outside combat, maintenance lasts a number of rounds equal to Victories (${character.victories}); track duration manually.`)}
          </p>
        </MechanicDetails>
      }
    >
      <div className="class-mechanics-summary" aria-live="polite">
        <span>{t("Эссенция в начале хода", "Essence at start of turn")}</span>
        <strong>
          {elementalistBaseTurnGain(character)} −{" "}
          {elementalistSustainCost(character)} ={" "}
          {elementalistStartTurnGain(character)}
        </strong>
      </div>
      {state.sustained.length ? (
        state.sustained.map((entry) => {
          const ability = abilities.find((a) => a.id === entry.abilityId);
          return (
            <div className="class-mechanics-item" key={entry.abilityId}>
              <div>
                {ability ? (
                  <AbilityPeek ability={ability} character={character} />
                ) : (
                  <span>{t("Способность удалена", "Ability removed")}</span>
                )}
                <small>
                  {entry.target} · {ability ? persistentCost(ability) : 0}{" "}
                  {t("эссенции", "essence")}
                </small>
              </div>
              <Button
                size="sm"
                variant="ghost"
                icon="close"
                iconOnly
                aria-label={t(`Прекратить: ${ability ? abilityName(ability) : entry.target}`, `End: ${ability ? abilityName(ability) : entry.target}`)}
                onClick={() =>
                  send({
                    kind: "elementalist-stop",
                    abilityId: entry.abilityId,
                  })
                }
              />
            </div>
          );
        })
      ) : (
        <p className="class-mechanics-note">{t("Нет активных поддержаний", "No active persistent abilities")}</p>
      )}
      <div className="class-mechanics-row">
        <Button size="sm" onClick={() => setEditing(true)}>
          {t("Добавить", "Add")}
        </Button>
        {state.sustained.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => send({ kind: "elementalist-stop-all" })}
          >
            {t("Прекратить все", "End all")}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setChecking(true)}>
          {t("Урон за ход", "Damage this turn")}
        </Button>
      </div>
      <p className="class-mechanics-note">
        {t(`Срыв при ${threshold}+ урона за один ход`, `Ends at ${threshold}+ damage in one turn`)}
      </p>
      {editing && (
        <CardDetailModal
          open
          title={t("Добавить поддержание", "Add persistent ability")}
          onClose={() => setEditing(false)}
          footer={
            <Button
              disabled={!preview.ok}
              onClick={() => {
                if (send(action)) {
                  setTarget("");
                  setEditing(false);
                }
              }}
            >
              {t("Поддерживать", "Maintain")}
            </Button>
          }
        >
          <div className="class-mechanics-stack">
            {abilities.length ? (
              <>
                <Field label={t("Способность с поддержанием", "Persistent ability")}>
                  <Select
                    value={chosen?.id ?? ""}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {abilities.map((a) => (
                      <option key={a.id} value={a.id}>
                        {abilityName(a)} · {persistentCost(a)} {t("эссенции", "essence")}
                      </option>
                    ))}
                  </Select>
                </Field>
                {chosen && (
                  <AbilityPeek ability={chosen} character={character} />
                )}
                <Field label={t("Цель или область", "Target or area")}>
                  <TextInput
                    value={target}
                    maxLength={300}
                    onChange={(e) => setTarget(e.target.value)}
                  />
                </Field>
              </>
            ) : (
              <p>{t("У героя нет способностей с правилом «Поддержание N».", "The hero has no abilities with the Persist N rule.")}</p>
            )}
            {!preview.ok && (
              <p className="class-mechanics-note">{localizeGameMessage(preview.reason, locale)}</p>
            )}
          </div>
        </CardDetailModal>
      )}
      {checking && (
        <CardDetailModal
          open
          title={t("Урон за один ход", "Damage in one turn")}
          onClose={() => setChecking(false)}
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  if (send({ kind: "elementalist-reset-damage" }))
                    setChecking(false);
                }}
              >
                {t("Сбросить проверку", "Reset check")}
              </Button>
              <Button
                disabled={
                  !Number.isSafeInteger(Number(damage)) || Number(damage) <= 0
                }
                onClick={() => {
                  if (
                    send({
                      kind: "elementalist-damage",
                      amount: Number(damage),
                    })
                  ) {
                    setDamage("");
                    setChecking(false);
                  }
                }}
              >
                {t("Проверить поддержания", "Check persistent abilities")}
              </Button>
            </>
          }
        >
          <div className="class-mechanics-stack">
            <p>
              {t(`Сумма попаданий за один ход существа. Проверка прекращает поддержания при ${threshold}+ урона, но не меняет Выносливость.`, `Total damage in one creature’s turn. This check ends persistent effects at ${threshold}+ damage but does not change Stamina.`)}
            </p>
            <p>{t(`Последний проверенный урон: ${state.damageThisTurn}.`, `Last checked damage: ${state.damageThisTurn}.`)}</p>
            <Field label={t("Суммарный урон за один ход", "Total damage in one turn")}>
              <TextInput
                type="number"
                min={1}
                max={9999}
                value={damage}
                onChange={(e) => setDamage(e.target.value)}
              />
            </Field>
          </div>
        </CardDetailModal>
      )}
    </Panel>
  );
}
