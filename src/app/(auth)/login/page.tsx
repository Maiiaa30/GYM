"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, type FormState } from "../actions";
import { Button, Field, Notice } from "@/components/ui";

const initialState: FormState = { error: null };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="space-y-5">
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
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <Submit />
      <p className="pt-2 text-center text-xs text-faint">
        Invited?{" "}
        <Link href="/join" className="text-brass underline underline-offset-4">
          Set up your account
        </Link>
      </p>
    </form>
  );
}
