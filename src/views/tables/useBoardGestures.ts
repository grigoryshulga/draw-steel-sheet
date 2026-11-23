import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { BOARD_HEIGHT, BOARD_WIDTH, boardScale, boundCounterPlacement, moveBoardItem, resizeBoardItem, screenToBoard, zoomBoard, type BoardResizeEdge } from "../../lib/tables/board";
import type { BoardGrid, BoardPlacement, BoardPoint, BoardView } from "../../lib/tables/types";
import type { useBoardView } from "../../state/useBoardView";

type DraggedItem = { key: string; placement: BoardPlacement };
type MoveTarget = { placement: BoardPlacement; overlay: boolean };
type Gesture =
  | { kind: "pan"; origin: BoardPoint; view: BoardView }
  | { kind: "pinch"; origin: BoardPoint; distance: number; view: BoardView }
  | { kind: "item"; item: DraggedItem & MoveTarget; edge?: BoardResizeEdge; origin: BoardPoint; view: BoardView; moved: boolean };

const closeEnough = (a: BoardPoint, b: BoardPoint) => Math.hypot(a.x - b.x, a.y - b.y) < 4;
const midpoint = (a: BoardPoint, b: BoardPoint) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distance = (a: BoardPoint, b: BoardPoint) => Math.hypot(a.x - b.x, a.y - b.y);

export function useBoardGestures(
  camera: ReturnType<typeof useBoardView>,
  grid: BoardGrid,
  fillViewport: boolean,
  artworkWidth: number,
  readItem: (key: string) => MoveTarget | undefined,
  onPlace: (item: DraggedItem) => Promise<void>,
) {
  const stage = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, BoardPoint>());
  const [dragged, setDragged] = useState<DraggedItem | null>(null);
  const [panning, setPanning] = useState(false);
  const width = () => stage.current?.clientWidth || 1;
  const height = () => stage.current?.clientHeight || 1;
  const local = (x: number, y: number) => {
    const rect = stage.current?.getBoundingClientRect();
    return { x: x - (rect?.left ?? 0), y: y - (rect?.top ?? 0) };
  };
  const at = (x: number, y: number) => screenToBoard(local(x, y), width(), camera.position.current, height(), fillViewport, artworkWidth);
  const inside = (point: BoardPoint) => point.x >= 0 && point.x <= width() &&
    point.y >= 0 && point.y <= height();
  const offsetView = (view: BoardView, origin: BoardPoint, next: BoardPoint): BoardView => {
    const scale = boardScale(width(), height(), fillViewport, artworkWidth) * view.zoom;
    return { ...view, x: view.x - (next.x - origin.x) / scale, y: view.y - (next.y - origin.y) / scale };
  };
  const placement = (current: Extract<Gesture, { kind: "item" }>, point: BoardPoint, event: ReactPointerEvent<HTMLDivElement>) => {
    const { key, overlay, placement: start } = current.item;
    const scale = boardScale(width(), height(), fillViewport, artworkWidth) * current.view.zoom;
    const delta = {
      x: (point.x - current.origin.x) * (overlay ? BOARD_WIDTH / width() : 1 / scale),
      y: (point.y - current.origin.y) * (overlay ? BOARD_HEIGHT / height() : 1 / scale),
    };
    const effectiveGrid = overlay || event.ctrlKey || event.metaKey ? { ...grid, enabled: false } : grid;
    const next = current.edge
      ? resizeBoardItem(start, current.edge, delta, effectiveGrid, { symmetric: event.altKey, proportional: event.shiftKey })
      : moveBoardItem(start, delta, effectiveGrid);
    return { key, placement: overlay ? boundCounterPlacement(next) : next };
  };

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || pointers.current.size >= 2) return;
    const target = event.target as HTMLElement;
    const handle = target.closest<HTMLElement>("[data-board-move]");
    const control = target.closest("button, a, input");
    const key = !control || control === handle ? handle?.dataset.boardMove : undefined;
    const item = key ? readItem(key) : undefined;
    if (gesture.current?.kind === "item" || (!item && (control || handle)) ||
        (!item && camera.following)) return;
    const origin = local(event.clientX, event.clientY);
    const view = camera.position.current;
    const isSecond = pointers.current.size === 1;
    if (isSecond && (item || event.pointerType !== "touch")) return;
    if (item) {
      event.preventDefault();
      handle?.focus({ preventScroll: true });
    }
    pointers.current.set(event.pointerId, origin);
    if (isSecond) {
      const [first, second] = [...pointers.current.values()];
      gesture.current = { kind: "pinch", origin: midpoint(first, second), distance: Math.max(1, distance(first, second)), view };
    } else if (item && key) gesture.current = { kind: "item", item: { key, ...item },
      edge: handle?.dataset.boardResize as BoardResizeEdge | undefined, origin, view, moved: false };
    else gesture.current = { kind: "pan", origin, view };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!item) setPanning(true);
  };

  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || !pointers.current.has(event.pointerId)) return;
    const point = local(event.clientX, event.clientY);
    pointers.current.set(event.pointerId, point);
    if (current.kind === "item") {
      if (!current.moved && closeEnough(current.origin, point)) return;
      current.moved = true;
      setDragged(placement(current, point, event));
    } else if (current.kind === "pan") {
      camera.move(offsetView(current.view, current.origin, point));
    } else {
      const [first, second] = [...pointers.current.values()];
      const anchor = screenToBoard(current.origin, width(), current.view, height(), fillViewport, artworkWidth);
      const next = zoomBoard(current.view, current.view.zoom * distance(first, second) / current.distance, anchor);
      camera.move(offsetView(next, current.origin, midpoint(first, second)));
    }
  };

  const finish = (event: ReactPointerEvent<HTMLDivElement>, cancel: boolean) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    const current = gesture.current;
    if (current?.kind === "pinch" && pointers.current.size && !cancel) {
      gesture.current = { kind: "pan", origin: [...pointers.current.values()][0], view: camera.position.current };
      return;
    }
    gesture.current = null;
    pointers.current.clear();
    setPanning(false);
    if (!current || cancel) { setDragged(null); return; }
    const point = local(event.clientX, event.clientY);
    if (current.kind === "item") {
      if (readItem(current.item.key) && current.moved && inside(point)) {
        const final = placement(current, point, event);
        setDragged(final);
        void onPlace(final).finally(() => setDragged(old => old === final ? null : old));
      } else setDragged(null);
    } else {
      camera.move(current.kind === "pan" ? offsetView(current.view, current.origin, point) : camera.position.current, true);
    }
  };

  const keyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && gesture.current) {
      gesture.current = null;
      pointers.current.clear();
      setPanning(false);
      setDragged(null);
      return;
    }
    const keys: Record<string, BoardPoint> = {
      ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
    };
    const shift = keys[event.key];
    const handle = (event.target as HTMLElement).closest<HTMLElement>("[data-board-move]");
    if (event.target !== handle && handle) return;
    const key = handle?.dataset.boardMove;
    const item = key ? readItem(key) : undefined;
    if (key && item && shift) {
      event.preventDefault();
      const effectiveGrid = item.overlay ? { ...grid, enabled: false } : grid;
      const step = effectiveGrid.enabled && item.placement.snap ? grid.size : event.shiftKey ? 40 : 10;
      const delta = { x: step * shift.x, y: step * shift.y };
      const edge = handle?.dataset.boardResize as BoardResizeEdge | undefined;
      const next = edge
        ? resizeBoardItem(item.placement, edge, delta, effectiveGrid)
        : moveBoardItem(item.placement, delta, effectiveGrid);
      void onPlace({ key, placement: item.overlay ? boundCounterPlacement(next) : next });
      return;
    }
    if (event.target !== event.currentTarget || camera.following) return;
    const view = camera.position.current;
    if (shift) camera.move({ ...view, x: view.x + 60 * shift.x / view.zoom, y: view.y + 60 * shift.y / view.zoom }, true);
    else if (event.key === "+" || event.key === "=") camera.move(zoomBoard(view, view.zoom * 1.25), true);
    else if (event.key === "-") camera.move(zoomBoard(view, view.zoom / 1.25), true);
    else return;
    event.preventDefault();
  };

  return {
    stage, at, dragged, panning,
    pointerDown, pointerMove, keyDown,
    pointerUp: (event: ReactPointerEvent<HTMLDivElement>) => finish(event, false),
    pointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => finish(event, true),
  };
}
