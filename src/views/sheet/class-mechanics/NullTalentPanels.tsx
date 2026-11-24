import { loadRuleArticle } from "../../../rules/repository";
import { useLocale } from "../../../i18n/locale";
import { useLocalizedData } from "../../../i18n/use-localized-data";
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

const loadNullOriginal = async () => Object.values((await loadRuleArticle("0811")).entities);

export function masteryOriginalText(entities: { id: string; originalDescription?: string }[], subclass: string, threshold: number): string | undefined {
  const tradition = subclass.includes("Хронокинетик") ? "chronokinetic" : subclass.includes("Криокинетик") ? "cryokinetic" : subclass.includes("Метакинетик") ? "metakinetic" : undefined;
  const text = entities.find(entity => entity.id === `feature.null.level-1.${tradition}-mastery`)?.originalDescription;
  return text?.split("\n").map(line => line.split("|").map(cell => cell.trim())).find(cells => new RegExp(`^${threshold}(?:\\s|$)`).test(cells[1] || ""))?.[2];
}

export function NullPanels() {
  const { t, locale } = useLocale();
  const original = useLocalizedData(locale, loadNullOriginal);
  const enhancementLabel = (value: string) => t(value, ({ "Гравитационное разрушение": "Gravitic Disruption", "Инерционный якорь": "Inertial Anchor", "Синаптический разрыв": "Synaptic Break" } as Record<string, string>)[value] || value);
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
        title={t("Мастерство дисциплины", "Discipline mastery")}
        className="class-mechanics-panel"
        bodyClassName="class-mechanics-stack"
        actions={
          <MechanicDetails title={t("Мастерство дисциплины", "Discipline mastery")}>
            <p>
              {t("Достигнутые преимущества сохраняются до конца своего хода, даже после траты дисциплины. Высшие пороги заменяют соответствующие низшие.", "Earned benefits last until the end of your turn, even after spending discipline. Higher thresholds replace the corresponding lower ones.")}
            </p>
            {rows.map((row) => (
              <section key={row.threshold}>
                <h3>
                  {t(`${row.threshold} дисциплины · уровень ${row.level}`, `${row.threshold} discipline · level ${row.level}`)}
                </h3>
                <p>{(locale === "en" && original && masteryOriginalText(original, character.subclass, row.threshold)) || row.text}</p>
              </section>
            ))}
          </MechanicDetails>
        }
      >
        <p className="class-mechanics-note">
          {t(`Сейчас ${character.heroicResource.current} · для мастерства ${nullDiscipline(character)} до конца хода`, `Current ${character.heroicResource.current} · mastery ${nullDiscipline(character)} until end of turn`)}
        </p>
        {!rows.length && (
          <p className="class-mechanics-note">{t("Выберите традицию Нуля.", "Choose a Null tradition.")}</p>
        )}
        <div className="class-mechanics-thresholds">
          {rows.map((row) => (
            <MechanicDetails
              key={row.threshold}
              title={t(`Мастерство: ${row.threshold} дисциплины`, `Mastery: ${row.threshold} discipline`)}
              className={`class-mechanics-threshold ${row.active ? "is-active" : character.level < row.level ? "is-locked" : ""}`}
              label={
                <>
                  <strong>{row.threshold}</strong>
                  <small>
                    {row.active
                      ? t("Действует", "Active")
                      : character.level < row.level
                        ? t(`${row.level} ур.`, `level ${row.level}`)
                        : row.replaced
                          ? t("Заменено", "Replaced")
                          : "—"}
                  </small>
                </>
              }
            >
              <p>{(locale === "en" && original && masteryOriginalText(original, character.subclass, row.threshold)) || row.text}</p>
              <p className="muted">{t(`Доступно с ${row.level}-го уровня.`, `Available at level ${row.level}.`)}</p>
            </MechanicDetails>
          ))}
        </div>
      </Panel>
      <Panel
        title={t("Поле нуля", "Null field")}
        className="class-mechanics-panel"
        bodyClassName="class-mechanics-stack"
        actions={
          <MechanicDetails title={t("Поле нуля", "Null field")}>
            <p>
              {t("Маневр, аура 1. Каждый враг в области уменьшает свои потенциалы на 1. Поле сохраняется вне боя, пока вы не выключите его или не окажетесь при смерти.", "Maneuver, aura 1. Each enemy in the area reduces their potencies by 1. The field persists outside combat until you turn it off or are dying.")}
            </p>
            {character.level >= 4 && (
              <p>
                {t("В бою поле удаляет временные сверхъестественные эффекты местности вашего уровня или ниже и подавляет постоянные, пока перекрывает их.", "In combat, the field removes temporary supernatural terrain effects of your level or lower and suppresses permanent effects while overlapping them.")}
              </p>
            )}
            {character.level >= 10 && (
              <p>
                {t("В начале боя можно потратить 1 порядок: размер ауры +1 до конца встречи. Отметьте расход порядка в ресурсах.", "At the start of combat, spend 1 order to increase aura size by 1 until the encounter ends. Record the order spent in resources.")}
              </p>
            )}
            <p>
              {t("Раз в свой ход: 1 дисциплина за усиление до начала следующего своего хода.", "Once on your turn, spend 1 discipline for an enhancement until the start of your next turn.")}
            </p>
            <ul>
              <li>
                {t("Гравитационное разрушение: при первом уроне цели за ход можно швырнуть её до 2 клеток.", "Gravitic Disruption: the first time you damage a target on a turn, you can vertical push them up to 2 squares.")}
              </li>
              <li>
                {t("Инерционный якорь: цель, начинающая ход в поле, не может смещаться.", "Inertial Anchor: a target starting their turn in the field cannot shift.")}
              </li>
              <li>
                {t("Синаптический разрыв: потенциал способности против цели с потенциалом увеличивается на 1.", "Synaptic Break: increase an ability’s potency by 1 against a target with potency.")}
              </li>
            </ul>
          </MechanicDetails>
        }
      >
        <div className="class-mechanics-summary">
          <span>
            {state.fieldActive
              ? t("Активно · аура 1 · потенциалы −1", "Active · aura 1 · potency −1")
              : t("Выключено", "Off")}
          </span>
          <Button
            size="sm"
            onClick={() =>
              act({ kind: "null-field", active: !state.fieldActive })
            }
          >
            {state.fieldActive ? t("Выключить", "Turn off") : t("Включить", "Turn on")}
          </Button>
        </div>
        {state.enhancement && (
          <p className="class-mechanics-note" role="status">
            {enhancementLabel(state.enhancement)} · {t("до начала следующего хода", "until the start of your next turn")}
          </p>
        )}
        {state.fieldActive && (
          <div className="class-mechanics-row">
            <Select
              aria-label={t("Усиление Поля нуля", "Null field enhancement")}
              value={enhancement}
              onChange={(e) =>
                setEnhancement(e.target.value as typeof enhancement)
              }
            >
              {NULL_ENHANCEMENTS.map((v) => (
                <option key={v} value={v}>{enhancementLabel(v)}</option>
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
              {t("Усилить · 1", "Enhance · 1")}
            </Button>
          </div>
        )}
      </Panel>
    </>
  );
}
export function TalentPanel() {
  const { t } = useLocale();
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
      title={t("Ясность и возбужденность", "Clarity and strain")}
      className="class-mechanics-panel"
      bodyClassName="class-mechanics-stack"
      actions={
        <MechanicDetails title={t("Ясность и возбужденность", "Clarity and strain")}>
          <p>
            {t(`При ясности ниже нуля вы в состоянии возбужденности. Минимальная ясность: ${heroicResourceFloor(character)}. В конце своего хода вы получаете урон за каждое отрицательное очко ясности. Он применяется один раз при завершении хода.`, `Below zero clarity you are strained. Minimum clarity: ${heroicResourceFloor(character)}. At the end of your turn, take damage for each negative clarity point, once when the turn ends.`)}
          </p>
          <p>
            {t("Последствия способностей заканчиваются по своим условиям. Возвращение ясности к нулю и конец боя не снимают их автоматически.", "Ability consequences end according to their conditions. Returning clarity to zero or ending combat does not remove them automatically.")}
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
          {strained ? t("Возбужденность", "Strained") : t("Возбужденности нет", "Not strained")}
        </span>
        <strong>{t(`${damage} урона в конце хода`, `${damage} damage at end of turn`)}</strong>
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
          {t("Не получать урон за отрицательную ясность", "Do not take damage from negative clarity")}
        </label>
      )}
      {state.consequences.map((consequence, index) => (
        <div className="class-mechanics-item" key={`${index}-${consequence}`}>
          <MechanicDetails
            title={t("Последствие возбужденности", "Strained consequence")}
            label={consequence}
          >
            <p>{consequence}</p>
          </MechanicDetails>
          <Button
            size="sm"
            variant="ghost"
            icon="close"
            iconOnly
            aria-label={t(`Завершить последствие: ${consequence}`, `End consequence: ${consequence}`)}
            onClick={() => act({ kind: "talent-consequence-remove", index })}
          />
        </div>
      ))}
      <div className="class-mechanics-row">
        <TextInput
          aria-label={t("Последствие возбужденности", "Strained consequence")}
          placeholder={t("Последствие и срок", "Consequence and duration")}
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button
          size="sm"
          icon="plus"
          iconOnly
          aria-label={t("Добавить последствие", "Add consequence")}
          disabled={!text.trim() || state.consequences.length >= 50}
          onClick={() => {
            if (act({ kind: "talent-consequence-add", text })) setText("");
          }}
        />
      </div>
    </Panel>
  );
}
