import { useState } from "react";
import { Button, Chip, Field, NumberInput, Select, Toggle } from "../../components/ui";
import { TierBadge } from "../../components/TierBadge";
import { CHARACTERISTICS } from "../../lib/rules";
import type { RollConfig, RollEntry } from "../../lib/roll";
import { useApp } from "../../state/AppContext";
import { formatBonus } from "../../lib/utils";
import type { CharacteristicKey } from "../../types";

interface Props {
  onRoll: (config: RollConfig) => void;
  lastRoll: RollEntry | null;
  log: RollEntry[];
}

const timeFormat = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

/** Панель броска силы: параметры, результат с тирами и сессионный журнал. */
export function PowerRollPanel({ onRoll, lastRoll, log }: Props) {
  const { character } = useApp();
  const [key, setKey] = useState<CharacteristicKey>("might");
  const [edges, setEdges] = useState(0);
  const [banes, setBanes] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [skill, setSkill] = useState("");
  const [isMainAction, setIsMainAction] = useState(true);

  const selected = CHARACTERISTICS.find((meta) => meta.key === key);
  const charValue = character.characteristics[key] ?? 0;

  const skillBonus = skill ? 2 : 0;

  const roll = () => {
    onRoll({
      label: selected
        ? `${selected.label}${skill ? ` · ${skill}` : ""}`
        : key,
      characteristicKey: key,
      edges,
      banes,
      bonus: bonus + skillBonus,
      isMainAction,
    });
  };

  return (
    <div className="roll-panel-content">
      <div className="roll-controls">
        <div className="roll-controls-row">
          <Field label="Характеристика" className="roll-char-field">
            <Select
              value={key}
              aria-label="Характеристика броска силы"
              onChange={(event) => setKey(event.target.value as CharacteristicKey)}
            >
              {CHARACTERISTICS.map((meta) => (
                <option key={meta.key} value={meta.key}>
                  {meta.label}
                </option>
              ))}
            </Select>
          </Field>
          <span className="chip chip-static chip-accent roll-char-value" title="Значение выбранной характеристики">
            {formatBonus(charValue)}
          </span>
        </div>

        <div className="roll-modifiers">
          <div className="roll-modifier">
            <span className="roll-chip-label eyebrow">Преим.</span>
            <div className="roll-chips" role="group" aria-label="Преимущества">
              {[0, 1, 2].map((count) => (
                <Chip
                  key={count}
                  active={edges === count}
                  title={count === 0 ? "Без преимущества" : count === 1 ? "Преимущество: +2 к броску" : "Двойное преимущество: +1 тир"}
                  onClick={() => {
                    setEdges(count);
                    if (count > 0) setBanes(0);
                  }}
                >
                  {count === 0 ? "нет" : `×${count}`}
                </Chip>
              ))}
            </div>
          </div>

          <div className="roll-modifier">
            <span className="roll-chip-label eyebrow">Помеха</span>
            <div className="roll-chips" role="group" aria-label="Помехи">
              {[0, 1, 2].map((count) => (
                <Chip
                  key={count}
                  active={banes === count}
                  title={count === 0 ? "Без помехи" : count === 1 ? "Помеха: −2 к броску" : "Двойная помеха: −1 тир"}
                  onClick={() => {
                    setBanes(count);
                    if (count > 0) setEdges(0);
                  }}
                >
                  {count === 0 ? "нет" : `×${count}`}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        <div className="roll-secondary-row">
          {character.skills.length > 0 && (
            <Field label="Навык (+2)" className="roll-skill-field">
              <div className="roll-skill-control">
                <Select
                  value={skill}
                  aria-label="Применимый навык"
                  onChange={(event) => setSkill(event.target.value)}
                >
                  <option value="">Без навыка</option>
                  {character.skills.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
                {skill && <span className="chip chip-static chip-green">+2</span>}
              </div>
            </Field>
          )}

          <Field label="Бонус" className="roll-bonus-field">
            <NumberInput
              value={bonus}
              label="Числовой бонус к броску"
              className="tiny-num"
              onChange={setBonus}
            />
          </Field>

          <div className="roll-main-action">
            <Toggle
              checked={isMainAction}
              label="Основное действие"
              onChange={setIsMainAction}
            />
          </div>
        </div>

        <Button variant="primary" icon="dice" onClick={roll} className="roll-submit">
          Бросить 2d10
        </Button>
      </div>

      <div className="roll-stage">
        {lastRoll ? (
          <div className={`roll-result tier-${lastRoll.result.tier}${lastRoll.result.crit ? " is-crit" : ""}`}>
            <div className="roll-headline">
              <div className="roll-dice" aria-hidden="true">
                <span className="die numeric">{lastRoll.result.die1}</span>
                <span className="die numeric">{lastRoll.result.die2}</span>
              </div>
              <span className="roll-total numeric">{lastRoll.result.total}</span>
              <TierBadge tier={lastRoll.result.tier} size="lg" />
              {lastRoll.result.crit && <span className="roll-crit">крит</span>}
            </div>
            <p className="roll-detail mono small">
              {lastRoll.label}: {lastRoll.detail} → {lastRoll.result.total}
            </p>
            <p className="small muted">{lastRoll.result.note}</p>
          </div>
        ) : null}
      </div>

      {log.length > 0 && (
        <div className="roll-log-wrap">
          <span className="eyebrow">Журнал бросков</span>
          <ul className="roll-log">
            {log.map((entry) => (
              <li key={entry.id}>
                <TierBadge tier={entry.result.tier} size="sm" />
                <span className="roll-log-label">{entry.label}</span>
                <span className="numeric roll-log-total">{entry.result.total}</span>
                {entry.result.crit && <span className="roll-crit">крит</span>}
                <span className="roll-log-time mono small muted">{timeFormat.format(entry.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}
