import { useId, useState, type ReactNode } from 'react';
import { Icon } from '../Icons';
import './AbilityGroup.css';

/** Shared disclosure and responsive card grid for hero and creature actions. */
export function AbilityGroup({
  action, label, count, children, collapsed: controlledCollapsed, onToggle,
  compact = false, headerActions,
}: {
  action: string;
  label: string;
  count: number;
  children: ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
  compact?: boolean;
  headerActions?: ReactNode;
}) {
  const id = useId();
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? localCollapsed;
  return <section className={`sheet-ability-section${collapsed ? ' is-collapsed' : ''}${compact ? ' is-compact' : ''}`}
    data-action={action} aria-labelledby={`${id}-label`}>
    <header className="sheet-ability-section-head">
      <h3 id={`${id}-label`}>
        <button type="button" className="sheet-ability-section-toggle" aria-expanded={!collapsed}
          aria-controls={`${id}-cards`} onClick={onToggle ?? (() => setLocalCollapsed(value => !value))}>
          <Icon name="chevron-down" size={14} />
          <span className="sheet-ability-section-label">{label}</span>
          <span className="sheet-ability-count mono">{count}</span>
        </button>
      </h3>
      <span className="sheet-ability-rule" />
      {headerActions}
    </header>
    <div id={`${id}-cards`} hidden={collapsed}>
      {!collapsed && <div className="sheet-ability-grid">{children}</div>}
    </div>
  </section>;
}
