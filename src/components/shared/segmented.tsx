"use client";

import { cn } from "@/lib/utils";

/** Grupo de opções exclusivas com alvos de toque grandes (alternativa ao select). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  name,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  name: string;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            name={name}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-9 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors",
              active && "bg-background text-foreground shadow-xs",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
