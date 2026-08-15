"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { asignarTarea } from "./actions";
import type { RegistroTipo } from "../lotes/registros-actions";

const TIPOS: { value: RegistroTipo; label: string }[] = [
  { value: "riego", label: "Riego" },
  { value: "humedad", label: "Humedad" },
  { value: "temperatura", label: "Temperatura" },
  { value: "observacion", label: "Observación" },
];

export function AsignarTareaForm({
  lotes,
  personas,
}: {
  lotes: { id: string; nombre: string }[];
  personas: { id: string; nombre: string | null; email: string }[];
}) {
  const [loteId, setLoteId] = useState(lotes[0]?.id ?? "");
  const [asignadoA, setAsignadoA] = useState(personas[0]?.id ?? "");
  const [tipo, setTipo] = useState<RegistroTipo>("observacion");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  // Los ids se asocian con htmlFor en vez de envolver el control en el
  // <label>. Envolviéndolo, el nombre accesible del <select> incluye el texto
  // de todas sus <option>, así que un lote llamado "…otra persona registra"
  // hacía que el select de Lote se llamara "LoteLote otra persona registra…"
  // y colisionara con la etiqueta "Persona". useId garantiza que los ids sean
  // únicos aunque el formulario se renderice más de una vez en la página.
  const id = useId();

  if (lotes.length === 0 || personas.length === 0) {
    return null;
  }

  return (
    <form
      className="mt-4 flex max-w-md flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await asignarTarea(loteId, asignadoA, tipo);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo asignar.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        <label htmlFor={`${id}-lote`}>Lote</label>
        <select
          id={`${id}-lote`}
          value={loteId}
          onChange={(e) => setLoteId(e.target.value)}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        >
          {lotes.map((lote) => (
            <option key={lote.id} value={lote.id}>
              {lote.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        <label htmlFor={`${id}-persona`}>Persona</label>
        <select
          id={`${id}-persona`}
          value={asignadoA}
          onChange={(e) => setAsignadoA(e.target.value)}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        >
          {personas.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.nombre ?? persona.email}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1 font-mono text-sm text-tinta/70">
        <label htmlFor={`${id}-tipo`}>Tipo</label>
        <select
          id={`${id}-tipo`}
          value={tipo}
          onChange={(e) => setTipo(e.target.value as RegistroTipo)}
          className="border border-tinta/20 bg-transparent px-2 py-1"
        >
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-fit font-mono text-sm uppercase tracking-wide text-musgo-oscuro underline disabled:text-tinta/30 disabled:no-underline"
      >
        Asignar
      </button>
      {error && <p className="font-mono text-sm text-red-700">{error}</p>}
    </form>
  );
}
