export const STATUS_COLORS = [
  "slate",
  "blue",
  "violet",
  "green",
  "amber",
  "orange",
  "red",
  "teal",
  "pink",
] as const;

export type StatusColor = (typeof STATUS_COLORS)[number];

// Classes completas (estáticas) para o Tailwind gerar o CSS.
const BADGE: Record<StatusColor, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  green: "bg-green-50 text-green-700 ring-green-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  orange: "bg-orange-50 text-orange-700 ring-orange-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  teal: "bg-teal-50 text-teal-700 ring-teal-200",
  pink: "bg-pink-50 text-pink-700 ring-pink-200",
};

const DOT: Record<StatusColor, string> = {
  slate: "bg-slate-400",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  green: "bg-green-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  teal: "bg-teal-500",
  pink: "bg-pink-500",
};

const BAR: Record<StatusColor, string> = {
  slate: "bg-slate-400",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  green: "bg-green-500",
  amber: "bg-amber-400",
  orange: "bg-orange-500",
  red: "bg-red-500",
  teal: "bg-teal-500",
  pink: "bg-pink-500",
};

function asColor(color: string | null | undefined): StatusColor {
  return (STATUS_COLORS as readonly string[]).includes(color ?? "") ? (color as StatusColor) : "slate";
}

export const statusBadgeClass = (color: string | null | undefined) => BADGE[asColor(color)];
export const statusDotClass = (color: string | null | undefined) => DOT[asColor(color)];
export const statusBarClass = (color: string | null | undefined) => BAR[asColor(color)];
