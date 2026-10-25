// Importa uma aba da planilha "ESTEIRA" (Google Sheets) para uma organização do CRM.
//
//   1) Relatório prévio (só lê o banco, não grava nada):
//        npm run import-planilha:prod -- imports/sete26.json --org "Eliene Recrutamento"
//   2) Gravação, depois de conferir o relatório:
//        npm run import-planilha:prod -- imports/sete26.json --org "Eliene Recrutamento" --apply
//   3) Desfazer a gravação (só enquanto ninguém mexeu nos importados):
//        npm run import-planilha:prod -- imports/sete26.json --org "Eliene Recrutamento" --undo
//
//   Sem banco (apenas o mapeamento): node scripts/import-planilha.mjs imports/sete26.json --offline
//
// Entrada: JSON da API do Google Sheets ({ range: "SETE.26!A1:R120", values: [...] }).
// O relatório e a lista de ids gravados ficam em imports/ (dados pessoais: fora do Git).
// Requer NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no arquivo de ambiente.
import { TZDate } from "@date-fns/tz";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import {
  DEFAULT_TIME,
  NEW_STATUS_COLORS,
  fold,
  formatDateBr,
  parseSheet,
  yearFromTabName,
} from "./lib/sheet-import.mjs";

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    org: { type: "string" },
    apply: { type: "boolean", default: false },
    undo: { type: "boolean", default: false },
    offline: { type: "boolean", default: false },
    "skip-errors": { type: "boolean", default: false },
    "member-id": { type: "string" },
    year: { type: "string" },
  },
});

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

const inputPath = positionals[0];
if (!inputPath) fail('Uso: node scripts/import-planilha.mjs <arquivo.json> --org "<organização>" [--apply | --undo]');
if (!args.offline && !args.org) fail('Informe a organização: --org "<nome>" (ou --offline para só ver o mapeamento).');
if (args.apply && args.undo) fail("Use --apply ou --undo, não os dois.");

const input = JSON.parse(readFileSync(inputPath, "utf8"));
const tab = String(input.range ?? "").split("!")[0].replace(/^'|'$/g, "") || "planilha";
const year = Number(args.year) || yearFromTabName(tab);
if (!year) fail(`Não foi possível deduzir o ano pelo nome da aba "${tab}". Use --year 2026.`);

const slug = fold(tab).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const reportPath = path.join("imports", `relatorio-${slug}.md`);
const idsPath = path.join("imports", `importados-${slug}.json`);

/** "AAAA-MM-DD" de hoje no fuso informado. */
function todayIn(timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Dia + horário padrão no fuso da organização → ISO UTC (nunca no futuro). */
function dayToIso(isoDate, timeZone) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const [hour, minute] = DEFAULT_TIME.split(":").map(Number);
  const time = Math.min(new TZDate(y, m - 1, d, hour, minute, timeZone).getTime(), Date.now());
  return new Date(time).toISOString();
}

function formatPhone(digits) {
  if (!digits) return "";
  const national = digits.slice(2);
  return national.length === 11
    ? `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`
    : `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
}

const md = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

// -----------------------------------------------------------------------------
// Banco (somente leitura até --apply)
// -----------------------------------------------------------------------------

let supabase = null;
let org = null;
let timezone = "America/Sao_Paulo";
let member = null;
const existing = { candidate_statuses: [], regions: [], segments: [], sources: [], managers: [], candidates: [] };

async function must(promise, what) {
  const { data, error } = await promise;
  if (error) fail(`${what}: ${error.message}`);
  return data;
}

if (!args.offline) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) fail("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY (arquivo de ambiente).");
  supabase = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const orgs = await must(supabase.from("organizations").select("id, name").eq("name", args.org.trim()), "Organizações");
  if (orgs.length !== 1) fail(`Organização "${args.org}" não encontrada (ou nome repetido).`);
  org = orgs[0];

  const settings = await must(
    supabase.from("organization_settings").select("timezone").eq("organization_id", org.id).maybeSingle(),
    "Configurações",
  );
  timezone = settings?.timezone ?? timezone;

  const members = await must(
    supabase.from("organization_members").select("id, role, profiles(full_name)").eq("organization_id", org.id),
    "Membros",
  );
  if (args["member-id"]) member = members.find((item) => item.id === args["member-id"]);
  else if (members.length === 1) member = members[0];
  if (!member) {
    fail(
      `Escolha o responsável com --member-id:\n${members.map((item) => `  ${item.id}  ${item.profiles?.full_name} (${item.role})`).join("\n")}`,
    );
  }

  for (const table of ["candidate_statuses", "regions", "segments", "sources", "managers"]) {
    const columns = table === "candidate_statuses" ? "id, name, position, is_active" : table === "managers" ? "id, name, is_active" : "id, name, sort_order, is_active";
    existing[table] = await must(supabase.from(table).select(columns).eq("organization_id", org.id), table);
  }
  existing.candidates = await must(
    supabase.from("candidates").select("id, full_name, phone").eq("organization_id", org.id).limit(20000),
    "Candidatos",
  );
}

// -----------------------------------------------------------------------------
// Desfazer
// -----------------------------------------------------------------------------

if (args.undo) {
  if (!existsSync(idsPath)) fail(`Arquivo ${idsPath} não encontrado: nada para desfazer.`);
  const saved = JSON.parse(readFileSync(idsPath, "utf8"));
  if (saved.organization_id !== org.id) fail("O arquivo de ids é de outra organização.");
  const ids = saved.candidate_ids;
  const [tasks, documents] = await Promise.all([
    must(supabase.from("tasks").select("id").in("candidate_id", ids).limit(1), "Tarefas"),
    must(supabase.from("candidate_documents").select("id").in("candidate_id", ids).limit(1), "Documentos"),
  ]);
  if (tasks.length || documents.length) {
    fail("Há tarefas ou documentos nos candidatos importados: desfazer apagaria trabalho feito depois. Use o backup.");
  }
  await must(supabase.from("candidate_history").delete().in("candidate_id", ids), "Histórico");
  const removed = await must(supabase.from("candidates").delete().in("id", ids).select("id"), "Candidatos");
  writeFileSync(idsPath.replace(/\.json$/, `.desfeito-${Date.now()}.json`), JSON.stringify(saved, null, 2));
  writeFileSync(idsPath, "");
  console.log(`\n✔ ${removed.length} candidatos importados foram removidos. Status, regiões, origens e gerentes criados foram mantidos.`);
  process.exit(0);
}

// -----------------------------------------------------------------------------
// Mapeamento e plano
// -----------------------------------------------------------------------------

const today = todayIn(timezone);
const records = parseSheet(input.values, { tab, year, today, importDate: today });

// Conflitos com o que já está no CRM (duplicidade pelo telefone).
const byPhone = new Map(existing.candidates.filter((c) => c.phone).map((c) => [c.phone, c]));
const phonelessNames = new Map(existing.candidates.filter((c) => !c.phone).map((c) => [fold(c.full_name), c]));
for (const record of records) {
  const { phone, full_name } = record.candidate;
  const clash = phone ? byPhone.get(phone) : phonelessNames.get(fold(full_name));
  if (clash) {
    record.errors.push(
      phone
        ? `telefone já cadastrado no CRM (${clash.full_name})`
        : `já existe no CRM um candidato sem telefone com este nome (${clash.full_name})`,
    );
  }
}

const importable = records.filter((record) => record.errors.length === 0);
const blocked = records.filter((record) => record.errors.length > 0);

// Cadastros de apoio: existentes (comparação sem acento/maiúsculas) ou novos.
const KINDS = [
  ["status", "candidate_statuses", "Status", "status"],
  ["manager", "managers", "Gerentes", "gerente"],
  ["region", "regions", "Regiões", "região"],
  ["source", "sources", "Origens / captação", "origem"],
  ["segment", "segments", "Ramos", "ramo"],
];
const plan = {};
for (const [key, table] of KINDS) {
  const counts = new Map();
  for (const record of importable) {
    const name = record.refs[key];
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  plan[key] = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .map(([name, count]) => {
      const found = existing[table].find((item) => fold(item.name) === fold(name));
      return { name, count, existing: found ?? null };
    });
}

// Ordem dos status: com os 6 padrões intactos, "Ativo" entra depois de Encaminhado
// e "Sem perfil" depois de Desistiu. Caso contrário, novos status vão para o fim.
const DEFAULT_ORDER = ["Seletiva", "Encaminhado", "Parceiro", "Não está trabalhando", "Desistiu", "Não retornou"];
const TARGET_ORDER = ["Seletiva", "Encaminhado", "Ativo", "Parceiro", "Não está trabalhando", "Desistiu", "Sem perfil", "Não retornou"];
const currentOrder = [...existing.candidate_statuses].sort((a, b) => a.position - b.position).map((s) => s.name);
const newStatuses = plan.status.filter((item) => !item.existing).map((item) => item.name);
const canReorder =
  !args.offline &&
  JSON.stringify(currentOrder) === JSON.stringify(DEFAULT_ORDER) &&
  newStatuses.every((name) => TARGET_ORDER.includes(name));
const finalStatusOrder = args.offline
  ? null
  : canReorder
    ? TARGET_ORDER.filter((name) => currentOrder.includes(name) || newStatuses.includes(name))
    : [...currentOrder, ...newStatuses];

// -----------------------------------------------------------------------------
// Relatório
// -----------------------------------------------------------------------------

const lines = [];
const push = (...items) => lines.push(...items);
push(
  `# Importação da planilha: aba ${tab}`,
  "",
  `Gerado em ${formatDateBr(today)} · ${args.offline ? "modo sem banco (só mapeamento)" : `organização **${org.name}**`} · ${args.apply ? "**GRAVAÇÃO**" : "relatório prévio: nada foi gravado"}`,
  "",
  "## Resumo",
  "",
  `| | Quantidade |`,
  `|---|---|`,
  `| Linhas com dados na planilha | ${records.length} |`,
  `| Entram no CRM | **${importable.length}** |`,
  `| Não entram (ver "Bloqueados") | ${blocked.length} |`,
  `| Entram sem telefone (telefone pendente) | ${importable.filter((r) => !r.candidate.phone).length} |`,
  `| Com data de integração (SLA congelado) | ${importable.filter((r) => r.candidate.integration_date).length} |`,
  `| Cavaplay | ${importable.filter((r) => r.candidate.cavaplay).length} |`,
  `| Curso pago pela Cava | ${importable.filter((r) => r.candidate.course_paid_by_cava).length} |`,
  "",
);

push("## Status no CRM", "", "| Status | Candidatos | Situação |", "|---|---|---|");
for (const item of plan.status) {
  push(`| ${md(item.name)} | ${item.count} | ${args.offline ? "—" : item.existing ? "já existe" : "**novo**"} |`);
}
if (finalStatusOrder) {
  push("", `Ordem dos status (Kanban) depois da importação: ${finalStatusOrder.join(" → ")}.`);
}
push("", "Texto da planilha → status do CRM:", "", "| STATUS na planilha | Status no CRM | Linhas |", "|---|---|---|");
const statusMap = new Map();
for (const record of records) {
  const raw = record.raw.status || "(vazio)";
  const k = `${raw}\u0000${record.refs.status ?? "NÃO RECONHECIDO"}`;
  statusMap.set(k, [...(statusMap.get(k) ?? []), record.line]);
}
for (const [k, rows] of [...statusMap.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const [raw, crm] = k.split("\u0000");
  push(`| ${md(raw)} | ${md(crm)} | ${rows.length} (linhas ${rows.join(", ")}) |`);
}
push("");

for (const [key, , label, singular] of KINDS.slice(1)) {
  push(`## ${label}`, "", "| Nome no CRM | Candidatos | Situação |", "|---|---|---|");
  if (plan[key].length === 0) push("| — | 0 | — |");
  for (const item of plan[key]) {
    push(`| ${md(item.name)} | ${item.count} | ${args.offline ? "—" : item.existing ? "já existe" : "**novo**"} |`);
  }
  const without = importable.filter((r) => !r.refs[key]).length;
  if (without) push("", `Sem ${singular}: ${without} candidato(s).`);
  push("");
}

push("## Bloqueados (não entram)", "");
if (blocked.length === 0) push("Nenhum.", "");
for (const record of blocked) {
  push(`- Linha ${record.line} · **${md(record.candidate.full_name || "(sem nome)")}**: ${record.errors.join("; ")}`);
}
push("");

push("## Avisos (entram, mas vale conferir)", "");
const warned = importable.filter((record) => record.warnings.length);
if (warned.length === 0) push("Nenhum.", "");
for (const record of warned) {
  push(`- Linha ${record.line} · **${md(record.candidate.full_name)}**: ${record.warnings.join("; ")}`);
}
push("");

push(
  "## Candidatos",
  "",
  "Cadastro = data da entrevista (o SLA conta da entrevista até a integração). Horário registrado: " +
    `${DEFAULT_TIME} (a planilha só tem o dia). Tudo que não coube num campo do CRM está na observação.`,
  "",
  "| Linha | Nome | Telefone | Status | Gerente | Região | Origem | Ramo | Cadastro | Integração | SLA |",
  "|---|---|---|---|---|---|---|---|---|---|---|",
);
for (const record of importable) {
  const c = record.candidate;
  const sla =
    c.integration_date && c.created_date
      ? `${Math.round((Date.parse(c.integration_date) - Date.parse(c.created_date)) / 86_400_000)} d`
      : "—";
  push(
    `| ${record.line} | ${md(c.full_name)} | ${c.phone ? formatPhone(c.phone) : "pendente"} | ${md(record.refs.status)} | ${md(record.refs.manager ?? "—")} | ${md(record.refs.region ?? "—")} | ${md(record.refs.source ?? "—")} | ${md(record.refs.segment ?? "—")} | ${formatDateBr(c.created_date)} | ${c.integration_date ? formatDateBr(c.integration_date) : "—"} | ${sla} |`,
  );
}
push("", "## Observação gravada em cada ficha", "");
for (const record of importable) {
  push(`<details><summary>Linha ${record.line} · ${md(record.candidate.full_name)}</summary>`, "", "```", record.candidate.notes);
  if (record.candidate.course_notes) push("", "[Curso] " + record.candidate.course_notes.replace(/\n/g, " · "));
  if (record.candidate.documentation_notes) push("[Cadastro] " + record.candidate.documentation_notes);
  push("```", "</details>", "");
}

writeFileSync(reportPath, lines.join("\n"));

console.log(`\nAba ${tab}: ${records.length} linhas · ${importable.length} entram · ${blocked.length} bloqueadas · ${warned.length} com aviso`);
for (const [key, , label] of KINDS) {
  const created = plan[key].filter((item) => !item.existing).map((item) => item.name);
  if (!args.offline && created.length) console.log(`  ${label} a criar: ${created.join(", ")}`);
}
for (const record of blocked) console.log(`  ✖ linha ${record.line} ${record.candidate.full_name}: ${record.errors.join("; ")}`);
console.log(`\nRelatório: ${reportPath}`);

if (!args.apply) {
  console.log(args.offline ? "" : "Nada foi gravado. Para gravar, rode de novo com --apply.");
  process.exit(0);
}

// -----------------------------------------------------------------------------
// Gravação
// -----------------------------------------------------------------------------

if (blocked.length && !args["skip-errors"]) {
  fail(`${blocked.length} linha(s) bloqueada(s). Corrija a planilha ou rode com --skip-errors para gravar só as demais.`);
}
if (importable.length === 0) fail("Nenhum candidato para gravar.");
if (existsSync(idsPath) && readFileSync(idsPath, "utf8").trim()) {
  fail(`Já existe ${idsPath} (importação anterior). Use --undo antes de importar de novo.`);
}

const ids = {};
// Status novos (e reordenação, quando os 6 padrões estão intactos).
const statusIds = new Map(existing.candidate_statuses.map((s) => [fold(s.name), s.id]));
if (newStatuses.length) {
  const maxPosition = Math.max(-1, ...existing.candidate_statuses.map((s) => s.position));
  const inserted = await must(
    supabase
      .from("candidate_statuses")
      .insert(
        newStatuses.map((name, index) => ({
          organization_id: org.id,
          name,
          color: NEW_STATUS_COLORS[name] ?? "slate",
          position: maxPosition + 1 + index,
        })),
      )
      .select("id, name"),
    "Criar status",
  );
  for (const status of inserted) statusIds.set(fold(status.name), status.id);
  if (canReorder) {
    // Duas passadas (posição temporária) por causa do índice único de posição.
    for (const [pass, offset] of [["temporária", 1000], ["final", 0]]) {
      for (const [index, name] of finalStatusOrder.entries()) {
        await must(
          supabase.from("candidate_statuses").update({ position: offset + index }).eq("id", statusIds.get(fold(name))),
          `Ordenar status (${pass})`,
        );
      }
    }
  }
}
ids.status = statusIds;

for (const [key, table] of KINDS.slice(1)) {
  const map = new Map(existing[table].map((item) => [fold(item.name), item.id]));
  const missing = plan[key].filter((item) => !item.existing).map((item) => item.name);
  if (missing.length) {
    const base = table === "managers" ? null : Math.max(-1, ...existing[table].map((item) => item.sort_order ?? 0));
    const rows = missing.map((name, index) =>
      base === null ? { organization_id: org.id, name } : { organization_id: org.id, name, sort_order: base + 1 + index },
    );
    const inserted = await must(supabase.from(table).insert(rows).select("id, name"), `Criar ${table}`);
    for (const item of inserted) map.set(fold(item.name), item.id);
  }
  ids[key] = map;
}

const lookup = (key, name) => (name ? ids[key].get(fold(name)) ?? fail(`Sem id para ${key} "${name}"`) : null);

const payload = importable.map((record) => {
  const c = record.candidate;
  return {
    organization_id: org.id,
    full_name: c.full_name,
    phone: c.phone,
    availability: c.availability,
    currently_working: c.currently_working,
    notes: c.notes,
    status_id: lookup("status", record.refs.status),
    manager_id: lookup("manager", record.refs.manager),
    region_id: lookup("region", record.refs.region),
    source_id: lookup("source", record.refs.source),
    segment_id: lookup("segment", record.refs.segment),
    interview_at: c.interview_date ? dayToIso(c.interview_date, timezone) : null,
    integration_date: c.integration_date,
    documentation_status: c.documentation_status,
    documentation_notes: c.documentation_notes,
    course_status: c.course_status,
    course_notes: c.course_notes,
    cavaplay: c.cavaplay,
    course_paid_by_cava: c.course_paid_by_cava,
    responsible_member_id: member.id,
    created_by_member_id: member.id,
    created_at: dayToIso(c.created_date, timezone),
  };
});

// Um único INSERT: ou entram todos, ou nenhum.
const inserted = await must(supabase.from("candidates").insert(payload).select("id"), "Gravar candidatos");
writeFileSync(
  idsPath,
  JSON.stringify({ organization_id: org.id, tab, imported_at: new Date().toISOString(), candidate_ids: inserted.map((c) => c.id) }, null, 2),
);

const { count } = await supabase
  .from("candidates")
  .select("id", { count: "exact", head: true })
  .eq("organization_id", org.id);
console.log(`\n✔ ${inserted.length} candidatos gravados em "${org.name}" (total na organização: ${count}).`);
console.log(`  Ids gravados em ${idsPath} (usados pelo --undo).`);
