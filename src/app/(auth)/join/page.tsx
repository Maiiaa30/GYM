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
      {pending ? "Setting up…" : "Create my password"}
    </Button>
  );
}

export default function JoinPage() {
  const [state, formAction] = useActionState(redeemInvite, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <Notice>
        Use the email your account was created with and the invitation code you
        were given.
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
        label="Invitation code"
        name="code"
        autoCapitalize="characters"
        autoComplete="one-time-code"
        placeholder="XXXX-XXXX"
        required
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        required
      />
      <Field
        label="Repeat password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
      />
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <Submit />
      <p className="pt-2 text-center text-xs text-faint">
        Already set up?{" "}
        <Link href="/login" className="text-brass underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
