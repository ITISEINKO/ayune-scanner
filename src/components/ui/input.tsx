import type { InputHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`min-h-12 w-full rounded-xl border border-input bg-card px-3 text-lg text-card-foreground outline-none placeholder:text-muted-foreground focus:border-ring ${className}`} {...props} />;
}
