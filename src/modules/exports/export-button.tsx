"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { CandidateFilters } from "@/modules/candidates/filters";

export function ExportButton({ filters, total }: { filters: CandidateFilters; total: number }) {
  const [loading, setLoading] = useState(false);

  async function exportCsv() {
    setLoading(true);
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error(data?.error ?? "Não foi possível exportar.");
        return;
      }
      const blob = await response.blob();
      const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "candidatos.csv";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${total} candidatos exportados.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      className="h-11 md:h-10"
      onClick={exportCsv}
      disabled={loading || total === 0}
      aria-label="Exportar CSV"
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
      <span className="hidden sm:inline" aria-hidden>
        Exportar CSV
      </span>
    </Button>
  );
}
