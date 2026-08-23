import { Button, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../../(auth)/actions";
import { InviteForm, SettingsForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: settings }, { data: me }, { data: members }] =
    await Promise.all([
      supabase
        .from("household_settings")
        .select("days_per_week, session_minutes, equipment")
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("name, email, height_cm, is_owner")
        .eq("id", user!.id)
        .maybeSingle(),
      supabase.from("profiles").select("id, name, email").order("created_at"),
    ]);

  const canInvite = Boolean(me?.is_owner) && (members?.length ?? 0) < 2;

  return (
    <div className="space-y-6">
      <header>
        <p className="label">Account</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl">
          Settings
        </h1>
      </header>

      <Card>
        <div className="px-5 py-4">
          <p className="label">Signed in as</p>
          <p className="mt-1">{me?.name}</p>
          <p className="text-sm text-muted">{me?.email}</p>
        </div>
      </Card>

      <section>
        <p className="label mb-2">Training</p>
        <Card>
          <SettingsForm
            daysPerWeek={settings?.days_per_week ?? 3}
            sessionMinutes={settings?.session_minutes ?? 60}
            equipment={settings?.equipment ?? "full_gym"}
          />
        </Card>
      </section>

      <section>
        <p className="label mb-2">Members</p>
        <Card>
          <ul className="divide-y divide-line">
            {members?.map((member) => (
              <li key={member.id} className="px-5 py-3">
                <p className="text-sm">{member.name}</p>
                <p className="text-xs text-faint">{member.email}</p>
              </li>
            ))}
          </ul>
          {canInvite ? (
            <div className="rule">
              <InviteForm />
            </div>
          ) : null}
        </Card>
      </section>

      <form action={signOut}>
        <Button type="submit" variant="ghost" className="w-full">
          Sign out
        </Button>
      </form>

      <p className="pb-2 text-center text-xs leading-relaxed text-faint">
        This application is a training log, not medical advice. Start light,
        learn the technique, and stop if something hurts.
      </p>
    </div>
  );
}
