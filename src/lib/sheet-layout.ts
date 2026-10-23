export const PANEL_DEFINITIONS = [
  { id: "characteristics", label: "Характеристики", width: "wide" },
  { id: "potency", label: "Потенциал", width: "narrow" },
  { id: "vitals", label: "Здоровье", width: "wide" },
  { id: "resources", label: "Ресурсы героя", width: "narrow" },
  { id: "conditions", label: "Состояния", width: "narrow" },
  { id: "abilities", label: "Способности", width: "full" },
  { id: "skills", label: "Навыки", width: "wide" },
  { id: "progress", label: "Развитие", width: "narrow" },
  { id: "perks", label: "Перки", width: "full" },
] as const;
export type PanelId = (typeof PANEL_DEFINITIONS)[number]["id"];
export const GRID_STEP = 10;
export const PANEL_GAP = 20;
export const MIN_PANEL_WIDTH = 260;
export const MIN_PANEL_HEIGHT = 100;
export interface PanelPlacement {
  x: number;
  y: number;
  width: number;
  /** Omitted when the panel grows with its content. */
  height?: number;
}
export interface SheetPanel {
  id: PanelId;
  width: "wide" | "narrow" | "full";
  hidden: boolean;
  collapsed: boolean;
  /** Absent on legacy layouts until the panels have been measured. */
  placement?: PanelPlacement;
  layer?: number;
}
export type PanelHeights = Partial<Record<PanelId, number>>;

export function snapToGrid(value: number): number {
  return Number.isFinite(value)
    ? Math.max(0, Math.round(value / GRID_STEP) * GRID_STEP)
    : 0;
}
export function panelHeight(contentHeight = 0): number {
  return Math.ceil((contentHeight + 2) / GRID_STEP) * GRID_STEP;
}
export function resolvedPanelHeight(
  panel: SheetPanel,
  heights: PanelHeights,
): number {
  if (panel.collapsed) return panelHeight(44);
  return panel.placement?.height ?? panelHeight(heights[panel.id]);
}
export function normalizePlacement(value: unknown): PanelPlacement | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { x, y, width, height } = value as Partial<PanelPlacement>;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof width !== "number" ||
    ![x, y, width].every(Number.isFinite)
  )
    return undefined;
  return {
    x: snapToGrid(x),
    y: snapToGrid(y),
    width: Math.max(MIN_PANEL_WIDTH, snapToGrid(width)),
    ...(typeof height === "number" && Number.isFinite(height)
      ? { height: Math.max(MIN_PANEL_HEIGHT, snapToGrid(height)) }
      : {}),
  };
}
export function defaultSheetLayout(): SheetPanel[] {
  return PANEL_DEFINITIONS.map((p) => ({
    id: p.id,
    width: p.width,
    hidden: false,
    collapsed: false,
  }));
}
export function normalizeSheetLayout(value: unknown): SheetPanel[] {
  if (!Array.isArray(value)) return defaultSheetLayout();
  const result: SheetPanel[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const definition = PANEL_DEFINITIONS.find((p) => p.id === item.id);
    if (!definition || result.some((p) => p.id === item.id)) continue;
    const placement = normalizePlacement(item.placement);
    result.push({
      id: definition.id,
      width: ["wide", "narrow", "full"].includes(item.width)
        ? item.width
        : definition.width,
      hidden: item.hidden === true,
      collapsed: item.collapsed === true,
      ...(placement ? { placement } : {}),
      ...(typeof item.layer === "number" &&
      Number.isFinite(item.layer) &&
      item.layer >= 0
        ? { layer: Math.floor(item.layer) }
        : {}),
    });
  }
  return [
    ...result,
    ...defaultSheetLayout().filter(
      (p) => !result.some((saved) => saved.id === p.id),
    ),
  ];
}
export function defaultPanelWidth(
  panel: SheetPanel,
  availableWidth: number,
): number {
  const width = Math.max(
    MIN_PANEL_WIDTH,
    Math.floor(availableWidth / GRID_STEP) * GRID_STEP,
  );
  const fraction =
    panel.width === "narrow" ? 1 / 3 : panel.width === "wide" ? 2 / 3 : 1;
  if (width < 2 * MIN_PANEL_WIDTH + PANEL_GAP) return width;
  return Math.max(
    MIN_PANEL_WIDTH,
    Math.floor(
      ((width - (fraction === 1 ? 0 : PANEL_GAP)) * fraction) / GRID_STEP,
    ) * GRID_STEP,
  );
}

/** Pack only new/legacy panels. Saved coordinates, including intentional overlaps, are authoritative. */
export function positionPanels(
  layout: SheetPanel[],
  availableWidth: number,
  heights: PanelHeights,
): SheetPanel[] {
  const unplaced = layout.filter((p) => !p.hidden && !p.placement);
  if (!unplaced.length) return layout;
  const occupied = layout
    .filter((p) => !p.hidden && p.placement)
    .map((p) => ({ ...p.placement!, height: resolvedPanelHeight(p, heights) }));
  return layout.map((panel) => {
    if (panel.hidden || panel.placement) return panel;
    const width = defaultPanelWidth(panel, availableWidth);
    const height = resolvedPanelHeight(panel, heights);
    const xs = [
      ...new Set([0, ...occupied.map((r) => r.x + r.width + PANEL_GAP)]),
    ].sort((a, b) => a - b);
    const ys = [
      ...new Set([0, ...occupied.map((r) => r.y + r.height + PANEL_GAP)]),
    ].sort((a, b) => a - b);
    for (const y of ys)
      for (const x of xs) {
        if (x + width > Math.max(availableWidth, MIN_PANEL_WIDTH)) continue;
        const overlaps = occupied.some(
          (r) =>
            x < r.x + r.width + PANEL_GAP &&
            x + width + PANEL_GAP > r.x &&
            y < r.y + r.height + PANEL_GAP &&
            y + height + PANEL_GAP > r.y,
        );
        if (overlaps) continue;
        occupied.push({ x, y, width, height });
        return { ...panel, placement: { x, y, width } };
      }
    // Previously positioned panels may extend beyond a narrower window.
    const y = Math.max(0, ...occupied.map((r) => r.y + r.height + PANEL_GAP));
    occupied.push({ x: 0, y, width, height });
    return { ...panel, placement: { x: 0, y, width } };
  });
}

export function updatePanelPlacement(
  layout: SheetPanel[],
  id: PanelId,
  changes: Partial<PanelPlacement>,
): SheetPanel[] {
  const panel = layout.find((p) => p.id === id);
  if (!panel?.placement) return layout;
  const placement = normalizePlacement({ ...panel.placement, ...changes });
  if (
    !placement ||
    (placement.x === panel.placement.x &&
      placement.y === panel.placement.y &&
      placement.width === panel.placement.width &&
      placement.height === panel.placement.height)
  )
    return layout;
  return layout.map((p) => (p.id === id ? { ...p, placement } : p));
}

export function canvasSize(
  layout: SheetPanel[],
  heights: PanelHeights,
  availableWidth: number,
) {
  const visible = layout.filter((p) => !p.hidden && p.placement);
  return {
    width: Math.max(
      availableWidth,
      ...visible.map((p) => p.placement!.x + p.placement!.width),
    ),
    height:
      Math.max(
        0,
        ...visible.map((p) => p.placement!.y + resolvedPanelHeight(p, heights)),
      ) + PANEL_GAP,
  };
}
