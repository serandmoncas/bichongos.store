"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteContenido } from "../actions";

export function EliminarContenidoButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm("¿Eliminar este contenido? No se puede deshacer.")) {
          return;
        }
        startTransition(async () => {
          try {
            await deleteContenido(id);
            router.push("/admin/contenidos");
          } catch (err) {
            window.alert(err instanceof Error ? err.message : "No se pudo eliminar.");
          }
        });
      }}
      className="font-mono text-sm uppercase tracking-wide text-terracota underline disabled:text-tinta/30 disabled:no-underline"
    >
      Eliminar
    </button>
  );
}
