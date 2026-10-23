import "./DrawSteelLogo.css";

export interface DrawSteelLogoProps {
  className?: string;
}

/** Official compatibility mark provided by MCDM for third-party products. */
export function DrawSteelLogo({ className }: DrawSteelLogoProps) {
  const classes = ["draw-steel-logo", className].filter(Boolean).join(" ");

  return (
    <img
      className={classes}
      src="/brand/powered-by-draw-steel.webp"
      alt="Powered by Draw Steel"
      width={1920}
      height={759}
    />
  );
}
