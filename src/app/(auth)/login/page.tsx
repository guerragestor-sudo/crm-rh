import type { Metadata } from "next";

import { LoginForm } from "@/modules/auth/components/login-form";
import { safeNextPath } from "@/modules/auth/schema";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next) ?? undefined;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground">
            RH
          </div>
          <h1 className="text-xl font-semibold tracking-tight">CRM Recrutamento</h1>
          <p className="mt-1 text-sm text-muted-foreground">Entre para acessar seus candidatos.</p>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <LoginForm next={nextPath} />
        </div>
      </div>
    </main>
  );
}
