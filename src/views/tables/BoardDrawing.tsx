import { memo, useRef, useState, type PointerEvent } from "react";
import { BOARD_HEIGHT, BOARD_STROKE_MAX, BOARD_STROKE_POINTS_MAX, BOARD_WIDTH } from "../../lib/tables/board";
import type { BoardPoint, BoardStroke } from "../../lib/tables/types";
import type { SendTableCommand } from "./TableMembers";

type DrawingAction =
  | { type: "board-draw"; payload: { sceneId: string | null; stroke: BoardStroke } }
  | { type: "board-undo-stroke"; payload: { sceneId: string | null; id: string } };

export function useBoardDrawing({ strokes, sceneId, editable, blocked, command, pointAt }: {
  strokes: BoardStroke[];
  sceneId: string | null;
  editable: boolean;
  blocked: boolean;
  command: SendTableCommand;
  pointAt: (x: number, y: number) => BoardPoint;
}) {
  const [enabled, setEnabled] = useState(false);
  const [color, setColor] = useState("#ff6961");
  const [thickness, setThickness] = useState(6);
  const [preview, setPreview] = useState<BoardStroke | null>(null);
  const [pending, setPending] = useState<DrawingAction | null>(null);
  const active = useRef<{ pointerId: number; sceneId: string | null; stroke: BoardStroke } | null>(null);
  const working = useRef(false);
  const painting = editable && enabled;
  const full = strokes.length >= BOARD_STROKE_MAX;

  const save = async (action: DrawingAction) => {
    if (working.current) return;
    working.current = true;
    try {
      const saved = await command(action.type, action.payload);
      setPending(saved ? null : action);
      if (saved) setPreview(null);
    } finally { working.current = false; }
  };

  const point = (event: PointerEvent<HTMLDivElement>): BoardStroke["points"][number] => {
    const { x, y } = pointAt(event.clientX, event.clientY);
    return [Math.round(Math.max(0, Math.min(x, BOARD_WIDTH))), Math.round(Math.max(0, Math.min(y, BOARD_HEIGHT)))];
  };

  const extend = (stroke: BoardStroke, next: BoardStroke["points"][number], finish: boolean) => {
    const [x, y] = stroke.points[stroke.points.length - 1];
    if (Math.hypot(next[0] - x, next[1] - y) < (finish ? 1 : 2)) return stroke;
    const points = stroke.points.length === BOARD_STROKE_POINTS_MAX
      ? stroke.points.filter((_, index) => index % 2 === 0) : stroke.points;
    return { ...stroke, points: [...points, next] };
  };

  const cancel = () => {
    if (active.current) setPreview(null);
    active.current = null;
  };

  return {
    painting, color, setColor, thickness, setThickness, preview, pending, full,
    inProgress: () => active.current !== null,
    toggle: () => { cancel(); setEnabled(value => !value); },
    cancel,
    retry: () => { if (editable && pending) void save(pending); },
    discard: () => { setPending(null); setPreview(null); },
    undo: () => {
      const last = strokes.at(-1);
      if (last && !blocked && !pending && !active.current) void save({ type: "board-undo-stroke", payload: { sceneId, id: last.id } });
    },
    pointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (!painting || (event.target as Element).closest("button, a, input")) return false;
      if (event.button !== 0 || active.current || blocked || pending || full || working.current) return true;
      const { x, y } = pointAt(event.clientX, event.clientY);
      if (x < 0 || x > BOARD_WIDTH || y < 0 || y > BOARD_HEIGHT) return true;
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
      const stroke: BoardStroke = { id: crypto.randomUUID(), color, thickness, points: [[Math.round(x), Math.round(y)]] };
      active.current = { pointerId: event.pointerId, stroke, sceneId };
      setPreview(stroke);
      return true;
    },
    pointerMove: (event: PointerEvent<HTMLDivElement>) => {
      const current = active.current;
      if (current?.pointerId !== event.pointerId) return false;
      const stroke = extend(current.stroke, point(event), false);
      current.stroke = stroke;
      setPreview(stroke);
      return true;
    },
    pointerEnd: (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
      const current = active.current;
      if (current?.pointerId !== event.pointerId) return false;
      if (cancelled || !editable || current.sceneId !== sceneId) { cancel(); return true; }
      active.current = null;
      const stroke = extend(current.stroke, point(event), true);
      setPreview(stroke);
      void save({ type: "board-draw", payload: { sceneId: current.sceneId, stroke } });
      return true;
    },
  };
}

function Stroke({ stroke }: { stroke: BoardStroke }) {
  return stroke.points.length === 1
    ? <circle cx={stroke.points[0][0]} cy={stroke.points[0][1]} r={stroke.thickness / 2} fill={stroke.color} />
    : <polyline points={stroke.points.map(point => point.join(",")).join(" ")} fill="none" stroke={stroke.color}
      strokeWidth={stroke.thickness} strokeLinecap="round" strokeLinejoin="round" />;
}

const SavedStrokes = memo(function SavedStrokes({ strokes }: { strokes: BoardStroke[] }) {
  return strokes.map(stroke => <Stroke key={stroke.id} stroke={stroke} />);
});

export function BoardDrawingLayer({ strokes, preview }: { strokes: BoardStroke[]; preview: BoardStroke | null }) {
  if (!strokes.length && !preview) return null;
  return <svg className="board-drawing" viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`} aria-hidden="true">
    <SavedStrokes strokes={strokes} />
    {preview && !strokes.some(stroke => stroke.id === preview.id) && <Stroke stroke={preview} />}
  </svg>;
}
