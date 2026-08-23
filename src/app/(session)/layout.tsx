import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * The training screen owns the whole viewport: no bottom navigation, nothing
 * to mis-tap between sets.
 */
export default async function SessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <div className="h-full w-full overflow-hidden">{children}</div>;
}
