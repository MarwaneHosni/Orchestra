import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  error?: string;
  description?: string;
  required?: boolean;
  children: (id: string, errorId: string, descriptionId: string) => ReactNode;
  className?: string;
}

export function FormField({ label, error, description, required, children, className }: FormFieldProps) {
  const generatedId = useId();
  const inputId = `field-${generatedId}`;
  const errorId = `error-${generatedId}`;
  const descriptionId = `desc-${generatedId}`;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={inputId} className="block text-sm font-medium text-text-primary">
        {label}
        {required && (
          <span className="ml-1 text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {description && (
        <p id={descriptionId} className="text-sm text-text-secondary">
          {description}
        </p>
      )}

      {children(inputId, errorId, descriptionId)}

      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
