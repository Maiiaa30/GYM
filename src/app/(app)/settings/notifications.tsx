"use client";

import { useEffect, useState } from "react";
import { Button, Notice } from "@/components/ui";
import { removeSubscription, saveSubscription } from "./push-actions";

/**
 * Turning notifications on for this device.
 *
 * Per device, not per account: the subscription belongs to a browser, so the
 * phone and the laptop are answered separately. On iOS this only works once
 * the application has been added to the home screen, which is stated rather
 * than discovered.
 */

/** The key arrives base64url from the server and has to go out as bytes. */
function decodeKey(key: string): Uint8Array {
  const padded = (key + "=".repeat((4 - (key.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

type State = "checking" | "unsupported" | "needs-install" | "off" | "on" | "blocked";

export function NotificationSetting({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const look = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        // iOS only exposes PushManager to an installed application.
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const installed = window.matchMedia("(display-mode: standalone)").matches;
        if (!cancelled) setState(iOS && !installed ? "needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("blocked");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (!cancelled) setState(existing ? "on" : "off");
    };

    void look();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = async () => {
    if (!publicKey) {
      setError("As notificações ainda não estão configuradas no servidor.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeKey(publicKey) as BufferSource,
      });

      const raw = subscription.toJSON();
      const result = await saveSubscription({
        endpoint: subscription.endpoint,
        p256dh: raw.keys?.p256dh ?? "",
        auth: raw.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });

      if (result.error) {
        setError(result.error);
        await subscription.unsubscribe();
        setState("off");
        return;
      }
      setState("on");
    } catch {
      setError("Não deu para ligar as notificações neste telemóvel.");
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removeSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="label">Avisos</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Um aviso quando o outro já treinou e tu ainda não, e quando o descanso
        acaba com o telemóvel no bolso. Neste aparelho apenas.
      </p>

      {state === "checking" ? null : state === "needs-install" ? (
        <p className="mt-3 text-xs leading-relaxed text-faint">
          No iPhone só funciona depois de adicionares a aplicação ao ecrã
          principal. Faz isso primeiro e volta aqui.
        </p>
      ) : state === "unsupported" ? (
        <p className="mt-3 text-xs text-faint">
          Este navegador não sabe mostrar avisos.
        </p>
      ) : state === "blocked" ? (
        <p className="mt-3 text-xs leading-relaxed text-faint">
          Bloqueaste os avisos para este site. Tens de os voltar a permitir nas
          definições do navegador.
        </p>
      ) : (
        <Button
          variant="quiet"
          className="mt-3 w-full"
          disabled={busy}
          onClick={() => void (state === "on" ? disable() : enable())}
        >
          {busy
            ? "Um momento…"
            : state === "on"
              ? "Desligar os avisos"
              : "Ligar os avisos"}
        </Button>
      )}

      {error ? (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
    </div>
  );
}
