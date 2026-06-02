import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
}

const variantStyles: Record<Variant, string> = {
  primary: "bg-accent-purple text-white border border-accent-purple hover:opacity-88 active:scale-[0.98] focus-visible:ring-accent-purple",
  ghost: "bg-transparent border border-border-default text-text-primary hover:border-border-strong hover:bg-bg-hover focus-visible:ring-accent-gray",
  danger: "bg-transparent border border-accent-red text-accent-red hover:bg-accent-red-dim focus-visible:ring-accent-red",
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-[18px] py-2 text-[13px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-[color,background-color,border-color,opacity,transform] duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base",
          "disabled:pointer-events-none disabled:opacity-50",
          "border",
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        style={{ borderRadius: 3 }}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
