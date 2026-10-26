import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatDays } from "@/lib/format";
import type { FilterLine } from "@/modules/candidates/filter-description";
import type { CountItem, DashboardSummary, MonthPoint, StatusCountItem } from "@/modules/dashboard/types";

/**
 * Relatório em PDF (gerado no navegador). Só dados agregados do painel de
 * Relatórios: contagens e SLA, nunca dados pessoais de candidatos.
 * Gráficos desenhados com Views (barras com ponta arredondada e base reta).
 */

const C = {
  brand: "#1d4ed8", // --primary do app
  ink: "#0f172a",
  text: "#334155",
  muted: "#64748b",
  line: "#e2e8f0",
  tile: "#f8fafc",
  series1: "#2a78d6", // mesma paleta validada dos gráficos do app
  series2: "#eb6834",
};

// Mesmas cores das barras de status no app (Tailwind).
const STATUS_HEX: Record<string, string> = {
  slate: "#94a3b8",
  blue: "#3b82f6",
  violet: "#8b5cf6",
  green: "#22c55e",
  amber: "#fbbf24",
  orange: "#f97316",
  red: "#ef4444",
  teal: "#14b8a6",
  pink: "#ec4899",
};

let fontsRegistered = false;

/** Fonte do app (Geist, servida em /fonts). Chamar antes de gerar o PDF. */
export function registerReportFonts(origin: string) {
  if (fontsRegistered) return;
  Font.register({
    family: "Geist",
    fonts: [400, 600, 700].map((fontWeight) => ({
      src: `${origin}/fonts/geist-sans-latin-${fontWeight}-normal.woff`,
      fontWeight,
    })),
  });
  // Sem hifenização automática (regras do inglês quebrariam palavras em português).
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 54, paddingHorizontal: 36, fontFamily: "Geist", fontSize: 9, color: C.text },
  brandBar: { position: "absolute", top: 0, left: 0, right: 0, height: 5, backgroundColor: C.brand },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 },
  eyebrow: { fontSize: 8, fontWeight: 600, color: C.brand, letterSpacing: 0.6, textTransform: "uppercase" },
  title: { fontSize: 20, fontWeight: 700, color: C.ink, marginTop: 3 },
  headerRight: { alignItems: "flex-end" },
  org: { fontSize: 10, fontWeight: 600, color: C.ink },
  small: { fontSize: 8, color: C.muted },
  filters: { borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 9, marginBottom: 14 },
  filtersTitle: { fontSize: 8, fontWeight: 600, color: C.muted, marginBottom: 4 },
  filterRow: { flexDirection: "row", marginTop: 2 },
  filterLabel: { width: 110, fontWeight: 600, color: C.ink },
  filterValue: { flex: 1 },
  tiles: { flexDirection: "row", marginHorizontal: -4, marginBottom: 8 },
  tile: { flex: 1, marginHorizontal: 4, backgroundColor: C.tile, borderRadius: 6, padding: 9 },
  tileLabel: { fontSize: 8, color: C.muted },
  tileValue: { fontSize: 17, fontWeight: 700, color: C.ink, marginTop: 3 },
  tileHint: { fontSize: 7.5, color: C.muted, marginTop: 2 },
  // flexShrink 0: um bloco que não cabe vai inteiro para a próxima página, nunca é espremido.
  section: { marginTop: 12, flexShrink: 0 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: C.ink },
  sectionNote: { fontSize: 8, color: C.muted, marginTop: 2, marginBottom: 8 },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  barLabel: { width: 150, paddingRight: 8, color: C.ink },
  barArea: { flex: 1, flexDirection: "row", alignItems: "center" },
  bar: { height: 9, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  barValue: { marginLeft: 5, fontSize: 8, color: C.text },
  swatch: { width: 7, height: 7, borderRadius: 2, marginRight: 5 },
  twoCols: { flexDirection: "row", marginHorizontal: -8, flexShrink: 0 },
  col: { flex: 1, marginHorizontal: 8 },
  legend: { flexDirection: "row", marginBottom: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", marginRight: 14 },
  table: { marginTop: 10, borderTopWidth: 1, borderColor: C.line },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderColor: C.line, paddingVertical: 3.5 },
  th: { fontSize: 8, fontWeight: 600, color: C.muted },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: C.line,
    paddingTop: 6,
    fontSize: 7.5,
    color: C.muted,
  },
});

const number = (value: number) => value.toLocaleString("pt-BR");
/** "1 novo" / "3 novos" */
const plural = (value: number, one: string, many: string) => `${number(value)} ${value === 1 ? one : many}`;
const percent = (value: number, total: number) =>
  total > 0 ? `${Math.round((value / total) * 100).toLocaleString("pt-BR")}%` : "—";

function monthLabel(month: string) {
  const [year, value] = month.split("-").map(Number);
  const name = new Date(year, value - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${name}/${String(year).slice(2)}`;
}

/** Do primeiro mês com movimento até hoje (mínimo 6): sem meses vazios à toa. */
function activeMonths(data: MonthPoint[], minimum = 6) {
  const first = data.findIndex((point) => point.new > 0 || point.integrations > 0);
  const start = first === -1 ? data.length - minimum : Math.min(first, data.length - minimum);
  return data.slice(Math.max(0, start));
}

/** Escala "redonda" para o eixo: 0, 5, 10, 15… */
function niceMax(value: number) {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => value / candidate <= 4)!;
  return Math.ceil(value / step) * step;
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={s.tile}>
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={s.tileValue}>{value}</Text>
      {hint ? <Text style={s.tileHint}>{hint}</Text> : null}
    </View>
  );
}

function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <View>
      <Text style={s.sectionTitle}>{title}</Text>
      <Text style={s.sectionNote}>{note ?? " "}</Text>
    </View>
  );
}

/** Barras horizontais; o valor fica na ponta da barra (texto nunca na cor da série). */
function Bars({
  items,
  total,
  color,
  labelWidth = 150,
}: {
  items: { key: string; name: string; count: number; color?: string }[];
  total: number;
  color: string;
  labelWidth?: number;
}) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <View>
      {items.map((item) => (
        <View key={item.key} style={s.barRow} wrap={false}>
          <Text style={[s.barLabel, { width: labelWidth }]}>{item.name}</Text>
          <View style={s.barArea}>
            {item.count > 0 ? (
              <View
                style={[s.bar, { width: `${Math.max(1.5, (item.count / max) * 78)}%`, backgroundColor: item.color ?? color }]}
              />
            ) : null}
            <Text style={s.barValue}>
              {number(item.count)} · {percent(item.count, total)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Top N + "Outros" (nunca uma lista sem fim no PDF). */
function topItems(items: CountItem[], limit = 8) {
  const sorted = [...items].sort((a, b) => b.count - a.count);
  if (sorted.length <= limit) return sorted.map((item) => ({ key: item.id ?? item.name, name: item.name, count: item.count }));
  const rest = sorted.slice(limit - 1);
  return [
    ...sorted.slice(0, limit - 1).map((item) => ({ key: item.id ?? item.name, name: item.name, count: item.count })),
    { key: "outros", name: `Outros (${rest.length})`, count: rest.reduce((sum, item) => sum + item.count, 0) },
  ];
}

function BreakdownSection({ title, items, total }: { title: string; items: CountItem[]; total: number }) {
  return (
    <View style={s.section} wrap={false}>
      <SectionTitle title={title} note="Candidatos e participação no total" />
      {items.length ? (
        <Bars items={topItems(items)} total={total} color={C.series1} labelWidth={110} />
      ) : (
        <Text style={s.small}>Sem dados.</Text>
      )}
    </View>
  );
}

/** Colunas agrupadas por mês (novos x integrações), um único eixo de contagem. */
function MonthlyChart({ data }: { data: MonthPoint[] }) {
  const plotHeight = 120;
  const max = niceMax(Math.max(0, ...data.flatMap((point) => [point.new, point.integrations])));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => Math.round(max * fraction));
  const height = (value: number) => (value / max) * plotHeight;
  const column = (value: number, fill: string) => (
    <View
      style={{
        width: 9,
        height: value > 0 ? Math.max(1.5, height(value)) : 0,
        backgroundColor: fill,
        borderTopLeftRadius: 2.5,
        borderTopRightRadius: 2.5,
      }}
    />
  );

  return (
    <View wrap={false}>
      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.swatch, { backgroundColor: C.series1 }]} />
          <Text>Novos candidatos</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.swatch, { backgroundColor: C.series2 }]} />
          <Text>Integrações</Text>
        </View>
      </View>
      <View style={{ height: plotHeight, marginLeft: 22, position: "relative" }}>
        {ticks.map((tick) => (
          <View key={`g${tick}`} style={{ position: "absolute", left: 0, right: 0, bottom: height(tick), borderTopWidth: 0.75, borderColor: C.line }} />
        ))}
        {ticks.map((tick) => (
          <Text
            key={`t${tick}`}
            style={{ position: "absolute", left: -24, width: 18, bottom: height(tick) - 3.5, textAlign: "right", fontSize: 7, color: C.muted }}
          >
            {number(tick)}
          </Text>
        ))}
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, flexDirection: "row", alignItems: "flex-end" }}>
          {data.map((point) => (
            <View key={point.month} style={{ flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "flex-end" }}>
              {column(point.new, C.series1)}
              <View style={{ width: 2 }} />
              {column(point.integrations, C.series2)}
            </View>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: "row", marginLeft: 22, marginTop: 4 }}>
        {data.map((point) => (
          <Text key={point.month} style={{ flex: 1, textAlign: "center", fontSize: 7, color: C.muted }}>
            {monthLabel(point.month)}
          </Text>
        ))}
      </View>
    </View>
  );
}

function MonthlyTable({ data }: { data: MonthPoint[] }) {
  const cols = [
    { width: "28%", align: "left" as const },
    { width: "24%", align: "right" as const },
    { width: "24%", align: "right" as const },
    { width: "24%", align: "right" as const },
  ];
  const row = (cells: string[], header = false) => (
    <View style={s.tr} wrap={false}>
      {cells.map((cell, index) => (
        <Text key={index} style={[{ width: cols[index].width, textAlign: cols[index].align }, header ? s.th : {}]}>
          {cell}
        </Text>
      ))}
    </View>
  );
  return (
    <View style={s.table}>
      {row(["Mês", "Novos", "Integrações", "SLA médio"], true)}
      {[...data].reverse().map((point) => (
        <View key={point.month}>
          {row([monthLabel(point.month), number(point.new), number(point.integrations), formatDays(point.sla_avg)])}
        </View>
      ))}
    </View>
  );
}

export type ReportPdfProps = {
  summary: DashboardSummary;
  filters: FilterLine[];
  organizationName: string;
  generatedAt: string;
};

export function ReportDocument({ summary, filters, organizationName, generatedAt }: ReportPdfProps) {
  const { totals, sla } = summary;
  const total = totals.active;
  const statuses: StatusCountItem[] = summary.by_status;
  const target = summary.sla_target_days;
  const months = activeMonths(summary.by_month);

  return (
    <Document title={`Relatório de recrutamento · ${organizationName}`} author={organizationName} creator="CRM Recrutamento" language="pt-BR">
      <Page size="A4" style={s.page}>
        <View style={s.brandBar} fixed />
        <View style={s.footer} fixed>
          <Text>
            {organizationName} · Gerado em {generatedAt} · Dados agregados, sem dados pessoais de candidatos
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>

        <View style={s.header}>
          <View>
            <Text style={s.eyebrow}>CRM Recrutamento</Text>
            <Text style={s.title}>Relatório de recrutamento</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.org}>{organizationName}</Text>
            <Text style={s.small}>Gerado em {generatedAt}</Text>
          </View>
        </View>

        <View style={s.filters}>
          <Text style={s.filtersTitle}>FILTROS APLICADOS</Text>
          {filters.length === 0 ? (
            <Text>Nenhum: todos os candidatos ativos.</Text>
          ) : (
            filters.map((line) => (
              <View key={line.label} style={s.filterRow}>
                <Text style={s.filterLabel}>{line.label}</Text>
                <Text style={s.filterValue}>{line.value}</Text>
              </View>
            ))
          )}
        </View>

        <View style={s.tiles}>
          <Tile label="Candidatos" value={number(total)} hint={`${plural(totals.new_7_days, "novo", "novos")} nos últimos 7 dias`} />
          <Tile label="Integrados" value={number(totals.integrations)} hint={`${number(totals.integrations_this_month)} neste mês`} />
          <Tile label="SLA médio" value={formatDays(sla.avg)} hint={`mediana ${formatDays(sla.median)}`} />
          <Tile label="Aguardando integração" value={number(sla.waiting_count)} hint={`há ${formatDays(sla.waiting_avg)} em média`} />
        </View>
        <View style={s.tiles}>
          <Tile label="Entrevistas agendadas" value={number(totals.interviews_upcoming)} hint={`${number(totals.interviews_today)} hoje`} />
          <Tile label="Tarefas atrasadas" value={number(totals.overdue_tasks)} hint={`${number(totals.today_tasks)} para hoje`} />
          <Tile label="Sem próxima ação" value={number(totals.no_next_action)} hint="sem nenhuma tarefa pendente" />
          <Tile
            label="Acima da meta de SLA"
            value={sla.above_target === null ? "—" : number(sla.above_target)}
            hint={target ? `meta de ${formatDays(target)}` : "meta não definida"}
          />
        </View>

        <View style={s.section} wrap={false}>
          <SectionTitle
            title="Tempo até a integração (SLA)"
            note={`Dias do cadastro até a integração, em ${plural(sla.completed_count, "candidato integrado", "candidatos integrados")}`}
          />
          <View style={s.tiles}>
            <Tile label="Média" value={formatDays(sla.avg)} />
            <Tile label="Mediana" value={formatDays(sla.median)} />
            <Tile label="Menor" value={formatDays(sla.min)} />
            <Tile label="Maior" value={formatDays(sla.max)} />
          </View>
        </View>

        <View style={s.section} wrap={false}>
          <SectionTitle title="Por status" note="Candidatos e participação no total" />
          <Bars
            items={statuses.map((status) => ({
              key: status.id ?? status.name,
              name: status.name,
              count: status.count,
              color: STATUS_HEX[status.color] ?? STATUS_HEX.slate,
            }))}
            total={total}
            color={C.series1}
          />
        </View>

        <View style={s.twoCols} wrap={false}>
          <View style={s.col}>
            <BreakdownSection title="Por gerente" items={summary.by_manager} total={total} />
          </View>
          <View style={s.col}>
            <BreakdownSection title="Por região" items={summary.by_region} total={total} />
          </View>
        </View>
        <View style={s.twoCols} wrap={false}>
          <View style={s.col}>
            <BreakdownSection title="Por origem" items={summary.by_source} total={total} />
          </View>
          <View style={s.col} />
        </View>

        <View style={s.section}>
          {/* Título preso ao gráfico: nunca fica sozinho no fim da página. */}
          <View wrap={false}>
            <SectionTitle
              title={`Evolução mensal (${months.length} meses)`}
              note={`Novos candidatos e integrações por mês, de ${monthLabel(months[0].month)} a ${monthLabel(months[months.length - 1].month)}`}
            />
            <MonthlyChart data={months} />
          </View>
          <MonthlyTable data={months} />
        </View>
      </Page>
    </Document>
  );
}
