"use client";

import "./globals.css";

/** Falha no layout raiz: página mínima, sem depender de dados nem do shell. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-dvh items-center justify-center bg-background px-4 font-sans text-foreground">
        <main className="max-w-sm text-center">
          <h1 className="text-lg font-semibold">O aplicativo encontrou um erro</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tente novamente. Se persistir, recarregue a página.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
