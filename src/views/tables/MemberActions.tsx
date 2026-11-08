import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "../../components/ui";

/** Rare membership actions; ordinary viewing stays beside the trigger. */
export function MemberActions({ name, children }: { name: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); root.current?.querySelector("button")?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div className="table-member-menu" ref={root} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <Button icon="more" iconOnly size="sm" variant="ghost" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} aria-label={`Управление участником: ${name}`} title={`Управление участником: ${name}`}>Управление участником</Button>
    {open && <div id={id} className="table-member-menu-content" role="group" aria-label={`Управление участником: ${name}`} onClick={(event) => { if ((event.target as HTMLElement).closest("button:not(:disabled)")) setOpen(false); }}>{children}</div>}
  </div>;
}
