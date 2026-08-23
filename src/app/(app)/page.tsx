import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { startSession } from "../(session)/session/actions";

export const dynamic = "force-dynamic";

function todayLabel() {
  return new Date().toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: plan }] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", user!.id).maybeSingle(),
    supabase
      .from("plans")
      .select("id, name")
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

  const { count: completedCount } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user!.id)
    .eq("status", "completed");

  const nextDay = days?.length
    ? days[(completedCount ?? 0) % days.length]
    : null;

  const { data: openSession } = await supabase
    .from("sessions")
    .select("id, plan_day_id")
    .eq("user_id", user!.id)
    .eq("status", "in_progress")
    .eq("performed_on", new Date().toISOString().slice(0, 10))
    .maybeSingle();

  const { data: items } = nextDay
    ? await supabase
        .from("plan_items")
        .select("position, exercise, sets, rep_low, rep_high")
        .eq("plan_day_id", nextDay.id)
        .order("position")
    : { data: null };

  const { data: exercises } = items?.length
    ? await supabase
        .from("exercises")
        .select("slug, name")
        .in("slug", items.map((item) => item.exercise))
    : { data: null };

  const nameBySlug = new Map(exercises?.map((e) => [e.slug, e.name]) ?? []);

  return (
    <div className="space-y-6">
      <header>
        <p className="label">{todayLabel()}</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl leading-tight">
          {profile?.name ? `Olá, ${profile.name.split(" ")[0]}` : "Olá"}
        </h1>
      </header>

      {!plan || !nextDay ? (
        <Card className="p-5">
          <p className="label">Ainda sem programa</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Define os dias de treino e o equipamento e cria o primeiro bloco.
          </p>
          <Link
            href="/plan"
            className="mt-4 inline-block text-sm text-brass underline underline-offset-4"
          >
            Criar um programa
          </Link>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex items-baseline justify-between px-5 pt-5">
              <div>
                <p className="label">Hoje</p>
                <p className="mt-1 font-[family-name:var(--font-display)] text-3xl">
                  {nextDay.name}
                </p>
              </div>
              <p className="text-xs text-faint">{nextDay.focus}</p>
            </div>

            <ul className="mt-4 divide-y divide-line">
              {items?.map((item) => (
                <li
                  key={item.position}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <span className="text-sm">
                    {nameBySlug.get(item.exercise) ?? item.exercise}
                  </span>
                  <span className="tabular text-sm text-muted">
                    {item.sets} ×{" "}
                    {item.rep_low === item.rep_high
                      ? item.rep_low
                      : `${item.rep_low}–${item.rep_high}`}
                  </span>
                </li>
              ))}
            </ul>

            <div className="p-5">
              {openSession ? (
                <Link
                  href={`/session/${openSession.id}`}
                  className="block rounded-[var(--radius-md)] border border-brass bg-brass py-4 text-center font-medium text-ink"
                >
                  Retomar o treino
                </Link>
              ) : (
                <form action={startSession}>
                  <input
                    type="hidden"
                    name="plan_day_id"
                    value={nextDay.id}
                  />
                  <Button type="submit" size="lg" className="w-full">
                    Começar o treino
                  </Button>
                </form>
              )}
            </div>
          </Card>

          <p className="text-center text-xs text-faint">
            {completedCount ?? 0} treinos concluídos
          </p>
        </>
      )}
    </div>
  );
}
