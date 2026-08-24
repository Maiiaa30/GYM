"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Installing puts the app on the home screen, which is where it belongs: it
 * opens without browser furniture and keeps its own cache.
 *
 * Chrome hands over an event we can trigger from a button. Safari never does,
 * so the manual route is spelled out underneath rather than sniffed for.
 */
export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (raw: Event) => {
      raw.preventDefault();
      setEvent(raw as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };

    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <p className="px-5 py-4 text-sm text-muted">
        Já está instalada neste dispositivo.
      </p>
    );
  }

  return (
    <div className="space-y-3 px-5 py-4">
      {event ? (
        <Button
          variant="quiet"
          className="w-full"
          onClick={async () => {
            await event.prompt();
            await event.userChoice;
            setEvent(null);
          }}
        >
          Instalar no telemóvel
        </Button>
      ) : null}
      <p className="text-xs leading-relaxed text-faint">
        Instalada, abre sem barra do browser, guarda os exercícios e as imagens
        no telemóvel e funciona no ginásio sem rede. No iPhone: botão de
        partilha, depois &ldquo;Adicionar ao ecrã principal&rdquo;.
      </p>
    </div>
  );
}
