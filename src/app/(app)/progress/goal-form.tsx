"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { setWeightGoal, type GoalState } from "./actions";
import { Button, Field, Notice } from "@/components/ui";

const initialState: GoalState = { error: null, saved: false };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="quiet" size="field" disabled={pending}>
      {pending ? "A guardar…" : "Definir"}
    </Button>
  );
}

export function GoalForm({ current }: { current: number | null }) {
  const [state, formAction] = useActionState(setWeightGoal, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <Field
        label="Objetivo"
        name="weight_goal_kg"
        type="number"
        step="0.5"
        inputMode="decimal"
        suffix="kg"
        defaultValue={current ?? undefined}
        hint="Deixa em branco se não quiseres definir um objetivo."
        action={<Submit />}
      />
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.saved ? <Notice>Guardado.</Notice> : null}
    </form>
  );
}
