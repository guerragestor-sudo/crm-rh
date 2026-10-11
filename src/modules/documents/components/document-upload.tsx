"use client";

import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Segmented } from "@/components/shared/segmented";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

import { registerDocumentAction } from "../actions";
import { ACCEPT_ATTRIBUTE, ALLOWED_MIME_TYPES, DOCUMENTS_BUCKET, validateDocumentFile } from "../constants";

const TYPE_OPTIONS = [
  { value: "resume", label: "Currículo" },
  { value: "other", label: "Outro documento" },
] as const;

/**
 * Upload direto do navegador para o bucket privado (o RLS do Storage confere
 * organização e candidato), depois registra os metadados no banco.
 */
export function DocumentUpload({
  organizationId,
  candidateId,
  hasResume,
}: {
  organizationId: string;
  candidateId: string;
  hasResume: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [documentType, setDocumentType] = useState<"resume" | "other">("resume");
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    const problem = validateDocumentFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }

    setUploading(true);
    try {
      const extension = ALLOWED_MIME_TYPES[file.type];
      const storagePath = `${organizationId}/${candidateId}/${crypto.randomUUID()}.${extension}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: false, cacheControl: "0" });
      if (uploadError) {
        toast.error("Não foi possível enviar o arquivo. Tente novamente.");
        return;
      }

      const response = await registerDocumentAction({
        candidateId,
        documentType,
        fileName: file.name,
        storagePath,
        mimeType: file.type,
        size: file.size,
      });
      if (!response.ok) {
        toast.error(response.error.message);
        return;
      }
      toast.success(documentType === "resume" && hasResume ? "Currículo substituído." : "Documento anexado.");
      router.refresh();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-xs">
      <Segmented
        name="document-type"
        ariaLabel="Tipo de documento"
        value={documentType}
        onChange={setDocumentType}
        options={TYPE_OPTIONS}
      />
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        id="document-file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <Button
        type="button"
        className="h-11 w-full"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
        {uploading
          ? "Enviando…"
          : documentType === "resume" && hasResume
            ? "Substituir currículo"
            : "Escolher arquivo ou foto"}
      </Button>
      <p className="text-xs text-muted-foreground">PDF, Word, JPG ou PNG · até 10 MB. O arquivo fica privado.</p>
    </div>
  );
}
