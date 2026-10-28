import { Button } from "../../components/ui";
import { undoReason } from "../../lib/game-actions";
import { useApp } from "../../state/AppContext";
import { ClassFeatureRuntimeStatus, RoundEncounterControls } from "./ClassFeaturesPanel";
import "./GameHistory.css";

const timeLabel = (timestamp: number) =>
  new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);

/**
 * Журнал действий текущей сессии. Живёт в поп-апе плавающей кнопки истории,
 * поэтому список всегда раскрыт: отдельная кнопка «показать» не нужна.
 */
export function GameHistory({ turnControls = false }: { turnControls?: boolean }) {
  const { character, gameHistory, undoGameAction } = useApp();
  const latest = gameHistory.find((entry) => !entry.undone);
  const reason = latest ? undoReason(character, latest) : undefined;

  if (!gameHistory.length) {
    return (
      <p className="game-history-empty">
        Здесь появятся действия с ресурсами, здоровьем и способностями.
        Последнее действие можно отменить.
      </p>
    );
  }

  return (
    <div className="game-history" aria-label="Журнал действий героя">
      <div className="game-history-head">
        <div className="game-history-summary">
          <span className="eyebrow">В этой сессии</span>
          <strong>{latest?.label ?? "Все действия отменены"}</strong>
          {latest && <time>{timeLabel(latest.at)}</time>}
        </div>
        {latest && (
          <Button
            size="sm"
            variant="soft"
            disabled={Boolean(reason)}
            title={reason}
            onClick={undoGameAction}
          >
            Отменить
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
        Журнал текущего открытия героя. Перезагрузка страницы и смена героя
        очищают историю.
      </p>

      <ol className="game-history-list">
        {gameHistory.map((entry) => (
          <li key={entry.id} className={entry.undone ? "is-undone" : ""}>
            <div>
              <strong>
                {entry.label}
                {entry.undone && (
                  <span className="game-history-undone"> · отменено</span>
                )}
              </strong>
              <time>{timeLabel(entry.at)}</time>
            </div>
            <p>{entry.detail}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
