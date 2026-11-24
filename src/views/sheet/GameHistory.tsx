import { findAbilityOriginal, mechanicAbilityName, useAbilityCatalog } from "../../components/abilityOriginal";
import { useLocale } from "../../i18n/locale";
import { Button } from "../../components/ui";
import { localizeGameMessage, undoReason, type GameHistoryEntry } from "../../lib/game-actions";
import { useApp } from "../../state/AppContext";
import { ClassFeatureRuntimeStatus, RoundEncounterControls } from "./ClassFeaturesPanel";
import "./GameHistory.css";

const timeLabel = (timestamp: number, locale: string) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);

/**
 * Журнал действий текущей сессии. Живёт в поп-апе плавающей кнопки истории,
 * поэтому список всегда раскрыт: отдельная кнопка «показать» не нужна.
 */
export function GameHistory({ turnControls = false }: { turnControls?: boolean }) {
  const { t, locale } = useLocale();
  const { character, gameHistory, undoGameAction } = useApp();
  const catalog = useAbilityCatalog(locale === "en");
  const label = (value: string) => {
    const ability = character.abilities.find(item => item.name === value);
    return locale === "en" && ability ? findAbilityOriginal(ability, catalog)?.originalName || localizeGameMessage(value, locale) : localizeGameMessage(value, locale);
  };
  const detail = (entry: GameHistoryEntry) => {
    const ability = entry.detailAbility;
    if (locale === "en" && ability && entry.detail.startsWith(ability.name)) {
      const suffix = entry.detail.slice(ability.name.length);
      return mechanicAbilityName(ability, catalog) + localizeGameMessage(suffix, locale);
    }
    return localizeGameMessage(entry.detail, locale);
  };
  const latest = gameHistory.find((entry) => !entry.undone);
  const reason = latest ? undoReason(character, latest, locale) : undefined;

  if (!gameHistory.length) {
    return (
      <p className="game-history-empty">
        {t("Здесь появятся действия с ресурсами, здоровьем и способностями. Последнее действие можно отменить.", "Resource, health, and ability actions appear here. You can undo the last action.")}
      </p>
    );
  }

  return (
    <div className="game-history" aria-label={t("Журнал действий героя", "Hero action history")}>
      <div className="game-history-head">
        <div className="game-history-summary">
          <span className="eyebrow">{t("В этой сессии", "This session")}</span>
          <strong>{(latest ? label(latest.label) : undefined) ?? t("Все действия отменены", "All actions undone")}</strong>
          {latest && <time>{timeLabel(latest.at, locale)}</time>}
        </div>
        {latest && (
          <Button
            size="sm"
            variant="soft"
            icon="undo"
            iconOnly
            aria-label={t("Отменить последнее действие", "Undo last action")}
            disabled={Boolean(reason)}
            title={reason || t("Отменить последнее действие", "Undo last action")}
            onClick={undoGameAction}
          >
            {t("Отменить", "Undo")}
          </Button>
        )}
      </div>
      {reason && <p className="game-history-reason">{reason}</p>}

      {turnControls && (
        <div className="game-history-turn">
          <ClassFeatureRuntimeStatus />
          <RoundEncounterControls />
        </div>
      )}

      <p className="game-history-session">
        {t("Журнал текущего открытия героя. Перезагрузка страницы и смена героя очищают историю.", "History lasts while this hero is open. Reloading or changing heroes clears it.")}
      </p>

      <ol className="game-history-list">
        {gameHistory.map((entry) => (
          <li key={entry.id} className={entry.undone ? "is-undone" : ""}>
            <div>
              <strong>
                {label(entry.label)}
                {entry.undone && (
                  <span className="game-history-undone">{t(" · отменено", " · undone")}</span>
                )}
              </strong>
              <time>{timeLabel(entry.at, locale)}</time>
            </div>
            <p>{detail(entry)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
