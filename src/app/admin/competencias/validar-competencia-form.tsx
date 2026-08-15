"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { validarCompetencia, revocarCompetencia } from "./actions";

export function ValidarCompetenciaForm({
  competenciaId,
  personas,
  validadas,
}: {
  competenciaId: string;
  personas: { id: string; nombre: string | null; email: string }[];
  validadas: string[];
}) {
  const [personaId, setPersonaId] = useState(personas[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (personas.length === 0) {
    return null;
  }

  const yaValidada = validadas.includes(personaId);

  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <select
          aria-label="Persona"
          value={personaId}
          onChange={(e) => setPersonaId(e.target.value)}
          className="border border-tinta/20 bg-transparent px-2 py-1 font-mono text-sm"
        >
          {personas.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.nombre ?? persona.email}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                if (yaValidada) {
                  await revocarCompetencia(competenciaId, personaId);
                } else {
                  await validarCompetencia(competenciaId, personaId);
                }
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "No se pudo guardar.");
              }
            });
          }}
          className="font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline disabled:text-tinta/30 disabled:no-underline"
        >
          {yaValidada ? "Revocar" : "Validar"}
        </button>
      </div>
      {error && <p className="font-mono text-sm text-red-700">{error}</p>}
    </div>
  );
}
