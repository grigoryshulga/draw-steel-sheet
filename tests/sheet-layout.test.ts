import { describe, expect, it } from "vitest";
import {
  canvasSize,
  defaultSheetLayout,
  GRID_STEP,
  MIN_PANEL_WIDTH,
  MIN_PANEL_HEIGHT,
  normalizeSheetLayout,
  panelHeight,
  resolvedPanelHeight,
  positionPanels,
  updatePanelPlacement,
  type PanelHeights,
} from "../src/lib/sheet-layout";

const heights: PanelHeights = Object.fromEntries(
  defaultSheetLayout().map((p) => [p.id, 173]),
);
const arranged = () => positionPanels(defaultSheetLayout(), 1180, heights);

describe("Free sheet layout", () => {
  it("adds the resources panel to a saved layout while preserving existing panel geometry and visibility", () => {
    const old = arranged()
      .filter((p) => p.id !== "resources")
      .map((p) =>
        p.id === "vitals" ? { ...p, hidden: true, collapsed: true } : p,
      );
    const migrated = normalizeSheetLayout(JSON.parse(JSON.stringify(old)));
    expect(migrated.filter((p) => p.id !== "resources")).toEqual(old);
    expect(migrated.find((p) => p.id === "resources")).toEqual({
      id: "resources",
      width: "narrow",
      hidden: false,
      collapsed: false,
    });
    const placed = positionPanels(migrated, 1180, heights);
    expect(placed.find((p) => p.id === "resources")?.placement).toBeDefined();
    expect(placed.filter((p) => p.id !== "resources")).toEqual(old);
  });
  it("migrates old visibility and sizing preferences without losing panels or duplicating them", () => {
    const layout = normalizeSheetLayout([
      null,
      { id: "removed" },
      { id: "vitals", width: "full", hidden: true, collapsed: true },
      { id: "vitals" },
    ]);
    expect(layout).toHaveLength(defaultSheetLayout().length);
    expect(layout[0]).toEqual({
      id: "vitals",
      width: "full",
      hidden: true,
      collapsed: true,
    });
    expect(new Set(layout.map((p) => p.id)).size).toBe(layout.length);
  });
  it("initially places every visible legacy panel without overlaps and on the 10px grid", () => {
    const layout = arranged();
    for (const panel of layout) {
      const rect = panel.placement!;
      expect(
        [rect.x, rect.y, rect.width].every((value) => value % GRID_STEP === 0),
      ).toBe(true);
      expect(rect.x + rect.width).toBeLessThanOrEqual(1180);
      for (const other of layout.filter((p) => p.id !== panel.id)) {
        const b = other.placement!;
        const separate =
          rect.x + rect.width <= b.x ||
          b.x + b.width <= rect.x ||
          rect.y + panelHeight(heights[panel.id]) <= b.y ||
          b.y + panelHeight(heights[other.id]) <= rect.y;
        expect(separate, `${panel.id} and ${other.id}`).toBe(true);
      }
    }
  });
  it("moves one panel to a free point without rearranging its neighbors", () => {
    const original = arranged();
    const moved = updatePanelPlacement(original, "vitals", { x: 37, y: 243 });
    expect(moved.find((p) => p.id === "vitals")?.placement).toMatchObject({
      x: 40,
      y: 240,
    });
    expect(moved.filter((p) => p.id !== "vitals")).toEqual(
      original.filter((p) => p.id !== "vitals"),
    );
    expect(original.find((p) => p.id === "vitals")?.placement?.x).toBe(0);
  });
  it("permits overlapping positions rather than silently pushing other panels away", () => {
    const layout = updatePanelPlacement(arranged(), "potency", { x: 0, y: 0 });
    expect(layout[0].placement).toMatchObject({ x: 0, y: 0 });
    expect(layout[1].placement).toMatchObject({ x: 0, y: 0 });
    expect(positionPanels(layout, 1180, heights)).toBe(layout);
  });
  it("resizes with grid snapping and minimum width, and prevents negative coordinates", () => {
    const resized = updatePanelPlacement(arranged(), "vitals", {
      width: 447,
      x: -23,
      y: -1,
    });
    expect(resized.find((p) => p.id === "vitals")?.placement).toEqual({
      width: 450,
      x: 0,
      y: 0,
    });
    expect(
      updatePanelPlacement(resized, "vitals", { width: 12 }).find(
        (p) => p.id === "vitals",
      )?.placement?.width,
    ).toBe(MIN_PANEL_WIDTH);
  });
  it("keeps desktop coordinates intact on smaller screens and across JSON storage", () => {
    const original = updatePanelPlacement(arranged(), "vitals", {
      x: 740,
      y: 300,
      width: 590,
    });
    const restored = normalizeSheetLayout(JSON.parse(JSON.stringify(original)));
    expect(restored).toEqual(original);
    expect(positionPanels(restored, 390, heights)).toBe(restored);
    expect(canvasSize(restored, heights, 390).width).toBe(1330);
  });
  it("places a restored legacy hidden panel without moving the existing panels", () => {
    const hidden = defaultSheetLayout().map((p) =>
      p.id === "potency" ? { ...p, hidden: true } : p,
    );
    const before = positionPanels(hidden, 1180, heights);
    const shown = positionPanels(
      before.map((p) => ({ ...p, hidden: false })),
      1180,
      heights,
    );
    expect(shown.find((p) => p.id === "potency")?.placement).toBeDefined();
    expect(shown.filter((p) => p.id !== "potency")).toEqual(
      before.filter((p) => p.id !== "potency"),
    );
  });
  it("grows the canvas for taller content and ignores hidden panels when determining its extent", () => {
    const layout = updatePanelPlacement(arranged(), "perks", { y: 900 });
    const before = canvasSize(layout, heights, 1180);
    expect(canvasSize(layout, { ...heights, perks: 633 }, 1180).height).toBe(
      1560,
    );
    expect(
      canvasSize(layout, { ...heights, perks: 633 }, 1180).height,
    ).toBeGreaterThan(before.height);
    expect(
      canvasSize(
        layout.map((p) => ({ ...p, hidden: true })),
        heights,
        1180,
      ),
    ).toEqual({ width: 1180, height: 20 });
  });
  it("discards corrupt saved geometry so it can be safely placed again", () => {
    const layout = normalizeSheetLayout([
      { id: "vitals", placement: { x: Infinity, y: 20, width: 500 } },
      { id: "potency", placement: { x: 33, y: -4, width: 345 } },
    ]);
    expect(layout[0].placement).toBeUndefined();
    expect(layout[1].placement).toEqual({ x: 30, y: 0, width: 350 });
  });
  it("snaps both dimensions and enforces a minimum height", () => {
    const resized = updatePanelPlacement(arranged(), "vitals", {
      width: 447,
      height: 237,
    });
    expect(resized.find((p) => p.id === "vitals")?.placement).toMatchObject({
      width: 450,
      height: 240,
    });
    expect(
      updatePanelPlacement(resized, "vitals", { height: -20 }).find(
        (p) => p.id === "vitals",
      )?.placement?.height,
    ).toBe(MIN_PANEL_HEIGHT);
    expect(resized.filter((p) => p.id !== "vitals")).toEqual(
      arranged().filter((p) => p.id !== "vitals"),
    );
  });
  it("preserves manual height through moving, width changes, and saved layouts", () => {
    let layout = updatePanelPlacement(arranged(), "vitals", { height: 300 });
    layout = updatePanelPlacement(layout, "vitals", { x: 50, width: 500 });
    const restored = normalizeSheetLayout(JSON.parse(JSON.stringify(layout)));
    expect(restored.find((p) => p.id === "vitals")?.placement).toMatchObject({
      x: 50,
      width: 500,
      height: 300,
    });
    expect(restored).toEqual(layout);
  });
  it("uses manual height for the canvas and restores automatic growth when cleared", () => {
    const layout = updatePanelPlacement(arranged(), "perks", {
      y: 900,
      height: 200,
    });
    expect(canvasSize(layout, { ...heights, perks: 633 }, 1180).height).toBe(
      1120,
    );
    const automatic = updatePanelPlacement(layout, "perks", {
      height: undefined,
    });
    expect(
      automatic.find((p) => p.id === "perks")?.placement,
    ).not.toHaveProperty("height");
    expect(canvasSize(automatic, { ...heights, perks: 633 }, 1180).height).toBe(
      1560,
    );
  });
  it("collapses a manually sized panel without losing its expanded height", () => {
    const panel = updatePanelPlacement(arranged(), "vitals", {
      height: 500,
    }).find((p) => p.id === "vitals")!;
    expect(resolvedPanelHeight({ ...panel, collapsed: true }, heights)).toBe(
      50,
    );
    expect(resolvedPanelHeight(panel, heights)).toBe(500);
  });
  it("packs new panels below a manually sized obstacle and ignores corrupt saved height", () => {
    const layout = defaultSheetLayout().map((p, i) =>
      i === 0
        ? { ...p, placement: { x: 0, y: 0, width: 1180, height: 500 } }
        : p,
    );
    const placed = positionPanels(layout, 1180, heights);
    expect(placed[1].placement?.y).toBe(520);
    const restored = normalizeSheetLayout([
      { id: "vitals", placement: { x: 0, y: 0, width: 500, height: "broken" } },
    ]);
    expect(restored[0].placement).toEqual({ x: 0, y: 0, width: 500 });
  });
});
