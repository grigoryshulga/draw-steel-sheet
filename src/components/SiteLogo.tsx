import "./SiteLogo.css";

export interface SiteLogoProps {
  variant?: "mark" | "wordmark";
  className?: string;
}

/** The site's own identity, independent of the Draw Steel compatibility mark. */
export function SiteLogo({ variant = "mark", className }: SiteLogoProps) {
  const classes = ["site-logo", `site-logo--${variant}`, className]
    .filter(Boolean)
    .join(" ");
  const href =
    variant === "wordmark"
      ? "/brand/dostat-listy-wordmark.svg#wordmark"
      : "/brand/dostat-listy-mark.svg#mark";
  const viewBox = variant === "wordmark" ? "140 50 1550 810" : "140 50 860 810";

  return (
    <svg
      className={classes}
      viewBox={viewBox}
      role="img"
      aria-label="Достать листы!"
      focusable="false"
    >
      <use href={href} />
    </svg>
  );
}
