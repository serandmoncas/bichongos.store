"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { marcarLeido, desmarcarLeido } from "../lecturas-actions";

export function LecturaToggle({
  contenidoId,
  leido,
}: {
  contenidoId: string;
  leido: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              if (leido) {
                await desmarcarLeido(contenidoId);
              } else {
                await marcarLeido(contenidoId);
              }
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "No se pudo guardar.");
            }
          });
        }}
        className="w-fit font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline disabled:text-tinta/30 disabled:no-underline"
      >
        {leido ? "Marcar como no leído" : "Marcar como leído"}
      </button>
      {error && <p className="font-mono text-sm text-red-700">{error}</p>}
    </div>
  );
}
