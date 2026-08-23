import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PROFILE_LABEL: Record<string, string> = {
  full_gym: "Full gym",
  hotel: "Travelling",
  home_minimal: "Home",
};

export default async function PlanPage() {
  const supabase = await createClient();

  const [{ data: settings }, { data: plan }] = await Promise.all([
    supabase
      .from("household_settings")
      .select("days_per_week, equipment, session_minutes")
      .maybeSingle(),
    supabase
      .from("plans")
      .select("id, name, block_start, weeks, equipment, source, rationale")
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="label">Programme</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl">
          Plan
        </h1>
      </header>

      <Card className="divide-y divide-line">
        <Row
          label="Days per week"
          value={settings ? String(settings.days_per_week) : "—"}
        />
        <Row
          label="Equipment"
          value={settings ? PROFILE_LABEL[settings.equipment] : "—"}
        />
        <Row
          label="Session length"
          value={settings ? `${settings.session_minutes} min` : "—"}
        />
      </Card>

      {plan ? (
        <Card className="p-5">
          <p className="label">Active block</p>
          <p className="mt-2 text-lg">{plan.name}</p>
          <p className="mt-1 text-sm text-muted">
            {plan.weeks} weeks from {plan.block_start}
          </p>
          {plan.rationale ? (
            <p className="mt-3 text-sm text-muted">{plan.rationale}</p>
          ) : null}
        </Card>
      ) : (
        <Card className="p-5">
          <p className="text-sm text-muted">
            No block has been built yet. Programme building arrives with the
            exercise catalogue.
          </p>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <span className="label">{label}</span>
      <span className="tabular text-parchment">{value}</span>
    </div>
  );
}
