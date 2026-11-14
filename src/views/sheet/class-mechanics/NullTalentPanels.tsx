import { useState } from "react";
import { heroicResourceFloor } from "../../../lib/game-actions";
import { Button, Panel, Select, TextInput } from "../../../components/ui";
import { useApp } from "../../../state/AppContext";
import { MechanicDetails } from "./MechanicDetails";
import {
  NULL_ENHANCEMENTS,
  nullDiscipline,
  nullMastery,
  nullState,
  talentState,
  type NullTalentAction,
} from "../../../lib/class-mechanics/null-talent";

export function NullPanels() {
  const { character, performGameAction } = useApp();
  const state = nullState(character),
    rows = nullMastery(character);
  const [enhancement, setEnhancement] = useState<
    (typeof NULL_ENHANCEMENTS)[number]
  >(NULL_ENHANCEMENTS[0]);
  const act = (action: NullTalentAction) =>
    performGameAction({ kind: "class-mechanic", action });
  return (
    <>
      <Panel
        title="Мастерство дисциплины"
        className="class-mechanics-panel"
        bodyClassName="class-mechanics-stack"
        actions={
          <MechanicDetails title="Мастерство дисциплины">
            <p>
              Достигнутые преимущества сохраняются до конца своего хода, даже
              после траты дисциплины. Высшие пороги заменяют соответствующие
              низшие.
            </p>
            {rows.map((row) => (
              <section key={row.threshold}>
                <h3>
                  {row.threshold} дисциплины · уровень {row.level}
                </h3>
                <p>{row.text}</p>
              </section>
            ))}
          </MechanicDetails>
        }
      >
        <p className="class-mechanics-note">
          Сейчас {character.heroicResource.current} · для мастерства{" "}
          {nullDiscipline(character)} до конца хода
        </p>
        {!rows.length && (
          <p className="class-mechanics-note">Выберите традицию Нуля.</p>
        )}
        <div className="class-mechanics-thresholds">
          {rows.map((row) => (
            <MechanicDetails
              key={row.threshold}
              title={`Мастерство: ${row.threshold} дисциплины`}
              className={`class-mechanics-threshold ${row.active ? "is-active" : character.level < row.level ? "is-locked" : ""}`}
              label={
                <>
                  <strong>{row.threshold}</strong>
                  <small>
                    {row.active
                      ? "Действует"
                      : character.level < row.level
                        ? `${row.level} ур.`
                        : row.replaced
                          ? "Заменено"
                          : "—"}
                  </small>
                </>
              }
            >
              <p>{row.text}</p>
              <p className="muted">Доступно с {row.level}-го уровня.</p>
            </MechanicDetails>
          ))}
        </div>
      </Panel>
      <Panel
        title="Поле нуля"
        className="class-mechanics-panel"
        bodyClassName="class-mechanics-stack"
        actions={
          <MechanicDetails title="Поле нуля">
            <p>
              Маневр, аура 1. Каждый враг в области уменьшает свои потенциалы на
              1. Поле сохраняется вне боя, пока вы не выключите его или не
              окажетесь при смерти.
            </p>
            {character.level >= 4 && (
              <p>
                В бою поле удаляет временные сверхъестественные эффекты
                местности вашего уровня или ниже и подавляет постоянные, пока
                перекрывает их.
              </p>
            )}
            {character.level >= 10 && (
              <p>
                В начале боя можно потратить 1 порядок: размер ауры +1 до конца
                встречи. Отметьте расход порядка в ресурсах.
              </p>
            )}
            <p>
              Раз в свой ход: 1 дисциплина за усиление до начала следующего
              своего хода.
            </p>
            <ul>
              <li>
                Гравитационное разрушение: при первом уроне цели за ход можно
                швырнуть её до 2 клеток.
              </li>
              <li>
                Инерционный якорь: цель, начинающая ход в поле, не может
                смещаться.
              </li>
              <li>
                Синаптический разрыв: потенциал способности против цели с
                потенциалом увеличивается на 1.
              </li>
            </ul>
          </MechanicDetails>
        }
      >
        <div className="class-mechanics-summary">
          <span>
            {state.fieldActive
              ? "Активно · аура 1 · потенциалы −1"
              : "Выключено"}
          </span>
          <Button
            size="sm"
            onClick={() =>
              act({ kind: "null-field", active: !state.fieldActive })
            }
          >
            {state.fieldActive ? "Выключить" : "Включить"}
          </Button>
        </div>
        {state.enhancement && (
          <p className="class-mechanics-note" role="status">
            {state.enhancement} · до начала следующего хода
          </p>
        )}
        {state.fieldActive && (
          <div className="class-mechanics-row">
            <Select
              aria-label="Усиление Поля нуля"
              value={enhancement}
              onChange={(e) =>
                setEnhancement(e.target.value as typeof enhancement)
              }
            >
              {NULL_ENHANCEMENTS.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </Select>
            <Button
              size="sm"
              disabled={
                !character.runtime?.turnActive ||
                character.heroicResource.current < 1 ||
                state.enhancedTurn === (character.runtime?.turn ?? 0)
              }
              onClick={() => act({ kind: "null-enhance", enhancement })}
            >
              Усилить · 1
            </Button>
          </div>
        )}
      </Panel>
    </>
  );
}
export function TalentPanel() {
  const { character, performGameAction } = useApp();
  const [text, setText] = useState("");
  const state = talentState(character),
    strained = character.heroicResource.current < 0;
  const act = (action: NullTalentAction) =>
    performGameAction({ kind: "class-mechanic", action });
  const damage =
    strained && !(character.level >= 10 && state.waiveStrainDamage)
      ? -character.heroicResource.current
      : 0;
  return (
    <Panel
      title="Ясность и возбужденность"
      className="class-mechanics-panel"
      bodyClassName="class-mechanics-stack"
      actions={
        <MechanicDetails title="Ясность и возбужденность">
          <p>
            При ясности ниже нуля вы в состоянии возбужденности. Минимальная
            ясность: {heroicResourceFloor(character)}. В конце своего хода вы
            получаете урон за каждое отрицательное очко ясности. Он применяется
            один раз при завершении хода.
          </p>
          <p>
            Последствия способностей заканчиваются по своим условиям.
            Возвращение ясности к нулю и конец боя не снимают их автоматически.
          </p>
        </MechanicDetails>
      }
    >
      <div className="class-mechanics-summary" role="status">
        <span
          className={
            strained ? "class-mechanics-warning" : "class-mechanics-note"
          }
        >
          {strained ? "Возбужденность" : "Возбужденности нет"}
        </span>
        <strong>{damage} урона в конце хода</strong>
      </div>
      {character.level >= 10 && (
        <label>
          <input
            type="checkbox"
            checked={state.waiveStrainDamage}
            onChange={(e) =>
              act({ kind: "talent-waive-strain", waive: e.target.checked })
            }
          />{" "}
          Не получать урон за отрицательную ясность
        </label>
      )}
      {state.consequences.map((consequence, index) => (
        <div className="class-mechanics-item" key={`${index}-${consequence}`}>
          <MechanicDetails
            title="Последствие возбужденности"
            label={consequence}
          >
            <p>{consequence}</p>
          </MechanicDetails>
          <Button
            size="sm"
            variant="ghost"
            icon="close"
            iconOnly
            aria-label={`Завершить последствие: ${consequence}`}
            onClick={() => act({ kind: "talent-consequence-remove", index })}
          />
        </div>
      ))}
      <div className="class-mechanics-row">
        <TextInput
          aria-label="Последствие возбужденности"
          placeholder="Последствие и срок"
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button
          size="sm"
          icon="plus"
          iconOnly
          aria-label="Добавить последствие"
          disabled={!text.trim() || state.consequences.length >= 50}
          onClick={() => {
            if (act({ kind: "talent-consequence-add", text })) setText("");
          }}
        />
      </div>
    </Panel>
  );
}
