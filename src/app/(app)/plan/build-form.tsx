"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  buildTemplatePlan,
  generateTailoredPlan,
  type PlanState,
} from "./actions";
import { Button, Notice } from "@/components/ui";

const initialState: PlanState = { error: null, source: null, notice: null };

function Submit({
  label,
  busy,
  variant,
}: {
  label: string;
  busy: string;
  variant: "primary" | "quiet";
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={variant === "primary" ? "lg" : "md"}
      className="w-full"
      disabled={pending}
    >
      {pending ? busy : label}
    </Button>
  );
}

export function BuildPlanForm({ replacing }: { replacing: boolean }) {
  const [tailored, tailoredAction] = useActionState(
    generateTailoredPlan,
    initialState,
  );
  const [template, templateAction] = useActionState(
    buildTemplatePlan,
    initialState,
  );

  const error = tailored.error ?? template.error;
  const notice = tailored.notice ?? template.notice;

  return (
    <div className="space-y-3">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice ? <Notice>{notice}</Notice> : null}

      <form action={tailoredAction}>
        <Submit
          variant="primary"
          label={replacing ? "Build a new block for us" : "Build our first block"}
          busy="Writing the block…"
        />
      </form>

      <form action={templateAction}>
        <Submit
          variant="quiet"
          label="Use the standard programme instead"
          busy="Building…"
        />
      </form>

      <p className="text-xs leading-relaxed text-faint">
        A tailored block is written around your heights, body weights, the
        weights you are currently lifting and anything you have flagged as
        painful. The standard programme is the same proven full-body routine for
        everyone.
        {replacing
          ? " Either way, your history and current working weights are kept."
          : ""}
      </p>
    </div>
  );
}
