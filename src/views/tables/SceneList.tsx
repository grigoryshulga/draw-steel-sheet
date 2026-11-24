import { useLocale } from "../../i18n/locale";
import { useState, type DragEvent } from "react";
import { Button, Card } from "../../components/ui";
import { Icon } from "../../components/Icons";
import type { TableScene } from "../../lib/tables/types";
import { MAIN_SCENE_DROP, SCENE_DROP, hasSceneDrag, readSceneDrop, type SceneDrop } from "../../lib/tables/board";

export function SceneList({
  scenes,
  currentSceneId,
  director,
  disabled,
  onOpen,
  onEdit,
  onStart,
  onStartMain,
  onDropScene,
  onCopy,
  onKeep,
  onDelete,
}: {
  scenes: TableScene[];
  currentSceneId: string | null;
  director: boolean;
  disabled: boolean;
  onOpen: (scene: TableScene) => void;
  onEdit: (scene: TableScene) => void;
  onStart: (scene: TableScene) => void;
  onStartMain: () => void;
  onDropScene: (target: SceneDrop) => void;
  onCopy: (scene: TableScene) => void;
  onKeep: (scene: TableScene) => void;
  onDelete: (scene: TableScene) => void;
}) {
  const { t: tr } = useLocale();
  const displayKinds = { encounter: tr("Бой", "Encounter"), negotiation: tr("Переговоры", "Negotiation"), montage: tr("Монтаж", "Montage") };
  const displayStatuses = { active: tr("В игре", "Active"), prepared: tr("Подготовка", "Prepared"), finished: tr("Завершено", "Finished") };
  const [filter, setFilter] = useState("all");
  const [dropTarget, setDropTarget] = useState(false);
  const canSwitch = director && !disabled;
  const mainIsCurrent = currentSceneId === null;
  const currentSceneDrop = (current: boolean) => !current || !canSwitch ? {} : {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!hasSceneDrag(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setDropTarget(true);
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropTarget(false);
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      setDropTarget(false);
      const target = readSceneDrop(event.dataTransfer);
      if (!target) return;
      event.preventDefault();
      onDropScene(target);
    },
  };
  const shown = scenes
    .filter((s) => filter === "all" || s.status === filter)
    .sort(
      (a, b) =>
        ({ active: 0, prepared: 1, finished: 2 })[a.status] -
        { active: 0, prepared: 1, finished: 2 }[b.status],
    );
  return (
    <>
      <Card className={`scene-pinned-row${mainIsCurrent && dropTarget ? " is-scene-drop-target" : ""}`}
        aria-current={mainIsCurrent ? "true" : undefined}
        draggable={canSwitch}
        onDragStart={event => {
          event.dataTransfer.setData(MAIN_SCENE_DROP, "main");
          event.dataTransfer.effectAllowed = "copy";
        }}
        onDragEnd={() => setDropTarget(false)}
        {...currentSceneDrop(mainIsCurrent)}>
        <h3><Icon name="pin" size={16} />{director
          ? <button type="button" className="table-title-button" disabled={disabled} onClick={onStartMain}>{tr("Главная сцена", "Main scene")}</button>
          : tr("Главная сцена", "Main scene")}</h3>
        {mainIsCurrent && <span className="table-badge is-active">{tr("На полотне", "On the board")}</span>}
      </Card>
      <div className="table-filter-bar" aria-label={tr("Фильтр сцен", "Filter scenes")}>
        {Object.entries({ all: tr("Все", "All"), ...displayStatuses }).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
            <span>
              {value === "all"
                ? scenes.length
                : scenes.filter((s) => s.status === value).length}
            </span>
          </button>
        ))}
      </div>
      <div className="scene-list">
        {shown.map((s) => {
          const current = s.id === currentSceneId;
          return <Card key={s.id} className={`scene-list-row scene-kind-${s.kind}${current && dropTarget ? " is-scene-drop-target" : ""}`}
            aria-current={current ? "true" : undefined}
            draggable={canSwitch} onDragStart={(event) => {
              event.dataTransfer.setData(SCENE_DROP, s.id);
              event.dataTransfer.effectAllowed = "copy";
            }} onDragEnd={() => setDropTarget(false)} {...currentSceneDrop(current)}>
            <div className="scene-list-identity">
              <div className="scene-list-meta">
                <span>{displayKinds[s.kind]}</span>
                <span>{tr("Участников", "Participants")}: {s.combatants.length}</span>
              </div>
              <div className="scene-list-title-row"><h3>
                <button
                  className="table-title-button"
                  onClick={() => onOpen(s)}
                >
                  {s.name}
                </button>
              </h3>
              </div>
              {s.objective && <p className="muted scene-list-description">{s.objective}</p>}
            </div>
                <span className={`table-badge scene-list-status is-${current ? "active" : s.status}`}>
                  {current ? tr("На полотне", "On the board") : displayStatuses[s.status]}
                </span>

            <div className="table-actions">
              {director && (
                <Button
                  size="sm"
                  disabled={disabled}
                  icon="play"
                  iconOnly
                  onClick={() => onStart(s)}
                >
                  {tr(`Запустить сцену «${s.name}»`, `Start scene “${s.name}”`)}
                </Button>
              )}
              {director && (
                <>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={disabled}
                      onClick={() => onEdit(s)}
                      icon="edit"
                      iconOnly
                    >
                      {tr(`Изменить сцену «${s.name}»`, `Edit scene “${s.name}”`)}
                    </Button>
                    <Button size="sm" variant="ghost" icon="copy" iconOnly disabled={disabled} onClick={() => onCopy(s)}>{tr(`Копировать сцену «${s.name}»`, `Copy scene “${s.name}”`)}</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onKeep(s)}
                      icon="bookmark"
                      iconOnly
                    >
                      {tr(`Сохранить в библиотеку сцену «${s.name}»`, `Save scene to library “${s.name}”`)}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={disabled}
                      onClick={() => onDelete(s)}
                      icon="trash"
                      iconOnly
                    >
                      {tr(`Удалить сцену «${s.name}»`, `Delete scene “${s.name}”`)}
                    </Button>
                </>
              )}
            </div>
          </Card>;
        })}
      </div>
      {shown.length === 0 && (
        <div className="table-empty">
          <strong>
            {scenes.length
              ? tr("В этом разделе пока нет сцен", "No scenes in this section yet")
              : director
                ? tr("Всё начинается со сцены", "Everything starts with a scene")
                : tr("Пока нет открытых сцен", "No scenes have been shared yet")}
          </strong>
          <p>
            {director
              ? tr("Создайте бой, переговоры или монтаж.", "Create an encounter, negotiation, or montage.")
              : tr("Сцена появится здесь, когда ведущий её опубликует.", "The scene will appear here when the Director publishes it.")}
          </p>
        </div>
      )}
    </>
  );
}
