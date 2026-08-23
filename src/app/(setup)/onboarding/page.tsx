import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarded_at) redirect("/");

  return (
    <div className="h-full w-full overflow-hidden">
      <div className="scroll-area mx-auto h-full w-full max-w-sm px-6 py-10">
        <header className="mb-8">
          <p className="label">Welcome</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl leading-tight">
            A few details
          </h1>
          <p className="mt-3 text-sm text-muted">
            Used to size the first programme and to track change over time. You
            can edit any of it later.
          </p>
        </header>
        <OnboardingForm defaultName={profile?.name ?? ""} />
      </div>
    </div>
  );
}
