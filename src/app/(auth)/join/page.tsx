"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { redeemInvite, type FormState } from "../actions";
import { Button, Field, Notice } from "@/components/ui";

const initialState: FormState = { error: null };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "A criar…" : "Criar a minha palavra-passe"}
    </Button>
  );
}

export default function JoinPage() {
  const [state, formAction] = useActionState(redeemInvite, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <Notice>
        Usa o email com que a tua conta foi criada e o código de convite que te deram.
      </Notice>
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        autoCapitalize="none"
        required
      />
      <Field
        label="Código de convite"
        name="code"
        autoCapitalize="characters"
        autoComplete="one-time-code"
        placeholder="XXXX-XXXX"
        required
      />
      <Field
        label="Palavra-passe"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="Pelo menos 8 caracteres."
        required
      />
      <Field
        label="Repete a palavra-passe"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
      />
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <Submit />
      <p className="pt-2 text-center text-xs text-faint">
        Já tens conta?{" "}
        <Link href="/login" className="text-brass underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </form>
  );
}
