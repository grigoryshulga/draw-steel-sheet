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
import { AbilityPeek, MechanicDetails } from "./MechanicDetails";
import {
  elementalistBaseTurnGain,
  elementalistPersistentAbilities,
  elementalistStartTurnGain,
  elementalistSustainCost,
  normalizeElementalistState,
  normalizeTroubadourState,
  persistentCost,
  previewRoutinesMagic,
  routineUnavailableReason,
  troubadourRoutines,
  type RoutinesMagicAction,
} from "../../../lib/class-mechanics/routines-magic";

export function TroubadourPanel() {
  const { character, performGameAction } = useApp();
  const state = normalizeTroubadourState(character.classMechanics?.troubadour);
  const routines = troubadourRoutines(character);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState("");
  const [secondSelection, setSecond] = useState<string>();
  const second = secondSelection ?? state.activeRoutineIds?.[1] ?? "";
  const chosen =
    routines.find((a) => a.id === selected) ??
    routines.find((a) => a.id === state.activeRoutineId) ??
    routines[0];
  const active = routines.filter((a) => state.activeRoutineIds?.includes(a.id));
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
      title="Выступление"
      className="class-mechanics-panel"
      bodyClassName="class-mechanics-stack"
      actions={
        <MechanicDetails title="Правила выступления">
          <p>
            В начале каждого раунда выберите выступление или продолжайте
            текущее. Без действия; до конца встречи или потери возможности
            выступать.
          </p>
          <p>
            С 5-го уровня «Медли» позволяет вести два выступления одновременно.
          </p>
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
            Герой мёртв или застигнут врасплох
          </label>
        </MechanicDetails>
      }
    >
      {active.length ? (
        active.map((ability) => (
          <div className="class-mechanics-item" key={ability.id}>
            <AbilityPeek ability={ability} character={character} />
            <small>{ability.distance}</small>
          </div>
        ))
      ) : (
        <p className="class-mechanics-note">Нет активного выступления</p>
      )}
      {unavailable && <p className="class-mechanics-warning">{unavailable}</p>}
      <div className="class-mechanics-row">
        <span className="class-mechanics-note">Смена в начале раунда</span>
        <Button
          size="sm"
          onClick={() => {
            setSelected(state.activeRoutineId ?? "");
            setSecond(state.activeRoutineIds?.[1] ?? "");
            setEditing(true);
          }}
        >
          {active.length ? "Сменить" : "Выбрать"}
        </Button>
        {active.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => send({ kind: "troubadour-stop" })}
          >
            Прекратить
          </Button>
        )}
      </div>
      {editing && (
        <CardDetailModal
          open
          title="Выбрать выступление"
          onClose={() => setEditing(false)}
          footer={
            <Button
              disabled={!preview.ok}
              onClick={() => {
                if (send(action)) setEditing(false);
              }}
            >
              Начать выступление
            </Button>
          }
        >
          <div className="class-mechanics-stack">
            {routines.length ? (
              <>
                <Field label="Выступление героя">
                  <Select
                    value={chosen?.id ?? ""}
                    onChange={(e) => {
                      setSelected(e.target.value);
                      if (second === e.target.value) setSecond("");
                    }}
                  >
                    {routines.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                {chosen && (
                  <AbilityPeek ability={chosen} character={character} />
                )}
                {character.level >= 5 && (
                  <Field label="Второе выступление · Медли">
                    <Select
                      value={second}
                      onChange={(e) => setSecond(e.target.value)}
                    >
                      <option value="">Без второго выступления</option>
                      {routines
                        .filter((a) => a.id !== chosen?.id)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
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
                У героя нет способностей с ключевым словом «Выступление».
                Добавьте полученные выступления в способности героя.
              </p>
            )}
            {!preview.ok && (
              <p className="class-mechanics-note">{preview.reason}</p>
            )}
          </div>
        </CardDetailModal>
      )}
    </Panel>
  );
}

export function ElementalistPanel() {
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
      title="Поддержание магии"
      className="class-mechanics-panel"
      bodyClassName="class-mechanics-stack"
      actions={
        <MechanicDetails title="Поддержание магии">
          <p>
            Отмечайте уже применённые способности. Поддержание уменьшает
            эссенцию в начале вашего хода; первоначальная стоимость оплачивается
            при применении способности.
          </p>
          <p>
            Урон за один ход ≥ {threshold} (5 × Разум) прекращает все
            поддержания. В конце встречи они также прекращаются.
          </p>
          <p>
            Один удар через панель здоровья проверяется автоматически. Несколько
            попаданий за один ход существа можно проверить по их сумме отдельно.
          </p>
          <p>
            Вне боя поддержание длится число раундов, равное Победам (
            {character.victories}); длительность ведётся вручную.
          </p>
        </MechanicDetails>
      }
    >
      <div className="class-mechanics-summary" aria-live="polite">
        <span>Эссенция в начале хода</span>
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
                  <span>Способность удалена</span>
                )}
                <small>
                  {entry.target} · {ability ? persistentCost(ability) : 0}{" "}
                  эссенции
                </small>
              </div>
              <Button
                size="sm"
                variant="ghost"
                icon="close"
                iconOnly
                aria-label={`Прекратить: ${ability?.name ?? entry.target}`}
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
        <p className="class-mechanics-note">Нет активных поддержаний</p>
      )}
      <div className="class-mechanics-row">
        <Button size="sm" onClick={() => setEditing(true)}>
          Добавить
        </Button>
        {state.sustained.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => send({ kind: "elementalist-stop-all" })}
          >
            Прекратить все
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setChecking(true)}>
          Урон за ход
        </Button>
      </div>
      <p className="class-mechanics-note">
        Срыв при {threshold}+ урона за один ход
      </p>
      {editing && (
        <CardDetailModal
          open
          title="Добавить поддержание"
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
              Поддерживать
            </Button>
          }
        >
          <div className="class-mechanics-stack">
            {abilities.length ? (
              <>
                <Field label="Способность с поддержанием">
                  <Select
                    value={chosen?.id ?? ""}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {abilities.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} · {persistentCost(a)} эссенции
                      </option>
                    ))}
                  </Select>
                </Field>
                {chosen && (
                  <AbilityPeek ability={chosen} character={character} />
                )}
                <Field label="Цель или область">
                  <TextInput
                    value={target}
                    maxLength={300}
                    onChange={(e) => setTarget(e.target.value)}
                  />
                </Field>
              </>
            ) : (
              <p>У героя нет способностей с правилом «Поддержание N».</p>
            )}
            {!preview.ok && (
              <p className="class-mechanics-note">{preview.reason}</p>
            )}
          </div>
        </CardDetailModal>
      )}
      {checking && (
        <CardDetailModal
          open
          title="Урон за один ход"
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
                Сбросить проверку
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
                Проверить поддержания
              </Button>
            </>
          }
        >
          <div className="class-mechanics-stack">
            <p>
              Сумма попаданий за один ход существа. Проверка прекращает
              поддержания при {threshold}+ урона, но не меняет Выносливость.
            </p>
            <p>Последний проверенный урон: {state.damageThisTurn}.</p>
            <Field label="Суммарный урон за один ход">
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
