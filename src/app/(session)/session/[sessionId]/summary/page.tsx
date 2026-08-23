import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { sessionVolume } from "@/lib/progression";

export const dynamic = "force-dynamic";

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session } = await supabase
    .from("sessions")
    .select("id, plan_day_id, started_at, ended_at, performed_on, status")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!session) notFound();

  const [{ data: logs }, { data: day }, { data: records }] = await Promise.all([
    supabase
      .from("set_logs")
      .select("exercise, weight_kg, reps, completed, is_warmup")
      .eq("session_id", sessionId)
      .eq("user_id", user.id),
    supabase
      .from("plan_days")
      .select("name, focus")
      .eq("id", session.plan_day_id ?? "")
      .maybeSingle(),
    supabase
      .from("personal_records")
      .select("exercise, weight_kg, reps")
      .eq("user_id", user.id)
      .eq("achieved_on", session.performed_on),
  ]);

  const slugs = [...new Set((logs ?? []).map((log) => log.exercise))];

  const { data: exercises } = slugs.length
    ? await supabase
        .from("exercises")
        .select("slug, name, is_timed")
        .in("slug", slugs)
    : { data: null };

  const nameBySlug = new Map(exercises?.map((e) => [e.slug, e.name]) ?? []);
  const timedSlugs = new Set(
    exercises?.filter((e) => e.is_timed).map((e) => e.slug) ?? [],
  );

  const volume = sessionVolume(
    (logs ?? []).map((log) => ({
      weightKg: log.weight_kg === null ? null : Number(log.weight_kg),
      reps: log.reps,
      completed: log.completed,
      isWarmup: log.is_warmup,
    })),
  );

  const workingSets = (logs ?? []).filter(
    (log) => !log.is_warmup && log.completed,
  );

  const minutes =
    session.ended_at && session.started_at
      ? Math.max(
          1,
          Math.round(
            (new Date(session.ended_at).getTime() -
              new Date(session.started_at).getTime()) /
              60000,
          ),
        )
      : null;

  const byExercise = slugs.map((slug) => {
    const sets = workingSets.filter((log) => log.exercise === slug);
    const heaviest = sets.reduce(
      (max, log) => Math.max(max, Number(log.weight_kg ?? 0)),
      0,
    );
    const reps = sets.reduce((total, log) => total + (log.reps ?? 0), 0);
    return {
      slug,
      sets: sets.length,
      heaviest,
      reps,
      timed: timedSlugs.has(slug),
    };
  });

  return (
    <div className="scroll-area h-full">
      <div
        className="mx-auto w-full max-w-md space-y-6 px-5 pb-10"
        style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
      >
        <header>
          <p className="label">{day?.name ?? "Treino"} concluído</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl">
            Bom trabalho
          </h1>
        </header>

        <Card className="grid grid-cols-3 divide-x divide-line">
          <Metric label="Volume" value={`${Math.round(volume)}`} unit="kg" />
          <Metric label="Séries" value={String(workingSets.length)} unit="" />
          <Metric
            label="Duração"
            value={minutes === null ? "—" : String(minutes)}
            unit={minutes === null ? "" : "min"}
          />
        </Card>

        {records && records.length > 0 ? (
          <Card className="p-5">
            <p className="label">Novos recordes pessoais</p>
            <ul className="mt-3 space-y-2">
              {records.map((record) => (
                <li key={record.exercise} className="text-sm">
                  <span className="text-brass">
                    {nameBySlug.get(record.exercise) ?? record.exercise}
                  </span>{" "}
                  — {Number(record.weight_kg)} kg × {record.reps}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card>
          <p className="label px-5 pt-4">O que levantaste</p>
          <ul className="mt-2 divide-y divide-line">
            {byExercise.map((row) => (
              <li
                key={row.slug}
                className="flex items-center justify-between px-5 py-3"
              >
                <span className="text-sm">
                  {nameBySlug.get(row.slug) ?? row.slug}
                </span>
                <span className="tabular text-sm text-muted">
                  {row.sets} séries · {row.reps} {row.timed ? "s" : "reps"}
                  {row.heaviest > 0 ? ` · ${row.heaviest} kg` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <p className="label">Próximo treino</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Todos os exercícios em que fizeste as repetições todas sobem de
            carga para a próxima. O que falhaste fica na mesma; se falhares duas
            vezes seguidas, desce dez por cento para voltares a subir.
          </p>
        </Card>

        <Link
          href="/"
          className="block rounded-[var(--radius-md)] border border-brass bg-brass py-4 text-center font-medium text-ink"
        >
          Feito
        </Link>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="px-4 py-5 text-center">
      <p className="label">{label}</p>
      <p className="tabular mt-2 font-[family-name:var(--font-display)] text-3xl">
        {value}
        {unit ? <span className="ml-1 text-sm text-muted">{unit}</span> : null}
      </p>
    </div>
  );
}
