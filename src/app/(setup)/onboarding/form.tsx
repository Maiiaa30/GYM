"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { completeOnboarding, type OnboardingState } from "./actions";
import { Button, Field, Notice } from "@/components/ui";

const initialState: OnboardingState = { error: null };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Saving…" : "Start training"}
    </Button>
  );
}

const SEX_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const [state, formAction] = useActionState(completeOnboarding, initialState);

  return (
    <form action={formAction} className="space-y-5 pb-10">
      <Field label="Name" name="name" defaultValue={defaultName} required />

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Height"
          name="height_cm"
          type="number"
          step="0.5"
          inputMode="decimal"
          suffix="cm"
          required
        />
        <Field
          label="Body weight"
          name="weight_kg"
          type="number"
          step="0.1"
          inputMode="decimal"
          suffix="kg"
          required
        />
      </div>

      <Field label="Date of birth" name="birth_date" type="date" />

      <div>
        <span className="label mb-2 block">Sex</span>
        <div className="flex gap-2">
          {SEX_OPTIONS.map((option) => (
            <label key={option.value} className="flex-1">
              <input
                type="radio"
                name="sex"
                value={option.value}
                className="peer sr-only"
              />
              <span className="flex h-12 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border border-line text-sm peer-checked:border-brass peer-checked:text-brass">
                {option.label}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-faint">
          Only used to set sensible starting loads. Leave blank to skip.
        </p>
      </div>

      <label className="block">
        <span className="label mb-2 block">Injuries or limitations</span>
        <textarea
          name="injury_notes"
          rows={3}
          placeholder="Optional. Anything that hurts, or movements to avoid."
          className="w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 py-2.5 text-parchment placeholder:text-faint focus:border-brass focus:outline-none"
        />
      </label>

      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <Submit />
    </form>
  );
}
