import { EMPTY_BOARD } from "../../lib/tables/board";
import type { BoardGrid, BoardMaterial, BoardStroke, SceneLayout, TableSnapshot } from "../../lib/tables/types";
import { TableBoard } from "./TableBoard";

export function SceneLayoutEditor({ table, layout, busy, onChange }: {
  table: TableSnapshot;
  layout?: SceneLayout;
  busy: boolean;
  onChange: (layout: SceneLayout) => void;
}) {
  const current = layout ?? {
    tableId: table.id, background: null, grid: EMPTY_BOARD.grid, materials: [],
  };
  const snapshot = { ...table, board: { ...current, counters: [] } };
  return <TableBoard draft table={snapshot} busy={busy} needsRetry={false} command={async (type, payload = {}) => {
    const materials = current.materials;
    let next: SceneLayout;
    switch (type) {
      case "board-grid": next = { ...current, grid: payload as unknown as BoardGrid }; break;
      case "board-background": next = { ...current, background: payload.assetId as string | null }; break;
      case "board-draw": next = { ...current, strokes: [...(current.strokes ?? []), payload.stroke as BoardStroke] }; break;
      case "board-undo-stroke": next = { ...current, strokes: current.strokes?.slice(0, -1) }; break;
      case "board-show":
        if (materials.length >= 32) throw new Error("На сцене помещаются 32 материала");
        next = { ...current, materials: [...materials, payload as unknown as BoardMaterial] };
        break;
      case "board-move": next = { ...current, materials: materials.map(material => material.id === payload.id
        ? { ...material, x: payload.x as number, y: payload.y as number,
          settings: payload.settings as BoardMaterial["settings"] } : material) }; break;
      case "board-step-counter": next = { ...current, materials: materials.map(material => material.id === payload.id && material.kind === "counter"
        ? { ...material, value: Math.max(0, Math.min(material.max ?? 1000000000, material.value + (payload.delta as number))) }
        : material) }; break;
      case "board-remove": next = { ...current, materials: materials.filter(material => material.id !== payload.id) }; break;
      default: return null;
    }
    onChange(next);
    return snapshot;
  }} />;
}
