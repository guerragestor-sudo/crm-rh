import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { DOCUMENTS_BUCKET } from "@/modules/documents/constants";
import { authorize } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { logger } from "@/server/logger";
import { createClient } from "@/server/supabase/server";

const SIGNED_URL_SECONDS = 60;

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Visualizar/baixar documento: confere sessão e permissão, lê o registro sob RLS,
 * gera URL assinada de curta duração, registra auditoria e redireciona.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/documentos/[id]">) {
  try {
    await authorize("candidates.read");
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) return errorResponse(404, "Documento não encontrado.");
    const download = request.nextUrl.searchParams.get("modo") === "baixar";

    const supabase = await createClient();
    const { data: document, error } = await supabase
      .from("candidate_documents")
      .select("id, storage_path, file_name")
      .eq("id", id)
      .maybeSingle();
    if (error || !document) return errorResponse(404, "Documento não encontrado.");

    const { data: signed, error: signError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(document.storage_path, SIGNED_URL_SECONDS, {
        download: download ? document.file_name : false,
      });
    if (signError || !signed) {
      logger.error("document_sign_failed", { documentId: document.id });
      return errorResponse(404, "Arquivo indisponível.");
    }

    await supabase.rpc("log_audit_event", {
      p_action: download ? "document_download" : "document_view",
      p_entity_type: "candidate_document",
      p_entity_id: document.id,
    });

    const response = NextResponse.redirect(signed.signedUrl, 302);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHENTICATED") return errorResponse(401, error.message);
    if (error instanceof AppError && error.code === "FORBIDDEN") return errorResponse(403, error.message);
    logger.error("document_route_error");
    return errorResponse(500, "Não foi possível abrir o documento.");
  }
}
