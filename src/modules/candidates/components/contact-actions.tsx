import { Mail, MessageCircle, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { telHref, whatsappHref } from "@/lib/phone";
import { cn } from "@/lib/utils";

import { PendingPhoneBadge } from "./pending-phone-badge";

/**
 * Ações de contato de um toque (ligar / WhatsApp / e-mail). Sem integração: só abre o app do aparelho.
 * Sem telefone, mostra "Telefone pendente" no lugar de ligar/WhatsApp.
 */
export function ContactActions({
  phone,
  email,
  size = "default",
  showLabels = false,
  className,
}: {
  phone: string | null;
  email?: string | null;
  size?: "default" | "lg";
  showLabels?: boolean;
  className?: string;
}) {
  const buttonSize = size === "lg" ? "h-11" : "h-9";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {phone ? (
        <>
          <Button asChild variant="outline" className={cn(buttonSize, !showLabels && "w-11 px-0")}>
            <a href={telHref(phone)} aria-label="Ligar">
              <Phone className="size-4" aria-hidden />
              {showLabels ? "Ligar" : null}
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            className={cn(buttonSize, "text-green-700", !showLabels && "w-11 px-0")}
          >
            <a href={whatsappHref(phone)} target="_blank" rel="noopener noreferrer" aria-label="Abrir WhatsApp">
              <MessageCircle className="size-4" aria-hidden />
              {showLabels ? "WhatsApp" : null}
            </a>
          </Button>
        </>
      ) : (
        <PendingPhoneBadge />
      )}
      {email ? (
        <Button asChild variant="outline" className={cn(buttonSize, !showLabels && "w-11 px-0")}>
          <a href={`mailto:${email}`} aria-label="Enviar e-mail">
            <Mail className="size-4" aria-hidden />
            {showLabels ? "E-mail" : null}
          </a>
        </Button>
      ) : null}
    </div>
  );
}
