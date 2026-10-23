import { useState } from "react";
import { Button } from "../../components/ui";
import { undoReason } from "../../lib/game-actions";
import { useApp } from "../../state/AppContext";
import "./GameHistory.css";

const timeLabel = (timestamp: number) =>
  new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);

export function GameHistory() {
  const { character, gameHistory, undoGameAction } = useApp();
  const [expanded, setExpanded] = useState(false);
  const latest = gameHistory.find((entry) => !entry.undone);
  const reason = latest ? undoReason(character, latest) : undefined;
  if (!gameHistory.length) return null;

  return (
    <section className="game-history" aria-label="Журнал действий героя">
      <div className="game-history-head">
        <div className="game-history-summary">
          <span className="eyebrow">В этой сессии</span>
          <strong>{latest?.label ?? "Все действия отменены"}</strong>
        </div>
        <div className="game-history-actions">
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
          <button
            type="button"
            className="game-history-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Скрыть историю" : "История · " + gameHistory.length}
          </button>
        </div>
      </div>
      {reason && <p className="game-history-reason">{reason}</p>}
      {expanded && (
        <>
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
        </>
      )}
    </section>
  );
}
