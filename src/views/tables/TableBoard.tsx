import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, DragEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../components/ui";
import { CardDetailModal } from "../../components/CardDetailModal";
import { Icon } from "../../components/Icons";
import { MarkdownPreview } from "../../components/MarkdownPreview";
import { AVATAR_ACCEPT, AVATAR_MIME_TYPES, prepareWebp } from "../../lib/avatar";
import { BOARD_BRUSH_MAX, BOARD_HEIGHT, BOARD_IMAGE_MAX, BOARD_STROKE_MAX, BOARD_VIEW, BOARD_WIDTH, EMPTY_BOARD, alignBoardItem, boardCenterY, boardScale, hasSceneDrag, zoomBoard, type BoardResizeEdge } from "../../lib/tables/board";
import { tableRepository } from "../../lib/tables/repository";
import type { BoardGrid, BoardMaterial, BoardPlacement, BoardPoint, BoardStroke, TableSnapshot } from "../../lib/tables/types";
import { useBoardView } from "../../state/useBoardView";
import { BoardCounterForm, BoardCounterValue, BoardGridForm, boardCounterKey, boardCounterRef } from "./BoardControls";
import { BoardDrawingLayer, useBoardDrawing } from "./BoardDrawing";
import { BoardImage } from "./BoardImage";
import { BoardMemberCards } from "./BoardMemberCards";
import type { SendTableCommand } from "./TableMembers";
import { useBoardGestures } from "./useBoardGestures";
import "./TableBoard.css";

const MATERIAL_DROP = "application/x-dostat-listy-material";
type Dialog = "text" | "counter" | "grid";
type PendingImage = { file: File; id: string; point?: BoardPoint };
const itemSettings = {
  text: { width: 280, height: 144, snap: true },
  image: { width: 320, height: 240, snap: true },
  counter: { width: 240, height: 120, snap: true },
};
const edges: BoardResizeEdge[] = ["n", "e", "s", "w", "nw", "ne", "sw", "se"];
const noStrokes: BoardStroke[] = [];
const gridSizes = [20, 40, 60, 80, 100, 120, 160];

export function TableBoard({ table, command, busy, needsRetry, openHero, sceneHud, draft = false, gridHost, gridObscured = false }: {
  table: TableSnapshot;
  command: SendTableCommand;
  busy: boolean;
  needsRetry: boolean;
  openHero?: (id: string) => void;
  sceneHud?: ReactNode;
  draft?: boolean;
  gridHost?: HTMLElement | null;
  gridObscured?: boolean;
}) {
  const board = table.board ?? EMPTY_BOARD;
  const director = table.actorId === table.ownerId;
  const editable = director && !table.archived;
  const camera = useBoardView(table.id, editable && !draft, !draft);
  const toolsId = useId();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [gridPreview, setGridPreview] = useState<BoardGrid | null>(null);
  const [selected, setSelected] = useState("");
  const [active, setActive] = useState("");
  const [newText, setNewText] = useState("");
  const [upload, setUpload] = useState<PendingImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dropTarget, setDropTarget] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [containedBackground, setContainedBackground] = useState<string>();
  const [[width, height], setSize] = useState([0, 0]);
  const imageInput = useRef<HTMLInputElement>(null);
  const backgroundInput = useRef<HTMLInputElement>(null);
  const cameraDock = useRef<HTMLDivElement>(null);
  const working = useRef(false);
  const mounted = useRef(false);
  const wheelEnd = useRef<number | undefined>(undefined);
  const wheelHandler = useRef<(event: WheelEvent) => void>(() => {});
  const blocked = busy || uploading || needsRetry;
  const currentMaterial = board.materials.find(material => material.id === selected);
  const gridAvailable = toolsOpen || !gridObscured;
  const grid = dialog === "grid" && gridAvailable ? gridPreview ?? board.grid : board.grid;
  const fitHeight = !!board.background && containedBackground !== board.background;
  const scale = boardScale(width, height, fitHeight);
  const canSwitchFit = !!board.background && width * BOARD_HEIGHT < height * BOARD_WIDTH;

  useEffect(() => {
    if (!gridAvailable) setDialog(current => current === "grid" ? null : current);
  }, [gridAvailable]);

  const startPlacement = (kind: BoardMaterial["kind"], point: BoardPoint = camera.position.current) =>
    alignBoardItem({ ...itemSettings[kind], x: point.x, y: point.y }, board.grid);
  const items = new Map<string, { placement: BoardPlacement; title: string; reference: { id: string; sceneId?: string }; counter: boolean }>();
  for (const material of board.materials) items.set(`material/${material.id}`, {
    placement: { x: material.x, y: material.y, ...(material.settings ?? { ...itemSettings[material.kind], snap: false }) },
    title: material.title, reference: { id: material.id }, counter: false,
  });
  board.counters.forEach((counter, index) => items.set(boardCounterKey(counter), {
    placement: counter.placement ?? { ...itemSettings.counter, snap: false, x: 200 + (index % 5) * 300, y: Math.max(100, 790 - Math.floor(index / 5) * 145) },
    title: counter.name, reference: boardCounterRef(counter), counter: true,
  }));
  const place = async ({ key, placement }: { key: string; placement: BoardPlacement }) => {
    const item = items.get(key);
    if (!editable || blocked || !item) return;
    const { x, y, ...settings } = placement;
    await (item.counter
      ? command("board-place-counter", { ...item.reference, placement })
      : command("board-move", { ...item.reference, x, y, settings }));
  };
  const remove = (key: string) => {
    const item = items.get(key);
    if (!editable || blocked || !item) return;
    void command(item.counter ? "board-unpin-counter" : "board-remove", item.reference);
    setActive("");
    stage.current?.focus({ preventScroll: true });
  };

  const gestures = useBoardGestures(camera, board.grid, fitHeight,
    key => {
      const placement = items.get(key)?.placement;
      return editable && !blocked && !placement?.locked ? placement : undefined;
    }, place);
  const stage = gestures.stage;
  const strokes = board.strokes ?? noStrokes;
  const drawing = useBoardDrawing({ strokes, sceneId: board.sceneId ?? null, editable, blocked, command, pointAt: gestures.at });

  useEffect(() => {
    mounted.current = true;
    const node = stage.current;
    const dock = cameraDock.current;
    const measure = () => {
      if (node) setSize(previous => previous[0] === node.clientWidth && previous[1] === node.clientHeight
        ? previous : [node.clientWidth, node.clientHeight]);
      if (dock) dock.parentElement?.style.setProperty("--board-camera-width", `${dock.offsetWidth}px`);
    };
    const observer = new ResizeObserver(measure);
    if (node) observer.observe(node);
    if (dock) observer.observe(dock);
    measure();
    const onWheel = (event: WheelEvent) => wheelHandler.current(event);
    node?.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      mounted.current = false;
      observer.disconnect();
      node?.removeEventListener("wheel", onWheel);
      window.clearTimeout(wheelEnd.current);
    };
  }, [stage]);

  wheelHandler.current = (event) => {
    event.preventDefault();
    if (camera.following || drawing.inProgress() || (!event.deltaX && !event.deltaY)) return;
    const current = camera.position.current;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? width : 1;
    const zooming = event.ctrlKey || event.metaKey || (!event.shiftKey && event.deltaY !== 0);
    if (zooming) {
      const factor = Math.exp(-event.deltaY * unit / 360);
      camera.move(zoomBoard(current, current.zoom * factor, gestures.at(event.clientX, event.clientY)));
    } else {
      if (current.zoom <= 1) return;
      const logical = unit / Math.max(0.001, scale) / current.zoom;
      camera.move({
        ...current,
        x: current.x + logical * (event.deltaX + (event.shiftKey ? event.deltaY : 0)),
        y: current.y + logical * (event.shiftKey ? 0 : event.deltaY),
      });
    }
    window.clearTimeout(wheelEnd.current);
    wheelEnd.current = window.setTimeout(() => camera.move(camera.position.current, true), 140);
  };

  const showText = async (text: string, point: BoardPoint, title?: string) => {
    if (!text.trim() || blocked) return false;
    if (board.materials.length >= 32) { setError("На полотне уже 32 материала."); return false; }
    if (text.length > 50000) { setError("Текст должен содержать до 50 000 символов."); return false; }
    setError("");
    const { x, y, ...settings } = startPlacement("text", point);
    return !!(await command("board-show", {
      x, y, settings, id: crypto.randomUUID(), kind: "text",
      title: title ?? (text.trim().split("\n", 1)[0].slice(0, 100) || "Текст"),
      text, ...(title ? { markdown: true } : {}),
    }));
  };

  const showImage = async (request: PendingImage) => {
    if (blocked || working.current) return;
    if (request.point && board.materials.length >= 32) { setError("На полотне уже 32 материала."); return; }
    working.current = true;
    setError("");
    setUploading(true);
    setUpload(null);
    try {
      const { file, id, point } = request;
      if (!(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) throw new Error("Подойдёт PNG, JPEG или WebP.");
      if (file.size > BOARD_IMAGE_MAX || file.size === 0) throw new Error("Выберите непустое изображение размером до 8 МиБ.");
      const image = await prepareWebp(file, 3840, 3840, BOARD_IMAGE_MAX);
      if (image.size > BOARD_IMAGE_MAX) throw new Error("Изображение превышает 8 МиБ после обработки.");
      await tableRepository.uploadBoardImage(table.id, id, image);
      if (!mounted.current) return;
      const { x, y, ...settings } = startPlacement("image", point);
      const saved = await command(point ? "board-show" : "board-background", point
        ? { x, y, settings, id, kind: "image", title: file.name.slice(0, 200).trim() || "Изображение", assetId: id }
        : { assetId: id });
      if (!saved && mounted.current) setUpload(request);
      else if (mounted.current) setDialog(null);
    } catch (problem) {
      if (mounted.current) {
        setError(problem instanceof Error ? problem.message : "Не удалось показать изображение");
        setUpload(request);
      }
    } finally {
      working.current = false;
      if (mounted.current) setUploading(false);
    }
  };

  const drop = (event: DragEvent<HTMLDivElement>) => {
    if (hasSceneDrag(event.dataTransfer)) return;
    event.preventDefault();
    setDropTarget(false);
    if (!editable || blocked) return;
    const point = gestures.at(event.clientX, event.clientY);
    if (point.x < 0 || point.x > BOARD_WIDTH || point.y < 0 || point.y > BOARD_HEIGHT) return;
    const material = table.materials.find(item => item.id === event.dataTransfer.getData(MATERIAL_DROP));
    const file = event.dataTransfer.files[0];
    if (file) void showImage({ file, id: crypto.randomUUID(), point });
    else if (material) void showText(material.text, point, material.title).then(saved => { if (saved) setDialog(null); });
    else void showText(event.dataTransfer.getData("text/plain"), point);
  };

  const { x, y, zoom } = camera.view;
  const translationX = width / 2 - x * scale * zoom;
  const translationY = boardCenterY(height, scale) - y * scale * zoom;
  const sceneArtTop = board.background ? Math.max(0, translationY) : 0;
  const gridLeft = -translationX / zoom;
  const gridTop = -translationY / zoom;
  const currentZoom = () => camera.position.current.zoom;
  const moveZoom = (factor: number) => camera.move(zoomBoard(camera.position.current, currentZoom() * factor), true);
  const cameraDisabled = camera.following || camera.changing;
  const fitWholeBoard = () => {
    if (canSwitchFit && board.background) setContainedBackground(board.background);
    camera.move(BOARD_VIEW, true);
  };
  const restoreHeightFit = canSwitchFit && !fitHeight && zoom === 1;
  const showRetry = upload && !board.materials.some(material => material.id === upload.id) && board.background !== upload.id;

  const renderItem = (key: string, kind: BoardMaterial["kind"], children: ReactNode) => {
    const item = items.get(key)!;
    const placement = gestures.dragged?.key === key ? gestures.dragged.placement : item.placement;
    const chosen = active === key;
    const select = () => { if (editable) setActive(key); };
    const { locked, snap } = placement;
    return <div key={key} className={`board-material board-material-${kind}${chosen ? " is-selected" : ""}${locked ? " is-locked" : ""}`}
      data-board-move={editable ? key : undefined} tabIndex={editable ? 0 : undefined} aria-label={item.title}
      onFocusCapture={select} onPointerDown={event => {
        select();
        if (editable && !(event.target as Element).closest("button")) event.currentTarget.focus({ preventScroll: true });
      }}
      style={{ left: `${placement.x / BOARD_WIDTH * 100}%`, top: `${placement.y / BOARD_HEIGHT * 100}%`,
        width: `${placement.width / BOARD_WIDTH * 100}%`, height: `${placement.height / BOARD_HEIGHT * 100}%` }}>
      <div className="board-material-content">{children}</div>
      {editable && <div className="board-material-tools">
        {kind !== "counter" && <Button size="sm" icon="eye" iconOnly variant="ghost"
          onClick={() => setSelected(item.reference.id)}>{kind === "image" ? "Открыть изображение" : "Открыть текст"}</Button>}
        <button type="button" className="board-drag-handle" data-board-move={key} disabled={blocked || locked}
          aria-label={`Переместить: ${item.title}`} title="Перетащите или используйте стрелки"><Icon name="move" size={16} /></button>
        <Button size="sm" iconOnly icon="table" variant={snap ? "soft" : "ghost"} aria-pressed={snap} disabled={blocked || locked}
          onClick={() => void place({ key, placement: alignBoardItem({ ...placement, snap: !snap }, board.grid) })}>Привязать к сетке</Button>
        <Button size="sm" iconOnly icon="lock" variant={locked ? "soft" : "ghost"} aria-pressed={!!locked} disabled={blocked}
          onClick={() => void place({ key, placement: { ...placement, locked: !locked } })}>Закрепить на месте</Button>
        <Button size="sm" iconOnly icon="close" variant="ghost" disabled={blocked} onClick={() => remove(key)}>Убрать с полотна</Button>
      </div>}
      {editable && !locked && edges.map(edge => <button key={edge} type="button" disabled={blocked}
        className={`board-resize-handle is-${edge}`} data-board-move={key} data-board-resize={edge}
        tabIndex={edge === "se" ? 0 : -1} aria-label={`Изменить размер: ${item.title}`} />)}
    </div>;
  };

  const toggleTools = () => {
    if (toolsOpen) {
      if (drawing.painting) drawing.toggle();
      setDialog(null);
    } else if (dialog === "grid") {
      setDialog(null);
    }
    setToolsOpen(!toolsOpen);
  };

  const gridButtons = <>
    <Button size="sm" icon="table" iconOnly variant={board.grid.enabled ? "soft" : "ghost"}
      aria-pressed={board.grid.enabled} disabled={blocked} onClick={() => {
        if (dialog === "grid") setDialog(null);
        void command("board-grid", { ...board.grid, enabled: !board.grid.enabled });
      }}>Сетка</Button>
    {toolsOpen && board.grid.enabled && <select className="board-grid-size" aria-label="Размер клетки" title="Размер клетки"
      value={board.grid.size} disabled={blocked || dialog === "grid"}
      onChange={event => void command("board-grid", { ...board.grid, size: Number(event.currentTarget.value) })}>
      {[...new Set([...gridSizes, board.grid.size])].sort((a, b) => a - b).map(size =>
        <option key={size} value={size}>{size} px</option>)}
    </select>}
    <Button size="sm" icon="settings" iconOnly variant="ghost" className="board-grid-settings" aria-expanded={dialog === "grid"}
      disabled={blocked} onClick={() => {
        setGridPreview({ ...board.grid, enabled: true });
        setDialog(dialog === "grid" ? null : "grid");
      }}>Настройки сетки</Button>
  </>;

  const gridPanel = dialog === "grid" && <aside className="board-grid-panel" aria-label="Настройки сетки">
    <div className="board-add-panel-header">
      <h3>Сетка</h3>
      <Button size="sm" icon="close" iconOnly variant="ghost" onClick={() => setDialog(null)}>Закрыть настройки сетки</Button>
    </div>
    <BoardGridForm grid={{ ...board.grid, enabled: true }} busy={blocked} onPreview={setGridPreview} onSave={async next => {
      const result = await command("board-grid", { ...next });
      if (result) setDialog(null);
      return !!result;
    }} />
  </aside>;

  const gridControls = <div className="board-grid-dock" role="group" aria-label="Сетка полотна"
    onKeyDown={event => {
      if (event.key === "Escape" && dialog === "grid") {
        setDialog(null);
        event.currentTarget.querySelector<HTMLButtonElement>(".board-grid-settings")?.focus();
      }
    }}>
    {gridButtons}
    {gridPanel}
  </div>;

  const textPanel = dialog === "text" && <aside className="board-add-panel" aria-label="Добавить текст">
    <div className="board-add-panel-header">
      <h3>Добавить текст</h3>
      <Button size="sm" icon="close" iconOnly variant="ghost" onClick={() => setDialog(null)}>Закрыть добавление</Button>
    </div>
    <form onSubmit={async event => {
      event.preventDefault();
      if (await showText(newText, camera.position.current)) { setNewText(""); setDialog(null); }
    }}>
      <label>Текст<textarea className="input" autoFocus required maxLength={50000} value={newText} onChange={event => setNewText(event.target.value)} /></label>
      <Button type="submit" variant="primary" disabled={blocked || !newText.trim()}>Добавить текст</Button>
    </form>
    {table.materials.length > 0 && <div className="board-material-library">
      <h3>Материалы стола</h3>
      {table.materials.map(material => <Button key={material.id} size="sm" variant="ghost" disabled={blocked} draggable={!blocked}
        onDragStart={event => {
          event.dataTransfer.setData(MATERIAL_DROP, material.id);
          event.dataTransfer.effectAllowed = "copy";
        }}
        onClick={async () => {
          if (await showText(material.text, camera.position.current, material.title)) setDialog(null);
        }}>{material.title}</Button>)}
    </div>}
  </aside>;

  return <section className={`table-board${draft ? " is-draft-board" : ""}`} aria-label={draft ? "Оформление сцены" : "За столом"}>
    {editable && <div className={`board-toolbar${toolsOpen ? " is-expanded" : ""}`} onKeyDown={event => {
      if (event.key !== "Escape" || !toolsOpen) return;
      const trigger = dialog === "grid" ? ".board-grid-settings" : dialog === "text" ? ".board-add-text" : ".board-toolbar-toggle";
      if (dialog === "grid" || dialog === "text") setDialog(null);
      else toggleTools();
      event.currentTarget.querySelector<HTMLButtonElement>(trigger)?.focus();
    }}>
      <Button size="sm" icon={toolsOpen ? "close" : "edit"} iconOnly className="board-toolbar-toggle"
        aria-expanded={toolsOpen} aria-controls={toolsId} onClick={toggleTools}>
        {toolsOpen ? "Свернуть инструменты сцены" : "Открыть инструменты сцены"}
      </Button>
      <div id={toolsId} className="board-toolbar-strip" role="group" aria-label="Инструменты сцены" hidden={!toolsOpen}>
        {toolsOpen && <>
          <div className="board-tool-group" role="group" aria-label="Элементы полотна">
            <Button size="sm" icon="plus" iconOnly variant="ghost" disabled={blocked} onClick={() => setDialog("counter")}>Добавить счётчик</Button>
            <Button size="sm" icon="sheet" iconOnly variant="ghost" className="board-add-text" disabled={blocked}
              aria-expanded={dialog === "text"} onClick={() => setDialog(dialog === "text" ? null : "text")}>Добавить текст</Button>
            <Button size="sm" icon="image" iconOnly variant="ghost" disabled={blocked}
              onClick={() => imageInput.current?.click()}>Добавить картинку</Button>
            <div className="board-background-actions">
              <Button size="sm" icon="palette" iconOnly variant="ghost" disabled={blocked}
                onClick={() => backgroundInput.current?.click()}>Задать фон</Button>
              {board.background && <Button size="sm" icon="undo" iconOnly variant="ghost" className="board-background-reset"
                disabled={blocked} onClick={() => void command("board-background", { assetId: null })}>Сбросить фон</Button>}
            </div>
          </div>
          <div className="board-tool-group board-brush-controls" role="group" aria-label="Рисование">
            <Button size="sm" icon="brush" iconOnly variant={drawing.painting ? "soft" : "ghost"} aria-pressed={drawing.painting}
              onClick={() => { setActive(""); drawing.toggle(); }}>Рисовать на полотне</Button>
            {drawing.painting && <>
              <input type="color" aria-label="Цвет кисти" title="Цвет кисти"
                value={drawing.color} onChange={event => drawing.setColor(event.currentTarget.value)} />
              <input type="range" aria-label="Толщина кисти" title="Толщина кисти" min={1} max={BOARD_BRUSH_MAX} value={drawing.thickness}
                onChange={event => drawing.setThickness(event.currentTarget.valueAsNumber)} />
              <output aria-label="Толщина кисти в пикселях">{drawing.thickness}</output>
              <Button size="sm" icon="undo" iconOnly variant="ghost" disabled={blocked || !!drawing.pending || !strokes.length}
                onClick={drawing.undo}>Отменить последний штрих</Button>
            </>}
          </div>
          <div className="board-tool-group" role="group" aria-label="Сетка полотна">{gridButtons}</div>
        </>}
      </div>
      {toolsOpen && gridPanel}
      {toolsOpen && textPanel}
    </div>}
    <div ref={cameraDock} className={`board-view-dock${cameraOpen ? " is-open" : ""}`} onKeyDown={event => {
      if (event.key === "Escape" && cameraOpen) {
        setCameraOpen(false);
        event.currentTarget.querySelector<HTMLButtonElement>(".board-view-toggle")?.focus();
      }
    }}>
      <Button size="sm" icon="expand" iconOnly className="board-view-toggle" aria-expanded={cameraOpen}
        onClick={() => setCameraOpen(open => !open)}>Камера сцены</Button>
      <div className="board-toolbar-group board-view-controls" role="group" aria-label="Камера сцены">
        {camera.following && <span className="board-view-status" role="status">Обзор ведущего</span>}
        <Button size="sm" icon="minus" iconOnly disabled={cameraDisabled || zoom <= 1} onClick={() => moveZoom(0.8)}>Уменьшить масштаб</Button>
        <Button size="sm" icon="plus" iconOnly disabled={cameraDisabled || zoom >= 4} onClick={() => moveZoom(1.25)}>Увеличить масштаб</Button>
        <Button size="sm" icon="expand" iconOnly disabled={cameraDisabled || (zoom === 1 && !canSwitchFit)}
          onClick={restoreHeightFit ? () => setContainedBackground(undefined) : fitWholeBoard}>
          {restoreHeightFit ? "Вписать фон по высоте" : "Уместить полотно"}
        </Button>
        {editable && !draft && <Button size="sm" icon={camera.shared.control ? "pause" : "play"} aria-pressed={!!camera.shared.control}
          disabled={!camera.ready || camera.changing} onClick={() => void camera.lead(!camera.shared.control)}>
          {camera.shared.control ? "Вернуть управление" : "Вести обзор"}
        </Button>}
      </div>
    </div>
    {(uploading || error || camera.error || showRetry || drawing.pending || (drawing.painting && drawing.full)) && (
      <div className="board-status">
        {uploading && <span role="status">Загрузка изображения…</span>}
        {error && <span role="alert">{error}</span>}
        {camera.error && <span role="alert">{camera.error}</span>}
        {showRetry && editable && <Button size="sm" disabled={blocked} onClick={() => void showImage(upload)}>Повторить загрузку</Button>}
        {drawing.painting && drawing.full && <span role="status">На сцене {BOARD_STROKE_MAX} штрихов. Можно отменить последний.</span>}
        {drawing.pending && editable && <>
          <Button size="sm" disabled={busy || uploading} onClick={drawing.retry}>Повторить сохранение рисунка</Button>
          {!needsRetry && <Button size="sm" variant="ghost" onClick={drawing.discard}>Сбросить несохранённое изменение</Button>}
        </>}
      </div>
    )}
    <div className="board-frame">
      <div
        ref={stage}
        className={`board-stage${dropTarget ? " is-drop-target" : ""}${gestures.panning ? " is-panning" : ""}${drawing.painting ? " is-drawing" : ""}`}
        tabIndex={0}
        aria-label="Полотно стола"
        onKeyDown={event => {
          if (event.key === "Delete" && active && editable && !blocked &&
              !(event.target as Element).closest("input, textarea, select, [contenteditable]")) {
            event.preventDefault();
            remove(active);
            return;
          }
          if (event.key === "Escape") {
            setActive("");
            if (drawing.painting) drawing.toggle();
          }
          if (event.key === "0" && event.target === event.currentTarget && !cameraDisabled) {
            event.preventDefault();
            fitWholeBoard();
            return;
          }
          gestures.keyDown(event);
        }}
        onPointerDown={event => {
          if (drawing.pointerDown(event)) { setActive(""); return; }
          if (!(event.target as Element).closest(".board-material")) setActive("");
          gestures.pointerDown(event);
        }}
        onPointerMove={event => { if (!drawing.pointerMove(event)) gestures.pointerMove(event); }}
        onPointerUp={event => { if (!drawing.pointerEnd(event, false)) gestures.pointerUp(event); }}
        onPointerCancel={event => { if (!drawing.pointerEnd(event, true)) gestures.pointerCancel(event); }}
        onLostPointerCapture={event => { drawing.pointerEnd(event, true); }}
        onPaste={event => {
          if (!editable || blocked || event.currentTarget !== event.target) return;
          const text = event.clipboardData.getData("text/plain");
          if (text) { event.preventDefault(); void showText(text, camera.position.current); }
        }}
        onDragOver={event => {
          if (hasSceneDrag(event.dataTransfer) || !event.dataTransfer.types.some(type => ["Files", "text/plain", MATERIAL_DROP].includes(type))) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = editable && !blocked ? "copy" : "none";
          if (editable && !blocked) setDropTarget(true);
        }}
        onDragLeave={event => {
          if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropTarget(false);
        }}
        onDrop={drop}
      >
        <div className="board-world" style={{ width: BOARD_WIDTH * scale, height: BOARD_HEIGHT * scale, transform: `translate(${translationX}px, ${translationY}px) scale(${zoom})` }}>
          {board.background && <BoardImage key={board.background} tableId={table.id} assetId={board.background} label="" background />}
          {grid.enabled && <div className="board-grid" aria-hidden="true" style={{
            // Fill the viewport using the same coordinates as the artwork and materials.
            left: gridLeft,
            top: gridTop,
            width: width / zoom,
            height: height / zoom,
            backgroundSize: `${grid.size * scale}px ${grid.size * scale}px`,
            backgroundPosition: `${grid.x * scale - gridLeft}px ${grid.y * scale - gridTop}px`,
            opacity: (grid.opacity ?? 60) / 100,
            backgroundImage: ["right", "bottom"].map(direction =>
              `linear-gradient(to ${direction}, ${grid.color ?? "var(--fg)"} ${grid.thickness ?? 1}px, transparent ${grid.thickness ?? 1}px)`
            ).join(","),
          }} />}
          <BoardDrawingLayer strokes={strokes} preview={drawing.preview} />
          {board.materials.map(material => renderItem(`material/${material.id}`, material.kind,
            material.kind === "counter"
              ? <BoardCounterValue counter={{ ...material, name: material.title }} editable={editable} busy={blocked} command={command} />
              : material.kind === "image"
                ? <BoardImage tableId={table.id} assetId={material.assetId} label={material.title}
                  onOpen={editable ? undefined : () => setSelected(material.id)} />
                : editable
                  ? <div className="board-material-text-preview">{material.text.slice(0, 1500)}</div>
                  : <Button className="board-material-open" variant="ghost" size="sm" onClick={() => setSelected(material.id)}>
                    {material.text.slice(0, 1500)}
                  </Button>,
          ))}
          {board.counters.map(counter => renderItem(boardCounterKey(counter), "counter",
            <BoardCounterValue counter={counter} editable={editable} busy={blocked} command={command} />,
          ))}
        </div>
      </div>
      {sceneHud && (
        <div className={`table-live-hud${director ? " is-director" : ""}`}
          style={{ "--scene-art-top": `${sceneArtTop}px` } as CSSProperties}>
          {sceneHud}
        </div>
      )}
      {!draft && <BoardMemberCards table={table} command={command}
        busy={busy || needsRetry || table.archived} openHero={openHero} />}
    </div>
    {dialog === "counter" && editable && <BoardCounterForm board={board} table={table} draft={draft} busy={blocked}
      command={command} placement={startPlacement("counter")} onClose={() => setDialog(null)} />}
    {currentMaterial && currentMaterial.kind !== "counter" && <CardDetailModal open title={currentMaterial.title} wide onClose={() => setSelected("")} className="table-dialog board-reading">
      {currentMaterial.kind === "image"
        ? <BoardImage tableId={table.id} assetId={currentMaterial.assetId} label={currentMaterial.title} />
        : currentMaterial.markdown
          ? <MarkdownPreview text={currentMaterial.text} images={false} />
          : <p className="board-reading-text">{currentMaterial.text}</p>}
    </CardDetailModal>}
    {editable && <input type="file" accept={AVATAR_ACCEPT} ref={backgroundInput} hidden aria-label="Изображение фона"
      onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) void showImage({ file, id: crypto.randomUUID() });
      }} />}
    {editable && <input type="file" accept={AVATAR_ACCEPT} ref={imageInput} hidden aria-label="Файл изображения"
      onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) void showImage({ file, id: crypto.randomUUID(), point: camera.position.current });
      }} />}
    {editable && !toolsOpen && !gridObscured && (gridHost ? createPortal(gridControls, gridHost) : gridControls)}
  </section>;
}
