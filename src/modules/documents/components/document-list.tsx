import { Download, Eye, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { DOCUMENT_TYPE_LABELS, formatBytes } from "../constants";
import type { CandidateDocument } from "../queries";

export function DocumentList({ documents, timezone }: { documents: CandidateDocument[]; timezone: string }) {
  if (documents.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhum documento anexado.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-xl border bg-card shadow-xs">
      {documents.map((document) => {
        const outdated = document.document_type === "resume" && !document.is_current;
        return (
          <li key={document.id} className={cn("flex flex-wrap items-center gap-3 p-3", outdated && "opacity-60")}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <FileText className="size-4 text-muted-foreground" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{document.file_name}</p>
              <p className="text-xs text-muted-foreground">
                {DOCUMENT_TYPE_LABELS[document.document_type]}
                {document.document_type === "resume" ? (document.is_current ? " · atual" : " · versão anterior") : ""}
                {" · "}
                {formatBytes(document.size_bytes)} · {formatDateTime(document.created_at, timezone)}
                {document.uploaded_by ? ` · ${document.uploaded_by}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" className="h-10">
                <a href={`/api/documentos/${document.id}`} target="_blank" rel="noopener noreferrer">
                  <Eye aria-hidden />
                  Ver
                </a>
              </Button>
              <Button asChild variant="outline" className="h-10 w-10 px-0">
                <a href={`/api/documentos/${document.id}?modo=baixar`} aria-label={`Baixar ${document.file_name}`}>
                  <Download aria-hidden />
                </a>
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
