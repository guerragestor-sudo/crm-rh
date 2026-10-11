import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "danger" | "warning" | "success";
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
        {Icon ? (
          <Icon
            className={cn(
              "size-4 shrink-0 text-muted-foreground",
              tone === "danger" && "text-red-600",
              tone === "warning" && "text-amber-600",
              tone === "success" && "text-green-600",
            )}
            aria-hidden
          />
        ) : null}
      </div>
      <p
        data-stat-value
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl",
          tone === "danger" && "text-red-600",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );

  const className = cn(
    "block rounded-xl border bg-card p-4 shadow-xs",
    tone === "danger" && "border-red-200 bg-red-50/40",
    href && "transition-colors hover:border-primary/40 hover:bg-primary/[0.02]",
  );

  return href ? (
    <Link href={href} className={className} data-stat={label}>
      {content}
    </Link>
  ) : (
    <div className={className} data-stat={label}>
      {content}
    </div>
  );
}
