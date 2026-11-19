const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
export const assetId = value => typeof value === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const within = (value, low, high) => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
const label = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const valid = condition => { if (!condition) throw Object.assign(new Error('Некорректные данные полотна'), { status: 400 }); };
const integer = (value, low, high) => Number.isInteger(value) && within(value, low, high);
export const emptyBoard = () => ({
  background: null, grid: { enabled: false, size: 80, x: 0, y: 0 },
  materials: [], counters: [], pins: [],
});
const defaultView = () => ({ x: 800, y: 450, zoom: 1, revision: 0, control: null, sequence: 0 });
export const boardCommands = new Set([
  'board-grid', 'board-background', 'board-show', 'board-move', 'board-remove',
  'board-add-counter', 'board-pin-counter', 'board-unpin-counter', 'board-step-counter', 'board-place-counter',
  'board-draw', 'board-undo-stroke',
]);

function validateStroke(stroke) {
  valid(stroke && id(stroke.id) && typeof stroke.color === 'string' && /^#[a-f0-9]{6}$/i.test(stroke.color) &&
    integer(stroke.thickness, 1, 32) && Array.isArray(stroke.points) && stroke.points.length > 0 &&
    stroke.points.length <= 384 && stroke.points.every(point => Array.isArray(point) && point.length === 2 &&
      integer(point[0], 0, 1600) && integer(point[1], 0, 900)));
  return { id: stroke.id, color: stroke.color, thickness: stroke.thickness, points: stroke.points };
}

function validateStrokes(strokes) {
  valid(Array.isArray(strokes) && strokes.length <= 128);
  const normalized = strokes.map(validateStroke);
  valid(new Set(normalized.map(stroke => stroke.id)).size === normalized.length);
  return normalized;
}

function sceneCounter(table, sceneId, counterId) {
  const scene = table.scenes.find(s => s.id === sceneId && s.published && s.status !== 'prepared');
  return scene?.counters.find(c => c.id === counterId && c.public);
}
export function hidesSceneCounterLimit(scene, counter) {
  return scene?.challenge?.kind === 'montage' && scene.challenge.hideLimits &&
    (['successes', 'failures'].includes(counter.id) || ['успехи', 'провалы'].includes(counter.name.trim().toLowerCase()));
}
const counterProjection = (counter, sceneId) => ({
  id: counter.id, name: counter.name, value: counter.value,
  ...(counter.max === undefined ? {} : { max: counter.max }),
  ...(sceneId ? { sceneId } : {}),
  ...(counter.placement ? { placement: counter.placement } : {}),
});
function itemSettings(value) {
  valid(value && within(value.width, 160, 1600) && within(value.height, 88, 900) &&
    typeof value.snap === 'boolean' && (value.locked === undefined || typeof value.locked === 'boolean'));
  return { width: value.width, height: value.height, snap: value.snap, ...(value.locked ? { locked: true } : {}) };
}
function checkLocked(previous, next) {
  if (previous?.locked) valid(next.x === previous.x && next.y === previous.y && next.width === previous.width &&
    next.height === previous.height && next.snap === previous.snap);
}
function counterPlacement(value, previous) {
  valid(value && within(value.x, 0, 1600) && within(value.y, 0, 900));
  const next = { x: value.x, y: value.y, ...itemSettings(value) };
  checkLocked(previous, next);
  return next;
}
export function projectBoard(table, director) {
  const { background, grid, materials, counters, pins, sceneId, strokes } = table.board ?? emptyBoard();
  return structuredClone({
    background, grid, materials,
    ...(strokes?.length ? { strokes } : {}),
    ...(sceneId ? { sceneId } : {}),
    counters: [
      ...counters.filter(c => c.pinned).map(c => counterProjection(c)),
      ...pins.flatMap(({ sceneId, id, placement }) => {
        const counter = sceneCounter(table, sceneId, id);
        if (!counter) return [];
        const scene = table.scenes.find(s => s.id === sceneId);
        const max = !director && hidesSceneCounterLimit(scene, counter) ? undefined : counter.max;
        return [counterProjection({ ...counter, max, placement }, sceneId)];
      }),
    ],
    ...(director ? { availableCounters: counters.filter(c => !c.pinned).map(c => counterProjection(c)) } : {}),
  });
}
export function pruneBoardPins(table) {
  if (table.board) table.board.pins = table.board.pins.filter(pin => sceneCounter(table, pin.sceneId, pin.id));
}
export function boardReferencesAsset(board, key) {
  return board?.background === key || board?.materials.some(material => material.assetId === key);
}

export async function validateSceneLayout(tableId, layout, hasAsset) {
  valid(layout && layout.tableId === tableId && Array.isArray(layout.materials) && layout.materials.length <= 32);
  const table = {};
  await applyBoardCommand(table, 'board-grid', layout.grid ?? {}, hasAsset);
  await applyBoardCommand(table, 'board-background', { assetId: layout.background }, hasAsset);
  for (const material of layout.materials) await applyBoardCommand(table, 'board-show', material ?? {}, hasAsset);
  const { background, grid, materials } = table.board;
  return { tableId, background, grid, materials, ...(layout.strokes === undefined ? {} : { strokes: validateStrokes(layout.strokes) }) };
}

export function installSceneLayout(table, scene = null) {
  const board = table.board ??= emptyBoard();
  if (board.sceneId === scene?.id) return;
  if (!board.sceneId) {
    const { background, grid, materials, strokes } = board;
    board.mainLayout = structuredClone({ background, grid, materials, ...(strokes?.length ? { strokes } : {}) });
  }
  const { background, grid, materials, strokes } = (scene ? scene.layout : board.mainLayout) ?? emptyBoard();
  Object.assign(board, structuredClone({ background, grid, materials }));
  if (strokes?.length) board.strokes = structuredClone(strokes);
  else delete board.strokes;
  if (scene) board.sceneId = scene.id;
  else {
    delete board.sceneId;
    delete board.mainLayout;
  }
}

export function discardHiddenSceneLayout(table) {
  const board = table.board;
  if (!board?.sceneId || table.scenes.some(scene => scene.id === board.sceneId && scene.published && scene.status !== 'prepared')) return;
  installSceneLayout(table);
}

export async function applyBoardCommand(table, type, p, hasAsset) {
  const board = table.board ??= emptyBoard();
  const validPoint = () => valid(within(p.x, 0, 1600) && within(p.y, 0, 900));
  const target = board.materials.find(material => material.id === p.id);
  switch (type) {
    case 'board-draw': {
      valid(p.sceneId === (board.sceneId ?? null));
      const stroke = validateStroke(p.stroke);
      const strokes = board.strokes ??= [];
      valid(strokes.length < 128 && !strokes.some(mark => mark.id === stroke.id));
      strokes.push(stroke);
      break;
    }
    case 'board-undo-stroke':
      valid(p.sceneId === (board.sceneId ?? null) && id(p.id) && board.strokes?.at(-1)?.id === p.id);
      board.strokes.pop();
      break;
    case 'board-grid':
      valid(typeof p.enabled === 'boolean' && integer(p.size, 8, 400) &&
        integer(p.x, -1600, 1600) && integer(p.y, -900, 900) &&
        (p.color === undefined || typeof p.color === 'string' && /^#[a-f0-9]{6}$/i.test(p.color)) &&
        (p.opacity === undefined || integer(p.opacity, 0, 100)) &&
        (p.thickness === undefined || integer(p.thickness, 1, 8)));
      board.grid = {
        enabled: p.enabled, size: p.size, x: p.x, y: p.y,
        ...(p.color !== undefined ? { color: p.color } : {}),
        ...(p.opacity !== undefined ? { opacity: p.opacity } : {}),
        ...(p.thickness !== undefined ? { thickness: p.thickness } : {}),
      };
      break;
    case 'board-background':
      valid(p.assetId === null || assetId(p.assetId) && await hasAsset(p.assetId));
      board.background = p.assetId;
      break;
    case 'board-show': {
      valid(id(p.id) && !target && board.materials.length < 32 && label(p.title, 200));
      validPoint();
      const placement = { id: p.id, title: p.title.trim(), x: p.x, y: p.y,
        ...(p.settings === undefined ? {} : { settings: itemSettings(p.settings) }) };
      if (p.kind === 'image') {
        valid(assetId(p.assetId) && await hasAsset(p.assetId));
        board.materials.push({ ...placement, kind: 'image', assetId: p.assetId });
      } else if (p.kind === 'counter') {
        valid(integer(p.value, 0, 1000000000) && (p.max === undefined || integer(p.max, p.value, 1000000000)));
        board.materials.push({ ...placement, kind: 'counter', value: p.value, ...(p.max === undefined ? {} : { max: p.max }) });
      } else {
        valid(p.kind === 'text' && label(p.text, 50000));
        valid(p.markdown === undefined || typeof p.markdown === 'boolean');
        board.materials.push({ ...placement, kind: 'text', text: p.text, ...(p.markdown ? { markdown: true } : {}) });
      }
      break;
    }
    case 'board-move':
      valid(target);
      validPoint();
      {
        const settings = p.settings === undefined ? target.settings : itemSettings(p.settings);
        checkLocked({ ...target.settings, x: target.x, y: target.y }, { ...settings, x: p.x, y: p.y });
        Object.assign(target, { x: p.x, y: p.y, ...(settings ? { settings } : {}) });
      }
      break;
    case 'board-remove':
      valid(target);
      board.materials = board.materials.filter(material => material !== target);
      break;
    case 'board-add-counter':
      valid(id(p.id) && !board.counters.some(c => c.id === p.id) &&
        label(p.name, 200) && integer(p.value, 0, 1000000000) &&
        (p.max === undefined || integer(p.max, p.value, 1000000000)));
      board.counters.push({ ...counterProjection({ id: p.id, name: p.name.trim(), value: p.value, max: p.max }), pinned: true });
      break;
    case 'board-pin-counter': {
      valid(id(p.id));
      if (p.sceneId === undefined) {
        const counter = board.counters.find(c => c.id === p.id);
        valid(counter);
        if (p.placement !== undefined && !counter.placement?.locked) counter.placement = counterPlacement(p.placement);
        counter.pinned = true;
      } else {
        valid(id(p.sceneId) && sceneCounter(table, p.sceneId, p.id) &&
          !board.pins.some(pin => pin.sceneId === p.sceneId && pin.id === p.id));
        board.pins.push({ sceneId: p.sceneId, id: p.id, ...(p.placement === undefined ? {} : { placement: counterPlacement(p.placement) }) });
      }
      break;
    }
    case 'board-place-counter': {
      valid(id(p.id) && (p.sceneId === undefined || id(p.sceneId)));
      const counter = p.sceneId === undefined ? board.counters.find(c => c.id === p.id && c.pinned) :
        board.pins.find(pin => pin.sceneId === p.sceneId && pin.id === p.id);
      valid(counter);
      counter.placement = counterPlacement(p.placement, counter.placement);
      break;
    }
    case 'board-unpin-counter':
      valid(id(p.id) && (p.sceneId === undefined || id(p.sceneId)));
      if (p.sceneId) board.pins = board.pins.filter(pin => pin.sceneId !== p.sceneId || pin.id !== p.id);
      else {
        const counter = board.counters.find(c => c.id === p.id);
        valid(counter);
        counter.pinned = false;
      }
      break;
    case 'board-step-counter': {
      valid(id(p.id) && (p.delta === 1 || p.delta === -1));
      const pinned = board.pins.some(pin => pin.sceneId === p.sceneId && pin.id === p.id);
      const counter = p.sceneId === undefined ? (target?.kind === 'counter' ? target : board.counters.find(c => c.id === p.id)) :
        pinned && sceneCounter(table, p.sceneId, p.id);
      valid(counter);
      counter.value = Math.max(0, Math.min(counter.max ?? 1000000000, counter.value + p.delta));
      break;
    }
  }
}

export function projectBoardView(table) {
  const { sequence, ...view } = table.boardView ?? defaultView();
  return view;
}
export function stopBoardView(table) {
  if (table.boardView?.control) Object.assign(table.boardView, { control: null, sequence: 0, revision: table.boardView.revision + 1 });
}
export function applyBoardView(table, command) {
  const previous = table.boardView ?? defaultView();
  const { type, view, control, sequence } = command ?? {};
  valid(id(control) && view && within(view.zoom, 1, 4) && within(view.x, 0, 1600) && within(view.y, 0, 900));
  valid(['start', 'move', 'stop'].includes(type));
  if (type === 'start') {
    valid(integer(command.expectedRevision, 0, Number.MAX_SAFE_INTEGER));
    if (command.expectedRevision !== previous.revision || previous.control === control) return false;
  }
  if (type === 'move') valid(integer(sequence, 1, 1000000000));
  if (type !== 'start' && previous.control !== control) return false;
  if (type === 'move' && sequence <= previous.sequence) return false;
  const halfWidth = 800 / view.zoom, halfHeight = 450 / view.zoom;
  table.boardView = {
    x: Math.max(halfWidth, Math.min(1600 - halfWidth, view.x)),
    y: Math.max(halfHeight, Math.min(900 - halfHeight, view.y)),
    zoom: view.zoom, revision: previous.revision + 1,
    control: type === 'stop' ? null : control, sequence: type === 'move' ? sequence : 0,
  };
  return true;
}

export function validBoardWebp(bytes) {
  if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'RIFF' ||
      bytes.toString('ascii', 8, 12) !== 'WEBP' || bytes.readUInt32LE(4) !== bytes.length - 8) return false;
  let image = false;
  const dimensions = (width, height) => within(width, 1, 3840) && within(height, 1, 3840);
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) return false;
    const kind = bytes.toString('ascii', offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    offset = start + length + length % 2;
    if (offset > bytes.length || !length) return false;
    if (kind === 'ANIM' || kind === 'ANMF') return false;
    if (kind === 'VP8X' && (length !== 10 ||
        !dimensions(bytes.readUIntLE(start + 4, 3) + 1, bytes.readUIntLE(start + 7, 3) + 1))) return false;
    if (kind === 'VP8 ') {
      if (image || length < 10 || bytes[start] & 1 ||
          bytes.readUIntBE(start + 3, 3) !== 0x9d012a ||
          !dimensions(bytes.readUInt16LE(start + 6) & 0x3fff, bytes.readUInt16LE(start + 8) & 0x3fff)) return false;
      image = true;
    }
    if (kind === 'VP8L') {
      if (image || length < 5 || bytes[start] !== 0x2f) return false;
      const bits = bytes.readUInt32LE(start + 1);
      if (bits >>> 29 || !dimensions((bits & 0x3fff) + 1, (bits >>> 14 & 0x3fff) + 1)) return false;
      image = true;
    }
  }
  return image;
}
