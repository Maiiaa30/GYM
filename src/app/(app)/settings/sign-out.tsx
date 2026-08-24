"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import { signOut } from "../../(auth)/actions";

/**
 * Signing out has to take the copies with it.
 *
 * The service worker keeps the last version of every page visited so the app
 * opens with no signal, and those pages are personal: weights, sessions, the
 * partner's numbers. Ending the session on the server left all of it sitting
 * in the browser's cache, readable by anyone holding the phone who put it into
 * aeroplane mode. The queue of unsent sets is emptied for the same reason.
 *
 * Cleared before the form is submitted, because the redirect that follows
 * never comes back here.
 */
async function forgetLocalCopies() {
  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith("gym-")).map((name) => caches.delete(name)),
      );
    }
  } catch {
    // Best effort: never block signing out.
  }

  try {
    indexedDB.deleteDatabase("gym");
  } catch {
    // Same.
  }
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" className="w-full" disabled={pending}>
      {pending ? "A sair…" : "Terminar sessão"}
    </Button>
  );
}

export function SignOutButton() {
  return (
    <form
      action={signOut}
      onSubmit={() => {
        void forgetLocalCopies();
      }}
    >
      <Submit />
    </form>
  );
}
