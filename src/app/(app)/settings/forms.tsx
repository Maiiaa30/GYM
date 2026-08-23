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
  { value: "full_gym", label: "Full gym" },
  { value: "hotel", label: "Travelling" },
  { value: "home_minimal", label: "Home" },
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
        <span className="label mb-2 block">Training days per week</span>
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
        <span className="label mb-2 block">Equipment</span>
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
        label="Session length"
        name="session_minutes"
        type="number"
        inputMode="numeric"
        suffix="min"
        defaultValue={sessionMinutes}
        required
      />

      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.saved ? <Notice>Saved.</Notice> : null}
      <Submit label="Save settings" busy="Saving…" />
    </form>
  );
}

export function InviteForm() {
  const [state, formAction] = useActionState(createInvite, inviteInitial);

  if (state.code) {
    return (
      <div className="space-y-3 p-5">
        <p className="label">Invitation code</p>
        <p className="tabular font-[family-name:var(--font-display)] text-3xl tracking-[0.2em] text-brass">
          {state.code}
        </p>
        <p className="text-sm text-muted">
          Give this code to them in person. It is shown once and cannot be read
          again. They enter it at <span className="text-parchment">/join</span>{" "}
          together with their email to choose a password.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 p-5">
      <Field label="Their name" name="name" autoComplete="off" required />
      <Field
        label="Their email"
        name="email"
        type="email"
        inputMode="email"
        autoCapitalize="none"
        autoComplete="off"
        required
      />
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <Submit label="Create their account" busy="Creating…" />
    </form>
  );
}
