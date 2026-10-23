import type { Tier } from "../lib/rules";

/** Чип тира: Т1, Т2, Т3. */
export function TierBadge({
  tier,
  size = "md",
  className = "",
}: {
  tier: Tier;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={`tier-chip tier-chip-${size} ${className}`.trim()}
      data-tier={tier}
      title={`Тир ${tier}`}
      aria-label={`Тир ${tier}`}
    >
      Т{tier}
    </span>
  );
}
