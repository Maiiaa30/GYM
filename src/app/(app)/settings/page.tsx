import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { InviteForm, SettingsForm } from "./forms";
import { InstallPrompt } from "./install";
import { SignOutButton } from "./sign-out";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: settings }, { data: me }, { data: members }] =
    await Promise.all([
      supabase
        .from("household_settings")
        .select("days_per_week, session_minutes, equipment")
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("name, email, height_cm, is_owner")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("profiles").select("id, name, email").order("created_at"),
    ]);

  const canInvite = Boolean(me?.is_owner) && (members?.length ?? 0) < 2;

  return (
    <div className="space-y-6">
      <header>
        <p className="label">Conta</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl">
          Definições
        </h1>
      </header>

      <Card>
        <div className="px-5 py-4">
          <p className="label">Sessão iniciada como</p>
          <p className="mt-1">{me?.name}</p>
          <p className="text-sm text-muted">{me?.email}</p>
        </div>
      </Card>

      <section>
        <p className="label mb-2">Treino</p>
        <Card>
          <SettingsForm
            daysPerWeek={settings?.days_per_week ?? 3}
            sessionMinutes={settings?.session_minutes ?? 60}
            equipment={settings?.equipment ?? "full_gym"}
          />
        </Card>
      </section>

      <section>
        <p className="label mb-2">Membros</p>
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

      <section>
        <p className="label mb-2">Aplicação</p>
        <Card>
          <InstallPrompt />
        </Card>
      </section>

      <SignOutButton />

      <p className="pb-2 text-center text-xs leading-relaxed text-faint">
        Esta aplicação é um registo de treino, não é aconselhamento médico.
        Começa leve, aprende a técnica e pára se alguma coisa doer.
      </p>
    </div>
  );
}
