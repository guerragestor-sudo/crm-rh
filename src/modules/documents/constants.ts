export const DOCUMENTS_BUCKET = "candidate-files";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export const ACCEPT_ATTRIBUTE = ".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  resume: "Currículo",
  other: "Outro documento",
};

/** Valida o arquivo no navegador antes do upload (o banco e o bucket validam de novo). */
export function validateDocumentFile(file: { size: number; type: string }): string | null {
  if (!ALLOWED_MIME_TYPES[file.type]) {
    return "Formato não aceito. Envie PDF, Word (DOC/DOCX), JPG ou PNG.";
  }
  if (file.size === 0) return "O arquivo está vazio.";
  if (file.size > MAX_DOCUMENT_BYTES) return "O arquivo passa de 10 MB.";
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}
