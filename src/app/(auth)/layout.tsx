import { Wordmark } from "@/components/ui";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full w-full overflow-hidden">
      <div className="scroll-area mx-auto flex h-full w-full max-w-sm flex-col justify-center px-6 py-10">
        <header className="mb-10">
          <Wordmark />
          <p className="mt-3 text-sm text-muted">
            Registo de treino para dois. Só por convite.
          </p>
        </header>
        {children}
      </div>
    </div>
  );
}
