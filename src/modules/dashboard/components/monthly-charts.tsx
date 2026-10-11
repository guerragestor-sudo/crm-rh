"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import type { MonthPoint } from "../types";

// Paleta categórica validada (slots 1 e 2): azul e laranja.
const SERIES_1 = "#2a78d6";
const SERIES_2 = "#eb6834";

function monthLabel(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Date(year, value - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

function monthLong(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Date(year, value - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

const volumeConfig = {
  new: { label: "Novos candidatos", color: SERIES_1 },
  integrations: { label: "Integrações", color: SERIES_2 },
} satisfies ChartConfig;

/** Novos x integrações por mês (mesma unidade: contagem, um único eixo). */
export function MonthlyVolumeChart({ data }: { data: MonthPoint[] }) {
  return (
    <ChartContainer config={volumeConfig} className="aspect-auto h-64 w-full">
      <BarChart data={data} margin={{ left: -16, right: 8, top: 8 }} barGap={2}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickFormatter={monthLabel} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
        <ChartTooltip
          cursor={{ fillOpacity: 0.4 }}
          content={<ChartTooltipContent labelFormatter={(value) => monthLong(String(value))} />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="new" fill="var(--color-new)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar dataKey="integrations" fill="var(--color-integrations)" radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ChartContainer>
  );
}

const slaConfig = {
  sla_avg: { label: "SLA médio (dias)", color: SERIES_1 },
  sla_median: { label: "SLA mediano (dias)", color: SERIES_2 },
} satisfies ChartConfig;

/** SLA médio e mediano das integrações de cada mês. Meses sem integração ficam em branco. */
export function SlaTrendChart({ data }: { data: MonthPoint[] }) {
  const hasData = data.some((point) => point.sla_avg !== null);
  if (!hasData) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Sem integrações no período.</p>;
  }
  return (
    <ChartContainer config={slaConfig} className="aspect-auto h-64 w-full">
      <LineChart data={data} margin={{ left: -16, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickFormatter={monthLabel} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => monthLong(String(value))} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          dataKey="sla_avg"
          stroke="var(--color-sla_avg)"
          strokeWidth={2}
          dot={{ r: 4, strokeWidth: 2, fill: "var(--color-sla_avg)", stroke: "var(--background)" }}
          activeDot={{ r: 5 }}
          connectNulls={false}
          type="monotone"
        />
        <Line
          dataKey="sla_median"
          stroke="var(--color-sla_median)"
          strokeWidth={2}
          strokeDasharray="5 3"
          dot={{ r: 4, strokeWidth: 2, fill: "var(--color-sla_median)", stroke: "var(--background)" }}
          activeDot={{ r: 5 }}
          connectNulls={false}
          type="monotone"
        />
      </LineChart>
    </ChartContainer>
  );
}
