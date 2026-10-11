import { statusBadgeClass } from "@/lib/status-colors";
import { cn } from "@/lib/utils";

export function StatusBadge({
  name,
  color,
  className,
}: {
  name: string;
  color: string | null | undefined;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        statusBadgeClass(color),
        className,
      )}
    >
      {name}
    </span>
  );
}
