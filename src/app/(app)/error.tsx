"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error.digest ?? "client_error");
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="size-5 text-red-600" aria-hidden />
      </span>
      <h1 className="text-lg font-semibold">Algo deu errado</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Não foi possível carregar esta página. Tente novamente; se persistir, recarregue o aplicativo.
      </p>
      <Button onClick={reset} className="mt-6 h-11">
        Tentar novamente
      </Button>
    </div>
  );
}
