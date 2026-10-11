import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <h1 className="text-lg font-semibold">Página não encontrada</h1>
      <p className="mt-1 text-sm text-muted-foreground">O endereço não existe ou o registro foi removido.</p>
      <Button asChild className="mt-6 h-11">
        <Link href="/inicio">Voltar ao início</Link>
      </Button>
    </main>
  );
}
