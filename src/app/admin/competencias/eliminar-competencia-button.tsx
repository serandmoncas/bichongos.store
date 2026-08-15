"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCompetencia } from "./actions";

export function EliminarCompetenciaButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (
          !window.confirm(
            "¿Eliminar esta competencia? Se pierden también las validaciones de quienes la lograron."
          )
        ) {
          return;
        }
        startTransition(async () => {
          try {
            await deleteCompetencia(id);
            router.refresh();
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
