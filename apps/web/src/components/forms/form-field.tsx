import { useId, type ReactNode } from "react";

interface FormFieldProps {
  label: string;
  description?: string;
  required?: boolean;
  error?: string;
  children: (id: string, errorId: string, descriptionId: string) => ReactNode;
}

export function FormField({ label, description, required, error, children }: FormFieldProps) {
  const id = useId();
  const errorId = useId();
  const descriptionId = useId();

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <label htmlFor={id} className="text-sm font-medium text-text-primary">
          {label}
        </label>
        {required && (
          <span className="text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </div>
      {description && (
        <p id={descriptionId} className="text-sm text-text-secondary">
          {description}
        </p>
      )}
      {children(id, errorId, descriptionId)}
      {error && (
        <p id={errorId} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
