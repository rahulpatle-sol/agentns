import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

type FieldProps = {
  label: string;
  /** Shows an asterisk and marks the control required for assistive tech. */
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: (props: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => ReactNode;
};

/**
 * Wraps a control with its label, hint and error message, and wires up the
 * `aria-describedby` / `aria-invalid` relationships. The render-prop form keeps
 * a single generated id flowing to the label, the hint, the error and the
 * control, so screen readers always announce the right thing.
 */
export function Field({
  label,
  required = false,
  hint,
  error,
  children,
}: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const invalid = Boolean(error);

  const describedBy =
    [hint ? hintId : null, invalid ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required ? (
          <span className="field__required" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children({ id, describedBy, invalid })}
      {hint ? (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {invalid ? (
        <span className="field__error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  /** Renders a unit hint pinned to the right edge, e.g. "SOL". */
  suffix?: string;
};

export function Input({ id, className, suffix, ...rest }: InputProps) {
  const input = (
    <input
      id={id}
      className={["input", className ?? ""].filter(Boolean).join(" ")}
      {...rest}
    />
  );

  if (!suffix) return input;
  return (
    <div className="input-wrap">
      {input}
      <span className="input-wrap__suffix" aria-hidden="true">
        {suffix}
      </span>
    </div>
  );
}

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  id: string;
};

export function Textarea({ id, className, ...rest }: TextareaProps) {
  return (
    <textarea
      id={id}
      className={["input", className ?? ""].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}

type SelectOption = { value: string; label: string; disabled?: boolean };

type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "id" | "children"
> & {
  id: string;
  options: SelectOption[];
};

export function Select({ id, options, className, ...rest }: SelectProps) {
  return (
    <select
      id={id}
      className={["input", "select", className ?? ""].filter(Boolean).join(" ")}
      {...rest}
    >
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          disabled={option.disabled}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}
