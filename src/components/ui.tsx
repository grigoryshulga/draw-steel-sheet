import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Icon, type IconName } from "./Icons";
import { createPortal } from "react-dom";
import {
  normalizeNumberInput,
  parseNumberInputDraft,
} from "../lib/number-input";

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

/* ---------- Fields ---------- */

export interface FieldProps {
  label?: ReactNode;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}

export function Field({
  label,
  children,
  className = "",
  htmlFor,
}: FieldProps) {
  return (
    <label className={`field ${className}`.trim()} htmlFor={htmlFor}>
      {label && <span className="field-label">{label}</span>}
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`input ${className}`.trim()} {...rest} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea className={`textarea ${className}`.trim()} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", children, ...rest } = props;
  return (
    <select className={`select ${className}`.trim()} {...rest}>
      {children}
    </select>
  );
}

export interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  className?: string;
  placeholder?: string;
  onBlur?: () => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  /** Вызывается после шага кнопкой −/+ (например, для commit по месту). */
  onCommit?: (value: number) => void;
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  className = "",
  placeholder,
  onBlur,
  onKeyDown,
  onCommit,
}: NumberInputProps) {
  const [draft, setDraft] = useState(() =>
    Number.isFinite(value) ? String(value) : "",
  );
  const lastValue = useRef(value);
  const lastEmitted = useRef<number | null>(null);

  useEffect(() => {
    if (Object.is(value, lastValue.current)) return;
    lastValue.current = value;
    if (!Object.is(value, lastEmitted.current)) {
      setDraft(Number.isFinite(value) ? String(value) : "");
    }
    if (Object.is(value, lastEmitted.current)) lastEmitted.current = null;
  }, [value]);

  const emit = (next: number) => {
    lastEmitted.current = next;
    onChange(next);
  };

  const commit = () => {
    const normalized = normalizeNumberInput(
      parseNumberInputDraft(draft),
      value,
      min,
      max,
    );
    setDraft(String(normalized));
    emit(normalized);
    onBlur?.();
  };

  return (
    <div
      className={`number-counter ${className}`.trim()}
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        className="number-counter-btn"
        aria-label={`${label ?? "Значение"}: уменьшить`}
        onClick={() => {
          const next = normalizeNumberInput(value - step, value, min, max);
          setDraft(String(next));
          emit(next);
          onCommit?.(next);
        }}
        disabled={min !== undefined && value <= min}
      >
        <Icon name="minus" size={12} />
      </button>
      <input
        type="text"
        inputMode="decimal"
        className="number-counter-value numeric"
        value={draft}
        aria-label={label}
        placeholder={placeholder}
        onBlur={commit}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented && event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        onChange={(event) => {
          const nextDraft = event.target.value;
          if (!/^-?(?:\d*\.?\d*)?$/.test(nextDraft)) return;
          setDraft(nextDraft);
          const next = parseNumberInputDraft(nextDraft);
          if (next !== null) emit(normalizeNumberInput(next, value, min, max));
        }}
      />
      <button
        type="button"
        className="number-counter-btn"
        aria-label={`${label ?? "Значение"}: увеличить`}
        onClick={() => {
          const next = normalizeNumberInput(value + step, value, min, max);
          setDraft(String(next));
          emit(next);
          onCommit?.(next);
        }}
        disabled={max !== undefined && value >= max}
      >
        <Icon name="plus" size={12} />
      </button>
    </div>
  );
}

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  className?: string;
  format?: (value: number) => string;
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  label,
  className = "",
  format,
}: StepperProps) {
  const clamp = (next: number) => {
    let result = next;
    if (min !== undefined) result = Math.max(min, result);
    if (max !== undefined) result = Math.min(max, result);
    return result;
  };
  return (
    <div
      className={`stepper ${className}`.trim()}
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        className="stepper-btn"
        aria-label={`${label ?? "Значение"}: уменьшить`}
        onClick={() => onChange(clamp(value - step))}
        disabled={min !== undefined && value <= min}
      >
        <Icon name="minus" size={14} />
      </button>
      <output className="stepper-value numeric">
        {format ? format(value) : value}
      </output>
      <button
        type="button"
        className="stepper-btn"
        aria-label={`${label ?? "Значение"}: увеличить`}
        onClick={() => onChange(clamp(value + step))}
        disabled={max !== undefined && value >= max}
      >
        <Icon name="plus" size={14} />
      </button>
    </div>
  );
}

/* ---------- Chips / tags ---------- */

export interface ChipProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  tone?: "default" | "accent" | "red" | "green" | "yellow" | "blue" | "magenta";
  title?: string;
  className?: string;
}

export function Chip({
  active = false,
  onClick,
  children,
  tone = "default",
  title,
  className = "",
}: ChipProps) {
  if (!onClick) {
    return (
      <span
        className={`chip chip-static chip-${tone} ${className}`.trim()}
        title={title}
      >
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`chip chip-${tone} ${active ? "is-active" : ""} ${className}`.trim()}
      onClick={onClick}
      title={title}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

/* ---------- Modal ---------- */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Кнопки в шапке слева от крестика. */
  headerActions?: ReactNode;
  wide?: boolean;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  headerActions,
  wide = false,
  className = "",
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusable = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
    if (!dialogRef.current?.contains(document.activeElement))
      focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (
        Array.from(document.querySelectorAll('[role="dialog"]')).at(-1) !==
        dialogRef.current
      )
        return;
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !dialogRef.current?.contains(document.activeElement))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className={`modal ${wide ? "modal-wide" : ""} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <div className="modal-head-actions">
            {headerActions}
            <Button
              variant="ghost"
              icon="close"
              iconOnly
              aria-label="Закрыть"
              onClick={onClose}
            />
          </div>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Misc ---------- */

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? "is-on" : ""}`.trim()}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-thumb" />
    </button>
  );
}

export function EmptyState({
  icon = "book",
  title,
  text,
  action,
}: {
  icon?: IconName;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={28} />
      </span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}
