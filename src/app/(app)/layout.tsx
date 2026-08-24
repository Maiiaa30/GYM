import Link from "next/link";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/nav";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarded_at) redirect("/onboarding");

  // Stepping out of a session is allowed, so the way back has to follow you
  // around: without this the only route back is the Hoje screen.
  const { data: openSession } = await supabase
    .from("sessions")
    .select("id, started_at")
    .eq("user_id", user.id)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="grid h-full grid-rows-[1fr_auto]">
      <main className="scroll-area">
        <div
          className="mx-auto w-full max-w-md px-5 pb-6"
          style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
        >
          {children}
        </div>
      </main>

      {openSession ? (
        <Link
          href={`/session/${openSession.id}`}
          className="flex items-center justify-between gap-3 border-t border-brass-dim bg-raised px-5 py-3"
        >
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full bg-brass"
            />
            <span className="text-sm text-parchment">Treino a meio</span>
          </span>
          <span className="text-xs uppercase tracking-[0.14em] text-brass">
            Retomar
          </span>
        </Link>
      ) : null}

      <BottomNav />
    </div>
  );
}
