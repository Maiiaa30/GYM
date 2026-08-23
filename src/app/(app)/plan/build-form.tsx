"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { buildTemplatePlan, type PlanState } from "./actions";
import { Button, Notice } from "@/components/ui";

const initialState: PlanState = { error: null };

function Submit({ replacing }: { replacing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={replacing ? "quiet" : "primary"}
      size={replacing ? "md" : "lg"}
      className="w-full"
      disabled={pending}
    >
      {pending
        ? "Building…"
        : replacing
          ? "Rebuild from the current settings"
          : "Build the first block"}
    </Button>
  );
}

export function BuildPlanForm({ replacing }: { replacing: boolean }) {
  const [state, formAction] = useActionState(buildTemplatePlan, initialState);

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <Submit replacing={replacing} />
      {replacing ? (
        <p className="text-xs text-faint">
          Rebuilding replaces the current block. Your training history and the
          weights you have worked up to are kept.
        </p>
      ) : null}
    </form>
  );
}
