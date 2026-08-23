"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { logBodyWeight, type BodyLogState } from "./actions";
import { Button, Field, Notice } from "@/components/ui";

const initialState: BodyLogState = { error: null, saved: false };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="quiet" disabled={pending}>
      {pending ? "A guardar…" : "Registar"}
    </Button>
  );
}

export function WeightForm({ current }: { current: number | null }) {
  const [state, formAction] = useActionState(logBodyWeight, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Field
            label="Peso de hoje"
            name="weight_kg"
            type="number"
            step="0.1"
            inputMode="decimal"
            suffix="kg"
            defaultValue={current ?? undefined}
            required
          />
        </div>
        <Submit />
      </div>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.saved ? <Notice>Registado.</Notice> : null}
    </form>
  );
}
