import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { Button } from "../../components/ui";

export function SceneEditorHeader({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  const anchor = useRef<HTMLElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>();
  useEffect(() => {
    const menu = document.querySelector(".floating-header");
    if (!menu) return;
    let frame = 0;
    const measure = () => {
      if (!anchor.current || !actions.current) return;
      const rect = menu.getBoundingClientRect();
      const width = actions.current.offsetWidth;
      setPosition(anchor.current.getBoundingClientRect().bottom < rect.bottom
        ? { position: "fixed", height: rect.height, top: rect.right + width + 16 <= window.innerWidth ? rect.top : rect.bottom + 12, left: Math.min(rect.right + 8, window.innerWidth - width - 8), zIndex: 46 }
        : undefined);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const resize = new ResizeObserver(schedule); resize.observe(menu);
    window.addEventListener("scroll", schedule, { passive: true }); window.addEventListener("resize", schedule); measure();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, []);
  return <header className="scene-editor-header" ref={anchor}>
    <div className="scene-editor-heading"><Button icon="arrow-left" iconOnly variant="ghost" onClick={onBack}>К списку сцен</Button><h2>Подготовка сцены</h2></div>
    <div className="scene-editor-actions-slot"><div ref={actions} className={`scene-actions scene-editor-action-pill${position ? " is-floating" : ""}`} style={position}>{children}</div></div>
  </header>;
}
