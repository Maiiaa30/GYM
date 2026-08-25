import { redirect } from "next/navigation";
import { Section, Stat, StatGrid } from "@/components/ui";
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
    <div>
      <Section>
        <p className="label text-amber">
          {plan
            ? plan.source === "generated"
              ? "Programa à medida"
              : "Programa de base"
            : "Programa"}
        </p>
        <h1 className="display mt-2 text-[2rem] leading-[1.05] text-parchment">
          {plan ? plan.name : "Plano"}
        </h1>
        {plan ? (
          <p className="tabular mt-1.5 text-[0.84375rem] text-muted">
            {plan.weeks} semanas · desde {plan.block_start}
          </p>
        ) : null}
      </Section>

      <div className="border-b border-line">
        <StatGrid>
          <Stat
            value={settings ? String(settings.days_per_week) : "—"}
            label="dias/sem"
          />
          <Stat
            value={settings ? PROFILE_LABEL[settings.equipment] : "—"}
            label="onde"
          />
          <Stat
            value={settings ? String(settings.session_minutes) : "—"}
            label="minutos"
          />
        </StatGrid>
      </div>

      {plan ? (
        <>
          {plan.rationale ? (
            <Section>
              <details className="disclosure">
                <summary className="action">Porquê este plano</summary>
                <p className="pt-2 text-sm leading-relaxed text-muted">
                  {plan.rationale}
                </p>
              </details>
            </Section>
          ) : null}

          {days?.map((day) => {
            const dayItems = (items ?? []).filter(
              (item) => item.plan_day_id === day.id,
            );
            const done = summaryByDay.get(day.id);

            return (
              <Section key={day.id}>
                <div className="flex items-start justify-between gap-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="display text-[1.4375rem] leading-[1.05] text-parchment">
                      {day.name}
                    </p>
                    <p className="mt-1 text-[0.78125rem] text-muted">
                      {day.focus}
                      {day.focus ? " · " : ""}
                      {dayItems.length} exercícios ·{" "}
                      {formatMinutes(minutesByDay.get(day.id) ?? 0)}
                    </p>
                  </div>
                </div>

                {done ? (
                  <p className="tabular mt-3.5 border-l-[3px] border-amber pl-3 text-[0.78125rem] leading-relaxed text-muted">
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
                  <p className="mt-3.5 border-l-[3px] border-line-strong pl-3 text-[0.78125rem] text-faint">
                    Ainda não fizeste este treino.
                  </p>
                )}

                <details className="disclosure mt-2">
                  <summary className="action">Ver os exercícios</summary>
                  <ul className="pb-1">
                    {dayItems.map((item) => (
                      <li
                        key={`${day.id}-${item.position}`}
                        className="row"
                      >
                        <span className="min-w-0 flex-1 text-[0.90625rem] text-parchment">
                          {exerciseBySlug.get(item.exercise)?.name ??
                            item.exercise}
                          {item.notes ? (
                            <span className="mt-0.5 block text-[0.78125rem] text-faint">
                              {item.notes}
                            </span>
                          ) : null}
                        </span>
                        <span className="display shrink-0 text-[1.0625rem] font-semibold text-muted">
                          {item.sets} × {repRange(item.rep_low, item.rep_high)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </Section>
            );
          })}

          <Section last>
            <BuildPlanForm replacing />
          </Section>
        </>
      ) : (
        <Section last className="space-y-4">
          <p className="text-sm leading-relaxed text-muted">
            Ainda não tens plano. O de base é de corpo inteiro e anda à volta de
            quatro coisas: agachar, levantar do chão, empurrar e puxar.
          </p>
          <BuildPlanForm replacing={false} />
        </Section>
      )}
    </div>
  );
}
