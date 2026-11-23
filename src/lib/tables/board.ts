import type { BoardGrid, BoardPlacement, BoardPoint, BoardView, SharedBoardView, TableBoard } from "./types";

export const BOARD_WIDTH = 1600;
export const BOARD_HEIGHT = 900;
export const BOARD_IMAGE_MAX = 8 * 1024 * 1024;
export const BOARD_STROKE_MAX = 128;
export const BOARD_STROKE_POINTS_MAX = 384;
export const BOARD_BRUSH_MAX = 32;
export const BOARD_VIEW: BoardView = { x: BOARD_WIDTH / 2, y: BOARD_HEIGHT / 2, zoom: 1 };
export const BOARD_ITEM_MIN = { width: 160, height: 88 };

const constrain = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const snapAxis = (value: number, offset: number, size: number) => offset + Math.round((value - offset) / size) * size;
function snapWithin(value: number, offset: number, size: number, low: number, high: number) {
  const first = offset + Math.ceil((low - offset) / size) * size;
  const last = offset + Math.floor((high - offset) / size) * size;
  return first <= last ? constrain(snapAxis(value, offset, size), first, last) : constrain(value, low, high);
}

export function moveBoardItem(item: BoardPlacement, delta: BoardPoint, grid: BoardGrid): BoardPlacement {
  const x = item.x + delta.x;
  const y = item.y + delta.y;
  if (!grid.enabled || !item.snap) return { ...item, x: constrain(x, 0, BOARD_WIDTH), y: constrain(y, 0, BOARD_HEIGHT) };
  const sizeOnGrid = (length: number, offset: number, minimum: number, limit: number) => {
    const start = offset + Math.ceil(-offset / grid.size) * grid.size;
    return snapWithin(length, 0, grid.size, minimum, limit - start);
  };
  const width = sizeOnGrid(item.width, grid.x, BOARD_ITEM_MIN.width, BOARD_WIDTH);
  const height = sizeOnGrid(item.height, grid.y, BOARD_ITEM_MIN.height, BOARD_HEIGHT);
  return { ...item, width, height,
    x: snapWithin(x - width / 2, grid.x, grid.size, 0, BOARD_WIDTH - width) + width / 2,
    y: snapWithin(y - height / 2, grid.y, grid.size, 0, BOARD_HEIGHT - height) + height / 2 };
}

export function alignBoardItem(item: BoardPlacement, grid: BoardGrid): BoardPlacement {
  return moveBoardItem(item, { x: 0, y: 0 }, grid);
}

export type BoardResizeEdge = "n" | "e" | "s" | "w" | "nw" | "ne" | "sw" | "se";

function commonDivisor(a: number, b: number): number {
  return b === 0 ? a : commonDivisor(b, a % b);
}

export function resizeBoardItem(source: BoardPlacement, edge: BoardResizeEdge, delta: BoardPoint, grid: BoardGrid,
  { symmetric = false, proportional = false } = {}): BoardPlacement {
  const snap = grid.enabled && source.snap;
  const item = snap ? alignBoardItem(source, grid) : source;
  const directionX = edge.includes("e") ? 1 : edge.includes("w") ? -1 : 0;
  const directionY = edge.includes("s") ? 1 : edge.includes("n") ? -1 : 0;
  const multiplier = symmetric ? 2 : 1;
  const maxSize = (center: number, length: number, direction: number, limit: number) => {
    if (!snap) return limit;
    if (symmetric || !direction) return 2 * Math.min(center, limit - center);
    return length / 2 + (direction > 0 ? limit - center : center);
  };
  const maxWidth = maxSize(item.x, item.width, directionX, BOARD_WIDTH);
  const maxHeight = maxSize(item.y, item.height, directionY, BOARD_HEIGHT);
  const resizeAxis = (center: number, length: number, direction: number, shift: number, offset: number, min: number, max: number) => {
    if (!direction) return length;
    const fixed = symmetric ? center : center - direction * length / 2;
    const moving = center + direction * length / 2 + shift;
    const low = fixed + (direction > 0 ? min : -max) / multiplier;
    const high = fixed + (direction > 0 ? max : -min) / multiplier;
    const target = snap ? snapWithin(moving, offset, grid.size, low, high) : moving;
    return constrain(direction * (target - fixed) * multiplier, min, max);
  };
  let width = resizeAxis(item.x, item.width, directionX,
    delta.x, grid.x, BOARD_ITEM_MIN.width, maxWidth);
  let height = resizeAxis(item.y, item.height, directionY,
    delta.y, grid.y, BOARD_ITEM_MIN.height, maxHeight);
  if (proportional) {
    const useWidth = directionX && (!directionY || Math.abs(delta.x / item.width) >= Math.abs(delta.y / item.height));
    const wantedRatio = useWidth ? width / item.width : height / item.height;
    const minRatio = Math.max(BOARD_ITEM_MIN.width / item.width, BOARD_ITEM_MIN.height / item.height);
    const maxRatio = Math.min(maxWidth / item.width, maxHeight / item.height);
    if (snap) {
      const divisor = commonDivisor(Math.round(item.width / grid.size), Math.round(item.height / grid.size));
      // A centered axis can grow by two cells at a time and keep both edges on the grid.
      const step = (symmetric || !directionX || !directionY ? 2 : 1) / divisor;
      const ratio = snapWithin(wantedRatio, 1, step, minRatio, maxRatio);
      width = snapAxis(item.width * ratio, 0, grid.size);
      height = snapAxis(item.height * ratio, 0, grid.size);
    } else {
      const ratio = constrain(wantedRatio, minRatio, maxRatio);
      width = constrain(item.width * ratio, BOARD_ITEM_MIN.width, BOARD_WIDTH);
      height = constrain(item.height * ratio, BOARD_ITEM_MIN.height, BOARD_HEIGHT);
    }
  }
  return { ...item, width, height,
    x: symmetric ? item.x : constrain(item.x + directionX * (width - item.width) / 2, 0, BOARD_WIDTH),
    y: symmetric ? item.y : constrain(item.y + directionY * (height - item.height) / 2, 0, BOARD_HEIGHT) };
}
export const SHARED_BOARD_VIEW: SharedBoardView = { ...BOARD_VIEW, revision: 0, control: null };
export const EMPTY_BOARD: TableBoard = {
  background: null,
  grid: { enabled: false, size: 80, x: 0, y: 0 },
  materials: [],
  counters: [],
};

export function clampBoardView(view: BoardView): BoardView {
  const zoom = Math.min(4, Math.max(1, view.zoom));
  const halfWidth = BOARD_WIDTH / zoom / 2;
  const halfHeight = BOARD_HEIGHT / zoom / 2;
  return {
    x: Math.min(BOARD_WIDTH - halfWidth, Math.max(halfWidth, view.x)),
    y: Math.min(BOARD_HEIGHT - halfHeight, Math.max(halfHeight, view.y)),
    zoom,
  };
}

export const SCENE_DROP = "application/x-dostat-listy-scene";
export const SCENE_TEMPLATE_DROP = "application/x-dostat-listy-scene-template";
export const MAIN_SCENE_DROP = "application/x-dostat-listy-main-scene";

export type SceneDrop = { kind: "main" } | { kind: "scene" | "template"; id: string };

export function hasSceneDrag(data: Pick<DataTransfer, "types">) {
  return data.types.some(type => type === SCENE_DROP || type === SCENE_TEMPLATE_DROP || type === MAIN_SCENE_DROP);
}

export function readSceneDrop(data: DataTransfer): SceneDrop | undefined {
  if (data.getData(MAIN_SCENE_DROP) === "main") return { kind: "main" };
  const scene = data.getData(SCENE_DROP);
  if (scene) return { kind: "scene", id: scene };
  const template = data.getData(SCENE_TEMPLATE_DROP);
  if (template) return { kind: "template", id: template };
}

export function boardScale(width: number, height: number, fillViewport = false, artworkWidth = BOARD_WIDTH) {
  const heightScale = height / BOARD_HEIGHT;
  // Artwork keeps its original height and horizontal centre in board coordinates.
  // Fit both the art and logical board so existing placements stay aligned.
  return fillViewport
    ? Math.max(width / Math.min(artworkWidth, BOARD_WIDTH), heightScale)
    : Math.min(width / Math.max(artworkWidth, BOARD_WIDTH), heightScale);
}

export function boardCenterY(height: number, fitScale: number) {
  return Math.max(height / 2, height - BOARD_HEIGHT * fitScale / 2);
}

/** Screen coordinates are relative to the viewport. */
export function screenToBoard(point: BoardPoint, viewportWidth: number, view: BoardView,
  viewportHeight = viewportWidth * BOARD_HEIGHT / BOARD_WIDTH, fillViewport = false, artworkWidth = BOARD_WIDTH): BoardPoint {
  const fitScale = boardScale(viewportWidth, viewportHeight, fillViewport, artworkWidth);
  const scale = fitScale * view.zoom;
  return {
    x: view.x + (point.x - viewportWidth / 2) / scale,
    y: view.y + (point.y - boardCenterY(viewportHeight, fitScale)) / scale,
  };
}

export function zoomBoard(view: BoardView, zoom: number, anchor: BoardPoint = view): BoardView {
  const next = Math.min(4, Math.max(1, zoom));
  const ratio = view.zoom / next;
  return clampBoardView({
    x: anchor.x + (view.x - anchor.x) * ratio,
    y: anchor.y + (view.y - anchor.y) * ratio,
    zoom: next,
  });
}
