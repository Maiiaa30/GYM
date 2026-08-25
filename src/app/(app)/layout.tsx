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
        {/*
          No horizontal padding here: every section owns its own gutter, so a
          divided list or a heatmap can reach the edge of the screen while the
          text beside it stays inset. The plate is the page, not a column of
          boxes floating on one.
        */}
        <div
          className="mx-auto w-full max-w-md"
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
        >
          {children}
        </div>
      </main>

      {openSession ? (
        <Link
          href={`/session/${openSession.id}`}
          className="flex items-center justify-between gap-3 border-t border-amber bg-raised px-[var(--gutter)] py-3"
        >
          <span className="flex items-center gap-2.5">
            <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 bg-amber" />
            <span className="text-sm text-parchment">Treino a meio</span>
          </span>
          <span className="action">Retomar</span>
        </Link>
      ) : null}

      <BottomNav />
    </div>
  );
}
