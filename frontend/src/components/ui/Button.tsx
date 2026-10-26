import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "../../lib/cn.ts";

type Variant = "primary" | "secondary" | "ghost" | "text" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-ivory hover:bg-primary/90",
  secondary: "border border-border bg-card text-charcoal hover:bg-ivory",
  ghost: "border border-border bg-transparent text-charcoal hover:bg-card",
  text: "text-muted hover:text-charcoal",
  danger: "text-muted hover:text-risk-high",
};

const sizes: Record<Size, string> = {
  md: "h-10 px-4 text-sm font-medium",
  sm: "h-8 px-3 text-sm font-medium",
};

type Common = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-field outline-none transition-colors duration-200",
        "focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-60",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

type ButtonLinkProps = Common & { to: string };

export function ButtonLink({ variant = "primary", size = "md", className, to, children }: ButtonLinkProps) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-field outline-none transition-colors duration-200",
        "focus-visible:ring-2 focus-visible:ring-primary/30",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}
