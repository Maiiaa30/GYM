"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createInvite,
  updateSettings,
  type InviteState,
  type SettingsState,
} from "./actions";
import { Button, Field, Notice } from "@/components/ui";
import type { EquipmentProfile } from "@/lib/database.types";

const settingsInitial: SettingsState = { error: null, saved: false };
const inviteInitial: InviteState = { error: null, code: null };

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="quiet" disabled={pending} className="w-full">
      {pending ? busy : label}
    </Button>
  );
}

const EQUIPMENT_OPTIONS: Array<{ value: EquipmentProfile; label: string }> = [
  { value: "full_gym", label: "Ginásio" },
  { value: "hotel", label: "Em viagem" },
  { value: "home_minimal", label: "Em casa" },
];

export function SettingsForm({
  daysPerWeek,
  sessionMinutes,
  equipment,
}: {
  daysPerWeek: number;
  sessionMinutes: number;
  equipment: EquipmentProfile;
}) {
  const [state, formAction] = useActionState(updateSettings, settingsInitial);

  return (
    <form action={formAction} className="space-y-5 p-5">
      <div>
        <span className="label mb-2 block">Dias de treino por semana</span>
        <div className="flex gap-2">
          {[2, 3, 4, 5].map((n) => (
            <label key={n} className="flex-1">
              <input
                type="radio"
                name="days_per_week"
                value={n}
                defaultChecked={n === daysPerWeek}
                className="peer sr-only"
              />
              <span className="tabular flex h-12 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border border-line text-parchment peer-checked:border-brass peer-checked:text-brass">
                {n}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <span className="label mb-2 block">Equipamento</span>
        <div className="flex gap-2">
          {EQUIPMENT_OPTIONS.map((option) => (
            <label key={option.value} className="flex-1">
              <input
                type="radio"
                name="equipment"
                value={option.value}
                defaultChecked={option.value === equipment}
                className="peer sr-only"
              />
              <span className="flex h-12 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border border-line px-2 text-center text-sm text-parchment peer-checked:border-brass peer-checked:text-brass">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      <Field
        label="Duração do treino"
        name="session_minutes"
        type="number"
        inputMode="numeric"
        suffix="min"
        defaultValue={sessionMinutes}
        required
      />

      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.saved ? <Notice>Guardado.</Notice> : null}
      <Submit label="Guardar definições" busy="A guardar…" />
    </form>
  );
}

export function InviteForm() {
  const [state, formAction] = useActionState(createInvite, inviteInitial);

  if (state.code) {
    return (
      <div className="space-y-3 p-5">
        <p className="label">Código de convite</p>
        <p className="tabular font-[family-name:var(--font-display)] text-3xl tracking-[0.2em] text-brass">
          {state.code}
        </p>
        <p className="text-sm text-muted">
          Dá-lhe este código em pessoa. Só aparece uma vez e não pode ser lido
          outra vez. Ele introduz o código em{" "}
          <span className="text-parchment">/join</span>, junto com o email, para
          escolher a palavra-passe.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 p-5">
      <Field label="Nome dele" name="name" autoComplete="off" required />
      <Field
        label="Email dele"
        name="email"
        type="email"
        inputMode="email"
        autoCapitalize="none"
        autoComplete="off"
        required
      />
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <Submit label="Criar a conta dele" busy="A criar…" />
    </form>
  );
}
