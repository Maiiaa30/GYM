import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { BuildPlanForm } from "./build-form";

export const dynamic = "force-dynamic";

const PROFILE_LABEL: Record<string, string> = {
  full_gym: "Full gym",
  hotel: "Travelling",
  home_minimal: "Home",
};

function repRange(low: number, high: number) {
  return low === high ? `${low}` : `${low}–${high}`;
}

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

  const { data: days } = plan
    ? await supabase
        .from("plan_days")
        .select("id, day_index, name, focus")
        .eq("plan_id", plan.id)
        .order("day_index")
    : { data: null };

  const { data: items } = days?.length
    ? await supabase
        .from("plan_items")
        .select("plan_day_id, position, exercise, sets, rep_low, rep_high, notes")
        .in(
          "plan_day_id",
          days.map((day) => day.id),
        )
        .order("position")
    : { data: null };

  const { data: exercises } = items?.length
    ? await supabase
        .from("exercises")
        .select("slug, name")
        .in("slug", [...new Set(items.map((item) => item.exercise))])
    : { data: null };

  const nameBySlug = new Map(exercises?.map((e) => [e.slug, e.name]) ?? []);

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
        <>
          <Card className="p-5">
            <p className="label">Active block</p>
            <p className="mt-2 text-lg">{plan.name}</p>
            <p className="mt-1 text-sm text-muted">
              {plan.weeks} weeks from {plan.block_start}
            </p>
            {plan.rationale ? (
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {plan.rationale}
              </p>
            ) : null}
          </Card>

          {days?.map((day) => (
            <Card key={day.id}>
              <div className="flex items-baseline justify-between px-5 pt-4">
                <p className="font-[family-name:var(--font-display)] text-xl">
                  {day.name}
                </p>
                <p className="label">{day.focus}</p>
              </div>
              <ul className="mt-3 divide-y divide-line">
                {items
                  ?.filter((item) => item.plan_day_id === day.id)
                  .map((item) => (
                    <li
                      key={`${day.id}-${item.position}`}
                      className="flex items-center justify-between gap-4 px-5 py-3"
                    >
                      <span className="text-sm">
                        {nameBySlug.get(item.exercise) ?? item.exercise}
                        {item.notes ? (
                          <span className="mt-0.5 block text-xs text-faint">
                            {item.notes}
                          </span>
                        ) : null}
                      </span>
                      <span className="tabular whitespace-nowrap text-sm text-muted">
                        {item.sets} × {repRange(item.rep_low, item.rep_high)}
                      </span>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}

          <BuildPlanForm replacing />
        </>
      ) : (
        <Card className="space-y-4 p-5">
          <p className="text-sm leading-relaxed text-muted">
            No block yet. The built-in template is a full-body programme around
            the squat, the hinge, a press and a pull — the fastest way for a
            beginner to get strong without guesswork.
          </p>
          <BuildPlanForm replacing={false} />
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
