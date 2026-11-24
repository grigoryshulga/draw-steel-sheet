import { resourceAmount, resourceFrequency, resourceHelpLine, resourceLabel, resourceName as displayResourceName } from "../../i18n/resource-language";
import { useLocale } from "../../i18n/locale";
import { lazy, Suspense, useState, type ReactNode } from "react";
import { HelpTooltip } from "../../components/HelpTooltip";
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

const DramaSourcesDialog = lazy(() => import("./DramaSourcesDialog").then(module => ({ default: module.DramaSourcesDialog })));

function HelpTip({ label, lines }: { label: string; lines: string[] }) {
  const { t } = useLocale();
  return <HelpTooltip label={t(`${label}: памятка`, `${label}: help`)}><ul className="resource-help-lines">{lines.map((line) => <li key={line}>{line}</li>)}</ul></HelpTooltip>;
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
  extra?: ReactNode;
  /** Памятка, скрытая под «?» */
  help?: string[];
}) {
  const { t } = useLocale();
  const { readOnly } = useApp();
  const top = max ?? limit;
  const pct = max ? clamp((value / max) * 100, 0, 100) : 0;
  return (
    <div className="resource-row">
      <div className="resource-row-head">
        <div className="resource-row-label">
          {help && <HelpTip label={label} lines={help} />}
          <span className="resource-title">{label}</span>
          {extra}
        </div>
        {readOnly ? (
          <span className="resource-row-value vitals-current">
            <span className="vital-big is-small numeric">{value}</span>
            {max !== undefined && <span className="resource-row-max numeric">/ {max}</span>}
          </span>
        ) : (
          <span className="resource-row-value vitals-current">
            <Button
              variant="ghost"
              iconOnly
              icon="minus"
              aria-label={t(`${label}: уменьшить`, `Decrease ${label}`)}
              disabled={value <= min}
              onClick={() => onValue(value - 1)}
            />
            <input
              className="vital-big vital-current-input is-small numeric"
              inputMode={min < 0 ? "text" : "numeric"}
              aria-label={t(`${label}: текущее значение`, `Current ${label}`)}
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
                    label={t(`${label}: максимум`, `${label}: maximum`)}
                    className="vital-max-input"
                    onChange={onMax}
                  />
                ) : (
                  <span className="resource-row-max numeric">{max}</span>
                )}
              </span>
            )}
            <Button
              variant="ghost"
              iconOnly
              icon="plus"
              aria-label={t(`${label}: увеличить`, `Increase ${label}`)}
              disabled={value >= top}
              onClick={() => onValue(value + 1)}
            />
          </span>
        )}
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
 * её можно отменить, а ключ отметки — тег прибавки. Блок доступен
 * и при выключенном авторасчёте: это чтение данных класса,
 * а не пересчёт листа.
 */
function ResourceGains({
  gains,
  title = "Откуда капает",
  actions,
  note,
}: {
  gains: ReturnType<typeof resourceGainLabels>;
  /** Заголовок блока: у эпического пула он свой, чтобы блоки не путались. */
  title?: string;
  actions?: ReactNode;
  note?: string;
}) {
  const { t, locale } = useLocale();
  const { performGameAction, readOnly } = useApp();
  if (gains.length === 0 && !actions && !note) return null;
  return (
    <section className="resource-gains">
      <div className="resource-gains-heading">
        <h3 className="resource-gains-title">{title === "Откуда капает" ? t(title, "Resource gains") : title}</h3>
        {actions}
      </div>
      {gains.length > 0 && <ul className="resource-gains-list">
        {gains.map((gain) => {
          // «= Победы» уже равенство, плюс к нему не ставится.
          const displayLabel = resourceLabel(gain.label, locale);
          const frequency = resourceFrequency(gain.frequency, locale);
          const amount = resourceAmount(gain.amount, locale);
          const amountText = amount.startsWith("=") ? amount : `+${amount}`;
          return (
            <li
              key={gain.tag}
              className={`resource-gain${gain.used ? " is-used" : ""}`}
            >
              <span className="resource-gain-event">{displayLabel}</span>
              <span className="resource-gain-meta numeric">
                {amountText}
                {" · "}
                {frequency}
              </span>
              {!readOnly && <Button
                size="sm"
                variant={gain.used ? "ghost" : "soft"}
                icon="check"
                iconOnly
                aria-pressed={gain.used}
                aria-label={`${gain.used ? t("Снять отметку", "Clear mark") : t("Отметить прибавку", "Mark gain")}: ${displayLabel}`}
                title={`${displayLabel}: ${amountText} (${frequency})`}
                onClick={() =>
                  performGameAction({
                    kind: "trigger",
                    featureId: gain.tag,
                    used: !gain.used,
                  })
                }
              />}
            </li>
          );
        })}
      </ul>}
      {note && <p className="drama-source-note">{note}</p>}
    </section>
  );
}

/** Ресурсы боя, независимые от здоровья и восстановлений. */
export function ResourcesPanel() {
  const { t, locale } = useLocale();
  const { character, performGameAction, readOnly, update } = useApp();
  const [editDrama, setEditDrama] = useState(false);
  const ownDrama = character.className === "Трубадур" && !readOnly;
  const drama = ownDrama ? character.dramaSources : undefined;
  const rawResourceName = heroicResourceName(character.className);
  const resourceName = displayResourceName(rawResourceName, locale);
  const gains = resourceGainLabels(character).filter((gain) =>
    !(gain.tag === "start-of-turn" && ["Проводник", "Элементалист"].includes(character.className)),
  );
  // Эпический пул открывается на своём уровне: своё число и свои прибавки.
  const epicName = epicResourceName(character);
  const epicGains = epicResourceGainLabels(character);
  const set = (resource: ResourceName, value: number) =>
    performGameAction({ kind: "resource", resource, value });

  return (
    <Panel title={t("Ресурсы героя", "Hero Resources")} icon="spark" className="resources-panel">
      <div className="hero-resources-grid">
        <ResourceRow
          label={resourceName}
          min={heroicResourceFloor(character)}
          help={heroicResourceHelp(character).map(line => resourceHelpLine(line, locale))}
          value={character.heroicResource.current}
          onValue={(value) => set("heroicResource", value)}
        />
        <ResourceGains gains={drama ? gains.filter(gain => !drama.hidden.includes(gain.tag)) : gains}
          note={drama?.note}
          actions={ownDrama && <Button size="sm" variant="ghost" icon="settings" iconOnly
            onClick={() => setEditDrama(true)}>{t("Настроить источники Драмы", "Configure Drama sources")}</Button>} />

        {epicName && (
          <>
            <ResourceRow
              label={displayResourceName(epicName, locale)}
              value={character.epic}
              onValue={(value) => set("epic", value)}
            />
            <ResourceGains gains={epicGains} title={t("Откуда капает: эпический пул", "Resource gains: epic pool")} />
          </>
        )}

        <ResourceRow
          label={t("Всплески", "Surges")}
          help={locale === "en" ? ["Spend up to 3 surges on rolled damage; each adds damage equal to your highest characteristic.", "Or spend 2 surges to increase potency against one target by 1 (maximum +1 per target).", "Spent surges are consumed; remaining surges are lost at the end of combat."] : SURGES_HELP}
          value={character.surges}
          onValue={(value) => set("surges", value)}
          extra={
            character.surges > 0 && (
              <span className="chip chip-static chip-accent">
                +{surgeDamageTotal(character, character.surges)} {t("урона", "damage")}
              </span>
            )
          }
        />

        {!readOnly && <ResourceRow
          label={t("Жетоны героя", "Hero tokens")}
          help={locale === "en" ? ["Hero tokens are shared by the group. The session starts with one per hero; the Director can award more for risky heroic actions and successful tests with rewards.", "Spend 1 token to gain 2 surges.", "Spend 1 token to succeed on a failed saving throw.", "Spend 1 token to reroll a test; use the new result.", "Spend 2 tokens on your turn or before taking damage to regain stamina equal to your recovery value.", "Spend at most one token per turn or test. Unused tokens are lost at session end unless the Director decides otherwise."] : HERO_TOKENS_HELP}
          value={character.heroTokens}
          onValue={(value) => set("heroTokens", value)}
        />}
      </div>
      {ownDrama && editDrama && <Suspense fallback={null}>
        <DramaSourcesDialog gains={gains} value={drama} onClose={() => setEditDrama(false)}
          onSave={dramaSources => {
            update(hero => ({ ...hero, dramaSources }));
            setEditDrama(false);
          }} />
      </Suspense>}
    </Panel>
  );
}
