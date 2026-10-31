import type { ReactNode } from "react";
import { Icon, type IconName } from "../Icons";

/* ---------- Panel ---------- */

export interface PanelProps {
  title?: ReactNode;
  icon?: IconName;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  dense?: boolean;
}

export function Panel({
  title,
  icon,
  actions,
  children,
  className = "",
  bodyClassName = "",
  dense = false,
}: PanelProps) {
  return (
    <section
      className={`panel ${dense ? "panel-dense" : ""} ${className}`.trim()}
    >
      {(title || actions) && (
        <header className="panel-head">
          <div className="panel-heading">
            {title && (
              <h2 className="panel-title">
                {icon && <Icon name={icon} size={15} />}
                <span>{title}</span>
              </h2>
            )}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      <div className={`panel-body ${bodyClassName}`.trim()}>{children}</div>
    </section>
  );
}
