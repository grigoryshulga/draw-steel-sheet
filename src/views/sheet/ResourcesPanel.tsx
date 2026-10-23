import { useId, useRef, useState } from "react";
import { Button, NumberInput, Panel } from "../../components/ui";
import { heroicResourceName } from "../../data/classes";
import {
  HERO_TOKENS_HELP,
  HEROIC_RESOURCE_FALLBACK,
  HEROIC_RESOURCE_HELP,
  SURGES_HELP,
} from "../../data/resource-help";
import { heroicResourceFloor } from "../../lib/game-actions";
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

/** Ресурсы боя, независимые от здоровья и восстановлений. */
export function ResourcesPanel() {
  const { character, performGameAction } = useApp();
  const resourceName = heroicResourceName(character.className);
  const set = (
    resource: "heroicResource" | "surges" | "heroTokens",
    value: number,
  ) => performGameAction({ kind: "resource", resource, value });

  return (
    <Panel title="Ресурсы героя" icon="spark" className="resources-panel">
      <div className="hero-resources-grid">
        <ResourceRow
          label={resourceName}
          min={heroicResourceFloor(character)}
          help={
            HEROIC_RESOURCE_HELP[character.className] ??
            HEROIC_RESOURCE_FALLBACK
          }
          value={character.heroicResource.current}
          onValue={(value) => set("heroicResource", value)}
        />

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
