import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/clock";

export const dynamic = "force-dynamic";

/**
 * Everything this account has recorded, as one JSON file.
 *
 * Years of training live in a single hosted database with no way of getting
 * them out. This is that way: their own rows, read under row level security
 * like any other request, so it can only ever return what the caller could
 * already see.
 *
 * The shared programme comes along because a session is unreadable without the
 * exercise it refers to.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const [
    { data: profile },
    { data: sessions },
    { data: sessionItems },
    { data: setLogs },
    { data: progression },
    { data: records },
    { data: bodyLogs },
    { data: plans },
    { data: planDays },
    { data: planItems },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("sessions").select("*").eq("user_id", user.id).order("performed_on"),
    supabase.from("session_items").select("*").eq("user_id", user.id),
    supabase.from("set_logs").select("*").eq("user_id", user.id).order("logged_at"),
    supabase.from("progression").select("*").eq("user_id", user.id),
    supabase.from("personal_records").select("*").eq("user_id", user.id),
    supabase.from("body_logs").select("*").eq("user_id", user.id).order("measured_on"),
    supabase.from("plans").select("*").order("block_start"),
    supabase.from("plan_days").select("*"),
    supabase.from("plan_items").select("*"),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    profile,
    body_logs: bodyLogs ?? [],
    sessions: sessions ?? [],
    session_items: sessionItems ?? [],
    set_logs: setLogs ?? [],
    progression: progression ?? [],
    personal_records: records ?? [],
    plans: plans ?? [],
    plan_days: planDays ?? [],
    plan_items: planItems ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="gym-${today()}.json"`,
      // Personal data: never let anything between here and the phone keep it.
      "Cache-Control": "no-store, private",
    },
  });
}
