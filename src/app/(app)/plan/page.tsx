import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { BuildPlanForm } from "./build-form";

export const dynamic = "force-dynamic";

// Writing a tailored block calls an external model; give it room.
export const maxDuration = 60;

const PROFILE_LABEL: Record<string, string> = {
  full_gym: "Ginásio",
  hotel: "Em viagem",
  home_minimal: "Em casa",
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
        <p className="label">Programa</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl">
          Plano
        </h1>
      </header>

      <Card className="divide-y divide-line">
        <Row
          label="Dias por semana"
          value={settings ? String(settings.days_per_week) : "—"}
        />
        <Row
          label="Equipamento"
          value={settings ? PROFILE_LABEL[settings.equipment] : "—"}
        />
        <Row
          label="Duração do treino"
          value={settings ? `${settings.session_minutes} min` : "—"}
        />
      </Card>

      {plan ? (
        <>
          <Card className="p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="label">Bloco activo</p>
              <p className="label text-brass-dim">
                {plan.source === "generated" ? "Personalizado" : "Padrão"}
              </p>
            </div>
            <p className="mt-2 text-lg">{plan.name}</p>
            <p className="mt-1 text-sm text-muted">
              {plan.weeks} semanas a partir de {plan.block_start}
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
            Ainda não há bloco. O programa padrão é de corpo inteiro, à volta do agachamento, da dobra de anca, de um empurrar e de um puxar — o caminho mais rápido para um principiante ficar forte sem adivinhar.
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
