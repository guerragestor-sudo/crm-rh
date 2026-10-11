import "server-only";

import { fromDatabaseError } from "@/server/errors";
import { createClient } from "@/server/supabase/server";

export type CandidateDocument = {
  id: string;
  document_type: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  is_current: boolean;
  created_at: string;
  uploaded_by: string | null;
};

export async function getCandidateDocuments(candidateId: string): Promise<CandidateDocument[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("candidate_documents")
    .select(
      "id, document_type, file_name, mime_type, size_bytes, is_current, created_at, uploader:organization_members(profiles(full_name))",
    )
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });
  if (error) throw fromDatabaseError(error, { op: "candidate_documents" });

  return (data ?? []).map((row) => {
    const uploader = row.uploader as { profiles: { full_name: string } | null } | null;
    return {
      id: row.id,
      document_type: row.document_type,
      file_name: row.file_name,
      mime_type: row.mime_type,
      size_bytes: row.size_bytes,
      is_current: row.is_current,
      created_at: row.created_at,
      uploaded_by: uploader?.profiles?.full_name ?? null,
    };
  });
}
