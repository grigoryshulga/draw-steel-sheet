import { useState } from "react";
import {
  Button,
  Panel,
  Field,
  TextInput,
  Select,
} from "../../../components/ui";
import { useApp } from "../../../state/AppContext";
import { activeClassFeatures } from "../../../lib/class-features";
import {
  conduitDomains,
  normalizeCensorState,
  normalizeTacticianState,
  normalizeConduitState,
  tacticianMarkLimit,
} from "../../../lib/class-mechanics/targets-prayer";
import type { TargetsPrayerAction } from "../../../lib/class-mechanics/targets-prayer";
import { MechanicDetails, RuleText } from "./MechanicDetails";

function useMechanic() {
  const app = useApp();
  return {
    ...app,
    act: (action: TargetsPrayerAction) =>
      app.performGameAction({ kind: "class-mechanic", action }),
  };
}
const judgmentRules = `**Суд · Маневр · Магия, Дальний · Дальний 10 · Один враг**

Цель осуждается вами до конца встречи, пока вы не используете эту способность снова, добровольно не завершите эффект (действие не требуется) или пока другой цензор не осудит цель.

Всякий раз, когда осуждённое существо использует основное действие в пределах вашей линии воздействия, вы можете свободным триггером нанести ему святой урон, равный двойному Присутствию. Когда его Выносливость падает до 0, вы можете свободным триггером применить Суд к новой цели.

Дополнительно вы можете потратить 1 гнев и выбрать один вариант свободного триггера:

- Смежная осуждённая цель начинает смещаться: свободный удар ближнего боя; её скорость становится 0 до конца текущего хода, предотвращая смещение.
- Осуждённая цель в пределах 10 клеток делает бросок силы: помеха на бросок.
- Осуждённая цель в пределах 10 клеток использует способность с потенциалом, нацеленную только на одно существо: потенциал уменьшается на 1.
- Вы наносите осуждённой цели урон способностью ближнего боя: она спровоцирована вами до конца своего следующего хода.

За одно событие можно выбрать только один платный вариант, даже если подходят несколько.`;
const markRules = `**Метка · Маневр · Дальний · Дальний 10 · Одно существо**

Цель отмечена до конца встречи, пока вы не окажетесь при смерти или пока не используете способность снова. Вы можете добровольно завершить метку без действия. Если другой тактик отмечает существо, ваша метка на нём заканчивается. Когда Выносливость отмеченной цели падает до 0, можно свободным триггером отметить новую цель в пределах расстояния.

Изначально способность отмечает одно существо. «Замысел» Воеводы с 5-го уровня позволяет выбирать двух существ. Другие способности могут отмечать дополнительные цели.

Пока отмеченная цель находится в вашей линии воздействия, вы и союзники в вашей линии воздействия получаете преимущество на броски силы против неё.

Когда вы или союзник наносите отмеченной цели выброшенный урон способностью, можно потратить 1 фокус и выбрать одно преимущество свободным триггером:

- Дополнительный урон, равный двойному Разуму.
- Наносящее урон существо может потратить Восстановление.
- Наносящее урон существо может сместиться до числа клеток, равного Разуму.
- Если вы наносите урон способностью ближнего боя, цель спровоцирована вами до конца её следующего хода.

Нельзя получить несколько преимуществ от одного триггера.`;
const prayerRules = `В начале каждого вашего хода в бою вы получаете 1d3 благочестия. Перед этим единственным броском вы можете помолиться без действия. Молитва добавляет к результату кости:

- **1:** ещё 1 благочестие; вы получаете психический урон 1d6 + ваш уровень, который нельзя уменьшить никаким образом.
- **2:** ещё 1 благочестие.
- **3:** ещё 2 благочестия; можно активировать эффект одного выбранного домена.

На 10-м уровне молитва даёт ещё 1 благочестие. В начале встречи благочестие равно вашим Победам; в конце встречи оставшееся благочестие теряется.`;

export function CensorPanel() {
  const { character: c, act } = useMechanic();
  const s = normalizeCensorState(c.classMechanics?.censor);
  const [target, setTarget] = useState("");
  const [reaction, setReaction] = useState<
    "main-action" | "shift" | "bane" | "potency" | "taunt"
  >("main-action");
  const reactions = [
    [
      "main-action",
      `Основное действие: ${2 * c.characteristics.presence} святого урона`,
    ],
    ["shift", "Смещение: удар и скорость 0"],
    ["bane", "Бросок силы: помеха"],
    ["potency", "Потенциал −1"],
    ["taunt", "Ваш урон: провокация"],
  ] as const;
  const upgrades = activeClassFeatures(c).filter(
    (f) =>
      /осужден|осуждён|способност[ьи] Суд/.test(f.description) &&
      f.name !== "Суд",
  );
  const orderBenefit = /Экзорцист|Exorcist/i.test(c.subclass)
    ? `Телепортация до ${2 * c.characteristics.presence} клеток ближе к цели; линия воздействия к месту назначения не нужна.`
    : /Оракул|Oracle/i.test(c.subclass)
      ? `${2 * c.characteristics.presence} святого урона цели.`
      : `Вертикальное притягивание цели до ${2 * c.characteristics.presence} клеток.`;
  return (
    <Panel
      title="Суд"
      className="class-mechanics-panel"
      actions={
        <MechanicDetails title="Суд">
          <RuleText text={judgmentRules} />
          <h3>Преимущество ордена</h3>
          <p>При первом использовании Суда за ход: {orderBenefit}</p>
          {upgrades.map((f) => (
            <section key={f.id}>
              <h3>{f.name}</h3>
              <RuleText text={f.description} />
            </section>
          ))}
        </MechanicDetails>
      }
    >
      <div className="class-mechanics-stack">
        <div className="class-mechanics-row">
          <span>Осуждён: {s.target || "—"}</span>
          {s.target && (
            <Button onClick={() => act({ kind: "censor-target", target: "" })}>
              Снять
            </Button>
          )}
        </div>
        <div className="class-mechanics-row">
          <TextInput
            aria-label="Цель Суда в пределах 10 клеток"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Новая цель · 10 клеток"
          />
          <Button
            disabled={!target.trim()}
            onClick={() => {
              if (act({ kind: "censor-target", target })) setTarget("");
            }}
          >
            Осудить
          </Button>
        </div>
        <div className="class-mechanics-row">
          <Select
            aria-label="Свободный триггер Суда"
            value={reaction}
            onChange={(e) => setReaction(e.target.value as typeof reaction)}
          >
            {reactions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Button
            disabled={
              !s.target ||
              (reaction !== "main-action" && c.heroicResource.current < 1)
            }
            onClick={() => act({ kind: "censor-reaction", effect: reaction })}
          >
            {reaction === "main-action" ? "Применить" : "За 1 гнев"}
          </Button>
        </div>
        {s.lastEffect && (
          <MechanicDetails
            title="Последний эффект Суда"
            label="Последний эффект"
          >
            <RuleText text={s.lastEffect} />
          </MechanicDetails>
        )}
      </div>
    </Panel>
  );
}
export function TacticianPanel() {
  const { character: c, act } = useMechanic();
  const s = normalizeTacticianState(c.classMechanics?.tactician);
  const [target, setTarget] = useState("");
  const [selected, setSelected] = useState("");
  const [benefit, setBenefit] = useState("damage");
  const [self, setSelf] = useState(false);
  const chosen = s.targets.includes(selected) ? selected : (s.targets[0] ?? "");
  const doctrines = activeClassFeatures(c).filter((f) =>
    f.description.includes("Преимущество метки:"),
  );
  const doctrine = doctrines.find((f) => f.id === benefit);
  const cost = doctrine ? 2 : 1;
  const benefits = [
    ["damage", `+${2 * c.characteristics.reason} урона`],
    ["recovery", "Восстановление"],
    ["shift", `Смещение ${c.characteristics.reason}`],
    ["taunt", "Ваш урон: провокация"],
  ] as const;
  return (
    <Panel
      title="Метка"
      className="class-mechanics-panel"
      actions={
        <MechanicDetails title="Метка">
          <RuleText text={markRules} />
          {doctrines.map((f) => (
            <section key={f.id}>
              <h3>{f.name}</h3>
              <RuleText text={f.description} />
            </section>
          ))}
        </MechanicDetails>
      }
    >
      <div className="class-mechanics-stack">
        <div className="class-mechanics-row">
          <span>
            Цели: {s.targets.length}/{tacticianMarkLimit(c)}
          </span>
          {s.targets.map((t) => (
            <span className="class-mechanics-row" key={t}>
              {t}
              <Button
                onClick={() =>
                  act({
                    kind: "tactician-targets",
                    targets: s.targets.filter((v) => v !== t),
                  })
                }
              >
                Снять
              </Button>
            </span>
          ))}
        </div>
        <div className="class-mechanics-row">
          <TextInput
            aria-label="Цель Метки в пределах 10 клеток"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Новая цель · 10 клеток"
          />
          <Button
            disabled={!target.trim()}
            onClick={() => {
              if (
                act({
                  kind: "tactician-targets",
                  targets:
                    tacticianMarkLimit(c) === 1
                      ? [target]
                      : [...s.targets, target],
                })
              )
                setTarget("");
            }}
          >
            Отметить
          </Button>
        </div>
        <div className="class-mechanics-row">
          {s.targets.length > 1 && (
            <Select
              aria-label="Цель триггера Метки"
              value={chosen}
              onChange={(e) => setSelected(e.target.value)}
            >
              {s.targets.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          )}
          <Select
            aria-label="Преимущество Метки"
            value={benefit}
            onChange={(e) => setBenefit(e.target.value)}
          >
            {benefits.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            {doctrines.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
          <Button
            disabled={!chosen || c.heroicResource.current < cost}
            onClick={() =>
              act({
                kind: "tactician-benefit",
                target: chosen,
                effect: doctrine
                  ? "doctrine"
                  : (benefit as "damage" | "recovery" | "shift" | "taunt"),
                self,
                featureId: doctrine?.id,
              })
            }
          >
            За {cost} {cost === 1 ? "фокус" : "фокуса"}
          </Button>
        </div>
        {benefit === "recovery" && (
          <label>
            <input
              type="checkbox"
              checked={self}
              onChange={(e) => setSelf(e.target.checked)}
            />{" "}
            Восстановление тратит мой герой
          </label>
        )}
        {s.lastEffect && (
          <MechanicDetails
            title="Последнее преимущество Метки"
            label="Последний эффект"
          >
            <RuleText text={s.lastEffect} />
          </MechanicDetails>
        )}
      </div>
    </Panel>
  );
}
export function ConduitPanel() {
  const { character: c, act } = useMechanic();
  const s = normalizeConduitState(c.classMechanics?.conduit);
  const [die, setDie] = useState(1);
  const [damageDie, setDamageDie] = useState(1);
  const done = s.resolvedTurn === (c.runtime?.turn ?? 0);
  const active = c.runtime?.combatActive && c.runtime?.turnActive;
  return (
    <Panel
      title="Молитва"
      className="class-mechanics-panel"
      actions={
        <MechanicDetails title="Молитва и благочестие">
          <RuleText text={prayerRules} />
        </MechanicDetails>
      }
    >
      <div className="class-mechanics-stack">
        <div className="class-mechanics-row">
          {s.prayer === undefined && !done ? (
            <>
              <span>Перед броском 1d3:</span>
              <Button
                disabled={!active}
                onClick={() => act({ kind: "conduit-prayer", pray: true })}
              >
                Молиться
              </Button>
              <Button
                disabled={!active}
                onClick={() => act({ kind: "conduit-prayer", pray: false })}
              >
                Без молитвы
              </Button>
            </>
          ) : (
            <span>
              {done
                ? "Благочестие за ход получено."
                : s.prayer
                  ? "С молитвой"
                  : "Без молитвы"}
            </span>
          )}
          {s.prayer !== undefined && !done && (
            <>
              <Field label="1d3">
                <Select
                  value={die}
                  onChange={(e) => setDie(Number(e.target.value))}
                >
                  {[1, 2, 3].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </Select>
              </Field>
              {s.prayer && die === 1 && (
                <Field label="Урон 1d6">
                  <Select
                    value={damageDie}
                    onChange={(e) => setDamageDie(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </Select>
                </Field>
              )}
              <Button
                disabled={!active}
                onClick={() => act({ kind: "conduit-roll", die, damageDie })}
              >
                Применить
              </Button>
            </>
          )}
        </div>
        {s.prayer && die === 1 && !done && (
          <p className="class-mechanics-warning">
            Неуменьшаемый психический урон: {damageDie + c.level}.
          </p>
        )}
        {conduitDomains(c).length > 0 && (
          <div className="class-mechanics-row">
            {conduitDomains(c).map((d) => (
              <span className="class-mechanics-row" key={d.id}>
                <MechanicDetails
                  title={d.name}
                  label={d.name.replace(/^Благочестие и эффект домена /, "")}
                >
                  <RuleText text={d.description} />
                </MechanicDetails>
                {s.domainAvailable && (
                  <Button
                    onClick={() =>
                      act({ kind: "conduit-domain", domain: d.id })
                    }
                  >
                    Применить
                  </Button>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
