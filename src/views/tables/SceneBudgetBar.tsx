import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

export function SceneBudgetBar({ cost, standardMax, hardMax, floatingEnabled = true }: { cost: number; standardMax: number; hardMax: number; floatingEnabled?: boolean }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [floating, setFloating] = useState<{ top: number; left: number; width: number } | null>(null);
  useEffect(() => {
    if (!floatingEnabled) return;
    const header = document.querySelector(".floating-header");
    const target = anchor.current;
    if (!header || !target) return;
    let frame = 0;
    const measure = () => {
      const rect = header.getBoundingClientRect();
      setFloating(target.getBoundingClientRect().bottom < rect.bottom + 8
        ? { top: rect.bottom + 8, left: rect.left + 16, width: Math.max(0, rect.width - 32) }
        : null);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const resize = new ResizeObserver(schedule);
    resize.observe(header);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    measure();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, [floatingEnabled]);
  const label = `Потрачено: ${cost} БЦ. ${cost > hardMax ? `Лимит превышен на ${cost - hardMax} БЦ` : standardMax >= cost ? `Осталось до стандартного боя: ${standardMax - cost} БЦ` : `Выше стандартного бюджета на ${cost - standardMax} БЦ`}`;
  const limit = Math.max(1, hardMax);
  const boundary = Math.min(100, standardMax / limit * 100);
  const fill = Math.min(100, Math.max(0, cost / limit * 100));
  const over = cost > hardMax;
  const meter = <div className={`scene-budget-track${over ? " is-over" : ""}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(cost, limit)} aria-valuetext={`${cost} БЦ из ${hardMax}. ${over ? `Лимит превышен на ${cost - hardMax} БЦ` : cost > standardMax ? "Трудный бой" : "Стандартный бой"}`} style={{ "--budget-boundary": `${boundary}%`, "--budget-fill": `${fill}%` } as CSSProperties}>
    <span className="scene-budget-track-fill" /><span className="scene-budget-track-divider" />
  </div>;
  return <>
    <div ref={anchor} className="scene-budget-spending">
      <div><strong>Потрачено: {cost} БЦ</strong><span>{standardMax >= cost ? `Осталось до стандартного боя: ${standardMax - cost} БЦ` : `Выше стандартного бюджета на ${cost - standardMax} БЦ`}</span></div>
      {meter}
    </div>
    {floating && createPortal(<div className="scene-budget-mini" style={floating} title={label}>{meter}</div>, document.body)}
  </>;
}
