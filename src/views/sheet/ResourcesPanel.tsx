import { useId, useRef, useState } from "react";
import { Button, NumberInput, Panel } from "../../components/ui";
import { heroicResourceName } from "../../data/classes";
import {
  HERO_TOKENS_HELP,
  SURGES_HELP,
  heroicResourceHelp,
} from "../../data/resource-help";
import { heroicResourceFloor } from "../../lib/game-actions";
import {
  epicResourceGainLabels,
  epicResourceName,
  resourceGainLabels,
} from "../../lib/resources";
import type { ResourceName } from "../../lib/game-actions";
import { clamp, surgeDamageTotal } from "../../lib/rules";
import { useApp } from "../../state/AppContext";
import "./ResourcesPanel.css";

/** Тултип-памятка: по наведению/фокусу, на касании — по нажатию. Fixed, чтобы не обрезался рамкой блока. */
function HelpTip({ label, lines }: { label: string; lines: string[] }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0, above: false });
  const show = () => {
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(300, window.innerWidth - 16);
    const above = rect.bottom + 200 > window.innerHeight && rect.top > 200;
    setPos({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      top: above ? rect.top - 6 : rect.bottom + 6,
      above,
    });
    setOpen(true);
  };
  const hide = () => {
    setOpen(false);
    setPinned(false);
  };
  return (
    <span className="resource-help-wrap">
      <button
        ref={button}
        type="button"
        className="resource-help-toggle"
        aria-label={`${label}: памятка`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={() => !pinned && setOpen(false)}
        onFocus={show}
        onBlur={hide}
        onClick={() => (pinned ? hide() : (show(), setPinned(true)))}
        onKeyDown={(event) => event.key === "Escape" && hide()}
      >
        ?
      </button>
      {open && (
        <ul
          id={id}
          role="tooltip"
          className={`resource-help${pos.above ? " is-above" : ""}`}
          style={{ left: pos.left, top: pos.top }}
        >
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </span>
  );
}

/** Строка ресурса: число правится по месту, ±1 — кнопками, максимум — рядом. */
function ResourceRow({
  label,
  value,
  max,
  min = 0,
  limit = 99,
  onValue,
  onMax,
  extra,
  help,
}: {
  label: string;
  value: number;
  max?: number;
  min?: number;
  limit?: number;
  onValue: (value: number) => void;
  onMax?: (value: number) => void;
  extra?: React.ReactNode;
  /** Памятка, скрытая под «?» */
  help?: string[];
}) {
  const top = max ?? limit;
  const pct = max ? clamp((value / max) * 100, 0, 100) : 0;
  return (
    <div className="resource-row">
      <div className="resource-row-head">
        {help && <HelpTip label={label} lines={help} />}
        <span className="resource-title">{label}</span>
        {extra}
        <span className="resource-row-value vitals-current">
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            icon="minus"
            aria-label={`${label}: уменьшить`}
            disabled={value <= min}
            onClick={() => onValue(value - 1)}
          />
          <input
            className="vital-big vital-current-input is-small numeric"
            inputMode={min < 0 ? "text" : "numeric"}
            aria-label={`${label}: текущее значение`}
            key={value}
            defaultValue={value}
            onFocus={(event) => event.currentTarget.select()}
            onBlur={(event) => {
              const next = Number(event.currentTarget.value);
              if (
                event.currentTarget.value.trim() === "" ||
                !Number.isInteger(next) ||
                next < min ||
                next > top ||
                next === value
              ) {
                event.currentTarget.value = String(value);
                return;
              }
              onValue(next);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                event.currentTarget.value = String(value);
                event.currentTarget.blur();
              }
            }}
          />
          {max !== undefined && (
            <span className="vital-max-edit">
              <span className="vital-max-slash numeric">/</span>
              {onMax ? (
                <NumberInput
                  value={max}
                  min={0}
                  max={99}
                  label={`${label}: максимум`}
                  className="vital-max-input"
                  onChange={onMax}
                />
              ) : (
                <span className="resource-row-max numeric">{max}</span>
              )}
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            icon="plus"
            aria-label={`${label}: увеличить`}
            disabled={value >= top}
            onClick={() => onValue(value + 1)}
          />
        </span>
      </div>
      {max !== undefined && (
        <div className="meter meter-thin" aria-hidden="true">
          <span className="meter-fill" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

/**
 * Компактный блок «Откуда капает»: триггер, количество и частота каждой
 * прибавки. Отметка идёт через журнал игры (`{kind:"trigger"}`), поэтому
 * её можно отменить, а ключ отметки — тег прибавки. Блок показывается
 * всегда, в том числе при выключенном авторасчёте: это чтение данных класса,
 * а не пересчёт листа.
 */
function ResourceGains({
  gains,
  title = "Откуда капает",
}: {
  gains: ReturnType<typeof resourceGainLabels>;
  /** Заголовок блока: у эпического пула он свой, чтобы блоки не путались. */
  title?: string;
}) {
  const { performGameAction } = useApp();
  if (gains.length === 0) return null;
  return (
    <section className="resource-gains" aria-label={title}>
      <h3 className="resource-gains-title">{title}</h3>
      <ul className="resource-gains-list">
        {gains.map((gain) => {
          // «= Победы» уже равенство, плюс к нему не ставится.
          const amountText = gain.amount.startsWith("=")
            ? gain.amount
            : `+${gain.amount}`;
          return (
            <li
              key={gain.tag}
              className={`resource-gain${gain.used ? " is-used" : ""}`}
            >
              <span className="resource-gain-event">{gain.label}</span>
              <span className="resource-gain-meta numeric">
                {amountText}
                {" · "}
                {gain.frequency}
              </span>
              {gain.used && (
                <span className="resource-gain-state">отмечено</span>
              )}
              <Button
                size="sm"
                variant={gain.used ? "ghost" : "soft"}
                aria-pressed={gain.used}
                aria-label={`${gain.used ? "Снять отметку" : "Отметить прибавку"}: ${gain.label}`}
                title={`${gain.label}: ${amountText} (${gain.frequency})`}
                onClick={() =>
                  performGameAction({
                    kind: "trigger",
                    featureId: gain.tag,
                    used: !gain.used,
                  })
                }
              >
                {gain.used ? "Снять" : "получено"}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Ресурсы боя, независимые от здоровья и восстановлений. */
export function ResourcesPanel() {
  const { character, performGameAction } = useApp();
  const resourceName = heroicResourceName(character.className);
  const gains = resourceGainLabels(character);
  // Эпический пул открывается на своём уровне: своё число и свои прибавки.
  const epicName = epicResourceName(character);
  const epicGains = epicResourceGainLabels(character);
  const set = (resource: ResourceName, value: number) =>
    performGameAction({ kind: "resource", resource, value });

  return (
    <Panel title="Ресурсы героя" icon="spark" className="resources-panel">
      <div className="hero-resources-grid">
        <ResourceRow
          label={resourceName}
          min={heroicResourceFloor(character)}
          help={heroicResourceHelp(character)}
          value={character.heroicResource.current}
          onValue={(value) => set("heroicResource", value)}
        />

        <ResourceGains gains={gains} />

        {epicName && (
          <>
            <ResourceRow
              label={epicName}
              value={character.epic}
              onValue={(value) => set("epic", value)}
            />
            <ResourceGains gains={epicGains} title="Откуда капает: эпический пул" />
          </>
        )}

        <ResourceRow
          label="Всплески"
          help={SURGES_HELP}
          value={character.surges}
          onValue={(value) => set("surges", value)}
          extra={
            character.surges > 0 && (
              <span className="chip chip-static chip-accent">
                +{surgeDamageTotal(character, character.surges)} урона
              </span>
            )
          }
        />

        <ResourceRow
          label="Жетоны героя"
          help={HERO_TOKENS_HELP}
          value={character.heroTokens}
          onValue={(value) => set("heroTokens", value)}
        />
      </div>
    </Panel>
  );
}
