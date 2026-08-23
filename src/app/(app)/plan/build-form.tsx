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
          label={replacing ? "Criar um bloco novo para nós" : "Criar o nosso primeiro bloco"}
          busy="A escrever o bloco…"
        />
      </form>

      <form action={templateAction}>
        <Submit
          variant="quiet"
          label="Usar antes o programa padrão"
          busy="A criar…"
        />
      </form>

      <p className="text-xs leading-relaxed text-faint">
        Um bloco personalizado é escrito a partir das vossas alturas, pesos,
        cargas actuais e do que tiverem assinalado como dolorido. O programa
        padrão é a mesma rotina de corpo inteiro para toda a gente.
        {replacing
          ? " Em qualquer dos casos, o histórico e as cargas actuais mantêm-se."
          : ""}
      </p>
    </div>
  );
}
