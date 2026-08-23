import Link from "next/link";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { TodayCard, type TodayDay } from "./today-card";

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

  const { data: openSession } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", user!.id)
    .eq("status", "in_progress")
    .eq("performed_on", new Date().toISOString().slice(0, 10))
    .maybeSingle();

  const { data: items } = days?.length
    ? await supabase
        .from("plan_items")
        .select("plan_day_id, position, exercise, sets, rep_low, rep_high")
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

  const cardDays: TodayDay[] = (days ?? []).map((day) => ({
    id: day.id,
    name: day.name,
    focus: day.focus,
    items: (items ?? [])
      .filter((item) => item.plan_day_id === day.id)
      .map((item) => ({
        name: nameBySlug.get(item.exercise) ?? item.exercise,
        sets: item.sets,
        repLow: item.rep_low,
        repHigh: item.rep_high,
      })),
  }));

  const suggestedIndex = cardDays.length
    ? (completedCount ?? 0) % cardDays.length
    : 0;

  return (
    <div className="space-y-6">
      <header>
        <p className="label">{todayLabel()}</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl leading-tight">
          {profile?.name ? `Olá, ${profile.name.split(" ")[0]}` : "Olá"}
        </h1>
      </header>

      {cardDays.length === 0 ? (
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
      ) : openSession ? (
        <Card className="p-5">
          <p className="label">Treino a decorrer</p>
          <p className="mt-2 text-sm text-muted">
            Tens um treino começado hoje.
          </p>
          <Link
            href={`/session/${openSession.id}`}
            className="mt-4 block rounded-[var(--radius-md)] border border-brass bg-brass py-4 text-center font-medium text-ink"
          >
            Retomar o treino
          </Link>
        </Card>
      ) : (
        <TodayCard days={cardDays} suggestedIndex={suggestedIndex} />
      )}

      {cardDays.length > 0 ? (
        <p className="text-center text-xs text-faint">
          {completedCount ?? 0} treinos concluídos
        </p>
      ) : null}
    </div>
  );
}
