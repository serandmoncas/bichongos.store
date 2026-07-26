export default function AdminNotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="font-serif text-2xl font-semibold">
        Esta sección aún no existe para tu rol
      </h1>
      <p className="max-w-md font-mono text-sm text-tinta/70">
        Tu cuenta está aprobada, pero esta parte del panel todavía no aplica a
        tu rol. La gestión del cultivo (Épica 5) está en construcción para
        roles distintos a admin. Usa la navegación de arriba para volver a una
        sección disponible.
      </p>
    </div>
  );
}
