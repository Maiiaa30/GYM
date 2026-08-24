"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { logBodyWeight, type BodyLogState } from "./actions";
import { Button, Field, Notice } from "@/components/ui";

const initialState: BodyLogState = { error: null, saved: false };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="quiet" size="field" disabled={pending}>
      {pending ? "A guardar…" : "Registar"}
    </Button>
  );
}

export function WeightForm({
  current,
  waist,
}: {
  current: number | null;
  waist: number | null;
}) {
  const [state, formAction] = useActionState(logBodyWeight, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Field
        label="Peso de hoje"
        name="weight_kg"
        type="number"
        step="0.1"
        inputMode="decimal"
        suffix="kg"
        defaultValue={current ?? undefined}
        required
        action={<Submit />}
      />

      <Field
        label="Cintura"
        name="waist_cm"
        type="number"
        step="0.5"
        inputMode="decimal"
        suffix="cm"
        defaultValue={waist ?? undefined}
        hint="Ao nível do umbigo, sem apertar. Uma vez por mês chega — diz-te se o peso que ganhaste é músculo."
      />
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.saved ? <Notice>Registado.</Notice> : null}
    </form>
  );
}
