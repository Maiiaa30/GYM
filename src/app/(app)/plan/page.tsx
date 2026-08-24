import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { today as todayInGym } from "@/lib/clock";
import { estimateMinutes, formatMinutes } from "@/lib/duration";
import { formatVolume, relativeDay, volumeOf } from "@/lib/home";
import { BuildPlanForm } from "./build-form";

export const dynamic = "force-dynamic";

// Writing a tailored block calls an external model; give it room.
export const maxDuration = 60;

const PROFILE_LABEL: Record<string, string> = {
  full_gym: "Ginásio",
  hotel: "Viagem",
  home_minimal: "Casa",
};

function repRange(low: number, high: number) {
  return low === high ? `${low}` : `${low}–${high}`;
}

export default async function PlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const today = todayInGym();

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

  const dayIds = (days ?? []).map((day) => day.id);

  const [{ data: items }, { data: sessions }] = await Promise.all([
    dayIds.length > 0
      ? supabase
          .from("plan_items")
          .select(
            "plan_day_id, position, exercise, sets, rep_low, rep_high, rest_sec, notes",
          )
          .in("plan_day_id", dayIds)
          .order("position")
      : Promise.resolve({ data: null }),
    // What they have actually done, which is the half the plan never showed.
    dayIds.length > 0
      ? supabase
          .from("sessions")
          .select("id, plan_day_id, performed_on")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .in("plan_day_id", dayIds)
          .order("performed_on", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const { data: exercises } = items?.length
    ? await supabase
        .from("exercises")
        .select("slug, name, family, is_timed")
        .in("slug", [...new Set(items.map((item) => item.exercise))])
    : { data: null };

  const exerciseBySlug = new Map(
    exercises?.map((exercise) => [exercise.slug, exercise]) ?? [],
  );

  // How often each day has been trained, and when it last was. Only the most
  // recent session of each needs its sets counted.
  const latestByDay = new Map<string, { id: string; on: string }>();
  const timesByDay = new Map<string, number>();
  for (const session of sessions ?? []) {
    const dayId = session.plan_day_id;
    if (!dayId) continue;
    timesByDay.set(dayId, (timesByDay.get(dayId) ?? 0) + 1);
    if (!latestByDay.has(dayId)) {
      latestByDay.set(dayId, { id: session.id, on: session.performed_on });
    }
  }

  const { data: latestSets } = latestByDay.size
    ? await supabase
        .from("set_logs")
        .select("session_id, weight_kg, reps")
        .eq("user_id", user.id)
        .eq("completed", true)
        .eq("is_warmup", false)
        .in(
          "session_id",
          [...latestByDay.values()].map((entry) => entry.id),
        )
    : { data: null };

  const summaryByDay = new Map<
    string,
    { times: number; when: string; sets: number; volumeKg: number }
  >();

  for (const [dayId, latest] of latestByDay) {
    const rows = (latestSets ?? []).filter(
      (row) => row.session_id === latest.id,
    );
    summaryByDay.set(dayId, {
      times: timesByDay.get(dayId) ?? 0,
      when: relativeDay(latest.on, today),
      sets: rows.length,
      volumeKg: volumeOf(
        rows.map((row) => ({
          weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
          reps: row.reps,
        })),
      ),
    });
  }

  const minutesByDay = new Map(
    (days ?? []).map((day) => [
      day.id,
      estimateMinutes(
        (items ?? [])
          .filter((item) => item.plan_day_id === day.id)
          .map((item) => {
            const exercise = exerciseBySlug.get(item.exercise);
            return {
              sets: item.sets,
              repLow: item.rep_low,
              repHigh: item.rep_high,
              restSec: item.rest_sec,
              isTimed: exercise?.is_timed,
              family: exercise?.family,
            };
          }),
      ),
    ]),
  );

  return (
    <div className="space-y-5">
      <header>
        <p className="label">Programa</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl">
          Plano
        </h1>
      </header>

      <Card className="grid grid-cols-3 divide-x divide-line">
        <Stat
          value={settings ? String(settings.days_per_week) : "—"}
          label="por semana"
        />
        <Stat
          value={settings ? PROFILE_LABEL[settings.equipment] : "—"}
          label="onde"
        />
        <Stat
          value={settings ? String(settings.session_minutes) : "—"}
          label="minutos"
        />
      </Card>

      {plan ? (
        <>
          <Card className="p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-[family-name:var(--font-display)] text-xl">
                {plan.name}
              </p>
              <p className="label shrink-0 text-brass-dim">
                {plan.source === "generated" ? "À medida" : "De base"}
              </p>
            </div>
            <p className="tabular mt-1 text-xs text-faint">
              {plan.weeks} semanas · desde {plan.block_start}
            </p>

            {plan.rationale ? (
              <details className="disclosure mt-1">
                <summary className="text-sm text-brass">
                  Porquê este plano
                </summary>
                <p className="pb-1 text-sm leading-relaxed text-muted">
                  {plan.rationale}
                </p>
              </details>
            ) : null}
          </Card>

          {days?.map((day) => {
            const dayItems = (items ?? []).filter(
              (item) => item.plan_day_id === day.id,
            );
            const done = summaryByDay.get(day.id);

            return (
              <Card key={day.id} className="p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <p className="font-[family-name:var(--font-display)] text-xl">
                      {day.name}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">{day.focus}</p>
                  </div>
                  <p className="tabular shrink-0 text-xs text-faint">
                    {formatMinutes(minutesByDay.get(day.id) ?? 0)}
                  </p>
                </div>

                {done ? (
                  <p className="tabular mt-3 border-l-2 border-brass-dim pl-3 text-xs leading-relaxed text-muted">
                    Já o fizeste {done.times === 1 ? "1 vez" : `${done.times} vezes`}.
                    <br />
                    <span className="text-faint">
                      Última {done.when}: {done.sets} séries
                      {done.volumeKg > 0
                        ? `, ${formatVolume(done.volumeKg)} kg`
                        : ""}
                    </span>
                  </p>
                ) : (
                  <p className="mt-3 border-l-2 border-line pl-3 text-xs text-faint">
                    Ainda não fizeste este treino.
                  </p>
                )}

                <details className="disclosure mt-1">
                  <summary className="text-sm text-brass">
                    {dayItems.length} exercícios
                  </summary>
                  <ul className="divide-y divide-line border-t border-line">
                    {dayItems.map((item) => (
                      <li
                        key={`${day.id}-${item.position}`}
                        className="flex items-baseline justify-between gap-4 py-2.5"
                      >
                        <span className="text-sm">
                          {exerciseBySlug.get(item.exercise)?.name ??
                            item.exercise}
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
                </details>
              </Card>
            );
          })}

          <BuildPlanForm replacing />
        </>
      ) : (
        <Card className="space-y-4 p-5">
          <p className="text-sm leading-relaxed text-muted">
            Ainda não tens plano. O de base é de corpo inteiro e anda à volta de
            quatro coisas: agachar, levantar do chão, empurrar e puxar.
          </p>
          <BuildPlanForm replacing={false} />
        </Card>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-2 py-4 text-center">
      <p className="tabular font-[family-name:var(--font-display)] text-2xl leading-none">
        {value}
      </p>
      <p className="mt-1.5 text-[0.625rem] uppercase tracking-[0.12em] text-faint">
        {label}
      </p>
    </div>
  );
}
