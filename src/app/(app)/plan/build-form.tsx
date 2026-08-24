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
          label={replacing ? "Criar um plano novo para nós" : "Criar o nosso primeiro plano"}
          busy="A escrever o plano…"
        />
      </form>

      <form action={templateAction}>
        <Submit
          variant="quiet"
          label="Usar o plano de base"
          busy="A criar…"
        />
      </form>

      <details className="disclosure">
        <summary className="text-xs uppercase tracking-[0.14em] text-faint">
          Qual é a diferença
        </summary>
        <p className="pb-1 text-xs leading-relaxed text-faint">
          O plano à vossa medida é feito a partir das vossas alturas, pesos, dos
          pesos que já levantam e do que tiverem dito que dói. O de base é a
          mesma rotina de corpo inteiro para toda a gente.
          {replacing
            ? " Seja qual for, não perdes nada: o histórico e os pesos a que chegaste ficam na mesma."
            : ""}
        </p>
      </details>
    </div>
  );
}
