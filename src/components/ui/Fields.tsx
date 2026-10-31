import { useEffect, useRef, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Icon } from "../Icons";
import { normalizeNumberInput, parseNumberInputDraft } from "../../lib/number-input";

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
  showButtons?: boolean;
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
  showButtons = true,
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
      className={`number-counter ${showButtons ? "" : "number-counter-plain"} ${className}`.trim()}
      role="group"
      aria-label={label}
    >
      {showButtons && (
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
      )}
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
      {showButtons && (
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
      )}
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
