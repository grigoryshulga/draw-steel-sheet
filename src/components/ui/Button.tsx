import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "../Icons";

/* ---------- Buttons ---------- */

type ButtonVariant = "default" | "primary" | "ghost" | "danger" | "soft";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconOnly?: boolean;
}

export function Button({
  variant = "default",
  size = "md",
  icon,
  iconOnly = false,
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size} ${iconOnly ? "btn-icon" : ""} ${className}`.trim()}
      {...props}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 17} />}
      {!iconOnly && children}
    </button>
  );
}
