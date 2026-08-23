import Link from "next/link";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function today() {
  return new Date().toLocaleDateString("en-GB", {
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
    supabase
      .from("profiles")
      .select("name")
      .eq("id", user!.id)
      .maybeSingle(),
    supabase
      .from("plans")
      .select("id, name, equipment")
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="label">{today()}</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl leading-tight">
          {profile?.name ? `Good day, ${profile.name.split(" ")[0]}` : "Good day"}
        </h1>
      </header>

      {plan ? (
        <Card className="p-5">
          <p className="label">Current block</p>
          <p className="mt-2 text-lg">{plan.name}</p>
          <Link
            href="/plan"
            className="mt-4 inline-block text-sm text-brass underline underline-offset-4"
          >
            View the programme
          </Link>
        </Card>
      ) : (
        <Card className="p-5">
          <p className="label">No programme yet</p>
          <p className="mt-2 text-sm text-muted">
            Set your training days and equipment, then build the first block.
          </p>
          <Link
            href="/plan"
            className="mt-4 inline-block text-sm text-brass underline underline-offset-4"
          >
            Build a programme
          </Link>
        </Card>
      )}
    </div>
  );
}
