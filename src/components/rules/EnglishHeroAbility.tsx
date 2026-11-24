import { lazy, Suspense, type ReactNode } from "react";
import type { Ability } from "../../types";
import type { PrintedBlock } from "../../rules/printed-ability";
import { Button } from "../ui";
import { AbilityBody, type AbilitySheetView } from "./AbilitySheet";
import { printedAbilityView } from "./printedAbilityView";
import { usePrintedAbility } from "./usePrintedAbility";

const Remainder = lazy(() => import("./EnglishAbilityRemainder").then(module => ({ default: module.EnglishAbilityRemainder })));

function ExtraBlocks({ blocks }: { blocks: PrintedBlock[] }) {
  return blocks.length ? <Suspense fallback={null}><Remainder blocks={blocks} /></Suspense> : null;
}

export function EnglishHeroAbility({ original, base, full, showCalculations = false, children }: {
  original: Ability;
  base: AbilitySheetView;
  full: boolean;
  showCalculations?: boolean;
  children?: (view: AbilitySheetView) => ReactNode;
}) {
  const { card, loading, error, retry } = usePrintedAbility(original.id);
  if (loading) return <p role="status">Loading ability…</p>;
  if (error) return <p role="alert">
    Could not load ability. <Button size="sm" onClick={event => { event.stopPropagation(); retry(); }}>Retry</Button>
  </p>;
  if (!card) return <ExtraBlocks blocks={[{ text: original.originalDescription ?? "" }]} />;

  const view = printedAbilityView(base, card, base.cardModifiers, text => <ExtraBlocks blocks={[{ text }]} />);
  return <>
    {children ? children(view) : <>
      {full && view.flavor && <p className="sheet-ability-detail-flavor">{view.flavor}</p>}
      {view.trigger && <p className="sheet-ability-trigger-text"><strong>Trigger:</strong> {view.trigger}</p>}
      <AbilityBody view={view} full={full} showCalculations={showCalculations} language="en" />
    </>}
    <ExtraBlocks blocks={card.blocks} />
  </>;
}
