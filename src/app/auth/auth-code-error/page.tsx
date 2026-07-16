import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="font-serif text-2xl font-semibold">
        No pudimos iniciar tu sesión
      </h1>
      <p className="font-mono text-sm text-tinta/70">
        Ocurrió un error al conectar con Google. Intentá de nuevo.
      </p>
      <Link
        href="/login"
        className="font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline"
      >
        Volver a iniciar sesión
      </Link>
    </main>
  );
}
