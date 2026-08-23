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
      <BottomNav />
    </div>
  );
}
