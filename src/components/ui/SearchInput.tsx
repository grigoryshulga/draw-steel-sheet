import { useEffect, useRef, type InputHTMLAttributes } from "react";
import { Icon } from "../Icons";
import "./SearchInput.css";

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  "aria-label": string;
  value: string;
  onValueChange: (value: string) => void;
  /** Only the main search on the current page claims the / shortcut. */
  shortcut?: boolean;
  onClear?: () => void;
  canClear?: boolean;
  clearLabel?: string;
}

export function SearchInput({
  value,
  onValueChange,
  shortcut = false,
  onClear,
  canClear = Boolean(value),
  clearLabel = "Очистить поиск",
  className = "",
  onKeyDown,
  ...props
}: SearchInputProps) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!shortcut) return;
    const focusSearch = (event: KeyboardEvent) => {
      if (
        event.key !== "/" || event.defaultPrevented || event.isComposing ||
        event.ctrlKey || event.metaKey || event.altKey
      ) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [role='textbox']"))) return;
      if (
        document.querySelector('[aria-modal="true"], dialog[open]') ||
        !input.current?.getClientRects().length || input.current.disabled
      ) return;
      event.preventDefault();
      input.current.focus();
    };
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, [shortcut]);

  const clear = () => {
    if (onClear) onClear();
    else onValueChange("");
    input.current?.focus();
  };

  return (
    <div className="search-field">
      <Icon name="search" className="search-field-icon" size={17} aria-hidden="true" />
      <input
        {...props}
        ref={input}
        type="search"
        className={`input search-field-input ${className}`.trim()}
        value={value}
        aria-keyshortcuts={shortcut ? "/" : undefined}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented && !event.nativeEvent.isComposing && event.key === "Escape" && canClear) {
            event.preventDefault();
            event.stopPropagation();
            clear();
          }
        }}
      />
      {canClear ? (
        <button
          type="button"
          className="search-field-clear"
          aria-label={clearLabel}
          title={clearLabel}
          disabled={props.disabled}
          onClick={clear}
        >
          <Icon name="close" size={16} aria-hidden="true" />
        </button>
      ) : shortcut ? (
        <kbd className="search-field-shortcut" aria-hidden="true" title="Нажмите /, чтобы начать поиск">/</kbd>
      ) : null}
    </div>
  );
}
