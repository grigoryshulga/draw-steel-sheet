import { useState } from "react";
import { CardDetailModal } from "../../components/CardDetailModal";
import { Button } from "../../components/ui";
import type { BoardGrid, BoardCounter, BoardPlacement, TableBoard, TableSnapshot } from "../../lib/tables/types";
import type { SendTableCommand } from "./TableMembers";

export function BoardGridForm({ grid, busy, onPreview, onSave }: {
  grid: BoardGrid;
  busy: boolean;
  onPreview: (grid: BoardGrid) => void;
  onSave: (grid: BoardGrid) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(grid);
  const fields = [
    { key: "size", label: "Размер клетки", min: 8, max: 400 },
    { key: "x", label: "Смещение по горизонтали", min: -1600, max: 1600 },
    { key: "y", label: "Смещение по вертикали", min: -900, max: 900 },
    { key: "thickness", label: "Толщина линий", min: 1, max: 8 },
  ] as const;
  const update = (next: BoardGrid) => {
    setDraft(next);
    if (fields.every(({ key, min, max }) => {
      const value = next[key] ?? 1;
      return Number.isInteger(value) && value >= min && value <= max;
    })) onPreview(next);
  };
  return <form onSubmit={event => { event.preventDefault(); void onSave(draft); }}>
    {fields.map(({ key, label, min, max }) => <label key={key}>
      {label}
      <input className="input" type="number" required min={min} max={max} value={Number.isNaN(draft[key]) ? "" : draft[key] ?? 1}
        onChange={event => update({ ...draft, [key]: event.currentTarget.valueAsNumber })} />
    </label>)}
    <label>Цвет линий
      <input type="color" value={draft.color ?? "#ffffff"} onChange={event => update({ ...draft, color: event.target.value })} />
    </label>
    <label>Прозрачность · {100 - (draft.opacity ?? 60)}%
      <input type="range" min={0} max={100} value={100 - (draft.opacity ?? 60)}
        onChange={event => update({ ...draft, opacity: 100 - event.currentTarget.valueAsNumber })} />
    </label>
    <Button type="submit" variant="primary" disabled={busy}>Применить сетку</Button>
  </form>;
}

export const boardCounterKey = (counter: BoardCounter) => `counter/${counter.sceneId ?? ""}/${counter.id}`;
export const boardCounterRef = (counter: BoardCounter) => ({ id: counter.id, ...(counter.sceneId ? { sceneId: counter.sceneId } : {}) });

export function BoardCounterValue({ counter, editable, busy, command }: {
  counter: BoardCounter;
  editable: boolean;
  busy: boolean;
  command: SendTableCommand;
}) {
  const step = (delta: number) => void command("board-step-counter", { ...boardCounterRef(counter), delta });
  return <div className="board-counter" aria-label={counter.name}>
    <span className="board-counter-name">{counter.name}</span>
    <div className="board-counter-value">
      {editable && <Button size="sm" variant="ghost" icon="minus" iconOnly disabled={busy || counter.value <= 0}
        onClick={() => step(-1)}>{`Уменьшить: ${counter.name}`}</Button>}
      <strong>{counter.value}{counter.max !== undefined && <small> / {counter.max}</small>}</strong>
      {editable && <Button size="sm" variant="ghost" icon="plus" iconOnly disabled={busy || counter.value >= (counter.max ?? 1000000000)}
        onClick={() => step(1)}>{`Увеличить: ${counter.name}`}</Button>}
    </div>
  </div>;
}

export function BoardCounterForm({ board, table, draft, busy, command, onClose, placement }: {
  board: TableBoard;
  table: TableSnapshot;
  draft: boolean;
  busy: boolean;
  command: SendTableCommand;
  onClose: () => void;
  placement: BoardPlacement;
}) {
  const [name, setName] = useState("");
  const [max, setMax] = useState("");
  const [value, setValue] = useState("0");
  const [selected, setSelected] = useState("");
  const sources: BoardCounter[] = draft ? [] : [
    ...(board.availableCounters ?? []),
    ...table.scenes.filter(scene => scene.published && scene.status !== "prepared")
      .flatMap(scene => scene.counters.filter(counter => counter.public)
        .map(counter => ({ ...counter, sceneId: scene.id }))),
  ].filter(counter => !board.counters.some(pinned => boardCounterKey(counter) === boardCounterKey(pinned)));
  const source = sources.find(counter => boardCounterKey(counter) === selected);
  const { x, y, ...settings } = placement;
  return <CardDetailModal open onClose={onClose} title="Добавить счётчик" className="table-dialog">
    <form onSubmit={async event => {
      event.preventDefault();
      const result = await command("board-show", {
        id: crypto.randomUUID(), kind: "counter", title: name.trim(), x, y, settings,
        value: Number(value), ...(max ? { max: Number(max) } : {}),
      });
      if (result) onClose();
    }}>
      <label>Название<input autoFocus className="input" value={name} maxLength={200} required onChange={event => setName(event.target.value)} /></label>
      <label>Значение<input className="input" type="number" min={0} max={max || 1000000000} required value={value} onChange={event => setValue(event.target.value)} /></label>
      <label>Максимум<input className="input" type="number" min={value || 0} max={1000000000} value={max} onChange={event => setMax(event.target.value)} /></label>
      <Button type="submit" variant="primary" disabled={busy || !name.trim() || board.materials.length >= 32}>Создать счётчик</Button>
    </form>
    {sources.length > 0 && <form onSubmit={async event => {
      event.preventDefault();
      if (source && await command("board-pin-counter", { ...boardCounterRef(source), placement })) onClose();
    }}>
      <label>Существующий счётчик
        <select className="select" value={selected} onChange={event => setSelected(event.target.value)}>
          <option value="">Выберите счётчик</option>
          {sources.map(counter => <option key={boardCounterKey(counter)} value={boardCounterKey(counter)}>
            {counter.name}{counter.sceneId ? ` · ${table.scenes.find(scene => scene.id === counter.sceneId)?.name}` : " · Стол"}
          </option>)}
        </select>
      </label>
      <Button type="submit" disabled={!source || busy}>Вывести на экран</Button>
    </form>}
  </CardDetailModal>;
}
