import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { signOut } from "@/modules/auth/actions";
import { getSessionStatus } from "@/server/auth/session";

export const metadata: Metadata = { title: "Sem acesso" };

export default async function NoAccessPage() {
  const status = await getSessionStatus();
  if (status === "anonymous") redirect("/login");
  if (status === "member") redirect("/inicio");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold">Acesso não liberado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua conta ainda não está vinculada a uma organização ativa. Fale com o administrador do sistema.
        </p>
        <form action={signOut} className="mt-6">
          <Button type="submit" variant="outline" className="h-11 w-full">
            Sair
          </Button>
        </form>
      </div>
    </main>
  );
}
