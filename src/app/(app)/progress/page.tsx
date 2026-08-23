import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { WeightForm } from "./weight-form";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: logs } = await supabase
    .from("body_logs")
    .select("measured_on, weight_kg")
    .eq("user_id", user!.id)
    .order("measured_on", { ascending: false })
    .limit(14);

  const latest = logs?.[0]?.weight_kg ?? null;
  const first = logs?.[logs.length - 1]?.weight_kg ?? null;
  const delta =
    latest !== null && first !== null ? Number(latest) - Number(first) : null;

  return (
    <div className="space-y-6">
      <header>
        <p className="label">Histórico</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl">
          Progresso
        </h1>
      </header>

      <Card className="p-5">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="label">Último registo</p>
            <p className="tabular mt-1 font-[family-name:var(--font-display)] text-5xl">
              {latest !== null ? Number(latest).toFixed(1) : "—"}
              <span className="ml-1 text-lg text-muted">kg</span>
            </p>
          </div>
          {delta !== null ? (
            <p className="tabular text-sm text-muted">
              {delta >= 0 ? "+" : ""}
              {delta.toFixed(1)} kg em {logs?.length ?? 0} registos
            </p>
          ) : null}
        </div>
        <div className="mt-5 rule pt-5">
          <WeightForm current={latest !== null ? Number(latest) : null} />
        </div>
      </Card>

      <Card>
        <p className="label px-5 pt-4">Registos recentes</p>
        {logs && logs.length > 0 ? (
          <ul className="mt-2 divide-y divide-line">
            {logs.map((log) => (
              <li
                key={log.measured_on}
                className="flex items-center justify-between px-5 py-3"
              >
                <span className="text-sm text-muted">{log.measured_on}</span>
                <span className="tabular text-sm">
                  {log.weight_kg !== null
                    ? `${Number(log.weight_kg).toFixed(1)} kg`
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-muted">Ainda não há registos.</p>
        )}
      </Card>
    </div>
  );
}
