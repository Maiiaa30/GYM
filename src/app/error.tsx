"use client";

import { useEffect } from "react";
import { Button, Card, Wordmark } from "@/components/ui";

/**
 * Anything that escapes a page ends here.
 *
 * The common case in practice is a tab left open across a deployment: the
 * server action it tries to call no longer exists under that identifier, and
 * the only cure is to load the new version. Say so plainly instead of showing
 * a stack trace.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const stale = /Server Action|not found on the server/i.test(error.message);

  return (
    <div className="scroll-area h-full">
      <div className="mx-auto flex h-full w-full max-w-sm flex-col justify-center px-6 py-10">
        <Wordmark />
        <Card className="mt-8 p-5">
          <p className="label">Alguma coisa correu mal</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {stale
              ? "Deixaste esta página aberta e entretanto saiu uma versão nova. Recarrega para ficares com a mais recente."
              : "Não deu para mostrar este ecrã. Tenta outra vez. Se voltar a acontecer, recarrega a página."}
          </p>
          <div className="mt-5 space-y-3">
            <Button
              className="w-full"
              onClick={() => window.location.reload()}
              size="lg"
            >
              Recarregar
            </Button>
            {!stale ? (
              <Button variant="quiet" className="w-full" onClick={reset}>
                Tentar outra vez
              </Button>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
