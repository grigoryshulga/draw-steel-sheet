import { useEffect, useState } from "react";
import type { PrintedAbility } from "../../rules/printed-ability";

type Cards = Readonly<Record<string, PrintedAbility>>;
let cached: Cards | undefined;
let pending: Promise<Cards> | undefined;

function loadCards() {
  pending ??= import("../../rules/consumer-printed-abilities")
    .then(({ printedAbilities }) => cached = printedAbilities)
    .finally(() => { pending = undefined; });
  return pending;
}

export function usePrintedAbility(id: string) {
  const [cards, setCards] = useState(cached);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (cards) return;
    let active = true;
    loadCards().then(
      result => { if (active) setCards(result); },
      () => { if (active) setError(true); },
    );
    return () => { active = false; };
  }, [attempt, cards]);
  return {
    card: cards?.[id],
    loading: !cards && !error,
    error,
    retry: () => { setError(false); setAttempt(value => value + 1); },
  };
}
