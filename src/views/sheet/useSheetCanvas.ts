import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent,
  type SetStateAction,
} from "react";
import {
  canvasSize,
  defaultPanelWidth,
  GRID_STEP,
  resolvedPanelHeight,
  positionPanels,
  updatePanelPlacement,
  type PanelHeights,
  type PanelId,
  type PanelPlacement,
  type SheetPanel,
} from "../../lib/sheet-layout";

type GestureMode = "move" | "resize-width" | "resize-height" | "resize-both";
interface Gesture {
  id: PanelId;
  mode: GestureMode;
  placement: PanelPlacement;
  height: number;
  clientX: number;
  clientY: number;
  pointerX: number;
  pointerY: number;
  scrollX: number;
  scrollY: number;
  canvasScrollX: number;
  pointerId: number;
  handle: HTMLElement;
}

function bringToFront(layout: SheetPanel[], id: PanelId): SheetPanel[] {
  // Keep DOM order stable: moving a captured element in the DOM loses pointer capture.
  const layer = Math.max(layout.length, ...layout.map((p) => p.layer ?? 0)) + 1;
  return layout.map((p) => (p.id === id ? { ...p, layer } : p));
}

/** Canvas coordinates are independent of viewport size; mobile reading never rewrites them. */
export function useSheetCanvas(
  layout: SheetPanel[],
  setLayout: Dispatch<SetStateAction<SheetPanel[]>>,
  editing: boolean,
) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRefs = useRef(new Map<PanelId, HTMLDivElement>());
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const [availableWidth, setAvailableWidth] = useState(0);
  const [heights, setHeights] = useState<PanelHeights>({});
  const [active, setActive] = useState<PanelId | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const animationRef = useRef<number | null>(null);
  const stacked = availableWidth > 0 && availableWidth < 700 && !editing;
  const visibleIds = layout
    .filter((p) => !p.hidden)
    .map((p) => p.id)
    .sort()
    .join(",");

  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const measure = () =>
      setAvailableWidth(
        Math.floor(element.clientWidth / GRID_STEP) * GRID_STEP,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const measure = () =>
      setHeights((previous) => {
        const next = { ...previous };
        let changed = false;
        for (const [id, element] of contentRefs.current) {
          const height = element.getBoundingClientRect().height;
          if (next[id] !== height) {
            next[id] = height;
            changed = true;
          }
        }
        return changed ? next : previous;
      });
    measure();
    const observer = new ResizeObserver(measure);
    for (const element of contentRefs.current.values())
      observer.observe(element);
    return () => observer.disconnect();
  }, [visibleIds]);

  useLayoutEffect(() => {
    if (
      !availableWidth ||
      stacked ||
      layout.every((p) => p.hidden || p.placement) ||
      layout.some((p) => !p.hidden && !contentRefs.current.has(p.id))
    )
      return;
    const measured = Object.fromEntries(
      [...contentRefs.current].map(([id, element]) => [
        id,
        element.getBoundingClientRect().height,
      ]),
    );
    setLayout((previous) => positionPanels(previous, availableWidth, measured));
  }, [availableWidth, heights, layout, setLayout, stacked]);

  function applyGesture(gesture: Gesture) {
    const dx =
      gesture.pointerX -
      gesture.clientX +
      window.scrollX -
      gesture.scrollX +
      (viewportRef.current?.scrollLeft ?? 0) -
      gesture.canvasScrollX;
    const dy =
      gesture.pointerY - gesture.clientY + window.scrollY - gesture.scrollY;
    const changes =
      gesture.mode === "move"
        ? { x: gesture.placement.x + dx, y: gesture.placement.y + dy }
        : {
            ...(gesture.mode !== "resize-height"
              ? { width: gesture.placement.width + dx }
              : {}),
            ...(gesture.mode !== "resize-width"
              ? { height: gesture.height + dy }
              : {}),
          };
    setLayout((previous) =>
      updatePanelPlacement(previous, gesture.id, changes),
    );
  }

  function stopGesture(revert = false) {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gestureRef.current = null;
    if (animationRef.current !== null)
      cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    if (revert)
      setLayout((previous) =>
        updatePanelPlacement(previous, gesture.id, {
          ...gesture.placement,
          height: gesture.placement.height,
        }),
      );
    if (gesture.handle.hasPointerCapture(gesture.pointerId))
      gesture.handle.releasePointerCapture(gesture.pointerId);
    setActive(null);
  }

  function autoScroll() {
    const gesture = gestureRef.current;
    if (!gesture) return;
    const beforeY = window.scrollY;
    const viewport = viewportRef.current;
    const beforeX = viewport?.scrollLeft;
    const edge = 50;
    if (gesture.pointerY > window.innerHeight - edge) window.scrollBy(0, 12);
    else if (gesture.pointerY < edge + 65) window.scrollBy(0, -12);
    if (viewport) {
      const bounds = viewport.getBoundingClientRect();
      if (gesture.pointerX > bounds.right - edge) viewport.scrollLeft += 12;
      else if (gesture.pointerX < bounds.left + edge) viewport.scrollLeft -= 12;
    }
    if (window.scrollY !== beforeY || viewport?.scrollLeft !== beforeX)
      applyGesture(gesture);
    animationRef.current = requestAnimationFrame(autoScroll);
  }

  useEffect(() => {
    if (!active) return;
    const cancel = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        stopGesture(true);
      }
    };
    const blur = () => stopGesture(true);
    window.addEventListener("keydown", cancel);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", cancel);
      window.removeEventListener("blur", blur);
    };
  }, [active]);
  useEffect(
    () => () => {
      if (animationRef.current !== null)
        cancelAnimationFrame(animationRef.current);
      gestureRef.current = null;
    },
    [],
  );

  function pointerDown(
    event: PointerEvent<HTMLElement>,
    id: PanelId,
    mode: GestureMode,
  ) {
    const panel = layoutRef.current.find((p) => p.id === id);
    if (
      !editing ||
      event.button !== 0 ||
      !panel?.placement ||
      gestureRef.current
    )
      return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = {
      id,
      mode,
      placement: { ...panel.placement },
      height: resolvedPanelHeight(panel, heights),
      clientX: event.clientX,
      clientY: event.clientY,
      pointerX: event.clientX,
      pointerY: event.clientY,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      canvasScrollX: viewportRef.current?.scrollLeft ?? 0,
      pointerId: event.pointerId,
      handle: event.currentTarget,
    };
    setLayout((previous) => bringToFront(previous, id));
    setActive(id);
    animationRef.current = requestAnimationFrame(autoScroll);
  }
  function pointerMove(event: PointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    gesture.pointerX = event.clientX;
    gesture.pointerY = event.clientY;
    applyGesture(gesture);
  }
  function pointerUp(event: PointerEvent<HTMLElement>) {
    if (event.pointerId !== gestureRef.current?.pointerId) return;
    pointerMove(event);
    stopGesture();
  }
  function keyDown(
    event: KeyboardEvent<HTMLElement>,
    id: PanelId,
    mode: GestureMode,
  ) {
    if (!editing || gestureRef.current) return;
    const panel = layoutRef.current.find((p) => p.id === id);
    const placement = panel?.placement;
    if (!panel || !placement) return;
    const amount = GRID_STEP * (event.shiftKey ? 10 : 1);
    const offsets: Record<string, [number, number]> = {
      ArrowLeft: [-amount, 0],
      ArrowRight: [amount, 0],
      ArrowUp: [0, -amount],
      ArrowDown: [0, amount],
    };
    const delta = offsets[event.key];
    if (
      !delta ||
      (mode === "resize-width" && !delta[0]) ||
      (mode === "resize-height" && !delta[1])
    )
      return;
    event.preventDefault();
    const changes =
      mode === "move"
        ? { x: placement.x + delta[0], y: placement.y + delta[1] }
        : {
            ...(mode !== "resize-height" && delta[0]
              ? { width: placement.width + delta[0] }
              : {}),
            ...(mode !== "resize-width" && delta[1]
              ? { height: resolvedPanelHeight(panel, heights) + delta[1] }
              : {}),
          };
    setLayout((previous) =>
      bringToFront(updatePanelPlacement(previous, id, changes), id),
    );
  }
  function handleProps(id: PanelId, mode: GestureMode) {
    return {
      onPointerDown: (event: PointerEvent<HTMLElement>) =>
        pointerDown(event, id, mode),
      onPointerMove: pointerMove,
      onPointerUp: pointerUp,
      onPointerCancel: () => stopGesture(true),
      onLostPointerCapture: () => stopGesture(),
      onKeyDown: (event: KeyboardEvent<HTMLElement>) =>
        keyDown(event, id, mode),
    };
  }
  const size = canvasSize(layout, heights, availableWidth);
  return {
    viewportRef,
    contentRefs,
    availableWidth,
    stacked,
    active,
    heights,
    size,
    handleProps,
    styleFor(panel: SheetPanel, index: number) {
      if (stacked) return undefined;
      return {
        left: panel.placement?.x ?? 0,
        top: panel.placement?.y ?? 0,
        width:
          panel.placement?.width ?? defaultPanelWidth(panel, availableWidth),
        height:
          heights[panel.id] === undefined
            ? undefined
            : resolvedPanelHeight(panel, heights),
        zIndex: panel.layer ?? index + 1,
        visibility: panel.placement ? undefined : ("hidden" as const),
      };
    },
  };
}
