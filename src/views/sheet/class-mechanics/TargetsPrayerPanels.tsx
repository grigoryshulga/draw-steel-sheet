import { useLocale } from "../../../i18n/locale";
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

const judgmentRulesEn = `**Judgment · Maneuver · Magic, Ranged · Ranged 10 · One enemy**

The target remains judged until the end of the encounter, you use Judgment again or voluntarily end it, or another censor judges the target.

When the judged creature uses a main action within line of effect, you can deal holy damage equal to twice your Presence as a free triggered action. When its Stamina falls to 0, you can judge a new target as a free triggered action.

You can spend 1 wrath for one free triggered option: stop an adjacent judged target’s shift with a melee free strike; impose a bane on its power roll within 10; reduce by 1 the potency of its single-target ability within 10; or taunt it until the end of its next turn when you damage it with a melee ability. Only one paid option can be chosen per event.`;
const markRulesEn = `**Mark · Maneuver · Ranged · Ranged 10 · One creature**

The target remains marked until the encounter ends, you are dying, you use Mark again, you voluntarily end it, or another tactician marks it. When its Stamina falls to 0, you can mark another target in range as a free triggered action. The ability initially marks one creature; Warlord’s Scheme at level 5 and other abilities may allow more.

While the target is in your line of effect, you and allies in your line of effect gain an edge on power rolls against it. When you or an ally deals rolled damage to it with an ability, spend 1 focus as a free triggered action for one benefit: extra damage equal to twice Reason; the damaging creature spends a Recovery; that creature shifts up to Reason squares; or, if your melee ability dealt the damage, the target is taunted by you until the end of its next turn. Only one benefit can be gained per trigger.`;
const prayerRulesEn = `At the start of each of your turns in combat, gain 1d3 piety. Before that roll, you can pray without using an action. Prayer adds to the die result:

- **1:** gain 1 more piety and take 1d6 + your level psychic damage that cannot be reduced.
- **2:** gain 1 more piety.
- **3:** gain 2 more piety and you can activate one chosen domain effect.

At level 10 prayer grants 1 additional piety. At the start of an encounter piety equals your Victories; remaining piety is lost at the end.`;

export function CensorPanel() {
  const { t: tr, locale } = useLocale();
  const { character: c, act } = useMechanic();
  const s = normalizeCensorState(c.classMechanics?.censor);
  const [target, setTarget] = useState("");
  const [reaction, setReaction] = useState<
    "main-action" | "shift" | "bane" | "potency" | "taunt"
  >("main-action");
  const reactions = [
    [
      "main-action",
      tr(`Основное действие: ${2 * c.characteristics.presence} святого урона`, `Main action: ${2 * c.characteristics.presence} holy damage`),
    ],
    ["shift", tr("Смещение: удар и скорость 0", "Shift: strike and speed 0")],
    ["bane", tr("Бросок силы: помеха", "Power roll: bane")],
    ["potency", tr("Потенциал −1", "Potency −1")],
    ["taunt", tr("Ваш урон: провокация", "Your damage: taunt")],
  ] as const;
  const upgrades = activeClassFeatures(c).filter(
    (f) =>
      /осужден|осуждён|способност[ьи] Суд/.test(f.description) &&
      f.name !== "Суд",
  );
  const orderBenefit = /Экзорцист|Exorcist/i.test(c.subclass)
    ? tr(`Телепортация до ${2 * c.characteristics.presence} клеток ближе к цели; линия воздействия к месту назначения не нужна.`, `Teleport up to ${2 * c.characteristics.presence} squares closer to the target; no line of effect to the destination is required.`)
    : /Оракул|Oracle/i.test(c.subclass)
      ? tr(`${2 * c.characteristics.presence} святого урона цели.`, `${2 * c.characteristics.presence} holy damage to the target.`)
      : tr(`Вертикальное притягивание цели до ${2 * c.characteristics.presence} клеток.`, `Vertically pull the target up to ${2 * c.characteristics.presence} squares.`);
  return (
    <Panel
      title={tr("Суд", "Judgment")}
      className="class-mechanics-panel"
      actions={
        <MechanicDetails title={tr("Суд", "Judgment")}>
          <RuleText text={locale === "en" ? judgmentRulesEn : judgmentRules} sourceLocale={locale} />
          <h3>{tr("Преимущество ордена", "Order benefit")}</h3>
          <p>{tr("При первом использовании Суда за ход", "First Judgment use each turn")}: {orderBenefit}</p>
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
          <span>{tr("Осуждён", "Judged")}: {s.target || "—"}</span>
          {s.target && (
            <Button onClick={() => act({ kind: "censor-target", target: "" })}>
              {tr("Снять", "Clear")}
            </Button>
          )}
        </div>
        <div className="class-mechanics-row">
          <TextInput
            aria-label={tr("Цель Суда в пределах 10 клеток", "Judgment target within 10 squares")}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={tr("Новая цель · 10 клеток", "New target · 10 squares")}
          />
          <Button
            disabled={!target.trim()}
            onClick={() => {
              if (act({ kind: "censor-target", target })) setTarget("");
            }}
          >
            {tr("Осудить", "Judge")}
          </Button>
        </div>
        <div className="class-mechanics-row">
          <Select
            aria-label={tr("Свободный триггер Суда", "Judgment free triggered action")}
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
            {reaction === "main-action" ? tr("Применить", "Apply") : tr("За 1 гнев", "Spend 1 wrath")}
          </Button>
        </div>
        {s.lastEffect && (
          <MechanicDetails
            title={tr("Последний эффект Суда", "Last Judgment effect")}
            label={tr("Последний эффект", "Last effect")}
          >
            <RuleText text={s.lastEffect} />
          </MechanicDetails>
        )}
      </div>
    </Panel>
  );
}
export function TacticianPanel() {
  const { t: tr, locale } = useLocale();
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
    ["damage", tr(`+${2 * c.characteristics.reason} урона`, `+${2 * c.characteristics.reason} damage`)],
    ["recovery", tr("Восстановление", "Recovery")],
    ["shift", tr(`Смещение ${c.characteristics.reason}`, `Shift ${c.characteristics.reason}`)],
    ["taunt", tr("Ваш урон: провокация", "Your damage: taunt")],
  ] as const;
  return (
    <Panel
      title={tr("Метка", "Mark")}
      className="class-mechanics-panel"
      actions={
        <MechanicDetails title={tr("Метка", "Mark")}>
          <RuleText text={locale === "en" ? markRulesEn : markRules} sourceLocale={locale} />
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
            {tr("Цели", "Targets")}: {s.targets.length}/{tacticianMarkLimit(c)}
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
                {tr("Снять", "Clear")}
              </Button>
            </span>
          ))}
        </div>
        <div className="class-mechanics-row">
          <TextInput
            aria-label={tr("Цель Метки в пределах 10 клеток", "Mark target within 10 squares")}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={tr("Новая цель · 10 клеток", "New target · 10 squares")}
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
            {tr("Отметить", "Mark")}
          </Button>
        </div>
        <div className="class-mechanics-row">
          {s.targets.length > 1 && (
            <Select
              aria-label={tr("Цель триггера Метки", "Mark trigger target")}
              value={chosen}
              onChange={(e) => setSelected(e.target.value)}
            >
              {s.targets.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          )}
          <Select
            aria-label={tr("Преимущество Метки", "Mark benefit")}
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
            {tr(`За ${cost} ${cost === 1 ? "фокус" : "фокуса"}`, `Spend ${cost} focus`)}
          </Button>
        </div>
        {benefit === "recovery" && (
          <label>
            <input
              type="checkbox"
              checked={self}
              onChange={(e) => setSelf(e.target.checked)}
            />{" "}
            {tr("Восстановление тратит мой герой", "My hero spends the recovery")}
          </label>
        )}
        {s.lastEffect && (
          <MechanicDetails
            title={tr("Последнее преимущество Метки", "Last Mark benefit")}
            label={tr("Последний эффект", "Last effect")}
          >
            <RuleText text={s.lastEffect} />
          </MechanicDetails>
        )}
      </div>
    </Panel>
  );
}
export function ConduitPanel() {
  const { t: tr, locale } = useLocale();
  const { character: c, act } = useMechanic();
  const s = normalizeConduitState(c.classMechanics?.conduit);
  const [die, setDie] = useState(1);
  const [damageDie, setDamageDie] = useState(1);
  const done = s.resolvedTurn === (c.runtime?.turn ?? 0);
  const active = c.runtime?.combatActive && c.runtime?.turnActive;
  return (
    <Panel
      title={tr("Молитва", "Prayer")}
      className="class-mechanics-panel"
      actions={
        <MechanicDetails title={tr("Молитва и благочестие", "Prayer and Piety")}>
          <RuleText text={locale === "en" ? prayerRulesEn : prayerRules} sourceLocale={locale} />
        </MechanicDetails>
      }
    >
      <div className="class-mechanics-stack">
        <div className="class-mechanics-row">
          {s.prayer === undefined && !done ? (
            <>
              <span>{tr("Перед броском 1d3:", "Before the 1d3 roll:")}</span>
              <Button
                disabled={!active}
                onClick={() => act({ kind: "conduit-prayer", pray: true })}
              >
                {tr("Молиться", "Pray")}
              </Button>
              <Button
                disabled={!active}
                onClick={() => act({ kind: "conduit-prayer", pray: false })}
              >
                {tr("Без молитвы", "Without prayer")}
              </Button>
            </>
          ) : (
            <span>
              {done
                ? tr("Благочестие за ход получено.", "Piety for this turn gained.")
                : s.prayer
                  ? tr("С молитвой", "With prayer")
                  : tr("Без молитвы", "Without prayer")}
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
                <Field label={tr("Урон 1d6", "Damage 1d6")}>
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
                {tr("Применить", "Apply")}
              </Button>
            </>
          )}
        </div>
        {s.prayer && die === 1 && !done && (
          <p className="class-mechanics-warning">
            {tr(`Неуменьшаемый психический урон: ${damageDie + c.level}.`, `Unpreventable psychic damage: ${damageDie + c.level}.`)}
          </p>
        )}
        {conduitDomains(c).length > 0 && (
          <div className="class-mechanics-row">
            {conduitDomains(c).map((d) => (
              <span className="class-mechanics-row" key={d.id}>
                <MechanicDetails
                  title={locale === "en" ? d.originalName || d.name : d.name}
                  label={locale === "en" ? (d.originalName || d.name).replace(/^Domain Piety and Effects: /, "") : d.name.replace(/^Благочестие и эффект домена /, "")}
                >
                  <RuleText text={locale === "en" ? d.originalDescription || d.description : d.description} sourceLocale={locale === "en" && d.originalDescription ? "en" : "ru"} />
                </MechanicDetails>
                {s.domainAvailable && (
                  <Button
                    onClick={() =>
                      act({ kind: "conduit-domain", domain: d.id })
                    }
                  >
                    {tr("Применить", "Apply")}
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
