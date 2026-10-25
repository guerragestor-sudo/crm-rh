// Conversão da planilha "ESTEIRA" (uma aba por ciclo, ex.: SETE.26) em candidatos do CRM.
//
// Funções puras (sem banco): o script import-planilha.mjs usa este módulo para o
// relatório prévio e para a gravação. Regras combinadas com o usuário em 24/10/2026:
//  * duplicidade pelo telefone (não pelo CPF); sem telefone válido → "telefone pendente";
//  * status fora dos 6 padrões: "Ativo" e "Sem perfil" viram status novos; Declinou,
//    não tem interesse e Quantum → Desistiu; cadastro em andamento e "ok" → Encaminhado;
//  * disponibilidade: só "avaliar" tem equivalente (A combinar); o resto vai para a observação;
//  * todo texto da planilha que não cabe num campo do CRM vai para a observação.

/** Colunas esperadas no cabeçalho (comparadas sem acento e sem diferença de maiúsculas). */
export const COLUMNS = {
  name: "NOME CANDIDATO",
  interview: "DATA ENTREVISTA",
  manager: "GERENTE INDICAÇÃO",
  documentation: "CADASTRO+DOC",
  course: "CADASTRO CURSO",
  region: "REGIÃO",
  source: "CAPTAÇÃO MIDIA",
  availability: "DISPONIBILIDADE",
  integration: "DATA INTEGRAÇÃO",
  working: "TRABALHA",
  segment: "RAMO",
  phone: "TELEFONE",
  notes: "OBSERVAÇÃO",
  status: "STATUS",
  cavaplay: "CAVAPLAY 1.200",
  coursePaid: "CURSO PAGO PELA CAVA",
};

/** Cores dos status criados pela importação (mesma paleta das Configurações). */
export const NEW_STATUS_COLORS = { Ativo: "teal", "Sem perfil": "orange" };

/** Horário usado quando a planilha só tem o dia (entrevista e data de cadastro). */
export const DEFAULT_TIME = "09:00";

// -----------------------------------------------------------------------------
// Texto
// -----------------------------------------------------------------------------

/** Espaços normalizados; "-", "." e vazio viram "". */
export function clean(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return /^[-.]*$/.test(text) ? "" : text;
}

/** Forma de comparação: minúsculas, sem acentos e com espaços normalizados. */
export function fold(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** "RENATA" → "Renata"; "são domingos" → "São Domingos" (preposições em minúsculas). */
export function titleCase(value) {
  const small = new Set(["da", "de", "do", "das", "dos", "e"]);
  return clean(value)
    .toLowerCase()
    .split(" ")
    .map((word, index) => (index > 0 && small.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

/** "Guarulhos /Bom sucesso" → "Guarulhos / Bom sucesso" (para a observação). */
function tidySlashes(value) {
  return clean(value).replace(/\s*\/\s*/g, " / ").replace(/ \/$/, "");
}

// -----------------------------------------------------------------------------
// Telefone e datas
// -----------------------------------------------------------------------------

/**
 * Mesmo algoritmo de src/lib/phone.ts (o teste unitário garante que os dois
 * concordam): o índice único do banco compara o telefone normalizado.
 */
export function normalizePhone(value) {
  if (!value) return null;
  let digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!/^55[1-9]\d\d{8,9}$/.test(digits)) return null;
  const local = digits.slice(4);
  if (local.length === 9 && !local.startsWith("9")) return null;
  return digits;
}

/** "30/09" (+ ano) → "2026-09-30"; null se não for uma data válida. */
export function parseDayMonth(value, year) {
  const match = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(clean(value));
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const fullYear = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : year;
  const date = new Date(Date.UTC(fullYear, month - 1, day));
  if (date.getUTCFullYear() !== fullYear || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${fullYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "SETE.26" → 2026 (ano do ciclo no nome da aba). */
export function yearFromTabName(tab) {
  const match = /(\d{2})\s*$/.exec(String(tab ?? ""));
  return match ? 2000 + Number(match[1]) : null;
}

// -----------------------------------------------------------------------------
// Mapeamentos (texto da planilha → cadastros do CRM)
// -----------------------------------------------------------------------------

const STATUS_RULES = [
  [/^parceiro$/, "Parceiro"],
  [/^nao esta trabalhando/, "Não está trabalhando"],
  [/^desistiu$/, "Desistiu"],
  [/^nao retornou$/, "Não retornou"],
  [/^nao tem perfil$/, "Sem perfil"],
  [/^seletiva/, "Seletiva"],
  [/^encaminhado/, "Encaminhado"],
  [/^(ativo|integracao ok)/, "Ativo"],
  [/^(declinou|nao tem interesse|esta na quantum)/, "Desistiu"],
  [/(atualizacao|processo) de cadastro/, "Encaminhado"],
  [/^ok$/, "Encaminhado"],
];

/**
 * Status da planilha → status do CRM. Status vazio: "Ativo" quando TRABALHA ou
 * OBSERVAÇÃO dizem "Ativo…"; senão "Seletiva". `original` = texto a registrar
 * na observação (quando difere do status escolhido).
 */
export function mapStatus(raw, { working = "", notes = "" } = {}) {
  const text = clean(raw);
  if (!text) {
    const active = /^ativo\b/.test(fold(working)) || /^ativo\b/.test(fold(notes));
    return {
      name: active ? "Ativo" : "Seletiva",
      original: null,
      inferred: active ? "status vazio; TRABALHA/OBSERVAÇÃO dizem “Ativo”" : "status vazio; ficou Seletiva",
    };
  }
  const folded = fold(text);
  const rule = STATUS_RULES.find(([pattern]) => pattern.test(folded));
  if (!rule) return { name: null, original: text, inferred: null };
  return { name: rule[1], original: fold(rule[1]) === folded ? null : text, inferred: null };
}

const MANAGER_TYPOS = { lendro: "Leandro", lenadro: "Leandro" };

/** "RENATA / Lenadro" → Renata (o texto completo vai para a observação). */
export function mapManager(raw) {
  const text = clean(raw);
  const parts = text.split("/").map(clean).filter(Boolean);
  if (parts.length === 0) return { name: null, original: null };
  const first = MANAGER_TYPOS[fold(parts[0])] ?? titleCase(parts[0]);
  return { name: first, original: parts.length > 1 ? tidySlashes(text) : null };
}

const REGION_ALIASES = {
  guarulho: "Guarulhos",
  "lageado zona leste": "Zona Leste",
};

/** "Guarulhos / São Domingos" → Guarulhos (o bairro vai para a observação). */
export function mapRegion(raw) {
  const text = clean(raw);
  if (!text) return { name: null, original: null };
  const first = clean(text.split("/")[0]);
  const name = REGION_ALIASES[fold(first)] ?? titleCase(first);
  const plain = fold(text) === fold(name) || fold(text) === "guarulho";
  return { name, original: plain ? null : tidySlashes(text) };
}

// [teste, nome no CRM, variações que dispensam registrar o texto original]
const SOURCE_RULES = [
  [/catho/, "Catho", /^(disparos? catho|catho dis\w*)$/],
  [/listagem propria/, "Disparo listagem própria", /^disparo listagem propria$/],
  [/grupos? (de )?vag|grupos? mrv/, "Grupos de vagas", /^disparo grupos de vag\w*$/],
  [/^postagem/, "Postagem", /^postagem$/],
  [/^indicacao/, "Indicação", /^indicacao$/],
  [/^anuncio/, "Anúncio", /^anuncio$/],
  [/^captacao$/, "Captação", /^captacao$/],
];

/** Captação/mídia → origem. Texto sem regra → "Outros" (original na observação). */
export function mapSource(raw) {
  const text = clean(raw);
  if (!text) return { name: null, original: null };
  const folded = fold(text);
  const rule = SOURCE_RULES.find(([pattern]) => pattern.test(folded));
  if (!rule) return { name: "Outros", original: tidySlashes(text) };
  return { name: rule[1], original: rule[2].test(folded) ? null : tidySlashes(text) };
}

const SEGMENT_RULES = [
  [/^(imoveis|imob|corretor|atend imob)/, "Imóveis", /^imoveis$/],
  [/^comercio/, "Comércio", /^comercio$/],
  [/^e-?comerc/, "E-commerce", /^e-?comerc\w*$/],
  [/^vend/, "Vendas", /^vendas$/],
];

/** RAMO → ramo do CRM. Ramos sem regra ficam sem ramo (texto na observação). */
export function mapSegment(raw) {
  const text = clean(raw);
  if (!text) return { name: null, original: null };
  const folded = fold(text);
  const rule = SEGMENT_RULES.find(([pattern]) => pattern.test(folded));
  if (!rule) return { name: null, original: text };
  return { name: rule[1], original: rule[2].test(folded) ? null : text };
}

/** Só "avaliar" tem equivalente no CRM (A combinar). */
export function mapAvailability(raw) {
  const text = clean(raw);
  if (!text) return { value: null, original: null };
  if (fold(text) === "avaliar") return { value: "to_negotiate", original: null };
  return { value: null, original: text };
}

/** TRABALHA (texto livre) → trabalha atualmente (sim/não/sem informação). */
export function mapWorking(raw) {
  const text = clean(raw);
  if (!text) return { value: null, original: null };
  const folded = fold(text);
  if (/^(nao trabalha|desempregad|seguro desemprego|segura dese)/.test(folded)) {
    return { value: false, original: folded === "nao trabalha" ? null : text };
  }
  if (folded === "estudante") return { value: null, original: text };
  return { value: true, original: text };
}

export function mapDocumentation(raw) {
  const text = clean(raw);
  const folded = fold(text);
  if (!text) return { status: "pending", notes: null };
  if (folded === "ok") return { status: "complete", notes: null };
  if (folded.startsWith("cad")) return { status: "in_progress", notes: text };
  return { status: "pending", notes: text };
}

export function mapCourse(raw) {
  const text = clean(raw);
  const folded = fold(text);
  if (!text) return { status: "not_started", notes: null };
  if (folded === "ok") return { status: "completed", notes: null };
  if (folded.includes("faltante")) return { status: "in_progress", notes: text };
  return { status: "not_started", notes: text };
}

// -----------------------------------------------------------------------------
// Planilha → registros
// -----------------------------------------------------------------------------

/** Índice de cada coluna conhecida no cabeçalho; erro se faltar alguma essencial. */
export function headerIndex(header) {
  const folded = header.map(fold);
  const index = {};
  for (const [key, label] of Object.entries(COLUMNS)) {
    index[key] = folded.indexOf(fold(label));
  }
  const missing = ["name", "phone", "status"].filter((key) => index[key] < 0);
  if (missing.length) throw new Error(`Colunas não encontradas: ${missing.map((key) => COLUMNS[key]).join(", ")}`);
  return index;
}

/**
 * Converte as linhas (formato values da API do Google Sheets, cabeçalho na 1ª)
 * em registros prontos para gravar, com problemas e avisos por linha.
 *
 * @param {string[][]} values
 * @param {{ tab: string, year: number, today: string, importDate: string }} options
 *   today/importDate em "AAAA-MM-DD" no fuso da organização.
 */
export function parseSheet(values, { tab, year, today, importDate }) {
  const [header, ...rows] = values;
  const col = headerIndex(header);
  const cell = (row, key) => (col[key] >= 0 ? (row[col[key]] ?? "") : "");

  const parsed = [];
  rows.forEach((row, offset) => {
    const line = offset + 2; // linha na planilha (cabeçalho = 1)
    if (row.every((value) => clean(value) === "")) return;

    const errors = [];
    const warnings = [];
    const extra = [];

    const fullName = clean(cell(row, "name"));
    if (fullName.length < 2) errors.push("nome vazio ou muito curto");

    // Telefone: inválido não impede a importação (fica "telefone pendente").
    const rawPhone = clean(cell(row, "phone"));
    const phone = normalizePhone(rawPhone);
    if (!rawPhone) warnings.push("sem telefone (telefone pendente)");
    else if (!phone) {
      warnings.push(`telefone inválido “${rawPhone}” (telefone pendente; número anotado na observação)`);
      extra.push(`Telefone na planilha (inválido): ${rawPhone}`);
    }

    // Datas
    const rawInterview = clean(cell(row, "interview"));
    const interviewDate = parseDayMonth(rawInterview, year);
    if (rawInterview && !interviewDate) {
      warnings.push(`data de entrevista não é data: “${rawInterview}” (anotada na observação)`);
      extra.push(`Data de entrevista na planilha: ${rawInterview}`);
    }
    const rawIntegration = clean(cell(row, "integration"));
    const integrationDate = parseDayMonth(rawIntegration, year);
    if (rawIntegration && !integrationDate) errors.push(`data de integração inválida: “${rawIntegration}”`);
    if (interviewDate && interviewDate > today) errors.push(`entrevista no futuro (${interviewDate})`);
    if (integrationDate && integrationDate > today) errors.push(`integração no futuro (${integrationDate})`);

    // Data de cadastro = entrevista (SLA conta da entrevista até a integração).
    let createdDate = interviewDate;
    let createdBasis = "entrevista";
    if (!createdDate && integrationDate) {
      createdDate = integrationDate;
      createdBasis = "integração";
      warnings.push("sem data de entrevista: cadastro = data de integração (SLA 0 dia)");
    }
    if (!createdDate) {
      createdDate = importDate;
      createdBasis = "importação";
      warnings.push(`sem datas: cadastro = data da importação (${importDate})`);
    }
    if (integrationDate && createdDate && integrationDate < createdDate) {
      errors.push(`integração (${integrationDate}) antes da entrevista (${createdDate})`);
    }

    // Cadastros de apoio
    const working = mapWorking(cell(row, "working"));
    const status = mapStatus(cell(row, "status"), { working: cell(row, "working"), notes: cell(row, "notes") });
    if (!status.name) errors.push(`status não reconhecido: “${status.original}”`);
    if (status.inferred) warnings.push(status.inferred);
    const manager = mapManager(cell(row, "manager"));
    const region = mapRegion(cell(row, "region"));
    const source = mapSource(cell(row, "source"));
    const segment = mapSegment(cell(row, "segment"));
    const availability = mapAvailability(cell(row, "availability"));
    const documentation = mapDocumentation(cell(row, "documentation"));
    const course = mapCourse(cell(row, "course"));

    const courseNotes = [course.notes];
    if (fold(cell(row, "cavaplay")) === "sim") courseNotes.push("Cavaplay 1.200: sim");
    if (fold(cell(row, "coursePaid")) === "sim") courseNotes.push("Curso pago pela Cava: sim");

    // Observação: texto original + tudo que não coube nos campos do CRM.
    const notes = [
      clean(cell(row, "notes")),
      working.original ? `Trabalha: ${working.original}` : "",
      availability.original ? `Disponibilidade na planilha: ${availability.original}` : "",
      status.original && status.name ? `Status na planilha: ${status.original}` : "",
      manager.original ? `Gerente na planilha: ${manager.original}` : "",
      region.original ? `Região na planilha: ${region.original}` : "",
      source.original ? `Captação na planilha: ${source.original}` : "",
      segment.original ? `Ramo na planilha: ${segment.original}` : "",
      ...extra,
      `Importado da planilha (aba ${tab}, linha ${line}) em ${formatDateBr(importDate)}.`,
    ].filter(Boolean);

    parsed.push({
      line,
      errors,
      warnings,
      createdBasis,
      raw: { status: clean(cell(row, "status")) },
      refs: {
        status: status.name,
        manager: manager.name,
        region: region.name,
        source: source.name,
        segment: segment.name,
      },
      candidate: {
        full_name: fullName,
        phone,
        availability: availability.value,
        currently_working: working.value,
        notes: notes.join("\n"),
        interview_date: interviewDate,
        created_date: createdDate,
        integration_date: integrationDate,
        documentation_status: documentation.status,
        documentation_notes: documentation.notes,
        course_status: course.status,
        course_notes: courseNotes.filter(Boolean).join("\n") || null,
      },
    });
  });

  // Telefone repetido dentro da própria planilha: só a primeira linha entra.
  const firstByPhone = new Map();
  for (const record of parsed) {
    const phone = record.candidate.phone;
    if (!phone) continue;
    const first = firstByPhone.get(phone);
    if (first) record.errors.push(`telefone repetido na planilha (mesmo da linha ${first.line}, ${first.candidate.full_name})`);
    else firstByPhone.set(phone, record);
  }

  // Mesmo nome com telefones diferentes: entra, mas avisa.
  const byName = new Map();
  for (const record of parsed) {
    const key = fold(record.candidate.full_name);
    byName.set(key, [...(byName.get(key) ?? []), record.line]);
  }
  for (const record of parsed) {
    const lines = byName.get(fold(record.candidate.full_name));
    if (lines.length > 1) {
      record.warnings.push(`mesmo nome nas linhas ${lines.join(", ")} (telefones diferentes: entram como pessoas distintas)`);
    }
  }

  return parsed;
}

export function formatDateBr(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}
