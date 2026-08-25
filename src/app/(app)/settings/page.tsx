import { redirect } from "next/navigation";
import { Panel, Section } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { InviteForm, SettingsForm } from "./forms";
import { InstallPrompt } from "./install";
import { NotificationSetting } from "./notifications";
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
    <div>
      <Section>
        <p className="label">Conta</p>
        <h1 className="display mt-2 text-[2rem] text-parchment">Definições</h1>
        <p className="mt-3 text-[0.9375rem] text-parchment">{me?.name}</p>
        <p className="text-sm text-muted">{me?.email}</p>
      </Section>

      <Panel title="Treino" flush>
        <SettingsForm
          daysPerWeek={settings?.days_per_week ?? 3}
          sessionMinutes={settings?.session_minutes ?? 60}
          equipment={settings?.equipment ?? "full_gym"}
        />
      </Panel>

      <Panel title="Membros" flush>
        <ul>
          {members?.map((member) => (
            <li key={member.id} className="gutter-x row block py-2.5">
              <p className="text-sm text-parchment">{member.name}</p>
              <p className="text-xs text-faint">{member.email}</p>
            </li>
          ))}
        </ul>
        {canInvite ? <InviteForm /> : null}
      </Panel>

      <Panel title="Aplicação" flush>
        <InstallPrompt />
      </Panel>

      <Section>
        <NotificationSetting
          publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
        />
      </Section>

      <Panel title="Os teus dados">
        <p className="text-sm leading-relaxed text-muted">
          Descarrega tudo o que já registaste — treinos, séries, pesos e
          planos — num ficheiro só teu.
        </p>
        <a href="/settings/export" download className="action mt-3.5 inline-block">
          Descarregar
        </a>
      </Panel>

      <Section last>
        <SignOutButton />
      </Section>

      <p className="gutter pb-6 text-center text-xs leading-relaxed text-faint">
        Esta aplicação é um registo de treino, não é aconselhamento médico.
        Começa leve, aprende a técnica e pára se alguma coisa doer.
      </p>
    </div>
  );
}
