import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { BOARD_VIEW, alignBoardItem, clampBoardView, moveBoardItem, resizeBoardItem, screenToBoard, zoomBoard } from "../src/lib/tables/board";
import { createTablesStore } from "../server/tables-store.mjs";
import { createScene } from "../src/lib/tables/scenes";

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { force: true, recursive: true }))); });

async function room() {
  const dataDir = await mkdtemp(join(tmpdir(), "dss-board-test-"));
  dirs.push(dataDir);
  const store = createTablesStore({ dataDir });
  const table = await store.command(null, {
    type: "create", operationId: "create", payload: { name: "Стол", memberName: "Ведущий" },
  });
  const command = async (type: string, payload: unknown) => {
    const input = { type, payload, operationId: randomUUID(), expectedRevision: (await store.read(table.id)).revision };
    return { input, result: await store.command(table.id, input) };
  };
  return { ...table, dataDir, store, command };
}

describe("table board", () => {
  it("aligns coordinates on different screens and zooms about the cursor", () => {
    const point = screenToBoard({ x: 500, y: 320 }, 800, BOARD_VIEW);
    expect(screenToBoard({ x: 250, y: 160 }, 400, BOARD_VIEW)).toEqual(point);
    const enlarged = zoomBoard(BOARD_VIEW, 2, point);
    expect(screenToBoard({ x: 250, y: 160 }, 400, enlarged)).toEqual(point);
    expect(clampBoardView({ x: -20, y: 9000, zoom: 10 })).toEqual({ x: 200, y: 787.5, zoom: 4 });
    expect(screenToBoard({ x: 400, y: 900 }, 800, BOARD_VIEW, 900)).toEqual({ x: 800, y: 900 });
    const tallPoint = screenToBoard({ x: 450, y: 700 }, 800, BOARD_VIEW, 900);
    expect(screenToBoard({ x: 450, y: 700 }, 800, zoomBoard(BOARD_VIEW, 2, tallPoint), 900)).toEqual(tallPoint);
  });

  it("fits a background to the viewport height and keeps zoom anchored on a tall screen", () => {
    const width = 390, height = 840;
    expect(screenToBoard({ x: width / 2, y: 0 }, width, BOARD_VIEW, height, true)).toEqual({ x: 800, y: 0 });
    expect(screenToBoard({ x: width / 2, y: height }, width, BOARD_VIEW, height, true)).toEqual({ x: 800, y: 900 });
    const cursor = { x: 250, y: 630 };
    const point = screenToBoard(cursor, width, BOARD_VIEW, height, true);
    const zoomed = zoomBoard(BOARD_VIEW, 2, point);
    expect(screenToBoard(cursor, width, zoomed, height, true)).toEqual(point);
  });

  it("keeps preparation private and installs the styled layout once when launched", async () => {
    const { id, store, command } = await room();
    const scene = createScene("montage", "Дорога");
    const grid = { enabled: true, size: 64, x: 2, y: 4, color: "#aaccee", opacity: 20, thickness: 4 };
    const material = { id: "sign", title: "Указатель", text: "К мосту", kind: "text", x: 800, y: 450 };
    const prepared = await command("save-scene", { scene: { ...scene, layout: { tableId: id, background: null, grid, materials: [material] } } });
    expect(prepared.result.board.materials).toEqual([]);
    const { input, result } = await command("board-start-scene", { sceneId: scene.id });
    expect(result.board).toMatchObject({ sceneId: scene.id, grid, materials: [material] });
    expect(result.scenes[0]).toMatchObject({ id: scene.id, status: "active", published: true });
    await command("board-move", { id: material.id, x: 900, y: 450 });
    expect((await store.command(id, input)).board.materials[0].x).toBe(900);
    await command("save-scene", { scene: { ...result.scenes[0], published: false } });
    expect((await store.read(id)).board).toMatchObject({ materials: [], background: null });
    await expect(command("board-grid", { ...grid, opacity: 101 })).rejects.toMatchObject({ status: 400 });
  });

  it("keeps strokes in the current scene and undoes only the last stroke", async () => {
    const { id, store, command } = await room();
    const stroke = { id: "mark", color: "#ff0000", thickness: 4, points: [[100, 120], [320, 250]] };
    const { input } = await command("board-draw", { sceneId: null, stroke });
    expect((await store.command(id, input)).board.strokes).toEqual([stroke]);
    const second = { ...stroke, id: "dot", color: "#00ff00", thickness: 12, points: [[80, 90]] };
    await command("board-draw", { sceneId: null, stroke: second });
    await expect(command("board-undo-stroke", { sceneId: null, id: stroke.id })).rejects.toMatchObject({ status: 400 });
    await command("board-undo-stroke", { sceneId: null, id: second.id });
    await expect(command("board-draw", { sceneId: null, stroke: { ...second, points: [[1601, 0]] } })).rejects.toMatchObject({ status: 400 });
    expect((await store.read(id)).board.strokes).toEqual([stroke]);
    const scene = createScene("montage", "Карта");
    await command("save-scene", { scene: { ...scene, layout: { tableId: id, background: null,
      grid: { enabled: false, size: 80, x: 0, y: 0 }, materials: [], strokes: [second] } } });
    expect((await store.read(id)).board.strokes).toEqual([stroke]);
    const started = await command("board-start-scene", { sceneId: scene.id });
    expect(started.result.board.strokes).toEqual([second]);
    await expect(command("board-draw", { sceneId: null, stroke })).rejects.toMatchObject({ status: 400 });
    await command("save-scene", { scene: { ...started.result.scenes[0], published: false } });
    expect((await store.read(id)).board.strokes).toEqual([stroke]);
  });

  it("replaces only the current layout and restores the main scene with its own assets", async () => {
    const { id, dataDir, store, command } = await room();
    const image = await readFile(new URL("../public/brand/powered-by-draw-steel.webp", import.meta.url));
    const asset = randomUUID();
    await store.uploadBoardImage(id, asset, image);
    await command("board-background", { assetId: asset });
    const mainGrid = { enabled: true, size: 40, x: 1, y: 2 };
    await command("board-grid", mainGrid);
    const material = { id: "table-title", kind: "text", title: "Карта", text: "Карта", x: 200, y: 300 };
    await command("board-show", material);
    await command("board-add-counter", { id: "days", name: "Дни", value: 1 });
    const firstScene = { ...createScene("encounter", "Засада"), round: 3 };
    const secondScene = createScene("negotiation", "Переговоры");
    await command("save-scene", { scene: firstScene });
    await command("save-scene", { scene: secondScene });
    const first = await command("board-start-scene", { sceneId: firstScene.id });
    expect(first.result.board).toMatchObject({ sceneId: firstScene.id, background: null, materials: [] });
    expect(first.result.board).not.toHaveProperty("mainLayout");
    expect((await command("board-start-scene", { sceneId: secondScene.id })).result.board.sceneId).toBe(secondScene.id);
    expect((await command("board-start-scene", { sceneId: firstScene.id })).result.scenes).toContainEqual(
      expect.objectContaining({ id: firstScene.id, round: 3 }),
    );
    await utimes(join(dataDir, "table-images", id, asset), 1, 1);
    await store.uploadBoardImage(id, randomUUID(), image);
    expect(await store.readBoardImage(id, asset)).toEqual(image);
    const restored = await command("board-start-scene", { sceneId: null });
    expect(restored.result.board).not.toHaveProperty("sceneId");
    expect(restored.result.board).toMatchObject({ background: asset, grid: mainGrid, materials: [material], counters: [{ id: "days", value: 1 }] });
    expect((await store.command(id, restored.input)).board).toEqual(restored.result.board);
  });

  it("moves and resizes from grid offsets, and allows free placement per item", () => {
    const grid = { enabled: true, size: 40, x: 10, y: 20 };
    const item = { x: 410, y: 440, width: 240, height: 120, snap: true };
    expect(alignBoardItem({ ...item, width: 234, height: 119 }, grid)).toEqual(item);
    expect(moveBoardItem(item, { x: 29, y: 13 }, grid)).toMatchObject({ x: 450, y: 440 });
    expect(moveBoardItem({ ...item, snap: false }, { x: 29, y: 13 }, grid)).toMatchObject({ x: 439, y: 453 });
    const resized = resizeBoardItem(item, "se", { x: 53, y: 15 }, grid);
    expect(resized.x - resized.width / 2).toBe(item.x - item.width / 2);
    expect(resized.y - resized.height / 2).toBe(item.y - item.height / 2);
    expect(resized.x + resized.width / 2).toBe(570);
    expect(resized.y + resized.height / 2).toBe(500);
    const symmetric = resizeBoardItem(item, "se", { x: 53, y: 31 }, grid, { symmetric: true });
    expect(symmetric).toMatchObject({ x: item.x, y: item.y, width: 320, height: 200 });
    const proportional = resizeBoardItem(item, "se", { x: 45, y: 10 }, { ...grid, enabled: false }, { proportional: true });
    expect(proportional.width / proportional.height).toBe(2);
    expect(proportional.width).toBe(285);
  });

  it("snaps all four corners after a free resize or grid change", () => {
    const grid = { enabled: true, size: 80, x: 13, y: -21 };
    const source = { x: 392, y: 317, width: 251, height: 169, snap: true };
    const moved = moveBoardItem(source, { x: 42, y: -12 }, grid);
    const resized = resizeBoardItem(source, "ne", { x: 107, y: -49 }, grid);
    const proportional = resizeBoardItem(moved, "se", { x: 98, y: 40 }, grid, { proportional: true });
    const centered = resizeBoardItem(moved, "e", { x: 80, y: 0 }, grid, { symmetric: true, proportional: true });
    const oversized = resizeBoardItem(moved, "se", { x: 4000, y: 3000 }, grid);
    for (const item of [moved, resized, proportional, centered, oversized]) {
      const left = item.x - item.width / 2;
      const right = item.x + item.width / 2;
      const top = item.y - item.height / 2;
      const bottom = item.y + item.height / 2;
      expect((left - grid.x) % grid.size).toBe(0);
      expect((right - grid.x) % grid.size).toBe(0);
      expect((top - grid.y) % grid.size).toBe(0);
      expect((bottom - grid.y) % grid.size).toBe(0);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThanOrEqual(1600);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(bottom).toBeLessThanOrEqual(900);
    }
    expect(proportional.width / proportional.height).toBe(moved.width / moved.height);
    expect(centered).toMatchObject({ x: moved.x, y: moved.y });
  });

  it("persists and locks a positioned counter, including one launched from a draft", async () => {
    const { id, store, command } = await room();
    const counter = { id: "timer", title: "Осталось", kind: "counter", x: 500, y: 330, value: 1, max: 3,
      settings: { width: 240, height: 128, snap: false } };
    const scene = createScene("montage", "Сцена");
    await command("save-scene", { scene: { ...scene, layout: { tableId: id, background: null,
      grid: { enabled: false, size: 80, x: 0, y: 0 }, materials: [counter] } } });
    await command("board-start-scene", { sceneId: scene.id });
    const placement = { id: counter.id, x: 540, y: 360, settings: { ...counter.settings, width: 280, locked: true } };
    await command("board-move", placement);
    await expect(command("board-move", { ...placement, x: 541 })).rejects.toMatchObject({ status: 400 });
    await expect(command("board-move", { ...placement, settings: { ...placement.settings, height: 60 } })).rejects.toMatchObject({ status: 400 });
    await command("board-step-counter", { id: counter.id, delta: 1 });
    expect((await store.read(id)).board.materials).toMatchObject([{ ...counter, ...placement, value: 2 }]);
    await command("board-remove", { id: counter.id });
    expect((await store.read(id)).board.materials).toEqual([]);
  });

  it("persists grid and materials, filters extra fields and replays a show once", async () => {
    const { dataDir, store, id, command } = await room();
    expect((await store.read(id)).board.grid.enabled).toBe(false);
    const grid = { enabled: true, size: 60, x: -30, y: 25 };
    await command("board-grid", grid);
    const text = { id: "letter", title: "Письмо", kind: "text", text: "Улика", x: 350.4, y: 480 };
    const { input } = await command("board-show", { ...text, private: "not a field" });
    expect((await store.command(id, input)).board.materials).toEqual([text]);
    await expect(command("board-move", { id: text.id, x: 1601, y: 100 })).rejects.toMatchObject({ status: 400 });
    await command("board-move", { id: text.id, x: 140, y: 180 });
    expect((await createTablesStore({ dataDir }).read(id)).board).toMatchObject({
      grid, materials: [{ ...text, x: 140, y: 180 }],
    });
  });

  it("links an open scene counter without copying it and retains an unpinned table counter", async () => {
    const { store, id, command } = await room();
    const scene = {
      id: "encounter", name: "Таверна", kind: "encounter", status: "active",
      published: true, description: "", objective: "", round: 1, initiative: "heroes", combatants: [],
      counters: [{ id: "alarm", name: "Тревога", value: 2, max: 3, public: true }],
    };
    const pin = { id: "alarm", sceneId: "encounter" };
    await command("save-scene", { scene });
    await command("board-pin-counter", pin);
    const placement = { x: 300, y: 220, width: 240, height: 110, snap: true, locked: true };
    await command("board-place-counter", { ...pin, placement });
    await expect(command("board-place-counter", { ...pin, placement: { ...placement, x: 315 } })).rejects.toMatchObject({ status: 400 });
    const { input, result } = await command("board-step-counter", { ...pin, delta: 1 });
    expect(result.scenes[0].counters[0].value).toBe(3);
    expect((await store.command(id, input)).board.counters).toMatchObject([{ ...pin, value: 3, placement }]);
    await command("save-scene", { scene: { ...scene, counters: [{ ...scene.counters[0], public: false }] } });
    expect((await store.read(id)).board.counters).toEqual([]);
    await command("board-add-counter", { id: "days", name: "Дни", value: 2 });
    await command("board-unpin-counter", { id: "days" });
    expect((await store.read(id)).board.availableCounters).toMatchObject([{ id: "days", value: 2 }]);
    expect((await command("board-pin-counter", { id: "days" })).result.board.counters).toMatchObject([{ id: "days", value: 2 }]);
  });

  it("publishes only a valid stored image belonging to this table", async () => {
    const { id, store, command } = await room();
    const assetId = randomUUID();
    const image = await readFile(new URL("../public/brand/powered-by-draw-steel.webp", import.meta.url));
    await expect(command("board-background", { assetId })).rejects.toMatchObject({ status: 400 });
    await expect(store.uploadBoardImage(id, assetId, image.subarray(0, 25))).rejects.toMatchObject({ status: 400 });
    await store.uploadBoardImage(id, assetId, image);
    await store.uploadBoardImage(id, assetId, image);
    expect((await command("board-background", { assetId })).result.board.background).toBe(assetId);
    expect((await store.readBoardImage(id, assetId)).equals(image)).toBe(true);
    const other = await store.command(null, {
      type: "create", operationId: "other", payload: { name: "Другой стол", memberName: "Ведущий" },
    });
    await expect(store.command(other.id, {
      type: "board-background", payload: { assetId }, operationId: "cross-table", expectedRevision: other.revision,
    })).rejects.toMatchObject({ status: 400 });
  });

  it("orders view gestures independently and stops shared view on archive", async () => {
    const { id, store, command } = await room();
    const start = { type: "start", control: "first", expectedRevision: 0, view: BOARD_VIEW };
    const move = { type: "move", control: "first", sequence: 2, view: { x: 940, y: 450, zoom: 2 } };
    expect((await store.readBoardView(id)).control).toBeNull();
    await store.writeBoardView(id, start);
    await store.writeBoardView(id, move);
    expect(await store.writeBoardView(id, { ...move, sequence: 1, view: BOARD_VIEW })).toMatchObject(move.view);
    expect((await store.read(id)).revision).toBe(1);
    await command("archive", { archived: true });
    expect(await store.readBoardView(id)).toMatchObject({ ...move.view, control: null, revision: 3 });
    await expect(store.writeBoardView(id, move)).rejects.toMatchObject({ status: 409 });
    await command("archive", { archived: false });
    expect((await store.writeBoardView(id, start)).control).toBeNull();
  });
});
